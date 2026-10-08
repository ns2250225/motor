import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lambert, glow, toon, textTexture } from '../utils/materials';

const B = new THREE.BoxGeometry(1, 1, 1);
const S = new THREE.IcosahedronGeometry(1, 0);
const S1 = new THREE.IcosahedronGeometry(1, 1);
const C = new THREE.CylinderGeometry(1, 1, 1, 7);
const K = new THREE.ConeGeometry(1, 1, 7);
const D = new THREE.DodecahedronGeometry(1, 0);

type Mat = THREE.Material;
function add(g: THREE.Group, geo: THREE.BufferGeometry, mat: Mat, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
const L = (c: number) => lambert(c);

/** 把 Group 烘焙为带顶点色的几何体（用于实例化渲染）；发光部件单独输出 */
export function bakeGroup(group: THREE.Group): { lit: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null } {
  group.updateMatrixWorld(true);
  const lit: THREE.BufferGeometry[] = [];
  const glowGeos: THREE.BufferGeometry[] = [];
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // 跳过隐藏部件（尾焰、残影等）
    for (let p: THREE.Object3D | null = m; p && p !== group; p = p.parent) if (!p.visible) return;
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    const mat = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    g.applyMatrix4(mat);
    const material = m.material as THREE.MeshLambertMaterial;
    const col = (material.color ?? new THREE.Color(0xffffff)) as THREE.Color;
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k);
    if ((material as THREE.Material).type === 'MeshBasicMaterial') glowGeos.push(g);
    else lit.push(g);
  });
  const merge = (arr: THREE.BufferGeometry[]) => {
    if (!arr.length) return null;
    const merged = mergeGeometries(arr, false)!;
    merged.computeBoundingSphere();
    return merged;
  };
  return { lit: merge(lit), glow: merge(glowGeos) };
}

