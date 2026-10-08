import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { PelicanDef, PelicanModifiers } from '../data/pelicans';
import type { MotorcycleDef, MotorcycleStats } from '../data/motorcycles';
import type { Appearance } from '../data/cosmetics';
import type { ItemId } from '../data/items';
import type { RaceWorld } from '../core/types';
import type { GroundInfo } from '../tracks/TrackGeometry';
import type { BikeContact } from '../core/Physics';
import { Pelican } from './Pelican';
import { MotorcycleModel } from './Motorcycle';
import { SURFACES } from '../tracks/surfaces';
import { DriftSystem } from '../systems/DriftSystem';
import { NitroSystem, NITRO_SPEED } from '../systems/NitroSystem';
import { clamp, damp, dampAngle, lerp, wrapAngle } from '../utils/math';
import { glow } from '../utils/materials';
import { bakeGroup } from '../tracks/Props';

let lodLit: THREE.MeshLambertMaterial | null = null;
let lodGlow: THREE.MeshBasicMaterial | null = null;
const LOD_DIST2 = 85 * 85;

export interface RacerInput {
  throttle: number;
  brake: number;
  steer: number;
  drift: boolean;
  nitro: boolean;
  // 以下为按下瞬间触发
  attackL: boolean;
  attackR: boolean;
  peck: boolean;
  sweep: boolean;
  clamp: boolean;
  superDash: boolean;
  useItem: boolean;
  horn: boolean;
  reset: boolean;
}

export const emptyInput = (): RacerInput => ({
  throttle: 0,
  brake: 0,
  steer: 0,
  drift: false,
  nitro: false,
  attackL: false,
  attackR: false,
  peck: false,
  sweep: false,
  clamp: false,
  superDash: false,
  useItem: false,
  horn: false,
  reset: false,
});

export type RacerState = 'driving' | 'crashed' | 'clamped' | 'finished' | 'eliminated';

export interface RacerStats {
  hits: number;
  kos: number;
  driftDist: number;
  tricks: number;
  specialHits: number;
  clampHits: number;
  crashes: number;
  shortcuts: Set<string>;
  itemsUsed: Set<ItemId>;
  topSpeed: number;
  damageTaken: number;
}

export interface RacerSetup {
  index: number;
  name: string;
  isPlayer: boolean;
  pelican: PelicanDef;
  bike: MotorcycleDef;
  stats: MotorcycleStats;
  appearance: Appearance;
}

const tmpContacts: BikeContact[] = [];

/** 骑手：鹈鹕 + 摩托 + 街机物理 + 比赛状态 */
export class Racer {
  index: number;
  name: string;
  isPlayer: boolean;
  pelicanDef: PelicanDef;
  bikeDef: MotorcycleDef;
  stats: MotorcycleStats;
  mods: PelicanModifiers;
  app: Appearance;
  world!: RaceWorld;

  // 模型
  group = new THREE.Group();
  tilt = new THREE.Group();
  riderGroup = new THREE.Group();
  bike: MotorcycleModel;
  pelican: Pelican;
  flames: THREE.Mesh[] = [];
  private goldAura: THREE.Mesh;
  private shadowBlob: THREE.Mesh;
  body?: RAPIER.RigidBody;

  // 运动学
  pos = new THREE.Vector3();
  prevPos = new THREE.Vector3();
  vx = 0;
  vz = 0;
  vy = 0;
  yaw = 0;
  prevYaw = 0;
  speed = 0;
  grounded = true;
  airTime = 0;
  pitch = 0;
  roll = 0;
  steerVis = 0;
  visualYaw = 0;
  ground: GroundInfo = {
    y: 0, surface: 'asphalt', onRoad: true, roadIdx: 0, mainS: 0, mainLateral: 0, mainIndex: 0, shortcutU: -1,
    barrierNx: 0, barrierNz: 0, barrierDepth: 0, boost: false, rampId: -1, tx: 0, tz: 1,
  };
  hint = -1;
  lastGroundY = 0;
  lastSafeS = 0;
  surfaceName = '';

  // 状态
  state: RacerState = 'driving';
  stateTimer = 0;
  invuln = 0;
  wobble = 0;
  spin = 0;
  frozen = 0;
  slippery = 0;
  blind = 0;
  golden = 0;
  superDash = 0;
  boostTimer = 0;
  boneTimer = 0;
  stunned = 0;
  clampedBy: Racer | null = null;
  clampTarget: Racer | null = null;
  clampTimer = 0;
  private crashSpinX = 0;
  private crashSpinZ = 0;
  private riderVel = new THREE.Vector3();
  private riderPos = new THREE.Vector3();
  private riderDetached = false;

  // 漂移/氮气
  drifting = false;
  driftDir = 0;
  driftCharge = 0;
  driftTime = 0;
  driftDistance = 0;
  nitro = 40;
  nitroActive = false;

  // 战斗
  cd = { wingL: 0, wingR: 0, peck: 0, sweep: 0, clamp: 0 };
  energy = 0;
  balance = 100;
  hp = 100;
  item: ItemId | null = null;
  lastAttacker: Racer | null = null;
  lastAttackTime = -99;
  lastHitTime = -99;
  revengeTarget: Racer | null = null;
  revengeUntil = 0;
  hornCd = 0;

