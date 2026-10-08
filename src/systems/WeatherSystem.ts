import * as THREE from 'three';
import { glow } from '../utils/materials';

/** 环境天气：沙尘、雨雪、落叶、余烬、云雾、海鸥群等（围绕相机循环的粒子） */
export class WeatherSystem {
  group = new THREE.Group();
  private layers: { points: THREE.Points; vel: THREE.Vector3; box: THREE.Vector3; sway: number }[] = [];
  private birds: { g: THREE.Group; wings: THREE.Mesh[]; r: number; h: number; sp: number; ph: number }[] = [];
  private sandstorm = false;
  private baseFog: { near: number; far: number } | null = null;
  private t = 0;
  visionStorm = 0;

  constructor(private weather: string[], quality: 'low' | 'medium' | 'high', private scene: THREE.Scene) {
    const mul = quality === 'low' ? 0.35 : quality === 'medium' ? 0.65 : 1;
    const add = (count: number, color: number, size: number, vel: [number, number, number], box: [number, number, number], sway = 0, opacity = 0.9) => {
      const n = Math.round(count * mul);
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * box[0];
        pos[i * 3 + 1] = Math.random() * box[1];
        pos[i * 3 + 2] = (Math.random() - 0.5) * box[2];
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      this.group.add(p);
      this.layers.push({ points: p, vel: new THREE.Vector3(...vel), box: new THREE.Vector3(...box), sway });
    };
    for (const w of weather) {
      switch (w) {
        case 'rain':
          add(1400, 0x9fb8ff, 0.12, [0, -38, 0], [70, 40, 70], 0, 0.6);
          break;
        case 'snow':
          add(1200, 0xffffff, 0.35, [0, -4, 0], [80, 40, 80], 1.5);
          break;
        case 'dust':
          add(500, 0xe8cf9a, 0.25, [3, -0.3, 1], [80, 20, 80], 0.8, 0.6);
          break;
        case 'sandstorm':
          this.sandstorm = true;
          add(900, 0xe2b77a, 0.4, [14, -0.5, 4], [90, 25, 90], 1, 0.7);
          break;
        case 'leaves':
          add(400, 0x6fbf4a, 0.45, [1, -2, 0.5], [80, 30, 80], 2);
          add(150, 0xe0a030, 0.4, [1, -2, 0.5], [80, 30, 80], 2);
          break;
        case 'mist':
          add(200, 0xe0fff0, 2.4, [0.3, 0, 0], [100, 10, 100], 0.3, 0.18);
          break;
        case 'embers':
          add(700, 0xff7a1a, 0.3, [0, 3, 0], [80, 30, 80], 1.2);
          break;
        case 'ash':
          add(500, 0x555555, 0.3, [0.5, -1.5, 0], [80, 30, 80], 1);
          break;
        case 'sparkles':
          add(500, 0xffe6ff, 0.3, [0, 0.5, 0], [90, 30, 90], 1.5);
          break;
        case 'clouds':
          add(160, 0xffffff, 6, [0, 0, 0], [200, 20, 200], 0.2, 0.25);
          break;
        case 'pollen':
          add(300, 0xfff2a0, 0.2, [0.5, 0.3, 0.2], [80, 20, 80], 1.5, 0.7);
          break;
        case 'space':
          add(300, 0xbfe8ff, 0.12, [0, 0, 0], [120, 40, 120], 0.2, 0.5);
          break;
        case 'seagulls':
        case 'overcast':
          break;
      }
    }
    if (weather.includes('seagulls')) {
      for (let i = 0; i < Math.round(10 * mul + 2); i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.1, 4).rotateX(Math.PI / 2), glow(0xffffff));
        g.add(body);
        const wings: THREE.Mesh[] = [];
        for (const sx of [-1, 1]) {
          const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.4), glow(0xeeeeee));
          w.geometry.translate(sx * 0.7, 0, 0);
          g.add(w);
          wings.push(w);
        }
        this.group.add(g);
        this.birds.push({ g, wings, r: 20 + Math.random() * 30, h: 18 + Math.random() * 12, sp: 0.2 + Math.random() * 0.2, ph: Math.random() * 10 });
      }
    }
    scene.add(this.group);
    if (scene.fog instanceof THREE.Fog) this.baseFog = { near: scene.fog.near, far: scene.fog.far };
  }

  update(dt: number, cam: THREE.Vector3) {
    this.t += dt;
    for (const l of this.layers) {
      const pos = l.points.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const bx = l.box.x / 2;
      const bz = l.box.z / 2;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] += (l.vel.x + Math.sin(this.t * 1.3 + i) * l.sway) * dt;
        arr[i + 1] += l.vel.y * dt;
        arr[i + 2] += (l.vel.z + Math.cos(this.t * 1.1 + i) * l.sway) * dt;
        // 相对相机包裹
        let rx = arr[i] - cam.x;
        let rz = arr[i + 2] - cam.z;
        if (rx > bx) rx -= l.box.x;
        if (rx < -bx) rx += l.box.x;
        if (rz > bz) rz -= l.box.z;
        if (rz < -bz) rz += l.box.z;
        arr[i] = cam.x + rx;
        arr[i + 2] = cam.z + rz;
        let ry = arr[i + 1] - (cam.y - 8);
        if (ry < 0) ry += l.box.y;
        if (ry > l.box.y) ry -= l.box.y;
        arr[i + 1] = cam.y - 8 + ry;
      }
      pos.needsUpdate = true;
    }
    for (const b of this.birds) {
      const a = this.t * b.sp + b.ph;
      b.g.position.set(cam.x + Math.cos(a) * b.r, cam.y + b.h, cam.z + Math.sin(a) * b.r);
      b.g.rotation.y = -a;
      const flap = Math.sin(this.t * 8 + b.ph) * 0.6;
      b.wings[0].rotation.z = -flap;
      b.wings[1].rotation.z = flap;
    }
    // 沙尘暴：周期性降低能见度
    if (this.sandstorm && this.baseFog && this.scene.fog instanceof THREE.Fog) {
      const storm = Math.max(0, Math.sin(this.t * 0.12)) ** 2;
      this.visionStorm = storm;
      this.scene.fog.near = this.baseFog.near * (1 - storm * 0.85);
      this.scene.fog.far = this.baseFog.far * (1 - storm * 0.7);
    }
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
  }
}
