<template>
  <div class="screen res" v-if="r">
    <div class="screen-header">
      <div class="screen-title">{{ title }}</div>
      <div class="coin-badge">🪙 {{ store.save.coins }}</div>
    </div>
    <div class="cols">
      <div class="panel left scroll">
        <div class="h">{{ r.trackName }} · {{ modeName }}</div>
        <table v-if="r.mode !== 'endless' && r.mode !== 'timetrial'">
          <tr v-for="row in r.rows" :key="row.name + row.place" :class="{ me: row.isPlayer }">
            <td class="pl">{{ row.place }}</td>
            <td class="nm">{{ row.name }}<span class="sub"> · {{ row.pelican }} / {{ row.bike }}</span></td>
            <td class="tm">{{ row.eliminated ? '已淘汰' : formatTime(row.time) + (row.estimated ? '*' : '') }}</td>
            <td class="ko">💥{{ row.kos }}</td>
          </tr>
        </table>
        <div v-else class="big-stat">
          <template v-if="r.mode === 'endless'">
            <div>行驶 <b>{{ (r.distance / 1000).toFixed(2) }}</b> 公里</div>
            <div>得分 <b>{{ r.score }}</b></div>
            <div class="sub">最佳纪录 {{ (store.save.stats.endlessBest / 1000).toFixed(2) }} 公里</div>
          </template>
          <template v-else>
            <div>完成时间 <b>{{ formatTime(r.time) }}</b></div>
            <div>最快单圈 <b>{{ formatTime(r.bestLap) }}</b> <span v-if="r.newRecord" class="rec">新纪录！</span></div>
          </template>
        </div>
        <div class="note" v-if="r.rows.some((x) => x.estimated)">* 为根据剩余距离估算的完成时间</div>
      </div>
      <div class="panel right scroll">
        <div v-if="r.mode === 'career'" class="stars">
          <span v-for="i in 3" :key="i" :class="{ on: r.stars >= i, new: r.stars >= i && r.prevStars < i }">★</span>
        </div>
        <div v-if="r.mode === 'career'" class="chal" :class="{ ok: r.challengeDone }">额外挑战：{{ r.challenge }} {{ r.challengeDone ? '✓' : '✗' }}</div>
        <div class="grid">
          <div v-if="r.mode !== 'endless'"><span>最终名次</span><b>{{ r.mode === 'timetrial' ? '—' : r.place }}</b></div>
          <div><span>完成时间</span><b>{{ formatTime(r.time) }}</b></div>
          <div v-if="r.mode !== 'endless'"><span>最快单圈</span><b>{{ formatTime(r.bestLap) }}</b></div>
          <div><span>攻击命中</span><b>{{ r.hits }}</b></div>
          <div><span>击倒对手</span><b>{{ r.kos }}</b></div>
          <div><span>漂移距离</span><b>{{ Math.floor(r.drift) }} 米</b></div>
          <div><span>空中特技</span><b>{{ r.tricks }}</b></div>
          <div><span>摔车次数</span><b>{{ r.crashes }}</b></div>
        </div>
        <div class="coins">
          <div v-for="b in r.breakdown" :key="b.label" class="cl"><span>{{ b.label }}</span><b>+{{ b.amount }}</b></div>
          <div class="total"><span>获得金币</span><b>🪙 +{{ shown }}</b></div>
        </div>
        <div v-if="r.unlocks.length" class="unlocks">
          <div class="uh">🎉 解锁内容</div>
          <div v-for="u in r.unlocks" :key="u">{{ u }}</div>
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="btn blue" @click="again">↻ 再来一次</button>
      <button v-if="nextLevel" class="btn green" @click="next">下一关：{{ nextLevel.name }} →</button>
      <button class="btn gray" @click="menu">⌂ 返回菜单</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useGameStore } from '../stores/game';
import { useEngine } from '../core/gameRef';
import { formatTime } from '../utils/math';
import { MODES, CAREER, careerIndex, careerUnlocked } from '../data/career';
import { getTrack } from '../tracks/TrackConfig';

