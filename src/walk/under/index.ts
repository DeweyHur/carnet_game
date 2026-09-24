// 지하철·버스 이동도 직접 걷는다. 로딩 화면이나 버튼 대신:
// 기마르 입구 계단을 내려가 → 개찰구에서 표를 찍고 → "Direction ○○" 표지판을 보고 승강장을 고르고 →
// 들어오는 전동차에 걸어 들어가 → (앉거나 서서) 역을 지나 → 내려서 → 환승 통로를 걷거나 → 원하는 출구로 올라온다.
// 버스는 앞문으로 타서 단말기에 찍고, 창밖 거리를 보며 가다가 내린다.
// 지도(MapLibre) 위가 아니라 따로 그린 장면이라, 몸(Body)은 이 장면의 World에서 움직인다.
import * as THREE from 'three';
import type { Hero } from '../hero';
import { World } from '../hero/world';
import type { Solid } from '../hero/world';
import { Frame } from '../hero/geo';
import { Crowd } from '../town/crowd';
import type { SeatSpot } from '../town';
import { LINES, rideInfo, stopPos } from '../districts';
import type { District, Gate, Journey, Leg, Ride } from '../districts';
import type { Curated } from '../places';
import type { MetroResult } from '../metro';
import * as sfx from '../sound';
import { buildStation, gateLeafMeshes, GATE_X, PLAT_X1 } from './station';
import type { ExitSpec, LineLook, StationBuilt } from './station';
import { Train, TRAIN_HALF } from './train';
import { BusScene, BUS_DOORS } from './bus';

type RideLeg = Extract<Leg, { kind: 'ride' }>;
type TransferLeg = Extract<Leg, { kind: 'transfer' }>;

const WRONG_MINS = 7;
const HOP = 240; // 역 사이(연출 거리, m)
const HOP_SECS = 6.5;
const near = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * 73000, (a[1] - b[1]) * 111320);
const ease = (t: number) => t * t * (3 - 2 * t);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lineLook = (key: string): LineLook => ({ key, label: LINES[key].label, color: LINES[key].color, ink: LINES[key].ink });

export interface TransitCtx {
  hero: Hero;
  toast: (s: string) => void;
  hint: (s: string) => void;
  /** 요금 외에 무임승차 벌금 등이 붙으면 */
  fine: (eur: number, why: string) => void;
}

export class Transit {
  active = false;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private camera = new THREE.PerspectiveCamera(62, 1, 0.05, 600);
  private scene = new THREE.Scene();
  private stationA: { built: StationBuilt; name: string } | null = null; // 지금(또는 떠나는) 역
  private stationB: { built: StationBuilt; name: string } | null = null; // 다가오는 역
  private offA = 0; private offB = 0;
  private tunnel = new THREE.Group();
  private train = new Train();
  private bus: BusScene | null = null;
  private crowd = new Crowd();
  private riders = new Crowd();
  private world: World = new World(new Frame([0, 0]));
  private waits: { test: () => boolean; resolve: () => void }[] = [];
  private hud: HTMLElement;
  private prompt: { verb: string; what: string; act: () => void } | null = null;
  private trainX = 0; // 승강장에 선 전동차의 x(들어오고 나가는 연출)
  private trainOn = false;
  private rideDist = 0; // 버스: 달린 거리
  private stopAhead = 999;
  private tunnelScroll = 0;
  private readonly c: TransitCtx;
  private leafMeshes: THREE.Mesh[] = [];
  private gateOpen = 0;
  private savedFacing = 0;

  constructor(c: TransitCtx) {
    this.c = c;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'under';
    const map = document.getElementById('map')!;
    map.after(this.canvas);
    this.hud = document.createElement('div');
    this.hud.className = 'transit-hud';
    document.body.appendChild(this.hud);
    this.camera.up.set(0, 0, 1);
    const hemi = new THREE.HemisphereLight(0xfffaf0, 0x6a6660, 1.5);
    hemi.position.set(0, 0, 1);
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(0.3, 0.4, 1);
    this.scene.add(hemi, dir, new THREE.AmbientLight(0xffffff, 0.35), this.tunnel, this.train.group);
    this.buildTunnel();
    this.train.group.visible = false;
    for (const cr of [this.crowd, this.riders]) {
      cr.birds = false;
      cr.followGround = true;
      cr.walkerRoles = [['passer', 60], ['tourist', 25], ['kid', 6]];
      cr.spawnRange = [6, 55];
      cr.despawn = 95;
      cr.maxOffset = 0.9;
      cr.scene.matrixAutoUpdate = true;
    }
    this.crowd.target = 22;
    this.riders.target = 0;
  }

