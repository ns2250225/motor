<template>
  <div class="screen dim">
    <div class="screen-header">
      <button class="btn gray small" @click="store.go('menu')">← 返回</button>
      <div class="screen-title">选择游戏模式</div>
      <div class="coin-badge">🪙 {{ store.save.coins }}</div>
    </div>
    <div class="grid scroll">
      <button v-for="m in MODES" :key="m.id" class="card panel" :class="{ locked: !unlocked(m.id) }" @click="pick(m.id)">
        <div class="icon">{{ m.icon }}</div>
        <div class="name">{{ m.name }}</div>
        <div class="desc">{{ m.desc }}</div>
        <div class="unlock" v-if="!unlocked(m.id)">🔒 {{ m.unlock }}</div>
        <div class="tag" v-else>{{ m.id === 'endless' || m.id === 'chaos' ? '加强版' : m.unlock === '默认' ? '可游玩' : '已解锁' }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/game';
import { MODES, eliminationUnlocked, ModeDef } from '../data/career';
import { useEngine } from '../core/gameRef';

const store = useGameStore();
function unlocked(id: ModeDef['id']) {
  if (id === 'elimination') return eliminationUnlocked(store.save.careerProgress);
  return true;
}
function pick(id: ModeDef['id']) {
  const g = useEngine();
  if (!unlocked(id)) {
    store.showToast('完成生涯模式前 3 关即可解锁暴力淘汰赛');
    return;
  }
  g?.audio.play('click');
  store.setup.mode = id;
  if (id === 'career') store.go('career');
  else if (id === 'endless') {
    store.setup.trackId = 'coast';
    store.go('tracks');
  } else store.go('tracks');
}
</script>

<style scoped>
.dim {
  background: rgba(10, 25, 55, 0.55);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  padding: 4px 4px 12px;
}
.card {
  text-align: left;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.12s;
  font-family: inherit;
  color: var(--c-ink);
}
.card:hover {
  transform: translateY(-3px) scale(1.01);
}
.card.locked {
  opacity: 0.65;
}
.icon {
  font-size: 40px;
}
.name {
  font-size: 20px;
  font-weight: 900;
}
.desc {
  font-size: 14px;
  color: #4a5670;
  flex: 1;
}
.unlock {
  font-size: 13px;
  font-weight: 800;
  color: #c2410c;
}
.tag {
  align-self: flex-start;
}
</style>
