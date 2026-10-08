export type PersonalityId = 'steady' | 'aggressive' | 'speed' | 'defensive' | 'troll' | 'revenge';

export interface Personality {
  id: PersonalityId;
  name: string;
  desc: string;
  aggression: number; // 主动攻击概率
  itemUsage: number; // 道具使用积极性
  nitroUsage: number;
  keepDistance: number; // 与其他骑手保持距离的倾向
  seekPlayer: number; // 主动追击玩家
  shortcutChance: number;
  driftSkill: number;
  laneJitter: number;
  revengeBoost: number; // 被攻击后攻击性提升
}

/** AI 性格（PRD 8.1） */
export const PERSONALITIES: Record<PersonalityId, Personality> = {
  steady: { id: 'steady', name: '稳健型', desc: '保持路线，较少攻击', aggression: 0.18, itemUsage: 0.5, nitroUsage: 0.55, keepDistance: 0.3, seekPlayer: 0, shortcutChance: 0.35, driftSkill: 0.8, laneJitter: 0.4, revengeBoost: 0.2 },
  aggressive: { id: 'aggressive', name: '激进型', desc: '主动冲撞和攻击玩家', aggression: 0.85, itemUsage: 0.7, nitroUsage: 0.7, keepDistance: 0, seekPlayer: 1, shortcutChance: 0.4, driftSkill: 0.6, laneJitter: 0.8, revengeBoost: 0.3 },
  speed: { id: 'speed', name: '速度型', desc: '优先加速和超车', aggression: 0.25, itemUsage: 0.55, nitroUsage: 1, keepDistance: 0.2, seekPlayer: 0, shortcutChance: 0.85, driftSkill: 1, laneJitter: 0.3, revengeBoost: 0.2 },
  defensive: { id: 'defensive', name: '防守型', desc: '保持安全距离，躲避攻击', aggression: 0.12, itemUsage: 0.6, nitroUsage: 0.6, keepDistance: 1, seekPlayer: -0.5, shortcutChance: 0.3, driftSkill: 0.8, laneJitter: 0.3, revengeBoost: 0.4 },
  troll: { id: 'troll', name: '捣蛋型', desc: '频繁使用搞怪道具', aggression: 0.45, itemUsage: 1, nitroUsage: 0.5, keepDistance: 0.1, seekPlayer: 0.4, shortcutChance: 0.6, driftSkill: 0.5, laneJitter: 1.2, revengeBoost: 0.3 },
  revenge: { id: 'revenge', name: '复仇型', desc: '被玩家攻击后短时间主动追击', aggression: 0.25, itemUsage: 0.6, nitroUsage: 0.65, keepDistance: 0.2, seekPlayer: 0, shortcutChance: 0.45, driftSkill: 0.7, laneJitter: 0.5, revengeBoost: 1 },
};

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyParams {
  reaction: number; // 反应延迟（秒）
  skill: number; // 极速利用率
  aggressionMul: number;
  mistakes: number; // 失误概率
  rubber: number; // 追赶补偿强度
}

export const DIFFICULTY: Record<Difficulty, DifficultyParams> = {
  easy: { reaction: 0.4, skill: 0.88, aggressionMul: 0.6, mistakes: 0.08, rubber: 0.05 },
  normal: { reaction: 0.22, skill: 0.95, aggressionMul: 1, mistakes: 0.03, rubber: 0.06 },
  hard: { reaction: 0.1, skill: 1, aggressionMul: 1.3, mistakes: 0.01, rubber: 0.08 },
};

export const PERSONALITY_ORDER: PersonalityId[] = ['aggressive', 'speed', 'steady', 'troll', 'revenge', 'defensive', 'aggressive'];
