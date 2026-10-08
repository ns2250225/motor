<template>
  <div class="hud" :class="{ mobile: store.isMobile || touch }">
    <!-- 左上：名次 / 圈数 / 时间 -->
    <div class="tl">
      <template v-if="mode !== 'endless' && mode !== 'timetrial'">
        <div class="place">
          <span class="big">{{ hud.place }}</span><span class="of">/{{ hud.total }}</span>
        </div>
      </template>
      <div class="info">
        <template v-if="mode === 'endless'">
          <div class="line">❤️ {{ '❤'.repeat(Math.max(0, hud.lives)) }}<span class="dim">{{ '♡'.repeat(Math.max(0, 3 - hud.lives)) }}</span></div>
          <div class="line">🛣️ {{ (hud.distance / 1000).toFixed(2) }} km</div>
          <div class="line">⭐ {{ hud.score }}</div>
        </template>
        <template v-else>
          <div class="line">圈 <b>{{ hud.lap }}</b>/{{ hud.laps }}</div>
          <div class="line">⏱ {{ formatTime(hud.time) }}</div>
          <div class="line small">本圈 {{ formatTime(hud.lapTime) }}<template v-if="hud.bestLap"> · 最快 {{ formatTime(hud.bestLap) }}</template></div>
        </template>
        <template v-if="mode === 'elimination'">
          <div class="line warn">淘汰倒计时 {{ Math.ceil(hud.elimTimer) }}s</div>
          <div class="hp"><i :style="{ width: hud.hp + '%' }" /></div>
        </template>
      </div>
      <div class="rivals" v-if="hud.ahead || hud.behind">
        <div v-if="hud.ahead" class="rv">▲ {{ hud.ahead.name }} {{ hud.ahead.dist }}m</div>
        <div v-if="hud.behind" class="rv behind">▼ {{ hud.behind.name }} {{ hud.behind.dist }}m</div>
      </div>
    </div>

    <!-- 右上：小地图 + 暂停 -->
    <div class="tr">
      <Minimap />
      <button class="pause-btn" @pointerdown.prevent="pause">⏸</button>
    </div>

    <!-- 中央提示 -->
    <div class="center">
      <TransitionGroup name="pop" tag="div" class="notices">
        <div v-for="n in store.notices" :key="n.id" class="notice" :class="n.kind">{{ n.text }}</div>
      </TransitionGroup>
    </div>
    <div v-if="hud.countdown" :key="hud.countdown" class="countdown" :class="{ go: hud.countdown === 'GO!' }">{{ hud.countdown }}</div>
    <div v-if="hud.wrongWay" class="wrong">⚠ 逆行！请掉头</div>

    <!-- 底部：速度 / 氮气 / 能量 -->
    <div class="bottom">
      <div class="speed">
        <span class="num">{{ hud.speed }}</span><span class="unit">{{ store.save.settings.speedUnit === 'mph' ? 'mph' : 'km/h' }}</span>
        <span v-if="hud.surface && hud.surface !== '柏油' && hud.surface !== '霓虹'" class="surf">{{ hud.surface }}</span>
      </div>
      <div class="bars">
        <div class="bar nitro" :class="{ active: hud.nitroActive }">
          <span>氮气</span>
          <div class="track"><i :style="{ width: hud.nitro * 100 + '%' }" /></div>
        </div>
        <div class="bar energy" :class="{ full: hud.canSuper }">
          <span>{{ hud.canSuper ? '超级!' : '能量' }}</span>
          <div class="track"><i :style="{ width: hud.energy * 100 + '%' }" /></div>
        </div>
      </div>
      <div v-if="hud.drifting" class="drift" :class="'lv' + hud.driftLevel">漂移 {{ ['', '▶', '▶▶', '▶▶▶'][hud.driftLevel] }}</div>
    </div>

    <!-- 右下（PC）：技能冷却与道具 -->
    <div v-if="!(store.isMobile || touch)" class="skills">
      <div v-for="s in skills" :key="s.key" class="sk" :class="{ ready: s.cd() <= 0 }">
        <i class="cdm" :style="{ height: Math.min(1, s.cd()) * 100 + '%' }" />
        <span class="ic">{{ s.icon }}</span>
        <span class="k">{{ s.key }}</span>
      </div>
      <div class="sk super" :class="{ ready: hud.canSuper }">
        <i class="cdm" :style="{ height: (1 - hud.energy) * 100 + '%' }" />
        <span class="ic">💥</span><span class="k">Q</span>
      </div>
      <div class="item-slot" :class="{ has: hud.item }">
        <span class="ic">{{ hud.item ? getItem(hud.item).icon : '·' }}</span>
        <span class="k">E</span>
        <span class="nm">{{ hud.item ? getItem(hud.item).name : '喉囊空空' }}</span>
      </div>
    </div>
    <div v-else-if="hud.item" class="item-mobile">{{ getItem(hud.item).icon }} {{ getItem(hud.item).name }}</div>
    <div v-if="hud.boneTimer > 0" class="buff">🦴 巨型鱼骨 {{ hud.boneTimer.toFixed(1) }}s</div>
    <div v-if="hud.invincible" class="buff gold">✨ 无敌</div>
    <div v-if="hud.frozen" class="buff ice">🧊 冰冻减速</div>

    <div v-if="store.save.settings.showFps" class="fps">{{ hud.fps }} FPS</div>

    <!-- 视线干扰 -->
    <div v-if="store.vision.feather > 0" class="vision feather" :style="{ opacity: Math.min(1, store.vision.feather) }">
      <span v-for="i in 18" :key="i" :style="featherStyle(i)">🪶</span>
    </div>
    <div v-if="store.vision.ink > 0" class="vision ink" :style="{ opacity: Math.min(0.92, store.vision.ink) }">
      <span v-for="i in 7" :key="i" :style="inkStyle(i)" />
    </div>

    <TouchControls v-if="(store.isMobile || touch) && !store.paused" />
    <PauseMenu v-if="store.paused" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import { useEngine } from '../core/gameRef';