// ——————————————— 布景道具 ———————————————
export const PROP_BUILDERS: Record<string, () => THREE.Group> = {
  palm() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) add(g, C, L(0x9c6b3c), 0.22 - i * 0.02, 1.4, 0.22 - i * 0.02, i * 0.12, 0.7 + i * 1.3, 0, 0, 0, -0.08);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(g, B, L(i % 2 ? 0x2fa84f : 0x3cbf5a), 0.5, 0.08, 2.6, 0.6 + Math.cos(a) * 1.1, 6.8, Math.sin(a) * 1.1, 0.4, -a + Math.PI / 2, 0);
    }
    add(g, S, L(0x6b4a2a), 0.3, 0.3, 0.3, 0.6, 6.5, 0.2);
    return g;
  },
  umbrella() {
    const g = new THREE.Group();
    add(g, C, L(0xffffff), 0.05, 2.6, 0.05, 0, 1.3, 0);
    add(g, K, L(Math.random() < 0.5 ? 0xff4d6d : 0x3fa9f5), 1.6, 0.6, 1.6, 0, 2.7, 0);
    add(g, B, L(0xffe0a3), 0.8, 0.08, 1.8, 1.2, 0.15, 0);
    return g;
  },
  rockSmall() {
    const g = new THREE.Group();
    add(g, D, L(0x9a9488), 0.8, 0.55, 0.7, 0, 0.3, 0);
    add(g, D, L(0x8a8478), 0.45, 0.35, 0.4, 0.6, 0.2, 0.3);
    return g;
  },
  rockBig() {
    const g = new THREE.Group();
    add(g, D, L(0xc9864a), 3, 2.4, 2.6, 0, 1.6, 0);
    add(g, D, L(0xb5753d), 1.8, 1.6, 1.8, 2, 1, 1);
    return g;
  },
  bush() {
    const g = new THREE.Group();
    add(g, S, L(0x4caf50), 0.9, 0.7, 0.9, 0, 0.5, 0);
    add(g, S, L(0x5cbf60), 0.6, 0.5, 0.6, 0.6, 0.4, 0.3);
    return g;
  },
  building() {
    const g = new THREE.Group();
    const h = 14 + Math.random() * 30;
    const w = 8 + Math.random() * 6;
    const cols = [0x2b2d42, 0x3d3b5c, 0x22223b, 0x4a4e69, 0x1f2041];
    add(g, B, L(cols[Math.floor(Math.random() * cols.length)]), w, h, w, 0, h / 2, 0);
    // 窗户灯光
    const winCol = Math.random() < 0.5 ? 0xffe9a3 : 0x9ef0ff;
    for (let y = 3; y < h - 2; y += 3.2) {
      if (Math.random() < 0.25) continue;
      add(g, B, glow(winCol), w + 0.05, 0.9, w * 0.7, 0, y, 0);
    }
    add(g, B, glow(Math.random() < 0.5 ? 0xff3cac : 0x56f6ff), w + 0.2, 0.3, w + 0.2, 0, h, 0);
    return g;
  },
  streetLamp() {
    const g = new THREE.Group();
    add(g, C, L(0x444455), 0.1, 6, 0.1, 0, 3, 0);
    add(g, B, L(0x444455), 0.12, 0.12, 1.6, 0, 6, 0.7);
    add(g, B, glow(0xfff3c4), 0.4, 0.15, 0.6, 0, 5.9, 1.4);
    return g;
  },
  neonSign() {
    const g = new THREE.Group();
    add(g, C, L(0x333344), 0.12, 5, 0.12, 0, 2.5, 0);
    const c = [0xff3cac, 0x56f6ff, 0xfff275, 0x7cf29c][Math.floor(Math.random() * 4)];
    add(g, B, glow(c), 3.5, 1.4, 0.2, 0, 5.4, 0);
    add(g, B, L(0x111118), 3.2, 1.1, 0.25, 0, 5.4, 0);
    add(g, B, glow(c), 2.4, 0.25, 0.3, 0, 5.4, 0);
    return g;
  },
  cactus() {
    const g = new THREE.Group();
    const c = L(0x3f9b4a);
    add(g, C, c, 0.35, 3.2, 0.35, 0, 1.6, 0);
    add(g, C, c, 0.25, 1.2, 0.25, 0.6, 1.8, 0, 0, 0, 0);
    add(g, C, c, 0.25, 0.7, 0.25, 0.35, 1.3, 0, 0, 0, Math.PI / 2);
    add(g, C, c, 0.22, 1, 0.22, -0.55, 2.2, 0);
    add(g, C, c, 0.22, 0.5, 0.22, -0.32, 1.8, 0, 0, 0, Math.PI / 2);
    return g;
  },
  dune() {
    const g = new THREE.Group();
    add(g, S1, L(0xe9b96e), 10, 3, 6, 0, 0, 0);
    return g;
  },
  pine() {
    const g = new THREE.Group();
    add(g, C, L(0x6b4a2a), 0.25, 1.4, 0.25, 0, 0.7, 0);
    add(g, K, L(0x2e6b4a), 2, 2.6, 2, 0, 2.4, 0);
    add(g, K, L(0x347a55), 1.5, 2.2, 1.5, 0, 3.6, 0);
    add(g, K, L(0xf5f9ff), 1.0, 1.6, 1.0, 0, 4.7, 0);
    return g;
  },
  rockSnow() {
    const g = new THREE.Group();
    add(g, D, L(0x8b94a3), 1, 0.7, 0.9, 0, 0.4, 0);
    add(g, D, L(0xffffff), 0.8, 0.3, 0.7, 0, 0.85, 0);
    return g;
  },
  jungleTree() {
    const g = new THREE.Group();
    add(g, C, L(0x5d4027), 0.35, 7, 0.35, 0, 3.5, 0);
    add(g, S, L(0x2f8f3a), 3, 2, 3, 0, 7.5, 0);
    add(g, S, L(0x3aa34a), 2, 1.6, 2, 1.5, 6.5, 1);
    add(g, S, L(0x267a31), 2.2, 1.5, 2.2, -1.2, 6.8, -0.8);
    return g;
  },
  fern() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      add(g, B, L(0x3aa34a), 0.3, 0.05, 1.4, Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5, 0.6, -a + Math.PI / 2, 0);
    }
    return g;
  },
  vine() {
    const g = new THREE.Group();
    add(g, C, L(0x5d4027), 0.3, 8, 0.3, 0, 4, 0);
    for (let i = 0; i < 4; i++) add(g, C, L(0x2f8f3a), 0.05, 3 + i, 0.05, 0.4 + i * 0.3, 7 - (3 + i) / 2, 0.2);
    add(g, S, L(0x2f8f3a), 1.8, 1, 1.8, 0, 8, 0);
    return g;
  },
  lavaRockProp() {
    const g = new THREE.Group();
    add(g, D, L(0x2b2222), 1.4, 1, 1.2, 0, 0.6, 0);
    add(g, B, glow(0xff5a1f), 0.15, 0.6, 1.2, 0.3, 0.7, 0, 0, 0.5, 0.3);
    return g;
  },
  deadTree() {
    const g = new THREE.Group();
    add(g, C, L(0x2a1d16), 0.2, 4, 0.2, 0, 2, 0);
    add(g, C, L(0x2a1d16), 0.1, 2, 0.1, 0.6, 3.2, 0, 0, 0, -0.8);
    add(g, C, L(0x2a1d16), 0.1, 1.5, 0.1, -0.5, 2.6, 0, 0, 0, 0.9);
    return g;
  },
  containerStack() {
    const g = new THREE.Group();
    const cols = [0xd63a2f, 0x2f6fd6, 0x2fae5a, 0xe6a12a, 0x7a4fd6];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) add(g, B, L(cols[Math.floor(Math.random() * cols.length)]), 2.5, 2.6, 6, (Math.random() - 0.5) * 0.4, 1.3 + i * 2.6, 0);
    return g;
  },
  bollard() {
    const g = new THREE.Group();
    add(g, C, L(0x333333), 0.3, 0.8, 0.3, 0, 0.4, 0);
    add(g, S, L(0x333333), 0.38, 0.2, 0.38, 0, 0.85, 0);
    return g;
  },
  craneProp() {
    const g = new THREE.Group();
    const y = L(0xf2b632);
    for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) add(g, B, y, 0.4, 16, 0.4, x, 8, z);
    add(g, B, y, 4.4, 1.2, 4.4, 0, 16, 0);
    add(g, B, y, 1, 1, 22, 0, 17, 6);
    add(g, B, L(0x444444), 1.8, 1.8, 2, 0, 17.2, -4);
    return g;
  },
  wheat() {
    const g = new THREE.Group();
    add(g, B, L(0xe8c55a), 2, 1.1, 2, 0, 0.55, 0);
    add(g, B, L(0xf2d474), 1.6, 0.25, 1.6, 0, 1.2, 0);
    return g;
  },
  tree() {
    const g = new THREE.Group();
    add(g, C, L(0x6b4a2a), 0.3, 3, 0.3, 0, 1.5, 0);
    add(g, S, L(0x4caf50), 2.2, 2, 2.2, 0, 4, 0);
    add(g, S, L(0x5cbf60), 1.4, 1.2, 1.4, 0.8, 4.8, 0.5);
    return g;
  },
  fence() {
    const g = new THREE.Group();
    const w = L(0xf3efe6);
    for (const x of [-1.5, 0, 1.5]) add(g, B, w, 0.15, 1.2, 0.15, 0, 0.6, x);
    add(g, B, w, 0.08, 0.15, 3.2, 0, 0.9, 0);
    add(g, B, w, 0.08, 0.15, 3.2, 0, 0.45, 0);
    return g;
  },
  cloud() {
    const g = new THREE.Group();
    const c = L(0xffffff);
    add(g, S1, c, 4, 2.2, 3, 0, 0, 0);
    add(g, S1, c, 3, 2, 2.5, 3, 0.4, 0.5);
    add(g, S1, c, 2.6, 1.8, 2.2, -3, 0.2, -0.3);
    return g;
  },
  floatingIsland() {
    const g = new THREE.Group();
    add(g, K, L(0x8a6a4a), 6, 7, 6, 0, -3.5, 0, Math.PI, 0, 0);
    add(g, C, L(0x7ed36b), 6, 0.8, 6, 0, 0.4, 0);
    add(g, S, L(0x4caf50), 1.5, 1.8, 1.5, 2, 2, 1);
    add(g, C, L(0x6b4a2a), 0.2, 1.4, 0.2, 2, 1, 1);
    return g;
  },
  craterProp() {
    const g = new THREE.Group();
    add(g, new THREE.TorusGeometry(1, 0.35, 5, 12), L(0x8d8d96), 3, 3, 1.2, 0, 0.1, 0, Math.PI / 2, 0, 0);
    add(g, C, L(0x6d6d76), 2.6, 0.1, 2.6, 0, 0, 0);
    return g;
  },
  moonRock() {
    const g = new THREE.Group();
    add(g, D, L(0x7d7d86), 0.9, 0.6, 0.8, 0, 0.3, 0);
    return g;
  },
  antenna() {
    const g = new THREE.Group();
    add(g, C, L(0xcccccc), 0.1, 6, 0.1, 0, 3, 0);
    add(g, S1, L(0xeeeeee), 1.2, 0.3, 1.2, 0, 6, 0, 0.6, 0, 0);
    add(g, S, glow(0xff3333), 0.15, 0.15, 0.15, 0, 6.4, 0.3);
    return g;
  },
};

