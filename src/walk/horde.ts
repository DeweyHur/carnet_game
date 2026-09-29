// 🌙 밤 습격(밤 모드): 거리의 사람들이 모두 집에 들어가고, 파리의 요괴들이 물결마다 떼로 몰려온다.
// 물결이 갈수록 많고 세지고(3물결부터 가고일, 4물결부터 정예), 물결을 넘길 때마다 ⭐·🔹·📘, 5물결마다 스킬 포인트.
// 요괴는 📘 파리의 가르침(특성 레벨)과 🔹 연마석을 떨어뜨린다. 쓰러지면 그 물결을 처음부터.
import type { Combat, Kind } from './combat';
import type { Hero } from './hero';
import * as sfx from './sound';

export interface HordeCtx {
  hero: Hero;
  combat: Combat;
  ar(): number;
  toast(s: string): void;
  /** 물결을 넘긴 보상(⭐·🔹·📘·스킬 포인트) */
  reward(r: { wave: number; stars: number; ore: number; books: number; sp: number }): void;
  /** 한 번에 살아 있을 수 있는 수(기기 품질) */
  cap(): number;
  /** 싸울 수 없는 때(비경 안·지도·창) */
  paused(): boolean;
}

const KEY = 'carnet-night-v1';
/** 물결의 크기: 1물결 12 → 5물결 28 → 10물결 48 */
export const waveSize = (w: number) => 8 + 4 * w;

export class Horde {
  private readonly c: HordeCtx;
  active = false;
  /** 밖에서 매 프레임 알려 준다(창·지도·비경이면 멈춘다) */
  pausedNow = false;
  wave = 0;
  /** 이번 물결에서 아직 나오지 않은 수 */
  private left = 0;
  private spawnT = 0;
  private restT = 0;
  kills = 0;
  best = 0;
  private downsSeen = 0;
  private readonly el: HTMLElement;

  constructor(c: HordeCtx) {
    this.c = c;
    try { this.best = (JSON.parse(localStorage.getItem(KEY) ?? 'null') as { best?: number } | null)?.best ?? 0; } catch { /* 무시 */ }
    this.el = document.createElement('div');
    this.el.className = 'horde';
    document.body.appendChild(this.el);
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.wave = 0; this.kills = 0; this.left = 0;
    this.restT = 3.5;
    this.downsSeen = this.c.combat.downs;
    this.el.classList.add('on');
    document.body.classList.add('horde-on');
    this.c.toast('🌙 밤 습격 — 사람들이 모두 집에 들어갔다. 요괴들이 몰려온다! 살아남아 물리치자');
    this.paint();
  }
  stop() {
    if (!this.active) return;
    this.active = false;
    this.c.combat.clearHunters();
    this.el.classList.remove('on');
    document.body.classList.remove('horde-on');
  }

  /** 요괴를 하나 쓰러뜨렸다 — 떨어뜨린 것을 돌려준다 */
  onKill(info: { hunter: boolean; elite: boolean }): { books: number; ore: number } {
    if (!this.active || !info.hunter) return { books: 0, ore: 0 };
    this.kills++;
    const books = info.elite ? 2 : Math.random() < 0.1 ? 1 : 0;
    const ore = info.elite ? 2 : Math.random() < 0.15 ? 1 : 0;
    this.paint();
    return { books, ore };
  }

  private kindFor(w: number): Kind {
    const r = Math.random();
    if (w >= 3 && r < Math.min(0.35, 0.12 + w * 0.02)) return 'gargoyle';
    return r < 0.55 ? 'rat' : 'slime';
  }

  update(dt: number) {
    if (!this.active) return;
    const C = this.c.combat;
    if (C.downs !== this.downsSeen) {
      // 쓰러졌다 — 이 물결을 처음부터(조금 쉬고)
      this.downsSeen = C.downs;
      this.left = 0; this.restT = 6; this.wave = Math.max(0, this.wave - 1);
      this.c.toast(`🌙 쓰러졌다… ${this.wave + 1}물결부터 다시 몰려온다`);
      this.paint();
      return;
    }
    if (this.c.paused()) return;
    const alive = C.huntersAlive();
    if (this.restT > 0) {
      this.restT -= dt;
      if (this.restT <= 0) this.next();
      return;
    }
    if (this.left > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && alive < this.c.cap()) {
        this.spawnT = 0.35;
        const n = Math.min(this.left, 3, this.c.cap() - alive);
        for (let i = 0; i < n; i++) this.spawnOne();
        this.left -= n;
        this.paint();
      }
    } else if (alive === 0) this.cleared();
  }

  private next() {
    this.wave++;
    this.left = waveSize(this.wave);
    this.spawnT = 0;
    sfx.spot();
    const boss = this.wave % 5 === 0;
    this.c.toast(`🌙 ${this.wave}물결 — 요괴 ${this.left}마리${this.wave >= 4 ? ' · 보랏빛은 정예(크고 세다)' : ''}${boss ? ' · 정예 무리가 앞장선다!' : ''}`);
    this.paint();
  }

  private cleared() {
    const w = this.wave;
    if (w > this.best) { this.best = w; try { localStorage.setItem(KEY, JSON.stringify({ best: this.best })); } catch { /* 무시 */ } }
    const r = { wave: w, stars: 5 * w, ore: 1 + Math.floor(w / 2), books: 1 + Math.floor(w / 3), sp: w % 5 === 0 ? 1 : 0 };
    this.c.reward(r);
    sfx.questDone();
    this.restT = 5;
    this.paint();
  }

  private spawnOne() {
    const h = this.c.hero, b = h.body, w = h.sceneWorld ?? h.world;
    const lv = 1 + Math.floor(this.c.ar() / 4) + Math.floor((this.wave - 1) / 2);
    const eliteP = this.wave >= 4 ? Math.min(0.3, 0.1 + 0.02 * (this.wave - 4)) : 0;
    // 정예 무리(5물결마다): 처음 넷은 정예
    const lead = this.wave % 5 === 0 && waveSize(this.wave) - this.left < 4;
    const elite = lead || Math.random() < eliteP;
    const kind = this.kindFor(this.wave);
    // 둘레 16~28 m, 길바닥(건물 지붕이 아닌 곳)을 고른다
    let x = b.x, y = b.y;
    for (let k = 0; k < 10; k++) {
      const a = Math.random() * Math.PI * 2, d = 16 + Math.random() * 12;
      x = b.x + Math.cos(a) * d; y = b.y + Math.sin(a) * d;
      const g = w.ground(x, y, b.z + 6, 12);
      if (kind === 'gargoyle' || g - w.terrain(x, y) < 0.8 || Math.abs(g - b.z) < 1.5) break;
    }
    this.c.combat.spawnHunter(kind, x, y, lv, elite);
  }

  private paint() {
    if (!this.active) return;
    const left = this.left + this.c.combat.huntersAlive();
    const status = this.restT > 0 && this.wave > 0 && left === 0 ? `✨ ${this.wave}물결을 넘겼다 — 숨 돌리기` : this.wave === 0 ? '곧 몰려온다…' : `남은 요괴 <b>${left}</b>`;
    this.el.innerHTML = `<span class="w">🌙 ${Math.max(1, this.wave)}물결</span><span>${status}</span><span>처치 <b>${this.kills}</b></span>${this.best ? `<small>최고 ${this.best}물결</small>` : ''}`;
  }
  /** 매 프레임 그리지 않고 가끔(남은 수가 바뀔 때) */
  tick() { if (this.active) this.paint(); }
}
