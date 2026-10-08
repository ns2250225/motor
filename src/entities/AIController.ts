import type { Racer, RacerInput } from './Racer';
import { emptyInput } from './Racer';
import type { RaceWorld } from '../core/types';
import { PERSONALITIES, DIFFICULTY, Personality, PersonalityId, Difficulty, DifficultyParams } from '../ai/AIBehavior';
import { PathFollower } from '../ai/PathFollower';
import { OvertakePlanner, AvoidPoint } from '../ai/OvertakePlanner';
import { inAttackRange, relative } from '../systems/CombatSystem';
import { getItem } from '../data/items';
import { clamp } from '../utils/math';

/**
 * AI 控制器：读取赛道与周围车辆 → 避障/超车 → 攻击判定 → 输出与玩家相同的输入结构。
 * AI 遵守相同的物理规则，不允许瞬移；难度通过反应延迟、攻击积极性、驾驶稳定性调整。
 */
export class AIController {
  pers: Personality;
  diff: DifficultyParams;
  input: RacerInput = emptyInput();
  private decisionTimer = Math.random() * 0.2;
  private targetLat = 0;
  private preferredLat = 0;
  private laneTimer = 0;
  private useShortcut = -1;
  private stuckTime = 0;
  private reverseTime = 0;
  private pendingActions: { t: number; act: keyof RacerInput }[] = [];
  private mistakeTimer = 0;
  private mistakeSteer = 0;
  private holdDrift = false;
  private shortcutDecided = new Set<number>();
  private lastS = 0;
  private lastPoints: AvoidPoint[] = [];
  /** 基础攻击（翅膀/啄击）无冷却，AI 自行控制出招节奏，避免每 0.1 秒连打 */
  private nextBasicAttack = 0;

  constructor(public racer: Racer, public world: RaceWorld, persId: PersonalityId, difficulty: Difficulty, public avoid: () => AvoidPoint[]) {
    this.pers = PERSONALITIES[persId];
    this.diff = DIFFICULTY[difficulty];
    this.preferredLat = (Math.random() - 0.5) * 4 * this.pers.laneJitter;
  }