// ——————————————— 地标（单体大物件） ———————————————
export const LANDMARK_BUILDERS: Record<string, () => THREE.Group> = {
  lighthouse() {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) add(g, C, L(i % 2 ? 0xffffff : 0xe8423f), 2.4 - i * 0.18, 3, 2.4 - i * 0.18, 0, 1.5 + i * 3, 0);
    add(g, C, glow(0xfff3a0), 1.3, 2, 1.3, 0, 19, 0);
    add(g, K, L(0x333333), 1.8, 2, 1.8, 0, 21, 0);
    add(g, C, L(0x9a9488), 4, 1, 4, 0, 0, 0);
    return g;
  },
  beachHut() {
    const g = new THREE.Group();
    add(g, B, L(0xffd6a5), 5, 3, 4, 0, 1.5, 0);
    add(g, K, L(0xc98b4e), 4.2, 2.2, 4.2, 0, 4.1, 0, 0, Math.PI / 4, 0);
    add(g, B, L(0x3fa9f5), 1.4, 2, 0.1, 0, 1, 2.05);
    return g;
  },
  tower() {
    const g = new THREE.Group();
    add(g, B, L(0x2a2a48), 14, 90, 14, 0, 45, 0);
    for (let y = 6; y < 88; y += 6) add(g, B, glow(y % 12 ? 0x56f6ff : 0xff3cac), 14.3, 0.6, 14.3, 0, y, 0);
    add(g, C, L(0x888899), 0.3, 18, 0.3, 0, 99, 0);
    add(g, S, glow(0xff3333), 0.6, 0.6, 0.6, 0, 108, 0);
    return g;
  },
  billboard() {
    const g = new THREE.Group();
    add(g, C, L(0x444455), 0.3, 10, 0.3, -4, 5, 0);
    add(g, C, L(0x444455), 0.3, 10, 0.3, 4, 5, 0);
    const texts = ['鹈鹕快递', 'PELICAN', '吃鱼吗？', '大嘴牌汽水'];
    const m = new THREE.MeshBasicMaterial({ map: textTexture(texts[Math.floor(Math.random() * texts.length)], '#ff3cac', '#ffffff', 512, 256, 'bold 90px sans-serif') });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), m);
    board.position.y = 12;
    g.add(board);
    const back = board.clone();
    back.rotation.y = Math.PI;
    g.add(back);
    return g;
  },
  gasStation() {
    const g = new THREE.Group();
    add(g, B, L(0xe8e2d0), 10, 3.5, 6, 0, 1.75, -6);
    add(g, B, L(0xd63a2f), 16, 0.6, 9, 0, 5, 1);
    for (const x of [-6, 6]) add(g, C, L(0xdddddd), 0.3, 5, 0.3, x, 2.5, 1);
    for (const x of [-2.5, 2.5]) add(g, B, L(0xd63a2f), 1, 1.8, 0.7, x, 0.9, 1);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), new THREE.MeshBasicMaterial({ map: textTexture('加油站', '#ffd23f', '#d63a2f', 256, 100, 'bold 60px sans-serif') }));
    sign.position.set(0, 6, 5.6);
    g.add(sign);
    return g;
  },
  mesa() {
    const g = new THREE.Group();
    add(g, C, L(0xc4743b), 18, 22, 16, 0, 11, 0);
    add(g, C, L(0xd88a4c), 15, 8, 13, 0, 26, 0);
    add(g, C, L(0xb5672f), 20, 4, 18, 0, 1, 0);
    return g;
  },
  mountain() {
    const g = new THREE.Group();
    add(g, K, L(0x7c8aa0), 40, 60, 40, 0, 30, 0);
    add(g, K, L(0xffffff), 17, 22, 17, 0, 52, 0);
    add(g, K, L(0x6b7890), 25, 38, 25, 25, 19, 8);
    return g;
  },
  iceLake() {
    const g = new THREE.Group();
    add(g, C, new THREE.MeshPhongMaterial({ color: 0xbfe8ff, shininess: 100 }), 30, 0.3, 20, 0, 0.1, 0);
    return g;
  },
  cabin() {
    const g = new THREE.Group();
    add(g, B, L(0x8b5a2b), 6, 3.5, 5, 0, 1.75, 0);
    add(g, K, L(0xffffff), 4.6, 2.6, 4.6, 0, 4.8, 0, 0, Math.PI / 4, 0);
    add(g, B, glow(0xffd27a), 1, 1, 0.1, 1.5, 2, 2.55);
    return g;
  },
  waterfallCliff() {
    const g = new THREE.Group();
    add(g, B, L(0x5a6b4a), 26, 30, 14, 0, 15, 0);
    add(g, B, L(0x4caf50), 27, 1.5, 15, 0, 30.5, 0);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(8, 30), new THREE.MeshLambertMaterial({ color: 0x7fd8ff, transparent: true, opacity: 0.8, emissive: 0x2a6f8f }));
    water.position.set(0, 15, 7.2);
    water.name = 'waterfall';
    g.add(water);
    add(g, C, L(0x2b9db0), 9, 0.4, 6, 0, 0.2, 10);
    return g;
  },
  temple() {
    const g = new THREE.Group();
    const st = L(0x9a9a7a);
    for (let i = 0; i < 4; i++) add(g, B, st, 18 - i * 4, 3, 18 - i * 4, 0, 1.5 + i * 3, 0);
    add(g, B, L(0x7a7a5a), 4, 4, 4, 0, 14, 0);
    add(g, S, L(0x2f8f3a), 4, 2, 4, 6, 13, 3);
    return g;
  },
  volcano() {
    const g = new THREE.Group();
    add(g, K, L(0x3a2626), 90, 110, 90, 0, 55, 0);
    add(g, C, glow(0xff5a1f), 16, 2, 16, 0, 104, 0);
    add(g, K, L(0x2b1d1d), 60, 70, 60, 50, 35, 30);
    for (let i = 0; i < 4; i++) add(g, B, glow(0xff7a1a), 3, 60, 2, Math.cos(i * 1.6) * 30, 40, Math.sin(i * 1.6) * 30, 0, i, 0.5);
    return g;
  },
  cargoShip() {
    const g = new THREE.Group();
    add(g, B, L(0x2f3a4a), 22, 6, 70, 0, -1, 0);
    add(g, B, L(0xd63a2f), 22.2, 1.2, 70.2, 0, -3.5, 0);
    add(g, B, L(0xf0f0f0), 10, 8, 8, 0, 6, -28);
    add(g, C, L(0x2b2b2b), 1.4, 6, 1.4, 0, 13, -30);
    const cols = [0xd63a2f, 0x2f6fd6, 0x2fae5a, 0xe6a12a];
    for (let i = 0; i < 6; i++) for (const x of [-8, 8]) add(g, B, L(cols[(i + (x > 0 ? 1 : 0)) % 4]), 4, 3, 7, x, 3.5, -16 + i * 8);
    return g;
  },
  windmill() {
    const g = new THREE.Group();
    add(g, C, L(0xf3efe6), 2.4, 14, 3, 0, 7, 0);
    add(g, K, L(0xb54a3a), 3.2, 4, 3.2, 0, 16, 0);
    const blades = new THREE.Group();
    blades.name = 'blades';
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(B, L(0xffffff));
      b.scale.set(1.2, 9, 0.2);
      b.position.y = 4.5;
      const p = new THREE.Group();
      p.rotation.z = (i / 4) * Math.PI * 2;
      p.add(b);
      blades.add(p);
    }
    blades.position.set(0, 14, 3.2);
    g.add(blades);
    return g;
  },
  barnProp() {
    const g = new THREE.Group();
    add(g, B, L(0xb83b2e), 12, 7, 9, 0, 3.5, 0);
    add(g, K, L(0x6b2a20), 8.5, 4, 8.5, 0, 9, 0, 0, Math.PI / 4, 0);
    add(g, B, L(0xffffff), 4, 4.5, 0.2, 0, 2.25, 4.55);
    return g;
  },
  silo() {
    const g = new THREE.Group();
    add(g, C, L(0xc9cfd6), 3, 16, 3, 0, 8, 0);
    add(g, S1, L(0x9aa3ad), 3, 2, 3, 0, 16, 0);
    return g;
  },
  rainbowArc() {
    const g = new THREE.Group();
    const cols = [0xff5f6d, 0xffb347, 0xfff275, 0x7cf29c, 0x6ec6ff, 0xb28dff];
    cols.forEach((c, i) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(40 - i * 2, 1, 6, 40, Math.PI), glow(c));
      g.add(t);
    });
    return g;
  },
  skyCastle() {
    const g = new THREE.Group();
    add(g, K, L(0x8a6a4a), 20, 24, 20, 0, -12, 0, Math.PI, 0, 0);
    add(g, C, L(0x7ed36b), 20, 1, 20, 0, 0.5, 0);
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]]) {
      const h = x === 0 ? 20 : 12;
      add(g, C, L(0xfaf3ff), 2.4, h, 2.4, x, h / 2, z);
      add(g, K, L(0xff7ad9), 3, 4, 3, x, h + 2, z);
    }
    return g;
  },
  moonBase() {
    const g = new THREE.Group();
    add(g, S1, L(0xe5e7eb), 8, 5, 8, 0, 0, 0);
    add(g, S1, L(0xe5e7eb), 5, 3.5, 5, 13, 0, 4);
    add(g, C, L(0xbfc5cc), 1.2, 1.2, 8, 7, 1, 2, Math.PI / 2, 0.3, Math.PI / 2);
    add(g, B, glow(0x7affff), 2, 1, 0.2, 0, 2.5, 7.8);
    return g;
  },
  rocketPad() {
    const g = new THREE.Group();
    add(g, C, L(0x666670), 8, 1, 8, 0, 0.5, 0);
    add(g, C, L(0xffffff), 2, 16, 2, 0, 9, 0);
    add(g, K, L(0xe8423f), 2, 4, 2, 0, 19, 0);
    for (let i = 0; i < 3; i++) add(g, B, L(0xe8423f), 0.2, 4, 2, Math.cos(i * 2.1) * 2, 3, Math.sin(i * 2.1) * 2, 0, -i * 2.1, 0);
    return g;
  },
  earth() {
    const g = new THREE.Group();
    add(g, S1, new THREE.MeshBasicMaterial({ color: 0x3f8ff5 }), 40, 40, 40, 0, 0, 0);
    add(g, S, new THREE.MeshBasicMaterial({ color: 0x4caf50 }), 25, 20, 18, 12, 10, 20);
    add(g, S, new THREE.MeshBasicMaterial({ color: 0x4caf50 }), 18, 22, 14, -15, -8, 25);
    return g;
  },
};

