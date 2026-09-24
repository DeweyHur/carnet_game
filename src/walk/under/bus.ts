// 버스 안. 앞문으로 타서 단말기에 표를 찍고, 서거나 앉아서 간다. 창밖으로 파리 거리가 흘러간다.
// 버스는 원점에 가만히 있고(앞 = +x), 바깥 거리(건물 줄·가로등·나무)가 -x로 흐른다. 문은 오른쪽(y < 0, 보도 쪽).
import * as THREE from 'three';
import { World } from '../hero/world';
import type { Solid } from '../hero/world';
import type { SeatSpot } from '../town';
import { GeoBuilder, hash, lin } from '../town/geom';
import { T } from '../town/atlas';
import { townMaterial, townUniforms } from '../town/material';
import type { TownUniforms } from '../town/material';
import { stamp, template } from '../town/props';
import { seatFabric } from './tex';

export const BUS_FLOOR = 0.35;
const HALF_L = 6, HALF_W = 1.25, ROOF = 2.75;
export const BUS_DOORS = [4.9, 0.2, -3.9];
const DOOR_W = 1.2;
const STRIP = 240; // 거리 무늬가 되풀이되는 길이

export class BusScene {
  readonly group = new THREE.Group();
  readonly street = new THREE.Group();
  readonly uniforms: TownUniforms = townUniforms();
  private leaves: { mesh: THREE.Object3D; x: number }[] = [];
  private stripMesh: THREE.Mesh | null = null;
  private stopMarks: THREE.Group;
  validator = { x: 4.3, y: -0.85 };

