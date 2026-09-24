// 지하철역 하나: 가운데 두 선로, 양쪽 승강장(A: y>0, B: y<0), 흰 타일 궁륭, 끝에서 계단을 올라가면 개찰구가 있는 매표 홀,
// 홀 뒤쪽 벽에는 출구(sortie)들, 옆벽에는 환승 통로(correspondance). 보이는 모습(THREE.Group)과 부딪힘(World)을 함께 만든다.
// 좌표: x = 선로 방향, y = 가로, z = 위(m). 승강장 높이 1.0, 홀 바닥 6.0.
import * as THREE from 'three';
import { World } from '../hero/world';
import type { Solid } from '../hero/world';
import type { SeatSpot } from '../town';
import { ballast, namePlate, platformFloor, poster, sign, tiles } from './tex';

export interface LineLook { key: string; label: string; color: string; ink: string }
export interface ExitSpec { ref: string; label: string; note: string; best?: boolean }

export interface StationSpec {
  name: string;
  line: LineLook;
  dirs: [string, string]; // A 승강장(y>0)에서 타는 방향, B 승강장
  exits: ExitSpec[];
  transfer?: { line: LineLook; text: string } | null;
  seed: number;
}

export interface Zone { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }
const inZone = (z: Zone, x: number, y: number, h: number) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1 && h >= z.z0 && h <= z.z1;

export const PLAT_Z = 1.0;
export const HALL_Z = 6.0;
export const TRACK_Y = 1.05;
export const PLAT_X0 = -44, PLAT_X1 = 46;
const HALL_X0 = 63, HALL_X1 = 84;
export const GATE_X = 74; // 개찰구 줄
const STEP_H = (HALL_Z - PLAT_Z) / 17;

export interface StationBuilt {
  group: THREE.Group;
  addSolids: (w: World) => void;
  gateLeaves: (w: World) => Solid[];
  spawnExit: (i: number) => { x: number; y: number; z: number; facing: number };
  spawnTransfer: { x: number; y: number; z: number; facing: number };
  spawnPlatform: (side: 1 | -1) => { x: number; y: number; z: number; facing: number };
  exitZones: Zone[];
  transferZone: Zone | null;
  platformZone: (side: 1 | -1) => Zone;
  inZone: typeof inZone;
  seats: SeatSpot[];
  nodes: [number, number][];
  adj: number[][];
  turnstile: { x: number; y: number }[];
  dispose: () => void;
}

/** 세운 판(PlaneGeometry)이 (dx,dy) 쪽을 보게, 글자는 바로 서게 */
function face(m: THREE.Object3D, dx: number, dy: number) { m.rotation.set(Math.PI / 2, 0, Math.atan2(dy, dx) + Math.PI / 2, 'ZXY'); }

const mats = new Map<string, THREE.Material>();
function mat(key: string, make: () => THREE.Material) { let m = mats.get(key); if (!m) mats.set(key, (m = make())); return m; }

export function exitY(i: number, n: number) { return (i - (n - 1) / 2) * 3.4; }

