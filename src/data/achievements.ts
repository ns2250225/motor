import type { GameSave } from '../systems/SaveSystem';
import { PELICANS } from './pelicans';
import { MOTORCYCLES } from './motorcycles';
import { TRACKS } from '../tracks/TrackConfig';
import { ITEMS } from './items';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  reward: number;
  check: (s: GameSave) => boolean;
  progress?: (s: GameSave) => [number, number];
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_race', name: '初出茅庐', desc: '完成第一场比赛', icon: '🏁', reward: 100, check: (s) => s.stats.races >= 1 },
  { id: 'first_win', name: '鹈鹕之王', desc: '第一次获得冠军', icon: '🏆', reward: 200, check: (s) => s.stats.wins >= 1 },
  { id: 'wins_10', name: '常胜将军', desc: '累计获得 10 次冠军', icon: '👑', reward: 800, check: (s) => s.stats.wins >= 10, progress: (s) => [s.stats.wins, 10] },
  { id: 'ko_10', name: '暴力鹈鹕', desc: '累计击倒 10 名对手', icon: '💥', reward: 300, check: (s) => s.stats.kos >= 10, progress: (s) => [s.stats.kos, 10] },
  { id: 'ko_100', name: '公路恶霸', desc: '累计击倒 100 名对手', icon: '☠️', reward: 1500, check: (s) => s.stats.kos >= 100, progress: (s) => [s.stats.kos, 100] },
  { id: 'drift_5k', name: '漂移大师', desc: '累计漂移 5000 米', icon: '🌀', reward: 500, check: (s) => s.stats.driftDistance >= 5000, progress: (s) => [Math.floor(s.stats.driftDistance), 5000] },
  { id: 'tricks_30', name: '空中飞鸟', desc: '累计完成 30 次空中特技', icon: '🤸', reward: 500, check: (s) => s.stats.tricks >= 30, progress: (s) => [s.stats.tricks, 30] },
  { id: 'clamp_10', name: '大嘴钳子', desc: '大嘴夹击命中 10 次', icon: '🦩', reward: 400, check: (s) => s.stats.clampHits >= 10, progress: (s) => [s.stats.clampHits, 10] },
  { id: 'shortcut_5', name: '抄近路', desc: '发现 5 条隐藏捷径', icon: '🗺️', reward: 400, check: (s) => s.discoveredShortcuts.length >= 5, progress: (s) => [s.discoveredShortcuts.length, 5] },
  { id: 'shortcut_all', name: '路痴克星', desc: '发现全部 10 条捷径', icon: '🧭', reward: 1200, check: (s) => s.discoveredShortcuts.length >= TRACKS.length, progress: (s) => [s.discoveredShortcuts.length, TRACKS.length] },
  { id: 'items_all', name: '道具专家', desc: '使用过全部 10 种道具', icon: '🎒', reward: 600, check: (s) => s.stats.itemsUsed.length >= ITEMS.length, progress: (s) => [s.stats.itemsUsed.length, ITEMS.length] },
  { id: 'career_all', name: '环游世界', desc: '生涯模式全部赛道获得至少一星', icon: '🌍', reward: 1500, check: (s) => TRACKS.every((t) => (s.careerProgress[t.id] ?? 0) >= 1), progress: (s) => [TRACKS.filter((t) => (s.careerProgress[t.id] ?? 0) >= 1).length, TRACKS.length] },
  { id: 'career_3star', name: '完美生涯', desc: '生涯模式全部赛道三星', icon: '⭐', reward: 5000, check: (s) => TRACKS.every((t) => (s.careerProgress[t.id] ?? 0) >= 3), progress: (s) => [TRACKS.filter((t) => (s.careerProgress[t.id] ?? 0) >= 3).length, TRACKS.length] },
  { id: 'collector', name: '鹈鹕收藏家', desc: '解锁全部 10 只鹈鹕', icon: '🐦', reward: 2000, check: (s) => s.unlockedPelicans.length >= PELICANS.length, progress: (s) => [s.unlockedPelicans.length, PELICANS.length] },
  { id: 'garage', name: '车库满满', desc: '拥有全部 8 辆摩托', icon: '🏍️', reward: 2000, check: (s) => s.unlockedMotorcycles.length >= MOTORCYCLES.length, progress: (s) => [s.unlockedMotorcycles.length, MOTORCYCLES.length] },
  { id: 'elim_win', name: '最后的鹈鹕', desc: '赢得一场暴力淘汰赛', icon: '🥊', reward: 500, check: (s) => s.stats.eliminationWins >= 1 },
  { id: 'endless_5k', name: '无尽旅程', desc: '无尽公路单次行驶 5 公里', icon: '🛣️', reward: 600, check: (s) => s.stats.endlessBest >= 5000, progress: (s) => [Math.floor(s.stats.endlessBest), 5000] },
  { id: 'perfect', name: '毫发无伤', desc: '不摔车拿下冠军', icon: '🛡️', reward: 500, check: (s) => s.stats.perfectWins >= 1 },
  { id: 'rich', name: '鱼塘大亨', desc: '累计赚取 20000 金币', icon: '💰', reward: 1000, check: (s) => s.stats.coinsEarned >= 20000, progress: (s) => [s.stats.coinsEarned, 20000] },
];

/** 检查并返回新解锁的成就 */
export function checkAchievements(s: GameSave): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!s.achievements[a.id] && a.check(s)) {
      s.achievements[a.id] = Date.now();
      s.coins += a.reward;
      out.push(a);
    }
  }
  return out;
}
