// 랜드마크: 진짜 설계도가 아니라 멀리서도 한눈에 알아보는 모양. 실제 자리(경위도)에 세우고, 부딪힘도 넣어서 올라갈 수 있다.
// 에펠탑(층마다 쉬어 가며 꼭대기까지 올라가 글라이더로 내려온다) · 노트르담 · 사크레쾨르(큰 계단) · 개선문(아래로 지나간다) ·
// 루브르(유리 피라미드) · 퐁피두 센터(색색 파이프) · 시청 · 팡테옹 · 물랭 루주(날개가 돈다) · 생자크 탑 · 생제르맹데프레 · 몽파르나스 타워 · 뷔트쇼몽 신전 · 그랑 팔레.
import * as THREE from 'three';
import type { LngLat } from '../graph';
import { GeoBuilder, lin } from './geom';
import type { V3 } from './geom';
import { T } from './atlas';

type Solid = (rings: Float64Array[], base: number, top: number) => void;

export interface Landmark {
  id: string;
  name: string;
  emoji: string;
  pos: LngLat;
  /** 건물의 주축(+x)이 가리키는 방위(도, 북 0 · 시계 방향) */
  bearing: number;
  /** 이 반경(m) 안의 보통 건물은 세우지 않는다 */
  clear: number;
  /** 이 반경 안 건물은 이 겉모습으로(보주 광장 등) */
  zone?: { style: string; r: number };
  build?: (b: LB) => void;
  /** 매 프레임 움직이는 부분(물랭 루주 날개) */
  anim?: THREE.Object3D;
}