import { formatTime } from '../utils/math';
import { getItem } from '../data/items';
import Minimap from './Minimap.vue';
import TouchControls from './TouchControls.vue';
import PauseMenu from './PauseMenu.vue';

const store = useGameStore();
const hud = store.hud;
const mode = computed(() => store.setup.mode);
const touch = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const skills = [
  { key: 'J', icon: '🪽', cd: () => hud.cd.wingL },
  { key: 'K', icon: '🪽', cd: () => hud.cd.wingR },
  { key: 'L', icon: '👄', cd: () => hud.cd.peck },
  { key: 'U', icon: '🌪️', cd: () => hud.cd.sweep },
  { key: 'I', icon: '🦩', cd: () => hud.cd.clamp },
];
function pause() {
  useEngine()?.pause();
}
function featherStyle(i: number) {
  const r = (i * 9301 + 49297) % 233280;
  return { left: (r % 100) + '%', top: ((r / 7) % 100) + '%', fontSize: 40 + (i % 5) * 18 + 'px', transform: `rotate(${(i * 47) % 360}deg)` };
}
function inkStyle(i: number) {
  const r = (i * 7919) % 1000;
  return { left: (r % 80) + '%', top: ((r * 3) % 70) + '%', width: 180 + (i % 3) * 90 + 'px', height: 160 + (i % 4) * 70 + 'px' };
}
</script>

