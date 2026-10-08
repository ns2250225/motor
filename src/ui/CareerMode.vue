<template>
  <div class="screen dim">
    <div class="screen-header">
      <button class="btn gray small" @click="store.go('mode')">← 返回</button>
      <div class="screen-title">生涯模式</div>
      <div class="total">⭐ {{ totalStars }} / {{ CAREER.length * 3 }}</div>
      <div class="coin-badge">🪙 {{ store.save.coins }}</div>
    </div>
    <div class="list scroll">
      <button
        v-for="(lv, i) in CAREER"
        :key="lv.trackId"
        class="level panel"
        :class="{ sel: sel === i, locked: !careerUnlocked(store.save.careerProgress, i) }"
        @click="select(i)"
      >
        <div class="idx">{{ i + 1 }}</div>
        <div class="main">
          <div class="name">{{ trackById(lv.trackId).name }}</div>
          <div class="goals">
            <span :class="{ ok: stars(lv.trackId) >= 1 }">★ 完成比赛</span>
            <span :class="{ ok: stars(lv.trackId) >= 2 }">★ 获得前三名</span>
            <span :class="{ ok: stars(lv.trackId) >= 3 }">★ 第一名 + {{ lv.challenge.desc }}</span>
          </div>
        </div>
        <div class="right">
          <div class="st">{{ '★'.repeat(stars(lv.trackId)) }}<span class="empty">{{ '★'.repeat(3 - stars(lv.trackId)) }}</span></div>
          <div class="reward">奖励 🪙{{ lv.reward }}</div>
          <div v-if="!careerUnlocked(store.save.careerProgress, i)" class="lock">🔒 完成上一关解锁</div>
        </div>
      </button>
      <div class="note">完成生涯前 3 关解锁「暴力淘汰赛」；每关首次获得一星时解锁下一条赛道。</div>
    </div>
    <RiderBar>
      <button class="btn start" :disabled="!careerUnlocked(store.save.careerProgress, sel)" @click="start">🏁 挑战第 {{ sel + 1 }} 关</button>
    </RiderBar>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useGameStore } from '../stores/game';
import { CAREER, careerUnlocked, trackById, careerIndex } from '../data/career';
import { useEngine } from '../core/gameRef';
import RiderBar from './RiderBar.vue';

const store = useGameStore();
const stars = (id: string) => store.save.careerProgress[id] ?? 0;
const totalStars = computed(() => CAREER.reduce((a, c) => a + stars(c.trackId), 0));
const firstOpen = () => {
  for (let i = 0; i < CAREER.length; i++) if (careerUnlocked(store.save.careerProgress, i) && stars(CAREER[i].trackId) < 3) return i;
  return 0;
};
const sel = ref(store.setup.mode === 'career' && careerIndex(store.setup.trackId) >= 0 ? careerIndex(store.setup.trackId) : firstOpen());
onMounted(() => {
  store.setup.mode = 'career';
  useEngine()?.setMenuView('ride');
});
function select(i: number) {
  useEngine()?.audio.play('click');
  sel.value = i;
  store.setup.trackId = CAREER[i].trackId;
}
function start() {
  store.setup.mode = 'career';
  store.setup.trackId = CAREER[sel.value].trackId;
  useEngine()?.startRace({ ...store.setup });
}
</script>

<style scoped>
.dim {
  background: rgba(10, 25, 55, 0.55);
}
.total {
  color: #ffd23f;
  font-weight: 900;
  font-size: 20px;
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.4);
}
.list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px;
}
.level {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  text-align: left;
  font-family: inherit;
  color: var(--c-ink);
  border: 4px solid transparent;
}
.level.sel {
  border-color: var(--c-primary);
}
.level.locked {
  opacity: 0.6;
}
.idx {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--c-blue);
  color: #fff;
  font-weight: 900;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.main {
  flex: 1;
}
.name {
  font-weight: 900;
  font-size: 18px;
}
.goals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 13px;
  color: #8a93a6;
}
.goals .ok {
  color: #e08a00;
  font-weight: 800;
}
.right {
  text-align: right;
}
.st {
  color: #ffb800;
  font-size: 24px;
  letter-spacing: 2px;
}
.st .empty {
  color: #d6dbe4;
}
.reward {
  font-size: 12px;
  font-weight: 800;
  color: #7a849a;
}
.lock {
  font-size: 12px;
  color: #c2410c;
  font-weight: 800;
}
.note {
  color: #fff;
  font-size: 13px;
  opacity: 0.85;
  padding: 4px;
}
.start {
  margin-left: auto;
  font-size: 19px;
}
</style>
