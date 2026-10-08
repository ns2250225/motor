import { Vector3 } from 'three';

export interface RoadQuery {
  index: number;
  s: number;
  lateral: number;
  y: number;
  tx: number;
  tz: number;
  dist2: number;
}

export interface RoadPoint {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  rx: number;
  rz: number;
}

/**
 * 道路中心线：Catmull-Rom 样条按约固定间距采样，存储为结构数组（便于高频查询）。
 * 前进方向 f=(tx,tz)，右方向 r=(-tz,tx)；横向偏移 lateral>0 表示在右侧。
 */
export class Road {
  px: number[] = [];
  py: number[] = [];
  pz: number[] = [];
  tx: number[] = [];
  tz: number[] = [];
  slope: number[] = [];
  curv: number[] = [];
  s: number[] = [];
  length = 0;
  minX = Infinity;
  maxX = -Infinity;
  minZ = Infinity;
  maxZ = -Infinity;
  private control: Vector3[] = [];
  private sampledSegments = 0;

  constructor(public id: string, public closed: boolean, public width: number, public spacing = 2) {}

  get count() {
    return this.px.length;
  }
  get halfWidth() {
    return this.width / 2;
  }

  static fromControlPoints(id: string, pts: Vector3[], closed: boolean, width: number, spacing = 2) {
    const r = new Road(id, closed, width, spacing);
    r.control = pts.map((p) => p.clone());
    r.sampleAll();
    return r;
  }

  private cr(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, t: number, out: Vector3) {
    const t2 = t * t;
    const t3 = t2 * t;
    out.x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    out.y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    out.z = 0.5 * (2 * p1.z + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);
    return out;
  }

  private ctrl(i: number) {
    const n = this.control.length;
    if (this.closed) return this.control[((i % n) + n) % n];
    if (i < 0) {
      // 外推首点
      return this.control[0].clone().multiplyScalar(2).sub(this.control[1]);
    }
    if (i >= n) {
      return this.control[n - 1].clone().multiplyScalar(2).sub(this.control[n - 2]);
    }
    return this.control[i];
  }

  private pushSample(p: Vector3) {
    const n = this.px.length;
    if (n > 0) {
      const dx = p.x - this.px[n - 1];
      const dz = p.z - this.pz[n - 1];
      const dy = p.y - this.py[n - 1];
      const d = Math.hypot(dx, dz, dy);
      if (d < 1e-4) return;
      this.s.push(this.s[n - 1] + d);
    } else this.s.push(0);
    this.px.push(p.x);
    this.py.push(p.y);
    this.pz.push(p.z);
    this.minX = Math.min(this.minX, p.x);
    this.maxX = Math.max(this.maxX, p.x);
    this.minZ = Math.min(this.minZ, p.z);
    this.maxZ = Math.max(this.maxZ, p.z);
  }

  private sampleSegment(i: number) {
    const p0 = this.ctrl(i - 1);
    const p1 = this.ctrl(i);
    const p2 = this.ctrl(i + 1);
    const p3 = this.ctrl(i + 2);
    const segLen = p1.distanceTo(p2);
    const steps = Math.max(2, Math.ceil(segLen / this.spacing));
    const tmp = new Vector3();
    for (let k = 0; k < steps; k++) {
      this.cr(p0, p1, p2, p3, k / steps, tmp);
      this.pushSample(tmp);
    }
  }

  private sampleAll() {
    this.px = [];
    this.py = [];
    this.pz = [];
    this.s = [];
    const n = this.control.length;
    const segs = this.closed ? n : n - 1;
    for (let i = 0; i < segs; i++) this.sampleSegment(i);
    if (!this.closed) this.pushSample(this.control[n - 1]);
    this.sampledSegments = segs;
    this.finalize();
  }

  /** 开放道路追加控制点（无尽公路使用） */
  appendControlPoints(pts: Vector3[]) {
    if (this.closed) return;
    // 去掉最后一个终点样本，然后继续采样
    if (this.px.length) {
      this.px.pop();
      this.py.pop();
      this.pz.pop();
      this.s.pop();
    }
    this.control.push(...pts.map((p) => p.clone()));
    const n = this.control.length;
    for (let i = this.sampledSegments; i < n - 1; i++) this.sampleSegment(i);
    this.pushSample(this.control[n - 1]);
    this.sampledSegments = n - 1;
    this.finalize();
  }

  get lastControl() {
    return this.control[this.control.length - 1];
  }
  get controlCount() {
    return this.control.length;
  }

  private finalize() {
    const n = this.px.length;
    const last = n - 1;
    if (this.closed) {
      this.length = this.s[last] + Math.hypot(this.px[0] - this.px[last], this.pz[0] - this.pz[last], this.py[0] - this.py[last]);
    } else this.length = this.s[last];
    this.tx.length = n;
    this.tz.length = n;
    this.slope.length = n;
    this.curv.length = n;
    for (let i = 0; i < n; i++) {
      const a = this.idx(i - 1);
      const b = this.idx(i + 1);
      let dx = this.px[b] - this.px[a];
      let dz = this.pz[b] - this.pz[a];
      const dl = Math.hypot(dx, dz) || 1;
      dx /= dl;
      dz /= dl;
      this.tx[i] = dx;
      this.tz[i] = dz;
      this.slope[i] = (this.py[b] - this.py[a]) / dl;
    }
    for (let i = 0; i < n; i++) {
      const a = this.idx(i - 2);
      const b = this.idx(i + 2);
      const ha = Math.atan2(this.tx[a], this.tz[a]);
      const hb = Math.atan2(this.tx[b], this.tz[b]);
      let d = hb - ha;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const ds = Math.abs(this.sAt(b) - this.sAt(a)) || 1;
      this.curv[i] = d / ds;
    }
  }

