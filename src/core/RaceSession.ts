import * as THREE from 'three';
import type { Game } from './Game';
import type { GameMode, RaceWorld, RaceEvents } from './types';
import { Emitter } from '../utils/events';
import { Physics } from './Physics';
import { loadTrack, BuiltTrack, Quality } from '../tracks/TrackLoader';
import { TrackGeometry } from '../tracks/TrackGeometry';
import { getTrack, TrackConfig } from '../tracks/TrackConfig';
import { Racer, emptyInput, RacerInput } from '../entities/Racer';
import { AIController } from '../entities/AIController';
import { EffectsSystem } from '../systems/EffectsSystem';
import { CombatSystem, inAttackRange, relative } from '../systems/CombatSystem';
import { ItemSystem } from '../systems/ItemSystem';
import { HazardSystem } from '../systems/HazardSystem';
import { RacingSystem } from '../systems/RacingSystem';
import { RespawnSystem } from '../systems/RespawnSystem';
import { WeatherSystem } from '../systems/WeatherSystem';
import { EndlessManager } from '../systems/EndlessManager';
import { applyRewards } from '../systems/RewardSystem';
import { PELICANS, getPelican } from '../data/pelicans';
import { MOTORCYCLES, getMotorcycle, applyUpgrades } from '../data/motorcycles';
import { resolveAppearance, randomAppearance } from '../data/cosmetics';
import { PERSONALITY_ORDER, Difficulty } from '../ai/AIBehavior';
import { shuffle, pick, clamp, rand } from '../utils/math';
import type { PlayerIntent } from './InputManager';
import { SURFACES } from '../tracks/surfaces';
import { vibrate } from '../utils/device';

export interface SessionOptions {
  mode: GameMode;
  trackId: string;
}

const FIXED_DT = 1 / 60;

/** AI 避障使用的障碍横向半径 */
const OBSTACLE_RADIUS: Record<string, number> = {
  log: 2.6, car: 1.3, container: 1.4, rock: 1.1, boulder: 1.5, lavaRock: 1.2, beachChair: 0.6, cactus: 0.6,
  snowman: 0.9, tire: 0.8, hay: 1, cone: 0.5, barrel: 0.6, crate: 0.7,
};
const BREAKABLE = new Set(['cone', 'barrel', 'crate', 'tire', 'hay', 'beachChair', 'cactus', 'snowman']);

/** 一场比赛的完整运行时 */
export class RaceSession {
  world: RaceWorld;
  built: BuiltTrack | null = null;
  endless: EndlessManager | null = null;
  racers: Racer[] = [];
  player!: Racer;
  ais = new Map<Racer, AIController>();
  combat: CombatSystem;
  items: ItemSystem;
  hazards: HazardSystem | null = null;
  racing: RacingSystem;
  respawn: RespawnSystem;
  fx: EffectsSystem;
  weather: WeatherSystem | null = null;
  root = new THREE.Group();
  cfg: TrackConfig;
  mode: GameMode;
  laps: number;
  private countdown = 4.2;
  private countdownShown = '';
  private hudTimer = 0;
  private finishCam = 0;
  private resultsShown = false;
  private accumulator = 0;
  private firstStep = true;
  paused = false;
  private disposers: (() => void)[] = [];
  private fireworkTimer = 0;
  private distanceStart = 0;
  private endlessSpawnTimer = 0;
  private quality: Quality;

