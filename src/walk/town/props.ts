// 파리의 거리 가구. 모두 도형 몇 개를 짜 맞춘 틀(template)이고, 자리마다 돌리고 옮겨서 한 덩어리에 붙인다.
// 가로등(밤에 켜진다) · 플라타너스 · 다비우드 벤치 · 월리스 분수 · 모리스 기둥 · 신문 가판대 · 기마르 지하철 입구 ·
// 버스 정류장 · 벨리브 자전거 · 주차된 차 · 카페 테라스 · 볼라드 · 쓰레기통.
import * as THREE from 'three';
import { GeoBuilder, lin } from './geom';
import type { V3 } from './geom';

interface Part { geo: THREE.BufferGeometry; m: THREE.Matrix4; tint: V3; glow: number }
export type Template = Part[];

const M = (x = 0, y = 0, z = 0, rz = 0, rx = 0, ry = 0, s: [number, number, number] = [1, 1, 1]) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'ZXY')), new THREE.Vector3(...s));

/** z축으로 선 원기둥, 바닥이 z0 */
const cylZ = (rTop: number, rBot: number, h: number, segs = 8, open = false, th0 = 0, thLen = Math.PI * 2) =>
  new THREE.CylinderGeometry(rTop, rBot, h, segs, 1, open, th0, thLen).rotateX(Math.PI / 2).translate(0, 0, h / 2);
const box = (sx: number, sy: number, sz: number) => new THREE.BoxGeometry(sx, sy, sz).translate(0, 0, sz / 2);
const ball = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);

const P = (geo: THREE.BufferGeometry, m: THREE.Matrix4, color: string, glow = 0): Part => ({ geo, m, tint: lin(color), glow });

const IRON = '#1f2b25';
const GREEN = '#1f4a38';

function lamp(): Template {
  return [
    P(cylZ(0.2, 0.27, 0.55, 10), M(), IRON),
    P(cylZ(0.055, 0.09, 3.2, 8), M(0, 0, 0.55), IRON),
    P(cylZ(0.12, 0.08, 0.12, 8), M(0, 0, 3.65), IRON),
    P(cylZ(0.24, 0.15, 0.5, 4), M(0, 0, 3.77, Math.PI / 4), '#fff1c8', 1),
    P(cylZ(0.02, 0.3, 0.26, 4), M(0, 0, 4.25, Math.PI / 4), IRON),
    P(ball(0.05, 0), M(0, 0, 4.55), IRON),
  ];
}

/** 좁은 골목: 벽에 매단 등(콘솔) — y가 벽에서 멀어지는 쪽 */
function wallLamp(): Template {
  return [
    P(box(0.05, 0.75, 0.05), M(0, 0.35, 4.3), IRON),
    P(cylZ(0.02, 0.02, 0.35, 4), M(0, 0.72, 3.95), IRON),
    P(cylZ(0.2, 0.13, 0.42, 4), M(0, 0.72, 3.55, Math.PI / 4), '#fff1c8', 1),
    P(cylZ(0.02, 0.26, 0.22, 4), M(0, 0.72, 3.97, Math.PI / 4), IRON),
  ];
}

function tree(k: number): Template {
  const leaf = ['#5d8a41', '#6b9a4a', '#557f3b', '#648f45', '#7a9a45'];
  const pick = (i: number) => leaf[(i + Math.floor(k * 5)) % leaf.length];
  return [
    P(box(1.5, 1.5, 0.03), M(), '#2a2a28'),
    P(cylZ(0.17, 0.27, 3.8, 7), M(), '#9a8c74'),
    P(box(0.2, 0.08, 0.5), M(0.14, 0.12, 1.2, 0.6), '#cdc2a6'),
    P(box(0.18, 0.08, 0.4), M(-0.1, -0.15, 2.3, -0.9), '#c9bfa6'),
    P(cylZ(0.08, 0.14, 1.6, 6), M(0.2, 0, 3.4, 0, 0, 0.5), '#9a8c74'),
    P(cylZ(0.08, 0.14, 1.6, 6), M(-0.2, 0.1, 3.4, 0, 0.3, -0.5), '#9a8c74'),
    P(ball(1), M(0, 0, 5.8, k * 3, 0, 0, [2.7, 2.6, 2.0]), pick(0)),
    P(ball(1), M(1.3, 0.7, 6.8, k * 5, 0, 0, [1.9, 1.8, 1.6]), pick(1)),
    P(ball(1), M(-1.2, -0.5, 6.5, 0, 0, 0, [2.0, 2.0, 1.7]), pick(2)),
    P(ball(1), M(0.3, -1.3, 5.1, 0, 0, 0, [1.7, 1.7, 1.4]), pick(3)),
    P(ball(1), M(-0.4, 1.2, 7.4, 0, 0, 0, [1.5, 1.5, 1.3]), pick(4)),
  ];
}

