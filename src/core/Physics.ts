import RAPIER from '@dimforge/rapier3d-compat';
import type { Object3D } from 'three';

export type ObstacleKind = 'solid' | 'breakable' | 'hazard' | 'ball';

export interface ObstacleRef {
  kind: ObstacleKind;
  type: string;
  mesh?: Object3D;
  body?: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  /** 危险物命中回调（例如岩浆喷发、落石） */
  hazardEffect?: 'crash' | 'spin' | 'launch';
  active: boolean;
  /** 软障碍碰撞后的冷却 */
  cooldown?: number;
  mass?: number;
}

export interface BikeContact {
  ref: ObstacleRef;
  nx: number;
  ny: number;
  nz: number;
  depth: number;
}

// 碰撞分组：高 16 位为成员，低 16 位为过滤
const G_OBSTACLE = 0x0001;
const G_BIKE = 0x0002;
const G_DEBRIS = 0x0004;
const G_GROUND = 0x0008;
const groups = (member: number, filter: number) => ((member & 0xffff) << 16) | (filter & 0xffff);

interface Debris {
  body: RAPIER.RigidBody;
  mesh: Object3D;
  life: number;
  removeMesh: boolean;
}

/** Rapier 3D 物理封装：障碍碰撞查询、动态碎片、地面网格 */
export class Physics {
  static ready = false;
  static async init() {
    if (Physics.ready) return;
    await RAPIER.init();
    Physics.ready = true;
  }

  world: RAPIER.World;
  private refs = new Map<number, ObstacleRef>();
  private debris: Debris[] = [];
  private bikeBodies: RAPIER.RigidBody[] = [];
  private ballShape: RAPIER.Ball;
  private identity = { x: 0, y: 0, z: 0, w: 1 };
  maxDebris = 40;

  constructor(gravity = 25) {
    this.world = new RAPIER.World({ x: 0, y: -gravity, z: 0 });
    this.world.timestep = 1 / 60;
    this.ballShape = new RAPIER.Ball(0.95);
  }

  private register(collider: RAPIER.Collider, ref: Omit<ObstacleRef, 'collider' | 'active'>) {
    const full: ObstacleRef = { ...ref, collider, active: true };
    this.refs.set(collider.handle, full);
    return full;
  }

  addStaticBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, yaw: number, ref: Omit<ObstacleRef, 'collider' | 'active'>) {
    const q = { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) };
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setRotation(q).setCollisionGroups(groups(G_OBSTACLE, G_BIKE | G_DEBRIS));
    return this.register(this.world.createCollider(desc), ref);
  }

  addStaticCylinder(x: number, y: number, z: number, r: number, hh: number, ref: Omit<ObstacleRef, 'collider' | 'active'>) {
    const desc = RAPIER.ColliderDesc.cylinder(hh, r).setTranslation(x, y, z).setCollisionGroups(groups(G_OBSTACLE, G_BIKE | G_DEBRIS));
    return this.register(this.world.createCollider(desc), ref);
  }

  addKinematic(shape: 'box' | 'ball' | 'cylinder', dims: number[], x: number, y: number, z: number, ref: Omit<ObstacleRef, 'collider' | 'active' | 'body'>) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, y, z));
    let desc: RAPIER.ColliderDesc;
    if (shape === 'box') desc = RAPIER.ColliderDesc.cuboid(dims[0], dims[1], dims[2]);
    else if (shape === 'ball') desc = RAPIER.ColliderDesc.ball(dims[0]);
    else desc = RAPIER.ColliderDesc.cylinder(dims[1], dims[0]);
    desc.setCollisionGroups(groups(G_OBSTACLE, G_BIKE | G_DEBRIS));
    const collider = this.world.createCollider(desc, body);
    return this.register(collider, { ...ref, body });
  }

  /** 可被撞飞的动态球（沙滩球等） */
  addDynamicBall(x: number, y: number, z: number, r: number, mesh: Object3D, ref: Omit<ObstacleRef, 'collider' | 'active' | 'body'>) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setLinearDamping(0.3).setAngularDamping(0.5));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(r).setRestitution(0.8).setDensity(0.15).setCollisionGroups(groups(G_OBSTACLE, G_BIKE | G_DEBRIS | G_GROUND | G_OBSTACLE)),
      body,
    );
    return this.register(collider, { ...ref, body, mesh });
  }

  /** 地面三角网格（供碎片/动态物体落地） */
  addGroundMesh(vertices: Float32Array, indices: Uint32Array) {
    const desc = RAPIER.ColliderDesc.trimesh(vertices, indices).setCollisionGroups(groups(G_GROUND, G_DEBRIS | G_OBSTACLE)).setFriction(0.8);
    return this.world.createCollider(desc);
  }

  removeCollider(c: RAPIER.Collider) {
    this.world.removeCollider(c, false);
  }

  /** 移除障碍（无尽模式回收） */
  removeRef(ref: ObstacleRef) {
    if (ref.active || this.refs.has(ref.collider.handle)) {
      this.refs.delete(ref.collider.handle);
      if (ref.body) this.world.removeRigidBody(ref.body);
      else this.world.removeCollider(ref.collider, false);
    }
    ref.active = false;
  }

  addGroundPlane(y: number) {
    const desc = RAPIER.ColliderDesc.cuboid(4000, 1, 4000).setTranslation(0, y - 1, 0).setCollisionGroups(groups(G_GROUND, G_DEBRIS | G_OBSTACLE));
    this.world.createCollider(desc);
  }

  /** 每个骑手对应一个运动学碰撞球，推开碎片 */
  createBikeBody() {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(RAPIER.ColliderDesc.capsule(0.6, 0.7).setCollisionGroups(groups(G_BIKE, G_DEBRIS | G_OBSTACLE)), body);
    this.bikeBodies.push(body);
    return body;
  }

  setKinematic(body: RAPIER.RigidBody, x: number, y: number, z: number, yaw = 0) {
    body.setNextKinematicTranslation({ x, y, z });
    if (yaw) body.setNextKinematicRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
  }

  /** 查询骑手与障碍的接触（法线指向骑手） */
  queryBike(x: number, y: number, z: number, out: BikeContact[]) {
    out.length = 0;
    const pos = { x, y: y + 0.9, z };
    this.world.intersectionsWithShape(
      pos,
      this.identity,
      this.ballShape,
      (col) => {
        const ref = this.refs.get(col.handle);
        if (!ref || !ref.active) return true;
        const c = col.contactShape(this.ballShape, pos, this.identity, 0.05);
        if (c) {
          let nx = c.normal1.x;
          let ny = c.normal1.y;
          let nz = c.normal1.z;
          const l = Math.hypot(nx, nz);
          if (l > 1e-4) {
            nx /= l;
            nz /= l;
          } else {
            const t = col.translation();
            nx = x - t.x;
            nz = z - t.z;
            const l2 = Math.hypot(nx, nz) || 1;
            nx /= l2;
            nz /= l2;
          }
          out.push({ ref, nx, ny, nz, depth: Math.max(0, -c.distance) });
        }
        return true;
      },
      undefined,
      groups(G_BIKE, G_OBSTACLE),
    );
    return out;
  }

  /** 把静态可破坏障碍转为动态碎片飞出去 */
  breakObstacle(ref: ObstacleRef, vx: number, vy: number, vz: number) {
    if (!ref.active || !ref.mesh) return;
    ref.active = false;
    const t = ref.collider.translation();
    const rot = ref.collider.rotation();
    const shape = ref.collider.shape;
    if (ref.body && ref.body.isKinematic()) {
      // 运动学物体（动物、风滚草）：隐藏本体并飞出一个替身，稍后由危险系统复活
      ref.mesh.visible = false;
      ref.body.setNextKinematicTranslation({ x: t.x, y: -500, z: t.z });
      const clone = ref.mesh.clone();
      clone.visible = true;
      ref.mesh.parent?.add(clone);
      this.spawnDebris(clone, shape, t, rot, vx, vy, vz, 3, true);
      return;
    }
    this.world.removeCollider(ref.collider, false);
    this.refs.delete(ref.collider.handle);
    if (ref.body) {
      this.world.removeRigidBody(ref.body);
    }
    this.spawnDebris(ref.mesh, shape, t, rot, vx, vy, vz, 7);
  }

  spawnDebris(mesh: Object3D, shape: RAPIER.Shape, t: RAPIER.Vector, rot: RAPIER.Rotation, vx: number, vy: number, vz: number, life: number, removeMesh = false) {
    if (this.debris.length >= this.maxDebris) {
      const old = this.debris.shift()!;
      old.mesh.visible = false;
      if (old.removeMesh) old.mesh.removeFromParent();
      this.world.removeRigidBody(old.body);
    }
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(t.x, t.y + 0.3, t.z)
        .setRotation(rot)
        .setLinvel(vx, vy, vz)
        .setAngvel({ x: (Math.random() - 0.5) * 14, y: (Math.random() - 0.5) * 10, z: (Math.random() - 0.5) * 14 })
        .setLinearDamping(0.2),
    );
    const desc = new RAPIER.ColliderDesc(shape).setDensity(0.4).setRestitution(0.45).setFriction(0.6).setCollisionGroups(groups(G_DEBRIS, G_GROUND | G_OBSTACLE | G_BIKE | G_DEBRIS));
    this.world.createCollider(desc, body);
    this.debris.push({ body, mesh, life, removeMesh });
  }

  getRef(handle: number) {
    return this.refs.get(handle);
  }

  step(dt: number) {
    this.world.timestep = dt;
    this.world.step();
    // 同步碎片
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      const p = d.body.translation();
      const r = d.body.rotation();
      d.mesh.position.set(p.x, p.y, p.z);
      d.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      if (d.life < 1) d.mesh.scale.setScalar(Math.max(0.01, d.life));
      if (d.life <= 0 || p.y < -200) {
        d.mesh.visible = false;
        if (d.removeMesh) d.mesh.removeFromParent();
        this.world.removeRigidBody(d.body);
        this.debris.splice(i, 1);
      }
    }
  }

  /** 同步动态球等由物理驱动的障碍网格 */
  syncDynamic(ref: ObstacleRef) {
    if (!ref.body || !ref.mesh) return;
    const p = ref.body.translation();
    const r = ref.body.rotation();
    ref.mesh.position.set(p.x, p.y, p.z);
    ref.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }

  dispose() {
    this.world.free();
    this.refs.clear();
    this.debris = [];
    this.bikeBodies = [];
  }
}
