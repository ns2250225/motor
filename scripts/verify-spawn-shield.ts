/** 临时验证：起跑保护（GO 后 3 秒无敌） */
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
import { defaultSave } from '../src/systems/SaveSystem';

await Physics.init();

const noop = () => {};
const save = defaultSave();
const notices: string[] = [];
const store: any = {
  save,
  setup: { mode: 'race', trackId: 'coast' },
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

const s = new RaceSession(game as any, { mode: 'race', trackId: 'coast' });
const autopilot = s.ais.get(s.player)!;
const dt = 1 / 60;
let simT = 0;
let fails = 0;
const check = (cond: boolean, msg: string) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) fails++;
};

let goAt = -1;
let crashedDuringShield = 0;
s.world.events.on('crash', (e) => {
  if (e.racer.isPlayer && e.racer.spawnShield > 0) crashedDuringShield++;
});

// 空跑到 GO
while (!s.world.started && simT < 10) {
  autopilot.update(dt, null);
  s.update(dt, { ...emptyPlayerIntent() });
  simT += dt;
}
goAt = simT;
check(goAt > 0 && goAt < 10, `GO 发生在 ${goAt.toFixed(2)}s`);
check(s.player.spawnShield > 2.95 && s.player.spawnShield <= 3, `GO 时玩家护盾 = ${s.player.spawnShield.toFixed(2)}（预期 3，含一帧 tick）`);
check(s.player.invincible, 'GO 时玩家处于无敌状态');
check(notices.some((n) => n.includes('起跑保护')), `GO 提示已显示：${notices.join(' | ')}`);

// 护盾期间每帧保持无敌
let shieldHeld = true;
while (simT < goAt + 2.9) {
  autopilot.update(dt, null);
  s.update(dt, { ...emptyPlayerIntent() });
  simT += dt;
  if (!s.player.invincible) shieldHeld = false;
}
check(shieldHeld, '护盾期内玩家始终无敌');
check(crashedDuringShield === 0, '护盾期内玩家未被打飞（crash 次数 = 0）');

// 护盾到期后消失（只验证护盾本身；无敌可能来自重生保护等其他来源）
while (simT < goAt + 3.5) {
  autopilot.update(dt, null);
  s.update(dt, { ...emptyPlayerIntent() });
  simT += dt;
}
check(s.player.spawnShield === 0, `护盾到期归零（当前 ${s.player.spawnShield.toFixed(2)}）`);
const p = s.player;
console.log(`INFO  3.5s 时玩家状态：invincible=${p.invincible}（golden=${p.golden.toFixed(2)} superDash=${p.superDash.toFixed(2)} invuln=${p.invuln.toFixed(2)}，均为其他合法来源）`);

s.dispose();
console.log(fails === 0 ? '\n全部通过' : `\n${fails} 项失败`);
process.exit(fails === 0 ? 0 : 1);

function emptyPlayerIntent() {
  return { throttle: 0, brake: 0, steer: 0, drift: false, nitro: false, attackL: false, attackR: false, peck: false, sweep: false, clamp: false, superDash: false, useItem: false, horn: false, reset: false, smartAttack: false, smartBeak: false } as any;
}