<style scoped>
.hud {
  position: fixed;
  inset: 0;
  z-index: 12;
  pointer-events: none;
  color: #fff;
  text-shadow: 0 2px 2px rgba(0, 0, 0, 0.55);
  font-weight: 800;
}
.tl {
  position: absolute;
  left: calc(14px + var(--safe-l));
  top: calc(10px + var(--safe-t));
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.place .big {
  font-size: 64px;
  font-weight: 900;
  line-height: 1;
  color: #ffd23f;
  -webkit-text-stroke: 2px #6b3a00;
}
.place .of {
  font-size: 26px;
}
.info .line {
  font-size: 17px;
}
.info .line.small {
  font-size: 13px;
  opacity: 0.9;
}
.info .warn {
  color: #ffb3b3;
}
.dim {
  opacity: 0.4;
}
.hp {
  width: 160px;
  height: 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.4);
  overflow: hidden;
}
.hp i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ff4d4d, #3ccf6e);
}
.rivals {
  margin-top: 4px;
  font-size: 13px;
}
.rv {
  background: rgba(0, 0, 0, 0.35);
  padding: 2px 8px;
  border-radius: 8px;
  margin-top: 3px;
}
.rv.behind {
  color: #ffd0d0;
}
.tr {
  position: absolute;
  right: calc(12px + var(--safe-r));
  top: calc(10px + var(--safe-t));
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.pause-btn {
  pointer-events: auto;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 22px;
}
.center {
  position: absolute;
  left: 50%;
  top: calc(12% + var(--safe-t));
  transform: translateX(-50%);
  width: min(80vw, 560px);
}
.notices {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.notice {
  padding: 6px 16px;
  border-radius: 999px;
  background: rgba(20, 28, 45, 0.6);
  font-size: 18px;
}
.notice.good {
  color: #b8ffcf;
}
.notice.bad {
  color: #ffb3b3;
}
.notice.big {
  font-size: 30px;
  color: #ffd23f;
  background: rgba(0, 0, 0, 0.25);
  -webkit-text-stroke: 1px #6b3a00;
}
.pop-enter-active {
  animation: pop 0.3s;
}
.pop-leave-active {
  transition: opacity 0.3s;
}
.pop-leave-to {
  opacity: 0;
}
@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  70% {
    transform: scale(1.15);
  }
}
.countdown {
  position: absolute;
  left: 50%;
  top: 38%;
  transform: translate(-50%, -50%);
  font-size: 120px;
  font-weight: 900;
  color: #ffd23f;
  -webkit-text-stroke: 4px #6b3a00;
  animation: pop 0.4s;
}
.countdown.go {
  color: #3ccf6e;
  -webkit-text-stroke: 4px #0f5a2a;
}
.wrong {
  position: absolute;
  left: 50%;
  top: 30%;
  transform: translateX(-50%);
  font-size: 34px;
  color: #ff4d4d;
  animation: blink 0.5s infinite alternate;
}
@keyframes blink {
  to {
    opacity: 0.3;
  }
}
.bottom {
  position: absolute;
  left: calc(16px + var(--safe-l));
  bottom: calc(14px + var(--safe-b));
  display: flex;
  align-items: flex-end;
  gap: 14px;
}
.mobile .bottom {
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(6px + var(--safe-b));
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.speed .num {
  font-size: 52px;
  font-weight: 900;
  line-height: 1;
}
.mobile .speed .num {
  font-size: 34px;
}
.speed .unit {
  font-size: 15px;
  margin-left: 4px;
}
.surf {
  margin-left: 8px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.35);
  padding: 2px 6px;
  border-radius: 6px;
}
.bars {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 200px;
}
.mobile .bars {
  width: 170px;
  flex-direction: row;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  flex: 1;
}
.bar .track {
  flex: 1;
  height: 12px;
  border-radius: 7px;
  background: rgba(0, 0, 0, 0.45);
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.5);
}
.bar.nitro i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #ffb21a, #ff3d1a);
}
.bar.nitro.active .track {
  box-shadow: 0 0 10px #ff7a1a;
}
.bar.energy i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #6ec6ff, #b28dff);
}
.bar.energy.full .track {
  box-shadow: 0 0 12px #b28dff;
  animation: blink 0.4s infinite alternate;
}
.drift {
  font-size: 18px;
  color: #ffe14a;
}
.drift.lv2 {
  color: #ff9a1f;
}
.drift.lv3 {
  color: #4ff7ff;
}
.skills {
  position: absolute;
  right: calc(14px + var(--safe-r));
  bottom: calc(14px + var(--safe-b));
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.sk {
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.45);
  border: 2px solid rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.sk.ready {
  border-color: #ffd23f;
}
.sk .cdm {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.55);
}
.sk .ic {
  font-size: 24px;
  position: relative;
}
.sk .k,
.item-slot .k {
  position: absolute;
  right: 3px;
  bottom: 1px;
  font-size: 11px;
}
.item-slot {
  position: relative;
  width: 76px;
  height: 76px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.45);
  border: 3px solid rgba(255, 255, 255, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.item-slot.has {
  border-color: #3ccf6e;
  animation: blink 0.6s infinite alternate;
}
.item-slot .ic {
  font-size: 34px;
}
.item-slot .nm {
  font-size: 10px;
}
.item-mobile {
  position: absolute;
  right: calc(12px + var(--safe-r));
  top: calc(170px + var(--safe-t));
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 14px;
}
.buff {
  position: absolute;
  left: 50%;
  top: calc(5px + var(--safe-t));
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.4);
  padding: 3px 12px;
  border-radius: 999px;
  font-size: 14px;
}
.buff.gold {
  color: #ffd700;
  top: calc(32px + var(--safe-t));
}
.buff.ice {
  color: #9fe8ff;
  top: calc(58px + var(--safe-t));
}
.fps {
  position: absolute;
  left: 50%;
  bottom: 2px;
  font-size: 11px;
  opacity: 0.7;
}
.vision {
  position: absolute;
  inset: 0;
  overflow: hidden;
  transition: opacity 0.3s;
}
.vision.feather span {
  position: absolute;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
}
.vision.feather {
  background: rgba(255, 255, 255, 0.35);
}
.vision.ink span {
  position: absolute;
  border-radius: 48% 52% 60% 40% / 50% 40% 60% 50%;
  background: radial-gradient(circle at 40% 40%, #2b1d48, #120a24);
}
@media (max-height: 500px) {
  .place .big {
    font-size: 44px;
  }
  .info .line {
    font-size: 14px;
  }
  .countdown {
    font-size: 80px;
  }
  .notice.big {
    font-size: 22px;
  }
  .notice {
    font-size: 15px;
  }
}
</style>
