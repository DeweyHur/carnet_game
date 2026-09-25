// 파리 하늘에 있는 것들 — 가까이 가면 서로 주고받는다.
//  🎈 열기구: 바람 따라 흘러간다. 바구니에 내려앉으면 올라타고(점프로 뛰어내린다), 풍선 꼭대기에 떨어지면 통 튄다.
//  🐦 새 떼: 천천히 날아 다가가면 곁에서 함께 날고, 빠르게 들이받으면 흩어진다. 열기구·비행기를 피해 간다.
//  🪂 낙하산 타는 사람들: 빙빙 돌며 내려온다. 다가가면 손을 흔들고 "Salut !", 바짝 붙으면 하이파이브(기력 가득).
//  ✈️ 낮게 지나가는 여객기: 가끔 하늘을 가로지른다. 뒤쪽 난기류에 휘말리면 휘청.
import * as THREE from 'three';
import type { Body } from './hero/body';
import * as sfx from './sound';

export interface SkyCtx {
  say(at: () => { x: number; y: number; z: number }, text: string, secs: number, voice?: number): void;
  toast(s: string): void;
  terrain(x: number, y: number): number;
}

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const toon = (c: number | string) => new THREE.MeshToonMaterial({ color: c });

interface Balloon { g: THREE.Group; flame: THREE.Mesh; x: number; y: number; z: number; vz: number; burn: number; want: number; t: number; greeted: boolean }
interface Flock { wings: [THREE.InstancedMesh, THREE.InstancedMesh]; bodies: THREE.InstancedMesh; n: number; x: number; y: number; z: number; h: number; speed: number; off: THREE.Vector3[]; ph: number[]; scatter: number; escort: number; turn: number; geese: boolean }
interface Jumper { g: THREE.Group; arm: THREE.Object3D; cx: number; cy: number; r: number; a: number; z: number; sink: number; waved: boolean; five: number; id: number }
interface Jet { g: THREE.Group; lights: THREE.Mesh[]; x: number; y: number; z: number; dx: number; dy: number; left: number; hit: boolean }

const BALLOON_COLS = [['#e8453c', '#f6d04d'], ['#2d6cdf', '#ffffff'], ['#3aa35b', '#f3e7c4'], ['#8e44ad', '#f39c12'], ['#e67e22', '#2c3e50'], ['#d6336c', '#ffe066']];

export class Sky {
  readonly group = new THREE.Group();
  private readonly c: SkyCtx;
  private balloons: Balloon[] = [];
  private flocks: Flock[] = [];
  private jumpers: Jumper[] = [];
  private jet: Jet | null = null;
  private jetT = 25;
  /** 타고 있는 열기구 */
  riding: Balloon | null = null;
  private wind = new THREE.Vector2(0.8, 0.5).normalize().multiplyScalar(3.2);
  private told = new Set<string>();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s1 = new THREE.Vector3(1, 1, 1);
  private readonly p = new THREE.Vector3();
  private jumperSeq = 9000;

  constructor(c: SkyCtx) {
    this.c = c;
    this.group.matrixAutoUpdate = true;
  }

  /** 미니맵에 찍을 것들 */
  blips(): { kind: 'balloon' | 'jumper' | 'jet' | 'birds'; x: number; y: number; h?: number }[] {
    const out: { kind: 'balloon' | 'jumper' | 'jet' | 'birds'; x: number; y: number; h?: number }[] = [];
    for (const b of this.balloons) out.push({ kind: 'balloon', x: b.x, y: b.y });
    for (const j of this.jumpers) out.push({ kind: 'jumper', x: j.cx + Math.cos(j.a) * j.r, y: j.cy + Math.sin(j.a) * j.r });
    for (const f of this.flocks) out.push({ kind: 'birds', x: f.x, y: f.y });
    if (this.jet) out.push({ kind: 'jet', x: this.jet.x, y: this.jet.y, h: Math.atan2(this.jet.dx, this.jet.dy) });
    return out;
  }

  private once(key: string, msg: string) { if (this.told.has(key)) return; this.told.add(key); this.c.toast(msg); }

