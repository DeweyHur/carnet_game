// 바람에 흔들리는 풀밭. 사람 둘레 창(격자) 안의 풀포기를 GPU가 직접 놓는다:
// 칸마다 해시로 흩뜨리고, 종류 지도에서 '잔디'인 곳에만, 땅 높이 지도를 따라 세운다.
// 사람이 걸으면 발밑 풀이 옆으로 눕고, 바람은 결을 따라 물결처럼 지나간다(돌풍이 가끔 훑는다).
// 풀 사이엔 들꽃이 드문드문, 공원에 있으면 꽃잎이 바람에 날린다.
import * as THREE from 'three';
import type { TownUniforms } from './material';
import { SHADOW_GLSL } from '../shadow';
import type { Ground } from './ground';
import { G_SIZE } from './ground';

const COMMON = /* glsl */ `
uniform sampler2D uType;
uniform sampler2D uHeight;
uniform vec2 uOrigin;
uniform vec3 uHero;
uniform float uTime;
uniform vec3 uWind; // xy = 방향, z = 세기
uniform float uCell;
uniform float uRadius;
uniform vec2 uHScale; // 높이 지도: 꼭짓점 격자와 텍셀 중심을 맞춘다
attribute vec2 aCell;
varying float vT;
varying float vShade;
varying float vFog;
uniform vec3 uEye; uniform float uFar;
varying float vSun;
${SHADOW_GLSL}
float hh(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), u.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), u.x), u.y); }
// 풀포기 하나의 자리·크기·바람. 풀이 없으면 크기 0.
vec3 place(out float scale, out float rot, out vec2 bend, float heightAt) {
  vec2 ci = floor(uHero.xy / uCell) + aCell;
  float r1 = hh(ci), r2 = hh(ci + 17.0), r3 = hh(ci - 31.0);
  vec2 base = (ci + vec2(r1, r2)) * uCell;
  vec2 uv = (base - uOrigin) / ${G_SIZE.toFixed(1)};
  vec4 t = texture2D(uType, uv);
  float water = min(t.r, min(t.g, t.b));
  float grass = smoothstep(0.45, 0.75, t.r - water) * (1.0 - smoothstep(0.35, 0.6, max(t.g, t.b) - water));
  float d = distance(base, uHero.xy);
  float fade = 1.0 - smoothstep(uRadius * 0.7, uRadius, d);
  scale = grass * fade * (0.65 + 0.7 * r3) * step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  rot = r1 * 6.2832;
  float z = texture2D(uHeight, uv * uHScale.x + uHScale.y).r;
  // 바람: 결을 따라 흐르는 물결 + 가끔 훑는 돌풍
  vec2 w = uWind.xy;
  float wave = sin(dot(base, w) * 0.35 - uTime * 2.1 + r2 * 1.5);
  float gust = smoothstep(0.35, 0.95, vn(base * 0.045 - w * uTime * 0.55));
  float s = uWind.z * (0.35 + 0.25 * wave) + gust * uWind.z * 1.1;
  bend = w * s + vec2(-w.y, w.x) * 0.12 * sin(uTime * 3.3 + r3 * 9.0) * uWind.z;
  // 발밑 풀은 밀려 눕는다
  vec2 away = base - uHero.xy;
  float near = 1.0 - smoothstep(0.2, 1.3, length(away));
  if (abs(uHero.z - z) < 1.5) bend += normalize(away + 1e-4) * near * 1.4;
  vShade = 0.8 + 0.4 * r2;
  vFog = smoothstep(uFar * 0.55, uFar, distance(base, uEye.xy)) * 0.85;
  vSun = shadowAt(vec3(base, z + 0.3)); // 풀포기 하나는 한 번만 본다(꼭짓점 셰이더에서)
  return vec3(base, z);
}
`;

const BLADE_VERT = /* glsl */ `
${COMMON}
attribute float aH; // 풀잎 위로 갈수록 0→1
void main() {
  float scale, rot; vec2 bend;
  vec3 b = place(scale, rot, bend, 0.0);
  if (scale < 0.04) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float c = cos(rot), s = sin(rot);
  vec3 p = position * vec3(1.0, 1.0, scale);
  p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float k = aH * aH;
  p.xy += bend * k * 0.55 * scale;
  p.z -= length(bend) * k * 0.18 * scale; // 휘면 키가 줄어든다
  vT = aH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(b + p, 1.0);
}`;

