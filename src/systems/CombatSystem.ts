import type { Racer } from '../entities/Racer';
import type { RaceWorld } from '../core/types';
import { clamp } from '../utils/math';
import { vibrate } from '../utils/device';

export type AttackKind = 'wingL' | 'wingR' | 'peck' | 'sweep' | 'clamp';

interface PendingAttack {
  attacker: Racer;
  kind: AttackKind;
  delay: number;
  window: number;
  hit: Set<Racer>;
}

/** J/K/L（翅膀拍击、啄击）无冷却，可连续出招；横扫与夹击保留冷却 */
export const COOLDOWNS: Record<AttackKind, number> = { wingL: 0, wingR: 0, peck: 0, sweep: 4, clamp: 8 };

/** 相对坐标：目标在攻击者坐标系中的纵向/横向偏移 */
export function relative(a: Racer, b: Racer) {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  return {
    lon: dx * a.forwardX + dz * a.forwardZ,
    lat: dx * a.rightX + dz * a.rightZ,
    dy: b.pos.y - a.pos.y,
    dist: Math.hypot(dx, dz),
  };
}

/** 攻击判定框：按距离、方向判断命中（独立命中盒，避免穿模问题） */
export function inAttackRange(kind: AttackKind, a: Racer, b: Racer) {
  const r = relative(a, b);
  if (Math.abs(r.dy) > 2.6) return false;
  switch (kind) {
    case 'wingL':
      return r.lat < -0.2 && r.lat > -6.5 && r.lon > -4 && r.lon < 4.5;
    case 'wingR':
      return r.lat > 0.2 && r.lat < 6.5 && r.lon > -4 && r.lon < 4.5;
    case 'peck':
      return r.lon > 0.6 && r.lon < 8.5 && Math.abs(r.lat) < 3.2;
    case 'sweep':
      return r.lon > -3.5 && r.lon < 5 && Math.abs(r.lat) < 5;
    case 'clamp':
      return r.lon > 0.2 && r.lon < 7 && Math.abs(r.lat) < 3.2;
  }
}

/** 鹈鹕战斗系统 */
export class CombatSystem {
  private pending: PendingAttack[] = [];
  private boneHits = new Map<Racer, Map<Racer, number>>();

  constructor(private world: RaceWorld) {}

  canTarget(b: Racer, a: Racer) {
    return b !== a && b.state === 'driving' && !b.finished;
  }

  /** 处理一名骑手的攻击输入 */
  handleInput(r: Racer) {
    if (r.state !== 'driving' || !this.world.started || this.world.mode === 'timetrial') return;
    const inp = r.input;
    const cdMul = r.mods.cooldown;
    const p = r.pelican;
    if (inp.attackL && r.cd.wingL <= 0) {
      r.cd.wingL = COOLDOWNS.wingL * cdMul;
      p.trigger('wingL');
      this.queue(r, 'wingL', 0.02, 0.14);
      this.sfx(r, 'wing');
    }
    if (inp.attackR && r.cd.wingR <= 0) {
      r.cd.wingR = COOLDOWNS.wingR * cdMul;
      p.trigger('wingR');
      this.queue(r, 'wingR', 0.02, 0.14);
      this.sfx(r, 'wing');
    }
    if (inp.peck && r.cd.peck <= 0) {
      r.cd.peck = COOLDOWNS.peck * cdMul;
      p.trigger('peck');
      this.queue(r, 'peck', 0.02, 0.12);
      this.sfx(r, 'peck');
    }
    if (inp.sweep && r.cd.sweep <= 0) {
      r.cd.sweep = COOLDOWNS.sweep * cdMul;
      p.trigger('sweep');
      this.queue(r, 'sweep', 0.08, 0.38);
      this.sfx(r, 'whoosh');
    }
    if (inp.clamp && r.cd.clamp <= 0 && !r.clampTarget) {
      r.cd.clamp = COOLDOWNS.clamp * cdMul;
      p.trigger('clamp');
      this.queue(r, 'clamp', 0.22, 0.16);
      this.sfx(r, 'squawk', r.pelicanDef.voicePitch);
    }
    if (inp.superDash && r.energy >= 100 && r.superDash <= 0) {
      r.energy = 0;
      r.superDash = 1.6;
      r.speed = Math.max(r.speed, r.stats.maxSpeed * 1.2);
      p.trigger('clamp');
      p.trigger('shout');
      this.sfx(r, 'rocket');
      this.sfx(r, 'squawk', r.pelicanDef.voicePitch * 0.8);
      if (r.isPlayer) this.world.events.emit('notify', { text: '超级鹈鹕冲刺！', kind: 'big', racer: r });
    }
    if (inp.horn && r.hornCd <= 0) {
      r.hornCd = 0.6;
      this.world.events.emit('sfx', { name: 'horn', racer: r });
      p.trigger('shout');
    }
  }

