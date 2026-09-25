// 걷는 화면을 three.js가 전부 그린다: 카메라·하늘(구름·해)·땅·거리·사람·여행자.
// 지도 엔진(MapLibre)은 지도 보기(M)와 지하철 노선도, 그리고 건물·길 타일 주소를 주는 데만 쓴다.
// 좌표는 걷기 세계 그대로(x 동 · y 북 · z 위, 미터). 카메라의 위쪽은 +z.
import * as THREE from 'three';

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;

// 하늘: 천정 → 지평선 → (아래는 안개) + 해와 해무리 + 천천히 흐르는 뭉게구름
const SKY_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uFog; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uTime; uniform float uNight;
varying vec3 vDir;
float hh(vec2 p) { p = mod(p, 289.0); return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hh(i), hh(i + vec2(1, 0)), u.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vn(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.z;
  vec3 col = mix(uHorizon, uTop, smoothstep(0.0, 0.55, h));
  col = mix(col, uFog, 1.0 - smoothstep(-0.02, 0.08, h));
  float sd = max(dot(d, normalize(uSun)), 0.0);
  col += uSunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 60.0) * 0.35) * (1.0 - uNight);
  col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.9993, 0.9997, sd) * (1.0 - uNight));
  // 구름: 높이 1 km 판에 비춘 잡음
  if (h > 0.0) {
    vec2 uv = d.xy / (h + 0.08) * 1.4 + vec2(uTime * 0.004, uTime * 0.0025);
    float c = fbm(uv);
    float cov = smoothstep(0.52, 0.78, c) * smoothstep(0.0, 0.18, h);
    vec3 cloud = mix(vec3(0.98, 0.97, 0.95), uHorizon * 0.92, 0.35) * (0.8 + 0.25 * fbm(uv * 2.2 + 3.0));
    cloud = mix(cloud, uSunCol, 0.15 * pow(sd, 3.0));
    col = mix(col, cloud * mix(1.0, 0.25, uNight), cov * 0.9);
  }
  // 밤: 별
  if (uNight > 0.3 && h > 0.05) { vec2 g = floor(d.xy / (h + 0.3) * 260.0); float s = step(0.9975, hh(g)); col += vec3(s) * (uNight - 0.3) * 0.9; }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface ViewParts {
  scenes: THREE.Object3D[];
  figure?: { scene: THREE.Object3D; x: number; y: number; z: number; visible: boolean };
}

