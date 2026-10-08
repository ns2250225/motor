import * as THREE from 'three';
import type { ItemId } from '../data/items';
import type { Racer } from './Racer';
import { toon, glow } from '../utils/materials';

const G = {
  body: new THREE.IcosahedronGeometry(1, 0),
  tail: new THREE.ConeGeometry(1, 1, 4),
  spike: new THREE.ConeGeometry(0.15, 0.4, 4),
};

/** 鱼形投射物模型 */
export function buildFishMesh(color: number, scale = 1, kind: ItemId = 'frozenFish') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(G.body, toon(color));
  body.scale.set(0.28, 0.32, 0.6);
  g.add(body);
  const tail = new THREE.Mesh(G.tail, toon(color));
  tail.scale.set(0.3, 0.35, 0.1);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -0.65;
  g.add(tail);
  const eye = new THREE.Mesh(G.body, toon(0x111111));
  eye.scale.setScalar(0.06);
  eye.position.set(0.2, 0.1, 0.35);
  g.add(eye, eye.clone().translateX(-0.4));
  if (kind === 'puffer') {
    body.scale.set(0.6, 0.6, 0.6);
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Mesh(G.spike, toon(0xd9a400));
      const v = new THREE.Vector3().randomDirection();
      s.position.copy(v.clone().multiplyScalar(0.6));
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
      g.add(s);
    }
  }
  if (kind === 'rocketFish') {
    const flame = new THREE.Mesh(G.tail, glow(0xffa31a));
    flame.scale.set(0.2, 0.7, 0.2);
    flame.rotation.x = -Math.PI / 2;
    flame.position.z = -1.1;
    g.add(flame);
  }
  if (kind === 'stinkBomb') {
    body.scale.set(0.35, 0.35, 0.5);
    const fuse = new THREE.Mesh(G.spike, glow(0xff5a1f));
    fuse.position.y = 0.4;
    g.add(fuse);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

export type ProjectileKind = 'stinkBomb' | 'frozenFish' | 'puffer' | 'rocketFish';

/** 投射物：从鹈鹕大嘴喷射 */
export class Projectile {
  mesh: THREE.Group;
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  life: number;
  alive = true;
  target: Racer | null = null;
  hint = -1;
  bounces = 0;

  constructor(public kind: ProjectileKind, public owner: Racer, color: number) {
    this.mesh = buildFishMesh(color, kind === 'puffer' ? 1.1 : 1, kind);
    this.life = kind === 'rocketFish' ? 7 : kind === 'stinkBomb' ? 1.6 : 4;
  }
}
