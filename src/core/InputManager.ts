import { KeyboardControls } from '../controls/KeyboardControls';
import { touchControls } from '../controls/TouchControls';
import { emptyInput, RacerInput } from '../entities/Racer';
import { clamp } from '../utils/math';

export interface PlayerIntent extends RacerInput {
  /** 触控“攻击”按钮：根据对手方位自动选择左右翅膀/啄击 */
  smartAttack: boolean;
  /** 触控“大嘴”按钮：夹击 > 横扫 > 啄击 */
  smartBeak: boolean;
  usingTouch: boolean;
}

/** 输入管理：合并键盘、触控、手柄 */
export class InputManager {
  keyboard = new KeyboardControls();
  touch = touchControls;
  private padPrev: boolean[] = [];
  onAction: ((a: 'pause' | 'camera') => void) | null = null;
  autoAccelerate = true;
  private intent: PlayerIntent = { ...emptyInput(), smartAttack: false, smartBeak: false, usingTouch: false };

  attach() {
    this.keyboard.attach();
    this.keyboard.onAction = (a) => this.onAction?.(a);
  }
  detach() {
    this.keyboard.detach();
  }

  sample(): PlayerIntent {
    const k = this.keyboard;
    const t = this.touch;
    const out = this.intent;
    // 键盘
    let throttle = k.isDown('KeyW', 'ArrowUp') ? 1 : 0;
    let brake = k.isDown('KeyS', 'ArrowDown') ? 1 : 0;
    let steer = (k.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (k.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    let drift = k.isDown('Space');
    let nitro = k.isDown('ShiftLeft', 'ShiftRight');
    out.attackL = k.wasPressed('KeyJ');
    out.attackR = k.wasPressed('KeyK');
    out.peck = k.wasPressed('KeyL');
    out.sweep = k.wasPressed('KeyU');
    out.clamp = k.wasPressed('KeyI');
    out.superDash = k.wasPressed('KeyQ');
    out.useItem = k.wasPressed('KeyE');
    out.horn = k.wasPressed('KeyH');
    out.reset = k.wasPressed('KeyR');
    out.smartAttack = false;
    out.smartBeak = false;

    // 触控
    const touchRecent = t.enabled && performance.now() - t.lastUsed < 15000;
    out.usingTouch = t.enabled && (touchRecent || !k.active);
    if (t.enabled) {
      if (Math.abs(t.steer) > 0.01) steer = t.steer;
      if (t.throttle) throttle = 1;
      if (t.brake) brake = 1;
      drift = drift || t.drift;
      nitro = nitro || t.nitro;
      if (t.consume('attack')) out.smartAttack = true;
      if (t.consume('beak')) out.smartBeak = true;
      if (t.consume('item')) out.useItem = true;
      if (t.consume('super')) out.superDash = true;
      if (t.consume('horn')) out.horn = true;
      if (t.consume('reset')) out.reset = true;
      if (out.usingTouch && this.autoAccelerate && !brake) throttle = 1;
    }

    // 手柄
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((p) => p && p.connected);
    if (pad) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      const edge = (i: number) => b(i) && !this.padPrev[i];
      const ax = pad.axes[0] ?? 0;
      if (Math.abs(ax) > 0.15) steer = clamp(ax, -1, 1);
      if (b(14)) steer = -1;
      if (b(15)) steer = 1;
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      if (rt > 0.1) throttle = Math.max(throttle, rt);
      if (lt > 0.1) brake = Math.max(brake, lt);
      if (b(0)) drift = true;
      if (b(1)) nitro = true;
      if (edge(2)) out.useItem = true;
      if (edge(3)) out.smartBeak = true;
      if (edge(4)) out.attackL = true;
      if (edge(5)) out.attackR = true;
      if (edge(10)) out.peck = true;
      if (edge(11)) out.superDash = true;
      if (edge(8)) out.reset = true;
      if (edge(9)) this.onAction?.('pause');
      if (edge(12)) this.onAction?.('camera');
      this.padPrev = pad.buttons.map((x) => x.pressed);
    }

    out.throttle = throttle;
    out.brake = brake;
    out.steer = clamp(steer, -1, 1);
    out.drift = drift;
    out.nitro = nitro;
    return out;
  }

  endFrame() {
    this.keyboard.endFrame();
    this.touch.endFrame();
  }

  clearEdges() {
    const o = this.intent;
    o.attackL = o.attackR = o.peck = o.sweep = o.clamp = o.superDash = o.useItem = o.horn = o.reset = false;
    o.smartAttack = o.smartBeak = false;
  }
}
