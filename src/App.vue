<template>
  <canvas ref="canvas" class="game-canvas" />
  <div v-if="store.screen === 'boot'" class="boot">
    <div class="boot-logo">🐦🏍️</div>
    <div class="boot-title">鹈鹕暴力摩托</div>
    <div class="boot-sub">{{ bootText }}</div>
    <div class="boot-bar"><i /></div>
  </div>
  <Transition name="fade" mode="out-in">
    <MainMenu v-if="store.screen === 'menu'" key="menu" />
    <ModeSelect v-else-if="store.screen === 'mode'" key="mode" />
    <TrackSelect v-else-if="store.screen === 'tracks'" key="tracks" />
    <CareerMode v-else-if="store.screen === 'career'" key="career" />
    <PelicanSelect v-else-if="store.screen === 'pelicans'" key="pelicans" />
    <Garage v-else-if="store.screen === 'garage'" key="garage" />
    <Codex v-else-if="store.screen === 'codex'" key="codex" />
    <SettingsScreen v-else-if="store.screen === 'settings'" key="settings" />
    <LoadingScreen v-else-if="store.screen === 'loading'" key="loading" />
    <Results v-else-if="store.screen === 'results'" key="results" />
  </Transition>
  <RaceHUD v-if="store.screen === 'race'" />
  <RotateScreen v-if="store.rotateOverlay" />
  <Transition name="fade">
    <div v-if="store.toast" class="toast">{{ store.toast }}</div>
  </Transition>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useGameStore } from './stores/game';
import { Game } from './core/Game';
import { setGame } from './core/gameRef';
import MainMenu from './ui/MainMenu.vue';
import ModeSelect from './ui/ModeSelect.vue';
import TrackSelect from './ui/TrackSelect.vue';
import CareerMode from './ui/CareerMode.vue';
import PelicanSelect from './ui/PelicanSelect.vue';
import Garage from './ui/Garage.vue';
import Codex from './ui/Codex.vue';
import SettingsScreen from './ui/Settings.vue';
import LoadingScreen from './ui/Loading.vue';
import Results from './ui/Results.vue';
import RaceHUD from './ui/RaceHUD.vue';
import RotateScreen from './ui/RotateScreen.vue';

const store = useGameStore();
const canvas = ref<HTMLCanvasElement>();
const bootText = ref('正在读取存档…');

onMounted(async () => {
  try {
    await store.loadSave();
    bootText.value = '正在启动物理引擎…';
    const game = await Game.create(canvas.value!, store);
    setGame(game);
    if (store.saveRecovered) store.showToast('检测到存档异常，已自动恢复');
    // 首次用户手势解锁音频
    const unlock = () => {
      game.unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    game.music.play('menu');
    store.go('menu');
  } catch (e) {
    console.error(e);
    bootText.value = '启动失败：' + (e as Error).message + '（请使用支持 WebGL 的现代浏览器）';
  }
});
</script>

<style scoped>
.boot {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 35%, #36b3ff, #0e4c8a);
  color: #fff;
}
.boot-logo {
  font-size: 72px;
  animation: bob 1s ease-in-out infinite alternate;
}
.boot-title {
  font-size: 44px;
  font-weight: 900;
  letter-spacing: 6px;
  text-shadow: 0 5px 0 #ff7a1a;
}
.boot-sub {
  margin-top: 14px;
  opacity: 0.9;
}
.boot-bar {
  margin-top: 16px;
  width: 220px;
  height: 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.25);
  overflow: hidden;
}
.boot-bar i {
  display: block;
  height: 100%;
  width: 40%;
  background: #ffd23f;
  border-radius: 6px;
  animation: slide 1.1s ease-in-out infinite;
}
@keyframes slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(260%);
  }
}
@keyframes bob {
  from {
    transform: translateY(0) rotate(-4deg);
  }
  to {
    transform: translateY(-10px) rotate(4deg);
  }
}
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(24px + var(--safe-b));
  transform: translateX(-50%);
  z-index: 100;
  background: rgba(20, 28, 45, 0.92);
  color: #fff;
  padding: 10px 20px;
  border-radius: 999px;
  font-weight: 700;
  pointer-events: none;
  max-width: 90vw;
  text-align: center;
}
</style>
