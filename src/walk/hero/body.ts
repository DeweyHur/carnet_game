// 몸. 달리고, 뛰고, 벽을 타고, 지붕에서 활공하고, 센 강에서 헤엄친다.
// 기력(스태미나)은 전력질주·벽타기·활공·빠른 헤엄에서 줄고, 발을 땅에 딛고 쉬면 찬다. 바닥나면 한동안 숨을 고른다.
import { World } from './world';
import type { Solid } from './world';
import { angleDiff, bearingOf, dirOf } from './geo';

export type Mode = 'ground' | 'air' | 'glide' | 'climb' | 'mantle' | 'swim' | 'down';
export type BodyEvent = 'jump' | 'land' | 'hurt' | 'glide' | 'unglide' | 'grab' | 'mantle' | 'climbjump' | 'drop' | 'splash' | 'drown' | 'exhausted' | 'recovered' | 'stepL' | 'stepR' | 'stroke';

export interface Intent {
  mx: number; my: number; // 가고 싶은 방향(세계 좌표, 크기 0..1)
  sprint: boolean;
  jump: boolean; // 이번 프레임에 눌렀다
  drop: boolean;
  pace: number; // 지치면 느려진다
  maxStamina: number;
}

export const R = 0.32;
const H = 1.75;
const STEP = 0.45;
const G = 21;
const JUMP_V = 7.4;
const WALK = 1.7, RUN = 4.6, SPRINT = 7.2, TIRED = 1.4;
const SWIM = 1.9, SWIM_FAST = 3.6;
const CLIMB_UP = 1.4, CLIMB_SIDE = 1.25;
const GLIDE_FWD = 6.4, GLIDE_SINK = 1.9;
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
    this.safe = { x, y, z };
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
    }
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
    const sprinting = it.sprint && m > 0.2 && this.canExert;
    let want = m < 0.08 ? 0 : m < 0.6 ? WALK + (RUN - WALK) * ((m - 0.08) / 0.52) : RUN;
    if (sprinting) want = SPRINT;
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
      const toward = m >= 0.08 && -(ix * hit.nx + iy * hit.ny) > 0.55;
      this.pushT = toward ? this.pushT + dt : 0;
      const rise = hit.top - this.z;
      if (toward && rise <= 1.4 && this.pushT > 0.08) { this.startMantle(hit.cx, hit.cy, hit.nx, hit.ny, hit.top); return; }
      if (toward && this.pushT > 0.12 && this.canExert) { this.grab(hit); return; }
    } else this.pushT = 0;
    this.x = p.x; this.y = p.y;
    if (sprinting && this.speed > RUN) this.spend(dt * 0.17); else this.rest(dt);
    this.stride(dt, this.speed > RUN + 0.5 ? 2.1 : 1.5);

    const g = w.ground(this.x, this.y, this.z, STEP + 0.1);
    if (this.z - g > 0.08) { this.mode = 'air'; this.fallTopZ = this.z; this.vz = 0; return; } // 지붕 끝에서 발을 헛디뎠다
    this.z = g;
    if (g < 0.3 && w.water(this.x, this.y)) { this.enterWater(); return; }
    this.safe = { x: this.x, y: this.y, z: this.z };
    if (it.jump) { this.vz = JUMP_V; this.mode = 'air'; this.fallTopZ = this.z; this.events.push('jump'); }
  }

  // ───────── 공중 · 활공 ─────────
  private air(dt: number, w: World, it: Intent, m: number, ix: number, iy: number, gliding: boolean) {
    const floor = w.ground(this.x, this.y, this.z + 0.05, 0.05);
    if (it.jump) {
      if (gliding) { this.mode = 'air'; this.fallTopZ = this.z; this.events.push('unglide'); gliding = false; }
      else if (this.z - floor > 1.3 && this.canExert) { this.mode = 'glide'; this.events.push('glide'); gliding = true; }
    }
    if (gliding) {
      this.vz += (-GLIDE_SINK - this.vz) * Math.min(1, dt * 3.5);
      if (m >= 0.08) this.turn(bearingOf(ix, iy), 150 * dt);
      const want = (m >= 0.08 ? GLIDE_FWD * m : 2.2) * Math.max(0.7, it.pace);
      const [fx, fy] = dirOf(this.facing);
      const s = Math.hypot(this.vx, this.vy);
      const ns = approach(s, want, dt * 5);
      this.vx = fx * ns; this.vy = fy * ns;
      this.spend(dt * 0.06);
      if (this.exhausted) { this.mode = 'air'; this.fallTopZ = this.z; this.events.push('unglide'); }
      this.fallTopZ = this.z;
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
    const hit = w.collide(p, Math.max(nz, this.z - 0.2), R, H, 0.05);
    if (hit) {
      const rise = hit.top - nz;
      const toward = -((m >= 0.08 ? ix : this.vx) * hit.nx + (m >= 0.08 ? iy : this.vy) * hit.ny) > 0;
      if (rise <= 1.1 && rise > -0.1 && this.vz < 3) { this.startMantle(hit.cx, hit.cy, hit.nx, hit.ny, hit.top); return; }
      if (toward && this.canExert) { this.x = p.x; this.y = p.y; this.z = nz; this.grab(hit); return; }
      const into = this.vx * hit.nx + this.vy * hit.ny;
      if (into < 0) { this.vx -= into * hit.nx; this.vy -= into * hit.ny; }
    }
    this.x = p.x; this.y = p.y;
    if (nz <= floor && this.vz <= 0) {
      this.z = floor;
      const fell = this.fallTopZ - floor;
      if (floor < 0.3 && w.water(this.x, this.y)) { this.enterWater(); return; }
      if (!gliding && fell > HURT_FALL) { this.mode = 'down'; this.downT = 1.1; this.speed = 0; this.events.push('hurt'); }
      else { this.mode = 'ground'; this.events.push('land'); this.speed *= gliding ? 0.5 : 0.8; }
      this.vz = 0;
      return;
    }
    this.z = nz;
    if (!gliding) this.rest(0); else this.restT = 0;
  }

  // ───────── 벽타기 ─────────
  private grab(hit: { nx: number; ny: number; solid: Solid; cx: number; cy: number }) {
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
        this.spend(0.22);
        this.events.push('climbjump');
        return;
      }
      const s = Math.min(1, Math.hypot(up, side));
      this.climbMove = s;
      if (s > 0.08) this.spend(dt * 0.055 * s); // 한 바퀴로 25 m쯤 — 파리 건물(15~25 m)은 끝까지 오를 수 있다
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

  private startMantle(cx: number, cy: number, nx: number, ny: number, top: number) {
    this.mode = 'mantle';
    this.wall = null;
    this.mantle = { t: 0, x0: this.x, y0: this.y, z0: this.z, x1: cx - nx * 0.6, y1: cy - ny * 0.6, z1: top };
    this.facing = bearingOf(-nx, -ny);
    this.vx = this.vy = this.vz = 0;
    this.speed = 0;
    this.events.push('mantle');
  }

  private doMantle(dt: number) {
    const mt = this.mantle;
    const dur = Math.max(0.3, Math.min(0.7, (mt.z1 - mt.z0) * 0.35 + 0.25));
    mt.t += dt / dur;
    const t = Math.min(1, mt.t);
    const up = Math.min(1, t / 0.65);
    const fwd = Math.max(0, (t - 0.45) / 0.55);
    this.z = mt.z0 + (mt.z1 - mt.z0) * (1 - (1 - up) ** 2);
    this.x = mt.x0 + (mt.x1 - mt.x0) * fwd;
    this.y = mt.y0 + (mt.y1 - mt.y0) * fwd;
    if (t >= 1) { this.mode = 'ground'; this.z = mt.z1; }
  }

  // ───────── 물 ─────────
  private enterWater() {
    this.mode = 'swim';
    this.z = 0;
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
    this.spend(dt * (fast ? 0.2 : this.speed > 0.3 ? 0.035 : 0.012));
    const [fx, fy] = dirOf(this.facing);
    const p = { x: this.x + fx * this.speed * dt, y: this.y + fy * this.speed * dt };
    w.collide(p, -1, R, H, 0.3);
    this.x = p.x; this.y = p.y;
    this.z = 0;
    if (this.stamina <= 0) {
      // 힘이 다 빠지면 마지막으로 딛고 섰던 곳으로 돌아온다
      this.events.push('drown');
      this.place(this.safe.x, this.safe.y, this.safe.z);
      this.stamina = this.maxStamina;
      this.exhausted = false;
      return;
    }
    if (!w.water(this.x, this.y)) { this.mode = 'ground'; this.events.push('land'); }
  }
}
