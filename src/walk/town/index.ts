// 거리 전체: 사람 둘레 몇백 m의 건물과 거리 가구를 64 m 칸으로 나눠 짓고, 멀어지면 허문다.
// 건물 모양은 World(지도와 같은 타일, 또는 타일이 없을 때 절차적으로 세운 줄집)에서 오고,
// 겉모습·거리 가구·가게 앞(차양·테라스·간판)은 여기서 정한다. 지도(MapLibre)와 같은 깊이 버퍼에 그린다.
import * as THREE from 'three';
import type { Cat } from '../places';
import { World } from '../hero/world';
import type { Solid } from '../hero/world';
import type { Frame } from '../hero/geo';
import { T } from './atlas';
import { addBuilding } from './buildings';
import type { Theme } from './buildings';
import { GeoBuilder, hash, lin } from './geom';
import { poolMaterial, townMaterial, townUniforms } from './material';
import { awning, circleRing, rectRing, rotFacing, stamp, template } from './props';
import { procedural } from './procedural';
import { LANDMARKS, LB } from './landmarks';
import { EIFFEL_ZONES } from '../eiffel';
import { G_SIZE, Ground } from './ground';
import { Grass } from './grass';
import { inRing as inRingT, ringOf } from '../hero/terrain';
import { FarCity } from './far';

export type { Theme };

export interface TownPlace { id: string; x: number; y: number; cat: Cat; name: string; emoji: string; tags: Record<string, string>; minor?: boolean }
export interface TownGate { x: number; y: number; station: string; label: string }
/** 앉을 수 있는 자리 */
export interface SeatSpot { x: number; y: number; z: number; facing: number; kind: 'bench' | 'chair' | 'fountain' | 'steps'; place?: string }
/** 무언가 할 수 있는 것 */
export interface Spot { kind: 'fountain' | 'morris' | 'kiosk' | 'metro' | 'bus' | 'velib' | 'bench' | 'terrace'; x: number; y: number; facing: number; ref?: string; label?: string }
/** 가게 앞: 문 자리와 바깥 방향 */
export interface Front { x: number; y: number; nx: number; ny: number; top: number }

const CELL = 64;
const cellKey = (ix: number, iy: number) => (ix + 32768) * 65536 + (iy + 32768);

interface Cell {
  ix: number; iy: number;
  solids: Solid[];
  lanes: number[]; // lanes 배열의 번호
  mesh: THREE.Mesh | null;
  pools: THREE.Mesh | null;
  signs: THREE.Object3D[];
  built: boolean;
  dirty: boolean;
  props: boolean; // 거리 가구 자리(와 부딪힘)를 이미 정했나
  placed: { t: string; x: number; y: number; z: number; rot: number; s: number; k?: number; lamp?: boolean }[];
}

const CAT_TILE: Partial<Record<Cat, number[]>> = {
  eat: [T.bistrot, T.shopRed], cafe: [T.cafe], bar: [T.shopBlack, T.bistrot], bakery: [T.boulangerie], sweet: [T.shopCream, T.shopNavy],
  gourmet: [T.fromagerie, T.epicerie], museum: [T.grandDoor], sight: [T.grandDoor], shop: [T.shopGreen, T.gallery, T.shopNavy],
};
export const CAT_COLOR: Record<Cat, string> = { eat: '#b3262c', bakery: '#2b4c8c', sweet: '#d9668f', gourmet: '#6b7d2a', cafe: '#a3322a', bar: '#5b2a6e', museum: '#3d3a8a', sight: '#2f6fa8', park: '#3a8a52', shop: '#1f6e6a' };

export class Town {
  readonly scene = new THREE.Scene();
  readonly uniforms = townUniforms();
  private readonly mat = townMaterial(this.uniforms);
  private readonly poolMat = poolMaterial(this.uniforms);
  private cells = new Map<number, Cell>();
  world!: World;
  frame!: Frame;
  theme: Theme = 'marais';
  lanes: [number, number, number, number][] = [];
  ways: [number, number][][] = [];
  places: TownPlace[] = [];
  gates: TownGate[] = [];
  busStops: { x: number; y: number; name: string }[] = [];
  seats: SeatSpot[] = [];
  spots: Spot[] = [];
  fronts = new Map<string, Front | null>();
  private placeCell = new Map<number, TownPlace[]>();
  private sat = new Set<string>(); // 테라스를 만든 장소
  private matrix = new THREE.Matrix4();
  private matrixOk = false;
  enabled = true;
  /** 짓는 반경(m) — 느린 기기에선 줄인다 */
  radius = 300;
  private heroX = 0; private heroY = 0;
  private procedural = false;
  private builtOnce = false;
  /** 프레임당 짓는 데 쓸 시간(ms). 시작 전 준비 동안에는 크게 준다. */
  budget = 5;
  /** 반경 안에서 아직 못 지은 칸 수와 전체 칸 수(준비 진행률) */
  backlog = 0;
  inView = 0;
  /** 이 동네 원점 기준 랜드마크(로컬 m) */
  /** 랜드마크 앞마당(로컬 x, y, 반지름) */
  private plazas: [number, number, number][] = [];
  landmarks: { id: string; name: string; emoji: string; x: number; y: number; z: number; clear: number; zone?: { style: string; r: number } }[] = [];
  private landmarkMesh: THREE.Mesh | null = null;
  private movers: THREE.Object3D[] = [];
  private extras: THREE.Object3D[] = [];
  private readonly farUniforms = { ...this.uniforms, uFar: { value: 30000 } };
  private readonly farMat = townMaterial(this.farUniforms);
  private lastT = performance.now();
  private job: Generator<void, void, void> | null = null;
  private jobCell: Cell | null = null;

