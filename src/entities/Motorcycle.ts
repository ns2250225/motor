import * as THREE from 'three';
import type { MotorcycleDef, BikeModel } from '../data/motorcycles';
import type { Appearance } from '../data/cosmetics';
import { toon, metal, glow, checkerTexture } from '../utils/materials';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 8),
  torus: new THREE.TorusGeometry(1, 0.32, 6, 14),
  ring: new THREE.TorusGeometry(1, 0.08, 4, 16),
  star: (() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.45 : 1;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false });
  })(),
};

function m(geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.scale.set(sx, sy, sz);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

interface Layout {
  wheelR: number;
  wheelW: number;
  front: number;
  rear: number;
  seatY: number;
  seatZ: number;
  bar: [number, number];
}

const LAYOUT: Record<BikeModel, Layout> = {
  street: { wheelR: 0.36, wheelW: 0.16, front: 0.78, rear: -0.72, seatY: 0.82, seatZ: -0.25, bar: [0.95, 0.42] },
  dirt: { wheelR: 0.42, wheelW: 0.13, front: 0.82, rear: -0.75, seatY: 0.95, seatZ: -0.2, bar: [1.1, 0.45] },
  super: { wheelR: 0.35, wheelW: 0.2, front: 0.85, rear: -0.75, seatY: 0.8, seatZ: -0.35, bar: [0.85, 0.5] },
  cruiser: { wheelR: 0.38, wheelW: 0.22, front: 1.05, rear: -0.85, seatY: 0.72, seatZ: -0.35, bar: [1.25, 0.6] },
  mini: { wheelR: 0.22, wheelW: 0.16, front: 0.5, rear: -0.48, seatY: 0.58, seatZ: -0.2, bar: [0.85, 0.3] },
  rocket: { wheelR: 0.36, wheelW: 0.2, front: 0.85, rear: -0.8, seatY: 0.82, seatZ: -0.25, bar: [0.95, 0.45] },
  amphibious: { wheelR: 0.36, wheelW: 0.18, front: 0.8, rear: -0.75, seatY: 0.85, seatZ: -0.25, bar: [1.0, 0.45] },
  hover: { wheelR: 0.3, wheelW: 0.3, front: 0.8, rear: -0.75, seatY: 0.85, seatZ: -0.25, bar: [0.95, 0.45] },
};

/** 低多边形摩托模型 */
export class MotorcycleModel {
  root = new THREE.Group();
  body = new THREE.Group();
  frontWheel = new THREE.Group();
  rearWheel = new THREE.Group();
  steerGroup = new THREE.Group();
  seat: THREE.Vector3;
  exhausts: THREE.Vector3[] = [];
  rearContact: THREE.Vector3;
  frontContact: THREE.Vector3;
  layout: Layout;
  hover: boolean;
  private hoverGlow?: THREE.Mesh[];
  private wheelSpin = 0;

  constructor(public def: MotorcycleDef, app: Appearance) {
    const L = (this.layout = LAYOUT[def.id]);
    this.hover = def.id === 'hover';
    const color = app.bodyColor ?? def.color;
    const body = app.bodyColor === 0xf2c54b ? metal(color) : toon(color);
    const accent = toon(def.accent);
    const dark = toon(0x2a2a30);
    const chrome = metal(0xd9dde3);
    this.root.add(this.body);
    this.seat = new THREE.Vector3(0, L.seatY, L.seatZ);
    this.rearContact = new THREE.Vector3(0, 0, L.rear);
    this.frontContact = new THREE.Vector3(0, 0, L.front);

    // 车轮
    if (!this.hover) {
      this.buildWheel(this.frontWheel, L, app.wheel, def.id === 'dirt');
      this.buildWheel(this.rearWheel, L, app.wheel, def.id === 'dirt');
      this.frontWheel.position.set(0, L.wheelR, L.front);
      this.rearWheel.position.set(0, L.wheelR, L.rear);
      this.steerGroup.add(this.frontWheel);
      this.body.add(this.rearWheel);
    }
    this.steerGroup.position.set(0, 0, 0);
    this.body.add(this.steerGroup);

    // 前叉与车把
    if (!this.hover) {
      const fork = m(G.cyl, chrome, 0.04, L.bar[0] - L.wheelR + 0.1, 0.04, 0, (L.bar[0] + L.wheelR) / 2, L.front - 0.12);
      fork.rotation.x = -0.35;
      this.steerGroup.add(fork);
    }
    const bar = m(G.cyl, dark, 0.035, L.bar[1] * 2 + (def.id === 'cruiser' ? 0.3 : 0), 0.035, 0, L.bar[0], L.front - 0.38);
    bar.rotation.z = Math.PI / 2;
    this.steerGroup.add(bar);
    for (const sx of [-1, 1]) this.steerGroup.add(m(G.cyl, toon(0x111111), 0.05, 0.14, 0.05, sx * (L.bar[1] + 0.05), L.bar[0], L.front - 0.38).rotateZ(Math.PI / 2));
    // 大灯
    const lamp = m(G.cyl, glow(0xfff6c8), 0.12, 0.06, 0.12, 0, L.bar[0] - 0.18, L.front - 0.22);
    lamp.rotation.x = Math.PI / 2;
    this.steerGroup.add(lamp);

    // 车身（按类型）
    switch (def.id) {
      case 'street':
        this.body.add(m(G.sphere, body, 0.28, 0.2, 0.45, 0, 0.88, 0.25)); // 油箱
        this.body.add(m(G.box, dark, 0.3, 0.12, 0.6, 0, L.seatY - 0.04, L.seatZ - 0.05)); // 坐垫
        this.body.add(m(G.box, body, 0.24, 0.3, 0.9, 0, 0.55, -0.15));
        this.body.add(m(G.box, dark, 0.3, 0.28, 0.4, 0, 0.42, 0.05)); // 引擎
        this.body.add(m(G.box, body, 0.22, 0.06, 0.45, 0, 0.78, -0.75)); // 后挡泥
        break;
      case 'dirt':
        this.body.add(m(G.box, body, 0.26, 0.18, 0.55, 0, 0.95, 0.2));
        this.body.add(m(G.box, dark, 0.26, 0.1, 0.75, 0, L.seatY, L.seatZ - 0.05));
        this.body.add(m(G.box, dark, 0.26, 0.3, 0.35, 0, 0.5, 0.05));
        this.body.add(m(G.box, body, 0.2, 0.05, 0.6, 0, 1.0, -0.8).rotateX(-0.3));
        this.steerGroup.add(m(G.box, body, 0.2, 0.05, 0.5, 0, 0.92, L.front + 0.05).rotateX(0.3)); // 高前挡泥
        this.steerGroup.add(m(G.box, toon(0xffffff), 0.3, 0.25, 0.03, 0, 1.0, L.front - 0.25)); // 号码牌
        break;
      case 'super': {
        const fairing = m(G.sphere, body, 0.32, 0.32, 0.8, 0, 0.72, 0.3);
        this.body.add(fairing);
        this.body.add(m(G.box, body, 0.34, 0.3, 0.9, 0, 0.62, -0.3));
        this.body.add(m(G.box, dark, 0.28, 0.08, 0.45, 0, L.seatY, L.seatZ));
        this.body.add(m(G.box, body, 0.24, 0.18, 0.4, 0, 0.88, -0.75).rotateX(0.3)); // 尾翼
        const screen = m(G.box, new THREE.MeshPhongMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.55 }), 0.3, 0.2, 0.02, 0, 1.0, 0.5);
        screen.rotation.x = -0.9;
        this.body.add(screen);
        this.body.add(m(G.box, accent, 0.35, 0.05, 0.9, 0, 0.82, 0.1));
        break;
      }
      case 'cruiser':
        this.body.add(m(G.sphere, body, 0.3, 0.2, 0.5, 0, 0.8, 0.35));
        this.body.add(m(G.box, toon(0x3b2416), 0.42, 0.12, 0.65, 0, L.seatY - 0.05, L.seatZ - 0.05));
        this.body.add(m(G.box, chrome, 0.38, 0.38, 0.45, 0, 0.45, 0.1));
        this.body.add(m(G.box, body, 0.28, 0.08, 0.6, 0, 0.72, -0.9));
        this.body.add(m(G.box, dark, 0.15, 0.12, 1.6, 0, 0.32, 0.05));
        for (const sx of [-1, 1]) this.body.add(m(G.box, toon(0x3b2416), 0.18, 0.3, 0.4, sx * 0.34, 0.6, -0.75)); // 边箱
        break;
      case 'mini':
        this.body.add(m(G.sphere, body, 0.28, 0.24, 0.42, 0, 0.5, 0.05));
        this.body.add(m(G.box, dark, 0.34, 0.12, 0.45, 0, L.seatY - 0.04, L.seatZ));
        this.body.add(m(G.sphere, accent, 0.12, 0.12, 0.12, 0, 0.95, L.front - 0.38));
        this.body.add(m(G.cyl, chrome, 0.03, 0.5, 0.03, 0, 0.75, L.front - 0.3).rotateX(-0.3));
        break;
      case 'rocket': {
        this.body.add(m(G.sphere, body, 0.28, 0.2, 0.5, 0, 0.86, 0.25));
        this.body.add(m(G.box, dark, 0.3, 0.12, 0.55, 0, L.seatY - 0.04, L.seatZ));
        this.body.add(m(G.box, body, 0.26, 0.3, 0.9, 0, 0.55, -0.1));
        const rocket = new THREE.Group();
        rocket.add(m(G.cyl, body, 0.2, 1.1, 0.2, 0, 0, 0).rotateX(Math.PI / 2));
        rocket.add(m(G.cone, toon(0xff3b2f), 0.2, 0.35, 0.2, 0, 0, 0.72).rotateX(Math.PI / 2));
        rocket.add(m(G.cone, dark, 0.22, 0.25, 0.22, 0, 0, -0.62).rotateX(-Math.PI / 2));
        for (let i = 0; i < 3; i++) {
          const fin = m(G.box, toon(0xff3b2f), 0.02, 0.25, 0.3, 0, 0, -0.4);
          fin.rotation.z = (i / 3) * Math.PI * 2;
          fin.translateY(0.2);
          rocket.add(fin);
        }
        rocket.position.set(0, 1.15, -0.65);
        this.body.add(rocket);
        this.exhausts.push(new THREE.Vector3(0, 1.15, -1.35));
        break;
      }
      case 'amphibious':
        this.body.add(m(G.sphere, body, 0.28, 0.2, 0.5, 0, 0.88, 0.25));
        this.body.add(m(G.box, dark, 0.3, 0.12, 0.6, 0, L.seatY - 0.04, L.seatZ));
        this.body.add(m(G.box, body, 0.26, 0.3, 0.9, 0, 0.55, -0.1));
        for (const sx of [-1, 1]) {
          const pont = m(G.sphere, accent, 0.16, 0.16, 0.75, sx * 0.48, 0.45, -0.1);
          this.body.add(pont);
          this.body.add(m(G.box, dark, 0.3, 0.04, 0.04, sx * 0.3, 0.5, 0.2));
        }
        {
          const prop = new THREE.Group();
          prop.name = 'propeller';
          prop.add(m(G.box, chrome, 0.5, 0.06, 0.03, 0, 0, 0), m(G.box, chrome, 0.06, 0.5, 0.03, 0, 0, 0));
          prop.position.set(0, 0.45, -1.15);
          this.body.add(prop);
        }
        break;
      case 'hover': {
        this.body.add(m(G.sphere, body, 0.35, 0.22, 1.1, 0, 0.62, 0));
        this.body.add(m(G.box, dark, 0.3, 0.1, 0.55, 0, L.seatY - 0.05, L.seatZ));
        this.body.add(m(G.sphere, accent, 0.12, 0.08, 0.5, 0, 0.85, 0.45));
        this.hoverGlow = [];
        for (const z of [L.front - 0.1, L.rear + 0.1]) {
          const pad = m(G.cyl, dark, 0.32, 0.12, 0.32, 0, 0.35, z);
          this.body.add(pad);
          const gl = m(G.cyl, glow(def.accent), 0.28, 0.04, 0.28, 0, 0.28, z);
          this.body.add(gl);
          this.hoverGlow.push(gl);
        }
        for (const sx of [-1, 1]) this.body.add(m(G.box, body, 0.5, 0.03, 0.25, sx * 0.4, 0.62, -0.45).rotateZ(sx * 0.2));
        break;
      }
    }

    // 排气管
    if (def.id !== 'rocket' && def.id !== 'hover') this.buildExhaust(app.exhaust, L, chrome);
    if (def.id === 'hover') this.exhausts.push(new THREE.Vector3(0, 0.62, -1.15));

    // 贴纸
    this.buildDecal(app.decal, def.id);

    // 尾灯
    this.body.add(m(G.box, glow(0xff2a2a), 0.14, 0.06, 0.03, 0, L.seatY - 0.05, L.rear - 0.1));
    // 转向组以车头为支点
    const pivot = L.front - 0.3;
    this.steerGroup.position.z = pivot;
    for (const c of this.steerGroup.children) c.position.z -= pivot;
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  private buildWheel(g: THREE.Group, L: Layout, style: string, knobby: boolean) {
    const tireMat = toon(0x1c1c20);
    const tire = m(G.torus, tireMat, L.wheelR * 0.78, L.wheelR * 0.78, L.wheelW * 2.2);
    tire.rotation.y = Math.PI / 2;
    g.add(tire);
    if (knobby) {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const k = m(G.box, tireMat, L.wheelW * 1.1, 0.06, 0.08, 0, Math.cos(a) * L.wheelR, Math.sin(a) * L.wheelR);
        k.rotation.x = -a;
        g.add(k);
      }
    }
    const rimMat = style === 'gold' ? metal(0xf2c54b) : style === 'neon' ? glow(0x4ff7ff) : metal(0xc7ccd4);
    const spin = new THREE.Group();
    spin.name = 'spin';
    if (style === 'spoke') {
      for (let i = 0; i < 8; i++) {
        const sp = m(G.box, rimMat, 0.02, L.wheelR * 1.3, 0.02);
        sp.rotation.x = (i / 8) * Math.PI;
        spin.add(sp);
      }
      spin.add(m(G.cyl, rimMat, 0.06, L.wheelW * 0.9, 0.06).rotateZ(Math.PI / 2));
    } else if (style === 'star') {
      for (const sx of [-1, 1]) {
        const st = new THREE.Mesh(G.star, rimMat);
        st.scale.setScalar(L.wheelR * 0.6);
        st.rotation.y = Math.PI / 2;
        st.position.x = sx * L.wheelW * 0.3 - (sx > 0 ? 0.1 * L.wheelR * 0.6 : 0);
        spin.add(st);
      }
    } else {
      spin.add(m(G.cyl, rimMat, L.wheelR * 0.55, L.wheelW * 0.7, L.wheelR * 0.55).rotateZ(Math.PI / 2));
      for (let i = 0; i < 3; i++) {
        const sp = m(G.box, toon(0x333333), L.wheelW * 0.75, L.wheelR * 0.8, 0.05);
        sp.rotation.x = (i / 3) * Math.PI;
        spin.add(sp);
      }
      if (style === 'neon') {
        const ring = m(G.ring, rimMat, L.wheelR * 0.85, L.wheelR * 0.85, L.wheelR * 0.85);
        ring.rotation.y = Math.PI / 2;
        spin.add(ring);
      }
    }
    g.add(spin);
  }

  private buildExhaust(style: string, L: Layout, chrome: THREE.Material) {
    const add = (x: number, y: number, len: number, r: number, cone = false) => {
      const geo = cone ? G.cone : G.cyl;
      const p = m(geo, chrome, r, len, r, x, y, L.rear + 0.15);
      p.rotation.x = cone ? -Math.PI / 2 : Math.PI / 2 - 0.15;
      this.body.add(p);
      this.exhausts.push(new THREE.Vector3(x, y + 0.05, L.rear + 0.15 - len / 2));
    };
    switch (style) {
      case 'dual':
        add(-0.22, 0.42, 0.75, 0.06);
        add(0.22, 0.42, 0.75, 0.06);
        break;
      case 'megaphone':
        add(-0.22, 0.45, 0.85, 0.13, true);
        break;
      case 'quad':
        for (const x of [-0.26, -0.16, 0.16, 0.26]) add(x, 0.45, 0.7, 0.045);
        break;
      default:
        add(-0.22, 0.4, 0.8, 0.065);
    }
  }

  private buildDecal(style: string, id: BikeModel) {
    if (style === 'none') return;
    const z0 = id === 'cruiser' ? 0.35 : 0.25;
    const y0 = id === 'mini' ? 0.55 : id === 'hover' ? 0.68 : 0.88;
    const g = new THREE.Group();
    switch (style) {
      case 'stripes':
        for (const sx of [-0.06, 0.06]) g.add(m(G.box, toon(0xffffff), 0.05, 0.02, 0.9, sx, y0 + 0.18, z0));
        break;
      case 'flames':
        for (const sx of [-1, 1])
          for (let i = 0; i < 3; i++) {
            const f = m(G.cone, toon(i % 2 ? 0xffd23f : 0xff5a1f), 0.06, 0.3, 0.02, sx * 0.27, y0 - 0.02 + i * 0.03, z0 - 0.1 + i * 0.12);
            f.rotation.x = -1.3;
            f.rotation.y = (sx * Math.PI) / 2;
            g.add(f);
          }
        break;
      case 'stars':
        for (const sx of [-1, 1]) {
          const st = new THREE.Mesh(G.star, toon(0xffe14a));
          st.scale.setScalar(0.1);
          st.rotation.y = (sx * Math.PI) / 2;
          st.position.set(sx * 0.28, y0, z0);
          g.add(st);
        }
        break;
      case 'fish':
        for (const sx of [-1, 1]) {
          g.add(m(G.sphere, toon(0x4fb3ff), 0.02, 0.07, 0.12, sx * 0.28, y0, z0));
          g.add(m(G.cone, toon(0x4fb3ff), 0.06, 0.08, 0.02, sx * 0.28, y0, z0 - 0.15).rotateX(Math.PI / 2));
        }
        break;
      case 'checker': {
        const mat = new THREE.MeshToonMaterial({ map: checkerTexture('#ffffff', '#111111', 6) });
        for (const sx of [-1, 1]) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.16), mat);
          p.rotation.y = (sx * Math.PI) / 2;
          p.position.set(sx * 0.29, y0 - 0.05, z0);
          g.add(p);
        }
        break;
      }
    }
    this.body.add(g);
  }

  /** 每帧更新：车轮转动、前轮转向、悬浮光效 */
  update(dt: number, speed: number, steer: number, t: number) {
    if (!this.hover) {
      this.wheelSpin += (speed / this.layout.wheelR) * dt;
      for (const w of [this.frontWheel, this.rearWheel]) {
        const s = w.getObjectByName('spin');
        if (s) s.rotation.x = this.wheelSpin;
        w.children[0].rotation.x = this.wheelSpin;
      }
    } else if (this.hoverGlow) {
      this.body.position.y = 0.15 + Math.sin(t * 5) * 0.05;
      for (const g of this.hoverGlow) g.scale.setScalar(0.28 * (1 + Math.sin(t * 12) * 0.1));
    }
    this.steerGroup.rotation.y = steer * 0.35;
    const prop = this.body.getObjectByName('propeller');
    if (prop) prop.rotation.z += dt * (5 + speed);
  }
}
