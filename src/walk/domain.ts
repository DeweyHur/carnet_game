// 비경(원신처럼): 파리 땅 밑의 도전 던전. 입구(돌 아치 속 보랏빛 소용돌이)에서 F → 따로 떨어진 장면으로.
// 시작 방 → (돌 받침에서 F: 도전 시작, 문이 열린다) → 복도 → 원형 광장에서 적의 물결 셋 → 제한 시간 안에 모두 물리치면 끝.
// 남은 시간으로 별 셋까지, 보상은 하루 세 번. 쓰러지거나 시간이 다하면 밖으로 밀려난다. 리리도 따라 들어온다.
//  🌫 하수도 — 안개의 수로(알마 다리)   💀 카타콤 — 뼈의 회랑(팡테옹)   ⛏ 몽마르트르 석고 채석장
import * as THREE from 'three';
import type { Hero } from './hero';
import { World } from './hero/world';
import type { Solid } from './hero/world';
import { Frame } from './hero/geo';
import type { LngLat } from './graph';
import type { Progress } from './progress';
import type { Combat } from './combat';
import type { Companion } from './companion';
import { lmPoint } from './explore';
import { DISTRICTS } from './districts';
import * as sfx from './sound';

type Kind = 'slime' | 'rat' | 'gargoyle';
interface Theme { wall: string; wall2: string; floor: string; fog: number; light: number; accent: number; water?: boolean; bones?: boolean; beams?: boolean }
export interface DomainDef { id: string; name: string; emoji: string; pos: LngLat; blurb: string; theme: Theme; waves: (lv: number) => Kind[][] }

export const DOMAINS: DomainDef[] = [
  {
    id: 'sewers', name: '안개의 수로', emoji: '🌫', pos: [2.30186, 48.86247],
    blurb: '알마 다리 옆 하수도 박물관 밑 — 센 강 안개가 고여 슬라임이 된다',
    theme: { wall: '#4d5a4c', wall2: '#3a453a', floor: '#3b3f38', fog: 0x1c2620, light: 0x9fd6b0, accent: 0x7ff5d0, water: true },
    waves: (lv) => [['slime', 'slime', 'slime'], ['rat', 'slime', 'rat', ...(lv > 1 ? ['slime'] as Kind[] : [])], ['rat', 'rat', 'gargoyle', ...(lv > 2 ? ['rat', 'slime'] as Kind[] : [])]],
  },
  {
    id: 'catacombs', name: '뼈의 회랑', emoji: '💀', pos: lmPoint('pantheon', -62, 16),
    blurb: '팡테옹 밑으로 이어진 카타콤 — 600만 명의 뼈 사이로 쥐 기사가 순찰한다',
    theme: { wall: '#b8ab8e', wall2: '#8f8367', floor: '#5b5446', fog: 0x1a1612, light: 0xffc98a, accent: 0xffb35c, bones: true },
    waves: (lv) => [['rat', 'rat', 'slime'], ['rat', 'rat', 'rat', ...(lv > 1 ? ['gargoyle'] as Kind[] : [])], ['gargoyle', 'rat', 'rat', ...(lv > 2 ? ['gargoyle', 'rat'] as Kind[] : [])]],
  },
  {
    id: 'quarry', name: '석고 채석장', emoji: '⛏', pos: DISTRICTS['montmartre'].start,
    blurb: '몽마르트르 언덕 속 옛 석고 채석장 — 돌 가고일이 잠에서 깬다',
    theme: { wall: '#e4ddcc', wall2: '#c9bfa8', floor: '#9c927e', fog: 0x2a2620, light: 0xfff1d0, accent: 0xb58cff, beams: true },
    waves: (lv) => [['gargoyle', 'slime', 'slime'], ['gargoyle', 'gargoyle', 'rat', ...(lv > 1 ? ['slime'] as Kind[] : [])], ['gargoyle', 'gargoyle', 'gargoyle', ...(lv > 2 ? ['rat', 'rat'] as Kind[] : [])]],
  },
];

