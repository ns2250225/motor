<template>
  <div class="touch-layer" :style="{ '--s': st.buttonScale }">
    <!-- 左手区域 -->
    <div v-if="st.touchLayout === 'buttons'" class="left">
      <div class="tbtn steer" :class="{ on: steerL }" @pointerdown.prevent="down($event, 'L')" @pointerup="up('L')" @pointercancel="up('L')" @lostpointercapture="up('L')">◀</div>
      <div class="tbtn steer" :class="{ on: steerR }" @pointerdown.prevent="down($event, 'R')" @pointerup="up('R')" @pointercancel="up('R')" @lostpointercapture="up('R')">▶</div>
    </div>
    <div v-else class="joy-area" @pointerdown.prevent="joyDown" @pointermove="joyMove" @pointerup="joyUp" @pointercancel="joyUp">
      <div class="joy-base" :style="{ left: joy.x + 'px', top: joy.y + 'px', opacity: joy.active ? 1 : 0.45 }">
        <div class="joy-knob" :style="{ transform: `translate(${joy.dx}px, ${joy.dy}px)` }" />
      </div>
    </div>

    <!-- 右手区域 -->
    <div class="right">
      <div class="col">
        <div v-if="hud.item" class="tbtn item" @pointerdown.prevent="press('item')">
          <span class="ic">{{ itemIcon }}</span><span class="lb">道具</span>
        </div>
        <div v-if="hud.canSuper" class="tbtn super" @pointerdown.prevent="press('super')"><span class="ic">💥</span><span class="lb">超级</span></div>
        <div class="tbtn beak" @pointerdown.prevent="press('beak')">
          <i class="cd" :style="cdStyle(Math.max(hud.cd.clamp, 0) > 0 && hud.cd.sweep > 0 ? Math.min(hud.cd.clamp, hud.cd.sweep) : 0)" />
          <span class="ic">🦩</span><span class="lb">大嘴</span>
        </div>
      </div>
      <div class="col">
        <div class="tbtn nitro" :class="{ on: held.nitro }" @pointerdown.prevent="hold($event, 'nitro', true)" @pointerup="hold(null, 'nitro', false)" @pointercancel="hold(null, 'nitro', false)">
          <i class="fill" :style="{ height: hud.nitro * 100 + '%' }" />
          <span class="ic">🔥</span><span class="lb">氮气</span>
        </div>
        <div class="tbtn attack" @pointerdown.prevent="press('attack')">
          <i class="cd" :style="cdStyle(Math.min(hud.cd.wingL, hud.cd.wingR))" />
          <span class="ic">👊</span><span class="lb">攻击</span>
        </div>
      </div>
      <div class="col">
        <div class="tbtn drift" :class="{ on: held.drift }" @pointerdown.prevent="hold($event, 'drift', true)" @pointerup="hold(null, 'drift', false)" @pointercancel="hold(null, 'drift', false)">
          <span class="ic">🌀</span><span class="lb">漂移</span>
        </div>
        <div v-if="!st.autoAccelerate" class="tbtn gas" :class="{ on: held.throttle }" @pointerdown.prevent="hold($event, 'throttle', true)" @pointerup="hold(null, 'throttle', false)" @pointercancel="hold(null, 'throttle', false)">
          <span class="ic">⏫</span><span class="lb">加速</span>
        </div>
        <div class="tbtn brake" :class="{ on: held.brake }" @pointerdown.prevent="hold($event, 'brake', true)" @pointerup="hold(null, 'brake', false)" @pointercancel="hold(null, 'brake', false)">
          <span class="ic">⏬</span><span class="lb">刹车</span>
        </div>
      </div>
    </div>
    <div class="mini">
      <div class="tbtn small" @pointerdown.prevent="press('horn')">📯</div>
      <div class="tbtn small" @pointerdown.prevent="press('reset')">↺</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onUnmounted } from 'vue';
import { useGameStore } from '../stores/game';
import { touchControls } from '../controls/TouchControls';
import { getItem } from '../data/items';
import { vibrate } from '../utils/device';

const store = useGameStore();
const hud = store.hud;
const st = store.save.settings;
const steerL = ref(false);
const steerR = ref(false);
const held = reactive({ nitro: false, drift: false, throttle: false, brake: false });
const joy = reactive({ active: false, id: -1, x: 120, y: Math.max(80, window.innerHeight * 0.65 - 100), ox: 0, oy: 0, dx: 0, dy: 0 });
const itemIcon = computed(() => (hud.item ? getItem(hud.item).icon : ''));
touchControls.enabled = true;

