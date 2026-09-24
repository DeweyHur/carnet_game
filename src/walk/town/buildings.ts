// 건물 한 채를 파리 건물처럼 세운다: 1층 가게(칸마다 다르게) · 윗층 창 · 띠돌림 · 발코니 · 처마 · 함석 망사르드 지붕과 굴뚝.
// 모양(다각형·높이)은 지도와 같은 타일에서 오고, 겉모습은 동네 분위기와 건물마다의 씨앗으로 정한다.
import { T } from './atlas';
import { GeoBuilder, hash, lin } from './geom';
import type { V3 } from './geom';
import { World } from '../hero/world';
import { awning } from './props';
import type { Solid } from '../hero/world';

export type Theme = 'marais' | 'saint-germain' | 'montmartre' | 'belleville' | 'champs-elysees';

interface Style { upper: number[]; yard: number; blank: number; shops: number[]; balcony: boolean; mansard: number; roof: number; tints: string[]; flowers: number; mansardTile?: number; mh?: number; turret?: 'dome' | 'cone' }

// 동네마다 흔한 겉모습. upper는 건물마다 하나를 고르고, tints는 같은 칸이라도 건물마다 조금씩 다르게 물들인다.
const STYLES: Record<string, Style> = {
  haussmann: { upper: [T.haussmann, T.cream], yard: T.yardStone, blank: T.blankStone, shops: [T.shopGreen, T.shopRed, T.shopBlack, T.shopNavy, T.cafe, T.boulangerie, T.pharmacie, T.librairie], balcony: true, mansard: 0.85, roof: T.zinc, tints: ['#ffffff', '#fbf4e6', '#f6eedc', '#fffaf0', '#f3ece4'], flowers: 0.2, turret: 'dome' },
  haussmannB: { upper: [T.haussmannB, T.haussmann], yard: T.yardStone, blank: T.blankStone, shops: [T.shopGreen, T.shopBlack, T.bistrot, T.fromagerie, T.gallery, T.shopCream], balcony: true, mansard: 0.8, roof: T.zinc, tints: ['#ffffff', '#f8efe0', '#f3eadb', '#fff6ea'], flowers: 0.3, turret: 'dome' },
  grand: { upper: [T.grand, T.cream], yard: T.yardStone, blank: T.blankStone, shops: [T.lobby, T.gallery, T.shopBlack, T.grandDoor, T.cafe], balcony: true, mansard: 0.9, roof: T.zinc, tints: ['#ffffff', '#fdf8ee', '#f7f1e6'], flowers: 0.05, turret: 'dome' },
  cream: { upper: [T.cream, T.haussmann], yard: T.yardStone, blank: T.blankStone, shops: [T.cafe, T.librairie, T.shopNavy, T.boulangerie, T.fleuriste], balcony: true, mansard: 0.85, roof: T.zinc, tints: ['#ffffff', '#fbf6ea'], flowers: 0.25, turret: 'dome' },
  grey: { upper: [T.grey], yard: T.yardStone, blank: T.blankStone, shops: [T.librairie, T.shopNavy, T.cafe, T.gallery, T.shopGreen], balcony: true, mansard: 0.7, roof: T.zinc, tints: ['#ffffff', '#f2f0ea', '#ebe8e2'], flowers: 0.15, turret: 'dome' },
  artNouveau: { upper: [T.artNouveau], yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.cafe, T.bistrot, T.gallery, T.shopGreen, T.fleuriste], balcony: true, mansard: 0.8, roof: T.zinc, tints: ['#ffffff', '#f6efe0'], flowers: 0.35, turret: 'dome' },
  ochre: { upper: [T.ochre, T.ochreRed], yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.shopRed, T.shopCream, T.epicerie, T.fleuriste, T.bistrot, T.gallery], balcony: false, mansard: 0.55, roof: T.zinc, tints: ['#ffffff', '#fbe9d0', '#f5e2c0', '#fff0dc'], flowers: 0.5, turret: 'cone' },
  plaster: { upper: [T.plaster, T.plasterBlue], yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.shopGreen, T.shopCream, T.fromagerie, T.librairie, T.cafe], balcony: false, mansard: 0.5, roof: T.zinc, tints: ['#ffffff', '#f7f1e4', '#fdf5e8'], flowers: 0.5, turret: 'cone' },
  pink: { upper: [T.pink, T.lilac], yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.cafe, T.shopCream, T.fleuriste, T.bistrot, T.boulangerie], balcony: false, mansard: 0.15, roof: T.terracotta, tints: ['#ffffff', '#fbe4dc'], flowers: 0.65, turret: 'cone' },
  yellow: { upper: [T.yellow, T.mint], yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.shopNavy, T.cafe, T.epicerie, T.gallery], balcony: false, mansard: 0.15, roof: T.terracotta, tints: ['#ffffff', '#fdf1d0'], flowers: 0.65, turret: 'cone' },
  brick: { upper: [T.brick], yard: T.brick, blank: T.blankBrick, shops: [T.brickShop, T.shutter, T.epicerie, T.marche, T.cafe], balcony: false, mansard: 0, roof: T.gravel, tints: ['#ffffff', '#f4e6de', '#efe0d6'], flowers: 0.25 },
  modern: { upper: [T.modern], yard: T.modern, blank: T.blankPlaster, shops: [T.lobby, T.shutter, T.brickShop, T.marche], balcony: false, mansard: 0, roof: T.gravel, tints: ['#ffffff', '#eef0f2'], flowers: 0.05 },
  vosges: { upper: [T.vosges], yard: T.vosges, blank: T.blankBrick, shops: [T.shopRed, T.gallery, T.cafe, T.shopBlack, T.porte], balcony: false, mansard: 1, roof: T.slate, tints: ['#ffffff', '#f7ece6'], flowers: 0.1, mansardTile: T.slate, mh: 4.2 },
};

