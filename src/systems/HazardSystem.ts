import * as THREE from 'three';
import type { RaceWorld } from '../core/types';
import type { BuiltTrack } from '../tracks/TrackLoader';
import type { ObstacleRef } from '../core/Physics';
import type { AvoidPoint } from '../ai/OvertakePlanner';
import { buildCar, buildTractor, buildAnimal } from '../tracks/Props';
import { toon, glow, lambert } from '../utils/materials';
import { rand, pick } from '../utils/math';

interface Hazard {
  kind: string;
  update: (dt: number, t: number) => void;
  avoid: () => AvoidPoint | null;
}

/** 动态障碍与环境危险 */
export class HazardSystem {
  hazards: Hazard[] = [];
  private root = new THREE.Group();
  private t = 0;

  constructor(private world: RaceWorld, private built: BuiltTrack) {
    built.root.add(this.root);
    const cfg = built.geo.cfg;
    for (const h of cfg.hazards) {
      switch (h.type) {
        case 'traffic':
          for (let i = 0; i < (h.count ?? 5); i++) this.addMover('car', (i / (h.count ?? 5)) * built.geo.length, (i % 2 ? 1 : -1) * 3, 11 + Math.random() * 6);
          break;
        case 'tractor':
          this.addMover('tractor', h.t * built.geo.length, -3, 8);
          break;
        case 'animals':
          for (let i = 0; i < (h.count ?? 3); i++) this.addCrosser(cfg.id === 'jungle' ? pick(['tapir', 'monkey'] as const) : pick(['cow', 'pig', 'chicken'] as const), h.t * built.geo.length + i * 9, i * 1.7);
          break;
        case 'rockfall':
          this.addFaller('rock', h.t, h.span ?? 0.05);
          break;
        case 'meteor':
          this.addFaller('meteor', h.t, h.span ?? 0.06);
          break;
        case 'snowball':
          for (let i = 0; i < (h.count ?? 2); i++) this.addRoller('snowball', h.t * built.geo.length + i * 22, i * 2.3);
          break;
        case 'tumbleweed':
          for (let i = 0; i < (h.count ?? 6); i++) this.addRoller('tumbleweed', (i / (h.count ?? 6) + 0.05) * built.geo.length, i * 1.3);
          break;
        case 'geyser':
          for (let i = 0; i < (h.count ?? 1); i++) this.addGeyser(h.t * built.geo.length + i * 14, (i % 2 ? 1 : -1) * rand(1, built.geo.main.halfWidth - 3), i * 1.9);
          break;
        case 'crane':
          this.addCrane(h.t * built.geo.length);
          break;
        case 'beachball':
          this.addBeachBalls(h.t * built.geo.length, (h.span ?? 0.06) * built.geo.length, h.count ?? 5);
          break;
        case 'liftRamp':
          // 由 update 中统一驱动
          break;
      }
    }
    // 升降平台跳台
    const lifts = built.geo.ramps.filter((r) => r.dynamic);
    if (lifts.length) {
      this.hazards.push({
        kind: 'liftRamp',
        update: (_dt, t) => {
          lifts.forEach((r, i) => {
            const k = 0.5 + 0.5 * Math.sin(t * 0.9 + i * 2);
            r.height = r.baseHeight * (0.3 + 1.5 * k);
            const mesh = built.rampMeshes.get(r.id);
            if (mesh) mesh.scale.y = r.height;
          });
        },
        avoid: () => null,
      });
    }
  }

  private pointAt(s: number, lat: number) {
    const p = this.built.geo.main.pointAt(s);
    return { x: p.x + p.rx * lat, y: p.y, z: p.z + p.rz * lat, yaw: Math.atan2(p.tx, p.tz) };
  }

