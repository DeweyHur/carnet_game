// 여러 도형을 한 BufferGeometry로 모은다. 모든 꼭짓점에 칸(tile)·색(tint)·빛(glow)·씨앗(seed)이 붙는다.
import * as THREE from 'three';

export type V3 = [number, number, number];

/** 결정적인 해시(0..1) — 같은 자리엔 늘 같은 것이 놓인다 */
export function hash(x: number, y: number, k = 0): number {
  let h = Math.imul(Math.round(x * 10) | 0, 374761393) ^ Math.imul(Math.round(y * 10) | 0, 668265263) ^ Math.imul(k | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) % 1000003) / 1000003;
}

const col = (c: THREE.ColorRepresentation) => { const x = new THREE.Color(c); return [x.r, x.g, x.b] as V3; };
const colorCache = new Map<string | number, V3>();
export function lin(c: string | number): V3 {
  let v = colorCache.get(c);
  if (!v) colorCache.set(c, (v = col(c)));
  return v;
}

/** 단위 공 꼭짓점 — 매번 도형을 새로 만들지 않게 detail마다 한 번만 */
const balls = new Map<number, Float32Array>();
function unitBall(detail: number): Float32Array {
  let a = balls.get(detail);
  if (!a) { const g = new THREE.IcosahedronGeometry(1, detail); a = (g.attributes.position.array as Float32Array).slice(); g.dispose(); balls.set(detail, a); }
  return a;
}

export class GeoBuilder {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  tile: number[] = [];
  tint: number[] = [];
  glow: number[] = [];
  seed: number[] = [];
  idx: number[] = [];

  get count() { return this.pos.length / 3; }

  /** 이 뒤로 넣는 모든 꼭짓점을 이만큼 올린다(언덕 위 건물·가구) */
  dz = 0;
  vert(p: V3, n: V3, u: number, v: number, tile: number, tint: V3, glow = 0, seed = 0) {
    this.pos.push(p[0], p[1], p[2] + this.dz);
    this.nor.push(n[0], n[1], n[2]);
    this.uv.push(u, v);
    this.tile.push(tile);
    this.tint.push(tint[0], tint[1], tint[2]);
    this.glow.push(glow);
    this.seed.push(seed);
    return this.count - 1;
  }

