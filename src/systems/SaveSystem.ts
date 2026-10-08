import { PELICANS } from '../data/pelicans';
import { MOTORCYCLES, UpgradeLevels } from '../data/motorcycles';
import { TRACKS } from '../tracks/TrackConfig';
import { COSMETICS, DEFAULT_COSMETICS, CosmeticSlot } from '../data/cosmetics';
import { matchMobileDevice } from '../utils/device';

export const SAVE_VERSION = 3;

export interface Settings {
  musicVolume: number;
  soundVolume: number;
  graphicsQuality: 'auto' | 'low' | 'medium' | 'high';
  autoAccelerate: boolean;
  touchLayout: 'buttons' | 'joystick';
  cameraMode: 'chase' | 'near' | 'far';
  showFps: boolean;
  difficulty: 'easy' | 'normal' | 'hard';
  buttonScale: number;
  vibration: boolean;
  speedUnit: 'kmh' | 'mph';
}

export interface LifetimeStats {
  races: number;
  wins: number;
  podiums: number;
  kos: number;
  hits: number;
  driftDistance: number;
  tricks: number;
  clampHits: number;
  coinsEarned: number;
  distance: number;
  endlessBest: number;
  eliminationWins: number;
  itemsUsed: string[];
  perfectWins: number;
}

export interface GameSave {
  version: number;
  coins: number;
  unlockedPelicans: string[];
  unlockedMotorcycles: string[];
  unlockedTracks: string[];
  careerProgress: Record<string, number>;
  bestLapTimes: Record<string, number>;
  equippedPelican: string;
  equippedMotorcycle: string;
  settings: Settings;
  // 扩展数据
  bestRaceTimes: Record<string, number>;
  ownedCosmetics: string[];
  equippedCosmetics: Record<CosmeticSlot, string>;
  upgrades: Record<string, UpgradeLevels>;
  achievements: Record<string, number>;
  stats: LifetimeStats;
  discoveredShortcuts: string[];
  seenTracks: string[];
  savedAt: number;
}

export function defaultSettings(): Settings {
  const mobile = matchMobileDevice();
  return {
    musicVolume: 0.6,
    soundVolume: 0.8,
    graphicsQuality: 'auto',
    autoAccelerate: true,
    touchLayout: 'buttons',
    cameraMode: 'chase',
    showFps: false,
    difficulty: 'normal',
    buttonScale: mobile ? 1 : 1,
    vibration: true,
    speedUnit: 'kmh',
  };
}

export function defaultSave(): GameSave {
  return {
    version: SAVE_VERSION,
    coins: 300,
    unlockedPelicans: ['classic'],
    unlockedMotorcycles: ['street'],
    unlockedTracks: ['coast'],
    careerProgress: {},
    bestLapTimes: {},
    equippedPelican: 'classic',
    equippedMotorcycle: 'street',
    settings: defaultSettings(),
    bestRaceTimes: {},
    ownedCosmetics: COSMETICS.filter((c) => c.price === 0).map((c) => c.id),
    equippedCosmetics: { ...DEFAULT_COSMETICS },
    upgrades: {},
    achievements: {},
    stats: {
      races: 0, wins: 0, podiums: 0, kos: 0, hits: 0, driftDistance: 0, tricks: 0, clampHits: 0, coinsEarned: 0, distance: 0,
      endlessBest: 0, eliminationWins: 0, itemsUsed: [], perfectWins: 0,
    },
    discoveredShortcuts: [],
    seenTracks: [],
    savedAt: Date.now(),
  };
}

/** 版本迁移：逐级升级旧存档结构 */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let v = typeof raw.version === 'number' ? raw.version : 1;
  const data = { ...raw };
  if (v < 2) {
    // v1（PRD 原始结构）→ v2：加入外观与升级
    data.ownedCosmetics = data.ownedCosmetics ?? [];
    data.equippedCosmetics = data.equippedCosmetics ?? {};
    data.upgrades = data.upgrades ?? {};
    v = 2;
  }
  if (v < 3) {
    // v2 → v3：加入成就、统计、捷径与最佳完赛时间
    data.achievements = data.achievements ?? {};
    data.stats = data.stats ?? {};
    data.discoveredShortcuts = data.discoveredShortcuts ?? [];
    data.bestRaceTimes = data.bestRaceTimes ?? {};
    v = 3;
  }
  data.version = v;
  return data;
}

