export interface PelicanModifiers {
  attack: number; // 攻击伤害
  accel: number; // 加速
  handling: number; // 操控
  impact: number; // 冲撞
  item: number; // 道具效果/时长
  defense: number; // 受到伤害减免
  jump: number; // 跳跃/滞空
  cooldown: number; // 技能冷却倍率（越小越快）
}

export type PelicanAccessory =
  | 'pirateHat'
  | 'eyepatch'
  | 'sunglasses'
  | 'jacket'
  | 'ninjaMask'
  | 'mohawk'
  | 'goggles'
  | 'labcoat'
  | 'fireHelmet'
  | 'spaceHelmet'
  | 'mechWings'
  | 'metalBeak';

export interface PelicanDef {
  id: string;
  name: string;
  title: string;
  look: string;
  trait: string;
  desc: string;
  price: number;
  bodyColor: number;
  wingColor: number;
  beakColor: number;
  pouchColor: number;
  metallic?: boolean;
  accessories: PelicanAccessory[];
  mods: PelicanModifiers;
  voicePitch: number;
}

const base: PelicanModifiers = { attack: 1, accel: 1, handling: 1, impact: 1, item: 1, defense: 1, jump: 1, cooldown: 1 };
const m = (o: Partial<PelicanModifiers>): PelicanModifiers => ({ ...base, ...o });

export const PELICANS: PelicanDef[] = [
  {
    id: 'classic',
    name: '经典鹈鹕',
    title: '老佩',
    look: '白色羽毛、黄色大嘴',
    trait: '属性均衡',
    desc: '海岸公路的老面孔，什么都会一点，嘴巴能装下整整一桶沙丁鱼。',
    price: 0,
    bodyColor: 0xf7f4ec,
    wingColor: 0xe6e1d4,
    beakColor: 0xffc22e,
    pouchColor: 0xffa62b,
    accessories: [],
    mods: m({}),
    voicePitch: 1,
  },
  {
    id: 'pirate',
    name: '海盗鹈鹕',
    title: '独眼杰克',
    look: '海盗帽、眼罩',
    trait: '攻击力高',
    desc: '曾经抢劫过整条渔船的海盗，翅膀拍人格外疼。',
    price: 800,
    bodyColor: 0xf1ead8,
    wingColor: 0xd9cfb6,
    beakColor: 0xf0a52a,
    pouchColor: 0xe3862a,
    accessories: ['pirateHat', 'eyepatch'],
    mods: m({ attack: 1.35 }),
    voicePitch: 0.85,
  },
  {
    id: 'biker',
    name: '机车鹈鹕',
    title: '雷霆嘎嘎',
    look: '墨镜、皮夹克',
    trait: '加速能力强',
    desc: '戴着墨镜从不摘下，起步时尾灯都来不及亮。',
    price: 1000,
    bodyColor: 0xf5f2ea,
    wingColor: 0x2b2b2b,
    beakColor: 0xffb31f,
    pouchColor: 0xf09a20,
    accessories: ['sunglasses', 'jacket'],
    mods: m({ accel: 1.22 }),
    voicePitch: 0.9,
  },
  {
    id: 'ninja',
    name: '忍者鹈鹕',
    title: '影嘴',
    look: '黑色忍者装',
    trait: '操控灵活',
    desc: '来无影去无踪，过弯时连影子都追不上。',
    price: 1500,
    bodyColor: 0x2a2a35,
    wingColor: 0x1d1d26,
    beakColor: 0xffc22e,
    pouchColor: 0xe0a024,
    accessories: ['ninjaMask'],
    mods: m({ handling: 1.22, cooldown: 0.9 }),
    voicePitch: 1.1,
  },
  {
    id: 'rock',
    name: '摇滚鹈鹕',
    title: '嘶吼莫西',
    look: '莫西干发型',
    trait: '冲撞能力强',
    desc: '莫西干头比嘴还硬，撞人之前先来一段失真吉他。',
    price: 1500,
    bodyColor: 0xfaf6ee,
    wingColor: 0xe9e1d0,
    beakColor: 0xff9a1f,
    pouchColor: 0xff6a3d,
    accessories: ['mohawk'],
    mods: m({ impact: 1.4 }),
    voicePitch: 0.95,
  },
  {
    id: 'scientist',
    name: '科学家鹈鹕',
    title: '佩博士',
    look: '护目镜、实验服',
    trait: '道具能力强',
    desc: '把喉囊改造成了道具实验室，任何鱼到它嘴里都会变得更危险。',
    price: 2000,
    bodyColor: 0xf7f4ec,
    wingColor: 0xffffff,
    beakColor: 0xffd04a,
    pouchColor: 0x9fe36b,
    accessories: ['goggles', 'labcoat'],
    mods: m({ item: 1.4 }),
    voicePitch: 1.15,
  },
  {
    id: 'firefighter',
    name: '消防员鹈鹕',
    title: '水枪队长',
    look: '消防头盔',
    trait: '防御力高',
    desc: '戴着结实的消防头盔，被啄十下也只是晃一晃。',
    price: 2000,
    bodyColor: 0xf7f1e4,
    wingColor: 0xe6dcc6,
    beakColor: 0xffb823,
    pouchColor: 0xe88b2a,
    accessories: ['fireHelmet'],
    mods: m({ defense: 1.45 }),
    voicePitch: 0.88,
  },
  {
    id: 'astronaut',
    name: '宇航员鹈鹕',
    title: '月球嘟嘟',
    look: '太空服',
    trait: '跳跃能力强',
    desc: '在月球训练了三年，飞起来就不想落地。',
    price: 3000,
    bodyColor: 0xf3f3f6,
    wingColor: 0xdfe3ea,
    beakColor: 0xffc22e,
    pouchColor: 0xf0a52a,
    accessories: ['spaceHelmet'],
    mods: m({ jump: 1.45 }),
    voicePitch: 1.05,
  },
  {
    id: 'golden',
    name: '黄金鹈鹕',
    title: '金嘴传说',
    look: '金色羽毛',
    trait: '稀有收藏角色',
    desc: '传说中的黄金鹈鹕，全属性小幅提升，比赛金币收益 +20%。',
    price: 9000,
    bodyColor: 0xf2c54b,
    wingColor: 0xe0ac2c,
    beakColor: 0xfff1a8,
    pouchColor: 0xffe27a,
    metallic: true,
    accessories: [],
    mods: m({ attack: 1.08, accel: 1.08, handling: 1.08, impact: 1.08, item: 1.08, defense: 1.08, jump: 1.08 }),
    voicePitch: 1.2,
  },
  {
    id: 'mech',
    name: '机械鹈鹕',
    title: 'P-3L1C4N',
    look: '机械翅膀、金属嘴',
    trait: '特殊动画',
    desc: '实验室逃出来的机械鹈鹕，翅膀会旋转着拍人，攻防兼备。',
    price: 7000,
    bodyColor: 0x9aa3ad,
    wingColor: 0x6d7782,
    beakColor: 0xc9d2db,
    pouchColor: 0x5ad1ff,
    metallic: true,
    accessories: ['mechWings', 'metalBeak'],
    mods: m({ attack: 1.15, defense: 1.15, cooldown: 0.92 }),
    voicePitch: 0.7,
  },
];

export const getPelican = (id: string) => PELICANS.find((p) => p.id === id) ?? PELICANS[0];
