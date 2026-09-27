// 탐험(원신처럼): 순간이동 포인트 · 잔 다르크 성상(바람 깃털을 바쳐 기력을 키운다) · 바람 깃털 · 보물상자 ·
// 검은 고양이(따라가면 상자) · 빛 구슬 도전(시간 안에 모으면 상자).
// 상자·깃털 자리는 경위도 칸(약 180 m)마다 해시로 정한다 — 어느 판이든 같은 자리, 한 번 연 것은 다시 나오지 않는다.
import * as THREE from 'three';
import type { Hero } from './hero';
import type { LngLat } from './graph';
import type { Frame as InputFrame } from './hero/input';
import { LANDMARKS } from './town/landmarks';
import { DISTRICTS } from './districts';
import type { Progress } from './progress';
import * as sfx from './sound';
import { inRing, ringOf, type Ring } from './hero/terrain';

export interface ExploreCtx {
  hero: Hero;
  progress: Progress;
  toast(s: string): void;
  hint(s: string): void;
  money(eur: number): void;
  /** 순간이동 포인트를 켜면 둘레 장소를 지도에 드러낸다 — 드러낸 수 */
  revealNear(pos: LngLat, r: number): number;
  /** XP 배율(실크해트 등) */
  xpMul(): number;
  /** 요괴 야영지를 세운다(싸움) */
  camp?(key: string, x: number, y: number, z: number, seed: number, only?: ('slime' | 'rat' | 'gargoyle')[]): void;
  /** 여기엔 요괴 야영지를 세우지 않는다(첫걸음 동안 에펠탑 둘레 — 튜토리얼 야영지 하나에만 집중하게) */
  calm?(x: number, y: number): boolean;
}

const TAU = Math.PI * 2;
const M_LAT = 111130;
const mLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);
/** 랜드마크 좌표(u = 주축, v = 왼쪽, m) → 경위도 */
export function lmPoint(id: string, u: number, v: number): LngLat {
  const L = LANDMARKS.find((l) => l.id === id)!;
  const rot = ((90 - L.bearing) * Math.PI) / 180;
  const dx = u * Math.cos(rot) - v * Math.sin(rot), dy = u * Math.sin(rot) + v * Math.cos(rot);
  return [L.pos[0] + dx / mLng(L.pos[1]), L.pos[1] + dy / M_LAT];
}

export interface Waypoint { id: string; name: string; pos: LngLat; statue?: boolean }
export const WAYPOINTS: Waypoint[] = [
  { id: 'wp-eiffel', name: '샹드마르스(에펠탑)', pos: lmPoint('eiffel', 0, -140) },
  { id: 'wp-trocadero', name: '트로카데로', pos: [2.28800, 48.86210] },
  { id: 'wp-arc', name: '개선문', pos: lmPoint('arc', -30, -45) },
  { id: 'wp-louvre', name: '루브르 나폴레옹 안뜰', pos: lmPoint('louvre', -90, 0) },
  { id: 'wp-jeanne', name: '잔 다르크 성상', pos: [2.33264, 48.86331], statue: true },
  { id: 'wp-notre-dame', name: '노트르담 앞 광장', pos: lmPoint('notre-dame', -125, -20) },
  { id: 'wp-sacre-coeur', name: '사크레쾨르 앞마당', pos: lmPoint('sacre-coeur', -30, -22) },
  { id: 'wp-pompidou', name: '퐁피두 광장', pos: lmPoint('pompidou', 0, 58) },
  { id: 'wp-pantheon', name: '팡테옹 앞', pos: lmPoint('pantheon', -62, 0) },
  { id: 'wp-marais', name: '마레', pos: DISTRICTS['marais'].start },
  { id: 'wp-saint-germain', name: '생제르맹', pos: DISTRICTS['saint-germain'].start },
  { id: 'wp-montmartre', name: '몽마르트르', pos: DISTRICTS['montmartre'].start },
  { id: 'wp-belleville', name: '벨빌', pos: DISTRICTS['belleville'].start },
  { id: 'wp-champs', name: '샹젤리제', pos: DISTRICTS['champs-elysees'].start },
];

/** 바람 깃털: 랜드마크 위 높은 곳(dz 없으면 그 자리에서 가장 높은 곳) */
const PLUMES: [string, number, number, number?][] = [
  ['eiffel', 0, 0, 58], ['eiffel', 0, 0, 115], ['eiffel', 0, 0], ['arc', 0, 6], ['notre-dame', -51.5, 14], ['notre-dame', -54, 0, 46], ['notre-dame', 12, 0],
  ['sacre-coeur', 10, 0], ['sacre-coeur', 44, 0], ['louvre', 0, 0], ['louvre', 72, 0], ['louvre', -70, 92], ['pompidou', 0, 0], ['pantheon', 0, 0],
  ['montparnasse', 0, 0], ['saint-jacques', 0, 0], ['grand-palais', 0, 0], ['hotel-de-ville', 0, 0], ['chaillot', 0, 0], ['saint-germain-des-pres', 0, 0],
];
/** 호화 상자: 랜드마크 꼭대기 */
const LUX: [string, number, number, number?][] = [['eiffel', 2, 2], ['notre-dame', -51.5, -14], ['sacre-coeur', 12, 3], ['arc', 0, -8]];

