// 싸움(원신처럼): 파리 우산으로 세 번 베기(마우스 톡) · 원소 스킬 "바람 소용돌이"(E, 6초) · 원소 폭발 "센 강의 회오리"(Q, 기력 60) ·
// 내려찍기(공중에서 공격) · 구르기(V)로 피하기(무적). 적은 사람이 아니라 파리의 요괴들 —
//   🌫 센 강 안개 슬라임 · 🐀 하수도 쥐 기사 · 🗿 돌 가고일(밤에 많다) · 👑 노트르담의 큰 가고일(하루 한 번 나오는 우두머리)
// 적 무리(야영지)는 보물상자를 지킨다 — 모두 물리치면 상자의 봉인이 풀린다. 쓰러지면 가장 가까운 순간이동 포인트에서 다시 일어난다.
import * as THREE from 'three';
import type { Hero } from './hero';
import type { Frame as InputFrame } from './hero/input';
import type { CombatAct } from './hero/body';
import type { Progress } from './progress';
import * as sfx from './sound';
import { weaponOf, type WeaponStats } from './gear';

const FIGHT_ACTS = new Set<string>(['atk1', 'atk2', 'atk3', 'atk4', 'charge', 'skill', 'burst']);
export interface CombatCtx {
  hero: Hero;
  progress: Progress;
  toast(s: string): void;
  hint(s: string): void;
  money(eur: number): void;
  xpMul(): number;
  /** 가까운 켠 순간이동 포인트 곁인가(회복) */
  atWaypoint(): boolean;
  /** 쓰러졌다 — 가까운 순간이동 포인트로 */
  respawn(): Promise<void>;
  /** 밤(0..1) */
  night(): number;
  /** 야영지를 다 물리쳤다 — 상자 봉인을 푼다 */
  cleared(key: string): void;
  /** 우두머리 자리(로컬) — 없으면 null */
  bossSpot(): [number, number, number] | null;
  /** 쥐왕의 굴(로컬) — 없으면 null */
  kingSpot?(): [number, number, number] | null;
  /** 쥐왕을 쓰러뜨렸다 */
  kingSlain?(): void;
  /** 손에 든 무기(옷장) */
  weapon?(): { id: string; emoji: string; lv: number };
  /** 전리품(연마석 등) */
  loot?(kind: Kind): void;
}

export type Kind = 'slime' | 'rat' | 'gargoyle' | 'boss' | 'ratking';
const STATS: Record<Kind, { hp: number; dmg: number; speed: number; range: number; windup: number; cd: number; xp: number; eur: number; name: string; fly?: boolean }> = {
  slime: { hp: 70, dmg: 8, speed: 2.4, range: 1.4, windup: 0.55, cd: 1.7, xp: 8, eur: 1, name: '센 강 안개 슬라임' },
  rat: { hp: 110, dmg: 11, speed: 3.6, range: 1.9, windup: 0.6, cd: 1.9, xp: 12, eur: 2, name: '하수도 쥐 기사' },
  gargoyle: { hp: 150, dmg: 15, speed: 5, range: 9, windup: 0.85, cd: 3.2, xp: 20, eur: 3, name: '돌 가고일', fly: true },
  boss: { hp: 1800, dmg: 20, speed: 4, range: 5, windup: 1.2, cd: 2.6, xp: 400, eur: 40, name: '노트르담의 큰 가고일', fly: true },
  // 쥐왕: 모험 등급을 따라 세지지 않는다(늘 Lv.40) — 처음엔 두 방이면 쓰러지고, 등급을 올려야 잡는다
  ratking: { hp: 7000, dmg: 75, speed: 5.4, range: 3.4, windup: 1.0, cd: 2.1, xp: 3000, eur: 150, name: '쥐왕 (Roi des Rats)' },
};
const RATKING_LV = 40;
/** 덩치 큰 우두머리(내려치기·돌진·빨간 원) */
const big = (f: { kind: Kind }) => f.kind === 'boss' || f.kind === 'ratking';

interface Foe {
  id: number; kind: Kind; lv: number;
  x: number; y: number; z: number; vz: number; lift: number;
  facing: number; hp: number; maxHp: number;
  obj: THREE.Group; mats: THREE.MeshToonMaterial[];
  state: 'idle' | 'chase' | 'windup' | 'dash' | 'recover' | 'return' | 'dead';
  t: number; cd: number; flash: number; home: [number, number, number]; camp: Camp | null;
  dash?: [number, number]; slam?: THREE.Mesh; wander: number; bar: HTMLElement | null; seen: number;
}
interface Camp { key: string; x: number; y: number; z: number; foes: Foe[]; done: boolean }
interface Fx { obj: THREE.Object3D; t: number; life: number; step?: (o: THREE.Object3D, t: number, dt: number) => void }

const TAU = Math.PI * 2;
const bearing = (dx: number, dy: number) => ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
const angDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;

export class Combat {
  private readonly c: CombatCtx;
  readonly group = new THREE.Group();
  private foes: Foe[] = [];
  private camps = new Map<string, Camp>();
  private fx: Fx[] = [];
  private seq = 1;
  private frameRef: unknown = null;
  // 여행자
  hp = 1; maxHp = 1;
  energy = 0; readonly energyMax = 60;
  private skillCd = 0; readonly skillMax = 6;
  private combo = 0; private comboT = 0;
  private pending: { at: number; kind: CombatAct } | null = null;
  private iframes = 0;
  private outT = 99; // 싸움에서 벗어난 지
  private downing = false;
  private tornado: { x: number; y: number; dx: number; dy: number; t: number; tick: number; obj: THREE.Object3D } | null = null;
  private bossDay = '';
  private boss: Foe | null = null;
  // 쥐왕
  private king: Foe | null = null;
  private kingDay = '';
  private kingRing: THREE.Mesh | null = null;
  /** 첫걸음의 만남: 멀리서도 달려든다 */
  kingProvoked = false;
  /** 쓰러진 횟수 */
  downs = 0;
  // 화면
  private readonly ui: HTMLElement;
  private readonly hpBar: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly skillBtn: HTMLElement;
  private readonly burstBtn: HTMLElement;
  private readonly atkBtn: HTMLElement;
  private readonly layer: HTMLElement;
  private readonly vignette: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly pt = { x: 0, y: 0 };

