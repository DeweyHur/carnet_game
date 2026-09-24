// 땅의 높낮이. 길과 건물은 평평하게 두고, 그 사이의 땅만 움직인다:
//  - 공원 잔디밭은 완만하게 굽이친다(길·가장자리에서는 0으로 스며든다)
//  - 강은 둑 아래로 가라앉는다(물 위 WATER_Z, 바닥 BED_Z) — 둑 벽은 Ground가 세운다
// 도시 전체의 언덕(몽마르트르 등)은 지도 엔진(MapLibre)의 평평한 먼 풍경과 어긋나서 아직 넣지 않았다.
import type { World } from './world';

export const WATER_Z = -2.2; // 센 강 물낯(둑 위 길 = 0)
export const BED_Z = -4.6;

const CH = 32; // 캐시 덩어리(m)
const ST = 2; // 표본 간격(m)
const NS = CH / ST + 1;

export interface Ring { r: Float64Array; minX: number; minY: number; maxX: number; maxY: number }
export function ringOf(r: Float64Array): Ring {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < r.length; i += 2) { minX = Math.min(minX, r[i]); maxX = Math.max(maxX, r[i]); minY = Math.min(minY, r[i + 1]); maxY = Math.max(maxY, r[i + 1]); }
  return { r, minX, minY, maxX, maxY };
}
export function inRing(g: Ring, x: number, y: number): boolean {
  if (x < g.minX || x > g.maxX || y < g.minY || y > g.maxY) return false;
  const r = g.r;
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const yi = r[i + 1], yj = r[j + 1];
    if (yi > y !== yj > y && x < ((r[j] - r[i]) * (y - yi)) / (yj - yi) + r[i]) inside = !inside;
  }
  return inside;
}
/** 고리 가장자리까지의 거리(최대 cap) */
export function edgeDist(g: Ring, x: number, y: number, cap: number): number {
  let d2 = cap * cap;
  const r = g.r;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const ax = r[j], ay = r[j + 1], dx = r[i] - ax, dy = r[i + 1] - ay;
    const L = dx * dx + dy * dy;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
    const ex = x - ax - dx * t, ey = y - ay - dy * t;
    const e = ex * ex + ey * ey;
    if (e < d2) d2 = e;
  }
  return Math.sqrt(d2);
}