function bench(): Template {
  const wood = '#2f5a3e';
  return [
    P(box(1.8, 0.44, 0.05), M(0, 0.02, 0.42), wood),
    P(box(1.8, 0.05, 0.38), M(0, -0.24, 0.55, 0, -0.18), wood),
    P(box(0.07, 0.5, 0.45), M(-0.8, 0, 0), IRON),
    P(box(0.07, 0.5, 0.45), M(0.8, 0, 0), IRON),
    P(box(0.06, 0.4, 0.05), M(-0.86, 0.02, 0.62), IRON),
    P(box(0.06, 0.4, 0.05), M(0.86, 0.02, 0.62), IRON),
  ];
}

function wallace(): Template {
  const out: Template = [
    P(cylZ(0.42, 0.52, 0.55, 8), M(), GREEN),
    P(cylZ(0.34, 0.34, 0.12, 8), M(0, 0, 0.55), GREEN),
    P(cylZ(0.05, 0.46, 0.5, 8), M(0, 0, 1.92), GREEN),
    P(cylZ(0.44, 0.44, 0.1, 8), M(0, 0, 1.84), GREEN),
    P(cylZ(0.02, 0.17, 0.45, 8), M(0, 0, 2.4), GREEN),
    P(cylZ(0.016, 0.016, 1.2, 5), M(0, 0, 0.66), '#bfe6ff', 0.25),
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    out.push(P(cylZ(0.05, 0.07, 1.05, 6), M(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0.67), GREEN));
    out.push(P(ball(0.07, 0), M(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 1.78), GREEN));
  }
  return out;
}

function morris(): Template {
  const posters = ['#e9d9b0', '#d9483b', '#2d6cdf', '#f2c14e', '#f4efe6', '#3a9d5d', '#b04ad6', '#101010'];
  const out: Template = [
    P(cylZ(0.72, 0.76, 0.45, 16), M(), GREEN),
    P(cylZ(0.6, 0.6, 2.7, 16), M(0, 0, 0.45), '#d8cdb3'),
  ];
  for (let i = 0; i < 8; i++) out.push(P(cylZ(0.62, 0.62, 2.2, 3, true, (i / 8) * Math.PI * 2 + 0.05, (Math.PI * 2) / 8 - 0.1), M(0, 0, 0.62), posters[i]));
  out.push(P(cylZ(0.76, 0.68, 0.25, 16), M(0, 0, 3.12), GREEN));
  out.push(P(cylZ(0.05, 0.64, 0.7, 16), M(0, 0, 3.37), GREEN));
  out.push(P(ball(0.09, 0), M(0, 0, 4.1), GREEN));
  return out;
}

function kiosk(): Template {
  return [
    P(box(2.6, 1.8, 2.3), M(), '#23483a'),
    P(box(2.64, 1.84, 0.6), M(0, 0, 1.0), '#e9e3d2'),
    P(box(0.5, 0.05, 0.5), M(-0.8, 0.93, 1.05), '#d9483b'),
    P(box(0.5, 0.05, 0.5), M(-0.15, 0.93, 1.05), '#2d6cdf'),
    P(box(0.5, 0.05, 0.5), M(0.5, 0.93, 1.05), '#f2c14e'),
    P(box(3.1, 2.3, 0.22), M(0, 0, 2.3), '#23483a'),
    P(cylZ(0.05, 0.55, 0.55, 8), M(0, 0, 2.52), '#23483a'),
    P(ball(0.08, 0), M(0, 0, 3.1), '#c9a14a'),
  ];
}