// ——————————————— 障碍物（带碰撞体尺寸） ———————————————
export interface ObstacleModel {
  group: THREE.Group;
  shape: 'box' | 'cylinder' | 'ball';
  half: [number, number, number]; // box 半尺寸；cylinder: [r, hh, -]；ball: [r]
  breakable: boolean;
}

export function buildObstacle(type: string): ObstacleModel {
  const g = new THREE.Group();
  switch (type) {
    case 'cone':
      add(g, K, toon(0xff7a1a), 0.35, 0.9, 0.35, 0, 0.45, 0);
      add(g, C, toon(0xffffff), 0.24, 0.12, 0.24, 0, 0.5, 0);
      add(g, B, toon(0xff7a1a), 0.7, 0.08, 0.7, 0, 0.04, 0);
      return { group: g, shape: 'cylinder', half: [0.35, 0.45, 0], breakable: true };
    case 'barrel':
      add(g, C, toon(0x2f6fd6), 0.45, 1.1, 0.45, 0, 0.55, 0);
      add(g, C, toon(0xffffff), 0.47, 0.1, 0.47, 0, 0.75, 0);
      return { group: g, shape: 'cylinder', half: [0.45, 0.55, 0], breakable: true };
    case 'crate':
      add(g, B, toon(0xc98b4e), 1.1, 1.1, 1.1, 0, 0.55, 0);
      add(g, B, toon(0x8d5a2b), 1.15, 0.15, 1.15, 0, 0.55, 0);
      return { group: g, shape: 'box', half: [0.55, 0.55, 0.55], breakable: true };
    case 'tire':
      add(g, new THREE.TorusGeometry(0.45, 0.2, 6, 10), toon(0x222222), 1, 1, 1, 0, 0.25, 0, Math.PI / 2, 0, 0);
      add(g, new THREE.TorusGeometry(0.45, 0.2, 6, 10), toon(0x222222), 1, 1, 1, 0, 0.6, 0, Math.PI / 2, 0, 0);
      return { group: g, shape: 'cylinder', half: [0.6, 0.4, 0], breakable: true };
    case 'hay':
      add(g, C, toon(0xf2d474), 0.8, 1.4, 0.8, 0, 0.8, 0, 0, 0, Math.PI / 2);
      add(g, C, toon(0xd8b94a), 0.82, 0.1, 0.82, 0.4, 0.8, 0, 0, 0, Math.PI / 2);
      return { group: g, shape: 'box', half: [0.7, 0.8, 0.8], breakable: true };
    case 'beachChair':
      add(g, B, toon(0xff4d6d), 0.7, 0.1, 1.6, 0, 0.5, 0, -0.2, 0, 0);
      add(g, B, toon(0xffffff), 0.7, 0.5, 0.1, 0, 0.25, 0.7);
      return { group: g, shape: 'box', half: [0.4, 0.5, 0.8], breakable: true };
    case 'cactus':
      add(g, C, toon(0x3f9b4a), 0.3, 2.2, 0.3, 0, 1.1, 0);
      add(g, C, toon(0x3f9b4a), 0.2, 0.8, 0.2, 0.45, 1.4, 0);
      return { group: g, shape: 'cylinder', half: [0.35, 1.1, 0], breakable: true };
    case 'snowman':
      add(g, S1, toon(0xffffff), 0.7, 0.7, 0.7, 0, 0.6, 0);
      add(g, S1, toon(0xffffff), 0.5, 0.5, 0.5, 0, 1.55, 0);
      add(g, S1, toon(0xffffff), 0.35, 0.35, 0.35, 0, 2.2, 0);
      add(g, K, toon(0xff7a1a), 0.07, 0.4, 0.07, 0, 2.2, 0.45, Math.PI / 2, 0, 0);
      return { group: g, shape: 'cylinder', half: [0.7, 1.2, 0], breakable: true };
    case 'log':
      add(g, C, toon(0x6b4a2a), 0.45, 4.5, 0.45, 0, 0.45, 0, 0, 0, Math.PI / 2);
      return { group: g, shape: 'box', half: [2.25, 0.45, 0.45], breakable: false };
    case 'rock':
      add(g, D, toon(0x8d8d8d), 0.9, 0.7, 0.9, 0, 0.6, 0);
      return { group: g, shape: 'ball', half: [0.9, 0, 0], breakable: false };
    case 'boulder':
      add(g, D, toon(0x6e6e78), 1.4, 1.2, 1.4, 0, 1.1, 0);
      return { group: g, shape: 'ball', half: [1.35, 0, 0], breakable: false };
    case 'lavaRock':
      add(g, D, toon(0x2b2222), 1.1, 0.9, 1.1, 0, 0.8, 0);
      add(g, B, glow(0xff5a1f), 0.1, 0.8, 1.0, 0.2, 0.9, 0, 0, 0.5, 0.4);
      return { group: g, shape: 'ball', half: [1.05, 0, 0], breakable: false };
    case 'car':
      return { group: buildCar(), shape: 'box', half: [1, 0.8, 2.1], breakable: false };
    case 'container':
      add(g, B, toon(0xd63a2f), 2.4, 2.6, 6, 0, 1.3, 0);
      add(g, B, toon(0xb52a20), 2.45, 0.2, 6.05, 0, 2.5, 0);
      return { group: g, shape: 'box', half: [1.2, 1.3, 3], breakable: false };
    default:
      add(g, B, toon(0x888888), 1, 1, 1, 0, 0.5, 0);
      return { group: g, shape: 'box', half: [0.5, 0.5, 0.5], breakable: true };
  }
}

