// 시작 헬기(배틀그라운드 수송기처럼): 불로뉴 숲에서 파리 북동쪽까지 정해진 길로 날아간다.
// 여행자는 열린 옆문에 앉아 있다가, 원하는 곳에서 뛰어내린다(점프). 끝까지 가면 저절로 뛰어내린다.
import * as THREE from 'three';
import type { LngLat } from './graph';

export const HELI_ALT = 420; // m
export const HELI_SPEED = 70; // m/s (약 250 km/h)

/** 노선(서 → 북동): 이름은 화면 안내("곧: …")에 쓴다 */
export const HELI_ROUTE: { pos: LngLat; name: string }[] = [
  { pos: [2.2380, 48.8590], name: '불로뉴 숲' },
  { pos: [2.2720, 48.8575], name: '파시' },
  { pos: [2.2905, 48.8600], name: '트로카데로·에펠탑' },
  { pos: [2.3080, 48.8620], name: '앵발리드' },
  { pos: [2.3213, 48.8656], name: '콩코르드' },
  { pos: [2.3370, 48.8610], name: '루브르' },
  { pos: [2.3522, 48.8570], name: '시청·마레' },
  { pos: [2.3640, 48.8675], name: '레퓌블리크' },
  { pos: [2.3790, 48.8720], name: '벨빌' },
  { pos: [2.3850, 48.8800], name: '뷔트쇼몽' },
  { pos: [2.3980, 48.8900], name: '파리 북동쪽 끝' },
];

export class Heli {
  readonly group = new THREE.Group();
  private readonly rotor = new THREE.Group();
  private readonly tail = new THREE.Group();
  private pts: [number, number][] = [];
  private cum: number[] = [];
  /** 노선을 따라 온 거리(m) */
  s = 0;
  length = 0;
  heading = 0;
  private bank = 0;
  /** 여행자가 타고 있나 */
  riding = true;
  /** 날고 있나(시작 버튼을 누르기 전엔 제자리에서 떠 있다) */
  flying = false;
  x = 0; y = 0; z = HELI_ALT;

  constructor() {
    this.build();
  }

  /** 좌표계(원점)가 정해지면 노선을 로컬로 */
  setFrame(toLocal: (p: LngLat) => [number, number]) {
    this.pts = HELI_ROUTE.map((w) => toLocal(w.pos));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + Math.hypot(this.pts[i][0] - this.pts[i - 1][0], this.pts[i][1] - this.pts[i - 1][1]));
    this.length = this.cum[this.cum.length - 1];
    this.place(true);
  }

  /** 노선 위 거리 s의 자리와 방향 */
  private at(s: number): { x: number; y: number; h: number } {
    let i = 1;
    while (i < this.cum.length - 1 && this.cum[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const L = this.cum[i] - this.cum[i - 1] || 1;
    const t = Math.max(0, Math.min(1, (s - this.cum[i - 1]) / L));
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, h: ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360 };
  }

  /** 다음 지나갈 곳과 거리 */
  next(): { name: string; dist: number } {
    for (let i = 1; i < this.cum.length; i++) if (this.cum[i] > this.s + 30) return { name: HELI_ROUTE[i].name, dist: this.cum[i] - this.s };
    return { name: HELI_ROUTE[HELI_ROUTE.length - 1].name, dist: 0 };
  }

  update(dt: number) {
    if (this.flying) this.s = Math.min(this.length + 2000, this.s + HELI_SPEED * dt);
    this.rotor.rotation.z += dt * 28;
    this.tail.rotation.x += dt * 40;
    this.place(false, dt);
  }

  private place(snap: boolean, dt = 0) {
    if (!this.pts.length) return;
    const p = this.at(Math.min(this.s, this.length));
    // 끝을 지나면 그 방향 그대로 날아가 버린다
    const over = Math.max(0, this.s - this.length);
    const hr = (p.h * Math.PI) / 180;
    this.x = p.x + Math.sin(hr) * over;
    this.y = p.y + Math.cos(hr) * over;
    this.z = HELI_ALT + Math.sin(this.s * 0.004) * 4; // 살짝 오르내린다
    // 방향은 모퉁이에서 부드럽게 돈다(도는 쪽으로 기운다)
    const d = ((p.h - this.heading + 540) % 360) - 180;
    const turn = snap ? d : Math.max(-22 * dt, Math.min(22 * dt, d));
    this.heading = (this.heading + turn + 360) % 360;
    this.bank += ((dt > 0 ? (turn / dt) * 0.6 : 0) - this.bank) * Math.min(1, dt * 2);
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.set(0, 0, 0);
    this.group.rotateZ(-hr + (p.h - this.heading) * (Math.PI / 180));
    this.group.rotateY((this.bank * Math.PI) / 180 * 0.4);
    this.group.rotateX(-0.08); // 앞으로 숙여 난다
  }

  /** 옆문에 앉은 자리(오른쪽 문) */
  seat(): { x: number; y: number; z: number; facing: number } {
    const hr = (this.heading * Math.PI) / 180;
    const rx = Math.cos(hr), ry = -Math.sin(hr); // 오른쪽
    return { x: this.x + rx * 1.15, y: this.y + ry * 1.15, z: this.z - 0.55, facing: (this.heading + 90) % 360 };
  }

  private build() {
    const mat = (c: number) => new THREE.MeshToonMaterial({ color: c });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.35, 3.4, 6, 14), mat(0x1f3b6e));
    body.scale.set(1, 1, 0.92);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.5).translate(0, 0, -1.0), mat(0xd9d4c8));
    const glass = new THREE.Mesh(new THREE.SphereGeometry(1.25, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 2.1, 0.2), new THREE.MeshToonMaterial({ color: 0x9ec4dc, transparent: true, opacity: 0.8 }));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.74, 4.2, 0.18).translate(0, 0, 0.35), mat(0xc8333a));
    // 열린 오른쪽 문(어두운 구멍)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 1.3).translate(1.36, -0.2, -0.1), mat(0x151515));
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 5.4, 10).translate(0, -4.8, 0.3), mat(0x1f3b6e));
    boom.geometry.rotateX(0);
    const boomG = new THREE.Group();
    boomG.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.0, 1.4).translate(0, -7.2, 0.9), mat(0x1f3b6e));
    const skidMat = mat(0x2a2a2a);
    const skids: THREE.Mesh[] = [];
    for (const sx of [-1, 1]) {
      skids.push(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 6).translate(sx * 1.2, 0, -1.75), skidMat));
      for (const sy of [-0.9, 0.9]) skids.push(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6).rotateX(Math.PI / 2).translate(sx * 1.1, sy, -1.45), skidMat));
    }
    // 큰 날개 넷 + 꼬리 날개
    const blade = mat(0x333333);
    this.rotor.position.set(0, 0, 1.6);
    this.rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8).rotateX(Math.PI / 2), blade));
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 5.6, 0.05).translate(0, 2.8, 0.2), blade);
      b.rotation.z = (k * Math.PI) / 2;
      this.rotor.add(b);
    }
    // 돌 때 보이는 흐린 원판
    this.rotor.add(new THREE.Mesh(new THREE.CircleGeometry(5.6, 32).translate(0, 0, 0.2), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })));
    this.tail.position.set(0.3, -7.3, 0.9);
    for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 1.4), blade); b.rotation.x = (k * Math.PI) / 2; this.tail.add(b); }
    this.group.add(body, belly, glass, stripe, door, boomG, fin, ...skids, this.rotor, this.tail);
    this.group.traverse((o) => { o.frustumCulled = false; });
  }
}
