import { TRACKS } from '../tracks/TrackConfig';

export type ChallengeType = 'ko' | 'drift' | 'special' | 'shortcut' | 'trick' | 'noCrash';

export interface CareerLevel {
  trackId: string;
  challenge: { type: ChallengeType; target: number; desc: string };
  reward: number;
}

/** 生涯模式：每条赛道一关，三星目标（完成 / 前三 / 第一 + 额外挑战） */
export const CAREER: CareerLevel[] = [
  { trackId: 'coast', challenge: { type: 'ko', target: 2, desc: '击倒 2 名对手' }, reward: 300 },
  { trackId: 'neon', challenge: { type: 'drift', target: 300, desc: '累计漂移 300 米' }, reward: 350 },
  { trackId: 'desert', challenge: { type: 'shortcut', target: 1, desc: '找到并通过隐藏捷径' }, reward: 400 },
  { trackId: 'snow', challenge: { type: 'special', target: 3, desc: '大嘴特殊攻击命中 3 次' }, reward: 450 },
  { trackId: 'jungle', challenge: { type: 'trick', target: 2, desc: '完成 2 次空中特技' }, reward: 500 },
  { trackId: 'volcano', challenge: { type: 'noCrash', target: 0, desc: '全程不摔车' }, reward: 600 },
  { trackId: 'port', challenge: { type: 'ko', target: 4, desc: '击倒 4 名对手' }, reward: 600 },
  { trackId: 'farm', challenge: { type: 'drift', target: 600, desc: '累计漂移 600 米' }, reward: 650 },
  { trackId: 'sky', challenge: { type: 'shortcut', target: 1, desc: '通过高空彩虹桥捷径' }, reward: 750 },
  { trackId: 'moon', challenge: { type: 'special', target: 5, desc: '大嘴特殊攻击命中 5 次' }, reward: 1000 },
];

export const careerIndex = (trackId: string) => CAREER.findIndex((c) => c.trackId === trackId);

/** 生涯关卡是否已解锁：前一关至少一星 */
export function careerUnlocked(progress: Record<string, number>, i: number) {
  if (i === 0) return true;
  return (progress[CAREER[i - 1].trackId] ?? 0) >= 1;
}

/** 淘汰赛在完成生涯前三关后解锁 */
export const ELIMINATION_UNLOCK = 3;
export function eliminationUnlocked(progress: Record<string, number>) {
  return CAREER.slice(0, ELIMINATION_UNLOCK).every((c) => (progress[c.trackId] ?? 0) >= 1);
}

export interface ModeDef {
  id: 'quick' | 'career' | 'elimination' | 'timetrial' | 'endless' | 'chaos';
  name: string;
  desc: string;
  icon: string;
  unlock: string;
}

export const MODES: ModeDef[] = [
  { id: 'quick', name: '快速比赛', desc: '选择赛道直接与 7 名 AI 竞速', icon: '🏁', unlock: '默认' },
  { id: 'career', name: '生涯模式', desc: '连续挑战不同赛道，赢取三星解锁内容', icon: '🏆', unlock: '默认' },
  { id: 'elimination', name: '暴力淘汰赛', desc: '每 25 秒淘汰最后一名，被打空血量直接出局', icon: '🥊', unlock: `完成生涯前 ${ELIMINATION_UNLOCK} 关` },
  { id: 'timetrial', name: '计时挑战', desc: '无对手，挑战最快圈速', icon: '⏱️', unlock: '默认' },
  { id: 'endless', name: '无尽公路', desc: '无限延伸的道路，3 条命持续躲避障碍和战斗', icon: '🛣️', unlock: '默认' },
  { id: 'chaos', name: '疯狂混战', desc: '道具刷新更快、攻击冷却减半、伤害更高', icon: '🌪️', unlock: '默认' },
];

export const trackById = (id: string) => TRACKS.find((t) => t.id === id)!;
