import { TRACKS } from '../src/tracks/TrackConfig';
import { TrackGeometry } from '../src/tracks/TrackGeometry';

for (const cfg of TRACKS) {
  const g = new TrackGeometry(cfg);
  const m = g.main;
  let minR = Infinity;
  for (let i = 0; i < m.count; i++) minR = Math.min(minR, 1 / Math.max(1e-6, Math.abs(m.curv[i])));
  // 主路自相交检测
  let selfMin = Infinity;
  for (let i = 0; i < m.count; i += 2) {
    for (let j = 0; j < m.count; j += 2) {
      const ds = Math.abs(m.deltaS(m.s[i], m.s[j]));
      if (ds < 120) continue;
      const d = Math.hypot(m.px[i] - m.px[j], m.pz[i] - m.pz[j]);
      selfMin = Math.min(selfMin, d);
    }
  }
  let line = `${cfg.id.padEnd(8)} L=${m.length.toFixed(0)} minR=${minR.toFixed(1)} self=${selfMin.toFixed(1)} y=[${Math.min(...m.py).toFixed(1)},${Math.max(...m.py).toFixed(1)}]`;
  for (const sc of g.shortcuts) {
    const r = sc.road;
    const mainSeg = sc.s1 - sc.s0;
    let mid = 0;
    {
      const p = r.pointAt(r.length / 2);
      const q = m.nearest(p.x, p.z);
      mid = Math.abs(q.lateral);
    }
    let clear = Infinity;
    for (let i = 0; i < r.count; i++) {
      const u = r.s[i] / r.length;
      if (u < 0.15 || u > 0.85) continue;
      for (let j = 0; j < m.count; j++) {
        const d = Math.hypot(r.px[i] - m.px[j], r.pz[i] - m.pz[j]);
        const sOk = m.s[j] < sc.s0 - 30 || m.s[j] > sc.s1 + 30;
        if (sOk) clear = Math.min(clear, d);
      }
    }
    line += ` | SC ${sc.cfg.id}: len=${r.length.toFixed(0)} vs ${mainSeg.toFixed(0)} save=${((1 - r.length / mainSeg) * 100).toFixed(0)}% midOff=${mid.toFixed(1)} clear=${clear.toFixed(1)}`;
  }
  console.log(line);
}
