export type CosmeticSlot = 'bodyColor' | 'wheel' | 'exhaust' | 'horn' | 'trail' | 'decal' | 'helmet' | 'glasses' | 'beakColor';

export interface CosmeticDef {
  id: string;
  slot: CosmeticSlot;
  name: string;
  price: number;
  /** 颜色类：颜色值；其他类：样式参数 */
  color?: number;
  style?: string;
}

export const SLOT_NAMES: Record<CosmeticSlot, string> = {
  bodyColor: '车身颜色',
  wheel: '车轮样式',
  exhaust: '排气管',
  horn: '喇叭声音',
  trail: '尾焰特效',
  decal: '车身贴纸',
  helmet: '鹈鹕头盔',
  glasses: '鹈鹕眼镜',
  beakColor: '大嘴颜色',
};

const c = (slot: CosmeticSlot, id: string, name: string, price: number, extra: Partial<CosmeticDef> = {}): CosmeticDef => ({
  id: `${slot}:${id}`,
  slot,
  name,
  price,
  ...extra,
});

export const COSMETICS: CosmeticDef[] = [
  c('bodyColor', 'default', '原厂配色', 0),
  c('bodyColor', 'red', '烈焰红', 0, { color: 0xe8423f }),
  c('bodyColor', 'blue', '海洋蓝', 0, { color: 0x1f8bff }),
  c('bodyColor', 'green', '薄荷绿', 150, { color: 0x34d399 }),
  c('bodyColor', 'yellow', '柠檬黄', 150, { color: 0xffd23f }),
  c('bodyColor', 'purple', '葡萄紫', 200, { color: 0x8b5cf6 }),
  c('bodyColor', 'pink', '泡泡粉', 200, { color: 0xff7ac6 }),
  c('bodyColor', 'black', '午夜黑', 300, { color: 0x1f2128 }),
  c('bodyColor', 'white', '珍珠白', 300, { color: 0xf3f4f6 }),
  c('bodyColor', 'gold', '土豪金', 1200, { color: 0xf2c54b }),

  c('wheel', 'classic', '经典轮毂', 0, { style: 'classic' }),
  c('wheel', 'spoke', '钢丝辐条', 200, { style: 'spoke' }),
  c('wheel', 'star', '五角星轮', 350, { style: 'star' }),
  c('wheel', 'neon', '霓虹发光', 600, { style: 'neon' }),
  c('wheel', 'gold', '黄金轮毂', 1000, { style: 'gold' }),

  c('exhaust', 'single', '单出排气', 0, { style: 'single' }),
  c('exhaust', 'dual', '双出排气', 250, { style: 'dual' }),
  c('exhaust', 'megaphone', '大喇叭排气', 400, { style: 'megaphone' }),
  c('exhaust', 'quad', '四出炮管', 700, { style: 'quad' }),

  c('horn', 'beep', '嘀嘀', 0, { style: 'beep' }),
  c('horn', 'duck', '嘎嘎鸭', 150, { style: 'duck' }),
  c('horn', 'trumpet', '小号', 300, { style: 'trumpet' }),
  c('horn', 'airhorn', '汽笛', 450, { style: 'airhorn' }),
  c('horn', 'squeak', '橡皮鸭', 300, { style: 'squeak' }),

  c('trail', 'flame', '经典火焰', 0, { style: 'flame', color: 0xff7a1a }),
  c('trail', 'plasma', '蓝色等离子', 400, { style: 'plasma', color: 0x3cc8ff }),
  c('trail', 'rainbow', '彩虹尾迹', 800, { style: 'rainbow', color: 0xff4fd8 }),
  c('trail', 'bubbles', '鱼泡泡', 500, { style: 'bubbles', color: 0x9fe8ff }),
  c('trail', 'stars', '星光闪闪', 700, { style: 'stars', color: 0xffe14a }),

  c('decal', 'none', '无贴纸', 0, { style: 'none' }),
  c('decal', 'stripes', '赛车条纹', 150, { style: 'stripes' }),
  c('decal', 'flames', '火焰贴花', 300, { style: 'flames' }),
  c('decal', 'stars', '星星贴纸', 250, { style: 'stars' }),
  c('decal', 'fish', '小鱼贴纸', 250, { style: 'fish' }),
  c('decal', 'checker', '赛车格纹', 350, { style: 'checker' }),

  c('helmet', 'none', '不戴头盔', 0, { style: 'none' }),
  c('helmet', 'classic', '经典头盔', 150, { style: 'classic', color: 0xff3b3b }),
  c('helmet', 'viking', '维京角盔', 500, { style: 'viking', color: 0x9aa0a8 }),
  c('helmet', 'cowboy', '牛仔帽', 400, { style: 'cowboy', color: 0x9a6233 }),
  c('helmet', 'crown', '小皇冠', 900, { style: 'crown', color: 0xffcc22 }),
  c('helmet', 'propeller', '螺旋桨帽', 600, { style: 'propeller', color: 0x3c8bff }),

  c('glasses', 'none', '不戴眼镜', 0, { style: 'none' }),
  c('glasses', 'round', '圆框眼镜', 120, { style: 'round', color: 0x222222 }),
  c('glasses', 'star', '星星墨镜', 300, { style: 'star', color: 0xff4fa3 }),
  c('glasses', 'heart', '爱心墨镜', 300, { style: 'heart', color: 0xff3355 }),
  c('glasses', 'aviator', '飞行员墨镜', 400, { style: 'aviator', color: 0xc9a227 }),
  c('glasses', 'monocle', '绅士单片镜', 500, { style: 'monocle', color: 0xd4af37 }),

  c('beakColor', 'default', '原生嘴色', 0),
  c('beakColor', 'orange', '橘子嘴', 100, { color: 0xff8a1f }),
  c('beakColor', 'pink', '草莓嘴', 200, { color: 0xff6fb5 }),
  c('beakColor', 'blue', '冰蓝嘴', 250, { color: 0x5ac8ff }),
  c('beakColor', 'black', '酷黑嘴', 300, { color: 0x2b2b2b }),
  c('beakColor', 'lime', '荧光绿嘴', 300, { color: 0x9cff3a }),
];