export function buildCar(color?: number) {
  const g = new THREE.Group();
  const cols = [0xff4d4d, 0x3fa9f5, 0xffd23f, 0x7cf29c, 0xb28dff, 0xffffff];
  const c = color ?? cols[Math.floor(Math.random() * cols.length)];
  add(g, B, toon(c), 1.9, 0.8, 4.1, 0, 0.75, 0);
  add(g, B, toon(c), 1.7, 0.7, 2.2, 0, 1.45, -0.3);
  add(g, B, toon(0x9fd8ff), 1.72, 0.5, 2.0, 0, 1.45, -0.3);
  for (const x of [-0.9, 0.9]) for (const z of [-1.3, 1.3]) add(g, C, toon(0x222222), 0.38, 0.3, 0.38, x, 0.38, z, 0, 0, Math.PI / 2);
  add(g, B, glow(0xfff3c4), 0.4, 0.15, 0.05, -0.6, 0.85, 2.06);
  add(g, B, glow(0xfff3c4), 0.4, 0.15, 0.05, 0.6, 0.85, 2.06);
  add(g, B, glow(0xff2a2a), 0.4, 0.15, 0.05, -0.6, 0.85, -2.06);
  add(g, B, glow(0xff2a2a), 0.4, 0.15, 0.05, 0.6, 0.85, -2.06);
  return g;
}