  /** 땅(높낮이·결·강)과 풀밭 */
  readonly ground: Ground;
  /** 하늘에서 내려다볼 때 보이는 먼 땅(4 km) */
  readonly farGround: Ground;
  readonly grass: Grass;
  /** 먼 도시(단순한 상자) — 지도 엔진의 입체 건물 대신 */
  readonly far: FarCity;
  private readonly cityUniforms = { ...this.uniforms, uFar: { value: 3400 } };
  /** 지도 보기(위에서 내려다봄) 중에는 땅을 숨긴다 — 지도의 길·경로 선이 보이게 */
  mapView = false;
  constructor() {
    this.scene.matrixAutoUpdate = false;
    this.ground = new Ground(this.uniforms, { size: G_SIZE, spacing: 2.5, px: 1024 });
    this.farGround = new Ground(this.uniforms, { size: 4096, spacing: 16, px: 2048, far: true });
    this.grass = new Grass(this.uniforms, this.ground);
    this.far = new FarCity(townMaterial(this.cityUniforms));
    this.scene.add(this.farGround.group, this.ground.group, this.grass.group, this.far.group);
  }

  /** 새 동네(또는 새 원점) */
  reset(world: World, frame: Frame, theme: Theme) {
    for (const c of this.cells.values()) this.dropCell(c);
    this.cells.clear();
    this.placeCell.clear();
    this.sat.clear();
    this.fronts.clear();
    this.seats = [];
    this.spots = [];
    this.world = world;
    this.frame = frame;
    this.ground.origin.set(NaN, NaN); // 새 세계 — 땅을 다시 깐다
    this.farGround.origin.set(NaN, NaN);
    this.theme = theme;
    this.procedural = false;
    this.builtOnce = false;
    world.onBuildings = (list) => { this.absorb(list); this.far.absorb(list); };
    this.far.reset(world, (x, y) => this.cleared(x, y));
    this.open = EIFFEL_ZONES.map((z) => { const r = new Float64Array(z.ring.length * 2); z.ring.forEach((p, i) => { const [x, y] = frame.toLocal(p); r[i * 2] = x; r[i * 2 + 1] = y; }); return r; });
    this.buildLandmarks();
  }
  /** 공원·강·광장(지도 타일이 없을 때 이 안에는 절차적 건물을 세우지 않는다) */
  private open: Float64Array[] = [];

