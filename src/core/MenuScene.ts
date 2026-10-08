import * as THREE from 'three';
import { buildSky } from '../tracks/TrackLoader';
import { PROP_BUILDERS, bakeGroup } from '../tracks/Props';
import { roadTexture, lambert } from '../utils/materials';
import { Pelican } from '../entities/Pelican';
import { MotorcycleModel } from '../entities/Motorcycle';
import { getPelican } from '../data/pelicans';
import { getMotorcycle } from '../data/motorcycles';
import type { Appearance } from '../data/cosmetics';
import { getTrack } from '../tracks/TrackConfig';
import { WeatherSystem } from '../systems/WeatherSystem';
import type { Renderer } from './Renderer';

/** 主菜单背景：动态 3D 海岸公路 + 骑摩托的鹈鹕；也用于角色/车库预览 */
export class MenuScene {
  root = new THREE.Group();
  private roadTex: THREE.Texture;
  private palms: THREE.InstancedMesh;
  private palmZ: number[] = [];
  private palmX: number[] = [];
  private dummy = new THREE.Object3D();
  private rider = new THREE.Group();
  private pelican: Pelican | null = null;
  private bike: MotorcycleModel | null = null;
  private t = 0;
  private weather: WeatherSystem;
  view: 'ride' | 'turntable' = 'ride';
  private key = '';
  private yaw = 0;
  dragYaw = 0;

  constructor(private renderer: Renderer) {
    const pal = getTrack('coast').palette;
    this.root.add(buildSky(pal.skyTop, pal.skyBottom, false));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000).rotateX(-Math.PI / 2), new THREE.MeshPhongMaterial({ color: pal.water, shininess: 80 }));
    sea.position.set(-1000 + 30, -1.2, 0);
    this.root.add(sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(200, 2000).rotateX(-Math.PI / 2), lambert(pal.ground));
    sand.position.set(40, -0.05, 0);
    sand.receiveShadow = true;
    this.root.add(sand);
    this.roadTex = roadTexture('asphalt', pal.road, pal.roadLine);
    this.roadTex.repeat.set(1, 40);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 600).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: this.roadTex }));
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.root.add(road);
    const palm = bakeGroup(PROP_BUILDERS.palm());
    this.palms = new THREE.InstancedMesh(palm.lit!, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 40);
    this.palms.castShadow = true;
    for (let i = 0; i < 40; i++) {
      this.palmZ.push(-200 + i * 10 + Math.random() * 5);
      this.palmX.push((i % 2 ? 1 : -1) * (11 + Math.random() * 14));
    }
    this.root.add(this.palms);
    this.root.add(this.rider);
    this.weather = new WeatherSystem(['seagulls'], 'medium', renderer.scene);
    this.weather.group.removeFromParent();
    this.root.add(this.weather.group);
  }

  activate() {
    const s = this.renderer.scene;
    const pal = getTrack('coast').palette;
    s.add(this.root);
    s.fog = new THREE.Fog(pal.fog, 60, 420);
    s.background = new THREE.Color(pal.skyBottom);
    this.renderer.setLighting(pal.skyTop, pal.hemiGround, pal.ambient, pal.sun, pal.sunIntensity);
  }

  deactivate() {
    this.root.removeFromParent();
  }

  setPreview(pelicanId: string, bikeId: string, app: Appearance) {
    const key = pelicanId + bikeId + JSON.stringify(app);
    if (key === this.key) return;
    this.key = key;
    this.rider.clear();
    this.bike = new MotorcycleModel(getMotorcycle(bikeId), app);
    this.pelican = new Pelican(getPelican(pelicanId), app);
    const seat = new THREE.Group();
    seat.position.copy(this.bike.seat);
    seat.add(this.pelican.root);
    this.pelican.root.scale.setScalar(0.95);
    this.rider.add(this.bike.root, seat);
    this.pelican.trigger('shout');
  }

  shout() {
    this.pelican?.trigger(Math.random() < 0.5 ? 'shout' : Math.random() < 0.5 ? 'wingL' : 'peck');
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    this.t += dt;
    const ride = this.view === 'ride';
    const speed = ride ? 26 : 0;
    this.roadTex.offset.y += (speed * dt) / 15;
    for (let i = 0; i < this.palmZ.length; i++) {
      this.palmZ[i] -= speed * dt;
      if (this.palmZ[i] < -200) this.palmZ[i] += 400;
      this.dummy.position.set(this.palmX[i], 0, this.palmZ[i]);
      this.dummy.rotation.y = i;
      this.dummy.scale.setScalar(1 + (i % 3) * 0.15);
      this.dummy.updateMatrix();
      this.palms.setMatrixAt(i, this.dummy.matrix);
    }
    this.palms.instanceMatrix.needsUpdate = true;
    if (this.pelican && this.bike) {
      const steer = ride ? Math.sin(this.t * 0.7) * 0.5 : 0;
      this.pelican.mood = ride ? 'ride' : 'idle';
      this.pelican.update({ speed, steer, boost: ride && Math.sin(this.t * 0.3) > 0.7, airborne: false, dt });
      this.bike.update(dt, speed, steer, this.t);
      this.rider.rotation.z = ride ? steer * 0.25 : 0;
      this.rider.position.x = ride ? Math.sin(this.t * 0.5) * 1.5 : 0;
      if (!ride) {
        this.yaw += dt * 0.5;
        this.rider.rotation.y = this.yaw + this.dragYaw;
      } else this.rider.rotation.y = steer * -0.15;
    }
    if (Math.random() < dt * 0.25) this.shout();
    // 镜头
    const tgt = this.rider.position;
    if (ride) {
      const a = this.t * 0.15;
      camera.position.set(tgt.x + Math.sin(a) * 4.5 + 3, 2.2 + Math.sin(this.t * 0.4) * 0.3, tgt.z + Math.cos(a) * 3 + 5.5);
    } else {
      camera.position.set(tgt.x + 2.2, 1.9, tgt.z + 4.4);
    }
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camera.lookAt(tgt.x + (ride ? 0 : 0.6), 1.1, tgt.z);
    this.weather.update(dt, camera.position);
    this.renderer.followShadow(tgt);
  }
}
