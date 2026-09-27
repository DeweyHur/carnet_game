// 상승(젤다 왕국의 눈물의 '울트라… 아니 상승'처럼): 머리 위에 지붕·천장·전망대 바닥이 있으면 그걸 뚫고
// 그 꼭대기로 솟아오른다. 머리 위가 비었어도 건물 벽에 바짝 붙어 서면 벽을 타고 지붕 위로.
// T 키 · ⬆️ 버튼. 에펠탑 아래 한가운데서 → 1층 전망대, 1층 한가운데서 → 꼭대기.
import * as THREE from 'three';
import type { Hero } from './hero';
import type { Frame as InputFrame } from './hero/input';
import { World, type Solid } from './hero/world';
import { dirOf } from './hero/geo';
import * as sfx from './sound';

export interface AscendTarget { kind: 'roof' | 'wall'; z1: number; ceil: number; x: number; y: number; tx: number; ty: number }

export interface AscendCtx {
  hero: Hero;
  hint(s: string): void;
  /** 처음 쓸 수 있게 됐을 때 리리가 알려 준다 */
  tip?(s: string): void;
  /** 처음 올라갔을 때 */
  used?(t: AscendTarget): void;
}

const HEAD = 1.9; // 머리 위 이만큼부터 천장
const REACH = 70; // 이만큼 위까지의 천장만 찾는다
const WALL = 1.4; // 벽까지 이만큼 가까워야
const COOL = 1.2;

interface Fx { obj: THREE.Object3D; t: number; life: number; step: (o: THREE.Object3D, k: number, dt: number) => void }

export class Ascend {
  readonly group = new THREE.Group();
  private readonly c: AscendCtx;
  private readonly btn: HTMLButtonElement;
  private readonly marker: THREE.Group;
  private readonly ring: THREE.Mesh;
  private readonly beam: THREE.Mesh;
  private target: AscendTarget | null = null;
  private scanT = 0;
  private cool = 0;
  private t = 0;
  private fx: Fx[] = [];
  private trailT = 0;
  private told = false;
  private usedOnce = false;

