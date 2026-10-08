import { Vector3 } from 'three';
import { Road, RoadQuery } from './Road';
import type { ObstacleType, ShortcutConfig, SurfaceType, TrackConfig } from './TrackConfig';
import { seededRandom, hashString } from '../utils/math';

export interface RampInstance {
  id: number;
  s: number;
  lateral: number;
  width: number;
  length: number;
  height: number;
  baseHeight: number;
  dynamic: boolean;
}

export interface GapInstance {
  s0: number;
  s1: number;
}

export interface ShortcutInstance {
  cfg: ShortcutConfig;
  road: Road;
  s0: number;
  s1: number;
}

export interface PlacedFeature {
  s: number;
  lateral: number;
}

export interface PlacedObstacle extends PlacedFeature {
  type: ObstacleType;
}

export interface ExtraSurface {
  /** 世界坐标轴对齐盒（顶面可行驶） */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number;
  surface: SurfaceType;
  active: boolean;
}

export interface GroundInfo {
  /** null 表示脚下没有地面（掉落） */
  y: number | null;
  surface: SurfaceType | 'offroad';
  onRoad: boolean;
  /** 0=主赛道，k>0 为第 k 条捷径，-1 为路外 */
  roadIdx: number;
  mainS: number;
  mainLateral: number;
  mainIndex: number;
  shortcutU: number;
  /** 需要被推回的护栏法线与穿透深度 */
  barrierNx: number;
  barrierNz: number;
  barrierDepth: number;
  boost: boolean;
  rampId: number;
  tx: number;
  tz: number;
}

export const SHOULDER_WIDTH = 24;

/** 赛道几何运行时：负责道路/捷径/跳台/缺口与地面查询 */
export class TrackGeometry {
  main: Road;
  shortcuts: ShortcutInstance[] = [];
  ramps: RampInstance[] = [];
  gaps: GapInstance[] = [];
  boostPads: PlacedFeature[] = [];
  itemBoxes: PlacedFeature[] = [];
  obstacles: PlacedObstacle[] = [];
  surfaceZones: { s0: number; s1: number; surface: SurfaceType }[] = [];
  extraSurfaces: ExtraSurface[] = [];
  landingZones: number[] = [];
  checkpointS: number[] = [];
  edge: TrackConfig['edge'];
  private q: RoadQuery = { index: 0, s: 0, lateral: 0, y: 0, tx: 0, tz: 1, dist2: 0 };
  private q2: RoadQuery = { index: 0, s: 0, lateral: 0, y: 0, tx: 0, tz: 1, dist2: 0 };
  private rng: () => number;

  constructor(public cfg: TrackConfig, endless = false) {
    this.edge = cfg.edge;
    this.rng = seededRandom(hashString(cfg.id));
    if (endless) {
      this.main = Road.fromControlPoints('main', TrackGeometry.endlessStart(), false, cfg.width);
    } else {
      this.main = Road.fromControlPoints('main', TrackGeometry.controlPoints(cfg), true, cfg.width);
      cfg.length = Math.round(this.main.length);
      this.buildShortcuts();
      this.placeFeatures();
      this.checkpointS = cfg.checkpoints.map((c) => c.t * this.main.length);
    }
  }

  static controlPoints(cfg: TrackConfig) {
    const n = 64;
    const pts: Vector3[] = [];
    const sh = cfg.shape;
    for (let i = 0; i < n; i++) {
      const th = (i / n) * Math.PI * 2;
      let r = 1;
      for (const [a, f, p] of sh.harmonics) r += a * Math.sin(f * th + p);
      r *= sh.radius;
      let y = sh.baseHeight;
      for (const [a, f, p] of sh.elevation) y += a * Math.sin(f * th + p);
      pts.push(new Vector3(Math.cos(th) * r * sh.sx, y, Math.sin(th) * r * sh.sz));
    }
    return pts;
  }

  static endlessStart() {
    const pts: Vector3[] = [];
    for (let i = -3; i < 30; i++) pts.push(new Vector3(0, 2, i * 25));
    return pts;
  }

  get length() {
    return this.main.length;
  }