export interface DomainCtx {
  hero: Hero;
  progress: Progress;
  combat: () => Combat | null;
  companion: () => Companion | null;
  toast(s: string): void;
  hint(s: string): void;
  money(eur: number): void;
  xpMul(): number;
}

const TIME = 180; // 제한 시간(초)
const DAILY = 3;
const KEY = 'carnet-domain-v1';
const ROMAN = ['', 'I', 'II', 'III'];
const today = () => new Date().toISOString().slice(0, 10);

interface Gate { def: DomainDef; obj: THREE.Group; x: number; y: number; z: number; settled: boolean; tryT: number }
type Phase = 'ready' | 'run' | 'clear' | 'out';

export class Domain {
  private readonly c: DomainCtx;
  /** 거리 장면에 세우는 입구들 */
  readonly group = new THREE.Group();
  private gates: Gate[] = [];
  private frameRef: unknown = null;
  private nearGate: Gate | null = null;
  // 안
  active = false;
  private def: DomainDef | null = null;
  private lv = 1;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.05, 400);
  private world = new World(new Frame([0, 0]));
  private room = new THREE.Group();
  private door: Solid | null = null;
  private doorObj: THREE.Object3D | null = null;
  private pedestal: THREE.Group | null = null;
  private exitRing: THREE.Object3D | null = null;
  private phase: Phase = 'ready';
  private t = 0;
  private left = TIME;
  private wave = 0;
  private waveKey = '';
  private runId = 0;
  private saved: { x: number; y: number; z: number; facing: number } | null = null;
  private hud: HTMLElement;
  private prompt: { verb: string; what: string; act: () => void } | null = null;
  private busy = false;
  private clears = { day: '', n: 0, best: {} as Record<string, number> };
  private arenaIn = false;

  constructor(c: DomainCtx) {
    this.c = c;
    this.group.name = 'domain-gates';
    this.camera.up.set(0, 0, 1);
    this.hud = document.createElement('div');
    this.hud.className = 'dom-hud';
    document.body.appendChild(this.hud);
    try { const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as typeof this.clears | null; if (d) this.clears = { day: d.day ?? '', n: d.n ?? 0, best: d.best ?? {} }; } catch { /* 처음 */ }
  }
  private saveClears() { try { localStorage.setItem(KEY, JSON.stringify(this.clears)); } catch { /* 무시 */ } }
  private get rewardsLeft() { if (this.clears.day !== today()) { this.clears = { day: today(), n: 0, best: this.clears.best }; } return DAILY - this.clears.n; }
  private levelFor(ar: number) { return ar >= 8 ? 3 : ar >= 4 ? 2 : 1; }

  // ───────── 거리: 입구 ─────────
  private placeGates() {
    const h = this.c.hero;
    for (const g of this.gates) this.group.remove(g.obj);
    this.gates = [];
    for (const def of DOMAINS) {
      const [x, y] = h.frame.toLocal(def.pos);
      if (Math.hypot(x, y) > 9000) continue;
      const obj = this.gateModel(def);
      this.group.add(obj);
      this.gates.push({ def, obj, x, y, z: 0, settled: false, tryT: 0 });
    }
  }
  private gateModel(def: DomainDef) {
    const g = new THREE.Group();
    const stone = new THREE.MeshToonMaterial({ color: 0x8a8174 });
    const dark = new THREE.MeshToonMaterial({ color: 0x4a443c });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 3.2).translate(0, 0, 1.6), stone);
      p.position.x = s * 1.5; g.add(p);
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.35, 8, 20, Math.PI).rotateX(Math.PI / 2).translate(0, 0, 3.2), stone);
    g.add(arch);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 0.25).translate(0, 0, 0.12), dark));
    // 보랏빛 소용돌이
    const swirl = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.35 - i * 0.3, 32), new THREE.MeshBasicMaterial({ color: [0x5b2a9e, 0x8f5cff, 0xd9c2ff][i], transparent: true, opacity: 0.75 - i * 0.15, side: THREE.DoubleSide, depthWrite: false, blending: i ? THREE.AdditiveBlending : THREE.NormalBlending }));
      m.rotation.x = Math.PI / 2; m.position.set(0, 0.01 * i, 2.05);
      swirl.add(m);
    }
    g.add(swirl);
    g.userData.swirl = swirl;
    // 이름표(스프라이트)
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const x = cv.getContext('2d')!;
    x.fillStyle = '#1f1b16cc'; x.beginPath(); x.roundRect(4, 8, 248, 48, 16); x.fill();
    x.fillStyle = '#e8dcff'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(`${def.emoji} 비경 · ${def.name}`, 128, 33);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sp.scale.set(4, 1, 1); sp.position.z = 4.6;
    g.add(sp);
    return g;
  }

  /** 입구를 둘레 40 m 안의 탁 트인 땅(반지름 2.5 m에 벽이 없는 곳)으로 옮긴다 — 지도 자료가 들어온 뒤에 */
  private settle(g: Gate) {
    const w = this.c.hero.world;
    const clear = (x: number, y: number) => {
      const z = w.terrain(x, y) + 1;
      if (w.water(x, y)) return false;
      for (let a = 0; a < 8; a++) { const r = a < 4 ? 1.2 : 2.5, t = (a * Math.PI) / 2 + (a < 4 ? 0 : Math.PI / 4); if (w.solidAt(x + Math.cos(t) * r, y + Math.sin(t) * r, z)) return false; }
      return !w.solidAt(x, y, z);
    };
    if (w.near(g.x, g.y, 60).length === 0) return false; // 아직 건물 자료가 없다
    for (let r = 0; r <= 40; r += 2) for (let k = 0; k < Math.max(1, r * 1.5); k++) {
      const t = (k / Math.max(1, r * 1.5)) * Math.PI * 2, x = g.x + Math.cos(t) * r, y = g.y + Math.sin(t) * r;
      if (clear(x, y)) { g.x = x; g.y = y; return true; }
    }
    return true; // 찾지 못하면 그 자리 그대로
  }

  /** 거리에서: 입구 곁이면 F 안내 */
  prompt2(): { verb: string; what: string } | null {
    const g = this.nearGate;
    if (!g) return null;
    const lv = this.levelFor(this.c.progress.ar);
    return { verb: '비경 들어가기', what: `${g.def.emoji} ${g.def.name} · 난도 ${ROMAN[lv]} · 오늘 보상 ${Math.max(0, this.rewardsLeft)}/${DAILY}` };
  }
  /** 한 곳이라도 깬 적이 있나 */
  get clearedAny() { return Object.keys(this.clears.best).length > 0; }
  /** ★★★로 깬 적이 있나 */
  get threeStarAny() { return Object.values(this.clears.best).some((v) => v >= 3); }
  /** 미니맵 표시 */
  marks() { return this.gates.map((g) => ({ x: g.x, y: g.y, icon: '🌀' })); }

  /** 거리에서 매 프레임(탐험 중일 때) */
  update(dt: number, f: { interact: boolean } | null, live: boolean) {
    const h = this.c.hero;
    if (this.frameRef !== h.frame) { this.frameRef = h.frame; this.placeGates(); }
    this.t += dt;
    const b = h.body;
    let near: Gate | null = null;
    for (const g of this.gates) {
      const d = Math.hypot(g.x - b.x, g.y - b.y);
      g.obj.visible = d < 400;
      if (!g.obj.visible) continue;
      if (!g.settled && (g.tryT -= dt) <= 0) { g.tryT = 1; g.settled = this.settle(g); }
      g.z = h.world.terrain(g.x, g.y);
      g.obj.position.set(g.x, g.y, g.z);
      const sw = g.obj.userData.swirl as THREE.Group;
      sw.children.forEach((m, i) => { m.rotation.z = this.t * (1.2 + i * 0.8) * (i % 2 ? -1 : 1); });
      if (d < 3.2 && Math.abs(b.z - g.z) < 2) near = g;
    }
    this.nearGate = live ? near : null;
    if (live && near && f?.interact && !this.busy) { f.interact = false; void this.enter(near.def); }
  }

  // ───────── 안: 방 짓기 ─────────
  private tex(base: string, dark: string, kind: 'brick' | 'bone' | 'chalk' | 'floor') {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256;
    const g = cv.getContext('2d')!;
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    if (kind === 'brick') { g.fillStyle = dark; for (let y = 0; y < 256; y += 32) { g.fillRect(0, y, 256, 3); for (let x = (y / 32) % 2 ? 0 : 32; x < 256; x += 64) g.fillRect(x, y, 3, 32); } }
    if (kind === 'bone') {
      for (let i = 0; i < 90; i++) { const x = Math.random() * 256, y = Math.random() * 256; g.fillStyle = Math.random() < 0.5 ? '#ddd2b8' : dark; g.beginPath(); g.ellipse(x, y, 10 + Math.random() * 8, 4, Math.random() * 3, 0, 7); g.fill(); }
      for (let i = 0; i < 12; i++) { const x = 16 + Math.random() * 224, y = 16 + Math.random() * 224; g.fillStyle = '#e9e0c9'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); g.fillStyle = '#2b251c'; g.beginPath(); g.arc(x - 4, y - 1, 3, 0, 7); g.arc(x + 4, y - 1, 3, 0, 7); g.fill(); }
    }
    if (kind === 'chalk') { for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? dark : '#f4efe3'; g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3); } }
    if (kind === 'floor') { g.fillStyle = dark; for (let i = 0; i < 256; i += 64) { g.fillRect(i, 0, 2, 256); g.fillRect(0, i, 256, 2); } for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; g.fillRect(Math.random() * 256, Math.random() * 256, 4, 4); } }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private build(def: DomainDef) {
    const T = def.theme;
    this.scene.clear();
    this.room = new THREE.Group();
    this.world = new World(new Frame([0, 0]));
    const W = this.world;
    const H = 7; // 보이는 벽 높이
    const wallTex = this.tex(T.wall, T.wall2, T.bones ? 'bone' : T.beams ? 'chalk' : 'brick');
    const floorTex = this.tex(T.floor, T.wall2, 'floor');
    const wallMat = new THREE.MeshLambertMaterial({ map: wallTex });
    wallTex.repeat.set(1, 2);
    const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
    const ceilMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(T.wall2).multiplyScalar(0.55) });
    // 바닥 한 장(방·복도·광장을 덮는다) — 부딪힘 바닥은 World의 땅(0)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 100), floorMat);
    floorTex.repeat.set(12, 20);
    floor.position.set(0, 30, 0);
    this.room.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(60, 100), ceilMat);
    ceil.rotation.x = Math.PI; ceil.position.set(0, 30, H);
    this.room.add(ceil);
    // 벽: 상자(보이는 것 + 부딪힘). 높이 40 — 기어올라 넘어가지 못하게(보이는 건 천장까지)
    // 부딪힘 높이 40(기어올라 넘지 못하게, 보이는 건 천장까지). kind를 비워 두면 건물이 아니라 상승(벽)에서 빠진다
    const box = (x0: number, x1: number, y0: number, y1: number) => {
      const w = x1 - x0, d = y1 - y0;
      const map = wallTex.clone(); map.needsUpdate = true; map.repeat.set(Math.max(w, d) / 4, H / 4);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, H), new THREE.MeshLambertMaterial({ map }));
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, H / 2);
      this.room.add(m);
      return W.addSolid([new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])], -1, 40, undefined, undefined, true);
    };
    // 시작 방 [-8,8]×[-8,8]
    box(-9, 9, -9, -8); box(-9, -8, -8, 8); box(8, 9, -8, 8);
    box(-9, -3, 8, 9); box(3, 9, 8, 9);
    // 문
    const doorMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(T.accent).multiplyScalar(0.5), emissive: new THREE.Color(T.accent).multiplyScalar(0.25) });
    this.doorObj = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, H), doorMat);
    this.doorObj.position.set(0, 8.5, H / 2);
    this.room.add(this.doorObj);
    this.door = W.addSolid([new Float64Array([-3, 8, 3, 8, 3, 9, -3, 9])], -1, 40, undefined, undefined, true);
    // 복도 [-3,3]×[9,40]
    box(-4, -3, 9, 40); box(3, 4, 9, 40);
    // 광장 [-15,15]×[40,70]
    box(-16, -3, 40, 41); box(3, 16, 40, 41);
    box(-16, -15, 41, 70); box(15, 16, 41, 70); box(-16, 16, 70, 71);
    // 기둥 넷(몸을 숨기거나 돌아 피하는 곳)
    for (const [px, py] of [[-8, 48], [8, 48], [-8, 62], [8, 62]]) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, H, 10).rotateX(Math.PI / 2).translate(0, 0, H / 2), wallMat);
      c.position.set(px, py, 0); this.room.add(c);
      W.addSolid([new Float64Array([px - 0.8, py - 0.8, px + 0.8, py - 0.8, px + 0.8, py + 0.8, px - 0.8, py + 0.8])], -1, 40, undefined, undefined, true);
    }
    // 테마 장식
    if (T.water) {
      const water = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 31), new THREE.MeshLambertMaterial({ color: 0x3f6b5e, emissive: 0x0d2a22, transparent: true, opacity: 0.85 }));
      water.position.set(0, 24.5, 0.03); this.room.add(water);
      for (const s of [-1, 1]) { const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 31, 10), new THREE.MeshLambertMaterial({ color: 0x55605a })); pipe.position.set(s * 2.6, 24.5, 5.4); this.room.add(pipe); }
    }
    if (T.beams) {
      const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
      for (let y = 12; y < 40; y += 6) { const b = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 0.4), wood); b.position.set(0, y, H - 0.3); this.room.add(b); for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, H), wood); p.position.set(s * 2.75, y, H / 2); this.room.add(p); } }
    }
    if (T.bones) {
      const bone = new THREE.MeshLambertMaterial({ color: 0xe6dcc4 });
      for (let i = 0; i < 24; i++) { const sk = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), bone); const s = i % 2 ? -1 : 1; sk.position.set(s * 2.8, 11 + i * 1.2, 0.8 + (i % 3) * 0.9); this.room.add(sk); }
    }
    // 횃불(빛나는 점 + 빛)
    const flameMat = new THREE.MeshBasicMaterial({ color: T.light });
    const torches: [number, number][] = [[-7.4, 0], [7.4, 0], [-2.4, 18], [2.4, 30], [-14.4, 55], [14.4, 55], [0, 69.4]];
    for (const [x, y] of torches) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), flameMat); f.position.set(x, y, 3.2); this.room.add(f);
      const L = new THREE.PointLight(T.light, 14, 16, 1.6); L.position.set(x, y, 3.4); this.room.add(L);
    }
    // 시작 방의 돌 받침(F: 도전 시작)
    this.pedestal = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 1.1, 8).rotateX(Math.PI / 2).translate(0, 0, 0.55), new THREE.MeshLambertMaterial({ color: 0x7c7466 }));
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), new THREE.MeshBasicMaterial({ color: T.accent }));
    orb.position.z = 1.55; orb.name = 'orb';
    this.pedestal.add(ped, orb);
    this.pedestal.position.set(0, 3, 0);
    this.room.add(this.pedestal);
    W.addSolid([new Float64Array([-0.6, 2.4, 0.6, 2.4, 0.6, 3.6, -0.6, 3.6])], -1, 1.1, 'prop', undefined, true);
    // 빛
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x2a2622, 0.9), new THREE.AmbientLight(0xffffff, 0.25), this.room);
    this.scene.fog = new THREE.Fog(T.fog, 18, 70);
  }

  // ───────── 들어가기·나가기 ─────────
  private fadeEl(): HTMLElement { let f = document.querySelector('.under-fade') as HTMLElement | null; if (!f) { f = document.createElement('div'); f.className = 'under-fade'; document.body.appendChild(f); } return f; }
  private async fade(on: boolean) { this.fadeEl().classList.toggle('on', on); await new Promise((r) => setTimeout(r, 450)); }

  async enter(def: DomainDef) {
    if (this.active || this.busy) return;
    this.busy = true;
    const h = this.c.hero, b = h.body;
    this.saved = { x: b.x, y: b.y, z: b.z, facing: b.facing };
    sfx.door();
    await this.fade(true);
    this.def = def;
    this.lv = this.levelFor(this.c.progress.ar);
    this.build(def);
    h.sceneWorld = this.world;
    this.c.combat()?.enterZone();
    const cb = this.c.combat(), co = this.c.companion();
    if (cb) this.scene.add(cb.group);
    if (co) { this.scene.add(co.group); co.hush = true; }
    b.place(0, -5, 0); b.mode = 'ground'; b.facing = 0; b.vx = b.vy = b.vz = 0;
    h.cam.snap(b); h.cam.yaw = 0; h.cam.pitch = 12;
    this.phase = 'ready'; this.left = TIME; this.wave = 0; this.arenaIn = false; this.runId++;
    this.exitRing = null;
    this.active = true;
    document.body.classList.add('domain-on', 'underground');
    this.paintHud();
    await this.fade(false);
    this.busy = false;
    const left = Math.max(0, this.rewardsLeft);
    this.c.toast(`${def.emoji} 비경 · ${def.name} (난도 ${ROMAN[this.lv]}) — ${def.blurb}`);
    setTimeout(() => this.lili(left ? `여기가 비경이야! 가운데 돌 받침에서 F를 누르면 도전이 시작돼. 제한 시간 ${TIME / 60}분, 빨리 끝낼수록 별이 많아!` : '오늘 비경 보상은 다 받았어. 그래도 연습은 할 수 있어!', 7), 900);
  }

  private async leave(msg?: string) {
    if (!this.active || this.busy) return;
    this.busy = true;
    const h = this.c.hero, b = h.body;
    await this.fade(true);
    const cb = this.c.combat(), co = this.c.companion();
    cb?.leaveZone();
    if (cb) h.crowd.scene.add(cb.group);
    if (co) { h.crowd.scene.add(co.group); co.hush = false; }
    h.sceneWorld = null;
    h.figure.scene.position.set(0, 0, 0);
    h.figure.scene.updateMatrixWorld(true);
    const s = this.saved;
    if (s) {
      // 입구 앞 한 걸음 뒤로
      const g = this.gates.find((q) => q.def === this.def);
      const bx = g ? g.x + (s.x - g.x) * 1.4 : s.x, by = g ? g.y + (s.y - g.y) * 1.4 : s.y;
      b.place(bx, by, h.world.ground(bx, by, s.z + 1, 1.5)); b.facing = s.facing; b.mode = 'ground'; b.vx = b.vy = b.vz = 0;
    }
    h.cam.snap(b);
    this.active = false;
    this.def = null;
    this.hud.classList.remove('on');
    document.body.classList.remove('domain-on', 'underground');
    h.hud.setPrompt(null);
    this.scene.clear();
    await this.fade(false);
    this.busy = false;
    if (msg) this.c.toast(msg);
  }

  /** 쓰러졌다(싸움이 부른다) */
  async fail(why: 'down' | 'time') {
    if (!this.active) return;
    this.phase = 'out';
    sfx.exhausted();
    await this.leave(why === 'time' ? '⌛ 시간이 다 됐다 — 비경에서 밀려났다. 다시 도전해 보자' : '💫 비경에서 쓰러졌다 — 입구 앞에서 정신을 차렸다');
  }

  /** 리리의 말(비경 안에선 거리 말풍선 층을 숨기니 아래 한 줄로) */
  private liliT: ReturnType<typeof setTimeout> | null = null;
  private lili(text: string, secs = 4.5) {
    if (!this.active) return;
    this.c.hint(`🧚 리리: ${text}`);
    sfx.pop();
    if (this.liliT) clearTimeout(this.liliT);
    this.liliT = setTimeout(() => this.c.hint(''), secs * 1000);
  }

  // ───────── 진행 ─────────
  private start() {
    if (this.phase !== 'ready') return;
    this.phase = 'run';
    this.left = TIME;
    sfx.questStart();
    // 문이 열린다
    if (this.door) { this.world.removeSolid(this.door); this.door = null; }
    const d = this.doorObj;
    if (d) { const t0 = performance.now(); const up = () => { const k = Math.min(1, (performance.now() - t0) / 900); d.position.z = 3.5 - k * 7.2; if (k < 1 && this.active) requestAnimationFrame(up); }; up(); }
    const orb = this.pedestal?.getObjectByName('orb');
    if (orb) orb.visible = false;
    this.lili('문이 열렸어! 복도 끝 광장으로 가자!', 4);
  }
  private spawnWave() {
    const def = this.def!;
    const kinds = def.waves(this.lv)[this.wave];
    this.waveKey = `dom:${this.runId}:${this.wave}`;
    this.c.combat()?.spawnCamp(this.waveKey, 0, 58, 0, 0.3 + this.wave * 0.21, kinds);
    sfx.bark();
    this.c.toast(`⚔️ 물결 ${this.wave + 1}/3 — ${kinds.length}마리`);
  }
  /** 싸움이 알려 준다: 물결 하나를 다 물리쳤다 */
  cleared(key: string) {
    if (!this.active || key !== this.waveKey || this.phase !== 'run') return;
    this.wave++;
    if (this.wave < 3) { setTimeout(() => { if (this.active && this.phase === 'run') this.spawnWave(); }, 1600); this.lili(this.wave === 2 ? '마지막 물결이야! 힘내!' : '좋아, 다음이 온다!', 3); return; }
    this.win();
  }
  private win() {
    this.phase = 'clear';
    const def = this.def!, P = this.c.progress;
    const used = TIME - this.left;
    const stars = this.left >= 120 ? 3 : this.left >= 60 ? 2 : 1;
    const best = Math.max(this.clears.best[def.id] ?? 0, stars);
    this.clears.best[def.id] = best;
    let msg = `🏆 비경 클리어! ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${Math.floor(used / 60)}분 ${Math.round(used % 60)}초`;
    if (this.rewardsLeft > 0) {
      this.clears.n++;
      const st = (20 + stars * 10) * this.lv, eur = 8 * this.lv + stars * 3, xp = Math.round((120 + stars * 40) * this.lv * this.c.xpMul());
      P.stars += st; this.c.money(eur); P.addXp(xp, `비경 · ${def.name}`);
      msg += ` — ⭐${st} · €${eur} · 경험치 ${xp} (오늘 ${this.rewardsLeft}번 남음)`;
    } else msg += ' — 오늘 보상은 이미 다 받았다';
    this.saveClears();
    sfx.fanfare();
    this.c.toast(msg);
    // 나가는 고리
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 8, 40), new THREE.MeshBasicMaterial({ color: def.theme.accent, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.position.set(0, 55, 0.1);
    this.room.add(ring);
    this.exitRing = ring;
    this.lili(stars === 3 ? '별 셋! 완벽했어!' : '해냈다! 가운데 빛나는 고리에서 F를 누르면 나갈 수 있어.', 5);
  }

  private paintHud() {
    const def = this.def;
    if (!def) return;
    const m = Math.floor(Math.max(0, this.left) / 60), s = Math.floor(Math.max(0, this.left) % 60);
    const star = this.left >= 120 ? 3 : this.left >= 60 ? 2 : 1;
    const phase = this.phase === 'ready' ? '돌 받침에서 F — 도전 시작' : this.phase === 'run' ? (this.arenaIn ? `물결 ${Math.min(3, this.wave + 1)}/3` : '광장으로') : this.phase === 'clear' ? '클리어! 가운데 고리에서 F — 나가기' : '';
    this.hud.innerHTML = `<b>${def.emoji} ${def.name} <small>난도 ${ROMAN[this.lv]}</small></b><span class="tm ${this.left < 30 && this.phase === 'run' ? 'low' : ''}">⏱ ${m}:${String(s).padStart(2, '0')}</span><span class="st">${'★'.repeat(star)}${'☆'.repeat(3 - star)}</span><small>${phase}</small>`;
    this.hud.classList.add('on');
  }

  /** 비경 안에서 매 프레임(main이 거리 대신 부른다) */
  frame(dt: number) {
    if (!this.active) return;
    const h = this.c.hero, b = h.body;
    const frozen = this.busy || !!document.querySelector('.under-fade.on');
    h.input.enabled = !frozen;
    h.hud.show(true);
    const r = h.tick(dt, { waypoint: null, frozen, pace: 1, maxStamina: 1, beacon: null });
    for (const e of h.events) {
      if (e === 'stepL' || e === 'stepR') sfx.step(e === 'stepL', 'stone');
      else if (e === 'jump') sfx.jump();
      else if (e === 'land') sfx.land();
      else if (e === 'roll' || e === 'rollLand') sfx.roll();
      else if (e === 'mantle') sfx.mantle();
    }
    this.t += dt;
    // 할 일
    this.prompt = null;
    if (this.phase === 'ready' && Math.hypot(b.x - 0, b.y - 3) < 2.4) this.prompt = { verb: '도전 시작', what: `⏱ ${TIME / 60}분 · 물결 셋`, act: () => this.start() };
    if (this.phase === 'clear' && Math.hypot(b.x, b.y - 55) < 2.4) this.prompt = { verb: '나가기', what: `${this.def!.emoji} 비경 밖으로`, act: () => void this.leave() };
    if (this.phase === 'ready' && b.y < -2 && Math.hypot(b.x, b.y + 7) < 2) this.prompt = { verb: '나가기', what: '도전하지 않고 밖으로', act: () => void this.leave() };
    if (r.f.interact && this.prompt && !frozen) { r.f.interact = false; this.prompt.act(); }
    h.hud.override = null; // 거리의 안내(입구 앞 '비경 들어가기')가 남지 않게
    h.hud.setPrompt(this.prompt ? { verb: this.prompt.verb, what: this.prompt.what } : null);
    h.hud.setPrompt2(null);
    if (this.phase === 'run') {
      this.left -= dt;
      if (!this.arenaIn && b.y > 42) { this.arenaIn = true; this.spawnWave(); }
      if (this.left <= 0) void this.fail('time');
    }
    const orb = this.pedestal?.getObjectByName('orb');
    if (orb) { orb.position.z = 1.55 + Math.sin(this.t * 2) * 0.1; orb.rotation.z = this.t; }
    if (this.exitRing) { this.exitRing.rotation.z = this.t * 1.5; this.exitRing.scale.setScalar(1 + Math.sin(this.t * 4) * 0.06); }
    // 싸움·리리
    this.c.combat()?.update(dt, r.f, !frozen && this.phase !== 'out');
    this.c.companion()?.update(dt, true);
    this.paintHud();
    // 카메라
    const shot = h.sceneShot(dt);
    const br = (shot.bearing * Math.PI) / 180, el = ((shot.pitch - 90) * Math.PI) / 180;
    this.camera.position.set(shot.x, shot.y, shot.z);
    this.camera.lookAt(shot.x + Math.sin(br) * Math.cos(el), shot.y + Math.cos(br) * Math.cos(el), shot.z + Math.sin(el));
    h.view.renderWith(this.camera, [this.scene], { scene: h.figure.scene, x: b.x, y: b.y, z: b.z, visible: true }, this.def?.theme.fog ?? 0x111111);
    const v = new THREE.Vector3(b.x, b.y, b.z + 1.5).project(this.camera);
    h.hud.anchor(((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight, v.z < 1);
  }
}