  private sfx(r: Racer, name: 'wing' | 'peck' | 'whoosh' | 'squawk' | 'rocket', pitch = 1) {
    this.world.events.emit('sfx', { name, racer: r, pitch });
  }

  private queue(attacker: Racer, kind: AttackKind, delay: number, window: number) {
    this.pending.push({ attacker, kind, delay, window, hit: new Set() });
  }

  update(dt: number) {
    const w = this.world;
    const racers = w.racers;
    // 攻击判定窗口
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const a = this.pending[i];
      if (a.attacker.state !== 'driving') {
        this.pending.splice(i, 1);
        continue;
      }
      a.delay -= dt;
      if (a.delay > 0) continue;
      a.window -= dt;
      for (const b of racers) {
        if (!this.canTarget(b, a.attacker) || a.hit.has(b)) continue;
        if (a.kind === 'clamp' && a.hit.size > 0) break;
        if (inAttackRange(a.kind, a.attacker, b)) {
          a.hit.add(b);
          this.applyHit(a.attacker, b, a.kind);
        }
      }
      if (a.window <= 0) {
        if (a.hit.size === 0 && a.attacker.isPlayer && a.kind !== 'sweep') {
          // 未命中提示（可选）
        }
        this.pending.splice(i, 1);
      }
    }

    // 夹击过程
    for (const r of racers) {
      if (r.clampTarget) this.updateClamp(r, dt);
      if (r.boneTimer > 0 && r.state === 'driving') this.updateBone(r);
    }

