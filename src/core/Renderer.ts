import * as THREE from 'three';
import { matchMobileDevice } from '../utils/device';

export type QualityLevel = 'low' | 'medium' | 'high';

/** 渲染器：画质分级、动态分辨率、阴影光源跟随 */
export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  quality: QualityLevel = 'high';
  private auto = true;
  pixelRatio = 1;
  private minPR = 0.6;
  private maxPR = 2;
  private frameTimes: number[] = [];
  private adjustTimer = 0;
  fps = 60;
  private lastW = 0;
  private lastH = 0;

  constructor(public canvas: HTMLCanvasElement) {
    const mobile = matchMobileDevice();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888866, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    const sc = this.sun.shadow.camera;
    sc.left = -45;
    sc.right = 45;
    sc.top = 45;
    sc.bottom = -45;
    sc.near = 1;
    sc.far = 260;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.resize();
  }

  /** 根据设置/设备选择画质 */
  setQuality(setting: 'auto' | QualityLevel) {
    const mobile = matchMobileDevice();
    this.auto = setting === 'auto';
    const q: QualityLevel = setting === 'auto' ? (mobile ? 'low' : 'high') : setting;
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    if (q === 'low') {
      this.maxPR = Math.min(dpr, mobile ? 1.25 : 1);
      this.minPR = 0.55;
      this.renderer.shadowMap.enabled = false;
    } else if (q === 'medium') {
      this.maxPR = Math.min(dpr, 1.5);
      this.minPR = 0.65;
      this.renderer.shadowMap.enabled = true;
      this.sun.shadow.mapSize.set(1024, 1024);
    } else {
      this.maxPR = Math.min(dpr, 2);
      this.minPR = 0.75;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.sun.shadow.mapSize.set(2048, 2048);
    }
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    if (this.sun.shadow.map) {
      this.sun.shadow.map.dispose();
      (this.sun.shadow as unknown as { map: null }).map = null;
    }
    this.pixelRatio = this.maxPR;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.resize(true);
  }

  get shadowsEnabled() {
    return this.renderer.shadowMap.enabled;
  }

  setLighting(sky: number, ground: number, ambient: number, sun: number, sunIntensity: number) {
    this.hemi.color.setHex(sky);
    this.hemi.groundColor.setHex(ground);
    this.hemi.intensity = ambient * 1.6;
    this.sun.color.setHex(sun);
    this.sun.intensity = sunIntensity;
  }

  /** 阴影相机跟随焦点 */
  followShadow(target: THREE.Vector3) {
    this.sun.position.set(target.x + 60, target.y + 110, target.z + 40);
    this.sun.target.position.copy(target);
  }

  resize(force = false) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (!force && w === this.lastW && h === this.lastH) return;
    this.lastW = w;
    this.lastH = h;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  get aspect() {
    return Math.max(0.3, window.innerWidth / Math.max(1, window.innerHeight));
  }

  /** 根据帧率动态调整渲染比例 */
  trackFrame(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    this.adjustTimer += dt;
    if (this.adjustTimer < 1) return;
    this.adjustTimer = 0;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = Math.round(1 / Math.max(1e-3, avg));
    const target = matchMobileDevice() ? 30 : 55;
    let pr = this.pixelRatio;
    if (this.fps < target - 3) pr = Math.max(this.minPR, pr - 0.1);
    else if (this.fps > target + 8 && this.fps > 50) pr = Math.min(this.maxPR, pr + 0.05);
    if (Math.abs(pr - this.pixelRatio) > 0.01) {
      this.pixelRatio = pr;
      this.renderer.setPixelRatio(pr);
      this.resize(true);
    }
    // 自动画质下持续低帧：关闭阴影
    if (this.auto && this.fps < target - 10 && this.pixelRatio <= this.minPR + 0.01 && this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      this.sun.castShadow = false;
    }
  }

  render(camera: THREE.Camera) {
    this.renderer.render(this.scene, camera);
  }
}