/** 기마르 지하철 입구: 계단 구멍 + 세 면 쇠 난간 + 두 개의 붉은 등 + 간판. y+가 들어가는 쪽. */
function guimard(): Template {
  const out: Template = [
    P(box(1.72, 4.4, 0.02), M(0, -0.1, 0.005), '#171412'),
    P(box(0.07, 4.5, 0.08), M(-0.92, -0.1, 0.92), GREEN),
    P(box(0.07, 4.5, 0.08), M(0.92, -0.1, 0.92), GREEN),
    P(box(1.9, 0.07, 0.08), M(0, -2.35, 0.92), GREEN),
    P(box(0.05, 4.5, 0.05), M(-0.92, -0.1, 0.18), GREEN),
    P(box(0.05, 4.5, 0.05), M(0.92, -0.1, 0.18), GREEN),
    P(box(1.9, 0.05, 0.05), M(0, -2.35, 0.18), GREEN),
  ];
  for (let k = 0; k < 11; k++) out.push(P(box(1.66, 0.28, 0.03), M(0, 1.9 - k * 0.4, 0.02 + 0.001 * k), k % 2 ? '#3d3833' : '#2a2622'));
  // 난간살(곡선 대신 촘촘한 막대)
  for (let y = -2.3; y <= 2.1; y += 0.3) for (const x of [-0.92, 0.92]) out.push(P(cylZ(0.018, 0.018, 0.75, 4), M(x, y, 0.18), GREEN));
  for (let x = -0.8; x <= 0.8; x += 0.3) out.push(P(cylZ(0.018, 0.018, 0.75, 4), M(x, -2.35, 0.18), GREEN));
  // 등 기둥 두 개(식물 줄기처럼 휘었다가) + 붉은 등
  for (const sx of [-1, 1]) {
    out.push(P(cylZ(0.05, 0.08, 2.4, 6), M(sx * 0.98, 2.0, 0), GREEN));
    out.push(P(cylZ(0.04, 0.05, 0.9, 6), M(sx * 0.98, 2.0, 2.35, 0, 0, sx * -0.35), GREEN));
    out.push(P(ball(1, 1), M(sx * 0.72, 2.0, 3.25, 0, 0, 0, [0.13, 0.13, 0.2]), '#ff7a2e', 1));
  }
  out.push(P(box(2.1, 0.06, 0.34), M(0, 2.02, 2.55), '#e6d7a1', 0.3));
  out.push(P(box(2.2, 0.08, 0.06), M(0, 2.02, 2.9), GREEN));
  return out;
}

function busShelter(): Template {
  return [
    P(box(0.06, 0.06, 2.3), M(-1.8, -0.6, 0), '#3c4145'),
    P(box(0.06, 0.06, 2.3), M(1.8, -0.6, 0), '#3c4145'),
    P(box(3.6, 0.04, 1.9), M(0, -0.62, 0.3), '#8fa9b8'),
    P(box(3.9, 1.5, 0.1), M(0, -0.05, 2.3), '#3c4145'),
    P(box(1.9, 0.34, 0.05), M(-0.6, -0.4, 0.5), '#6d747a'),
    P(box(1.2, 0.12, 1.8), M(2.0, -0.2, 0.2), '#f3efe2', 0.7),
    P(box(0.2, 0.2, 2.9), M(-2.3, 0.4, 0), '#3c4145'),
    P(box(0.5, 0.06, 0.5), M(-2.3, 0.4, 2.7), '#2e6fb5', 0.3),
  ];
}

function bike(): Template {
  const frame = '#61806a';
  const wheel = new THREE.TorusGeometry(0.32, 0.03, 5, 14).rotateY(Math.PI / 2);
  return [
    P(wheel, M(0, 0.5, 0.34), '#222'),
    P(wheel, M(0, -0.5, 0.34), '#222'),
    P(box(0.05, 0.95, 0.05), M(0, 0, 0.62, 0, 0.25), frame),
    P(box(0.05, 0.05, 0.55), M(0, -0.2, 0.34, 0, -0.3), frame),
    P(box(0.34, 0.26, 0.2), M(0, 0.62, 0.8), frame),
    P(box(0.5, 0.04, 0.04), M(0, 0.45, 1.0), '#222'),
    P(box(0.12, 0.25, 0.06), M(0, -0.28, 0.86), '#2a2a2a'),
    P(box(0.14, 0.14, 0.95), M(0, 0.95, 0), '#c3c8ca'),
  ];
}

