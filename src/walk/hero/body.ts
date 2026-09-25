// 몸. 달리고, 뛰고, 벽을 타고, 지붕에서 활공하고, 센 강에서 헤엄친다.
// 기력(스태미나)은 전력질주·벽타기·활공·빠른 헤엄에서 줄고, 발을 땅에 딛고 쉬면 찬다. 바닥나면 한동안 숨을 고른다.
import { WATER_Z } from './terrain';
import { World } from './world';
import type { Solid } from './world';
import { angleDiff, bearingOf, dirOf } from './geo';

export type Mode = 'ground' | 'air' | 'glide' | 'climb' | 'mantle' | 'swim' | 'down' | 'roll' | 'slide' | 'sit' | 'act' | 'stagger';
export type BodyEvent = 'jump' | 'land' | 'hurt' | 'glide' | 'unglide' | 'grab' | 'mantle' | 'vault' | 'climbjump' | 'drop' | 'splash' | 'drown' | 'exhausted' | 'recovered' | 'stepL' | 'stepR' | 'stroke'
  | 'roll' | 'rollLand' | 'slide' | 'crouch' | 'uncrouch' | 'sit' | 'stand' | 'shutter' | 'stagger' | 'actDone';
/** 제자리에서 하는 동작. dance·lie는 움직이면 끝나고, 나머지는 정해진 시간이 지나면 끝난다. */
export type Act = 'dance' | 'photo' | 'drink' | 'eat' | 'clap' | 'lie' | 'push' | 'tip' | 'feed' | 'pet' | 'stretch' | 'think';
/** 손에 든 것 */
export type Carry = null | 'crepe' | 'baguette' | 'coffee' | 'balloon' | 'flowers' | 'book';
const ACT_SECS: Record<Act, number> = { dance: Infinity, lie: Infinity, photo: 1.25, drink: 2.2, eat: 1.9, clap: 2.2, push: 0.7, tip: 1.1, feed: 2.4, pet: 2.2, stretch: 2.4, think: 1.8 };
export interface Seat { x: number; y: number; z: number; facing: number }

export interface Intent {
  mx: number; my: number; // 가고 싶은 방향(세계 좌표, 크기 0..1)
  sprint: boolean;
  jump: boolean; // 이번 프레임에 눌렀다
  drop: boolean;
  crouch?: boolean; // 이번 프레임에 눌렀다 — 웅크리기 전환(달리는 중이면 미끄러지기)
  roll?: boolean; // 이번 프레임에 눌렀다 — 앞구르기(공중에서 누르면 착지 구르기)
  pace: number; // 지치면 느려진다
  maxStamina: number;
  /** 자동으로 걷는 중(지도에서 찍은 길) — 벽을 타거나 넘지 않는다 */
  auto?: boolean;
}

export const R = 0.32;
const H = 1.75;
const STEP = 0.45;
const G = 21;
const JUMP_V = 7.4;
const WALK = 1.7, RUN = 4.6, SPRINT = 7.2, TIRED = 1.4, SNEAK = 1.25;
const ROLL_SECS = 0.62, ROLL_V = 5.4;
const SLIDE_SECS = 0.95;
const SAFE_ROLL = 16; // m — 착지 직전에 구르면 이 높이까지는 다치지 않는다
const SWIM = 1.9, SWIM_FAST = 3.6;
const CLIMB_UP = 1.4, CLIMB_SIDE = 1.25;
const GLIDE_FWD = 6.4, GLIDE_SINK = 1.9;
const PARA_FWD = 20, PARA_DIVE = 30; // 낙하산 순항·급강하 앞으로 속도(m/s)
const HURT_FALL = 7; // m — 이보다 높이서 그냥 떨어지면 주저앉는다

const approach = (v: number, to: number, d: number) => (v < to ? Math.min(to, v + d) : Math.max(to, v - d));

export class Body {
  x = 0; y = 0; z = 0;
  vx = 0; vy = 0; vz = 0;
  facing = 0;
  mode: Mode = 'ground';
  stamina = 1;
  maxStamina = 1;
  exhausted = false;
  restT = 0;
  wall: { nx: number; ny: number; solid: Solid } | null = null;
  private pushT = 0;
  private mantle = { t: 0, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };
  private climbJump = { t: 0, ux: 0, uz: 0 };
  private downT = 0;
  private rollT = 0; private rollV = 0;
  private slideT = 0; private slideV = 0;
  private rollBuf = 0; // 공중에서 구르기를 눌러 둔 시간
  private staggerT = 0;
  private staggerCool = 0;
  crouch = false;
  act: { kind: Act; t: number; dur: number } | null = null;
  waveT = 0; // 걸으면서도 손을 흔든다(윗몸만)
  pointT = 0; // 방향을 가리킨다(윗몸만)
  carry: Carry = null;
  seatZ = 0;
  idleT = 0; // 가만히 서 있은 시간 — 두리번거리기
  fallTopZ = 0;
  safe = { x: 0, y: 0, z: 0 };
  speed = 0; // 수평 속력(m/s)
  climbMove = 0; // 벽에서 움직이는 정도 0..1
  phase = 0; // 걸음·팔 동작 위상
  gliderOpen = 0; // 0..1 펼쳐진 정도
  moved = 0; // 이번 프레임에 수평으로 간 거리
  lift = 0; // 이번 프레임에 올라간 높이
  events: BodyEvent[] = [];