  constructor(private game: Game, opts: SessionOptions) {
    const save = game.store.save;
    this.mode = opts.mode;
    const endless = opts.mode === 'endless';
    const base = getTrack(endless ? 'coast' : opts.trackId);
    this.cfg = endless ? { ...base, id: 'endless', name: '无尽公路', hazards: [], shortcuts: [], laps: 0, edge: 'offroad', gravity: 25 } : base;
    this.laps = opts.mode === 'elimination' ? 6 : this.cfg.laps;
    const r = game.renderer;
    const q = r.quality;
    this.quality = {
      level: q,
      propDensity: q === 'low' ? 0.45 : q === 'medium' ? 0.75 : 1,
      drawDistance: q === 'low' ? 380 : q === 'medium' ? 520 : 700,
      shadows: r.shadowsEnabled,
    };
    const physics = new Physics(this.cfg.gravity);
    this.fx = new EffectsSystem(q);
    const events = new Emitter<RaceEvents>();
    r.scene.add(this.root);
    this.root.add(this.fx.group);

    // 世界
    let geo: TrackGeometry;
    if (endless) {
      geo = new TrackGeometry(this.cfg, true);
    } else {
      this.built = loadTrack(this.cfg, r.scene, physics, this.quality);
      geo = this.built.geo;
    }
    this.world = {
      track: geo,
      physics,
      gravity: this.cfg.gravity,
      time: 0,
      fx: this.fx,
      events,
      racers: this.racers,
      mode: opts.mode,
      upgradesAllowed: opts.mode !== 'timetrial',
      chaos: opts.mode === 'chaos',
      lavaY: this.built?.lavaY ?? null,
      started: false,
    };
    this.items = new ItemSystem(this.world, this.root);
    if (endless) {
      this.endless = new EndlessManager(geo, r.scene, this.root, physics, this.items, r, this.quality.propDensity);
    } else {
      for (const b of geo.itemBoxes) {
        const p = geo.main.pointAt(b.s);
        this.items.addBox(p.x + p.rx * b.lateral, p.y, p.z + p.rz * b.lateral);
      }
      this.hazards = new HazardSystem(this.world, this.built!);
    }
    const pal = this.cfg.palette;
    r.setLighting(pal.skyTop, pal.hemiGround, pal.ambient, pal.sun, pal.sunIntensity);
    this.weather = new WeatherSystem(endless ? ['seagulls'] : this.cfg.weather, q, r.scene);

    // 骑手
    this.createRacers(save.equippedPelican, save.equippedMotorcycle);
    this.combat = new CombatSystem(this.world);
    this.racing = new RacingSystem(this.world, this.laps, endless);
    this.respawn = new RespawnSystem(this.world, this.racing);
    this.racing.init();
    this.racing.onRaceOver = () => this.onRaceOver();
    this.bindEvents();
    this.distanceStart = this.player.ground.mainS;
    game.camera.snapTo(this.player);
    game.music.play(endless ? 'surf' : this.cfg.music);
    if (this.built) for (const l of this.built.startLights) (l.material as THREE.MeshBasicMaterial).color.setHex(0x331111);
  }

  private createRacers(pelId: string, bikeId: string) {
    const save = this.game.store.save;
    const w = this.world;
    const geo = w.track;
    const pel = getPelican(pelId);
    const bike = getMotorcycle(bikeId);
    const up = w.upgradesAllowed ? save.upgrades[bike.id] : undefined;
    const playerSetup = {
      index: 0,
      name: '你',
      isPlayer: true,
      pelican: pel,
      bike,
      stats: applyUpgrades(bike.stats, up),
      appearance: resolveAppearance(save.equippedCosmetics),
    };
    const total = this.mode === 'timetrial' ? 1 : this.mode === 'endless' ? 5 : 8;
    const others = shuffle(PELICANS.filter((p) => p.id !== pel.id));
    const diff = save.settings.difficulty as Difficulty;
    const trackDiff = this.cfg.difficulty;
    const playerGrid = this.mode === 'timetrial' ? 0 : this.mode === 'endless' ? 0 : 5;
    let aiIdx = 0;
    for (let i = 0; i < total; i++) {
      let r: Racer;
      if (i === playerGrid) {
        r = new Racer(playerSetup);
        this.player = r;
      } else {
        const pd = others[aiIdx % others.length];
        // AI 摩托：根据赛道难度略有强化
        const bd = pick(MOTORCYCLES);
        const lvl = Math.min(3, Math.max(0, trackDiff - 2 + (diff === 'hard' ? 1 : diff === 'easy' ? -1 : 0)));
        const stats = applyUpgrades(bd.stats, { engine: lvl, handling: lvl, armor: lvl, nitro: lvl });
        r = new Racer({ index: i, name: pd.title, isPlayer: false, pelican: pd, bike: bd, stats, appearance: randomAppearance() });
        aiIdx++;
      }
      r.index = i;
      r.attach(w);
      this.racers.push(r);
      this.root.add(r.group);
      // 起跑位置
      const sp = this.cfg.spawnPoints[i] ?? { x: 0, z: 8 + i * 7, y: 0 };
      if (this.mode === 'endless') r.placeAt(60 + (i === 0 ? 0 : 25 + i * 18), i === 0 ? 0 : (i % 2 ? -3 : 3));
      else r.placeAt(geo.length - sp.z, sp.x);
      r.setShadowBlob(!this.game.renderer.shadowsEnabled || !r.isPlayer);
      if (!r.isPlayer) {
        const pers = PERSONALITY_ORDER[(i - (i > playerGrid ? 1 : 0)) % PERSONALITY_ORDER.length];
        this.ais.set(r, new AIController(r, w, pers, diff, () => this.avoidPoints()));
      }
    }
    // 玩家完赛后的自动驾驶
    this.ais.set(this.player, new AIController(this.player, w, 'steady', 'normal', () => this.avoidPoints()));
  }