export function buildTractor() {
  const g = new THREE.Group();
  add(g, B, toon(0x2fae5a), 1.8, 1.2, 3, 0, 1.3, 0.4);
  add(g, B, toon(0x2fae5a), 1.6, 1.5, 1.4, 0, 2.4, -0.6);
  add(g, B, toon(0x9fd8ff), 1.62, 1, 1.2, 0, 2.5, -0.6);
  for (const x of [-1.1, 1.1]) {
    add(g, C, toon(0x222222), 0.95, 0.5, 0.95, x, 0.95, -0.7, 0, 0, Math.PI / 2);
    add(g, C, toon(0xffd23f), 0.5, 0.52, 0.5, x, 0.95, -0.7, 0, 0, Math.PI / 2);
    add(g, C, toon(0x222222), 0.55, 0.4, 0.55, x * 0.9, 0.55, 1.6, 0, 0, Math.PI / 2);
  }
  add(g, C, toon(0x444444), 0.1, 1.2, 0.1, 0.5, 2.6, 1.3);
  // 干草拖车
  add(g, B, toon(0x8b5a2b), 2, 0.3, 3.5, 0, 0.8, -3.6);
  add(g, C, toon(0xf2d474), 0.7, 1.4, 0.7, -0.5, 1.6, -3.6, Math.PI / 2, 0, 0);
  add(g, C, toon(0xf2d474), 0.7, 1.4, 0.7, 0.5, 1.6, -3.6, Math.PI / 2, 0, 0);
  return g;
}