  place(x: number, y: number, z = 0) {
    this.x = x; this.y = y; this.z = z;
    this.vx = this.vy = this.vz = 0;
    this.mode = 'ground';
    this.wall = null;
    this.act = null;
    this.crouch = false;
    this.safe = { x, y, z };
  }

  /** 낙하산(시작할 때): 기력을 쓰지 않고, 땅에 닿을 때까지 펼쳐 둔다. Shift = 급강하 */
  parachute = false;
  /** 숨은 보상: 에펠탑 꼭대기에 내려앉으면 글라이더가 금빛 낙하산이 된다(빠르고 기력을 안 쓴다) */
  golden = false;
  /** 입은 장비가 몸에 주는 것(곱) — gear.ts의 modsOf */
  mods = { run: 1, climb: 1, glide: 1, hurt: 1, swim: 1, steady: false };
  skydive(x: number, y: number, z: number, facing: number) {
    this.place(x, y, z);
    this.facing = facing;
    // 처음엔 자유낙하 — 점프로 낙하산을 편다(땅에서 120 m 남으면 저절로 펴진다)
    this.mode = 'air';
    this.freefall = true;
    this.parachute = false;
    this.fallTopZ = z;
    this.vz = -4;
    const [fx, fy] = dirOf(facing);
    this.vx = fx * 6; this.vy = fy * 6;
  }
  /** 자유낙하 중(스카이다이빙 시작) */
  freefall = false;
  private openChute() {
    this.freefall = false;
    this.mode = 'glide';
    this.parachute = true;
    this.vz = Math.max(this.vz, -14); // 펴지는 순간 확 잡아챈다
    this.events.push('glide');
  }

  // ───────── 밖(게임)에서 시키는 동작 ─────────
  /** 제자리 동작을 시작한다. 땅 위(또는 앉아 있을 때 사진)만 된다. */
  doAct(kind: Act): boolean {
    if (this.mode !== 'ground' && !(this.mode === 'sit' && (kind === 'photo' || kind === 'eat' || kind === 'clap'))) return false;
    if (this.mode === 'sit') { this.act = { kind, t: 0, dur: ACT_SECS[kind] }; return true; }
    this.mode = 'act';
    this.act = { kind, t: 0, dur: ACT_SECS[kind] };
    this.speed = 0; this.vx = this.vy = 0;
    this.crouch = kind === 'pet' || kind === 'feed' ? this.crouch : false;
    return true;
  }
  /** 손을 흔든다(봉주르). 걸으면서도 된다. */
  wave() { if (this.mode === 'ground' || this.mode === 'sit' || this.mode === 'act') { this.waveT = 1.6; return true; } return false; }
  /** 어느 쪽을 가리킨다. */
  point(facing: number) { if (this.mode !== 'ground' && this.mode !== 'act') return false; this.facing = facing; this.pointT = 1.8; this.speed = 0; return true; }
  /** 앉는다. seat가 없으면 그 자리 바닥에. */
  sit(seat: Seat | null): boolean {
    if (this.mode !== 'ground' && this.mode !== 'act') return false;
    this.act = null;
    this.mode = 'sit';
    this.crouch = false;
    if (seat) { this.x = seat.x; this.y = seat.y; this.z = seat.z; this.facing = seat.facing; this.seatZ = seat.z; }
    else this.seatZ = -1; // 바닥에 앉는다
    this.vx = this.vy = this.vz = 0;
    this.speed = 0;
    this.events.push('sit');
    return true;
  }
  /** 사람과 부딪혀 휘청인다 */
  stagger(nx: number, ny: number, power = 2.2) {
    if (this.mode !== 'ground' && this.mode !== 'act') return;
    if (this.mods.steady) return; // 가죽 재킷: 버틴다
    if (this.staggerCool > 0) return; // 한 번 휘청였으면 잠깐은 버틴다(사람 무리를 뚫고 가다 연달아 휘청이지 않게)
    this.staggerCool = 2.2;
    this.mode = 'stagger';
    this.act = null;
    this.staggerT = 0.55;
    this.vx = nx * power; this.vy = ny * power;
    this.speed = 0;
    this.events.push('stagger');
  }