const THEMES: Record<Theme, [string, number][]> = {
  marais: [['ochre', 3], ['plaster', 3], ['haussmannB', 2], ['haussmann', 2], ['grey', 1], ['artNouveau', 0.6]],
  'saint-germain': [['haussmann', 4], ['grey', 3], ['haussmannB', 2], ['cream', 2], ['plaster', 1], ['artNouveau', 0.8]],
  montmartre: [['pink', 2], ['yellow', 2], ['plaster', 3], ['ochre', 2], ['haussmannB', 1]],
  belleville: [['brick', 3], ['modern', 2], ['plaster', 2], ['haussmannB', 1], ['ochre', 1], ['yellow', 0.5]],
  'champs-elysees': [['grand', 4], ['haussmann', 3], ['cream', 2], ['haussmannB', 1], ['artNouveau', 0.6], ['modern', 0.7]],
};

/** 차양·화분 등 건물마다의 포인트 색 */
const ACCENTS = ['#b3262c', '#1f4a38', '#1d2f52', '#c9822c', '#6b2e5f', '#2f6d6a', '#d9a441', '#2a2a2a'];
const FLOWERS = ['#e0364f', '#f06a8a', '#ffffff', '#e05a2a', '#c43b8e'];

function pick<T>(list: [T, number][], r: number): T {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let x = r * total;
  for (const [v, w] of list) { x -= w; if (x <= 0) return v; }
  return list[list.length - 1][0];
}

const GROUND = 4.0; // 1층 높이(파리는 천장이 높다)

/** 고리의 부호 있는 넓이(반시계 +) */
export function signedArea(r: Float64Array): number {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i += 2) {
    const j = (i + 2) % n;
    a += r[i] * r[j + 1] - r[j] * r[i + 1];
  }
  return a / 2;
}