  private buildShortcuts() {
    for (const sc of this.cfg.shortcuts) {
      const L = this.main.length;
      const s0 = sc.t0 * L;
      const s1 = sc.t1 * L;
      const A = this.main.pointAt(s0);
      const B = this.main.pointAt(s1);
      const pts: Vector3[] = [];
      const K = Math.max(8, Math.round((s1 - s0) / 12));
      for (let k = 0; k <= K; k++) {
        const u = k / K;
        const M = this.main.pointAt(s0 + u * (s1 - s0));
        const cx = A.x + (B.x - A.x) * u;
        const cz = A.z + (B.z - A.z) * u;
        const cy = A.y + (B.y - A.y) * u;
        const w = sc.blend * Math.pow(Math.sin(Math.PI * u), 0.9);
        // 两端坡度为零，避免捷径入口变成意外的跳台
        const lift = sc.lift * Math.pow(Math.sin(Math.PI * u), 2);
        pts.push(new Vector3(M.x + (cx - M.x) * w, M.y + (cy - M.y) * w + lift, M.z + (cz - M.z) * w));
      }
      const road = Road.fromControlPoints(sc.id, pts, false, sc.width);
      this.shortcuts.push({ cfg: sc, road, s0, s1 });
    }
  }

  private nearFeature(s: number, list: number[], dist: number) {
    return list.some((x) => Math.abs(this.main.deltaS(x, s)) < dist);
  }

  private placeFeatures() {
    const L = this.main.length;
    const cfg = this.cfg;
    let id = 0;
    for (const r of cfg.ramps) {
      const s = r.t * L;
      this.ramps.push({ id: id++, s, lateral: r.lateral, width: r.width, length: r.length, height: r.height, baseHeight: r.height, dynamic: false });
    }
    for (const g of cfg.gaps) {
      const s0 = g.t * L;
      this.gaps.push({ s0, s1: s0 + g.length });
      // 缺口前自动放置全宽跳台与加速带
      this.ramps.push({ id: id++, s: s0 - 11, lateral: 0, width: cfg.width, length: 10, height: 2.6, baseHeight: 2.6, dynamic: false });
      this.boostPads.push({ s: s0 - 36, lateral: -3 }, { s: s0 - 36, lateral: 3 });
    }
    for (const h of cfg.hazards) {
      if (h.type === 'liftRamp') {
        this.ramps.push({ id: id++, s: h.t * L, lateral: 0, width: cfg.width - 2, length: 12, height: 2, baseHeight: 2, dynamic: true });
      }
    }
    for (const b of cfg.boostPads) this.boostPads.push({ s: b.t * L, lateral: b.lateral });
    const hw = cfg.width / 2;
    for (const t of cfg.itemRows) {
      const n = 4;
      for (let k = 0; k < n; k++) this.itemBoxes.push({ s: t * L, lateral: (k - (n - 1) / 2) * ((hw * 2 - 4) / (n - 1)) });
    }
    for (const z of cfg.surfaceZones) this.surfaceZones.push({ s0: z.t0 * L, s1: z.t1 * L, surface: z.surface });
    for (const o of cfg.obstacles) this.obstacles.push({ type: o.type, s: o.t * L, lateral: o.lateral });
    // 随机障碍（可复现）
    // 跳台落地区不放障碍（低重力赛道飞得更远）
    const landing = 30 + 100 * Math.sqrt(25 / cfg.gravity);
    for (const r of this.ramps) for (let d = 0; d <= landing; d += 20) this.landingZones.push(r.s + d);
    const avoid = [
      0,
      ...this.landingZones,
      ...this.ramps.map((r) => r.s),
      ...this.gaps.map((g) => g.s0),
      ...this.boostPads.map((b) => b.s),
      ...cfg.itemRows.map((t) => t * L),
      ...this.shortcuts.map((s) => s.s0),
      ...this.shortcuts.map((s) => s.s1),
      ...cfg.hazards.map((h) => h.t * L),
    ];
    let tries = 0;
    let placed = 0;
    while (placed < cfg.randomObstacles.count && tries++ < 400) {
      const s = (0.05 + this.rng() * 0.92) * L;
      if (this.nearFeature(s, avoid, 28)) continue;
      if (this.obstacles.some((o) => Math.abs(this.main.deltaS(o.s, s)) < 30)) continue;
      // 冰面/沙地等低抓地区域不放障碍
      if (this.surfaceZones.some((z) => s > z.s0 - 25 && s < z.s1 + 15)) continue;
      const type = cfg.randomObstacles.types[Math.floor(this.rng() * cfg.randomObstacles.types.length)];
      if (type === 'log') {
        // 倒木：靠一侧横放，另一半路面留出通道
        this.obstacles.push({ type, s, lateral: (this.rng() < 0.5 ? -1 : 1) * (hw - 2.6) });
        placed++;
        continue;
      }
      const lat = (this.rng() * 2 - 1) * (hw - 2.5);
      this.obstacles.push({ type, s, lateral: lat });
      // 偶尔成对出现，形成需要穿越的缝隙
      if (this.rng() < 0.35) this.obstacles.push({ type, s: s + 1, lateral: lat > 0 ? lat - 7 : lat + 7 });
      placed++;
    }
  }

