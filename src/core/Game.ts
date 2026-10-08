import { Renderer } from './Renderer';
import { CameraController } from './Camera';
import { InputManager } from './InputManager';
import { Physics } from './Physics';
import { MenuScene } from './MenuScene';
import { RaceSession } from './RaceSession';
import { AudioSystem } from '../systems/AudioSystem';
import { MusicSystem } from '../systems/MusicSystem';
import { OrientationManager } from '../controls/OrientationManager';
import { touchControls } from '../controls/TouchControls';
import { resolveAppearance } from '../data/cosmetics';
import type { useGameStore, RaceSetup } from '../stores/game';
import type { Settings } from '../systems/SaveSystem';

type Store = ReturnType<typeof useGameStore>;

/** 游戏主循环与全局子系统；Vue 负责界面，这里负责 3D、物理、AI 与战斗 */
export class Game {
  renderer: Renderer;
  camera: CameraController;
  input = new InputManager();
  audio = new AudioSystem();
  music: MusicSystem;
  orientation = new OrientationManager();
  menu: MenuScene;
  session: RaceSession | null = null;
  private last = performance.now();
  private running = false;
  private raf = 0;
  private previewPelican: string | null = null;
  private previewBike: string | null = null;

  static async create(canvas: HTMLCanvasElement, store: Store) {
    await Physics.init();
    return new Game(canvas, store);
  }

  private constructor(canvas: HTMLCanvasElement, public store: Store) {
    this.renderer = new Renderer(canvas);
    this.renderer.setQuality(store.save.settings.graphicsQuality);
    this.camera = new CameraController(this.renderer.aspect);
    this.renderer.scene.add(this.camera.camera);
    this.music = new MusicSystem(this.audio);
    this.menu = new MenuScene(this.renderer);
    this.menu.activate();
    this.refreshPreview();
    this.applySettings(store.save.settings);
    this.input.attach();
    this.input.onAction = (a) => {
      if (a === 'pause') this.togglePause();
      if (a === 'camera' && this.session) {
        const m = this.camera.cycleMode();
        store.save.settings.cameraMode = m;
        store.persist();
        store.notify(`镜头：${m === 'chase' ? '第三人称追尾' : m === 'near' ? '近距离追尾' : '远距离追尾'}`);
      }
    };
    store.isMobile = this.orientation.isMobile;
    touchControls.enabled = this.orientation.isMobile || matchMedia('(pointer: coarse)').matches;
    this.orientation.onResize = () => this.resize();
    this.orientation.onChange = ({ showOverlay }) => {
      store.rotateOverlay = showOverlay;
      // 游戏中转为竖屏：自动暂停
      if (showOverlay && this.session && !store.paused) this.pause();
      this.resize();
    };
    this.orientation.updateOrientationUI();
    window.addEventListener('resize', () => this.resize());
    // 浏览器失去焦点：自动暂停
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.autoPause();
        this.audio.suspend();
      } else this.audio.resume();
    });
    this.start();
  }

  private autoPause() {
    if (this.session && !this.store.paused && this.store.screen === 'race') this.pause();
  }

  resize() {
    this.renderer.resize();
    this.camera.setAspect(this.renderer.aspect);
  }

  applySettings(s: Settings) {
    this.audio.setVolumes(s.musicVolume, s.soundVolume);
    this.camera.setMode(s.cameraMode);
    this.input.autoAccelerate = s.autoAccelerate;
  }

  setQuality(q: Settings['graphicsQuality']) {
    this.renderer.setQuality(q);
  }

  /** 首次用户手势：解锁音频 */
  unlockAudio() {
    this.audio.unlock();
    this.music.resumeTheme();
  }

  refreshPreview(pelicanId?: string, bikeId?: string) {
    const s = this.store.save;
    this.previewPelican = pelicanId ?? this.previewPelican;
    this.previewBike = bikeId ?? this.previewBike;
    this.menu.setPreview(this.previewPelican ?? s.equippedPelican, this.previewBike ?? s.equippedMotorcycle, resolveAppearance(s.equippedCosmetics));
  }

  clearPreview() {
    this.previewPelican = null;
    this.previewBike = null;
    this.refreshPreview();
  }

  setMenuView(v: 'ride' | 'turntable') {
    this.menu.view = v;
  }

  /** 开始比赛（必须由用户点击触发，以便请求全屏与横屏锁定） */
  async startRace(setup: RaceSetup) {
    const store = this.store;
    this.unlockAudio();
    await this.orientation.enterLandscapeGame();
    store.loadingText = '正在加载 3D 赛道…';
    store.go('loading');
    await new Promise((r) => setTimeout(r, 60));
    this.endSession();
    this.menu.deactivate();
    store.resetHud();
    store.paused = false;
    try {
      this.session = new RaceSession(this, { mode: setup.mode, trackId: setup.trackId });
    } catch (e) {
      console.error(e);
      store.showToast('赛道加载失败：' + (e as Error).message);
      this.toMenu();
      return;
    }
    this.resize();
    this.last = performance.now();
    store.go('race');
  }

  restart() {
    const s = { ...this.store.setup };
    this.startRace(s);
  }

  endSession() {
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
    touchControls.reset();
  }

  toMenu() {
    this.endSession();
    this.store.paused = false;
    this.menu.activate();
    this.clearPreview();
    this.music.play('menu');
    this.store.go('menu');
  }

  pause() {
    if (!this.session) return;
    this.store.paused = true;
    this.session.setPaused(true);
    this.music.setIntensity(0.4);
  }

  resume() {
    if (!this.session || this.store.rotateOverlay) return;
    this.store.paused = false;
    this.session.setPaused(false);
    this.last = performance.now();
    this.music.setIntensity(1);
  }

  togglePause() {
    if (!this.session || this.store.screen !== 'race') return;
    if (this.store.paused) this.resume();
    else this.pause();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.25) dt = 0.25;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private frame(dt: number) {
    this.renderer.trackFrame(dt);
    const intent = this.input.sample();
    if (this.session) {
      this.session.update(dt, intent);
    } else {
      this.menu.update(dt, this.camera.camera);
    }
    this.renderer.render(this.camera.camera);
    this.input.endFrame();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.endSession();
  }
}