  /** 沿赛道行驶的车辆（交通车、拖拉机） */
  private addMover(kind: 'car' | 'tractor', s0: number, lat: number, speed: number) {
    const mesh = kind === 'car' ? buildCar() : buildTractor();
    this.root.add(mesh);
    const ref = this.world.physics.addKinematic('box', kind === 'car' ? [1, 0.8, 2.1] : [1.1, 1.3, 3.6], 0, 0, 0, { kind: 'solid', type: kind, mesh });
    let s = s0;
    const L = this.built.geo.length;
    const geo = this.built.geo;
    let curLat = lat;
    let laneTimer = rand(4, 9);
    this.hazards.push({
      kind,
      update: (dt) => {
        s = (s + speed * dt) % L;
        if (geo.inGap(s)) s += 20;
        laneTimer -= dt;
        // 偶尔微调车道位置（不会横穿到另一侧车道）
        if (laneTimer <= 0 && kind === 'car') {
          laneTimer = rand(5, 10);
          lat = Math.sign(lat) * rand(2.4, 3.6);
        }
        curLat += (lat - curLat) * Math.min(1, dt * 0.8);
        const p = this.pointAt(s, curLat);
        // 在跳台上：保持在地面
        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.y = p.yaw;
        const yOff = kind === 'car' ? 0.8 : 1.3;
        ref.body!.setNextKinematicTranslation({ x: p.x, y: p.y + yOff, z: p.z });
        ref.body!.setNextKinematicRotation({ x: 0, y: Math.sin(p.yaw / 2), z: 0, w: Math.cos(p.yaw / 2) });
      },
      avoid: () => ({ s: s + speed * 0.6, lat: curLat, r: kind === 'car' ? 1.3 : 1.6, weight: 7 }),
    });
  }

