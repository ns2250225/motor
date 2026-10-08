<template>
  <div class="rider-bar panel">
    <div class="who">
      <div class="lbl">鹈鹕</div>
      <div class="val">{{ pelican.name }}</div>
      <button class="btn small green" @click="store.go('pelicans')">更换</button>
    </div>
    <div class="who">
      <div class="lbl">摩托</div>
      <div class="val">{{ bike.name }}</div>
      <button class="btn small green" @click="store.go('garage')">更换</button>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/game';
import { getPelican } from '../data/pelicans';
import { getMotorcycle } from '../data/motorcycles';

const store = useGameStore();
const pelican = computed(() => getPelican(store.save.equippedPelican));
const bike = computed(() => getMotorcycle(store.save.equippedMotorcycle));
</script>

<style scoped>
.rider-bar {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 10px 14px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.who {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lbl {
  font-size: 12px;
  font-weight: 800;
  color: #7a849a;
}
.val {
  font-weight: 900;
  font-size: 16px;
}
</style>
