<template>
  <div class="screen loading">
    <div class="spin">🏍️</div>
    <div class="txt">{{ store.loadingText || '加载中…' }}</div>
    <div class="tip">小贴士：{{ tip }}</div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { pick } from '../utils/math';

const store = useGameStore();
const tip = pick([
  '漂移时间越长，松开后的加速越猛（火花颜色会变化）。',
  '在跳台腾空时按漂移键可以做空中特技，落地奖励氮气。',
  '喉囊里只能装一个道具，鼓起的嘴巴就是提示。',
  '大嘴夹击冷却长达 8 秒，但能直接把对手甩出赛道。',
  '能量满了按 Q（触控“超级”按钮）发动超级鹈鹕冲刺，撞飞一切。',
  '每条赛道都藏着一条捷径，发现后有额外金币奖励。',
  '重型巡航车撞人最疼，迷你摩托转弯最灵活。',
  '黄金鲤鱼让你短时间无敌，冲进人群吧！',
]);
</script>

<style scoped>
.loading {
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 50% 40%, #2a8fe0, #0b2a55);
  color: #fff;
  z-index: 30;
}
.spin {
  font-size: 64px;
  animation: ride 0.6s ease-in-out infinite alternate;
}
.txt {
  font-size: 22px;
  font-weight: 900;
  margin-top: 10px;
}
.tip {
  margin-top: 14px;
  opacity: 0.85;
  max-width: 520px;
  text-align: center;
}
@keyframes ride {
  from {
    transform: translateX(-20px) rotate(-6deg);
  }
  to {
    transform: translateX(20px) rotate(6deg);
  }
}
</style>