  // 比赛
  lapsCompleted = -1;
  cp = 15;
  progress = 0;
  finished = false;
  finishTime = 0;
  place = 1;
  lapStartTime = 0;
  lapTimes: number[] = [];
  wrongWayTime = 0;
  private scU0 = -1;
  private scIdx = -1;
  eliminatedAt = 0;
  lives = 3;

  stat: RacerStats = {
    hits: 0, kos: 0, driftDist: 0, tricks: 0, specialHits: 0, clampHits: 0, crashes: 0,
    shortcuts: new Set(), itemsUsed: new Set(), topSpeed: 0, damageTaken: 0,
  };

  // 特技
  trickActive = false;
  trickT = 0;
  trickKind: 'flip' | 'barrel' | 'spin' = 'spin';
  trickAngle = 0;
  tricksThisJump = 0;

  input: RacerInput = emptyInput();
  steerSmoothed = 0;

  constructor(setup: RacerSetup) {
    this.index = setup.index;
    this.name = setup.name;
    this.isPlayer = setup.isPlayer;
    this.pelicanDef = setup.pelican;
    this.bikeDef = setup.bike;
    this.stats = setup.stats;
    this.mods = setup.pelican.mods;
    this.app = setup.appearance;
    this.nitro = this.stats.nitroCapacity * 0.4;

    this.bike = new MotorcycleModel(setup.bike, setup.appearance);
    this.pelican = new Pelican(setup.pelican, setup.appearance);
    this.pelican.root.scale.setScalar(0.95);
    this.riderGroup.add(this.pelican.root);
    this.riderGroup.position.copy(this.bike.seat);
    this.tilt.add(this.bike.root, this.riderGroup);
    this.group.add(this.tilt);

    // 氮气尾焰
    const trail = setup.appearance.trail;
    const flameColor = trail === 'plasma' ? 0x3cc8ff : trail === 'rainbow' ? 0xff4fd8 : trail === 'bubbles' ? 0x9fe8ff : trail === 'stars' ? 0xffe14a : 0xff7a1a;
    const flameGeo = new THREE.ConeGeometry(0.12, 1, 6);
    flameGeo.translate(0, -0.5, 0);
    flameGeo.rotateX(Math.PI / 2);
    for (const e of this.bike.exhausts) {
      const f = new THREE.Mesh(flameGeo, glow(flameColor, 0.85));
      f.position.copy(e);
      f.visible = false;
      const core = new THREE.Mesh(flameGeo, glow(0xffffff, 0.9));
      core.scale.set(0.5, 0.5, 0.6);
      f.add(core);
      this.bike.body.add(f);
      this.flames.push(f);
    }
    // 黄金鲤鱼无敌光环
    this.goldAura = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), glow(0xffd700, 0.25));
    this.goldAura.position.y = 1.1;
    this.goldAura.visible = false;
    this.group.add(this.goldAura);
    // 圆形阴影（低画质时替代实时阴影）
    this.shadowBlob = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.shadowBlob.scale.set(0.8, 1, 1.5);
    this.group.add(this.shadowBlob);
    // 远距离 LOD：把静止姿态烘焙为单个网格，远处骑手只需 1~2 次绘制
    this.lod = new THREE.Group();
    const baked = bakeGroup(this.tilt);
    lodLit = lodLit ?? new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    lodGlow = lodGlow ?? new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    if (baked.lit) this.lod.add(new THREE.Mesh(baked.lit, lodLit));
    if (baked.glow) this.lod.add(new THREE.Mesh(baked.glow, lodGlow));
    this.lod.visible = false;
    this.group.add(this.lod);
  }

  get forwardX() {
    return Math.sin(this.yaw);
  }
  get forwardZ() {
    return Math.cos(this.yaw);
  }
  get rightX() {
    return -Math.cos(this.yaw);
  }
  get rightZ() {
    return Math.sin(this.yaw);
  }

  get maxSpeedBase() {
    return this.stats.maxSpeed;
  }

  get isActive() {
    return this.state === 'driving' || this.state === 'finished';
  }

  get invincible() {
    return this.golden > 0 || this.superDash > 0 || this.invuln > 0;
  }

  get lap() {
    return Math.max(1, this.lapsCompleted + 1);
  }

  attach(world: RaceWorld) {
    this.world = world;
    this.body = world.physics.createBikeBody();
  }

  /** 放置到赛道指定进度与横向位置 */
  placeAt(s: number, lateral: number) {
    const p = this.world.track.main.pointAt(s);
    this.pos.set(p.x + p.rx * lateral, p.y, p.z + p.rz * lateral);
    this.prevPos.copy(this.pos);
    this.yaw = Math.atan2(p.tx, p.tz);
    this.prevYaw = this.yaw;
    this.visualYaw = 0;
    this.speed = 0;
    this.vx = this.vz = this.vy = 0;
    this.grounded = true;
    this.hint = -1;
    this.world.track.query(this.pos.x, this.pos.z, this.pos.y + 1, -1, this.ground);
    this.hint = this.ground.mainIndex;
    this.lastGroundY = this.pos.y;
    this.lastSafeS = s;
  }

  // ——— 每个物理步 ———
  update(dt: number, input: RacerInput) {
    const w = this.world;
    this.input = input;
    this.prevPos.copy(this.pos);
    this.prevYaw = this.yaw;
    this.tickTimers(dt);

    if (this.state === 'eliminated') return;
    if (this.state === 'crashed') {
      this.updateCrash(dt);
      this.syncBody();
      return;
    }
    if (this.state === 'clamped') {
      this.syncBody();
      return;
    }

    const finished = this.state === 'finished';
    let throttle = input.throttle;
    let brake = input.brake;
    let steer = input.steer;
    if (!w.started) {
      throttle = 0;
      steer = 0;
    }
    if (finished && !this.isPlayer) throttle = Math.min(throttle, 0.6);

    // 失控状态：转向噪声、无法加速
    if (this.wobble > 0) steer = clamp(steer * 0.4 + Math.sin(w.time * 17 + this.index) * 0.8, -1, 1);
    if (this.stunned > 0) {
      throttle = 0;
      steer *= 0.3;
    }
    if (this.spin > 0) {
      throttle = 0;
      steer = 0;
    }
    if (this.blind > 0 && !this.isPlayer) steer = clamp(steer + Math.sin(w.time * 3 + this.index) * 0.5, -1, 1);
    this.steerSmoothed = damp(this.steerSmoothed, steer, 14, dt);
    steer = this.steerSmoothed;

    const surf = SURFACES[this.ground.surface];
    const immune = this.bikeDef.surfaceImmunity;
    let grip = this.ground.surface === 'offroad' ? lerp(surf.grip, 1, this.bikeDef.offroadGrip - 0.4) : lerp(surf.grip, 1, immune);
    let surfSpeed = this.ground.surface === 'offroad' ? this.bikeDef.offroadGrip : lerp(surf.speed, 1, immune);
    if (this.slippery > 0) grip *= 0.25;
    if (w.gravity < 15) grip *= 0.85;

    // 目标极速
    let maxSpeed = this.stats.maxSpeed * surfSpeed;
    let accel = this.stats.acceleration * this.mods.accel;
    NitroSystem.update(this, input.nitro && w.started, dt);
    if (this.nitroActive) {
      maxSpeed *= NITRO_SPEED;
      accel *= 1.6;
    }
    if (this.boostTimer > 0) {
      maxSpeed *= 1.22;
      accel *= 1.5;
    }
    if (this.golden > 0) {
      maxSpeed *= 1.12;
      accel *= 1.3;
    }
    if (this.superDash > 0) {
      maxSpeed = this.stats.maxSpeed * 1.55;
      accel *= 3;
      throttle = 1;
    }
    if (this.frozen > 0) maxSpeed *= 0.5;
    if (this.drifting) maxSpeed *= 0.97;
    if (w.chaos) maxSpeed *= 1.05;

    // 纵向速度
    if (this.grounded) {
      if (throttle > 0 && this.speed < maxSpeed) {
        const f = 1 - Math.pow(clamp(this.speed / maxSpeed, 0, 1), 2) * 0.75;
        this.speed += accel * throttle * f * dt;
        if (this.speed > maxSpeed) this.speed = maxSpeed;
      }
      if (this.speed > maxSpeed) this.speed = damp(this.speed, maxSpeed, 1.6, dt);
      if (brake > 0) {
        if (this.speed > 0.5) this.speed -= this.stats.braking * brake * dt;
        else this.speed = Math.max(-9, this.speed - 10 * brake * dt);
      }
      if (throttle <= 0 && brake <= 0) this.speed = damp(this.speed, 0, 0.35, dt);
      this.speed -= surf.drag * (1 - immune) * dt * clamp(this.speed / 20, 0, 1);
    } else {
      this.speed = damp(this.speed, Math.min(this.speed, maxSpeed), 0.3, dt);
    }

    // 转向
    const sp = Math.abs(this.speed);
    const speedFactor = clamp(sp / 10, 0, 1) * (1 - 0.32 * clamp(sp / 50, 0, 1));
    let turnRate = this.stats.handling * this.mods.handling * speedFactor;
    if (!this.grounded) turnRate *= 0.35;
    DriftSystem.update(this, steer, input.drift && w.started, dt);
    let yawRate: number;
    if (this.drifting) {
      const tight = clamp(steer * this.driftDir, -1, 1);
      yawRate = -this.driftDir * turnRate * (1.05 + 0.45 * tight);
    } else {
      yawRate = -steer * turnRate * (this.speed < 0 ? -1 : 1);
    }
    if (this.spin <= 0) this.yaw = wrapAngle(this.yaw + yawRate * dt);

    // 速度向量：低抓地时速度方向滞后于车头（冰面打滑）
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    let tvx = fx * this.speed;
    let tvz = fz * this.speed;
    if (this.drifting) {
      // 漂移时向外侧滑动
      const slide = this.speed * 0.16;
      tvx += -Math.cos(this.yaw) * -this.driftDir * slide;
      tvz += Math.sin(this.yaw) * -this.driftDir * slide;
    }
    const lambda = this.grounded ? grip * (this.drifting ? 5 : 9) : 0.4;
    const k = 1 - Math.exp(-lambda * dt);
    this.vx += (tvx - this.vx) * k;
    this.vz += (tvz - this.vz) * k;
    // 纵向速度标量与真实速度保持一致（被撞击时）
    const along = this.vx * fx + this.vz * fz;
    if (this.grounded && Math.abs(along) < Math.abs(this.speed) - 0.5) this.speed = lerp(this.speed, along, 0.2);

    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;

    this.updateVertical(dt);
    this.handleBarrier();
    this.handleObstacles();
    this.checkFallOrLava();

    // 视觉：车身倾斜、漂移偏转
    const leanTarget = this.grounded ? steer * clamp(sp / 22, 0, 1) * (this.drifting ? 0.75 : 0.5) : steer * 0.15;
    this.roll = damp(this.roll, leanTarget + (this.wobble > 0 ? Math.sin(w.time * 25) * 0.15 : 0), 9, dt);
    const driftYaw = this.drifting ? this.driftDir * -0.5 * (this.bikeDef.id === 'hover' ? 1.3 : 1) : 0;
    if (this.spin > 0) this.visualYaw += dt * 16;
    else this.visualYaw = dampAngle(this.visualYaw, driftYaw, 7, dt);
    this.steerVis = damp(this.steerVis, this.drifting ? -this.driftDir * 0.6 : steer, 10, dt);

    this.stat.topSpeed = Math.max(this.stat.topSpeed, this.speed);
    this.syncBody();
  }

  private tickTimers(dt: number) {
    const dec = (v: number) => (v > 0 ? Math.max(0, v - dt) : 0);
    this.invuln = dec(this.invuln);
    this.wobble = dec(this.wobble);
    this.spin = dec(this.spin);
    this.frozen = dec(this.frozen);
    this.slippery = dec(this.slippery);
    this.blind = dec(this.blind);
    this.golden = dec(this.golden);
    this.superDash = dec(this.superDash);
    this.boostTimer = dec(this.boostTimer);
    this.stunned = dec(this.stunned);
    this.hornCd = dec(this.hornCd);
    const wasBone = this.boneTimer > 0;
    this.boneTimer = dec(this.boneTimer);
    if (wasBone && this.boneTimer <= 0) this.pelican.setBone(false);
    const cdMul = this.world.chaos ? 2 : 1;
    this.cd.wingL = Math.max(0, this.cd.wingL - dt * cdMul);
    this.cd.wingR = Math.max(0, this.cd.wingR - dt * cdMul);
    this.cd.peck = Math.max(0, this.cd.peck - dt * cdMul);
    this.cd.sweep = Math.max(0, this.cd.sweep - dt * cdMul);
    this.cd.clamp = Math.max(0, this.cd.clamp - dt * cdMul);
    // 平衡值回复
    if (this.world.time - this.lastHitTime > 2) this.balance = Math.min(100, this.balance + 12 * dt);
  }

  private updateVertical(dt: number) {
    const w = this.world;
    const g = w.gravity / (this.airTime > 0.1 ? this.mods.jump : 1);
    const prevY = this.pos.y;
    w.track.query(this.pos.x, this.pos.z, this.pos.y, this.hint, this.ground);
    this.hint = this.ground.mainIndex;
    const gy = this.ground.y;
    if (gy !== null && this.ground.onRoad && !this.ground.barrierDepth) {
      this.lastSafeS = this.ground.mainS;
    }
    if (this.grounded) {
      if (gy === null) {
        this.grounded = false;
        this.airTime = 0;
      } else {
        const desiredVy = (gy - prevY) / dt;
        if (desiredVy < this.vy - g * dt * 3 && this.vy > -5) {
          // 地面下降快于重力（跳台末端）→ 腾空
          this.grounded = false;
          this.airTime = 0;
          this.tricksThisJump = 0;
        } else {
          this.pos.y = gy;
          this.vy = clamp(desiredVy, -30, 30);
          this.lastGroundY = gy;
          if (this.ground.boost && this.boostTimer < 0.8) {
            this.boostTimer = 1.1;
            this.speed = Math.min(this.speed + 8, this.stats.maxSpeed * 1.3);
            w.events.emit('sfx', { name: 'boost', racer: this });
          }
        }
      }
    }
    if (!this.grounded) {
      this.airTime += dt;
      this.vy -= g * dt;
      this.pos.y += this.vy * dt;
      this.airAssist(dt);
      this.updateTrick(dt);
      if (gy !== null && this.pos.y <= gy && this.vy <= 0) this.land(gy);
    }
    // 俯仰
    const hs = Math.max(4, Math.hypot(this.vx, this.vz));
    const pitchTarget = -Math.atan2(this.vy, hs) * (this.grounded ? 0.9 : 0.7);
    this.pitch = damp(this.pitch, pitchTarget, this.grounded ? 12 : 3, dt);
  }

  private land(gy: number) {
    const w = this.world;
    const impact = -this.vy;
    this.pos.y = gy;
    this.grounded = true;
    if (this.trickActive) {
      // 特技未完成就落地：失控
      this.trickActive = false;
      this.trickAngle = 0;
      this.wobble = 0.8;
      this.speed *= 0.7;
      if (this.isPlayer) w.events.emit('notify', { text: '特技失败！', kind: 'bad', racer: this });
    } else if (this.tricksThisJump > 0) {
      const bonus = this.tricksThisJump;
      this.nitro = Math.min(this.stats.nitroCapacity, this.nitro + 20 * bonus);
      this.boostTimer = Math.max(this.boostTimer, 0.6 + 0.3 * bonus);
      this.energy = Math.min(100, this.energy + 12 * bonus);
      this.stat.tricks += bonus;
      w.events.emit('trick', { racer: this, name: bonus > 1 ? `连续特技 x${bonus}` : '空中特技' });
      w.events.emit('sfx', { name: 'trick', racer: this });
    }
    this.tricksThisJump = 0;
    if (impact > 9) {
      w.events.emit('shake', { amount: clamp(impact / 30, 0.15, 0.7), racer: this });
      w.events.emit('sfx', { name: 'land', racer: this, volume: clamp(impact / 25, 0.3, 1) });
      w.fx.burst(this.ground.surface === 'sand' || this.ground.surface === 'offroad' ? 'dust' : 'smoke', this.pos.x, this.pos.y + 0.2, this.pos.z, 10, 4, 0.2);
      if (impact > 26 && !this.invincible) {
        this.wobble = 0.5;
        this.speed *= 0.85;
      }
    }
    this.vy = 0;
    this.airTime = 0;
  }

  /** 街机式空中辅助：飞行方向逐渐贴合赛道走向，并把偏出路面的骑手拉回，避免跳台后飞出赛道 */
  private airAssist(dt: number) {
    const gr = this.ground;
    const hs = Math.hypot(this.vx, this.vz);
    if (hs > 4) {
      const cur = Math.atan2(this.vx, this.vz);
      const d = wrapAngle(Math.atan2(gr.tx, gr.tz) - cur);
      if (Math.abs(d) < 1.3) {
        const a = cur + clamp(d, -1.5 * dt, 1.5 * dt);
        this.vx = Math.sin(a) * hs;
        this.vz = Math.cos(a) * hs;
      }
      if (!this.trickActive) this.yaw = dampAngle(this.yaw, Math.atan2(this.vx, this.vz) + (this.speed < 0 ? Math.PI : 0), 2.5, dt);
    }
    if (gr.roadIdx <= 0) {
      const lim = this.world.track.main.halfWidth - 1.5;
      const lat = gr.mainLateral;
      if (Math.abs(lat) > lim && Math.abs(lat) < lim + 14) {
        const push = -Math.sign(lat) * 10 * dt;
        this.vx += -gr.tz * push;
        this.vz += gr.tx * push;
      }
    }
  }

  /** 空中特技：滞空时按漂移键 */
  private updateTrick(dt: number) {
    const inp = this.input;
    if (!this.trickActive && inp.drift && this.airTime > 0.12 && this.state === 'driving') {
      const timeLeft = this.estimateAirTimeLeft();
      if (timeLeft > 0.35) {
        this.trickActive = true;
        this.trickT = 0;
        this.trickAngle = 0;
        this.trickKind = Math.abs(inp.steer) > 0.4 ? 'barrel' : inp.brake > 0.3 ? 'flip' : 'spin';
        this.pelican.trigger('trick');
        this.world.events.emit('sfx', { name: 'whoosh', racer: this });
      }
    }
    if (this.trickActive) {
      const dur = 0.55 / Math.min(1.3, this.mods.jump);
      this.trickT += dt;
      this.trickAngle = Math.min(1, this.trickT / dur) * Math.PI * 2;
      if (this.trickT >= dur) {
        this.trickActive = false;
        this.trickAngle = 0;
        this.tricksThisJump++;
      }
    }
  }

  estimateAirTimeLeft() {
    // 估算落地时间：假设下方地面高度为上次地面高度
    const g = this.world.gravity / this.mods.jump;
    const h = this.pos.y - this.lastGroundY;
    const disc = this.vy * this.vy + 2 * g * Math.max(0, h);
    return (this.vy + Math.sqrt(disc)) / g;
  }

  private handleBarrier() {
    const gr = this.ground;
    if (gr.barrierDepth <= 0) return;
    const nx = gr.barrierNx;
    const nz = gr.barrierNz;
    this.pos.x += nx * gr.barrierDepth;
    this.pos.z += nz * gr.barrierDepth;
    const vn = this.vx * nx + this.vz * nz;
    if (vn < 0) {
      this.vx -= nx * vn * 1.4;
      this.vz -= nz * vn * 1.4;
      const hit = -vn;
      this.speed *= 1 - clamp(hit / 60, 0.02, 0.4);
      if (hit > 4) {
        this.world.fx.burst('spark', this.pos.x - nx * 0.6, this.pos.y + 0.4, this.pos.z - nz * 0.6, 6, 5, 0.3);
        this.world.events.emit('sfx', { name: 'scrape', racer: this, volume: clamp(hit / 20, 0.2, 0.8) });
      }
      if (hit > 20 && !this.invincible) {
        this.wobble = 0.6;
        this.world.events.emit('shake', { amount: 0.3, racer: this });
      }
      // 把车头推向沿墙方向
      const along = Math.atan2(this.vx, this.vz);
      this.yaw = dampAngle(this.yaw, along, 4, 1 / 60);
    }
  }

  private handleObstacles() {
    const w = this.world;
    const contacts = w.physics.queryBike(this.pos.x, this.pos.y, this.pos.z, tmpContacts);
    for (const c of contacts) {
      const ref = c.ref;
      const vn = -(this.vx * c.nx + this.vz * c.nz); // 接近速度
      if (ref.kind === 'breakable') {
        if (this.invincible || vn > 2 || this.speed > 6) {
          w.physics.breakObstacle(ref, this.vx * 0.9 + c.nx * -3, 6 + Math.abs(this.speed) * 0.15, this.vz * 0.9 + c.nz * -3);
          w.events.emit('sfx', { name: 'break', racer: this });
          w.fx.burst('spark', this.pos.x, this.pos.y + 0.6, this.pos.z, 4, 4);
          if (!this.invincible) {
            this.speed *= 0.82;
            this.wobble = Math.max(this.wobble, 0.25);
          }
        }
        continue;
      }
      if (ref.kind === 'ball') {
        if (ref.body && (ref.cooldown ?? 0) <= w.time) {
          ref.cooldown = w.time + 0.3;
          ref.body.applyImpulse({ x: this.vx * 0.4 - c.nx * 3, y: 4 + Math.abs(this.speed) * 0.1, z: this.vz * 0.4 - c.nz * 3 }, true);
          this.speed *= 0.93;
          w.events.emit('sfx', { name: 'boing', racer: this, volume: 0.6 });
        }
        continue;
      }
      if (ref.kind === 'hazard') {
        if (this.invincible) continue;
        if (ref.hazardEffect === 'spin') this.spinOut(1.1);
        else if (ref.hazardEffect === 'launch') this.crash('launch', null, 14);
        else this.crash('hazard', null, 8);
        continue;
      }
      // 实心障碍
      this.pos.x += c.nx * (c.depth + 0.02);
      this.pos.z += c.nz * (c.depth + 0.02);
      if (vn > 0) {
        this.vx += c.nx * vn * 1.3;
        this.vz += c.nz * vn * 1.3;
        if (this.invincible) {
          this.speed *= 0.95;
          continue;
        }
        const tough = 0.8 + this.stats.durability * 0.05 * this.mods.defense;
        if (vn > 24 * tough) {
          this.lastHitType = ref.type;
          this.crash('obstacle', null, vn * 0.3);
        } else if (vn > 11 * tough) {
          this.wobble = 0.7;
          this.speed *= 0.55;
          this.damage(10, null);
          w.events.emit('shake', { amount: 0.35, racer: this });
          w.events.emit('sfx', { name: 'hit', racer: this });
          w.fx.burst('star', this.pos.x, this.pos.y + 1.4, this.pos.z, 4, 3);
        } else {
          this.speed *= 0.86;
          if (vn > 4) w.events.emit('sfx', { name: 'scrape', racer: this, volume: 0.4 });
        }
      }
    }
  }

  private checkFallOrLava() {
    const w = this.world;
    if (w.lavaY !== null && this.pos.y < w.lavaY + 0.5) {
      w.fx.burst('lava', this.pos.x, this.pos.y + 0.5, this.pos.z, 20, 8);
      w.events.emit('sfx', { name: 'splash', racer: this });
      this.crash('lava', null, 6, true);
      return;
    }
    // 只有脚下没有地面（或已穿到地面以下）才算掉落；从高处落到下层路面不算
    const gy = this.ground.y;
    if (!this.grounded && (gy === null ? this.pos.y < this.lastGroundY - 14 : this.pos.y < gy - 3)) {
      this.crash('fall', null, 0, true);
    }
  }

  // ——— 战斗反馈 ———

  /** 受到伤害：降低平衡值，归零时被击倒 */
  damage(amount: number, by: Racer | null, kind = 'hit') {
    if (this.invincible || this.state !== 'driving') return false;
    const w = this.world;
    const def = (0.75 + this.stats.durability * 0.05) * this.mods.defense;
    const dmg = amount / def;
    this.balance -= dmg * 1.4;
    this.stat.damageTaken += dmg;
    this.lastHitTime = w.time;
    if (by) {
      this.lastAttacker = by;
      this.lastAttackTime = w.time;
      this.revengeTarget = by;
      this.revengeUntil = w.time + 8;
    }
    if (w.mode === 'elimination') {
      this.hp -= dmg * 0.55;
    }
    this.energy = Math.min(100, this.energy + 4);
    this.pelican.trigger('hurt');
    w.fx.burst('feather', this.pos.x, this.pos.y + 1.3, this.pos.z, 8, 4, 0.4);
    if (this.isPlayer) w.events.emit('shake', { amount: 0.25, racer: this });
    if (this.balance <= 0 || (w.mode === 'elimination' && this.hp <= 0)) {
      this.balance = 100;
      this.crash(kind, by, 8);
      return true;
    }
    return false;
  }

  /** 推开（侧向冲量） */
  push(dx: number, dz: number, power: number) {
    if (this.invincible && this.golden > 0) return;
    this.vx += dx * power;
    this.vz += dz * power;
  }

  spinOut(sec: number) {
    if (this.invincible || this.state !== 'driving') return;
    this.spin = sec;
    this.drifting = false;
    this.speed *= 0.55;
    this.world.events.emit('sfx', { name: 'tumble', racer: this, volume: 0.6 });
    this.pelican.trigger('shout');
  }

  /** 摔车：摩托翻滚、骑手弹飞、落地星星眩晕，随后快速爬起 */
  crash(reason: string, by: Racer | null, force = 8, respawn = false) {
    if (this.state === 'crashed' || this.state === 'eliminated') return;
    if (this.state === 'finished') return;
    const w = this.world;
    if (by === null && w.time - this.lastAttackTime < 3 && this.lastAttacker) by = this.lastAttacker;
    if (this.clampTarget) this.releaseClampTarget();
    this.state = 'crashed';
    this.stateTimer = respawn ? 1.3 : 1.7;
    this.drifting = false;
    this.trickActive = false;
    this.nitroActive = false;
    this.superDash = 0;
    this.stat.crashes++;
    this.crashSpinX = (Math.random() < 0.5 ? -1 : 1) * (4 + force * 0.4);
    this.crashSpinZ = (Math.random() - 0.5) * 10;
    this.respawnAfterCrash = respawn || !this.ground.onRoad;
    // 骑手弹起
    this.riderDetached = true;
    this.riderGroup.getWorldPosition(this.riderPos);
    this.riderVel.set(this.vx * 0.6 + (Math.random() - 0.5) * 4, 7 + force * 0.4, this.vz * 0.6 + (Math.random() - 0.5) * 4);
    this.pelican.mood = 'tumble';
    this.pelican.setDizzy(2.2);
    w.fx.burst('feather', this.pos.x, this.pos.y + 1.2, this.pos.z, 22, 7, 0.5);
    w.fx.burst('star', this.pos.x, this.pos.y + 1.5, this.pos.z, 8, 5, 0.6);
    w.events.emit('sfx', { name: 'crash', racer: this });
    w.events.emit('sfx', { name: 'squawk', racer: this, pitch: this.pelicanDef.voicePitch * 1.2 });
    w.events.emit('crash', { racer: this, by, reason });
    if (this.isPlayer) w.events.emit('shake', { amount: 0.8, racer: this });
    if (w.mode === 'elimination') this.hp -= 18;
    if (w.mode === 'endless' && this.isPlayer) this.lives--;
  }
  respawnAfterCrash = false;
  private lod: THREE.Group;
  /** 最近一次撞上的障碍类型（调试/统计） */
  lastHitType = '';

  private updateCrash(dt: number) {
    const w = this.world;
    this.stateTimer -= dt;
    const fall = this.respawnAfterCrash && (this.ground.y === null || w.lavaY !== null);
    // 摩托滑行翻滚
    const fr = Math.exp(-2.2 * dt);
    this.vx *= fr;
    this.vz *= fr;
    this.speed *= fr;
    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;
    w.track.query(this.pos.x, this.pos.z, this.pos.y, this.hint, this.ground);
    this.hint = this.ground.mainIndex;
    if (this.ground.y !== null && !fall) {
      if (this.pos.y > this.ground.y + 0.05) {
        this.vy -= w.gravity * dt;
        this.pos.y = Math.max(this.ground.y, this.pos.y + this.vy * dt);
      } else {
        this.pos.y = this.ground.y;
        this.vy = 0;
      }
      if (this.ground.barrierDepth > 0) {
        this.pos.x += this.ground.barrierNx * this.ground.barrierDepth;
        this.pos.z += this.ground.barrierNz * this.ground.barrierDepth;
      }
    } else {
      this.vy -= w.gravity * dt;
      this.pos.y += this.vy * dt;
    }
    const spinDecay = this.stateTimer > 0.6 ? 1 : 0;
    this.pitch += this.crashSpinX * dt * spinDecay * 0.6;
    this.roll += this.crashSpinZ * dt * spinDecay * 0.5;
    if (spinDecay === 0) {
      this.pitch = damp(this.pitch, 0, 8, dt);
      this.roll = damp(this.roll, 0, 8, dt);
    }

    // 骑手弹飞轨迹
    if (this.riderDetached) {
      this.riderVel.y -= w.gravity * dt;
      this.riderPos.addScaledVector(this.riderVel, dt);
      const floor = (this.ground.y ?? this.pos.y - 50) + 0.1;
      if (this.riderPos.y < floor && !fall) {
        this.riderPos.y = floor;
        if (this.riderVel.y < -4) w.fx.burst('star', this.riderPos.x, floor + 1, this.riderPos.z, 5, 3, 0.5);
        this.riderVel.y = Math.abs(this.riderVel.y) * 0.3;
        this.riderVel.x *= 0.6;
        this.riderVel.z *= 0.6;
      }
    }

    if (this.stateTimer <= 0) this.recover();
  }

  private recover() {
    const w = this.world;
    if (this.respawnAfterCrash || !this.ground.onRoad || this.ground.y === null) {
      // 掉落重生：回到最近的安全赛道位置
      const s = w.track.safeRespawnS(this.lastSafeS + 5);
      this.placeAt(s, 0);
    } else {
      this.speed = 0;
      this.vx = this.vz = 0;
      // 车头朝向赛道方向
      this.yaw = Math.atan2(this.ground.tx, this.ground.tz);
      this.prevYaw = this.yaw;
    }
    this.state = this.finished ? 'finished' : 'driving';
    this.pitch = 0;
    this.roll = 0;
    this.visualYaw = 0;
    this.invuln = 1.6;
    this.wobble = 0;
    this.spin = 0;
    this.balance = 100;
    this.riderDetached = false;
    this.pelican.mood = 'ride';
    this.pelican.setDizzy(0.8);
    if (this.world.mode === 'elimination' && this.hp <= 0) this.eliminate();
  }

  /** 复位摩托（R 键） */
  resetToTrack() {
    if (this.state !== 'driving') return;
    const s = this.world.track.safeRespawnS(this.lastSafeS);
    this.placeAt(s, clamp(this.ground.mainLateral, -3, 3));
    this.invuln = 1.2;
  }

  eliminate() {
    this.state = 'eliminated';
    this.eliminatedAt = this.world.time;
    this.group.visible = false;
    this.world.fx.burst('feather', this.pos.x, this.pos.y + 1, this.pos.z, 30, 8);
    this.world.events.emit('eliminated', { racer: this });
    this.world.events.emit('sfx', { name: 'eliminate', racer: this });
  }

  releaseClampTarget() {
    if (this.clampTarget) {
      this.clampTarget.clampedBy = null;
      if (this.clampTarget.state === 'clamped') this.clampTarget.state = 'driving';
      this.clampTarget = null;
    }
  }

  /** 捷径与进度追踪 */
  updateShortcutTracking() {
    const g = this.ground;
    const k = g.roadIdx - 1;
    if (k >= 0 && g.shortcutU >= 0) {
      if (this.scIdx !== k) {
        this.scIdx = k;
        this.scU0 = g.shortcutU;
      }
      if (this.scU0 < 0.25 && g.shortcutU > 0.8) {
        const sc = this.world.track.shortcuts[k];
        if (sc) {
          this.scU0 = 2; // 避免重复计数
          this.stat.shortcuts.add(sc.cfg.id);
          this.world.events.emit('shortcut', { racer: this, id: sc.cfg.id, name: sc.cfg.name });
        }
      }
    } else if (g.roadIdx === 0) {
      this.scIdx = -1;
      this.scU0 = -1;
    }
  }

  syncBody() {
    if (this.body) this.world.physics.setKinematic(this.body, this.pos.x, this.pos.y + 0.9, this.pos.z);
  }

  // ——— 渲染同步（插值） ———
  render(alpha: number, dt: number, time: number, camPos?: THREE.Vector3) {
    if (this.state === 'eliminated') return;
    const g = this.group;
    g.position.lerpVectors(this.prevPos, this.pos, alpha);
    const useLod = !!camPos && !this.isPlayer && (this.state === 'driving' || this.state === 'finished') && g.position.distanceToSquared(camPos) > LOD_DIST2;
    const yaw = this.prevYaw + wrapAngle(this.yaw - this.prevYaw) * alpha;
    g.rotation.y = yaw + this.visualYaw;
    let trickPitch = 0;
    let trickRoll = 0;
    let trickYaw = 0;
    if (this.trickActive) {
      if (this.trickKind === 'flip') trickPitch = -this.trickAngle;
      else if (this.trickKind === 'barrel') trickRoll = this.trickAngle * Math.sign(this.input.steer || 1);
      else trickYaw = this.trickAngle;
    }
    this.tilt.rotation.set(this.pitch + trickPitch, trickYaw, this.roll + trickRoll, 'YXZ');
    this.tilt.position.y = this.trickActive ? 0.4 : 0;

    // 骑手：摔车时弹飞
    if (this.state === 'crashed') {
      if (this.riderDetached) {
        const local = this.riderPos.clone();
        g.worldToLocal(local);
        // 在最后 0.5 秒爬起并重新骑上
        if (this.stateTimer < 0.5) local.lerp(this.bike.seat, 1 - this.stateTimer / 0.5);
        this.riderGroup.position.copy(local);
        this.riderGroup.rotation.x += dt * (this.stateTimer > 0.6 ? 9 : 0);
        if (this.stateTimer <= 0.6) this.riderGroup.rotation.x = damp(this.riderGroup.rotation.x % (Math.PI * 2), 0, 10, dt);
      }
    } else if (this.state === 'clamped') {
      this.riderGroup.rotation.z = Math.sin(time * 20) * 0.3;
    } else {
      this.riderGroup.position.lerp(this.bike.seat, 1 - Math.exp(-12 * dt));
      this.riderGroup.rotation.set(0, 0, 0);
    }

    // 远处骑手（LOD）跳过程序化动画更新
    if (!useLod) {
      this.bike.update(dt, this.speed, this.steerVis, time);
      this.pelican.update({ speed: this.speed, steer: this.steerVis, boost: this.nitroActive || this.superDash > 0, airborne: !this.grounded, dt });
      this.pelican.setPouch(this.item !== null);
    }

    // 尾焰
    const flameOn = this.nitroActive || this.boostTimer > 0 || this.superDash > 0;
    for (const f of this.flames) {
      f.visible = flameOn;
      if (flameOn) {
        const l = (this.superDash > 0 ? 2.4 : this.nitroActive ? 1.6 : 1) * (0.85 + Math.random() * 0.3);
        f.scale.set(1.2, 1.2, l);
      }
    }
    // 无敌闪烁 / 黄金光环
    this.goldAura.visible = this.golden > 0 || this.superDash > 0;
    if (this.goldAura.visible) {
      this.goldAura.rotation.y += dt * 2;
      this.goldAura.scale.setScalar(1 + Math.sin(time * 10) * 0.05);
      ((this.goldAura.material as THREE.MeshBasicMaterial).color as THREE.Color).setHex(this.golden > 0 ? 0xffd700 : 0xffffff);
    }
    this.tilt.visible = !useLod && !(this.invuln > 0 && this.golden <= 0 && Math.floor(time * 14) % 2 === 0 && this.state === 'driving');
    this.lod.visible = useLod;
    if (useLod) this.lod.rotation.copy(this.tilt.rotation);
    // 冰冻着色
    this.shadowBlob.position.y = (this.ground.y ?? this.pos.y - 100) - g.position.y + 0.05;
    this.shadowBlob.visible = this.ground.y !== null && g.position.y - (this.ground.y ?? 0) < 12;
  }

  setShadowBlob(on: boolean) {
    (this.shadowBlob.material as THREE.Material).visible = on;
  }

  dispose() {
    this.group.removeFromParent();
  }
}