export class View {
  readonly el: HTMLDivElement;
  readonly canvas: HTMLCanvasElement;
  readonly pins: HTMLDivElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.3, 16000);
  private readonly skyScene = new THREE.Scene();
  private readonly sky: THREE.Mesh;
  readonly skyU = {
    uTop: { value: new THREE.Color('#a9c9ec') }, uHorizon: { value: new THREE.Color('#efe3d2') }, uFog: { value: new THREE.Color('#efe3d2') },
    uSun: { value: new THREE.Vector3(-0.45, -0.6, 0.66) }, uSunCol: { value: new THREE.Color(1, 0.95, 0.85) }, uTime: { value: 0 }, uNight: { value: 0 },
  };
  private dpr = Math.min(2, window.devicePixelRatio || 1);
  private shotCb: ((url: string | null) => void) | null = null;
  /** 화면 좌표 계산에 쓰는 (투영 × 보기) 행렬 */
  readonly viewProj = new THREE.Matrix4();
  visible = true;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'view';
    this.canvas = document.createElement('canvas');
    this.pins = document.createElement('div');
    this.pins.className = 'pins';
    this.el.append(this.canvas, this.pins);
    host.after(this.el);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0xefe3d2);
    this.camera.up.set(0, 0, 1);
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false }));
    this.sky.frustumCulled = false;
    this.skyScene.add(this.sky);
  }

  setPixelRatio(r: number) { this.dpr = r; }

  /** 카메라를 (x,y,z)에 두고 (fx,fy,fz)를 본다 */
  look(x: number, y: number, z: number, fx: number, fy: number, fz: number) {
    const c = this.camera;
    c.position.set(x, y, z);
    c.lookAt(fx, fy, fz);
    // 가까운 면은 카메라와 초점 거리에 맞춰(깊이 정밀도), 먼 면은 먼 땅·랜드마크까지
    const d = Math.hypot(x - fx, y - fy, z - fz);
    c.near = Math.max(0.15, Math.min(4, d * 0.06, Math.max(0.3, z * 0.01)));
    c.far = 16000;
  }

  /** 다음 그림을 한 장 떠서 돌려준다(사진) */
  capture(cb: (url: string | null) => void) { this.shotCb = cb; }

  /** 월드 좌표 → 화면(CSS px). 카메라 뒤면 false */
  project(x: number, y: number, z: number, out: { x: number; y: number }): boolean {
    const e = this.viewProj.elements;
    const X = e[0] * x + e[4] * y + e[8] * z + e[12];
    const Y = e[1] * x + e[5] * y + e[9] * z + e[13];
    const W = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (W <= 0.01) return false;
    out.x = ((X / W + 1) / 2) * this.el.clientWidth;
    out.y = ((1 - Y / W) / 2) * this.el.clientHeight;
    return true;
  }

  /** 캔버스 크기·해상도를 맞춘다. 그릴 수 없으면 false */
  private fit(c: THREE.PerspectiveCamera): boolean {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return false;
    const R = this.renderer;
    if (Math.abs(R.getPixelRatio() - this.dpr) > 0.01) R.setPixelRatio(this.dpr);
    const bw = Math.round(w * this.dpr), bh = Math.round(h * this.dpr);
    if (this.canvas.width !== bw || this.canvas.height !== bh) R.setSize(w, h, false);
    if (c.aspect !== w / h) c.aspect = w / h;
    c.updateProjectionMatrix();
    return true;
  }

  /** 다른 장면(지하철·버스)을 같은 렌더러·캔버스로 그린다 — WebGL 문맥을 하나만 쓴다 */
  renderWith(cam: THREE.PerspectiveCamera, scenes: THREE.Object3D[], figure: ViewParts['figure'] | undefined, clear: THREE.ColorRepresentation) {
    if (!this.fit(cam)) return;
    const R = this.renderer;
    R.setClearColor(clear);
    R.clear();
    for (const s of scenes) R.render(s as THREE.Scene, cam);
    if (figure?.visible) {
      figure.scene.position.set(figure.x, figure.y, figure.z);
      figure.scene.updateMatrixWorld(true);
      R.render(figure.scene as THREE.Scene, cam);
    }
  }

  render(p: ViewParts, dt: number) {
    const c = this.camera;
    if (!this.fit(c)) return;
    const R = this.renderer;
    c.updateMatrixWorld();
    this.viewProj.multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse);
    if (!this.visible) return;
    this.skyU.uTime.value += dt;
    R.setClearColor(this.skyU.uFog.value);
    R.clear();
    this.sky.position.copy(c.position);
    this.sky.updateMatrixWorld();
    R.render(this.skyScene, c);
    for (const s of p.scenes) R.render(s as THREE.Scene, c);
    if (p.figure?.visible) {
      p.figure.scene.position.set(p.figure.x, p.figure.y, p.figure.z);
      p.figure.scene.updateMatrixWorld(true);
      R.render(p.figure.scene as THREE.Scene, c);
    }
    if (this.shotCb) {
      const cb = this.shotCb;
      this.shotCb = null;
      let url: string | null = null;
      try {
        const out = document.createElement('canvas');
        out.width = 480;
        out.height = Math.round((480 * this.canvas.height) / this.canvas.width);
        out.getContext('2d')!.drawImage(this.canvas, 0, 0, out.width, out.height);
        url = out.toDataURL('image/jpeg', 0.82);
      } catch { url = null; }
      cb(url);
    }
  }
}
