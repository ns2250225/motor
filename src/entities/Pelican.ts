import * as THREE from 'three';
import type { PelicanDef } from '../data/pelicans';
import type { Appearance } from '../data/cosmetics';
import { toon, metal, glow } from '../utils/materials';
import { Spring, clamp, damp, lerp } from '../utils/math';

// 共享几何体，减少内存
const G = {
  sphere: new THREE.IcosahedronGeometry(1, 1),
  sphereHi: new THREE.SphereGeometry(1, 12, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
  torus: new THREE.TorusGeometry(1, 0.18, 6, 12),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** 翅膀拍击 / 啄击动画时长（秒），与战斗判定窗口对应 */
export const WING_DUR = 0.5;
export const PECK_DUR = 0.45;

/** 翅膀拍击曲线：0~0.25 向后蓄力，0.25~0.55 猛抡（带过冲），之后回收 */
function wingSwing(p: number) {
  if (p < 0.25) {
    const k = p / 0.25;
    return { swing: -0.45 * k, out: 0.6 * k };
  }
  if (p < 0.55) {
    const k = (p - 0.25) / 0.3;
    return { swing: -0.45 + 1.75 * Math.sin(k * Math.PI * 0.5), out: 0.6 + 0.4 * k };
  }
  const k = (p - 0.55) / 0.45;
  return { swing: 1.3 * (1 - k), out: 1 - k };
}

export type PelicanAnim = 'wingL' | 'wingR' | 'peck' | 'sweep' | 'clamp' | 'hurt' | 'shout' | 'celebrate' | 'sad' | 'trick' | 'spit';

export interface PelicanContext {
  speed: number;
  steer: number;
  boost: boolean;
  airborne: boolean;
  dt: number;
}

/** 鹈鹕骑手模型：程序化动画（待机摇头、张嘴叫喊、倾斜、俯身、翅膀攻击、啄击、夹击、受伤晃动、庆祝、沮丧） */
export class Pelican {
  root = new THREE.Group();
  torso = new THREE.Group();
  neck: THREE.Group[] = [];
  head = new THREE.Group();
  beak = new THREE.Group();
  jaw = new THREE.Group();
  pouch: THREE.Mesh;
  wingL = new THREE.Group();
  wingR = new THREE.Group();
  legs = new THREE.Group();
  heldBone: THREE.Group;
  private ghosts: THREE.Group[] = [];
  private beakHistory: number[] = [];
  private eyes: THREE.Mesh[] = [];
  private starRing: THREE.Group;

  // 动画状态
  mood: 'ride' | 'idle' | 'celebrate' | 'sad' | 'tumble' = 'ride';
  private t = Math.random() * 10;
  private wingLT = 0;
  private wingRT = 0;
  private peckT = 0;
  private sweepT = 0;
  private clampT = 0;
  private clampHold = 0;
  private shoutT = 0;
  private trickT = 0;
  private lean = 0;
  private crouch = 0;
  pouchFill = 0;
  private pouchTarget = 0;
  private neckSpringX = new Spring(90, 6);
  private neckSpringZ = new Spring(90, 6);
  private beakSquash = new Spring(160, 9, 1);
  private dizzy = 0;
  readonly mechanical: boolean;

  constructor(public def: PelicanDef, app: Appearance) {
    this.mechanical = def.accessories.includes('mechWings');
    const matBody = def.metallic ? metal(def.bodyColor) : toon(def.bodyColor);
    const matWing = def.metallic ? metal(def.wingColor) : toon(def.wingColor);
    const beakColor = app.beakColor ?? def.beakColor;
    const matBeak = def.accessories.includes('metalBeak') ? metal(beakColor) : toon(beakColor);
    const matPouch = toon(app.beakColor ? new THREE.Color(app.beakColor).multiplyScalar(0.85).getHex() : def.pouchColor);
    const matLeg = toon(0xff9a2e);
    const white = toon(0xffffff);
    const black = toon(0x111111);

    this.root.add(this.torso);
    // 身体（小身体）
    this.torso.add(mesh(G.sphere, matBody, 0.42, 0.48, 0.56, 0, 0.45, -0.05));
    this.torso.add(mesh(G.cone, matWing, 0.18, 0.4, 0.18, 0, 0.42, -0.6).rotateX(-Math.PI / 2 - 0.4));
    // 短腿
    for (const sx of [-1, 1]) {
      const leg = mesh(G.cyl, matLeg, 0.06, 0.5, 0.06, sx * 0.25, 0.12, 0.28);
      leg.rotation.x = 1.1;
      this.legs.add(leg);
      this.legs.add(mesh(G.box, matLeg, 0.18, 0.05, 0.24, sx * 0.27, -0.05, 0.5));
    }
    this.root.add(this.legs);

    // 翅膀：肩部为支点，静止时伸向车把
    const buildWing = (side: 1 | -1, g: THREE.Group) => {
      g.position.set(side * 0.38, 0.62, 0.05);
      const w = mesh(G.sphere, matWing, 0.1, 0.22, 0.5, side * 0.06, -0.08, 0.3);
      w.rotation.x = 0.35;
      g.add(w);
      // 翼尖羽毛
      for (let i = 0; i < 3; i++) {
        const f = mesh(G.box, matWing, 0.04, 0.08, 0.22, side * 0.08, -0.16 - i * 0.03, 0.66 + i * 0.05);
        f.rotation.y = side * (0.2 - i * 0.2);
        g.add(f);
      }
      if (this.mechanical) {
        const gear = mesh(G.torus, metal(0x4b5563), 0.14, 0.14, 0.14, side * 0.1, 0, 0);
        gear.rotation.y = Math.PI / 2;
        g.add(gear);
      }
      this.torso.add(g);
    };
    buildWing(1, this.wingL);
    buildWing(-1, this.wingR);

    // 脖子（3 节，弹簧晃动）
    let parent: THREE.Object3D = this.torso;
    const neckBase = new THREE.Vector3(0, 0.8, 0.12);
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      if (i === 0) seg.position.copy(neckBase);
      else seg.position.set(0, 0.2, 0.02);
      seg.add(mesh(G.cyl, matBody, 0.13 - i * 0.01, 0.24, 0.13 - i * 0.01, 0, 0.1, 0));
      parent.add(seg);
      this.neck.push(seg);
      parent = seg;
    }
    this.head.position.set(0, 0.28, 0.02);
    parent.add(this.head);
    // 大脑袋
    this.head.add(mesh(G.sphere, matBody, 0.3, 0.3, 0.32, 0, 0.12, 0));
    // 大眼睛
    for (const sx of [-1, 1]) {
      const eye = mesh(G.sphereHi, white, 0.1, 0.12, 0.08, sx * 0.17, 0.22, 0.2);
      const pupil = mesh(G.sphereHi, this.mechanical ? glow(0xff2a2a) : black, 0.05, 0.06, 0.04, sx * 0.19, 0.22, 0.27);
      this.head.add(eye, pupil);
      this.eyes.push(pupil);
    }
    // 大嘴：上喙 + 下颌 + 喉囊
    this.beak.position.set(0, 0.06, 0.22);
    this.head.add(this.beak);
    const upper = mesh(G.box, matBeak, 0.22, 0.09, 0.95, 0, 0.02, 0.45);
    this.beak.add(upper);
    this.beak.add(mesh(G.cone, matBeak, 0.08, 0.16, 0.08, 0, -0.02, 0.95).rotateX(Math.PI));
    this.jaw.position.set(0, -0.03, 0);
    this.beak.add(this.jaw);
    this.jaw.add(mesh(G.box, matBeak, 0.2, 0.05, 0.9, 0, -0.03, 0.44));
    this.pouch = mesh(G.sphere, matPouch, 0.16, 0.16, 0.4, 0, -0.12, 0.36);
    this.jaw.add(this.pouch);

    // 大嘴攻击残影
    for (let i = 0; i < 3; i++) {
      const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
      const gh = new THREE.Group();
      gh.add(mesh(G.box, ghostMat, 0.22, 0.12, 0.95, 0, 0, 0.45));
      gh.position.copy(this.beak.position);
      gh.visible = false;
      this.head.add(gh);
      this.ghosts.push(gh);
    }

    // 眩晕星星
    this.starRing = new THREE.Group();
    const starMat = glow(0xffe14a);
    for (let i = 0; i < 5; i++) {
      const st = mesh(G.cone, starMat, 0.08, 0.16, 0.08);
      const a = (i / 5) * Math.PI * 2;
      st.position.set(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
      this.starRing.add(st);
    }
    this.starRing.position.y = 0.55;
    this.starRing.visible = false;
    this.head.add(this.starRing);

    // 巨型鱼骨（道具）
    this.heldBone = this.buildBone();
    this.heldBone.visible = false;
    this.wingL.add(this.heldBone);

    this.addAccessories(def, app);
    this.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
  }

  private buildBone() {
    const g = new THREE.Group();
    const m = toon(0xf3ead2);
    g.add(mesh(G.cyl, m, 0.06, 2.2, 0.06, 0, 0, 0).rotateZ(Math.PI / 2));
    for (let i = 0; i < 6; i++) {
      const rib = mesh(G.cyl, m, 0.03, 0.6, 0.03, -0.9 + i * 0.32 + 0.1, 0, 0);
      g.add(rib);
    }
    g.add(mesh(G.cone, m, 0.3, 0.4, 0.12, -1.25, 0, 0).rotateZ(Math.PI / 2));
    g.add(mesh(G.sphere, m, 0.22, 0.22, 0.18, 1.2, 0, 0));
    g.position.set(0.5, -0.1, 0.5);
    return g;
  }

  private addAccessories(def: PelicanDef, app: Appearance) {
    const acc = new Set(def.accessories);
    const H = this.head;
    const black = toon(0x161616);
    if (acc.has('pirateHat')) {
      const hat = new THREE.Group();
      hat.add(mesh(G.cyl, black, 0.42, 0.08, 0.32, 0, 0, 0));
      hat.add(mesh(G.sphere, black, 0.28, 0.2, 0.24, 0, 0.1, 0));
      hat.add(mesh(G.sphereHi, toon(0xffffff), 0.05, 0.05, 0.02, 0, 0.14, 0.24));
      hat.position.set(0, 0.42, -0.02);
      H.add(hat);
    }
    if (acc.has('eyepatch')) {
      H.add(mesh(G.cyl, black, 0.08, 0.02, 0.08, 0.2, 0.22, 0.26).rotateX(Math.PI / 2));
      H.add(mesh(G.torus, black, 0.31, 0.31, 0.12, 0, 0.24, 0).rotateX(Math.PI / 2 - 0.25));
    }
    if (acc.has('sunglasses')) {
      for (const sx of [-1, 1]) H.add(mesh(G.box, black, 0.16, 0.08, 0.03, sx * 0.15, 0.23, 0.29));
      H.add(mesh(G.box, black, 0.36, 0.025, 0.02, 0, 0.25, 0.29));
    }
    if (acc.has('jacket')) {
      this.torso.add(mesh(G.sphere, toon(0x202020), 0.44, 0.42, 0.5, 0, 0.42, -0.06));
      this.torso.add(mesh(G.box, toon(0xc0c0c0), 0.03, 0.4, 0.02, 0.08, 0.5, 0.42));
    }
    if (acc.has('ninjaMask')) {
      H.add(mesh(G.torus, toon(0xd62828), 0.31, 0.31, 0.2, 0, 0.32, 0).rotateX(Math.PI / 2));
      H.add(mesh(G.box, toon(0xd62828), 0.04, 0.05, 0.35, 0.05, 0.3, -0.42).rotateX(0.5));
    }
    if (acc.has('mohawk')) {
      for (let i = 0; i < 5; i++) {
        const c = mesh(G.cone, toon(i % 2 ? 0xff2d95 : 0xa855f7), 0.06, 0.32, 0.12, 0, 0.45 - Math.abs(i - 2) * 0.03, 0.18 - i * 0.12);
        c.rotation.x = -0.3 + i * 0.12;
        H.add(c);
      }
    }
    if (acc.has('goggles')) {
      for (const sx of [-1, 1]) H.add(mesh(G.cyl, toon(0x55ccff, 0x2288aa, 0.4), 0.09, 0.06, 0.09, sx * 0.14, 0.34, 0.24).rotateX(Math.PI / 2 - 0.4));
      H.add(mesh(G.torus, toon(0x333333), 0.31, 0.31, 0.12, 0, 0.33, 0).rotateX(Math.PI / 2 - 0.3));
    }
    if (acc.has('labcoat')) {
      this.torso.add(mesh(G.sphere, toon(0xffffff), 0.44, 0.44, 0.54, 0, 0.4, -0.08));
      this.torso.add(mesh(G.box, toon(0x3b82f6), 0.05, 0.08, 0.02, -0.15, 0.6, 0.43));
    }
    if (acc.has('fireHelmet')) {
      const hel = new THREE.Group();
      hel.add(mesh(G.sphere, toon(0xd61f1f), 0.33, 0.22, 0.35, 0, 0, 0));
      hel.add(mesh(G.cyl, toon(0xd61f1f), 0.4, 0.03, 0.46, 0, -0.05, -0.05));
      hel.add(mesh(G.box, toon(0xffcc33), 0.12, 0.14, 0.03, 0, 0.05, 0.34));
      hel.position.set(0, 0.32, -0.02);
      H.add(hel);
    }
    if (acc.has('spaceHelmet')) {
      const glass = new THREE.Mesh(G.sphereHi, new THREE.MeshPhongMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28, shininess: 120, depthWrite: false }));
      glass.scale.setScalar(0.62);
      glass.position.set(0, 0.15, 0.25);
      H.add(glass);
      this.torso.add(mesh(G.box, toon(0xe5e7eb), 0.5, 0.5, 0.3, 0, 0.5, -0.55));
      this.torso.add(mesh(G.box, toon(0xef4444), 0.1, 0.1, 0.05, 0.15, 0.6, 0.45));
    }
    // 外观定制：头盔与眼镜（角色自带帽子时不重复）
    const hasHat = acc.has('pirateHat') || acc.has('fireHelmet') || acc.has('spaceHelmet');
    if (!hasHat && app.helmet !== 'none') {
      const hm = toon(app.helmetColor);
      const g = new THREE.Group();
      g.position.set(0, 0.36, -0.02);
      switch (app.helmet) {
        case 'classic':
          g.add(mesh(G.sphere, hm, 0.33, 0.24, 0.35, 0, 0, 0));
          g.add(mesh(G.box, toon(0xffffff), 0.05, 0.05, 0.6, 0, 0.18, 0));
          break;
        case 'viking':
          g.add(mesh(G.sphere, hm, 0.32, 0.22, 0.33, 0, 0, 0));
          for (const sx of [-1, 1]) {
            const horn = mesh(G.cone, toon(0xfff3d6), 0.07, 0.35, 0.07, sx * 0.32, 0.12, 0);
            horn.rotation.z = -sx * 0.9;
            g.add(horn);
          }
          break;
        case 'cowboy':
          g.add(mesh(G.cyl, hm, 0.55, 0.04, 0.5, 0, 0, 0));
          g.add(mesh(G.cyl, hm, 0.24, 0.26, 0.24, 0, 0.13, 0));
          break;
        case 'crown':
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            g.add(mesh(G.cone, hm, 0.06, 0.2, 0.06, Math.cos(a) * 0.17, 0.1, Math.sin(a) * 0.17));
          }
          g.add(mesh(G.cyl, hm, 0.2, 0.08, 0.2, 0, 0, 0));
          break;
        case 'propeller': {
          g.add(mesh(G.sphere, hm, 0.3, 0.16, 0.32, 0, 0, 0));
          const prop = new THREE.Group();
          prop.name = 'propeller';
          prop.add(mesh(G.box, toon(0xffd23f), 0.7, 0.02, 0.08, 0, 0, 0));
          prop.add(mesh(G.box, toon(0xff4d4d), 0.08, 0.02, 0.7, 0, 0, 0));
          prop.position.y = 0.2;
          g.add(prop, mesh(G.cyl, toon(0x333333), 0.02, 0.2, 0.02, 0, 0.1, 0));
          break;
        }
      }
      H.add(g);
    }
    if (!acc.has('sunglasses') && !acc.has('goggles') && app.glasses !== 'none') {
      const gm = toon(app.glassesColor);
      switch (app.glasses) {
        case 'round':
          for (const sx of [-1, 1]) H.add(mesh(G.torus, gm, 0.08, 0.08, 0.08, sx * 0.16, 0.22, 0.28));
          break;
        case 'star':
        case 'heart':
          for (const sx of [-1, 1]) H.add(mesh(app.glasses === 'star' ? G.cone : G.sphere, gm, 0.1, 0.1, 0.03, sx * 0.16, 0.22, 0.29));
          H.add(mesh(G.box, gm, 0.36, 0.025, 0.02, 0, 0.24, 0.29));
          break;
        case 'aviator':
          for (const sx of [-1, 1]) H.add(mesh(G.sphere, toon(0x3b2f1c), 0.1, 0.08, 0.03, sx * 0.16, 0.21, 0.29));
          H.add(mesh(G.box, gm, 0.36, 0.02, 0.02, 0, 0.25, 0.29));
          break;
        case 'monocle':
          H.add(mesh(G.torus, gm, 0.09, 0.09, 0.09, 0.17, 0.22, 0.29));
          H.add(mesh(G.cyl, gm, 0.005, 0.3, 0.005, 0.22, 0.05, 0.29));
          break;
      }
    }
  }

  /** 触发动画 */
  trigger(a: PelicanAnim) {
    switch (a) {
      case 'wingL':
        this.wingLT = WING_DUR;
        break;
      case 'wingR':
        this.wingRT = WING_DUR;
        break;
      case 'peck':
        this.peckT = PECK_DUR;
        break;
      case 'spit':
        this.peckT = PECK_DUR * 0.7;
        this.shoutT = 0.3;
        break;
      case 'sweep':
        this.sweepT = 0.55;
        break;
      case 'clamp':
        this.clampT = 1.3;
        break;
      case 'hurt':
        this.neckSpringX.kick(12 * (Math.random() < 0.5 ? -1 : 1));
        this.neckSpringZ.kick(10);
        this.beakSquash.kick(-6);
        this.dizzy = Math.max(this.dizzy, 0.8);
        break;
      case 'shout':
        this.shoutT = 0.6;
        break;
      case 'trick':
        this.trickT = 0.6;
        break;
      case 'celebrate':
        this.mood = 'celebrate';
        break;
      case 'sad':
        this.mood = 'sad';
        break;
    }
  }

  /** 夹击命中后保持张嘴“咬住”状态 */
  holdClamp(sec: number) {
    this.clampHold = sec;
  }

  setDizzy(sec: number) {
    this.dizzy = Math.max(this.dizzy, sec);
  }

  setPouch(full: boolean) {
    this.pouchTarget = full ? 1 : 0;
  }

  /** 鱼骨近战 */
  setBone(on: boolean) {
    this.heldBone.visible = on;
  }

  get beakTipWorld() {
    const v = new THREE.Vector3(0, 0, 1);
    return this.beak.localToWorld(v);
  }

  update(ctx: PelicanContext) {
    const dt = ctx.dt;
    this.t += dt;
    const t = this.t;
    this.wingLT = Math.max(0, this.wingLT - dt);
    this.wingRT = Math.max(0, this.wingRT - dt);
    this.peckT = Math.max(0, this.peckT - dt);
    this.sweepT = Math.max(0, this.sweepT - dt);
    this.clampT = Math.max(0, this.clampT - dt);
    this.clampHold = Math.max(0, this.clampHold - dt);
    this.shoutT = Math.max(0, this.shoutT - dt);
    this.trickT = Math.max(0, this.trickT - dt);
    this.dizzy = Math.max(0, this.dizzy - dt);

    // 身体倾斜与加速俯身
    this.lean = damp(this.lean, ctx.steer * clamp(ctx.speed / 25, 0, 1) * 0.35, 8, dt);
    this.crouch = damp(this.crouch, ctx.boost ? 1 : ctx.speed > 30 ? 0.4 : 0, 6, dt);
    let torsoX = 0.15 + this.crouch * 0.35;
    let torsoZ = -this.lean * 0.6;
    let torsoY = 0;
    let headYaw = 0;
    let headPitch = -this.crouch * 0.3;
    let mouth = 0;
    let neckExtend = 0;
    let wingLRot = 0;
    let wingRRot = 0;
    let wingLift = 0;

    if (this.mood === 'idle' || (this.mood === 'ride' && ctx.speed < 1)) {
      // 待机摇头
      headYaw = Math.sin(t * 1.6) * 0.5 + Math.sin(t * 4.1) * 0.08;
      headPitch = Math.sin(t * 2.3) * 0.08;
      mouth = Math.max(0, Math.sin(t * 0.9) - 0.85) * 4;
      torsoX = 0.05;
    }
    if (this.mood === 'celebrate') {
      wingLift = 1;
      torsoY = Math.abs(Math.sin(t * 7)) * 0.15;
      headPitch = -0.4;
      mouth = 0.6 + Math.sin(t * 10) * 0.3;
      headYaw = Math.sin(t * 5) * 0.3;
    } else if (this.mood === 'sad') {
      torsoX = 0.55;
      headPitch = 0.7;
      headYaw = Math.sin(t * 0.8) * 0.15;
      wingLRot = 0.4;
      wingRRot = 0.4;
    } else if (this.mood === 'tumble') {
      wingLift = 0.7 + Math.sin(t * 20) * 0.3;
      mouth = 0.8;
    }

    // 翅膀攻击：先向后蓄力，再变大成巨型翅膀狠狠抡出去
    let wingLOut = 0;
    let wingROut = 0;
    let wingLScale = 1;
    let wingRScale = 1;
    let torsoTwist = 0;
    if (this.wingLT > 0) {
      const p = 1 - this.wingLT / WING_DUR;
      const w = wingSwing(p);
      wingLRot = -w.swing * 3.2;
      wingLOut = w.out;
      wingLScale = 1 + w.out * 1.6;
      torsoTwist += w.swing * 0.5;
      if (this.mechanical) this.wingL.rotation.x = p * Math.PI * 6;
    } else if (this.mechanical) this.wingL.rotation.x = damp(this.wingL.rotation.x % (Math.PI * 2), 0, 10, dt);
    if (this.wingRT > 0) {
      const p = 1 - this.wingRT / WING_DUR;
      const w = wingSwing(p);
      wingRRot = -w.swing * 3.2;
      wingROut = w.out;
      wingRScale = 1 + w.out * 1.6;
      torsoTwist -= w.swing * 0.5;
      if (this.mechanical) this.wingR.rotation.x = p * Math.PI * 6;
    } else if (this.mechanical) this.wingR.rotation.x = damp(this.wingR.rotation.x % (Math.PI * 2), 0, 10, dt);
    if (this.heldBone.visible) wingLRot -= 0.6 + Math.sin(t * 9) * 0.4;

    // 大嘴啄击：先缩脖子蓄力，再整个脖子弹射出去，嘴巴拉长
    let beakYaw = 0;
    let peckStretch = 0;
    if (this.peckT > 0) {
      const p = 1 - this.peckT / PECK_DUR;
      if (p < 0.3) {
        neckExtend = -0.5 * (p / 0.3);
        torsoX -= 0.3 * (p / 0.3);
      } else {
        const k = Math.sin(((p - 0.3) / 0.7) * Math.PI);
        neckExtend = k * 1.8;
        peckStretch = k;
        torsoX += k * 0.5;
      }
      mouth = Math.max(mouth, p > 0.25 && p < 0.7 ? 1 : 0.2);
    }
    if (this.sweepT > 0) {
      const p = 1 - this.sweepT / 0.55;
      beakYaw = Math.sin(p * Math.PI * 2) * 1.3;
      mouth = Math.max(mouth, 0.5);
      neckExtend = Math.max(neckExtend, 0.4);
    }
    if (this.clampT > 0 || this.clampHold > 0) {
      const p = this.clampT > 0 ? 1 - this.clampT / 1.3 : 0.5;
      neckExtend = Math.max(neckExtend, p < 0.25 ? p * 4 : 1 - Math.max(0, p - 0.8) * 5);
      mouth = this.clampHold > 0 ? 0.15 : p < 0.2 ? 1 : Math.max(mouth, 0.2);
      if (this.clampHold > 0) beakYaw = Math.sin(t * 18) * 0.25;
    }
    if (this.shoutT > 0) mouth = Math.max(mouth, Math.sin((this.shoutT / 0.6) * Math.PI) * 1);
    if (this.trickT > 0) {
      wingLift = Math.max(wingLift, Math.sin((this.trickT / 0.6) * Math.PI));
      mouth = Math.max(mouth, 0.7);
    }
    if (ctx.airborne && this.mood === 'ride') wingLift = Math.max(wingLift, 0.35 + Math.sin(t * 16) * 0.15);

    this.torso.rotation.set(torsoX, torsoTwist, torsoZ);
    this.torso.position.y = torsoY;

    // 翅膀
    const restL = 0.15;
    this.wingL.rotation.z = lerp(lerp(restL, 1.6, wingLift), 1.75, wingLOut) + -wingLRot * 0.35;
    this.wingL.rotation.y = wingLRot * 0.55;
    this.wingR.rotation.z = -(lerp(lerp(restL, 1.6, wingLift), 1.75, wingROut) + -wingRRot * 0.35);
    this.wingR.rotation.y = -wingRRot * 0.55;
    this.wingL.scale.setScalar(wingLScale);
    this.wingR.scale.setScalar(wingRScale);
    if (wingLift > 0.2) {
      this.wingL.rotation.z += Math.sin(t * 18) * 0.3 * wingLift;
      this.wingR.rotation.z -= Math.sin(t * 18) * 0.3 * wingLift;
    }

    // 脖子弹簧晃动（受击、加速时）
    const sx = this.neckSpringX.update(dt);
    const sz = this.neckSpringZ.update(dt);
    const extendPitch = Math.min(1, Math.max(0, neckExtend));
    this.neck[0].rotation.set(0.25 + extendPitch * 0.9 + sz * 0.05, 0, sx * 0.06 + this.lean * 0.4);
    this.neck[1].rotation.set(extendPitch * 0.3 + sz * 0.04, 0, sx * 0.05);
    this.neck[2].rotation.set(-0.35 - extendPitch * 0.6 + sz * 0.03, 0, sx * 0.04);
    this.neck[1].position.y = Math.max(0.08, 0.2 + neckExtend * 0.32);
    this.neck[2].position.y = Math.max(0.08, 0.2 + neckExtend * 0.32);
    this.head.rotation.set(headPitch - 0.15, headYaw, 0);
    this.head.scale.setScalar(1 + peckStretch * 0.35);

    // 嘴巴开合与形变
    const sq = this.beakSquash.update(dt);
    this.jaw.rotation.x = mouth * 0.7;
    this.beak.scale.set(1 + (1 - sq) * 0.6 + peckStretch * 0.3, 1 + peckStretch * 0.3, clamp(sq, 0.5, 1.5) + peckStretch * 1.1);
    this.beak.rotation.y = beakYaw;
    this.pouchFill = damp(this.pouchFill, this.pouchTarget, 6, dt);
    const pf = this.pouchFill + Math.sin(t * 6) * 0.03 * this.pouchFill;
    this.pouch.scale.set(0.16 + pf * 0.16, 0.16 + pf * 0.2, 0.4 + pf * 0.08);
    this.pouch.position.y = -0.12 - pf * 0.12;

    // 残影：记录嘴部旋转历史
    this.beakHistory.unshift(beakYaw, neckExtend);
    if (this.beakHistory.length > 24) this.beakHistory.length = 24;
    const showGhost = this.sweepT > 0 || this.peckT > 0 || this.clampT > 1.0;
    for (let i = 0; i < this.ghosts.length; i++) {
      const gh = this.ghosts[i];
      gh.visible = showGhost;
      if (!showGhost) continue;
      const k = (i + 1) * 4;
      gh.rotation.y = this.beakHistory[k] ?? 0;
      gh.position.z = this.beak.position.z - (i + 1) * 0.05;
      ((gh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.3 - i * 0.08;
    }

    // 眩晕星星
    this.starRing.visible = this.dizzy > 0;
    if (this.dizzy > 0) this.starRing.rotation.y += dt * 6;

    // 眼睛轻微转动
    for (const e of this.eyes) e.position.x = Math.sign(e.position.x) * (0.19 + Math.sin(t * 0.7) * 0.01);
    const prop = this.head.getObjectByName('propeller');
    if (prop) prop.rotation.y += dt * (8 + ctx.speed);
  }
}