  /** 랜드마크를 세운다(7 km 안). 멀리서도 보이게 따로 한 덩어리, 안개도 멀리. */
  private buildLandmarks() {
    if (this.landmarkMesh) { this.scene.remove(this.landmarkMesh); this.landmarkMesh.geometry.dispose(); this.landmarkMesh = null; }
    for (const m of this.movers) this.scene.remove(m);
    this.movers = [];
    for (const m of this.extras) this.scene.remove(m);
    this.extras = [];
    this.landmarks = [];
    this.plazas = [];
    const g = new GeoBuilder();
    for (const L of LANDMARKS) {
      const [x, y] = this.frame.toLocal(L.pos);
      if (Math.hypot(x, y) > 7000) continue;
      const oz = this.world.relief.hill(x, y); // 언덕 위 랜드마크(사크레쾨르 등)
      this.landmarks.push({ id: L.id, name: L.name, emoji: L.emoji, x, y, z: oz, clear: L.clear, zone: L.zone });
      if (!L.build) continue;
      const rot = ((90 - L.bearing) * Math.PI) / 180;
      for (const [u, v, r] of L.plazas ?? []) this.plazas.push([x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot), r]);
      const b = new LB(g, x, y, rot, (rings, base, top) => { this.world.addSolid(rings, base + oz, top + oz, 'building', undefined, true); });
      g.dz = oz;
      L.build(b);
      g.dz = 0;
      for (const m of b.movers) { m.position.z += oz; this.scene.add(m); this.movers.push(m); }
      for (const m of b.extras) { m.position.z += oz; this.scene.add(m); this.extras.push(m); }
    }
    const geo = g.build();
    if (geo) { this.landmarkMesh = new THREE.Mesh(geo, this.farMat); this.landmarkMesh.frustumCulled = false; this.scene.add(this.landmarkMesh); }
  }

  /** 랜드마크 자리라서 보통 건물을 세우지 않는 곳인가 */
  cleared(x: number, y: number) {
    for (const l of this.landmarks) if (l.clear && Math.abs(l.x - x) < l.clear && Math.abs(l.y - y) < l.clear && Math.hypot(l.x - x, l.y - y) < l.clear) return true;
    for (const [px, py, r] of this.plazas) if (Math.hypot(px - x, py - y) < r) return true;
    if (this.procedural) for (const r of this.open) if (inRing(r, x, y)) return true;
    return false;
  }

  private zone = (x: number, y: number): string | null => {
    for (const l of this.landmarks) if (l.zone && Math.hypot(l.x - x, l.y - y) < l.zone.r) return l.zone.style;
    return null;
  };

  /** 걷는 길(로컬 m 선분) */
  setLanes(lanes: [number, number, number, number][]) {
    this.lanes = lanes;
    for (const c of this.cells.values()) c.lanes = [];
    lanes.forEach((l, i) => this.cellOf((l[0] + l[2]) / 2, (l[1] + l[3]) / 2, true)!.lanes.push(i));
  }

  setPlaces(list: TownPlace[]) {
    this.places = list;
    this.placeCell.clear();
    for (const p of list) {
      const k = cellKey(Math.floor(p.x / CELL), Math.floor(p.y / CELL));
      (this.placeCell.get(k) ?? this.placeCell.set(k, []).get(k)!).push(p);
    }
  }

  setGates(list: TownGate[], bus: { x: number; y: number; name: string }[]) {
    this.gates = list;
    this.busStops = bus;
  }

  /** 타일을 못 받는 곳이면 길을 따라 건물을 세운다 */
  buildProcedural(ways: [number, number][][]) {
    if (this.procedural) return;
    this.procedural = true;
    this.ways = ways;
    const t0 = performance.now();
    // 타일이 없으면 강·공원·다리도 손으로 그린 것을 쓴다(에펠탑 둘레)
    const open = EIFFEL_ZONES.map((z, i) => ({ z, r: this.open[i] }));
    for (const { z, r } of open) {
      const flat = r.subarray(0, r.length - 2); // 닫는 점(첫 점 반복) 빼고
      if (z.kind === 'water') this.world.addWater(flat);
      if (z.kind === 'park') this.world.addGreens([flat]);
    }
    const water = open.filter((o) => o.z.kind === 'water').map((o) => ringOf(o.r));
    for (const [ax, ay, bx, by] of this.lanes) {
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      if (water.some((w) => inRingT(w, mx, my))) this.world.addBridge(ax, ay, bx, by, 5.5);
    }
    const list = procedural(this.world, ways, this.theme).filter((b) => { const r = b.rings[0]; return !this.cleared((r[0] + r[4]) / 2, (r[1] + r[5]) / 2); });
    this.world.addBuildings(list);
    if (import.meta.env.DEV) console.debug(`[town] procedural ${list.length} buildings in ${Math.round(performance.now() - t0)} ms`);
  }

  /** 다른 동네의 길을 따라서도 절차적 건물을 세운다(헬기에서 뛰어내려 어디든 내려앉을 수 있게) */
  addProcedural(ways: [number, number][][]) {
    if (!this.procedural || !this.world || !ways.length) return;
    const list = procedural(this.world, ways, this.theme).filter((b) => { const r = b.rings[0]; return !this.cleared((r[0] + r[4]) / 2, (r[1] + r[5]) / 2); });
    this.world.addBuildings(list);
  }

  private cellOf(x: number, y: number, make = false): Cell | undefined {
    const ix = Math.floor(x / CELL), iy = Math.floor(y / CELL);
    const k = cellKey(ix, iy);
    let c = this.cells.get(k);
    if (!c && make) this.cells.set(k, (c = { ix, iy, solids: [], lanes: [], mesh: null, pools: null, signs: [], built: false, dirty: false, props: false, placed: [] }));
    return c;
  }

  private absorb(list: Solid[]) {
    for (const s of list) {
      const c = this.cellOf(s.render!.cx, s.render!.cy, true)!;
      c.solids.push(s);
      if (c.built) c.dirty = true;
    }
    // 새 건물이 들어오면 가게 앞 자리를 다시 찾는다
    for (const [id, f] of this.fronts) if (!f) this.fronts.delete(id);
  }

  /** 가게 앞: 장소 점에서 가장 가까운 건물 벽 */
  front(p: { id: string; x: number; y: number }): Front | null {
    if (this.fronts.has(p.id)) return this.fronts.get(p.id)!;
    let best: Front | null = null, bd = 9;
    for (const s of this.world.near(p.x, p.y, 9)) {
      if (s.kind !== 'building') continue;
      const c = World.closest(s, p.x, p.y);
      const d = Math.abs(c.d);
      if (d < bd) { bd = d; best = { x: c.cx, y: c.cy, nx: c.nx, ny: c.ny, top: s.top }; }
    }
    // 문이 길 쪽을 보게: 바깥 방향 앞이 건물 속이면 반대쪽 벽일 수 있다 — 그대로 둔다
    if (best || this.world.tileReady(p.x, p.y) || this.procedural) this.fronts.set(p.id, best);
    return best;
  }

  /** 매 프레임: 가까운 칸을 짓고 먼 칸을 허문다(한 프레임에 조금씩) */
  /** 사람 높이(풀이 발밑에서 눕는지 볼 때) */
  heroZ = 0;
  update(x: number, y: number) {
    this.heroX = x; this.heroY = y;
    this.uniforms.uEye.value.set(x, y, this.heroZ);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    this.ground.time.value += dt;
    if (this.world) {
      this.ground.update(this.world, this.lanes, x, y);
      this.farGround.update(this.world, this.lanes, x, y);
      this.far.update(x, y, this.builtOnce ? Math.max(2, this.budget * 0.5) : 30);
      // 먼 땅은 가까운 땅이 덮는 사각형을 비운다(겹쳐 깜빡이지 않게) — 가장자리 1 m는 겹친다
      const o = this.ground.origin;
      this.farGround.hole.set(o.x + 1, o.y + 1, o.x + G_SIZE - 1, o.y + G_SIZE - 1);
      this.ground.group.visible = this.farGround.group.visible = this.grass.group.visible = !this.mapView;
      this.grass.update(dt, x, y, this.heroZ);
    }
    for (const m of this.movers) { const k = m.children[0]; if (!k) continue; if (m.userData.spin === 'z') k.rotation.z += dt * 0.7; else k.rotation.y += dt * 0.5; }
    if (!this.enabled || !this.world) return;
    const R = Math.min(this.procedural ? 250 : 300, this.radius), DROP = R + 120;
    const t0 = performance.now();
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    const span = Math.ceil(R / CELL);
    const want: { c: Cell; d: number }[] = [];
    let inView = 0, waiting = 0;
    for (let ix = cx - span; ix <= cx + span; ix++) for (let iy = cy - span; iy <= cy + span; iy++) {
      const mx = (ix + 0.5) * CELL, my = (iy + 0.5) * CELL;
      const d = Math.hypot(mx - x, my - y);
      if (d > R + CELL * 0.7) continue;
      const c = this.cellOf(mx, my, true)!;
      inView++;
      if (c.built && !c.dirty) continue;
      if (!this.procedural && !this.world.tileReady(mx, my)) { waiting++; continue; }
      want.push({ c, d });
    }
    want.sort((a, b) => a.d - b.d);
    this.backlog = want.length + waiting;
    this.inView = inView;
    const budget = this.builtOnce ? this.budget : 60; // 처음엔 한꺼번에(화면이 비지 않게), 그다음은 조금씩(끊기지 않게)
    // 한 칸도 여러 프레임에 나눠 짓는다 — 칸 하나가 수십 ms라 통째로 지으면 뚝 끊긴다
    let wi = 0;
    while (performance.now() - t0 < budget) {
      if (!this.job) {
        while (wi < want.length && want[wi].c === this.jobCell) wi++;
        if (wi >= want.length) break;
        this.jobCell = want[wi++].c;
        this.job = this.buildSteps(this.jobCell);
      }
      if (this.job.next().done) { this.job = null; this.jobCell = null; }
    }
    this.builtOnce = this.builtOnce || want.length === 0 || !!this.jobCell || performance.now() - t0 < 60;
    for (const c of this.cells.values()) {
      if (!c.built) continue;
      if (Math.hypot((c.ix + 0.5) * CELL - x, (c.iy + 0.5) * CELL - y) > DROP) this.dropCell(c);
    }
  }

  private dropCell(c: Cell) {
    if (this.jobCell === c) { this.job = null; this.jobCell = null; }
    this.disposeParts(c.mesh, c.pools, c.signs);
    c.mesh = null; c.pools = null; c.signs = [];
    c.built = false;
    c.dirty = false;
  }

  private disposeParts(mesh: THREE.Mesh | null, pools: THREE.Mesh | null, signs: THREE.Object3D[]) {
    if (mesh) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    if (pools) { this.scene.remove(pools); pools.geometry.dispose(); }
    for (const s of signs) { this.scene.remove(s); s.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); } }); }
  }

  private street = (x: number, y: number) => this.world.onLane(x, y, 3.5);

  private shopAt = (x: number, y: number): number | null => {
    for (const p of this.places) {
      if (p.minor || Math.abs(p.x - x) > 4 || Math.abs(p.y - y) > 4) continue;
      if (Math.hypot(p.x - x, p.y - y) > 3.6) continue;
      const tiles = CAT_TILE[p.cat];
      if (!tiles) return null;
      if (p.cat === 'shop') {
        const k = p.tags.shop ?? '';
        if (/book/.test(k)) return T.librairie;
        if (/florist/.test(k)) return T.fleuriste;
        if (/cheese|deli/.test(k)) return T.fromagerie;
        if (/greengrocer|supermarket|convenience/.test(k)) return T.marche;
        if (/chemist|pharmacy/.test(k)) return T.pharmacie;
        if (/art|gallery|antiques/.test(k)) return T.gallery;
      }
      return tiles[Math.floor(hash(p.x, p.y, 3) * tiles.length)];
    }
    return null;
  };

  /** 언덕 위 건물: 평지에 짓듯 만들고(상대 높이) 꼭짓점을 그 자리 땅만큼 올린다. 비탈 아래쪽은 돌 기단으로 메운다. */
  private addLifted(g: GeoBuilder, s: Solid, env: Parameters<typeof addBuilding>[2]) {
    const gz = s.gz ?? 0;
    if (!gz) { addBuilding(g, s, env); return; }
    const lifted = s.base <= gz - 0.05;
    const rel: Solid = { ...s, top: s.top - gz, base: lifted ? 0 : s.base - gz };
    const w = env.world;
    const relWorld = {
      buildingTopAt: (x: number, y: number, ex?: Solid) => { const t = w.buildingTopAt(x, y, ex === rel ? s : ex); return t > 0 ? Math.max(0.01, t - gz) : 0; },
      addSolid: (rings: Float64Array[], b: number, t: number, k: Solid['kind']) => w.addSolid(rings, b + gz, t + gz, k, undefined, true),
    } as unknown as World;
    g.dz = gz;
    addBuilding(g, rel, { ...env, world: relWorld });
    // 기단: 가장 낮은 모서리(바닥)부터 0(상대)까지 돌벽
    if (lifted && s.base < gz - 0.35) {
      const r = s.render!.rings[0];
      const n = r.length / 2;
      let area = 0;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; }
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = r[i * 2], ay = r[i * 2 + 1], bx = r[j * 2], by = r[j * 2 + 1];
        const L = Math.hypot(bx - ax, by - ay);
        if (L < 0.3) continue;
        let nx = (by - ay) / L, ny = -(bx - ax) / L;
        if (area < 0) { nx = -nx; ny = -ny; }
        g.wall(ax, ay, bx, by, s.base - gz, 0.02, nx, ny, [0, L / 2.9], [0, (gz - s.base) / 3.05], T.blankStone, lin('#e8dcc3'), s.render!.seed);
      }
    }
    g.dz = 0;
  }

  /** 칸 하나 짓기 — 건물·가구 몇 개마다 쉬어 가는 생성기. 다 지을 때까지 옛 메시는 그대로 둔다(깜빡이지 않게). */
  private *buildSteps(c: Cell): Generator<void, void, void> {
    const old = { mesh: c.mesh, pools: c.pools, signs: c.signs };
    c.signs = [];
    c.dirty = false; // 짓는 동안 새 건물이 들어오면 다시 dirty가 되어 한 번 더 짓는다
    const g = new GeoBuilder();
    const pools = new GeoBuilder();
    const env = { world: this.world, theme: this.theme, street: this.street, shopAt: this.shopAt, zone: this.zone };
    let n = 0;
    for (const s of c.solids) {
      if (!this.cleared(s.render!.cx, s.render!.cy)) { this.addLifted(g, s, env); if (++n % 3 === 0) yield; }
    }
    if (!c.props) { this.layoutProps(c); c.props = true; yield; }
    yield* this.shopFronts(c, g); // 테라스 가구를 placed에 더하므로 stamp보다 먼저
    for (const p of c.placed) {
      stamp(g, template(p.t, p.k), p.x, p.y, p.z + this.world.terrain(p.x, p.y), p.rot, p.s);
      if (p.lamp) { const lz = this.world.terrain(p.x, p.y) + 0.04; pools.quad([p.x - 5, p.y - 5, lz], [p.x + 5, p.y - 5, lz], [p.x + 5, p.y + 5, lz], [p.x - 5, p.y + 5, lz], [0, 0, 1], [0, 0, 1, 1], -1, [1, 1, 1]); }
      if (++n % 12 === 0) yield;
    }
    yield;
    const geo = g.build();
    const pg = pools.build();
    this.disposeParts(old.mesh, old.pools, old.signs);
    c.mesh = null; c.pools = null;
    if (geo) { c.mesh = new THREE.Mesh(geo, this.mat); c.mesh.matrixAutoUpdate = false; this.scene.add(c.mesh); }
    if (pg) { c.pools = new THREE.Mesh(pg, this.poolMat); c.pools.matrixAutoUpdate = false; c.pools.renderOrder = 2; this.scene.add(c.pools); }
    c.built = true;
  }


  /** 타일이 없을 때는 길바닥도 그린다(아스팔트 + 포석 보도) */
  /** 길 한쪽에서 건물 벽까지 몇 m인가(없으면 Infinity) */
  private faceDist(x: number, y: number, nx: number, ny: number, max = 22): number {
    for (let d = 1.2; d <= max; d += 0.8) if (this.world.buildingTopAt(x + nx * d, y + ny * d) > 0) return d;
    return Infinity;
  }

  private near(list: { x: number; y: number }[], x: number, y: number, r: number) {
    for (const p of list) if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r && Math.hypot(p.x - x, p.y - y) < r) return true;
    return false;
  }

  private solidAtAll(x: number, y: number, r: number) {
    for (const s of this.world.near(x, y, r)) if (s.kind !== 'water' && s.base < 1 && (World.contains(s, x, y) || Math.abs(World.closest(s, x, y).d) < r)) return true;
    return false;
  }

  /** 이 칸의 거리 가구 자리를 정한다(한 번만). 부딪히는 것은 World에도 넣는다. */
  private layoutProps(c: Cell) {
    const W = this.world;
    const add = (t: string, x: number, y: number, rot: number, extra: Partial<Cell['placed'][number]> = {}) => c.placed.push({ t, x, y, z: 0, rot, s: 1, ...extra });
    // 지하철 입구·장소 문 앞은 비워 둔다
    const taken: { x: number; y: number }[] = this.gates.map((g) => ({ x: g.x, y: g.y }));
    for (const p of this.placeCell.get(cellKey(c.ix, c.iy)) ?? []) taken.push({ x: p.x, y: p.y });
    const cars = ['#e8e6e1', '#2b2d31', '#8a9199', '#1f3b6b', '#b3262c', '#e5e1d8', '#4a5b4f', '#c9c3b5'];
    for (const li of c.lanes) {
      const [ax, ay, bx, by] = this.lanes[li];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 3) continue;
      const dx = (bx - ax) / len, dy = (by - ay) / len;
      for (const side of [1, -1]) {
        const nx = -dy * side, ny = dx * side;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const face = this.faceDist(mx, my, nx, ny);
        const hs = hash(mx, my, side + 40);
        // 가로등: 약 22 m마다. 넓으면 보도 끝, 좁은 골목은 벽에 매단다
        const lampEvery = 22;
        const phase = hash(Math.round(ax / lampEvery), Math.round(ay / lampEvery), side) * lampEvery;
        for (let t = phase; t < len; t += lampEvery) {
          const px = ax + dx * t, py = ay + dy * t;
          if (face < 4.2) {
            const wx = px + nx * (face - 0.05), wy = py + ny * (face - 0.05);
            if (this.near(taken, wx, wy, 10)) continue;
            taken.push({ x: wx, y: wy });
            add('wallLamp', wx, wy, rotFacing(-nx, -ny), { lamp: true });
          } else {
            const off = face === Infinity ? 4.2 : Math.min(face - 1.4, 6.5);
            const lx = px + nx * off, ly = py + ny * off;
            if (this.near(taken, lx, ly, 10) || W.onLane(lx, ly, 1.6) || this.solidAtAll(lx, ly, 0.4)) continue;
            taken.push({ x: lx, y: ly });
            add('lamp', lx, ly, rotFacing(nx, ny), { lamp: true });
            W.addSolid([circleRing(lx, ly, 0.14, 6)], 0, 4.4, 'prop');
          }
        }
        // 넓은 보도: 플라타너스 줄 + 사이사이 벤치
        if (face >= 9 && face !== Infinity) {
          const off = face - 3.6;
          const every = 9;
          const ph = hash(Math.round(ax / every), Math.round(ay / every), side + 3) * every;
          for (let t = ph; t < len; t += every) {
            const tx = ax + dx * t + nx * off, ty = ay + dy * t + ny * off;
            if (this.near(taken, tx, ty, 6) || W.onLane(tx, ty, 2.2) || this.solidAtAll(tx, ty, 0.6)) continue;
            taken.push({ x: tx, y: ty });
            const k = hash(tx, ty, 50);
            add('tree', tx, ty, k * 6.28, { s: 0.85 + k * 0.35, k });
            W.addSolid([circleRing(tx, ty, 0.26, 7)], 0, 3.2, 'prop');
            if (hash(tx, ty, 51) < 0.35) {
              const bx2 = tx + dx * (every / 2), by2 = ty + dy * (every / 2);
              if (!this.solidAtAll(bx2, by2, 1.0) && !W.onLane(bx2, by2, 2.0)) this.addBench(c, bx2, by2, -nx, -ny);
            }
          }
        }
        // 중간 폭 길: 주차된 차·오토바이 한 줄
        if (face >= 6 && face < 12 && hs < 0.55) {
          const off = Math.min(face - 2.6, 3.4);
          for (let t = 3 + hash(ax, ay, 60) * 3; t < len - 2.5; t += 5.6) {
            const qx = ax + dx * t + nx * off, qy = ay + dy * t + ny * off;
            if (hash(qx, qy, 61) < 0.35 || this.near(taken, qx, qy, 3.2) || this.solidAtAll(qx, qy, 1.2)) continue;
            taken.push({ x: qx, y: qy });
            const rot = rotFacing(dx * (hash(qx, qy, 62) < 0.5 ? 1 : -1), dy * (hash(qx, qy, 62) < 0.5 ? 1 : -1));
            if (hash(qx, qy, 63) < 0.18) { add(`scooter:${['#c9302c', '#f2efe6', '#2d6cdf', '#222'][Math.floor(hash(qx, qy, 64) * 4)]}`, qx, qy, rot); continue; }
            add(`car:${cars[Math.floor(hash(qx, qy, 65) * cars.length)]}`, qx, qy, rot);
            W.addSolid([rectRing(qx, qy, 1.8, 4.1, rot)], 0, 1.45, 'prop');
          }
        }
        // 좁은 길: 갈색 볼라드(주차 막는 말뚝)
        if (face >= 3.2 && face < 7 && hs > 0.62) {
          const off = face - 0.9;
          for (let t = 1; t < len; t += 1.9) {
            const qx = ax + dx * t + nx * off, qy = ay + dy * t + ny * off;
            if (this.solidAtAll(qx, qy, 0.2) || W.onLane(qx, qy, 1.2)) continue;
            add('bollard', qx, qy, 0);
          }
        }
        // 쓰레기통·화분
        if (face !== Infinity && face > 4 && hash(mx, my, side + 70) < 0.12) {
          const qx = mx + nx * (face - 1.0), qy = my + ny * (face - 1.0);
          if (!this.solidAtAll(qx, qy, 0.4) && !this.near(taken, qx, qy, 2)) { taken.push({ x: qx, y: qy }); add(hash(mx, my, 71) < 0.6 ? 'bin' : 'planter', qx, qy, rotFacing(-nx, -ny)); }
        }
      }
    }
    // 갈림길: 월리스 분수·모리스 기둥(드물게)
    const nodes = new Map<string, { x: number; y: number; n: number }>();
    for (const li of c.lanes) for (const [x, y] of [[this.lanes[li][0], this.lanes[li][1]], [this.lanes[li][2], this.lanes[li][3]]]) {
      const k = `${Math.round(x)},${Math.round(y)}`;
      const v = nodes.get(k) ?? { x, y, n: 0 };
      v.n++;
      nodes.set(k, v);
    }
    for (const v of nodes.values()) {
      if (v.n < 3) continue;
      const h = hash(v.x, v.y, 80);
      const kind = h < 0.12 ? 'wallace' : h < 0.26 ? 'morris' : null;
      if (!kind) continue;
      // 길 한가운데를 피해 모퉁이 쪽으로
      let placed = false;
      for (let a = 0; a < 8 && !placed; a++) {
        const ang = (a / 8) * Math.PI * 2 + h * 3;
        for (const r of [5.5, 7, 9]) {
          const px = v.x + Math.cos(ang) * r, py = v.y + Math.sin(ang) * r;
          const sk = kind === 'wallace' ? 'fountain' : 'morris';
          if (W.onLane(px, py, 2.4) || this.solidAtAll(px, py, 1.4) || this.spots.some((s) => Math.hypot(s.x - px, s.y - py) < (kind === 'wallace' ? 160 : 120) && s.kind === sk)) continue;
          add(kind, px, py, ang);
          W.addSolid([circleRing(px, py, kind === 'wallace' ? 0.55 : 0.74, 8)], 0, kind === 'wallace' ? 2.85 : 4.1, 'prop');
          this.spots.push({ kind: sk, x: px, y: py, facing: 0 });
          placed = true;
          break;
        }
      }
    }
    // 이 칸의 지하철 입구·가판대·버스 정류장
    for (const gt of this.gates) {
      if (Math.floor(gt.x / CELL) !== c.ix || Math.floor(gt.y / CELL) !== c.iy) continue;
      const lane = this.nearestLaneDir(gt.x, gt.y);
      // 계단은 길과 나란히, 길 위를 막지 않게 보도 쪽으로 비켜 선다. 입구(+y)는 길을 따라 걸어오는 쪽.
      const rot = rotFacing(lane.dx, lane.dy);
      let cx = gt.x, cy = gt.y;
      search: for (let k = 1.5; k <= 7; k += 0.5) for (const sd of [1, -1]) {
        const qx = lane.px + lane.nx * sd * k, qy = lane.py + lane.ny * sd * k;
        let ok = true;
        for (let t = -2.4; t <= 2.4 && ok; t += 1.2) for (const w of [-0.9, 0.9]) {
          const sx = qx + lane.dx * t + lane.nx * w, sy = qy + lane.dy * t + lane.ny * w;
          if (W.onLane(sx, sy, 1.3) || this.solidAtAll(sx, sy, 0.3)) { ok = false; break; }
        }
        if (ok) { cx = qx; cy = qy; break search; }
      }
      add('guimard', cx, cy, rot);
      c.signs.push(this.metroSign(cx, cy, rot));
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const at = (lx: number, ly: number) => [cx + lx * cs - ly * sn, cy + lx * sn + ly * cs] as const;
      const seg = (x0: number, y0: number, x1: number, y1: number) => { const [p, q] = at(x0, y0), [r, s] = at(x1, y1); const L = Math.hypot(r - p, s - q); W.addSolid([rectRing((p + r) / 2, (q + s) / 2, 0.12, L, Math.atan2(s - q, r - p) - Math.PI / 2)], 0, 1.0, 'prop'); };
      seg(-0.92, -2.35, -0.92, 2.1); seg(0.92, -2.35, 0.92, 2.1); seg(-0.92, -2.35, 0.92, -2.35);
      this.spots.push({ kind: 'metro', x: at(0, 2.3)[0], y: at(0, 2.3)[1], facing: Math.atan2(-lane.dy, -lane.dx), ref: gt.station, label: gt.label });
      // 역 앞 신문 가판대(역마다 하나)
      if (!this.spots.some((s) => s.kind === 'kiosk' && s.ref === gt.station)) {
        for (const d of [8, 11, -8]) {
          const kx = gt.x + lane.dx * d + lane.nx * 3.2, ky = gt.y + lane.dy * d + lane.ny * 3.2;
          if (this.solidAtAll(kx, ky, 1.6) || W.onLane(kx, ky, 1.6)) continue;
          add('kiosk', kx, ky, rot);
          W.addSolid([rectRing(kx, ky, 2.6, 1.8, rot)], 0, 3.0, 'prop');
          this.spots.push({ kind: 'kiosk', x: kx, y: ky, facing: 0, ref: gt.station });
          break;
        }
      }
    }
    for (const b of this.busStops) {
      if (Math.floor(b.x / CELL) !== c.ix || Math.floor(b.y / CELL) !== c.iy) continue;
      const lane = this.nearestLaneDir(b.x, b.y);
      const side = this.faceDist(b.x, b.y, lane.nx, lane.ny) < this.faceDist(b.x, b.y, -lane.nx, -lane.ny) ? 1 : -1;
      const face = this.faceDist(b.x, b.y, lane.nx * side, lane.ny * side);
      const off = Math.min(face - 1.4, 4.4);
      const sx = b.x + lane.nx * side * off, sy = b.y + lane.ny * side * off;
      const rot = rotFacing(-lane.nx * side, -lane.ny * side);
      add('bus', sx, sy, rot);
      W.addSolid([rectRing(sx - lane.nx * side * 0.6, sy - lane.ny * side * 0.6, 3.7, 0.12, rot)], 0, 2.3, 'prop');
      this.spots.push({ kind: 'bus', x: sx, y: sy, facing: Math.atan2(-lane.ny * side, -lane.nx * side), ref: b.name, label: b.name });
      this.seats.push({ x: sx - lane.nx * side * 0.35, y: sy - lane.ny * side * 0.35, z: 0.52 + this.world.terrain(sx, sy), facing: bearingOfVec(-lane.nx * side, -lane.ny * side), kind: 'bench' });
    }
  }

  private addBench(c: Cell, x: number, y: number, fx: number, fy: number) {
    const rot = rotFacing(fx, fy);
    c.placed.push({ t: 'bench', x, y, z: 0, rot, s: 1 });
    this.world.addSolid([rectRing(x, y, 1.8, 0.5, rot)], 0, 0.47, 'prop');
    const f = bearingOfVec(fx, fy);
    const rx = Math.cos(rot), ry = Math.sin(rot);
    const bz = this.world.terrain(x, y);
    for (const s of [-0.45, 0.45]) this.seats.push({ x: x + rx * s + fx * 0.08, y: y + ry * s + fy * 0.08, z: 0.47 + bz, facing: f, kind: 'bench' });
    this.spots.push({ kind: 'bench', x, y, facing: f });
  }

  nearestLaneDir(x: number, y: number) {
    let bd = Infinity, dx = 1, dy = 0, px = x, py = y;
    for (const l of this.lanes) {
      if (Math.abs(l[0] - x) > 40 && Math.abs(l[2] - x) > 40) continue;
      const ex = l[2] - l[0], ey = l[3] - l[1];
      const L = ex * ex + ey * ey;
      const t = L ? Math.max(0, Math.min(1, ((x - l[0]) * ex + (y - l[1]) * ey) / L)) : 0;
      const qx = l[0] + ex * t, qy = l[1] + ey * t;
      const d = Math.hypot(x - qx, y - qy);
      if (d < bd) { bd = d; const s = Math.sqrt(L) || 1; dx = ex / s; dy = ey / s; px = qx; py = qy; }
    }
    return { dx, dy, nx: -dy, ny: dx, px, py, d: bd };
  }

  /** 이 칸에 있는 장소들: 1층 차양·테라스·간판 */
  private *shopFronts(c: Cell, g: GeoBuilder): Generator<void, void, void> {
    const list = this.placeCell.get(cellKey(c.ix, c.iy)) ?? [];
    for (const p of list) {
      if (p.minor || p.cat === 'park') continue;
      const f = this.front(p);
      if (!f) continue;
      const tx = -f.ny, ty = f.nx; // 벽을 따라
      const w = p.cat === 'museum' || p.cat === 'sight' ? 0 : 3.4;
      g.dz = this.world.terrain(f.x + f.nx * 1.5, f.y + f.ny * 1.5);
      if (w) awning(g, f.x - tx * w / 2 + f.nx * 0.02, f.y - ty * w / 2 + f.ny * 0.02, f.x + tx * w / 2 + f.nx * 0.02, f.y + ty * w / 2 + f.ny * 0.02, f.nx, f.ny, CAT_COLOR[p.cat], 3.35, p.cat === 'cafe' || p.cat === 'bar' || p.cat === 'eat' ? 2.4 : 1.4, 0.7);
      // 테라스: 카페·바·식당 앞 보도에 테이블 두세 개
      if ((p.cat === 'cafe' || p.cat === 'bar' || p.cat === 'eat') && !this.sat.has(p.id)) {
        this.sat.add(p.id);
        const n = 2 + Math.floor(hash(p.x, p.y, 90) * 2);
        for (let i = 0; i < n; i++) {
          const off = (i - (n - 1) / 2) * 1.75;
          const qx = f.x + f.nx * 1.35 + tx * off, qy = f.y + f.ny * 1.35 + ty * off;
          if (this.world.onLane(qx, qy, 1.2) || this.solidAtAll(qx, qy, 0.5)) continue;
          const rot = rotFacing(f.nx, f.ny);
          c.placed.push({ t: 'terrace', x: qx, y: qy, z: 0, rot, s: 1 });
          // 의자 두 개: 탁자 양옆(벽을 따라)에서 탁자를 본다
          for (const sx of [-1, 1]) {
            const cxp = qx + Math.cos(rot) * sx * 0.58, cyp = qy + Math.sin(rot) * sx * 0.58;
            this.seats.push({ x: cxp, y: cyp, z: 0.45 + this.world.terrain(cxp, cyp), facing: bearingOfVec(-Math.cos(rot) * sx, -Math.sin(rot) * sx), kind: 'chair', place: p.id });
          }
          this.world.addSolid([circleRing(qx, qy, 0.36, 8)], 0, 0.75, 'prop');
        }
        this.spots.push({ kind: 'terrace', x: f.x + f.nx * 1.35, y: f.y + f.ny * 1.35, facing: bearingOfVec(f.nx, f.ny), ref: p.id, label: p.name });
      }
      // 간판: 차양 위 이름판 + 벽에서 튀어나온 깃발 간판(그림)
      g.dz = 0;
      const board = this.nameBoard(p, f, tx, ty);
      board.position.z += this.world.terrain(f.x + f.nx * 1.5, f.y + f.ny * 1.5);
      c.signs.push(board);
      yield; // 간판 그림(캔버스)이 무겁다 — 하나마다 쉰다
    }
  }

  /** 기마르 입구 간판: 크림색 바탕에 초록 글씨 METROPOLITAIN (양면) */
  private metroSign(cx: number, cy: number, rot: number): THREE.Object3D {
    let tex = this.metroTex;
    if (!tex) {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 80;
      const g = cv.getContext('2d')!;
      g.fillStyle = '#efe0a8'; g.fillRect(0, 0, 512, 80);
      g.strokeStyle = '#1f4a38'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 74);
      g.fillStyle = '#1f4a38';
      g.font = 'bold 50px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('METROPOLITAIN', 256, 44);
      tex = this.metroTex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.31), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    const c = Math.cos(rot), s = Math.sin(rot);
    // 틀의 (0, 2.06, 2.72) — 입구 쪽 간판 바로 앞
    const mz = 2.72 + this.world.terrain(cx, cy);
    m.position.set(cx - 2.06 * s, cy + 2.06 * c, mz);
    m.up.set(0, 0, 1);
    m.lookAt(m.position.x - s, m.position.y + c, mz);
    this.scene.add(m);
    return m;
  }
  private metroTex: THREE.CanvasTexture | null = null;

  private nameBoard(p: TownPlace, f: Front, tx: number, ty: number): THREE.Object3D {
    const grp = new THREE.Group();
    const cv = document.createElement('canvas');
    // 작게 그린다(칸을 지을 때마다 만드니 크면 끊긴다)
    cv.width = 384; cv.height = 72;
    const g2 = cv.getContext('2d')!;
    g2.setTransform(0.75, 0, 0, 0.75, 0, 0);
    const bg = CAT_COLOR[p.cat];
    g2.fillStyle = p.cat === 'museum' || p.cat === 'sight' ? '#2a2724' : bg;
    g2.fillRect(0, 0, 512, 96);
    g2.strokeStyle = '#d9b45a'; g2.lineWidth = 4; g2.strokeRect(6, 6, 500, 84);
    g2.fillStyle = '#f6e7b9';
    let size = 46;
    g2.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
    const name = p.name.length > 26 ? p.name.slice(0, 25) + '…' : p.name;
    while (g2.measureText(name).width > 470 && size > 20) { size -= 2; g2.font = `bold ${size}px Georgia, serif`; }
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(name, 256, 50);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const w = Math.min(4.2, Math.max(2.6, name.length * 0.22)), h = w * (96 / 512);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -6 }));
    // 평면(xy)을 세워서 바깥(n)을 보게
    const z = p.cat === 'museum' || p.cat === 'sight' ? 4.6 : 3.72;
    board.position.set(f.x + f.nx * 0.08, f.y + f.ny * 0.08, z);
    board.up.set(0, 0, 1);
    board.lookAt(f.x + f.nx * 5, f.y + f.ny * 5, z);
    grp.add(board);
    // 깃발 간판: 벽에서 수직으로 튀어나온 동그란 판(양면)
    const cv2 = document.createElement('canvas');
    cv2.width = cv2.height = 64;
    const g3 = cv2.getContext('2d')!;
    g3.scale(0.5, 0.5);
    g3.fillStyle = '#1d1a17'; g3.beginPath(); g3.arc(64, 64, 62, 0, 7); g3.fill();
    g3.fillStyle = bg; g3.beginPath(); g3.arc(64, 64, 54, 0, 7); g3.fill();
    g3.font = '64px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif'; g3.textAlign = 'center'; g3.textBaseline = 'middle';
    g3.fillText(p.emoji, 64, 70);
    const tex2 = new THREE.CanvasTexture(cv2);
    tex2.colorSpace = THREE.SRGBColorSpace;
    const blade = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ map: tex2, side: THREE.DoubleSide }));
    const bx = f.x + f.nx * 0.75 + tx * 2.3, by = f.y + f.ny * 0.75 + ty * 2.3;
    blade.position.set(bx, by, 4.55);
    blade.up.set(0, 0, 1);
    blade.lookAt(bx + tx, by + ty, 4.55);
    grp.add(blade);
    grp.traverse((o) => { o.matrixAutoUpdate = true; });
    this.scene.add(grp);
    return grp;
  }

  /** 가장 가까운 앉을 자리 */
  seatNear(x: number, y: number, r: number): SeatSpot | null {
    let best: SeatSpot | null = null, bd = r;
    for (const s of this.seats) { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  /** 하루의 빛 */
  daylight(sun: THREE.Vector3, sunCol: string, amb: string, night: number, fog: string) {
    this.uniforms.uSun.value.copy(sun).normalize();
    this.uniforms.uSunCol.value.set(sunCol);
    this.uniforms.uAmb.value.set(amb);
    this.uniforms.uNight.value = night;
    this.uniforms.uFog.value.set(fog);
  }

  /** 먼 곳에 지도의 건물이 이어지면 안개를 걷는다(경계가 도드라지지 않게) */
  setFar(far: number) { this.uniforms.uFar.value = far; }

  /** 로컬 점 → 화면 좌표(CSS px). 화면 뒤면 null. */
  project(x: number, y: number, z: number, out: { x: number; y: number }): boolean {
    if (!this.matrixOk) return false;
    const e = this.matrix.elements;
    const X = e[0] * x + e[4] * y + e[8] * z + e[12];
    const Y = e[1] * x + e[5] * y + e[9] * z + e[13];
    const W = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (W <= 0.01) return false;
    out.x = ((X / W + 1) / 2) * this.cw;
    out.y = ((1 - Y / W) / 2) * this.ch;
    return true;
  }
  private cw = 1; private ch = 1;

  /** 화면 좌표 계산용 (투영 × 보기) 행렬과 화면 크기 — 걷기 화면(View)이 매 프레임 넘겨준다 */
  setView(viewProj: THREE.Matrix4, w: number, h: number) {
    this.matrix.copy(viewProj);
    this.matrixOk = true;
    this.cw = w; this.ch = h;
  }

  get heroPos() { return { x: this.heroX, y: this.heroY }; }
}

/** 벡터 → 방위(북 0°, 시계 방향) */
function bearingOfVec(x: number, y: number) { return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360; }

function inRing(r: Float64Array, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