  step(dt: number, w: World, it: Intent) {
    this.events.length = 0;
    this.maxStamina = Math.max(0.25, it.maxStamina);
    const x0 = this.x, y0 = this.y, z0 = this.z;
    let m = Math.hypot(it.mx, it.my);
    const ix = m > 1e-3 ? it.mx / m : 0, iy = m > 1e-3 ? it.my / m : 0;
    m = Math.min(1, m);

    switch (this.mode) {
      case 'ground': this.ground(dt, w, it, m, ix, iy); break;
      case 'air': this.air(dt, w, it, m, ix, iy, false); break;
      case 'glide': this.air(dt, w, it, m, ix, iy, true); break;
      case 'climb': this.climb(dt, w, it); break;
      case 'mantle': this.doMantle(dt); break;
      case 'swim': this.swim(dt, w, it, m, ix, iy); break;
      case 'down': this.downT -= dt; this.speed = 0; if (this.downT <= 0) this.mode = 'ground'; this.rest(dt); break;
      case 'roll': this.rolling(dt, w, it, m, ix, iy); break;
      case 'slide': this.sliding(dt, w, it, m, ix, iy); break;
      case 'sit': this.sitting(dt, it, m); break;
      case 'act': this.acting(dt, w, it, m); break;
      case 'stagger': this.staggering(dt, w); break;
    }
    if (this.waveT > 0) this.waveT -= dt;
    if (this.staggerCool > 0) this.staggerCool -= dt;
    if (this.pointT > 0) this.pointT -= dt;
    this.idleT = (this.mode === 'ground' && this.speed < 0.1) ? this.idleT + dt : 0;
    this.gliderOpen = approach(this.gliderOpen, this.mode === 'glide' ? 1 : 0, dt * 4);
    this.moved = Math.hypot(this.x - x0, this.y - y0);
    this.lift = Math.max(0, this.z - z0);
    if (this.stamina > this.maxStamina) this.stamina = this.maxStamina;
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || !Number.isFinite(this.z)) this.place(this.safe.x, this.safe.y, this.safe.z);
  }

  // ───────── 기력 ─────────
  private spend(amount: number) {
    this.restT = 0;
    this.stamina = Math.max(0, this.stamina - amount);
    if (this.stamina <= 0 && !this.exhausted) { this.exhausted = true; this.events.push('exhausted'); }
  }
  private rest(dt: number) {
    this.restT += dt;
    if (this.restT < 0.7) return;
    this.stamina = Math.min(this.maxStamina, this.stamina + dt * (this.exhausted ? 0.3 : 0.5));
    if (this.exhausted && this.stamina >= this.maxStamina - 1e-3) { this.exhausted = false; this.events.push('recovered'); }
  }
  get canExert() { return !this.exhausted && this.stamina > 0; }

  private turn(to: number, rate: number) {
    const d = angleDiff(this.facing, to);
    this.facing = (this.facing + Math.sign(d) * Math.min(Math.abs(d), rate) + 360) % 360;
  }

  private stride(dt: number, len: number) {
    const before = Math.floor(this.phase / Math.PI);
    this.phase += (this.speed * dt * Math.PI) / len;
    const after = Math.floor(this.phase / Math.PI);
    if (after !== before) this.events.push(after % 2 ? 'stepL' : 'stepR');
  }

  // ───────── 땅 위 ─────────
  private ground(dt: number, w: World, it: Intent, m: number, ix: number, iy: number) {
    if (it.roll && this.stamina > 0.05 && !this.exhausted) { this.startRoll(m >= 0.08 ? bearingOf(ix, iy) : this.facing, false); return; }
    if (it.crouch) {
      if (this.speed > RUN * 0.8 && !this.crouch) { this.startSlide(); return; }
      this.crouch = !this.crouch;
      this.events.push(this.crouch ? 'crouch' : 'uncrouch');
    }
    if (this.crouch && it.sprint && m > 0.2) { this.crouch = false; this.events.push('uncrouch'); }
    const sprinting = it.sprint && m > 0.2 && this.canExert && !this.crouch;
    let want = m < 0.08 ? 0 : m < 0.6 ? WALK + (RUN - WALK) * ((m - 0.08) / 0.52) : RUN;
    if (sprinting) want = SPRINT;
    if (want > WALK) want *= this.mods.run;
    if (this.crouch) want = Math.min(want, SNEAK * Math.max(0.4, m));
    if (this.pointT > 0) want = 0;
    if (this.exhausted) want = Math.min(want, TIRED);
    want *= it.pace;
    if (m >= 0.08) {
      const d = Math.abs(angleDiff(this.facing, bearingOf(ix, iy)));
      this.turn(bearingOf(ix, iy), (sprinting ? 520 : 820) * dt);
      if (d > 100) want *= 0.35; // 거의 뒤돌 때는 속도를 죽이고 돈다
    }
    this.speed = approach(this.speed, want, (want > this.speed ? 18 : 26) * dt);
    const [fx, fy] = dirOf(this.facing);
    this.vx = fx * this.speed; this.vy = fy * this.speed; this.vz = 0;
    const p = { x: this.x + this.vx * dt, y: this.y + this.vy * dt };
    const hit = w.collide(p, this.z, R, H, STEP);
    if (hit) {
      // 벽에 막힌 만큼 실제 속력도 줄인다
      const into = -(fx * hit.nx + fy * hit.ny);
      if (into > 0.2) this.speed *= 1 - into * 0.5;
      // 걷다가 스치기만 해도 벽을 타면 이상하다: 벽 쪽으로 똑바로(±37°), 잠깐 밀고 있어야 오르거나 넘는다.
      // 가로등·나무 줄기·난간처럼 가는 것은 타지 않고 비켜 간다(달리면 난간은 넘는다).
      const dot = -(ix * hit.nx + iy * hit.ny);
      const toward = m >= 0.08 && dot > 0.55 && !it.auto;
      this.pushT = toward && dot > 0.78 ? this.pushT + dt : 0;
      const rise = hit.top - this.z;
      const so = hit.solid, w0 = Math.min(so.maxX - so.minX, so.maxY - so.minY), w1 = Math.max(so.maxX - so.minX, so.maxY - so.minY);
      const thin = w0 < 0.45 || w1 < 1.2; // 기둥·말뚝·난간
      const running = sprinting || this.speed > RUN * 0.85;
      if (rise <= 1.4 && this.pushT > (running ? 0.06 : 0.28) && (!thin || (running && rise < 1.15))) { this.startMantle(hit.cx, hit.cy, hit.nx, hit.ny, hit.top); return; }
      if (!thin && rise > 1.4 && this.pushT > (running ? 0.18 : so.kind === 'prop' ? 0.5 : 0.35) && this.canExert) { this.grab(hit); return; }
    } else this.pushT = 0;
    this.x = p.x; this.y = p.y;
    if (sprinting && this.speed > RUN) this.spend(dt * 0.17); else this.rest(dt);
    this.stride(dt, this.speed > RUN + 0.5 ? 2.1 : 1.5);

    const g = w.ground(this.x, this.y, this.z, STEP + 0.1);
    // 계단·턱 한 칸 정도는 걸어서 내려간다. 그보다 높으면 발을 헛디딘 것.
    if (this.z - g > STEP + 0.06) { this.mode = 'air'; this.fallTopZ = this.z; this.vz = 0; this.crouch = false; return; }
    this.z = g;
    if (g < WATER_Z + 0.3 && w.water(this.x, this.y)) { this.enterWater(); return; }
    this.safe = { x: this.x, y: this.y, z: this.z };
    if (it.jump) { this.vz = JUMP_V * (this.crouch ? 0.8 : 1); this.mode = 'air'; this.fallTopZ = this.z; this.crouch = false; this.rollBuf = 0; this.events.push('jump'); }
  }

  // ───────── 구르기 · 미끄러지기 ─────────
  private startRoll(dir: number, landing: boolean) {
    this.mode = 'roll';
    this.rollT = 0;
    this.facing = dir;
    this.crouch = false;
    this.rollV = Math.max(landing ? 4 : ROLL_V, Math.min(SPRINT, this.speed * (landing ? 0.9 : 1.05)));
    if (!landing) this.spend(0.1);
    this.events.push(landing ? 'rollLand' : 'roll');
  }
  private rolling(dt: number, w: World, it: Intent, m: number, ix: number, iy: number) {
    this.rollT += dt;
    if (m >= 0.08) this.turn(bearingOf(ix, iy), 120 * dt);
    const k = this.rollT / ROLL_SECS;
    this.speed = this.rollV * (1 - 0.55 * k);
    const [fx, fy] = dirOf(this.facing);
    const p = { x: this.x + fx * this.speed * dt, y: this.y + fy * this.speed * dt };
    const hit = w.collide(p, this.z, R, 1.0, STEP);
    if (hit && -(fx * hit.nx + fy * hit.ny) > 0.5) this.rollV *= 0.5; // 벽에 부딪히면 멈춘다
    this.x = p.x; this.y = p.y;
    this.phase += dt * 10;
    const g = w.ground(this.x, this.y, this.z, STEP + 0.1);
    if (this.z - g > STEP + 0.06) { this.mode = 'air'; this.fallTopZ = this.z; this.vz = 0; this.vx = fx * this.speed; this.vy = fy * this.speed; return; }
    this.z = g;
    if (g < WATER_Z + 0.3 && w.water(this.x, this.y)) { this.enterWater(); return; }
    if (this.rollT >= ROLL_SECS) { this.mode = 'ground'; this.speed = Math.min(this.speed, RUN); if (it.jump) { this.vz = JUMP_V; this.mode = 'air'; this.fallTopZ = this.z; this.events.push('jump'); } }
  }
  private startSlide() {
    this.mode = 'slide';
    this.slideT = 0;
    this.slideV = Math.min(SPRINT + 1.2, this.speed + 1.4);
    this.crouch = false;
    this.spend(0.06);
    this.events.push('slide');
  }
  private sliding(dt: number, w: World, it: Intent, m: number, ix: number, iy: number) {
    this.slideT += dt;
    if (m >= 0.08) this.turn(bearingOf(ix, iy), 70 * dt);
    const k = Math.min(1, this.slideT / SLIDE_SECS);
    this.speed = this.slideV * (1 - k) + 1.2 * k;
    const [fx, fy] = dirOf(this.facing);
    const p = { x: this.x + fx * this.speed * dt, y: this.y + fy * this.speed * dt };
    const hit = w.collide(p, this.z, R, 0.9, STEP);
    if (hit && -(fx * hit.nx + fy * hit.ny) > 0.5) this.slideV *= 0.4;
    this.x = p.x; this.y = p.y;
    const g = w.ground(this.x, this.y, this.z, STEP + 0.1);
    if (this.z - g > STEP + 0.06) { this.mode = 'air'; this.fallTopZ = this.z; this.vz = 0; this.vx = fx * this.speed; this.vy = fy * this.speed; return; }
    this.z = g;
    if (g < WATER_Z + 0.3 && w.water(this.x, this.y)) { this.enterWater(); return; }
    if (it.jump) { this.vz = JUMP_V * 1.05; this.mode = 'air'; this.fallTopZ = this.z; this.vx = fx * this.speed; this.vy = fy * this.speed; this.events.push('jump'); return; } // 미끄러지다 뛰면 멀리 뛴다
    if (this.slideT >= SLIDE_SECS) { this.mode = 'ground'; this.crouch = !!it.crouch; }
  }

  // ───────── 앉기 · 제자리 동작 ─────────
  private sitting(dt: number, it: Intent, m: number) {
    this.speed = 0;
    this.restT = 1; // 앉으면 바로 숨이 돌아온다
    this.stamina = Math.min(this.maxStamina, this.stamina + dt * 0.9);
    if (this.exhausted && this.stamina >= this.maxStamina - 1e-3) { this.exhausted = false; this.events.push('recovered'); }
    if (this.act) { this.act.t += dt; if (this.act.kind === 'photo' && this.act.t - dt < 0.7 && this.act.t >= 0.7) this.events.push('shutter'); if (this.act.t >= this.act.dur) { this.act = null; this.events.push('actDone'); } }
    if (m > 0.35 || it.jump) { this.mode = 'ground'; this.act = null; this.events.push('stand'); }
  }
  private acting(dt: number, w: World, it: Intent, m: number) {
    const a = this.act;
    this.speed = 0;
    if (!a) { this.mode = 'ground'; return; }
    a.t += dt;
    if (a.kind === 'photo' && a.t - dt < 0.7 && a.t >= 0.7) this.events.push('shutter');
    if (a.kind === 'lie') { this.restT = 1; this.stamina = Math.min(this.maxStamina, this.stamina + dt * 0.8); } else this.rest(dt);
    this.phase += dt * (a.kind === 'dance' ? 7 : 3);
    const cancel = (m > 0.35 && (a.dur === Infinity || a.t > 0.3)) || it.jump;
    if (a.t >= a.dur || cancel) {
      this.mode = 'ground';
      this.act = null;
      this.events.push('actDone');
      if (it.jump && this.z - w.ground(this.x, this.y, this.z, 0.1) < 0.1) { this.vz = JUMP_V; this.mode = 'air'; this.fallTopZ = this.z; this.events.push('jump'); }
    }
  }
  private staggering(dt: number, w: World) {
    this.staggerT -= dt;
    this.vx *= Math.exp(-dt * 5); this.vy *= Math.exp(-dt * 5);
    const p = { x: this.x + this.vx * dt, y: this.y + this.vy * dt };
    w.collide(p, this.z, R, H, STEP);
    this.x = p.x; this.y = p.y;
    this.phase += dt * 6;
    if (this.staggerT <= 0) this.mode = 'ground';
  }

  /** 다른 몸(사람)에서 밀려난다 — 겹친 만큼 옮긴다. 벽 속으로 밀려 들어가지는 않는다. */
  shove(dx: number, dy: number, w: World) {
    const p = { x: this.x + dx, y: this.y + dy };
    w.collide(p, this.z, R, H, STEP);
    this.x = p.x; this.y = p.y;
  }

  // ───────── 공중 · 활공 ─────────
  private air(dt: number, w: World, it: Intent, m: number, ix: number, iy: number, gliding: boolean) {
    const floor = w.ground(this.x, this.y, this.z + 0.05, 0.05);
    if (it.roll) this.rollBuf = 0.45; else if (this.rollBuf > 0) this.rollBuf -= dt;
    // 스카이다이빙: 점프로 펴거나, 너무 낮아지면 저절로
    if (this.freefall && !gliding && (it.jump || this.z - floor < 120)) { this.openChute(); return; }
    if (it.jump && !this.freefall) {
      if (gliding) { this.mode = 'air'; this.fallTopZ = this.z; this.events.push('unglide'); gliding = false; this.parachute = false; }
      else if (this.z - floor > 1.3 && this.canExert) { this.mode = 'glide'; this.events.push('glide'); gliding = true; }
    }
    if (gliding) {
      // 낙하산: 파리 어디로든 갈 수 있게 빠르게 난다(순항 20 m/s, 3 m/s씩 가라앉음 → 430 m에서 약 2.8 km).
      // 달리기 = 급강하(빨리 내려가며 더 빠르게), 손을 떼도 앞으로 흘러간다.
      const chute = this.parachute || this.golden;
      const sink = chute ? (it.sprint ? 11 : (this.parachute ? 3.1 : 2.5) * this.mods.glide) : GLIDE_SINK * this.mods.glide;
      this.vz += (-sink - this.vz) * Math.min(1, dt * 3.5);
      if (m >= 0.08) this.turn(bearingOf(ix, iy), (chute ? 110 : 150) * dt);
      const want = chute
        ? (it.sprint ? PARA_DIVE : m >= 0.08 ? PARA_FWD * (0.55 + 0.45 * m) : PARA_FWD * 0.45)
        : (m >= 0.08 ? GLIDE_FWD * m : 2.2) * Math.max(0.7, it.pace);
      const [fx, fy] = dirOf(this.facing);
      const s = Math.hypot(this.vx, this.vy);
      const ns = approach(s, want, dt * (chute ? 9 : 5));
      this.vx = fx * ns; this.vy = fy * ns;
      if (!chute) this.spend(dt * 0.06);
      if (this.exhausted && !chute) { this.mode = 'air'; this.fallTopZ = this.z; this.events.push('unglide'); }
      this.fallTopZ = this.z;
    } else if (this.freefall) {
      // 자유낙하: 종단 속도 50 m/s, 몸을 기울여 방향을 튼다(트래킹 — 앞으로 18 m/s까지)
      this.vz = Math.max(it.sprint ? -62 : -50, this.vz - G * dt);
      if (m >= 0.08) this.turn(bearingOf(ix, iy), 120 * dt);
      const [fx, fy] = dirOf(this.facing);
      const want = m >= 0.08 ? 18 * m : 5;
      const ns = approach(Math.hypot(this.vx, this.vy), want, dt * 6);
      this.vx = fx * ns; this.vy = fy * ns;
      this.fallTopZ = this.z; // 낙하산을 펴고 내려앉으니 다치지 않는다
    } else {
      this.vz = Math.max(-45, this.vz - G * dt);
      // 공중에서도 조금은 방향을 튼다
      if (m >= 0.08) {
        this.turn(bearingOf(ix, iy), 360 * dt);
        const cap = Math.max(RUN * 0.8, Math.hypot(this.vx, this.vy));
        this.vx += ix * m * 9 * dt; this.vy += iy * m * 9 * dt;
        const s = Math.hypot(this.vx, this.vy);
        if (s > cap) { this.vx *= cap / s; this.vy *= cap / s; }
      }
      this.fallTopZ = Math.max(this.fallTopZ, this.z);
    }
    this.speed = Math.hypot(this.vx, this.vy);
    const p = { x: this.x + this.vx * dt, y: this.y + this.vy * dt };
    const nz = this.z + this.vz * dt;
    // 강으로 떨어지면 물낯에서 헤엄친다(바닥은 그 아래)
    if (this.vz <= 0 && nz <= WATER_Z && this.z >= WATER_Z - 0.6 && w.water(p.x, p.y)) { this.x = p.x; this.y = p.y; this.enterWater(); return; }
    const hit = w.collide(p, Math.max(nz, this.z - 0.2), R, H, 0.05);
    if (hit) {
      const rise = hit.top - nz;
      const toward = -((m >= 0.08 ? ix : this.vx) * hit.nx + (m >= 0.08 ? iy : this.vy) * hit.ny) > 0;
      // 떨어지며 방금 딛고 있던 것 모서리에 걸린 것(높이 차 없음·멀어지는 중)은 다시 올라서지 않는다 — 올라섰다 떨어졌다를 되풀이했다
      if (rise <= 1.1 && rise > 0.25 && toward && this.vz < 3) { this.startMantle(hit.cx, hit.cy, hit.nx, hit.ny, hit.top); return; }
      const so = hit.solid, thin = Math.min(so.maxX - so.minX, so.maxY - so.minY) < 0.45 || Math.max(so.maxX - so.minX, so.maxY - so.minY) < 1.2;
      if (toward && !thin && rise > 1.1 && this.canExert) { this.x = p.x; this.y = p.y; this.z = nz; this.grab(hit); return; } // 낮은 것은 붙잡지 않는다(그냥 내려앉는다)
      const into = this.vx * hit.nx + this.vy * hit.ny;
      if (into < 0) { this.vx -= into * hit.nx; this.vy -= into * hit.ny; }
    }
    this.x = p.x; this.y = p.y;
    if (nz <= floor && this.vz <= 0) {
      this.z = floor;
      const fell = this.fallTopZ - floor;
      if (floor < WATER_Z + 0.3 && w.water(this.x, this.y)) { this.enterWater(); return; }
      this.vz = 0;
      this.parachute = false; this.freefall = false;
      const buffered = this.rollBuf > 0;
      this.rollBuf = 0;
      // 착지 직전에 구르면 충격을 흘려 보낸다(낙법)
      if (!gliding && buffered && fell < SAFE_ROLL * this.mods.hurt) { this.startRoll(Math.hypot(this.vx, this.vy) > 0.5 ? bearingOf(this.vx, this.vy) : this.facing, true); return; }
      if (!gliding && fell > HURT_FALL * this.mods.hurt) { this.mode = 'down'; this.downT = 1.1; this.speed = 0; this.events.push('hurt'); }
      else { this.mode = 'ground'; this.events.push('land'); this.speed = gliding ? Math.min(this.speed * 0.5, 4) : this.speed * 0.8; } // 빨리 날다 내려앉아도 몇 걸음에 선다
      return;
    }
    this.z = nz;
    if (!gliding) this.rest(0); else this.restT = 0;
  }

  // ───────── 벽타기 ─────────
  private grab(hit: { nx: number; ny: number; solid: Solid; cx: number; cy: number }) {
    this.parachute = false; this.freefall = false;
    this.mode = 'climb';
    this.wall = { nx: hit.nx, ny: hit.ny, solid: hit.solid };
    this.x = hit.cx + hit.nx * R; this.y = hit.cy + hit.ny * R;
    this.vx = this.vy = this.vz = 0;
    this.speed = 0;
    this.pushT = 0;
    this.facing = bearingOf(-hit.nx, -hit.ny);
    this.events.push('grab');
  }

  private climb(dt: number, w: World, it: Intent) {
    const wall = this.wall!;
    this.restT = 0;
    if (it.drop) { this.release(1.4); this.events.push('drop'); return; }
    const rx = -wall.ny, ry = wall.nx; // 벽을 보고 섰을 때 오른쪽
    let up = -(it.mx * wall.nx + it.my * wall.ny);
    let side = it.mx * rx + it.my * ry;
    if (this.climbJump.t > 0) {
      this.climbJump.t -= dt;
      up = this.climbJump.uz; side = this.climbJump.ux;
      this.z += up * 6 * dt;
      this.x += rx * side * 5 * dt; this.y += ry * side * 5 * dt;
    } else {
      if (it.jump && this.stamina > 0.02) {
        const k = Math.hypot(up, side);
        this.climbJump = { t: 0.34, uz: k > 0.2 ? up / k : 1, ux: k > 0.2 ? side / k : 0 };
        this.spend(0.22 * this.mods.climb);
        this.events.push('climbjump');
        return;
      }
      const s = Math.min(1, Math.hypot(up, side));
      this.climbMove = s;
      if (s > 0.08) this.spend(dt * 0.055 * s * this.mods.climb); // 한 바퀴로 25 m쯤 — 파리 건물(15~25 m)은 끝까지 오를 수 있다
      this.z += up * CLIMB_UP * it.pace * dt;
      this.x += rx * side * CLIMB_SIDE * it.pace * dt; this.y += ry * side * CLIMB_SIDE * it.pace * dt;
      this.phase += s * dt * 5.5;
    }
    if (this.exhausted) { this.release(0.8); return; }
    // 벽에 다시 붙인다. 모서리를 돌면 법선이 따라 돈다. 옆 건물로 넘어가면 그 벽으로 갈아탄다.
    const c = World.closest(wall.solid, this.x, this.y);
    if (c.d > 1.2) { this.release(0.5); return; }
    this.x = c.cx + c.nx * R; this.y = c.cy + c.ny * R;
    wall.nx = c.nx; wall.ny = c.ny;
    const p = { x: this.x, y: this.y };
    const other = w.collide(p, this.z, R * 0.9, H, 0.05);
    if (other && other.solid !== wall.solid) { this.x = p.x; this.y = p.y; this.wall = { nx: other.nx, ny: other.ny, solid: other.solid }; }
    this.facing = bearingOf(-this.wall!.nx, -this.wall!.ny);
    const top = this.wall!.solid.top;
    if (this.z + 1.0 >= top && up > 0.1) { this.climbJump.t = 0; this.startMantle(this.x - this.wall!.nx * R, this.y - this.wall!.ny * R, this.wall!.nx, this.wall!.ny, top); return; }
    if (this.z > top) this.z = top;
    const floor = w.ground(this.x + this.wall!.nx * 0.1, this.y + this.wall!.ny * 0.1, this.z + 0.05, 0.05);
    if (this.z <= floor && up <= 0) { this.z = floor; this.mode = 'ground'; this.wall = null; this.events.push('land'); }
  }

  private release(push: number) {
    const wall = this.wall;
    this.mode = 'air';
    this.fallTopZ = this.z;
    this.vz = 0;
    if (wall) { this.vx = wall.nx * push; this.vy = wall.ny * push; }
    this.wall = null;
    this.climbJump.t = 0;
  }

  vaulting = false;
  private startMantle(cx: number, cy: number, nx: number, ny: number, top: number) {
    // 달리다 낮은 것(벤치·난간·볼라드)을 만나면 한 손 짚고 넘어간다
    this.vaulting = this.mode === 'ground' && top - this.z < 1.05 && this.speed > 3.2;
    this.parachute = false; this.freefall = false;
    this.mode = 'mantle';
    this.wall = null;
    const reach = this.vaulting ? 1.0 : 0.6;
    this.mantle = { t: 0, x0: this.x, y0: this.y, z0: this.z, x1: cx - nx * reach, y1: cy - ny * reach, z1: top };
    this.facing = bearingOf(-nx, -ny);
    this.vx = this.vy = this.vz = 0;
    this.speed = 0;
    this.events.push(this.vaulting ? 'vault' : 'mantle');
  }

  private doMantle(dt: number) {
    const mt = this.mantle;
    const dur = this.vaulting ? 0.3 : Math.max(0.3, Math.min(0.7, (mt.z1 - mt.z0) * 0.35 + 0.25));
    mt.t += dt / dur;
    const t = Math.min(1, mt.t);
    const up = Math.min(1, t / 0.65);
    const fwd = Math.max(0, (t - 0.45) / 0.55);
    this.z = mt.z0 + (mt.z1 - mt.z0) * (1 - (1 - up) ** 2);
    this.x = mt.x0 + (mt.x1 - mt.x0) * fwd;
    this.y = mt.y0 + (mt.y1 - mt.y0) * fwd;
    if (t >= 1) { this.mode = 'ground'; this.z = mt.z1; if (this.vaulting) this.speed = RUN * 0.8; }
  }

  // ───────── 물 ─────────
  private enterWater() {
    this.parachute = false; this.freefall = false;
    this.mode = 'swim';
    this.z = WATER_Z;
    this.vz = 0;
    this.speed *= 0.4;
    this.events.push('splash');
  }

  private swim(dt: number, w: World, it: Intent, m: number, ix: number, iy: number) {
    const fast = it.sprint && m > 0.2 && this.canExert;
    let want = m < 0.08 ? 0 : (fast ? SWIM_FAST : SWIM * m) * it.pace;
    if (this.exhausted) want = Math.min(want, 0.9);
    if (m >= 0.08) this.turn(bearingOf(ix, iy), 300 * dt);
    this.speed = approach(this.speed, want, 5 * dt);
    const before = Math.floor(this.phase / Math.PI);
    this.phase += dt * (1.6 + this.speed * 1.3);
    if (Math.floor(this.phase / Math.PI) !== before && this.speed > 0.4) this.events.push('stroke');
    this.restT = 0;
    this.spend(dt * (fast ? 0.2 : this.speed > 0.3 ? 0.035 : 0.012) * this.mods.swim);
    const [fx, fy] = dirOf(this.facing);
    const p = { x: this.x + fx * this.speed * dt, y: this.y + fy * this.speed * dt };
    w.collide(p, WATER_Z - 1, R, H, 0.3);
    this.x = p.x; this.y = p.y;
    this.z = WATER_Z;
    if (this.stamina <= 0) {
      // 힘이 다 빠지면 마지막으로 딛고 섰던 곳으로 돌아온다
      this.events.push('drown');
      this.place(this.safe.x, this.safe.y, this.safe.z);
      this.stamina = this.maxStamina;
      this.exhausted = false;
      return;
    }
    if (!w.water(this.x, this.y)) {
      // 물가: 낮으면 걸어 나오고, 둑이면 손을 짚고 올라간다
      const g = w.ground(this.x, this.y, WATER_Z + 3.5, 3.5);
      if (g <= WATER_Z + 0.7) { this.mode = 'ground'; this.z = Math.max(g, WATER_Z); this.events.push('land'); }
      else { this.mode = 'ground'; this.startMantle(this.x, this.y, -fx, -fy, g); }
    }
  }
}