  constructor(color: string) {
    const lam = (c: number | string, extra: THREE.MeshLambertMaterialParameters = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
    const body = lam('#e9ecef'), dark = lam(0x2b2f33), floor = lam(0x55595e), inner = lam(0xe3e3dd);
    const glass = new THREE.MeshBasicMaterial({ color: 0x14202a, transparent: true, opacity: 0.25, depthWrite: false });
    const light = new THREE.MeshBasicMaterial({ color: 0xfff8e8 });
    const stripe = lam(color);
    const fabric = new THREE.MeshLambertMaterial({ map: seatFabric() });
    const box = (sx: number, sy: number, sz: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.group) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); parent.add(b); return b; };
    box(HALF_L * 2, HALF_W * 2, 0.1, floor, 0, 0, BUS_FLOOR - 0.05);
    box(HALF_L * 2, HALF_W * 2 + 0.1, 0.2, body, 0, 0, ROOF + 0.1);
    box(HALF_L * 2 - 0.4, HALF_W * 2 - 0.2, 0.03, inner, 0, 0, ROOF - 0.02);
    for (const s of [-0.5, 0.5]) box(HALF_L * 2 - 1, 0.16, 0.03, light, 0, s, ROOF - 0.04);
    for (const s of [1, -1] as const) {
      const y = s * HALF_W;
      const gaps = s < 0 ? BUS_DOORS : [];
      let prev = -HALF_L;
      for (const d of [...gaps, HALF_L + DOOR_W / 2]) {
        const a = prev, b = d - DOOR_W / 2;
        prev = d + DOOR_W / 2;
        if (b - a < 0.05) continue;
        const w = b - a, mx = (a + b) / 2;
        box(w, 0.08, 0.75, body, mx, y, 0.4);
        box(w, 0.09, 0.08, stripe, mx, y, 0.82);
        box(w, 0.06, 1.2, glass, mx, y, 1.45);
        box(w, 0.08, 0.7, body, mx, y, 2.4);
        for (let k = a + 0.05; k < b; k += 1.6) box(0.08, 0.09, 1.2, dark, k, y, 1.45);
      }
      // 끝면
    }
    box(0.1, HALF_W * 2, ROOF, body, -HALF_L, 0, ROOF / 2);
    box(0.1, HALF_W * 2 - 0.2, 1.1, glass, -HALF_L - 0.02, 0, 1.6);
    box(0.1, HALF_W * 2, 0.9, body, HALF_L, 0, 0.45);
    box(0.1, HALF_W * 2 - 0.1, 1.6, glass, HALF_L + 0.02, 0, 1.75);
    // 운전석 칸막이·핸들
    box(0.9, 0.05, 1.4, dark, HALF_L - 0.5, 0.05, 1.05);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16).rotateY(Math.PI / 2 - 0.5), dark);
    wheel.position.set(HALF_L - 0.55, 0.65, 1.3);
    this.group.add(wheel);
    // 행선지 전광판(안쪽)
    box(0.04, 1.2, 0.2, lam(0x111111), HALF_L - 0.9, 0, ROOF - 0.2);
    // 문짝(접이식 대신 미닫이 한 장)
    for (const d of BUS_DOORS) {
      const leaf = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.05, 0.05, 2.1), body);
      m.position.z = BUS_FLOOR + 1.05;
      const g2 = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W - 0.25, 0.06, 1.3), glass);
      g2.position.z = BUS_FLOOR + 1.3;
      leaf.add(m, g2);
      leaf.position.set(d, -HALF_W - 0.03, 0);
      this.group.add(leaf);
      this.leaves.push({ mesh: leaf, x: d });
    }
    // 좌석: 통로 양쪽 두 줄, 앞을 본다(가운데 문 앞은 비운다)
    for (let x = -5.3; x <= 3.4; x += 0.85) for (const s of [1, -1]) {
      if (s < 0 && Math.abs(x - 0.2) < 0.9) continue;
      box(0.45, 0.9, 0.1, fabric, x, s * 0.72, BUS_FLOOR + 0.45);
      box(0.08, 0.9, 0.55, fabric, x - 0.24, s * 0.72, BUS_FLOOR + 0.75);
    }
    // 손잡이 기둥(노랑·빨강 정지 버튼)
    for (const x of [-4.4, -2.1, 1.3, 3.6]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, ROOF - BUS_FLOOR, 8).rotateX(Math.PI / 2), lam(0xd9c23a));
      p.position.set(x, 0.24, (ROOF + BUS_FLOOR) / 2);
      this.group.add(p);
      box(0.06, 0.04, 0.08, lam(0xd9302c), x, 0.2, 1.5);
    }
    // 표 찍는 단말기
    box(0.18, 0.12, 0.3, lam(0x2d6cdf), this.validator.x, this.validator.y, 1.2);
    box(0.04, 0.04, 0.9, dark, this.validator.x, this.validator.y, 0.7);

    // 바깥 거리: 도로·보도·양쪽 건물 줄·가로등·나무(한 무늬를 두 번 이어 붙여 되풀이)
    const gb = new GeoBuilder();
    for (const rep of [-1, 0, 1]) {
      const ox = rep * STRIP;
      gb.quad([ox - STRIP / 2, -7, 0.0], [ox + STRIP / 2, -7, 0.0], [ox + STRIP / 2, 7, 0.0], [ox - STRIP / 2, 7, 0.0], [0, 0, 1], [0, 0, STRIP / 4, 14 / 4], T.asphalt, lin('#ffffff'));
      for (const s of [1, -1]) {
        const y0 = s * 7, y1 = s * 11;
        gb.quad([ox - STRIP / 2, Math.min(y0, y1), 0.12], [ox + STRIP / 2, Math.min(y0, y1), 0.12], [ox + STRIP / 2, Math.max(y0, y1), 0.12], [ox - STRIP / 2, Math.max(y0, y1), 0.12], [0, 0, 1], [0, 0, STRIP / 4, 1], T.sidewalk, lin('#ffffff'));
        // 건물 줄: 8~14 m 폭마다 다른 겉모습
        let x = -STRIP / 2;
        let i = 0;
        const uppers = [T.haussmann, T.haussmannB, T.ochre, T.plaster, T.grey, T.grand];
        const shops = [T.cafe, T.boulangerie, T.shopGreen, T.shopRed, T.librairie, T.porte, T.pharmacie, T.bistrot, T.fromagerie];
        while (x < STRIP / 2) {
          const w = 8 + hash(i, s, 1) * 6;
          const h = 15 + Math.round(hash(i, s, 2) * 3) * 3;
          const wy = s * 11;
          const nx = 0, ny = -s;
          const a = s > 0 ? ox + x : ox + x + w, b = s > 0 ? ox + x + w : ox + x;
          const bays = Math.max(1, Math.round(w / 2.9));
          const floors = Math.round((h - 4) / 3.05);
          gb.wall(a, wy, b, wy, 4, h, nx, ny, [0, bays], [0, floors], uppers[Math.floor(hash(i, s, 3) * uppers.length)], lin('#ffffff'), i);
          for (let k = 0; k < bays; k++) { const t0 = k / bays, t1 = (k + 1) / bays; gb.wall(a + (b - a) * t0, wy, a + (b - a) * t1, wy, 0, 4, nx, ny, [0, 1], [0, 1], shops[Math.floor(hash(i, k, s + 4) * shops.length)], lin('#ffffff'), i + k); }
          gb.quad([a, wy, h], [b, wy, h], [b, wy + s * 12, h], [a, wy + s * 12, h], [0, 0, 1], [0, 0, 1, 1], T.zinc, lin('#ffffff'));
          x += w; i++;
        }
        for (let lx = -STRIP / 2 + 6; lx < STRIP / 2; lx += 24) stamp(gb, template('lamp'), ox + lx, s * 7.6, 0.12, s > 0 ? Math.PI : 0, 1);
        for (let lx = -STRIP / 2 + 15; lx < STRIP / 2; lx += 12) { const k = hash(lx, s, 9); stamp(gb, template('tree', k), ox + lx, s * 8.8, 0.12, k * 6, 0.9 + k * 0.3); }
      }
    }
    const geo = gb.build();
    if (geo) { this.stripMesh = new THREE.Mesh(geo, townMaterial(this.uniforms)); this.street.add(this.stripMesh); }
    this.uniforms.uFar.value = 1e6;
    // 정류장 표시(차가 멈추는 자리마다 쉼터)
    this.stopMarks = new THREE.Group();
    const sg = new GeoBuilder();
    stamp(sg, template('bus'), 0, -8.2, 0.12, Math.PI, 1);
    const sgeo = sg.build();
    if (sgeo) this.stopMarks.add(new THREE.Mesh(sgeo, townMaterial(this.uniforms)));
    this.group.add(this.street, this.stopMarks);
  }

  /** 버스가 거리를 d m 달렸다. stopAt: 이번(다음) 정류장이 버스 앞 몇 m에 있나 */
  scroll(d: number, stopAhead: number) {
    this.street.position.x = -(((d % STRIP) + STRIP) % STRIP);
    this.stopMarks.position.x = stopAhead;
  }

  setOpen(k: number) { for (const l of this.leaves) l.mesh.position.x = l.x - k * (DOOR_W - 0.1); }

  /** 부딪힘. 문짝은 따로(열면 뺀다). */
  addSolids(w: World): { leaves: Solid[] } {
    const box = (x0: number, x1: number, y0: number, y1: number, base: number, top: number) => w.addSolid([new Float64Array([x0, y0, x1, y0, x1, y1, x0, y1])], base, top, 'prop');
    box(-HALF_L, HALF_L, -HALF_W, HALF_W, -1, BUS_FLOOR);
    box(-HALF_L, HALF_L, -HALF_W - 0.2, HALF_W + 0.2, ROOF, ROOF + 3);
    box(-HALF_L - 0.3, -HALF_L, -HALF_W - 0.2, HALF_W + 0.2, -1, ROOF + 3);
    box(HALF_L, HALF_L + 0.3, -HALF_W - 0.2, HALF_W + 0.2, -1, ROOF + 3);
    box(-HALF_L, HALF_L, HALF_W - 0.05, HALF_W + 0.2, -1, ROOF + 3);
    box(HALF_L - 1.0, HALF_L, -0.02, HALF_W, -1, ROOF + 3); // 운전석
    let prev = -HALF_L;
    const leaves: Solid[] = [];
    for (const d of BUS_DOORS) {
      box(prev, d - DOOR_W / 2, -HALF_W - 0.2, -HALF_W + 0.05, -1, ROOF + 3);
      leaves.push(box(d - DOOR_W / 2, d + DOOR_W / 2, -HALF_W - 0.2, -HALF_W + 0.05, -1, ROOF + 3));
      prev = d + DOOR_W / 2;
    }
    box(prev, HALF_L - 1, -HALF_W - 0.2, -HALF_W + 0.05, -1, ROOF + 3);
    for (let x = -5.3; x <= 3.4; x += 0.85) for (const s of [1, -1]) {
      if (s < 0 && Math.abs(x - 0.2) < 0.9) continue;
      box(x - 0.26, x + 0.24, s * 0.72 - 0.45, s * 0.72 + 0.45, -1, BUS_FLOOR + 0.47);
    }
    for (const x of [-4.4, -2.1, 1.3, 3.6]) box(x - 0.04, x + 0.04, 0.2, 0.28, -1, ROOF);
    box(this.validator.x - 0.1, this.validator.x + 0.1, this.validator.y - 0.07, this.validator.y + 0.07, -1, 1.4);
    // 바깥 보도(내리면 여기에 선다)
    box(-30, 30, -11, -1.6, -1, 0.12);
    return { leaves };
  }

  seats(): SeatSpot[] {
    const out: SeatSpot[] = [];
    for (let x = -5.3; x <= 3.4; x += 0.85) for (const s of [1, -1]) {
      if (s < 0 && Math.abs(x - 0.2) < 0.9) continue;
      out.push({ x: x + 0.05, y: s * 0.72, z: BUS_FLOOR + 0.47, facing: 90, kind: 'bench' });
    }
    return out;
  }

  inside(x: number, y: number) { return Math.abs(x) < HALF_L && Math.abs(y) < HALF_W; }

  dispose() {
    this.group.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose(); });
  }
}
