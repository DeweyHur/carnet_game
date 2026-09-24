// 먼 도시: 지도 엔진의 입체 건물 대신, 세계(World)에 읽힌 모든 건물을 256 m 덩어리마다 단순한 상자로 세운다.
// 창이 난 파사드 한 칸 + 함석·슬레이트 평지붕. 가까운 곳은 자세한 거리(Town 칸)가 덮는다 —
// 상자를 벽에서 0.35 m 안으로, 지붕을 0.6 m 낮게 세워 자세한 건물 속에 숨는다(겹쳐 깜빡이지 않게).
import * as THREE from 'three';
import type { World, Solid } from '../hero/world';
import { GeoBuilder, hash, lin } from './geom';
import { T } from './atlas';

const BLOCK = 256;
const NEAR_R = 3200; // 이 안의 덩어리를 세운다
const DROP_R = 3900;
const FACADES = [T.haussmann, T.haussmannB, T.grand, T.grey, T.plaster, T.ochre, T.cream, T.yellow];
const ROOFS = ['#7d8792', '#6c7680', '#8a929a', '#b9a58a', '#5f6a74'].map((c) => lin(c));

interface Block { key: string; mesh: THREE.Mesh | null; count: number; stamp: number }

export class FarCity {
  readonly group = new THREE.Group();
  private blocks = new Map<string, Block>();
  private world: World | null = null;
  private readonly mat: THREE.Material;
  private dirty = new Set<string>();
  private skip: (x: number, y: number) => boolean = () => false;
  /** 아직 못 세운 덩어리 수(준비 진행률) */
  backlog = 0;

  constructor(mat: THREE.Material) {
    this.mat = mat;
    this.group.matrixAutoUpdate = false;
  }

  reset(world: World, skip: (x: number, y: number) => boolean) {
    for (const b of this.blocks.values()) this.drop(b);
    this.blocks.clear();
    this.dirty.clear();
    this.world = world;
    this.skip = skip;
  }

  /** 새 건물이 들어왔다 — 그 덩어리를 다시 세운다 */
  absorb(list: Solid[]) {
    for (const s of list) if (s.render) this.dirty.add(keyOf(s.render.cx, s.render.cy));
  }

  /** 매 프레임: 가까운 덩어리부터 조금씩(ms 예산) */
  update(x: number, y: number, budget = 2) {
    const w = this.world;
    if (!w) return;
    const t0 = performance.now();
    const cx = Math.floor(x / BLOCK), cy = Math.floor(y / BLOCK), span = Math.ceil(NEAR_R / BLOCK);
    const want: { k: string; ix: number; iy: number; d: number }[] = [];
    for (let ix = cx - span; ix <= cx + span; ix++) for (let iy = cy - span; iy <= cy + span; iy++) {
      const d = Math.hypot((ix + 0.5) * BLOCK - x, (iy + 0.5) * BLOCK - y);
      if (d > NEAR_R) continue;
      const k = `${ix},${iy}`;
      const b = this.blocks.get(k);
      if (b && !this.dirty.has(k)) continue;
      want.push({ k, ix, iy, d });
    }
    want.sort((a, b) => a.d - b.d);
    this.backlog = want.length;
    for (const q of want) {
      this.build(q.k, q.ix, q.iy);
      this.dirty.delete(q.k);
      if (performance.now() - t0 > budget) break;
    }
    for (const b of this.blocks.values()) {
      const [ix, iy] = b.key.split(',').map(Number);
      if (Math.hypot((ix + 0.5) * BLOCK - x, (iy + 0.5) * BLOCK - y) > DROP_R) { this.drop(b); this.blocks.delete(b.key); }
    }
  }

  private drop(b: Block) { if (b.mesh) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh = null; } }

  private build(k: string, ix: number, iy: number) {
    const w = this.world!;
    const old = this.blocks.get(k);
    if (old) this.drop(old);
    const x0 = ix * BLOCK, y0 = iy * BLOCK;
    const g = new GeoBuilder();
    let n = 0;
    for (const s of w.near(x0 + BLOCK / 2, y0 + BLOCK / 2, BLOCK * 0.72)) {
      if (s.kind !== 'building' || !s.render) continue;
      const { cx, cy } = s.render;
      if (cx < x0 || cx >= x0 + BLOCK || cy < y0 || cy >= y0 + BLOCK) continue;
      if (this.skip(cx, cy)) continue;
      this.box(g, s);
      n++;
    }
    const geo = n ? g.build() : null;
    const b: Block = { key: k, mesh: null, count: n, stamp: 0 };
    if (geo) { b.mesh = new THREE.Mesh(geo, this.mat); b.mesh.matrixAutoUpdate = false; b.mesh.frustumCulled = true; geo.computeBoundingSphere(); this.group.add(b.mesh); }
    this.blocks.set(k, b);
  }

  private box(g: GeoBuilder, s: Solid) {
    const seed = s.render!.seed;
    const tile = FACADES[Math.floor(hash(seed, 1, 5) * FACADES.length)];
    const roof = ROOFS[Math.floor(hash(seed, 2, 7) * ROOFS.length)];
    const tint = lin('#ffffff');
    const top = Math.max(3, s.top - 0.6), base = s.base;
    for (const r of s.rings) {
      const n = r.length / 2;
      if (n < 3) continue;
      let area = 0;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; }
      const ccw = area > 0;
      // 안쪽으로 0.35 m 오그린 고리(자세한 벽 속에 숨게)
      const pts: number[][] = [];
      for (let i = 0; i < n; i++) {
        const p = (i + n - 1) % n, q = (i + 1) % n;
        const ax = r[i * 2] - r[p * 2], ay = r[i * 2 + 1] - r[p * 2 + 1], bx = r[q * 2] - r[i * 2], by = r[q * 2 + 1] - r[i * 2 + 1];
        const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
        // 두 변의 안쪽 법선 평균
        let nx = -(ay / la + by / lb), ny = ax / la + bx / lb;
        if (!ccw) { nx = -nx; ny = -ny; }
        const L = Math.hypot(nx, ny) || 1;
        pts.push([r[i * 2] + (nx / L) * 0.35, r[i * 2 + 1] + (ny / L) * 0.35]);
      }
      for (let i = 0; i < n; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
        const len = Math.hypot(bx - ax, by - ay);
        if (len < 0.3) continue;
        let nx = (by - ay) / len, ny = -(bx - ax) / len;
        if (!ccw) { nx = -nx; ny = -ny; }
        g.wall(ax, ay, bx, by, base, top, nx, ny, [0, Math.max(1, Math.round(len / 3.2))], [0, Math.max(1, Math.round((top - base) / 3.1))], tile, tint, seed);
      }
      g.flat(pts, [], top, -1, roof);
      break; // 바깥 고리만(안뜰은 멀리서 안 보인다)
    }
  }
}

const keyOf = (x: number, y: number) => `${Math.floor(x / BLOCK)},${Math.floor(y / BLOCK)}`;