  constructor(c: AscendCtx) {
    this.c = c;
    this.group.name = 'ascend';
    try { this.told = !!localStorage.getItem('carnet-ascend-told'); this.usedOnce = !!localStorage.getItem('carnet-ascend-used'); } catch { /* 무시 */ }
    // 표시: 천장 아래에 도는 옥빛 고리 + 발에서 그 고리까지 가느다란 빛
    this.marker = new THREE.Group();
    const jade = new THREE.MeshBasicMaterial({ color: 0x7ff5d0, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.95, 40), jade);
    const inner = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.45, 6), jade.clone());
    this.ring.add(inner);
    for (let i = 0; i < 4; i++) {
      const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.4), jade.clone());
      const a = (i / 4) * Math.PI * 2;
      tick.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0);
      tick.rotation.z = a + Math.PI / 2;
      this.ring.add(tick);
    }
    this.marker.add(this.ring);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x9ff3e0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5), beamMat);
    this.marker.add(this.beam);
    this.marker.visible = false;
    this.group.add(this.marker);
    // 버튼(터치에선 크게, 키보드에선 T 표시)
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.className = 'asc-btn';
    this.btn.title = '상승 — 머리 위 지붕을 뚫고, 또는 벽을 타고 꼭대기로 (T)';
    this.btn.innerHTML = '<em>⤒</em><kbd>T</kbd>';
    this.btn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); c.hero.input.press('ascend'); });
    document.body.appendChild(this.btn);
  }

  private get W(): World { return this.c.hero.sceneWorld ?? this.c.hero.world; }
  get available() { return !!this.target; }

  /** (x,y)에 겹쳐 쌓인 고체를 base ≤ top+1로 이어서 가장 높은 꼭대기를 찾는다 */
  private stackTop(x: number, y: number, from: Solid): number {
    const W = this.W;
    const list = W.near(x, y, 0.1).filter((s) => !s.water && World.contains(s, x, y));
    let top = from.top;
    for (let more = true; more;) {
      more = false;
      for (const s of list) if (s.top > top && s.base <= top + 1) { top = s.top; more = true; }
    }
    return top;
  }

  /** 둘레 0.5 m 네 곳도 같은 높이에 설 수 있는가(가장자리에 걸쳐 떨어지지 않게) */
  private roomy(x: number, y: number, z: number) {
    const W = this.W;
    for (const [dx, dy] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) if (W.ground(x + dx, y + dy, z + 0.2, 0.4) < z - 0.3) return false;
    return true;
  }

  /** 지금 서 있는 곳에서 상승할 수 있으면 그 목표 */
  scan(): AscendTarget | null {
    const b = this.c.hero.body;
    const W = this.W;
    // 1) 머리 위 천장
    let ceil: Solid | null = null;
    for (const s of W.near(b.x, b.y, 0.1)) {
      if (s.water || s.base <= b.z + HEAD || s.base > b.z + REACH) continue;
      if (!World.contains(s, b.x, b.y)) continue;
      if (!ceil || s.base < ceil.base) ceil = s;
    }
    if (ceil) {
      const z1 = this.stackTop(b.x, b.y, ceil);
      return { kind: 'roof', z1, ceil: ceil.base, x: b.x, y: b.y, tx: b.x, ty: b.y };
    }
    // 2) 앞의 건물 벽
    const [fx, fy] = dirOf(b.facing);
    for (let d = 0.5; d <= WALL + 0.01; d += 0.3) {
      const px = b.x + fx * d, py = b.y + fy * d;
      for (const s of W.near(px, py, 0.1)) {
        if (s.water || s.kind === 'prop' || s.top < b.z + 3 || s.base > b.z + 1) continue;
        if (!World.contains(s, px, py)) continue;
        // 내려앉을 곳: 지붕 안쪽으로 들어가며, 발밑이 그 꼭대기이고 몸이 어디에도 박히지 않는 첫 자리(깊은 쪽부터)
        let land: [number, number, number] | null = null;
        for (const k of [3, 2.4, 1.8, 1.3, 0.8, 0.4]) {
          const tx = px + fx * k, ty = py + fy * k;
          if (!World.contains(s, tx, ty)) continue;
          const z1 = this.stackTop(tx, ty, s);
          const g = W.ground(tx, ty, z1 + 0.2, 0.4);
          if (Math.abs(g - z1) > 0.3 || W.solidAt(tx, ty, z1 + 1)) continue;
          if (!this.roomy(tx, ty, z1)) continue;
          land = [tx, ty, z1];
          break;
        }
        if (!land) continue;
        const [tx, ty, z1] = land;
        if (z1 - b.z > REACH * 3) return null;
        // 벽에서 조금 떨어진 자리(몸이 벽에 박히지 않게)
        const x0 = b.x + fx * Math.max(0, d - 0.55), y0 = b.y + fy * Math.max(0, d - 0.55);
        return { kind: 'wall', z1, ceil: z1, x: x0, y: y0, tx, ty };
      }
    }
    return null;
  }

  update(dt: number, f: InputFrame | null, live: boolean) {
    this.t += dt;
    this.cool = Math.max(0, this.cool - dt);
    const hero = this.c.hero;
    const b = hero.body;
    this.btn.classList.toggle('on', live);
    for (const e of hero.events) {
      if (e === 'ascendStart') { sfx.ascendCharge(); hero.cam.tiltTo(-10, 0.9); this.shock(b.x, b.y, b.z + 0.05, 0.4, 2.2, 0.5); }
      if (e === 'ascendRise') { sfx.ascendRise(); this.shock(b.x, b.y, b.z + 0.1, 0.6, 4, 0.6); }
      if (e === 'ascendEnd') {
        sfx.ascendPop();
        hero.cam.tiltTo(26, 2.4); // 꼭대기에 서면 내려다본다
        this.shock(b.x, b.y, b.z + 0.1, 0.8, 6, 0.8);
        this.sparks(b.x, b.y, b.z + 0.4, 26);
        if (!this.usedOnce) { this.usedOnce = true; try { localStorage.setItem('carnet-ascend-used', '1'); } catch { /* 무시 */ } }
      }
    }
    if (b.mode === 'ascend') {
      this.marker.visible = false;
      this.target = null;
      if ((this.trailT -= dt) < 0) { this.trailT = 0.03; this.streak(b.x, b.y, b.z); }
    } else if (live) {
      if ((this.scanT -= dt) < 0) {
        this.scanT = 0.12;
        const standing = b.mode === 'ground' || b.mode === 'sit' || b.mode === 'act' || b.mode === 'climb';
        this.target = standing ? this.scan() : null;
        if (this.target && !this.told) {
          this.told = true;
          try { localStorage.setItem('carnet-ascend-told', '1'); } catch { /* 무시 */ }
          const touch = document.body.classList.contains('touch-play');
          this.c.tip?.(this.target.kind === 'roof' ? `머리 위에 천장이 있어! ${touch ? '⤒ 버튼' : 'T'}를 누르면 뚫고 꼭대기로 솟아오를 수 있어!` : `벽에 바짝 붙었네! ${touch ? '⤒ 버튼' : 'T'}를 누르면 벽을 타고 지붕 위로 단숨에 올라가!`);
        }
      }
      this.paintMarker(b.z);
      if (f?.ascend) {
        f.ascend = false;
        this.fire();
      }
    } else {
      this.marker.visible = false;
    }
    this.btn.classList.toggle('ready', live && !!this.target && this.cool <= 0);
    this.stepFx(dt);
  }

  private fire() {
    const b = this.c.hero.body;
    if (b.mode !== 'ground' && b.mode !== 'sit' && b.mode !== 'act' && b.mode !== 'climb') return; // 공중·상승 중엔 안 된다
    const T = this.target ?? this.scan();
    if (!T || this.cool > 0) {
      if (!T) {
        sfx.ascendNo();
        this.c.hint('⤒ 상승: 머리 위에 지붕·천장이 있거나, 건물 벽에 바짝 붙어 있을 때만 쓸 수 있다');
      }
      return;
    }
    const [x0, y0] = [b.x, b.y];
    if (T.kind === 'wall') { b.x = T.x; b.y = T.y; }
    if (!b.startAscend(T.z1, T.tx, T.ty)) { b.x = x0; b.y = y0; return; }
    {
      this.cool = COOL;
      this.target = null;
      this.c.used?.(T);
    }
  }

  private paintMarker(z: number) {
    const T = this.target;
    this.marker.visible = !!T;
    if (!T) return;
    const pulse = 1 + Math.sin(this.t * 5) * 0.08;
    if (T.kind === 'roof') {
      this.marker.position.set(T.x, T.y, z);
      this.ring.position.set(0, 0, T.ceil - z - 0.08);
      this.ring.rotation.set(0, 0, this.t * 1.5);
      this.ring.scale.setScalar(pulse);
      this.beam.visible = true;
      this.beam.scale.set(1, 1, Math.max(0.1, T.ceil - z - 0.1));
    } else {
      // 벽: 지붕 가장자리 위에 떠서 돈다
      this.marker.position.set(T.tx, T.ty, T.z1 + 0.6 + Math.sin(this.t * 3) * 0.15);
      this.ring.position.set(0, 0, 0);
      this.ring.rotation.set(0, 0, this.t * 1.5);
      this.ring.scale.setScalar(pulse * 0.8);
      this.beam.visible = false;
    }
  }

  // ───────── 효과 ─────────
  /** 퍼져 나가는 옥빛 고리 */
  private shock(x: number, y: number, z: number, r0: number, r1: number, life: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: 0xaaffe6, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    this.add(m, life, (o, k) => { o.scale.setScalar(r0 + (r1 - r0) * (1 - (1 - k) ** 3)); ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k); });
  }
  /** 솟아오르는 동안 몸 뒤에 남는 빛줄기 */
  private streak(x: number, y: number, z: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.6), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0x9ff3e0 : 0xffffff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 0.5;
    m.position.set(x + Math.cos(a) * r, y + Math.sin(a) * r, z + Math.random() * 1.6);
    this.add(m, 0.45, (o, k) => { ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - k); o.scale.set(1, 1, 1 - k * 0.7); });
  }
  /** 꼭대기로 튀어나올 때 흩어지는 불티 */
  private sparks(x: number, y: number, z: number, n: number) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshBasicMaterial({ color: i % 3 ? 0x9ff3e0 : 0xfff2b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.set(x, y, z);
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      const v = new THREE.Vector3(Math.cos(a) * sp, Math.sin(a) * sp, 3 + Math.random() * 5);
      this.add(m, 0.9 + Math.random() * 0.4, (o, k, dt) => {
        v.z -= 9 * dt;
        o.position.addScaledVector(v, dt);
        o.rotation.x += dt * 8;
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 1 - k;
      });
    }
  }
  private add(obj: THREE.Object3D, life: number, step: Fx['step']) {
    this.group.add(obj);
    this.fx.push({ obj, t: 0, life, step });
  }
  private stepFx(dt: number) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const e = this.fx[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.life);
      e.step(e.obj, k, dt);
      if (k >= 1) {
        this.group.remove(e.obj);
        const m = e.obj as THREE.Mesh;
        m.geometry?.dispose();
        (m.material as THREE.Material)?.dispose();
        this.fx.splice(i, 1);
      }
    }
  }
}
