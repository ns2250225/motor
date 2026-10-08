import type { SfxName } from '../core/types';

/**
 * 音效系统：全部使用 Web Audio API 实时合成（无外部音频资源）。
 * 包含：鹈鹕叫声、引擎（随转速变化）、漂移摩擦、攻击/撞击/翻车/氮气/道具等音效。
 */
export class AudioSystem {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxGain!: GainNode;
  musicGain!: GainNode;
  private noise!: AudioBuffer;
  private engine: { osc1: OscillatorNode; osc2: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private engine2: { osc: OscillatorNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private screech: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private wind: { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode } | null = null;
  private listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
  private recent = new Map<string, number>();
  sfxVolume = 0.8;
  musicVolume = 0.6;
  private distortion: WaveShaperNode | null = null;

  /** 必须在用户手势中调用 */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const comp = this.ctx.createDynamicsCompressor();
      comp.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.connect(comp);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(comp);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.setVolumes(this.musicVolume, this.sfxVolume);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    this.musicGain.gain.value = music * 0.5;
    this.sfxGain.gain.value = sfx * 0.9;
  }

  suspend() {
    this.ctx?.suspend().catch(() => undefined);
  }
  resume() {
    this.ctx?.resume().catch(() => undefined);
  }

  setListener(x: number, y: number, z: number, rx: number, rz: number) {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.z = z;
    this.listener.rx = rx;
    this.listener.rz = rz;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  private noiseSrc() {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  private dist() {
    if (!this.distortion && this.ctx) {
      this.distortion = this.ctx.createWaveShaper();
      const c = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        c[i] = Math.tanh(x * 4);
      }
      this.distortion.curve = c;
    }
    return this.distortion!;
  }

  /** 输出节点：带音量与立体声定位 */
  private out(vol: number, pan = 0) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = vol;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      p.connect(this.sfxGain);
    } else g.connect(this.sfxGain);
    return g;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, dest: AudioNode, delay = 0, attack = 0.005) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noiseBurst(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, dest: AudioNode, delay = 0, q = 1) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const s = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  /** 鹈鹕叫声：锯齿波 + 共振峰 + 颤音 */
  squawk(dest: AudioNode, pitch = 1, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = 520 * pitch;
    o.frequency.setValueAtTime(base * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(base, t + 0.08);
    o.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.35);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    const lg = ctx.createGain();
    lg.gain.value = 40 * pitch;
    lfo.connect(lg);
    lg.connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400 * pitch;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(f);
    f.connect(g);
    g.connect(dest);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.45);
    lfo.stop(t + 0.45);
  }

  horn(style: string, dest: AudioNode) {
    switch (style) {
      case 'duck':
        this.squawk(dest, 0.8);
        this.squawk(dest, 0.8, 0.18);
        break;
      case 'trumpet':
        [523, 659, 784].forEach((f, i) => this.tone('sawtooth', f, f, 0.18, 0.18, dest, i * 0.12, 0.02));
        break;
      case 'airhorn':
        for (const f of [233, 294, 349]) this.tone('sawtooth', f, f * 0.98, 0.9, 0.16, dest, 0, 0.02);
        break;
      case 'squeak':
        this.tone('sine', 1200, 2200, 0.15, 0.3, dest);
        this.tone('sine', 1400, 2600, 0.15, 0.3, dest, 0.18);
        break;
      default:
        this.tone('square', 440, 440, 0.12, 0.15, dest);
        this.tone('square', 554, 554, 0.18, 0.15, dest, 0.14);
    }
  }

  /** 播放音效；可带世界坐标做距离衰减与声像 */
  play(name: SfxName, opts: { x?: number; y?: number; z?: number; volume?: number; pitch?: number; horn?: string } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    // 同名音效节流
    const now = this.ctx.currentTime;
    const last = this.recent.get(name) ?? -1;
    if (now - last < 0.035) return;
    this.recent.set(name, now);
    let vol = opts.volume ?? 1;
    let pan = 0;
    if (opts.x !== undefined && opts.z !== undefined) {
      const dx = opts.x - this.listener.x;
      const dz = opts.z - this.listener.z;
      const d = Math.hypot(dx, dz, (opts.y ?? 0) - this.listener.y);
      vol *= Math.max(0, 1 - d / 90);
      if (vol < 0.02) return;
      pan = ((dx * this.listener.rx + dz * this.listener.rz) / Math.max(1, d)) * 0.8;
    }
    const p = opts.pitch ?? 1;
    const o = this.out(vol, pan);
    switch (name) {
      case 'squawk':
        this.squawk(o, p);
        break;
      case 'peck':
        this.tone('square', 900 * p, 260, 0.09, 0.35, o);
        this.noiseBurst(0.04, 0.4, 'highpass', 3000, 3000, o);
        break;
      case 'wing':
        this.noiseBurst(0.12, 0.6, 'bandpass', 1400 * p, 600, o, 0, 1.5);
        this.noiseBurst(0.12, 0.5, 'bandpass', 1600 * p, 700, o, 0.1, 1.5);
        break;
      case 'hit':
        this.tone('sine', 180, 60, 0.18, 0.7, o);
        this.noiseBurst(0.08, 0.4, 'lowpass', 2000, 400, o);
        break;
      case 'bigHit':
        this.tone('sine', 150, 45, 0.3, 0.9, o);
        this.noiseBurst(0.15, 0.6, 'lowpass', 3000, 300, o);
        this.tone('sine', 300, 900, 0.25, 0.3, o, 0.05);
        break;
      case 'boing': {
        const osc = this.tone('sine', 220 * p, 660 * p, 0.35, 0.45, o);
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 18;
        const lg = this.ctx.createGain();
        lg.gain.value = 60;
        lfo.connect(lg);
        lg.connect(osc.frequency);
        lfo.start();
        lfo.stop(this.ctx.currentTime + 0.4);
        break;
      }
      case 'crash':
        this.noiseBurst(0.7, 0.8, 'lowpass', 2500, 200, o);
        this.tone('sine', 120, 40, 0.4, 0.8, o);
        for (let i = 0; i < 4; i++) this.tone('square', 300 + Math.random() * 600, 200, 0.06, 0.15, o, 0.08 + i * 0.12);
        break;
      case 'tumble':
        for (let i = 0; i < 5; i++) this.tone('sine', 140 + i * 20, 60, 0.1, 0.4, o, i * 0.11);
        this.tone('sine', 800, 300, 0.5, 0.15, o);
        break;
      case 'nitro':
        this.noiseBurst(0.7, 0.6, 'bandpass', 400, 3000, o, 0, 0.8);
        this.tone('sawtooth', 80, 160, 0.6, 0.2, o);
        break;
      case 'boost':
        [0, 4, 7, 12].forEach((s, i) => this.tone('sawtooth', 330 * Math.pow(2, s / 12), 330 * Math.pow(2, s / 12), 0.08, 0.15, o, i * 0.04));
        this.noiseBurst(0.4, 0.35, 'bandpass', 600, 2500, o);
        break;
      case 'land':
        this.tone('sine', 110, 50, 0.2, 0.7, o);
        this.noiseBurst(0.1, 0.3, 'lowpass', 1200, 200, o);
        break;
      case 'item':
      case 'pickup':
        [0, 4, 7].forEach((s, i) => this.tone('square', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.09, 0.15, o, i * 0.06));
        break;
      case 'throw':
        this.noiseBurst(0.18, 0.5, 'bandpass', 800, 2400, o, 0, 2);
        this.tone('sine', 500, 200, 0.12, 0.2, o);
        break;
      case 'explode':
        this.noiseBurst(0.9, 0.9, 'lowpass', 1800 * p, 120, o);
        this.tone('sine', 90 * p, 30, 0.6, 0.9, o);
        break;
      case 'freeze':
        for (let i = 0; i < 6; i++) this.tone('sine', 2000 + Math.random() * 2000, 1500, 0.15, 0.12, o, i * 0.04);
        this.noiseBurst(0.3, 0.3, 'highpass', 5000, 3000, o);
        break;
      case 'splat':
        this.noiseBurst(0.3, 0.7, 'lowpass', 1500, 150, o);
        this.tone('sine', 300, 80, 0.2, 0.3, o);
        break;
      case 'splash':
        this.noiseBurst(0.6, 0.7, 'bandpass', 1200, 300, o, 0, 0.7);
        break;
      case 'rocket':
        this.noiseBurst(0.8, 0.6, 'bandpass', 300, 2000, o, 0, 0.6);
        this.tone('sawtooth', 120, 400, 0.8, 0.15, o);
        break;
      case 'gold':
        [0, 4, 7, 11, 14].forEach((s, i) => this.tone('triangle', 784 * p * Math.pow(2, s / 12), 784 * p * Math.pow(2, s / 12), 0.2, 0.15, o, i * 0.05));
        break;
      case 'whoosh':
        this.noiseBurst(0.3, 0.5, 'bandpass', 500 * p, 2500 * p, o, 0, 1.2);
        break;
      case 'clamp':
        this.tone('square', 220, 120, 0.1, 0.4, o);
        this.noiseBurst(0.05, 0.5, 'highpass', 2000, 2000, o, 0.02);
        this.tone('square', 260, 140, 0.1, 0.35, o, 0.12);
        break;
      case 'scrape':
        this.noiseBurst(0.15, 0.35, 'highpass', 3000, 6000, o);
        break;
      case 'break':
        this.noiseBurst(0.2, 0.5, 'bandpass', 900, 400, o, 0, 2);
        this.tone('square', 400, 200, 0.05, 0.2, o);
        break;
      case 'countdown':
        this.tone('square', 440, 440, 0.25, 0.25, o);
        break;
      case 'go':
        this.tone('square', 880, 880, 0.6, 0.3, o);
        this.tone('square', 1320, 1320, 0.6, 0.15, o);
        break;
      case 'lap':
        this.tone('triangle', 784, 784, 0.15, 0.3, o);
        this.tone('triangle', 1175, 1175, 0.3, 0.3, o, 0.12);
        break;
      case 'finish':
      case 'win':
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.tone('square', 523 * Math.pow(2, s / 12), 523 * Math.pow(2, s / 12), i === 6 ? 0.6 : 0.14, 0.18, o, i * 0.13));
        [0, 7, 12].forEach((s) => this.tone('triangle', 262 * Math.pow(2, s / 12), 262 * Math.pow(2, s / 12), 1.4, 0.1, o, 0.8));
        break;
      case 'lose':
        [0, -1, -2, -3].forEach((s, i) => this.tone('sawtooth', 392 * Math.pow(2, s / 12), 392 * Math.pow(2, (s - 0.5) / 12), i === 3 ? 0.8 : 0.3, 0.15, o, i * 0.32));
        break;
      case 'click':
        this.tone('square', 1200, 900, 0.04, 0.12, o);
        break;
      case 'coin':
        this.tone('square', 988, 988, 0.07, 0.15, o);
        this.tone('square', 1319, 1319, 0.25, 0.15, o, 0.07);
        break;
      case 'horn':
        this.horn(opts.horn ?? 'beep', o);
        break;
      case 'trick':
        [0, 5, 9, 12].forEach((s, i) => this.tone('triangle', 660 * Math.pow(2, s / 12), 660 * Math.pow(2, s / 12), 0.12, 0.2, o, i * 0.05));
        break;
      case 'eliminate':
        this.tone('sawtooth', 600, 80, 0.8, 0.3, o);
        this.squawk(o, 0.6, 0.1);
        break;
      case 'geyser':
        this.noiseBurst(1.4, 0.7, 'lowpass', 400, 1500, o);
        this.tone('sine', 60, 40, 1.2, 0.6, o);
        break;
      case 'drift':
        this.noiseBurst(0.2, 0.3, 'bandpass', 2500, 2000, o, 0, 5);
        break;
    }
  }

  /** 引擎声随转速变化；漂移摩擦与风噪 */
  updateEngine(speed: number, maxSpeed: number, nitro: boolean, drifting: boolean, active: boolean, otherSpeed = 0, otherVol = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (!this.engine) {
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 4;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      osc1.start();
      osc2.start();
      this.engine = { osc1, osc2, filter, gain };
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(f);
      f.connect(g);
      g.connect(this.sfxGain);
      o.start();
      this.engine2 = { osc: o, filter: f, gain: g };
      const mk = (type: BiquadFilterType, freq: number, q: number) => {
        const src = this.noiseSrc();
        const filter2 = ctx.createBiquadFilter();
        filter2.type = type;
        filter2.frequency.value = freq;
        filter2.Q.value = q;
        const gn = ctx.createGain();
        gn.gain.value = 0;
        src.connect(filter2);
        filter2.connect(gn);
        gn.connect(this.sfxGain);
        src.start();
        return { src, filter: filter2, gain: gn };
      };
      this.screech = mk('bandpass', 2600, 6);
      this.wind = mk('bandpass', 700, 0.6);
    }
    const r = Math.max(0, Math.min(1.4, Math.abs(speed) / maxSpeed));
    // 模拟换挡：转速在每档内循环
    const gear = Math.min(4, Math.floor(r * 4));
    const inGear = r * 4 - gear;
    const rpm = 0.35 + inGear * 0.55 + gear * 0.06 + (nitro ? 0.15 : 0);
    const f = 45 + rpm * 110;
    this.engine.osc1.frequency.setTargetAtTime(f, t, 0.05);
    this.engine.osc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engine.filter.frequency.setTargetAtTime(500 + rpm * 1600 + (nitro ? 800 : 0), t, 0.05);
    this.engine.gain.gain.setTargetAtTime(active ? 0.09 + r * 0.06 : 0, t, 0.1);
    this.screech!.gain.gain.setTargetAtTime(active && drifting ? 0.18 : 0, t, 0.05);
    this.wind!.gain.gain.setTargetAtTime(active ? Math.max(0, r - 0.5) * 0.25 : 0, t, 0.2);
    const ro = Math.min(1, otherSpeed / maxSpeed);
    this.engine2!.osc.frequency.setTargetAtTime(55 + ro * 120, t, 0.08);
    this.engine2!.gain.gain.setTargetAtTime(active ? otherVol * 0.05 : 0, t, 0.15);
  }

  stopEngine() {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.gain.gain.setTargetAtTime(0, t, 0.05);
    this.engine2?.gain.gain.setTargetAtTime(0, t, 0.05);
    this.screech?.gain.gain.setTargetAtTime(0, t, 0.05);
    this.wind?.gain.gain.setTargetAtTime(0, t, 0.05);
  }

  /** 供音乐系统使用 */
  get distortionNode() {
    return this.dist();
  }
  get noiseBuffer() {
    return this.noise;
  }
}
