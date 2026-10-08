import * as THREE from 'three';

export type FxKind =
  | 'smoke'
  | 'dust'
  | 'spark'
  | 'feather'
  | 'star'
  | 'fire'
  | 'plasma'
  | 'confetti'
  | 'water'
  | 'ink'
  | 'stink'
  | 'ice'
  | 'bubble'
  | 'rainbow'
  | 'snow'
  | 'lava'
  | 'gold'
  | 'boom';

interface KindDef {
  pool: 0 | 1 | 2;
  colors: number[];
  life: [number, number];
  size: [number, number];
  grow: number; // 终止尺寸 / 初始尺寸
  gravity: number;
  drag: number;
  spin: number;
}

const KINDS: Record<FxKind, KindDef> = {
  smoke: { pool: 0, colors: [0xffffff, 0xeeeeee, 0xdddddd], life: [0.6, 1.1], size: [0.35, 0.6], grow: 3, gravity: -1.5, drag: 2.5, spin: 1 },
  dust: { pool: 0, colors: [0xe8cf9a, 0xd8b98a, 0xc9a777], life: [0.5, 1], size: [0.3, 0.6], grow: 2.5, gravity: -0.5, drag: 2, spin: 1 },
  spark: { pool: 1, colors: [0xffe14a, 0xffa31a, 0xffffff], life: [0.25, 0.5], size: [0.05, 0.1], grow: 0.2, gravity: 12, drag: 1, spin: 10 },
  feather: { pool: 1, colors: [0xffffff, 0xf4f1e8, 0xffffff], life: [1.2, 2], size: [0.18, 0.28], grow: 1, gravity: 1.5, drag: 3, spin: 6 },
  star: { pool: 2, colors: [0xffe14a, 0xfff07a, 0xffc400], life: [0.6, 0.9], size: [0.25, 0.4], grow: 0.3, gravity: 4, drag: 2, spin: 8 },
  fire: { pool: 0, colors: [0xff7a1a, 0xffb21a, 0xff3d1a], life: [0.15, 0.3], size: [0.18, 0.32], grow: 0.2, gravity: -2, drag: 4, spin: 3 },
  plasma: { pool: 0, colors: [0x3cc8ff, 0x8ae8ff, 0x4f7bff], life: [0.15, 0.3], size: [0.18, 0.3], grow: 0.2, gravity: -1, drag: 4, spin: 3 },
  confetti: { pool: 1, colors: [0xff4d6d, 0xffd23f, 0x4ade80, 0x60a5fa, 0xc084fc, 0xff8fab], life: [2, 3.5], size: [0.15, 0.25], grow: 1, gravity: 4, drag: 1.6, spin: 9 },
  water: { pool: 0, colors: [0x7fd8ff, 0xbfefff, 0x4fb8ff], life: [0.4, 0.8], size: [0.1, 0.2], grow: 0.6, gravity: 14, drag: 0.5, spin: 1 },
  ink: { pool: 0, colors: [0x2b1d48, 0x3a2d5c, 0x1b1530], life: [1.2, 2], size: [0.8, 1.4], grow: 2.2, gravity: -0.3, drag: 1.5, spin: 0.5 },
  stink: { pool: 0, colors: [0x9acd32, 0x7cb518, 0xb5e550], life: [1, 1.6], size: [0.6, 1.1], grow: 2.5, gravity: -0.8, drag: 1.5, spin: 0.5 },
  ice: { pool: 1, colors: [0xbff0ff, 0x8fe3ff, 0xffffff], life: [0.5, 0.9], size: [0.1, 0.2], grow: 0.5, gravity: 10, drag: 1, spin: 8 },
  bubble: { pool: 0, colors: [0xbfefff, 0x9fe8ff, 0xffffff], life: [0.5, 0.9], size: [0.12, 0.22], grow: 1.6, gravity: -2, drag: 2, spin: 0 },
  rainbow: { pool: 1, colors: [0xff5f6d, 0xffb347, 0xfff275, 0x7cf29c, 0x6ec6ff, 0xb28dff], life: [0.4, 0.7], size: [0.15, 0.25], grow: 0.4, gravity: -0.5, drag: 3, spin: 4 },
  snow: { pool: 0, colors: [0xffffff, 0xf0f6ff], life: [0.5, 0.9], size: [0.2, 0.35], grow: 1.8, gravity: 2, drag: 2, spin: 1 },
  lava: { pool: 0, colors: [0xff5a1f, 0xffa020, 0xff2a00], life: [0.6, 1.2], size: [0.3, 0.6], grow: 0.4, gravity: 16, drag: 0.5, spin: 2 },
  gold: { pool: 2, colors: [0xffd700, 0xfff3a0, 0xffc400], life: [0.4, 0.7], size: [0.15, 0.25], grow: 0.2, gravity: -1, drag: 2, spin: 5 },
  boom: { pool: 0, colors: [0xffd23f, 0xff7a1a, 0xffffff], life: [0.3, 0.5], size: [0.8, 1.4], grow: 3, gravity: -1, drag: 3, spin: 2 },
};

interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  s0: number;
  s1: number;
  g: number;
  drag: number;
  rx: number;
  ry: number;
  spin: number;
}

