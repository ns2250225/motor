import * as THREE from 'three';
import type { TrackGeometry } from '../tracks/TrackGeometry';
import { SHOULDER_WIDTH } from '../tracks/TrackGeometry';
import type { Physics, ObstacleRef } from '../core/Physics';
import type { ItemSystem } from './ItemSystem';
import { ribbon, wedgeGeometry, buildSky } from '../tracks/TrackLoader';
import { PROP_BUILDERS, bakeGroup, buildObstacle } from '../tracks/Props';
import { getTrack, ENDLESS_THEMES, TrackConfig } from '../tracks/TrackConfig';
import { roadTexture, canvasTexture, hex, lambert } from '../utils/materials';
import { rand, pick } from '../utils/math';
import type { Renderer } from '../core/Renderer';

interface EndlessChunk {
  i0: number;
  i1: number;
  sEnd: number;
  group: THREE.Group;
  refs: ObstacleRef[];
  ground: ReturnType<Physics['addGroundMesh']> | null;
  disposables: { dispose: () => void }[];
}

const THEME_LENGTH = 1800;

/** 无尽公路：沿途无限生成道路分段，主题循环切换，身后的分段回收 */
export class EndlessManager {
  private chunks: EndlessChunk[] = [];
  private heading = 0;
  private builtUpTo = 0; // 已构建可视化的采样索引
  private sky: THREE.Group;
  private skyMat: THREE.ShaderMaterial;
  private groundPlane: THREE.Mesh;
  private themeIdx = 0;
  private propCache = new Map<string, { lit: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null }>();
  private litMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
  private curTop = new THREE.Color();
  private curBottom = new THREE.Color();
  private curFog = new THREE.Color();
  private curGround = new THREE.Color();
  private rampId = 1000;

