<template>
  <div class="screen dim">
    <div class="screen-header">
      <button class="btn gray small" @click="back">← 返回</button>
      <div class="screen-title">{{ modeName }} · 选择赛道</div>
      <div class="coin-badge">🪙 {{ store.save.coins }}</div>
    </div>
    <div v-if="store.setup.mode === 'endless'" class="endless panel">
      <div class="icon">🛣️</div>
      <div>
        <div class="name">无尽公路</div>
        <div class="desc">无限延伸的道路，途经海滨、沙漠、农场、雪山、霓虹都市与月球。3 条命，持续躲避障碍和战斗，跑得越远分数越高。</div>
        <div class="desc">最佳纪录：{{ (store.save.stats.endlessBest / 1000).toFixed(2) }} 公里</div>
      </div>
    </div>
    <div v-else class="grid scroll">
      <button
        v-for="t in TRACKS"
        :key="t.id"
        class="card panel"
        :class="{ sel: store.setup.trackId === t.id, locked: !isUnlocked(t.id) }"
        @click="select(t.id)"
      >
        <div class="thumb" :style="{ background: `linear-gradient(180deg, ${hex(t.palette.skyTop)}, ${hex(t.palette.skyBottom)} 55%, ${hex(t.palette.ground)} 56%)` }">
          <span class="num">{{ String(TRACKS.indexOf(t) + 1).padStart(2, '0') }}</span>
          <span class="theme">{{ t.theme }}</span>
          <span v-if="!isUnlocked(t.id)" class="lock">🔒</span>
        </div>
        <div class="info">
          <div class="name">{{ t.name }}</div>
          <div class="stars">难度 {{ '★'.repeat(t.difficulty) }}{{ '☆'.repeat(5 - t.difficulty) }} · {{ store.setup.mode === 'elimination' ? '淘汰赛' : t.laps + ' 圈' }}</div>
          <div class="desc">{{ t.description }}</div>
          <div class="meta">
            <span class="tag">{{ t.feature }}{{ store.save.discoveredShortcuts.includes(t.shortcuts[0]?.id) ? ' ✓' : '' }}</span>
            <span class="tag" v-if="store.save.bestLapTimes[t.id]">最快圈 {{ formatTime(store.save.bestLapTimes[t.id]) }}</span>
          </div>
          <div v-if="!isUnlocked(t.id)" class="buy">
            <button class="btn small" @click.stop="store.buyTrack(t.id)">🪙 {{ t.unlockPrice }} 解锁</button>
            <span class="or">或在生涯模式中解锁</span>
          </div>
        </div>
      </button>
    </div>
    <RiderBar>
      <button class="btn big-start" :disabled="!canStart" @click="start">🏍️ 开始比赛</button>
    </RiderBar>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useGameStore } from '../stores/game';
import { TRACKS } from '../tracks/TrackConfig';
import { MODES } from '../data/career';
import { hex } from '../utils/materials';
import { formatTime } from '../utils/math';
import { useEngine } from '../core/gameRef';
import RiderBar from './RiderBar.vue';

const store = useGameStore();
const modeName = computed(() => MODES.find((m) => m.id === store.setup.mode)?.name ?? '快速比赛');
const isUnlocked = (id: string) => store.save.unlockedTracks.includes(id);
const canStart = computed(() => store.setup.mode === 'endless' || isUnlocked(store.setup.trackId));

onMounted(() => {
  useEngine()?.setMenuView('ride');
  if (store.setup.mode !== 'endless' && !isUnlocked(store.setup.trackId)) store.setup.trackId = 'coast';
});

function select(id: string) {
  useEngine()?.audio.play('click');
  store.setup.trackId = id;
}
function back() {
  store.go(store.setup.mode === 'quick' && store.prevScreen === 'menu' ? 'menu' : 'mode');
}
function start() {
  useEngine()?.startRace({ ...store.setup });
}
</script>

<style scoped>
.dim {
  background: rgba(10, 25, 55, 0.55);
}
.grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
  padding: 4px;
  align-content: start;
}
.card {
  text-align: left;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  color: var(--c-ink);
  border: 4px solid transparent;
  transition: transform 0.12s;
}
.card.sel {
  border-color: var(--c-primary);
  transform: translateY(-2px);
}
.card.locked .thumb {
  filter: grayscale(0.7);
}
.thumb {
  height: 70px;
  position: relative;
}
.num {
  position: absolute;
  left: 10px;
  top: 6px;
  font-size: 28px;
  font-weight: 900;
  color: #fff;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
}
.theme {
  position: absolute;
  right: 10px;
  bottom: 6px;
  color: #fff;
  font-weight: 800;
  text-shadow: 0 1px 2px #000;
}
.lock {
  position: absolute;
  right: 10px;
  top: 6px;
  font-size: 22px;
}
.info {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.name {
  font-size: 18px;
  font-weight: 900;
}
.stars {
  font-size: 13px;
  color: #e08a00;
  font-weight: 800;
}
.desc {
  font-size: 13px;
  color: #4a5670;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.buy {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.or {
  font-size: 12px;
  color: #7a849a;
}
.big-start {
  margin-left: auto;
  font-size: 20px;
  padding: 12px 28px;
}
.endless {
  display: flex;
  gap: 16px;
  padding: 18px;
  align-items: center;
  max-width: 640px;
}
.endless .icon {
  font-size: 60px;
}
.endless .name {
  font-size: 24px;
}
</style>