const store = useGameStore();
const r = computed(() => store.results);
const shown = ref(0);
const modeName = computed(() => MODES.find((m) => m.id === r.value?.mode)?.name ?? '');
const title = computed(() => {
  const x = r.value;
  if (!x) return '';
  if (x.mode === 'endless') return '旅程结束';
  if (x.mode === 'timetrial') return x.newRecord ? '刷新纪录！' : '计时完成';
  if (x.place === 1) return '🏆 冠军！';
  if (x.place <= 3) return `第 ${x.place} 名！`;
  return `第 ${x.place} 名`;
});
const nextLevel = computed(() => {
  const x = r.value;
  if (!x || x.mode !== 'career') return null;
  const i = careerIndex(x.trackId);
  const n = CAREER[i + 1];
  if (!n || !careerUnlocked(store.save.careerProgress, i + 1)) return null;
  return getTrack(n.trackId);
});

onMounted(() => {
  const g = useEngine();
  g?.endSession();
  g?.menu.activate();
  g?.setMenuView('ride');
  const target = r.value?.coins ?? 0;
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / 1200);
    shown.value = Math.round(target * k);
    if (k < 1) requestAnimationFrame(tick);
    else g?.audio.play('coin');
  };
  tick();
});

function again() {
  useEngine()?.startRace({ ...store.setup });
}
function next() {
  if (!nextLevel.value) return;
  store.setup.trackId = nextLevel.value.id;
  store.go('career');
}
function menu() {
  useEngine()?.toMenu();
}
</script>

<style scoped>
.res {
  background: rgba(10, 25, 55, 0.6);
}
.cols {
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
}
.left,
.right {
  flex: 1;
  padding: 14px 16px;
}
.h {
  font-weight: 900;
  font-size: 18px;
  margin-bottom: 6px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
tr {
  border-bottom: 1px solid #e6eaf1;
}
tr.me {
  background: #fff3c4;
  font-weight: 900;
}
td {
  padding: 5px 4px;
}
.pl {
  font-weight: 900;
  font-size: 18px;
  width: 30px;
  text-align: center;
}
.sub {
  color: #8a93a6;
  font-size: 12px;
  font-weight: 600;
}
.tm {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.ko {
  text-align: right;
  width: 46px;
}
.big-stat {
  font-size: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
}
.rec {
  color: #e8423f;
  font-weight: 900;
}
.note {
  font-size: 11px;
  color: #8a93a6;
  margin-top: 6px;
}
.stars {
  text-align: center;
  font-size: 46px;
  color: #d6dbe4;
  letter-spacing: 8px;
}
.stars .on {
  color: #ffb800;
}
.stars .new {
  animation: starpop 0.6s;
  display: inline-block;
}
@keyframes starpop {
  from {
    transform: scale(2.5) rotate(-60deg);
    opacity: 0;
  }
}
.chal {
  text-align: center;
  font-weight: 800;
  color: #8a93a6;
  margin-bottom: 6px;
}
.chal.ok {
  color: #23964c;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 16px;
  font-size: 14px;
}
.grid div {
  display: flex;
  justify-content: space-between;
}
.grid span {
  color: #7a849a;
  font-weight: 700;
}
.coins {
  margin-top: 10px;
  border-top: 2px dashed #e0e5ee;
  padding-top: 8px;
  font-size: 13px;
}
.cl {
  display: flex;
  justify-content: space-between;
  color: #4a5670;
}
.cl b {
  color: #c27c00;
}
.total {
  display: flex;
  justify-content: space-between;
  font-size: 20px;
  font-weight: 900;
  margin-top: 6px;
  color: #c27c00;
}
.unlocks {
  margin-top: 8px;
  background: #ecfdf3;
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 700;
  color: #23964c;
}
.uh {
  font-weight: 900;
}
.actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 10px;
  flex-wrap: wrap;
}
@media (max-width: 700px) {
  .cols {
    flex-direction: column;
    overflow-y: auto;
  }
}
</style>
