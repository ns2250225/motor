import * as THREE from 'three';
import type { RaceWorld } from '../core/types';
import type { Racer } from '../entities/Racer';
import { Projectile, ProjectileKind, buildFishMesh } from '../entities/Projectile';
import { getItem, rollItem, ItemId } from '../data/items';
import type { GroundInfo } from '../tracks/TrackGeometry';
import { toon, glow, textTexture } from '../utils/materials';

interface ItemBox {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  respawn: number;
}

interface Trap {
  mesh: THREE.Object3D;
  x: number;
  y: number;
  z: number;
  life: number;
  owner: Racer;
  armed: number;
}

interface Cloud {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  r: number;
  life: number;
  kind: 'stink' | 'ink';
  owner: Racer;
  hit: Set<Racer>;
}

let boxTex: THREE.Texture | null = null;

/** 道具系统：道具箱拾取、喉囊储存、喷射投射物、陷阱与烟雾区域 */
export class ItemSystem {
  boxes: ItemBox[] = [];
  projectiles: Projectile[] = [];
  traps: Trap[] = [];
  clouds: Cloud[] = [];
  private ground: GroundInfo = {
    y: 0, surface: 'asphalt', onRoad: true, roadIdx: 0, mainS: 0, mainLateral: 0, mainIndex: 0, shortcutU: -1,
    barrierNx: 0, barrierNz: 0, barrierDepth: 0, boost: false, rampId: -1, tx: 0, tz: 1,
  };
  private t = 0;

  constructor(private world: RaceWorld, private root: THREE.Group) {}

