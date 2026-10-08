import type { AudioSystem } from './AudioSystem';
import { seededRandom, hashString } from '../utils/math';

interface Theme {
  bpm: number;
  root: number; // MIDI
  scale: number[];
  chords: number[]; // 每小节和弦根音（音阶级数）
  bass: string; // 16 步：x=根音 o=五度 .=休止 -=八度
  kick: string;
  snare: string;
  hat: string;
  lead: OscillatorType | 'pluck';
  leadDensity: number;
  tremolo?: boolean;
  swing?: number;
  pad?: boolean;
  distort?: boolean;
  skank?: boolean;
  arp?: boolean;
  bongo?: boolean;
}

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const MIN = [0, 2, 3, 5, 7, 8, 10];
const PENTA = [0, 2, 4, 7, 9];
const MINPENTA = [0, 3, 5, 7, 10];

/** 各赛道音乐主题：海滨冲浪摇滚、霓虹电子、沙漠西部摇滚…… */
const THEMES: Record<string, Theme> = {
  menu: { bpm: 122, root: 60, scale: MAJ, chords: [0, 5, 3, 4], bass: 'x.x.o.x.x.x.o.-.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', lead: 'pluck', leadDensity: 0.45, swing: 0.1 },
  surf: { bpm: 162, root: 57, scale: MIN, chords: [0, 0, 3, 4], bass: 'x.x.x.x.o.o.x.x.', kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', lead: 'square', leadDensity: 0.6, tremolo: true },
  synth: { bpm: 128, root: 57, scale: MIN, chords: [0, 5, 2, 6], bass: 'x.xx.xx.x.xx.xx.', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', lead: 'sawtooth', leadDensity: 0.5, arp: true, pad: true },
  western: { bpm: 138, root: 52, scale: MIN, chords: [0, 0, 5, 4], bass: 'x..o..x..o..x.o.', kick: 'x.....x.x.....x.', snare: '....x.......x...', hat: 'x..x..x..x..x..x', lead: 'pluck', leadDensity: 0.5, swing: 0.2 },
  alpine: { bpm: 134, root: 62, scale: MAJ, chords: [0, 4, 0, 4], bass: 'x...o...x...o...', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', lead: 'triangle', leadDensity: 0.55 },
  jungle: { bpm: 148, root: 55, scale: PENTA, chords: [0, 3, 0, 4], bass: 'x..x..x...x..x..', kick: 'x..x....x..x....', snare: '......x.......x.', hat: 'x.xxx.xxx.xxx.xx', lead: 'pluck', leadDensity: 0.6, bongo: true },
  metal: { bpm: 172, root: 40, scale: MIN, chords: [0, 0, 5, 6], bass: 'xxxxxxxxxxxxxxxx', kick: 'xxxxxxxxxxxxxxxx', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', lead: 'sawtooth', leadDensity: 0.45, distort: true },
  ska: { bpm: 150, root: 60, scale: MAJ, chords: [0, 3, 4, 3], bass: 'x.o.x.o.x.o.-.o.', kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.', lead: 'square', leadDensity: 0.4, skank: true },
  country: { bpm: 128, root: 55, scale: MAJ, chords: [0, 3, 4, 0], bass: 'x...o...x...o...', kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.xx.xx.x.xx.xx.', lead: 'pluck', leadDensity: 0.65, swing: 0.25 },
  dream: { bpm: 116, root: 64, scale: MAJ, chords: [0, 5, 3, 4], bass: 'x.......o.......', kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.', lead: 'triangle', leadDensity: 0.35, pad: true, arp: true },
  space: { bpm: 108, root: 57, scale: MINPENTA, chords: [0, 3, 4, 0], bass: 'x.......x...o...', kick: 'x.........x.....', snare: '........x.......', hat: '....x.......x...', lead: 'sine', leadDensity: 0.3, pad: true },
};

/** 程序化背景音乐：前瞻调度的步进音序器 */
export class MusicSystem {
  private theme: Theme | null = null;
  private themeId = '';
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private melody: (number | null)[] = [];
  private bus: GainNode | null = null;
  private intensity = 1;

  constructor(private audio: AudioSystem) {}

  play(id: string) {
    if (this.themeId === id && this.timer !== null) return;
    this.stop();
    const ctx = this.audio.ctx;
    if (!ctx) {
      this.themeId = id;
      return;
    }
    this.theme = THEMES[id] ?? THEMES.menu;
    this.themeId = id;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.setTargetAtTime(1, ctx.currentTime, 0.5);
    if (this.theme.distort) {
      // 失真只作用于主音
    }
    this.bus.connect(this.audio.musicGain);
    // 生成可复现的旋律（4 小节 × 16 步）
    const rnd = seededRandom(hashString(id));
    this.melody = [];
    let deg = 4;
    for (let i = 0; i < 64; i++) {
      if (rnd() < this.theme.leadDensity && (i % 2 === 0 || rnd() < 0.3)) {
        deg = Math.max(0, Math.min(this.theme.scale.length * 2 - 1, deg + Math.floor(rnd() * 5) - 2));
        this.melody.push(deg);
      } else this.melody.push(null);
    }
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  /** 已初始化音频后恢复之前请求的主题 */
  resumeTheme() {
    if (this.themeId && this.timer === null) {
      const id = this.themeId;
      this.themeId = '';
      this.play(id);
    }
  }

  setIntensity(v: number) {
    this.intensity = v;
  }

  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    if (this.bus && this.audio.ctx) {
      const b = this.bus;
      b.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.2);
      setTimeout(() => b.disconnect(), 1200);
    }
    this.bus = null;
  }

  private note(midi: number) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private degToMidi(deg: number, octave = 0) {
    const sc = this.theme!.scale;
    const o = Math.floor(deg / sc.length);
    return this.theme!.root + sc[((deg % sc.length) + sc.length) % sc.length] + 12 * (o + octave);
  }

  private schedule() {
    const ctx = this.audio.ctx;
    if (!ctx || !this.theme || !this.bus) return;
    if (ctx.state !== 'running') {
      this.nextTime = ctx.currentTime + 0.1;
      return;
    }
    const th = this.theme;
    const stepDur = 60 / th.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      let t = this.nextTime;
      const s = this.step % 16;
      if (th.swing && s % 2 === 1) t += stepDur * th.swing;
      this.playStep(t, s, Math.floor(this.step / 16) % 4, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private env(t: number, dur: number, vol: number, attack = 0.005) {
    const g = this.audio.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.bus!);
    return g;
  }

  private osc(type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode) {
    const o = this.audio.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noise(t: number, dur: number, vol: number, type: BiquadFilterType, freq: number) {
    const ctx = this.audio.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.audio.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    s.connect(f);
    f.connect(this.env(t, dur, vol, 0.001));
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  private playStep(t: number, s: number, bar: number, stepDur: number) {
    const th = this.theme!;
    const ctx = this.audio.ctx!;
    const chordDeg = th.chords[bar];
    const I = this.intensity;
    // 鼓
    if (th.kick[s] === 'x') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      o.connect(this.env(t, 0.2, 0.55 * I, 0.002));
      o.start(t);
      o.stop(t + 0.25);
    }
    if (th.snare[s] === 'x') {
      this.noise(t, 0.15, 0.25 * I, 'highpass', 1500);
      this.osc('triangle', 190, t, 0.1, this.env(t, 0.1, 0.15 * I));
    }
    if (th.hat[s] === 'x') this.noise(t, 0.04, 0.07 * I, 'highpass', 7000);
    if (th.bongo && (s === 3 || s === 7 || s === 10 || s === 14)) this.osc('sine', s % 7 === 3 ? 320 : 240, t, 0.12, this.env(t, 0.12, 0.2));
    // 贝斯
    const b = th.bass[s];
    if (b !== '.') {
      const base = this.degToMidi(chordDeg, -2);
      const m = b === 'o' ? base + 7 : b === '-' ? base + 12 : base;
      const dest = this.env(t, stepDur * 1.8, 0.22 * I);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = th.distort ? 900 : 600;
      f.connect(dest);
      this.osc(th.distort ? 'sawtooth' : 'square', this.note(m), t, stepDur * 1.8, f);
    }
    // 和弦铺底
    if (th.pad && s === 0) {
      for (const k of [0, 2, 4]) {
        const m = this.degToMidi(chordDeg + k, 0);
        const dest = this.env(t, stepDur * 15, 0.05, 0.3);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1200;
        f.connect(dest);
        this.osc('sawtooth', this.note(m), t, stepDur * 15, f);
        this.osc('sawtooth', this.note(m) * 1.005, t, stepDur * 15, f);
      }
    }
    // 斯卡反拍
    if (th.skank && s % 4 === 2) {
      for (const k of [0, 2, 4]) this.osc('square', this.note(this.degToMidi(chordDeg + k, 0)), t, 0.08, this.env(t, 0.08, 0.05));
    }
    // 琶音
    if (th.arp && s % 2 === 0) {
      const k = [0, 2, 4, 7][(s / 2) % 4];
      this.osc('square', this.note(this.degToMidi(chordDeg + k, 1)), t, stepDur, this.env(t, stepDur * 0.9, 0.04));
    }
    // 金属：强力和弦
    if (th.distort && s % 8 === 0) {
      const dist = this.audio.distortionNode;
      const g = this.env(t, stepDur * 7, 0.08);
      try {
        dist.disconnect();
      } catch {
        /* 未连接 */
      }
      dist.connect(g);
      const m = this.degToMidi(chordDeg, -1);
      this.osc('sawtooth', this.note(m), t, stepDur * 7, dist);
      this.osc('sawtooth', this.note(m + 7), t, stepDur * 7, dist);
    }
    // 主旋律
    const md = this.melody[bar * 16 + s];
    if (md !== null && md !== undefined) {
      const m = this.degToMidi(md + chordDeg, th.root < 50 ? 2 : 1);
      const f = this.note(m);
      const dur = stepDur * (th.lead === 'pluck' ? 1.5 : 2);
      const dest = this.env(t, dur, th.lead === 'sawtooth' ? 0.06 : 0.09, 0.005);
      if (th.lead === 'pluck') {
        const flt = ctx.createBiquadFilter();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(4000, t);
        flt.frequency.exponentialRampToValueAtTime(400, t + dur);
        flt.connect(dest);
        this.osc('sawtooth', f, t, dur, flt);
      } else {
        const o = this.osc(th.lead, f, t, dur, dest);
        if (th.tremolo) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 12;
          const lg = ctx.createGain();
          lg.gain.value = 6;
          lfo.connect(lg);
          lg.connect(o.frequency);
          lfo.start(t);
          lfo.stop(t + dur);
        }
      }
    }
  }
}
