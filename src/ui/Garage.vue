<template>
  <div class="screen sel-screen">
    <div class="screen-header">
      <button class="btn gray small" @click="back">← 返回</button>
      <div class="screen-title">摩托车库</div>
      <div class="tabs">
        <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.name }}</button>
      </div>
      <div class="coin-badge">🪙 {{ store.save.coins }}</div>
    </div>
    <div class="layout">
      <!-- 摩托 -->
      <template v-if="tab === 'bikes'">
        <div class="list scroll">
          <button v-for="b in MOTORCYCLES" :key="b.id" class="item" :class="{ sel: cur.id === b.id }" @click="pick(b.id)">
            <span class="dot" :style="{ background: hex(b.color) }" />
            <span class="nm">{{ b.name }}</span>
            <span v-if="!owned(b.id)" class="price">🪙{{ b.price }}</span>
            <span v-else-if="store.save.equippedMotorcycle === b.id" class="tag">使用中</span>
          </button>
        </div>
        <div class="spacer" />
        <div class="detail panel">
          <div class="title">{{ cur.name }} <span class="tag">{{ cur.special }}</span></div>
          <div class="desc">{{ cur.desc }}</div>
          <div class="ratings">速度 <b>{{ cur.ratings.speed }}</b> · 操控 <b>{{ cur.ratings.handling }}</b> · 防御 <b>{{ cur.ratings.defense }}</b></div>
          <div class="stats">
            <div v-for="s in statRows" :key="s.k" class="st">
              <span>{{ s.label }}</span>
              <div class="stat-bar"><i :style="{ width: s.pct(curStats) + '%' }" /></div>
            </div>
          </div>
          <div class="actions">
            <button v-if="!owned(cur.id)" class="btn" @click="store.buyBike(cur.id)">🪙 {{ cur.price }} 购买</button>
            <button v-else-if="store.save.equippedMotorcycle !== cur.id" class="btn green" @click="store.equipBike(cur.id)">选用</button>
            <button v-else class="btn gray" disabled>已选用</button>
          </div>
        </div>
      </template>

      <!-- 升级 -->
      <template v-else-if="tab === 'upgrade'">
        <div class="spacer" />
        <div class="detail panel wide">
          <div class="title">升级 {{ equipped.name }}</div>
          <div class="desc">性能升级在快速比赛、生涯、淘汰赛等模式生效（计时挑战使用原厂性能，保证公平）。</div>
          <div v-for="(name, key) in UPGRADE_NAMES" :key="key" class="up-row">
            <div class="up-name">{{ name }}</div>
            <div class="pips">
              <i v-for="n in MAX_UPGRADE" :key="n" :class="{ on: lvl(key) >= n }" />
            </div>
            <button v-if="lvl(key) < MAX_UPGRADE" class="btn small" @click="store.upgrade(equipped.id, key)">🪙 {{ upgradeCost(lvl(key)) }}</button>
            <span v-else class="tag">已满级</span>
          </div>
        </div>
      </template>

      <!-- 外观 -->
      <template v-else>
        <div class="slots scroll">
          <button v-for="(name, slot) in SLOT_NAMES" :key="slot" class="item" :class="{ sel: curSlot === slot }" @click="curSlot = slot">
            <span class="nm">{{ name }}</span>
            <span class="tag">{{ getCosmetic(store.save.equippedCosmetics[slot])?.name }}</span>
          </button>
        </div>
        <div class="spacer" />
        <div class="detail panel">
          <div class="title">{{ SLOT_NAMES[curSlot] }}</div>
          <div class="opts scroll">
            <button
              v-for="c in cosmeticsForSlot(curSlot)"
              :key="c.id"
              class="opt"
              :class="{ on: store.save.equippedCosmetics[curSlot] === c.id }"
              @click="buyCos(c.id)"
            >
              <span v-if="c.color !== undefined" class="sw" :style="{ background: hex(c.color) }" />
              <span class="nm">{{ c.name }}</span>
              <span v-if="!store.save.ownedCosmetics.includes(c.id)" class="price">🪙{{ c.price }}</span>
              <span v-else-if="store.save.equippedCosmetics[curSlot] === c.id">✔</span>
            </button>
          </div>
          <div class="desc">点击即可购买并装备。喇叭声音可在比赛中按 H 键（触控为喇叭按钮）播放。</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useGameStore, Screen } from '../stores/game';
import { MOTORCYCLES, getMotorcycle, applyUpgrades, MAX_UPGRADE, UPGRADE_NAMES, upgradeCost, MotorcycleStats, UpgradeLevels } from '../data/motorcycles';
import { SLOT_NAMES, cosmeticsForSlot, getCosmetic, CosmeticSlot } from '../data/cosmetics';
import { hex } from '../utils/materials';
import { useEngine } from '../core/gameRef';

