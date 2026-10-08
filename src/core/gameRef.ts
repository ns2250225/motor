import type { Game } from './Game';

let instance: Game | null = null;

export function setGame(g: Game) {
  instance = g;
}

/** 获取游戏引擎实例（非响应式） */
export function useEngine(): Game | null {
  return instance;
}