const num = (v: unknown, def: number, min = -Infinity, max = Infinity) => (typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : def);
const strArr = (v: unknown, valid?: Set<string>) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && (!valid || valid.has(x))))] : []);
const numRec = (v: unknown, valid?: Set<string>) => {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && isFinite(x) && (!valid || valid.has(k))) out[k] = x;
  return out;
};

/** 校验并修复存档（异常数据恢复） */
export function sanitize(input: unknown): GameSave {
  const def = defaultSave();
  if (!input || typeof input !== 'object') return def;
  const raw = migrate(input as Record<string, unknown>);
  const pel = new Set(PELICANS.map((p) => p.id));
  const bikes = new Set(MOTORCYCLES.map((m) => m.id as string));
  const tracks = new Set(TRACKS.map((t) => t.id));
  const cos = new Set(COSMETICS.map((c) => c.id));
  const s: GameSave = {
    version: SAVE_VERSION,
    coins: Math.floor(num(raw.coins, def.coins, 0, 99999999)),
    unlockedPelicans: strArr(raw.unlockedPelicans, pel),
    unlockedMotorcycles: strArr(raw.unlockedMotorcycles, bikes),
    unlockedTracks: strArr(raw.unlockedTracks, tracks),
    careerProgress: numRec(raw.careerProgress, tracks),
    bestLapTimes: numRec(raw.bestLapTimes, tracks),
    equippedPelican: typeof raw.equippedPelican === 'string' ? raw.equippedPelican : 'classic',
    equippedMotorcycle: typeof raw.equippedMotorcycle === 'string' ? raw.equippedMotorcycle : 'street',
    settings: { ...def.settings },
    bestRaceTimes: numRec(raw.bestRaceTimes, tracks),
    ownedCosmetics: strArr(raw.ownedCosmetics, cos),
    equippedCosmetics: { ...DEFAULT_COSMETICS },
    upgrades: {},
    achievements: numRec(raw.achievements),
    stats: { ...def.stats },
    discoveredShortcuts: strArr(raw.discoveredShortcuts),
    seenTracks: strArr(raw.seenTracks, tracks),
    savedAt: num(raw.savedAt, Date.now()),
  };
  // 必备内容
  for (const id of def.unlockedPelicans) if (!s.unlockedPelicans.includes(id)) s.unlockedPelicans.push(id);
  for (const id of def.unlockedMotorcycles) if (!s.unlockedMotorcycles.includes(id)) s.unlockedMotorcycles.push(id);
  for (const id of def.unlockedTracks) if (!s.unlockedTracks.includes(id)) s.unlockedTracks.push(id);
  for (const id of def.ownedCosmetics) if (!s.ownedCosmetics.includes(id)) s.ownedCosmetics.push(id);
  if (!s.unlockedPelicans.includes(s.equippedPelican)) s.equippedPelican = 'classic';
  if (!s.unlockedMotorcycles.includes(s.equippedMotorcycle)) s.equippedMotorcycle = 'street';
  for (const k of Object.keys(s.careerProgress)) s.careerProgress[k] = Math.round(Math.min(3, Math.max(0, s.careerProgress[k])));
  // 设置
  const st = (raw.settings ?? {}) as Partial<Settings>;
  s.settings.musicVolume = num(st.musicVolume, def.settings.musicVolume, 0, 1);
  s.settings.soundVolume = num(st.soundVolume, def.settings.soundVolume, 0, 1);
  if (['auto', 'low', 'medium', 'high'].includes(st.graphicsQuality as string)) s.settings.graphicsQuality = st.graphicsQuality!;
  if (typeof st.autoAccelerate === 'boolean') s.settings.autoAccelerate = st.autoAccelerate;
  if (st.touchLayout === 'buttons' || st.touchLayout === 'joystick') s.settings.touchLayout = st.touchLayout;
  if (['chase', 'near', 'far'].includes(st.cameraMode as string)) s.settings.cameraMode = st.cameraMode!;
  if (typeof st.showFps === 'boolean') s.settings.showFps = st.showFps;
  if (['easy', 'normal', 'hard'].includes(st.difficulty as string)) s.settings.difficulty = st.difficulty!;
  s.settings.buttonScale = num(st.buttonScale, def.settings.buttonScale, 0.7, 1.4);
  if (typeof st.vibration === 'boolean') s.settings.vibration = st.vibration;
  if (st.speedUnit === 'kmh' || st.speedUnit === 'mph') s.settings.speedUnit = st.speedUnit;
  // 外观
  const eq = (raw.equippedCosmetics ?? {}) as Record<string, string>;
  for (const slot of Object.keys(DEFAULT_COSMETICS) as CosmeticSlot[]) {
    const id = eq[slot];
    if (typeof id === 'string' && s.ownedCosmetics.includes(id) && id.startsWith(slot + ':')) s.equippedCosmetics[slot] = id;
  }
  // 升级
  const up = (raw.upgrades ?? {}) as Record<string, Partial<UpgradeLevels>>;
  for (const [k, v] of Object.entries(up)) {
    if (!bikes.has(k) || !v || typeof v !== 'object') continue;
    s.upgrades[k] = {
      engine: Math.round(num(v.engine, 0, 0, 3)),
      handling: Math.round(num(v.handling, 0, 0, 3)),
      armor: Math.round(num(v.armor, 0, 0, 3)),
      nitro: Math.round(num(v.nitro, 0, 0, 3)),
    };
  }
  // 统计
  const rs = (raw.stats ?? {}) as Partial<LifetimeStats>;
  for (const k of Object.keys(def.stats) as (keyof LifetimeStats)[]) {
    if (k === 'itemsUsed') s.stats.itemsUsed = strArr(rs.itemsUsed);
    else (s.stats[k] as number) = num(rs[k], 0, 0);
  }
  return s;
}

