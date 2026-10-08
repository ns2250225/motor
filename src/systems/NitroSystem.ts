import type { Racer } from '../entities/Racer';

export const NITRO_DRAIN = 34; // 每秒消耗
export const NITRO_SPEED = 1.32;

/** 氮气系统：消耗能量短时高速冲刺，并缓慢自然回复 */
export const NitroSystem = {
  update(r: Racer, wantNitro: boolean, dt: number) {
    const cap = r.stats.nitroCapacity;
    const prev = r.nitroActive;
    r.nitroActive = wantNitro && r.nitro > 0.5 && r.state === 'driving' && r.speed > 3;
    if (r.nitroActive) {
      r.nitro = Math.max(0, r.nitro - NITRO_DRAIN * dt);
      if (!prev) r.world.events.emit('sfx', { name: 'nitro', racer: r });
    } else {
      // 自然回复：越野/滞空时不回复
      const regen = (r.grounded ? 2.2 : 0) * r.bikeDef.nitroRegen * (r.world.chaos ? 2 : 1);
      r.nitro = Math.min(cap, r.nitro + regen * dt);
    }
  },
};
