import type { Emitter } from '../utils/events';
import type { TrackGeometry } from '../tracks/TrackGeometry';
import type { Physics } from './Physics';
import type { EffectsSystem } from '../systems/EffectsSystem';
import type { Racer } from '../entities/Racer';
import type { ItemId } from '../data/items';

export type GameMode = 'quick' | 'career' | 'elimination' | 'timetrial' | 'endless' | 'chaos';

export type SfxName =
  | 'squawk'
  | 'peck'
  | 'wing'
  | 'hit'
  | 'bigHit'
  | 'crash'
  | 'tumble'
  | 'nitro'
  | 'boost'
  | 'drift'
  | 'land'
  | 'item'
  | 'pickup'
  | 'throw'
  | 'explode'
  | 'freeze'
  | 'boing'
  | 'splat'
  | 'rocket'
  | 'gold'
  | 'whoosh'
  | 'clamp'
  | 'scrape'
  | 'break'
  | 'countdown'
  | 'go'
  | 'lap'
  | 'finish'
  | 'win'
  | 'lose'
  | 'click'
  | 'coin'
  | 'horn'
  | 'trick'
  | 'eliminate'
  | 'splash'
  | 'geyser';

export interface RaceEvents extends Record<string, unknown> {
  sfx: { name: SfxName; racer?: Racer; x?: number; y?: number; z?: number; volume?: number; pitch?: number };
  shake: { amount: number; racer: Racer };
  notify: { text: string; kind?: 'good' | 'bad' | 'info' | 'big'; racer: Racer };
  hit: { attacker: Racer; target: Racer; kind: string; damage: number };
  crash: { racer: Racer; by?: Racer | null; reason: string };
  ko: { attacker: Racer; target: Racer };
  lap: { racer: Racer; lap: number; time: number };
  finish: { racer: Racer };
  item: { racer: Racer; item: ItemId };
  shortcut: { racer: Racer; id: string; name: string };
  trick: { racer: Racer; name: string };
  eliminated: { racer: Racer };
  vision: { kind: 'feather' | 'ink'; duration: number; racer: Racer };
}

export interface RaceWorld {
  track: TrackGeometry;
  physics: Physics;
  gravity: number;
  time: number;
  fx: EffectsSystem;
  events: Emitter<RaceEvents>;
  racers: Racer[];
  mode: GameMode;
  /** 是否允许摩托升级加成 */
  upgradesAllowed: boolean;
  chaos: boolean;
  lavaY: number | null;
  started: boolean;
}