/** 다각형을 d m만큼 안으로 줄인다(각 변을 평행 이동해 이웃 변과 만나는 점). 뒤집히면 null. */
export function inset(r: Float64Array, d: number): Float64Array | null {
  const n = r.length / 2;
  if (n < 3) return null;
  const sgn = signedArea(r) > 0 ? 1 : -1; // 반시계면 왼쪽이 안
  const out = new Float64Array(r.length);
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n, q = (i + 1) % n;
    const ax = r[p * 2], ay = r[p * 2 + 1], bx = r[i * 2], by = r[i * 2 + 1], cx = r[q * 2], cy = r[q * 2 + 1];
    let e1x = bx - ax, e1y = by - ay, e2x = cx - bx, e2y = cy - by;
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    e1x /= l1; e1y /= l1; e2x /= l2; e2y /= l2;
    // 안쪽 법선
    const n1x = -e1y * sgn, n1y = e1x * sgn, n2x = -e2y * sgn, n2y = e2x * sgn;
    let mx = n1x + n2x, my = n1y + n2y;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) { mx = n1x; my = n1y; } else { mx /= ml; my /= ml; }
    const cos = mx * n1x + my * n1y;
    const k = Math.min(2.5, 1 / Math.max(0.2, cos));
    out[i * 2] = bx + mx * d * k;
    out[i * 2 + 1] = by + my * d * k;
  }
  // 변이 뒤집혔거나 넓이가 너무 줄면 포기
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ox = r[j * 2] - r[i * 2], oy = r[j * 2 + 1] - r[i * 2 + 1];
    const nx = out[j * 2] - out[i * 2], ny = out[j * 2 + 1] - out[i * 2 + 1];
    if (ox * nx + oy * ny <= 0) return null;
  }
  const a0 = Math.abs(signedArea(r)), a1 = Math.abs(signedArea(out));
  if (a1 < a0 * 0.3 || a1 > a0) return null;
  return out;
}

export interface BuildEnv {
  world: World;
  theme: Theme;
  /** 이 점(로컬 m)이 걷는 길 위인가 — 길 쪽 벽을 가린다 */
  street: (x: number, y: number) => boolean;
  /** 이 벽 앞(로컬 m, 반경 r)에 장소가 있으면 그 장소의 1층 칸 */
  shopAt: (x: number, y: number) => number | null;
  /** 특별한 구역(보주 광장 등)이면 그 겉모습 이름 */
  zone?: (x: number, y: number) => string | null;
}

export interface BuiltInfo { mansard: Float64Array | null; roofZ: number }

const ringPts = (r: Float64Array) => { const a: number[][] = []; for (let i = 0; i < r.length; i += 2) a.push([r[i], r[i + 1]]); return a; };