  constructor(
    private geo: TrackGeometry,
    private scene: THREE.Scene,
    private root: THREE.Group,
    private physics: Physics,
    private items: ItemSystem,
    private renderer: Renderer,
    private propDensity: number,
  ) {
    const pal = this.theme.palette;
    this.sky = buildSky(pal.skyTop, pal.skyBottom, false);
    this.skyMat = (this.sky.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    root.add(this.sky);
    this.groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: pal.ground }));
    this.groundPlane.position.y = -4;
    this.groundPlane.receiveShadow = true;
    root.add(this.groundPlane);
    this.curTop.setHex(pal.skyTop);
    this.curBottom.setHex(pal.skyBottom);
    this.curFog.setHex(pal.fog);
    this.curGround.setHex(pal.ground);
    scene.fog = new THREE.Fog(pal.fog, pal.fogNear, pal.fogFar);
    scene.background = new THREE.Color(pal.skyBottom);
    physics.addGroundPlane(-4);
    this.extend(1200);
  }

  get theme(): TrackConfig {
    return getTrack(ENDLESS_THEMES[this.themeIdx % ENDLESS_THEMES.length]);
  }

  private themeAt(s: number) {
    return getTrack(ENDLESS_THEMES[Math.floor(s / THEME_LENGTH) % ENDLESS_THEMES.length]);
  }

  /** 生成新的控制点直到道路长度达到 target */
  private extend(target: number) {
    const road = this.geo.main;
    while (road.length < target) {
      const pts: THREE.Vector3[] = [];
      let last = road.lastControl.clone();
      for (let i = 0; i < 10; i++) {
        this.heading += rand(-0.22, 0.22) - this.heading * 0.08;
        const y = Math.max(0, Math.min(10, last.y + rand(-1.2, 1.2)));
        const p = new THREE.Vector3(last.x + Math.sin(this.heading) * 25, y, last.z + Math.cos(this.heading) * 25);
        pts.push(p);
        last = p;
      }
      road.appendControlPoints(pts);
    }
    // 构建尚未可视化的分段（保留最后两段用于平滑）
    const maxIdx = road.count - 30;
    while (this.builtUpTo < maxIdx - 10) {
      const i0 = this.builtUpTo;
      const i1 = Math.min(maxIdx, i0 + 120);
      this.buildChunk(i0, i1);
      this.builtUpTo = i1;
    }
  }

  private buildChunk(i0: number, i1: number) {
    const road = this.geo.main;
    const s0 = road.s[i0];
    const s1 = road.s[i1];
    const cfg = this.themeAt(s0);
    const pal = cfg.palette;
    const hw = road.halfWidth;
    const group = new THREE.Group();
    const disposables: { dispose: () => void }[] = [];
    const refs: ObstacleRef[] = [];
    const add = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.receiveShadow = true;
      group.add(mesh);
      disposables.push(g);
      return mesh;
    };
    const tex = roadTexture(cfg.surface === 'rainbow' ? 'asphalt' : cfg.surface, pal.road, pal.roadLine);
    disposables.push(tex);
    add(ribbon(road, i0, i1, [-hw, 0.02], [hw, 0.02], 16), new THREE.MeshLambertMaterial({ map: tex }));
    const curb = canvasTexture(16, 64, (ctx) => {
      ctx.fillStyle = hex(pal.curbA);
      ctx.fillRect(0, 0, 16, 32);
      ctx.fillStyle = hex(pal.curbB);
      ctx.fillRect(0, 32, 16, 32);
    });
    disposables.push(curb);
    const cm = new THREE.MeshLambertMaterial({ map: curb });
    add(ribbon(road, i0, i1, [hw, 0.04], [hw + 1, 0.12], 4), cm);
    add(ribbon(road, i0, i1, [-hw - 1, 0.12], [-hw, 0.04], 4), cm);
    const sh = lambert(pal.shoulder);
    const W = hw + SHOULDER_WIDTH;
    add(ribbon(road, i0, i1, [hw + 1, 0], [W, 0], 12), sh);
    add(ribbon(road, i0, i1, [-W, 0], [-hw - 1, 0], 12), sh);
    add(ribbon(road, i0, i1, [W, 0], [W + 14, -4, true], 12), sh);
    add(ribbon(road, i0, i1, [-W - 14, -4, true], [-W, 0], 12), sh);
    const wm = new THREE.MeshLambertMaterial({ color: pal.wall, side: THREE.DoubleSide });
    add(ribbon(road, i0, i1, [W, 0], [W, 1], 8), wm);
    add(ribbon(road, i0, i1, [-W, 1], [-W, 0], 8), wm);

    // 布景
    const mats = new Map<string, THREE.Matrix4[]>();
    for (const pc of cfg.props) {
      if (!PROP_BUILDERS[pc.type] || pc.type === 'cloud' || pc.type === 'floatingIsland') continue;
      const count = Math.round(((pc.density * (s1 - s0)) / 100) * this.propDensity * 0.8);
      for (let k = 0; k < count; k++) {
        const s = s0 + Math.random() * (s1 - s0);
        const side = Math.random() < 0.5 ? -1 : 1;
        const off = Math.min(pc.maxOff, W - 1) * Math.random() + Math.min(pc.minOff, W - 2) * 0.5 + hw * 0.5;
        if (off < hw + 3) continue;
        const p = road.pointAt(s);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(p.x + p.rx * off * side, p.y, p.z + p.rz * off * side),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * 6.28, 0)),
          new THREE.Vector3().setScalar(pc.scale[0] + Math.random() * (pc.scale[1] - pc.scale[0])),
        );
        const key = pc.type;
        if (!mats.has(key)) mats.set(key, []);
        mats.get(key)!.push(m);
      }
    }
    mats.forEach((list, key) => {
      let pg = this.propCache.get(key);
      if (!pg) {
        pg = bakeGroup(PROP_BUILDERS[key]());
        this.propCache.set(key, pg);
      }
      for (const [g, mat] of [
        [pg.lit, this.litMat],
        [pg.glow, this.glowMat],
      ] as const) {
        if (!g) continue;
        const im = new THREE.InstancedMesh(g, mat, list.length);
        list.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = true;
        im.computeBoundingSphere();
        group.add(im);
      }
    });

    // 玩法要素：障碍、跳台、加速带、道具箱
    const types = cfg.randomObstacles.types;
    for (let s = s0 + 40; s < s1 - 10; s += rand(35, 70)) {
      if (s < 250) continue;
      const roll = Math.random();
      const p = road.pointAt(s);
      if (roll < 0.5) {
        // 障碍（单个或成排）
        const n = Math.random() < 0.4 ? 3 : 1;
        const lat0 = rand(-hw + 2, hw - 2);
        for (let k = 0; k < n; k++) {
          const lat = n === 1 ? lat0 : -hw + 2.5 + k * ((hw * 2 - 5) / 2) + (Math.random() < 0.5 ? 0 : 99);
          if (Math.abs(lat) > hw) continue;
          const model = buildObstacle(pick(types));
          const x = p.x + p.rx * lat;
          const z = p.z + p.rz * lat;
          const yaw = Math.atan2(p.tx, p.tz);
          const cy = model.shape === 'ball' ? model.half[0] : model.half[1];
          const wrapper = new THREE.Group();
          wrapper.position.set(x, p.y + cy, z);
          wrapper.rotation.y = yaw;
          model.group.position.y = -cy;
          wrapper.add(model.group);
          group.add(wrapper);
          const ref = { kind: (model.breakable ? 'breakable' : 'solid') as 'breakable' | 'solid', type: 'obs', mesh: wrapper };
          const r =
            model.shape === 'box'
              ? this.physics.addStaticBox(x, p.y + cy, z, model.half[0], model.half[1], model.half[2], yaw, ref)
              : this.physics.addStaticCylinder(x, p.y + cy, z, model.half[0], model.shape === 'ball' ? model.half[0] : model.half[1], ref);
          refs.push(r);
        }
      } else if (roll < 0.68) {
        const r = { id: this.rampId++, s, lateral: rand(-3, 3), width: 7, length: 9, height: 1.8, baseHeight: 1.8, dynamic: false };
        this.geo.ramps.push(r);
        const mesh = new THREE.Mesh(wedgeGeometry(r.width, r.length), new THREE.MeshLambertMaterial({ color: 0xffd23f }));
        mesh.position.set(p.x + p.rx * r.lateral, p.y + 0.03, p.z + p.rz * r.lateral);
        mesh.rotation.y = Math.atan2(p.tx, p.tz);
        mesh.scale.y = r.height;
        mesh.castShadow = true;
        group.add(mesh);
        disposables.push(mesh.geometry);
      } else if (roll < 0.82) {
        const lat = rand(-hw + 3, hw - 3);
        this.geo.boostPads.push({ s, lateral: lat });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x00d5ff, transparent: true, opacity: 0.8 }));
        const pp = road.pointAt(s + 2);
        m.position.set(pp.x + pp.rx * lat, pp.y + 0.08, pp.z + pp.rz * lat);
        m.rotation.y = Math.atan2(pp.tx, pp.tz);
        group.add(m);
        disposables.push(m.geometry);
      } else {
        for (let k = 0; k < 4; k++) {
          const lat = (k - 1.5) * ((hw * 2 - 4) / 3);
          this.items.addBox(p.x + p.rx * lat, p.y, p.z + p.rz * lat);
        }
      }
    }

    // 碎片用地面
    const verts: number[] = [];
    const ids: number[] = [];
    for (let i = i0; i <= i1; i++) {
      const rx = -road.tz[i];
      const rz = road.tx[i];
      verts.push(road.px[i] - rx * W, road.py[i], road.pz[i] - rz * W, road.px[i] + rx * W, road.py[i], road.pz[i] + rz * W);
      if (i > i0) {
        const p = (i - i0 - 1) * 2;
        ids.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
      }
    }
    const ground = this.physics.addGroundMesh(new Float32Array(verts), new Uint32Array(ids));
    this.root.add(group);
    this.chunks.push({ i0, i1, sEnd: s1, group, refs, ground, disposables });
  }

  update(dt: number, playerS: number, camPos: THREE.Vector3) {
    const road = this.geo.main;
    if (road.length - playerS < 900) this.extend(road.length + 600);
    // 回收身后分段
    while (this.chunks.length && this.chunks[0].sEnd < playerS - 260) {
      const c = this.chunks.shift()!;
      c.group.removeFromParent();
      for (const d of c.disposables) d.dispose();
      for (const r of c.refs) this.physics.removeRef(r);
      if (c.ground) this.physics.removeCollider(c.ground);
      const cutS = c.sEnd;
      this.items.pruneBoxes((b) => {
        const q = road.nearest(b.x, b.z, c.i1);
        return q.s < cutS;
      });
      this.geo.ramps = this.geo.ramps.filter((r) => r.s > cutS - 20);
      this.geo.boostPads = this.geo.boostPads.filter((b) => b.s > cutS - 20);
    }
    // 主题渐变
    const t = this.themeAt(playerS);
    const pal = t.palette;
    const k = 1 - Math.exp(-dt * 0.6);
    this.curTop.lerp(new THREE.Color(pal.skyTop), k);
    this.curBottom.lerp(new THREE.Color(pal.skyBottom), k);
    this.curFog.lerp(new THREE.Color(pal.fog), k);
    this.curGround.lerp(new THREE.Color(pal.ground), k);
    this.skyMat.uniforms.top.value.copy(this.curTop);
    this.skyMat.uniforms.bottom.value.copy(this.curBottom);
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(this.curFog);
    (this.scene.background as THREE.Color).copy(this.curBottom);
    (this.groundPlane.material as THREE.MeshLambertMaterial).color.copy(this.curGround);
    this.renderer.setLighting(pal.skyTop, pal.hemiGround, pal.ambient, pal.sun, pal.sunIntensity);
    this.sky.position.copy(camPos);
    this.groundPlane.position.x = camPos.x;
    this.groundPlane.position.z = camPos.z;
    const idx = ENDLESS_THEMES.indexOf(t.id);
    if (idx !== this.themeIdx) this.themeIdx = idx;
  }

  get themeName() {
    return this.themeAt(0).name;
  }

  dispose() {
    for (const c of this.chunks) {
      c.group.removeFromParent();
      for (const d of c.disposables) d.dispose();
    }
    this.chunks = [];
    this.litMat.dispose();
    this.glowMat.dispose();
  }
}
