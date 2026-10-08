import * as THREE from 'three';
import type { TrackConfig } from './TrackConfig';
import { TrackGeometry, SHOULDER_WIDTH } from './TrackGeometry';
import type { Road } from './Road';
import type { Physics, ObstacleRef } from '../core/Physics';
import { PROP_BUILDERS, LANDMARK_BUILDERS, bakeGroup, buildObstacle } from './Props';
import { lambert, glow, roadTexture, canvasTexture, checkerTexture, hex, textTexture, toon } from '../utils/materials';
import { seededRandom, hashString, lerp } from '../utils/math';
import { SURFACES } from './surfaces';

export interface Quality {
  level: 'low' | 'medium' | 'high';
  propDensity: number;
  drawDistance: number;
  shadows: boolean;
}

interface Chunk {
  meshes: THREE.Object3D[];
  center: THREE.Vector3;
  radius: number;
  detail: boolean;
}

export interface BuiltTrack {
  geo: TrackGeometry;
  root: THREE.Group;
  rampMeshes: Map<number, THREE.Mesh>;
  startLights: THREE.Mesh[];
  minimap: { main: [number, number][]; shortcuts: [number, number][][]; bounds: { minX: number; maxX: number; minZ: number; maxZ: number } };
  groundLevel: number;
  waterLevel: number | null;
  lavaY: number | null;
  obstacleRefs: ObstacleRef[];
  update: (dt: number, camPos: THREE.Vector3) => void;
  dispose: () => void;
}

type CrossPoint = [lateral: number, yOff: number, absolute?: boolean];