/** 건물 한 채의 겉모습을 geometry에 더한다 */
export function addBuilding(g: GeoBuilder, s: Solid, env: BuildEnv): BuiltInfo {
  const R = s.render!;
  const seed = R.seed;
  const h0 = hash(R.cx, R.cy, 1), h1 = hash(R.cx, R.cy, 2), h2 = hash(R.cx, R.cy, 3);
  const top = s.top, base = s.base;
  const tall = top - base;
  let styleName = env.zone?.(R.cx, R.cy) ?? pick(THEMES[env.theme], h0);
  if (tall < 7 && (styleName === 'haussmann' || styleName === 'grand' || styleName === 'cream')) styleName = 'plaster';
  const st = STYLES[styleName];
  const upperTile = st.upper[Math.floor(hash(R.cx, R.cy, 30) * st.upper.length)];
  const accent = ACCENTS[Math.floor(hash(R.cx, R.cy, 31) * ACCENTS.length)];
  const flowers = hash(R.cx, R.cy, 32) < st.flowers;
  const flowerCol = lin(FLOWERS[Math.floor(hash(R.cx, R.cy, 33) * FLOWERS.length)]);
  const tint = lin(st.tints[Math.floor(h1 * st.tints.length)]);
  const white = lin('#ffffff');
  const gTop = base > 0.5 ? base : Math.min(top, tall < 6 ? tall * 0.7 : GROUND);
  const upperH = top - gTop;
  const floors = Math.max(1, Math.round(upperH / 3.05));
  const fh = upperH / floors;
  const shopOf = st.shops;
  let doorPlaced = false;

  // 망사르드: 고리 하나짜리, 타일에 다 들어온, 충분히 크고 높은 건물만
  let mansard: Float64Array | null = null;
  const MH = st.mh ?? 2.9;
  if (R.full && R.rings.length === 1 && top >= 11 && h2 < st.mansard) {
    const area = Math.abs(signedArea(R.rings[0]));
    if (area > 70) mansard = inset(R.rings[0], st.mh ? 1.6 : 1.15);
  }

  const exposed: boolean[] = []; // 바깥 고리의 변마다: 길 쪽이고 드러난 벽인가
  for (let ri = 0; ri < R.rings.length; ri++) {
    const r = R.rings[ri];
    const cut = R.cut[ri];
    const n = r.length / 2;
    for (let i = 0; i < n; i++) {
      if (ri === 0) exposed[i] = false;
      if (cut[i]) continue;
      const j = (i + 1) % n;
      let ax = r[i * 2], ay = r[i * 2 + 1], bx = r[j * 2], by = r[j * 2 + 1];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.3) continue;
      let nx = (by - ay) / len, ny = -(bx - ax) / len;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      if (World.contains(s, mx + nx * 0.05, my + ny * 0.05)) { nx = -nx; ny = -ny; }
      // 밖에서 볼 때 왼쪽→오른쪽이 되게(아니면 간판 글자가 뒤집힌다)
      const flip = (bx - ax) * -ny + (by - ay) * nx < 0;
      if (flip) { [ax, bx] = [bx, ax]; [ay, by] = [by, ay]; }
      // 바깥에 붙은 이웃 건물 — 그 높이까지는 벽이 안 보인다(맞벽)
      const neighbour = env.world.buildingTopAt(mx + nx * 0.6, my + ny * 0.6, s);
      const from = Math.max(base, neighbour);
      if (from >= top - 0.05) continue;
      const street = env.street(mx + nx * 4, my + ny * 4) || env.street(mx + nx * 8, my + ny * 8) || env.street(mx + nx * 13, my + ny * 13) || (env.theme === 'champs-elysees' && env.street(mx + nx * 20, my + ny * 20));
      const bays = Math.max(1, Math.round(len / 2.9));
      const eseed = seed + i * 13 + ri * 101;
      if (ri === 0 && street && neighbour <= base + 0.5) exposed[i] = true;
      const tx = (bx - ax) / len, ty = (by - ay) / len;
      if (neighbour > base + 0.5) {
        // 드러난 맞벽: 창 없는 벽(가끔 오래된 광고 그림이나 벽화)
        const blank = hash(mx, my, 9) < 0.18 ? (env.theme === 'belleville' ? T.graffiti : T.ghostSign) : st.blank;
        g.wall(ax, ay, bx, by, from, top, nx, ny, [0, len / 2.9], [0, (top - from) / 3.05], blank, tint, eseed);
        continue;
      }
      // 1층: 칸마다 가게가 다르다. 길 쪽이 아니면 돌벽.
      if (base < 0.5 && gTop > 0.5) {
        for (let b = 0; b < bays; b++) {
          const t0 = b / bays, t1 = (b + 1) / bays;
          const px = ax + (bx - ax) * (t0 + t1) / 2, py = ay + (by - ay) * (t0 + t1) / 2;
          let tile: number = T.rustic;
          if (street) {
            const special = env.shopAt(px + nx * 1.5, py + ny * 1.5);
            if (special !== null) tile = special;
            else if (!doorPlaced && len > 8 && b === Math.floor(bays / 2)) { tile = T.porte; doorPlaced = true; }
            else tile = shopOf[Math.floor(hash(px, py, 4 + Math.floor(b / 2)) * shopOf.length)];
          }
          g.wall(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1, 0, gTop, nx, ny, [0, 1], [0, 1], tile, white, eseed + b);
          // 가게 칸 몇 곳엔 건물 색 차양
          if (street && tile !== T.porte && tile !== T.rustic && tile !== T.grandDoor && tile !== T.lobby && tile !== T.shutter && env.shopAt(px + nx * 1.5, py + ny * 1.5) === null && hash(px, py, 34) < 0.38 && gTop > 3.4) {
            awning(g, ax + (bx - ax) * t0 + tx * 0.15 + nx * 0.02, ay + (by - ay) * t0 + ty * 0.15 + ny * 0.02, ax + (bx - ax) * t1 - tx * 0.15 + nx * 0.02, ay + (by - ay) * t1 - ty * 0.15 + ny * 0.02, nx, ny, accent, gTop - 0.55, 1.2, 0.55);
          }
        }
        // 1층과 윗층 사이 띠돌림
        if (street && upperH > 2) ledge(g, ax, ay, bx, by, nx, ny, gTop - 0.12, 0.28, 0.2, tint, eseed);
      }
      if (upperH <= 0.2) continue;
      // 윗층: 창이 줄지어 난 벽(칸 반복)
      const upTile = len < 1.6 ? st.blank : street ? upperTile : st.yard;
      g.wall(ax, ay, bx, by, Math.max(gTop, from), top, nx, ny, [0, len < 1.6 ? len / 2.9 : bays], [(Math.max(gTop, from) - gTop) / fh, floors], upTile, tint, eseed);
      if (street && len > 2) {
        // 발코니(오스만식: 3층과 꼭대기층에 길게)
        if (st.balcony && floors >= 3) balcony(g, ax, ay, bx, by, nx, ny, gTop + fh, len, eseed);
        if (st.balcony && floors >= 5) balcony(g, ax, ay, bx, by, nx, ny, gTop + fh * (floors - 1), len, eseed + 1);
        // 처마 돌림띠
        ledge(g, ax, ay, bx, by, nx, ny, top - 0.45, 0.45, 0.38, tint, eseed);
        // 창가 화분(제라늄)
        if (flowers && len > 2) {
          for (let f = 0; f < Math.min(floors, 3); f++) {
            if (st.balcony && f === 1 && floors >= 3) continue;
            const z = gTop + f * fh + 0.17 * fh - 0.2;
            for (let k = 0; k < bays; k++) {
              if (hash(eseed, k, f + 40) < 0.25) continue;
              const t = (k + 0.5) / bays;
              const cx = ax + (bx - ax) * t + nx * 0.14, cy = ay + (by - ay) * t + ny * 0.14;
              g.box(cx, cy, z, 0.95, 0.24, 0.2, Math.atan2(ty, tx), lin('#6b4a2e'));
              for (let q = -1; q <= 1; q++) {
                g.blob(cx + tx * q * 0.3, cy + ty * q * 0.3, z + 0.28, 0.16, 0.12, 0.13, lin('#3f7a36'), 0);
                g.blob(cx + tx * q * 0.3 + nx * 0.05, cy + ty * q * 0.3 + ny * 0.05, z + 0.34, 0.09, 0.08, 0.08, flowerCol, 0);
              }
            }
          }
        }
      }
      // 망사르드 지붕의 경사면
      if (mansard && ri === 0) {
        let ix = mansard[i * 2], iy = mansard[i * 2 + 1], jx = mansard[j * 2], jy = mansard[j * 2 + 1];
        if (flip) { [ix, jx] = [jx, ix]; [iy, jy] = [jy, iy]; }
        const up: V3 = [nx * 0.93, ny * 0.93, 0.37];
        g.quad([ax, ay, top], [bx, by, top], [jx, jy, top + MH], [ix, iy, top + MH], up, [0, 0, bays, 1], st.mansardTile ?? T.mansardPlain, white, eseed);
        // 지붕창(뤼카른): 길 쪽 칸마다 튀어나온 작은 창
        if (street && len > 2.4) for (let k = 0; k < bays; k++) {
          if (bays > 2 && (k === 0 || k === bays - 1) && hash(eseed, k, 50) < 0.5) continue;
          const t = (k + 0.5) / bays;
          const fx = ax + (bx - ax) * t - nx * 0.28, fy = ay + (by - ay) * t - ny * 0.28;
          dormer(g, fx, fy, top + 0.55, tx, ty, nx, ny, upperTile === T.vosges ? T.vosges : T.cream, tint, st.mansardTile === T.slate);
        }
      }
    }
  }

  // 지붕
  const outer: number[][] = [];
  const holes: number[][][] = [];
  const sign0 = R.rings.length ? Math.sign(signedArea(R.rings[0])) : 1;
  const polys: { outer: number[][]; holes: number[][][] }[] = [];
  for (const r of R.rings) {
    if (Math.sign(signedArea(r)) === sign0 || !polys.length) polys.push({ outer: ringPts(r), holes: [] });
    else polys[polys.length - 1].holes.push(ringPts(r));
  }
  void outer; void holes;
  const roofTile = st.roof;
  for (const p of polys) g.flat(p.outer, p.holes, top + 0.02, roofTile, lin('#ffffff'), 5, seed);
  let roofZ = top;
  if (mansard) {
    g.flat(ringPts(mansard), [], top + MH, T.zinc, lin('#f4f6f8'), 5, seed);
    roofZ = top + MH;
    if (!R.roofAdded) env.world.addSolid([mansard], top, top + MH, 'roof');
    R.roofAdded = true;
  }
  // 굴뚝: 지붕 위 돌기둥 + 붉은 토관
  const chimRing = mansard ?? (R.full ? R.rings[0] : null);
  if (chimRing && chimRing.length >= 6 && tall > 6) {
    const n = chimRing.length / 2;
    const count = 1 + Math.floor(h1 * 3);
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += chimRing[i * 2]; cy += chimRing[i * 2 + 1]; }
    cx /= n; cy /= n;
    for (let c = 0; c < count; c++) {
      const k = Math.floor(hash(cx, cy, 20 + c) * n);
      const px = chimRing[k * 2] + (cx - chimRing[k * 2]) * 0.3, py = chimRing[k * 2 + 1] + (cy - chimRing[k * 2 + 1]) * 0.3;
      if (!World.contains({ ...s, rings: [chimRing] } as Solid, px, py)) continue;
      const w = 0.7 + hash(px, py, 5) * 1.3, hgt = 1.1 + hash(px, py, 6) * 0.9;
      const rot = Math.atan2(chimRing[((k + 1) % n) * 2 + 1] - chimRing[k * 2 + 1], chimRing[((k + 1) % n) * 2] - chimRing[k * 2]);
      g.box(px, py, roofZ, w, 0.55, hgt, rot, lin(styleName === 'brick' ? '#9c5a43' : '#d8ccb4'));
      const pots = Math.max(1, Math.round(w / 0.35));
      for (let q = 0; q < pots; q++) {
        const off = (q - (pots - 1) / 2) * 0.3;
        g.cyl(px + Math.cos(rot) * off, py + Math.sin(rot) * off, roofZ + hgt, 0.09, 0.08, 0.35, 6, lin('#b5583a'));
      }
    }
  }
  // 모퉁이 둥근 탑(로통드) — 길 두 개가 만나는 볼록한 모서리, 높은 건물만
  if (R.full && R.rings.length && tall >= 13 && st.turret && hash(R.cx, R.cy, 35) < 0.6) {
    const r = R.rings[0];
    const n = r.length / 2;
    const ccw = signedArea(r) > 0 ? 1 : -1;
    for (let j = 0; j < n; j++) {
      const i = (j - 1 + n) % n;
      if (!exposed[i] || !exposed[j]) continue;
      const px = r[j * 2], py = r[j * 2 + 1];
      const ax = r[i * 2], ay = r[i * 2 + 1], bx = r[((j + 1) % n) * 2], by = r[((j + 1) % n) * 2 + 1];
      const l1 = Math.hypot(px - ax, py - ay), l2 = Math.hypot(bx - px, by - py);
      if (l1 < 5 || l2 < 5) continue;
      const d1x = (px - ax) / l1, d1y = (py - ay) / l1, d2x = (bx - px) / l2, d2y = (by - py) / l2;
      const cross = d1x * d2y - d1y * d2x;
      const cos = -(d1x * d2x + d1y * d2y);
      if (cross * ccw <= 0 || cos < -0.6 || cos > 0.55) continue;
      let bxv = -d1x + d2x, byv = -d1y + d2y;
      const bl = Math.hypot(bxv, byv) || 1;
      bxv /= bl; byv /= bl;
      const cx = px + bxv * 1.25, cy = py + byv * 1.25;
      turret(g, s, cx, cy, 2.5, gTop, top, st.turret, upperTile, tint, fh, seed, env.world, R);
      break;
    }
  }
  // 평지붕: 옥상 정원·천창·안테나(건물마다 다르게)
  if (!mansard && R.full && R.rings.length && tall > 6) {
    const r = R.rings[0];
    const n = r.length / 2;
    let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += r[i * 2]; cy += r[i * 2 + 1]; }
    cx /= n; cy /= n;
    const inside = (x: number, y: number) => World.contains(s, x, y) && Math.abs(World.closest(s, x, y).d) > 0.9;
    const kind = hash(R.cx, R.cy, 36);
    if (kind < 0.3 && inside(cx, cy)) {
      // 옥상 정원: 화분 상자와 작은 나무, 파라솔
      for (let q = 0; q < 3; q++) {
        const qx = cx + (hash(cx, q, 37) - 0.5) * 6, qy = cy + (hash(cy, q, 38) - 0.5) * 6;
        if (!inside(qx, qy)) continue;
        g.box(qx, qy, top, 1.4, 0.6, 0.5, hash(q, cx, 39) * 3, lin('#8a6a4a'));
        g.blob(qx, qy, top + 0.9, 0.7, 0.5, 0.6, lin(['#4f8a3c', '#5f9a45', '#3f7a36'][q]), 0);
      }
      if (inside(cx + 1, cy)) { g.cyl(cx + 1, cy, top, 0.03, 0.03, 2.1, 5, lin('#dddddd')); g.cyl(cx + 1, cy, top + 1.9, 1.3, 0.02, 0.5, 8, lin(accent)); }
    } else if (kind < 0.55) {
      for (let q = 0; q < 2; q++) {
        const qx = cx + (hash(cx, q, 40) - 0.5) * 5, qy = cy + (hash(cy, q, 41) - 0.5) * 5;
        if (inside(qx, qy)) g.box(qx, qy, top, 1.6, 1.0, 0.45, 0, lin('#9fb6c4'));
      }
    } else if (kind < 0.8 && styleName !== 'vosges') {
      // 기계실 상자 + 안테나
      if (inside(cx, cy)) { g.box(cx, cy, top, 2.2, 1.6, 1.4, hash(cx, cy, 42) * 3, lin(styleName === 'modern' ? '#b9bcbf' : '#cfc5b0')); g.cyl(cx + 0.5, cy, top + 1.4, 0.03, 0.03, 3.2, 4, lin('#555555')); }
    }
  }
  return { mansard, roofZ };
}

