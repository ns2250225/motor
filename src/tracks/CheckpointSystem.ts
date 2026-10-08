import type { Racer } from '../entities/Racer';
import type { TrackGeometry } from './TrackGeometry';

/** 检查点与圈数验证：必须按顺序经过全部检查点才计一圈，捷径进度会映射回主赛道 */
export class CheckpointSystem {
  private prevS = new Map<Racer, number>();

  constructor(private track: TrackGeometry) {}

  get count() {
    return this.track.checkpointS.length;
  }

  init(r: Racer) {
    r.lapsCompleted = -1;
    r.cp = this.count - 1;
    this.prevS.set(r, r.ground.mainS);
    this.updateProgress(r);
  }

  /** @returns 是否完成了一圈（越过终点线） */
  update(r: Racer): 'none' | 'checkpoint' | 'lap' {
    const t = this.track;
    const N = this.count;
    const s = r.ground.mainS;
    const prev = this.prevS.get(r) ?? s;
    let result: 'none' | 'checkpoint' | 'lap' = 'none';
    const next = (r.cp + 1) % N;
    const target = t.checkpointS[next];
    if (r.state === 'driving' || r.state === 'finished') {
      if (t.crossed(prev, s, target)) {
        r.cp = next;
        if (next === 0) {
          r.lapsCompleted++;
          result = 'lap';
        } else result = 'checkpoint';
      }
    }
    this.prevS.set(r, s);
    this.updateProgress(r);
    return result;
  }

  /** 由于重生可能被放回检查点之前，重置上一帧进度避免误判 */
  resync(r: Racer) {
    this.prevS.set(r, r.ground.mainS);
  }

  updateProgress(r: Racer) {
    const t = this.track;
    const L = t.length;
    const sCp = t.checkpointS[r.cp];
    const unwrapped = sCp + t.main.deltaS(sCp, r.ground.mainS);
    r.progress = r.lapsCompleted * L + unwrapped;
  }
}