  update(dt: number, player: Racer | null): RacerInput {
    const r = this.racer;
    const w = this.world;
    const inp = this.input;
    // 清除瞬时按键
    inp.attackL = inp.attackR = inp.peck = inp.sweep = inp.clamp = inp.superDash = inp.useItem = inp.horn = inp.reset = false;
    if (r.state !== 'driving' && r.state !== 'finished') return inp;

    // 反应延迟后执行的动作
    for (let i = this.pendingActions.length - 1; i >= 0; i--) {
      const a = this.pendingActions[i];
      a.t -= dt;
      if (a.t <= 0) {
        (inp as unknown as Record<string, boolean>)[a.act] = true;
        this.pendingActions.splice(i, 1);
      }
    }

    const track = w.track;
    const g = r.ground;
    const onShortcut = g.roadIdx > 0;
    // 悬空赛道缩短预瞄距离，避免抄内线掉下去
    const lm = track.edge === 'fall' ? 0.6 : 1;
    const s = g.mainS;

    // 决策频率：远离玩家时降低（性能优化）
    const far = player ? r.pos.distanceToSquared(player.pos) > 160 * 160 : false;
    this.decisionTimer -= dt;
    if (this.decisionTimer <= 0) {
      this.decisionTimer = far ? 0.35 : 0.1 + Math.random() * 0.05;
      this.decide(player, far);
    }

    // 路径跟随
    let steerRes;
    if (onShortcut) {
      const sc = track.shortcuts[g.roadIdx - 1];
      const q = sc.road.nearest(r.pos.x, r.pos.z);
      steerRes = PathFollower.steerTo(r, sc.road, q.s, 0, lm);
    } else if (this.useShortcut >= 0) {
      // 驶向捷径入口
      const sc = track.shortcuts[this.useShortcut];
      const ds = track.main.deltaS(s, sc.s0);
      if (ds < 40 && ds > -8) {
        const q = sc.road.nearest(r.pos.x, r.pos.z);
        steerRes = PathFollower.steerTo(r, sc.road, Math.max(q.s, 0) + 2, 0, lm);
      } else steerRes = PathFollower.steerTo(r, track.main, s, this.targetLat, lm);
      if (ds < -12) this.useShortcut = -1;
    } else {
      steerRes = PathFollower.steerTo(r, track.main, s, this.targetLat, lm);
    }
    let steer = steerRes.steer;

    // 失误（偶尔方向抖动）
    this.mistakeTimer -= dt;
    if (this.mistakeTimer > 0) steer = clamp(steer + this.mistakeSteer, -1, 1);

    // 速度规划
    const road = onShortcut ? track.shortcuts[g.roadIdx - 1].road : track.main;
    const rs = onShortcut ? road.nearest(r.pos.x, r.pos.z).s : s;
    const curv = PathFollower.maxCurvatureAhead(road, rs, 20 + Math.abs(r.speed) * 1.4);
    const grip = g.surface === 'ice' ? 0.45 : g.surface === 'offroad' ? 0.75 : 1;
    const vSafe = PathFollower.safeSpeed(curv, 42 * grip * (r.stats.handling / 2.2));
    let throttle = 1;
    let brake = 0;
    if (r.speed > vSafe * 1.08) throttle = 0;
    if (r.speed > vSafe * 1.3) brake = 0.6;
    // 难度与追赶补偿（只调节油门，不改变物理）
    let skill = this.diff.skill;
    if (player && w.mode !== 'timetrial') {
      const gap = player.progress - r.progress;
      if (gap > 60) skill += this.diff.rubber;
      else if (gap < -120) skill -= this.diff.rubber * 0.8;
    }
    if (r.speed > r.stats.maxSpeed * skill && !r.nitroActive && r.boostTimer <= 0) throttle = Math.min(throttle, 0.3);

    // 漂移：长弯道时
    const wantDrift = curv > 1 / 70 && r.speed > 22 && this.pers.driftSkill > 0.4 && Math.abs(steerRes.diff) > 0.05;
    if (wantDrift && !this.holdDrift && Math.random() < this.pers.driftSkill * 0.1) this.holdDrift = true;
    if (this.holdDrift) {
      if (!wantDrift || (r.drifting && Math.sign(-steerRes.diff) !== r.driftDir && Math.abs(steerRes.diff) > 0.12) || r.driftTime > 2.6) this.holdDrift = false;
    }

    // 氮气：前方较直时使用
    const straight = PathFollower.maxCurvatureAhead(road, rs, 70) < 1 / 140;
    const gapAhead =
      track.gaps.some((gp) => {
        const d = track.main.deltaS(s, gp.s0);
        return d > 0 && d < 70;
      }) ||
      track.ramps.some((rp) => {
        const d = track.main.closed ? track.main.deltaS(s, rp.s) : rp.s - s;
        return d > 0 && d < 55 && Math.abs(r.ground.mainLateral - rp.lateral) < rp.width / 2 + 2;
      });
    const nitroWant = (straight && r.nitro > r.stats.nitroCapacity * (1 - this.pers.nitroUsage * 0.7)) || gapAhead;

    // 卡死检测
    if (w.started && r.state === 'driving' && Math.abs(r.speed) < 2.5) this.stuckTime += dt;
    else this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
    if (this.stuckTime > 2.2 && this.reverseTime <= 0) {
      this.reverseTime = 1;
      this.stuckTime = 0;
    }
    if (this.reverseTime > 0) {
      this.reverseTime -= dt;
      throttle = 0;
      brake = 1;
      steer = -steer;
      if (this.reverseTime <= 0 && Math.abs(r.speed) < 3 && Math.abs(track.main.deltaS(this.lastS, s)) < 2) r.resetToTrack();
      this.lastS = s;
    }

    // 紧急制动：正前方近距离有实心障碍且来不及绕开
    if (!onShortcut && r.grounded && r.speed > 14) {
      for (const p of this.lastPoints) {
        if (p.weight < 6) continue;
        const ds = track.main.closed ? track.main.deltaS(s, p.s) : p.s - s;
        if (ds > 1 && ds < 6 + r.speed * 0.32 && Math.abs(r.ground.mainLateral - p.lat) < p.r + 1.1) {
          throttle = 0;
          brake = 1;
          break;
        }
      }
    }
    inp.throttle = throttle;
    inp.brake = brake;
    inp.steer = steer;
    inp.drift = this.holdDrift;
    inp.nitro = nitroWant && throttle > 0.5;
    return inp;
  }

  private act(a: keyof RacerInput) {
    this.pendingActions.push({ t: this.diff.reaction * (0.6 + Math.random() * 0.8), act: a });
  }

