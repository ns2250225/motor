import type { Racer } from '../entities/Racer';
import type { RaceWorld } from '../core/types';
import type { RacingSystem } from './RacingSystem';

/** 重生系统：手动复位、卡死检测、越界/逆行处理，保证不会永久卡住 */
export class RespawnSystem {
  private stuck = new Map<Racer, number>();

  constructor(private world: RaceWorld, private racing: RacingSystem) {}

  update(dt: number) {
    for (const r of this.world.racers) {
      if (r.state !== 'driving') {
        this.stuck.set(r, 0);
        continue;
      }
      if (r.input.reset) {
        r.resetToTrack();
        this.racing.resync(r);
        continue;
      }
      // 玩家卡死：低速且贴墙/路外超过 4 秒自动复位
      const slow = Math.abs(r.speed) < 2 && this.world.started;
      const offTrack = !r.ground.onRoad && this.world.track.edge !== 'offroad';
      let t = this.stuck.get(r) ?? 0;
      t = slow || offTrack ? t + dt : Math.max(0, t - dt);
      if (t > (r.isPlayer ? 5 : 3.5) && (offTrack || r.ground.barrierDepth > 0 || r.isPlayer === false)) {
        r.resetToTrack();
        this.racing.resync(r);
        t = 0;
      }
      // 长时间逆行（AI）
      if (!r.isPlayer && r.wrongWayTime > 3) {
        r.resetToTrack();
        r.wrongWayTime = 0;
        this.racing.resync(r);
      }
      this.stuck.set(r, t);
    }
  }
}