  constructor(c: CombatCtx) {
    this.c = c;
    this.group.name = 'combat';
    try { this.bossDay = localStorage.getItem('carnet-boss-day') ?? ''; this.kingDay = localStorage.getItem('carnet-ratking-day') ?? ''; } catch { /* 무시 */ }
    this.ui = document.createElement('div');
    this.ui.className = 'cbt';
    this.ui.innerHTML = `<div class="hp"><i></i><span></span></div>
      <button class="atk" type="button" title="공격 (마우스 톡 · 길게 누르면 강공격)">⚔️</button>
      <button class="skill" type="button" title="원소 스킬 — 바람 소용돌이 (E)"><em>🌀</em><kbd>E</kbd><i></i></button>
      <button class="burst" type="button" title="원소 폭발 — 센 강의 회오리 (Q)"><em>🌪️</em><kbd>Q</kbd><i></i></button>`;
    document.body.appendChild(this.ui);
    this.hpBar = this.ui.querySelector('.hp i')!;
    this.hpText = this.ui.querySelector('.hp span')!;
    this.skillBtn = this.ui.querySelector('.skill')!;
    this.burstBtn = this.ui.querySelector('.burst')!;
    this.atkBtn = this.ui.querySelector('.atk')!;
    const tap = (sel: string, e: 'attack' | 'skill' | 'burst') => this.ui.querySelector(sel)!.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); c.hero.input.press(e); });
    tap('.skill', 'skill'); tap('.burst', 'burst');
    // ⚔️: 톡 = 공격, 길게(0.4초) = 강공격
    const atk = this.ui.querySelector('.atk') as HTMLElement;
    let downAt = 0;
    atk.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); downAt = performance.now(); atk.classList.add('held'); });
    const up = (ev: PointerEvent) => { if (!downAt) return; ev.preventDefault(); atk.classList.remove('held'); c.hero.input.press(performance.now() - downAt >= 400 ? 'charge' : 'attack'); downAt = 0; };
    atk.addEventListener('pointerup', up);
    atk.addEventListener('pointercancel', () => { downAt = 0; atk.classList.remove('held'); });
    this.layer = document.createElement('div');
    this.layer.className = 'cbt-layer';
    document.body.appendChild(this.layer);
    this.vignette = document.createElement('div');
    this.vignette.className = 'cbt-hurt';
    document.body.appendChild(this.vignette);
    this.bossBar = document.createElement('div');
    this.bossBar.className = 'cbt-boss';
    this.bossBar.innerHTML = '<b></b><span><i></i></span>';
    document.body.appendChild(this.bossBar);
    this.recalc(true);
  }

  /** 적의 힘: 보통은 적 레벨로, 쥐왕은 고정 — 대신 모험 등급이 오를수록 덜 아프다(방어, 최대 절반) */
  private lvMul(f: Foe) { return f.kind === 'ratking' ? 1 - Math.min(0.5, this.ar * 0.025) : 1 + 0.2 * (f.lv - 1); }
  private get hero() { return this.c.hero; }
  /** 지금 몸이 선 세계(비경 안이면 비경) */
  private get W() { return this.hero.sceneWorld ?? this.hero.world; }
  private get ar() { return this.c.progress.ar; }
  /** 손에 든 무기의 능력 */
  private get wep(): WeaponStats { const w = this.c.weapon?.(); return weaponOf(w?.id ?? 'umbrella', w?.lv ?? 1); }
  /** 화면에 보일 능력(옷장) */
  stats() { const w = this.wep; return { atk: Math.round(this.atk), hp: this.maxHp, crit: Math.round(w.crit * 100), critDmg: w.critDmg }; }
  /** 모험 등급 × 무기 */
  private get atk() { return (16 + this.ar * 3) * this.wep.atk; }
  private recalc(full = false) {
    const m = 120 + this.ar * 12;
    if (m !== this.maxHp) { const r = this.hp / this.maxHp; this.maxHp = m; this.hp = full ? m : Math.max(1, Math.round(r * m)); }
  }
  get inCombat() { return this.foes.some((f) => f.state !== 'idle' && f.state !== 'return' && f.state !== 'dead'); }
  heal(frac: number) { this.hp = Math.min(this.maxHp, this.hp + this.maxHp * frac); }

  // ───────── 적 만들기 ─────────
  /** 야영지(보물상자 지키기): 탐험(칸)에서 부른다 */
  spawnCamp(key: string, x: number, y: number, z: number, seed: number, only?: Kind[], ring = 1) {
    if (this.camps.has(key)) return;
    const night = this.c.night() > 0.5;
    const r = seed;
    const kinds: Kind[] = only ? only : night && r < 0.5 ? ['gargoyle', 'gargoyle', 'slime'] : r < 0.4 ? ['slime', 'slime', 'slime'] : r < 0.75 ? ['rat', 'rat', 'slime'] : ['rat', 'gargoyle', 'slime'];
    const camp: Camp = { key, x, y, z, foes: [], done: false };
    kinds.forEach((k, i) => {
      const a = (i / kinds.length) * TAU + seed * 5, d = (4 + i) * ring;
      const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d;
      const fz = this.W.ground(fx, fy, z + 2, 2.5);
      camp.foes.push(this.spawn(k, fx, fy, fz, camp));
    });
    this.camps.set(key, camp);
  }

  private spawn(kind: Kind, x: number, y: number, z: number, camp: Camp | null): Foe {
    const S = STATS[kind];
    const lv = kind === 'ratking' ? RATKING_LV : 1 + Math.floor(this.ar / 4);
    const hp = kind === 'ratking' ? S.hp : Math.round(S.hp * (1 + 0.28 * (lv - 1)));
    const { obj, mats } = this.model(kind);
    obj.position.set(x, y, z);
    this.group.add(obj);
    const f: Foe = { id: this.seq++, kind, lv, x, y, z, vz: 0, lift: 0, facing: Math.random() * 360, hp, maxHp: hp, obj, mats, state: 'idle', t: 0, cd: 1 + Math.random(), flash: 0, home: [x, y, z], camp, wander: Math.random() * 5, bar: null, seen: 0 };
    this.foes.push(f);
    return f;
  }

  private model(kind: Kind): { obj: THREE.Group; mats: THREE.MeshToonMaterial[] } {
    const g = new THREE.Group(), body = new THREE.Group();
    g.add(body);
    g.userData.body = body;
    const mats: THREE.MeshToonMaterial[] = [];
    const M = (color: number, extra: Partial<THREE.MeshToonMaterialParameters> = {}) => { const m = new THREE.MeshToonMaterial({ color, ...extra }); mats.push(m); return m; };
    const eye = new THREE.MeshBasicMaterial({ color: kind === 'slime' ? 0x10202c : 0xff3b2f });
    if (kind === 'slime') {
      const gel = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14).scale(1, 1, 0.8).translate(0, 0, 0.45), M(0x9fc9ea, { transparent: true, opacity: 0.88 }));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8).translate(0, -0.05, 0.45), M(0xe8f6ff, { emissive: 0x335577 }));
      body.add(gel, core);
      for (const sx of [-1, 1]) body.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6).translate(sx * 0.17, 0.46, 0.55), eye));
      const wisp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8).rotateX(Math.PI / 2).translate(0, 0, 0.95), M(0xcfe6f7, { transparent: true, opacity: 0.7 }));
      body.add(wisp);
    } else if (kind === 'rat' || kind === 'ratking') {
      const king = kind === 'ratking';
      const fur = M(king ? 0x3a322d : 0x6e6258), pink = M(0xe8a7a0), steel = M(king ? 0xe6c35a : 0xc9ccd0), red = M(0xb3262c);
      body.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.45, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.62), fur));
      const head = new THREE.Group(); head.position.set(0, 0.12, 1.12); body.add(head);
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), fur));
      head.add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.26, 10).rotateX(-Math.PI / 2).translate(0, 0.26, -0.03), fur));
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6).translate(0, 0.39, -0.03), pink));
      for (const sx of [-1, 1]) { head.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6).scale(1, 0.4, 1).translate(sx * 0.15, -0.02, 0.17), pink)); head.add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6).translate(sx * 0.08, 0.17, 0.06), eye)); }
      head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.05, 14).rotateX(Math.PI / 2).translate(0.03, -0.02, 0.2), red)); // 베레모
      body.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.01, 0.8, 5).rotateX(-0.9).translate(0, -0.45, 0.3), pink)); // 꼬리
      const arm = new THREE.Group(); arm.position.set(0.3, 0.05, 0.8); body.add(arm);
      arm.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.75).translate(0, 0.12, -0.25).rotateX(-1.1), steel)); // 칼
      body.userData.arm = arm;
      for (const sx of [-1, 1]) body.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.3, 3, 6).rotateX(Math.PI / 2).translate(sx * 0.13, 0, 0.2), fur));
      if (king) {
        // 쥐왕: 세 배 덩치, 금관, 붉은 망토, 빛나는 눈
        const gold = M(0xe6b422, { emissive: 0x3a2a00 });
        for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; head.add(new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5).rotateX(Math.PI / 2).translate(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0.33), gold)); }
        head.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 14, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.27), gold));
        const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.9).rotateX(Math.PI / 2 - 0.25).translate(0, -0.3, 0.65), M(0x8e1a22, { side: THREE.DoubleSide }));
        body.add(cape);
        body.scale.setScalar(3.1);
      }
    } else {
      const big = kind === 'boss' ? 3.2 : 1;
      const stone = M(kind === 'boss' ? 0x5c5f66 : 0x8a8d93), dark = M(kind === 'boss' ? 0x3b3d42 : 0x6c6f75);
      const inner = new THREE.Group(); inner.scale.setScalar(big); body.add(inner);
      inner.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.4, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.5), stone));
      const head = new THREE.Group(); head.position.set(0, 0.1, 0.98); inner.add(head);
      head.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8).scale(1, 1.2, 0.9), stone));
      head.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.1).translate(0, 0.2, -0.08), dark)); // 주둥이
      for (const sx of [-1, 1]) { head.add(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6).rotateY(sx * 0.4).translate(sx * 0.12, -0.02, 0.22), dark)); head.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6).translate(sx * 0.08, 0.22, 0.04), eye)); }
      const wings: THREE.Object3D[] = [];
      for (const sx of [-1, 1]) {
        const w = new THREE.Group(); w.position.set(sx * 0.2, -0.1, 0.72); inner.add(w);
        const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.9, 0.35), new THREE.Vector2(0.75, -0.1), new THREE.Vector2(0.55, 0.05), new THREE.Vector2(0.35, -0.2)]);
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2).scale(sx, 1, 1), new THREE.MeshToonMaterial({ color: kind === 'boss' ? 0x46494f : 0x74777d, side: THREE.DoubleSide }));
        mats.push(mesh.material as THREE.MeshToonMaterial);
        w.add(mesh);
        wings.push(w);
      }
      g.userData.wings = wings;
      for (const sx of [-1, 1]) inner.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.25, 3, 6).rotateX(Math.PI / 2).translate(sx * 0.14, 0.05, 0.12), dark));
    }
    return { obj: g, mats };
  }

  // ───────── 매 프레임 ─────────
  update(dt: number, f: InputFrame | null, live: boolean) {
    if (this.frameRef !== this.hero.frame) { this.frameRef = this.hero.frame; this.clearAll(); }
    this.recalc();
    const b = this.hero.body;
    this.ui.classList.toggle('on', live);
    this.layer.classList.toggle('on', live);
    this.iframes = Math.max(0, this.iframes - dt);
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    this.clock += dt;
    if (!live || this.downing) { this.paintHud(); this.paintMarks(); return; }
    const fighting = this.inCombat;
    this.outT = fighting ? 0 : this.outT + dt;
    // 회복: 순간이동 포인트 곁이면 가득, 싸움 밖 8초 뒤부턴 천천히
    if (this.c.atWaypoint() && this.hp < this.maxHp) { this.hp = this.maxHp; sfx.recovered(); this.float(b.x, b.y, b.z + 2.2, '회복', 'heal'); }
    else if (this.outT > 8) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.03 * dt);
    // 입력
    if (f) {
      if (f.attack) this.attack();
      if (f.charge) this.charge();
      // 구르는 중이거나 한 박자 일찍 누른 공격은 잠깐 기억했다가 되는 순간 나간다
      if (this.buffered > 0) { this.buffered -= dt; if (b.mode === 'ground' || (b.mode === 'act' && b.act && FIGHT_ACTS.has(b.act.kind) && b.act.t >= 0.18)) { this.buffered = 0; this.attack(); } }
      if (f.skill) this.skill();
      if (f.burst) this.burst();
      f.attack = f.skill = f.burst = f.charge = false;
    }
    // 공격이 닿는 순간
    if (this.pending && b.act?.kind === this.pending.kind && b.act.t >= this.pending.at) { this.strike(this.pending.kind); this.pending = null; }
    else if (this.pending && b.act?.kind !== this.pending.kind) this.pending = null;
    for (const e of this.hero.events) { if (e === 'plunge') this.plungeHit(); else if (e === 'roll') this.rollAt = this.clock; }
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) { this.hits = 0; this.comboEl?.classList.remove('on'); } }
    this.stepBoss();
    this.stepKing();
    for (const foe of this.foes.slice()) this.stepFoe(foe, dt);
    this.stepTornado(dt);
    this.stepFx(dt);
    this.paintHud();
    this.paintMarks();
  }

  // ───────── 비경(따로 떨어진 곳) ─────────
  /** 비경 안인가: 우두머리를 깨우지 않고, 바깥 적은 잠시 치워 둔다 */
  zone = false;
  private stashed: { foes: Foe[]; camps: Map<string, Camp>; boss: Foe | null; king: Foe | null } | null = null;
  enterZone() {
    if (this.zone) return;
    for (const f of this.foes) { this.group.remove(f.obj); f.bar?.remove(); f.bar = null; if (f.slam) { this.group.remove(f.slam); f.slam = undefined; } if (f.state !== 'dead') f.state = 'idle'; }
    this.stashed = { foes: this.foes, camps: this.camps, boss: this.boss, king: this.king };
    this.foes = []; this.camps = new Map(); this.boss = null; this.king = null;
    if (this.kingRing) this.kingRing.visible = false;
    this.clearFx();
    this.bossBar.classList.remove('on');
    this.zone = true;
  }
  leaveZone() {
    if (!this.zone) return;
    this.clearAll();
    const st = this.stashed;
    if (st) {
      this.foes = st.foes; this.camps = st.camps; this.boss = st.boss; this.king = st.king;
      for (const f of this.foes) if (f.state !== 'dead') this.group.add(f.obj);
      // 바깥 적은 제자리로
      for (const f of this.foes) if (f.state !== 'dead') { [f.x, f.y, f.z] = f.home; f.hp = f.maxHp; }
    }
    this.stashed = null;
    this.zone = false;
    this.hp = Math.max(this.hp, this.maxHp * 0.5);
  }
  /** 비경 안의 무리가 몇이 남았나 */
  alive(key: string) { return this.camps.get(key)?.foes.filter((f) => f.state !== 'dead').length ?? 0; }
  private clearFx() {
    for (const x of this.fx) this.group.remove(x.obj);
    this.fx = [];
    if (this.tornado) { this.group.remove(this.tornado.obj); this.tornado = null; }
  }

  private clearAll() {
    for (const f of this.foes) { this.group.remove(f.obj); f.bar?.remove(); if (f.slam) this.group.remove(f.slam); }
    this.foes = []; this.camps.clear(); this.boss = null; this.king = null;
    if (this.kingRing) this.kingRing.visible = false;
    for (const x of this.fx) this.group.remove(x.obj);
    this.fx = [];
    if (this.tornado) { this.group.remove(this.tornado.obj); this.tornado = null; }
  }

  // ───────── 여행자의 공격 ─────────
  /** 가까운 적 쪽으로 몸을 돌린다(원신의 부드러운 조준) */
  private aim(r = 7) {
    const b = this.hero.body;
    let best: Foe | null = null, bd = r;
    for (const f of this.foes) { if (f.state === 'dead') continue; const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < bd && Math.abs(f.z - b.z) < 5) { bd = d; best = f; } }
    if (best) b.facing = bearing(best.x - b.x, best.y - b.y);
  }

  private attack() {
    const b = this.hero.body;
    if (b.plunge()) { b.drawn = 4; sfx.glide(); return; }
    // 네 번 이어진다: 가로 베기 → 되베기 → 내려찍기 → 회오리 베기(한 바퀴)
    const kind: CombatAct = this.comboT > 0 && this.combo < 4 ? (['atk1', 'atk2', 'atk3', 'atk4'] as const)[this.combo] : 'atk1';
    this.aim();
    if (!b.combat(kind)) { if (b.mode === 'roll') this.buffered = 0.9; else if (b.mode === 'act' && b.act && FIGHT_ACTS.has(b.act.kind)) this.buffered = 0.45; return; }
    this.buffered = 0;
    this.combo = kind === 'atk1' ? 1 : kind === 'atk2' ? 2 : kind === 'atk3' ? 3 : 4;
    this.comboT = 0.95;
    if (this.combo >= 4) this.comboT = 0;
    this.pending = { at: kind === 'atk3' ? 0.26 : kind === 'atk4' ? 0.2 : 0.12, kind };
    this.armCounter();
    b.drawn = 4;
    sfx.roll();
  }

  /** 강공격: 끌지 않고 길게 눌렀다 뗀다 — 앞으로 내달리며 찌르고, 줄지어 선 적을 꿰뚫는다(기력 20%) */
  private charge() {
    const b = this.hero.body;
    if (b.stamina < 0.2) { this.c.hint('기력이 모자라 강공격을 못 한다'); setTimeout(() => this.c.hint(''), 1500); return; }
    this.aim(9);
    if (!b.combat('charge')) return;
    b.stamina -= 0.2;
    this.chargeFrom = [b.x, b.y];
    this.combo = 0; this.comboT = 0;
    this.pending = { at: 0.3, kind: 'charge' };
    b.drawn = 4;
    sfx.vault();
    this.armCounter();
  }
  /** 구르기로 피한 직후(구르기가 끝나고 0.5초 안)의 공격 = 반격: 반드시 치명타, 1.5배 */
  private rollAt = -9;
  private chargeFrom: [number, number] | null = null;
  private clock = 0;
  private buffered = 0;
  private counterArmed = false;
  private armCounter() {
    if (this.clock - this.rollAt < 1.1) { this.counterArmed = true; const b = this.hero.body; this.float(b.x, b.y, b.z + 2.4, '반격!', 'crit'); sfx.spot(); }
  }
  /** 이어 맞힌 수(2.5초 안에 다음 타격) — 많을수록 조금 더 세다 */
  private hits = 0;
  private hitT = 0;
  private comboEl: HTMLElement | null = null;
  private get hitMul() { return 1 + Math.min(0.3, Math.floor(this.hits / 5) * 0.05); }
  private countHit() {
    this.hits++;
    this.hitT = 2.5;
    if (!this.comboEl) { this.comboEl = document.createElement('div'); this.comboEl.className = 'cbt-combo'; this.layer.appendChild(this.comboEl); }
    const n = this.hits;
    const rank = n >= 40 ? 'Parisien!' : n >= 25 ? 'Magnifique!' : n >= 15 ? 'Très bien!' : n >= 8 ? 'Bien!' : '';
    const bonus = Math.round((this.hitMul - 1) * 100);
    this.comboEl.innerHTML = `<b>${n}</b><span>HIT</span>${rank ? `<em>${rank}</em>` : ''}${bonus ? `<small>피해 +${bonus}%</small>` : ''}`;
    this.comboEl.classList.remove('pop'); void this.comboEl.offsetWidth; this.comboEl.classList.add('pop', 'on');
  }

  private skill() {
    const b = this.hero.body;
    if (this.skillCd > 0) { this.cooldownNote(); return; }
    this.aim();
    if (!b.combat('skill')) return;
    this.skillCd = this.skillMax;
    b.drawn = 4;
    sfx.glide();
    this.pending = { at: 0.22, kind: 'skill' };
    this.ring(b.x, b.y, b.z + 0.4, 0x9ff3e0, 5.5);
  }

  private burst() {
    const b = this.hero.body;
    if (this.energy < this.energyMax) { this.cooldownNote(true); return; }
    this.aim(12);
    if (!b.combat('burst')) return;
    this.energy = 0;
    b.drawn = 5;
    sfx.fanfare();
    this.pending = { at: 0.5, kind: 'burst' };
  }

  private noteT = 0;
  private cooldownNote(burst = false) {
    const now = performance.now();
    if (now - this.noteT < 1200) return;
    this.noteT = now;
    this.c.hint(burst ? `원소 에너지가 모자라다 (${Math.floor(this.energy)}/${this.energyMax}) — 적을 때리면 찬다` : `원소 스킬 재사용까지 ${this.skillCd.toFixed(1)}초`);
    setTimeout(() => this.c.hint(''), 1500);
  }

  private strike(kind: CombatAct) {
    const b = this.hero.body;
    const [fx, fy] = [Math.sin((b.facing * Math.PI) / 180), Math.cos((b.facing * Math.PI) / 180)];
    if (kind === 'burst') {
      const obj = this.tornadoModel();
      const x = b.x + fx * 3, y = b.y + fy * 3;
      obj.position.set(x, y, b.z);
      this.group.add(obj);
      this.tornado = { x, y, dx: fx, dy: fy, t: 0, tick: 0, obj };
      this.c.hint('🌪️ 센 강의 회오리!');
      setTimeout(() => this.c.hint(''), 1500);
      return;
    }
    if (kind === 'skill') {
      let n = 0;
      for (const f of this.foes) {
        if (f.state === 'dead') continue;
        const d = Math.hypot(f.x - b.x, f.y - b.y);
        if (d > 5.5 || Math.abs(f.z - b.z) > 4) continue;
        // 가운데로 끌어당기며 띄운다
        const k = Math.min(1, 2 / Math.max(0.1, d));
        f.x += (b.x - f.x) * k * 0.6; f.y += (b.y - f.y) * k * 0.6;
        this.damage(f, this.atk * 2.2 * this.wep.skill, 'skill');
        if (!big(f)) { f.lift = 0.1; f.vz = 5; }
        n++;
      }
      this.energy = Math.min(this.energyMax, this.energy + (n * 6 + (n ? 4 : 0)) * this.wep.energy);
      this.burstWind(b.x, b.y, b.z + 1, 0x9ff3e0);
      return;
    }
    if (kind === 'charge') {
      // 내달리기 시작한 곳부터 앞으로 5 m(+내달린 거리), 폭 1.4 m 안의 적을 모두 꿰뚫는다
      let n = 0;
      const [sx, sy] = this.chargeFrom ?? [b.x, b.y];
      const ran = Math.hypot(b.x - sx, b.y - sy);
      this.swing(b.x, b.y, b.z + 1.1, b.facing, true);
      for (const f of this.foes) {
        if (f.state === 'dead') continue;
        const dx = f.x - sx, dy = f.y - sy;
        const along = dx * fx + dy * fy, side = Math.abs(dx * fy - dy * fx);
        const size = big(f) ? 2.4 : 0.5;
        if (along < -1 || along > 5 + ran + this.wep.reach + size || side > 1.4 + size || Math.abs(f.z - b.z) > (big(f) ? 4 : 2.2)) continue;
        this.damage(f, this.atk * 2.8, 'heavy');
        if (!big(f)) { f.x += fx * 2; f.y += fy * 2; f.lift = Math.max(f.lift, 0.3); f.vz = 3; }
        n++;
      }
      if (n) { this.energy = Math.min(this.energyMax, this.energy + 4 * n * this.wep.energy); sfx.bump(); }
      this.counterArmed = false;
      return;
    }
    if (kind === 'atk4') {
      // 한 바퀴 돌며 둘레를 모두 벤다(넷째 — 마무리)
      let n = 0;
      this.ring(b.x, b.y, b.z + 1, 0xfff2b0, 3.4 + this.wep.reach);
      for (const f of this.foes) {
        if (f.state === 'dead') continue;
        const dx = f.x - b.x, dy = f.y - b.y, d = Math.hypot(dx, dy);
        const size = big(f) ? 2.4 : 0.5;
        if (d - size > 3.3 + this.wep.reach || Math.abs(f.z - b.z) > (big(f) ? 4 : 2.2)) continue;
        this.damage(f, this.atk * 2.4, 'heavy');
        if (!big(f)) { const k = 2.2; f.x += (dx / (d || 1)) * k; f.y += (dy / (d || 1)) * k; }
        n++;
      }
      if (n) { this.energy = Math.min(this.energyMax, this.energy + 3 * n * this.wep.energy); sfx.bump(); }
      this.counterArmed = false;
      return;
    }
    const heavy = kind === 'atk3';
    const reach = (heavy ? 3.1 : 2.6) + this.wep.reach, cone = heavy ? 100 : 75;
    this.swing(b.x, b.y, b.z + 1.1, b.facing, heavy);
    let n = 0;
    for (const f of this.foes) {
      if (f.state === 'dead') continue;
      const dx = f.x - b.x, dy = f.y - b.y, d = Math.hypot(dx, dy);
      const size = big(f) ? 2.4 : 0.5;
      if (d - size > reach || Math.abs(f.z + (big(f) ? 2 : 0.6) - (b.z + 1)) > (big(f) ? 4 : 2.2)) continue;
      if (d > size && Math.abs(angDiff(b.facing, bearing(dx, dy))) > cone / 2) continue;
      this.damage(f, this.atk * (kind === 'atk1' ? 1 : kind === 'atk2' ? 1.1 : 1.8), heavy ? 'heavy' : 'hit');
      // 밀어낸다
      if (!big(f)) { const k = heavy ? 1.6 : 0.6; f.x += (dx / (d || 1)) * k; f.y += (dy / (d || 1)) * k; }
      n++;
    }
    if (n) { this.energy = Math.min(this.energyMax, this.energy + 2 * n * this.wep.energy); sfx.bump(); }
    this.counterArmed = false;
  }

  private plungeHit() {
    const b = this.hero.body;
    const drop = Math.max(0, b.fallTopZ - b.z);
    this.ring(b.x, b.y, b.z + 0.2, 0xfff2b0, 3.4);
    sfx.land();
    let n = 0;
    for (const f of this.foes) {
      if (f.state === 'dead') continue;
      if (Math.hypot(f.x - b.x, f.y - b.y) > (big(f) ? 5.5 : 3.4) || Math.abs(f.z - b.z) > 4) continue;
      this.damage(f, this.atk * (2.6 + Math.min(3, drop / 10)), 'heavy');
      n++;
    }
    this.energy = Math.min(this.energyMax, this.energy + n * 3);
  }

  private damage(f: Foe, raw: number, how: 'hit' | 'heavy' | 'skill' | 'burst') {
    const w = this.wep;
    const counter = this.counterArmed && how !== 'burst';
    const crit = counter || Math.random() < w.crit;
    // 스킬로 띄운 적은 공중 추가타 +25% · 이어 맞힌 수만큼 +5%씩(최대 +30%) · 반격 1.5배
    const juggle = f.lift > 0.2 && !big(f) && how !== 'skill' ? 1.25 : 1;
    const dmg = Math.round(raw * (0.9 + Math.random() * 0.2) * (crit ? w.critDmg : 1) * juggle * this.hitMul * (counter ? 1.5 : 1));
    this.countHit();
    if (w.heal && (how === 'hit' || how === 'heavy')) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * w.heal); // 바게트: 한 입
    f.hp -= dmg;
    f.flash = 0.12;
    f.seen = 4;
    if (f.state === 'idle' || f.state === 'return') this.aggro(f);
    this.float(f.x, f.y, f.z + (big(f) ? 5.5 : 1.6), `${dmg}${crit ? '!' : ''}`, crit ? 'crit' : how === 'skill' || how === 'burst' ? 'wind' : 'dmg');
    if (f.hp <= 0) this.kill(f);
  }

  private kill(f: Foe) {
    f.state = 'dead';
    f.t = 0;
    f.bar?.remove(); f.bar = null;
    if (f.slam) { this.group.remove(f.slam); f.slam = undefined; }
    const S = STATS[f.kind];
    this.burstWind(f.x, f.y, f.z + 0.8, f.kind === 'slime' ? 0x9fc9ea : f.kind === 'rat' ? 0xb8a898 : 0xbfc3c9);
    sfx.chime();
    const P = this.c.progress;
    const lvK = f.kind === 'ratking' ? 1 : f.lv;
    P.addXp(Math.round(S.xp * lvK * this.c.xpMul()), S.name);
    this.c.money(S.eur * lvK);
    P.bump('defeat');
    this.c.loot?.(f.kind);
    if (f.kind === 'boss') {
      P.stars += 60;
      this.boss = null;
      this.bossBar.classList.remove('on');
      sfx.fanfare();
      this.c.toast(`👑 ${S.name}을 물리쳤다! ⭐60 · €${S.eur * f.lv} · 경험치 ${Math.round(S.xp * f.lv * this.c.xpMul())} — 내일 다시 깨어난다`);
      this.bossDay = new Date().toISOString().slice(0, 10);
      try { localStorage.setItem('carnet-boss-day', this.bossDay); } catch { /* 무시 */ }
    }
    if (f.kind === 'ratking') {
      P.stars += 300;
      this.king = null;
      this.kingProvoked = false;
      if (this.kingRing) this.kingRing.visible = false;
      this.bossBar.classList.remove('on');
      sfx.fanfare();
      this.c.toast(`🐀👑 쥐왕을 쓰러뜨렸다!! ⭐300 · €${S.eur} · 경험치 ${Math.round(S.xp * this.c.xpMul())} — 파리의 쥐들이 잠잠해진다(내일 다시 나타난다)`);
      this.kingDay = new Date().toISOString().slice(0, 10);
      try { localStorage.setItem('carnet-ratking-day', this.kingDay); localStorage.setItem('carnet-ratking-slain', '1'); } catch { /* 무시 */ }
      this.c.kingSlain?.();
    }
    const camp = f.camp;
    if (camp && !camp.done && camp.foes.every((q) => q.state === 'dead')) {
      camp.done = true;
      const k = camp.key;
      if (k.startsWith('dom:')) this.c.cleared(k); // 비경의 물결 — 알림은 비경이
      else if (k.startsWith('story:')) { sfx.questDone(); this.c.cleared(k); }
      else if (k.startsWith('pack:')) setTimeout(() => { sfx.questDone(); this.c.toast(`⚔️ ${camp.foes.some((q) => q.kind === 'rat') ? '🐀 쥐 떼를' : '요괴 무리를'} 쫓아냈다`); this.c.cleared(k); }, 500);
      else setTimeout(() => { sfx.questDone(); this.c.toast('⚔️ 적을 모두 물리쳤다 — 보물상자의 봉인이 풀렸다'); this.c.cleared(k); }, 600);
    }
  }

  private aggro(f: Foe) {
    if (f.state === 'dead') return;
    const was = this.inCombat;
    f.state = 'chase';
    f.t = 0;
    if (!was) sfx.spot();
    // 같은 무리는 함께 덤빈다
    if (f.camp) for (const q of f.camp.foes) if (q.state === 'idle') { q.state = 'chase'; q.t = Math.random() * 0.5; }
  }

  // ───────── 적의 움직임 ─────────
  private stepFoe(f: Foe, dt: number) {
    const b = this.hero.body, w = this.W, S = STATS[f.kind];
    f.t += dt;
    if (f.seen > 0) f.seen -= dt;
    const body = f.obj.userData.body as THREE.Object3D;
    if (f.state === 'dead') {
      body.scale.setScalar(Math.max(0.01, 1 - f.t * 2.5));
      if (f.t > 0.5) { this.group.remove(f.obj); this.foes = this.foes.filter((q) => q !== f); }
      return;
    }
    const dx = b.x - f.x, dy = b.y - f.y, d = Math.hypot(dx, dy);
    const far = Math.hypot(f.x - f.home[0], f.y - f.home[1]);
    if (d > (f.kind === 'ratking' ? 460 : 180)) { f.obj.visible = false; return; }
    f.obj.visible = true;
    // 떠오름(스킬에 맞아)
    if (f.lift > 0 || f.vz > 0) { f.vz -= 18 * dt; f.lift = Math.max(0, f.lift + f.vz * dt); if (f.lift === 0) f.vz = 0; }
    const move = (tx: number, ty: number, sp: number) => {
      const ex = tx - f.x, ey = ty - f.y, L = Math.hypot(ex, ey);
      if (L < 0.05) return;
      f.facing = bearing(ex, ey);
      const s = Math.min(L, sp * dt);
      const p = { x: f.x + (ex / L) * s, y: f.y + (ey / L) * s };
      if (!S.fly) w.collide(p, f.z, 0.45, 1.2, 0.6);
      f.x = p.x; f.y = p.y;
    };
    switch (f.state) {
      case 'idle':
        f.wander -= dt;
        if (f.wander < 0) { f.wander = 3 + Math.random() * 4; f.dash = [f.home[0] + (Math.random() - 0.5) * 6, f.home[1] + (Math.random() - 0.5) * 6]; }
        if (f.dash) move(f.dash[0], f.dash[1], S.speed * 0.35);
        if (d < (f.kind === 'ratking' ? (this.kingProvoked ? 70 : 15) : big(f) ? 22 : 13) && Math.abs(b.z - f.z) < 8 && !this.downing) this.aggro(f);
        break;
      case 'return':
        move(f.home[0], f.home[1], S.speed * 1.2);
        f.hp = Math.min(f.maxHp, f.hp + f.maxHp * 0.3 * dt);
        if (far < 1) { f.state = 'idle'; f.hp = f.maxHp; }
        break;
      case 'chase':
        f.cd -= dt;
        if (far > (f.kind === 'ratking' ? (this.kingProvoked ? 90 : 34) : big(f) ? 45 : 28) || this.downing) { f.state = 'return'; break; }
        if (d > S.range * (f.kind === 'gargoyle' ? 1 : 0.85)) move(b.x, b.y, S.speed);
        else { f.facing = bearing(dx, dy); if (f.cd <= 0) { f.state = 'windup'; f.t = 0; if (big(f) && d < 6) this.telegraph(f, b.x, b.y); } }
        if (f.kind === 'gargoyle' && d < S.range && f.cd <= 0) { f.state = 'windup'; f.t = 0; }
        break;
      case 'windup': {
        f.facing = bearing(dx, dy);
        if (f.t >= S.windup) {
          if (f.kind === 'gargoyle' || (big(f) && !f.slam)) { f.state = 'dash'; f.t = 0; const L = d || 1; f.dash = [dx / L, dy / L]; }
          else { this.foeHit(f, big(f) ? 4.5 : S.range + 0.5); f.state = 'recover'; f.t = 0; }
        }
        break;
      }
      case 'dash': {
        const sp = big(f) ? 16 : 13;
        const p = { x: f.x + f.dash![0] * sp * dt, y: f.y + f.dash![1] * sp * dt };
        f.x = p.x; f.y = p.y;
        if (Math.hypot(b.x - f.x, b.y - f.y) < (big(f) ? 2.6 : 1.3) && Math.abs(b.z + 1 - (f.z + 1)) < 2.5) { this.hurt(S.dmg * this.lvMul(f), f); f.state = 'recover'; f.t = 0; }
        if (f.t > 0.55) { f.state = 'recover'; f.t = 0; }
        break;
      }
      case 'recover':
        if (f.t > 0.6) { f.state = 'chase'; f.cd = S.cd * (0.8 + Math.random() * 0.4); }
        break;
    }
    // 높이: 걷는 것은 땅을, 나는 것은 땅 위 2.5 m를 따른다
    const g = w.ground(f.x, f.y, f.z + 1.5, 2);
    const want = S.fly ? Math.max(g, w.terrain(f.x, f.y)) + (big(f) ? 1.2 : 2.3) + Math.sin(f.t * 2 + f.id) * 0.25 : g;
    f.z += (want - f.z) * Math.min(1, dt * (S.fly ? 3 : 12));
    f.obj.position.set(f.x, f.y, f.z + f.lift);
    f.obj.rotation.z = (-f.facing * Math.PI) / 180;
    // 몸짓
    const wind = f.state === 'windup' ? Math.min(1, f.t / S.windup) : 0;
    if (f.kind === 'slime') { const hop = f.state === 'chase' || f.state === 'return' ? Math.abs(Math.sin(f.t * 7)) : 0.3 * Math.abs(Math.sin(f.t * 2)); body.position.z = hop * 0.35 + wind * 0.2; body.scale.set(1 + wind * 0.25, 1 + wind * 0.25, 1 - wind * 0.35 + hop * 0.1); }
    else if (f.kind === 'rat' || f.kind === 'ratking') { const arm = body.userData.arm as THREE.Object3D; arm.rotation.x = f.state === 'windup' ? -1.4 * wind : f.state === 'recover' ? 1.2 : Math.sin(f.t * 8) * 0.2; body.rotation.x = f.state === 'chase' ? 0.15 : 0; body.position.z = f.state === 'chase' ? Math.abs(Math.sin(f.t * 10)) * 0.08 : 0; }
    else { const wings = f.obj.userData.wings as THREE.Object3D[]; const fl = Math.sin(f.t * (f.state === 'dash' ? 20 : 8)) * 0.6; wings[0].rotation.y = fl; wings[1].rotation.y = -fl; body.rotation.x = f.state === 'windup' ? -0.5 * wind : f.state === 'dash' ? 0.7 : 0; }
    for (const m of f.mats) m.emissive.setHex(f.flash > 0 ? 0xffffff : wind > 0.6 ? 0x661100 : 0x000000);
    if (f.flash > 0) f.flash -= dt;
    if (f.slam) { const s = f.slam.material as THREE.MeshBasicMaterial; s.opacity = 0.25 + 0.35 * wind; }
  }

  /** 우두머리 내려치기: 빨간 원으로 미리 보여 준다 */
  private telegraph(f: Foe, x: number, y: number) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(4.5, 40), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.3, depthWrite: false }));
    m.position.set(x, y, this.W.ground(x, y, this.hero.body.z + 1, 2) + 0.06);
    this.group.add(m);
    f.slam = m;
    f.dash = [x, y];
  }

  private foeHit(f: Foe, reach: number) {
    const b = this.hero.body, S = STATS[f.kind];
    if (big(f) && f.slam) {
      const [x, y] = f.dash!;
      this.group.remove(f.slam); f.slam = undefined;
      this.ring(x, y, this.W.ground(x, y, b.z + 1, 2) + 0.2, 0xff7a50, 4.5);
      sfx.land();
      if (Math.hypot(b.x - x, b.y - y) < 4.5 && b.z - f.z < 4) this.hurt(S.dmg * 1.4 * this.lvMul(f), f);
      return;
    }
    if (Math.hypot(b.x - f.x, b.y - f.y) < reach && Math.abs(b.z - f.z) < 2) this.hurt(S.dmg * this.lvMul(f), f);
  }

  private hurt(dmg: number, from: Foe | null) {
    const b = this.hero.body;
    if (this.iframes > 0 || b.mode === 'roll' || this.downing) { if (b.mode === 'roll' && from) this.float(b.x, b.y, b.z + 2.2, '회피!', 'heal'); return; }
    const d = Math.round(dmg);
    this.hp -= d;
    this.iframes = 0.55;
    this.float(b.x, b.y, b.z + 2.2, `-${d}`, 'hurt');
    this.vignette.classList.remove('go'); void this.vignette.offsetWidth; this.vignette.classList.add('go');
    sfx.hurt();
    if (from) { const dx = b.x - from.x, dy = b.y - from.y, L = Math.hypot(dx, dy) || 1; b.shove((dx / L) * 0.8, (dy / L) * 0.8, this.W); }
    if (this.hp <= 0) void this.down();
  }
  /** 높은 데서 떨어져 다쳤다 */
  fallDamage(z: number) { if (z > 0) this.hurt(Math.min(this.maxHp * 0.3, 8 + z), null); }

  private async down() {
    this.hp = 0;
    this.downing = true;
    this.downs++;
    for (const f of this.foes) if (f.state !== 'dead') { f.state = 'return'; if (f.slam) { this.group.remove(f.slam); f.slam = undefined; } }
    this.c.toast(this.zone ? '💫 쓰러졌다… 비경에서 밀려난다' : '💫 쓰러졌다… 가까운 순간이동 포인트에서 다시 일어난다');
    await new Promise((r) => setTimeout(r, 1200));
    await this.c.respawn();
    this.hp = this.maxHp;
    this.energy = 0;
    this.downing = false;
  }

  // ───────── 우두머리 ─────────
  private stepBoss() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.zone) return;
    if (this.boss || this.bossDay === today) { if (this.boss) this.paintBoss(); return; }
    const spot = this.c.bossSpot();
    if (!spot) return;
    const b = this.hero.body;
    if (Math.hypot(spot[0] - b.x, spot[1] - b.y) > 120) return;
    this.boss = this.spawn('boss', spot[0], spot[1], spot[2], null);
    this.c.toast('👑 노트르담 뒤뜰에 큰 가고일이 깨어났다… (하루 한 번)');
  }
  private paintBoss() {
    const f = this.boss!;
    const show = f.state !== 'idle' && f.state !== 'return' && f.state !== 'dead';
    this.bossBar.classList.toggle('on', show);
    if (!show) return;
    this.bossBar.querySelector('b')!.textContent = `👑 ${STATS.boss.name} · Lv.${f.lv}`;
    (this.bossBar.querySelector('i') as HTMLElement).style.width = `${Math.max(0, (f.hp / f.maxHp) * 100)}%`;
    // 절반이 되면 작은 가고일 둘을 부른다
    if (f.hp < f.maxHp / 2 && !f.obj.userData.summoned) {
      f.obj.userData.summoned = true;
      for (const s of [-1, 1]) { const q = this.spawn('gargoyle', f.x + s * 4, f.y, f.z, null); this.aggro(q); }
      this.c.toast('👑 큰 가고일이 무리를 불렀다!');
    }
  }

  // ───────── 쥐왕 ─────────
  /** 쥐왕이 있나 · 어디 · 싸우는 중인가(첫걸음·리리가 본다) */
  kingInfo(): { x: number; y: number; hp: number; max: number; fighting: boolean } | null {
    const f = this.king;
    if (!f || f.state === 'dead') return null;
    return { x: f.x, y: f.y, hp: f.hp, max: f.maxHp, fighting: f.state !== 'idle' && f.state !== 'return' };
  }
  get kingSlainEver() { try { return !!localStorage.getItem('carnet-ratking-slain'); } catch { return false; } }
  private stepKing() {
    if (this.zone) return;
    const spot = this.c.kingSpot?.();
    if (!spot) return;
    const b = this.hero.body;
    const today = new Date().toISOString().slice(0, 10);
    if (!this.king) {
      if (this.kingDay === today || Math.hypot(spot[0] - b.x, spot[1] - b.y) > 420) return;
      this.king = this.spawn('ratking', spot[0], spot[1], spot[2], null);
      // 이름표(빨간 글씨) — 멀리서도 보인다
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
      const g = cv.getContext('2d')!;
      g.fillStyle = '#2a0d0dcc'; g.beginPath(); g.roundRect(6, 10, 500, 76, 26); g.fill();
      g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ff6b5e';
      g.fillText(`👑 ${STATS.ratking.name} · Lv.${RATKING_LV}`, 256, 50);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, depthTest: false }));
      plate.scale.set(6, 1.1, 1); plate.position.z = 7.2; plate.renderOrder = 5;
      this.king.obj.add(plate);
      if (!this.kingRing) {
        this.kingRing = new THREE.Mesh(new THREE.RingGeometry(14.2, 15, 64), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
        this.group.add(this.kingRing);
      }
    }
    const f = this.king;
    if (this.kingRing) { this.kingRing.visible = true; this.kingRing.position.set(f.home[0], f.home[1], this.W.ground(f.home[0], f.home[1], f.home[2] + 1, 2) + 0.08); (this.kingRing.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * Math.sin(performance.now() / 300); }
    const show = f.state !== 'idle' && f.state !== 'return' && f.state !== 'dead';
    if (show) {
      this.bossBar.classList.add('on');
      this.bossBar.querySelector('b')!.textContent = `👑 ${STATS.ratking.name} · Lv.${RATKING_LV}`;
      (this.bossBar.querySelector('i') as HTMLElement).style.width = `${Math.max(0, (f.hp / f.maxHp) * 100)}%`;
    } else if (!this.boss || this.boss.state === 'idle') this.bossBar.classList.remove('on');
    if (f.state === 'return') this.kingProvoked = false;
    // 절반이 되면 쥐 기사 셋을 부른다
    if (f.hp < f.maxHp / 2 && !f.obj.userData.summoned) {
      f.obj.userData.summoned = true;
      for (let i = 0; i < 3; i++) { const q = this.spawn('rat', f.x + Math.cos(i * 2.1) * 5, f.y + Math.sin(i * 2.1) * 5, f.z, null); this.aggro(q); }
      this.c.toast('🐀👑 쥐왕이 휘파람을 불었다 — 쥐 기사들이 몰려온다!');
    }
  }

  // ───────── 원소 폭발 ─────────
  private tornadoModel() {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - i * 0.5, 0.5 + i * 0.2, 7 - i, 18, 1, true).rotateX(Math.PI / 2).translate(0, 0, 3.5 - i * 0.2), new THREE.MeshBasicMaterial({ color: 0xbff7ea, transparent: true, opacity: 0.22 - i * 0.04, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      g.add(m);
    }
    return g;
  }
  private stepTornado(dt: number) {
    const T = this.tornado;
    if (!T) return;
    T.t += dt; T.tick -= dt;
    T.x += T.dx * 3.5 * dt; T.y += T.dy * 3.5 * dt;
    T.obj.position.set(T.x, T.y, this.W.ground(T.x, T.y, this.hero.body.z + 3, 6));
    T.obj.children.forEach((c, i) => { c.rotation.z = T.t * (6 + i * 2); });
    T.obj.scale.setScalar(Math.min(1, T.t * 3) * (T.t > 5.6 ? Math.max(0, (6 - T.t) / 0.4) : 1));
    for (const f of this.foes) {
      if (f.state === 'dead') continue;
      const d = Math.hypot(f.x - T.x, f.y - T.y);
      if (d < 5 && !big(f)) { f.x += (T.x - f.x) * Math.min(1, dt * 2.5); f.y += (T.y - f.y) * Math.min(1, dt * 2.5); f.lift = Math.max(f.lift, 0.8 + Math.sin(T.t * 6 + f.id) * 0.3); }
    }
    if (T.tick <= 0) {
      T.tick = 0.5;
      for (const f of this.foes) if (f.state !== 'dead' && Math.hypot(f.x - T.x, f.y - T.y) < (big(f) ? 5.5 : 3.8)) this.damage(f, this.atk * 1.15 * this.wep.burst, 'burst');
    }
    if (T.t > 6) { this.group.remove(T.obj); this.tornado = null; for (const f of this.foes) f.lift = Math.min(f.lift, 0.01); }
  }

  // ───────── 효과 ─────────
  private swing(x: number, y: number, z: number, facing: number, heavy: boolean) {
    const a0 = ((90 - facing) * Math.PI) / 180;
    const geo = new THREE.RingGeometry(1.2, heavy ? 3 : 2.6, 24, 1, a0 - 0.75, 1.5);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: heavy ? 0xfff2b0 : 0xe8f6ff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z);
    if (heavy) m.rotation.x = 0.35;
    this.group.add(m);
    this.fx.push({ obj: m, t: 0, life: 0.18, step: (o, t) => { ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t / 0.18); } });
  }
  private ring(x: number, y: number, z: number, color: number, r: number) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z);
    this.group.add(m);
    this.fx.push({ obj: m, t: 0, life: 0.45, step: (o, t) => { o.scale.setScalar(1 + (r - 1) * (t / 0.45)); ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - t / 0.45); } });
  }
  private burstWind(x: number, y: number, z: number, color: number) {
    const N = 40, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos.set([x, y, z], i * 3); const a = Math.random() * TAU, s = 2 + Math.random() * 3; vel.set([Math.cos(a) * s, Math.sin(a) * s, 1 + Math.random() * 3], i * 3); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.25, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false;
    this.group.add(pts);
    this.fx.push({ obj: pts, t: 0, life: 0.9, step: (o, t, dt) => { const a = (o as THREE.Points).geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { vel[i * 3 + 2] -= 6 * dt; a.setXYZ(i, a.getX(i) + vel[i * 3] * dt, a.getY(i) + vel[i * 3 + 1] * dt, a.getZ(i) + vel[i * 3 + 2] * dt); } a.needsUpdate = true; ((o as THREE.Points).material as THREE.PointsMaterial).opacity = 1 - t / 0.9; } });
  }
  private stepFx(dt: number) {
    for (const e of this.fx.slice()) {
      e.t += dt;
      e.step?.(e.obj, e.t, dt);
      if (e.t >= e.life) { this.group.remove(e.obj); this.fx = this.fx.filter((q) => q !== e); }
    }
  }

  // ───────── 화면(피·쿨타임·데미지 숫자) ─────────
  private float(x: number, y: number, z: number, text: string, cls: string) {
    const el = document.createElement('div');
    el.className = `cbt-num ${cls}`;
    el.textContent = text;
    this.layer.appendChild(el);
    const born = performance.now();
    const off = (Math.random() - 0.5) * 30;
    const tick = () => {
      const t = (performance.now() - born) / 1000;
      if (t > 0.9 || !el.isConnected) { el.remove(); return; }
      if (this.hero.view.project(x, y, z + t * 0.8, this.pt)) { el.style.transform = `translate(${this.pt.x + off}px, ${this.pt.y}px) translate(-50%, -50%)`; el.style.opacity = `${1 - Math.max(0, t - 0.5) / 0.4}`; }
      requestAnimationFrame(tick);
    };
    tick();
  }

  private paintHud() {
    const hpPct = Math.max(0, this.hp / this.maxHp);
    this.hpBar.style.width = `${hpPct * 100}%`;
    this.hpBar.classList.toggle('low', hpPct < 0.3);
    this.hpText.textContent = `${Math.ceil(Math.max(0, this.hp))} / ${this.maxHp}`;
    this.ui.classList.toggle('fight', this.inCombat || hpPct < 0.999 || this.hero.body.drawn > 0);
    (this.skillBtn.querySelector('i') as HTMLElement).style.setProperty('--p', `${(this.skillCd / this.skillMax) * 100}%`);
    this.skillBtn.classList.toggle('cool', this.skillCd > 0);
    const we = this.c.weapon?.().emoji ?? '⚔️';
    if (this.atkBtn.textContent !== we) this.atkBtn.textContent = we;
    (this.burstBtn.querySelector('i') as HTMLElement).style.setProperty('--p', `${(1 - this.energy / this.energyMax) * 100}%`);
    this.burstBtn.classList.toggle('ready', this.energy >= this.energyMax);
  }

  /** 적 머리 위 피 막대(싸우는 중이거나 맞은 적만) */
  private paintMarks() {
    for (const f of this.foes) {
      const show = f.state !== 'dead' && !big(f) && (f.seen > 0 || f.state === 'chase' || f.state === 'windup' || f.state === 'dash' || f.state === 'recover') && f.obj.visible;
      if (!show) { if (f.bar) { f.bar.remove(); f.bar = null; } continue; }
      if (!f.bar) { f.bar = document.createElement('div'); f.bar.className = 'cbt-bar'; f.bar.innerHTML = `<small>Lv.${f.lv}</small><span><i></i></span>`; this.layer.appendChild(f.bar); }
      if (this.hero.view.project(f.x, f.y, f.z + f.lift + (f.kind === 'gargoyle' ? 1.6 : 1.5), this.pt)) {
        f.bar.style.transform = `translate(${this.pt.x}px, ${this.pt.y}px) translate(-50%, -100%)`;
        (f.bar.querySelector('i') as HTMLElement).style.width = `${(f.hp / f.maxHp) * 100}%`;
      }
    }
  }

  /** 미니맵: 싸우는 적은 빨간 점 */
  marks(): { x: number; y: number; icon: string }[] {
    return this.foes.filter((f) => f.state !== 'dead').map((f) => ({ x: f.x, y: f.y, icon: f.kind === 'boss' ? '👑' : f.kind === 'ratking' ? '🐀👑' : f.kind === 'slime' ? '🌫' : f.kind === 'rat' ? '🐀' : '🗿' }));
  }
  list() { return this.foes.map((f) => ({ id: f.id, kind: f.kind, x: f.x, y: f.y, z: f.z, hp: f.hp, max: f.maxHp, state: f.state, camp: f.camp?.key ?? null })); }
  campDone(key: string) { return !!this.camps.get(key)?.done; }
}