  /** 네 점(반시계, 바깥에서 볼 때) 사각형. uv는 네 모서리 [u0,v0,u1,v1]. */
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, uv: [number, number, number, number], tile: number, tint: V3, glow = 0, seed = 0) {
    const [u0, v0, u1, v1] = uv;
    const i = this.vert(a, n, u0, v0, tile, tint, glow, seed);
    this.vert(b, n, u1, v0, tile, tint, glow, seed);
    this.vert(c, n, u1, v1, tile, tint, glow, seed);
    this.vert(d, n, u0, v1, tile, tint, glow, seed);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }

  /** 벽 한 장: 바닥 선 (ax,ay)→(bx,by), 높이 z0..z1, 바깥 법선 n */
  wall(ax: number, ay: number, bx: number, by: number, z0: number, z1: number, nx: number, ny: number, u: [number, number], v: [number, number], tile: number, tint: V3, seed = 0, glow = 0) {
    this.quad([ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1], [nx, ny, 0], [u[0], v[0], u[1], v[1]], tile, tint, glow, seed);
  }

  /** 다각형 한 판(지붕·바닥). outer + holes(로컬 m). uv = 세계 xy / scale */
  flat(outer: number[][], holes: number[][][], z: number, tile: number, tint: V3, scale = 4, seed = 0, up = true) {
    const contour = outer.map(([x, y]) => new THREE.Vector2(x, y));
    const hs = holes.map((h) => h.map(([x, y]) => new THREE.Vector2(x, y)));
    let tris: number[][];
    try { tris = THREE.ShapeUtils.triangulateShape(contour, hs); } catch { return; }
    const all = [...contour, ...hs.flat()];
    const base = this.count;
    for (const p of all) this.vert([p.x, p.y, z], [0, 0, up ? 1 : -1], p.x / scale, p.y / scale, tile, tint, 0, seed);
    for (const t of tris) this.idx.push(base + t[0], base + t[1], base + t[2]);
  }

  /** 상자(가운데 cx,cy,z0 바닥, 크기 sx·sy·h, 방위 rot 라디안) — 칸 없이 색만 */
  box(cx: number, cy: number, z0: number, sx: number, sy: number, h: number, rot: number, tint: V3, glow = 0, tile = -1, uvScale = 0) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const P = (lx: number, ly: number, z: number): V3 => [cx + lx * c - ly * s, cy + lx * s + ly * c, z];
    const hx = sx / 2, hy = sy / 2, z1 = z0 + h;
    const N = (lx: number, ly: number): V3 => [lx * c - ly * s, lx * s + ly * c, 0];
    const us = uvScale || 1;
    const uvw = (w: number, hh: number): [number, number, number, number] => (uvScale ? [0, 0, w / us, hh / us] : [0, 0, 1, 1]);
    this.quad(P(-hx, -hy, z0), P(hx, -hy, z0), P(hx, -hy, z1), P(-hx, -hy, z1), N(0, -1), uvw(sx, h), tile, tint, glow);
    this.quad(P(hx, hy, z0), P(-hx, hy, z0), P(-hx, hy, z1), P(hx, hy, z1), N(0, 1), uvw(sx, h), tile, tint, glow);
    this.quad(P(hx, -hy, z0), P(hx, hy, z0), P(hx, hy, z1), P(hx, -hy, z1), N(1, 0), uvw(sy, h), tile, tint, glow);
    this.quad(P(-hx, hy, z0), P(-hx, -hy, z0), P(-hx, -hy, z1), P(-hx, hy, z1), N(-1, 0), uvw(sy, h), tile, tint, glow);
    this.quad(P(-hx, -hy, z1), P(hx, -hy, z1), P(hx, hy, z1), P(-hx, hy, z1), [0, 0, 1], uvw(sx, sy), tile, tint, glow);
    if (z0 > 0.05) this.quad(P(-hx, hy, z0), P(hx, hy, z0), P(hx, -hy, z0), P(-hx, -hy, z0), [0, 0, -1], uvw(sx, sy), tile, tint, glow);
  }

  /** 세로 원기둥(뚜껑 포함) */
  cyl(cx: number, cy: number, z0: number, r0: number, r1: number, h: number, segs: number, tint: V3, glow = 0, cap = true) {
    const base = this.count;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      this.vert([cx + ca * r0, cy + sa * r0, z0], [ca, sa, (r0 - r1) / Math.max(0.01, h)], 0, 0, -1, tint, glow);
      this.vert([cx + ca * r1, cy + sa * r1, z0 + h], [ca, sa, (r0 - r1) / Math.max(0.01, h)], 0, 0, -1, tint, glow);
    }
    for (let i = 0; i < segs; i++) { const a = base + i * 2; this.idx.push(a, a + 2, a + 3, a, a + 3, a + 1); }
    if (cap && r1 > 0.001) {
      const c = this.vert([cx, cy, z0 + h], [0, 0, 1], 0, 0, -1, tint, glow);
      const ring = this.count;
      for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI * 2; this.vert([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, z0 + h], [0, 0, 1], 0, 0, -1, tint, glow); }
      for (let i = 0; i < segs; i++) this.idx.push(c, ring + i, ring + i + 1);
    }
  }

  /** 뭉툭한 공(나뭇잎 덩어리 등) — 팔면체를 한 번 쪼갠 것 */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, tint: V3, detail = 1, glow = 0) {
    const p = unitBall(detail);
    const base = this.count, n = p.length / 3;
    for (let i = 0; i < n; i++) {
      const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      this.vert([cx + x * rx, cy + y * ry, cz + z * rz], [x, y, z], 0, 0, -1, tint, glow);
    }
    for (let i = 0; i < n; i++) this.idx.push(base + i);
  }

  /** 기울어진 판(차양 등): 네 점을 직접 */
  plane(a: V3, b: V3, c: V3, d: V3, tint: V3, tile = -1, uv: [number, number, number, number] = [0, 0, 1, 1], glow = 0) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    const n: V3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const L = Math.hypot(n[0], n[1], n[2]) || 1;
    this.quad(a, b, c, d, [n[0] / L, n[1] / L, n[2] / L], uv, tile, tint, glow);
  }

  /** three.js 도형 하나를 변환해서 붙인다(색만) */
  addGeometry(geo: THREE.BufferGeometry, m: THREE.Matrix4, tint: V3, glow = 0) {
    const p = geo.attributes.position, nn = geo.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    const base = this.count;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      if (nn) n.fromBufferAttribute(nn, i).applyMatrix3(nm).normalize(); else n.set(0, 0, 1);
      this.vert([v.x, v.y, v.z], [n.x, n.y, n.z], 0, 0, -1, tint, glow);
    }
    const ix = geo.index;
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }

  build(): THREE.BufferGeometry | null {
    if (!this.idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aTile', new THREE.Float32BufferAttribute(this.tile, 1));
    g.setAttribute('aTint', new THREE.Float32BufferAttribute(this.tint, 3));
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(this.seed, 1));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}