  inGap(s: number) {
    for (const g of this.gaps) if (s >= g.s0 && s <= g.s1) return true;
    return false;
  }

  surfaceAt(s: number): SurfaceType {
    for (const z of this.surfaceZones) {
      if (z.s0 <= z.s1 ? s >= z.s0 && s <= z.s1 : s >= z.s0 || s <= z.s1) return z.surface;
    }
    return this.cfg.surface;
  }

  rampHeight(s: number, lat: number) {
    for (const r of this.ramps) {
      const d = this.main.closed ? this.main.deltaS(r.s, s) : s - r.s;
      if (d >= 0 && d <= r.length && Math.abs(lat - r.lateral) <= r.width / 2) {
        return { h: (r.height * d) / r.length, id: r.id };
      }
    }
    return null;
  }

  isBoost(s: number, lat: number) {
    for (const b of this.boostPads) {
      const d = this.main.closed ? this.main.deltaS(b.s, s) : s - b.s;
      if (d >= -1 && d <= 5 && Math.abs(lat - b.lateral) < 2.4) return true;
    }
    return false;
  }

  /** 捷径进度映射回主赛道进度 */
  shortcutToMain(k: number, sc: number) {
    const inst = this.shortcuts[k];
    const u = Math.max(0, Math.min(1, sc / inst.road.length));
    return { s: inst.s0 + u * (inst.s1 - inst.s0), u };
  }

