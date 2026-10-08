<template>
  <div class="screen dim">
    <div class="screen-header">
      <button class="btn gray small" @click="store.go('menu')">← 返回</button>
      <div class="screen-title">游戏设置</div>
    </div>
    <div class="cols scroll">
      <div class="panel box">
        <div class="h">声音与画面</div>
        <label class="row">音乐音量 <input type="range" min="0" max="1" step="0.05" v-model.number="st.musicVolume" @input="apply" /> {{ Math.round(st.musicVolume * 100) }}</label>
        <label class="row">音效音量 <input type="range" min="0" max="1" step="0.05" v-model.number="st.soundVolume" @input="apply" /> {{ Math.round(st.soundVolume * 100) }}</label>
        <div class="row">
          画面质量
          <div class="seg">
            <button v-for="q in qualities" :key="q.v" :class="{ on: st.graphicsQuality === q.v }" @click="setQuality(q.v)">{{ q.n }}</button>
          </div>
        </div>
        <div class="row">
          镜头模式
          <div class="seg">
            <button v-for="c in cams" :key="c.v" :class="{ on: st.cameraMode === c.v }" @click="st.cameraMode = c.v; apply()">{{ c.n }}</button>
          </div>
        </div>
        <label class="row chk"><input type="checkbox" v-model="st.showFps" @change="apply" /> 显示帧率</label>
        <div class="row">
          速度单位
          <div class="seg">
            <button :class="{ on: st.speedUnit === 'kmh' }" @click="st.speedUnit = 'kmh'; apply()">km/h</button>
            <button :class="{ on: st.speedUnit === 'mph' }" @click="st.speedUnit = 'mph'; apply()">mph</button>
          </div>
        </div>
      </div>
      <div class="panel box">
        <div class="h">操作与难度</div>
        <div class="row">
          AI 难度
          <div class="seg">
            <button v-for="d in diffs" :key="d.v" :class="{ on: st.difficulty === d.v }" @click="st.difficulty = d.v; apply()">{{ d.n }}</button>
          </div>
        </div>
        <label class="row chk"><input type="checkbox" v-model="st.autoAccelerate" @change="apply" /> 自动加速（触控操作时，专注转向与战斗）</label>
        <div class="row">
          触控布局
          <div class="seg">
            <button :class="{ on: st.touchLayout === 'buttons' }" @click="st.touchLayout = 'buttons'; apply()">左右按钮</button>
            <button :class="{ on: st.touchLayout === 'joystick' }" @click="st.touchLayout = 'joystick'; apply()">虚拟摇杆</button>
          </div>
        </div>
        <label class="row">按钮大小 <input type="range" min="0.7" max="1.4" step="0.05" v-model.number="st.buttonScale" @input="apply" /> {{ Math.round(st.buttonScale * 100) }}%</label>
        <label class="row chk"><input type="checkbox" v-model="st.vibration" @change="apply" /> 震动反馈（支持的设备）</label>
        <div class="keys">
          <b>键盘：</b>W/↑ 加速 · S/↓ 刹车 · A/← D/→ 转向 · 空格 漂移（空中按下做特技） · Shift 氮气 · J 左翅 · K 右翅 · L 大嘴啄击 · U 大嘴横扫 · I 大嘴夹击 · Q 超级鹈鹕冲刺 · E
          使用道具 · H 喇叭 · R 复位 · C 切换镜头 · Esc 暂停
          <br /><b>手柄：</b>RT 油门 · LT 刹车 · 摇杆转向 · A 漂移 · B 氮气 · X 道具 · Y 大嘴 · LB/RB 翅膀 · Start 暂停
        </div>
      </div>
      <div class="panel box">
        <div class="h">存档管理</div>
        <div class="desc">存档保存在本机浏览器（IndexedDB），无需注册。可导出备份文件，换设备后导入。</div>
        <div class="btns">
          <button class="btn blue small" @click="exportSave">⬇️ 导出存档</button>
          <button class="btn green small" @click="fileInput?.click()">⬆️ 导入存档</button>
          <button class="btn red small" @click="resetSave">🗑️ 重置存档</button>
          <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="importSave" />
        </div>
        <div class="desc">存档版本 v{{ store.save.version }} · 上次保存 {{ new Date(store.save.savedAt).toLocaleString() }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useGameStore } from '../stores/game';
import { SaveSystem, Settings } from '../systems/SaveSystem';
import { useEngine } from '../core/gameRef';

const store = useGameStore();
const st = store.save.settings;
const fileInput = ref<HTMLInputElement>();
const qualities: { v: Settings['graphicsQuality']; n: string }[] = [
  { v: 'auto', n: '自动' },
  { v: 'low', n: '低' },
  { v: 'medium', n: '中' },
  { v: 'high', n: '高' },
];
const cams: { v: Settings['cameraMode']; n: string }[] = [
  { v: 'chase', n: '追尾' },
  { v: 'near', n: '近距离' },
  { v: 'far', n: '远距离' },
];
const diffs: { v: Settings['difficulty']; n: string }[] = [
  { v: 'easy', n: '简单' },
  { v: 'normal', n: '普通' },
  { v: 'hard', n: '困难' },
];

function apply() {
  useEngine()?.applySettings(st);
  store.persist();
}
function setQuality(q: Settings['graphicsQuality']) {
  st.graphicsQuality = q;
  useEngine()?.setQuality(q);
  apply();
}
function exportSave() {
  SaveSystem.exportFile(JSON.parse(JSON.stringify(store.save)));
}
async function importSave(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const s = await SaveSystem.importFile(f);
    Object.assign(store.save, s);
    await SaveSystem.save(s);
    useEngine()?.applySettings(store.save.settings);
    useEngine()?.clearPreview();
    store.showToast('存档导入成功！');
  } catch (err) {
    store.showToast('导入失败：' + (err as Error).message);
  }
  (e.target as HTMLInputElement).value = '';
}
async function resetSave() {
  if (!confirm('确定要重置存档吗？所有进度、金币和解锁内容都会清空，且无法恢复。')) return;
  const s = await SaveSystem.reset();
  Object.assign(store.save, s);
  useEngine()?.applySettings(store.save.settings);
  useEngine()?.clearPreview();
  store.showToast('存档已重置');
}
</script>

<style scoped>
.dim {
  background: rgba(10, 25, 55, 0.65);
}
.cols {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 12px;
  align-content: start;
  padding: 4px;
}
.box {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.h {
  font-weight: 900;
  font-size: 18px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  font-size: 14px;
}
.row input[type='range'] {
  flex: 1;
  accent-color: var(--c-primary);
}
.chk input {
  width: 18px;
  height: 18px;
  accent-color: var(--c-primary);
}
.seg {
  display: flex;
  margin-left: auto;
  border-radius: 10px;
  overflow: hidden;
  border: 2px solid #d6dbe4;
}
.seg button {
  padding: 6px 12px;
  font-weight: 800;
  background: #fff;
  color: var(--c-ink);
}
.seg button.on {
  background: var(--c-primary);
  color: #fff;
}
.keys {
  font-size: 12px;
  color: #4a5670;
  line-height: 1.6;
}
.desc {
  font-size: 13px;
  color: #4a5670;
}
.btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