const BLADE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFog; uniform float uNight;
varying float vT;
varying float vShade;
varying float vFog;
varying float vSun;
void main() {
  vec3 root = vec3(0.16, 0.30, 0.09), tip = vec3(0.58, 0.74, 0.30);
  vec3 base = mix(root, tip, vT) * vShade;
  vec3 col = base * (uAmb * 0.85 + uSunCol * (0.45 + 0.4 * vT) * mix(0.35, 1.0, vSun)); // 끝이 햇빛을 머금는다
  col = mix(col, uFog, vFog);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const FLOWER_VERT = /* glsl */ `
${COMMON}
attribute float aH;
attribute float aPetal; // 1 = 꽃잎, 0 = 줄기
varying float vPetal;
varying vec3 vCol;
void main() {
  float scale, rot; vec2 bend;
  vec3 b = place(scale, rot, bend, 0.0);
  vec2 ci = floor(uHero.xy / uCell) + aCell;
  float pick = hh(ci + 5.0);
  if (scale < 0.04 || pick > 0.42) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  float c = cos(rot), s = sin(rot);
  vec3 p = position * (0.8 + 0.5 * scale);
  p.xy = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p.xy += bend * aH * aH * 0.4;
  float kind = hh(ci + 11.0);
  vCol = kind < 0.45 ? vec3(0.97, 0.96, 0.92) : kind < 0.7 ? vec3(0.98, 0.83, 0.25) : kind < 0.88 ? vec3(0.66, 0.52, 0.86) : vec3(0.93, 0.42, 0.42);
  vPetal = aPetal;
  vT = aH;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(b + p, 1.0);
}`;

const FLOWER_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uFog;
varying float vPetal; varying vec3 vCol; varying float vT; varying float vShade; varying float vFog; varying float vSun;
void main() {
  vec3 base = vPetal > 0.5 ? vCol : vec3(0.22, 0.4, 0.12);
  vec3 col = base * (uAmb * 0.8 + uSunCol * 0.65 * mix(0.35, 1.0, vSun));
  col = mix(col, uFog, vFog);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

/** 풀잎 다섯 장이 한 포기(3마디씩, 끝이 뾰족) */
function clumpGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], hs: number[] = [], idx: number[] = [];
  const B = 5, SEG = 3;
  for (let b = 0; b < B; b++) {
    const a = (b / B) * Math.PI * 2 + b * 0.7;
    const ox = Math.cos(a) * 0.09 * ((b % 2) + 0.4), oy = Math.sin(a) * 0.09 * ((b % 3) * 0.5 + 0.3);
    const h = 0.34 + ((b * 37) % 10) * 0.028, w = 0.035;
    const dir = a + 1.2, cx = Math.cos(dir), cy = Math.sin(dir);
    const lean = 0.08 * ((b % 2) ? 1 : -1);
    const base = pos.length / 3;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG, ww = w * (1 - t * 0.85);
      const lx = ox + Math.cos(a) * lean * t * t, ly = oy + Math.sin(a) * lean * t * t;
      pos.push(lx - cx * ww, ly - cy * ww, h * t, lx + cx * ww, ly + cy * ww, h * t);
      hs.push(t, t);
    }
    for (let s = 0; s < SEG; s++) { const q = base + s * 2; idx.push(q, q + 1, q + 3, q, q + 3, q + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
  g.setIndex(idx);
  return g;
}

/** 들꽃: 줄기 하나 + 꽃잎 다섯(작은 판) */
function flowerGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], hs: number[] = [], pet: number[] = [], idx: number[] = [];
  const H = 0.42;
  pos.push(-0.008, 0, 0, 0.008, 0, 0, 0.008, 0, H, -0.008, 0, H); hs.push(0, 0, 1, 1); pet.push(0, 0, 0, 0); idx.push(0, 1, 2, 0, 2, 3);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const b = pos.length / 3, r = 0.055, w = 0.025;
    pos.push(0, 0, H, c * r - s * w, s * r + c * w, H + 0.012, c * r * 1.3, s * r * 1.3, H + 0.02, c * r + s * w, s * r - c * w, H + 0.012);
    hs.push(1, 1, 1, 1); pet.push(1, 1, 1, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(hs, 1));
  g.setAttribute('aPetal', new THREE.Float32BufferAttribute(pet, 1));
  g.setIndex(idx);
  return g;
}

function windowCells(radius: number, cell: number): Float32Array {
  const K = Math.ceil(radius / cell) + 1;
  const out: number[] = [];
  for (let j = -K; j <= K; j++) for (let i = -K; i <= K; i++) if (Math.hypot(i, j) * cell <= radius + cell) out.push(i, j);
  return new Float32Array(out);
}

export class Grass {
  readonly group = new THREE.Group();
  private blades: THREE.Mesh | null = null;
  private flowers: THREE.Mesh | null = null;
  private petals: THREE.Points;
  private petalPos: Float32Array;
  private petalVel: Float32Array;
  readonly uniforms: Record<string, THREE.IUniform>;
  private radius = 0;
  private readonly ground: Ground;
  private readonly tu: TownUniforms;
  private wind = new THREE.Vector3(0.8, 0.6, 0.5);
  private windA = 0.6;