  private buildTunnel() {
    const tex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d')!; g.fillStyle = '#26241f'; g.fillRect(0, 0, 256, 64); for (let i = 0; i < 500; i++) { const k = 28 + Math.random() * 25; g.fillStyle = `rgb(${k},${k},${k - 3})`; g.fillRect(Math.random() * 256, Math.random() * 64, 3, 2); } g.fillStyle = '#111'; for (const y of [18, 24, 28]) g.fillRect(0, y, 256, 2); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const wall = new THREE.MeshLambertMaterial({ map: tex });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0c0b0a });
    const lamp = new THREE.MeshBasicMaterial({ color: 0xffe7b0 });
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(420, 5), wall);
      m.rotation.x = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      m.position.set(0, s * 3.6, 2.5);
      (m.material as THREE.MeshLambertMaterial).map!.repeat.set(35, 1);
      this.tunnel.add(m);
      for (let x = -210; x < 210; x += 12) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.18), lamp); l.position.set(x, s * 3.5, 3.4); this.tunnel.add(l); }
    }
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(420, 7.2), dark);
    roof.position.z = 5; roof.rotation.x = Math.PI;
    this.tunnel.add(roof);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(420, 7.2), new THREE.MeshLambertMaterial({ color: 0x2e2b27 }));
    this.tunnel.add(floor);
    this.tunnel.visible = false;
  }

  // ───────── 준비·정리 ─────────
  private ensureRenderer() {
    if (this.renderer) return;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x0b0a09);
  }

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const r = this.renderer!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) { r.setPixelRatio(dpr); r.setSize(w, h, false); }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private setStation(slot: 'A' | 'B', built: StationBuilt | null, name = '') {
    const cur = slot === 'A' ? this.stationA : this.stationB;
    if (cur) { this.scene.remove(cur.built.group); cur.built.dispose(); }
    const v = built ? { built, name } : null;
    if (slot === 'A') this.stationA = v; else this.stationB = v;
    if (built) this.scene.add(built.group);
  }

  /** 몸이 이 세계로 들어간다 */
  private use(w: World) {
    this.world = w;
    this.c.hero.sceneWorld = w;
    this.crowd.world = w;
  }

  private placeHero(p: { x: number; y: number; z: number; facing: number }) {
    const b = this.c.hero.body;
    b.place(p.x, p.y, p.z);
    b.facing = p.facing;
    this.c.hero.cam.snap(b);
    this.c.hero.cam.yaw = p.facing;
    this.c.hero.cam.pitch = 12;
  }

  private tick = 0;
  private nextFrame(): Promise<void> { const t = this.tick; return this.until(() => this.tick > t); }

  private until(test: () => boolean): Promise<void> {
    if (test()) return Promise.resolve();
    return new Promise((resolve) => this.waits.push({ test, resolve }));
  }

  /** 두 가지 중 먼저 되는 쪽(번호) */
  private race(tests: (() => boolean)[]): Promise<number> {
    return new Promise((resolve) => {
      const test = () => tests.findIndex((t) => t()) >= 0;
      void this.until(test).then(() => resolve(tests.findIndex((t) => t())));
    });
  }

  private tween(secs: number, f: (k: number) => void): Promise<void> {
    const t0 = performance.now();
    return this.until(() => { const k = Math.min(1, (performance.now() - t0) / 1000 / secs); f(k); return k >= 1; });
  }

  private fadeEl(): HTMLElement { let f = document.querySelector('.under-fade') as HTMLElement | null; if (!f) { f = document.createElement('div'); f.className = 'under-fade'; document.body.appendChild(f); } return f; }
  private async fade(on: boolean) { this.fadeEl().classList.toggle('on', on); await wait(450); }

  private say(title: string, sub: string, chips: string[] = [], at = -1, color = '#152a52', badge = '') {
    this.hud.replaceChildren();
    const head = document.createElement('div');
    head.className = 'th-head';
    if (badge) { const b = document.createElement('i'); b.className = 'mline'; b.textContent = badge; b.style.background = color; head.appendChild(b); }
    const t = document.createElement('b'); t.textContent = title; head.appendChild(t);
    this.hud.appendChild(head);
    if (sub) { const p = document.createElement('p'); p.textContent = sub; this.hud.appendChild(p); }
    if (chips.length) {
      const row = document.createElement('div'); row.className = 'ride-chips';
      chips.forEach((n, i) => { const c = document.createElement('span'); c.className = `chip ${i === at ? 'on' : ''} ${i < at ? 'past' : ''}`; c.textContent = n; row.appendChild(c); });
      this.hud.appendChild(row);
    }
    this.hud.classList.add('on');
  }

  // ───────── 매 프레임(main이 부른다) ─────────
  frame(dt: number) {
    if (!this.active || !this.renderer) return;
    const h = this.c.hero, b = h.body;
    h.input.enabled = !document.querySelector('.under-fade.on');
    h.hud.show(true);
    const r = h.tick(dt, { waypoint: null, frozen: !h.input.enabled, pace: 1, maxStamina: 1, beacon: null });
    for (const e of h.events) {
      if (e === 'stepL' || e === 'stepR') sfx.step(e === 'stepL');
      else if (e === 'jump') sfx.jump();
      else if (e === 'land') sfx.land();
      else if (e === 'sit') sfx.sit();
      else if (e === 'roll' || e === 'rollLand') sfx.roll();
      else if (e === 'vault') sfx.vault();
      else if (e === 'mantle') sfx.mantle();
    }
    // 몸짓(앉기는 가까운 좌석에)
    if (r.f.emote === 'sit' && b.mode !== 'sit') {
      const seat = this.seatNear(b.x, b.y, b.z);
      if (seat) b.sit({ x: seat.x, y: seat.y, z: seat.z, facing: seat.facing }); else b.sit(null);
    } else if (r.f.emote === 'wave') { b.wave(); sfx.bonjour(); }
    else if (r.f.emote === 'dance') b.doAct('dance');
    else if (r.f.emote === 'photo') b.doAct('photo');
    if (h.events.includes('shutter')) sfx.shutter();
    if (r.f.interact && this.prompt) { const p = this.prompt; this.prompt = null; p.act(); }
    h.hud.setPrompt(this.prompt ? { verb: this.prompt.verb, what: this.prompt.what } : b.mode === 'sit' ? { verb: '일어서기', what: '(움직이면 일어선다)' } : null);
    h.hud.setPrompt2(null);
    // 사람들
    const heroInfo = { x: b.x, y: b.y, z: b.z, speed: b.speed, mode: b.mode, crouch: b.crouch, facing: b.facing };
    this.crowd.scene.position.x = this.offA;
    this.crowd.update(dt, { ...heroInfo, x: b.x - this.offA }, h.cam.yaw);
    this.riders.update(dt, heroInfo, h.cam.yaw);
    h.pushAgainst(this.riders, this.world);
    if (this.offA === 0) h.pushAgainst(this.crowd, this.world);
    // 역·터널 위치
    if (this.stationA) this.stationA.built.group.position.x = this.offA;
    if (this.stationB) this.stationB.built.group.position.x = this.offB;
    const nearStation = Math.min(Math.abs(this.offA), this.stationB ? Math.abs(this.offB) : 999) < 150;
    this.tunnel.visible = !nearStation && !this.bus;
    this.tunnel.position.x = -(((this.tunnelScroll % 12) + 12) % 12);
    this.train.group.position.x = this.trainX;
    this.train.group.visible = this.trainOn;
    if (this.bus) this.bus.scroll(this.rideDist, this.stopAhead);
    // 개찰구 문짝
    for (const m of this.leafMeshes) m.rotation.z = (m.userData.s as number) * this.gateOpen * 1.4;
    // 기다리던 일들
    this.tick++;
    for (let i = this.waits.length - 1; i >= 0; i--) if (this.waits[i].test()) { const w = this.waits[i]; this.waits.splice(i, 1); w.resolve(); }
    // 카메라
    const shot = h.sceneShot(dt);
    const br = (shot.bearing * Math.PI) / 180, el = ((shot.pitch - 90) * Math.PI) / 180;
    this.camera.position.set(shot.x, shot.y, shot.z);
    this.camera.lookAt(shot.x + Math.sin(br) * Math.cos(el), shot.y + Math.cos(br) * Math.cos(el), shot.z + Math.sin(el));
    this.resize();
    const R = this.renderer;
    R.clear();
    R.render(this.scene, this.camera);
    R.render(this.crowd.scene, this.camera);
    R.render(this.riders.scene, this.camera);
    h.figure.scene.position.set(b.x, b.y, b.z);
    h.figure.scene.updateMatrixWorld(true);
    R.render(h.figure.scene, this.camera);
    // 기력 바퀴를 머리 옆에
    const v = new THREE.Vector3(b.x, b.y, b.z + 1.5).project(this.camera);
    h.hud.anchor(((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight, v.z < 1);
  }

  private seatNear(x: number, y: number, z: number): SeatSpot | null {
    const list: SeatSpot[] = [...(this.stationA && this.offA === 0 ? this.stationA.built.seats : []), ...(this.trainOn ? this.train.seats() : []), ...(this.bus ? this.bus.seats() : [])];
    let best: SeatSpot | null = null, bd = 1.3;
    for (const s of list) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd && Math.abs(s.z - z) < 1) { bd = d; best = s; } }
    if (best && this.riders.npcs.some((n) => n.anchor && Math.hypot(n.anchor.x - best!.x, n.anchor.y - best!.y) < 0.3)) return null;
    return best;
  }

  // ───────── 여정 전체 ─────────
  async run(from: District, dest: District, j: Journey, entered: Gate, want: Curated | null, preload: () => void): Promise<MetroResult | null> {
    this.ensureRenderer();
    const h = this.c.hero;
    const b = h.body;
    const saved = { x: b.x, y: b.y, z: b.z, facing: b.facing };
    this.savedFacing = b.facing;
    this.active = true;
    document.body.classList.add('underground');
    await this.fade(true);
    this.canvas.classList.add('on');
    const st = { mins: 0, wrong: 0, fraud: false, validated: false, preloaded: false, exit: entered as Gate, extra: 0 };
    const pre = () => { if (!st.preloaded) { st.preloaded = true; preload(); } };
    const legs = j.legs;
    let result: MetroResult | null = null;
    try {
      let entry: 'street' | 'corridor' = 'street';
      for (let i = 0; i < legs.length; i++) {
        const l = legs[i];
        if (l.kind === 'transfer') {
          st.mins += l.mins;
          entry = l.street ? 'street' : 'corridor';
          if (l.street) { await this.interlude(`${l.at} · 길을 걸어 옮긴다`, `${l.from} → ${l.to} (${l.mins}분) — ${l.note}`); st.validated = false; }
          continue;
        }
        const r = rideInfo(l);
        const next = legs[i + 1] as TransferLeg | undefined;
        const last = !legs.slice(i + 1).some((x) => x.kind === 'ride');
        if (r.mode === 'bus') {
          const out = await this.busLeg(l, r, st, pre, last, dest, want, entered, i === 0);
          if (out === 'cancel') return null;
          entry = 'street';
          continue;
        }
        const nextLine = (legs.slice(i + 1).find((x) => x.kind === 'ride') as RideLeg | undefined)?.line;
        const out = await this.metroLeg(l, r, st, pre, { first: i === 0, entry, last, next, nextLine, from, dest, want, entered });
        if (out === 'cancel') return null;
        entry = 'corridor';
      }
      if (st.fraud && Math.random() < 0.55) { st.extra += 50; this.c.fine(50, '무임승차'); }
      result = { mins: st.mins, cost: Math.round((j.fare + st.extra) * 100) / 100, exit: st.exit, wrong: st.wrong };
      return result;
    } finally {
      // 거리로 돌아간다(취소면 원래 자리에)
      if (!result) { b.place(saved.x, saved.y, saved.z); b.facing = saved.facing; }
      this.cleanup();
      if (!result) { h.cam.snap(b); h.cam.yaw = this.savedFacing; }
      await this.fade(false);
    }
  }

  private cleanup() {
    const h = this.c.hero;
    h.sceneWorld = null;
    h.figure.scene.position.set(0, 0, 0);
    h.figure.scene.updateMatrixWorld(true);
    this.setStation('A', null); this.setStation('B', null);
    this.offA = 0; this.offB = 0;
    this.trainOn = false;
    this.train.group.visible = false;
    if (this.bus) { this.scene.remove(this.bus.group); this.bus.dispose(); this.bus = null; }
    this.crowd.npcs.length = 0;
    this.riders.npcs.length = 0;
    this.waits.length = 0;
    this.prompt = null;
    this.leafMeshes = [];
    this.canvas.classList.remove('on');
    this.hud.classList.remove('on');
    this.active = false;
    document.body.classList.remove('underground');
    sfx.rumble(0);
    h.hud.setPrompt(null);
  }

  private async interlude(title: string, sub: string) {
    this.say(title, sub);
    await this.fade(true);
    for (let i = 0; i < 5; i++) sfx.stair(i);
    await wait(1400);
  }

  // ───────── 지하철 한 구간 ─────────
  private stationSpec(name: string, line: string, r: Ride, exits: ExitSpec[], transfer: { line: LineLook; text: string } | null) {
    return buildStation({ name, line: lineLook(line), dirs: r.dirs, exits, transfer, seed: name.length * 31 + line.length * 7 });
  }

  private exitsOf(d: District, name: string, want: Curated | null): { specs: ExitSpec[]; gates: Gate[] } {
    const stn = d.stations.find((s) => s.name === name);
    const gates = stn?.gates ?? [];
    const best = want && gates.length ? gates.reduce((a, g, i) => (near(g.pos, want.pos) < near(gates[a].pos, want.pos) ? i : a), 0) : -1;
    const specs = gates.length ? gates.map((g, i) => ({ ref: g.ref, label: g.label.split('—')[0].trim(), note: g.note, best: i === best })) : [{ ref: '1', label: `${name} · 거리로`, note: '' }];
    return { specs, gates };
  }

  private async metroLeg(l: RideLeg, r: Ride, st: { mins: number; wrong: number; fraud: boolean; validated: boolean; exit: Gate }, pre: () => void,
    o: { first: boolean; entry: 'street' | 'corridor'; last: boolean; next?: TransferLeg; nextLine?: string; from: District; dest: District; want: Curated | null; entered: Gate }): Promise<'ok' | 'cancel'> {
    void this.c.hero;
    // 타는 역
    const ex0 = this.exitsOf(o.from, l.from, null);
    const enteredIdx = Math.max(0, ex0.gates.findIndex((g) => g === o.entered));
    const built = this.stationSpec(l.from, l.line, r, ex0.specs, null);
    this.setStation('A', built, l.from);
    this.offA = 0;
    const W = new World(new Frame([0, 0]));
    built.addSolids(W);
    this.leafMeshes = gateLeafMeshes(built.group);
    let leaves: Solid[] = [];
    const needTicket = o.entry === 'street';
    if (needTicket) { leaves = built.gateLeaves(W); this.gateOpen = 0; st.validated = false; } else { this.gateOpen = 1; st.validated = true; }
    this.use(W);
    this.crowd.reset(W, built.nodes, built.adj, 'metro');
    this.crowd.seats = built.seats;
    this.crowd.spots = [{ kind: 'fountain', x: 79, y: 5.5, facing: 200 }];
    this.placeHero(o.entry === 'street' ? built.spawnExit(enteredIdx) : built.spawnTransfer);
    if (o.first) st.mins += 3;
    this.say(`Ⓜ ${l.from}`, needTicket ? '개찰구에서 표를 찍고(E), "Direction" 표지판을 보고 승강장으로 내려간다.' : `${r.label} 승강장으로. 가는 방향은 종착역 이름(Direction)으로 적혀 있다.`, [], -1, r.color, l.line);
    await this.fade(false);
    this.c.hint(`${l.to}에 가려면: ${r.label} Direction ${r.dirs[r.right]} — 노선에서 ${l.to}가 ${r.dirs[r.right]} 쪽에 있다.`);
    setTimeout(() => this.c.hint(''), 9000);

    // 승강장을 고르고 전동차를 탈 때까지
    for (;;) {
      const board = await this.boardLoop(built, W, leaves, st, pre, o.first, l, r);
      if (board === 'cancel') return 'cancel';
      const side = board;
      const wrong = (side > 0 ? 0 : 1) !== r.right;
      const ok = await this.ride(l, r, side, wrong, st, o);
      if (ok) return 'ok';
      // 반대 방향이었다 — 같은 역 맞은편 승강장으로 돌아왔다
      const again = this.stationSpec(l.from, l.line, r, ex0.specs, null);
      this.setStation('A', again, l.from);
      this.offA = 0; this.offB = 0;
      this.setStation('B', null);
      const W2 = new World(new Frame([0, 0]));
      again.addSolids(W2);
      this.gateOpen = 1;
      this.leafMeshes = gateLeafMeshes(again.group);
      this.use(W2);
      this.crowd.reset(W2, again.nodes, again.adj, 'metro');
      this.crowd.seats = again.seats;
      this.placeHero(again.spawnPlatform(-side as 1 | -1));
      await this.fade(false);
      return (await this.continueFrom(again, W2, st, pre, l, r, o)) ? 'ok' : 'cancel';
    }
  }

  /** 반대로 갔다 돌아온 뒤: 맞은편 승강장에서 다시 탄다 */
  private async continueFrom(built: StationBuilt, W: World, st: { mins: number; wrong: number; fraud: boolean; validated: boolean; exit: Gate }, pre: () => void, l: RideLeg, r: Ride,
    o: { first: boolean; entry: 'street' | 'corridor'; last: boolean; next?: TransferLeg; nextLine?: string; from: District; dest: District; want: Curated | null; entered: Gate }): Promise<boolean> {
    for (;;) {
      const board = await this.boardLoop(built, W, [], st, pre, false, l, r);
      if (board === 'cancel') return false;
      const wrong = (board > 0 ? 0 : 1) !== r.right;
      if (await this.ride(l, r, board, wrong, st, o)) return true;
    }
  }

  /** 개찰구·승강장·전동차 도착과 탑승. 탄 승강장(1=A, -1=B) 또는 취소 */
  private async boardLoop(built: StationBuilt, W: World, leaves: Solid[], st: { mins: number; wrong: number; fraud: boolean; validated: boolean }, pre: () => void, first: boolean, l: RideLeg, r: Ride): Promise<1 | -1 | 'cancel'> {
    const h = this.c.hero, b = h.body;
    let schedule = -1; // 다음 차가 들어오기까지(초)
    let side: 1 | -1 = 1;
    let last = performance.now();
    for (;;) {
      // 한 프레임씩
      await this.nextFrame();
      const now = performance.now();
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      // 개찰구
      this.prompt = null;
      if (!st.validated && b.x > GATE_X && b.x < GATE_X + 2.6 && b.z > 5) {
        this.prompt = { verb: '표 찍기', what: '🎫 개찰구', act: () => {
          st.validated = true;
          for (const s of leaves) W.removeSolid(s);
          sfx.validate(); setTimeout(() => sfx.turnstile(), 250);
          void this.tween(0.5, (k) => { this.gateOpen = k; });
          pre();
          this.c.toast('🎫 표를 찍었다. 문이 열린다');
        } };
      }
      if (!st.validated && b.x < GATE_X - 0.8 && b.z > 5) {
        st.validated = true;
        st.fraud = true;
        pre();
        this.c.toast('개찰구를 뛰어넘었다… 검표원에게 걸리면 벌금 €50');
      }
      // 되돌아 나가면 취소(처음 역에서 아직 안 탔을 때)
      if (first && built.exitZones.some((z) => built.inZone(z, b.x, b.y, b.z))) return 'cancel';
      // 승강장
      const onA = built.inZone(built.platformZone(1), b.x, b.y, b.z), onB = built.inZone(built.platformZone(-1), b.x, b.y, b.z);
      if ((onA || onB) && !this.trainOn && schedule < 0) {
        side = onA ? 1 : -1;
        schedule = 3 + Math.random() * 3;
        const dirName = r.dirs[side > 0 ? 0 : 1];
        this.say(`Ⓜ ${l.from} · Direction ${dirName}`, `다음 열차 곧 도착 — ${dirName} 방면. ${l.to}가 이쪽이 맞나?`, [], -1, r.color, l.line);
      }
      if (schedule >= 0 && !this.trainOn) {
        schedule -= dt;
        if (schedule <= 0) {
          schedule = -1;
          const boarded = await this.trainCall(W, side, r);
          if (boarded) return side;
        }
      }
    }
  }

  /** 전동차가 들어와 문을 열고, 여행자가 타면 1, 안 타고 떠나면 0 */
  private async trainCall(W: World, side: 1 | -1, r: Ride): Promise<boolean> {
    const h = this.c.hero, b = h.body;
    this.train.place(side);
    this.train.setLine(r.color);
    this.train.setOpen(0);
    const dir = side; // A 쪽 차는 +x로 달린다
    this.trainOn = true;
    sfx.rumble(0.7);
    await this.tween(5.5, (k) => { this.trainX = -dir * 170 * (1 - ease(Math.min(1, k * 1.05))); sfx.rumble(0.9 * (1 - k * 0.8)); });
    this.trainX = 0;
    sfx.rumble(0.05);
    const { leaves, all } = this.train.addSolids(W);
    // 전동차 안 사람들
    this.fillRiders(W, side);
    sfx.doorOpen();
    for (const s of leaves) W.removeSolid(s);
    await this.tween(0.8, (k) => this.train.setOpen(k));
    this.c.toast('문이 열렸다 — 걸어 들어가서 타자');
    // 여행자가 타거나, 시간이 다 되면 닫힌다
    const t0 = performance.now();
    let inside = 0;
    await this.until(() => {
      if (this.train.inside(b.x, b.y, b.z)) inside += 1 / 60; else inside = 0;
      return inside > 1.2 || performance.now() - t0 > 16000;
    });
    const boarded = this.train.inside(b.x, b.y, b.z);
    sfx.doorBeep();
    await wait(900);
    // 문간에 서 있으면 안으로 들인다
    if (!boarded) {
      const inDoor = Math.abs(b.y - side * 1.05) < 1.4 && Math.abs(b.x) < TRAIN_HALF;
      if (inDoor) b.place(b.x, side * 2.9, 1.0);
    }
    for (const s of leaves) W.reinsert(s);
    await this.tween(0.8, (k) => this.train.setOpen(1 - k));
    if (boarded) return true;
    for (const s of all) W.removeSolid(s);
    this.riders.npcs.length = 0;
    sfx.rumble(0.8);
    await this.tween(5, (k) => { this.trainX = dir * 190 * ease(k); sfx.rumble(0.8 * (1 - k)); });
    this.trainOn = false;
    this.c.toast('전동차가 떠났다. 다음 차를 기다린다');
    return false;
  }

  private fillRiders(W: World, side: 1 | -1) {
    this.riders.npcs.length = 0;
    this.riders.world = W;
    const seats = this.train.seats();
    for (const s of seats) {
      if (Math.random() > 0.38) continue;
      const n = this.riders.spawn(Math.random() < 0.7 ? 'reader' : 'sitter', s.x, s.y, s.facing, { state: 'sit', anchor: { x: s.x, y: s.y, z: s.z, facing: s.facing }, speed: 0 });
      n.z = s.z;
    }
    for (let i = 0; i < 9; i++) {
      const x = (Math.random() - 0.5) * (TRAIN_HALF * 2 - 4), y = side * 1.05 + (Math.random() - 0.5) * 0.9;
      const n = this.riders.spawn(Math.random() < 0.3 ? 'tourist' : 'passer', x, y, Math.random() < 0.5 ? 90 : 270, { state: 'stand', anchor: { x, y, z: 1.0, facing: Math.random() * 360 }, speed: 0 });
      n.z = 1.0;
    }
  }

  /** 탄 뒤: 역을 지나 내릴 역까지. 반대 방향이면 false */
  private async ride(l: RideLeg, r: Ride, side: 1 | -1, wrong: boolean, st: { mins: number; wrong: number; fraud: boolean; validated: boolean; exit: Gate },
    o: { last: boolean; next?: TransferLeg; nextLine?: string; dest: District; want: Curated | null }): Promise<boolean> {
    const h = this.c.hero, b = h.body;
    const dir = side;
    // 달리는 동안은 전동차 안이 세계다
    const TW = new World(new Frame([0, 0]));
    this.train.addSolids(TW);
    this.use(TW);
    this.crowd.npcs.length = 0;
    const step = r.b > r.a ? 1 : -1;
    const names: string[] = [];
    if (wrong) names.push(r.stations[Math.max(0, Math.min(r.stations.length - 1, r.a - step))]);
    else for (let i = r.a + step; i !== r.b + step; i += step) names.push(r.stations[i]);
    const chips = [l.from, ...names];
    for (let k = 0; k < names.length; k++) {
      const nm = names[k];
      const final = k === names.length - 1;
      sfx.chime();
      this.say(`${r.label} · Direction ${r.dirs[side > 0 ? 0 : 1]}`, `Prochaine station : ${nm}${final && !wrong ? ' — 여기서 내린다' : ''}`, chips, k, r.color, l.line);
      // 다음 역을 미리 지어 둔다
      const isArrival = final && !wrong;
      let exits: { specs: ExitSpec[]; gates: Gate[] } = { specs: [{ ref: '1', label: `${nm} · 거리로`, note: '' }], gates: [] };
      let transfer: { line: LineLook; text: string } | null = null;
      if (isArrival) {
        if (o.next && !o.next.street) {
          const nextRide = o.nextLine;
          if (nextRide && LINES[nextRide]) transfer = { line: lineLook(nextRide), text: `${LINES[nextRide].label} · ${o.next.note}` };
        }
        if (o.last || (o.next && o.next.street)) exits = this.exitsOf(o.dest, nm, o.last ? o.want : null);
      }
      const nb = this.stationSpec(nm, l.line, r, exits.specs, transfer);
      this.setStation('B', nb, nm);
      this.offB = dir * (HOP + 60);
      sfx.rumble(0.9);
      await this.tween(HOP_SECS, (kk) => {
        const e = ease(kk);
        this.offA = -dir * (HOP + 60) * e;
        this.offB = dir * (HOP + 60) * (1 - e);
        this.tunnelScroll = dir * e * 400;
        sfx.rumble(0.35 + 0.6 * Math.sin(kk * Math.PI));
      });
      sfx.rumble(0.05);
      // 도착한 역이 새 "지금 역"
      this.setStation('A', null);
      this.stationA = this.stationB; this.stationB = null;
      this.offA = 0; this.offB = 0;
      if (wrong) {
        st.wrong++;
        st.mins += WRONG_MINS;
        sfx.hurt();
        this.c.toast(`반대 방향이었다! ${nm}에서 내려 맞은편 승강장으로 돌아왔다 (+${WRONG_MINS}분)`);
        await this.fade(true);
        this.trainOn = false;
        this.riders.npcs.length = 0;
        return false;
      }
      if (!final) { await wait(1400); continue; }
      // 내릴 역: 문을 열고 역 세계로
      st.mins += r.mins;
      const built = this.stationA!.built;
      const W = new World(new Frame([0, 0]));
      built.addSolids(W);
      this.gateOpen = 1;
      this.leafMeshes = gateLeafMeshes(built.group);
      const { leaves, all } = this.train.addSolids(W);
      for (const s of leaves) W.removeSolid(s);
      this.use(W);
      this.crowd.reset(W, built.nodes, built.adj, 'metro');
      this.crowd.seats = built.seats;
      this.crowd.spots = [];
      sfx.doorOpen();
      await this.tween(0.8, (kk) => this.train.setOpen(kk));
      this.say(`Ⓜ ${nm}`, o.last ? '내려서 계단을 올라가 출구(Sortie)를 고른다. ★는 가려는 곳에서 가까운 출구.' : o.next && !o.next.street ? `Correspondance 표지판을 따라 갈아탄다.` : '내려서 출구로 나간다.', [], -1, r.color, l.line);
      // 여행자가 내리면 떠난다
      await this.until(() => !this.train.inside(b.x, b.y, b.z) && Math.abs(b.y) > 2.35);
      void (async () => {
        await wait(2500);
        sfx.doorBeep();
        for (const s of leaves) W.reinsert(s);
        await this.tween(0.8, (kk) => this.train.setOpen(1 - kk));
        for (const s of all) W.removeSolid(s);
        this.riders.npcs.length = 0;
        await this.tween(5, (kk) => { this.trainX = dir * 190 * ease(kk); });
        this.trainOn = false;
        this.trainX = 0;
      })();
      // 출구 또는 환승 통로
      const zones = built.exitZones;
      const tz = built.transferZone;
      const which = await this.race([() => zones.some((z) => built.inZone(z, b.x, b.y, b.z)), () => !!tz && built.inZone(tz, b.x, b.y, b.z)]);
      if (which === 0) {
        const i = zones.findIndex((z) => built.inZone(z, b.x, b.y, b.z));
        const g = exits.gates[i];
        if (g) { st.exit = g; st.mins += g.mins; }
        else if (o.last) st.exit = { ref: '1', label: `${nm}`, note: '', pos: exits.gates[0]?.pos ?? stopPosOr(l.line, nm, st.exit.pos), mins: 2 };
        for (let n = 0; n < 6; n++) sfx.stair(n);
        sfx.surface();
        this.c.toast(`↑ Sortie${g ? ` ${g.ref} · ${g.label.split('—')[0].trim()}` : ''}`);
      } else {
        for (let n = 0; n < 5; n++) sfx.stair(n);
      }
      await this.fade(true);
      this.trainOn = false;
      this.riders.npcs.length = 0;
      return true;
    }
    return true;
  }

  // ───────── 버스 한 구간 ─────────
  private async busLeg(l: RideLeg, r: Ride, st: { mins: number; wrong: number; fraud: boolean; validated: boolean; exit: Gate }, pre: () => void, last: boolean, dest: District, want: Curated | null, entered: Gate, first: boolean): Promise<'ok' | 'cancel'> {
    const h = this.c.hero, b = h.body;
    if (this.bus) { this.scene.remove(this.bus.group); this.bus.dispose(); }
    const bus = (this.bus = new BusScene(r.color));
    this.scene.add(bus.group);
    this.setStation('A', null); this.setStation('B', null);
    this.leafMeshes = [];
    const W = new World(new Frame([0, 0]));
    const { leaves } = bus.addSolids(W);
    this.use(W);
    this.crowd.reset(W, [], [], 'bus');
    this.crowd.npcs.length = 0;
    this.riders.npcs.length = 0;
    this.riders.world = W;
    for (const s of bus.seats()) if (Math.random() < 0.4) { const n = this.riders.spawn(Math.random() < 0.6 ? 'reader' : 'sitter', s.x, s.y, s.facing, { state: 'sit', anchor: { x: s.x, y: s.y, z: s.z, facing: s.facing }, speed: 0 }); n.z = s.z; }
    // 해질녘 거리 빛깔
    const tu = h.town.uniforms;
    bus.uniforms.uSun.value.copy(tu.uSun.value); bus.uniforms.uSunCol.value.copy(tu.uSunCol.value); bus.uniforms.uAmb.value.copy(tu.uAmb.value); bus.uniforms.uNight.value = tu.uNight.value;
    this.stopAhead = 0;
    this.rideDist = 0;
    this.placeHero({ x: BUS_DOORS[0] - 0.3, y: -0.5, z: 0.4, facing: 270 });
    if (first) st.mins += 6;
    st.validated = false;
    const step = r.b > r.a ? 1 : -1;
    const names: string[] = [];
    for (let i = r.a + step; i !== r.b + step; i += step) names.push(r.stations[i]);
    const chips = [l.from, ...names];
    this.say(`🚌 ${r.label} → ${r.dirs[r.right]}`, '앞문으로 탔다. 단말기(파란 상자)에 표를 찍자(E). 앉아도(4) 된다.', chips, 0, r.color);
    await this.fade(false);
    // 표 찍기(선택) — 안 찍고 내리면 검표에 걸릴 수 있다
    const validator = () => {
      if (st.validated) return;
      if (Math.hypot(b.x - bus.validator.x, b.y - bus.validator.y) < 1.1) this.prompt = { verb: '표 찍기', what: '🎫 단말기', act: () => { st.validated = true; sfx.validate(); pre(); this.c.toast('🎫 삑! 표를 찍었다'); } };
      else if (this.prompt?.what === '🎫 단말기') this.prompt = null;
    };
    for (let k = 0; k < names.length; k++) {
      const nm = names[k];
      const final = k === names.length - 1;
      sfx.chime();
      this.say(`🚌 ${r.label} → ${r.dirs[r.right]}`, `Prochain arrêt : ${nm}${final ? ' — 여기서 내린다' : ''}`, chips, k, r.color);
      const d0 = this.rideDist;
      await this.tween(HOP_SECS + 1, (kk) => { const e = ease(kk); this.rideDist = d0 + 180 * e; this.stopAhead = 180 * (1 - e); sfx.rumble(0.25 + 0.3 * Math.sin(kk * Math.PI)); validator(); });
      sfx.rumble(0.05);
      if (!final) { await wait(1200); continue; }
    }
    st.mins += r.mins;
    if (!st.validated) st.fraud = true;
    pre();
    // 내린다: 문이 열리고, 보도로 걸어 나간다
    sfx.doorOpen();
    for (const s of leaves) W.removeSolid(s);
    await this.tween(0.8, (kk) => bus.setOpen(kk));
    this.prompt = null;
    this.c.toast('문이 열렸다 — 보도로 내리자');
    await this.until(() => b.y < -1.9);
    if (last) {
      const pos = stopPos(l.line, l.to) ?? entered.pos;
      st.exit = { ref: LINES[l.line].label, label: `${l.to} 정류장`, note: '버스에서 내리면 바로 길가다.', pos, mins: 0 };
      void want; void dest;
    }
    sfx.surface();
    await this.fade(true);
    this.scene.remove(bus.group);
    bus.dispose();
    this.bus = null;
    this.riders.npcs.length = 0;
    return 'ok';
  }
}

function stopPosOr(line: string, name: string, fallback: [number, number]): [number, number] {
  return stopPos(line, name) ?? fallback;
}

export { PLAT_X1 };