  private avoidPoints() {
    const pts = this.hazards?.avoidPoints() ?? [];
    const geo = this.world.track;
    for (const o of geo.obstacles) {
      const r = OBSTACLE_RADIUS[o.type] ?? 1;
      pts.push({ s: o.s, lat: o.lateral, r, weight: BREAKABLE.has(o.type) ? 2.5 : 8 });
    }
    for (const t of this.items.traps) {
      const q = geo.main.nearest(t.x, t.z);
      pts.push({ s: q.s, lat: q.lateral, r: 1, weight: 5 });
    }
    return pts;
  }

  private bindEvents() {
    const ev = this.world.events;
    const store = this.game.store;
    const audio = this.game.audio;
    const P = () => this.player;
    ev.on('sfx', (e) => {
      const r = e.racer;
      const pos = r ? r.pos : null;
      audio.play(e.name, {
        x: e.x ?? pos?.x,
        y: e.y ?? pos?.y,
        z: e.z ?? pos?.z,
        volume: (e.volume ?? 1) * (r && r.isPlayer ? 1 : 0.8),
        pitch: e.pitch ?? (e.name === 'squawk' && r ? r.pelicanDef.voicePitch : 1),
        horn: r?.app.horn,
      });
    });
    ev.on('shake', (e) => {
      if (e.racer.isPlayer) this.game.camera.addShake(e.amount);
    });
    ev.on('notify', (e) => {
      if (e.racer.isPlayer) store.notify(e.text, e.kind ?? 'info');
    });
    ev.on('hit', (e) => {
      if (e.attacker.isPlayer && (e.kind === 'peck' || e.kind === 'sweep' || e.kind === 'bone')) store.notify(e.kind === 'peck' ? '啄中！' : '横扫命中！', 'good');
      if (e.target.isPlayer && this.game.store.save.settings.vibration) vibrate(40);
    });
    ev.on('crash', (e) => {
      const by = e.by;
      if (by && by !== e.racer) {
        by.stat.kos++;
        ev.emit('ko', { attacker: by, target: e.racer });
        if (by.isPlayer) {
          store.notify(`击倒 ${e.racer.name}！`, 'big');
          audio.play('coin');
        }
      }
      if (e.racer.isPlayer) {
        const why: Record<string, string> = { fall: '掉下去了！', lava: '掉进岩浆了！', clamp: '被甩飞了！', obstacle: '撞车了！' };
        store.notify(why[e.reason] ?? '摔车了！', 'bad');
      }
    });
    ev.on('lap', (e) => {
      if (!e.racer.isPlayer) return;
      audio.play('lap');
      const left = this.laps - e.lap;
      if (left === 1) store.notify('最后一圈！', 'big');
      else if (left > 1) store.notify(`第 ${e.lap + 1} 圈`, 'info');
    });
    ev.on('finish', (e) => {
      if (e.racer.isPlayer) {
        audio.play(e.racer.place <= 3 ? 'win' : 'lose');
        store.notify(this.mode === 'timetrial' ? '计时完成！' : `完赛！第 ${e.racer.place} 名`, 'big');
        this.finishCam = 0.001;
      }
    });
    ev.on('shortcut', (e) => {
      if (e.racer.isPlayer) {
        const first = !store.save.discoveredShortcuts.includes(e.id);
        store.notify(first ? `发现隐藏捷径：${e.name}！` : `捷径：${e.name}`, 'good');
      }
    });
    ev.on('trick', (e) => {
      if (e.racer.isPlayer) store.notify(`${e.name}！氮气 +`, 'good');
    });
    ev.on('eliminated', (e) => {
      store.notify(e.racer.isPlayer ? '你被淘汰了！' : `${e.racer.name} 被淘汰！`, e.racer.isPlayer ? 'bad' : 'info');
    });
    ev.on('vision', (e) => {
      if (e.racer.isPlayer) store.vision[e.kind] = e.duration;
    });
    ev.on('item', (e) => {
      if (e.racer.isPlayer) audio.play('item');
    });
  }