function car(color: string): Template {
  const wheel = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 12).rotateZ(Math.PI / 2);
  const out: Template = [
    P(box(1.72, 4.0, 0.62), M(0, 0, 0.3), color),
    P(box(1.58, 2.1, 0.55), M(0, -0.3, 0.9), '#34414b'),
    P(box(1.54, 1.9, 0.06), M(0, -0.32, 1.44), color),
    P(box(1.6, 0.9, 0.12), M(0, 1.45, 0.86, 0, -0.12), color),
    P(box(0.34, 0.04, 0.14), M(-0.6, 2.0, 0.7), '#fff4d4', 0.7),
    P(box(0.34, 0.04, 0.14), M(0.6, 2.0, 0.7), '#fff4d4', 0.7),
    P(box(0.3, 0.04, 0.12), M(-0.62, -2.0, 0.75), '#c0282c', 0.35),
    P(box(0.3, 0.04, 0.12), M(0.62, -2.0, 0.75), '#c0282c', 0.35),
    P(box(0.5, 0.05, 0.1), M(0, 2.01, 0.42), '#e8e8e8'),
  ];
  for (const [x, y] of [[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]]) out.push(P(wheel, M(x, y, 0.33), '#1b1b1b'));
  return out;
}

function scooter(color: string): Template {
  const wheel = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10).rotateZ(Math.PI / 2);
  return [
    P(wheel, M(0, 0.55, 0.2), '#1b1b1b'), P(wheel, M(0, -0.55, 0.2), '#1b1b1b'),
    P(box(0.4, 1.0, 0.35), M(0, -0.2, 0.25), color),
    P(box(0.34, 0.6, 0.12), M(0, -0.3, 0.62), '#2a2a2a'),
    P(box(0.3, 0.12, 0.8), M(0, 0.55, 0.3, 0, -0.25), color),
    P(box(0.6, 0.04, 0.04), M(0, 0.62, 1.1), '#2a2a2a'),
  ];
}

/** 카페 테이블 하나 + 의자 둘(서로 마주 본다, x축) */
function terraceSet(): Template {
  const rattan = '#c89a5b', rattanD = '#a8773f';
  const out: Template = [
    P(cylZ(0.34, 0.34, 0.03, 14), M(0, 0, 0.72), '#d9d2c4'),
    P(cylZ(0.035, 0.035, 0.7, 6), M(0, 0, 0.02), '#2a2a2a'),
    P(cylZ(0.2, 0.24, 0.03, 10), M(), '#2a2a2a'),
    P(cylZ(0.04, 0.05, 0.14, 8), M(0.1, 0.05, 0.75), '#f6f1e7'),
  ];
  for (const sx of [-1, 1]) {
    out.push(P(box(0.42, 0.42, 0.05), M(sx * 0.58, 0, 0.44), rattan));
    out.push(P(box(0.04, 0.42, 0.42), M(sx * 0.8, 0, 0.5, 0, 0, sx * 0.12), rattanD));
    for (const [lx, ly] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) out.push(P(box(0.03, 0.03, 0.44), M(sx * 0.58 + lx, ly, 0), '#3a2a1c'));
  }
  return out;
}

function bollard(): Template {
  return [P(cylZ(0.05, 0.065, 0.85, 7), M(), '#4a3527'), P(ball(0.07, 0), M(0, 0, 0.88), '#4a3527')];
}

function bin(): Template {
  return [P(cylZ(0.21, 0.19, 0.7, 10), M(0, 0, 0.1), '#a9cf96'), P(cylZ(0.23, 0.23, 0.05, 10, true), M(0, 0, 0.78), '#3c4a3f'), P(box(0.05, 0.05, 0.9), M(0, -0.25, 0), '#3c4a3f')];
}

function planter(): Template {
  const out: Template = [P(box(1.2, 0.45, 0.45), M(), '#3b5a3c')];
  const cols = ['#e0436c', '#f2c14e', '#fff', '#b04ad6', '#f07f3c'];
  for (let i = 0; i < 6; i++) out.push(P(ball(0.13, 0), M(-0.45 + i * 0.18, (i % 2) * 0.1 - 0.05, 0.55), i % 2 ? '#4f8a3c' : cols[i % cols.length]));
  return out;
}

