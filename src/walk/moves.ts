// 캐릭터마다 다른 싸움: 보통 공격(모양 · 닿는 곳 · 빠르기) · 원소 스킬(E) · 원소 폭발(Q).
// 여행자는 combat.ts의 우산 검술 그대로, 나머지 일곱은 여기서. combat.ts가 좁은 창(MoveApi)만 열어 준다.
//   💧 쥘리 — 물채찍(길고 좁게) · 물보라(밀어내며 회복) · 밀물(퍼지는 파도 + 회복)
//   ⚙️ 귀스타브 — 망치(느리고 넓고 묵직) · 리벳 방패(받는 피해 −60% + 발구르기) · 철의 귀부인(하늘에서 쇠기둥)
//   🔥 마르셀 — 총검 찌르기(빠르고 좁게) · 불씨 돌진(꿰뚫고 불태움) · 꺼지지 않는 불꽃(불의 기운 8초)
//   🖼 아멜리 — 액자 던지기(멀리) · 액자 번쩍(부채꼴 기절) · 모나리자의 미소(둘레 모두 기절)
//   🔔 캉탱 — 종 울리기(둘레 작은 고리) · 작은 종(끌어당기며 세 번 울림) · 에마뉘엘의 울림(큰 충격파 셋)
//   🎨 엘로디 — 붓(아주 빠르게 넓게, 물감 자국) · 물감 고리(치명타 +30% 6초) · 파리의 색(물감 폭탄 여섯)
//   🌙 륀 — 달그림자 베기(맞힐 때마다 적에게 순간 이동) · 달그림자(앞으로 순간 이동, 표식) · 별똥비(별이 쏟아진다)
import * as THREE from 'three';
import type { Hero } from './hero';
import type { World } from './hero/world';
import type { CharId } from './party';
import * as sfx from './sound';

export type How = 'hit' | 'heavy' | 'skill' | 'burst';
export interface FoeLike { x: number; y: number; z: number; lift: number; state: string; kind: string; lv: number }
export interface MoveApi {
  hero: Hero;
  W(): World;
  group: THREE.Group;
  foes(): FoeLike[];
  big(f: FoeLike): boolean;
  hit(f: FoeLike, raw: number, how: How): void;
  atk(): number;
  ring(x: number, y: number, z: number, color: number, r: number): void;
  burst(x: number, y: number, z: number, color: number): void;
  float(x: number, y: number, z: number, text: string, cls: string): void;
  fx(obj: THREE.Object3D, life: number, step?: (o: THREE.Object3D, t: number, dt: number) => void): void;
  shake(a: number): void;
  stun(f: FoeLike, secs: number): void;
  push(f: FoeLike, dx: number, dy: number, v: number): void;
  pull(f: FoeLike, x: number, y: number, k: number): void;
  heal(frac: number): void;
  energy(n: number): void;
  iframes(s: number): void;
}

/** 공격 빠르기(동작 시간 ÷) */
export const SPEED: Record<CharId, number> = { traveler: 1, julie: 1.1, gustave: 0.8, marcel: 1.3, amelie: 1.05, quentin: 0.95, elodie: 1.4, lune: 1.2 };

