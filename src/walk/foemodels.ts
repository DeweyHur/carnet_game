// 적의 모습: 모델 파일 없이 도형을 빚고, 캔버스로 직접 그린 무늬(털 · 마리니에르 줄무늬 · 이끼 낀 돌)를 입힌다.
// 툰 셰이딩(3단 명암) + 검은 외곽선. 같은 재질의 조각은 한 덩어리로 합쳐(merge) 밤 습격처럼 수십 마리가 나와도 가볍게.
// 좌표: x 오른쪽 · y 앞 · z 위. 움직이는 부분(쥐의 칼 팔 · 가고일의 날개)만 따로 둔다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
export type FoeKind = 'slime' | 'rat' | 'gargoyle' | 'boss' | 'ratking';

// ───────── 공용: 명암 램프 · 외곽선 · 캔버스 무늬 ─────────
let rampTex: THREE.DataTexture | null = null;
function ramp() {
  if (rampTex) return rampTex;
  const d = new Uint8Array([85, 85, 85, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  rampTex = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  rampTex.minFilter = rampTex.magFilter = THREE.NearestFilter;
  rampTex.needsUpdate = true;
  return rampTex;
}
const outlines = new Map<string, THREE.MeshBasicMaterial>();
function outline(width: number, color = 0x1a1512) {
  const k = `${width}:${color}`;
  let m = outlines.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`); };
    outlines.set(k, m);
  }
  return m;
}
const texCache = new Map<string, THREE.CanvasTexture>();
function paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!, w, h);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** 털: 짧은 붓질을 수천 번 */
const furTex = () => paint('fur', 256, 256, (g, w, h) => {
  seed = 11;
  g.fillStyle = '#8a7a6c'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * w, y = rnd() * h, l = 4 + rnd() * 7, a = Math.PI / 2 + (rnd() - 0.5) * 0.7, v = rnd();
    g.strokeStyle = v < 0.45 ? 'rgba(60,48,40,0.55)' : v < 0.8 ? 'rgba(160,146,132,0.5)' : 'rgba(205,192,178,0.45)';
    g.lineWidth = 1 + rnd();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
});
/** 쥐의 몸통: 아래는 털(바지), 가운데는 파리의 마리니에르(흰 바탕 남색 줄), 위는 털 */
const shirtTex = () => paint('shirt', 128, 256, (g, w, h) => {
  seed = 5;
  const band = (y0: number, y1: number, col: string) => { g.fillStyle = col; g.fillRect(0, h * (1 - y1), w, h * (y1 - y0)); };
  band(0, 1, '#f2eee4');
  for (let i = 0; i < 8; i++) { const y = 0.34 + i * 0.07; band(y, y + 0.032, '#233a6b'); }
  band(0, 0.3, '#3a4a6a'); // 바지(짙은 남색)
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${0.04 + rnd() * 0.05})`; g.fillRect(rnd() * w, h * (1 - rnd() * 0.3), 2, 2); }
  band(0.28, 0.31, '#5a3a22'); // 허리띠
  g.fillStyle = '#d8b04a'; g.fillRect(w * 0.45, h * (1 - 0.31), w * 0.1, h * 0.03);
  band(0.9, 1, '#8a7a6c');
  // 천 주름 명암
  const gr = g.createLinearGradient(0, 0, w, 0);
  gr.addColorStop(0, 'rgba(0,0,0,0.08)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});
/** 돌: 얼룩 · 금 · 이끼(가고일은 노트르담의 오래된 돌) */
const stoneTex = () => paint('stone', 256, 256, (g, w, h) => {
  seed = 3;
  g.fillStyle = '#9a9890'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { const r = 2 + rnd() * 10, v = 120 + rnd() * 60 | 0; g.fillStyle = `rgba(${v},${v - 2},${v - 8},0.25)`; g.beginPath(); g.arc(rnd() * w, rnd() * h, r, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(40,38,34,0.7)'; g.lineWidth = 1.4;
  for (let i = 0; i < 14; i++) { let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 28; y += rnd() * 20; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${70 + rnd() * 30 | 0},${110 + rnd() * 40 | 0},${50 + rnd() * 20 | 0},${0.35 + rnd() * 0.3})`; g.beginPath(); g.arc(rnd() * w, h * (0.6 + rnd() * 0.4), 1.5 + rnd() * 4, 0, TAU); g.fill(); }
});
/** 부드러운 빛 한 점(눈의 빛 · 핵) */
export const glowTex = () => paint('glow', 64, 64, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.6)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});

// ───────── 도형 도우미 ─────────
type G = THREE.BufferGeometry;
/** 옆모습 [반지름, 높이]를 아래→위로 돌려 깎는다(z축이 위) */
const lathe = (prof: [number, number][], seg = 18) => new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(Math.max(0.001, r), z)), seg).rotateX(Math.PI / 2);
const ball = (r: number, sx = 1, sy = 1, sz = 1, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz);
/** 원뿔을 활처럼 휘게(뿔 · 발톱 · 꼬리 끝) — y 방향으로 뻗은 원뿔을 x쪽으로 bend 라디안만큼 굽힌다 */
function hornGeo(r: number, len: number, bend: number, seg = 8): G {
  const g = new THREE.ConeGeometry(r, len, seg, 6).translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = y / len, a = bend * t, R = len / (bend || 1e-6);
    const x = p.getX(i);
    // 중심선이 반지름 R의 원호를 따른다
    const cx = bend ? R - R * Math.cos(a) : 0, cy = bend ? R * Math.sin(a) : y;
    p.setXY(i, cx + x * Math.cos(a), cy - x * Math.sin(a));
  }
  g.computeVertexNormals();
  return g;
}
const tube = (pts: [number, number, number][], r: number, seg = 16) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), seg, r, 6, false);
/** 조각을 모아 재질별로 합친다. line이면 외곽선도 함께. */
class Kit {
  private parts = new Map<string, G[]>();
  private lined: G[] = [];
  private done: { key: string; geo: G }[] | null = null;
  private line: G | null = null;
  add(key: string, g: G, line = true) {
    (this.parts.get(key) ?? this.parts.set(key, []).get(key)!).push(g);
    if (line) this.lined.push(g);
    return this;
  }
  build(into: THREE.Object3D, mat: (key: string) => THREE.Material, lineW: number, lineColor?: number) {
    if (!this.done) {
      this.done = [...this.parts].map(([key, gs]) => ({ key, geo: merge(gs) }));
      if (this.lined.length) this.line = merge(this.lined.map((g) => { const c = new THREE.BufferGeometry(); c.setAttribute('position', g.attributes.position); c.setAttribute('normal', g.attributes.normal); if (g.index) c.setIndex(g.index); return c; }));
    }
    for (const { key, geo } of this.done) into.add(new THREE.Mesh(geo, mat(key)));
    if (this.line) into.add(new THREE.Mesh(this.line, outline(lineW, lineColor)));
  }
}
function merge(gs: G[]): G {
  const norm = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  // 속성 이름을 맞춘다(position · normal · uv만)
  for (const g of norm) for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  const hasUv = norm.every((g) => g.attributes.uv);
  if (!hasUv) for (const g of norm) g.deleteAttribute('uv');
  return mergeGeometries(norm, false) ?? norm[0];
}

// 같은 종류의 모양은 한 번만 만든다(재질만 한 마리씩 — 맞으면 번쩍이는 색이 따로 움직이므로)
interface Proto { kit: Kit; arm?: Kit; wings?: Kit[]; glows: [number, number, number, number, number][]; lineW: number; lineColor?: number; extra?: (body: THREE.Group, M: (k: string) => THREE.Material) => void }
const protos = new Map<FoeKind, Proto>();

function ratProto(king: boolean): Proto {
  const k = new Kit(), arm = new Kit();
  // 몸통: 배가 볼록한 서양배 모양 — 줄무늬 셔츠와 바지
  k.add('shirt', lathe([[0.02, 0.22], [0.2, 0.26], [0.29, 0.4], [0.31, 0.55], [0.27, 0.72], [0.19, 0.86], [0.12, 0.93]]));
  k.add('red', new THREE.TorusGeometry(0.15, 0.045, 8, 18).translate(0, 0, 0.9)); // 목에 두른 빨간 스카프
  k.add('red', new THREE.ConeGeometry(0.07, 0.16, 6).rotateX(Math.PI).translate(0.06, 0.14, 0.82));
  // 머리: 앞으로 길쭉한 털 공 + 주둥이
  const H = (g: G) => g.translate(0, 0.06, 1.08);
  k.add('fur', H(ball(0.2, 1, 1.12, 0.95)));
  k.add('fur', H(lathe([[0.15, 0], [0.13, 0.1], [0.09, 0.2], [0.04, 0.27], [0.01, 0.29]], 14).rotateX(-Math.PI / 2).translate(0, 0.1, -0.04)));
  k.add('pink', H(ball(0.045).translate(0, 0.39, -0.03)), false); // 코
  k.add('white', H(new THREE.BoxGeometry(0.05, 0.025, 0.06).translate(-0.028, 0.33, -0.12)), false); // 앞니
  k.add('white', H(new THREE.BoxGeometry(0.05, 0.025, 0.06).translate(0.028, 0.33, -0.12)), false);
  for (const sx of [-1, 1]) {
    // 둥글고 큰 귀(분홍 속)
    k.add('fur', H(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 16).rotateZ(Math.PI / 2).rotateY(sx * 0.35).rotateX(-0.2).translate(sx * 0.17, -0.02, 0.17)));
    k.add('pink', H(new THREE.CylinderGeometry(0.095, 0.095, 0.02, 16).rotateZ(Math.PI / 2).rotateY(sx * 0.35).rotateX(-0.2).translate(sx * 0.17 + sx * 0.012, 0.012, 0.17)), false);
    // 눈: 흰자 + 큰 눈동자 + 반짝임 + 찌푸린 눈썹
    k.add('white', H(ball(0.058, 1, 0.6, 1.1).translate(sx * 0.085, 0.165, 0.055)), false);
    k.add('black', H(ball(0.034, 1, 0.6, 1.1).translate(sx * 0.08, 0.2, 0.05)), false);
    k.add('white', H(ball(0.012).translate(sx * 0.07, 0.215, 0.07)), false);
    k.add('black', H(new THREE.BoxGeometry(0.09, 0.02, 0.022).rotateY(sx * 0.45).translate(sx * 0.085, 0.19, 0.125)), false);
    // 다리 · 큰 발
    k.add('shirt', new THREE.CapsuleGeometry(0.075, 0.18, 4, 8).rotateX(Math.PI / 2).translate(sx * 0.13, 0, 0.18));
    k.add('pink', ball(0.09, 0.8, 1.4, 0.45).translate(sx * 0.14, 0.07, 0.04));
    // 왼팔(칼 없는 쪽)은 허리에
    if (sx < 0) k.add('fur', new THREE.CapsuleGeometry(0.055, 0.22, 4, 8).rotateY(0.6).translate(-0.3, 0.02, 0.62));
  }
  // 꼬리: 뒤로 휘어 올라가는 분홍 꼬리
  k.add('pink', tube([[0, -0.22, 0.3], [0, -0.45, 0.2], [0.1, -0.7, 0.3], [0.05, -0.85, 0.55], [-0.05, -0.8, 0.7]], 0.028, 20));
  // 베레모: 납작한 빵 모양 + 꼭지
  k.add('beret', ball(0.19, 1.05, 1, 0.38).rotateY(-0.25).translate(0.03, 0.02, 1.27));
  k.add('beret', new THREE.CylinderGeometry(0.012, 0.018, 0.06, 6).translate(0, 0, 0).rotateX(Math.PI / 2).translate(0.03, 0.02, 1.35), false);
  // 칼 팔(움직인다): 어깨를 축으로 — 팔 · 손 · 세이버(금빛 손잡이 컵)
  arm.add('fur', new THREE.CapsuleGeometry(0.055, 0.16, 4, 8).rotateX(-0.57).translate(0, 0.11, -0.07));
  arm.add('pink', ball(0.05).translate(0, 0.22, -0.14));
  arm.add('gold', ball(0.075, 1, 0.45, 1, 12, 8).translate(0, 0.27, -0.14));
  arm.add('steel', new THREE.BoxGeometry(0.022, 0.72, 0.045).translate(0, 0.65, -0.14));
  arm.add('steel', new THREE.ConeGeometry(0.023, 0.08, 4).translate(0, 1.05, -0.14), false);
  const extra = king ? (body: THREE.Group, M: (k: string) => THREE.Material) => {
    // 쥐왕: 금관 · 붉은 망토 · 황금 칼
    const crown = new Kit();
    crown.add('gold', new THREE.CylinderGeometry(0.16, 0.15, 0.08, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0.02, 1.33));
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; crown.add('gold', new THREE.ConeGeometry(0.035, 0.13, 5).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.15, 0.02 + Math.sin(a) * 0.15, 1.42)); crown.add('red', ball(0.022).translate(Math.cos(a) * 0.16, 0.02 + Math.sin(a) * 0.16, 1.34), false); }
    const capeShape = new THREE.Shape(); capeShape.moveTo(-0.22, 0); capeShape.quadraticCurveTo(-0.4, -0.5, -0.36, -0.85); for (let i = 0; i <= 6; i++) capeShape.lineTo(-0.36 + (0.72 * i) / 6, -0.85 + (i % 2 ? 0.07 : 0)); capeShape.quadraticCurveTo(0.4, -0.5, 0.22, 0);
    crown.add('cape', new THREE.ShapeGeometry(capeShape).rotateX(Math.PI / 2 - 0.12).translate(0, -0.26, 0.95));
    crown.add('fur', new THREE.TorusGeometry(0.2, 0.06, 8, 18).translate(0, -0.02, 0.9)); // 털 깃
    crown.build(body, M, 0.012);
  } : undefined;
  return { kit: k, arm, glows: king ? [[0.085, 0.2, 1.13, 0.12, 0xffc03a], [-0.085, 0.2, 1.13, 0.12, 0xffc03a]] : [], lineW: 0.012, extra };
}

function slimeProto(): Proto {
  const k = new Kit();
  // 물방울: 아래가 넓고 위가 뾰족, 끝이 살짝 말린다
  k.add('gel', lathe([[0.001, 0], [0.42, 0.02], [0.58, 0.14], [0.6, 0.3], [0.52, 0.5], [0.36, 0.7], [0.18, 0.86], [0.05, 0.97], [0.001, 1.0]], 24));
  k.add('gel', hornGeo(0.05, 0.22, 1.8, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).translate(0, -0.02, 0.96));
  k.add('core', ball(0.2, 1, 1, 0.9).translate(0.05, -0.1, 0.34), false);
  for (const [x, y, z, r] of [[-0.25, -0.2, 0.24, 0.05], [0.28, -0.15, 0.5, 0.035], [-0.12, -0.28, 0.58, 0.03], [0.18, -0.3, 0.18, 0.04]] as const) k.add('bubble', ball(r).translate(x, y, z), false);
  // 얼굴: 반짝이는 큰 눈 · 볼터치 · 작은 입
  for (const sx of [-1, 1]) {
    k.add('black', ball(0.075, 0.9, 0.5, 1.25).translate(sx * 0.17, 0.555, 0.4), false);
    k.add('white', ball(0.026, 1, 0.5, 1).translate(sx * 0.17 - 0.025, 0.59, 0.45), false);
    k.add('white', ball(0.013, 1, 0.5, 1).translate(sx * 0.17 + 0.025, 0.59, 0.36), false);
    k.add('blush', ball(0.06, 1.3, 0.3, 0.6).translate(sx * 0.3, 0.52, 0.28), false);
  }
  k.add('black', new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI).rotateX(Math.PI / 2).rotateY(Math.PI).translate(0, 0.6, 0.3), false);
  // 반짝이는 윗면(빛 받는 곳)
  k.add('shine', ball(0.11, 1.4, 0.5, 0.6).rotateY(0.5).rotateX(-0.5).translate(-0.2, 0.2, 0.72), false);
  return { kit: k, glows: [], lineW: 0.014, lineColor: 0x21465f };
}

function gargProto(boss: boolean): Proto {
  const k = new Kit(), wl = new Kit(), wr = new Kit();
  // 웅크린 몸: 굽은 등 · 넓은 가슴
  k.add('stone', lathe([[0.02, 0.2], [0.22, 0.24], [0.3, 0.38], [0.33, 0.55], [0.3, 0.72], [0.2, 0.86], [0.08, 0.92]]).rotateX(0.35).translate(0, 0.05, 0));
  // 머리: 사자 같은 코 · 벌린 입 · 굽은 뿔 · 뾰족 귀
  const H = (g: G) => g.translate(0, 0.28, 0.98);
  k.add('stone', H(ball(0.21, 1, 1.1, 0.95)));
  k.add('stone', H(ball(0.12, 1.15, 1, 0.75).translate(0, 0.18, -0.03)));
  k.add('dark', H(ball(0.1, 1.1, 0.8, 0.4).translate(0, 0.2, -0.1)), false); // 벌린 입(어둠)
  for (const sx of [-1, 1]) {
    k.add('bone', H(new THREE.ConeGeometry(0.018, 0.07, 5).rotateX(Math.PI).translate(sx * 0.05, 0.27, -0.06)), false); // 송곳니
    k.add('dark', H(hornGeo(0.05, 0.3, 1.5).rotateZ(sx * -1.2).rotateY(sx * 0.3).translate(sx * 0.12, -0.02, 0.15)));
    k.add('stone', H(new THREE.ConeGeometry(0.06, 0.18, 4).rotateY(sx * 0.9).translate(sx * 0.2, -0.06, 0.06)));
    k.add('dark', H(new THREE.BoxGeometry(0.1, 0.03, 0.03).rotateY(sx * -0.5).translate(sx * 0.08, 0.17, 0.1)), false); // 찌푸린 이마
    k.add('eye', H(ball(0.035, 1.3, 0.6, 0.8).translate(sx * 0.08, 0.2, 0.05)), false);
    // 팔 · 갈퀴 발톱
    k.add('stone', new THREE.CapsuleGeometry(0.06, 0.3, 4, 8).rotateX(0.5).translate(sx * 0.3, 0.22, 0.5));
    for (let c = -1; c <= 1; c++) k.add('bone', hornGeo(0.018, 0.1, -1.2, 5).rotateX(-0.3).translate(sx * 0.3 + c * 0.03, 0.36, 0.3), false);
    // 다리: 쪼그린 무릎
    k.add('stone', new THREE.CapsuleGeometry(0.08, 0.14, 4, 8).rotateX(-0.9).translate(sx * 0.15, 0.08, 0.22));
    for (let c = -1; c <= 1; c++) k.add('bone', hornGeo(0.02, 0.1, -1.2, 5).translate(sx * 0.15 + c * 0.035, 0.16, 0.05), false);
    // 날개: 뼈대(팔) + 가리비처럼 파인 막
    const w = sx < 0 ? wl : wr;
    const bone = (a: [number, number], b: [number, number], r: number) => w.add('stone', tube([[0, 0, 0], [(a[0] + b[0]) / 2 * sx, 0, (a[1] + b[1]) / 2 + 0.03], [b[0] * sx, 0, b[1]]], r, 6));
    bone([0, 0], [0.55, 0.45], 0.03); bone([0.55, 0.45], [1.05, 0.55], 0.022); bone([0.55, 0.45], [0.9, 0.05], 0.018); bone([0.55, 0.45], [0.62, -0.18], 0.018);
    const sh = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.55, 0.45), new THREE.Vector2(1.05, 0.55)]);
    sh.quadraticCurveTo(0.92, 0.25, 0.9, 0.05); sh.quadraticCurveTo(0.74, 0.06, 0.62, -0.18); sh.quadraticCurveTo(0.35, -0.1, 0.12, -0.2); sh.lineTo(0, 0);
    w.add('wing', new THREE.ShapeGeometry(sh, 10).rotateX(Math.PI / 2).scale(sx, 1, 1).translate(0, -0.01, 0), false);
  }
  // 꼬리: 끝이 창날
  k.add('stone', tube([[0, -0.2, 0.3], [0, -0.5, 0.2], [0.15, -0.75, 0.3], [0.2, -0.9, 0.5]], 0.035, 16));
  k.add('dark', new THREE.ConeGeometry(0.07, 0.16, 4).rotateX(0.6).translate(0.2, -0.92, 0.58));
  if (boss) {
    // 우두머리: 가슴의 갈라진 틈에서 불빛 · 뿔 왕관 · 등의 가시
    k.add('lava', ball(0.16, 1, 0.5, 1.2).translate(0, 0.28, 0.58), false);
    for (let i = 0; i < 5; i++) k.add('dark', new THREE.ConeGeometry(0.05, 0.22, 5).rotateX(-0.5).translate(0, -0.2 + i * 0.02, 0.9 - i * 0.12));
    for (let i = -2; i <= 2; i++) k.add('dark', hornGeo(0.03, 0.18, 0.4).rotateZ(i * 0.3).translate(i * 0.06, 0.2, 1.18));
  }
  const glows: Proto['glows'] = [[0.08, 0.48, 1.03, boss ? 0.2 : 0.16, boss ? 0xff5a1a : 0xffb030], [-0.08, 0.48, 1.03, boss ? 0.2 : 0.16, boss ? 0xff5a1a : 0xffb030]];
  if (boss) glows.push([0, 0.34, 0.58, 0.3, 0xff6a1a]);
  return { kit: k, wings: [wl, wr], glows, lineW: boss ? 0.008 : 0.012 };
}

const PALETTE: Record<string, (kind: FoeKind) => THREE.MeshToonMaterialParameters | 'basic'> = {
  fur: (kd) => ({ map: furTex(), color: kd === 'ratking' ? 0x6a5a50 : 0xffffff }),
  shirt: (kd) => ({ map: shirtTex(), color: kd === 'ratking' ? 0xb8a0a0 : 0xffffff }),
  pink: () => ({ color: 0xeca8a4 }),
  white: () => 'basic',
  black: () => 'basic',
  red: () => ({ color: 0xc8283a }),
  beret: (kd) => ({ color: kd === 'ratking' ? 0x5a1020 : 0x2a2a33 }),
  steel: (kd) => ({ color: kd === 'ratking' ? 0xf1cd5a : 0xd8dde4 }),
  gold: () => ({ color: 0xe6b422 }),
  cape: () => ({ color: 0x9c1826, side: THREE.DoubleSide }),
  gel: () => ({ color: 0x86c8f0, transparent: true, opacity: 0.86 }),
  core: () => ({ color: 0xe8f7ff }),
  bubble: () => ({ color: 0xffffff, transparent: true, opacity: 0.7 }),
  blush: () => ({ color: 0xff8fa8, transparent: true, opacity: 0.75 }),
  shine: () => 'basic',
  stone: (kd) => ({ map: stoneTex(), color: kd === 'boss' ? 0x8a8690 : 0xffffff }),
  dark: (kd) => ({ color: kd === 'boss' ? 0x2c2a30 : 0x4a4a50 }),
  bone: () => ({ color: 0xe8e0c8 }),
  wing: (kd) => ({ map: stoneTex(), color: kd === 'boss' ? 0x4a4450 : 0x8a8490, side: THREE.DoubleSide }),
  eye: () => 'basic',
  lava: () => 'basic',
};
const BASIC: Record<string, number> = { white: 0xffffff, black: 0x14100e, shine: 0xffffff, eye: 0xffc040, lava: 0xff7a2a };

/** 한 마리 만들기 — combat.ts의 약속: g.userData.body, body.userData.arm(쥐), g.userData.wings(가고일) */
export function buildFoe(kind: FoeKind): { obj: THREE.Group; mats: THREE.MeshToonMaterial[] } {
  let P = protos.get(kind);
  if (!P) {
    P = kind === 'slime' ? slimeProto() : kind === 'rat' || kind === 'ratking' ? ratProto(kind === 'ratking') : gargProto(kind === 'boss');
    protos.set(kind, P);
  }
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  g.userData.body = body;
  const mats: THREE.MeshToonMaterial[] = [];
  const cache = new Map<string, THREE.Material>();
  const M = (key: string) => {
    let m = cache.get(key);
    if (m) return m;
    const p = PALETTE[key](kind);
    if (p === 'basic') m = new THREE.MeshBasicMaterial({ color: kind === 'boss' && key === 'eye' ? 0xff5a1a : BASIC[key] });
    else { const t = new THREE.MeshToonMaterial({ gradientMap: ramp(), ...p }); mats.push(t); m = t; }
    cache.set(key, m);
    return m;
  };
  const inner = new THREE.Group();
  body.add(inner);
  P.kit.build(inner, M, P.lineW, P.lineColor);
  P.extra?.(inner, M);
  if (P.arm) { const arm = new THREE.Group(); arm.position.set(0.3, 0.06, 0.78); P.arm.build(arm, M, P.lineW); inner.add(arm); body.userData.arm = arm; }
  if (P.wings) {
    const wings: THREE.Object3D[] = [];
    for (const [i, wk] of P.wings.entries()) { const w = new THREE.Group(); w.position.set((i ? 1 : -1) * 0.2, -0.1, 0.78); wk.build(w, M, P.lineW); inner.add(w); wings.push(w); }
    g.userData.wings = wings;
  }
  for (const [x, y, z, s, c] of P.glows) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.set(x, y, z); sp.scale.setScalar(s); inner.add(sp);
  }
  if (kind === 'ratking') inner.scale.setScalar(3.1);
  if (kind === 'boss') inner.scale.setScalar(3.2);
  // 쥐의 수염: 가는 선
  if (kind === 'rat' || kind === 'ratking') {
    const v: number[] = [];
    for (const sx of [-1, 1]) for (const dz of [-0.03, 0, 0.03]) v.push(sx * 0.05, 0.4, 1.07 + dz, sx * 0.32, 0.36 + Math.abs(dz), 1.07 + dz * 3);
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    inner.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x2a2420 })));
  }
  return { obj: g, mats };
}

// ───────── 타격 이펙트 무늬(combat.ts) ─────────
/** 베기 궤적: u는 호를 따라(앞이 짙고 꼬리는 사라진다), v는 반지름(바깥 날이 가장 밝다) */
export const slashTex = () => paint('slash', 256, 64, (g, w, h) => {
  seed = 21;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / (w - 1), v = 1 - y / (h - 1); // v=1 바깥
    const along = Math.pow(u, 1.6) * (1 - Math.pow(Math.max(0, u - 0.9) / 0.1, 2));
    const edge = Math.pow(v, 5) * 1.0 + Math.pow(v, 1.5) * 0.45;
    const streak = 0.75 + 0.25 * Math.sin(v * 38 + u * 6);
    const a = Math.max(0, Math.min(1, along * edge * streak));
    const core = Math.pow(v, 14) * along;
    const i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255 * Math.min(1, 0.55 + core);
    img.data[i + 3] = 255 * a;
  }
  g.putImageData(img, 0, 0);
});
/** 충격파: 바깥이 밝은 부드러운 고리 + 안쪽 은은한 빛 */
export const shockTex = () => paint('shock', 128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.55, 'rgba(255,255,255,0.08)'); r.addColorStop(0.82, 'rgba(255,255,255,0.55)');
  r.addColorStop(0.92, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
});
/** 호 띠(가운데 x,y · 반지름 r0~r1 · 시작각 a0에서 len 라디안) — uv가 호를 따른다 */
export function arcGeo(r0: number, r1: number, a0: number, len: number, seg = 28): THREE.BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = a0 + len * t, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r0, s * r0, 0, c * r1, s * r1, 0); uv.push(t, 0, t, 1);
    if (i < seg) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
/** 바닥 범위: 가운데는 옅고 테두리가 또렷한 원 + 안쪽 무늬 고리 */
export const areaTex = () => paint('area', 128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,0.35)'); r.addColorStop(0.7, 'rgba(255,255,255,0.45)'); r.addColorStop(0.93, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; g.setLineDash([6, 5]);
  g.beginPath(); g.arc(w / 2, w / 2, w * 0.36, 0, TAU); g.stroke();
});
