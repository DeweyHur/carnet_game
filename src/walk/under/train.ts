// 전동차 다섯 칸. 칸마다 양쪽에 미닫이문 셋. 선로 가운데(y = side × TRACK_Y)에 서고, 가운데 칸이 x = 0.
// 멈춰 있을 때는 역과 같은 좌표라 몸이 그대로 걸어 들어간다. 달리는 동안은 전동차가 가만히 있고 바깥(역·터널)이 흘러간다.
import * as THREE from 'three';
import type { World } from '../hero/world';
import type { Solid } from '../hero/world';
import type { SeatSpot } from '../town';
import { PLAT_Z, TRACK_Y } from './station';
import { seatFabric } from './tex';

const CARS = 5, LEN = 15, HALF_W = 1.2;
const DOORS = [-4.9, 0, 4.9];
const DOOR_W = 1.3;
export const TRAIN_HALF = (CARS * LEN) / 2;
const ROOF = PLAT_Z + 2.35;

export class Train {
  readonly group = new THREE.Group();
  private leaves: { mesh: THREE.Mesh; side: 1 | -1; x: number; dir: number }[] = [];
  side: 1 | -1 = 1;
  open = 0; // 0 닫힘 … 1 열림
  private stripe: THREE.MeshLambertMaterial;

  constructor() {
    const lam = (c: number, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const white = lam(0xf1f1ee), lower = lam(0x33404c), roof = lam(0x8d949a), dark = lam(0x1d1f22), floor = lam(0x4a4f55), inner = lam(0xdcdcd6);
    this.stripe = lam(0x2a8f7e);
    const glass = new THREE.MeshBasicMaterial({ color: 0x0f1a24, transparent: true, opacity: 0.35, depthWrite: false });
    const light = new THREE.MeshBasicMaterial({ color: 0xfff8e8 });
    const chrome = lam(0xc9cdd1);
    const fabric = new THREE.MeshLambertMaterial({ map: seatFabric() });
    const box = (sx: number, sy: number, sz: number, m: THREE.Material, x: number, y: number, z: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); this.group.add(b); return b; };
    const z0 = PLAT_Z - 0.1; // 차체 바닥
    for (let c = 0; c < CARS; c++) {
      const cx = -TRAIN_HALF + LEN * c + LEN / 2;
      // 바닥·지붕·천장 불빛
      box(LEN - 0.1, HALF_W * 2, 0.12, floor, cx, 0, PLAT_Z - 0.06);
      box(LEN - 0.1, HALF_W * 2 + 0.1, 0.3, roof, cx, 0, ROOF + 0.15);
      box(LEN - 0.4, HALF_W * 2 - 0.1, 0.04, inner, cx, 0, ROOF - 0.02);
      for (const s of [-0.45, 0.45]) box(LEN - 1.5, 0.18, 0.03, light, cx, s, ROOF - 0.05);
      // 옆면: 문 사이사이 기둥 + 아래 판 + 창
      for (const s of [1, -1] as const) {
        const y = s * HALF_W;
        const segs: [number, number][] = [];
        let prev = -LEN / 2 + 0.05;
        for (const d of DOORS) { segs.push([prev, d - DOOR_W / 2]); prev = d + DOOR_W / 2; }
        segs.push([prev, LEN / 2 - 0.05]);
        for (const [a, b] of segs) {
          const w = b - a, mx = cx + (a + b) / 2;
          box(w, 0.08, 0.95, lower, mx, y, z0 + 0.48);
          box(w, 0.09, 0.08, this.stripe, mx, y, z0 + 0.98);
          box(w, 0.06, 0.95, glass, mx, y, z0 + 1.5);
          box(w, 0.08, 0.45, white, mx, y, z0 + 2.2);
          for (let k = a + 0.02; k < b; k += Math.max(1.1, w / 2)) box(0.1, 0.09, 0.95, white, cx + k, y, z0 + 1.5);
          // 안쪽 벽(밝게) + 긴 의자
          box(w, 0.04, 0.95, inner, mx, y - s * 0.06, z0 + 0.48);
          if (w > 1.2) {
            box(w - 0.2, 0.45, 0.1, fabric, mx, y - s * 0.3, PLAT_Z + 0.42);
            box(w - 0.2, 0.08, 0.45, fabric, mx, y - s * 0.1, PLAT_Z + 0.72);
          }
        }
        // 문 위 판
        for (const d of DOORS) box(DOOR_W, 0.08, 0.4, white, cx + d, y, z0 + 2.25);
        // 문짝 둘(미닫이)
        for (const d of DOORS) for (const dir of [-1, 1]) {
          const leaf = new THREE.Group();
          const lx = cx + d + dir * DOOR_W / 4;
          const m1 = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W / 2 - 0.02, 0.06, 1.95), lam(0xd8dadb));
          m1.position.z = z0 + 1.07;
          const gl = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W / 2 - 0.16, 0.07, 0.8), glass);
          gl.position.z = z0 + 1.5;
          leaf.add(m1, gl);
          leaf.position.set(lx, y + s * 0.02, 0);
          this.group.add(leaf);
          this.leaves.push({ mesh: leaf as unknown as THREE.Mesh, side: s, x: lx, dir });
        }
      }
      // 손잡이 기둥
      for (const d of DOORS) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ROOF - PLAT_Z, 8).rotateX(Math.PI / 2), chrome); p.position.set(cx + d, 0, (ROOF + PLAT_Z) / 2); this.group.add(p); }
      // 칸 사이 이음
      if (c > 0) box(0.3, HALF_W * 2 - 0.2, ROOF - z0, dark, cx - LEN / 2, 0, (ROOF + z0) / 2);
    }
    // 앞뒤 운전실(비스듬한 얼굴 + 전조등)
    for (const e of [1, -1]) {
      const fx = e * (TRAIN_HALF + 0.35);
      box(0.7, HALF_W * 2, ROOF - z0 + 0.3, white, fx, 0, (ROOF + z0) / 2 + 0.1);
      box(0.72, HALF_W * 2 - 0.3, 0.8, glass, fx, 0, z0 + 1.6);
      box(0.74, HALF_W * 2 + 0.02, 0.12, this.stripe, fx, 0, z0 + 0.98);
      for (const s of [-0.75, 0.75]) box(0.05, 0.25, 0.14, light, fx + e * 0.36, s, z0 + 0.6);
    }
  }

  setLine(color: string) { this.stripe.color.set(color); }

  /** 어느 선로에 서나(1 = A 승강장 쪽) */
  place(side: 1 | -1) {
    this.side = side;
    this.group.position.y = side * TRACK_Y;
  }

  /** 문 여닫이 연출(0..1). 승강장 쪽 문만 열린다. */
  setOpen(k: number) {
    this.open = k;
    for (const l of this.leaves) {
      const o = l.side === this.side ? k : 0; // 승강장 쪽 문만
      l.mesh.position.x = l.x + l.dir * o * (DOOR_W / 2 - 0.05);
    }
  }

  /** 좌석(사람·여행자가 앉는 자리) — 역 좌표 */
  seats(): SeatSpot[] {
    const out: SeatSpot[] = [];
    const ty = this.side * TRACK_Y;
    for (let c = 0; c < CARS; c++) {
      const cx = -TRAIN_HALF + LEN * c + LEN / 2;
      let prev = -LEN / 2 + 0.05;
      for (const d of [...DOORS, LEN / 2 + DOOR_W / 2 - 0.05]) {
        const a = prev, b = d - DOOR_W / 2;
        prev = d + DOOR_W / 2;
        if (b - a < 1.2) continue;
        for (let x = a + 0.4; x < b - 0.2; x += 0.55) for (const s of [1, -1]) out.push({ x: cx + x, y: ty + s * (HALF_W - 0.35), z: PLAT_Z + 0.47, facing: s > 0 ? 180 : 0, kind: 'bench' });
      }
    }
    return out;
  }

  /** 안에 있나(역 좌표) */
  inside(x: number, y: number, z: number) {
    return Math.abs(x) < TRAIN_HALF - 0.1 && Math.abs(y - this.side * TRACK_Y) < HALF_W - 0.05 && z > PLAT_Z - 0.4 && z < ROOF;
  }

  /** 부딪힘: 바닥·옆벽(문 자리 비움)·끝벽·지붕·의자·기둥. 문짝은 따로 돌려준다(열면 뺀다). */
  addSolids(w: World): { leaves: Solid[]; all: Solid[] } {
    const ty = this.side * TRACK_Y;
    const all: Solid[] = [];
    const leaves: Solid[] = [];
    const box = (x0: number, x1: number, y0: number, y1: number, base: number, top: number, list = all) => { const s = w.addSolid([new Float64Array([x0, ty + y0, x1, ty + y0, x1, ty + y1, x0, ty + y1])], base, top, 'prop'); list.push(s); if (list !== all) all.push(s); return s; };
    box(-TRAIN_HALF, TRAIN_HALF, -HALF_W, HALF_W, -1, PLAT_Z);
    box(-TRAIN_HALF, TRAIN_HALF, -HALF_W, HALF_W, ROOF, ROOF + 3);
    for (const e of [1, -1]) box(e > 0 ? TRAIN_HALF : -TRAIN_HALF - 0.4, e > 0 ? TRAIN_HALF + 0.4 : -TRAIN_HALF, -HALF_W - 0.1, HALF_W + 0.1, -1, ROOF + 3);
    for (let c = 0; c < CARS; c++) {
      const cx = -TRAIN_HALF + LEN * c + LEN / 2;
      for (const s of [1, -1]) {
        let prev = -LEN / 2;
        for (const d of DOORS) {
          box(cx + prev, cx + d - DOOR_W / 2, s > 0 ? HALF_W - 0.1 : -HALF_W - 0.1, s > 0 ? HALF_W + 0.1 : -HALF_W + 0.1, -1, ROOF + 3);
          prev = d + DOOR_W / 2;
          box(cx + d - DOOR_W / 2, cx + d + DOOR_W / 2, s > 0 ? HALF_W - 0.1 : -HALF_W - 0.1, s > 0 ? HALF_W + 0.1 : -HALF_W + 0.1, -1, ROOF + 3, s === this.side ? leaves : all);
        }
        box(cx + prev, cx + LEN / 2, s > 0 ? HALF_W - 0.1 : -HALF_W - 0.1, s > 0 ? HALF_W + 0.1 : -HALF_W + 0.1, -1, ROOF + 3);
        // 긴 의자
        prev = -LEN / 2 + 0.05;
        for (const d of [...DOORS, LEN / 2 + DOOR_W / 2 - 0.05]) {
          const a = prev, b = d - DOOR_W / 2;
          prev = d + DOOR_W / 2;
          if (b - a > 1.2) box(cx + a + 0.1, cx + b - 0.1, s > 0 ? HALF_W - 0.55 : -HALF_W + 0.1, s > 0 ? HALF_W - 0.1 : -HALF_W + 0.55, -1, PLAT_Z + 0.47);
        }
      }
      for (const d of DOORS) box(cx + d - 0.04, cx + d + 0.04, -0.04, 0.04, -1, ROOF);
    }
    return { leaves, all };
  }
}
