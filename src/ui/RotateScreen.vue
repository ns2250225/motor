<template>
  <div class="rotate">
    <div class="phone">📱</div>
    <h2>请横屏游玩</h2>
    <p>旋转手机，开启鹈鹕疯狂竞速！</p>
    <p class="small" v-if="store.screen === 'race'">游戏已暂停，转为横屏后点击「继续」即可恢复</p>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game';
const store = useGameStore();
</script>

<style scoped>
.rotate {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #1b9bd8, #0b2a55);
  color: #fff;
  text-align: center;
  padding: 24px;
}
.phone {
  font-size: 80px;
  animation: rot 1.6s ease-in-out infinite;
}
h2 {
  font-size: 30px;
  margin: 18px 0 6px;
  letter-spacing: 4px;
}
p {
  margin: 4px;
  opacity: 0.95;
}
.small {
  font-size: 13px;
  opacity: 0.75;
}
@keyframes rot {
  0%,
  20% {
    transform: rotate(0);
  }
  60%,
  100% {
    transform: rotate(-90deg);
  }
}
</style>