  idx(i: number) {
    const n = this.px.length;
    if (this.closed) return ((i % n) + n) % n;
    return i < 0 ? 0 : i >= n ? n - 1 : i;
  }

  private sAt(i: number) {
    return this.s[i];
  }

  /** 由距离求采样索引 */
  indexAt(s: number) {
    if (this.closed) s = ((s % this.length) + this.length) % this.length;
    else s = Math.max(0, Math.min(this.length, s));
    let lo = 0;
    let hi = this.s.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.s[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  wrapS(s: number) {
    return this.closed ? ((s % this.length) + this.length) % this.length : Math.max(0, Math.min(this.length, s));
  }

  pointAt(s: number, out: RoadPoint = { x: 0, y: 0, z: 0, tx: 0, tz: 1, rx: -1, rz: 0 }): RoadPoint {
    s = this.wrapS(s);
    const i = this.indexAt(s);
    const j = this.idx(i + 1);
    const s0 = this.s[i];
    let s1 = j === 0 && this.closed ? this.length : this.s[j];
    if (s1 <= s0) s1 = s0 + 1e-3;
    const f = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
    out.x = this.px[i] + (this.px[j] - this.px[i]) * f;
    out.y = this.py[i] + (this.py[j] - this.py[i]) * f;
    out.z = this.pz[i] + (this.pz[j] - this.pz[i]) * f;
    let tx = this.tx[i] + (this.tx[j] - this.tx[i]) * f;
    let tz = this.tz[i] + (this.tz[j] - this.tz[i]) * f;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    out.tx = tx;
    out.tz = tz;
    out.rx = -tz;
    out.rz = tx;
    return out;
  }

  curvatureAt(s: number) {
    return this.curv[this.indexAt(s)];
  }

  /** 查询最近点；hint>=0 时局部搜索 */
  nearest(x: number, z: number, hint = -1, out?: RoadQuery, window = 14): RoadQuery {
    const res = out ?? { index: 0, s: 0, lateral: 0, y: 0, tx: 0, tz: 1, dist2: 0 };
    const n = this.px.length;
    let best = 0;
    let bestD = Infinity;
    if (hint >= 0 && hint < n) {
      // 局部搜索，必要时扩展窗口
      let w = window;
      for (let pass = 0; pass < 4; pass++) {
        best = hint;
        bestD = Infinity;
        let bestK = 0;
        for (let k = -w; k <= w; k++) {
          let i = hint + k;
          if (this.closed) i = ((i % n) + n) % n;
          else if (i < 0 || i >= n) continue;
          const dx = this.px[i] - x;
          const dz = this.pz[i] - z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = i;
            bestK = k;
          }
        }
        if (Math.abs(bestK) < w - 1 || w * 2 >= n) break;
        hint = best;
        w *= 3;
      }
    } else {
      for (let i = 0; i < n; i++) {
        const dx = this.px[i] - x;
        const dz = this.pz[i] - z;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    // 投影到相邻两段线段
    let bestS = this.s[best];
    let bestLat = 0;
    let bestY = this.py[best];
    let bestDist = Infinity;
    let bestIdx = best;
    for (const a of [this.idx(best - 1), best]) {
      const b = this.idx(a + 1);
      if (a === b) continue;
      const ax = this.px[a];
      const az = this.pz[a];
      const sx = this.px[b] - ax;
      const sz = this.pz[b] - az;
      const len2 = sx * sx + sz * sz || 1e-6;
      let f = ((x - ax) * sx + (z - az) * sz) / len2;
      if (!this.closed && ((a === 0 && f < 0) || (b === n - 1 && f > 1))) {
        // 开放道路端点外允许外推
      } else f = Math.max(0, Math.min(1, f));
      const qx = ax + sx * f;
      const qz = az + sz * f;
      const d = (x - qx) * (x - qx) + (z - qz) * (z - qz);
      if (d < bestDist) {
        bestDist = d;
        const len = Math.sqrt(len2);
        const fx = sx / len;
        const fz = sz / len;
        bestLat = (x - qx) * -fz + (z - qz) * fx;
        const sa = this.s[a];
        const sb = b === 0 && this.closed ? this.length : this.s[b];
        bestS = sa + (sb - sa) * f;
        bestY = this.py[a] + (this.py[b] - this.py[a]) * Math.max(0, Math.min(1, f));
        bestIdx = f > 0.5 ? b : a;
        res.tx = fx;
        res.tz = fz;
      }
    }
    res.index = bestIdx;
    res.s = this.closed ? this.wrapS(bestS) : bestS;
    res.lateral = bestLat;
    res.y = bestY;
    res.dist2 = bestDist;
    return res;
  }

  /** 两个进度之间沿道路的有向距离（闭合道路取最短方向） */
  deltaS(from: number, to: number) {
    let d = to - from;
    if (this.closed) {
      if (d > this.length / 2) d -= this.length;
      if (d < -this.length / 2) d += this.length;
    }
    return d;
  }
}