type Tier = 'common' | 'exquisite' | 'precious' | 'luxurious';
const TIER: Record<Tier, { name: string; xp: number; stars: number; eur: number; body: number; trim: number }> = {
  common: { name: '평범한 보물상자', xp: 20, stars: 2, eur: 3, body: 0x8a5a33, trim: 0x6b6f75 },
  exquisite: { name: '정교한 보물상자', xp: 40, stars: 5, eur: 8, body: 0x6f86a8, trim: 0xd7dde6 },
  precious: { name: '진귀한 보물상자', xp: 80, stars: 10, eur: 15, body: 0xc9982f, trim: 0x7a3b8f },
  luxurious: { name: '화려한 보물상자', xp: 150, stars: 40, eur: 30, body: 0xe8c14e, trim: 0xb3262c },
};

interface Ent {
  key: string;
  kind: 'chest' | 'plume' | 'waypoint' | 'cat' | 'challenge' | 'orb';
  x: number; y: number; z: number;
  obj: THREE.Object3D;
  tier?: Tier;
  wp?: Waypoint;
  opened?: number; // 연 뒤 흐른 초
  locked?: boolean; // 요괴 야영지가 지키는 상자(다 물리치면 풀린다)
  path?: [number, number, number][]; hop?: number; // 고양이
  cell?: string;
}