  /**
   * 地面查询：综合主路、捷径、附加平台、护栏。
   * @param y 当前高度（用于判定是否能"登上"某个表面）
   */
  query(x: number, z: number, y: number, hint: number, out: GroundInfo): GroundInfo {
    const main = this.main;
    const q = main.nearest(x, z, hint, this.q);
    const hw = main.halfWidth;
    out.mainIndex = q.index;
    out.mainS = q.s;
    out.mainLateral = q.lateral;
    out.tx = q.tx;
    out.tz = q.tz;
    out.boost = false;
    out.rampId = -1;
    out.barrierDepth = 0;
    out.shortcutU = -1;

    let bestY = -Infinity;
    let surface: GroundInfo['surface'] = 'offroad';
    let roadIdx = -1;
    let onRoad = false;
    const stepUp = 1.4;

    // 主路面
    const absLat = Math.abs(q.lateral);
    if (absLat <= hw + 0.3 && !this.inGap(q.s)) {
      let h = q.y;
      const ramp = this.rampHeight(q.s, q.lateral);
      if (ramp) {
        h += ramp.h;
        out.rampId = ramp.id;
      }
      if (h <= y + stepUp + (ramp ? 3 : 0)) {
        bestY = h;
        surface = this.surfaceAt(q.s);
        roadIdx = 0;
        onRoad = true;
        out.boost = this.isBoost(q.s, q.lateral);
      }
    }

    // 捷径
    let scBand = Infinity;
    let scIdx = -1;
    let scLat = 0;
    let scTx = 0;
    let scTz = 0;
    let scY = 0;
    for (let k = 0; k < this.shortcuts.length; k++) {
      const sc = this.shortcuts[k];
      const r = sc.road;
      if (x < r.minX - 30 || x > r.maxX + 30 || z < r.minZ - 30 || z > r.maxZ + 30) continue;
      const q2 = r.nearest(x, z, -1, this.q2);
      const shw = r.halfWidth;
      const al = Math.abs(q2.lateral);
      if (q2.s < 0 || q2.s > r.length) continue;
      const excess = al - (shw + (this.edge === 'offroad' ? 3 : 0.5));
      if (excess < scBand) {
        scBand = excess;
        scIdx = k;
        scLat = q2.lateral;
        scTx = q2.tx;
        scTz = q2.tz;
        scY = q2.y;
      }
      if (al <= shw + 0.2 && q2.y <= y + stepUp) {
        // 与主路重叠时：高度明显更高、或更靠近捷径中心才切换到捷径
        const better =
          roadIdx !== 0 ? q2.y > bestY - 0.05 : q2.y > bestY + 0.5 || (Math.abs(q2.y - bestY) <= 0.5 && al < absLat);
        if (!better) continue;
        bestY = q2.y;
        surface = sc.cfg.surface;
        roadIdx = k + 1;
        onRoad = true;
        const m = this.shortcutToMain(k, q2.s);
        out.shortcutU = m.u;
        out.mainS = m.s;
        out.tx = q2.tx;
        out.tz = q2.tz;
      }
    }

    // 附加平台（货船甲板、升降平台等）
    for (const e of this.extraSurfaces) {
      if (!e.active) continue;
      if (x >= e.minX && x <= e.maxX && z >= e.minZ && z <= e.maxZ && e.top <= y + stepUp && e.top > bestY) {
        bestY = e.top;
        surface = e.surface;
        onRoad = true;
        if (roadIdx < 0) roadIdx = 0;
      }
    }

    // 路肩（越野边缘）
    const mainBand = absLat - (this.edge === 'offroad' ? hw + SHOULDER_WIDTH : this.edge === 'wall' ? hw + 0.2 : Infinity);
    if (!onRoad && this.edge === 'offroad' && mainBand <= 0) {
      bestY = q.y;
      surface = 'offroad';
      roadIdx = -1;
    } else if (!onRoad && this.edge !== 'fall' && scBand <= 0 && scY <= y + stepUp) {
      // 捷径两侧的路肩
      bestY = scY;
      surface = 'offroad';
      roadIdx = -1;
    }

    // 护栏：不在任何允许区域内则推回
    if (this.edge !== 'fall' && mainBand > 0 && scBand > 0) {
      if (mainBand <= scBand || scIdx < 0) {
        const sgn = Math.sign(q.lateral) || 1;
        out.barrierNx = -(-q.tz) * sgn;
        out.barrierNz = -q.tx * sgn;
        out.barrierDepth = mainBand;
        if (bestY === -Infinity) bestY = q.y;
      } else {
        const sgn = Math.sign(scLat) || 1;
        out.barrierNx = -(-scTz) * sgn;
        out.barrierNz = -scTx * sgn;
        out.barrierDepth = scBand;
        if (bestY === -Infinity) bestY = this.shortcuts[scIdx].road.nearest(x, z, -1, this.q2).y;
      }
    }

    out.y = bestY === -Infinity ? null : bestY;
    out.surface = surface;
    out.onRoad = onRoad;
    out.roadIdx = roadIdx;
    return out;
  }

  /** 找到 s 之后（含）第一个可安全重生的位置 */
  safeRespawnS(s: number) {
    let ss = this.main.wrapS(s);
    for (let i = 0; i < 60; i++) {
      let bad = this.inGap(ss) || this.inGap(ss + 6) || this.inGap(ss - 4);
      if (!bad) {
        for (const r of this.ramps) {
          const d = this.main.closed ? this.main.deltaS(r.s, ss) : ss - r.s;
          if (d > -6 && d < r.length + 2) bad = true;
        }
      }
      if (!bad) return ss;
      ss = this.main.wrapS(ss + 4);
    }
    return ss;
  }

  /** 检查点前进：根据新旧进度判断是否越过下一个检查点 */
  crossed(prevS: number, curS: number, target: number) {
    const L = this.main.length;
    const a = this.main.deltaS(prevS, target);
    const b = this.main.deltaS(curS, target);
    return a > 0 && b <= 0 && Math.abs(a - b) < L / 4;
  }
}