/** 랜드마크 좌표계로 그리는 도구: 원점 = 랜드마크 자리, +x = 주축 */
export class LB {
  readonly g: GeoBuilder;
  private readonly base: THREE.Matrix4;
  private readonly ox: number; private readonly oy: number; private readonly rot: number;
  readonly solid: Solid;
  readonly movers: THREE.Object3D[] = [];
  readonly extras: THREE.Object3D[] = [];
  constructor(g: GeoBuilder, ox: number, oy: number, rot: number, solid: Solid) {
    this.g = g; this.ox = ox; this.oy = oy; this.rot = rot; this.solid = solid;
    this.base = new THREE.Matrix4().makeRotationZ(rot).setPosition(ox, oy, 0);
  }
  /** 랜드마크 좌표 → 로컬 좌표 */
  at(x: number, y: number): [number, number] {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [this.ox + x * c - y * s, this.oy + x * s + y * c];
  }
  geo(geo: THREE.BufferGeometry, m: THREE.Matrix4, color: string, glow = 0) {
    this.g.addGeometry(geo, new THREE.Matrix4().multiplyMatrices(this.base, m), lin(color), glow);
    geo.dispose();
  }
  M(x = 0, y = 0, z = 0, rz = 0, rx = 0, ry = 0, s: [number, number, number] = [1, 1, 1]) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'ZXY')), new THREE.Vector3(...s));
  }
  box(x: number, y: number, z0: number, sx: number, sy: number, h: number, color: string, rz = 0, glow = 0) {
    this.geo(new THREE.BoxGeometry(sx, sy, h).translate(0, 0, h / 2), this.M(x, y, z0, rz), color, glow);
  }
  /** 창이 난 벽으로 두른 상자(아틀라스 칸) */
  tbox(x: number, y: number, z0: number, sx: number, sy: number, h: number, tile: number, tint = '#ffffff', roof = '#8e99a3', floorH = 3.05) {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    const P = (lx: number, ly: number) => { const [wx, wy] = this.at(x + lx, y + ly); return [wx, wy] as const; };
    const hx = sx / 2, hy = sy / 2;
    const corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]];
    for (let i = 0; i < 4; i++) {
      const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 4];
      const [wax, way] = P(ax, ay), [wbx, wby] = P(bx, by);
      const len = Math.hypot(bx - ax, by - ay);
      // 반시계로 도는 변의 바깥 법선 = 오른쪽
      const ex = (bx - ax) / len, ey = (by - ay) / len;
      const nlx = ey, nly = -ex;
      const nx = nlx * c - nly * s, ny = nlx * s + nly * c;
      const bay = 2.9 * Math.max(1, floorH / 3.05) * 0.8;
      this.g.wall(wax, way, wbx, wby, z0, z0 + h, nx, ny, [0, Math.max(1, Math.round(len / bay))], [0, Math.max(1, Math.round(h / floorH))], tile, lin(tint));
    }
    const pts = corners.map(([lx, ly]) => { const [wx, wy] = P(lx, ly); return [wx, wy]; });
    this.g.flat(pts, [], z0 + h, -1, lin(roof));
  }
  cyl(x: number, y: number, z0: number, rTop: number, rBot: number, h: number, segs: number, color: string, glow = 0, rz = 0) {
    this.geo(new THREE.CylinderGeometry(rTop, rBot, h, segs).rotateX(Math.PI / 2).translate(0, 0, h / 2), this.M(x, y, z0, rz), color, glow);
  }
  /** 옆으로 누운 삼각 지붕(맞배): x방향 길이 L, 폭 w, 높이 h */
  gable(x: number, y: number, z0: number, L: number, w: number, h: number, color: string, rz = 0) {
    const shape = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: L, bevelEnabled: false }).rotateY(Math.PI / 2).rotateX(Math.PI / 2).translate(-L / 2, 0, 0);
    // rotateY: 모양의 x→-z… 결과: 길이 방향 x, 폭 y, 높이 z
    this.geo(geo, this.M(x, y, z0, rz), color);
  }
  /** 회전체(돔·첨탑): [반지름, 높이] 목록 */
  lathe(x: number, y: number, z0: number, prof: [number, number][], segs: number, color: string, glow = 0) {
    const pts = prof.map(([r, z]) => new THREE.Vector2(Math.max(0.001, r), z));
    this.geo(new THREE.LatheGeometry(pts, segs).rotateX(Math.PI / 2), this.M(x, y, z0), color, glow);
  }
  /** 두 점을 잇는 기둥(각진 단면) */
  beam(a: V3, b: V3, r0: number, r1: number, segs: number, color: string, glow = 0) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = vb.clone().sub(va);
    const L = d.length();
    const geo = new THREE.CylinderGeometry(r1, r0, L, segs);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    const m = new THREE.Matrix4().compose(va.clone().add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    this.geo(geo, m, color, glow);
  }
  /** 부딪힘 상자(랜드마크 좌표) */
  sbox(x: number, y: number, sx: number, sy: number, base: number, top: number, rz = 0) {
    const c = Math.cos(rz), s = Math.sin(rz);
    const pts = [[-sx / 2, -sy / 2], [sx / 2, -sy / 2], [sx / 2, sy / 2], [-sx / 2, sy / 2]];
    const a = new Float64Array(8);
    pts.forEach(([lx, ly], i) => { const [wx, wy] = this.at(x + lx * c - ly * s, y + lx * s + ly * c); a[i * 2] = wx; a[i * 2 + 1] = wy; });
    this.solid([a], base, top);
  }
  scyl(x: number, y: number, r: number, base: number, top: number, n = 12) {
    const a = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const [wx, wy] = this.at(x + Math.cos(t) * r, y + Math.sin(t) * r); a[i * 2] = wx; a[i * 2 + 1] = wy; }
    this.solid([a], base, top);
  }
  /** 글자 간판(캔버스): (dx,dy) 쪽을 본다 */
  sign(text: string, x: number, y: number, z: number, w: number, h: number, dx: number, dy: number, bg: string, fg: string) {
    const cv = document.createElement('canvas');
    cv.width = 512; cv.height = Math.round(512 * (h / w));
    const g = cv.getContext('2d')!;
    g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = fg; g.shadowColor = fg; g.shadowBlur = 12;
    g.font = `bold ${Math.round(cv.height * 0.62)}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, cv.height / 2 + 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    const [wx, wy] = this.at(x, y);
    m.position.set(wx, wy, z);
    m.up.set(0, 0, 1);
    const c = Math.cos(this.rot), sn = Math.sin(this.rot);
    m.lookAt(wx + dx * c - dy * sn, wy + dx * sn + dy * c, z);
    this.extras.push(m);
  }

  /** 따로 움직이는 부분(물랭 루주 날개) */
  mover(obj: THREE.Object3D, x: number, y: number, z: number) {
    const [wx, wy] = this.at(x, y);
    obj.position.set(wx, wy, z);
    obj.rotation.z = this.rot;
    this.movers.push(obj);
  }
}

const STONE = '#ddd1b6', STONE_D = '#c9bb9a', LEAD = '#6c7680', WHITE = '#f4f1e9';

// ───────── 에펠탑 ─────────
function eiffel(b: LB) {
  const col = '#7b5f3e', dark = '#5e4730';
  const glow = 0.45;
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    b.beam([sx * 60, sy * 60, 0], [sx * 25, sy * 25, 57], 10, 6.5, 4, col, glow);
    // 다리 사이 가새(X)
    b.beam([sx * 52, sy * 52, 8], [sx * 30, sy * 30, 48], 1.1, 1.1, 4, dark, glow);
    b.beam([sx * 54, sy * 47, 8], [sx * 32, sy * 36, 48], 0.8, 0.8, 4, dark, glow);
    b.beam([sx * 25, sy * 25, 57], [sx * 13, sy * 13, 115], 5.5, 4, 4, col, glow);
  }
  // 네 면의 아치
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const geo = new THREE.TorusGeometry(40, 1.6, 6, 24, Math.PI).rotateX(Math.PI / 2);
    b.geo(geo, b.M(Math.cos(a) * 46, Math.sin(a) * 46, 4, a + Math.PI / 2), dark, glow);
  }
  b.box(0, 0, 52, 76, 76, 6, dark, 0, glow);
  b.box(0, 0, 58, 72, 72, 1.6, col, 0, glow); // 난간
  b.box(0, 0, 110, 42, 42, 5, dark, 0, glow);
  b.box(0, 0, 115, 40, 40, 1.4, col, 0, glow);
  // 꼭대기로 가늘어지는 몸통(네모 단면을 45° 돌려 모서리가 다리 쪽)
  b.geo(new THREE.CylinderGeometry(4.5, 19, 160, 4, 1, true).rotateY(Math.PI / 4).rotateX(Math.PI / 2).translate(0, 0, 80), b.M(0, 0, 115), col, glow);
  for (let z = 125; z < 270; z += 18) { const r = 19 - ((z - 115) / 160) * 14.5; b.box(0, 0, z, r * 1.45, r * 1.45, 1.2, dark, 0, glow); }
  b.box(0, 0, 272, 13, 13, 5, dark, 0, glow);
  b.cyl(0, 0, 277, 3.5, 4.5, 10, 8, col, glow);
  b.cyl(0, 0, 287, 0.6, 1.4, 38, 6, '#d9d2c4', glow);
  // 부딪힘: 다리 넷 → 1층 → 2층 다리 → 2층 → 층층이 가늘어지는 몸통(단마다 발 디딜 곳)
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { b.sbox(sx * 44, sy * 44, 14, 14, 0, 30); b.sbox(sx * 32, sy * 32, 12, 12, 29, 52); b.sbox(sx * 19, sy * 19, 8, 8, 58, 110); }
  b.sbox(0, 0, 76, 76, 50, 58);
  b.sbox(0, 0, 42, 42, 108, 115);
  let top = 115;
  for (const [h, r] of [[20, 15], [20, 13], [20, 11.2], [20, 9.6], [20, 8.2], [20, 7], [20, 6], [22, 5]] as const) { b.sbox(0, 0, r * 2, r * 2, top - 1, top + h); top += h; }
  b.sbox(0, 0, 13, 13, top - 1, 277);
}

// ───────── 샤요 궁(트로카데로) — 탑을 향해 두 팔을 벌린 초승달 날개 ─────────
function chaillot(b: LB) {
  const R = 170, CX = 150; // 호의 중심은 탑 쪽(+x)
  for (const sy of [-1, 1]) {
    for (let a = 14; a < 76; a += 7) {
      const t = ((a + 3.5) * Math.PI) / 180;
      const x = CX - R * Math.cos(t), y = sy * R * Math.sin(t);
      const rz = sy * (Math.PI / 2 - t); // 호를 따라 눕힌다
      b.box(x, y, 0, 17, 21.5, 20, STONE, rz);
      b.box(x, y, 20, 17.6, 22, 1.4, STONE_D, rz);
      b.box(x, y, 21.4, 15, 20, 3.2, '#cfc3a6', rz);
      // 탑 쪽 벽의 높은 창(밤엔 은은히)
      const c = Math.cos(rz), sn = Math.sin(rz);
      for (const k of [-6, 0, 6]) b.box(x + c * 8.6 - sn * k, y + sn * 8.6 + c * k, 4, 0.4, 3, 11, '#2d2a26', rz, 0.25);
      b.sbox(x, y, 17, 21.5, 0, 24.6, rz);
    }
    // 광장 끝 파빌리온
    b.box(-12, sy * 44, 0, 26, 18, 24, STONE);
    b.box(-12, sy * 44, 24, 27, 19, 1.4, STONE_D);
    b.sbox(-12, sy * 44, 26, 18, 0, 25.4);
    // 금빛 조각상들(광장 가장자리)
    for (let k = 0; k < 4; k++) { b.box(4 + k * 7, sy * 33, 0, 1.6, 1.6, 2.2, STONE_D); b.cyl(4 + k * 7, sy * 33, 2.2, 0.35, 0.55, 3.2, 6, '#d8b24a', 0.6); }
  }
  // 광장 바닥 테라스(인권 광장) — 올라서서 탑을 본다
  b.box(0, 0, 0, 40, 52, 0.4, '#e9dfc9');
  b.sbox(0, 0, 40, 52, 0, 0.4);
}

// ───────── 탑 발밑 회전목마 ─────────
function carrousel(b: LB) {
  b.cyl(0, 0, 0, 5.6, 5.8, 0.45, 20, '#d9c7a0');
  b.cyl(0, 0, 0.45, 0.5, 0.5, 5, 8, '#d8b24a', 0.5);
  b.sbox(0, 0, 11, 11, 0, 0.45);
  // 도는 부분: 기둥과 말, 줄무늬 지붕
  const spin = new THREE.Group();
  const gold = new THREE.MeshBasicMaterial({ color: 0xd8b24a });
  const cols = [0xf4f1e9, 0xc9a45a, 0x8a5a3a, 0xe8d8c0];
  for (let k = 0; k < 10; k++) {
    const t = (k / 10) * Math.PI * 2;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 5).rotateX(Math.PI / 2).translate(0, 0, 2.55), gold);
    pole.position.set(Math.cos(t) * 4.2, Math.sin(t) * 4.2, 0);
    const horse = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.3, 0.7).translate(0, 0, 1.55), new THREE.MeshBasicMaterial({ color: cols[k % 4] }));
    horse.position.copy(pole.position);
    horse.rotation.z = t;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.5, 0.6).translate(0, 0.7, 2.05), horse.material);
    head.position.copy(pole.position);
    head.rotation.z = t;
    spin.add(pole, horse, head);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(6.2, 2.2, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 5.75), new THREE.MeshBasicMaterial({ color: 0xc8333a, side: THREE.DoubleSide }));
  const band = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.2, 0.7, 20, 1, true).rotateX(Math.PI / 2).translate(0, 0, 4.4), new THREE.MeshBasicMaterial({ color: 0xf4efe2, side: THREE.DoubleSide }));
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6).translate(0, 0, 7), gold);
  spin.add(roof, band, top);
  const hub = new THREE.Group();
  hub.userData.spin = 'z';
  hub.add(spin);
  b.mover(hub, 0, 0, 0);
}

// ───────── 노트르담 ─────────
function notreDame(b: LB) {
  // 서쪽 정면(-x)과 두 탑
  b.tbox(-56, 0, 0, 10, 40, 44, T.blankStone, '#f3ece0', STONE, 6);
  for (const sy of [-13, 13]) {
    b.tbox(-56, sy, 0, 14, 14, 69, T.blankStone, '#efe6d4', STONE, 6);
    b.box(-56, sy, 69, 14.6, 14.6, 1.2, STONE_D);
    for (const [px, py] of [[-6.5, -6.5], [6.5, -6.5], [-6.5, 6.5], [6.5, 6.5]]) b.cyl(-56 + px, sy + py, 69, 0.2, 0.5, 3, 6, STONE_D);
    // 탑 창(길고 좁은)
    for (const k of [-3, 3]) b.box(-61.1, sy + k, 48, 0.3, 2.2, 16, '#2a2622');
  }
  // 정면 장식: 장미창·포털 셋·왕들의 회랑
  b.geo(new THREE.CylinderGeometry(5.2, 5.2, 0.4, 28).rotateZ(Math.PI / 2), b.M(-61.2, 0, 29), '#3a3f86', 0.8);
  b.geo(new THREE.TorusGeometry(5.4, 0.45, 6, 28).rotateY(Math.PI / 2), b.M(-61.3, 0, 29), STONE_D);
  for (const k of [-11, 0, 11]) { b.box(-61.2, k, 0, 0.6, k === 0 ? 7 : 6, 11, '#2b2620'); b.box(-61.3, k, 11, 0.5, k === 0 ? 7.6 : 6.6, 1.5, STONE_D); }
  b.box(-61.3, 0, 17, 0.6, 40, 2.2, STONE_D);
  b.box(-61.3, 0, 40, 0.8, 40, 1.4, STONE_D);
  // 신랑(가운데 높고 양옆 낮게) + 급한 납 지붕
  b.tbox(-8, 0, 0, 86, 14, 33, T.blankStone, '#f0e8d8', STONE, 6);
  b.gable(-8, 0, 33, 86, 14.5, 11, LEAD);
  for (const sy of [-12, 12]) { b.box(-8, sy, 0, 86, 10, 20, STONE); b.box(-8, sy, 20, 86, 10.4, 1, STONE_D); }
  // 높은 뾰족 창(스테인드글라스 — 밤엔 은은히 빛난다)
  for (let x = -46; x <= 30; x += 6) for (const s of [-1, 1]) { b.box(x, s * 7.05, 22, 2, 0.2, 9, '#2c3160', 0.45); b.box(x, s * 17.05, 5, 2.2, 0.2, 11, '#2c3160', 0.35); }
  // 날개(transept)
  b.tbox(12, 0, 0, 14, 46, 33, T.blankStone, '#f0e8d8', STONE, 6);
  b.gable(12, 0, 33, 46, 14.5, 11, LEAD, Math.PI / 2);
  for (const sy of [-23.2, 23.2]) b.geo(new THREE.CylinderGeometry(4, 4, 0.4, 24).rotateX(Math.PI / 2).rotateY(Math.PI / 2), b.M(12, sy, 24, Math.PI / 2), '#3a3f86', 0.8);
  // 뒤쪽 둥근 끝(애프스)
  b.cyl(36, 0, 0, 7, 7, 33, 16, STONE);
  b.cyl(36, 0, 33, 0.5, 7.4, 9, 16, LEAD);
  b.cyl(38, 0, 0, 14, 14, 20, 20, STONE);
  // 첨탑(플레슈)
  b.cyl(12, 0, 43, 2.2, 3, 8, 8, LEAD);
  b.cyl(12, 0, 51, 0.15, 2.2, 45, 8, LEAD);
  // 날아가는 버팀벽
  for (let x = -40; x <= 30; x += 8) for (const s of [-1, 1]) {
    b.beam([x, s * 21, 0], [x, s * 21, 22], 0.9, 0.9, 4, STONE_D);
    b.beam([x, s * 21, 20], [x, s * 7.5, 30], 0.45, 0.45, 4, STONE_D);
  }
  // 부딪힘
  b.sbox(-56, 0, 10, 40, 0, 44);
  for (const sy of [-13, 13]) b.sbox(-56, sy, 14, 14, 0, 69);
  b.sbox(-8, 0, 86, 34, 0, 20);
  b.sbox(-8, 0, 86, 14, 0, 38);
  b.sbox(12, 0, 14, 46, 0, 38);
  b.scyl(38, 0, 14, 0, 20);
}

// ───────── 사크레쾨르 ─────────
function sacreCoeur(b: LB) {
  // 언덕 대신 넓은 단 셋과 앞쪽 큰 계단(-x가 정면·남쪽)
  const tiers: [number, number, number][] = [[140, 110, 4], [110, 90, 8], [90, 70, 12]];
  for (const [sx, sy, top] of tiers) { b.box(8, 0, top - 4, sx, sy, 4, '#cfc7b4'); b.sbox(8, 0, sx, sy, 0, top); }
  // 계단(0.4 m씩)
  for (let k = 0; k < 30; k++) {
    const z = (k + 1) * 0.4;
    const x = -68 + k * 0.9;
    b.box(x, 0, 0, 0.9, 24, z, k % 2 ? '#e8e2d4' : '#ddd6c6');
    b.sbox(x, 0, 0.9, 24, 0, z);
  }
  const base = 12;
  b.tbox(10, 0, base, 56, 34, 20, T.blankStone, WHITE, WHITE);
  // 정면 현관: 아치 셋 + 작은 돔 둘
  b.tbox(-22, 0, base, 10, 26, 16, T.grandDoor, WHITE, WHITE);
  for (const k of [-7, 0, 7]) b.box(-27.2, k, base, 0.5, 5, 10, '#3a342c');
  for (const sy of [-11, 11]) { b.cyl(-22, sy, base + 16, 3.5, 3.5, 4, 16, WHITE); b.lathe(-22, sy, base + 20, dome(3.5, 7), 16, WHITE); b.cyl(-22, sy, base + 27, 0.3, 0.6, 3, 8, WHITE); }
  // 큰 돔: 원통 드럼 + 길쭉한 돔 + 등탑
  b.cyl(10, 0, base + 20, 11, 11, 14, 24, WHITE);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; b.box(10 + Math.cos(a) * 11.1, Math.sin(a) * 11.1, base + 23, 0.5, 1.4, 8, '#3a342c', a); }
  b.lathe(10, 0, base + 34, dome(11, 26), 28, WHITE);
  b.cyl(10, 0, base + 60, 2, 2.4, 6, 12, WHITE);
  b.lathe(10, 0, base + 66, dome(2.2, 5), 12, WHITE);
  b.cyl(10, 0, base + 71, 0.1, 0.5, 4, 6, '#c9a14a');
  // 네 모서리 작은 돔
  for (const [sx, sy] of [[-10, -13], [-10, 13], [30, -13], [30, 13]]) { b.cyl(sx, sy, base + 20, 4, 4, 8, 16, WHITE); b.lathe(sx, sy, base + 28, dome(4, 9), 16, WHITE); b.cyl(sx, sy, base + 37, 0.2, 0.6, 3, 6, WHITE); }
  // 종탑(뒤쪽)
  b.tbox(44, 0, base, 11, 11, 52, T.blankStone, WHITE, WHITE);
  b.cyl(44, 0, base + 52, 5, 5.5, 6, 12, WHITE);
  b.lathe(44, 0, base + 58, dome(5, 10), 16, WHITE);
  // 부딪힘
  b.sbox(10, 0, 56, 34, 0, base + 20);
  b.sbox(-22, 0, 10, 26, 0, base + 16);
  b.scyl(10, 0, 11, 0, base + 34);
  b.sbox(44, 0, 11, 11, 0, base + 52);
}

/** 로마-비잔틴식 길쭉한 돔 단면 */
function dome(r: number, h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; out.push([r * Math.cos(t * Math.PI / 2) ** 0.7, h * Math.sin(t * Math.PI / 2)]); }
  return out;
}

// ───────── 개선문 ─────────
function arc(b: LB) {
  // 큰 아치는 x축을 따라 뚫려 있다(샹젤리제 방향)
  for (const sy of [-15.3, 15.3]) {
    b.box(0, sy, 0, 22, 14.6, 29, STONE);
    // 부조(밝은 판)
    for (const sx of [-11.1, 11.1]) b.box(sx, sy, 6, 0.4, 9, 11, '#ece3cc');
    b.box(0, sy, 0, 22.6, 15.2, 2.5, STONE_D);
  }
  b.box(0, 0, 29, 22, 45, 21, STONE);
  b.box(0, 0, 29, 22.6, 45.6, 1.4, STONE_D);
  b.box(0, 0, 42, 23, 46, 1.6, STONE_D);
  b.box(0, 0, 48.5, 23.2, 46.2, 1.5, STONE_D);
  // 아치 천장 곡면
  b.geo(new THREE.CylinderGeometry(7.3, 7.3, 22, 16, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), b.M(0, 0, 29 - 7.3), '#cfc2a4');
  // 무명용사의 불꽃
  b.cyl(0, 0, 0, 0.5, 0.6, 0.4, 10, '#3a342c');
  b.cyl(0, 0, 0.4, 0.05, 0.25, 0.7, 6, '#ffb347', 1);
  for (const sy of [-15.3, 15.3]) b.sbox(0, sy, 22, 14.6, 0, 29);
  b.sbox(0, 0, 22, 45, 28.5, 50);
}

// ───────── 루브르: 유리 피라미드 + 나폴레옹 안뜰을 둘러싼 궁전 날개(ㄷ자, 서쪽이 열렸다) ─────────
function louvre(b: LB) {
  const GLASS = '#a7cbe0', STEEL = '#4b5661', SLATE = '#5f6a74', PALE = '#efe6d2';
  // 큰 피라미드(밑변 35 m, 높이 21.6 m) — 밤엔 은은히 빛난다
  b.cyl(0, 0, 0, 0.01, 24.75, 21.6, 4, GLASS, 0.35, Math.PI / 4);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.beam([sx * 17.5, sy * 17.5, 0], [0, 0, 21.6], 0.22, 0.22, 4, STEEL, 0.2);
  for (const z of [5.4, 10.8, 16.2]) { const h = 17.5 * (1 - z / 21.6); for (const [ax, ay, bx, by] of [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h]]) b.beam([ax, ay, z], [bx, by, z], 0.12, 0.12, 4, STEEL, 0.2); }
  // 작은 피라미드 셋과 물 웅덩이
  for (const [px, py] of [[0, 34], [0, -34], [34, 0]]) b.cyl(px, py, 0, 0.01, 5.6, 5, 4, GLASS, 0.35, Math.PI / 4);
  for (const [px, py, rz] of [[-26, 22, 0.6], [-26, -22, -0.6], [24, 24, -0.6], [24, -24, 0.6]]) b.box(px, py, 0, 22, 9, 0.35, '#6f9fbf', rz);
  // 날개: 북(리슐리외)·남(드농)·동(쉴리) — 창 난 벽 + 슬레이트 지붕
  for (const sy of [92, -92]) {
    b.tbox(-70, sy, 0, 240, 30, 24, T.grand, PALE, SLATE);
    b.gable(-70, sy, 24, 240, 30, 7, SLATE);
    b.tbox(-20, sy, 0, 42, 38, 30, T.grand, PALE, SLATE); // 파비용
    b.lathe(-20, sy, 30, [[21, 0], [18, 6], [10, 11], [0.5, 13]], 4, SLATE);
    b.sbox(-70, sy, 240, 30, 0, 24);
    b.sbox(-20, sy, 42, 38, 0, 30);
  }
  b.tbox(72, 0, 0, 30, 214, 24, T.grand, PALE, SLATE);
  b.gable(72, 0, 24, 214, 30, 7, SLATE, Math.PI / 2);
  b.tbox(72, 0, 0, 38, 40, 34, T.grand, PALE, SLATE); // 시계 파비용
  b.lathe(72, 0, 34, [[24, 0], [20, 7], [11, 13], [0.5, 15]], 4, SLATE);
  b.sbox(72, 0, 30, 214, 0, 24);
  b.sbox(72, 0, 38, 40, 0, 34);
  // 부딪힘: 피라미드는 계단 모양으로(꼭대기까지 기어오를 수 있다)
  for (let k = 0; k < 4; k++) { const w = 35 * (1 - k / 4); b.sbox(0, 0, w, w, 0, 5.4 * (k + 1)); }
}

// ───────── 퐁피두 센터 ─────────
function pompidou(b: LB) {
  const W = 166, D = 60, H = 42;
  b.box(0, 0, 0, W, D, H, '#c6dbe6', 0.25);
  for (let z = 7; z < H; z += 7) b.box(0, 0, z - 0.3, W + 0.2, D + 0.2, 0.6, '#e6ecef');
  b.box(0, 0, H, W + 1, D + 1, 1, WHITE);
  // 흰 골조
  for (let x = -W / 2; x <= W / 2; x += 12.8) for (const s of [-1, 1]) b.box(x, s * (D / 2 + 1.5), 0, 1, 1, H + 1, WHITE);
  for (let z = 0; z <= H; z += 7) for (const s of [-1, 1]) b.box(0, s * (D / 2 + 1.5), z, W, 0.6, 0.6, WHITE);
  // 동쪽 면의 색색 파이프(파랑 = 공기, 초록 = 물, 노랑 = 전기, 빨강 = 이동)
  const cols = ['#2d6cdf', '#3a9d5d', '#f2c14e', '#d9302c'];
  for (let i = 0; i < 26; i++) {
    const x = -W / 2 + 4 + i * 6.2, c = cols[i % 4];
    const r = i % 4 === 0 ? 1.4 : 0.7;
    b.cyl(x, D / 2 + 3.2 + (i % 2) * 1.2, 0, r, r, H + (i % 4 === 0 ? 6 : 1), 10, c);
  }
  for (let z = 8; z < H; z += 11) b.beam([-W / 2, D / 2 + 3.5, z], [W / 2, D / 2 + 3.5, z], 0.6, 0.6, 8, cols[(z / 11) % 4 | 0]);
  // 지붕 굴뚝(흰 파이프)
  for (const [x, y] of [[-40, 10], [-10, -12], [25, 8], [55, -10]]) { b.cyl(x, y, H, 1.5, 1.5, 7, 10, WHITE); b.cyl(x, y, H + 7, 2.2, 1.5, 1.2, 10, WHITE); }
  // 서쪽 면: 지그재그 에스컬레이터 관
  for (let k = 0; k < 5; k++) {
    const x0 = -60 + k * 30, z0 = 6 + k * 7;
    b.beam([x0, -D / 2 - 3, z0], [x0 + 30, -D / 2 - 3, z0 + 7], 1.6, 1.6, 12, '#dfe7ec');
    b.beam([x0, -D / 2 - 3, z0 - 1.6], [x0 + 30, -D / 2 - 3, z0 + 5.4], 0.4, 0.4, 6, '#d9302c');
  }
  b.sbox(0, 0, W, D, 0, H + 1);
}

// ───────── 시청 ─────────
function hotelDeVille(b: LB) {
  b.tbox(0, 0, 0, 110, 70, 20, T.grand, '#f4ecdc', '#56616b', 5);
  b.gable(0, 0, 20, 108, 70, 10, '#4e5963');
  // 모서리·가운데 파빌리온: 가파른 사각 지붕
  for (const [x, y, w] of [[-50, -30, 14], [50, -30, 14], [-50, 30, 14], [50, 30, 14], [0, -32, 20]] as const) {
    b.tbox(x, y, 0, w, 12, 24, T.grand, '#f4ecdc', '#56616b', 5);
    b.geo(new THREE.CylinderGeometry(0.4, w * 0.72, 11, 4, 1).rotateY(Math.PI / 4).rotateX(Math.PI / 2).translate(0, 0, 5.5), b.M(x, y, 24), '#4e5963');
  }
  // 시계탑
  b.tbox(0, -32, 24, 8, 8, 12, T.blankStone, '#f4ecdc');
  b.geo(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 20).rotateX(Math.PI / 2).rotateX(Math.PI / 2), b.M(0, -36.2, 31), '#f7f2e6', 0.4);
  b.cyl(0, -32, 36, 0.2, 4.5, 9, 4, '#4e5963');
  b.cyl(0, -32, 45, 0.05, 0.3, 4, 4, '#c9a14a');
  // 삼색기
  b.cyl(0, -32, 49, 0.05, 0.05, 5, 4, '#dddddd');
  b.box(0.9, -32, 52.4, 1.6, 0.05, 1.2, '#1d4a9c'); b.box(2.5, -32, 52.4, 1.6, 0.05, 1.2, '#ffffff'); b.box(4.1, -32, 52.4, 1.6, 0.05, 1.2, '#d9302c');
  b.sbox(0, 0, 110, 70, 0, 22);
  b.sbox(0, -32, 20, 12, 0, 24);
}

// ───────── 팡테옹 ─────────
function pantheon(b: LB) {
  b.tbox(10, 0, 0, 80, 70, 28, T.blankStone, '#efe6d2', STONE, 7);
  // 현관: 기둥 여섯 + 박공
  for (let k = 0; k < 6; k++) b.cyl(-34, -15 + k * 6, 0, 1.1, 1.2, 20, 12, '#efe8d8');
  b.box(-34, 0, 20, 10, 38, 3, STONE);
  b.gable(-34, 0, 23, 10, 38, 7, STONE, Math.PI / 2);
  // 드럼 + 열주 + 돔
  b.cyl(10, 0, 28, 16, 16, 18, 28, STONE);
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2; b.cyl(10 + Math.cos(a) * 17, Math.sin(a) * 17, 28, 0.6, 0.6, 16, 8, '#efe8d8'); }
  b.cyl(10, 0, 44, 17.8, 17.8, 2, 28, STONE);
  b.cyl(10, 0, 46, 13, 13, 6, 24, STONE);
  b.lathe(10, 0, 52, dome(13, 17), 28, '#8e99a3');
  b.cyl(10, 0, 69, 2, 2, 6, 12, STONE);
  b.lathe(10, 0, 75, dome(2.2, 4), 12, '#8e99a3');
  b.sbox(10, 0, 80, 70, 0, 28);
  b.scyl(10, 0, 16, 0, 46);
}

// ───────── 물랭 루주 ─────────
function moulinRouge(b: LB) {
  b.box(0, 0, 0, 30, 14, 10, '#b3262c');
  b.box(0, -7.2, 7.2, 22, 0.4, 2.4, '#1d1a17', 0, 0.9);
  b.sign('MOULIN ROUGE', 0, -7.45, 8.4, 21, 2.2, 0, -1, '#1d1a17', '#ff5a4f');
  for (let x = -14; x <= 14; x += 1.4) b.box(x, -7.25, 9.6, 0.25, 0.3, 0.25, '#ffd98a', 1);
  // 풍차: 몸통 + 모자 + 도는 날개
  b.geo(new THREE.CylinderGeometry(3.2, 4.2, 11, 8).rotateX(Math.PI / 2).translate(0, 0, 5.5), b.M(8, 0, 10), '#c43030');
  b.cyl(8, 0, 21, 0.2, 4.2, 3.5, 8, '#8a2020');
  const sails = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xe9dbb0 });
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.y = (k * Math.PI) / 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.15, 9).translate(0.6, 0, 4.8), mat);
    arm.add(blade);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 10).translate(0, 0, 5), new THREE.MeshBasicMaterial({ color: 0x5a3a22 }));
    arm.add(rail);
    sails.add(arm);
  }
  const hub = new THREE.Group();
  hub.add(sails);
  b.mover(hub, 8, -4.4, 18);
  b.sbox(0, 0, 30, 14, 0, 10);
  b.scyl(8, 0, 4, 0, 21);
}

// ───────── 생자크 탑 ─────────
function saintJacques(b: LB) {
  b.tbox(0, 0, 0, 10, 10, 46, T.blankStone, '#d9ccad', STONE_D);
  for (const [x, y] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) { b.cyl(x, y, 0, 0.7, 0.9, 48, 6, STONE_D); b.cyl(x, y, 48, 0.05, 0.8, 5, 6, STONE_D); }
  b.box(0, 0, 46, 10.4, 10.4, 1, STONE_D);
  b.cyl(3, 3, 47, 0.5, 0.6, 3, 8, '#bfb294');
  b.sbox(0, 0, 10, 10, 0, 47);
}

// ───────── 생제르맹데프레 성당 ─────────
function saintGermain(b: LB) {
  b.tbox(10, 0, 0, 60, 20, 18, T.blankStone, '#e2d6ba', STONE);
  b.gable(10, 0, 18, 60, 20.5, 8, '#5e6870');
  b.tbox(-24, 0, 0, 11, 11, 36, T.blankStone, '#e2d6ba', STONE);
  for (const s of [-1, 1]) b.box(-29.6, s * 2.5, 26, 0.3, 1.4, 5, '#2a2622');
  b.cyl(-24, 0, 36, 0.3, 7.8, 12, 4, '#4e5963', Math.PI / 4);
  b.cyl(-24, 0, 48, 0.05, 0.2, 2.5, 4, '#c9a14a');
  b.sbox(10, 0, 60, 20, 0, 18);
  b.sbox(-24, 0, 11, 11, 0, 36);
}

// ───────── 몽파르나스 타워(멀리 보이는 검은 탑) ─────────
function montparnasse(b: LB) {
  b.tbox(0, 0, 0, 50, 32, 210, T.modern, '#5d646c', '#3a3f45', 3.6);
  b.box(0, 0, 210, 44, 26, 4, '#2b2f35');
  b.sbox(0, 0, 50, 32, 0, 214);
}

// ───────── 뷔트쇼몽의 시빌 신전 ─────────
function sibylle(b: LB) {
  const rock = '#b59a78';
  b.geo(new THREE.CylinderGeometry(14, 30, 28, 9).rotateX(Math.PI / 2).translate(0, 0, 14), b.M(0, 0, 0), rock);
  b.geo(new THREE.IcosahedronGeometry(12, 1), b.M(10, 8, 20, 0, 0, 0, [1.3, 1, 0.8]), '#a88e6c');
  b.geo(new THREE.IcosahedronGeometry(10, 1), b.M(-12, -6, 18, 0, 0, 0, [1.2, 1.1, 0.8]), '#c2a684');
  b.cyl(0, 0, 28, 6.2, 6.4, 1, 20, WHITE);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; b.cyl(Math.cos(a) * 5.4, Math.sin(a) * 5.4, 29, 0.35, 0.4, 6, 8, WHITE); }
  b.cyl(0, 0, 35, 6.2, 6.2, 1.2, 20, WHITE);
  b.lathe(0, 0, 36.2, dome(6, 4), 20, WHITE);
  b.scyl(0, 0, 18, 0, 28);
}

// ───────── 그랑 팔레 ─────────
function grandPalais(b: LB) {
  b.tbox(0, 0, 0, 200, 90, 20, T.grand, '#f2ead8', STONE, 6.5);
  b.geo(new THREE.CylinderGeometry(22, 22, 180, 20, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2), b.M(0, 0, 20, 0, 0, 0, [1, 1, 0.55]), '#9fbccc');
  b.lathe(0, 0, 20, dome(24, 22), 24, '#9fbccc');
  b.cyl(0, 0, 42, 0.3, 0.3, 8, 4, '#dddddd');
  b.box(1.6, 0, 48.2, 3, 0.05, 1.8, '#1d4a9c'); b.box(4.6, 0, 48.2, 3, 0.05, 1.8, '#ffffff'); b.box(7.6, 0, 48.2, 3, 0.05, 1.8, '#d9302c');
  b.sbox(0, 0, 200, 90, 0, 28);
}

export const LANDMARKS: Landmark[] = [
  { id: 'eiffel', name: '에펠탑', emoji: '🗼', pos: [2.29448, 48.85826], bearing: 44, clear: 70, build: eiffel },
  { id: 'chaillot', name: '샤요 궁', emoji: '🏛', pos: [2.28805, 48.86229], bearing: 133.6, clear: 0, build: chaillot },
  { id: 'carrousel', name: '에펠탑 회전목마', emoji: '🎠', pos: [2.29268, 48.85871], bearing: 0, clear: 0, build: carrousel },
  { id: 'louvre', name: '루브르 박물관', emoji: '🔺', pos: [2.33585, 48.86099], bearing: 115, clear: 150, build: louvre },
  { id: 'notre-dame', name: '노트르담 대성당', emoji: '⛪', pos: [2.34994, 48.85297], bearing: 112, clear: 62, build: notreDame },
  { id: 'sacre-coeur', name: '사크레쾨르 대성당', emoji: '⛪', pos: [2.34306, 48.88672], bearing: 0, clear: 80, build: sacreCoeur },
  { id: 'arc', name: '개선문', emoji: '🏛', pos: [2.29504, 48.87378], bearing: 112, clear: 115, build: arc },
  { id: 'pompidou', name: '퐁피두 센터', emoji: '🎨', pos: [2.35222, 48.86065], bearing: 8, clear: 90, build: pompidou },
  { id: 'hotel-de-ville', name: '파리 시청', emoji: '🏛', pos: [2.35222, 48.85641], bearing: 8, clear: 80, build: hotelDeVille },
  { id: 'pantheon', name: '팡테옹', emoji: '🏛', pos: [2.34608, 48.84622], bearing: 90, clear: 50, build: pantheon },
  { id: 'moulin-rouge', name: '물랭 루주', emoji: '💃', pos: [2.33229, 48.88411], bearing: 90, clear: 18, build: moulinRouge },
  { id: 'saint-jacques', name: '생자크 탑', emoji: '🗼', pos: [2.34900, 48.85800], bearing: 0, clear: 10, build: saintJacques },
  { id: 'saint-germain-des-pres', name: '생제르맹데프레 성당', emoji: '⛪', pos: [2.33431, 48.85398], bearing: 100, clear: 38, build: saintGermain },
  { id: 'montparnasse', name: '몽파르나스 타워', emoji: '🏢', pos: [2.32197, 48.84214], bearing: 20, clear: 34, build: montparnasse },
  { id: 'sibylle', name: '뷔트쇼몽 시빌 신전', emoji: '🏛', pos: [2.38255, 48.88089], bearing: 0, clear: 30, build: sibylle },
  { id: 'grand-palais', name: '그랑 팔레', emoji: '🏛', pos: [2.31246, 48.86609], bearing: 0, clear: 105, build: grandPalais },
  // 모양은 없고 겉모습만 바꾸는 구역
  { id: 'vosges', name: '보주 광장', emoji: '⛲', pos: [2.36553, 48.85561], bearing: 0, clear: 0, zone: { style: 'vosges', r: 95 } },
];