const hash = (a: number, b: number, s = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const CLAT = 0.0016, CLNG = 0.0024; // 약 178 × 176 m

export class Explore {
  private readonly c: ExploreCtx;
  readonly group = new THREE.Group();
  private ents: Ent[] = [];
  private cells = new Map<string, { t: number; done: boolean }>();
  private frameRef: unknown = null;
  private t = 0;
  private scanT = 0;
  private near: Ent | null = null;
  private challenge: { ent: Ent; orbs: Ent[]; t: number; got: number } | null = null;
  private burst: { pts: THREE.Points; vel: Float32Array; t: number }[] = [];
  private readonly mats = new Map<number, THREE.MeshToonMaterial>();

  constructor(c: ExploreCtx) {
    this.c = c;
    this.group.name = 'explore';
  }

  private mat(color: number, emissive = 0) {
    const k = color * 7 + emissive;
    let m = this.mats.get(k);
    if (!m) { m = new THREE.MeshToonMaterial({ color, emissive }); this.mats.set(k, m); }
    return m;
  }

  private get hero() { return this.c.hero; }
  private get P() { return this.c.progress; }

  // ───────── 자리 ─────────
  private lmGround(id: string) { return this.hero.town.landmarks.find((l) => l.id === id); }
  /** 경위도의 그 자리 땅(가장 높은 곳이 아니라 바닥)에 선 로컬 좌표 */
  /** 경위도의 그 자리에서 딛고 설 면(땅 위 40 m 안에서 가장 높은 곳 — 사크레쾨르 앞마당 같은 단 위) */
  private at(p: LngLat): [number, number, number] {
    const [x, y] = this.hero.frame.toLocal(p);
    const w = this.hero.world, g = w.terrain(x, y);
    return [x, y, w.ground(x, y, g + 40, 0)];
  }
  private lmAt(id: string, u: number, v: number, dz?: number): [number, number, number] | null {
    const L = this.lmGround(id);
    if (!L) return null;
    const [x, y] = this.hero.frame.toLocal(lmPoint(id, u, v));
    const w = this.hero.world;
    const z = dz === undefined ? w.ground(x, y, 1e4, 1e4) : w.ground(x, y, L.z + dz + 0.3, 0.8);
    return [x, y, z];
  }

  /** 원점이 바뀌면(동네 이동) 모두 다시 세운다 */
  /** 고정해 둔 것(프롤로그의 상자·야영지) — 원점이 바뀌어도 다시 세운다 */
  private fixed: { key: string; pos: LngLat; kind: 'chest' | 'camp'; tier: Tier }[] = [];
  addFixed(key: string, pos: LngLat, kind: 'chest' | 'camp', tier: Tier = 'common') {
    if (this.fixed.some((f) => f.key === key)) return;
    this.fixed.push({ key, pos, kind, tier });
    this.frameRef = null; // 다음 프레임에 다시 세운다
  }
  private placeFixed() {
    for (const f of this.fixed) {
      if (this.P.chests.has(f.key)) continue;
      const [x, y, z] = this.at(f.pos);
      const e = this.add({ key: f.key, kind: 'chest', tier: f.tier, x, y, z, obj: this.chestModel(f.tier), locked: f.kind === 'camp' });
      if (f.kind === 'camp') { this.seal(e, true); this.c.camp?.(f.key, x, y, z, 0.1, ['slime', 'slime']); }
    }
  }

  private rebuild() {
    for (const e of this.ents) this.group.remove(e.obj);
    this.ents = [];
    this.cells.clear();
    this.challenge = null;
    const P = this.P;
    this.placeFixed();
    for (const wp of WAYPOINTS) {
      const [x, y, z] = this.at(wp.pos);
      if (Math.hypot(x, y) > 9000) continue;
      const obj = wp.statue ? this.statueModel() : this.waypointModel();
      this.add({ key: wp.id, kind: 'waypoint', x, y, z, obj, wp });
      this.paintWaypoint(this.ents[this.ents.length - 1], P.waypoints.has(wp.id));
    }
    PLUMES.forEach(([id, u, v, dz], i) => {
      const key = `p:${id}:${i}`;
      if (P.plumesGot.has(key)) return;
      const p = this.lmAt(id, u, v, dz);
      if (p) this.add({ key, kind: 'plume', x: p[0], y: p[1], z: p[2], obj: this.plumeModel() });
    });
    LUX.forEach(([id, u, v, dz], i) => {
      const key = `L:${id}:${i}`;
      if (P.chests.has(key)) return;
      const p = this.lmAt(id, u, v, dz);
      if (p) this.add({ key, kind: 'chest', tier: 'luxurious', x: p[0], y: p[1], z: p[2], obj: this.chestModel('luxurious') });
    });
  }

  private add(e: Ent) {
    e.obj.position.set(e.x, e.y, e.z);
    this.group.add(e.obj);
    this.ents.push(e);
    return e;
  }
  private drop(e: Ent) { this.group.remove(e.obj); this.ents = this.ents.filter((q) => q !== e); }

  // ───────── 칸마다 상자·고양이·도전·깃털 ─────────
  private scanCells() {
    const b = this.hero.body;
    const [lng, lat] = this.hero.frame.toLngLat(b.x, b.y);
    const ix0 = Math.floor(lng / CLNG), iy0 = Math.floor(lat / CLAT);
    for (let ix = ix0 - 1; ix <= ix0 + 1; ix++) for (let iy = iy0 - 1; iy <= iy0 + 1; iy++) {
      const key = `${ix}:${iy}`;
      const st = this.cells.get(key);
      if (st && (st.done || this.t - st.t < 5)) continue;
      const done = this.genCell(ix, iy);
      this.cells.set(key, { t: this.t, done });
    }
  }

  /** 칸 하나를 채운다. 자료(길·건물)가 아직 없으면 false — 나중에 다시 */
  private genCell(ix: number, iy: number): boolean {
    const key = `c:${ix}:${iy}`;
    const r = hash(ix, iy, 1);
    const kind = r < 0.38 ? 'common' : r < 0.5 ? 'camp' : r < 0.68 ? 'roof' : r < 0.77 ? 'cat' : r < 0.84 ? 'challenge' : r < 0.93 ? 'plume' : null;
    if (!kind) return true;
    if (kind === 'plume' ? this.P.plumesGot.has(key) : this.P.chests.has(key)) return true;
    const w = this.hero.world;
    const [cx, cy] = this.hero.frame.toLocal([(ix + 0.5) * CLNG, (iy + 0.5) * CLAT]);
    if (Math.hypot(cx - this.hero.body.x, cy - this.hero.body.y) > 320) return false;
    if (w.laneDist(cx, cy, 120) >= 120) return false; // 아직 길을 모른다
    if (kind === 'roof' || kind === 'plume') {
      const roofs = w.near(cx, cy, 80).filter((s) => s.kind === 'building' && s.top - w.terrain((s.minX + s.maxX) / 2, (s.minY + s.maxY) / 2) > (kind === 'plume' ? 16 : 9) && s.maxX - s.minX > 6 && s.maxY - s.minY > 6);
      if (!roofs.length) return false;
      for (let k = 0; k < Math.min(6, roofs.length); k++) {
        const s = roofs[Math.floor(hash(ix, iy, 10 + k) * roofs.length)];
        const x = (s.minX + s.maxX) / 2, y = (s.minY + s.maxY) / 2;
        const z = w.ground(x, y, s.top + 0.5, 0.6);
        if (z < s.top - 0.2) continue; // 가운데가 안뜰이면
        if (kind === 'plume') this.add({ key, kind: 'plume', x, y, z, obj: this.plumeModel(), cell: key });
        else this.add({ key, kind: 'chest', tier: 'exquisite', x, y, z, obj: this.chestModel('exquisite'), cell: key });
        return true;
      }
      return false;
    }
    if (kind === 'camp' && this.c.calm?.(cx, cy)) return false; // 5초마다 다시 본다 — 첫걸음을 마치면 세운다
    const campSpot = kind === 'camp' ? this.groundSpot(cx, cy, ix, iy, 85, true) : null;
    const spot = campSpot ?? this.groundSpot(cx, cy, ix, iy, 70);
    if (!spot) return false;
    const [x, y, z] = spot;
    if (kind === 'common') { this.add({ key, kind: 'chest', tier: 'common', x, y, z, obj: this.chestModel('common'), cell: key }); return true; }
    if (kind === 'camp' && !campSpot) { this.add({ key, kind: 'chest', tier: 'common', x, y, z, obj: this.chestModel('common'), cell: key }); return true; } // 싸울 만한 자리가 없으면 그냥 상자
    if (kind === 'camp') {
      // 요괴 야영지: 봉인된 상자를 셋이 지킨다
      const tier: Tier = hash(ix, iy, 9) < 0.35 ? 'precious' : 'exquisite';
      const e = this.add({ key, kind: 'chest', tier, x, y, z, obj: this.chestModel(tier), cell: key, locked: true });
      this.seal(e, true);
      this.c.camp?.(key, x, y, z, hash(ix, iy, 11));
      return true;
    }
    if (kind === 'challenge') { this.add({ key, kind: 'challenge', x, y, z, obj: this.pedestalModel(), cell: key }); return true; }
    // 고양이: 이 자리에서 기다렸다가, 가까이 가면 상자 있는 데까지 세 번 뛰어 데려간다
    const end = this.groundSpot(cx + (hash(ix, iy, 5) - 0.5) * 120, cy + (hash(ix, iy, 6) - 0.5) * 120, ix, iy + 7, 60);
    if (!end || Math.hypot(end[0] - x, end[1] - y) < 30) return false;
    const path: [number, number, number][] = [[x, y, z]];
    for (let k = 1; k <= 3; k++) {
      const t = k / 3, px = x + (end[0] - x) * t + (k < 3 ? (hash(ix, iy, 20 + k) - 0.5) * 16 : 0), py = y + (end[1] - y) * t + (k < 3 ? (hash(ix, iy, 30 + k) - 0.5) * 16 : 0);
      path.push([px, py, k === 3 ? end[2] : w.ground(px, py, w.terrain(px, py) + 0.5, 0.6)]);
    }
    this.add({ key, kind: 'cat', x, y, z, obj: this.catModel(), path, hop: 0, cell: key });
    return true;
  }

  /** 걸어갈 수 있는 바닥(물·건물 아님, 길에서 2~9 m) */
  private greenCache: { src: unknown; n: number; rings: Ring[] } = { src: null, n: -1, rings: [] };
  /** 공원·잔디 고리(바운딩 박스와 함께, 늘어나면 다시) */
  private greens(): Ring[] {
    const g = this.hero.world.greens, C = this.greenCache;
    if (C.src !== g || C.n !== g.length) this.greenCache = { src: g, n: g.length, rings: g.map((r) => ringOf(r)) };
    return this.greenCache.rings;
  }
  private groundSpot(cx: number, cy: number, ix: number, iy: number, R: number, camp = false): [number, number, number] | null {
    const w = this.hero.world;
    // 야영지: 먼저 공원·잔디 안에서, 없으면 길에서 떨어진 탁 트인 곳(사람 다니는 보도 한가운데는 피한다)
    for (let pass = camp ? 0 : 2; pass < (camp ? 2 : 3); pass++) for (let k = 0; k < 24; k++) {
      const a = hash(ix, iy, 100 + k) * TAU, r = Math.sqrt(hash(ix, iy, 200 + k)) * R;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (w.water(x, y)) continue;
      const g = w.terrain(x, y);
      if (w.ground(x, y, g + 3, 0) > g + 0.3) continue; // 무언가 위(지붕·가구)
      if (w.near(x, y, 0.9).some((s) => s.base < g + 2 && s.top > g + 0.3 && Math.max(s.minX - x, x - s.maxX, s.minY - y, y - s.maxY) < 0.9)) continue;
      const ld = w.laneDist(x, y, 30);
      if (pass === 0 && !this.greens().some((r) => inRing(r, x, y))) continue;
      if (pass === 1 && (ld < 8 || ld > 28 || w.near(x, y, 5).some((s) => s.kind === 'building' && s.top > g + 1 && Math.max(s.minX - x, x - s.maxX, s.minY - y, y - s.maxY) < 5))) continue;
      if (pass === 2 && (ld < 2 || ld > 9)) continue;
      if (this.ents.some((e) => Math.hypot(e.x - x, e.y - y) < 12)) continue;
      return [x, y, g];
    }
    return null;
  }

  // ───────── 모형 ─────────
  private chestModel(tier: Tier) {
    const T = TIER[tier];
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.5).translate(0, 0, 0.25), this.mat(T.body));
    const lid = new THREE.Group();
    lid.position.set(0, -0.3, 0.5);
    const lidM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0.3, 0), this.mat(T.body));
    lid.add(lidM);
    for (const sx of [-0.33, 0.33]) { base.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.52).translate(sx, 0, 0.26), this.mat(T.trim))); lid.add(new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(sx, 0.3, 0), this.mat(T.trim))); }
    base.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.2).translate(0, 0.31, 0.42), this.mat(0xe8c14e, 0x3a2a00)));
    g.add(base, lid);
    g.userData.lid = lid;
    // 반짝임(원신 상자처럼 멀리서도 보이게)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: tier === 'common' ? 0xfff0c0 : tier === 'exquisite' ? 0xcfe6ff : 0xffd966, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.2); glow.position.z = 0.6;
    g.add(glow);
    g.userData.glow = glow;
    return g;
  }
  private plumeModel() {
    const g = new THREE.Group();
    const q = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 6).rotateX(Math.PI / 2).translate(0, 0, 0.45), this.mat(0x7fe3c8, 0x1f6b5a));
    const vane = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8).scale(0.35, 0.12, 1.3).translate(0, 0, 0.55), this.mat(0xb8f5e4, 0x2a8a73));
    const inner = new THREE.Group(); inner.add(q, vane); inner.rotation.y = 0.35;
    inner.position.z = 1.0;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x7fffd4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.4); glow.position.z = 1.4;
    g.add(inner, glow);
    g.userData.spin = inner;
    return g;
  }
  private waypointModel() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0, 0.25), this.mat(0x8c8f96)));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 2.4, 6).rotateX(Math.PI / 2).translate(0, 0, 1.7), this.mat(0x9aa0a8)));
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.45).scale(1, 1, 1.6), this.mat(0x9aa0a8));
    gem.position.z = 3.8;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 32), this.mat(0x9aa0a8));
    ring.position.z = 3.8;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x6fe3ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(4); glow.position.z = 3.8;
    g.add(gem, ring, glow);
    g.userData = { gem, ring, glow };
    return g;
  }
  private paintWaypoint(e: Ent, on: boolean) {
    const u = e.obj.userData as { gem?: THREE.Mesh; ring?: THREE.Mesh; glow?: THREE.Sprite };
    if (!u.gem) return;
    u.gem.material = on ? this.mat(0x6fe3ff, 0x1a7fa8) : this.mat(0x9aa0a8);
    u.ring!.material = on ? this.mat(0xe8f8ff, 0x3a8fb0) : this.mat(0x9aa0a8);
    u.glow!.visible = on;
  }
  private statueModel() {
    // 잔 다르크(피라미드 광장): 돌 받침 위 금빛 말 탄 사람과 깃발
    const g = new THREE.Group();
    const gold = this.mat(0xe0b44a, 0x3a2800);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(2.4, 4.2, 3.2).translate(0, 0, 1.6), this.mat(0xd8cfbf)));
    const horse = new THREE.Group(); horse.position.z = 3.2; g.add(horse);
    horse.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.6, 4, 10).rotateX(Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0, 1.3), gold));
    for (const [lx, ly] of [[-0.3, 0.7], [0.3, 0.7], [-0.3, -0.7], [0.3, -0.7]]) horse.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 1.1, 6).rotateX(Math.PI / 2).translate(lx, ly, 0.55), gold));
    horse.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 8).rotateX(0.9).translate(0, 1.3, 1.9), gold));
    horse.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.7, 4, 8).rotateX(Math.PI / 2).translate(0, 0.1, 2.3), gold));
    horse.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 0.1, 3.0), gold));
    horse.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6).rotateX(Math.PI / 2).translate(0.35, 0.3, 3.3), gold));
    horse.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.6).translate(0.35, 0.75, 4.5), gold));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd98a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    glow.scale.setScalar(7); glow.position.z = 5.4;
    g.add(glow);
    return g;
  }
  private catModel() {
    const g = new THREE.Group();
    const inner = new THREE.Group(); g.add(inner);
    const fur = this.mat(0x1b1b22), eye = this.mat(0xffe066, 0xc9a200);
    inner.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 4, 8).rotateX(Math.PI / 2).rotateX(Math.PI / 2), fur));
    const head = new THREE.Group(); head.position.set(0, 0.3, 0.14); inner.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), fur));
    for (const sx of [-1, 1]) { head.add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4).rotateX(Math.PI / 2).translate(sx * 0.08, -0.02, 0.15), fur)); head.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6).translate(sx * 0.06, 0.12, 0.03), eye)); }
    inner.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.5, 6).rotateX(-0.6).translate(0, -0.35, 0.25), fur));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xb89cff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.8);
    inner.add(glow);
    inner.position.z = 1.1;
    g.userData.inner = inner;
    return g;
  }
  private pedestalModel() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.2, 6).rotateX(Math.PI / 2).translate(0, 0, 0.6), this.mat(0xb8b0a0)));
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), this.mat(0xffd966, 0x8a6a00));
    orb.position.z = 1.55;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe08a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(2.4); glow.position.z = 1.55;
    g.add(orb, glow);
    g.userData.orb = orb;
    return g;
  }
  private orbModel() {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), this.mat(0xfff2b0, 0xb89a20));
    s.position.z = 1.1;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(1.6); glow.position.z = 1.1;
    g.add(s, glow);
    return g;
  }

  // ───────── 매 프레임 ─────────
  /** 가까운 것과 E. 누른 E를 여기서 썼으면 true */
  update(dt: number, f: InputFrame | null, live: boolean): boolean {
    this.t += dt;
    if (this.frameRef !== this.hero.frame) { this.frameRef = this.hero.frame; this.rebuild(); }
    if (!live) return false;
    this.scanT -= dt;
    if (this.scanT < 0) { this.scanT = 0.7; this.scanCells(); }
    const b = this.hero.body, P = this.P, t = this.t;
    let near: Ent | null = null, nd = Infinity;
    for (const e of this.ents.slice()) {
      const d = Math.hypot(e.x - b.x, e.y - b.y), dz = b.z - e.z;
      if (d > 260) { e.obj.visible = false; continue; }
      e.obj.visible = true;
      switch (e.kind) {
        case 'plume': {
          const u = e.obj.userData as { spin: THREE.Object3D };
          u.spin.rotation.z = t * 1.6; u.spin.position.z = 1.0 + Math.sin(t * 2 + e.x) * 0.15;
          if (d < 1.4 && dz > -0.8 && dz < 2.2) this.takePlume(e);
          break;
        }
        case 'waypoint': {
          const u = e.obj.userData as { gem?: THREE.Object3D; ring?: THREE.Object3D };
          if (u.gem) { u.gem.rotation.z = t * 0.8; u.gem.position.z = 3.8 + Math.sin(t * 1.5) * 0.12; u.ring!.rotation.x = t * 0.9; u.ring!.rotation.y = t * 0.6; }
          if (d < 9 && Math.abs(dz) < 6 && !P.waypoints.has(e.wp!.id)) this.activate(e); // 원신처럼 넉넉히(단 위·계단 옆에 서도 켜진다)
          if (e.wp!.statue && d < 5 && Math.abs(dz) < 4 && d < nd) { near = e; nd = d; }
          break;
        }
        case 'chest': {
          const u = e.obj.userData as { lid: THREE.Object3D; glow: THREE.Sprite };
          if (e.opened !== undefined) {
            e.opened += dt;
            u.lid.rotation.x = -Math.min(1.9, e.opened * 4);
            u.glow.material.opacity = Math.max(0, 1 - e.opened / 2);
            if (e.opened > 4) this.drop(e);
            break;
          }
          u.glow.material.opacity = 0.55 + 0.35 * Math.sin(t * 3 + e.x);
          if (d < 2.2 && Math.abs(dz) < 1.6 && d < nd) { near = e; nd = d; }
          if (e.locked) { const s = e.obj.userData.seal as THREE.Object3D | undefined; if (s) s.rotation.z = t * 1.5; }
          break;
        }
        case 'cat': this.stepCat(e, d, dt); break;
        case 'challenge': {
          const u = e.obj.userData as { orb: THREE.Object3D };
          u.orb.position.z = 1.55 + Math.sin(t * 2) * 0.1; u.orb.rotation.z = t;
          if (!this.challenge && d < 2.4 && Math.abs(dz) < 1.6 && d < nd) { near = e; nd = d; }
          break;
        }
        case 'orb': e.obj.position.z = e.z + Math.sin(t * 3 + e.x) * 0.15; break;
      }
    }
    this.stepChallenge(dt);
    this.stepBursts(dt);
    this.near = near;
    if (near && f?.interact) { f.interact = false; this.use(near); return true; }
    return false;
  }

  /** 행동 안내(거리의 안내보다 앞선다) */
  prompt(): { verb: string; what: string } | null {
    const e = this.near;
    if (!e) return null;
    if (e.kind === 'chest') return e.locked ? { verb: '🔒 봉인됨', what: '둘레의 요괴를 모두 물리치자' } : { verb: '열기', what: `🎁 ${TIER[e.tier!].name}` };
    if (e.kind === 'challenge') return { verb: '도전 시작', what: '⏱ 빛 구슬 모으기' };
    if (e.kind === 'waypoint') return { verb: this.P.plumes ? `바람 깃털 바치기 (${this.P.plumes})` : '성상에 기도하기', what: '🗽 잔 다르크 성상' };
    return null;
  }

  private use(e: Ent) {
    if (e.kind === 'chest') { if (e.locked) { this.c.hint('🔒 봉인된 상자 — 둘레의 요괴를 모두 물리치면 열린다'); setTimeout(() => this.c.hint(''), 2500); sfx.exhausted(); } else this.open(e); }
    else if (e.kind === 'challenge') this.startChallenge(e);
    else if (e.kind === 'waypoint') this.offer();
  }

  private reward(xp: number, stars: number, eur: number, why: string) {
    const P = this.P;
    const gx = Math.round(xp * this.c.xpMul());
    P.stars += stars;
    if (eur) this.c.money(eur);
    P.addXp(gx, why);
    return `${stars ? `⭐ +${stars}` : ''}${eur ? ` · € +${eur}` : ''} · 모험 경험치 +${gx}`;
  }

  private open(e: Ent) {
    const T = TIER[e.tier!];
    e.opened = 0;
    this.P.chests.add(e.key);
    sfx.chime(); setTimeout(() => sfx.coin(), 250);
    this.spawnBurst(e.x, e.y, e.z + 0.7, e.tier === 'common' ? 0xfff0c0 : 0xffd966);
    this.c.toast(`🎁 ${T.name} — ${this.reward(T.xp, T.stars, T.eur, T.name)}`);
    this.P.bump('chest');
  }

  private takePlume(e: Ent) {
    this.drop(e);
    this.P.plumesGot.add(e.key);
    this.P.plumes++;
    sfx.flutter(); sfx.chime();
    this.spawnBurst(e.x, e.y, e.z + 1, 0x7fffd4);
    this.c.toast(`🪶 바람 깃털 (${this.P.plumes}개 가짐) — 잔 다르크 성상에 바치면 기력이 커진다 · ${this.reward(30, 0, 0, '바람 깃털')}`);
  }

  private activate(e: Ent) {
    const P = this.P, wp = e.wp!;
    P.waypoints.add(wp.id);
    P.last = wp.id;
    this.paintWaypoint(e, true);
    sfx.spotBig();
    this.spawnBurst(e.x, e.y, e.z + 3.8, 0x6fe3ff);
    const n = this.c.revealNear(wp.pos, 280);
    this.c.toast(`🔷 순간이동 포인트 활성화 · ${wp.name}${n ? ` — 둘레 ${n}곳이 지도에 드러났다` : ''} · ${this.reward(60, 5, 0, '순간이동 포인트')}`);
    this.c.hint('지도(M)에서 🔷를 누르면 언제든 이곳으로 순간이동한다');
    setTimeout(() => this.c.hint(''), 5000);
    P.bump('waypoint');
  }

  private offer() {
    const P = this.P;
    if (!P.plumes) { this.c.toast('🗽 성상이 조용히 빛난다 — 높은 곳의 바람 깃털🪶을 가져오면 기력을 키워 준다'); sfx.chime(); return; }
    const before = P.staminaLevel;
    const n = P.plumes;
    P.offered += n; P.plumes = 0;
    sfx.fanfare();
    const lv = P.staminaLevel;
    this.c.toast(`🗽 바람 깃털 ${n}개를 바쳤다${lv > before ? ` — 기력이 커졌다! (단계 ${lv} · 기력 소모 −${Math.round((1 - P.staminaCost) * 100)}%)` : ` — 다음 단계까지 ${4 - (P.offered % 4)}개`} · ${this.reward(50 * n, 10 * n, 0, '성상')}`);
  }

  // ───────── 고양이 ─────────
  private stepCat(e: Ent, d: number, dt: number) {
    const inner = e.obj.userData.inner as THREE.Object3D;
    inner.position.z = 1.1 + Math.sin(this.t * 3) * 0.12;
    const path = e.path!, hop = e.hop!;
    if (hop >= path.length - 1) return;
    const [nx, ny, nz] = path[hop + 1];
    const moving = e.obj.userData.moving as boolean | undefined;
    if (!moving && d < 7) { e.obj.userData.moving = true; sfx.flutter(); if (hop === 0) this.c.toast('🐈‍⬛ 검은 고양이가 따라오라는 듯 돌아본다…'); }
    if (e.obj.userData.moving) {
      const dx = nx - e.x, dy = ny - e.y, L = Math.hypot(dx, dy);
      e.obj.rotation.z = -Math.atan2(dx, dy);
      const step = Math.min(L, 7 * dt);
      e.x += (dx / (L || 1)) * step; e.y += (dy / (L || 1)) * step; e.z += (nz - e.z) * Math.min(1, dt * 3);
      e.obj.position.set(e.x, e.y, e.z);
      if (L < 0.3) {
        e.hop = hop + 1; e.obj.userData.moving = false;
        if (e.hop >= path.length - 1) {
          // 도착: 고양이가 사라지고 상자가 나타난다
          this.drop(e);
          this.spawnBurst(e.x, e.y, e.z + 1, 0xb89cff);
          sfx.spot();
          this.add({ key: e.key, kind: 'chest', tier: 'precious', x: e.x, y: e.y, z: e.z, obj: this.chestModel('precious'), cell: e.cell });
          this.c.toast('🐈‍⬛ 고양이가 사라진 자리에 진귀한 보물상자가!');
        }
      }
    }
  }

  // ───────── 빛 구슬 도전 ─────────
  private startChallenge(e: Ent) {
    const w = this.hero.world, orbs: Ent[] = [];
    for (let k = 0; k < 40 && orbs.length < 7; k++) {
      const a = (k / 7) * TAU + hash(k, Math.round(e.x), 3) * 0.6, r = 10 + hash(k, Math.round(e.y), 4) * 22;
      const x = e.x + Math.cos(a) * r, y = e.y + Math.sin(a) * r;
      if (w.water(x, y)) continue;
      const g = w.terrain(x, y), z = w.ground(x, y, g + 3.2, 0);
      if (z > g + 3.1 || orbs.some((o) => Math.hypot(o.x - x, o.y - y) < 5)) continue;
      orbs.push(this.add({ key: `${e.key}:o${k}`, kind: 'orb', x, y, z, obj: this.orbModel() }));
    }
    if (orbs.length < 4) { for (const o of orbs) this.drop(o); this.c.toast('여기선 도전할 수 없다'); return; }
    this.challenge = { ent: e, orbs, t: 12 + orbs.length * 3.5, got: 0 };
    sfx.questStart();
    this.c.toast(`⏱ 도전! 빛 구슬 ${orbs.length}개를 ${Math.round(this.challenge.t)}초 안에 모으자`);
  }
  private stepChallenge(dt: number) {
    const ch = this.challenge;
    if (!ch) return;
    const b = this.hero.body;
    ch.t -= dt;
    for (const o of ch.orbs.slice()) {
      if (Math.hypot(o.x - b.x, o.y - b.y) < 1.5 && Math.abs(b.z + 1 - (o.z + 1.1)) < 1.6) {
        ch.orbs = ch.orbs.filter((q) => q !== o);
        this.drop(o);
        ch.got++;
        sfx.tick();
        this.spawnBurst(o.x, o.y, o.z + 1.1, 0xffe9a0);
      }
    }
    this.c.hint(`⏱ ${Math.max(0, ch.t).toFixed(1)}초 · 빛 구슬 ${ch.got}/${ch.got + ch.orbs.length}`);
    if (!ch.orbs.length) {
      this.challenge = null;
      this.c.hint('');
      const e = ch.ent;
      this.drop(e);
      sfx.fanfare();
      this.add({ key: e.key, kind: 'chest', tier: 'precious', x: e.x, y: e.y, z: e.z, obj: this.chestModel('precious'), cell: e.cell });
      this.c.toast('⏱ 도전 성공! 진귀한 보물상자가 나타났다');
    } else if (ch.t <= 0) {
      for (const o of ch.orbs) this.drop(o);
      this.challenge = null;
      this.c.hint('');
      sfx.exhausted();
      this.c.toast('⏱ 시간 초과 — 받침에서 F로 다시 도전할 수 있다');
    }
  }

  // ───────── 반짝 ─────────
  private spawnBurst(x: number, y: number, z: number, color: number) {
    const N = 60, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos.set([x, y, z], i * 3);
      const a = Math.random() * TAU, e = Math.random() * 1.2, s = 2 + Math.random() * 3;
      vel.set([Math.cos(a) * Math.cos(e) * s, Math.sin(a) * Math.cos(e) * s, Math.sin(e) * s + 1.5], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.28, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.group.add(pts);
    this.burst.push({ pts, vel, t: 0 });
  }
  private stepBursts(dt: number) {
    for (const b of this.burst.slice()) {
      b.t += dt;
      const a = b.pts.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) { b.vel[i * 3 + 2] -= 5 * dt; a.setXYZ(i, a.getX(i) + b.vel[i * 3] * dt, a.getY(i) + b.vel[i * 3 + 1] * dt, a.getZ(i) + b.vel[i * 3 + 2] * dt); }
      a.needsUpdate = true;
      (b.pts.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - b.t / 1.6);
      if (b.t > 1.6) { this.group.remove(b.pts); b.pts.geometry.dispose(); this.burst = this.burst.filter((q) => q !== b); }
    }
  }

  /** 봉인(보랏빛 고리) */
  private seal(e: Ent, on: boolean) {
    const old = e.obj.userData.seal as THREE.Object3D | undefined;
    if (old) { e.obj.remove(old); e.obj.userData.seal = undefined; }
    if (!on) return;
    const s = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: 0xb58cff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.z = 0.45;
    e.obj.add(s);
    e.obj.userData.seal = s;
  }
  /** 이 상자가 봉인돼 있는가(없으면 null) */
  isLocked(key: string): boolean | null {
    const e = this.ents.find((q) => q.key === key && q.kind === 'chest');
    return e ? !!e.locked : null;
  }
  /** 야영지를 다 물리쳤다 — 봉인을 푼다 */
  unlock(key: string) {
    const e = this.ents.find((q) => q.key === key && q.kind === 'chest');
    if (!e || !e.locked) return;
    e.locked = false;
    this.seal(e, false);
    this.spawnBurst(e.x, e.y, e.z + 0.8, 0xb58cff);
  }
  /** 켠 순간이동 포인트 곁인가(싸움: 회복) */
  atWaypoint() {
    const b = this.hero.body;
    return this.ents.some((e) => e.kind === 'waypoint' && this.P.waypoints.has(e.wp!.id) && Math.hypot(e.x - b.x, e.y - b.y) < 9 && Math.abs(e.z - b.z) < 6);
  }
  /** 우두머리 자리: 노트르담 뒤뜰(장 23세 광장) */
  bossSpot(): [number, number, number] | null { return this.lmAt('notre-dame', 62, -32, 0); }

  /** 미니맵: 순간이동 포인트(켜진 것 🔷, 아직 ◇) · 성상 */
  marks(): { x: number; y: number; icon: string; dim?: boolean }[] {
    return this.ents.filter((e) => e.kind === 'waypoint').map((e) => ({ x: e.x, y: e.y, icon: e.wp!.statue ? '🗽' : '🔷', dim: !this.P.waypoints.has(e.wp!.id) }));
  }
  /** 디버그·시험 */
  list() { return this.ents.map((e) => ({ key: e.key, kind: e.kind, tier: e.tier, x: e.x, y: e.y, z: e.z, locked: !!e.locked })); }
  get challenging() { return !!this.challenge; }
}

let glowT: THREE.Texture | null = null;
function glowTex() {
  if (glowT) return glowT;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#ffffffff'); gr.addColorStop(0.3, '#ffffff88'); gr.addColorStop(1, '#ffffff00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowT = new THREE.CanvasTexture(cv);
  return glowT;
}
