/**
 * 赛道配置：所有赛道由统一的数据配置驱动（PRD 4.1）。
 * 赛道中心线由极坐标谐波函数生成闭合样条；特征（跳台、加速带、障碍、捷径等）用归一化进度 t∈[0,1) 定位。
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** 检查点：t 为沿主赛道的归一化进度 */
export interface Checkpoint {
  t: number;
}

export type SurfaceType =
  | 'asphalt'
  | 'sand'
  | 'ice'
  | 'mud'
  | 'wood'
  | 'metal'
  | 'rainbow'
  | 'moon'
  | 'dirt'
  | 'neon'
  | 'snow'
  | 'rock';

export type ObstacleType =
  | 'cone'
  | 'barrel'
  | 'crate'
  | 'rock'
  | 'hay'
  | 'log'
  | 'car'
  | 'cactus'
  | 'snowman'
  | 'tire'
  | 'container'
  | 'boulder'
  | 'lavaRock'
  | 'beachChair';

export interface ObstacleConfig {
  type: ObstacleType;
  t: number;
  lateral: number;
}

export type HazardType =
  | 'traffic'
  | 'rockfall'
  | 'snowball'
  | 'geyser'
  | 'crane'
  | 'animals'
  | 'tractor'
  | 'tumbleweed'
  | 'meteor'
  | 'beachball'
  | 'liftRamp';

export interface HazardConfig {
  type: HazardType;
  t: number;
  /** 部分危险物的数量/范围 */
  count?: number;
  span?: number;
}

export type ShortcutStyle = 'boardwalk' | 'tunnel' | 'dune' | 'iceCave' | 'waterfall' | 'lavaTube' | 'shipDeck' | 'barn' | 'rainbowBridge' | 'crater';

export interface ShortcutConfig {
  id: string;
  name: string;
  t0: number;
  t1: number;
  style: ShortcutStyle;
  width: number;
  /** 捷径中段抬升高度 */
  lift: number;
  /** 0~1：向弦线（直线）靠拢的程度，越大越短 */
  blend: number;
  surface: SurfaceType;
}

export interface RampConfig {
  t: number;
  lateral: number;
  width: number;
  length: number;
  height: number;
}

export interface GapConfig {
  t: number;
  length: number;
}

export interface PropConfig {
  type: string;
  /** 每 100 米的数量 */
  density: number;
  minOff: number;
  maxOff: number;
  scale: [number, number];
  side?: 'both' | 'left' | 'right';
}

export interface LandmarkConfig {
  type: string;
  t: number;
  side: -1 | 1;
  offset: number;
  scale?: number;
}

export interface TrackTheme {
  skyTop: number;
  skyBottom: number;
  fog: number;
  fogNear: number;
  fogFar: number;
  ground: number;
  shoulder: number;
  road: number;
  roadLine: number;
  curbA: number;
  curbB: number;
  wall: number;
  sun: number;
  sunIntensity: number;
  ambient: number;
  hemiGround: number;
  night?: boolean;
  stars?: boolean;
  water?: number;
  waterLevel?: number;
  lava?: boolean;
  cloudSea?: boolean;
  groundLevel?: number;
}

export interface TrackConfig {
  id: string;
  name: string;
  theme: string;
  description: string;
  feature: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  laps: number;
  /** 赛道长度（米），加载时由几何生成回填 */
  length: number;
  checkpoints: Checkpoint[];
  /** 出生点：x=横向偏移, z=相对起跑线向后的距离, y=0 */
  spawnPoints: Vec3Like[];
  obstacles: ObstacleConfig[];
  shortcuts: ShortcutConfig[];
  weather: string[];
  music: string;
  // ——— 几何与玩法扩展 ———
  shape: {
    radius: number;
    sx: number;
    sz: number;
    harmonics: [number, number, number][]; // [振幅, 频率, 相位]
    elevation: [number, number, number][];
    baseHeight: number;
  };
  width: number;
  surface: SurfaceType;
  edge: 'offroad' | 'wall' | 'fall';
  gravity: number;
  ramps: RampConfig[];
  gaps: GapConfig[];
  boostPads: { t: number; lateral: number }[];
  itemRows: number[];
  surfaceZones: { t0: number; t1: number; surface: SurfaceType }[];
  hazards: HazardConfig[];
  randomObstacles: { types: ObstacleType[]; count: number };
  props: PropConfig[];
  landmarks: LandmarkConfig[];
  palette: TrackTheme;
  unlockPrice: number;
}