// 값 잡음(정수 격자 해시 + 부드러운 보간)
function h2(ix: number, iy: number) { let n = (ix * 374761393 + iy * 668265263) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
export function vnoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(ix, iy), b = h2(ix + 1, iy), c = h2(ix, iy + 1), d = h2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 파리의 언덕(센 강 둑 = 0 기준, m). 실제 높이를 바탕으로 한 모양 — 반경 r0에서 절반, p가 클수록 가파른 둔덕.
const HILLS: { pos: [number, number]; H: number; r0: number; p: number }[] = [
  { pos: [2.3431, 48.8867], H: 100, r0: 560, p: 4 }, // 몽마르트르(사크레쾨르)
  { pos: [2.3965, 48.8740], H: 95, r0: 1200, p: 4 }, // 벨빌·메닐몽탕 고개
  { pos: [2.3830, 48.8800], H: 45, r0: 330, p: 4 }, // 뷔트쇼몽
  { pos: [2.3461, 48.8462], H: 33, r0: 480, p: 4 }, // 생트주느비에브 언덕(팡테옹)
  { pos: [2.2830, 48.8622], H: 38, r0: 480, p: 6 }, // 샤요 언덕(트로카데로)
  { pos: [2.2950, 48.8738], H: 28, r0: 950, p: 3 }, // 에투알(개선문)
];
// 센 강 한가운데 선(서→동) — 강가로 갈수록 언덕이 낮아진다(강은 골짜기 바닥)
const SEINE: [number, number][] = [
  [2.2700, 48.8440], [2.2800, 48.8505], [2.2870, 48.8555], [2.2922, 48.8610], [2.3014, 48.8640], [2.3100, 48.8642], [2.3190, 48.8637],
  [2.3290, 48.8600], [2.3413, 48.8570], [2.3470, 48.8563], [2.3520, 48.8545], [2.3575, 48.8525], [2.3610, 48.8500], [2.3665, 48.8455], [2.3760, 48.8385], [2.3900, 48.8300],
];

export class Relief {
  private hillL: { x: number; y: number; H: number; r0: number; p: number }[] = [];
  private seineL: number[] = [];
  /** 도시 규모의 언덕을 쓰나(거리 세계만 — 지하철 장면은 평평) */
  hillsOn = false;
  enableHills(toLocal: (p: [number, number]) => [number, number]) {
    this.hillsOn = true;
    this.hillL = HILLS.map((h) => { const [x, y] = toLocal(h.pos); return { x, y, H: h.H, r0: h.r0, p: h.p }; });
    this.seineL = SEINE.flatMap((p) => toLocal(p));
    this.clear();
  }
  /** 언덕 높이만(건물을 올려 앉힐 때) — 둔덕·강바닥은 빼고 */
  hill(x: number, y: number): number {
    if (!this.hillsOn) return 0;
    let h = 0;
    for (const k of this.hillL) {
      const d = Math.hypot(x - k.x, y - k.y) / k.r0;
      if (d > 4) continue;
      h += k.H / (1 + d ** k.p);
    }
    if (h < 0.05) return 0;
    // 강가 골짜기: 강 한가운데서 30 m까지 0, 380 m에서 온전히
    let d2 = Infinity;
    const s = this.seineL;
    for (let i = 0; i + 3 < s.length; i += 2) {
      const ax = s[i], ay = s[i + 1], dx = s[i + 2] - ax, dy = s[i + 3] - ay;
      const L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L)) : 0;
      d2 = Math.min(d2, (x - ax - dx * t) ** 2 + (y - ay - dy * t) ** 2);
    }
    return h * smooth(30, 380, Math.sqrt(d2));
  }
  private cache = new Map<number, Float32Array>();
  readonly parks: Ring[] = [];
  private readonly w: World;
  /** 바뀔 때마다 늘어난다(땅을 다시 그릴 때가 됐나) */
  version = 0;

  constructor(w: World) { this.w = w; }

  addParks(rings: Float64Array[]) { for (const r of rings) if (r.length >= 6) this.parks.push(ringOf(r)); this.clear(); }
  clear() { this.cache.clear(); this.version++; }

  /** 이 자리 땅 높이(m) */
  height(x: number, y: number): number {
    const cx = Math.floor(x / CH), cy = Math.floor(y / CH);
    const key = (cx + 32768) * 65536 + (cy + 32768);
    let c = this.cache.get(key);
    if (!c) { c = this.chunk(cx, cy); this.cache.set(key, c); }
    const lx = (x - cx * CH) / ST, ly = (y - cy * CH) / ST;
    const ix = Math.min(NS - 2, Math.floor(lx)), iy = Math.min(NS - 2, Math.floor(ly));
    const fx = lx - ix, fy = ly - iy;
    const a = c[iy * NS + ix], b = c[iy * NS + ix + 1], d = c[(iy + 1) * NS + ix], e = c[(iy + 1) * NS + ix + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }

  private chunk(cx: number, cy: number): Float32Array {
    const out = new Float32Array(NS * NS);
    for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) out[j * NS + i] = this.sample(cx * CH + i * ST, cy * CH + j * ST);
    return out;
  }

  /** 계산(캐시 없이) */
  private wetBoxes: Ring[] = [];
  sample(x: number, y: number): number { return this.hill(x, y) + this.local(x, y); }
  /** 언덕 위에 얹는 것: 공원 둔덕, 강바닥 */
  private local(x: number, y: number): number {
    // 빠른 길: 물·공원 근처가 아니면 평지
    const ws = this.w.waters;
    if (this.wetBoxes.length !== ws.length) this.wetBoxes = ws.map((r) => ringOf(r));
    let maybe = false;
    for (const g of this.wetBoxes) if (x >= g.minX && x <= g.maxX && y >= g.minY && y <= g.maxY) { maybe = true; break; }
    if (maybe && this.w.water(x, y)) return BED_Z;
    if (!maybe) { let park = false; for (const p of this.parks) if (x >= p.minX && x <= p.maxX && y >= p.minY && y <= p.maxY) { park = true; break; } if (!park) return 0; }
    let m = 0;
    for (const p of this.parks) if (inRing(p, x, y)) { m = Math.max(m, smooth(2, 18, edgeDist(p, x, y, 18))); if (m >= 1) break; }
    if (m <= 0) return 0;
    const lf = smooth(3.5, 13, this.w.laneDist(x, y, 13));
    if (lf <= 0) return 0;
    // 완만한 둔덕 둘 겹(40 m, 13 m 결) — 대부분 위로 솟고 가끔 오목하다
    const n = 1.5 * vnoise(x / 41 + 7.3, y / 41 - 2.1) + 0.45 * vnoise(x / 13.5 - 3.7, y / 13.5 + 9.2) - 0.55;
    return n * m * lf;
  }
}
