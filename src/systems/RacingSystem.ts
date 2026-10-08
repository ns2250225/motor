import type { Racer } from '../entities/Racer';
import type { RaceWorld } from '../core/types';
import { CheckpointSystem } from '../tracks/CheckpointSystem';

export interface Standing {
  racer: Racer;
  place: number;
  time: number;
  estimated: boolean;
}

/** 竞速系统：检查点/圈数、实时名次、完赛判定、淘汰赛规则 */
export class RacingSystem {
  cps: CheckpointSystem | null;
  raceTime = 0;
  finishOrder: Racer[] = [];
  eliminationTimer = 0;
  eliminationInterval = 25;
  laps: number;
  over = false;
  onRaceOver: (() => void) | null = null;

  constructor(private world: RaceWorld, laps: number, endless = false) {
    this.laps = laps;
    this.cps = endless ? null : new CheckpointSystem(world.track);
  }

  init() {
    for (const r of this.world.racers) {
      if (this.cps) this.cps.init(r);
      r.lapStartTime = 0;
    }
    this.eliminationTimer = this.eliminationInterval;
  }

  resync(r: Racer) {
    this.cps?.resync(r);
  }

  update(dt: number) {
    const w = this.world;
    if (!w.started || this.over) return;
    this.raceTime += dt;
    for (const r of w.racers) {
      if (r.state === 'eliminated') continue;
      r.updateShortcutTracking();
      if (!this.cps) {
        r.progress = r.ground.mainS;
        continue;
      }
      const res = this.cps.update(r);
      if (res === 'lap' && !r.finished) {
        if (r.lapsCompleted >= 1) {
          const lt = this.raceTime - r.lapStartTime;
          r.lapTimes.push(lt);
          w.events.emit('lap', { racer: r, lap: r.lapsCompleted, time: lt });
        }
        r.lapStartTime = this.raceTime;
        if (r.lapsCompleted >= this.laps) this.finish(r);
      }
      // 逆行检测
      const dot = r.forwardX * r.ground.tx + r.forwardZ * r.ground.tz;
      if (dot < -0.4 && r.speed > 4 && r.state === 'driving') r.wrongWayTime += dt;
      else r.wrongWayTime = Math.max(0, r.wrongWayTime - dt * 2);
    }

    // 淘汰赛：定时淘汰最后一名
    if (w.mode === 'elimination') {
      this.eliminationTimer -= dt;
      const active = w.racers.filter((r) => r.state !== 'eliminated');
      if (this.eliminationTimer <= 0 && active.length > 1) {
        this.eliminationTimer = this.eliminationInterval;
        const last = [...active].sort((a, b) => a.progress - b.progress)[0];
        last.eliminate();
      }
      const remaining = w.racers.filter((r) => r.state !== 'eliminated');
      const player = w.racers.find((r) => r.isPlayer);
      if (remaining.length <= 1 || (player && player.state === 'eliminated')) {
        if (remaining.length === 1 && !remaining[0].finished) this.finish(remaining[0]);
        this.end();
      }
    }

    this.updatePlaces();
    if (w.mode === 'endless') {
      const p = w.racers.find((r) => r.isPlayer);
      if (p && p.lives <= 0 && p.state !== 'crashed') this.end();
    }
  }

  finish(r: Racer) {
    if (r.finished) return;
    r.finished = true;
    r.finishTime = this.raceTime;
    if (r.state === 'driving') r.state = 'finished';
    this.finishOrder.push(r);
    this.world.events.emit('finish', { racer: r });
    if (r.isPlayer) {
      r.pelican.trigger(this.finishOrder.length <= 3 ? 'celebrate' : 'sad');
    } else if (this.finishOrder.length === 1) r.pelican.trigger('celebrate');
  }

  end() {
    if (this.over) return;
    this.over = true;
    this.onRaceOver?.();
  }

  updatePlaces() {
    const list = [...this.world.racers].sort((a, b) => {
      if (a.state === 'eliminated' || b.state === 'eliminated') {
        if (a.state === 'eliminated' && b.state === 'eliminated') return b.eliminatedAt - a.eliminatedAt;
        return a.state === 'eliminated' ? 1 : -1;
      }
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    list.forEach((r, i) => (r.place = i + 1));
    return list;
  }

  /** 最终成绩：未完成者按剩余距离与平均速度估算完成时间 */
  standings(): Standing[] {
    const list = this.updatePlaces();
    const L = this.world.track.length;
    const total = this.laps * L;
    return list.map((r) => {
      if (r.finished) return { racer: r, place: r.place, time: r.finishTime, estimated: false };
      if (r.state === 'eliminated') return { racer: r, place: r.place, time: 0, estimated: false };
      const avg = Math.max(15, r.progress / Math.max(1, this.raceTime));
      const remain = Math.max(0, total - r.progress);
      return { racer: r, place: r.place, time: this.raceTime + remain / avg, estimated: true };
    });
  }
}
