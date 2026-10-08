/**
 * 无渲染的整场比赛模拟：验证赛道构建、物理、AI、战斗、道具、检查点与结算逻辑。
 * 用法：npx tsx scripts/sim.ts [trackId|all] [mode] [seconds]
 */
// —— 最小 DOM 桩（仅用于创建画布纹理） ——
const ctxStub = new Proxy({}, { get: () => () => ({ addColorStop() {} }) });
(globalThis as any).document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctxStub, style: {} }),
  addEventListener() {},
};
(globalThis as any).window = globalThis;
(globalThis as any).matchMedia = () => ({ matches: false, addEventListener() {} });

import * as THREE from 'three';
import { Physics } from '../src/core/Physics';
import { RaceSession } from '../src/core/RaceSession';
import { TRACKS } from '../src/tracks/TrackConfig';
import { defaultSave } from '../src/systems/SaveSystem';
import { emptyInput } from '../src/entities/Racer';
import type { GameMode } from '../src/core/types';

const noop = () => {};
async function run(trackId: string, mode: GameMode, seconds: number) {
  const save = defaultSave();
  save.settings.difficulty = 'normal';
  const notices: string[] = [];
  const store: any = {
    save,
    setup: { mode, trackId },
    hud: { cd: {} },
    vision: { feather: 0, ink: 0 },
    notify: (t: string) => notices.push(t),
    go: noop,
    persist: noop,
    results: null,
  };
  const game: any = {
    store,
    renderer: { quality: 'low', shadowsEnabled: false, scene: new THREE.Scene(), setLighting: noop, followShadow: noop, fps: 60 },
    camera: { snapTo: noop, follow: noop, orbit: noop, addShake: noop, camera: new THREE.PerspectiveCamera() },
    audio: { play: noop, setListener: noop, updateEngine: noop, stopEngine: noop },
    music: { play: noop },
  };
  const t0 = Date.now();
  const s = new RaceSession(game, { mode, trackId });
  const buildMs = Date.now() - t0;
  const autopilot = s.ais.get(s.player)!;
  const reasons: Record<string, number> = {};
  s.world.events.on('crash', (e) => { const k = e.reason + (e.reason === 'obstacle' ? ':' + e.racer.lastHitType : '') + (e.by ? '(by)' : ''); if (process.env.DBG2 && e.reason === 'obstacle') { const ai: any = s.ais.get(e.racer); const g = s.world.track; const near = g.obstacles.filter((o) => Math.abs(g.main.deltaS(e.racer.ground.mainS, o.s)) < 8).map((o) => o.type + '@' + o.lateral.toFixed(1)); console.log('  OB', e.racer.lastHitType, 'lat', e.racer.ground.mainLateral.toFixed(1), 'tgt', ai?.targetLat?.toFixed(1), 'air', !e.racer.grounded, 'wob', e.racer.wobble.toFixed(2), 'spd', e.racer.speed.toFixed(0), 'near', near.join(','), e.racer.isPlayer ? 'P' : ''); }
    if (process.env.DBG && (e.reason === process.env.DBG)) console.log('  @', (e.racer.lastSafeS / s.world.track.length).toFixed(3), 'lat', e.racer.ground.mainLateral.toFixed(1), 'spd', e.racer.speed.toFixed(1), 'vy', e.racer.vy.toFixed(1), 'y', e.racer.pos.y.toFixed(1), 'lastG', e.racer.lastGroundY.toFixed(1), 'road', e.racer.ground.roadIdx, 'gy', e.racer.ground.y, 'mainY', s.world.track.main.pointAt(e.racer.ground.mainS).y.toFixed(1), 'u', e.racer.ground.shortcutU.toFixed(2), 'gaps', s.world.track.gaps.map((g) => (g.s0 / s.world.track.length).toFixed(3)).join(',')); reasons[k] = (reasons[k] ?? 0) + 1; });
  const dt = 1 / 60;
  let simT = 0;
  let maxStuck = 0;
  const stuck = new Map<any, number>();
  let resultsAt = -1;
  const offAcc = new Map<any, { sum: number; n: number; off: number; nit: number; wall: number }>();
  for (const r of s.racers) offAcc.set(r, { sum: 0, n: 0, off: 0, nit: 0, wall: 0 });
  const t1 = Date.now();
  while (simT < seconds) {
    const ai = autopilot.update(dt, null);
    const intent: any = { ...emptyInput(), ...ai, smartAttack: false, smartBeak: false, usingTouch: false };
    // 自动驾驶的玩家也使用攻击/道具
    if (Math.random() < 0.02) intent.attackL = true;
    if (Math.random() < 0.02) intent.peck = true;
    if (Math.random() < 0.01) intent.useItem = true;
    if (Math.random() < 0.005) intent.clamp = true;
    s.update(dt, intent);
    simT += dt;
    for (const r of s.racers) {
      if (r.state !== 'driving') continue;
      if (s.world.started) { const a = offAcc.get(r)!; a.sum += r.speed; a.n++; if (r.ground.surface === 'offroad') a.off++; if (r.nitroActive) a.nit++; if (r.ground.barrierDepth > 0) a.wall++; }
      const v = Math.abs(r.speed) < 1 && s.world.started ? (stuck.get(r) ?? 0) + dt : 0;
      stuck.set(r, v);
      if (v > 5 && v < 5 + dt * 1.5) console.log('  STUCK', r.name, (r.ground.mainS / s.world.track.length).toFixed(3), 'lat', r.ground.mainLateral.toFixed(1), 'y', r.pos.y.toFixed(1), 'gy', r.ground.y, 'onRoad', r.ground.onRoad, 'bar', r.ground.barrierDepth.toFixed(2), 'grounded', r.grounded, 'road', r.ground.roadIdx);
      maxStuck = Math.max(maxStuck, v);
    }
    if (store.results && resultsAt < 0) {
      resultsAt = simT;
      break;
    }
    if (s.racing.over && simT > 0 && resultsAt < 0 && simT > seconds - 1) break;
  }
  const wall = Date.now() - t1;
  const st = s.racing.standings();
  const fin = st.filter((x) => x.racer.finished).length;
  const crashes = s.racers.reduce((a, r) => a + r.stat.crashes, 0);
  const hits = s.racers.reduce((a, r) => a + r.stat.hits, 0);
  const kos = s.racers.reduce((a, r) => a + r.stat.kos, 0);
  const items = s.racers.reduce((a, r) => a + r.stat.itemsUsed.size, 0);
  const sc = s.racers.reduce((a, r) => a + r.stat.shortcuts.size, 0);
  const tricks = s.racers.reduce((a, r) => a + r.stat.tricks, 0);
  console.log(
    `${trackId.padEnd(8)} ${mode.padEnd(10)} build=${buildMs}ms sim=${simT.toFixed(0)}s wall=${wall}ms finished=${fin}/${s.racers.length} ` +
      `results=${resultsAt > 0 ? resultsAt.toFixed(0) + 's' : 'no'} crashes=${crashes} hits=${hits} kos=${kos} items=${items} shortcuts=${sc} tricks=${tricks} maxStuck=${maxStuck.toFixed(1)}s`,
  );
  console.log('   reasons:', JSON.stringify(reasons));
  console.log('   order:', st.map((x) => `${x.place}.${x.racer.name}${x.racer.isPlayer ? '(P)' : ''}[L${x.racer.lapsCompleted}${x.racer.finished ? ' ' + x.racer.finishTime.toFixed(0) + 's' : ''}]`).join(' '));
  for (const r of s.racers) console.log('   ', r.name.padEnd(10), r.bikeDef.id.padEnd(10), 'crash', r.stat.crashes, 'top', r.stat.topSpeed.toFixed(1), 'avg', (offAcc.get(r)!.sum / offAcc.get(r)!.n).toFixed(1), 'offroad%', (100 * offAcc.get(r)!.off / offAcc.get(r)!.n).toFixed(0), 'nitro%', (100 * offAcc.get(r)!.nit / offAcc.get(r)!.n).toFixed(0), 'wall%', (100 * offAcc.get(r)!.wall / offAcc.get(r)!.n).toFixed(0), 'drift', r.stat.driftDist.toFixed(0));
  if (store.results) console.log('   reward coins:', store.results.coins, 'stars:', store.results.stars, store.results.breakdown.map((b: any) => b.label + '+' + b.amount).join(', '));
  s.dispose();
}

await Physics.init();
const arg = process.argv[2] ?? 'all';
const mode = (process.argv[3] ?? 'quick') as GameMode;
const secs = Number(process.argv[4] ?? 330);
const list = arg === 'all' ? TRACKS.map((t) => t.id) : [arg];
for (const id of list) {
  try {
    await run(id, mode, secs);
  } catch (e) {
    console.log(`${id} FAILED:`, (e as Error).stack);
  }
}
