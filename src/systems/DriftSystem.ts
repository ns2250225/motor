import type { Racer } from '../entities/Racer';
import { clamp } from '../utils/math';

/** 漂移系统：快速过弯并积累氮气，松开后获得小涡轮加速 */
export const DriftSystem = {
  update(r: Racer, steer: number, driftHeld: boolean, dt: number) {
    const canDrift = r.grounded && r.speed > 14 && r.state === 'driving' && r.spin <= 0;
    if (!r.drifting) {
      if (driftHeld && canDrift && Math.abs(steer) > 0.25) {
        r.drifting = true;
        r.driftDir = Math.sign(steer);
        r.driftCharge = 0;
        r.driftTime = 0;
      }
      return;
    }
    if (!driftHeld || !canDrift) {
      DriftSystem.release(r);
      return;
    }
    r.driftTime += dt;
    // 外侧方向键收紧/放松漂移角
    const intensity = 0.75 + 0.5 * clamp(steer * r.driftDir, 0, 1);
    const hover = r.bikeDef.id === 'hover' ? 1.35 : 1;
    r.driftCharge += dt * intensity * hover;
    r.driftDistance += r.speed * dt;
    r.stat.driftDist += r.speed * dt;
    r.energy = Math.min(100, r.energy + dt * 3);
  },

  release(r: Racer) {
    if (!r.drifting) return;
    r.drifting = false;
    const c = r.driftCharge;
    if (c > 0.7) {
      const level = c > 2.2 ? 3 : c > 1.4 ? 2 : 1;
      r.boostTimer = Math.max(r.boostTimer, 0.35 + level * 0.35);
      r.speed = Math.min(r.speed + 3 + level * 2, r.maxSpeedBase * 1.25);
      r.nitro = Math.min(r.stats.nitroCapacity, r.nitro + c * 9 * r.bikeDef.nitroRegen);
      r.world.events.emit('sfx', { name: 'boost', racer: r, volume: 0.5 + level * 0.15 });
      if (r.isPlayer && level >= 2) r.world.events.emit('notify', { text: level === 3 ? '超级漂移加速！' : '漂移加速！', kind: 'good', racer: r });
    }
    r.driftCharge = 0;
  },
};