const DB_NAME = 'pelican-road-rage';
const STORE = 'save';
const LS_KEY = 'prr-save';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('no idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const r = tx.objectStore(STORE).get('main');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function idbSet(value: unknown) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, 'main');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 本地存档：IndexedDB 为主，localStorage 为镜像/降级 */
export const SaveSystem = {
  async load(): Promise<{ save: GameSave; recovered: boolean }> {
    let fromIdb: unknown = null;
    let fromLs: unknown = null;
    let recovered = false;
    try {
      fromIdb = await idbGet();
    } catch {
      /* IndexedDB 不可用 */
    }
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) fromLs = JSON.parse(raw);
    } catch {
      recovered = true;
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) localStorage.setItem(LS_KEY + '-corrupt-' + Date.now(), raw);
      } catch {
        /* 忽略 */
      }
    }
    const pickNewest = () => {
      const a = fromIdb as { savedAt?: number } | null;
      const b = fromLs as { savedAt?: number } | null;
      if (a && b) return (a.savedAt ?? 0) >= (b.savedAt ?? 0) ? a : b;
      return a ?? b;
    };
    const raw = pickNewest();
    if (!raw) return { save: defaultSave(), recovered };
    try {
      return { save: sanitize(raw), recovered };
    } catch {
      return { save: defaultSave(), recovered: true };
    }
  },

  async save(data: GameSave) {
    data.savedAt = Date.now();
    const plain = JSON.parse(JSON.stringify(data));
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(plain));
    } catch {
      /* 存储已满或被禁用 */
    }
    try {
      await idbSet(plain);
    } catch {
      /* 降级到 localStorage */
    }
  },

  async reset() {
    const s = defaultSave();
    await SaveSystem.save(s);
    return s;
  },

  /** 导出存档文件 */
  exportFile(data: GameSave) {
    const payload = { game: 'pelican-road-rage', exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `鹈鹕暴力摩托-存档-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** 导入存档文件（校验后返回） */
  async importFile(file: File): Promise<GameSave> {
    const text = await file.text();
    const json = JSON.parse(text);
    const data = json && json.game === 'pelican-road-rage' ? json.data : json;
    if (!data || typeof data !== 'object' || typeof data.coins !== 'number') throw new Error('不是有效的存档文件');
    return sanitize(data);
  },
};