export function buildAnimal(kind: 'cow' | 'chicken' | 'pig' | 'tapir' | 'monkey') {
  const g = new THREE.Group();
  if (kind === 'cow') {
    add(g, B, toon(0xffffff), 1, 1, 2, 0, 1.2, 0);
    add(g, B, toon(0x222222), 1.02, 0.6, 0.8, 0, 1.4, 0.3);
    add(g, B, toon(0xffffff), 0.7, 0.7, 0.8, 0, 1.6, 1.3);
    add(g, B, toon(0xffb3c1), 0.6, 0.35, 0.3, 0, 1.35, 1.75);
    for (const x of [-0.35, 0.35]) for (const z of [-0.7, 0.7]) add(g, B, toon(0xffffff), 0.22, 0.8, 0.22, x, 0.4, z);
  } else if (kind === 'pig') {
    add(g, S1, toon(0xffb3c1), 0.8, 0.65, 1.1, 0, 0.8, 0);
    add(g, C, toon(0xff8fab), 0.25, 0.2, 0.25, 0, 0.85, 1.1, Math.PI / 2, 0, 0);
    for (const x of [-0.35, 0.35]) for (const z of [-0.5, 0.5]) add(g, B, toon(0xffb3c1), 0.18, 0.4, 0.18, x, 0.2, z);
  } else if (kind === 'chicken') {
    add(g, S1, toon(0xffffff), 0.35, 0.35, 0.4, 0, 0.5, 0);
    add(g, S1, toon(0xffffff), 0.2, 0.2, 0.2, 0, 0.85, 0.25);
    add(g, K, toon(0xffa31a), 0.07, 0.15, 0.07, 0, 0.85, 0.48, Math.PI / 2, 0, 0);
    add(g, B, toon(0xff3333), 0.05, 0.15, 0.12, 0, 1.05, 0.25);
  } else if (kind === 'tapir') {
    add(g, S1, toon(0x3a3a3a), 0.8, 0.7, 1.3, 0, 0.9, 0);
    add(g, S1, toon(0xf0f0f0), 0.82, 0.55, 0.5, 0, 0.95, -0.2);
    add(g, C, toon(0x3a3a3a), 0.18, 0.5, 0.18, 0, 0.8, 1.3, Math.PI / 2.5, 0, 0);
    for (const x of [-0.4, 0.4]) for (const z of [-0.6, 0.6]) add(g, B, toon(0x3a3a3a), 0.2, 0.5, 0.2, x, 0.25, z);
  } else {
    add(g, S1, toon(0x8b5a2b), 0.45, 0.5, 0.4, 0, 0.7, 0);
    add(g, S1, toon(0xd8a777), 0.32, 0.32, 0.3, 0, 1.25, 0.1);
    add(g, C, toon(0x8b5a2b), 0.05, 0.9, 0.05, 0, 0.9, -0.5, 0.8, 0, 0);
  }
  return g;
}
