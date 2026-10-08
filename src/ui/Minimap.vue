<template>
  <canvas ref="cv" class="minimap" :width="size" :height="size" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useEngine } from '../core/gameRef';

const size = 150;
const cv = ref<HTMLCanvasElement>();
let raf = 0;
let cache: { key: string; path: Path2D; sc: Path2D[]; tf: (x: number, z: number) => [number, number] } | null = null;

function build() {
  const s = useEngine()?.session;
  if (!s || !s.built) return null;
  const mm = s.built.minimap;
  const b = mm.bounds;
  const w = b.maxX - b.minX;
  const h = b.maxZ - b.minZ;
  const k = (size - 16) / Math.max(w, h);
  const ox = (size - w * k) / 2;
  const oz = (size - h * k) / 2;
  const tf = (x: number, z: number): [number, number] => [ox + (x - b.minX) * k, oz + (z - b.minZ) * k];
  const path = new Path2D();
  mm.main.forEach(([x, z], i) => {
    const [px, pz] = tf(x, z);
    if (i === 0) path.moveTo(px, pz);
    else path.lineTo(px, pz);
  });
  path.closePath();
  const sc = mm.shortcuts.map((arr) => {
    const p = new Path2D();
    arr.forEach(([x, z], i) => {
      const [px, pz] = tf(x, z);
      if (i === 0) p.moveTo(px, pz);
      else p.lineTo(px, pz);
    });
    return p;
  });
  return { key: s.cfg.id, path, sc, tf };
}

function draw() {
  raf = requestAnimationFrame(draw);
  const s = useEngine()?.session;
  const c = cv.value;
  if (!s || !c) return;
  const ctx = c.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(10,20,40,0.45)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  if (s.mode === 'endless') {
    // 无尽模式：以玩家为中心的局部地图
    const p = s.player;
    const road = s.world.track.main;
    const sc = 0.18;
    const cosY = Math.cos(p.yaw);
    const sinY = Math.sin(p.yaw);
    const tf = (x: number, z: number): [number, number] => {
      const dx = x - p.pos.x;
      const dz = z - p.pos.z;
      const lx = dx * cosY - dz * sinY;
      const lz = dx * sinY + dz * cosY;
      return [size / 2 - lx * sc, size / 2 + 20 - lz * sc];
    };
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let d = -150; d < 600; d += 10) {
      const pt = road.pointAt(p.ground.mainS + d);
      const [x, y] = tf(pt.x, pt.z);
      if (d === -150) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (const r of s.racers) {
      if (r.state === 'eliminated') continue;
      const [x, y] = tf(r.pos.x, r.pos.z);
      ctx.fillStyle = r.isPlayer ? '#ffd23f' : '#ff4d4d';
      ctx.beginPath();
      ctx.arc(x, y, r.isPlayer ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (!cache || cache.key !== s.cfg.id) cache = build();
  if (!cache) return;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  ctx.stroke(cache.path);
  ctx.strokeStyle = 'rgba(255,210,63,0.9)';
  ctx.setLineDash([3, 3]);
  ctx.lineWidth = 3;
  for (const p of cache.sc) ctx.stroke(p);
  ctx.setLineDash([]);
  // 起点
  const st = s.world.track.main.pointAt(0);
  const [sx, sz] = cache.tf(st.x, st.z);
  ctx.fillStyle = '#111';
  ctx.fillRect(sx - 4, sz - 4, 8, 8);
  ctx.fillStyle = '#fff';
  ctx.fillRect(sx - 4, sz - 4, 4, 4);
  ctx.fillRect(sx, sz, 4, 4);
  const sorted = [...s.racers].sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  for (const r of sorted) {
    if (r.state === 'eliminated') continue;
    const [x, z] = cache.tf(r.pos.x, r.pos.z);
    ctx.fillStyle = r.isPlayer ? '#ffd23f' : '#ff4d4d';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, z, r.isPlayer ? 5.5 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

onMounted(() => (raf = requestAnimationFrame(draw)));
onUnmounted(() => cancelAnimationFrame(raf));
</script>

<style scoped>
.minimap {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  pointer-events: none;
}
@media (max-height: 500px) {
  .minimap {
    width: 104px;
    height: 104px;
  }
}
</style>
