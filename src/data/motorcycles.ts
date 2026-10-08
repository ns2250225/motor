export interface MotorcycleStats {
  maxSpeed: number; // m/s
  acceleration: number; // m/s²
  handling: number; // 转向角速度 rad/s
  braking: number; // m/s²
  durability: number; // 1-10 防御
  impactPower: number; // 1-10 冲撞力
  nitroCapacity: number; // 氮气容量
}

export type BikeModel = 'street' | 'dirt' | 'super' | 'cruiser' | 'mini' | 'rocket' | 'amphibious' | 'hover';

export interface MotorcycleDef {
  id: BikeModel;
  name: string;
  type: string;
  desc: string;
  price: number;
  color: number;
  accent: number;
  stats: MotorcycleStats;
  /** 越野路面减速系数（越接近 1 越不受影响） */
  offroadGrip: number;
  /** 特殊路面（沙地/冰面/泥潭）抓地补正 */
  surfaceImmunity: number;
  nitroRegen: number;
  special: string;
  ratings: { speed: string; handling: string; defense: string };
}

export const MOTORCYCLES: MotorcycleDef[] = [
  {
    id: 'street',
    name: '经典街车',
    type: '街车',
    desc: '圆润可靠的入门街车，操控友好，最适合新手鹈鹕。',
    price: 0,
    color: 0xe8423f,
    accent: 0xffffff,
    stats: { maxSpeed: 42, acceleration: 21, handling: 2.25, braking: 32, durability: 5, impactPower: 5, nitroCapacity: 100 },
    offroadGrip: 0.62,
    surfaceImmunity: 0,
    nitroRegen: 1,
    special: '新手友好',
    ratings: { speed: '中', handling: '高', defense: '中' },
  },
  {
    id: 'dirt',
    name: '越野摩托',
    type: '越野',
    desc: '高挡泥板、大齿胎，沙地泥地如履平地。',
    price: 1500,
    color: 0xff8c1a,
    accent: 0x222222,
    stats: { maxSpeed: 42, acceleration: 20, handling: 2.2, braking: 30, durability: 7.5, impactPower: 6, nitroCapacity: 100 },
    offroadGrip: 0.9,
    surfaceImmunity: 0.6,
    nitroRegen: 1,
    special: '复杂地形',
    ratings: { speed: '中', handling: '高', defense: '高' },
  },
  {
    id: 'super',
    name: '超级跑车',
    type: '跑车',
    desc: '全包围整流罩，直线上谁也追不上，但一撞就散。',
    price: 3200,
    color: 0x1f6bff,
    accent: 0xffe14a,
    stats: { maxSpeed: 49, acceleration: 23, handling: 1.85, braking: 30, durability: 3, impactPower: 4, nitroCapacity: 100 },
    offroadGrip: 0.5,
    surfaceImmunity: 0,
    nitroRegen: 1,
    special: '直线冲刺',
    ratings: { speed: '极高', handling: '中', defense: '低' },
  },
  {
    id: 'cruiser',
    name: '重型巡航车',
    type: '巡航',
    desc: '又长又重的铁家伙，冲撞时对手会像保龄球瓶一样飞出去。',
    price: 2600,
    color: 0x3b3b46,
    accent: 0xd8a24a,
    stats: { maxSpeed: 42, acceleration: 16.5, handling: 1.55, braking: 26, durability: 10, impactPower: 10, nitroCapacity: 100 },
    offroadGrip: 0.65,
    surfaceImmunity: 0.2,
    nitroRegen: 1,
    special: '强力冲撞',
    ratings: { speed: '中', handling: '低', defense: '极高' },
  },
  {
    id: 'mini',
    name: '迷你滑稽摩托',
    type: '迷你',
    desc: '轮子小、脑袋大，转弯灵活得离谱，就是有点丢人。',
    price: 1200,
    color: 0xff5fb3,
    accent: 0x7af0ff,
    stats: { maxSpeed: 41, acceleration: 22, handling: 2.8, braking: 34, durability: 3, impactPower: 3, nitroCapacity: 100 },
    offroadGrip: 0.6,
    surfaceImmunity: 0.1,
    nitroRegen: 1.1,
    special: '灵活搞怪',
    ratings: { speed: '中', handling: '极高', defense: '低' },
  },
  {
    id: 'rocket',
    name: '火箭摩托',
    type: '火箭',
    desc: '后座绑着一枚火箭，氮气容量与回复速度极高。',
    price: 4200,
    color: 0xb8bcc6,
    accent: 0xff3b2f,
    stats: { maxSpeed: 48, acceleration: 17.5, handling: 1.55, braking: 25, durability: 5, impactPower: 6, nitroCapacity: 165 },
    offroadGrip: 0.55,
    surfaceImmunity: 0,
    nitroRegen: 1.6,
    special: '高氮气能力',
    ratings: { speed: '极高', handling: '低', defense: '中' },
  },
  {
    id: 'amphibious',
    name: '水陆两栖摩托',
    type: '两栖',
    desc: '带浮筒的怪车，冰面、泥潭、沙地都不在话下。',
    price: 3600,
    color: 0x16b39a,
    accent: 0xffd23f,
    stats: { maxSpeed: 45, acceleration: 19.5, handling: 1.95, braking: 28, durability: 5.5, impactPower: 5, nitroCapacity: 110 },
    offroadGrip: 0.78,
    surfaceImmunity: 0.9,
    nitroRegen: 1,
    special: '特殊赛道适应',
    ratings: { speed: '高', handling: '中', defense: '中' },
  },
  {
    id: 'hover',
    name: '未来悬浮摩托',
    type: '悬浮',
    desc: '没有轮子，靠反重力悬浮，漂移时会划出炫目的光带。',
    price: 5200,
    color: 0x9b5cff,
    accent: 0x4ff7ff,
    stats: { maxSpeed: 45.5, acceleration: 20.5, handling: 2.3, braking: 28, durability: 3.5, impactPower: 4, nitroCapacity: 120 },
    offroadGrip: 0.8,
    surfaceImmunity: 0.5,
    nitroRegen: 1.15,
    special: '特殊漂移动画',
    ratings: { speed: '高', handling: '高', defense: '低' },
  },
];

export const getMotorcycle = (id: string) => MOTORCYCLES.find((m) => m.id === id) ?? MOTORCYCLES[0];

export interface UpgradeLevels {
  engine: number;
  handling: number;
  armor: number;
  nitro: number;
}
export const MAX_UPGRADE = 3;
export const UPGRADE_NAMES: Record<keyof UpgradeLevels, string> = {
  engine: '引擎（极速/加速）',
  handling: '悬挂（操控/刹车）',
  armor: '装甲（防御/冲撞）',
  nitro: '氮气罐（容量）',
};
export const upgradeCost = (level: number) => [400, 900, 1600][level] ?? 0;

/** 计算最终属性：摩托基础 × 升级（允许升级的模式） */
export function applyUpgrades(stats: MotorcycleStats, up: UpgradeLevels | undefined): MotorcycleStats {
  if (!up) return { ...stats };
  return {
    maxSpeed: stats.maxSpeed * (1 + up.engine * 0.025),
    acceleration: stats.acceleration * (1 + up.engine * 0.04),
    handling: stats.handling * (1 + up.handling * 0.04),
    braking: stats.braking * (1 + up.handling * 0.05),
    durability: stats.durability + up.armor * 0.8,
    impactPower: stats.impactPower + up.armor * 0.6,
    nitroCapacity: stats.nitroCapacity * (1 + up.nitro * 0.12),
  };
}