const store = useGameStore();
const tabs = [
  { id: 'bikes', name: '摩托' },
  { id: 'upgrade', name: '性能升级' },
  { id: 'look', name: '外观定制' },
] as const;
const tab = ref<'bikes' | 'upgrade' | 'look'>('bikes');
const returnTo = ref<Screen>('menu');
const selId = ref(store.save.equippedMotorcycle);
const cur = computed(() => getMotorcycle(selId.value));
const equipped = computed(() => getMotorcycle(store.save.equippedMotorcycle));
const curStats = computed(() => applyUpgrades(cur.value.stats, store.save.upgrades[cur.value.id]));
const curSlot = ref<CosmeticSlot>('bodyColor');
const owned = (id: string) => store.save.unlockedMotorcycles.includes(id);
const lvl = (k: keyof UpgradeLevels) => store.save.upgrades[equipped.value.id]?.[k] ?? 0;
const statRows: { k: string; label: string; pct: (s: MotorcycleStats) => number }[] = [
  { k: 'maxSpeed', label: '极速', pct: (s) => ((s.maxSpeed - 36) / 16) * 100 },
  { k: 'acceleration', label: '加速', pct: (s) => ((s.acceleration - 12) / 14) * 100 },
  { k: 'handling', label: '操控', pct: (s) => ((s.handling - 1.2) / 1.8) * 100 },
  { k: 'braking', label: '刹车', pct: (s) => ((s.braking - 20) / 16) * 100 },
  { k: 'durability', label: '耐久', pct: (s) => (s.durability / 12) * 100 },
  { k: 'impactPower', label: '冲撞', pct: (s) => (s.impactPower / 12) * 100 },
  { k: 'nitroCapacity', label: '氮气', pct: (s) => ((s.nitroCapacity - 60) / 140) * 100 },
];

onMounted(() => {
  returnTo.value = ['tracks', 'career'].includes(store.prevScreen) ? store.prevScreen : 'menu';
  const g = useEngine();
  g?.setMenuView('turntable');
  g?.refreshPreview(undefined, selId.value);
});
onUnmounted(() => useEngine()?.clearPreview());
watch(
  () => [selId.value, tab.value, JSON.stringify(store.save.equippedCosmetics)],
  () => useEngine()?.refreshPreview(undefined, tab.value === 'bikes' ? selId.value : store.save.equippedMotorcycle),
);

function pick(id: string) {
  selId.value = id;
  useEngine()?.audio.play('click');
}
function buyCos(id: string) {
  store.buyCosmetic(id);
  const c = getCosmetic(id);
  const g = useEngine();
  if (c?.slot === 'horn' && store.save.ownedCosmetics.includes(id)) {
    g?.unlockAudio();
    g?.audio.play('horn', { horn: c.style });
  }
}
function back() {
  store.go(returnTo.value);
}
</script>

<style scoped>
.sel-screen {
  background: linear-gradient(90deg, rgba(10, 25, 55, 0.6), rgba(10, 25, 55, 0) 40%);
}
.tabs {
  display: flex;
  gap: 6px;
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
.layout {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}
.list,
.slots {
  width: 230px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  width: 18px;
  height: 18px;
  border-radius: 6px;
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
  width: 340px;
  align-self: flex-end;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 100%;
}
.detail.wide {
  width: 420px;
}
.title {
  font-size: 22px;
  font-weight: 900;
}
.desc {
  font-size: 13px;
  color: #4a5670;
}
.ratings {
  font-size: 14px;
}
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 14px;
}
.st {
  font-size: 12px;
  font-weight: 800;
  color: #4a5670;
}
.actions {
  display: flex;
  gap: 8px;
}
.up-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.up-name {
  flex: 1;
  font-weight: 800;
}
.pips {
  display: flex;
  gap: 4px;
}
.pips i {
  width: 18px;
  height: 12px;
  border-radius: 4px;
  background: #d6dbe4;
}
.pips i.on {
  background: var(--c-primary);
}
.opts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  max-height: 220px;
}
.opt {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  background: #eef2f8;
  font-family: inherit;
  font-weight: 800;
  font-size: 13px;
  border: 3px solid transparent;
  color: var(--c-ink);
}
.opt.on {
  border-color: var(--c-green);
  background: #fff;
}
.sw {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.15);
}
@media (max-width: 760px) {
  .list,
  .slots {
    width: 170px;
  }
  .detail {
    width: 270px;
  }
}
</style>