  /** 触控“攻击/大嘴”智能选择 */
  private resolveSmart(intent: PlayerIntent, input: RacerInput) {
    const p = this.player;
    if (!intent.smartAttack && !intent.smartBeak) return;
    let nearest: Racer | null = null;
    let nd = Infinity;
    for (const o of this.racers) {
      if (o === p || o.state !== 'driving') continue;
      const d = relative(p, o).dist;
      if (d < nd) {
        nd = d;
        nearest = o;
      }
    }
    if (intent.smartAttack) {
      if (nearest && inAttackRange('wingL', p, nearest) && p.cd.wingL <= 0) input.attackL = true;
      else if (nearest && inAttackRange('wingR', p, nearest) && p.cd.wingR <= 0) input.attackR = true;
      else if (nearest && inAttackRange('peck', p, nearest) && p.cd.peck <= 0) input.peck = true;
      else if (nearest && relative(p, nearest).lat < 0 && p.cd.wingL <= 0) input.attackL = true;
      else if (p.cd.wingR <= 0) input.attackR = true;
      else if (p.cd.wingL <= 0) input.attackL = true;
      else input.peck = true;
    }
    if (intent.smartBeak) {
      if (nearest && p.cd.clamp <= 0 && inAttackRange('clamp', p, nearest)) input.clamp = true;
      else if (nearest && p.cd.sweep <= 0 && inAttackRange('sweep', p, nearest)) input.sweep = true;
      else if (p.cd.peck <= 0) input.peck = true;
      else if (p.cd.sweep <= 0) input.sweep = true;
      else input.clamp = true;
    }
  }

  /** 每帧调用：固定步长推进模拟 */
  update(frameDt: number, intent: PlayerIntent) {
    const dt = Math.min(frameDt, 0.1);
    if (!this.paused) {
      this.accumulator += dt;
      this.firstStep = true;
      let steps = 0;
      while (this.accumulator >= FIXED_DT && steps < 6) {
        this.step(FIXED_DT, intent);
        this.accumulator -= FIXED_DT;
        steps++;
        this.firstStep = false;
      }
      if (steps === 6) this.accumulator = 0;
    }
    this.render(dt);
  }