  private boxMesh() {
    if (!boxTex) boxTex = textTexture('?', '#ff9f1c', '#ffffff', 128, 128, 'bold 96px sans-serif');
    const g = new THREE.Group();
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 1.3), new THREE.MeshLambertMaterial({ map: boxTex, emissive: 0x663300, emissiveIntensity: 0.4 }));
    cube.castShadow = true;
    g.add(cube);
    const fish = buildFishMesh(0x4fb3ff, 0.8);
    fish.position.y = 1.4;
    g.add(fish);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 4, 20), glow(0xffe14a));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.6;
    g.add(ring);
    return g;
  }

  addBox(x: number, y: number, z: number) {
    const mesh = this.boxMesh();
    mesh.position.set(x, y + 1.3, z);
    this.root.add(mesh);
    this.boxes.push({ mesh, x, y: y + 1.3, z, respawn: 0 });
  }

  /** 移除指定位置之前的道具箱（无尽模式回收） */
  pruneBoxes(pred: (b: { x: number; z: number }) => boolean) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      if (pred(this.boxes[i])) {
        this.boxes[i].mesh.removeFromParent();
        this.boxes.splice(i, 1);
      }
    }
  }

  update(dt: number) {
    const w = this.world;
    this.t += dt;
    // 道具箱
    for (const b of this.boxes) {
      if (b.respawn > 0) {
        b.respawn -= dt;
        if (b.respawn <= 0) {
          b.mesh.visible = true;
          b.mesh.scale.setScalar(0.1);
        }
        continue;
      }
      b.mesh.rotation.y += dt * 1.6;
      b.mesh.position.y = b.y + Math.sin(this.t * 3 + b.x) * 0.15;
      if (b.mesh.scale.x < 1) b.mesh.scale.setScalar(Math.min(1, b.mesh.scale.x + dt * 3));
      for (const r of w.racers) {
        if (r.state !== 'driving') continue;
        const dx = r.pos.x - b.x;
        const dz = r.pos.z - b.z;
        const dy = r.pos.y + 1 - b.y;
        if (dx * dx + dz * dz < 5.2 && Math.abs(dy) < 2.5) {
          b.respawn = w.chaos ? 1.5 : 4;
          b.mesh.visible = false;
          w.fx.burst('confetti', b.x, b.y, b.z, 12, 5);
          if (r.item === null && w.mode !== 'timetrial') {
            r.item = rollItem(r.place, w.racers.length, r.mods.item);
            r.pelican.trigger('shout');
            w.events.emit('sfx', { name: 'pickup', racer: r });
            if (r.isPlayer) w.events.emit('notify', { text: `获得 ${getItem(r.item).icon} ${getItem(r.item).name}，存入喉囊`, kind: 'info', racer: r });
          }
          break;
        }
      }
    }
    this.updateProjectiles(dt);
    this.updateTraps(dt);
    this.updateClouds(dt);
  }

  /** 使用喉囊中的道具 */
  use(r: Racer) {
    const it = r.item;
    if (!it || r.state !== 'driving') return;
    const w = this.world;
    r.item = null;
    r.stat.itemsUsed.add(it);
    w.events.emit('item', { racer: r, item: it });
    const im = r.mods.item * (w.chaos ? 1.3 : 1);
    switch (it) {
      case 'stinkBomb':
        this.spit(r, 'stinkBomb', 0x8fbf3a, 20, 7);
        break;
      case 'frozenFish':
        this.spit(r, 'frozenFish', 0x8fe3ff, 34, 0);
        break;
      case 'puffer':
        this.spit(r, 'puffer', 0xffcf4a, 26, 4);
        break;
      case 'rocketFish': {
        const p = this.spit(r, 'rocketFish', 0xff5a36, 30, 2);
        p.target = this.findTargetAhead(r);
        w.events.emit('sfx', { name: 'rocket', racer: r });
        break;
      }
      case 'sardine':
        r.nitro = r.stats.nitroCapacity;
        r.boostTimer = Math.max(r.boostTimer, 0.8);
        r.pelican.trigger('shout');
        w.fx.burst('water', r.pos.x, r.pos.y + 1.8, r.pos.z, 10, 4);
        w.events.emit('sfx', { name: 'gold', racer: r, pitch: 1.4 });
        if (r.isPlayer) w.events.emit('notify', { text: '氮气全满！', kind: 'good', racer: r });
        break;
      case 'featherStorm': {
        w.fx.burst('feather', r.pos.x, r.pos.y + 2, r.pos.z, 70, 14, 0.4, 1.6);
        w.events.emit('sfx', { name: 'wing', racer: r, pitch: 0.7 });
        r.pelican.trigger('wingL');
        r.pelican.trigger('wingR');
        const rad = 24 * im;
        for (const o of w.racers) {
          if (o === r || o.state !== 'driving' || o.invincible) continue;
          if (o.pos.distanceTo(r.pos) < rad) {
            o.blind = 3 * im;
            o.wobble = Math.max(o.wobble, 0.3);
            if (o.isPlayer) w.events.emit('vision', { kind: 'feather', duration: 3 * im, racer: o });
            w.events.emit('hit', { attacker: r, target: o, kind: 'feather', damage: 0 });
            r.stat.hits++;
          }
        }
        break;
      }
      case 'banana': {
        const mesh = new THREE.Group();
        const peel = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.35, 5), toon(0xffe14a));
        peel.castShadow = true;
        mesh.add(peel);
        for (let i = 0; i < 4; i++) {
          const flap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.7), toon(0xf5d020));
          flap.rotation.y = (i / 4) * Math.PI * 2;
          flap.translateZ(0.45);
          flap.rotation.x = 0.4;
          mesh.add(flap);
        }
        const x = r.pos.x - r.forwardX * 3;
        const z = r.pos.z - r.forwardZ * 3;
        w.track.query(x, z, r.pos.y + 1, r.hint, this.ground);
        const y = this.ground.y ?? r.pos.y;
        mesh.position.set(x, y + 0.15, z);
        this.root.add(mesh);
        this.traps.push({ mesh, x, y, z, life: 30, owner: r, armed: 0.4 });
        w.events.emit('sfx', { name: 'throw', racer: r });
        break;
      }
      case 'goldenCarp':
        r.golden = 5 * im;
        r.wobble = 0;
        r.frozen = 0;
        r.slippery = 0;
        w.fx.burst('gold', r.pos.x, r.pos.y + 1.2, r.pos.z, 20, 6);
        w.events.emit('sfx', { name: 'gold', racer: r });
        if (r.isPlayer) w.events.emit('notify', { text: '黄金鲤鱼：无敌！', kind: 'big', racer: r });
        break;
      case 'inkCloud': {
        const x = r.pos.x - r.forwardX * 5;
        const z = r.pos.z - r.forwardZ * 5;
        this.addCloud('ink', r, x, r.pos.y, z, 6.5 * im, 7);
        r.pelican.trigger('spit');
        w.events.emit('sfx', { name: 'splat', racer: r });
        break;
      }
      case 'fishBone':
        r.boneTimer = 6 * im;
        r.pelican.setBone(true);
        w.events.emit('sfx', { name: 'whoosh', racer: r, pitch: 0.7 });
        if (r.isPlayer) w.events.emit('notify', { text: '巨型鱼骨！靠近对手自动横扫', kind: 'info', racer: r });
        break;
    }
  }

  /** 从大嘴向前喷射 */
  private spit(r: Racer, kind: ProjectileKind, color: number, speed: number, up: number) {
    const p = new Projectile(kind, r, color);
    p.pos.set(r.pos.x + r.forwardX * 2, r.pos.y + 1.9, r.pos.z + r.forwardZ * 2);
    const fwd = Math.max(0, r.speed) + speed;
    p.vel.set(r.forwardX * fwd, up, r.forwardZ * fwd);
    p.hint = r.hint;
    p.mesh.position.copy(p.pos);
    this.root.add(p.mesh);
    this.projectiles.push(p);
    r.pelican.trigger('spit');
    this.world.events.emit('sfx', { name: 'throw', racer: r });
    return p;
  }

  findTargetAhead(r: Racer): Racer | null {
    let best: Racer | null = null;
    let bestD = Infinity;
    for (const o of this.world.racers) {
      if (o === r || o.state === 'eliminated' || o.finished) continue;
      const d = o.progress - r.progress;
      if (d > 0 && d < bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private updateProjectiles(dt: number) {
    const w = this.world;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const gq = w.track.query(p.pos.x, p.pos.z, p.pos.y + 2, p.hint, this.ground);
      p.hint = gq.mainIndex;
      const gy = gq.y;
      const speedH = Math.hypot(p.vel.x, p.vel.z);
      // 沿赛道方向修正（避免撞墙）
      const steerTo = (tx: number, tz: number, rate: number) => {
        const cur = Math.atan2(p.vel.x, p.vel.z);
        let tgt = Math.atan2(tx, tz);
        let d = tgt - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        tgt = cur + Math.max(-rate * dt, Math.min(rate * dt, d));
        p.vel.x = Math.sin(tgt) * speedH;
        p.vel.z = Math.cos(tgt) * speedH;
      };
      if (p.kind === 'rocketFish' && p.target && p.target.state !== 'eliminated') {
        const t = p.target;
        steerTo(t.pos.x - p.pos.x, t.pos.z - p.pos.z, 4);
        const sp = Math.min(60, speedH + 30 * dt);
        const l = Math.hypot(p.vel.x, p.vel.z) || 1;
        p.vel.x = (p.vel.x / l) * sp;
        p.vel.z = (p.vel.z / l) * sp;
        p.vel.y = (t.pos.y + 1 - p.pos.y) * 4;
        if (Math.random() < 0.6) w.fx.spawn('fire', p.pos.x, p.pos.y, p.pos.z, -p.vel.x * 0.05, 0.5, -p.vel.z * 0.05);
      } else if (p.kind === 'frozenFish' || p.kind === 'puffer' || p.kind === 'rocketFish') {
        // 弱追踪：前方小角度内的目标
        let tgt: Racer | null = null;
        if (p.kind === 'frozenFish') {
          let bestA = 0.5;
          for (const o of w.racers) {
            if (o === p.owner || o.state !== 'driving') continue;
            const dx = o.pos.x - p.pos.x;
            const dz = o.pos.z - p.pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 40) continue;
            const a = Math.acos(Math.max(-1, Math.min(1, (dx * p.vel.x + dz * p.vel.z) / (dist * speedH + 1e-6))));
            if (a < bestA) {
              bestA = a;
              tgt = o;
            }
          }
        }
        if (tgt) steerTo(tgt.pos.x - p.pos.x, tgt.pos.z - p.pos.z, 2.5);
        else steerTo(gq.tx, gq.tz, 1.2);
      }
      if (p.kind === 'stinkBomb' || p.kind === 'puffer') {
        p.vel.y -= w.gravity * dt;
      } else if (p.kind === 'frozenFish' && gy !== null) {
        p.pos.y += ((gy + 0.9) - p.pos.y) * Math.min(1, dt * 8);
      }
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = Math.atan2(p.vel.x, p.vel.z);
      if (p.kind === 'puffer') p.mesh.rotation.x += dt * 8;

      // 着地
      if (gy !== null && p.pos.y < gy + 0.3) {
        if (p.kind === 'stinkBomb') {
          this.explodeStink(p);
          this.removeProjectile(i);
          continue;
        }
        if (p.kind === 'puffer') {
          p.pos.y = gy + 0.3;
          p.vel.y = 8;
          p.bounces++;
          w.events.emit('sfx', { name: 'boing', x: p.pos.x, y: p.pos.y, z: p.pos.z, volume: 0.5 });
        }
      }
      // 撞墙
      if (gq.barrierDepth > 0.5 && p.kind !== 'rocketFish') {
        w.fx.burst('smoke', p.pos.x, p.pos.y, p.pos.z, 5, 3);
        if (p.kind === 'stinkBomb') this.explodeStink(p);
        this.removeProjectile(i);
        continue;
      }
      // 命中骑手
      let hit: Racer | null = null;
      for (const o of w.racers) {
        if (o.state !== 'driving' && o.state !== 'finished') continue;
        if (o === p.owner && p.life > (p.kind === 'rocketFish' ? 6.5 : 3.4)) continue;
        if (o === p.owner && p.kind !== 'puffer') continue;
        const dx = o.pos.x - p.pos.x;
        const dy = o.pos.y + 1 - p.pos.y;
        const dz = o.pos.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < 3.4) {
          hit = o;
          break;
        }
      }
      if (hit) {
        this.onProjectileHit(p, hit);
        this.removeProjectile(i);
        continue;
      }
      if (p.life <= 0 || (gy === null && p.pos.y < -100)) {
        if (p.kind === 'stinkBomb') this.explodeStink(p);
        else w.fx.burst('smoke', p.pos.x, p.pos.y, p.pos.z, 4, 2);
        this.removeProjectile(i);
      }
    }
  }

  private onProjectileHit(p: Projectile, o: Racer) {
    const w = this.world;
    const im = p.owner.mods.item * (w.chaos ? 1.3 : 1);
    if (o.invincible) {
      w.fx.burst('gold', p.pos.x, p.pos.y, p.pos.z, 8, 4);
      return;
    }
    p.owner.stat.hits++;
    w.events.emit('hit', { attacker: p.owner, target: o, kind: p.kind, damage: 0 });
    switch (p.kind) {
      case 'frozenFish':
        o.frozen = 2.5 * im;
        o.damage(10, p.owner, 'frozen');
        w.fx.burst('ice', o.pos.x, o.pos.y + 1, o.pos.z, 16, 6);
        w.events.emit('sfx', { name: 'freeze', racer: o });
        if (o.isPlayer) w.events.emit('notify', { text: '被冻住了！', kind: 'bad', racer: o });
        break;
      case 'puffer':
        o.lastAttacker = p.owner;
        o.lastAttackTime = w.time;
        o.crash('puffer', p.owner, 14);
        o.vy = 12;
        w.events.emit('sfx', { name: 'boing', racer: o });
        w.fx.ring(o.pos.x, o.pos.y + 0.5, o.pos.z, 4, 0xffcf4a);
        break;
      case 'rocketFish':
        o.lastAttacker = p.owner;
        o.lastAttackTime = w.time;
        o.crash('rocket', p.owner, 12);
        w.fx.burst('boom', p.pos.x, p.pos.y, p.pos.z, 8, 4);
        w.fx.burst('spark', p.pos.x, p.pos.y, p.pos.z, 16, 9);
        w.events.emit('sfx', { name: 'explode', racer: o });
        break;
      case 'stinkBomb':
        this.explodeStink(p);
        break;
    }
  }

  private explodeStink(p: Projectile) {
    const w = this.world;
    const im = p.owner.mods.item * (w.chaos ? 1.3 : 1);
    w.fx.burst('stink', p.pos.x, p.pos.y + 0.5, p.pos.z, 24, 5, 0.3, 1.2);
    w.fx.ring(p.pos.x, p.pos.y + 0.3, p.pos.z, 8, 0x9acd32);
    w.events.emit('sfx', { name: 'explode', x: p.pos.x, y: p.pos.y, z: p.pos.z, pitch: 0.7 });
    const rad = 7.5 * im;
    for (const o of w.racers) {
      if (o.state !== 'driving' || o.invincible) continue;
      const d = o.pos.distanceTo(p.pos);
      if (d < rad) {
        o.slippery = 2.2 * im;
        o.damage(12, p.owner === o ? null : p.owner, 'stink');
        if (d < 3.5) o.spinOut(0.8);
        if (o !== p.owner) {
          p.owner.stat.hits++;
          w.events.emit('hit', { attacker: p.owner, target: o, kind: 'stink', damage: 12 });
        }
      }
    }
    this.addCloud('stink', p.owner, p.pos.x, p.pos.y, p.pos.z, 6 * im, 3.5);
  }

  private addCloud(kind: 'stink' | 'ink', owner: Racer, x: number, y: number, z: number, r: number, life: number) {
    const g = new THREE.Group();
    const color = kind === 'ink' ? 0x2b1d48 : 0x9acd32;
    const mat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
    for (let i = 0; i < 9; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), mat);
      const a = (i / 9) * Math.PI * 2;
      puff.position.set(Math.cos(a) * r * 0.5 * Math.random(), Math.random() * 1.5 + 0.5, Math.sin(a) * r * 0.5 * Math.random());
      puff.scale.setScalar(r * 0.35 * (0.6 + Math.random() * 0.6));
      g.add(puff);
    }
    g.position.set(x, y, z);
    this.root.add(g);
    this.clouds.push({ mesh: g, x, y, z, r, life, kind, owner, hit: new Set() });
  }

  private updateTraps(dt: number) {
    const w = this.world;
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.life -= dt;
      t.armed -= dt;
      t.mesh.rotation.y += dt * 0.5;
      let triggered = false;
      if (t.armed <= 0) {
        for (const o of w.racers) {
          if (o.state !== 'driving' || !o.grounded) continue;
          const dx = o.pos.x - t.x;
          const dz = o.pos.z - t.z;
          if (dx * dx + dz * dz < 2.3 && Math.abs(o.pos.y - t.y) < 1.5) {
            if (!o.invincible) {
              o.spinOut(1.2);
              o.lastAttacker = t.owner !== o ? t.owner : null;
              o.lastAttackTime = w.time;
              if (t.owner !== o) {
                t.owner.stat.hits++;
                w.events.emit('hit', { attacker: t.owner, target: o, kind: 'banana', damage: 0 });
              }
              if (o.isPlayer) w.events.emit('notify', { text: '踩到香蕉鱼皮！', kind: 'bad', racer: o });
            }
            triggered = true;
            break;
          }
        }
      }
      if (triggered || t.life <= 0) {
        t.mesh.removeFromParent();
        this.traps.splice(i, 1);
      }
    }
  }

  private updateClouds(dt: number) {
    const w = this.world;
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.life -= dt;
      c.mesh.rotation.y += dt * 0.3;
      const fade = Math.min(1, c.life / 1);
      c.mesh.scale.setScalar(0.6 + 0.4 * fade + (1 - fade) * 0.3);
      for (const o of w.racers) {
        if (o.state !== 'driving' || c.hit.has(o) || (o === c.owner && c.life > 0.5)) continue;
        if (o === c.owner) continue;
        const dx = o.pos.x - c.x;
        const dz = o.pos.z - c.z;
        if (dx * dx + dz * dz < c.r * c.r && Math.abs(o.pos.y - c.y) < 4) {
          c.hit.add(o);
          if (o.invincible) continue;
          if (c.kind === 'ink') {
            o.blind = 2.6;
            o.speed *= 0.75;
            o.wobble = Math.max(o.wobble, 0.4);
            if (o.isPlayer) w.events.emit('vision', { kind: 'ink', duration: 2.6, racer: o });
          } else {
            o.slippery = 1.8;
            o.wobble = Math.max(o.wobble, 0.3);
          }
          c.owner.stat.hits++;
          w.events.emit('hit', { attacker: c.owner, target: o, kind: c.kind, damage: 0 });
          w.events.emit('sfx', { name: 'splat', racer: o });
        }
      }
      if (c.life <= 0) {
        c.mesh.removeFromParent();
        this.clouds.splice(i, 1);
      }
    }
  }

  private removeProjectile(i: number) {
    this.projectiles[i].mesh.removeFromParent();
    this.projectiles.splice(i, 1);
  }

  /** AI 使用：评估当前道具是否值得使用 */
  static itemKind(it: ItemId) {
    return getItem(it).kind;
  }

  clear() {
    for (const p of this.projectiles) p.mesh.removeFromParent();
    for (const t of this.traps) t.mesh.removeFromParent();
    for (const c of this.clouds) c.mesh.removeFromParent();
    this.projectiles = [];
    this.traps = [];
    this.clouds = [];
  }
}
