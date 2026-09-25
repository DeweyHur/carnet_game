// 미니맵: 오른쪽 위 동그란 지도. 보는 쪽이 늘 위(카메라를 따라 돈다), 높이 오를수록 넓게 보인다.
// 바탕(강·공원·건물·길)은 가끔 한 장으로 그려 두고, 매번은 돌려 붙인 뒤 움직이는 것(사람·헬기·열기구·빛기둥)만 찍는다.
import type { World } from './hero/world';

export interface MiniMark { x: number; y: number; icon: string; dim?: boolean }
export interface MiniBlip { kind: 'balloon' | 'jumper' | 'jet' | 'birds'; x: number; y: number; h?: number }
export interface MiniSrc {
  world(): World;
  body(): { x: number; y: number; z: number; facing: number };
  yaw(): number;
  /** 걷는 길(로컬 선분 x0,y0,x1,y1…) — 원점이 바뀌면 새 배열 */
  lanes(): Float64Array;
  marks(): MiniMark[];
  dots(): { x: number; y: number }[];
  route(): [number, number][] | null;
  heli(): { x: number; y: number; h: number } | null;
  sky(): MiniBlip[];
  beacon(): [number, number] | null;
}

const CSS = { big: 156, small: 108 };
const LANE_CELL = 200;

export class Minimap {
  readonly el: HTMLElement;
  private readonly cv: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly base = document.createElement('canvas');
  private readonly bg: CanvasRenderingContext2D;
  private readonly src: MiniSrc;
  private px = 0; // 반지름(기기 화소)
  private dpr = 1;
  private range = 180; // 보이는 반지름(m)
  private acc = 0;
  private baseAt = { x: 1e9, y: 1e9, range: 0, t: 0, lanes: null as Float64Array | null };
  private label: HTMLElement;
  visible = true;