/** 지붕창 하나: 경사면에서 튀어나온 상자 + 창 + 작은 박공지붕 */
function dormer(g: GeoBuilder, fx: number, fy: number, z0: number, tx: number, ty: number, nx: number, ny: number, tile: number, tint: V3, slate: boolean) {
  const w = 1.15, d = 0.8, h = 1.45;
  const rot = Math.atan2(ty, tx);
  const cx = fx - nx * (d / 2 - 0.05), cy = fy - ny * (d / 2 - 0.05);
  g.box(cx, cy, z0, w, d, h, rot, lin(slate ? '#efe6d3' : '#e8dcc3'));
  // 창(아틀라스의 창 한 칸을 가운데만 오려 붙인다)
  const ox = fx + nx * 0.06, oy = fy + ny * 0.06;
  g.wall(ox - tx * 0.42, oy - ty * 0.42, ox + tx * 0.42, oy + ty * 0.42, z0 + 0.12, z0 + h - 0.08, nx, ny, [0.22, 0.78], [0.08, 0.92], tile, tint);
  // 박공지붕
  const roof = lin(slate ? '#4c5763' : '#7d8b96');
  const zr = z0 + h, ridge = zr + 0.55;
  const fl: V3 = [fx - tx * (w / 2 + 0.08) + nx * 0.1, fy - ty * (w / 2 + 0.08) + ny * 0.1, zr];
  const fr: V3 = [fx + tx * (w / 2 + 0.08) + nx * 0.1, fy + ty * (w / 2 + 0.08) + ny * 0.1, zr];
  const bl: V3 = [fl[0] - nx * (d + 0.2), fl[1] - ny * (d + 0.2), zr];
  const br: V3 = [fr[0] - nx * (d + 0.2), fr[1] - ny * (d + 0.2), zr];
  const rf: V3 = [fx + nx * 0.1, fy + ny * 0.1, ridge];
  const rb: V3 = [fx - nx * (d + 0.1), fy - ny * (d + 0.1), ridge];
  g.plane(fl, bl, rb, rf, roof);
  g.plane(br, fr, rf, rb, roof);
  // 앞 박공(삼각)
  const tri: V3 = [fx + nx * 0.08, fy + ny * 0.08, ridge - 0.02];
  g.plane([fl[0], fl[1], zr], [fr[0], fr[1], zr], tri, tri, lin(slate ? '#efe6d3' : '#e8dcc3'));
}

