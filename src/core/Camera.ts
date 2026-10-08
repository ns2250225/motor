import * as THREE from 'three';
import type { Racer } from '../entities/Racer';
import { clamp, damp, dampAngle, lerp } from '../utils/math';

export type CameraMode = 'chase' | 'near' | 'far';

const MODES: Record<CameraMode, { dist: number; height: number; look: number; fov: number }> = {
  chase: { dist: 7.2, height: 3.1, look: 1.4, fov: 66 },
  near: { dist: 4.6, height: 2.2, look: 1.3, fov: 72 },
  far: { dist: 11, height: 5.2, look: 1.6, fov: 62 },
};

/** 速度线：高速时从屏幕边缘向后掠过的细线 */
class SpeedLines {
  mesh: THREE.InstancedMesh;
  private data: { x: number; y: number; z: number; len: number }[] = [];
  private dummy = new THREE.Object3D();
  constructor(count = 40) {
    const g = new THREE.BoxGeometry(0.02, 0.02, 1);
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    this.mesh = new THREE.InstancedMesh(g, m, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    for (let i = 0; i < count; i++) this.data.push(this.spawn(-Math.random() * 30));
  }
  private spawn(z: number) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.2 + Math.random() * 3;
    return { x: Math.cos(a) * r * 1.6, y: Math.sin(a) * r, z, len: 1.5 + Math.random() * 3 };
  }
  update(dt: number, intensity: number) {
    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = intensity * 0.45;
    this.mesh.visible = intensity > 0.02;
    if (!this.mesh.visible) return;
    const sp = 60 + intensity * 80;
    this.data.forEach((d, i) => {
      d.z += sp * dt;
      if (d.z > 2) Object.assign(d, this.spawn(-28 - Math.random() * 6));
      this.dummy.position.set(d.x, d.y, d.z);
      this.dummy.scale.set(1, 1, d.len * (0.5 + intensity));
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** 摄像机系统：第三人称追尾 / 近距离 / 远距离 + 动态镜头 */
export class CameraController {
  camera: THREE.PerspectiveCamera;
  mode: CameraMode = 'chase';
  private pos = new THREE.Vector3();
  private look = new THREE.Vector3();
  private yaw = 0;
  private shake = 0;
  private fovBoost = 0;
  private sideOffset = 0;
  private pitchOffset = 0;
  private distMul = 1;
  speedLines: SpeedLines;
  private orbitT = 0;
  private initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(66, aspect, 0.3, 2400);
    this.speedLines = new SpeedLines();
    this.camera.add(this.speedLines.mesh);
  }

  setMode(m: CameraMode) {
    this.mode = m;
  }
  cycleMode() {
    const order: CameraMode[] = ['chase', 'near', 'far'];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    return this.mode;
  }

  addShake(a: number) {
    this.shake = Math.min(1.2, this.shake + a);
  }

  snapTo(r: Racer) {
    this.initialized = false;
    this.follow(r, 1 / 60, 1);
  }

  /** 竖屏/窄屏时自动拉远，保证可视范围 */
  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    this.distMul = aspect < 1.2 ? 1.35 : aspect > 2 ? 0.95 : 1;
    this.camera.updateProjectionMatrix();
  }

  follow(r: Racer, dt: number, alpha: number) {
    const m = MODES[this.mode];
    const g = r.group;
    const target = g.position;
    const speedK = clamp(Math.abs(r.speed) / 45, 0, 1.4);
    const boosting = r.nitroActive || r.boostTimer > 0 || r.superDash > 0;
    // 加速时略微拉远并增大 FOV
    this.fovBoost = damp(this.fovBoost, (boosting ? 12 : 0) + speedK * 6, 4, dt);
    // 漂移时摄像机轻微偏移
    this.sideOffset = damp(this.sideOffset, r.drifting ? -r.driftDir * 1.3 : 0, 3, dt);
    // 跳跃时自动调整俯仰
    this.pitchOffset = damp(this.pitchOffset, !r.grounded ? clamp(-r.vy * 0.06, -0.8, 1.2) : 0, 3, dt);

    // 摔车时镜头跟随角色但限制过度旋转
    const crashed = r.state === 'crashed';
    const heading = crashed ? this.yaw : r.yaw;
    this.yaw = dampAngle(this.yaw, heading, crashed ? 0.8 : 5, dt);
    if (!this.initialized) this.yaw = r.yaw;

    const dist = m.dist * this.distMul * (1 + (boosting ? 0.12 : 0) + speedK * 0.08) * (crashed ? 1.3 : 1);
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    const rx = -Math.cos(this.yaw);
    const rz = Math.sin(this.yaw);
    const desired = new THREE.Vector3(
      target.x - fx * dist + rx * this.sideOffset,
      target.y + m.height * this.distMul + this.pitchOffset * 1.5,
      target.z - fz * dist + rz * this.sideOffset,
    );
    if (!this.initialized) {
      this.pos.copy(desired);
      this.look.set(target.x, target.y + m.look, target.z);
      this.initialized = true;
    }
    const k = 1 - Math.exp(-(crashed ? 3 : 9) * dt);
    this.pos.lerp(desired, k);
    // 防止镜头钻到地下
    this.pos.y = Math.max(this.pos.y, target.y + 0.9);
    const lookT = new THREE.Vector3(target.x + fx * 4, target.y + m.look - this.pitchOffset * 0.8, target.z + fz * 4);
    this.look.lerp(lookT, 1 - Math.exp(-12 * dt));

    // 镜头震动
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * this.shake * 0.6;
    this.camera.position.set(this.pos.x + (Math.random() - 0.5) * s, this.pos.y + (Math.random() - 0.5) * s, this.pos.z + (Math.random() - 0.5) * s);
    this.camera.lookAt(this.look);
    this.camera.fov = m.fov + this.fovBoost;
    this.camera.updateProjectionMatrix();
    this.speedLines.update(dt, clamp((Math.abs(r.speed) - 30) / 18, 0, 1) + (boosting ? 0.35 : 0));
    void alpha;
  }

  /** 环绕展示（主菜单、完赛庆祝） */
  orbit(center: THREE.Vector3, dt: number, radius = 6, height = 2.4, speed = 0.35) {
    this.orbitT += dt * speed;
    const x = center.x + Math.cos(this.orbitT) * radius;
    const z = center.z + Math.sin(this.orbitT) * radius;
    this.camera.position.set(x, center.y + height, z);
    this.camera.lookAt(center.x, center.y + 1, center.z);
    this.camera.fov = lerp(this.camera.fov, 55, 0.1);
    this.camera.updateProjectionMatrix();
    this.speedLines.update(dt, 0);
    this.initialized = false;
  }
}
