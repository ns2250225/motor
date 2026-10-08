import type { Racer } from '../entities/Racer';
import type { Road, RoadPoint } from '../tracks/Road';
import { clamp, wrapAngle } from '../utils/math';

const tmp: RoadPoint = { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0 };

/** 路径跟随：沿道路中心线 + 期望横向偏移，计算转向与目标速度 */
export const PathFollower = {
  /** 计算转向输入（-1~1，正为右转） */
  steerTo(r: Racer, road: Road, s: number, lateral: number, lookMul = 1) {
    const look = (7 + Math.abs(r.speed) * 0.42) * lookMul;
    road.pointAt(s + look, tmp);
    const tx = tmp.x + tmp.rx * lateral;
    const tz = tmp.z + tmp.rz * lateral;
    const desired = Math.atan2(tx - r.pos.x, tz - r.pos.z);
    const diff = wrapAngle(desired - r.yaw);
    return { steer: clamp(-diff * 3, -1, 1), diff };
  },

  /** 前方最大曲率 */
  maxCurvatureAhead(road: Road, s: number, dist: number) {
    let k = 0;
    for (let d = 4; d < dist; d += 4) k = Math.max(k, Math.abs(road.curvatureAt(s + d)));
    return k;
  },

  /** 根据曲率估算安全速度 */
  safeSpeed(curv: number, lateralAccel: number) {
    if (curv < 1e-4) return Infinity;
    return Math.sqrt(lateralAccel / curv);
  },
};