export function buildStation(spec: StationSpec): StationBuilt {
  const g = new THREE.Group();
  const disposables: { dispose(): void }[] = [];
  const tileMat = mat('tiles', () => new THREE.MeshLambertMaterial({ map: tiles(), color: 0xffffff }));
  const floorMat = mat('floor', () => new THREE.MeshLambertMaterial({ map: platformFloor() }));
  const ballastMat = mat('ballast', () => new THREE.MeshLambertMaterial({ map: ballast() }));
  const steel = mat('steel', () => new THREE.MeshLambertMaterial({ color: 0x9aa1a8 }));
  const dark = mat('dark', () => new THREE.MeshLambertMaterial({ color: 0x2a2724 }));
  const white = mat('white', () => new THREE.MeshLambertMaterial({ color: 0xf2efe8 }));
  const lightMat = mat('light', () => new THREE.MeshBasicMaterial({ color: 0xfff6e2 }));
  const orange = mat('orange', () => new THREE.MeshLambertMaterial({ color: 0xe86a2c }));
  const green = mat('green', () => new THREE.MeshLambertMaterial({ color: 0x1f4a38 }));
  const hallFloor = mat('hallfloor', () => new THREE.MeshLambertMaterial({ map: platformFloor(), color: 0xc9c2b4 }));

  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); disposables.push(geo); return mesh; };
  const boxAt = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material, uv?: number) => {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    if (uv) { const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * (Math.max(x1 - x0, y1 - y0)) / uv, a.getY(i) * (z1 - z0 > 0.5 ? z1 - z0 : Math.min(x1 - x0, y1 - y0)) / uv); }
    return add(geo, m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  };
  const tileSpan = 2.4;

  // ── 선로 바닥·레일·침목
  boxAt(PLAT_X0 - 30, PLAT_X1 + 30, -2.3, 2.3, -0.05, 0, ballastMat, 3);
  for (const ty of [TRACK_Y, -TRACK_Y]) {
    for (const r of [-0.72, 0.72]) boxAt(PLAT_X0 - 30, PLAT_X1 + 30, ty + r - 0.04, ty + r + 0.04, 0, 0.16, steel);
    for (let x = PLAT_X0 - 29; x < PLAT_X1 + 29; x += 0.8) boxAt(x, x + 0.25, ty - 1.0, ty + 1.0, 0, 0.08, dark);
  }
  // ── 승강장 두 개
  for (const s of [1, -1] as const) {
    const y0 = s > 0 ? 2.3 : -6.8, y1 = s > 0 ? 6.8 : -2.3;
    const p = boxAt(PLAT_X0, PLAT_X1, y0, y1, 0, PLAT_Z, floorMat);
    const a = p.geometry.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * 22, a.getY(i) * 1.2);
    // 가장자리 흰 줄 + 점자 블록
    const ey = s * 2.42;
    boxAt(PLAT_X0, PLAT_X1, ey - 0.06, ey + 0.06, PLAT_Z, PLAT_Z + 0.006, white);
    boxAt(PLAT_X0, PLAT_X1, s * 2.78 - 0.2, s * 2.78 + 0.2, PLAT_Z, PLAT_Z + 0.004, mat('tactile', () => new THREE.MeshLambertMaterial({ color: 0xd9c9a0 })));
    // 승강장 벽(선로 쪽 수직면)
    boxAt(PLAT_X0, PLAT_X1, s > 0 ? 2.28 : -2.32, s > 0 ? 2.32 : -2.28, 0, PLAT_Z, dark);
  }
  // ── 궁륭(타일 터널): 양옆 벽 + 타원 아치
  const vault = new THREE.BufferGeometry();
  {
    const prof: [number, number][] = [];
    prof.push([6.8, PLAT_Z]);
    prof.push([6.8, 3.4]);
    for (let i = 1; i <= 16; i++) { const a = (i / 16) * Math.PI; prof.push([6.8 * Math.cos(a), 3.4 + 3.7 * Math.sin(a)]); }
    prof.push([-6.8, PLAT_Z]);
    const pos: number[] = [], uv: number[] = [], nor: number[] = [], idx: number[] = [];
    let arc = 0;
    const arcs = [0];
    for (let i = 1; i < prof.length; i++) { arc += Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]); arcs.push(arc); }
    for (let i = 0; i < prof.length; i++) {
      const [y, z] = prof[i];
      const ny = -y / 6.8, nz = -(z - 3.4) / 3.7;
      for (const x of [PLAT_X0, PLAT_X1]) { pos.push(x, y, z); uv.push(x / tileSpan, arcs[i] / tileSpan); nor.push(0, ny, Math.max(-1, nz)); }
    }
    for (let i = 0; i + 1 < prof.length; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    vault.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    vault.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    vault.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    vault.setIndex(idx);
    vault.computeVertexNormals();
    const vm = add(vault, mat('tilesD', () => new THREE.MeshLambertMaterial({ map: tiles(), side: THREE.DoubleSide })));
    void vm;
  }
  // 끝벽(타일) — 터널 입구는 뚫려 있다
  for (const [x, dir] of [[PLAT_X0, 1], [PLAT_X1, -1]] as const) {
    const shape = new THREE.Shape();
    shape.moveTo(-7, 0); shape.lineTo(7, 0); shape.lineTo(7, 7.2); shape.lineTo(-7, 7.2); shape.lineTo(-7, 0);
    const hole = new THREE.Path();
    hole.moveTo(-2.3, 0); hole.lineTo(2.3, 0); hole.lineTo(2.3, 3.4); hole.absarc(0, 3.4, 2.3, 0, Math.PI, false); hole.lineTo(-2.3, 0);
    shape.holes.push(hole);
    if (dir < 0) for (const s of [1, -1]) { const h2 = new THREE.Path(); const y0 = s > 0 ? 3.0 : -6.0; h2.moveTo(y0, PLAT_Z); h2.lineTo(y0 + 3, PLAT_Z); h2.lineTo(y0 + 3, PLAT_Z + 3.3); h2.lineTo(y0, PLAT_Z + 3.3); h2.lineTo(y0, PLAT_Z); shape.holes.push(h2); }
    const geo = new THREE.ShapeGeometry(shape);
    const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) / tileSpan, a.getY(i) / tileSpan);
    const m = add(geo, mat('tilesD', () => new THREE.MeshLambertMaterial({ map: tiles(), side: THREE.DoubleSide })), x, 0, 0);
    face(m, dir, 0);
    // 터널 속(어둡게)
    boxAt(dir > 0 ? x - 30 : x, dir > 0 ? x : x + 30, -2.35, 2.35, 4.9, 5.0, dark);
    for (const s of [1, -1]) boxAt(dir > 0 ? x - 30 : x, dir > 0 ? x : x + 30, s * 2.35 - 0.05, s * 2.35 + 0.05, 0, 5, dark);
  }
  // 천장 불빛 두 줄
  for (const s of [1, -1]) boxAt(PLAT_X0 + 2, PLAT_X1 - 2, s * 2.6 - 0.12, s * 2.6 + 0.12, 6.35, 6.45, lightMat);
  // 역명판·광고판(양쪽 벽)
  const nameTex = namePlate(spec.name);
  disposables.push(nameTex);
  const plateMat = new THREE.MeshBasicMaterial({ map: nameTex });
  disposables.push(plateMat);
  for (const s of [1, -1] as const) {
    for (let x = PLAT_X0 + 8; x < PLAT_X1 - 4; x += 16) {
      const pl = add(new THREE.PlaneGeometry(4.2, 0.66), plateMat, x, s * 6.76, 2.55);
      face(pl, 0, -s);
      // 광고판 둘
      for (const dx of [4.5, 8.5]) {
        if (x + dx > PLAT_X1 - 2) continue;
        const t = poster(spec.seed + Math.round(x + dx * 3 + s * 7));
        disposables.push(t);
        const pm = new THREE.MeshBasicMaterial({ map: t });
        disposables.push(pm);
        boxAt(x + dx - 0.95, x + dx + 0.95, s * 6.74 - 0.03, s * 6.74 + 0.03, 1.55, 4.1, green);
        const ad = add(new THREE.PlaneGeometry(1.7, 2.3), pm, x + dx, s * 6.7, 2.82);
        face(ad, 0, -s);
      }
    }
    // 주황 1인 의자(모트 좌석) 네 줄
    for (const bx of [-30, -12, 14, 32]) for (let k = 0; k < 4; k++) {
      const sx = bx + k * 0.55;
      const seat = add(new THREE.BoxGeometry(0.46, 0.44, 0.06), orange, sx, s * 6.3, PLAT_Z + 0.46);
      void seat;
      boxAt(sx - 0.23, sx + 0.23, s * 6.55 - 0.03, s * 6.55 + 0.03, PLAT_Z + 0.5, PLAT_Z + 0.95, orange);
    }
  }
  // 홀로 올라가는 계단 두 줄 + 방향 표지판
  const badge = { text: spec.line.key.startsWith('bus') ? spec.line.key.slice(3) : spec.line.key, color: spec.line.color, ink: spec.line.ink };
  for (const s of [1, -1] as const) {
    const y0 = s > 0 ? 3.0 : -6.0, y1 = y0 + 3.0;
    for (let k = 1; k <= 17; k++) {
      const x0 = PLAT_X1 + (k - 1), top = PLAT_Z + STEP_H * k;
      const st = boxAt(x0, x0 + 1, y0, y1, top - STEP_H, top, hallFloor);
      void st;
      boxAt(x0, x0 + 1, y0, y1, top - 0.02, top, k % 2 ? floorMat : hallFloor);
    }
    // 계단 옆벽(타일) + 천장
    for (const wy of [y0 - 0.15, y1 + 0.15]) { const w = boxAt(PLAT_X1, HALL_X0 + 1, wy - 0.15, wy + 0.15, PLAT_Z, HALL_Z + 3.5, tileMat); const a = w.geometry.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * 7, a.getY(i) * 3.5); }
    // 방향 표지판: 홀에서 계단을 내려다보는 쪽(+x에서 -x를 볼 때 보인다)
    const dirName = spec.dirs[s > 0 ? 0 : 1];
    const t = sign({ badge, text: `Direction ${dirName}`, sub: `${spec.line.label} · 이쪽 승강장`, arrow: '↓' });
    disposables.push(t);
    const sm = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    disposables.push(sm);
    const sg = add(new THREE.PlaneGeometry(3.4, 0.66), sm, HALL_X0 + 0.6, (y0 + y1) / 2, HALL_Z + 2.7);
    face(sg, 1, 0);
    // 승강장 쪽에도(계단 입구 위, 승강장에서 볼 때)
    const t2 = sign({ badge, text: 'Sortie · Correspondance', arrow: '↑' });
    disposables.push(t2);
    const sm2 = new THREE.MeshBasicMaterial({ map: t2, side: THREE.DoubleSide });
    disposables.push(sm2);
    const sg2 = add(new THREE.PlaneGeometry(3.0, 0.58), sm2, PLAT_X1 - 0.3, (y0 + y1) / 2, PLAT_Z + 3.75);
    face(sg2, -1, 0);
    // 승강장 쪽 방향 표지판(승강장 가운데 천장에 매단)
    const t3 = sign({ badge, text: `Direction ${dirName}` });
    disposables.push(t3);
    const sm3 = new THREE.MeshBasicMaterial({ map: t3 });
    disposables.push(sm3);
    for (const x of [-20, 20]) for (const d of [1, -1]) { const s3 = add(new THREE.PlaneGeometry(3.4, 0.66), sm3, x + d * 0.02, s * 4.6, 4.2); face(s3, d, 0); }
  }
  // ── 매표 홀
  const hf = boxAt(HALL_X0, HALL_X1, -7.5, 7.5, HALL_Z - 0.2, HALL_Z, hallFloor);
  { const a = hf.geometry.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * 6, a.getY(i) * 4); }
  boxAt(HALL_X0, HALL_X1, -7.5, 7.5, HALL_Z + 4.0, HALL_Z + 4.2, white);
  for (let x = HALL_X0 + 2; x < HALL_X1; x += 4) boxAt(x, x + 2.6, -0.15, 0.15, HALL_Z + 3.9, HALL_Z + 4.0, lightMat);
  // 홀 벽(타일): 옆벽 둘 + 앞벽(계단 입구 사이)
  const exits = spec.exits.length ? spec.exits : [{ ref: '1', label: 'Sortie', note: '' }];
  for (const s of [1, -1]) {
    const hasTransfer = !!spec.transfer && s < 0;
    if (hasTransfer) {
      boxAt(HALL_X0, 66, s * 7.5, s * 7.8, HALL_Z, HALL_Z + 4.2, tileMat, 2.4);
      boxAt(69.5, HALL_X1, s * 7.5, s * 7.8, HALL_Z, HALL_Z + 4.2, tileMat, 2.4);
    } else boxAt(HALL_X0, HALL_X1, s * 7.5 - (s < 0 ? 0.3 : 0), s * 7.5 + (s > 0 ? 0.3 : 0), HALL_Z, HALL_Z + 4.2, tileMat, 2.4);
  }
  boxAt(HALL_X0 - 0.3, HALL_X0, -3.0, 3.0, HALL_Z, HALL_Z + 4.2, tileMat, 2.4);
  for (const s of [1, -1]) boxAt(HALL_X0 - 0.3, HALL_X0, s * 6.0, s * 7.5, HALL_Z, HALL_Z + 4.2, tileMat, 2.4);
  // 계단 입구 난간
  for (const s of [1, -1]) for (const y of [s * 3.0, s * 6.0]) boxAt(HALL_X0, HALL_X0 + 1.2, y - 0.04, y + 0.04, HALL_Z, HALL_Z + 1.0, green);
  // 개찰구: 회색 기둥 사이 여닫이 문
  const turn: { x: number; y: number }[] = [];
  const gateYs = [-5.4, -3.2, -1.0, 1.2, 3.4, 5.6];
  for (let i = 0; i <= gateYs.length; i++) {
    const yA = i === 0 ? -7.5 : gateYs[i - 1] + 0.4, yB = i === gateYs.length ? 7.5 : gateYs[i] - 0.4;
    if (yB - yA > 0.1) { boxAt(GATE_X - 0.6, GATE_X + 0.6, yA, yB, HALL_Z, HALL_Z + 1.05, steel); boxAt(GATE_X - 0.62, GATE_X + 0.62, yA, yB, HALL_Z + 1.05, HALL_Z + 1.1, dark); }
  }
  for (const y of gateYs) turn.push({ x: GATE_X, y });
  const leafMat = mat('leaf', () => new THREE.MeshLambertMaterial({ color: 0x6fb3d9, transparent: true, opacity: 0.7 }));
  const leafMeshes: THREE.Mesh[] = [];
  for (const y of gateYs) for (const s of [-1, 1]) { const m = boxAt(GATE_X - 0.03, GATE_X + 0.03, y + s * 0.2 - 0.2, y + s * 0.2 + 0.2, HALL_Z + 0.3, HALL_Z + 1.2, leafMat); leafMeshes.push(m); m.userData.s = s; }
  // 뒷벽: 출구 구멍들 + 거리로 올라가는 계단 + 출구 표지판
  const n = exits.length;
  const ys = exits.map((_, i) => exitY(i, n));
  const holes: [number, number][] = ys.map((y) => [y - 1.2, y + 1.2]);
  let prev = -7.5;
  for (const [a, b] of [...holes, [7.5, 7.8]] as [number, number][]) { if (a - prev > 0.05) boxAt(HALL_X1, HALL_X1 + 0.3, prev, a, HALL_Z, HALL_Z + 4.2, tileMat, 2.4); prev = b; }
  boxAt(HALL_X1, HALL_X1 + 0.3, -7.5, 7.5, HALL_Z + 3.0, HALL_Z + 4.2, tileMat, 2.4);
  const exitZones: Zone[] = [];
  exits.forEach((e, i) => {
    const y = ys[i];
    for (let k = 1; k <= 12; k++) boxAt(HALL_X1 + 0.3 + (k - 1) * 0.6, HALL_X1 + 0.3 + k * 0.6, y - 1.15, y + 1.15, HALL_Z, HALL_Z + k * 0.3, k % 2 ? floorMat : hallFloor);
    for (const s of [-1, 1]) boxAt(HALL_X1 + 0.3, HALL_X1 + 7.5, y + s * 1.2 - 0.1, y + s * 1.2 + 0.1, HALL_Z, HALL_Z + 6.5, tileMat, 2.4);
    // 위에서 들어오는 햇빛
    boxAt(HALL_X1 + 6.9, HALL_X1 + 7.2, y - 1.15, y + 1.15, HALL_Z + 3.5, HALL_Z + 7, lightMat);
    boxAt(HALL_X1 + 0.3, HALL_X1 + 7.5, y - 1.15, y + 1.15, HALL_Z + 6.3, HALL_Z + 6.5, white);
    const t = sign({ text: `Sortie ${e.ref}${e.best ? ' ★' : ''}`, sub: e.label, arrow: '↑' });
    disposables.push(t);
    const sm = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    disposables.push(sm);
    const sg = add(new THREE.PlaneGeometry(2.6, 0.5), sm, HALL_X1 - 0.05, y, HALL_Z + 3.35);
    face(sg, -1, 0);
    exitZones.push({ x0: HALL_X1 + 2.4, x1: HALL_X1 + 9, y0: y - 1.2, y1: y + 1.2, z0: HALL_Z - 0.5, z1: HALL_Z + 6 });
  });
  // 환승 통로
  let transferZone: Zone | null = null;
  if (spec.transfer) {
    const tb = { text: spec.transfer.line.key.startsWith('bus') ? spec.transfer.line.key.slice(3) : spec.transfer.line.key, color: spec.transfer.line.color, ink: spec.transfer.line.ink };
    const t = sign({ badge: tb, text: 'Correspondance', sub: spec.transfer.text, arrow: '→' });
    disposables.push(t);
    const sm = new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide });
    disposables.push(sm);
    const sg = add(new THREE.PlaneGeometry(3.6, 0.7), sm, 67.75, -7.35, HALL_Z + 3.2);
    face(sg, 0, 1);
    boxAt(66, 69.5, -16, -7.5, HALL_Z - 0.2, HALL_Z, hallFloor);
    for (const x of [65.7, 69.8]) boxAt(x - 0.15, x + 0.15, -16, -7.5, HALL_Z, HALL_Z + 3.4, tileMat, 2.4);
    boxAt(66, 69.5, -16, -7.5, HALL_Z + 3.3, HALL_Z + 3.4, white);
    for (let y = -15; y < -8; y += 3) boxAt(67.4, 68.1, y, y + 1.6, HALL_Z + 3.2, HALL_Z + 3.3, lightMat);
    transferZone = { x0: 65.8, x1: 69.7, y0: -17, y1: -12.5, z0: HALL_Z - 0.5, z1: HALL_Z + 3 };
  }
  // 홀의 역 이름(앞벽)
  const hp = add(new THREE.PlaneGeometry(4.2, 0.66), plateMat, HALL_X0 + 0.05, 0, HALL_Z + 3.2);
  face(hp, 1, 0);
  // 홀 벽에 걸린 노선도(짙은 판)
  boxAt(HALL_X0 + 6, HALL_X0 + 10, 7.44, 7.5, HALL_Z + 1.0, HALL_Z + 3.0, mat('map', () => new THREE.MeshLambertMaterial({ color: 0xf2efe6 })));

  // ── 부딪힘
  const addSolids = (w: World) => {
    const box = (x0: number, x1: number, y0: number, y1: number, base: number, top: number) => w.addSolid([new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])], base, top, 'prop');
    for (const s of [1, -1]) {
      box(PLAT_X0, PLAT_X1, s > 0 ? 2.3 : -6.8, s > 0 ? 6.8 : -2.3, -1, PLAT_Z);
      box(PLAT_X0, PLAT_X1 + 1, s > 0 ? 6.8 : -7.4, s > 0 ? 7.4 : -6.8, -1, 12); // 옆벽
      // 궁륭(카메라가 뚫고 나가지 않게)
      box(PLAT_X0, PLAT_X1, s > 0 ? 5.8 : -6.8, s > 0 ? 6.8 : -5.8, 4.6, 12);
      box(PLAT_X0, PLAT_X1, s > 0 ? 4.2 : -5.8, s > 0 ? 5.8 : -4.2, 6.0, 12);
      // 의자 줄
      for (const bx of [-30, -12, 14, 32]) box(bx - 0.25, bx + 0.25 + 3 * 0.55, s > 0 ? 6.08 : -6.6, s > 0 ? 6.6 : -6.08, 0, PLAT_Z + 0.49);
    }
    box(PLAT_X0, PLAT_X1, -4.2, 4.2, 6.9, 12);
    // 승강장 끝벽
    for (const s of [1, -1]) {
      box(PLAT_X0 - 0.6, PLAT_X0, s > 0 ? 2.3 : -7.4, s > 0 ? 7.4 : -2.3, -1, 12);
      box(PLAT_X1, PLAT_X1 + 0.5, s > 0 ? 2.3 : -3.0, s > 0 ? 3.0 : -2.3, -1, 12);
      box(PLAT_X1, PLAT_X1 + 0.5, s > 0 ? 6.0 : -7.4, s > 0 ? 7.4 : -6.0, -1, 12);
    }
    // 터널 입구 위(카메라)와 터널 끝(더 못 가게)
    for (const x of [PLAT_X0 - 0.6, PLAT_X1]) box(x, x + 0.6, -2.3, 2.3, 4.6, 12);
    box(PLAT_X0 - 16, PLAT_X0 - 15, -2.3, 2.3, -1, 12);
    box(PLAT_X1 + 15, PLAT_X1 + 16, -2.3, 2.3, -1, 12);
    for (const s of [1, -1]) { box(PLAT_X0 - 16, PLAT_X0, s > 0 ? 2.3 : -2.8, s > 0 ? 2.8 : -2.3, -1, 12); box(PLAT_X1, PLAT_X1 + 16, s > 0 ? 2.3 : -3.0, s > 0 ? 3.0 : -2.3, -1, 12); }
    // 계단(한 칸씩)과 계단 벽·천장
    for (const s of [1, -1]) {
      const y0 = s > 0 ? 3.0 : -6.0, y1 = y0 + 3.0;
      for (let k = 1; k <= 17; k++) { const x0 = PLAT_X1 + (k - 1); box(x0, x0 + 1, y0, y1, -1, PLAT_Z + STEP_H * k); box(x0, x0 + 1, y0, y1, PLAT_Z + STEP_H * k + 3.3, PLAT_Z + STEP_H * k + 8); }
      box(PLAT_X1, HALL_X0 + 1, y0 - 0.3, y0, -1, 14);
      box(PLAT_X1, HALL_X0 + 1, y1, y1 + 0.3, -1, 14);
    }
    // 홀 바닥·천장·벽
    box(HALL_X0, HALL_X1 + 0.3, -7.5, 7.5, HALL_Z - 1, HALL_Z);
    box(HALL_X0, HALL_X1 + 0.3, -7.8, 7.8, HALL_Z + 4.0, HALL_Z + 8);
    if (spec.transfer) { box(HALL_X0, 66, -8.1, -7.5, 0, 14); box(69.5, HALL_X1 + 0.3, -8.1, -7.5, 0, 14); box(66, 69.5, -17, -7.5, HALL_Z - 1, HALL_Z); box(65.4, 66, -17, -7.5, 0, 14); box(69.5, 70.1, -17, -7.5, 0, 14); box(66, 69.5, -17.6, -17, 0, 14); box(66, 69.5, -17, -7.5, HALL_Z + 3.3, HALL_Z + 8); }
    else box(HALL_X0, HALL_X1 + 0.3, -8.1, -7.5, 0, 14);
    box(HALL_X0, HALL_X1 + 0.3, 7.5, 8.1, 0, 14);
    box(HALL_X0 - 0.3, HALL_X0, -3.0, 3.0, HALL_Z - 1, 14);
    for (const s of [1, -1]) box(HALL_X0 - 0.3, HALL_X0, s > 0 ? 6.0 : -7.5, s > 0 ? 7.5 : -6.0, HALL_Z - 1, 14);
    // 개찰구 기둥(문짝은 따로)
    for (let i = 0; i <= gateYs.length; i++) {
      const yA = i === 0 ? -7.5 : gateYs[i - 1] + 0.4, yB = i === gateYs.length ? 7.5 : gateYs[i] - 0.4;
      if (yB - yA > 0.1) box(GATE_X - 0.6, GATE_X + 0.6, yA, yB, HALL_Z - 1, HALL_Z + 1.1);
    }
    // 뒷벽과 출구 계단
    prev = -7.5;
    for (const [a, b] of [...holes, [7.5, 7.8]] as [number, number][]) { if (a - prev > 0.05) box(HALL_X1, HALL_X1 + 0.3, prev, a, HALL_Z - 1, 14); prev = b; }
    ys.forEach((y) => {
      for (let k = 1; k <= 12; k++) box(HALL_X1 + 0.3 + (k - 1) * 0.6, HALL_X1 + 0.3 + k * 0.6, y - 1.15, y + 1.15, HALL_Z - 1, HALL_Z + k * 0.3);
      for (const s of [-1, 1]) box(HALL_X1 + 0.3, HALL_X1 + 8, y + s * 1.2 - 0.12, y + s * 1.2 + 0.12, 0, 14);
      box(HALL_X1 + 7.8, HALL_X1 + 8.2, y - 1.2, y + 1.2, 0, 14);
      box(HALL_X1 + 0.3, HALL_X1 + 8, y - 1.2, y + 1.2, HALL_Z + 6.3, HALL_Z + 9);
    });
  };
  const gateLeaves = (w: World) => gateYs.map((y) => w.addSolid([new Float64Array([GATE_X - 0.05, y - 0.4, GATE_X + 0.05, y - 0.4, GATE_X + 0.05, y + 0.4, GATE_X - 0.05, y + 0.4])], HALL_Z - 1, HALL_Z + 1.3, 'prop'));

  // ── 사람들이 걷는 길(승강장 가운데 → 계단 → 홀)
  const nodes: [number, number][] = [];
  const adj: number[][] = [];
  const node = (x: number, y: number) => { nodes.push([x, y]); adj.push([]); return nodes.length - 1; };
  const link = (a: number, b: number) => { adj[a].push(b); adj[b].push(a); };
  for (const s of [1, -1]) {
    let prevN = -1;
    for (let x = PLAT_X0 + 4; x <= PLAT_X1 - 2; x += 8) { const k = node(x, s * 4.4); if (prevN >= 0) link(prevN, k); prevN = k; }
    const st = node(PLAT_X1 + 8, s * 4.5); link(prevN, st);
    const top = node(HALL_X0 + 2, s * 4.5); link(st, top);
    const mid = node(HALL_X0 + 6, s * 2); link(top, mid);
  }
  const hallA = node(70, 0), hallB = node(78, 0);
  link(hallA, hallB);
  for (let i = 0; i < nodes.length; i++) if (Math.abs(nodes[i][0] - (HALL_X0 + 6)) < 0.1) link(i, hallA);
  const seats: SeatSpot[] = [];
  for (const s of [1, -1] as const) for (const bx of [-30, -12, 14, 32]) for (let k = 0; k < 4; k++) seats.push({ x: bx + k * 0.55, y: s * 6.3, z: PLAT_Z + 0.49, facing: s > 0 ? 180 : 0, kind: 'bench' });

  return {
    group: g,
    addSolids,
    gateLeaves,
    spawnExit: (i) => ({ x: HALL_X1 + 1.5, y: ys[Math.max(0, Math.min(ys.length - 1, i))], z: HALL_Z + 0.3, facing: 270 }),
    spawnTransfer: spec.transfer ? { x: 67.75, y: -11, z: HALL_Z, facing: 0 } : { x: 70, y: 0, z: HALL_Z, facing: 270 },
    spawnPlatform: (side) => ({ x: 0, y: side * 3.4, z: PLAT_Z, facing: side > 0 ? 180 : 0 }),
    exitZones,
    transferZone,
    platformZone: (side) => ({ x0: PLAT_X0, x1: PLAT_X1, y0: side > 0 ? 2.3 : -6.8, y1: side > 0 ? 6.8 : -2.3, z0: PLAT_Z - 0.3, z1: PLAT_Z + 2 }),
    inZone,
    seats,
    nodes,
    adj,
    turnstile: turn,
    dispose: () => { for (const d of disposables) d.dispose(); for (const m of leafMeshes) void m; },
  };
}

/** 개찰구 문짝 메시들(여닫이 연출용) */
export function gateLeafMeshes(g: THREE.Group): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  g.traverse((o) => { if (o instanceof THREE.Mesh && o.userData.s !== undefined) out.push(o); });
  return out;
}