  private step(dt: number, intent: PlayerIntent) {
    const w = this.world;
    w.time += dt;
    // 倒计时
    if (!w.started) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 1);
      const label = this.countdown > 3.2 ? '' : n > 0 ? String(n) : 'GO!';
      if (label !== this.countdownShown) {
        this.countdownShown = label;
        this.game.store.hud.countdown = label || null;
        if (label && label !== 'GO!') this.game.audio.play('countdown');
        if (this.built && label) {
          const idx = 3 - n;
          this.built.startLights.forEach((l, i) => {
            (l.material as THREE.MeshBasicMaterial).color.setHex(label === 'GO!' ? 0x22ff55 : i < idx ? 0xff2222 : 0x331111);
          });
        }
      }
      if (this.countdown <= 1) {
        w.started = true;
        this.game.audio.play('go');
        for (const r of this.racers) r.pelican.trigger('shout');
        setTimeout(() => {
          if (this.game.store.hud.countdown === 'GO!') this.game.store.hud.countdown = null;
        }, 800);
      }
    }

    // 输入
    const p = this.player;
    const playerInput: RacerInput = { ...emptyInput() };
    const useAI = p.finished || this.racing.over;
    if (useAI) {
      Object.assign(playerInput, this.ais.get(p)!.update(dt, null));
      playerInput.attackL = playerInput.attackR = playerInput.peck = playerInput.sweep = playerInput.clamp = playerInput.useItem = false;
    } else {
      playerInput.throttle = intent.throttle;
      playerInput.brake = intent.brake;
      playerInput.steer = intent.steer;
      playerInput.drift = intent.drift;
      playerInput.nitro = intent.nitro;
      if (this.firstStep) {
        playerInput.attackL = intent.attackL;
        playerInput.attackR = intent.attackR;
        playerInput.peck = intent.peck;
        playerInput.sweep = intent.sweep;
        playerInput.clamp = intent.clamp;
        playerInput.superDash = intent.superDash;
        playerInput.useItem = intent.useItem;
        playerInput.horn = intent.horn;
        playerInput.reset = intent.reset;
        this.resolveSmart(intent, playerInput);
      }
    }
    for (const r of this.racers) {
      if (r === p) r.update(dt, playerInput);
      else r.update(dt, this.ais.get(r)!.update(dt, p));
    }
    for (const r of this.racers) {
      this.combat.handleInput(r);
      if (r.input.useItem && w.started && this.mode !== 'timetrial') this.items.use(r);
    }
    this.combat.update(dt);
    this.items.update(dt);
    this.hazards?.update(dt);
    w.physics.step(dt);
    this.racing.update(dt);
    this.respawn.update(dt);
    if (this.mode === 'endless') this.updateEndless(dt);
  }

  /** 无尽模式：AI 对手在玩家附近循环出现 */
  private updateEndless(dt: number) {
    const p = this.player;
    this.endlessSpawnTimer -= dt;
    for (const r of this.racers) {
      if (r === p) continue;
      const d = r.ground.mainS - p.ground.mainS;
      if ((d < -90 || d > 420) && r.state === 'driving' && this.endlessSpawnTimer <= 0) {
        r.placeAt(p.ground.mainS + rand(70, 160), rand(-4, 4));
        r.speed = p.speed * 0.8;
        r.invuln = 1;
        this.endlessSpawnTimer = 1.5;
      }
    }
  }

  private render(dt: number) {
    const g = this.game;
    const alpha = this.paused ? 1 : this.accumulator / FIXED_DT;
    const t = this.world.time;
    for (const r of this.racers) r.render(alpha, dt, t, g.camera.camera.position);
    if (!this.paused) this.fx.update(dt);
    const cam = g.camera;
    const p = this.player;

    // 镜头：完赛后环绕庆祝
    if (this.finishCam > 0 || this.racing.over) {
      this.finishCam += dt;
      if (this.finishCam < 1.2) cam.follow(p, dt, alpha);
      else cam.orbit(p.group.position, dt, 7, 2.8, 0.5);
      if (p.place <= 3 || this.mode === 'timetrial') {
        this.fireworkTimer -= dt;
        if (this.fireworkTimer <= 0 && this.finishCam > 0.5) {
          this.fireworkTimer = 0.4;
          const c = p.group.position;
          this.fx.firework(c.x + rand(-15, 15), c.y + rand(10, 20), c.z + rand(-15, 15));
          if (Math.random() < 0.5) this.fx.burst('confetti', c.x, c.y + 4, c.z, 20, 6);
        }
      }
      if (this.finishCam > 4 && !this.resultsShown) this.showResults();
    } else {
      cam.follow(p, dt, alpha);
    }
    g.renderer.followShadow(p.group.position);
    if (this.built) this.built.update(dt, cam.camera.position);
    if (this.endless) this.endless.update(dt, p.ground.mainS, cam.camera.position);
    this.weather?.update(dt, cam.camera.position);

    // 尾焰/烟雾/火花粒子
    if (!this.paused) this.emitRacerFx(dt);

    // 音频
    const fwd = new THREE.Vector3();
    cam.camera.getWorldDirection(fwd);
    g.audio.setListener(cam.camera.position.x, cam.camera.position.y, cam.camera.position.z, -fwd.z, fwd.x);
    let near: Racer | null = null;
    let nd = Infinity;
    for (const r of this.racers) {
      if (r === p || r.state === 'eliminated') continue;
      const d = r.pos.distanceTo(p.pos);
      if (d < nd) {
        nd = d;
        near = r;
      }
    }
    g.audio.updateEngine(p.speed, p.stats.maxSpeed, p.nitroActive || p.superDash > 0, p.drifting && p.grounded, !this.paused && p.state !== 'eliminated', near?.speed ?? 0, near ? clamp(1 - nd / 40, 0, 1) : 0);

    // HUD（节流）
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.updateHud();
    }
    const v = g.store.vision;
    if (v.feather > 0) v.feather = Math.max(0, v.feather - dt);
    if (v.ink > 0) v.ink = Math.max(0, v.ink - dt);
  }

  private emitRacerFx(dt: number) {
    const fx = this.fx;
    const camPos = this.game.camera.camera.position;
    for (const r of this.racers) {
      if (r.state === 'eliminated') continue;
      if (r.pos.distanceToSquared(camPos) > 120 * 120) continue;
      const g = r.group;
      const sp = Math.abs(r.speed);
      const fwdX = r.forwardX;
      const fwdZ = r.forwardZ;
      const rearX = g.position.x - fwdX * 0.8;
      const rearZ = g.position.z - fwdZ * 0.8;
      const y = g.position.y;
      // 漂移烟雾与火花
      if (r.drifting && r.grounded) {
        if (Math.random() < 0.7) fx.spawn(r.ground.surface === 'sand' || r.ground.surface === 'offroad' ? 'dust' : r.ground.surface === 'snow' || r.ground.surface === 'ice' ? 'snow' : 'smoke', rearX, y + 0.2, rearZ, -fwdX * 2 + (Math.random() - 0.5) * 2, 1, -fwdZ * 2 + (Math.random() - 0.5) * 2);
        const lvl = r.driftCharge > 2.2 ? 3 : r.driftCharge > 1.4 ? 2 : r.driftCharge > 0.7 ? 1 : 0;
        if (lvl > 0 && Math.random() < 0.6) fx.spawn(lvl === 3 ? 'plasma' : 'spark', rearX, y + 0.15, rearZ, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6);
        if (r.bikeDef.id === 'hover' && Math.random() < 0.5) fx.spawn('rainbow', rearX, y + 0.4, rearZ, 0, 0.5, 0);
      }
      // 路外扬尘
      if (r.grounded && sp > 12 && r.ground.surface !== 'asphalt' && SURFACES[r.ground.surface].drag > 1 && Math.random() < 0.3) {
        fx.spawn(r.ground.surface === 'mud' ? 'ink' : r.ground.surface === 'snow' ? 'snow' : 'dust', rearX, y + 0.2, rearZ, -fwdX * 3, 1.5, -fwdZ * 3, 0.5);
      }
      // 氮气尾焰粒子
      if ((r.nitroActive || r.superDash > 0 || r.boostTimer > 0) && Math.random() < 0.8) {
        const trail = r.app.trail;
        const kind = trail === 'plasma' ? 'plasma' : trail === 'rainbow' ? 'rainbow' : trail === 'bubbles' ? 'bubble' : trail === 'stars' ? 'gold' : 'fire';
        const ex = r.bike.exhausts[0];
        const wx = g.position.x - fwdX * (-(ex?.z ?? -1) + 0.3);
        const wz = g.position.z - fwdZ * (-(ex?.z ?? -1) + 0.3);
        fx.spawn(kind, wx, y + (ex?.y ?? 0.5), wz, -fwdX * 6, 0.5, -fwdZ * 6);
      }
      if (r.frozen > 0 && Math.random() < 0.3) fx.spawn('ice', g.position.x, y + 1, g.position.z, 0, 1, 0);
      if (r.slippery > 0 && Math.random() < 0.3) fx.spawn('stink', g.position.x, y + 1, g.position.z, 0, 1, 0, 0.5);
      if (r.blind > 0 && Math.random() < 0.2) fx.spawn('feather', g.position.x, y + 2, g.position.z, 0, 1, 0);
      if (r.golden > 0 && Math.random() < 0.5) fx.spawn('gold', g.position.x, y + 1.2, g.position.z, 0, 1, 0);
      // 空中特技轨迹
      if (r.trickActive && Math.random() < 0.7) fx.spawn('rainbow', g.position.x, y + 1.2, g.position.z, 0, 0, 0);
    }
    void dt;
  }

  private updateHud() {
    const h = this.game.store.hud;
    const p = this.player;
    const w = this.world;
    const unit = this.game.store.save.settings.speedUnit === 'mph' ? 2.237 : 3.6;
    h.place = p.place;
    h.total = this.racers.filter((r) => r.state !== 'eliminated').length;
    h.alive = h.total;
    h.lap = Math.min(this.laps, Math.max(1, p.lapsCompleted + 1));
    h.laps = this.laps;
    h.time = this.racing.raceTime;
    h.lapTime = this.racing.raceTime - p.lapStartTime;
    h.bestLap = p.lapTimes.length ? Math.min(...p.lapTimes) : 0;
    h.speed = Math.round(Math.abs(p.speed) * unit);
    h.nitro = p.nitro / p.stats.nitroCapacity;
    h.nitroActive = p.nitroActive;
    h.energy = p.energy / 100;
    h.canSuper = p.energy >= 100;
    h.item = p.item;
    const cdm = p.mods.cooldown;
    h.cd.wingL = p.cd.wingL / (1.5 * cdm);
    h.cd.wingR = p.cd.wingR / (1.5 * cdm);
    h.cd.peck = p.cd.peck / (2 * cdm);
    h.cd.sweep = p.cd.sweep / (4 * cdm);
    h.cd.clamp = p.cd.clamp / (8 * cdm);
    h.hp = Math.max(0, Math.round(p.hp));
    h.lives = p.lives;
    h.distance = Math.max(0, p.ground.mainS - this.distanceStart);
    h.score = Math.floor(h.distance + p.stat.kos * 100 + p.stat.tricks * 50);
    h.wrongWay = p.wrongWayTime > 1.2;
    h.elimTimer = this.racing.eliminationTimer;
    h.fps = this.game.renderer.fps;
    h.drifting = p.drifting;
    h.driftLevel = p.driftCharge > 2.2 ? 3 : p.driftCharge > 1.4 ? 2 : p.driftCharge > 0.7 ? 1 : 0;
    h.invincible = p.golden > 0 || p.superDash > 0;
    h.frozen = p.frozen > 0;
    h.finished = p.finished;
    h.boneTimer = p.boneTimer;
    h.surface = p.ground.surface === 'offroad' ? '路外' : SURFACES[p.ground.surface]?.name ?? '';
    // 前后方对手
    let ahead: Racer | null = null;
    let behind: Racer | null = null;
    for (const r of this.racers) {
      if (r === p || r.state === 'eliminated') continue;
      if (r.place === p.place - 1) ahead = r;
      if (r.place === p.place + 1) behind = r;
    }
    h.ahead = ahead && !ahead.finished ? { name: ahead.name, dist: Math.round(ahead.progress - p.progress) } : null;
    h.behind = behind && !behind.finished ? { name: behind.name, dist: Math.round(p.progress - behind.progress) } : null;
    if (this.mode === 'endless' || this.mode === 'timetrial') {
      h.ahead = null;
      h.behind = null;
    }
    void w;
  }

  private onRaceOver() {
    if (this.finishCam <= 0) this.finishCam = 0.001;
  }

  private showResults() {
    this.resultsShown = true;
    const store = this.game.store;
    const res = applyRewards(store.save, {
      mode: this.mode,
      trackId: this.cfg.id === 'endless' ? 'coast' : this.cfg.id,
      player: this.player,
      standings: this.racing.standings(),
      raceTime: this.racing.raceTime,
      distance: this.mode === 'endless' ? Math.max(0, this.player.ground.mainS - this.distanceStart) : 0,
      shortcutIds: [...this.player.stat.shortcuts],
    });
    if (this.mode === 'endless') {
      res.trackName = '无尽公路';
    }
    store.results = res;
    store.persist();
    this.game.audio.stopEngine();
    store.go('results');
    this.game.music.play('menu');
  }

  /** 玩家在结束前主动结束（例如无尽模式放弃） */
  forceEnd() {
    if (this.resultsShown) return;
    this.racing.end();
    this.finishCam = 3.9;
  }

  get playerProgress() {
    return this.player.progress;
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.game.audio.stopEngine();
  }

  dispose() {
    for (const d of this.disposers) d();
    this.world.events.clear();
    this.items.clear();
    this.combat.clear();
    for (const r of this.racers) r.dispose();
    this.built?.dispose();
    this.endless?.dispose();
    this.weather?.dispose();
    this.fx.dispose();
    this.root.removeFromParent();
    this.world.physics.dispose();
    this.game.audio.stopEngine();
  }
}