function syncSteer() {
  touchControls.steer = (steerR.value ? 1 : 0) - (steerL.value ? 1 : 0);
  touchControls.touched();
}
function down(e: PointerEvent, side: 'L' | 'R') {
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  if (side === 'L') steerL.value = true;
  else steerR.value = true;
  syncSteer();
}
function up(side: 'L' | 'R') {
  if (side === 'L') steerL.value = false;
  else steerR.value = false;
  syncSteer();
}
function hold(e: PointerEvent | null, k: keyof typeof held, v: boolean) {
  if (e) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  held[k] = v;
  touchControls[k] = v;
  touchControls.touched();
  if (v && st.vibration) vibrate(8);
}
function press(k: 'attack' | 'beak' | 'item' | 'super' | 'horn' | 'reset') {
  touchControls.press(k);
  if (st.vibration) vibrate(12);
}
function cdStyle(frac: number) {
  const f = Math.max(0, Math.min(1, frac));
  return { background: `conic-gradient(rgba(0,0,0,0.55) ${f * 360}deg, transparent 0)` };
}

// 虚拟摇杆
function joyDown(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  joy.active = true;
  joy.id = e.pointerId;
  joy.x = e.clientX - rect.left;
  joy.y = e.clientY - rect.top;
  joy.ox = e.clientX;
  joy.oy = e.clientY;
  joy.dx = joy.dy = 0;
}
function joyMove(e: PointerEvent) {
  if (!joy.active || e.pointerId !== joy.id) return;
  const R = 55 * st.buttonScale;
  let dx = e.clientX - joy.ox;
  let dy = e.clientY - joy.oy;
  const l = Math.hypot(dx, dy);
  if (l > R) {
    dx = (dx / l) * R;
    dy = (dy / l) * R;
  }
  joy.dx = dx;
  joy.dy = dy;
  const v = dx / R;
  touchControls.steer = Math.abs(v) < 0.08 ? 0 : v;
  touchControls.touched();
}
function joyUp() {
  joy.active = false;
  joy.dx = joy.dy = 0;
  touchControls.steer = 0;
}
onUnmounted(() => touchControls.reset());
</script>

<style scoped>
.touch-layer {
  position: fixed;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  touch-action: none;
}
.tbtn {
  pointer-events: auto;
  position: relative;
  width: calc(74px * var(--s));
  height: calc(74px * var(--s));
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.28);
  border: 3px solid rgba(255, 255, 255, 0.65);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-weight: 900;
  font-size: calc(26px * var(--s));
  backdrop-filter: blur(2px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  touch-action: none;
}
.tbtn.on {
  background: rgba(255, 210, 63, 0.55);
  transform: scale(0.94);
}
.tbtn:active {
  transform: scale(0.94);
}
.tbtn .ic {
  font-size: calc(24px * var(--s));
  line-height: 1;
  position: relative;
}
.tbtn .lb {
  font-size: calc(11px * var(--s));
  margin-top: 2px;
  position: relative;
}
.cd {
  position: absolute;
  inset: 0;
  border-radius: 50%;
}
.fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 122, 26, 0.55);
}
.left {
  position: absolute;
  left: calc(18px + var(--safe-l));
  bottom: calc(18px + var(--safe-b));
  display: flex;
  gap: calc(14px * var(--s));
}
.steer {
  width: calc(92px * var(--s));
  height: calc(92px * var(--s));
  font-size: calc(36px * var(--s));
}
.right {
  position: absolute;
  right: calc(14px + var(--safe-r));
  bottom: calc(14px + var(--safe-b));
  display: flex;
  gap: calc(10px * var(--s));
  align-items: flex-end;
}
.col {
  display: flex;
  flex-direction: column;
  gap: calc(10px * var(--s));
  align-items: center;
}
.attack {
  width: calc(88px * var(--s));
  height: calc(88px * var(--s));
  background: rgba(255, 77, 77, 0.4);
}
.beak {
  background: rgba(255, 210, 63, 0.4);
}
.item {
  background: rgba(60, 207, 110, 0.5);
  animation: pulse 0.8s ease-in-out infinite alternate;
}
.super {
  background: rgba(155, 92, 255, 0.6);
  animation: pulse 0.5s ease-in-out infinite alternate;
}
.nitro {
  background: rgba(255, 122, 26, 0.25);
}
.drift {
  width: calc(80px * var(--s));
  height: calc(80px * var(--s));
}
.brake,
.gas {
  width: calc(64px * var(--s));
  height: calc(64px * var(--s));
}
.mini {
  position: absolute;
  right: calc(16px + var(--safe-r));
  top: calc(50% - 30px);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tbtn.small {
  width: calc(46px * var(--s));
  height: calc(46px * var(--s));
  font-size: calc(18px * var(--s));
}
.joy-area {
  pointer-events: auto;
  position: absolute;
  left: 0;
  bottom: 0;
  width: 42%;
  height: 65%;
}
.joy-base {
  position: absolute;
  width: calc(130px * var(--s));
  height: calc(130px * var(--s));
  margin: calc(-65px * var(--s)) 0 0 calc(-65px * var(--s));
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  border: 3px solid rgba(255, 255, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.joy-knob {
  width: calc(56px * var(--s));
  height: calc(56px * var(--s));
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.75);
}
@keyframes pulse {
  from {
    box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6);
  }
  to {
    box-shadow: 0 0 0 8px rgba(255, 255, 255, 0);
  }
}
</style>
