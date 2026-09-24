// 건물·거리 가구를 한 재질로 그린다(한 덩어리 = 그리기 한 번).
// 칸(tile) ≥ 0이면 아틀라스의 그 칸을 uv 반복으로 붙이고, -1이면 꼭짓점 색만 쓴다.
// 밤이 되면 유리 칸의 일부에 불이 켜지고, glow가 있는 꼭짓점(가로등 등)은 스스로 빛난다.
import * as THREE from 'three';
import { ATLAS_N, facadeAtlas } from './atlas';

export interface TownUniforms {
  uAtlas: { value: THREE.Texture };
  uSun: { value: THREE.Vector3 };
  uSunCol: { value: THREE.Color };
  uAmb: { value: THREE.Color };
  uNight: { value: number };
  uFog: { value: THREE.Color };
  uEye: { value: THREE.Vector3 };
  uFar: { value: number };
}

export function townUniforms(): TownUniforms {
  return {
    uAtlas: { value: facadeAtlas() },
    uSun: { value: new THREE.Vector3(-0.45, -0.6, 0.66).normalize() },
    uSunCol: { value: new THREE.Color(1, 0.96, 0.9) },
    uAmb: { value: new THREE.Color(0.62, 0.66, 0.74) },
    uNight: { value: 0 },
    uFog: { value: new THREE.Color('#efe3d2') },
    uEye: { value: new THREE.Vector3() },
    uFar: { value: 330 },
  };
}

const VERT = /* glsl */ `
attribute float aTile;
attribute vec3 aTint;
attribute float aGlow;
attribute float aSeed;
varying vec2 vUv;
varying float vTile;
varying vec3 vTint;
varying float vGlow;
varying float vSeed;
varying vec3 vN;
varying vec3 vP;
void main() {
  vUv = uv;
  vTile = aTile;
  vTint = aTint;
  vGlow = aGlow;
  vSeed = aSeed;
  vN = normal;
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uAtlas;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform float uNight;
uniform vec3 uFog;
uniform vec3 uEye;
uniform float uFar;
varying vec2 vUv;
varying float vTile;
varying vec3 vTint;
varying float vGlow;
varying float vSeed;
varying vec3 vN;
varying vec3 vP;
// 큰 수를 sin에 넣으면 GPU마다 정밀도가 달라 픽셀마다 들쭉날쭉해진다 — 작은 정수로 섞는다
float hash(vec3 p) { p = mod(floor(p + 0.5), 97.0); return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 437.5453); }
void main() {
  vec3 base = vTint;
  float glassMask = 0.0;
  if (vTile >= 0.0) {
    float n = ${ATLAS_N.toFixed(1)};
    vec2 f = fract(vUv);
    vec2 cell = vec2(mod(vTile, n), floor(vTile / n));
    vec2 inset = f * (126.0 / 128.0) + 1.0 / 128.0;
    vec2 auv = (cell + vec2(inset.x, 1.0 - inset.y)) / n;
    vec4 tex = textureGrad(uAtlas, auv, dFdx(vUv) / n, dFdy(vUv) / n);
    if (tex.a < 0.35) discard;
    base = tex.rgb * vTint;
    glassMask = (tex.a > 0.55 && tex.a < 0.93) ? 1.0 : 0.0;
  }
  vec3 N = normalize(vN);
  float ndl = max(dot(N, uSun), 0.0);
  // 땅 가까이는 살짝 어둡게(그늘·때), 위로 갈수록 하늘빛을 더 받는다
  float ao = mix(0.72, 1.0, smoothstep(0.0, 3.0, vP.z)) * (0.92 + 0.08 * N.z);
  vec3 col = base * (uAmb * ao + uSunCol * ndl * 0.85);
  // 밤: 유리창 일부에 불이 켜진다(창마다 다르게)
  if (glassMask > 0.5 && uNight > 0.01) {
    float h = hash(vec3(floor(vUv), floor(vSeed + 0.5)));
    if (h < 0.18 + 0.4 * uNight) col = mix(col, vec3(1.0, 0.8, 0.5) * (0.85 + 0.3 * h), clamp(uNight * 1.2, 0.0, 0.95));
  }
  col += vGlow * uNight * vec3(1.0, 0.82, 0.55) * 1.4;
  col = mix(col, vTint, vGlow * uNight * 0.6);
  float d = distance(vP.xy, uEye.xy);
  col = mix(col, uFog, smoothstep(uFar * 0.55, uFar, d) * 0.85);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function townMaterial(u: TownUniforms): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    uniforms: u as unknown as Record<string, THREE.IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    // 지도(MapLibre)가 그린 같은 자리의 벽보다 조금 앞에 — 줄무늬(z-fighting) 없이 이쪽이 보이게
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4,
  });
  return m;
}

/** 밤에 가로등 아래 바닥에 번지는 빛 */
export function poolMaterial(u: TownUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uNight: u.uNight },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; uniform float uNight; varying vec2 vUv;
      void main(){ float r = length(vUv - 0.5) * 2.0; float a = (1.0 - smoothstep(0.0, 1.0, r)); a = a * a * uNight * 0.6; if (a < 0.004) discard; gl_FragColor = vec4(vec3(1.0, 0.78, 0.45) * a, 1.0); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  });
}