const TAU = Math.PI * 2;
const dir = (deg: number): [number, number] => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
const angDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const bearing = (dx: number, dy: number) => ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
const basic = (color: number, opacity = 0.8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

export class Moves {
  private readonly m: MoveApi;
  private timed: { t: number; fn: () => void }[] = [];
  private shots: { x: number; y: number; z: number; dx: number; dy: number; left: number; dmg: number; obj: THREE.Object3D; how: How }[] = [];
  /** 버프: 리벳 방패(받는 피해) · 물감(치명타) · 불꽃 기운 · 달 표식 */
  shieldT = 0; paintT = 0; fireT = 0; marks = 0;
  private fireTick = 0;
  private bell: { x: number; y: number; z: number; t: number; rings: number; obj: THREE.Object3D } | null = null;
  private burns = new Map<FoeLike, { t: number; tick: number; dps: number }>();

  constructor(m: MoveApi) { this.m = m; }

  private get b() { return this.m.hero.body; }
  private after(t: number, fn: () => void) { this.timed.push({ t, fn }); }
  private alive() { return this.m.foes().filter((f) => f.state !== 'dead'); }
  private near(f: FoeLike, zr = 2.4) { return Math.abs(f.z + f.lift - this.b.z) < (this.m.big(f) ? 4 : zr); }
  private nearest(max: number): FoeLike | null {
    let best: FoeLike | null = null, bd = max;
    for (const f of this.alive()) { const d = Math.hypot(f.x - this.b.x, f.y - this.b.y); if (d < bd && this.near(f, 5)) { bd = d; best = f; } }
    return best;
  }
  /** 앞 부채꼴 */
  private cone(reach: number, deg: number, mul: number, how: How, then?: (f: FoeLike) => void) {
    const b = this.b; let n = 0;
    for (const f of this.alive()) {
      const dx = f.x - b.x, dy = f.y - b.y, d = Math.hypot(dx, dy), size = this.m.big(f) ? 2.4 : 0.5;
      if (d - size > reach || !this.near(f)) continue;
      if (d > size && Math.abs(angDiff(b.facing, bearing(dx, dy))) > deg / 2) continue;
      this.m.hit(f, this.m.atk() * mul, how); then?.(f); n++;
    }
    return n;
  }
  private circle(x: number, y: number, r: number, mul: number, how: How, then?: (f: FoeLike) => void) {
    let n = 0;
    for (const f of this.alive()) {
      if (Math.hypot(f.x - x, f.y - y) - (this.m.big(f) ? 2.4 : 0.4) > r || !this.near(f, 4)) continue;
      this.m.hit(f, this.m.atk() * mul, how); then?.(f); n++;
    }
    return n;
  }
  private line(x0: number, y0: number, dx: number, dy: number, len: number, w: number, mul: number, how: How, then?: (f: FoeLike) => void) {
    let n = 0;
    for (const f of this.alive()) {
      const rx = f.x - x0, ry = f.y - y0, along = rx * dx + ry * dy, side = Math.abs(rx * dy - ry * dx), size = this.m.big(f) ? 2.4 : 0.5;
      if (along < -0.8 || along > len + size || side > w + size || !this.near(f)) continue;
      this.m.hit(f, this.m.atk() * mul, how); then?.(f); n++;
    }
    return n;
  }
  /** 모양: 호(부채꼴 테두리) · 쭉 뻗는 빛 · 바닥 자국 */
  private arc(r0: number, r1: number, deg: number, color: number, life = 0.2, tilt = 0.15) {
    const b = this.b, a0 = ((90 - b.facing) * Math.PI) / 180, span = (deg * Math.PI) / 180;
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 28, 1, a0 - span / 2, span), basic(color, 0.85));
    m.position.set(b.x, b.y, b.z + 1.05); m.rotation.x = tilt;
    this.m.group.add(m);
    this.m.fx(m, life, (o, t) => { o.scale.setScalar(1 + t * 1.5); ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - t / life); });
  }
  private beam(x: number, y: number, z: number, facing: number, len: number, w: number, color: number, life = 0.22) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.12).translate(0, len / 2, 0), basic(color, 0.8));
    m.position.set(x, y, z); m.rotation.z = (-facing * Math.PI) / 180;
    this.m.group.add(m);
    this.m.fx(m, life, (o, t) => { o.scale.x = 1 - t / life; ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t / life); });
  }
  private splat(x: number, y: number, color: number, r: number, life = 1.4) {
    const W = this.m.W();
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }));
    m.position.set(x, y, W.ground(x, y, this.b.z + 1, 3) + 0.05);
    this.m.group.add(m);
    this.m.fx(m, life, (o, t) => { ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t / life); });
  }
  private pillar(x: number, y: number, color: number, h: number, life: number, r = 0.9) {
    const z = this.m.W().ground(x, y, this.b.z + 3, 8);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, h, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, h / 2), basic(color, 0.6));
    m.position.set(x, y, z);
    this.m.group.add(m);
    this.m.fx(m, life, (o, t) => { ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t / life); o.scale.set(1 + t, 1 + t, 1); });
  }
  /** 몸을 옮긴다(벽은 넘지 않는다) */
  private dash(tx: number, ty: number) {
    const b = this.b, W = this.m.W();
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const p = { x: b.x + (tx - b.x) / (steps - i), y: b.y + (ty - b.y) / (steps - i) };
      W.collide(p, b.z, 0.3, 1.7, 0.5);
      b.x = p.x; b.y = p.y;
    }
    b.z = W.ground(b.x, b.y, b.z + 0.6, 1.2);
  }

  // ───────── 보통 공격(1~4타) ─────────
  /** 여행자가 아니면 여기서 친다(맞힌 수를 돌려준다, 여행자는 null) */
  normal(id: CharId, kind: 'atk1' | 'atk2' | 'atk3' | 'atk4'): number | null {
    const b = this.b, [fx, fy] = dir(b.facing), last = kind === 'atk4', k = kind === 'atk1' ? 0 : kind === 'atk2' ? 1 : kind === 'atk3' ? 2 : 3;
    switch (id) {
      case 'julie': {
        sfx.whip();
        if (last) { this.beam(b.x, b.y, b.z + 0.7, b.facing, 7.5, 1.4, 0x6fc3ff, 0.3); sfx.splash(); return this.line(b.x, b.y, fx, fy, 7.5, 1.1, 2.2, 'heavy', (f) => this.m.push(f, fx, fy, 6)); }
        this.arc(3.2, 4.6, 55, 0x8fd3ff, 0.18, k === 1 ? -0.3 : 0.3);
        return this.cone(4.6, 45, [0.85, 0.95, 1.4][k], k === 2 ? 'heavy' : 'hit');
      }
      case 'gustave': {
        sfx.whoosh(0);
        const r = last ? 4.6 : k === 2 ? 3.6 : 0;
        if (r) {
          // 3·4타: 땅을 내리친다(둘레 고리)
          const [x, y] = [b.x + fx * 1.4, b.y + fy * 1.4];
          this.m.ring(x, y, b.z + 0.2, 0xc9ccd0, r); sfx.land(); this.m.shake(last ? 0.3 : 0.18);
          return this.circle(x, y, r, last ? 3.0 : 2.0, 'heavy', (f) => this.m.push(f, f.x - x, f.y - y, last ? 9 : 6));
        }
        this.arc(0.6, 3, 140, 0xdde3ea, 0.22, k ? -0.2 : 0.2);
        return this.cone(3, 140, 1.35, 'heavy');
      }
      case 'marcel': {
        sfx.whoosh(2);
        if (last) {
          const [x, y] = [b.x + fx * 3.4, b.y + fy * 3.4];
          this.m.ring(x, y, b.z + 0.8, 0xff8a4a, 2.6); this.m.burst(x, y, b.z + 1, 0xffa04a); sfx.fire(); this.m.shake(0.2);
          return this.circle(x, y, 2.6, 2.6, 'heavy', (f) => this.burn(f, 3, 0.25));
        }
        this.beam(b.x + fx * 0.6, b.y + fy * 0.6, b.z + 1.1, b.facing, 3.2, 0.18, 0xffb070, 0.12);
        return this.line(b.x, b.y, fx, fy, 3.7, 0.6, [0.8, 0.85, 1.1][k], 'hit');
      }
      case 'amelie': {
        sfx.throwFrame();
        if (last) { for (const off of [-18, 0, 18]) this.throwFrame(b.facing + off, 1.5); return 1; }
        this.throwFrame(b.facing, [0.95, 1.0, 1.3][k]);
        return 1; // 맞았는지는 날아가서 안다
      }
      case 'quentin': {
        sfx.bell(k);
        const r = last ? 4.8 : 2.7;
        this.m.ring(b.x, b.y, b.z + 0.9, 0xd8b0ff, r);
        if (last) this.m.shake(0.2);
        return this.circle(b.x, b.y, r, last ? 1.9 : 0.8, last ? 'heavy' : 'hit', last ? (f) => this.m.stun(f, 1.6) : undefined);
      }
      case 'elodie': {
        sfx.whoosh(1);
        const reach = last ? 3.8 : 2.8, deg = last ? 170 : 115;
        this.arc(0.8, reach, deg, [0xff6fb0, 0x6fc3ff, 0xffd166, 0x9be37a][k], 0.2, k % 2 ? -0.35 : 0.35);
        return this.cone(reach, deg, last ? 2.0 : 0.75, last ? 'heavy' : 'hit', (f: FoeLike) => this.splat(f.x, f.y, [0xff6fb0, 0x6fc3ff, 0xffd166, 0x9be37a][k], 0.7));
      }
      case 'lune': {
        // 맞힐 때마다 가장 가까운 적 곁으로 스르르(8 m 안)
        const t = this.nearest(8);
        if (t) { const d = Math.hypot(t.x - b.x, t.y - b.y); if (d > 1.6) { const k2 = (d - 1.3) / d; this.dash(b.x + (t.x - b.x) * k2, b.y + (t.y - b.y) * k2); b.facing = bearing(t.x - b.x, t.y - b.y); sfx.blink(); } }
        if (last && t) {
          // 적 뒤로 돌아가 한 바퀴
          const [ux, uy] = dir(bearing(t.x - b.x, t.y - b.y));
          this.dash(t.x + ux * 1.4, t.y + uy * 1.4); b.facing = bearing(t.x - b.x, t.y - b.y);
          this.m.ring(b.x, b.y, b.z + 1, 0xb79bff, 3); this.m.iframes(0.3);
          return this.circle(b.x, b.y, 3, 2.3, 'heavy');
        }
        this.arc(0.5, 2.6, 100, 0xb79bff, 0.16, k === 1 ? -0.3 : 0.3);
        return this.cone(2.6, 100, [0.85, 0.9, 1.25][k], k === 2 ? 'heavy' : 'hit');
      }
      default: return null;
    }
  }

  private throwFrame(facing: number, mul: number) {
    const b = this.b, [dx, dy] = dir(facing);
    const g = new THREE.Group();
    const gold = new THREE.MeshBasicMaterial({ color: 0xe6c35a });
    for (const [w, h, x, y] of [[0.5, 0.06, 0, 0.2], [0.5, 0.06, 0, -0.2], [0.06, 0.4, 0.22, 0], [0.06, 0.4, -0.22, 0]] as const) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, h), gold); m.position.set(x, 0, y); g.add(m); }
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.34).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3f6e8f, side: THREE.DoubleSide }));
    g.add(pic);
    g.position.set(b.x + dx * 0.6, b.y + dy * 0.6, b.z + 1.2);
    this.m.group.add(g);
    this.shots.push({ x: g.position.x, y: g.position.y, z: g.position.z, dx, dy, left: 14, dmg: mul, obj: g, how: mul > 1.2 ? 'heavy' : 'hit' });
  }
  private burn(f: FoeLike, secs: number, dps: number) { this.burns.set(f, { t: secs, tick: 0.5, dps }); }

  // ───────── 원소 스킬(E) ─────────
  skill(id: CharId): boolean {
    const b = this.b, [fx, fy] = dir(b.facing);
    switch (id) {
      case 'julie':
        sfx.splash(); this.m.ring(b.x, b.y, b.z + 0.4, 0x6fc3ff, 5.2); this.m.burst(b.x, b.y, b.z + 1, 0x8fd3ff);
        this.m.energy(this.circle(b.x, b.y, 5.2, 1.7, 'skill', (f) => this.m.push(f, f.x - b.x, f.y - b.y, 10)) * 5 + 4);
        return true;
      case 'gustave':
        sfx.shield(); this.shieldT = 6; this.m.ring(b.x, b.y, b.z + 0.2, 0xc9ccd0, 3.6); this.m.shake(0.2);
        this.m.float(b.x, b.y, b.z + 2.6, '🛡 리벳 방패', 'wind');
        this.m.energy(this.circle(b.x, b.y, 3.6, 1.8, 'skill') * 5 + 4);
        return true;
      case 'marcel': {
        // 앞으로 7 m 내달리며 꿰뚫고 불태운다
        const x0 = b.x, y0 = b.y;
        this.dash(b.x + fx * 7, b.y + fy * 7); this.m.iframes(0.4); sfx.fire();
        const len = Math.hypot(b.x - x0, b.y - y0);
        this.beam(x0, y0, b.z + 0.8, b.facing, len, 0.9, 0xff8a4a, 0.4);
        this.m.energy(this.line(x0, y0, fx, fy, len, 1.2, 2.2, 'skill', (f) => this.burn(f, 4, 0.4)) * 5 + 4);
        return true;
      }
      case 'amelie':
        sfx.flash(); this.arc(0.5, 9, 90, 0xffe28a, 0.35, 0);
        this.m.energy(this.cone(9, 90, 1.4, 'skill', (f: FoeLike) => this.m.stun(f, 2.2)) * 5 + 4);
        return true;
      case 'quentin': {
        const x = b.x + fx * 4, y = b.y + fy * 4, z = this.m.W().ground(x, y, b.z + 2, 4);
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.6, 0.8, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.9), new THREE.MeshToonMaterial({ color: 0xd9b44a, side: THREE.DoubleSide })));
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8).translate(0, 0, 1.3), new THREE.MeshToonMaterial({ color: 0xd9b44a })));
        g.position.set(x, y, z);
        this.m.group.add(g);
        if (this.bell) this.m.group.remove(this.bell.obj);
        this.bell = { x, y, z, t: 0, rings: 0, obj: g };
        sfx.bell(3);
        return true;
      }
      case 'elodie':
        sfx.splash(); this.paintT = 6;
        for (const c of [0xff6fb0, 0x6fc3ff, 0xffd166]) this.m.ring(b.x, b.y, b.z + 0.3, c, 4.2);
        this.splat(b.x, b.y, 0xff6fb0, 4, 2);
        this.m.float(b.x, b.y, b.z + 2.6, '🎨 치명타 +30%', 'crit');
        this.m.energy(this.circle(b.x, b.y, 4.2, 1.5, 'skill') * 5 + 4);
        return true;
      case 'lune': {
        const x0 = b.x, y0 = b.y;
        this.dash(b.x + fx * 6, b.y + fy * 6); this.m.iframes(0.6); sfx.blink();
        const len = Math.hypot(b.x - x0, b.y - y0);
        this.beam(x0, y0, b.z + 1, b.facing, len, 0.5, 0xb79bff, 0.45);
        this.marks = 3;
        this.m.float(b.x, b.y, b.z + 2.6, '🌙 표식 ×3', 'wind');
        this.m.energy(this.line(x0, y0, fx, fy, len, 1, 2.0, 'skill') * 5 + 4);
        return true;
      }
      default: return false;
    }
  }

  // ───────── 원소 폭발(Q) ─────────
  burst(id: CharId): boolean {
    const b = this.b, [fx, fy] = dir(b.facing);
    switch (id) {
      case 'julie':
        this.m.heal(0.3); this.m.float(b.x, b.y, b.z + 2.6, '💧 +30%', 'heal');
        for (let i = 0; i < 3; i++) this.after(i * 0.25, () => { this.m.ring(b.x, b.y, b.z + 0.3, 0x6fc3ff, 4 + i * 2.5); sfx.splash(); this.circle(b.x, b.y, 4 + i * 2.5, 1.2, 'burst', (f) => this.m.push(f, f.x - b.x, f.y - b.y, 7)); });
        return true;
      case 'gustave': {
        const t = this.nearest(12);
        const [x, y] = t ? [t.x, t.y] : [b.x + fx * 6, b.y + fy * 6];
        this.m.ring(x, y, b.z + 0.1, 0xff5a4a, 5);
        this.after(0.6, () => { this.pillar(x, y, 0xc9ccd0, 40, 0.6, 1.6); this.m.ring(x, y, b.z + 0.3, 0xdde3ea, 5.5); sfx.kill(true); this.m.shake(0.45); this.circle(x, y, 5, 6, 'burst', (f) => this.m.stun(f, 1.5)); });
        return true;
      }
      case 'marcel':
        this.fireT = 8; this.fireTick = 0; sfx.fire();
        this.m.float(b.x, b.y, b.z + 2.6, '🔥 공격력 +20%', 'crit');
        return true;
      case 'amelie':
        sfx.flash(); this.m.ring(b.x, b.y, b.z + 1, 0xffe28a, 14); this.m.shake(0.25);
        this.circle(b.x, b.y, 14, 2.2, 'burst', (f) => this.m.stun(f, 3.5));
        return true;
      case 'quentin':
        for (let i = 0; i < 3; i++) this.after(i * 0.6, () => { sfx.bell(4); this.m.ring(b.x, b.y, b.z + 0.5, 0xd8b0ff, 6.5); this.m.shake(0.25); this.circle(b.x, b.y, 6.5, 2, 'burst', (f) => this.m.push(f, f.x - b.x, f.y - b.y, 5)); });
        return true;
      case 'elodie': {
        const ts = this.alive().filter((f) => Math.hypot(f.x - b.x, f.y - b.y) < 14).slice(0, 6);
        for (let i = 0; i < 6; i++) this.after(0.1 + i * 0.3, () => {
          const f = ts[i % Math.max(1, ts.length)];
          const [x, y] = f ? [f.x, f.y] : [b.x + fx * (3 + i), b.y + fy * (3 + i)];
          const c = [0xff6fb0, 0x6fc3ff, 0xffd166, 0x9be37a][i % 4];
          this.splat(x, y, c, 2.5); this.m.burst(x, y, b.z + 1, c); sfx.splash();
          this.circle(x, y, 2.5, 1.8, 'burst');
        });
        return true;
      }
      case 'lune':
        for (let i = 0; i < 10; i++) this.after(0.2 + i * 0.38, () => {
          const fs = this.alive().filter((f) => Math.hypot(f.x - this.b.x, f.y - this.b.y) < 12);
          const f = fs[Math.floor(Math.random() * fs.length)];
          const [x, y] = f ? [f.x, f.y] : [this.b.x + (Math.random() - 0.5) * 10, this.b.y + (Math.random() - 0.5) * 10];
          this.pillar(x, y, 0xb79bff, 30, 0.35, 0.5); this.m.ring(x, y, this.b.z + 0.2, 0xe9e4ff, 2); sfx.meteor();
          this.circle(x, y, 2, 1.4, 'burst');
        });
        return true;
      default: return false;
    }
  }

  // ───────── 매 프레임 ─────────
  update(dt: number) {
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.paintT = Math.max(0, this.paintT - dt);
    for (const e of this.timed.slice()) { e.t -= dt; if (e.t <= 0) { this.timed.splice(this.timed.indexOf(e), 1); e.fn(); } }
    // 던진 액자
    for (const s of this.shots.slice()) {
      const step = 22 * dt;
      s.x += s.dx * step; s.y += s.dy * step; s.left -= step;
      s.obj.position.set(s.x, s.y, s.z); s.obj.rotation.z += dt * 14;
      const f = this.alive().find((q) => Math.hypot(q.x - s.x, q.y - s.y) < (this.m.big(q) ? 2.6 : 1) && Math.abs(q.z + q.lift + 0.8 - s.z) < (this.m.big(q) ? 4 : 1.8));
      if (f || s.left <= 0) {
        if (f) { this.m.hit(f, this.m.atk() * s.dmg, s.how); this.m.energy(2); }
        this.m.group.remove(s.obj); this.shots.splice(this.shots.indexOf(s), 1);
      }
    }
    // 작은 종: 끌어당기고 세 번 울린다
    if (this.bell) {
      const B = this.bell; B.t += dt;
      B.obj.rotation.x = Math.sin(B.t * 12) * 0.3;
      for (const f of this.alive()) if (!this.m.big(f) && Math.hypot(f.x - B.x, f.y - B.y) < 7) this.m.pull(f, B.x, B.y, dt * 2);
      if (B.t > 0.5 + B.rings * 0.9 && B.rings < 3) { B.rings++; sfx.bell(B.rings); this.m.ring(B.x, B.y, B.z + 1, 0xd8b0ff, 3.2); this.m.energy(this.circle(B.x, B.y, 3.2, 1.0, 'skill') * 2); }
      if (B.t > 3.2) { this.m.group.remove(B.obj); this.bell = null; }
    }
    // 불꽃 기운
    if (this.fireT > 0) {
      this.fireT -= dt; this.fireTick -= dt;
      if (this.fireTick <= 0) { this.fireTick = 0.5; const b = this.b; this.m.ring(b.x, b.y, b.z + 0.4, 0xff8a4a, 3.5); this.circle(b.x, b.y, 3.5, 0.8, 'burst'); }
    }
    // 불타는 적
    for (const [f, s] of this.burns) {
      if (f.state === 'dead') { this.burns.delete(f); continue; }
      s.t -= dt; s.tick -= dt;
      if (s.tick <= 0) { s.tick = 0.5; this.m.hit(f, this.m.atk() * s.dps, 'burst'); }
      if (s.t <= 0) this.burns.delete(f);
    }
  }
  /** 바뀌거나 비울 때 */
  clear() {
    for (const s of this.shots) this.m.group.remove(s.obj);
    this.shots = []; this.timed = []; this.burns.clear();
    if (this.bell) { this.m.group.remove(this.bell.obj); this.bell = null; }
    this.fireT = 0;
  }
}
void TAU;
