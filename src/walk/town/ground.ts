// 걷는 사람 둘레의 땅: 높낮이를 따르는 격자 한 장에, 무엇이 깔렸는지(잔디·자갈·포석·보도·강바닥)를
// 그린 '종류 지도'를 입혀 셰이더가 결을 만든다. 강은 둑 아래로 가라앉고, 돌 둑과 흐르는 물낯을 따로 세운다.
// 지도 타일이 있든 없든 같은 방식 — 길은 걷는 길(그래프), 공원·물은 타일(또는 손으로 그린 에펠탑 둘레).
import * as THREE from 'three';
import type { World } from '../hero/world';
import { BED_Z, WATER_Z } from '../hero/terrain';
import type { TownUniforms } from './material';

export const G_SIZE = 640; // 한 장이 덮는 넓이(m)

const NOISE = /* glsl */ `
float hh(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), u.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { return 0.5 * vn(p) + 0.3 * vn(p * 2.03 + 7.1) + 0.2 * vn(p * 4.1 - 3.7); }
`;

const VERT = /* glsl */ `
varying vec3 vP;
varying vec3 vN;
void main() { vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uType;
uniform vec2 uOrigin;
uniform float uSize;
uniform vec4 uHole; // 이 안은 가까운 땅이 그린다
uniform float uEdge;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFog; uniform vec3 uEye; uniform float uFar; uniform float uNight;
varying vec3 vP;
varying vec3 vN;
${NOISE}
void main() {
  vec2 p = vP.xy;
  if (p.x > uHole.x && p.y > uHole.y && p.x < uHole.z && p.y < uHole.w) discard;
  vec4 t = texture2D(uType, (p - uOrigin) / uSize);
  float water = min(t.r, min(t.g, t.b));
  float grass = max(t.r - water, 0.0), gravel = max(t.g - water, 0.0);
  // 파랑: 짙으면 차도(포석), 옅으면 보도 — 둘 다 아니면 블록 안(건물 자리·안뜰)
  float bl = max(t.b - water, 0.0);
  float road = smoothstep(0.62, 0.9, bl);
  float side = max(0.0, smoothstep(0.2, 0.45, bl) - road);
  float block = max(0.0, 1.0 - max(t.r, max(t.g, smoothstep(0.2, 0.45, t.b))));
  // 잔디: 큰 얼룩 + 작은 결 + 깎은 줄무늬
  float g1 = fbm(p * 0.07), g2 = vn(p * 0.9), g3 = vn(p * 4.0);
  vec3 grassC = mix(vec3(0.27, 0.45, 0.16), vec3(0.45, 0.62, 0.23), g1);
  grassC = mix(grassC, vec3(0.56, 0.62, 0.30), smoothstep(0.62, 0.9, g2) * 0.35);
  grassC *= 0.88 + 0.2 * g3 + 0.05 * sin(dot(p, vec2(0.25, 0.18)));
  // 자갈(공원 산책길): 모래빛 알갱이
  float gr = hh(floor(p * 7.0));
  vec3 gravelC = vec3(0.80, 0.74, 0.61) * (0.86 + 0.18 * gr) * (0.92 + 0.12 * vn(p * 0.5));
  // 포석(차도): 0.30×0.20 m 돌이 줄마다 엇갈려 박혀 있다
  vec2 q = p / vec2(0.30, 0.20);
  q.x += 0.5 * mod(floor(q.y), 2.0);
  vec2 cell = floor(q), fr = fract(q);
  float edge = min(min(fr.x, 1.0 - fr.x) * 0.30, min(fr.y, 1.0 - fr.y) * 0.20);
  float stone = hh(cell);
  vec3 roadC = mix(vec3(0.40, 0.40, 0.43), vec3(0.58, 0.55, 0.52), stone) * (0.85 + 0.1 * vn(p * 0.3));
  roadC *= mix(0.55, 1.0, smoothstep(0.0, 0.025, edge));
  // 보도·광장: 1.2 m 판석
  vec2 s = p / 1.2; vec2 sf = fract(s);
  float slab = hh(floor(s));
  vec3 paveC = vec3(0.80, 0.77, 0.71) * (0.9 + 0.1 * slab) * (0.93 + 0.08 * vn(p * 0.6));
  paveC *= mix(0.78, 1.0, smoothstep(0.0, 0.03, min(min(sf.x, 1.0 - sf.x), min(sf.y, 1.0 - sf.y))));
  vec3 mudC = vec3(0.30, 0.27, 0.20);
  // 먼 땅의 블록 안: 하늘에서 본 지붕들(함석 청회색·크림 석조, 안뜰은 어둡게)
  vec2 rc = floor(p / 9.0);
  float rr = hh(rc), rq = hh(rc + 3.0);
  vec3 roofC = mix(vec3(0.52, 0.56, 0.62), vec3(0.84, 0.79, 0.69), step(0.55, rr)) * (0.85 + 0.2 * rq);
  roofC = mix(roofC, vec3(0.36, 0.34, 0.31), step(0.9, hh(rc + 9.0)));
  // 가까운 땅도 건물을 짓는 반경 밖이면 지붕처럼(먼 땅과 이어지게)
  vec3 blockC = mix(paveC, roofC, uEdge > 0.5 ? 1.0 : smoothstep(uFar * 0.75, uFar * 1.05, distance(p, uEye.xy)));
  float sum = grass + gravel + road + side + block + water + 1e-4;
  vec3 base = (grassC * grass + gravelC * gravel + roadC * road + paveC * side + blockC * block + mudC * water) / sum;
  vec3 N = normalize(vN);
  float ndl = max(dot(N, uSun), 0.0);
  vec3 col = base * (uAmb * 0.92 + uSunCol * ndl * 0.8);
  // 가장자리는 안개로 — 한 장의 끝이 보이지 않게
  float edgeFade = smoothstep(uSize * 0.36, uSize * 0.5, max(abs(p.x - uOrigin.x - uSize * 0.5), abs(p.y - uOrigin.y - uSize * 0.5)));
  // 땅은 칸마다 튀어나오지 않으니 건물보다 멀리까지 또렷하게(하늘에서 내려다볼 때도)
  float fd = length(vP - uEye);
  col = mix(col, uFog, max(smoothstep(900.0, 2400.0, fd) * 0.8, edgeFade * uEdge));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const WATER_FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec4 uHole;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFog; uniform vec3 uEye; uniform float uFar; uniform float uNight;
varying vec3 vP;
${NOISE}
void main() {
  vec2 p = vP.xy;
  if (p.x > uHole.x && p.y > uHole.y && p.x < uHole.z && p.y < uHole.w) discard;
  // 물결: 흐르는 두 겹 잡음으로 법선을 흔든다
  float e = 0.35;
  vec2 fl = vec2(0.6, 0.35) * uTime;
  float h0 = fbm(p * 0.35 + fl) + 0.5 * fbm(p * 1.3 - fl * 1.7);
  float hx = fbm((p + vec2(e, 0.0)) * 0.35 + fl) + 0.5 * fbm((p + vec2(e, 0.0)) * 1.3 - fl * 1.7);
  float hy = fbm((p + vec2(0.0, e)) * 0.35 + fl) + 0.5 * fbm((p + vec2(0.0, e)) * 1.3 - fl * 1.7);
  vec3 N = normalize(vec3((h0 - hx) * 1.6, (h0 - hy) * 1.6, 1.0));
  vec3 V = normalize(uEye - vP + vec3(0.0, 0.0, 2.0));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 deep = vec3(0.13, 0.27, 0.30), sky = mix(uFog, vec3(0.62, 0.76, 0.88), 0.5);
  vec3 col = mix(deep * (uAmb + uSunCol * 0.3), sky * (0.7 + 0.3 * uSunCol), 0.25 + 0.6 * fres);
  vec3 H = normalize(uSun + V);
  col += uSunCol * pow(max(dot(N, H), 0.0), 90.0) * 1.2 * (1.0 - uNight);
  col = mix(col, uFog, smoothstep(900.0, 2400.0, length(vP - uEye)) * 0.8);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const WALL_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFog; uniform vec3 uEye; uniform float uFar;
varying vec3 vP;
varying vec3 vN;
${NOISE}
void main() {
  // 석회암 블록 둑: 가로 1.1 m × 세로 0.5 m, 물에 닿는 아래는 이끼로 어둡다
  vec2 q = vec2(vP.x + vP.y, vP.z) / vec2(1.1, 0.5);
  q.x += 0.5 * mod(floor(q.y), 2.0);
  vec2 fr = fract(q);
  float joint = smoothstep(0.0, 0.05, min(min(fr.x, 1.0 - fr.x), min(fr.y, 1.0 - fr.y)));
  vec3 base = vec3(0.78, 0.73, 0.62) * (0.88 + 0.15 * hh(floor(q))) * mix(0.6, 1.0, joint);
  base = mix(base * vec3(0.55, 0.62, 0.5), base, smoothstep(${WATER_Z.toFixed(2)} - 0.2, ${WATER_Z.toFixed(2)} + 0.9, vP.z));
  vec3 N = normalize(vN);
  vec3 col = base * (uAmb + uSunCol * max(dot(N, uSun), 0.0) * 0.8);
  col = mix(col, uFog, smoothstep(uFar * 0.55, uFar, distance(vP.xy, uEye.xy)) * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export class Ground {
  readonly group = new THREE.Group();
  /** 종류 지도(풀이 자랄 곳을 풀도 같이 본다) */
  readonly typeTex: THREE.CanvasTexture;
  readonly heightTex: THREE.DataTexture;
  readonly origin = new THREE.Vector2(NaN, NaN);
  private readonly canvas = document.createElement('canvas');
  private typeData: Uint8ClampedArray | null = null;
  private readonly mesh: THREE.Mesh;
  readonly N: number;
  private heights: Float32Array;
  private water: THREE.Mesh | null = null;
  private walls: THREE.Mesh | null = null;
  private readonly mat: THREE.ShaderMaterial;
  private readonly waterMat: THREE.ShaderMaterial;
  private readonly wallMat: THREE.ShaderMaterial;
  private builtVersion = -1;
  private builtAt = 0;
  readonly time = { value: 0 };

  readonly size: number;
  private readonly px: number;
  /** 먼 땅: 넓고 성기게(높낮이는 강만), 가까운 땅 자리엔 구멍 */
  private readonly far: boolean;
  /** 가까운 땅이 덮는 사각형(먼 땅은 여기를 그리지 않는다) */
  readonly hole = new THREE.Vector4(1, 1, 0, 0);
  constructor(u: TownUniforms, opts: { size: number; spacing: number; px: number; far?: boolean }) {
    this.size = opts.size; this.px = opts.px; this.far = !!opts.far;
    this.N = Math.round(this.size / opts.spacing) + 1;
    const N = this.N;
    this.heights = new Float32Array(N * N);
    this.canvas.width = this.canvas.height = this.px;
    this.typeTex = new THREE.CanvasTexture(this.canvas);
    this.typeTex.flipY = false;
    this.typeTex.minFilter = THREE.LinearFilter;
    this.typeTex.generateMipmaps = false;
    this.heightTex = new THREE.DataTexture(new Uint16Array(N * N), N, N, THREE.RedFormat, THREE.HalfFloatType);
    this.heightTex.minFilter = this.heightTex.magFilter = THREE.LinearFilter;
    const shared = { uSun: u.uSun, uSunCol: u.uSunCol, uAmb: u.uAmb, uFog: u.uFog, uEye: u.uEye, uFar: u.uFar, uNight: u.uNight };
    this.mat = new THREE.ShaderMaterial({ uniforms: { ...shared, uType: { value: this.typeTex }, uOrigin: { value: this.origin }, uSize: { value: this.size }, uHole: { value: this.hole }, uEdge: { value: this.far ? 1 : 0 } }, vertexShader: VERT, fragmentShader: FRAG });
    this.waterMat = new THREE.ShaderMaterial({ uniforms: { ...shared, uTime: this.time, uHole: { value: this.hole } }, vertexShader: VERT, fragmentShader: WATER_FRAG });
    this.wallMat = new THREE.ShaderMaterial({ uniforms: shared, vertexShader: VERT, fragmentShader: WALL_FRAG, side: THREE.DoubleSide });
    // 격자: 위치만 다시 채운다
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * N * 3);
    const idx = new Uint32Array((N - 1) * (N - 1) * 6);
    let k = 0;
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      idx.set([a, b, d, a, d, c], k); k += 6;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * N * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.renderOrder = this.far ? -3 : -2;
    this.group.add(this.mesh);
    this.group.visible = false;
  }

  /** 이 자리에 무엇이 깔렸나: 0 보도 · 1 잔디 · 2 자갈 · 3 포석 · 4 물 */
  typeAt(x: number, y: number): number {
    const d = this.typeData;
    if (!d) return 0;
    const px = Math.floor(((x - this.origin.x) / this.size) * this.px), py = Math.floor(((y - this.origin.y) / this.size) * this.px);
    if (px < 0 || py < 0 || px >= this.px || py >= this.px) return 0;
    const o = (py * this.px + px) * 4;
    const r = d[o], g = d[o + 1], b = d[o + 2];
    if (r > 128 && g > 128 && b > 128) return 4;
    if (r > 128) return 1;
    if (g > 128) return 2;
    if (b > 200) return 3;
    return 0;
  }

  /** 매 프레임: 멀리 왔거나 땅이 바뀌었으면(타일이 들어옴) 다시 깐다 */
  update(world: World, lanes: [number, number, number, number][], x: number, y: number) {
    const now = performance.now();
    const lim = this.size * 0.17, snap = this.far ? 256 : 32;
    const far = !(Math.abs(x - (this.origin.x + this.size / 2)) < lim && Math.abs(y - (this.origin.y + this.size / 2)) < lim);
    const stale = world.relief.version !== this.builtVersion && now - this.builtAt > 1500;
    if (!far && !stale) return false;
    this.build(world, lanes, Math.round(x / snap) * snap - this.size / 2, Math.round(y / snap) * snap - this.size / 2);
    this.builtAt = now;
    this.builtVersion = world.relief.version;
    return true;
  }

  private build(world: World, lanes: [number, number, number, number][], ox: number, oy: number) {
    this.origin.set(ox, oy);
    const N = this.N, step = this.size / (N - 1);
    const H = this.heights;
    // 먼 땅은 둔덕을 보지 않는다(강만 가라앉힌다) — 넓은 곳을 다 계산하면 무겁다
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[j * N + i] = this.far ? (world.water(ox + i * step, oy + j * step) ? BED_Z : 0) : world.terrain(ox + i * step, oy + j * step);
    const geo = this.mesh.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    const nor = geo.attributes.normal.array as Float32Array;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i;
      pos[k * 3] = ox + i * step; pos[k * 3 + 1] = oy + j * step; pos[k * 3 + 2] = H[k];
      const hl = H[j * N + Math.max(0, i - 1)], hr = H[j * N + Math.min(N - 1, i + 1)], hd = H[Math.max(0, j - 1) * N + i], hu = H[Math.min(N - 1, j + 1) * N + i];
      const nx = (hl - hr) / (2 * step), ny = (hd - hu) / (2 * step), L = Math.hypot(nx, ny, 1);
      nor[k * 3] = nx / L; nor[k * 3 + 1] = ny / L; nor[k * 3 + 2] = 1 / L;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    const hd = this.heightTex.image.data as Uint16Array;
    for (let k = 0; k < N * N; k++) hd[k] = THREE.DataUtils.toHalfFloat(H[k]);
    this.heightTex.needsUpdate = true;
    this.paintTypes(world, lanes, ox, oy);
    this.buildWater(world, ox, oy);
  }

  private paintTypes(world: World, lanes: [number, number, number, number][], ox: number, oy: number) {
    const c = this.canvas.getContext('2d', { willReadFrequently: true })!;
    const k = this.px / this.size;
    c.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    c.fillStyle = '#000';
    c.fillRect(ox, oy, this.size, this.size);
    const inView = (r: Float64Array) => overlaps(r, ox, oy, 50, this.size);
    const path = (r: Float64Array) => { c.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) c.lineTo(r[i], r[i + 1]); c.closePath(); };
    const near = lanes.filter(([ax, ay, bx, by]) => Math.max(ax, bx) > ox - 10 && Math.min(ax, bx) < ox + this.size + 10 && Math.max(ay, by) > oy - 10 && Math.min(ay, by) < oy + this.size + 10);
    // 1) 보도(옅은 파랑) 위에 차도(포석, 짙은 파랑)
    c.lineCap = 'round';
    c.strokeStyle = '#000080'; c.lineWidth = 11.5;
    c.beginPath(); for (const [ax, ay, bx, by] of near) { c.moveTo(ax, ay); c.lineTo(bx, by); } c.stroke();
    c.strokeStyle = '#0000ff'; c.lineWidth = 6.4;
    c.beginPath(); for (const [ax, ay, bx, by] of near) { c.moveTo(ax, ay); c.lineTo(bx, by); } c.stroke();
    // 2) 공원(잔디) — 공원 안의 길은 3) 자갈로
    const greens = world.greens.filter(inView);
    if (greens.length) {
      c.fillStyle = '#ff0000';
      c.beginPath(); for (const r of greens) path(r); c.fill('evenodd');
      c.save();
      c.beginPath(); for (const r of greens) path(r); c.clip('evenodd');
      c.strokeStyle = '#00ff00'; c.lineWidth = 4.6;
      c.beginPath(); for (const [ax, ay, bx, by] of near) { c.moveTo(ax, ay); c.lineTo(bx, by); } c.stroke();
      c.restore();
    }
    // 4) 물(강바닥)
    const waters = world.waters.filter(inView);
    if (waters.length) { c.fillStyle = '#ffffff'; c.beginPath(); for (const r of waters) path(r); c.fill('evenodd'); }
    if (!this.far) this.typeData = c.getImageData(0, 0, this.px, this.px).data;
    this.typeTex.needsUpdate = true;
  }

  /** 물낯(WATER_Z)과 돌 둑(바닥에서 길 높이까지) */
  private buildWater(world: World, ox: number, oy: number) {
    if (this.water) { this.group.remove(this.water); this.water.geometry.dispose(); this.water = null; }
    if (this.walls) { this.group.remove(this.walls); this.walls.geometry.dispose(); this.walls = null; }
    const M = 60;
    const rings = world.waters.filter((r) => overlaps(r, ox, oy, M, this.size));
    if (!rings.length) return;
    const wp: number[] = [], wi: number[] = [];
    const sp: number[] = [], sn: number[] = [], si: number[] = [];
    for (const r of rings) {
      // 물낯: 고리를 삼각형으로
      const pts = [] as THREE.Vector2[];
      for (let i = 0; i < r.length; i += 2) pts.push(new THREE.Vector2(r[i], r[i + 1]));
      const tris = THREE.ShapeUtils.triangulateShape(pts, []);
      const base = wp.length / 3;
      for (const p of pts) wp.push(p.x, p.y, WATER_Z);
      for (const t of tris) wi.push(base + t[0], base + t[1], base + t[2]);
      // 둑: 바깥이 물이 아닌 변만(타일 경계로 잘린 변은 건너뛴다)
      const n = r.length / 2;
      let area = 0;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; }
      const ccw = area > 0;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = r[i * 2], ay = r[i * 2 + 1], bx = r[j * 2], by = r[j * 2 + 1];
        const L = Math.hypot(bx - ax, by - ay);
        if (L < 0.2) continue;
        if (Math.max(ax, bx) < ox - 5 || Math.min(ax, bx) > ox + this.size + 5 || Math.max(ay, by) < oy - 5 || Math.min(ay, by) > oy + this.size + 5) continue;
        // 바깥쪽(뭍) 법선
        let nx = (by - ay) / L, ny = -(bx - ax) / L;
        if (!ccw) { nx = -nx; ny = -ny; }
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (world.water(mx + nx * 1.5, my + ny * 1.5)) continue;
        const top = Math.max(0.05, world.terrain(mx + nx * 2.5, my + ny * 2.5) + 0.05);
        const b0 = sp.length / 3;
        // 벽 면(물 쪽을 본다) + 위의 갓돌 띠
        sp.push(ax, ay, BED_Z, bx, by, BED_Z, bx, by, top, ax, ay, top);
        for (let q = 0; q < 4; q++) sn.push(-nx, -ny, 0);
        si.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
        const b1 = sp.length / 3, w = 0.55;
        sp.push(ax, ay, top, bx, by, top, bx + nx * w, by + ny * w, top, ax + nx * w, ay + ny * w, top);
        for (let q = 0; q < 4; q++) sn.push(0, 0, 1);
        si.push(b1, b1 + 1, b1 + 2, b1, b1 + 2, b1 + 3);
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    wg.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(wp.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
    wg.setIndex(wi);
    this.water = new THREE.Mesh(wg, this.waterMat);
    this.water.frustumCulled = false;
    this.water.matrixAutoUpdate = false;
    this.group.add(this.water);
    if (si.length && !this.far) {
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
      sg.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
      sg.setIndex(si);
      this.walls = new THREE.Mesh(sg, this.wallMat);
      this.walls.frustumCulled = false;
      this.walls.matrixAutoUpdate = false;
      this.group.add(this.walls);
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.water?.geometry.dispose();
    this.walls?.geometry.dispose();
  }
}

/** 고리의 바운딩 박스가 이 땅 한 장(여유 m 포함)과 겹치나 — 꼭짓점이 모두 밖이어도 덮을 수 있다 */
function overlaps(r: Float64Array, ox: number, oy: number, m: number, size: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < r.length; i += 2) { if (r[i] < minX) minX = r[i]; if (r[i] > maxX) maxX = r[i]; if (r[i + 1] < minY) minY = r[i + 1]; if (r[i + 1] > maxY) maxY = r[i + 1]; }
  return maxX > ox - m && minX < ox + size + m && maxY > oy - m && minY < oy + size + m;
}
