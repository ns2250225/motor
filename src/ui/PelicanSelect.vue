<template>
  <div class="screen sel-screen">
    <div class="screen-header">
      <button class="btn gray small" @click="back">← 返回</button>
      <div class="screen-title">鹈鹕角色</div>
      <div class="coin-badge">🪙 {{ store.save.coins }}</div>
    </div>
    <div class="layout">
      <div class="list scroll">
        <button v-for="p in PELICANS" :key="p.id" class="item" :class="{ sel: cur.id === p.id, eq: store.save.equippedPelican === p.id }" @click="pick(p.id)">
          <span class="dot" :style="{ background: hex(p.bodyColor), borderColor: hex(p.beakColor) }" />
          <span class="nm">{{ p.name }}</span>
          <span v-if="!owned(p.id)" class="price">🪙{{ p.price }}</span>
          <span v-else-if="store.save.equippedPelican === p.id" class="tag">使用中</span>
        </button>
      </div>
      <div class="spacer" />
      <div class="detail panel">
        <div class="title">
          <span class="nm">{{ cur.name }}</span>
          <span class="nick">「{{ cur.title }}」</span>
        </div>
        <div class="row"><span class="tag">外观</span> {{ cur.look }}</div>
        <div class="row"><span class="tag">特点</span> <b>{{ cur.trait }}</b></div>
        <div class="desc">{{ cur.desc }}</div>
        <div class="stats">
          <div v-for="s in statRows" :key="s.k" class="st">
            <span>{{ s.label }}</span>
            <div class="stat-bar"><i :style="{ width: Math.min(100, (cur.mods[s.k] - 0.6) * 100) + '%' }" /></div>
          </div>
        </div>
        <div class="actions">
          <button v-if="!owned(cur.id)" class="btn" @click="store.buyPelican(cur.id)">🪙 {{ cur.price }} 解锁</button>
          <button v-else-if="store.save.equippedPelican !== cur.id" class="btn green" @click="equip">选用</button>
          <button v-else class="btn gray" disabled>已选用</button>
          <button class="btn blue small" @click="squawk">叫一声</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useGameStore, Screen } from '../stores/game';
import { PELICANS, getPelican, PelicanModifiers } from '../data/pelicans';
import { hex } from '../utils/materials';
import { useEngine } from '../core/gameRef';

const store = useGameStore();
const returnTo = ref<Screen>('menu');
const selId = ref(store.save.equippedPelican);
const cur = computed(() => getPelican(selId.value));
const owned = (id: string) => store.save.unlockedPelicans.includes(id);
const statRows: { k: keyof PelicanModifiers; label: string }[] = [
  { k: 'attack', label: '攻击' },
  { k: 'accel', label: '加速' },
  { k: 'handling', label: '操控' },
  { k: 'impact', label: '冲撞' },
  { k: 'item', label: '道具' },
  { k: 'defense', label: '防御' },
  { k: 'jump', label: '跳跃' },
];

onMounted(() => {
  returnTo.value = ['tracks', 'career'].includes(store.prevScreen) ? store.prevScreen : 'menu';
  const g = useEngine();
  g?.setMenuView('turntable');
  g?.refreshPreview(selId.value);
});
onUnmounted(() => useEngine()?.clearPreview());

function pick(id: string) {
  selId.value = id;
  const g = useEngine();
  g?.audio.play('click');
  g?.refreshPreview(id);
}
function equip() {
  store.equipPelican(cur.value.id);
  useEngine()?.audio.play('coin');
}
function squawk() {
  const g = useEngine();
  g?.unlockAudio();
  g?.audio.play('squawk', { pitch: cur.value.voicePitch });
  g?.menu.shout();
}
function back() {
  store.go(returnTo.value);
}
</script>

<style scoped>
.sel-screen {
  background: linear-gradient(90deg, rgba(10, 25, 55, 0.6), rgba(10, 25, 55, 0) 40%);
}
.layout {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}
.list {
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 4px;
}
.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  font-family: inherit;
  font-weight: 800;
  font-size: 15px;
  color: var(--c-ink);
  border: 3px solid transparent;
  text-align: left;
}
.item.sel {
  border-color: var(--c-primary);
  background: #fff;
}
.dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 5px solid;
  flex-shrink: 0;
}
.nm {
  flex: 1;
}
.price {
  color: #c27c00;
  font-size: 13px;
}
.spacer {
  flex: 1;
}
.detail {
  width: 320px;
  align-self: flex-end;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 100%;
  overflow-y: auto;
}
.title .nm {
  font-size: 22px;
  font-weight: 900;
}
.nick {
  color: #7a849a;
  font-weight: 700;
}
.desc {
  font-size: 13px;
  color: #4a5670;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
  margin: 4px 0;
}
.st {
  font-size: 12px;
  font-weight: 800;
  color: #4a5670;
}
.actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
@media (max-width: 760px) {
  .list {
    width: 160px;
  }
  .detail {
    width: 260px;
  }
}
</style>
