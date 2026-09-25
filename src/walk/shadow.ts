// 해 그림자: 해 쪽에서 내려다본 깊이 지도를 한 장 그리고, 건물·땅·풀 셰이더가 그걸 들여다본다.
// (거리의 재질이 모두 손으로 쓴 셰이더라 three.js 기본 그림자 대신 직접 한다.)
// 여행자 둘레 ±70 m 상자만 — 텍셀 단위로 붙여 움직여서 그림자 가장자리가 떨지 않게.
import * as THREE from 'three';

export interface ShadowUniforms {
  uShadowMap: { value: THREE.Texture };
  uShadowMatrix: { value: THREE.Matrix4 };
  uShadowOn: { value: number };
  uShadowTexel: { value: number };
}

let blank: THREE.DataTexture | null = null;
/** 그림자가 없을 때 묶어 둘 텍스처(깊이 1 = 아무것도 가리지 않음) */
function blankTex() {
  if (!blank) { blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blank.needsUpdate = true; }
  return blank;
}

export function shadowUniforms(): ShadowUniforms {
  return { uShadowMap: { value: blankTex() }, uShadowMatrix: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: 1 / 2048 } };
}

/** 셰이더에 넣는 조각: shadowAt(세계 좌표) → 1 = 햇빛, 0 = 그늘 */
export const SHADOW_GLSL = /* glsl */ `
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowOn;
uniform float uShadowTexel;
float shadowAt(vec3 wp) {
  if (uShadowOn < 0.01) return 1.0;
  vec4 c = uShadowMatrix * vec4(wp, 1.0);
  vec3 s = c.xyz / c.w;
  if (s.x <= 0.0 || s.x >= 1.0 || s.y <= 0.0 || s.y >= 1.0 || s.z >= 1.0) return 1.0;
  float lit = 0.0;
  // 3×3 칸을 보고 부드럽게(PCF)
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
    float d = texture2D(uShadowMap, s.xy + vec2(float(i), float(j)) * uShadowTexel).r;
    lit += (s.z - 0.00015 > d) ? 0.0 : 1.0;
  }
  lit /= 9.0;
  vec2 e = min(s.xy, 1.0 - s.xy);
  float edge = smoothstep(0.0, 0.1, min(e.x, e.y)); // 상자 가장자리에선 서서히 사라진다
  return mix(1.0, lit, uShadowOn * edge);
}
`;

export class SunShadow {
  readonly u: ShadowUniforms;
  private rt: THREE.WebGLRenderTarget | null = null;
  private size = 0;
  private readonly cam = new THREE.OrthographicCamera(-70, 70, 70, -70, 1, 1300);
  private readonly depthMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  private readonly bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  private readonly v = new THREE.Vector3();
  /** 그림자 상자 반폭(m) */
  extent = 70;

  constructor(u: ShadowUniforms) {
    this.u = u;
    this.cam.up.set(0, 0, 1);
  }

  /** 그림자 지도 크기(0 = 끔) */
  setSize(n: number) {
    if (n === this.size) return;
    this.size = n;
    this.rt?.dispose();
    this.rt = null;
    if (!n) { this.u.uShadowOn.value = 0; this.u.uShadowMap.value = blankTex(); return; }
    const dt = new THREE.DepthTexture(n, n);
    dt.type = THREE.UnsignedIntType;
    this.rt = new THREE.WebGLRenderTarget(n, n, { depthTexture: dt, depthBuffer: true });
    this.rt.texture.generateMipmaps = false;
    this.u.uShadowMap.value = dt;
    this.u.uShadowTexel.value = 1 / n;
  }

  /**
   * 해 쪽에서 깊이를 그린다. casters = 그림자를 드리우는 장면들, hide = 이번 패스에서 뺄 것(땅·풀·하늘·먼 도시).
   * strength: 해 높이·밤에 따라 0..1
   */
  render(R: THREE.WebGLRenderer, casters: THREE.Object3D[], hide: THREE.Object3D[], center: THREE.Vector3, sun: THREE.Vector3, strength: number) {
    if (!this.rt || strength < 0.02) { this.u.uShadowOn.value = 0; return; }
    const c = this.cam, E = this.extent;
    c.left = -E; c.right = E; c.top = E; c.bottom = -E;
    c.updateProjectionMatrix();
    const s = this.v.copy(sun).normalize();
    c.position.copy(center).addScaledVector(s, 650);
    c.lookAt(center);
    c.updateMatrixWorld();
    // 텍셀 단위로 붙인다(걸을 때 그림자 가장자리가 반짝이지 않게)
    const texel = (2 * E) / this.size;
    const local = center.clone().applyMatrix4(c.matrixWorldInverse);
    const dx = Math.round(local.x / texel) * texel - local.x, dy = Math.round(local.y / texel) * texel - local.y;
    const right = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(c.matrixWorld, 1);
    c.position.addScaledVector(right, -dx).addScaledVector(up, -dy);
    c.updateMatrixWorld();
    const was = hide.map((o) => o.visible);
    for (const o of hide) o.visible = false;
    const prevTarget = R.getRenderTarget();
    R.setRenderTarget(this.rt);
    R.clear(false, true, false);
    for (const scene of casters) {
      const sc = scene as THREE.Scene;
      const ov = sc.overrideMaterial;
      sc.overrideMaterial = this.depthMat;
      R.render(sc, c);
      sc.overrideMaterial = ov;
    }
    R.setRenderTarget(prevTarget);
    hide.forEach((o, i) => { o.visible = was[i]; });
    this.u.uShadowMatrix.value.multiplyMatrices(this.bias, c.projectionMatrix).multiply(c.matrixWorldInverse);
    this.u.uShadowOn.value = strength;
  }
}
