import { defineStore } from 'pinia';
import { reactive, ref, markRaw } from 'vue';
import { SaveSystem, GameSave, defaultSave } from '../systems/SaveSystem';
import { PELICANS } from '../data/pelicans';
import { MOTORCYCLES, MAX_UPGRADE, upgradeCost, UpgradeLevels } from '../data/motorcycles';
import { COSMETICS, CosmeticSlot } from '../data/cosmetics';
import { TRACKS } from '../tracks/TrackConfig';
import { checkAchievements, AchievementDef } from '../data/achievements';
import type { ItemId } from '../data/items';
import type { GameMode } from '../core/types';

export type Screen =
  | 'boot'
  | 'menu'
  | 'mode'
  | 'tracks'
  | 'pelicans'
  | 'garage'
  | 'codex'
  | 'settings'
  | 'career'
  | 'loading'
  | 'race'
  | 'results';

export interface HudState {
  place: number;
  total: number;
  lap: number;
  laps: number;
  time: number;
  lapTime: number;
  bestLap: number;
  speed: number;
  nitro: number;
  nitroActive: boolean;
  energy: number;
  item: ItemId | null;
  cd: { wingL: number; wingR: number; peck: number; sweep: number; clamp: number };
  hp: number;
  lives: number;
  distance: number;
  score: number;
  wrongWay: boolean;
  ahead: { name: string; dist: number } | null;
  behind: { name: string; dist: number } | null;
  countdown: string | null;
  elimTimer: number;
  alive: number;
  fps: number;
  drifting: boolean;
  driftLevel: number;
  invincible: boolean;
  frozen: boolean;
  finished: boolean;
  surface: string;
  boneTimer: number;
  canSuper: boolean;
}

export interface Notice {
  id: number;
  text: string;
  kind: 'good' | 'bad' | 'info' | 'big';
  t: number;
}

export interface ResultRow {
  name: string;
  pelican: string;
  bike: string;
  place: number;
  time: number;
  estimated: boolean;
  isPlayer: boolean;
  kos: number;
  eliminated: boolean;
}

export interface RaceResults {
  mode: GameMode;
  trackId: string;
  trackName: string;
  rows: ResultRow[];
  place: number;
  time: number;
  bestLap: number;
  hits: number;
  kos: number;
  drift: number;
  tricks: number;
  crashes: number;
  coins: number;
  breakdown: { label: string; amount: number }[];
  unlocks: string[];
  stars: number;
  prevStars: number;
  challenge: string;
  challengeDone: boolean;
  newRecord: boolean;
  achievements: AchievementDef[];
  distance: number;
  score: number;
}

export interface RaceSetup {
  mode: GameMode;
  trackId: string;
}

const emptyHud = (): HudState => ({
  place: 1, total: 8, lap: 1, laps: 3, time: 0, lapTime: 0, bestLap: 0, speed: 0, nitro: 0, nitroActive: false, energy: 0, item: null,
  cd: { wingL: 0, wingR: 0, peck: 0, sweep: 0, clamp: 0 }, hp: 100, lives: 3, distance: 0, score: 0, wrongWay: false, ahead: null, behind: null,
  countdown: null, elimTimer: 0, alive: 8, fps: 60, drifting: false, driftLevel: 0, invincible: false, frozen: false, finished: false, surface: '',
  boneTimer: 0, canSuper: false,
});

let noticeId = 0;