  constructor(src: MiniSrc, onClick: () => void) {
    this.src = src;
    this.el = document.createElement('div');
    this.el.className = 'minimap';
    this.el.title = '미니맵 — 누르면 큰 지도 (M)';
    this.cv = document.createElement('canvas');
    this.label = document.createElement('span');
    this.label.className = 'mm-scale';
    this.el.append(this.cv, this.label);
    document.body.appendChild(this.el);
    this.g = this.cv.getContext('2d')!;
    this.bg = this.base.getContext('2d')!;
    this.el.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); onClick(); });
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private resize() {
    const css = innerWidth < 700 ? CSS.small : CSS.big;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.px = Math.round((css / 2) * this.dpr);
    this.cv.width = this.cv.height = this.px * 2;
    this.cv.style.width = this.cv.style.height = `${css}px`;
    this.baseAt.range = 0; // 다시 그린다
  }

  update(dt: number) {
    this.el.classList.toggle('on', this.visible);
    if (!this.visible) return;
    const b = this.src.body();
    // 높을수록 넓게(헬기 420 m에서 1.2 km쯤)
    const h = Math.max(0, b.z - this.src.world().relief.hill(b.x, b.y));
    const want = Math.max(170, Math.min(1400, 170 + h * 2.4));
    this.range += (want - this.range) * Math.min(1, dt * 2.5);
    this.acc += dt;
    if (this.acc < 0.1) return; // 초당 10번
    this.acc = 0;
    this.draw(b);
  }

  private draw(b: { x: number; y: number; z: number; facing: number }) {
    const P = this.px, R = this.range, s = P / R, g = this.g;
    const lanes = this.src.lanes();
    const B = this.baseAt;
    const t = performance.now();
    // 바탕은 넉넉히 그려 두었으니, 급하지 않으면 0.4초에 한 번만 다시 그린다
    const moved = Math.hypot(b.x - B.x, b.y - B.y), zr = R / (B.range || 1);
    const stale = moved > R * 0.3 || zr > 1.18 || zr < 0.85 || t - B.t > 2500;
    const urgent = B.lanes !== lanes || moved > R * 0.6 || zr > 1.4 || zr < 0.7;
    if (urgent || (stale && t - B.t > 400)) this.paintBase(b.x, b.y, R, lanes);
    const yaw = (this.src.yaw() * Math.PI) / 180;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const scr = (x: number, y: number): [number, number] => { const dx = (x - b.x) * s, dy = (y - b.y) * s; return [P + dx * cs - dy * sn, P - (dx * sn + dy * cs)]; };

    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, P * 2, P * 2);
    g.save();
    g.beginPath(); g.arc(P, P, P - this.dpr, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#e6dcc6'; g.fillRect(0, 0, P * 2, P * 2);
    // 바탕 한 장을 돌려 붙인다
    const bs = this.base.width / 2, sb = this.pxOf(B.range);
    const k = s / sb; // 바탕을 그린 뒤로 넓어졌으면 줄여 붙인다
    g.translate(P, P);
    g.rotate(-yaw);
    g.scale(k, k);
    g.drawImage(this.base, -(bs + (b.x - B.x) * sb), -(bs - (b.y - B.y) * sb));
    g.setTransform(1, 0, 0, 1, 0, 0);
    const d = this.dpr;
    // 헬기 노선
    const route = this.src.route();
    if (route && route.length > 1) {
      g.strokeStyle = '#c8333acc'; g.lineWidth = 2.2 * d; g.setLineDash([6 * d, 5 * d]);
      g.beginPath();
      route.forEach(([x, y], i) => { const [sx, sy] = scr(x, y); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
      g.stroke(); g.setLineDash([]);
    }
    // 사람들
    g.fillStyle = '#5b4a3acc';
    const r0 = 1.6 * d;
    for (const n of this.src.dots()) {
      if (Math.abs(n.x - b.x) > R || Math.abs(n.y - b.y) > R) continue;
      const [sx, sy] = scr(n.x, n.y);
      g.fillRect(sx - r0, sy - r0, r0 * 2, r0 * 2);
    }
    // 장소·역
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${Math.round(12 * d)}px sans-serif`;
    for (const m of this.src.marks()) {
      if (Math.abs(m.x - b.x) > R * 1.05 || Math.abs(m.y - b.y) > R * 1.05) continue;
      const [sx, sy] = scr(m.x, m.y);
      g.globalAlpha = m.dim ? 0.55 : 1;
      g.fillStyle = '#fbf7ef'; g.beginPath(); g.arc(sx, sy, 7.5 * d, 0, Math.PI * 2); g.fill();
      g.fillText(m.icon, sx, sy + 0.5 * d);
    }
    g.globalAlpha = 1;
    // 하늘의 것들
    g.font = `${Math.round(11 * d)}px sans-serif`;
    for (const k2 of this.src.sky()) {
      if (Math.abs(k2.x - b.x) > R || Math.abs(k2.y - b.y) > R) continue;
      const [sx, sy] = scr(k2.x, k2.y);
      g.fillText(k2.kind === 'balloon' ? '🎈' : k2.kind === 'jumper' ? '🪂' : k2.kind === 'jet' ? '✈️' : '🐦', sx, sy);
    }
    const heli = this.src.heli();
    if (heli && Math.hypot(heli.x - b.x, heli.y - b.y) > R * 0.04) { // 타고 있으면 내 화살이 곧 헬기
      const [sx, sy] = scr(heli.x, heli.y);
      g.font = `${Math.round(14 * d)}px sans-serif`;
      g.fillText('🚁', sx, sy);
    }
    // 빛기둥(가는 곳): 밖이면 가장자리에 화살표
    const bc = this.src.beacon();
    if (bc) {
      let [sx, sy] = scr(bc[0], bc[1]);
      const ex = sx - P, ey = sy - P, L = Math.hypot(ex, ey), lim = P - 10 * d;
      const out = L > lim;
      if (out) { sx = P + (ex / L) * lim; sy = P + (ey / L) * lim; }
      g.fillStyle = '#35c9ef'; g.strokeStyle = '#fff'; g.lineWidth = 2 * d;
      g.beginPath(); g.arc(sx, sy, (out ? 5 : 6.5) * d, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // 나: 보는 쪽 부채꼴 + 몸 방향 화살
    g.fillStyle = '#ffffff40';
    g.beginPath(); g.moveTo(P, P); g.arc(P, P, P * 0.55, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); g.closePath(); g.fill();
    g.save();
    g.translate(P, P);
    g.rotate(((b.facing - this.src.yaw()) * Math.PI) / 180);
    g.fillStyle = '#e4572e'; g.strokeStyle = '#fff'; g.lineWidth = 2 * d; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, -9 * d); g.lineTo(6.5 * d, 7 * d); g.lineTo(0, 3.5 * d); g.lineTo(-6.5 * d, 7 * d); g.closePath();
    g.stroke(); g.fill();
    g.restore();
    g.restore();
    // 테두리 + 북쪽
    g.strokeStyle = '#1f1b16'; g.lineWidth = 3 * d;
    g.beginPath(); g.arc(P, P, P - 1.5 * d, 0, Math.PI * 2); g.stroke();
    const nx = P - sn * (P - 10 * d), ny = P - cs * (P - 10 * d);
    g.fillStyle = '#1f1b16'; g.beginPath(); g.arc(nx, ny, 8 * d, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = `bold ${Math.round(10 * d)}px sans-serif`; g.fillText('N', nx, ny + 0.5 * d);
    const m = R * 0.5;
    this.label.textContent = m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 50) * 50} m`;
  }

  private laneIdx: { src: Float64Array | null; cells: Map<number, number[]> } = { src: null, cells: new Map() };
  /** 길 선분을 칸(200 m)으로 나눠 둔다 — 길이 10만 개가 넘는다 */
  private indexLanes(l: Float64Array) {
    if (this.laneIdx.src === l) return this.laneIdx.cells;
    const cells = new Map<number, number[]>();
    for (let i = 0; i < l.length; i += 4) {
      const k = Math.floor((l[i] + l[i + 2]) / 2 / LANE_CELL) * 65536 + Math.floor((l[i + 1] + l[i + 3]) / 2 / LANE_CELL);
      const c = cells.get(k);
      if (c) c.push(i); else cells.set(k, [i]);
    }
    this.laneIdx = { src: l, cells };
    return cells;
  }

  /** 바탕 한 장에서 1 m가 몇 화소인가 */
  private pxOf(range: number) { return this.px / range; }

  /** 바탕: 강·공원·건물·길을 북쪽 위로 넉넉히(대각선까지) 그려 둔다 */
  private paintBase(cx: number, cy: number, R: number, lanes: Float64Array) {
    const P = this.px, s = P / R;
    const half = Math.ceil(P * 1.75); // 돌려도·조금 걸어도 비지 않게
    if (this.base.width !== half * 2) this.base.width = this.base.height = half * 2;
    const g = this.bg, w = this.src.world();
    const X = (x: number) => half + (x - cx) * s, Y = (y: number) => half - (y - cy) * s;
    const span = (half / s);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#e6dcc6';
    g.fillRect(0, 0, half * 2, half * 2);
    const poly = (rings: Float64Array[]) => {
      g.beginPath();
      for (const r of rings) {
        for (let i = 0; i < r.length; i += 2) { const sx = X(r[i]), sy = Y(r[i + 1]); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); }
        g.closePath();
      }
    };
    const inView = (r: Float64Array) => {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i < r.length; i += 2) { const x = r[i], y = r[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return x1 > cx - span && x0 < cx + span && y1 > cy - span && y0 < cy + span;
    };
    g.fillStyle = '#a9cb8a';
    for (const r of w.greens) if (inView(r)) { poly([r]); g.fill('evenodd'); }
    g.fillStyle = '#86b6dc';
    for (const r of w.waters) if (inView(r)) { poly([r]); g.fill('evenodd'); }
    // 길(흰 줄)
    g.strokeStyle = '#fbf7ef'; g.lineCap = 'round';
    g.lineWidth = Math.max(1.2 * this.dpr, Math.min(4 * this.dpr, 7 * s));
    g.beginPath();
    const idx = this.indexLanes(lanes), C = LANE_CELL;
    for (let ix = Math.floor((cx - span) / C) - 1; ix <= Math.floor((cx + span) / C) + 1; ix++) for (let iy = Math.floor((cy - span) / C) - 1; iy <= Math.floor((cy + span) / C) + 1; iy++) for (const i of idx.get(ix * 65536 + iy) ?? []) {
      const ax = lanes[i], ay = lanes[i + 1], bx = lanes[i + 2], by = lanes[i + 3];
      if (Math.max(ax, bx) < cx - span || Math.min(ax, bx) > cx + span || Math.max(ay, by) < cy - span || Math.min(ay, by) > cy + span) continue;
      g.moveTo(X(ax), Y(ay)); g.lineTo(X(bx), Y(by));
    }
    g.stroke();
    // 건물(가까이 볼 때만 — 멀리서는 길과 강이면 충분하다)
    if (R < 600) {
      g.fillStyle = '#c7b89c'; g.strokeStyle = '#a8977a'; g.lineWidth = this.dpr * 0.6;
      let n = 0;
      for (const so of w.near(cx, cy, span * 1.1)) {
        if (so.kind !== 'building') continue;
        poly(so.rings); g.fill('evenodd');
        if (R < 320) g.stroke();
        if (++n > 5000) break;
      }
    }
    this.baseAt = { x: cx, y: cy, range: R, t: performance.now(), lanes };
  }
}
