export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
/** 帧率无关的指数阻尼插值 */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const dampAngle = (current: number, target: number, lambda: number, dt: number) =>
  current + wrapAngle(target - current) * (1 - Math.exp(-lambda * dt));

export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p: number) => Math.random() < p;

/** 可复现的伪随机数（mulberry32），赛道道具/布景生成使用 */
export function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatTime(sec: number) {
  if (!isFinite(sec) || sec <= 0) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

/** 弹簧（用于脖子晃动、大嘴形变等程序化动画） */
export class Spring {
  value = 0;
  velocity = 0;
  constructor(public stiffness = 120, public damping = 8, public target = 0) {}
  update(dt: number) {
    const force = (this.target - this.value) * this.stiffness - this.velocity * this.damping;
    this.velocity += force * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
  kick(v: number) {
    this.velocity += v;
  }
}
