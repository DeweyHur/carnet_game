// 부딪히고, 올라서고, 기어오르는 세계. 지도에 그려진 바로 그 건물(같은 벡터 타일)을 읽어서 만든다.
// 그래서 눈에 보이는 벽과 몸이 부딪히는 벽이 같다. 카메라가 어디를 보든 상관없이, 사람 주변 z14 타일 3×3을 직접 받아 읽는다.
import { VectorTile } from '@mapbox/vector-tile';
import type { VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { Frame } from './geo';

export interface Solid {
  rings: Float64Array[]; // [x0,y0,x1,y1,…] 닫힌 고리(첫 점 반복 없음). 짝홀 규칙으로 안/밖을 가린다(안뜰 = 구멍).
  top: number;
  base: number;
  minX: number; minY: number; maxX: number; maxY: number;
  stamp: number;
  water?: boolean;
}

interface Bridge { ax: number; ay: number; bx: number; by: number; half: number }

export interface Hit { nx: number; ny: number; solid: Solid; top: number; cx: number; cy: number }

const CELL = 16;
const Z = 14;
const cellKey = (ix: number, iy: number) => (ix + 32768) * 65536 + (iy + 32768);

export class World {
  frame: Frame;
  private grid = new Map<number, Solid[]>();
  private bridges: Bridge[] = [];
  private tiles = new Set<string>();
  private lanes = new Map<number, Float64Array[]>(); // 걸어 다니는 길(OSM) — 건물 밑 통로·아케이드는 1층이 뚫려 있다
  private stamp = 1;
  count = 0;
  onLoad?: (key: string, ms: number) => void;

  constructor(frame: Frame) { this.frame = frame; }

  /** (lng,lat) 둘레 z14 타일 3×3 중 아직 없는 것을 받아 온다. template은 {z}/{x}/{y} 주소. */
  ensure(lng: number, lat: number, template: string) {
    const n = 2 ** Z;
    const tx = Math.floor(((lng + 180) / 360) * n);
    const r = (lat * Math.PI) / 180;
    const ty = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const x = tx + dx, y = ty + dy, key = `${Z}/${x}/${y}`;
      if (this.tiles.has(key)) continue;
      this.tiles.add(key);
      const url = template.replace('{z}', String(Z)).replace('{x}', String(x)).replace('{y}', String(y));
      const t0 = performance.now();
      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(String(res.status)))))
        .then((buf) => { this.read(new VectorTile(new PbfReader(buf)), x, y); this.onLoad?.(key, performance.now() - t0); })
        .catch(() => this.tiles.delete(key)); // 다음에 다시
    }
  }

  private read(vt: VectorTile, x: number, y: number) {
    const each = (name: string, f: (feat: VectorTileFeature) => void) => {
      const layer = vt.layers[name];
      if (layer) for (let i = 0; i < layer.length; i++) f(layer.feature(i));
    };
    each('building', (f) => {
      if (f.properties.hide_3d) return;
      const s = this.solidOf(f, x, y, Number(f.properties.render_height ?? 10) || 10, Number(f.properties.render_min_height ?? 0) || 0);
      if (s) this.insert(s);
    });
    each('water', (f) => { const s = this.solidOf(f, x, y, 0, -3); if (s) { s.water = true; this.insert(s); } });
    each('transportation', (f) => {
      if (f.properties.brunnel !== 'bridge') return;
      const half = /motorway|trunk|primary|secondary/.test(String(f.properties.class)) ? 13 : 8;
      for (const line of this.ringsOf(f, x, y)) for (let i = 0; i + 3 < line.length; i += 2) this.bridges.push({ ax: line[i], ay: line[i + 1], bx: line[i + 2], by: line[i + 3], half });
    });
  }

  /** 타일 좌표(0..extent) → 이 세계의 미터 좌표 */
  private ringsOf(f: VectorTileFeature, tx: number, ty: number): Float64Array[] {
    const n = 2 ** Z;
    const E = f.extent;
    return f.loadGeometry().map((ring) => {
      const out = new Float64Array(ring.length * 2);
      ring.forEach((p, i) => {
        const wx = (tx + p.x / E) / n;
        const wy = (ty + p.y / E) / n;
        const lng = wx * 360 - 180;
        const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180) / Math.PI;
        const [lx, ly] = this.frame.toLocal([lng, lat]);
        out[i * 2] = lx;
        out[i * 2 + 1] = ly;
      });
      return out;
    });
  }

  private solidOf(f: VectorTileFeature, tx: number, ty: number, top: number, base: number): Solid | null {
    const rings = this.ringsOf(f, tx, ty).map((r) => (r.length >= 4 && r[0] === r[r.length - 2] && r[1] === r[r.length - 1] ? r.subarray(0, r.length - 2) : r)).filter((r) => r.length >= 6);
    if (!rings.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rings) for (let i = 0; i < r.length; i += 2) {
      if (r[i] < minX) minX = r[i]; if (r[i] > maxX) maxX = r[i];
      if (r[i + 1] < minY) minY = r[i + 1]; if (r[i + 1] > maxY) maxY = r[i + 1];
    }
    return { rings, top, base, minX, minY, maxX, maxY, stamp: 0 };
  }

  private insert(s: Solid) {
    this.count++;
    for (let ix = Math.floor(s.minX / CELL); ix <= Math.floor(s.maxX / CELL); ix++)
      for (let iy = Math.floor(s.minY / CELL); iy <= Math.floor(s.maxY / CELL); iy++) {
        const k = cellKey(ix, iy);
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(s);
      }
  }

  /** 걷는 길을 등록한다. 건물을 가로지르는 구간은 1층 통로(아케이드·파사주)로 본다. */
  setLanes(segs: [number, number, number, number][]) {
    this.lanes.clear();
    for (const [ax, ay, bx, by] of segs) {
      const seg = new Float64Array([ax, ay, bx, by]);
      for (let ix = Math.floor(Math.min(ax, bx) / CELL); ix <= Math.floor(Math.max(ax, bx) / CELL); ix++)
        for (let iy = Math.floor(Math.min(ay, by) / CELL); iy <= Math.floor(Math.max(ay, by) / CELL); iy++) {
          const k = cellKey(ix, iy);
          let arr = this.lanes.get(k);
          if (!arr) this.lanes.set(k, (arr = []));
          arr.push(seg);
        }
    }
  }

  /** 길 한가운데서 w m 안인가 */
  onLane(x: number, y: number, w: number): boolean {
    const arr = this.lanes.get(cellKey(Math.floor(x / CELL), Math.floor(y / CELL)));
    if (!arr) return false;
    for (const s of arr) {
      const dx = s[2] - s[0], dy = s[3] - s[1];
      const L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / L)) : 0;
      if ((x - s[0] - dx * t) ** 2 + (y - s[1] - dy * t) ** 2 < w * w) return true;
    }
    return false;
  }

  /** (x,y) 주변 r m 안에 걸치는 것들 */
  near(x: number, y: number, r: number): Solid[] {
    const st = ++this.stamp;
    const out: Solid[] = [];
    for (let ix = Math.floor((x - r) / CELL); ix <= Math.floor((x + r) / CELL); ix++)
      for (let iy = Math.floor((y - r) / CELL); iy <= Math.floor((y + r) / CELL); iy++) {
        const arr = this.grid.get(cellKey(ix, iy));
        if (!arr) continue;
        for (const s of arr) {
          if (s.stamp === st) continue;
          s.stamp = st;
          if (x + r < s.minX || x - r > s.maxX || y + r < s.minY || y - r > s.maxY) continue;
          out.push(s);
        }
      }
    return out;
  }

  static contains(s: Solid, x: number, y: number): boolean {
    if (x < s.minX || x > s.maxX || y < s.minY || y > s.maxY) return false;
    let inside = false;
    for (const r of s.rings) {
      const n = r.length;
      for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const yi = r[i + 1], yj = r[j + 1];
        if ((yi > y) !== (yj > y) && x < ((r[j] - r[i]) * (y - yi)) / (yj - yi) + r[i]) inside = !inside;
      }
    }
    return inside;
  }

  /** 테두리에서 가장 가까운 점과, 바깥을 향하는 법선 */
  static closest(s: Solid, x: number, y: number): { cx: number; cy: number; d: number; nx: number; ny: number } {
    let best = Infinity, cx = x, cy = y, ex = 1, ey = 0;
    for (const r of s.rings) {
      const n = r.length;
      for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const ax = r[j], ay = r[j + 1], bx = r[i], by = r[i + 1];
        const dx = bx - ax, dy = by - ay;
        const L = dx * dx + dy * dy;
        const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
        const px = ax + dx * t, py = ay + dy * t;
        const d = (x - px) ** 2 + (y - py) ** 2;
        if (d < best) { best = d; cx = px; cy = py; ex = dx; ey = dy; }
      }
    }
    const d = Math.sqrt(best);
    const inside = World.contains(s, x, y);
    let nx: number, ny: number;
    if (d > 1e-4) { nx = (x - cx) / d; ny = (y - cy) / d; if (inside) { nx = -nx; ny = -ny; } }
    else {
      const L = Math.hypot(ex, ey) || 1;
      nx = -ey / L; ny = ex / L;
      if (World.contains(s, cx + nx * 0.05, cy + ny * 0.05)) { nx = -nx; ny = -ny; }
    }
    return { cx, cy, d: inside ? -d : d, nx, ny };
  }

  /** 발 밑의 높이: 서 있을 수 있는 가장 높은 지붕(없으면 길바닥 0) */
  ground(x: number, y: number, z: number, reach = 0.6): number {
    let g = 0;
    for (const s of this.near(x, y, 0.5)) {
      if (s.water || s.top <= g || s.top > z + reach) continue;
      if (World.contains(s, x, y)) g = s.top;
    }
    return g;
  }

  /** 몸(반지름 r, 발 z, 키 h)이 벽에 박혔으면 밀어낸다. 가장 크게 부딪힌 벽을 돌려준다. */
  collide(p: { x: number; y: number }, z: number, r: number, h: number, step: number): Hit | null {
    let hit: Hit | null = null;
    let worst = 0;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const s of this.near(p.x, p.y, r + 0.5)) {
        if (s.water) continue;
        if (s.top <= z + step || s.base >= z + h) continue; // 올라설 수 있는 높이이거나 머리 위에 떠 있다
        const c = World.closest(s, p.x, p.y);
        if (c.d >= r) continue;
        if (z < 3 && this.onLane(p.x, p.y, 1.4) && (c.d < 0 || this.onLane(c.cx - c.nx * 1.5, c.cy - c.ny * 1.5, 1.6))) continue; // 건물 밑으로 난 길(이미 들어와 있거나, 길이 벽 안으로 이어진다)
        const push = r - c.d;
        p.x += c.nx * push;
        p.y += c.ny * push;
        moved = true;
        if (push > worst || !hit) { worst = push; hit = { nx: c.nx, ny: c.ny, solid: s, top: s.top, cx: c.cx, cy: c.cy }; }
      }
      if (!moved) break;
    }
    return hit;
  }

  /** 이 점이 건물 속인가(카메라가 벽을 뚫지 않게) */
  solidAt(x: number, y: number, z: number): boolean {
    for (const s of this.near(x, y, 0.1)) if (!s.water && z < s.top && z >= s.base && World.contains(s, x, y)) return true;
    return false;
  }

  /** 물 위인가(다리 위는 뺀다) */
  water(x: number, y: number): boolean {
    let wet = false;
    for (const s of this.near(x, y, 0.1)) if (s.water && World.contains(s, x, y)) { wet = true; break; }
    if (!wet) return false;
    for (const b of this.bridges) {
      const dx = b.bx - b.ax, dy = b.by - b.ay;
      const L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - b.ax) * dx + (y - b.ay) * dy) / L)) : 0;
      if ((x - b.ax - dx * t) ** 2 + (y - b.ay - dy * t) ** 2 < b.half * b.half) return false;
    }
    return true;
  }
}