  /** 사람 둘레에 새로 흩뿌린다(동네를 새로 읽었을 때) */
  reset(hx: number, hy: number) {
    this.riding = null;
    for (const b of this.balloons) this.group.remove(b.g);
    for (const f of this.flocks) this.group.remove(f.bodies, ...f.wings);
    for (const j of this.jumpers) this.group.remove(j.g);
    if (this.jet) this.group.remove(this.jet.g);
    this.balloons = []; this.flocks = []; this.jumpers = []; this.jet = null;
    for (let i = 0; i < 6; i++) this.balloons.push(this.makeBalloon(hx, hy, i));
    for (let i = 0; i < 4; i++) this.flocks.push(this.makeFlock(hx, hy, i % 2 === 0));
    for (let i = 0; i < 5; i++) this.jumpers.push(this.makeJumper(hx, hy));
    this.jetT = rnd(15, 35);
  }

  /** 원점이 옮겨졌다(동네 경계를 넘었다) */
  shift(dx: number, dy: number) {
    for (const b of this.balloons) { b.x += dx; b.y += dy; }
    for (const f of this.flocks) { f.x += dx; f.y += dy; }
    for (const j of this.jumpers) { j.cx += dx; j.cy += dy; }
    if (this.jet) { this.jet.x += dx; this.jet.y += dy; }
  }