  private decide(player: Racer | null, far: boolean) {
    const r = this.racer;
    const w = this.world;
    const track = w.track;
    const s = r.ground.mainS;
    const pers = this.pers;

    // 失误
    if (Math.random() < this.diff.mistakes * 0.3) {
      this.mistakeTimer = 0.3;
      this.mistakeSteer = (Math.random() - 0.5) * 1.2;
    }

    // 捷径决策
    if (r.ground.roadIdx <= 0) {
      track.shortcuts.forEach((sc, k) => {
        const ds = track.main.deltaS(s, sc.s0);
        if (ds > 40 && ds < 90 && !this.shortcutDecided.has(k)) {
          this.shortcutDecided.add(k);
          const p = pers.shortcutChance * (this.diff.skill > 0.97 ? 1.1 : this.diff.skill < 0.9 ? 0.6 : 0.9);
          if (Math.random() < p) this.useShortcut = k;
        }
        if (ds < -30 || ds > 120) this.shortcutDecided.delete(k);
      });
    }

    // 复仇型：被攻击后追击攻击者
    const revenge = r.revengeTarget && w.time < r.revengeUntil && r.revengeTarget.state === 'driving' ? r.revengeTarget : null;
    let seek: Racer | null = null;
    if (revenge && pers.revengeBoost > 0.5) seek = revenge;
    else if (pers.seekPlayer > 0 && player && player.state === 'driving' && Math.abs(player.progress - r.progress) < 40) seek = player;

    // 选择车道
    this.laneTimer -= 0.1;
    if (this.laneTimer <= 0) {
      this.laneTimer = 2 + Math.random() * 3;
      this.preferredLat = (Math.random() - 0.5) * 5 * pers.laneJitter;
    }
    // 远离玩家时只降低决策频率，仍然避开障碍
    const points = this.avoid();
    this.lastPoints = points;
    // 道具箱吸引（没有道具时）
    if (!far && r.item === null && w.mode !== 'timetrial') {
      for (const b of track.itemBoxes) points.push({ s: b.s, lat: b.lateral, r: 0.6, weight: -1.6 });
    }
    for (const b of track.boostPads) points.push({ s: b.s, lat: b.lateral, r: 0.8, weight: -1.2 });
    this.targetLat = OvertakePlanner.choose(r, track, s, r.ground.mainLateral, this.preferredLat, points, w.racers, pers, seek);

    if (!w.started || w.mode === 'timetrial' || r.state !== 'driving') return;

    // 攻击决策
    const aggr = clamp((pers.aggression + (revenge ? pers.revengeBoost * 0.6 : 0)) * this.diff.aggressionMul * (w.chaos ? 1.5 : 1), 0, 1.5);
    for (const o of w.racers) {
      if (o === r || o.state !== 'driving') continue;
      const rel = relative(r, o);
      if (rel.dist > 9) continue;
      let p = aggr * 0.35;
      if (o === seek) p *= 1.8;
      if (o.isPlayer && pers.seekPlayer > 0) p *= 1.3;
      if (pers.keepDistance > 0.8 && !revenge) p *= 0.4;
      if (Math.random() > p) continue;
      if (r.cd.clamp <= 0 && inAttackRange('clamp', r, o) && Math.random() < 0.35 + aggr * 0.2) {
        this.act('clamp');
        break;
      }
      const basicReady = w.time >= this.nextBasicAttack;
      const basic = (a: 'peck' | 'attackL' | 'attackR') => {
        this.act(a);
        this.nextBasicAttack = w.time + (0.9 + Math.random() * 0.8) / (0.6 + aggr * 0.5);
      };
      if (basicReady && inAttackRange('peck', r, o)) {
        basic('peck');
        break;
      }
      if (basicReady && inAttackRange('wingL', r, o)) {
        basic('attackL');
        break;
      }
      if (basicReady && inAttackRange('wingR', r, o)) {
        basic('attackR');
        break;
      }
      if (r.cd.sweep <= 0 && inAttackRange('sweep', r, o) && Math.random() < 0.5) {
        this.act('sweep');
        break;
      }
    }
    // 超级冲刺
    if (r.energy >= 100) {
      const tgt = w.racers.find((o) => o !== r && o.state === 'driving' && (() => {
        const rel = relative(r, o);
        return rel.lon > 3 && rel.lon < 35 && Math.abs(rel.lat) < 4;
      })());
      if (tgt || Math.random() < 0.05) this.act('superDash');
    }

    // 道具决策
    if (r.item) {
      const kind = getItem(r.item).kind;
      const use = pers.itemUsage;
      let want = false;
      const ahead = w.racers.some((o) => {
        if (o === r || o.state !== 'driving') return false;
        const rel = relative(r, o);
        return rel.lon > 4 && rel.lon < 45 && Math.abs(rel.lat) < 6;
      });
      const behind = w.racers.some((o) => {
        if (o === r || o.state !== 'driving') return false;
        const rel = relative(r, o);
        return rel.lon < -3 && rel.lon > -30 && Math.abs(rel.lat) < 6;
      });
      const near = w.racers.some((o) => o !== r && o.state === 'driving' && relative(r, o).dist < (kind === 'melee' ? 9 : 20));
      switch (kind) {
        case 'forward':
          want = r.item === 'rocketFish' ? r.place > 1 : ahead;
          break;
        case 'backward':
          want = behind || Math.random() < use * 0.04;
          break;
        case 'self':
          want = r.item === 'sardine' ? r.nitro < r.stats.nitroCapacity * 0.3 : near || r.place > 3 || Math.random() < 0.05;
          break;
        case 'area':
        case 'melee':
          want = near;
          break;
      }
      if (pers.id === 'troll' && Math.random() < 0.15) want = true;
      if (want && Math.random() < 0.25 + use * 0.6) this.act('useItem');
    }
    if (pers.id === 'troll' && Math.random() < 0.01) this.act('horn');
  }
}