  /** 横穿道路的动物 */
  private addCrosser(kind: 'cow' | 'pig' | 'chicken' | 'tapir' | 'monkey', s: number, phase: number) {
    const mesh = buildAnimal(kind);
    this.root.add(mesh);
    const small = kind === 'chicken' || kind === 'monkey';
    const half = small ? [0.4, 0.5, 0.4] : [0.6, 0.9, 1.1];
    const ref = this.world.physics.addKinematic('box', half, 0, 0, 0, { kind: small ? 'breakable' : 'solid', type: kind, mesh });
    const hw = this.built.geo.main.halfWidth + 5;
    let lat = -hw;
    let dir = 1;
    let wait = phase;
    const sp = small ? 4.5 : 2.8;
    let bob = 0;
    let dead = 0;
    this.hazards.push({
      kind: 'animal',
      update: (dt) => {
        if (!ref.active) {
          dead += dt;
          if (dead > 8) {
            dead = 0;
            ref.active = true;
            mesh.visible = true;
            lat = -hw;
            dir = 1;
            wait = rand(1, 3);
          }
          return;
        }
        if (wait > 0) {
          wait -= dt;
        } else {
          lat += dir * sp * dt;
          bob += dt * 10;
          if (Math.abs(lat) > hw) {
            lat = Math.sign(lat) * hw;
            dir = -dir;
            wait = rand(2, 5);
          }
        }
        const p = this.pointAt(s, lat);
        mesh.position.set(p.x, p.y + Math.abs(Math.sin(bob)) * 0.15, p.z);
        mesh.rotation.y = p.yaw + (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        ref.body!.setNextKinematicTranslation({ x: p.x, y: p.y + half[1], z: p.z });
        ref.body!.setNextKinematicRotation({ x: 0, y: Math.sin(mesh.rotation.y / 2), z: 0, w: Math.cos(mesh.rotation.y / 2) });
      },
      avoid: () => (ref.active && Math.abs(lat) < hw - 3 ? { s, lat: lat + dir * 2, r: 1.6, weight: 6 } : null),
    });
  }

  /** 落石 / 陨石：先出现地面预警阴影，然后坠落砸地 */
  private addFaller(kind: 'rock' | 'meteor', t: number, span: number) {
    const geo = this.built.geo;
    const L = geo.length;
    const hw = geo.main.halfWidth;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), toon(kind === 'meteor' ? 0x5a4a4a : 0x7a7f8a));
    rock.castShadow = true;
    const fire = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 6), glow(0xff7a1a, 0.8));
    fire.position.y = 2.2;
    if (kind === 'meteor') rock.add(fire);
    const warn = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.9, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.7, depthWrite: false }));
    this.root.add(rock, warn);
    const ref = this.world.physics.addKinematic('ball', [1.35], 0, -500, 0, { kind: 'hazard', type: kind, mesh: rock, hazardEffect: 'crash' });
    let state: 'idle' | 'warn' | 'fall' | 'rest' = 'idle';
    let timer = rand(1, 4);
    let s = t * L;
    let lat = 0;
    let y = 0;
    let vy = 0;
    let gy = 0;
    const hide = () => {
      rock.visible = false;
      warn.visible = false;
      ref.body!.setNextKinematicTranslation({ x: 0, y: -500, z: 0 });
    };
    hide();
    this.hazards.push({
      kind,
      update: (dt) => {
        timer -= dt;
        const p = this.pointAt(s, lat);
        if (state === 'idle' && timer <= 0) {
          state = 'warn';
          timer = 1.3;
          s = (t + Math.random() * span) * L;
          lat = rand(-hw + 1.5, hw - 1.5);
          const pp = this.pointAt(s, lat);
          gy = pp.y;
          warn.visible = true;
          warn.position.set(pp.x, pp.y + 0.1, pp.z);
        } else if (state === 'warn') {
          warn.scale.setScalar(1 + Math.sin(timer * 20) * 0.1);
          if (timer <= 0) {
            state = 'fall';
            y = gy + 30;
            vy = kind === 'meteor' ? -25 : -10;
            rock.visible = true;
            ref.hazardEffect = 'crash';
            ref.kind = 'hazard';
          }
        } else if (state === 'fall') {
          vy -= 30 * dt;
          y += vy * dt;
          if (y <= gy + 1.1) {
            y = gy + 1.1;
            state = 'rest';
            timer = 5;
            warn.visible = false;
            ref.kind = 'solid';
            this.world.fx.burst(kind === 'meteor' ? 'fire' : 'smoke', p.x, gy + 0.5, p.z, 20, 8, 0.4, 1.5);
            this.world.fx.burst(kind === 'meteor' ? 'spark' : 'snow', p.x, gy + 0.5, p.z, 16, 9);
            this.world.fx.ring(p.x, gy + 0.3, p.z, 7, kind === 'meteor' ? 0xff7a1a : 0xffffff);
            this.world.events.emit('sfx', { name: 'explode', x: p.x, y: gy, z: p.z, volume: 0.7, pitch: 0.6 });
            fire.visible = false;
          }
        } else if (state === 'rest' && timer <= 0) {
          state = 'idle';
          timer = rand(2.5, 5);
          fire.visible = true;
          hide();
          return;
        }
        if (state === 'fall' || state === 'rest') {
          rock.position.set(p.x, y, p.z);
          rock.rotation.x += dt * (state === 'fall' ? 4 : 0);
          ref.body!.setNextKinematicTranslation({ x: p.x, y, z: p.z });
        }
      },
      avoid: () => (state === 'warn' || state === 'fall' || state === 'rest' ? { s, lat, r: 1.8, weight: 9 } : null),
    });
  }

  /** 横向滚过的雪球 / 风滚草 */
  private addRoller(kind: 'snowball' | 'tumbleweed', s: number, phase: number) {
    const hw = this.built.geo.main.halfWidth + 6;
    const big = kind === 'snowball';
    const r = big ? 1.4 : 0.8;
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, big ? 1 : 0),
      big ? toon(0xffffff) : new THREE.MeshLambertMaterial({ color: 0xb08a4a, wireframe: true }),
    );
    mesh.castShadow = true;
    this.root.add(mesh);
    const ref = this.world.physics.addKinematic('ball', [r * 0.9], 0, -500, 0, {
      kind: big ? 'hazard' : 'breakable',
      type: kind,
      mesh,
      hazardEffect: 'launch',
    });
    let lat = -hw;
    let dir = 1;
    let wait = phase;
    let ss = s;
    const L = this.built.geo.length;
    this.hazards.push({
      kind,
      update: (dt) => {
        if (!ref.active) {
          // 风滚草被撞碎后重生
          wait -= dt;
          if (wait < -6) {
            ref.active = true;
            mesh.visible = true;
            mesh.scale.setScalar(1);
            this.root.add(mesh);
          }
          return;
        }
        if (wait > 0) {
          wait -= dt;
          mesh.visible = false;
          ref.body!.setNextKinematicTranslation({ x: 0, y: -500, z: 0 });
          return;
        }
        mesh.visible = true;
        lat += dir * (big ? 6 : 7) * dt;
        if (Math.abs(lat) > hw) {
          dir = -dir;
          lat = Math.sign(lat) * hw;
          wait = rand(1.5, 4);
          if (!big) ss = (ss + rand(100, 300)) % L;
        }
        const p = this.pointAt(ss, lat);
        const y = p.y + r + (big ? 0 : Math.abs(Math.sin(lat)) * 0.8);
        mesh.position.set(p.x, y, p.z);
        mesh.rotation.z -= dir * dt * 5;
        mesh.rotation.y = p.yaw;
        ref.body!.setNextKinematicTranslation({ x: p.x, y, z: p.z });
      },
      avoid: () => (ref.active && wait <= 0 ? { s: ss, lat: lat + dir * 3, r: r + 0.8, weight: big ? 8 : 3 } : null),
    });
  }

  /** 岩浆间歇喷发 */
  private addGeyser(s: number, lat: number, phase: number) {
    const p = this.pointAt(s, lat);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.3, 10), glow(0x7a1a0a));
    vent.position.set(p.x, p.y + 0.1, p.z);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 12, 10, 1, true), glow(0xff6a1a, 0.85));
    column.position.set(p.x, p.y + 6, p.z);
    column.visible = false;
    this.root.add(vent, column);
    const ref = this.world.physics.addKinematic('cylinder', [1.4, 5], p.x, -500, p.z, { kind: 'hazard', type: 'geyser', mesh: column, hazardEffect: 'launch' });
    let timer = 2 + phase;
    let st: 'idle' | 'warn' | 'erupt' = 'idle';
    const vm = vent.material as THREE.MeshBasicMaterial;
    this.hazards.push({
      kind: 'geyser',
      update: (dt, t) => {
        timer -= dt;
        if (st === 'idle') {
          vm.color.setHex(0x7a1a0a);
          if (timer <= 0) {
            st = 'warn';
            timer = 1.3;
          }
        } else if (st === 'warn') {
          vm.color.setHex(Math.sin(t * 30) > 0 ? 0xff5a1f : 0xffd23f);
          if (Math.random() < 0.4) this.world.fx.spawn('lava', p.x + rand(-1, 1), p.y + 0.4, p.z + rand(-1, 1), 0, rand(3, 6), 0);
          if (timer <= 0) {
            st = 'erupt';
            timer = 1.6;
            column.visible = true;
            ref.body!.setNextKinematicTranslation({ x: p.x, y: p.y + 5, z: p.z });
            this.world.events.emit('sfx', { name: 'geyser', x: p.x, y: p.y, z: p.z });
          }
        } else {
          column.scale.set(1 + Math.sin(t * 25) * 0.08, Math.min(1, (1.6 - timer) * 5), 1 + Math.cos(t * 25) * 0.08);
          column.position.y = p.y + 6 * column.scale.y;
          if (Math.random() < 0.7) this.world.fx.spawn('lava', p.x + rand(-1, 1), p.y + 10, p.z + rand(-1, 1), rand(-4, 4), rand(4, 10), rand(-4, 4));
          if (timer <= 0) {
            st = 'idle';
            timer = rand(2.5, 4.5);
            column.visible = false;
            ref.body!.setNextKinematicTranslation({ x: p.x, y: -500, z: p.z });
          }
        }
      },
      avoid: () => (st !== 'idle' ? { s, lat, r: 2.2, weight: 10 } : null),
    });
  }

  /** 港口吊车：吊运集装箱来回扫过赛道 */
  private addCrane(s: number) {
    const geo = this.built.geo;
    const hw = geo.main.halfWidth;
    const base = this.pointAt(s, hw + 6);
    const crane = new THREE.Group();
    const y = lambert(0xf2b632);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(1.2, 18, 1.2), y);
    tower.position.y = 9;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 1, hw * 2 + 14), y);
    arm.position.set(0, 18, 0);
    crane.add(tower, arm);
    crane.position.set(base.x, base.y, base.z);
    const center = this.pointAt(s, 0);
    crane.lookAt(center.x, base.y, center.z);
    arm.position.z = hw + 4;
    this.root.add(crane);
    const cont = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 5.5), toon(pick([0xd63a2f, 0x2f6fd6, 0x2fae5a])));
    box.castShadow = true;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 14, 4), lambert(0x333333));
    cable.position.y = 8;
    cont.add(box, cable);
    this.root.add(cont);
    const ref = this.world.physics.addKinematic('box', [1.2, 1.2, 2.75], 0, 0, 0, { kind: 'solid', type: 'container', mesh: cont });
    let lat = 0;
    this.hazards.push({
      kind: 'crane',
      update: (_dt, t) => {
        lat = Math.sin(t * 0.55 + s) * (hw + 2);
        const p = this.pointAt(s, lat);
        const hover = 1.2 + Math.max(0, Math.cos(t * 0.55 + s)) * 0.3;
        cont.position.set(p.x, p.y + hover, p.z);
        cont.rotation.y = p.yaw;
        ref.body!.setNextKinematicTranslation({ x: p.x, y: p.y + hover, z: p.z });
        ref.body!.setNextKinematicRotation({ x: 0, y: Math.sin(p.yaw / 2), z: 0, w: Math.cos(p.yaw / 2) });
      },
      avoid: () => ({ s, lat, r: 2.2, weight: 8 }),
    });
  }

  /** 沙滩球：Rapier 动态刚体，被撞后满地乱弹 */
  private addBeachBalls(s0: number, span: number, count: number) {
    const hw = this.built.geo.main.halfWidth;
    const refs: ObstacleRef[] = [];
    for (let i = 0; i < count; i++) {
      const s = s0 + Math.random() * span;
      const p = this.pointAt(s, rand(-hw + 2, hw - 2));
      const g = new THREE.Group();
      const cols = [0xff4d6d, 0xffffff, 0x3fa9f5, 0xffd23f];
      for (let k = 0; k < 4; k++) {
        const seg = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6, (k * Math.PI) / 2, Math.PI / 2), toon(cols[k]));
        seg.castShadow = true;
        g.add(seg);
      }
      this.root.add(g);
      refs.push(this.world.physics.addDynamicBall(p.x, p.y + 1, p.z, 0.7, g, { kind: 'ball', type: 'beachball' }));
    }
    this.hazards.push({
      kind: 'beachball',
      update: () => {
        for (const r of refs) this.world.physics.syncDynamic(r);
      },
      avoid: () => null,
    });
  }

  update(dt: number) {
    this.t += dt;
    for (const h of this.hazards) h.update(dt, this.t);
  }

  /** 供 AI 避障使用的动态障碍点（主赛道坐标） */
  avoidPoints(): AvoidPoint[] {
    const out: AvoidPoint[] = [];
    for (const h of this.hazards) {
      const a = h.avoid();
      if (a) out.push(a);
    }
    return out;
  }
}