  // ───────── 만들기 ─────────
  private stripes(a: string, b: string) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d')!;
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect((i * 256) / 12, 0, 256 / 12 + 1, 64); }
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 22, 256, 7);
    g.fillStyle = a; g.fillRect(0, 50, 256, 14);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private makeBalloon(hx: number, hy: number, i: number): Balloon {
    const g = new THREE.Group();
    const [a, b] = BALLOON_COLS[i % BALLOON_COLS.length];
    const prof = [[1.2, 0], [3.2, 2.2], [6.6, 5.6], [8.6, 9.6], [9, 12.8], [8.1, 16.4], [5.8, 19], [2.6, 20.6], [0.05, 21.1]].map(([r, z]) => new THREE.Vector2(r, z));
    const env = new THREE.Mesh(new THREE.LatheGeometry(prof, 24).rotateX(Math.PI / 2), new THREE.MeshToonMaterial({ map: this.stripes(a, b) }));
    env.position.z = 4.2;
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.1).translate(0, 0, 0.55), toon('#8a5a2b'));
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.12).translate(0, 0, 1.1), toon('#5a3a1c'));
    const ropes = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]].flatMap(([x, y]) => [new THREE.Vector3(x, y, 1.1), new THREE.Vector3(x * 1.6, y * 1.6, 4.3)])), new THREE.LineBasicMaterial({ color: 0x3a2e24 }));
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.4, 8).rotateX(Math.PI / 2).translate(0, 0, 3.2), new THREE.MeshBasicMaterial({ color: 0xffb030, transparent: true, opacity: 0.9 }));
    // 승객 둘
    for (const [px, c] of [[-0.35, '#2d4d7a'], [0.35, '#b33a3a']] as const) {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 8).rotateX(Math.PI / 2).translate(px, 0.1, 1.2), toon(c));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6).translate(px, 0.1, 1.75), toon('#e8c4a0'));
      g.add(body, head);
    }
    g.add(env, basket, rim, ropes, flame);
    this.group.add(g);
    const ang = rnd(0, TAU), d = rnd(250, 1800);
    return { g, flame, x: hx + Math.cos(ang) * d, y: hy + Math.sin(ang) * d, z: rnd(160, 420), vz: 0, burn: 0, want: rnd(160, 420), t: rnd(0, 100), greeted: false };
  }

  private makeFlock(hx: number, hy: number, geese: boolean): Flock {
    const n = geese ? 11 : 26;
    const col = geese ? '#6b6258' : '#2c2a28';
    const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0, -0.12, 0), new THREE.Vector3(geese ? 0.9 : 0.35, -0.05, 0)]);
    wingGeo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    const left = new THREE.InstancedMesh(wingGeo, mat, n), right = new THREE.InstancedMesh(wingGeo, mat, n);
    const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(geese ? 0.1 : 0.05, geese ? 0.55 : 0.2, 2, 5).rotateX(Math.PI / 2).rotateX(Math.PI / 2), mat, n);
    for (const m of [left, right, bodies]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.group.add(m); }
    const off: THREE.Vector3[] = [], ph: number[] = [];
    for (let i = 0; i < n; i++) {
      if (geese) { const side = i % 2 ? 1 : -1, k = Math.ceil(i / 2); off.push(new THREE.Vector3(side * k * 2.2, -k * 2.4, rnd(-0.3, 0.3))); } // V 대형
      else off.push(new THREE.Vector3(rnd(-7, 7), rnd(-7, 7), rnd(-3, 3))); // 찌르레기 떼
      ph.push(rnd(0, TAU));
    }
    const ang = rnd(0, TAU), d = rnd(300, 1500);
    return { wings: [left, right], bodies, n, x: hx + Math.cos(ang) * d, y: hy + Math.sin(ang) * d, z: rnd(70, 260), h: rnd(0, 360), speed: geese ? 14 : 11, off, ph, scatter: 0, escort: 0, turn: rnd(-8, 8), geese };
  }

  private makeJumper(hx: number, hy: number, fresh = false): Jumper {
    const g = new THREE.Group();
    const cols = ['#e8453c', '#2d6cdf', '#f6d04d', '#3aa35b', '#ffffff', '#ff7ab8'];
    const col = cols[Math.floor(Math.random() * cols.length)];
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 1.9, 10, 1, true, -0.9, 1.8).rotateZ(Math.PI / 2).scale(1, 1, 0.45).translate(0, 0, 5.4), new THREE.MeshToonMaterial({ color: col, side: THREE.DoubleSide }));
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 1.2), new THREE.Vector3(-2.6, 0, 4.4), new THREE.Vector3(0, 0, 1.2), new THREE.Vector3(2.6, 0, 4.4)]), new THREE.LineBasicMaterial({ color: 0x333333 }));
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.7, 3, 8).rotateX(Math.PI / 2).translate(0, 0, 0.6), toon('#333a44'));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6).translate(0, 0, 1.25), toon('#e8c4a0'));
    const arm = new THREE.Group();
    arm.position.set(0.25, 0, 1.0);
    arm.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 2, 5).translate(0, 0, 0.3), toon('#333a44')));
    g.add(canopy, lines, body, head, arm);
    this.group.add(g);
    const ang = rnd(0, TAU), d = rnd(200, 1400);
    return { g, arm, cx: hx + Math.cos(ang) * d, cy: hy + Math.sin(ang) * d, r: rnd(35, 90), a: rnd(0, TAU), z: fresh ? rnd(700, 950) : rnd(200, 900), sink: rnd(2.2, 3.4), waved: false, five: 0, id: this.jumperSeq++ };
  }

  private makeJet(hx: number, hy: number): Jet {
    const g = new THREE.Group();
    const white = toon('#f4f4f2'), blue = toon('#1f3b6e'), red = toon('#c8333a'), grey = toon('#9aa0a6');
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 30, 14), white));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(2, 14, 10).scale(1, 2.2, 1).translate(0, 15, 0), white));
    g.add(new THREE.Mesh(new THREE.ConeGeometry(2, 7, 14).rotateX(Math.PI).translate(0, -18.5, 0.3), white));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(4.1, 30, 0.8).translate(0, 0, -1.2), blue)); // 배 쪽 띠
    const wing = new THREE.Shape([new THREE.Vector2(0, 3), new THREE.Vector2(17, -4), new THREE.Vector2(17, -6.5), new THREE.Vector2(0, -3)]);
    for (const s of [1, -1]) {
      const w = new THREE.Mesh(new THREE.ExtrudeGeometry(wing, { depth: 0.5, bevelEnabled: false }).scale(s, 1, 1).translate(0, 0, -0.9), white);
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 4, 10).translate(s * 6.5, 2, -2.1), grey);
      const st = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(0, -12), new THREE.Vector2(6.5, -16), new THREE.Vector2(6.5, -17.5), new THREE.Vector2(0, -16.5)]), { depth: 0.3, bevelEnabled: false }).scale(s, 1, 1).translate(0, 0, 1.2), white);
      g.add(w, eng, st);
    }
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 7).translate(0, -17, 4.8), red);
    g.add(fin);
    // 항법등(밤에 깜빡)
    const lights = [0xff3030, 0x30ff60, 0xffffff].map((c, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), new THREE.MeshBasicMaterial({ color: c })); m.position.set(i === 0 ? -17 : i === 1 ? 17 : 0, i === 2 ? -17 : -5.5, i === 2 ? 8 : -0.6); g.add(m); return m; });
    this.group.add(g);
    // 사람 옆 300~900 m를 지나가는 곧은 길, 3.5 km 밖에서 들어온다
    const ang = rnd(0, TAU), side = rnd(-900, 900);
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const x = hx - dx * 3500 - dy * side, y = hy - dy * 3500 + dx * side;
    return { g, lights, x, y, z: rnd(480, 620), dx, dy, left: 7500, hit: false };
  }

  // ───────── 매 프레임 ─────────
  update(dt: number, b: Body, night: number) {
    const air = b.mode === 'air' || b.mode === 'glide';
    const t = performance.now() / 1000;
    this.stepBalloons(dt, b, air);
    this.stepFlocks(dt, b, air, t);
    this.stepJumpers(dt, b, air, t);
    this.stepJet(dt, b, air, night, t);
  }

  private stepBalloons(dt: number, b: Body, air: boolean) {
    for (const bl of this.balloons) {
      bl.t += dt;
      // 원하는 높이로: 모자라면 버너를 켠다
      if (bl.t % 40 < dt) bl.want = rnd(160, 440);
      bl.burn = bl.z < bl.want - 5 ? Math.min(1, bl.burn + dt * 2) : Math.max(0, bl.burn - dt);
      bl.vz += ((bl.burn > 0.3 ? 1.2 : -0.5) - bl.vz) * dt * 0.3;
      bl.z += bl.vz * dt;
      bl.x += this.wind.x * dt; bl.y += this.wind.y * dt;
      // 너무 멀어지면 사람 바람 불어오는 쪽에서 다시
      if (!this.riding || this.riding !== bl) {
        if (Math.hypot(bl.x - b.x, bl.y - b.y) > 3200) { const a = Math.atan2(-this.wind.y, -this.wind.x) + rnd(-0.8, 0.8), d = rnd(1400, 2200); bl.x = b.x + Math.cos(a) * d; bl.y = b.y + Math.sin(a) * d; bl.z = rnd(160, 420); bl.greeted = false; }
      }
      bl.g.position.set(bl.x, bl.y, bl.z);
      bl.g.rotation.z = Math.sin(bl.t * 0.2) * 0.2;
      bl.flame.visible = bl.burn > 0.3 && Math.sin(bl.t * 30) > -0.4;
      if (bl.flame.visible && Math.random() < dt * 0.5 && Math.hypot(bl.x - b.x, bl.y - b.y, bl.z - b.z) < 60) sfx.burner();
      if (!air || this.riding) continue;
      // 바구니: 내려앉으면 탄다
      const bdx = b.x - bl.x, bdy = b.y - bl.y, bdz = b.z - bl.z;
      if (Math.hypot(bdx, bdy) < 1.7 && bdz > -0.6 && bdz < 2.6) { this.board(bl, b); continue; }
      // 풍선: 꼭대기에 떨어지면 통, 옆은 미끄러진다
      const cx = bl.x, cy = bl.y, cz = bl.z + 4.2 + 12;
      const ex = b.x - cx, ey = b.y - cy, ez = (b.z + 0.9 - cz) * 0.8;
      const d = Math.hypot(ex, ey, ez), R = 9.4;
      if (d < R && d > 0.01) {
        const nx = ex / d, ny = ey / d, nz = ez / d;
        b.x = cx + nx * R; b.y = cy + ny * R;
        if (nz > 0.45) {
          b.z = Math.max(b.z, cz + (nz * R) / 0.8 - 0.9);
          b.vz = 13;
          b.mode = 'air';
          b.parachute = false; b.freefall = false;
          sfx.jump(); sfx.pop();
          this.once('bounce', '🎈 열기구 꼭대기에서 통! 튀어 올랐다');
        } else {
          const into = b.vx * nx + b.vy * ny;
          if (into < 0) { b.vx -= into * nx * 1.6; b.vy -= into * ny * 1.6; }
        }
      }
      if (!bl.greeted && Math.hypot(b.x - bl.x, b.y - bl.y, b.z - bl.z) < 40) {
        bl.greeted = true;
        this.c.say(() => ({ x: bl.x, y: bl.y, z: bl.z + 2.3 }), 'Coucou ! Venez à bord !', 3, 7100);
      }
    }
  }

  private board(bl: Balloon, b: Body) {
    this.riding = bl;
    b.vx = b.vy = b.vz = 0;
    sfx.land();
    this.c.say(() => ({ x: bl.x, y: bl.y, z: bl.z + 2.3 }), 'Bienvenue à bord !', 3, 7100);
    this.once('board', '🎈 열기구에 올라탔다! 바람 따라 흘러간다 — 점프로 뛰어내린다');
  }

  /** 열기구 바구니 안 자리 */
  seat(): { x: number; y: number; z: number; facing: number } | null {
    const bl = this.riding;
    if (!bl) return null;
    return { x: bl.x, y: bl.y - 0.35, z: bl.z + 0.55, facing: 180 };
  }

  /** 바구니에서 뛰어내린다 */
  leave(b: Body) {
    const bl = this.riding;
    if (!bl) return;
    this.riding = null;
    b.x = bl.x; b.y = bl.y - 1.9; b.z = bl.z + 1.3;
    b.mode = 'air';
    b.vz = 5; b.vx = this.wind.x; b.vy = this.wind.y - 3;
    b.fallTopZ = b.z;
    sfx.jump();
    this.c.say(() => ({ x: bl.x, y: bl.y, z: bl.z + 2.3 }), 'Bon vol !', 2.5, 7100);
  }

  private stepFlocks(dt: number, b: Body, air: boolean, t: number) {
    const hs = Math.hypot(b.vx, b.vy);
    for (const f of this.flocks) {
      const d = Math.hypot(f.x - b.x, f.y - b.y, f.z - b.z);
      if (air && d < 32 && f.scatter <= 0) {
        if (b.mode === 'glide' && hs < 16 && !b.freefall) {
          if (f.escort <= 0) { this.once('escort', f.geese ? '🪿 기러기 떼가 곁에서 함께 난다' : '🐦 새 떼가 곁에서 함께 난다'); sfx.flutter(); }
          f.escort = 18;
        } else if (f.escort <= 0) { f.scatter = 3; sfx.flutter(); this.once('scatter', '🐦 새 떼가 놀라 흩어졌다 — 천천히 날아 다가가 보자'); }
      }
      let tx: number, ty: number, tz: number, sp = f.speed;
      if (f.escort > 0 && air) {
        f.escort -= dt;
        // 사람 옆 7 m, 조금 위에서 같은 방향으로
        const [fx, fy] = [Math.sin((b.facing * Math.PI) / 180), Math.cos((b.facing * Math.PI) / 180)];
        tx = b.x + fy * 7; ty = b.y - fx * 7; tz = b.z + 2;
        sp = Math.max(8, hs) + Math.hypot(tx - f.x, ty - f.y) * 0.8;
      } else {
        f.escort = 0;
        f.turn += rnd(-6, 6) * dt;
        f.turn = Math.max(-12, Math.min(12, f.turn));
        f.h = (f.h + f.turn * dt + 360) % 360;
        const hr = (f.h * Math.PI) / 180;
        tx = f.x + Math.sin(hr) * 50; ty = f.y + Math.cos(hr) * 50; tz = Math.max(60, Math.min(260, f.z + Math.sin(t * 0.1 + f.ph[0]) * 3));
        // 열기구·여객기는 피해 간다
        for (const bl of this.balloons) { const dx = f.x - bl.x, dy = f.y - bl.y, dz = f.z - bl.z - 14; const dd = Math.hypot(dx, dy, dz); if (dd < 45) { tx += (dx / dd) * 60; ty += (dy / dd) * 60; } }
        if (this.jet && Math.hypot(f.x - this.jet.x, f.y - this.jet.y, f.z - this.jet.z) < 200) tz -= 40;
        if (Math.hypot(f.x - b.x, f.y - b.y) > 2600) { const a = rnd(0, TAU), dd = rnd(600, 1500); f.x = b.x + Math.cos(a) * dd; f.y = b.y + Math.sin(a) * dd; f.z = rnd(70, 260); }
      }
      const dx = tx - f.x, dy = ty - f.y, dz = tz - f.z, L = Math.hypot(dx, dy) || 1;
      f.x += (dx / L) * sp * dt; f.y += (dy / L) * sp * dt; f.z += Math.max(-3, Math.min(3, dz)) * dt;
      const head = Math.atan2(dx, dy);
      if (f.scatter > 0) f.scatter -= dt;
      const spread = 1 + Math.max(0, f.scatter) * 3;
      for (let i = 0; i < f.n; i++) {
        const o = f.off[i];
        const c = Math.cos(-head), s = Math.sin(-head);
        const ox = (o.x * c - o.y * s) * spread + Math.sin(t * 0.7 + f.ph[i]) * 0.8, oy = (o.x * s + o.y * c) * spread + Math.cos(t * 0.6 + f.ph[i]) * 0.8;
        const px = f.x + ox, py = f.y + oy, pz = f.z + o.z * spread + Math.sin(t * 1.3 + f.ph[i]) * 0.5;
        const flap = Math.sin(t * (f.geese ? 5 : 11) + f.ph[i]) * 0.7;
        this.p.set(px, py, pz);
        this.q.setFromEuler(this.e.set(0, 0, -head));
        this.m.compose(this.p, this.q, this.s1);
        f.bodies.setMatrixAt(i, this.m);
        for (const [k, side] of [[0, 1], [1, -1]] as const) {
          this.q.setFromEuler(this.e.set(0, side * flap, -head, 'ZYX'));
          this.m.compose(this.p, this.q, this.p.clone().set(side, 1, 1));
          f.wings[k].setMatrixAt(i, this.m);
        }
      }
      f.bodies.instanceMatrix.needsUpdate = true;
      f.wings[0].instanceMatrix.needsUpdate = true;
      f.wings[1].instanceMatrix.needsUpdate = true;
    }
  }

  private stepJumpers(dt: number, b: Body, air: boolean, t: number) {
    for (let i = 0; i < this.jumpers.length; i++) {
      const j = this.jumpers[i];
      j.a += (dt * 10) / j.r;
      j.z -= j.sink * dt;
      const x = j.cx + Math.cos(j.a) * j.r, y = j.cy + Math.sin(j.a) * j.r;
      if (j.z - this.c.terrain(x, y) < 45 || Math.hypot(x - b.x, y - b.y) > 2600) {
        this.group.remove(j.g);
        this.jumpers[i] = this.makeJumper(b.x, b.y, true);
        continue;
      }
      j.g.position.set(x, y, j.z);
      j.g.rotation.z = -j.a; // 도는 방향으로
      if (j.five > 0) j.five -= dt;
      const wave = j.five > 0 || (j.waved && Math.sin(t * 2) > 0);
      j.arm.rotation.y = wave ? -2.5 + Math.sin(t * 12) * 0.4 : -0.4;
      if (!air) continue;
      const d = Math.hypot(x - b.x, y - b.y, j.z - b.z);
      if (d < 38 && !j.waved) {
        j.waved = true;
        this.c.say(() => ({ x: j.g.position.x, y: j.g.position.y, z: j.g.position.z + 1.9 }), ['Salut !', 'Coucou !', 'Ça plane ?', 'Bonjour là-haut !'][j.id % 4], 2.8, j.id);
      }
      if (d < 5 && j.five <= 0) {
        j.five = 4;
        b.stamina = b.maxStamina; b.exhausted = false;
        sfx.applause(2);
        this.c.say(() => ({ x: j.g.position.x, y: j.g.position.y, z: j.g.position.z + 1.9 }), 'Tope là ! ✋', 2, j.id);
        this.c.toast('🤚 공중 하이파이브! 기력이 가득 찼다');
      }
    }
  }

  private stepJet(dt: number, b: Body, air: boolean, night: number, t: number) {
    if (!this.jet) {
      this.jetT -= dt;
      if (this.jetT < 0) this.jet = this.makeJet(b.x, b.y);
      sfx.jet(0);
      return;
    }
    const j = this.jet, V = 95;
    j.x += j.dx * V * dt; j.y += j.dy * V * dt; j.left -= V * dt;
    j.g.position.set(j.x, j.y, j.z);
    j.g.rotation.z = -Math.atan2(j.dx, j.dy);
    j.lights.forEach((l, i) => { l.visible = night > 0.2 ? (i < 2 || Math.sin(t * 6) > 0.7) : i < 2 && night > 0; });
    const d = Math.hypot(j.x - b.x, j.y - b.y, j.z - b.z);
    sfx.jet(Math.max(0, 1 - d / 2600) ** 1.5);
    // 난기류: 비행기 뒤 30~400 m, 옆 45 m, 위아래 30 m 안
    if (air && !j.hit) {
      const rx = b.x - j.x, ry = b.y - j.y;
      const along = -(rx * j.dx + ry * j.dy), side = Math.abs(rx * j.dy - ry * j.dx);
      if (along > 0 && along < 400 && side < 45 && Math.abs(b.z - j.z) < 30) {
        j.hit = true;
        b.vx += (Math.random() - 0.5) * 30 + j.dx * 18; b.vy += (Math.random() - 0.5) * 30 + j.dy * 18; b.vz -= 12;
        b.facing = (b.facing + rnd(-120, 120) + 360) % 360;
        this.c.toast('✈️ 여객기 난기류에 휘말렸다!');
        sfx.hurt();
      }
    }
    if (j.left < 0) { this.group.remove(j.g); this.jet = null; this.jetT = rnd(50, 110); }
  }
}