/** 모퉁이 둥근 탑: 창이 난 원통 벽 + 돔(석조 동네) 또는 뾰족 원뿔(옛 동네) */
function turret(g: GeoBuilder, s: Solid, cx: number, cy: number, r: number, z0: number, top: number, kind: 'dome' | 'cone', tile: number, tint: V3, fh: number, seed: number, world: World, R: NonNullable<Solid['render']>) {
  const segs = 14;
  let u = 0;
  for (let k = 0; k < segs; k++) {
    const a0 = (k / segs) * Math.PI * 2, a1 = ((k + 1) / segs) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
    const am = (a0 + a1) / 2;
    const arc = r * (a1 - a0);
    const mx = cx + Math.cos(am) * r, my = cy + Math.sin(am) * r;
    if (World.contains(s, mx + Math.cos(am) * 0.1, my + Math.sin(am) * 0.1)) { u += arc / 2.9; continue; } // 건물 속 — 안 보인다
    // 밖에서 볼 때 왼→오: 반시계로 도는 원에서는 a1 쪽이 오른쪽
    g.wall(x0, y0, x1, y1, z0, top, Math.cos(am), Math.sin(am), [u, u + arc / 2.9], [0, (top - z0) / fh], tile, tint, seed + k);
    u += arc / 2.9;
  }
  // 처마 고리 + 돔
  g.cyl(cx, cy, top - 0.4, r + 0.35, r + 0.35, 0.45, segs, lin('#ece2cc'));
  if (kind === 'dome') {
    g.cyl(cx, cy, top + 0.05, r + 0.1, r * 0.95, 0.6, segs, lin('#7d8b96'));
    const prof: [number, number][] = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([r * 0.95 * Math.cos(t * Math.PI / 2) ** 0.8, top + 0.65 + 3.2 * Math.sin(t * Math.PI / 2)]); }
    for (let i = 0; i < 8; i++) {
      const [r0, z0b] = prof[i], [r1, z1b] = prof[i + 1];
      g.cyl(cx, cy, z0b, r0, r1, z1b - z0b, segs, lin('#6f7e8a'), 0, false);
    }
    g.cyl(cx, cy, top + 3.8, 0.25, 0.18, 0.7, 6, lin('#e9dfc8'));
    g.cyl(cx, cy, top + 4.5, 0.05, 0.02, 1.1, 4, lin('#c9a14a'));
  } else {
    g.cyl(cx, cy, top + 0.05, r + 0.15, 0.05, 4.5, segs, lin('#4c5763'));
    g.cyl(cx, cy, top + 4.5, 0.04, 0.02, 0.9, 4, lin('#2a2a2a'));
  }
  if (!R.turretAdded) { world.addSolid([circle(cx, cy, r, 10)], z0, top + 0.4, 'prop'); R.turretAdded = true; }
}