const cache = new Map<string, Template>();
export function template(name: string, k = 0): Template {
  const key = name === 'tree' ? `tree${Math.floor(k * 5)}` : name;
  let t = cache.get(key);
  if (t) return t;
  switch (name) {
    case 'lamp': t = lamp(); break;
    case 'wallLamp': t = wallLamp(); break;
    case 'tree': t = tree(k); break;
    case 'bench': t = bench(); break;
    case 'wallace': t = wallace(); break;
    case 'morris': t = morris(); break;
    case 'kiosk': t = kiosk(); break;
    case 'guimard': t = guimard(); break;
    case 'bus': t = busShelter(); break;
    case 'bike': t = bike(); break;
    case 'terrace': t = terraceSet(); break;
    case 'bollard': t = bollard(); break;
    case 'bin': t = bin(); break;
    case 'planter': t = planter(); break;
    default:
      if (name.startsWith('car:')) t = car(name.slice(4));
      else if (name.startsWith('scooter:')) t = scooter(name.slice(8));
      else t = [];
  }
  cache.set(key, t);
  return t;
}

const tmpM = new THREE.Matrix4();
const placeM = new THREE.Matrix4();
/** 틀을 (x,y,z)에 방위 rot(라디안, 틀의 +y가 가리킬 방향 = 수학 각도 − 90°)로 놓는다 */
export function stamp(g: GeoBuilder, t: Template, x: number, y: number, z: number, rot: number, scale = 1, tintMul?: V3) {
  placeM.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot), new THREE.Vector3(scale, scale, scale));
  for (const p of t) {
    tmpM.multiplyMatrices(placeM, p.m);
    g.addGeometry(p.geo, tmpM, tintMul ? [p.tint[0] * tintMul[0], p.tint[1] * tintMul[1], p.tint[2] * tintMul[2]] : p.tint, p.glow);
  }
}

/** 방향 (fx,fy)를 틀의 +y가 보게 하는 회전 */
export const rotFacing = (fx: number, fy: number) => Math.atan2(fy, fx) - Math.PI / 2;

/** 줄무늬 차양: 벽의 (ax,ay)→(bx,by) 위에서 앞으로 기울어 나온다 */
export function awning(g: GeoBuilder, ax: number, ay: number, bx: number, by: number, nx: number, ny: number, color: string, z = 3.1, out = 1.9, drop = 0.75) {
  const len = Math.hypot(bx - ax, by - ay);
  const strips = Math.max(2, Math.round(len / 0.45));
  const c1 = lin(color), c2 = lin('#f4efe4');
  const zf = z - drop;
  for (let i = 0; i < strips; i++) {
    const t0 = i / strips, t1 = (i + 1) / strips;
    const p0x = ax + (bx - ax) * t0, p0y = ay + (by - ay) * t0, p1x = ax + (bx - ax) * t1, p1y = ay + (by - ay) * t1;
    const c = i % 2 ? c2 : c1;
    g.plane([p0x, p0y, z], [p1x, p1y, z], [p1x + nx * out, p1y + ny * out, zf], [p0x + nx * out, p0y + ny * out, zf], c);
    // 앞 드림(가리비 모양 대신 짧은 천)
    g.plane([p0x + nx * out, p0y + ny * out, zf], [p1x + nx * out, p1y + ny * out, zf], [p1x + nx * out, p1y + ny * out, zf - 0.28], [p0x + nx * out, p0y + ny * out, zf - 0.28], c);
  }
  // 옆 천
  for (const [px, py] of [[ax, ay], [bx, by]]) g.plane([px, py, z], [px + nx * out, py + ny * out, zf], [px + nx * out, py + ny * out, zf - 0.02], [px, py, z - 0.02], c1);
}

export const circleRing = (x: number, y: number, r: number, n = 8) => {
  const a = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; a[i * 2] = x + Math.cos(t) * r; a[i * 2 + 1] = y + Math.sin(t) * r; }
  return a;
};
export const rectRing = (x: number, y: number, sx: number, sy: number, rot: number) => {
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = [[-sx / 2, -sy / 2], [sx / 2, -sy / 2], [sx / 2, sy / 2], [-sx / 2, sy / 2]];
  const a = new Float64Array(8);
  pts.forEach(([lx, ly], i) => { a[i * 2] = x + lx * c - ly * s; a[i * 2 + 1] = y + lx * s + ly * c; });
  return a;
};
