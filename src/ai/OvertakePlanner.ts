import type { Racer } from '../entities/Racer';
import type { TrackGeometry } from '../tracks/TrackGeometry';
import type { Personality } from './AIBehavior';

export interface AvoidPoint {
  s: number;
  lat: number;
  r: number;
  /** 负值表示吸引（道具箱、加速带） */
  weight: number;
}

/** 超车与局部避障规划：在候选横向车道中选择代价最低的一条 */
export const OvertakePlanner = {
  choose(
    r: Racer,
    track: TrackGeometry,
    s: number,
    curLat: number,
    preferred: number,
    points: AvoidPoint[],
    racers: Racer[],
    pers: Personality,
    seekTarget: Racer | null,
  ) {
    const hw = track.main.halfWidth - (track.edge === 'fall' ? 2.6 : 1.6);
    const main = track.main;
    let best = curLat;
    let bestCost = Infinity;
    for (let l = -hw; l <= hw + 0.01; l += 1.2) {
      let cost = 0.025 * (l - preferred) * (l - preferred) + 0.04 * Math.abs(l - curLat);
      for (const p of points) {
        const ds = main.closed ? main.deltaS(s, p.s) : p.s - s;
        if (ds < 1 || ds > 90) continue;
        const near = Math.abs(l - p.lat) - p.r;
        if (p.weight > 0) {
          if (near < 1.6) cost += p.weight * (1.3 - ds / 90) * (1.6 - Math.max(0, near));
        } else if (near < 1.2) {
          cost += p.weight * (1 - ds / 90);
        }
      }
      for (const o of racers) {
        if (o === r || (o.state !== 'driving' && o.state !== 'finished')) continue;
        const ds = main.closed ? main.deltaS(s, o.ground.mainS) : o.ground.mainS - s;
        if (ds < -4 || ds > 26) continue;
        const dl = Math.abs(l - o.ground.mainLateral);
        if (o === seekTarget) {
          // 追击目标：靠近其横向位置
          if (dl < 3) cost -= 2.5 * (1 - dl / 3);
          continue;
        }
        if (ds > 0 && dl < 1.9) cost += 2.6 * (1 - ds / 30);
        if (pers.keepDistance > 0 && dl < 4) cost += pers.keepDistance * 1.2 * (1 - dl / 4);
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = l;
      }
    }
    return best;
  },
};
