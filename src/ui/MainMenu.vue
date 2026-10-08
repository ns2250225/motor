<template>
  <div class="screen menu">
    <div class="top">
      <div class="coin-badge">🪙 {{ store.save.coins }}</div>
    </div>
    <div class="body">
      <div class="logo">
        <div class="logo-cn">鹈鹕暴力摩托</div>
        <div class="logo-en">PELICAN ROAD RAGE</div>
        <div class="tagline">骑着摩托的鹈鹕在高速公路上狂飙，用大嘴把对手啄飞！</div>
      </div>
      <div class="buttons">
        <button class="btn big" @click="start">🏁 开始游戏</button>
        <button class="btn blue" @click="go('career')">🏆 生涯模式</button>
        <button class="btn blue" @click="quickTracks">🗺️ 赛道选择</button>
        <div class="row">
          <button class="btn green" @click="go('pelicans')">🐦 鹈鹕角色</button>
          <button class="btn green" @click="go('garage')">🏍️ 摩托车库</button>
        </div>
        <div class="row">
          <button class="btn gray" @click="go('codex')">📖 图鉴</button>
          <button class="btn gray" @click="go('settings')">⚙️ 游戏设置</button>
        </div>
      </div>
    </div>
    <div class="hint">{{ store.isMobile ? '建议横屏游玩 · 点击开始后自动全屏' : 'W/S 加减速 · A/D 转向 · 空格漂移 · Shift 氮气 · J/K 翅膀 · L 啄击 · E 道具' }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useGameStore, Screen } from '../stores/game';
import { useEngine } from '../core/gameRef';

const store = useGameStore();
onMounted(() => {
  const g = useEngine();
  g?.setMenuView('ride');
  g?.clearPreview();
});
function go(s: Screen) {
  useEngine()?.audio.play('click');
  store.go(s);
}
function start() {
  useEngine()?.unlockAudio();
  go('mode');
}
function quickTracks() {
  store.setup.mode = 'quick';
  go('tracks');
}
</script>

<style scoped>
.menu {
  background: linear-gradient(90deg, rgba(10, 30, 70, 0.55) 0%, rgba(10, 30, 70, 0.2) 45%, rgba(0, 0, 0, 0) 70%);
}
.top {
  display: flex;
}
.body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  max-width: 460px;
}
.logo-cn {
  font-size: clamp(34px, 6vw, 64px);
  font-weight: 900;
  color: #fff;
  letter-spacing: 4px;
  text-shadow: 0 5px 0 #ff7a1a, 0 9px 0 rgba(0, 0, 0, 0.25);
  line-height: 1.1;
}
.logo-en {
  font-size: clamp(14px, 2vw, 20px);
  font-weight: 900;
  color: #ffd23f;
  letter-spacing: 6px;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.35);
}
.tagline {
  margin-top: 6px;
  color: #fff;
  opacity: 0.9;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
.buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 340px;
}
.buttons .btn {
  width: 100%;
}
.btn.big {
  font-size: 22px;
  padding: 16px;
}
.row {
  display: flex;
  gap: 12px;
}
.hint {
  color: #fff;
  opacity: 0.8;
  font-size: 13px;
  text-shadow: 0 1px 2px #000;
}
@media (max-height: 500px) {
  .body {
    gap: 8px;
  }
  .buttons {
    gap: 7px;
  }
  .btn.big {
    font-size: 18px;
    padding: 10px;
  }
  .tagline {
    display: none;
  }
}
</style>