/** 沿道路生成带状几何体（横截面两点 a→b） */
export function ribbon(
  road: Road,
  i0: number,
  i1: number,
  a: CrossPoint,
  b: CrossPoint,
  vScale = 12,
  skip?: (s: number) => boolean,
  wrap = false,
): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const n = road.count;
  const count = wrap ? i1 - i0 + 2 : i1 - i0 + 1;
  for (let k = 0; k < count; k++) {
    const i = wrap ? (i0 + k) % n : i0 + k;
    const s = wrap && k === count - 1 ? road.length : road.s[i];
    const rx = -road.tz[i];
    const rz = road.tx[i];
    for (const [lat, yo, abs] of [a, b]) {
      pos.push(road.px[i] + rx * lat, abs ? yo : road.py[i] + yo, road.pz[i] + rz * lat);
    }
    uv.push(0, s / vScale, 1, s / vScale);
    if (k > 0) {
      const sm = (s + (wrap && k === count - 1 ? road.s[(i0 + k - 1) % n] : road.s[i - 1])) / 2;
      if (skip && skip(sm)) continue;
      const p = (k - 1) * 2;
      idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function wedgeGeometry(w: number, len: number) {
  // 跳台楔形：沿 +z 抬升（高度 1，运行时缩放）
  const hw = w / 2;
  const v = [
    -hw, 0, 0, hw, 0, 0, -hw, 0, len, hw, 0, len, -hw, 1, len, hw, 1, len,
  ];
  const idx = [0, 4, 2, 0, 2, 4, 1, 3, 5, 0, 1, 5, 0, 5, 4, 2, 4, 5, 2, 5, 3, 0, 3, 1, 0, 2, 3];
  const g = new THREE.BufferGeometry();
  // 展开为非索引并计算法线（平直着色）
  const p: number[] = [];
  const tris = [
    [0, 5, 1], [0, 4, 5], // 斜面
    [2, 3, 5], [2, 5, 4], // 末端竖直面
    [0, 2, 4], [1, 5, 3], // 两侧
  ];
  void idx;
  for (const t of tris) for (const i of t) p.push(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

let skyGeo: THREE.SphereGeometry | null = null;
export function buildSky(top: number, bottom: number, stars: boolean) {
  const g = new THREE.Group();
  skyGeo = skyGeo ?? new THREE.SphereGeometry(1400, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, pow(h,0.8)),1.0); }`,
  });
  const sky = new THREE.Mesh(skyGeo, mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  g.add(sky);
  if (stars) {
    const pts: number[] = [];
    for (let i = 0; i < 900; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05;
      v.multiplyScalar(1300);
      pts.push(v.x, v.y, v.z);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const s = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false }));
    s.frustumCulled = false;
    g.add(s);
  }
  return g;
}

/** 赛道加载器：数据驱动构建 3D 赛道 */
export function loadTrack(cfg: TrackConfig, scene: THREE.Scene, physics: Physics, q: Quality): BuiltTrack {
  const geo = new TrackGeometry(cfg);
  const main = geo.main;
  const pal = cfg.palette;
  const root = new THREE.Group();
  root.name = 'track';
  scene.add(root);
  const rng = seededRandom(hashString(cfg.id + 'props'));
  const disposables: { dispose: () => void }[] = [];
  const animated: ((dt: number, t: number) => void)[] = [];
  const hw = main.halfWidth;
  const n = main.count;

  const minY = Math.min(...main.py);
  const groundLevel = Math.min(pal.groundLevel ?? -1, minY - 1.5);
  const waterLevel = pal.water !== undefined ? Math.min(pal.waterLevel ?? -1, minY - 1) : null;
  const lavaY = pal.lava ? groundLevel : null;

  // ——— 天空、雾、光照 ———
  scene.background = new THREE.Color(pal.skyBottom);
  scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar * (q.level === 'low' ? 0.75 : 1));
  const sky = buildSky(pal.skyTop, pal.skyBottom, !!(pal.stars || pal.night));
  root.add(sky);
  animated.push(() => {
    // 天空跟随相机
  });

  const addMesh = (g: THREE.BufferGeometry, m: THREE.Material, shadow = true) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = shadow;
    root.add(mesh);
    disposables.push(g);
    return mesh;
  };

  // ——— 地面 / 水面 / 岩浆 / 云海 ———
  const span = Math.max(main.maxX - main.minX, main.maxZ - main.minZ) + 900;
  const cx = (main.maxX + main.minX) / 2;
  const cz = (main.maxZ + main.minZ) / 2;
  if (pal.cloudSea) {
    const m = addMesh(new THREE.PlaneGeometry(span * 2, span * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xf3e6ff, emissiveIntensity: 0.35 }), false);
    m.position.set(cx, groundLevel, cz);
  } else if (pal.lava) {
    const lavaTex = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = '#ff4a10';
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = i % 2 ? '#ffb020' : '#c22a00';
        ctx.beginPath();
        ctx.arc(Math.random() * 128, Math.random() * 128, 4 + Math.random() * 14, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    lavaTex.repeat.set(span / 40, span / 40);
    const m = addMesh(new THREE.PlaneGeometry(span * 2, span * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: lavaTex, fog: true }), false);
    m.position.set(cx, groundLevel, cz);
    animated.push((dt) => {
      lavaTex.offset.x += dt * 0.01;
      lavaTex.offset.y += dt * 0.006;
    });
  } else {
    const gtex = canvasTexture(128, 128, (ctx) => {
      ctx.fillStyle = hex(pal.ground);
      ctx.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
        ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
      }
    });
    gtex.repeat.set(span / 16, span / 16);
    const m = addMesh(new THREE.PlaneGeometry(span * 2, span * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: gtex }));
    m.position.set(cx, groundLevel, cz);
  }
  if (waterLevel !== null) {
    const wm = new THREE.MeshPhongMaterial({ color: pal.water, shininess: 90, transparent: true, opacity: 0.88 });
    const water = addMesh(new THREE.PlaneGeometry(span * 2, span * 2).rotateX(-Math.PI / 2), wm, false);
    // 水面只在赛道外侧一侧显示（海边）
    water.position.set(cx, waterLevel, cz);
    let t = 0;
    animated.push((dt) => {
      t += dt;
      water.position.y = waterLevel + Math.sin(t * 0.8) * 0.15;
    });
    // 内陆地面抬升到水面之上
    if (cfg.id !== 'port') {
      const inner = addMesh(new THREE.CircleGeometry(Math.min(main.maxX - main.minX, main.maxZ - main.minZ) * 0.42, 32).rotateX(-Math.PI / 2), lambert(pal.ground));
      inner.position.set(cx, waterLevel + 0.3, cz);
      inner.scale.set((main.maxX - main.minX) / (main.maxZ - main.minZ), 1, 1);
    }
  }

  // ——— 主路 ———
  const roadMat = (surface: string, color: number, line: number) => {
    const tex = roadTexture(surface, color, line);
    disposables.push(tex);
    return new THREE.MeshLambertMaterial({ map: tex });
  };
  const inGap = (s: number) => geo.inGap(s);
  const mainRoadMat = roadMat(cfg.surface, pal.road, pal.roadLine);
  addMesh(ribbon(main, 0, n - 1, [-hw, 0.02], [hw, 0.02], 16, inGap, true), mainRoadMat);
  // 特殊路面区域
  for (const z of geo.surfaceZones) {
    const i0 = main.indexAt(z.s0);
    const i1 = main.indexAt(z.s1);
    const col = z.surface === 'ice' ? 0xcfefff : z.surface === 'sand' ? 0xe6c07a : z.surface === 'mud' ? 0x5e3d22 : z.surface === 'snow' ? 0xffffff : z.surface === 'metal' ? 0x8a929b : z.surface === 'wood' ? 0xa8763e : 0x888888;
    const m = roadMat(z.surface, col, 0xffffff);
    if (z.surface === 'ice') {
      m.transparent = true;
      m.opacity = 0.92;
    }
    if (i1 > i0) addMesh(ribbon(main, i0, i1, [-hw, 0.05], [hw, 0.05], 16, inGap), m);
  }
  // 路缘石
  const curbTex = canvasTexture(16, 64, (ctx) => {
    ctx.fillStyle = hex(pal.curbA);
    ctx.fillRect(0, 0, 16, 32);
    ctx.fillStyle = hex(pal.curbB);
    ctx.fillRect(0, 32, 16, 32);
  });
  disposables.push(curbTex);
  const curbMat = new THREE.MeshLambertMaterial({ map: curbTex });
  const scOverlap = (s: number, side: number, lat: number) => {
    // 主路边缘位置是否落在捷径路面上（护栏开口）
    const p = main.pointAt(s);
    const x = p.x + p.rx * lat * side;
    const z = p.z + p.rz * lat * side;
    for (const sc of geo.shortcuts) {
      const r = sc.road;
      if (x < r.minX - 15 || x > r.maxX + 15 || z < r.minZ - 15 || z > r.maxZ + 15) continue;
      const qq = r.nearest(x, z);
      if (Math.abs(qq.lateral) < r.halfWidth + 1.5 && qq.s > 0.5 && qq.s < r.length - 0.5) return true;
    }
    return false;
  };
  const edgeSkip = (side: number, lat: number) => (s: number) => inGap(s) || scOverlap(s, side, lat);
  addMesh(ribbon(main, 0, n - 1, [hw, 0.04], [hw + 1, 0.12], 4, edgeSkip(1, hw + 0.5), true), curbMat);
  addMesh(ribbon(main, 0, n - 1, [-hw - 1, 0.12], [-hw, 0.04], 4, edgeSkip(-1, hw + 0.5), true), curbMat);

  // ——— 边缘：路肩/护栏/悬空 ———
  if (cfg.edge === 'offroad') {
    const shTex = canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = hex(pal.shoulder);
      ctx.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
      }
    });
    shTex.repeat.set(3, 1);
    disposables.push(shTex);
    const shMat = new THREE.MeshLambertMaterial({ map: shTex });
    const W = hw + SHOULDER_WIDTH;
    addMesh(ribbon(main, 0, n - 1, [hw + 1, 0.0], [W, 0], 12, undefined, true), shMat);
    addMesh(ribbon(main, 0, n - 1, [-W, 0], [-hw - 1, 0.0], 12, undefined, true), shMat);
    addMesh(ribbon(main, 0, n - 1, [W, 0], [W + 18, groundLevel, true], 12, undefined, true), shMat);
    addMesh(ribbon(main, 0, n - 1, [-W - 18, groundLevel, true], [-W, 0], 12, undefined, true), shMat);
    // 外圈矮石墙（捷径处开口）
    const wallMat = lambert(pal.wall);
    addMesh(ribbon(main, 0, n - 1, [W, 0], [W, 1.0], 8, edgeSkip(1, W), true), new THREE.MeshLambertMaterial({ color: pal.wall, side: THREE.DoubleSide }));
    addMesh(ribbon(main, 0, n - 1, [-W, 1.0], [-W, 0], 8, edgeSkip(-1, W), true), new THREE.MeshLambertMaterial({ color: pal.wall, side: THREE.DoubleSide }));
    void wallMat;
  } else if (cfg.edge === 'wall') {
    const wm = new THREE.MeshLambertMaterial({ color: pal.wall, side: THREE.DoubleSide });
    addMesh(ribbon(main, 0, n - 1, [hw + 1, 0], [hw + 1, 1.3], 8, edgeSkip(1, hw + 1), true), wm);
    addMesh(ribbon(main, 0, n - 1, [-hw - 1, 1.3], [-hw - 1, 0], 8, edgeSkip(-1, hw + 1), true), wm);
    const topMat = glow(pal.curbA);
    addMesh(ribbon(main, 0, n - 1, [hw + 0.9, 1.3], [hw + 1.2, 1.3], 8, edgeSkip(1, hw + 1), true), topMat);
    addMesh(ribbon(main, 0, n - 1, [-hw - 1.2, 1.3], [-hw - 0.9, 1.3], 8, edgeSkip(-1, hw + 1), true), topMat);
    // 路外地面
    const side = lambert(pal.shoulder);
    addMesh(ribbon(main, 0, n - 1, [hw + 1, 0], [hw + 14, 0], 12, undefined, true), side);
    addMesh(ribbon(main, 0, n - 1, [-hw - 14, 0], [-hw - 1, 0], 12, undefined, true), side);
    addMesh(ribbon(main, 0, n - 1, [hw + 14, 0], [hw + 24, groundLevel, true], 12, undefined, true), side);
    addMesh(ribbon(main, 0, n - 1, [-hw - 24, groundLevel, true], [-hw - 14, 0], 12, undefined, true), side);
  } else {
    // 悬空道路：发光边缘 + 底板厚度
    const rim = glow(pal.curbB);
    addMesh(ribbon(main, 0, n - 1, [hw + 1, 0.12], [hw + 1, -1.6], 8, inGap, true), new THREE.MeshLambertMaterial({ color: pal.wall, side: THREE.DoubleSide }));
    addMesh(ribbon(main, 0, n - 1, [-hw - 1, -1.6], [-hw - 1, 0.12], 8, inGap, true), new THREE.MeshLambertMaterial({ color: pal.wall, side: THREE.DoubleSide }));
    addMesh(ribbon(main, 0, n - 1, [hw + 1, -1.6], [-hw - 1, -1.6], 8, inGap, true), new THREE.MeshLambertMaterial({ color: pal.wall, side: THREE.DoubleSide }));
    addMesh(ribbon(main, 0, n - 1, [hw + 0.9, 0.14], [hw + 1.1, 0.14], 8, inGap, true), rim);
    addMesh(ribbon(main, 0, n - 1, [-hw - 1.1, 0.14], [-hw - 0.9, 0.14], 8, inGap, true), rim);
  }

  // ——— 桥墩（高架路段） ———
  if (!pal.cloudSea) {
    const pillarGeo = new THREE.CylinderGeometry(1, 1.3, 1, 7);
    disposables.push(pillarGeo);
    const pm = lambert(cfg.edge === 'fall' ? 0x3a2b28 : 0xb9b2a6);
    const pillars: THREE.Matrix4[] = [];
    const base = waterLevel !== null && cfg.edge !== 'offroad' ? waterLevel : groundLevel;
    for (let s = 0; s < main.length; s += 24) {
      const p = main.pointAt(s);
      const h = p.y - base;
      if ((cfg.edge === 'offroad' && h < 4) || h < 2.5 || inGap(s)) continue;
      for (const side of cfg.edge === 'fall' ? [0] : [-1, 1]) {
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(p.x + p.rx * side * (hw - 2), base + h / 2 - 0.8, p.z + p.rz * side * (hw - 2)),
          new THREE.Quaternion(),
          new THREE.Vector3(cfg.edge === 'fall' ? 2.2 : 1, h, cfg.edge === 'fall' ? 2.2 : 1),
        );
        pillars.push(m);
      }
    }
    if (cfg.edge !== 'offroad' && pillars.length) {
      const im = new THREE.InstancedMesh(pillarGeo, pm, pillars.length);
      pillars.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true;
      root.add(im);
    }
  }

  // ——— 捷径 ———
  for (const sc of geo.shortcuts) buildShortcutVisual(sc.road, sc.cfg.style, sc.cfg.surface, cfg, root, disposables, animated, groundLevel, waterLevel);

  // ——— 起终点 ———
  const startLights: THREE.Mesh[] = [];
  {
    const p = main.pointAt(0);
    const yaw = Math.atan2(p.tx, p.tz);
    const g = new THREE.Group();
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = yaw;
    const chk = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 3).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: checkerTexture('#ffffff', '#111111', 8) }));
    chk.position.y = 0.06;
    (chk.material as THREE.MeshLambertMaterial).map!.repeat.set(hw / 1.5, 1);
    g.add(chk);
    const pm = toon(0x2b2b38);
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.8, 9, 0.8), pm);
      pole.position.set(sx * (hw + 1.6), 4.5, 0);
      pole.castShadow = true;
      g.add(pole);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(hw * 2 + 4, 2.2, 0.6),
      [pm, pm, pm, pm, new THREE.MeshBasicMaterial({ map: textTexture('PELICAN ROAD RAGE', '#ff7a1a', '#ffffff', 1024, 128, 'bold 84px sans-serif') }), new THREE.MeshBasicMaterial({ map: textTexture('鹈鹕暴力摩托', '#1b9bd8', '#ffffff', 1024, 128, 'bold 90px sans-serif') })],
    );
    banner.position.y = 9;
    g.add(banner);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0x331111 }));
      l.position.set((i - 1) * 1.6, 7.3, -0.4);
      g.add(l);
      startLights.push(l);
    }
    root.add(g);
  }

  // ——— 跳台 ———
  const rampMeshes = new Map<number, THREE.Mesh>();
  const rampTex = canvasTexture(64, 64, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffd23f' : '#222222';
      ctx.beginPath();
      ctx.moveTo(i * 16 - 32, 0);
      ctx.lineTo(i * 16 - 16, 0);
      ctx.lineTo(i * 16 + 16, 64);
      ctx.lineTo(i * 16, 64);
      ctx.fill();
    }
  });
  disposables.push(rampTex);
  for (const r of geo.ramps) {
    const p = main.pointAt(r.s);
    const mesh = new THREE.Mesh(wedgeGeometry(r.width, r.length), new THREE.MeshLambertMaterial({ color: r.dynamic ? 0xff7a3a : 0xffffff, map: rampTex }));
    // 斜面 UV 不重要，使用颜色纹理平铺
    mesh.position.set(p.x + p.rx * r.lateral, p.y + 0.03, p.z + p.rz * r.lateral);
    mesh.rotation.y = Math.atan2(p.tx, p.tz);
    mesh.scale.y = r.height;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    rampMeshes.set(r.id, mesh);
  }
  // 楔形几何没有 UV，补一个简单 UV
  rampMeshes.forEach((m) => {
    const g = m.geometry;
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / 2;
      uv[i * 2 + 1] = pos.getZ(i) / 2 + pos.getY(i) * 0.3;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  });

  // ——— 加速带 ———
  const arrowTex = canvasTexture(64, 128, (ctx) => {
    ctx.fillStyle = '#00d5ff';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < 128; y += 42) {
      ctx.beginPath();
      ctx.moveTo(8, y + 30);
      ctx.lineTo(32, y + 6);
      ctx.lineTo(56, y + 30);
      ctx.lineTo(56, y + 40);
      ctx.lineTo(32, y + 16);
      ctx.lineTo(8, y + 40);
      ctx.fill();
    }
  });
  arrowTex.repeat.set(1, 1.5);
  disposables.push(arrowTex);
  const padMat = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, opacity: 0.92, fog: true });
  for (const b of geo.boostPads) {
    const p = main.pointAt(b.s + 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 6).rotateX(-Math.PI / 2), padMat);
    m.position.set(p.x + p.rx * b.lateral, p.y + 0.08, p.z + p.rz * b.lateral);
    m.rotation.y = Math.atan2(p.tx, p.tz);
    root.add(m);
  }
  animated.push((dt) => {
    arrowTex.offset.y -= dt * 1.5;
  });

  // ——— 障碍物 ———
  const obstacleRefs: ObstacleRef[] = [];
  for (const o of geo.obstacles) {
    if (inGap(o.s)) continue;
    const p = main.pointAt(o.s);
    const model = buildObstacle(o.type);
    const x = p.x + p.rx * o.lateral;
    const z = p.z + p.rz * o.lateral;
    const yaw = Math.atan2(p.tx, p.tz) + (o.type === 'log' ? 0 : rng() * 0.6);
    model.group.position.set(x, p.y, z);
    model.group.rotation.y = yaw;
    root.add(model.group);
    const ref = { kind: (model.breakable ? 'breakable' : 'solid') as 'breakable' | 'solid', type: o.type, mesh: model.group };
    let r: ObstacleRef;
    if (model.shape === 'box') r = physics.addStaticBox(x, p.y + model.half[1], z, model.half[0], model.half[1], model.half[2], yaw, ref);
    else if (model.shape === 'cylinder') r = physics.addStaticCylinder(x, p.y + model.half[1], z, model.half[0], model.half[1], ref);
    else r = physics.addStaticCylinder(x, p.y + model.half[0], z, model.half[0], model.half[0], ref);
    obstacleRefs.push(r);
    // 让破碎物件的网格以碰撞体中心为原点
    if (model.breakable) {
      const cy = model.shape === 'ball' ? model.half[0] : model.half[1];
      const wrapper = new THREE.Group();
      wrapper.position.set(x, p.y + cy, z);
      wrapper.rotation.y = yaw;
      model.group.position.set(0, -cy, 0);
      model.group.rotation.y = 0;
      wrapper.add(model.group);
      root.add(wrapper);
      r.mesh = wrapper;
    }
  }

  // ——— 地面物理网格（供碎片落地） ———
  {
    const verts: number[] = [];
    const ids: number[] = [];
    const W = cfg.edge === 'offroad' ? hw + SHOULDER_WIDTH : cfg.edge === 'wall' ? hw + 14 : hw + 1;
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      const rx = -main.tz[k];
      const rz = main.tx[k];
      verts.push(main.px[k] - rx * W, main.py[k], main.pz[k] - rz * W, main.px[k] + rx * W, main.py[k], main.pz[k] + rz * W);
      if (i > 0) {
        const p = (i - 1) * 2;
        if (!inGap(main.s[k])) ids.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
      }
    }
    for (const sc of geo.shortcuts) {
      const r = sc.road;
      const off = verts.length / 3;
      for (let i = 0; i < r.count; i++) {
        const rx = -r.tz[i];
        const rz = r.tx[i];
        const w = r.halfWidth + 1;
        verts.push(r.px[i] - rx * w, r.py[i], r.pz[i] - rz * w, r.px[i] + rx * w, r.py[i], r.pz[i] + rz * w);
        if (i > 0) {
          const p = off + (i - 1) * 2;
          ids.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
        }
      }
    }
    physics.addGroundMesh(new Float32Array(verts), new Uint32Array(ids));
    if (!pal.cloudSea) physics.addGroundPlane(lavaY !== null ? lavaY - 5 : groundLevel);
  }

  // ——— 布景（实例化 + 分区） ———
  const chunks: Chunk[] = [];
  const CHUNKS = 8;
  const chunkOf = (s: number) => Math.min(CHUNKS - 1, Math.floor((s / main.length) * CHUNKS));
  const chunkBuckets: Map<string, THREE.Matrix4[]>[] = Array.from({ length: CHUNKS }, () => new Map());
  const chunkCenters = Array.from({ length: CHUNKS }, (_, i) => {
    const p = main.pointAt(((i + 0.5) / CHUNKS) * main.length);
    return new THREE.Vector3(p.x, p.y, p.z);
  });
  const propGeos = new Map<string, { lit: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null; detail: boolean }>();
  const VARIANTS = 2;
  const onOtherRoad = (x: number, z: number, margin: number) => {
    const qm = main.nearest(x, z);
    if (Math.abs(qm.lateral) < hw + margin) return true;
    for (const sc of geo.shortcuts) {
      const r = sc.road;
      if (x < r.minX - 20 || x > r.maxX + 20 || z < r.minZ - 20 || z > r.maxZ + 20) continue;
      const qq = r.nearest(x, z);
      if (Math.abs(qq.lateral) < r.halfWidth + margin + 1 && qq.s > -2 && qq.s < r.length + 2) return true;
    }
    return false;
  };
  const shoulderW = cfg.edge === 'offroad' ? hw + SHOULDER_WIDTH : hw + 14;
  const heightAtOffset = (roadY: number, off: number) => {
    if (cfg.edge === 'fall') return roadY;
    if (off <= shoulderW) return roadY;
    const sk = cfg.edge === 'offroad' ? 18 : 10;
    return lerp(roadY, groundLevel, Math.min(1, (off - shoulderW) / sk));
  };
  for (const pc of cfg.props) {
    const builder = PROP_BUILDERS[pc.type];
    if (!builder) continue;
    const detail = ['bush', 'fern', 'rockSmall', 'moonRock', 'bollard', 'fence', 'wheat', 'rockSnow'].includes(pc.type);
    for (let v = 0; v < VARIANTS; v++) {
      const key = `${pc.type}#${v}`;
      if (!propGeos.has(key)) propGeos.set(key, { ...bakeGroup(builder()), detail });
    }
    const count = Math.round(((pc.density * main.length) / 100) * q.propDensity);
    for (let i = 0; i < count; i++) {
      const s = rng() * main.length;
      const sideSel = pc.side === 'left' ? -1 : pc.side === 'right' ? 1 : rng() < 0.5 ? -1 : 1;
      const off = pc.minOff + rng() * (pc.maxOff - pc.minOff);
      const p = main.pointAt(s);
      const x = p.x + p.rx * off * sideSel;
      const z = p.z + p.rz * off * sideSel;
      if (onOtherRoad(x, z, 2.5)) continue;
      let y = heightAtOffset(p.y, off);
      if (pc.type === 'cloud') y = p.y - 6 - rng() * 30;
      if (pc.type === 'floatingIsland') y = p.y - 10 - rng() * 25;
      if (pc.type === 'fence' || pc.type === 'streetLamp' || pc.type === 'bollard') {
        // 沿道路方向摆放
      }
      const sc = pc.scale[0] + rng() * (pc.scale[1] - pc.scale[0]);
      let yaw = rng() * Math.PI * 2;
      if (pc.type === 'fence' || pc.type === 'streetLamp' || pc.type === 'neonSign' || pc.type === 'bollard') {
        yaw = Math.atan2(p.tx, p.tz) + (pc.type === 'streetLamp' ? (sideSel > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI : 0);
        if (pc.type === 'streetLamp') yaw = Math.atan2(-p.rx * sideSel, -p.rz * sideSel);
        if (pc.type === 'neonSign') yaw = Math.atan2(p.rx * -sideSel, p.rz * -sideSel);
        if (pc.type === 'fence') yaw = Math.atan2(p.tx, p.tz) + Math.PI / 2;
      }
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), new THREE.Vector3(sc, sc, sc));
      const key = `${pc.type}#${Math.floor(rng() * VARIANTS)}`;
      const bucket = chunkBuckets[chunkOf(s)];
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(m);
    }
  }
  const litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  disposables.push(litMat, glowMat);
  chunkBuckets.forEach((bucket, ci) => {
    const ch: Chunk = { meshes: [], center: chunkCenters[ci], radius: (main.length / CHUNKS) * 0.8 + 80, detail: false };
    const detailCh: Chunk = { meshes: [], center: chunkCenters[ci], radius: ch.radius, detail: true };
    bucket.forEach((mats, key) => {
      const pg = propGeos.get(key)!;
      for (const [g, mat] of [
        [pg.lit, litMat],
        [pg.glow, glowMat],
      ] as const) {
        if (!g) continue;
        const im = new THREE.InstancedMesh(g, mat, mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = q.shadows && !pg.detail;
        im.receiveShadow = false;
        im.computeBoundingSphere();
        root.add(im);
        (pg.detail ? detailCh : ch).meshes.push(im);
      }
    });
    chunks.push(ch, detailCh);
  });
  propGeos.forEach((pg) => {
    if (pg.lit) disposables.push(pg.lit);
    if (pg.glow) disposables.push(pg.glow);
  });

  // ——— 地标 ———
  for (const lm of cfg.landmarks) {
    const b = LANDMARK_BUILDERS[lm.type];
    if (!b) continue;
    const g = b();
    const L = main.length;
    const p = main.pointAt(lm.t * L);
    if (lm.type === 'volcano') {
      g.position.set(cx, groundLevel, cz);
      g.scale.setScalar(0.9);
    } else if (lm.type === 'earth') {
      g.position.set(cx + 500, 380, cz - 700);
    } else if (lm.type === 'cargoShip') {
      g.position.set(p.x + p.rx * -90, waterLevel ?? 0, p.z + p.rz * -90);
      g.rotation.y = Math.atan2(p.tx, p.tz);
    } else {
      const x = p.x + p.rx * lm.offset * lm.side;
      const z = p.z + p.rz * lm.offset * lm.side;
      let y = heightAtOffset(p.y, lm.offset);
      if (lm.type === 'rainbowArc' || lm.type === 'skyCastle') y = p.y - 25;
      if (lm.type === 'mountain' || lm.type === 'mesa') y = groundLevel;
      g.position.set(x, y, z);
      g.rotation.y = Math.atan2(-p.rx * lm.side, -p.rz * lm.side);
    }
    g.scale.multiplyScalar(lm.scale ?? 1);
    g.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = q.shadows && lm.type !== 'mountain' && lm.type !== 'volcano';
        m.receiveShadow = true;
      }
    });
    root.add(g);
    const blades = g.getObjectByName('blades');
    if (blades) animated.push((dt) => (blades.rotation.z += dt * 0.8));
    const wf = g.getObjectByName('waterfall');
    if (wf) {
      let t = 0;
      animated.push((dt) => {
        t += dt;
        ((wf as THREE.Mesh).material as THREE.MeshLambertMaterial).emissiveIntensity = 0.6 + Math.sin(t * 6) * 0.15;
      });
    }
  }

  // ——— 光照 ———
  // 光源由 Renderer 统一管理；这里只返回主题参数

  // ——— 小地图数据 ———
  const mm: [number, number][] = [];
  for (let s = 0; s < main.length; s += 8) {
    const p = main.pointAt(s);
    mm.push([p.x, p.z]);
  }
  const mmsc = geo.shortcuts.map((sc) => {
    const arr: [number, number][] = [];
    for (let s = 0; s <= sc.road.length; s += 8) {
      const p = sc.road.pointAt(s);
      arr.push([p.x, p.z]);
    }
    return arr;
  });

  let time = 0;
  return {
    geo,
    root,
    rampMeshes,
    startLights,
    minimap: { main: mm, shortcuts: mmsc, bounds: { minX: main.minX, maxX: main.maxX, minZ: main.minZ, maxZ: main.maxZ } },
    groundLevel,
    waterLevel,
    lavaY,
    obstacleRefs,
    update(dt: number, camPos: THREE.Vector3) {
      time += dt;
      sky.position.copy(camPos);
      for (const a of animated) a(dt, time);
      // 分区 LOD：远处隐藏细节布景，超出视距隐藏整块
      const dd = q.drawDistance;
      for (const ch of chunks) {
        const d = ch.center.distanceTo(camPos) - ch.radius;
        const vis = d < (ch.detail ? dd * 0.45 : dd);
        for (const m of ch.meshes) m.visible = vis;
      }
    },
    dispose() {
      root.removeFromParent();
      for (const d of disposables) d.dispose();
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}

/** 捷径的主题造型（木栈道、隧道、沙丘、冰洞、瀑布、熔岩隧道、货船甲板、谷仓、彩虹桥、陨石坑） */
function buildShortcutVisual(
  road: Road,
  style: string,
  surface: string,
  cfg: TrackConfig,
  root: THREE.Group,
  disposables: { dispose: () => void }[],
  animated: ((dt: number, t: number) => void)[],
  groundLevel: number,
  waterLevel: number | null,
) {
  const n = road.count;
  const hw = road.halfWidth;
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    root.add(mesh);
    disposables.push(g);
    return mesh;
  };
  const surfColor: Record<string, number> = { wood: 0xa8763e, neon: 0x15151f, sand: 0xe6c07a, ice: 0xcfefff, dirt: 0x8a6440, rock: 0x3b3433, metal: 0x7b8590, rainbow: 0xffffff, moon: 0x6c6c76 };
  const tex = roadTexture(surface, surfColor[surface] ?? 0x666666, surface === 'rock' ? 0xffa020 : 0xffffff);
  disposables.push(tex);
  add(ribbon(road, 0, n - 1, [-hw, 0.06], [hw, 0.06], 12), new THREE.MeshLambertMaterial({ map: tex }));
  const base = waterLevel ?? groundLevel;
  const ds = THREE.DoubleSide;
  const midRange = (u0: number, u1: number) => [road.indexAt(road.length * u0), road.indexAt(road.length * u1)] as const;

  const tunnel = (u0: number, u1: number, wallCol: number, roofCol: number, h: number, stripCol?: number, opacity = 1) => {
    const [i0, i1] = midRange(u0, u1);
    const wm = new THREE.MeshLambertMaterial({ color: wallCol, side: ds, transparent: opacity < 1, opacity });
    const rm = new THREE.MeshLambertMaterial({ color: roofCol, side: ds, transparent: opacity < 1, opacity });
    add(ribbon(road, i0, i1, [-hw - 0.6, 0], [-hw - 0.6, h]), wm);
    add(ribbon(road, i0, i1, [hw + 0.6, h], [hw + 0.6, 0]), wm);
    add(ribbon(road, i0, i1, [-hw - 0.6, h], [-hw * 0.4, h + 1.4]), rm);
    add(ribbon(road, i0, i1, [-hw * 0.4, h + 1.4], [hw * 0.4, h + 1.4]), rm);
    add(ribbon(road, i0, i1, [hw * 0.4, h + 1.4], [hw + 0.6, h]), rm);
    if (stripCol !== undefined) {
      add(ribbon(road, i0, i1, [-hw * 0.3, h + 1.3], [hw * 0.3, h + 1.3]), glow(stripCol));
      add(ribbon(road, i0, i1, [-hw - 0.5, 0.6], [-hw - 0.5, 0.9]), glow(stripCol));
      add(ribbon(road, i0, i1, [hw + 0.5, 0.9], [hw + 0.5, 0.6]), glow(stripCol));
    }
  };
  const sideWalls = (col: number, h: number) => {
    const m = new THREE.MeshLambertMaterial({ color: col, side: ds });
    const [i0, i1] = midRange(0.12, 0.88);
    add(ribbon(road, i0, i1, [-hw - 0.5, 0], [-hw - 0.5, h]), m);
    add(ribbon(road, i0, i1, [hw + 0.5, h], [hw + 0.5, 0]), m);
  };
  const support = (col: number, toY: number) => {
    const m = new THREE.MeshLambertMaterial({ color: col, side: ds });
    add(ribbon(road, 0, n - 1, [-hw - 0.5, 0], [-hw - 6, toY, true]), m);
    add(ribbon(road, 0, n - 1, [hw + 6, toY, true], [hw + 0.5, 0]), m);
  };

  switch (style) {
    case 'boardwalk': {
      const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 1, 6);
      disposables.push(postGeo);
      const mats: THREE.Matrix4[] = [];
      for (let s = 0; s < road.length; s += 4) {
        const p = road.pointAt(s);
        const h = p.y - base + 0.5;
        if (h < 0.3) continue;
        for (const side of [-1, 1]) mats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x + p.rx * side * (hw - 0.4), base + h / 2 - 0.3, p.z + p.rz * side * (hw - 0.4)), new THREE.Quaternion(), new THREE.Vector3(1, h, 1)));
      }
      const im = new THREE.InstancedMesh(postGeo, lambert(0x6b4a2a), mats.length);
      mats.forEach((m, i) => im.setMatrixAt(i, m));
      root.add(im);
      const rail = new THREE.MeshLambertMaterial({ color: 0x8d5a2b, side: ds });
      add(ribbon(road, 0, n - 1, [-hw - 0.2, 0.9], [-hw - 0.2, 1.05]), rail);
      add(ribbon(road, 0, n - 1, [hw + 0.2, 1.05], [hw + 0.2, 0.9]), rail);
      break;
    }
    case 'tunnel':
      tunnel(0.18, 0.82, 0x3a3a48, 0x2a2a35, 4.5, 0xff3cac);
      sideWalls(0x5a5a72, 1.3);
      support(0x3a3a48, base);
      break;
    case 'dune':
      support(0xe6b56b, groundLevel);
      break;
    case 'iceCave':
      tunnel(0.2, 0.8, 0x9fd8ff, 0xcfefff, 5, 0x7affff, 0.75);
      {
        const ic = new THREE.ConeGeometry(0.3, 1.6, 5);
        disposables.push(ic);
        const mats: THREE.Matrix4[] = [];
        for (let s = road.length * 0.22; s < road.length * 0.78; s += 3) {
          const p = road.pointAt(s);
          const l = (Math.random() - 0.5) * hw * 1.4;
          mats.push(new THREE.Matrix4().compose(new THREE.Vector3(p.x + p.rx * l, p.y + 5.6, p.z + p.rz * l), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)), new THREE.Vector3(1, 0.6 + Math.random(), 1)));
        }
        const im = new THREE.InstancedMesh(ic, glow(0xdff6ff, 0.85), mats.length);
        mats.forEach((m, i) => im.setMatrixAt(i, m));
        root.add(im);
      }
      support(0xeaf2fd, groundLevel);
      break;
    case 'waterfall': {
      support(0x4f9a40, groundLevel);
      sideWalls(0x6b6b5a, 3);
      const p = road.pointAt(road.length * 0.5);
      const wtex = canvasTexture(64, 128, (ctx) => {
        ctx.fillStyle = '#7fd8ff';
        ctx.fillRect(0, 0, 64, 128);
        for (let i = 0; i < 30; i++) {
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(Math.random() * 64, Math.random() * 128, 2, 20 + Math.random() * 30);
        }
      });
      disposables.push(wtex);
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2 + 6, 12), new THREE.MeshBasicMaterial({ map: wtex, transparent: true, opacity: 0.6, side: ds, depthWrite: false }));
      curtain.position.set(p.x, p.y + 6, p.z);
      curtain.rotation.y = Math.atan2(p.tx, p.tz);
      root.add(curtain);
      const rock = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 10, 6, 6), lambert(0x6b6b5a));
      rock.position.set(p.x, p.y + 15, p.z);
      rock.rotation.y = curtain.rotation.y;
      root.add(rock);
      animated.push((dt) => {
        wtex.offset.y -= dt * 1.8;
      });
      break;
    }
    case 'lavaTube':
      tunnel(0.15, 0.85, 0x2b1d1d, 0x1d1414, 5, 0xff5a1f);
      support(0x2b2222, groundLevel);
      break;
    case 'shipDeck': {
      const hull = new THREE.MeshLambertMaterial({ color: 0x2f3a4a, side: ds });
      add(ribbon(road, 0, n - 1, [-hw - 3, 0], [-hw - 3, (waterLevel ?? groundLevel) - 1, true]), hull);
      add(ribbon(road, 0, n - 1, [hw + 3, (waterLevel ?? groundLevel) - 1, true], [hw + 3, 0]), hull);
      add(ribbon(road, 0, n - 1, [-hw - 3, 0.02], [-hw, 0.02]), lambert(0x5b6b7a));
      add(ribbon(road, 0, n - 1, [hw, 0.02], [hw + 3, 0.02]), lambert(0x5b6b7a));
      const rail = new THREE.MeshLambertMaterial({ color: 0xffffff, side: ds });
      add(ribbon(road, 0, n - 1, [-hw - 2.9, 1], [-hw - 2.9, 1.15]), rail);
      add(ribbon(road, 0, n - 1, [hw + 2.9, 1.15], [hw + 2.9, 1]), rail);
      add(ribbon(road, 0, n - 1, [-hw - 3.02, -0.5], [-hw - 3.02, -1.5]), lambert(0xd63a2f));
      add(ribbon(road, 0, n - 1, [hw + 3.02, -1.5], [hw + 3.02, -0.5]), lambert(0xd63a2f));
      break;
    }
    case 'barn':
      tunnel(0.3, 0.7, 0xb83b2e, 0x6b2a20, 5.5);
      support(0x86c95a, groundLevel);
      break;
    case 'rainbowBridge': {
      const rim = glow(0xffffff);
      add(ribbon(road, 0, n - 1, [-hw - 0.4, 0.1], [-hw - 0.4, 0.5]), rim);
      add(ribbon(road, 0, n - 1, [hw + 0.4, 0.5], [hw + 0.4, 0.1]), rim);
      add(ribbon(road, 0, n - 1, [hw, -0.8], [-hw, -0.8]), new THREE.MeshLambertMaterial({ color: 0xffd6f2, side: ds }));
      break;
    }
    case 'crater': {
      support(0x9a9aa2, groundLevel);
      const p = road.pointAt(road.length * 0.5);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(22, 3, 6, 24), lambert(0x8d8d96));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(p.x, p.y - 2, p.z);
      root.add(rim);
      break;
    }
  }
  void cfg;
  void SURFACES;
}