  constructor(u: TownUniforms, ground: Ground) {
    this.ground = ground;
    this.tu = u;
    this.uniforms = {
      uType: { value: ground.typeTex }, uHeight: { value: ground.heightTex }, uOrigin: { value: ground.origin },
      uHero: { value: new THREE.Vector3() }, uHScale: { value: new THREE.Vector2((ground.N - 1) / ground.N, 0.5 / ground.N) }, uTime: ground.time, uWind: { value: this.wind }, uCell: { value: 0.5 }, uRadius: { value: 30 },
      uSunCol: u.uSunCol, uAmb: u.uAmb, uFog: u.uFog, uNight: u.uNight, uEye: u.uEye, uFar: u.uFar, uShadowMap: u.uShadowMap, uShadowMatrix: u.uShadowMatrix, uShadowOn: u.uShadowOn, uShadowTexel: u.uShadowTexel,
    };
    // 꽃잎: 사람 둘레 상자 안에서 바람 따라 날다가 돌아온다
    const P = 160;
    this.petalPos = new Float32Array(P * 3);
    this.petalVel = new Float32Array(P);
    for (let i = 0; i < P; i++) { this.petalPos.set([(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, Math.random() * 6], i * 3); this.petalVel[i] = 0.6 + Math.random() * 0.8; }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P * 3), 3));
    this.petals = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xfff3f0, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
    this.petals.frustumCulled = false;
    this.group.add(this.petals);
  }

  /** 풀이 나는 반경(품질에 따라). 0이면 끈다. */
  setRadius(r: number) {
    if (r === this.radius) return;
    this.radius = r;
    for (const m of [this.blades, this.flowers]) if (m) { this.group.remove(m); m.geometry.dispose(); }
    this.blades = this.flowers = null;
    if (r <= 0) return;
    const bladeCell = 0.5, flowerCell = 1.9;
    this.blades = this.make(clumpGeometry(), BLADE_VERT, BLADE_FRAG, windowCells(r, bladeCell), bladeCell, r);
    this.flowers = this.make(flowerGeometry(), FLOWER_VERT, FLOWER_FRAG, windowCells(r * 0.8, flowerCell), flowerCell, r * 0.8);
  }

  private make(geo: THREE.BufferGeometry, vs: string, fs: string, cells: Float32Array, cell: number, radius: number) {
    const n = cells.length / 2;
    const ig = new THREE.InstancedBufferGeometry();
    ig.index = geo.index;
    for (const k of Object.keys(geo.attributes)) ig.setAttribute(k, geo.attributes[k]);
    ig.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    ig.instanceCount = n;
    const mat = new THREE.ShaderMaterial({ uniforms: { ...this.uniforms, uCell: { value: cell }, uRadius: { value: radius } }, vertexShader: vs, fragmentShader: fs, side: THREE.DoubleSide });
    const m = new THREE.Mesh(ig, mat); // 자리는 셰이더가 aCell로 정한다
    m.frustumCulled = false;
    m.matrixAutoUpdate = false;
    this.group.add(m);
    return m;
  }

  update(dt: number, x: number, y: number, z: number) {
    (this.uniforms.uHero.value as THREE.Vector3).set(x, y, z);
    // 바람: 방향이 천천히 돌고, 세기가 숨 쉬듯 오르내린다
    const t = this.ground.time.value;
    this.windA += dt * 0.02 * Math.sin(t * 0.05);
    const strength = 0.45 + 0.25 * Math.sin(t * 0.21) + 0.15 * Math.sin(t * 0.67 + 1.3);
    this.wind.set(Math.cos(this.windA), Math.sin(this.windA), strength);
    // 꽃잎: 공원 안이거나 가까울 때만
    const inPark = this.ground.typeAt(x, y) === 1 || this.ground.typeAt(x + 12, y) === 1 || this.ground.typeAt(x - 12, y) === 1 || this.ground.typeAt(x, y + 12) === 1 || this.ground.typeAt(x, y - 12) === 1;
    const mat = this.petals.material as THREE.PointsMaterial;
    mat.opacity += ((inPark ? 0.9 : 0) - mat.opacity) * Math.min(1, dt * 1.5);
    this.petals.visible = mat.opacity > 0.02;
    if (this.petals.visible) {
      const P = this.petalVel.length, p = this.petalPos, out = this.petals.geometry.attributes.position.array as Float32Array;
      const wx = this.wind.x * (1 + strength * 3), wy = this.wind.y * (1 + strength * 3);
      for (let i = 0; i < P; i++) {
        const v = this.petalVel[i];
        p[i * 3] += (wx * v + Math.sin(t * 2 + i) * 0.4) * dt;
        p[i * 3 + 1] += (wy * v + Math.cos(t * 1.7 + i * 1.3) * 0.4) * dt;
        p[i * 3 + 2] += (-0.35 * v + Math.sin(t * 3 + i * 0.7) * 0.3) * dt;
        // 상자(40×40×7 m)를 벗어나면 반대쪽으로
        for (const a of [0, 1]) { if (p[i * 3 + a] > 20) p[i * 3 + a] -= 40; if (p[i * 3 + a] < -20) p[i * 3 + a] += 40; }
        if (p[i * 3 + 2] < 0) p[i * 3 + 2] += 7;
        out[i * 3] = x + p[i * 3]; out[i * 3 + 1] = y + p[i * 3 + 1]; out[i * 3 + 2] = z + p[i * 3 + 2] - 1;
      }
      this.petals.geometry.attributes.position.needsUpdate = true;
    }
    void this.tu;
  }
}
