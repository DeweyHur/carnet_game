// 건물 한 채를 파리 건물처럼 세운다: 1층 가게(칸마다 다르게) · 윗층 창 · 띠돌림 · 발코니 · 처마 · 함석 망사르드 지붕과 굴뚝.
// 모양(다각형·높이)은 지도와 같은 타일에서 오고, 겉모습은 동네 분위기와 건물마다의 씨앗으로 정한다.
import { T } from './atlas';
import { GeoBuilder, hash, lin } from './geom';
import type { V3 } from './geom';
import { World } from '../hero/world';
import type { Solid } from '../hero/world';

export type Theme = 'marais' | 'saint-germain' | 'montmartre' | 'belleville' | 'champs-elysees';

interface Style { upper: number; yard: number; blank: number; shops: number[]; balcony: boolean; mansard: number; roof: number; tints: string[] }

// 동네마다 흔한 겉모습. tints는 같은 칸이라도 건물마다 조금씩 다르게 물들인다.
const STYLES: Record<string, Style> = {
  haussmann: { upper: T.haussmann, yard: T.yardStone, blank: T.blankStone, shops: [T.shopGreen, T.shopRed, T.shopBlack, T.shopNavy, T.cafe, T.boulangerie, T.pharmacie, T.librairie], balcony: true, mansard: 0.85, roof: T.zinc, tints: ['#ffffff', '#fbf4e6', '#f6eedc', '#fffaf0'] },
  haussmannB: { upper: T.haussmannB, yard: T.yardStone, blank: T.blankStone, shops: [T.shopGreen, T.shopBlack, T.bistrot, T.fromagerie, T.gallery, T.shopCream], balcony: true, mansard: 0.8, roof: T.zinc, tints: ['#ffffff', '#f8efe0', '#f3eadb'] },
  grand: { upper: T.grand, yard: T.yardStone, blank: T.blankStone, shops: [T.lobby, T.gallery, T.shopBlack, T.grandDoor, T.cafe], balcony: true, mansard: 0.9, roof: T.zinc, tints: ['#ffffff', '#fdf8ee'] },
  grey: { upper: T.grey, yard: T.yardStone, blank: T.blankStone, shops: [T.librairie, T.shopNavy, T.cafe, T.gallery, T.shopGreen], balcony: true, mansard: 0.7, roof: T.zinc, tints: ['#ffffff', '#f2f0ea'] },
  ochre: { upper: T.ochre, yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.shopRed, T.shopCream, T.epicerie, T.fleuriste, T.bistrot, T.gallery], balcony: false, mansard: 0.55, roof: T.zinc, tints: ['#ffffff', '#fbe9d0', '#f5e2c0'] },
  plaster: { upper: T.plaster, yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.shopGreen, T.shopCream, T.fromagerie, T.librairie, T.cafe], balcony: false, mansard: 0.5, roof: T.zinc, tints: ['#ffffff', '#f7f1e4'] },
  pink: { upper: T.pink, yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.cafe, T.shopCream, T.fleuriste, T.bistrot, T.boulangerie], balcony: false, mansard: 0.15, roof: T.terracotta, tints: ['#ffffff', '#fbe4dc'] },
  yellow: { upper: T.yellow, yard: T.yardPlaster, blank: T.blankPlaster, shops: [T.shopNavy, T.cafe, T.epicerie, T.gallery], balcony: false, mansard: 0.15, roof: T.terracotta, tints: ['#ffffff', '#fdf1d0'] },
  brick: { upper: T.brick, yard: T.brick, blank: T.blankBrick, shops: [T.brickShop, T.shutter, T.epicerie, T.marche, T.cafe], balcony: false, mansard: 0, roof: T.gravel, tints: ['#ffffff', '#f4e6de'] },
  modern: { upper: T.modern, yard: T.modern, blank: T.blankPlaster, shops: [T.lobby, T.shutter, T.brickShop, T.marche], balcony: false, mansard: 0, roof: T.gravel, tints: ['#ffffff', '#eef0f2'] },
};

const THEMES: Record<Theme, [string, number][]> = {
  marais: [['ochre', 3], ['plaster', 3], ['haussmannB', 2], ['haussmann', 2], ['grey', 1]],
  'saint-germain': [['haussmann', 4], ['grey', 3], ['haussmannB', 2], ['plaster', 1]],
  montmartre: [['pink', 2], ['yellow', 2], ['plaster', 3], ['ochre', 2], ['haussmannB', 1]],
  belleville: [['brick', 3], ['modern', 2], ['plaster', 2], ['haussmannB', 1], ['ochre', 1]],
  'champs-elysees': [['grand', 4], ['haussmann', 3], ['haussmannB', 1], ['modern', 1]],
};

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
  let styleName = pick(THEMES[env.theme], h0);
  if (tall < 7 && (styleName === 'haussmann' || styleName === 'grand')) styleName = 'plaster';
  const st = STYLES[styleName];
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
  const MH = 2.9;
  if (R.full && R.rings.length === 1 && top >= 11 && h2 < st.mansard) {
    const area = Math.abs(signedArea(R.rings[0]));
    if (area > 70) mansard = inset(R.rings[0], 1.15);
  }

  for (let ri = 0; ri < R.rings.length; ri++) {
    const r = R.rings[ri];
    const cut = R.cut[ri];
    const n = r.length / 2;
    for (let i = 0; i < n; i++) {
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
        }
        // 1층과 윗층 사이 띠돌림
        if (street && upperH > 2) ledge(g, ax, ay, bx, by, nx, ny, gTop - 0.12, 0.28, 0.2, tint, eseed);
      }
      if (upperH <= 0.2) continue;
      // 윗층: 창이 줄지어 난 벽(칸 반복)
      const upTile = len < 1.6 ? st.blank : street ? st.upper : st.yard;
      g.wall(ax, ay, bx, by, Math.max(gTop, from), top, nx, ny, [0, len < 1.6 ? len / 2.9 : bays], [(Math.max(gTop, from) - gTop) / fh, floors], upTile, tint, eseed);
      if (street && len > 2) {
        // 발코니(오스만식: 3층과 꼭대기층에 길게)
        if (st.balcony && floors >= 3) balcony(g, ax, ay, bx, by, nx, ny, gTop + fh, len, eseed);
        if (st.balcony && floors >= 5) balcony(g, ax, ay, bx, by, nx, ny, gTop + fh * (floors - 1), len, eseed + 1);
        // 처마 돌림띠
        ledge(g, ax, ay, bx, by, nx, ny, top - 0.45, 0.45, 0.38, tint, eseed);
      }
      // 망사르드 지붕의 경사면
      if (mansard && ri === 0) {
        let ix = mansard[i * 2], iy = mansard[i * 2 + 1], jx = mansard[j * 2], jy = mansard[j * 2 + 1];
        if (flip) { [ix, jx] = [jx, ix]; [iy, jy] = [jy, iy]; }
        const up: V3 = [nx * 0.93, ny * 0.93, 0.37];
        g.quad([ax, ay, top], [bx, by, top], [jx, jy, top + MH], [ix, iy, top + MH], up, [0, 0, bays, 1], street && len > 3 ? T.mansard : T.mansardPlain, white, eseed);
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
  return { mansard, roofZ };
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
