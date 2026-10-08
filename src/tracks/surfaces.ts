import type { SurfaceType } from './TrackConfig';

export interface SurfaceProps {
  grip: number; // 侧向抓地（速度方向对齐速率）
  speed: number; // 极速系数
  drag: number; // 额外阻力
  name: string;
}

export const SURFACES: Record<SurfaceType | 'offroad', SurfaceProps> = {
  asphalt: { grip: 1, speed: 1, drag: 0, name: '柏油' },
  sand: { grip: 0.55, speed: 0.82, drag: 4, name: '沙地' },
  ice: { grip: 0.22, speed: 1, drag: 0, name: '冰面' },
  mud: { grip: 0.6, speed: 0.7, drag: 7, name: '泥潭' },
  wood: { grip: 0.95, speed: 1, drag: 0, name: '木板' },
  metal: { grip: 0.85, speed: 1, drag: 0, name: '钢板' },
  rainbow: { grip: 1, speed: 1.03, drag: 0, name: '彩虹' },
  moon: { grip: 0.62, speed: 1, drag: 0, name: '月壤' },
  dirt: { grip: 0.9, speed: 0.98, drag: 0.5, name: '泥土' },
  neon: { grip: 1, speed: 1.02, drag: 0, name: '霓虹' },
  snow: { grip: 0.6, speed: 0.88, drag: 2, name: '积雪' },
  rock: { grip: 0.95, speed: 1, drag: 0, name: '岩石' },
  offroad: { grip: 0.75, speed: 0.62, drag: 5, name: '路外' },
};