function circle(x: number, y: number, r: number, n: number) {
  const a = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; a[i * 2] = x + Math.cos(t) * r; a[i * 2 + 1] = y + Math.sin(t) * r; }
  return a;
}

/** 벽에서 튀어나온 띠(발코니 바닥·처마·띠돌림) */
function ledge(g: GeoBuilder, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, z: number, h: number, depth: number, tint: V3, seed: number) {
  const ox = nx * depth, oy = ny * depth;
  g.wall(ax + ox, ay + oy, bx + ox, by + oy, z, z + h, nx, ny, [0, Math.hypot(bx - ax, by - ay) / 2.9], [0, 0.35], T.cornice, tint, seed);
  g.quad([ax, ay, z + h], [bx, by, z + h], [bx + ox, by + oy, z + h], [ax + ox, ay + oy, z + h], [0, 0, 1], [0, 0, 1, 0.2], T.cornice, tint, seed);
  g.quad([ax + ox, ay + oy, z], [bx + ox, by + oy, z], [bx, by, z], [ax, ay, z], [0, 0, -1], [0, 0, 1, 0.2], T.cornice, lin('#b8ad98'), seed);
}

/** 쇠 난간 발코니 */
function balcony(g: GeoBuilder, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, z: number, len: number, seed: number) {
  const depth = 0.55;
  ledge(g, ax, ay, bx, by, nx, ny, z - 0.14, 0.14, depth, lin('#f0e8d8'), seed);
  const ox = nx * (depth - 0.03), oy = ny * (depth - 0.03);
  g.wall(ax + ox, ay + oy, bx + ox, by + oy, z, z + 1.0, nx, ny, [0, len / 1.3], [0, 1], T.railing, lin('#ffffff'), seed);
}