export const useGameStore = defineStore('game', () => {
  const screen = ref<Screen>('boot');
  const prevScreen = ref<Screen>('menu');
  const save = reactive<GameSave>(defaultSave());
  const setup = reactive<RaceSetup>({ mode: 'quick', trackId: 'coast' });
  const hud = reactive<HudState>(emptyHud());
  const notices = ref<Notice[]>([]);
  const paused = ref(false);
  const rotateOverlay = ref(false);
  const isMobile = ref(false);
  const results = ref<RaceResults | null>(null);
  const vision = reactive({ feather: 0, ink: 0 });
  const toast = ref<string | null>(null);
  const loadingText = ref('');
  const saveRecovered = ref(false);
  const codexTab = ref<'pelicans' | 'bikes' | 'items' | 'tracks' | 'achievements'>('pelicans');
  const engine = ref<unknown>(null);

  function go(s: Screen) {
    prevScreen.value = screen.value;
    screen.value = s;
  }

  async function loadSave() {
    const { save: s, recovered } = await SaveSystem.load();
    Object.assign(save, s);
    saveRecovered.value = recovered;
  }

  let saveTimer: number | null = null;
  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      SaveSystem.save(JSON.parse(JSON.stringify(save)) as GameSave);
    }, 150);
  }

  function showToast(msg: string) {
    toast.value = msg;
    setTimeout(() => {
      if (toast.value === msg) toast.value = null;
    }, 2200);
  }

  function notify(text: string, kind: Notice['kind'] = 'info') {
    const n = { id: ++noticeId, text, kind, t: performance.now() };
    notices.value = [...notices.value.slice(-3), n];
    setTimeout(() => {
      notices.value = notices.value.filter((x) => x.id !== n.id);
    }, kind === 'big' ? 1800 : 1500);
  }

  function resetHud() {
    Object.assign(hud, emptyHud());
    notices.value = [];
    vision.feather = 0;
    vision.ink = 0;
  }

  // ——— 经济 ———
  function spend(amount: number) {
    if (save.coins < amount) {
      showToast('金币不足！去比赛赚点小鱼干吧');
      return false;
    }
    save.coins -= amount;
    return true;
  }

  function afterPurchase() {
    const ach = checkAchievements(save);
    for (const a of ach) showToast(`🏅 成就解锁：${a.name}（+${a.reward} 金币）`);
    persist();
  }

  function buyPelican(id: string) {
    const p = PELICANS.find((x) => x.id === id);
    if (!p || save.unlockedPelicans.includes(id)) return;
    if (!spend(p.price)) return;
    save.unlockedPelicans.push(id);
    save.equippedPelican = id;
    showToast(`解锁了 ${p.name}！`);
    afterPurchase();
  }

  function equipPelican(id: string) {
    if (!save.unlockedPelicans.includes(id)) return;
    save.equippedPelican = id;
    persist();
  }

  function buyBike(id: string) {
    const b = MOTORCYCLES.find((x) => x.id === id);
    if (!b || save.unlockedMotorcycles.includes(id)) return;
    if (!spend(b.price)) return;
    save.unlockedMotorcycles.push(id);
    save.equippedMotorcycle = id;
    showToast(`购买了 ${b.name}！`);
    afterPurchase();
  }

  function equipBike(id: string) {
    if (!save.unlockedMotorcycles.includes(id)) return;
    save.equippedMotorcycle = id;
    persist();
  }

  function upgrade(bikeId: string, key: keyof UpgradeLevels) {
    const cur = save.upgrades[bikeId] ?? { engine: 0, handling: 0, armor: 0, nitro: 0 };
    if (cur[key] >= MAX_UPGRADE) return;
    if (!spend(upgradeCost(cur[key]))) return;
    cur[key]++;
    save.upgrades[bikeId] = { ...cur };
    showToast('升级成功！');
    persist();
  }

  function buyCosmetic(id: string) {
    const c = COSMETICS.find((x) => x.id === id);
    if (!c) return;
    if (!save.ownedCosmetics.includes(id)) {
      if (!spend(c.price)) return;
      save.ownedCosmetics.push(id);
    }
    save.equippedCosmetics[c.slot as CosmeticSlot] = id;
    persist();
  }

  function buyTrack(id: string) {
    const t = TRACKS.find((x) => x.id === id);
    if (!t || save.unlockedTracks.includes(id)) return;
    if (!spend(t.unlockPrice)) return;
    save.unlockedTracks.push(id);
    showToast(`解锁赛道：${t.name}`);
    persist();
  }

  return {
    screen, prevScreen, save, setup, hud, notices, paused, rotateOverlay, isMobile, results, vision, toast, loadingText, saveRecovered, codexTab, engine,
    go, loadSave, persist, showToast, notify, resetHud, spend, buyPelican, equipPelican, buyBike, equipBike, upgrade, buyCosmetic, buyTrack, afterPurchase,
  };
});

export const rawEngine = <T extends object>(v: T) => markRaw(v);
