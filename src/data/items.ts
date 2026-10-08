export type ItemId =
  | 'stinkBomb'
  | 'frozenFish'
  | 'sardine'
  | 'featherStorm'
  | 'puffer'
  | 'banana'
  | 'goldenCarp'
  | 'rocketFish'
  | 'inkCloud'
  | 'fishBone';

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  desc: string;
  color: number;
  /** AI 用途分类 */
  kind: 'forward' | 'backward' | 'self' | 'area' | 'melee';
  /** 名次越靠后越容易获得的权重 [领先权重, 落后权重] */
  weight: [number, number];
}

export const ITEMS: ItemDef[] = [
  { id: 'stinkBomb', name: '臭鱼炸弹', icon: '💣', desc: '向前抛出，爆炸产生臭气，使附近骑手短暂打滑。', color: 0x8fbf3a, kind: 'forward', weight: [3, 3] },
  { id: 'frozenFish', name: '冰冻鱼', icon: '🧊', desc: '从大嘴喷出冰冻鱼，命中目标后使其短暂减速。', color: 0x8fe3ff, kind: 'forward', weight: [4, 2] },
  { id: 'sardine', name: '超级沙丁鱼', icon: '🐟', desc: '一口吞下，立刻恢复全部氮气能量。', color: 0x7fb2ff, kind: 'self', weight: [3, 4] },
  { id: 'featherStorm', name: '羽毛风暴', icon: '🪶', desc: '抖出漫天羽毛，干扰附近对手的视线。', color: 0xffffff, kind: 'area', weight: [2, 3] },
  { id: 'puffer', name: '弹力河豚', icon: '🐡', desc: '弹跳着前进的河豚，命中后将目标高高弹飞。', color: 0xffcf4a, kind: 'forward', weight: [2, 3] },
  { id: 'banana', name: '香蕉鱼皮', icon: '🍌', desc: '在身后路面留下打滑陷阱。', color: 0xffe14a, kind: 'backward', weight: [5, 1] },
  { id: 'goldenCarp', name: '黄金鲤鱼', icon: '✨', desc: '短时间获得无敌并小幅加速，撞开一切。', color: 0xffc400, kind: 'self', weight: [0.5, 3] },
  { id: 'rocketFish', name: '火箭鱼', icon: '🚀', desc: '发射追踪飞鱼，自动攻击前方最近的对手。', color: 0xff5a36, kind: 'forward', weight: [1, 4] },
  { id: 'inkCloud', name: '墨鱼烟雾', icon: '🦑', desc: '在身后释放墨汁烟雾，糊住后方对手的视线并减速。', color: 0x3a2d5c, kind: 'backward', weight: [4, 1] },
  { id: 'fishBone', name: '巨型鱼骨', icon: '🦴', desc: '掏出巨型鱼骨作为近战武器，持续横扫身边敌人。', color: 0xf3ead2, kind: 'melee', weight: [2, 3] },
];

export const getItem = (id: string) => ITEMS.find((i) => i.id === id)!;

/** 根据名次按权重随机道具（落后者更容易拿到强力道具） */
export function rollItem(position: number, total: number, itemBonus = 1): ItemId {
  const behind = total > 1 ? (position - 1) / (total - 1) : 0.5;
  let sum = 0;
  const weights = ITEMS.map((it) => {
    let w = it.weight[0] + (it.weight[1] - it.weight[0]) * behind;
    // 道具能力强的角色更容易获得强力道具
    if (itemBonus > 1 && (it.id === 'rocketFish' || it.id === 'goldenCarp' || it.id === 'puffer')) w *= itemBonus;
    sum += w;
    return w;
  });
  let r = Math.random() * sum;
  for (let i = 0; i < ITEMS.length; i++) {
    r -= weights[i];
    if (r <= 0) return ITEMS[i].id;
  }
  return ITEMS[0].id;
}
