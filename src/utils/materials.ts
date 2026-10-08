import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;
function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.generateMipmaps = false;
  gradient.needsUpdate = true;
  return gradient;
}

const toonCache = new Map<string, THREE.MeshToonMaterial>();
const lambertCache = new Map<string, THREE.MeshLambertMaterial>();
const basicCache = new Map<string, THREE.MeshBasicMaterial>();

/** 卡通材质（角色/摩托） */
export function toon(color: number, emissive = 0, emissiveIntensity = 1) {
  const key = `${color}-${emissive}-${emissiveIntensity}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
    if (emissive) {
      m.emissive.setHex(emissive);
      m.emissiveIntensity = emissiveIntensity;
    }
    toonCache.set(key, m);
  }
  return m;
}

/** 金属感卡通（黄金/机械鹈鹕） */
const metalCache = new Map<number, THREE.MeshStandardMaterial>();
export function metal(color: number) {
  let m = metalCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.32, flatShading: true });
    metalCache.set(color, m);
  }
  return m;
}

/** 低多边形环境材质 */
export function lambert(color: number, flat = true) {
  const key = `${color}-${flat}`;
  let m = lambertCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: flat });
    lambertCache.set(key, m);
  }
  return m;
}

export function glow(color: number, opacity = 1) {
  const key = `${color}-${opacity}`;
  let m = basicCache.get(key);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, fog: true });
    basicCache.set(key, m);
  }
  return m;
}

export const vertexColorLambert = () => new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** 画布纹理工具 */
export function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.anisotropy = 4;
  return tex;
}

export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** 生成某种路面的纹理（沿 v 方向重复） */
export function roadTexture(surface: string, road: number, line: number) {
  return canvasTexture(128, 256, (ctx) => {
    const W = 128;
    const H = 256;
    ctx.fillStyle = hex(road);
    ctx.fillRect(0, 0, W, H);
    const noise = (alpha: number, n = 500) => {
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      }
    };
    switch (surface) {
      case 'rainbow': {
        const cols = ['#ff5f6d', '#ffb347', '#fff275', '#7cf29c', '#6ec6ff', '#b28dff'];
        cols.forEach((c, i) => {
          ctx.fillStyle = c;
          ctx.fillRect((i * W) / cols.length, 0, W / cols.length + 1, H);
        });
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let y = 0; y < H; y += 32) ctx.fillRect(0, y, W, 4);
        return;
      }
      case 'wood': {
        ctx.fillStyle = '#a8763e';
        ctx.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 16) {
          ctx.fillStyle = y % 32 === 0 ? '#8d6232' : '#b5844a';
          ctx.fillRect(0, y, W, 14);
          ctx.fillStyle = '#5e3f1d';
          ctx.fillRect(0, y + 14, W, 2);
        }
        return;
      }
      case 'metal': {
        ctx.fillStyle = '#7b8590';
        ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        for (let y = 0; y < H; y += 16) {
          for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, y + 4);
            ctx.lineTo(x + 8, y + 12);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(0, 0, 6, H);
        ctx.fillRect(W - 6, 0, 6, H);
        return;
      }
      case 'neon': {
        ctx.fillStyle = '#15151f';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff3cac';
        ctx.fillRect(4, 0, 4, H);
        ctx.fillRect(W - 8, 0, 4, H);
        ctx.fillStyle = '#56f6ff';
        for (let y = 0; y < H; y += 64) ctx.fillRect(W / 2 - 3, y, 6, 32);
        return;
      }
      case 'dirt':
      case 'sand':
      case 'moon':
      case 'rock':
      case 'snow':
      case 'ice':
      case 'mud': {
        noise(0.12, 900);
        if (surface === 'dirt' || surface === 'mud') {
          ctx.fillStyle = 'rgba(60,35,15,0.25)';
          ctx.fillRect(W * 0.28, 0, 10, H);
          ctx.fillRect(W * 0.66, 0, 10, H);
        }
        if (surface === 'moon' || surface === 'rock') {
          ctx.fillStyle = hex(line);
          for (let y = 0; y < H; y += 64) ctx.fillRect(W / 2 - 2, y, 4, 30);
        }
        if (surface === 'ice') {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * W, Math.random() * H);
            ctx.lineTo(Math.random() * W, Math.random() * H);
            ctx.stroke();
          }
        }
        return;
      }
      default: {
        noise(0.08, 700);
        ctx.fillStyle = hex(line);
        ctx.fillRect(4, 0, 4, H);
        ctx.fillRect(W - 8, 0, 4, H);
        for (let y = 0; y < H; y += 64) ctx.fillRect(W / 2 - 3, y, 6, 34);
      }
    }
  });
}

export function checkerTexture(a = '#ffffff', b = '#111111', n = 8) {
  return canvasTexture(
    128,
    128,
    (ctx) => {
      const s = 128 / n;
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          ctx.fillStyle = (x + y) % 2 ? a : b;
          ctx.fillRect(x * s, y * s, s, s);
        }
    },
    true,
  );
}

/** 带文字的贴图（招牌/广告牌/道具箱） */
export function textTexture(text: string, bg: string, fg: string, w = 256, h = 128, font = 'bold 64px sans-serif') {
  return canvasTexture(
    w,
    h,
    (ctx) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = fg;
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2, h / 2 + 4);
    },
    false,
  );
}
