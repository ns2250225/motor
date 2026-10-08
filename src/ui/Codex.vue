<template>
  <div class="screen dim">
    <div class="screen-header">
      <button class="btn gray small" @click="store.go('menu')">← 返回</button>
      <div class="screen-title">图鉴与成就</div>
      <div class="tabs">
        <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: store.codexTab === t.id }" @click="store.codexTab = t.id">{{ t.name }}</button>
      </div>
    </div>
    <div class="grid scroll">
      <template v-if="store.codexTab === 'pelicans'">
        <div v-for="p in PELICANS" :key="p.id" class="card panel" :class="{ locked: !store.save.unlockedPelicans.includes(p.id) }">
          <div class="icon" :style="{ background: hex(p.bodyColor), borderColor: hex(p.beakColor) }" />
          <div class="name">{{ store.save.unlockedPelicans.includes(p.id) ? p.name : '??? 鹈鹕' }}</div>
          <div class="sub">{{ p.look }} · {{ p.trait }}</div>
          <div class="desc">{{ store.save.unlockedPelicans.includes(p.id) ? p.desc : `在角色页面花费 ${p.price} 金币解锁` }}</div>
        </div>
      </template>
      <template v-else-if="store.codexTab === 'bikes'">
        <div v-for="b in MOTORCYCLES" :key="b.id" class="card panel" :class="{ locked: !store.save.unlockedMotorcycles.includes(b.id) }">
          <div class="icon sq" :style="{ background: hex(b.color) }" />
          <div class="name">{{ b.name }}</div>
          <div class="sub">速度 {{ b.ratings.speed }} · 操控 {{ b.ratings.handling }} · 防御 {{ b.ratings.defense }} · {{ b.special }}</div>
          <div class="desc">{{ b.desc }}</div>
        </div>
      </template>
      <template v-else-if="store.codexTab === 'items'">
        <div v-for="it in ITEMS" :key="it.id" class="card panel" :class="{ locked: !store.save.stats.itemsUsed.includes(it.id) }">
          <div class="emoji">{{ it.icon }}</div>
          <div class="name">{{ it.name }}</div>
          <div class="desc">{{ it.desc }}</div>
          <div class="sub">{{ store.save.stats.itemsUsed.includes(it.id) ? '已使用过' : '尚未使用' }}</div>
        </div>
      </template>
      <template v-else-if="store.codexTab === 'tracks'">
        <div v-for="t in TRACKS" :key="t.id" class="card panel" :class="{ locked: !store.save.unlockedTracks.includes(t.id) }">
          <div class="icon sq" :style="{ background: `linear-gradient(${hex(t.palette.skyTop)}, ${hex(t.palette.ground)})` }" />
          <div class="name">{{ t.name }}</div>
          <div class="sub">难度 {{ '★'.repeat(t.difficulty) }} · {{ t.theme }} · 全长 {{ trackLen(t.id) }} 米</div>
          <div class="desc">{{ t.description }}</div>
          <div class="sub">
            捷径「{{ t.shortcuts[0]?.name }}」：{{ store.save.discoveredShortcuts.includes(t.shortcuts[0]?.id) ? '已发现 ✓' : '未发现' }} · 最快圈
            {{ store.save.bestLapTimes[t.id] ? formatTime(store.save.bestLapTimes[t.id]) : '--' }}
          </div>
        </div>
      </template>
      <template v-else>
        <div v-for="a in ACHIEVEMENTS" :key="a.id" class="card panel ach" :class="{ locked: !store.save.achievements[a.id] }">
          <div class="emoji">{{ a.icon }}</div>
          <div class="name">{{ a.name }}</div>
          <div class="desc">{{ a.desc }}</div>
          <div class="sub">
            奖励 🪙{{ a.reward }}
            <template v-if="store.save.achievements[a.id]"> · 已达成 {{ new Date(store.save.achievements[a.id]).toLocaleDateString() }}</template>
            <template v-else-if="a.progress"> · 进度 {{ Math.min(a.progress(store.save)[0], a.progress(store.save)[1]) }}/{{ a.progress(store.save)[1] }}</template>
          </div>
        </div>
      </template>
    </div>
    <div class="stats panel" v-if="store.codexTab === 'achievements'">
      生涯统计：比赛 {{ s.races }} 场 · 冠军 {{ s.wins }} · 领奖台 {{ s.podiums }} · 击倒 {{ s.kos }} · 命中 {{ s.hits }} · 漂移 {{ Math.floor(s.driftDistance) }} 米 · 特技 {{ s.tricks }} · 累计金币 {{ s.coinsEarned }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import { PELICANS } from '../data/pelicans';
import { MOTORCYCLES } from '../data/motorcycles';
import { ITEMS } from '../data/items';
import { TRACKS } from '../tracks/TrackConfig';
import { ACHIEVEMENTS } from '../data/achievements';
import { TrackGeometry } from '../tracks/TrackGeometry';
import { hex } from '../utils/materials';
import { formatTime } from '../utils/math';

const store = useGameStore();
const s = computed(() => store.save.stats);
const tabs = [
  { id: 'pelicans', name: '鹈鹕' },
  { id: 'bikes', name: '摩托' },
  { id: 'items', name: '道具' },
  { id: 'tracks', name: '赛道' },
  { id: 'achievements', name: '成就' },
] as const;
const lenCache = new Map<string, number>();
function trackLen(id: string) {
  if (!lenCache.has(id)) {
    const t = TRACKS.find((x) => x.id === id)!;
    lenCache.set(id, Math.round(new TrackGeometry({ ...t, shortcuts: [], randomObstacles: { types: [], count: 0 } }).length));
  }
  return lenCache.get(id);
}
</script>

<style scoped>
.dim {
  background: rgba(10, 25, 55, 0.65);
}
.tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tab {
  padding: 7px 14px;
  border-radius: 10px;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.7);
  color: var(--c-ink);
}
.tab.on {
  background: var(--c-yellow);
}
.grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 10px;
  align-content: start;
  padding: 4px;
}
.card {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card.locked {
  opacity: 0.55;
  filter: grayscale(0.5);
}
.icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 8px solid;
}
.icon.sq {
  border-radius: 12px;
  border: none;
}
.emoji {
  font-size: 36px;
}
.name {
  font-weight: 900;
  font-size: 17px;
}
.sub {
  font-size: 12px;
  color: #7a849a;
  font-weight: 700;
}
.desc {
  font-size: 13px;
  color: #4a5670;
}
.stats {
  margin-top: 8px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
}
</style>