class Pool {
  mesh: THREE.InstancedMesh;
  parts: Particle[] = [];
  free: number[] = [];
  private dummy = new THREE.Object3D();
  private color = new THREE.Color();
  constructor(geo: THREE.BufferGeometry, mat: THREE.Material, public cap: number) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = cap;
    this.dummy.scale.setScalar(0);
    this.dummy.updateMatrix();
    for (let i = 0; i < cap; i++) {
      this.parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, s0: 1, s1: 1, g: 0, drag: 0, rx: 0, ry: 0, spin: 0 });
      this.free.push(cap - 1 - i);
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.setHex(0xffffff));
    }
  }
  spawn(): number {
    if (this.free.length) return this.free.pop()!;
    // 池满时覆盖最老的粒子
    let oldest = 0;
    let minLife = Infinity;
    for (let i = 0; i < this.cap; i++) {
      if (this.parts[i].life < minLife) {
        minLife = this.parts[i].life;
        oldest = i;
      }
    }
    return oldest;
  }
  setColor(i: number, c: number) {
    this.mesh.setColorAt(i, this.color.setHex(c));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  update(dt: number) {
    const d = this.dummy;
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      any = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        this.free.push(i);
        d.scale.setScalar(0);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k - p.g * dt;
      p.vz *= k;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.spin * dt;
      p.ry += p.spin * 0.7 * dt;
      const t = 1 - p.life / p.max;
      const s = p.s0 + (p.s1 - p.s0) * t;
      const fade = t > 0.75 ? (1 - t) / 0.25 : 1;
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx, p.ry, 0);
      d.scale.setScalar(Math.max(0.0001, s * fade));
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** 粒子特效系统：对象池 + 实例化渲染 */
export class EffectsSystem {
  group = new THREE.Group();
  private pools: Pool[];
  private rings: { mesh: THREE.Mesh; life: number; max: number; size: number }[] = [];
  scale = 1;

  constructor(quality: 'low' | 'medium' | 'high') {
    const cap = quality === 'low' ? 260 : quality === 'medium' ? 500 : 800;
    this.scale = quality === 'low' ? 0.45 : quality === 'medium' ? 0.75 : 1;
    const puff = new THREE.IcosahedronGeometry(1, 0);
    const shard = new THREE.BoxGeometry(1, 0.15, 1.6);
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.45 : 1;
      const a = (i / 10) * Math.PI * 2;
      if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const star = new THREE.ShapeGeometry(starShape);
    const mat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, fog: true });
    this.pools = [new Pool(puff, mat(), cap), new Pool(shard, mat(), cap), new Pool(star, mat(), Math.round(cap / 3))];
    for (const p of this.pools) this.group.add(p.mesh);
    const ringGeo = new THREE.TorusGeometry(1, 0.08, 4, 24);
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
      mesh.rotation.x = Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, life: 0, max: 0.4, size: 4 });
    }
  }

  spawn(kind: FxKind, x: number, y: number, z: number, vx = 0, vy = 0, vz = 0, sizeMul = 1) {
    const def = KINDS[kind];
    const pool = this.pools[def.pool];
    const i = pool.spawn();
    const p = pool.parts[i];
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.max = p.life = def.life[0] + Math.random() * (def.life[1] - def.life[0]);
    p.s0 = (def.size[0] + Math.random() * (def.size[1] - def.size[0])) * sizeMul;
    p.s1 = p.s0 * def.grow;
    p.g = def.gravity;
    p.drag = def.drag;
    p.rx = Math.random() * 6;
    p.ry = Math.random() * 6;
    p.spin = (Math.random() - 0.5) * def.spin * 2;
    pool.setColor(i, def.colors[Math.floor(Math.random() * def.colors.length)]);
  }

  /** 爆发：随机方向 */
  burst(kind: FxKind, x: number, y: number, z: number, count: number, speed: number, up = 0.5, sizeMul = 1) {
    const n = Math.max(1, Math.round(count * this.scale));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.2) * Math.PI * 0.5;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.spawn(kind, x, y, z, Math.cos(a) * Math.cos(e) * sp, Math.abs(Math.sin(e)) * sp + up * speed, Math.sin(a) * Math.cos(e) * sp, sizeMul);
    }
  }

  /** 冲击波环 */
  ring(x: number, y: number, z: number, size: number, color = 0xffffff) {
    const r = this.rings.find((q) => q.life <= 0) ?? this.rings[0];
    r.life = r.max = 0.45;
    r.size = size;
    r.mesh.visible = true;
    r.mesh.position.set(x, y, z);
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  /** 烟花（获胜庆祝） */
  firework(x: number, y: number, z: number) {
    const colors: FxKind[] = ['confetti', 'spark', 'rainbow', 'gold'];
    const k = colors[Math.floor(Math.random() * colors.length)];
    this.burst(k, x, y, z, 40, 14, 0.1, 1.4);
    this.ring(x, y, z, 6, 0xffe14a);
  }

  update(dt: number) {
    for (const p of this.pools) p.update(dt);
    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = 1 - r.life / r.max;
      r.mesh.scale.setScalar(0.3 + t * r.size);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t);
      if (r.life <= 0) r.mesh.visible = false;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}