export const DEFAULT_COSMETICS: Record<CosmeticSlot, string> = {
  bodyColor: 'bodyColor:default',
  wheel: 'wheel:classic',
  exhaust: 'exhaust:single',
  horn: 'horn:beep',
  trail: 'trail:flame',
  decal: 'decal:none',
  helmet: 'helmet:none',
  glasses: 'glasses:none',
  beakColor: 'beakColor:default',
};

export const getCosmetic = (id: string) => COSMETICS.find((x) => x.id === id);
export const cosmeticsForSlot = (slot: CosmeticSlot) => COSMETICS.filter((x) => x.slot === slot);

/** 玩家装备外观的解析结果 */
export interface Appearance {
  bodyColor?: number;
  wheel: string;
  exhaust: string;
  horn: string;
  trail: string;
  trailColor: number;
  decal: string;
  helmet: string;
  helmetColor: number;
  glasses: string;
  glassesColor: number;
  beakColor?: number;
}

export function resolveAppearance(equipped: Partial<Record<CosmeticSlot, string>>): Appearance {
  const get = (slot: CosmeticSlot) => getCosmetic(equipped[slot] ?? DEFAULT_COSMETICS[slot]) ?? getCosmetic(DEFAULT_COSMETICS[slot])!;
  const trail = get('trail');
  const helmet = get('helmet');
  const glasses = get('glasses');
  return {
    bodyColor: get('bodyColor').color,
    wheel: get('wheel').style ?? 'classic',
    exhaust: get('exhaust').style ?? 'single',
    horn: get('horn').style ?? 'beep',
    trail: trail.style ?? 'flame',
    trailColor: trail.color ?? 0xff7a1a,
    decal: get('decal').style ?? 'none',
    helmet: helmet.style ?? 'none',
    helmetColor: helmet.color ?? 0xff3b3b,
    glasses: glasses.style ?? 'none',
    glassesColor: glasses.color ?? 0x222222,
    beakColor: get('beakColor').color,
  };
}

/** AI 使用的随机外观 */
export function randomAppearance(rng: () => number = Math.random): Appearance {
  const pickSlot = (slot: CosmeticSlot) => {
    const list = cosmeticsForSlot(slot);
    return list[Math.floor(rng() * list.length)].id;
  };
  const eq: Partial<Record<CosmeticSlot, string>> = {};
  (Object.keys(DEFAULT_COSMETICS) as CosmeticSlot[]).forEach((s) => {
    eq[s] = rng() < 0.45 ? pickSlot(s) : DEFAULT_COSMETICS[s];
  });
  eq.beakColor = DEFAULT_COSMETICS.beakColor;
  return resolveAppearance(eq);
}