    // 摩托冲撞（两两检测）
    for (let i = 0; i < racers.length; i++) {
      const a = racers[i];
      if (!this.collidable(a)) continue;
      for (let j = i + 1; j < racers.length; j++) {
        const b = racers[j];
        if (!this.collidable(b)) continue;
        this.collide(a, b);
      }
    }
  }

  private collidable(r: Racer) {
    return (r.state === 'driving' || r.state === 'finished') && !(r.state === 'finished' && r.isPlayer && false);
  }

  private applyHit(a: Racer, b: Racer, kind: AttackKind) {
    const w = this.world;
    const atk = a.mods.attack * (w.chaos ? 1.3 : 1);
    if (b.invincible) {
      w.fx.burst('gold', b.pos.x, b.pos.y + 1.2, b.pos.z, 6, 4);
      return;
    }
    const r = relative(a, b);
    let dmg = 0;
    switch (kind) {
      case 'wingL':
      case 'wingR': {
        dmg = 20 * atk;
        const side = kind === 'wingL' ? -1 : 1;
        // 夸张横飞：大力侧推 + 弹离地面
        b.push(a.rightX * side, a.rightZ * side, 20 * atk);
        this.popUp(b, 6);
        b.wobble = Math.max(b.wobble, 0.7);
        b.pelican.setDizzy(1);
        w.events.emit('sfx', { name: 'bigHit', racer: b });
        w.events.emit('sfx', { name: 'boing', racer: b, pitch: 0.8 });
        const hx = (a.pos.x + b.pos.x) / 2;
        const hz = (a.pos.z + b.pos.z) / 2;
        w.fx.ring(hx, a.pos.y + 1.2, hz, 6, 0xffffff);
        w.fx.burst('feather', hx, a.pos.y + 1.5, hz, 24, 9, 0.5, 1.3);
        w.fx.burst('star', b.pos.x, b.pos.y + 1.8, b.pos.z, 8, 6);
        break;
      }
      case 'peck':
        dmg = 28 * atk;
        // 一嘴啄飞：向前顶出、弹起、明显减速
        b.speed *= 0.55;
        b.wobble = Math.max(b.wobble, 0.9);
        b.push(a.forwardX, a.forwardZ, 14 * atk);
        b.push(Math.sign(r.lat || 1) * a.rightX, Math.sign(r.lat || 1) * a.rightZ, 6);
        this.popUp(b, 9);
        b.pelican.setDizzy(1.4);
        w.fx.ring(b.pos.x, b.pos.y + 1.2, b.pos.z, 7, 0xffd23f);
        w.fx.burst('star', b.pos.x, b.pos.y + 1.6, b.pos.z, 14, 7);
        w.fx.burst('boom', b.pos.x, b.pos.y + 1.4, b.pos.z, 4, 3, 0.2, 0.6);
        w.events.emit('sfx', { name: 'boing', racer: b });
        w.events.emit('sfx', { name: 'bigHit', racer: b });
        a.stat.specialHits++;
        break;
      case 'sweep': {
        dmg = 20 * atk;
        const l = Math.max(0.5, r.dist);
        b.push((b.pos.x - a.pos.x) / l, (b.pos.z - a.pos.z) / l, 11 * atk);
        b.wobble = Math.max(b.wobble, 0.45);
        w.events.emit('sfx', { name: 'hit', racer: b });
        a.stat.specialHits++;
        break;
      }
      case 'clamp':
        a.stat.specialHits++;
        a.stat.clampHits++;
        this.startClamp(a, b);
        break;
    }
    a.stat.hits++;
    a.energy = Math.min(100, a.energy + 9);
    w.events.emit('hit', { attacker: a, target: b, kind, damage: dmg });
    if (dmg > 0) b.damage(dmg, a, kind);
    w.fx.burst('feather', b.pos.x, b.pos.y + 1.2, b.pos.z, 6, 5);
    if (a.isPlayer || b.isPlayer) {
      w.events.emit('shake', { amount: kind === 'peck' ? 0.6 : kind === 'wingL' || kind === 'wingR' ? 0.5 : 0.25, racer: a.isPlayer ? a : b });
      vibrate(30);
    }
  }

  /** 把目标弹离地面（夸张的被打飞效果） */
  private popUp(b: Racer, vy: number) {
    if (b.state !== 'driving') return;
    b.vy = Math.max(b.vy, vy);
    b.grounded = false;
    b.pos.y += 0.05;
  }

  private startClamp(a: Racer, b: Racer) {
    const w = this.world;
    a.clampTarget = b;
    a.clampTimer = 0.75;
    b.clampedBy = a;
    b.state = 'clamped';
    b.drifting = false;
    b.nitroActive = false;
    a.pelican.holdClamp(0.75);
    b.pelican.trigger('hurt');
    b.pelican.trigger('shout');
    w.events.emit('sfx', { name: 'clamp', racer: a });
    if (a.isPlayer) w.events.emit('notify', { text: '大嘴夹击！', kind: 'big', racer: a });
    if (b.isPlayer) w.events.emit('notify', { text: '被夹住了！', kind: 'bad', racer: b });
  }

  /** 夹住 → 短暂蓄力 → 甩出 */
  private updateClamp(a: Racer, dt: number) {
    const b = a.clampTarget!;
    if (a.state !== 'driving' || b.state !== 'clamped') {
      a.releaseClampTarget();
      return;
    }
    a.clampTimer -= dt;
    a.speed *= 1 - 0.6 * dt;
    // 目标被吊在嘴前方
    const shake = Math.sin(this.world.time * 30) * 0.3;
    b.prevPos.copy(b.pos);
    b.pos.set(a.pos.x + a.forwardX * 2.2 + a.rightX * shake, a.pos.y + 0.8 + Math.max(0, 0.75 - a.clampTimer) * 1.2, a.pos.z + a.forwardZ * 2.2 + a.rightZ * shake);
    b.yaw = a.yaw + Math.PI / 2;
    b.vx = a.vx;
    b.vz = a.vz;
    b.syncBody();
    if (a.clampTimer <= 0) {
      // 甩出去！
      const side = Math.random() < 0.5 ? -1 : 1;
      a.releaseClampTarget();
      b.state = 'driving';
      b.vx = a.vx * 0.5 + a.rightX * side * 22;
      b.vz = a.vz * 0.5 + a.rightZ * side * 22;
      b.vy = 0;
      b.pos.y = a.pos.y + 1.5;
      b.grounded = false;
      b.crash('clamp', a, 18);
      b.vy = 9;
      this.world.events.emit('sfx', { name: 'whoosh', racer: a });
      this.world.events.emit('sfx', { name: 'bigHit', racer: b });
      if (a.isPlayer) this.world.events.emit('shake', { amount: 0.5, racer: a });
    }
  }

  private updateBone(a: Racer) {
    let map = this.boneHits.get(a);
    if (!map) this.boneHits.set(a, (map = new Map()));
    for (const b of this.world.racers) {
      if (!this.canTarget(b, a)) continue;
      const r = relative(a, b);
      if (Math.abs(r.lon) < 3.8 && Math.abs(r.lat) < 4.6 && Math.abs(r.dy) < 2.5) {
        const last = map.get(b) ?? -99;
        if (this.world.time - last < 0.9) continue;
        map.set(b, this.world.time);
        a.pelican.trigger(r.lat < 0 ? 'wingL' : 'wingR');
        if (b.invincible) continue;
        const l = Math.max(0.5, r.dist);
        b.push((b.pos.x - a.pos.x) / l, (b.pos.z - a.pos.z) / l, 12);
        b.damage(22 * a.mods.attack * a.mods.item, a, 'bone');
        a.stat.hits++;
        this.world.events.emit('sfx', { name: 'bigHit', racer: b });
        this.world.fx.burst('star', b.pos.x, b.pos.y + 1.5, b.pos.z, 5, 4);
        this.world.events.emit('hit', { attacker: a, target: b, kind: 'bone', damage: 22 });
      }
    }
  }

  /** 摩托冲撞：基于相对速度与质量交换冲量 */
  private collide(a: Racer, b: Racer) {
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const dy = b.pos.y - a.pos.y;
    if (Math.abs(dy) > 1.8) return;
    const d2 = dx * dx + dz * dz;
    const minD = 1.7;
    if (d2 > minD * minD || d2 < 1e-6) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const nz = dz / d;
    const w = this.world;
    // 超级冲刺 / 黄金无敌：直接撞飞
    const aPow = a.superDash > 0 || a.golden > 0;
    const bPow = b.superDash > 0 || b.golden > 0;
    if (aPow !== bPow) {
      const [s, t] = aPow ? [a, b] : [b, a];
      if (!t.invincible && t.state === 'driving') {
        const sgn = aPow ? 1 : -1;
        t.vx += nx * sgn * 18;
        t.vz += nz * sgn * 18;
        t.lastAttacker = s;
        t.lastAttackTime = w.time;
        t.crash(s.superDash > 0 ? 'superDash' : 'golden', s, 16);
        s.stat.hits++;
        if (s.superDash > 0) s.stat.specialHits++;
        w.events.emit('hit', { attacker: s, target: t, kind: 'ram', damage: 50 });
        w.events.emit('sfx', { name: 'bigHit', racer: t });
        w.fx.ring(t.pos.x, t.pos.y + 0.5, t.pos.z, 4, 0xffe14a);
      }
      return;
    }
    // 质量：重型摩托更重
    const ma = 1 + a.stats.durability * 0.12 + a.stats.impactPower * 0.05;
    const mb = 1 + b.stats.durability * 0.12 + b.stats.impactPower * 0.05;
    const overlap = minD - d;
    const tot = ma + mb;
    a.pos.x -= nx * overlap * (mb / tot);
    a.pos.z -= nz * overlap * (mb / tot);
    b.pos.x += nx * overlap * (ma / tot);
    b.pos.z += nz * overlap * (ma / tot);
    const vrel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
    if (vrel <= 0) return;
    const e = 0.6;
    const j = ((1 + e) * vrel) / (1 / ma + 1 / mb);
    a.vx -= (j / ma) * nx;
    a.vz -= (j / ma) * nz;
    b.vx += (j / mb) * nx;
    b.vz += (j / mb) * nz;
    if (vrel > 6) {
      // 谁冲得更猛谁是“攻击者”
      const aDrive = a.vx * nx + a.vz * nz;
      const bDrive = -(b.vx * nx + b.vz * nz);
      const [att, tar, mAtt, mTar] = aDrive >= bDrive ? [a, b, ma, mb] : [b, a, mb, ma];
      const power = vrel * (att.stats.impactPower / 5) * att.mods.impact * (mAtt / mTar) * (w.chaos ? 1.3 : 1);
      const dmg = clamp(power * 1.6, 4, 60);
      if (att.state === 'driving') att.stat.hits++;
      tar.wobble = Math.max(tar.wobble, clamp(vrel / 25, 0.2, 0.7));
      w.events.emit('hit', { attacker: att, target: tar, kind: 'ram', damage: dmg });
      w.events.emit('sfx', { name: vrel > 14 ? 'bigHit' : 'hit', racer: tar });
      w.fx.burst('spark', (a.pos.x + b.pos.x) / 2, a.pos.y + 0.6, (a.pos.z + b.pos.z) / 2, 8, 6);
      w.fx.burst('feather', tar.pos.x, tar.pos.y + 1.2, tar.pos.z, 4, 3);
      if (power > 34 && tar.state === 'driving' && !tar.invincible) tar.crash('ram', att, power * 0.3);
      else tar.damage(dmg, att, 'ram');
      if (att.isPlayer || tar.isPlayer) {
        w.events.emit('shake', { amount: clamp(vrel / 30, 0.2, 0.6), racer: att.isPlayer ? att : tar });
        vibrate(25);
      }
    }
  }

  clear() {
    this.pending = [];
    this.boneHits.clear();
  }
}
