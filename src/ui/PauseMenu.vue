<template>
  <div class="pause">
    <div class="panel box">
      <div class="h">游戏暂停</div>
      <div class="sub" v-if="store.rotateOverlay">请先将设备转为横屏</div>
      <button class="btn green" :disabled="store.rotateOverlay" @click="resume">▶ 继续</button>
      <button class="btn blue" @click="restart">↻ 重新开始</button>
      <button v-if="store.setup.mode === 'endless'" class="btn" @click="endRun">🏁 结束本次旅程</button>
      <button class="btn gray" @click="menu">⌂ 返回菜单</button>
      <div class="vol">
        <label>音乐 <input type="range" min="0" max="1" step="0.05" v-model.number="st.musicVolume" @input="apply" /></label>
        <label>音效 <input type="range" min="0" max="1" step="0.05" v-model.number="st.soundVolume" @input="apply" /></label>
        <label class="chk"><input type="checkbox" v-model="st.autoAccelerate" @change="apply" /> 自动加速（触控）</label>
      </div>
      <div class="help">J/K 翅膀 · L 啄击 · U 横扫 · I 夹击 · Q 超级冲刺 · E 道具 · 空格 漂移/特技 · Shift 氮气 · R 复位 · C 镜头</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { useEngine } from '../core/gameRef';

const store = useGameStore();
const st = store.save.settings;
function resume() {
  useEngine()?.resume();
}
function restart() {
  useEngine()?.restart();
}
function menu() {
  useEngine()?.toMenu();
}
function endRun() {
  const g = useEngine();
  g?.resume();
  g?.session?.forceEnd();
}
function apply() {
  useEngine()?.applySettings(st);
  store.persist();
}
</script>

<style scoped>
.pause {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: auto;
  background: rgba(5, 12, 30, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  text-shadow: none;
}
.box {
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(380px, 92vw);
  max-height: 94vh;
  overflow-y: auto;
  color: var(--c-ink);
}
.h {
  font-size: 26px;
  font-weight: 900;
  text-align: center;
}
.sub {
  text-align: center;
  color: #c2410c;
}
.vol {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}
.vol label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.vol input[type='range'] {
  flex: 1;
  accent-color: var(--c-primary);
}
.help {
  font-size: 11px;
  color: #7a849a;
  font-weight: 600;
}
@media (max-height: 500px) {
  .box {
    gap: 6px;
    padding: 12px 16px;
  }
}
</style>