const spawn = (): Vec3Like[] => {
  const pts: Vec3Like[] = [];
  for (let i = 0; i < 8; i++) {
    const row = Math.floor(i / 2);
    const lane = i % 2 === 0 ? -1 : 1;
    pts.push({ x: lane * 3 + (row % 2) * 0.8 * lane, y: 0, z: 8 + row * 7 });
  }
  return pts;
};

const checkpoints = (n = 16): Checkpoint[] => Array.from({ length: n }, (_, i) => ({ t: i / n }));

export const TRACKS: TrackConfig[] = [
  {
    id: 'coast',
    name: '鹈鹕海岸公路',
    theme: '海滨',
    description: '海滨公路、沙滩、棕榈树、海鸥群。宽阔直道搭配缓弯，适合熟悉驾驶和战斗。',
    feature: '捷径：海边木栈道',
    difficulty: 1,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [
      { type: 'beachChair', t: 0.33, lateral: -5 },
      { type: 'beachChair', t: 0.335, lateral: 4 },
      { type: 'barrel', t: 0.62, lateral: 0 },
    ],
    shortcuts: [{ id: 'coast-boardwalk', name: '海边木栈道', t0: 0.515, t1: 0.645, style: 'boardwalk', width: 9, lift: 1.2, blend: 0.75, surface: 'wood' }],
    weather: ['sunny', 'seagulls'],
    music: 'surf',
    shape: { radius: 190, sx: 1.25, sz: 0.9, harmonics: [[0.216, 2, 0.4], [0.126, 3, 1.3]], elevation: [[3, 2, 0.5], [1.5, 5, 1]], baseHeight: 2 },
    width: 18,
    surface: 'asphalt',
    edge: 'offroad',
    gravity: 25,
    ramps: [{ t: 0.47, lateral: 0, width: 8, length: 9, height: 1.8 }],
    gaps: [],
    boostPads: [{ t: 0.08, lateral: 3 }, { t: 0.45, lateral: 0 }, { t: 0.74, lateral: -3 }],
    itemRows: [0.12, 0.38, 0.6, 0.86],
    surfaceZones: [],
    hazards: [{ type: 'beachball', t: 0.55, count: 6, span: 0.08 }],
    randomObstacles: { types: ['cone', 'barrel', 'crate'], count: 10 },
    props: [
      { type: 'palm', density: 3.2, minOff: 14, maxOff: 40, scale: [0.9, 1.4] },
      { type: 'umbrella', density: 1.4, minOff: 13, maxOff: 30, scale: [0.9, 1.2], side: 'right' },
      { type: 'rockSmall', density: 1.2, minOff: 12, maxOff: 45, scale: [0.6, 1.6] },
      { type: 'bush', density: 2, minOff: 12, maxOff: 50, scale: [0.7, 1.3] },
    ],
    landmarks: [
      { type: 'lighthouse', t: 0.22, side: 1, offset: 60, scale: 1.4 },
      { type: 'beachHut', t: 0.05, side: 1, offset: 30 },
      { type: 'beachHut', t: 0.7, side: -1, offset: 32 },
    ],
    palette: {
      skyTop: 0x2f8fe6, skyBottom: 0xbfe8ff, fog: 0xbfe3f5, fogNear: 120, fogFar: 650,
      ground: 0xf3d99b, shoulder: 0xf0d48f, road: 0x55595f, roadLine: 0xffffff, curbA: 0xff4d4d, curbB: 0xffffff,
      wall: 0xffffff, sun: 0xfff3d6, sunIntensity: 2.6, ambient: 0.9, hemiGround: 0xf1d79c,
      water: 0x27b5d8, waterLevel: -1.2, groundLevel: -1,
    },
    unlockPrice: 0,
  },
  {
    id: 'neon',
    name: '霓虹都市',
    theme: '城市',
    description: '夜间城市、霓虹广告、立交桥和隧道。道路狭窄，交通障碍较多，可以利用坡道飞越车辆。',
    feature: '捷径：地下隧道',
    difficulty: 2,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [
      { type: 'car', t: 0.305, lateral: -3 },
      { type: 'car', t: 0.31, lateral: 3 },
      { type: 'car', t: 0.318, lateral: 0 },
      { type: 'car', t: 0.705, lateral: -2.5 },
      { type: 'car', t: 0.712, lateral: 2.5 },
    ],
    shortcuts: [{ id: 'neon-tunnel', name: '地下隧道', t0: 0.335, t1: 0.465, style: 'tunnel', width: 9, lift: 0, blend: 0.8, surface: 'neon' }],
    weather: ['night', 'rain'],
    music: 'synth',
    shape: { radius: 170, sx: 1.1, sz: 1, harmonics: [[0.232, 3, 0.2], [0.087, 5, 2]], elevation: [[5, 1, 0.3], [2, 3, 1.2]], baseHeight: 4 },
    width: 14,
    surface: 'asphalt',
    edge: 'wall',
    gravity: 25,
    ramps: [
      { t: 0.295, lateral: 0, width: 12, length: 10, height: 2.6 },
      { t: 0.695, lateral: 0, width: 12, length: 10, height: 2.6 },
    ],
    gaps: [],
    boostPads: [{ t: 0.285, lateral: 0 }, { t: 0.685, lateral: 0 }, { t: 0.06, lateral: 0 }],
    itemRows: [0.15, 0.45, 0.8],
    surfaceZones: [],
    hazards: [{ type: 'traffic', t: 0, count: 6 }],
    randomObstacles: { types: ['cone', 'barrel', 'tire'], count: 12 },
    props: [
      { type: 'building', density: 4, minOff: 14, maxOff: 60, scale: [0.8, 1.8] },
      { type: 'streetLamp', density: 2.5, minOff: 8.5, maxOff: 9.5, scale: [1, 1] },
      { type: 'neonSign', density: 1.2, minOff: 12, maxOff: 18, scale: [0.8, 1.3] },
    ],
    landmarks: [
      { type: 'tower', t: 0.1, side: -1, offset: 80, scale: 1.5 },
      { type: 'tower', t: 0.4, side: 1, offset: 90, scale: 1.2 },
      { type: 'billboard', t: 0.85, side: 1, offset: 20 },
      { type: 'billboard', t: 0.25, side: -1, offset: 20 },
    ],
    palette: {
      skyTop: 0x0b0b2a, skyBottom: 0x3a1a5e, fog: 0x2a1748, fogNear: 60, fogFar: 420,
      ground: 0x2b2b38, shoulder: 0x3a3a48, road: 0x26262e, roadLine: 0x56f6ff, curbA: 0xff3cac, curbB: 0x2b2bff,
      wall: 0x5a5a72, sun: 0x9fb4ff, sunIntensity: 0.8, ambient: 0.55, hemiGround: 0x30204a, night: true, groundLevel: -2,
    },
    unlockPrice: 400,
  },
  {
    id: 'desert',
    name: '沙漠死亡公路',
    theme: '沙漠',
    description: '沙丘、仙人掌、峡谷、废弃加油站。沙地会降低抓地力，沙尘暴影响视线。',
    feature: '捷径：隐藏沙丘跳台',
    difficulty: 2,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [],
    shortcuts: [{ id: 'desert-dune', name: '隐藏沙丘跳台', t0: 0.475, t1: 0.605, style: 'dune', width: 9, lift: 2, blend: 0.85, surface: 'sand' }],
    weather: ['sunny', 'sandstorm', 'dust'],
    music: 'western',
    shape: { radius: 210, sx: 1.2, sz: 0.95, harmonics: [[0.252, 2, 1.7], [0.144, 4, 0.3]], elevation: [[6, 2, 0.1], [2, 4, 0.9]], baseHeight: 3 },
    width: 17,
    surface: 'asphalt',
    edge: 'offroad',
    gravity: 25,
    ramps: [
      { t: 0.2, lateral: -3, width: 7, length: 9, height: 2 },
      { t: 0.75, lateral: 3, width: 7, length: 9, height: 2 },
    ],
    gaps: [],
    boostPads: [{ t: 0.1, lateral: 0 }, { t: 0.6, lateral: -4 }, { t: 0.9, lateral: 4 }],
    itemRows: [0.14, 0.35, 0.65, 0.88],
    surfaceZones: [
      { t0: 0.26, t1: 0.32, surface: 'sand' },
      { t0: 0.66, t1: 0.71, surface: 'sand' },
    ],
    hazards: [{ type: 'tumbleweed', t: 0, count: 8 }],
    randomObstacles: { types: ['cactus', 'rock', 'tire', 'barrel'], count: 12 },
    props: [
      { type: 'cactus', density: 2.4, minOff: 13, maxOff: 60, scale: [0.8, 1.6] },
      { type: 'rockBig', density: 1, minOff: 25, maxOff: 80, scale: [1, 2.5] },
      { type: 'rockSmall', density: 1.8, minOff: 12, maxOff: 50, scale: [0.6, 1.4] },
      { type: 'dune', density: 0.8, minOff: 35, maxOff: 90, scale: [1, 2] },
    ],
    landmarks: [
      { type: 'gasStation', t: 0.05, side: 1, offset: 26 },
      { type: 'mesa', t: 0.3, side: -1, offset: 110, scale: 2 },
      { type: 'mesa', t: 0.62, side: 1, offset: 120, scale: 2.4 },
      { type: 'mesa', t: 0.9, side: -1, offset: 130, scale: 1.6 },
    ],
    palette: {
      skyTop: 0x4d9be0, skyBottom: 0xffd9a0, fog: 0xf0c890, fogNear: 100, fogFar: 600,
      ground: 0xe6b56b, shoulder: 0xdcab62, road: 0x6b5e55, roadLine: 0xffe066, curbA: 0xe8423f, curbB: 0xfff1d0,
      wall: 0xc98f4e, sun: 0xffe2b0, sunIntensity: 3, ambient: 0.85, hemiGround: 0xd8a35a, groundLevel: -1,
    },
    unlockPrice: 600,
  },
  {
    id: 'snow',
    name: '雪山冰封之路',
    theme: '雪山',
    description: '雪山、冰湖、雪松、冰洞。冰面抓地力降低，部分路段有落石和雪球障碍。',
    feature: '捷径：冰洞穿越',
    difficulty: 3,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [
      { type: 'snowman', t: 0.18, lateral: -4 },
      { type: 'snowman', t: 0.58, lateral: 3 },
    ],
    shortcuts: [{ id: 'snow-cave', name: '冰洞穿越', t0: 0.655, t1: 0.785, style: 'iceCave', width: 9, lift: 0, blend: 0.8, surface: 'ice' }],
    weather: ['snow'],
    music: 'alpine',
    shape: { radius: 185, sx: 1.05, sz: 1.1, harmonics: [[0.24, 3, 0.9], [0.096, 2, 2.1]], elevation: [[10, 1, 0.7], [3, 3, 0.2]], baseHeight: 12 },
    width: 16,
    surface: 'asphalt',
    edge: 'offroad',
    gravity: 25,
    ramps: [{ t: 0.4, lateral: 0, width: 9, length: 10, height: 2.2 }],
    gaps: [],
    boostPads: [{ t: 0.05, lateral: 0 }, { t: 0.38, lateral: 0 }, { t: 0.85, lateral: 3 }],
    itemRows: [0.12, 0.33, 0.55, 0.9],
    surfaceZones: [
      { t0: 0.22, t1: 0.3, surface: 'ice' },
      { t0: 0.5, t1: 0.56, surface: 'ice' },
      { t0: 0.88, t1: 0.93, surface: 'snow' },
    ],
    hazards: [
      { type: 'rockfall', t: 0.14, span: 0.06 },
      { type: 'snowball', t: 0.46, count: 2, span: 0.05 },
      { type: 'rockfall', t: 0.84, span: 0.05 },
    ],
    randomObstacles: { types: ['rock', 'snowman', 'rock'], count: 9 },
    props: [
      { type: 'pine', density: 4.5, minOff: 12, maxOff: 60, scale: [0.8, 1.7] },
      { type: 'rockSnow', density: 1.4, minOff: 12, maxOff: 50, scale: [0.7, 1.8] },
    ],
    landmarks: [
      { type: 'mountain', t: 0.1, side: -1, offset: 160, scale: 3 },
      { type: 'mountain', t: 0.35, side: 1, offset: 180, scale: 3.6 },
      { type: 'mountain', t: 0.6, side: -1, offset: 170, scale: 2.8 },
      { type: 'mountain', t: 0.85, side: 1, offset: 150, scale: 3.2 },
      { type: 'iceLake', t: 0.5, side: -1, offset: 50 },
      { type: 'cabin', t: 0.02, side: 1, offset: 24 },
    ],
    palette: {
      skyTop: 0x6aa8e8, skyBottom: 0xe8f4ff, fog: 0xdfeefa, fogNear: 80, fogFar: 520,
      ground: 0xf4f8ff, shoulder: 0xeaf2fd, road: 0x59606b, roadLine: 0xffffff, curbA: 0x3a7bff, curbB: 0xffffff,
      wall: 0xbfd6ee, sun: 0xffffff, sunIntensity: 2.4, ambient: 1, hemiGround: 0xe9f1ff, groundLevel: 0,
    },
    unlockPrice: 800,
  },
  {
    id: 'jungle',
    name: '热带雨林',
    theme: '雨林',
    description: '茂密森林、瀑布、木桥、泥潭。藤蔓与倒木形成障碍。',
    feature: '捷径：穿越瀑布',
    difficulty: 3,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [
      { type: 'log', t: 0.27, lateral: -3 },
      { type: 'log', t: 0.52, lateral: 3 },
      { type: 'log', t: 0.83, lateral: 0 },
    ],
    shortcuts: [{ id: 'jungle-falls', name: '瀑布暗道', t0: 0.51, t1: 0.64, style: 'waterfall', width: 9, lift: 0.5, blend: 0.8, surface: 'dirt' }],
    weather: ['leaves', 'mist'],
    music: 'jungle',
    shape: { radius: 175, sx: 1.15, sz: 1, harmonics: [[0.189, 3, 2.5], [0.131, 4, 0.7]], elevation: [[5, 2, 1.4], [3, 3, 0.1]], baseHeight: 5 },
    width: 15,
    surface: 'dirt',
    edge: 'offroad',
    gravity: 25,
    ramps: [{ t: 0.66, lateral: 0, width: 8, length: 9, height: 2 }],
    gaps: [],
    boostPads: [{ t: 0.08, lateral: 0 }, { t: 0.64, lateral: 0 }],
    itemRows: [0.15, 0.48, 0.72, 0.92],
    surfaceZones: [
      { t0: 0.2, t1: 0.25, surface: 'mud' },
      { t0: 0.56, t1: 0.6, surface: 'mud' },
      { t0: 0.86, t1: 0.89, surface: 'wood' },
    ],
    hazards: [{ type: 'animals', t: 0.76, count: 3 }],
    randomObstacles: { types: ['log', 'rock', 'crate'], count: 10 },
    props: [
      { type: 'jungleTree', density: 5, minOff: 11, maxOff: 55, scale: [0.9, 1.8] },
      { type: 'fern', density: 4, minOff: 10, maxOff: 30, scale: [0.8, 1.5] },
      { type: 'vine', density: 0.8, minOff: 9, maxOff: 10, scale: [1, 1.2] },
    ],
    landmarks: [
      { type: 'waterfallCliff', t: 0.38, side: 1, offset: 70, scale: 1.4 },
      { type: 'temple', t: 0.75, side: -1, offset: 60 },
    ],
    palette: {
      skyTop: 0x5ab0c8, skyBottom: 0xcdf2d8, fog: 0x9fd4b0, fogNear: 50, fogFar: 380,
      ground: 0x3f8a3a, shoulder: 0x4f9a40, road: 0x8a6440, roadLine: 0xf2d38c, curbA: 0x6b4423, curbB: 0xc8a165,
      wall: 0x5a3d22, sun: 0xfff2c8, sunIntensity: 2.2, ambient: 0.85, hemiGround: 0x2e6b2c,
      water: 0x2b9db0, waterLevel: -1.5, groundLevel: -1,
    },
    unlockPrice: 1000,
  },
  {
    id: 'volcano',
    name: '火山熔岩环道',
    theme: '火山',
    description: '活火山、熔岩河、断裂岩桥。地面间歇喷发岩浆，部分平台会周期性升降。',
    feature: '捷径：熔岩隧道',
    difficulty: 4,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [],
    shortcuts: [{ id: 'volcano-tube', name: '熔岩隧道', t0: 0.55, t1: 0.68, style: 'lavaTube', width: 9, lift: 0, blend: 0.8, surface: 'rock' }],
    weather: ['embers', 'ash'],
    music: 'metal',
    shape: { radius: 180, sx: 1.1, sz: 1.05, harmonics: [[0.21, 2, 0.2], [0.12, 5, 1.1]], elevation: [[6, 1, 2.2], [2, 4, 0.4]], baseHeight: 14 },
    width: 16,
    surface: 'rock',
    edge: 'fall',
    gravity: 25,
    ramps: [],
    gaps: [
      { t: 0.27, length: 13 },
      { t: 0.84, length: 12 },
    ],
    boostPads: [{ t: 0.05, lateral: 0 }, { t: 0.5, lateral: 0 }],
    itemRows: [0.12, 0.4, 0.55, 0.78],
    surfaceZones: [],
    hazards: [
      { type: 'geyser', t: 0.17, count: 2 },
      { type: 'geyser', t: 0.47, count: 2 },
      { type: 'geyser', t: 0.93, count: 1 },
      { type: 'liftRamp', t: 0.36 },
      { type: 'liftRamp', t: 0.74 },
    ],
    randomObstacles: { types: ['lavaRock', 'boulder'], count: 9 },
    props: [
      { type: 'lavaRockProp', density: 1.6, minOff: 14, maxOff: 50, scale: [0.8, 2] },
      { type: 'deadTree', density: 0.8, minOff: 14, maxOff: 40, scale: [0.8, 1.4] },
    ],
    landmarks: [
      { type: 'volcano', t: 0.5, side: -1, offset: 0, scale: 1 },
    ],
    palette: {
      skyTop: 0x2a0c0c, skyBottom: 0xb8452a, fog: 0x6a2a1e, fogNear: 60, fogFar: 450,
      ground: 0x2b2222, shoulder: 0x3a2b28, road: 0x3b3433, roadLine: 0xffa020, curbA: 0xff5a1f, curbB: 0x2a2020,
      wall: 0x4a3a36, sun: 0xffb27a, sunIntensity: 1.6, ambient: 0.7, hemiGround: 0x8a2a10, lava: true, groundLevel: -6,
    },
    unlockPrice: 1400,
  },
  {
    id: 'port',
    name: '疯狂港口',
    theme: '港口',
    description: '集装箱、货轮、起重机、码头。动态吊运集装箱形成障碍。',
    feature: '捷径：货船甲板',
    difficulty: 3,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [
      { type: 'container', t: 0.42, lateral: -4.5 },
      { type: 'container', t: 0.78, lateral: 4.5 },
    ],
    shortcuts: [{ id: 'port-ship', name: '货船甲板', t0: 0.39, t1: 0.52, style: 'shipDeck', width: 10, lift: 3, blend: 0.85, surface: 'metal' }],
    weather: ['overcast', 'seagulls'],
    music: 'ska',
    shape: { radius: 195, sx: 1.2, sz: 0.92, harmonics: [[0.2, 2, 2.6], [0.2, 3, 0.4]], elevation: [[2, 2, 0.4], [1, 5, 1.2]], baseHeight: 2 },
    width: 16,
    surface: 'asphalt',
    edge: 'wall',
    gravity: 25,
    ramps: [{ t: 0.6, lateral: 0, width: 10, length: 10, height: 2.2 }],
    gaps: [],
    boostPads: [{ t: 0.08, lateral: 0 }, { t: 0.58, lateral: 0 }, { t: 0.9, lateral: -3 }],
    itemRows: [0.14, 0.38, 0.68, 0.86],
    surfaceZones: [{ t0: 0.5, t1: 0.53, surface: 'metal' }],
    hazards: [
      { type: 'crane', t: 0.46 },
      { type: 'crane', t: 0.95 },
    ],
    randomObstacles: { types: ['crate', 'barrel', 'tire', 'cone'], count: 14 },
    props: [
      { type: 'containerStack', density: 2.2, minOff: 13, maxOff: 50, scale: [1, 1] },
      { type: 'bollard', density: 2, minOff: 9.5, maxOff: 10.5, scale: [1, 1] },
      { type: 'craneProp', density: 0.25, minOff: 30, maxOff: 50, scale: [1, 1.3] },
    ],
    landmarks: [
      { type: 'cargoShip', t: 0.265, side: -1, offset: 0, scale: 1 },
      { type: 'lighthouse', t: 0.6, side: 1, offset: 70 },
    ],
    palette: {
      skyTop: 0x6e8fb0, skyBottom: 0xd4e0ea, fog: 0xc2cfda, fogNear: 90, fogFar: 520,
      ground: 0x7d838a, shoulder: 0x8a9097, road: 0x4b4f55, roadLine: 0xffd23f, curbA: 0xffd23f, curbB: 0x2b2b2b,
      wall: 0xd8a23a, sun: 0xf6f2e8, sunIntensity: 2, ambient: 0.95, hemiGround: 0x6b7178,
      water: 0x2a6f8f, waterLevel: -2, groundLevel: -1,
    },
    unlockPrice: 1200,
  },
  {
    id: 'farm',
    name: '乡村农场',
    theme: '农场',
    description: '麦田、风车、谷仓、牲畜。拖拉机和干草堆阻碍通行，偶尔有动物横穿道路。',
    feature: '捷径：穿越谷仓',
    difficulty: 2,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [
      { type: 'hay', t: 0.22, lateral: -4 },
      { type: 'hay', t: 0.225, lateral: 4 },
      { type: 'hay', t: 0.55, lateral: 0 },
      { type: 'hay', t: 0.81, lateral: -3 },
    ],
    shortcuts: [{ id: 'farm-barn', name: '穿越谷仓', t0: 0.535, t1: 0.665, style: 'barn', width: 9, lift: 0, blend: 0.8, surface: 'dirt' }],
    weather: ['sunny', 'pollen'],
    music: 'country',
    shape: { radius: 200, sx: 1.15, sz: 1, harmonics: [[0.228, 3, 1.9], [0.133, 2, 0.6]], elevation: [[4, 2, 2], [2, 3, 0.4]], baseHeight: 3 },
    width: 16,
    surface: 'asphalt',
    edge: 'offroad',
    gravity: 25,
    ramps: [{ t: 0.4, lateral: 0, width: 8, length: 9, height: 2.1 }],
    gaps: [],
    boostPads: [{ t: 0.06, lateral: 0 }, { t: 0.38, lateral: 0 }, { t: 0.92, lateral: 3 }],
    itemRows: [0.13, 0.3, 0.5, 0.85],
    surfaceZones: [{ t0: 0.44, t1: 0.48, surface: 'mud' }],
    hazards: [
      { type: 'tractor', t: 0.15 },
      { type: 'tractor', t: 0.65 },
      { type: 'animals', t: 0.33, count: 4 },
      { type: 'animals', t: 0.9, count: 3 },
    ],
    randomObstacles: { types: ['hay', 'crate', 'tire'], count: 10 },
    props: [
      { type: 'wheat', density: 6, minOff: 12, maxOff: 45, scale: [0.9, 1.3] },
      { type: 'tree', density: 1.5, minOff: 15, maxOff: 60, scale: [0.9, 1.5] },
      { type: 'fence', density: 3, minOff: 10.5, maxOff: 11, scale: [1, 1] },
    ],
    landmarks: [
      { type: 'windmill', t: 0.1, side: 1, offset: 45, scale: 1.3 },
      { type: 'windmill', t: 0.52, side: -1, offset: 55 },
      { type: 'barnProp', t: 0.3, side: 1, offset: 35 },
      { type: 'silo', t: 0.88, side: -1, offset: 35 },
    ],
    palette: {
      skyTop: 0x3f9be8, skyBottom: 0xd6f0ff, fog: 0xcfe6f2, fogNear: 110, fogFar: 600,
      ground: 0x7cc451, shoulder: 0x86c95a, road: 0x5c5a58, roadLine: 0xffffff, curbA: 0xd13c2f, curbB: 0xffffff,
      wall: 0x9a6a3a, sun: 0xfff1cf, sunIntensity: 2.6, ambient: 0.95, hemiGround: 0x6aa844, groundLevel: -1,
    },
    unlockPrice: 900,
  },
  {
    id: 'sky',
    name: '天空彩虹公路',
    theme: '天空',
    description: '云层、悬浮道路、彩虹桥、空中平台。连续跳台和高空捷径带来强烈速度感。',
    feature: '捷径：高空彩虹桥',
    difficulty: 5,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [],
    shortcuts: [{ id: 'sky-rainbow', name: '高空彩虹桥', t0: 0.36, t1: 0.49, style: 'rainbowBridge', width: 9, lift: 6, blend: 0.85, surface: 'rainbow' }],
    weather: ['clouds', 'sparkles'],
    music: 'dream',
    shape: { radius: 185, sx: 1.1, sz: 1, harmonics: [[0.234, 2, 2.2], [0.144, 3, 0.9]], elevation: [[12, 1, 0.2], [5, 3, 1.4]], baseHeight: 60 },
    width: 15,
    surface: 'rainbow',
    edge: 'fall',
    gravity: 25,
    ramps: [
      { t: 0.12, lateral: 0, width: 10, length: 9, height: 1.8 },
      { t: 0.135, lateral: 0, width: 10, length: 9, height: 1.8 },
      { t: 0.15, lateral: 0, width: 10, length: 9, height: 1.8 },
      { t: 0.7, lateral: -3, width: 7, length: 9, height: 2.2 },
    ],
    gaps: [
      { t: 0.3, length: 12 },
      { t: 0.85, length: 14 },
    ],
    boostPads: [{ t: 0.1, lateral: 0 }, { t: 0.42, lateral: 0 }, { t: 0.68, lateral: -3 }],
    itemRows: [0.06, 0.24, 0.4, 0.64, 0.92],
    surfaceZones: [],
    hazards: [{ type: 'liftRamp', t: 0.6 }],
    randomObstacles: { types: ['cone', 'crate'], count: 6 },
    props: [
      { type: 'cloud', density: 2, minOff: 20, maxOff: 120, scale: [1, 3] },
      { type: 'floatingIsland', density: 0.25, minOff: 40, maxOff: 120, scale: [1, 2] },
    ],
    landmarks: [
      { type: 'rainbowArc', t: 0.2, side: 1, offset: 80, scale: 1.5 },
      { type: 'rainbowArc', t: 0.75, side: -1, offset: 90, scale: 1.2 },
      { type: 'skyCastle', t: 0.5, side: 1, offset: 150, scale: 1.5 },
    ],
    palette: {
      skyTop: 0x6fb6ff, skyBottom: 0xffe3f6, fog: 0xf3e6ff, fogNear: 120, fogFar: 700,
      ground: 0xffffff, shoulder: 0xffffff, road: 0xffffff, roadLine: 0xffffff, curbA: 0xff7ad9, curbB: 0x8ae8ff,
      wall: 0xffffff, sun: 0xfff6ea, sunIntensity: 2.6, ambient: 1.1, hemiGround: 0xffd6f2, cloudSea: true, groundLevel: 10,
    },
    unlockPrice: 2000,
  },
  {
    id: 'moon',
    name: '月球疯狂竞速',
    theme: '月球',
    description: '月球表面、陨石坑、太空基地。低重力跳跃距离更远，漂移和落地控制更加困难。',
    feature: '捷径：陨石坑飞跃',
    difficulty: 5,
    laps: 3,
    length: 0,
    checkpoints: checkpoints(),
    spawnPoints: spawn(),
    obstacles: [],
    shortcuts: [{ id: 'moon-crater', name: '陨石坑飞跃', t0: 0.31, t1: 0.44, style: 'crater', width: 10, lift: 0, blend: 0.85, surface: 'moon' }],
    weather: ['space', 'dust'],
    music: 'space',
    shape: { radius: 200, sx: 1.1, sz: 1.05, harmonics: [[0.225, 3, 0.6], [0.075, 5, 2.4]], elevation: [[4, 2, 0.9], [2, 4, 0.2]], baseHeight: 3 },
    width: 17,
    surface: 'moon',
    edge: 'offroad',
    gravity: 9.5,
    ramps: [
      { t: 0.15, lateral: 0, width: 9, length: 10, height: 1.6 },
      { t: 0.55, lateral: -3, width: 7, length: 10, height: 1.6 },
      { t: 0.8, lateral: 3, width: 7, length: 10, height: 1.6 },
    ],
    gaps: [],
    boostPads: [{ t: 0.07, lateral: 0 }, { t: 0.5, lateral: 0 }, { t: 0.9, lateral: 0 }],
    itemRows: [0.1, 0.3, 0.45, 0.68, 0.92],
    surfaceZones: [{ t0: 0.6, t1: 0.66, surface: 'sand' }],
    hazards: [
      { type: 'meteor', t: 0.42, span: 0.08 },
      { type: 'meteor', t: 0.72, span: 0.08 },
    ],
    randomObstacles: { types: ['rock', 'boulder', 'crate'], count: 10 },
    props: [
      { type: 'craterProp', density: 1.4, minOff: 14, maxOff: 70, scale: [0.8, 2.5] },
      { type: 'moonRock', density: 1.8, minOff: 12, maxOff: 60, scale: [0.6, 1.8] },
      { type: 'antenna', density: 0.3, minOff: 20, maxOff: 40, scale: [1, 1.4] },
    ],
    landmarks: [
      { type: 'moonBase', t: 0.05, side: 1, offset: 45, scale: 1.2 },
      { type: 'rocketPad', t: 0.6, side: -1, offset: 60 },
      { type: 'earth', t: 0.3, side: 1, offset: 0 },
    ],
    palette: {
      skyTop: 0x020208, skyBottom: 0x0d1030, fog: 0x0b0d22, fogNear: 150, fogFar: 750,
      ground: 0x9a9aa2, shoulder: 0xa4a4ac, road: 0x5c5c66, roadLine: 0x7affff, curbA: 0xffffff, curbB: 0x3c3c48,
      wall: 0x8a8a96, sun: 0xffffff, sunIntensity: 2.8, ambient: 0.55, hemiGround: 0x55555f, stars: true, groundLevel: -0.5,
    },
    unlockPrice: 2400,
  },
];

export const getTrack = (id: string) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];

/** 无尽公路使用的程序化主题循环 */
export const ENDLESS_THEMES = ['coast', 'desert', 'farm', 'snow', 'neon', 'moon'];
