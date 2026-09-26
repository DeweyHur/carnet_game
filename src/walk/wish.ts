// 기원(원신처럼): 별조각 ⭐160으로 한 번. 5★(1.6%, 50번째엔 반드시) · 4★(13%, 10번마다 반드시) · 3★ 기념품.
// 5★·4★은 옷장 장비 — 이미 있으면 별조각으로 돌려준다(5★ ⭐60, 4★ ⭐12).
import { GEAR, type Gear, type Wardrobe } from './gear';
import type { Progress } from './progress';
import * as sfx from './sound';

export const WISH_COST = 160;
const SOUVENIRS: [string, string, number][] = [['🖼', '몽마르트르 엽서', 3], ['🧲', '에펠탑 자석', 4], ['🥖', '바게트 쿠폰', 3], ['🎫', '지하철 표', 2], ['🍫', '초콜릿 한 상자', 5], ['📕', '헌책 한 권', 4]];

export interface WishResult { star: 3 | 4 | 5; emoji: string; name: string; note: string; gear?: Gear }

export class Wish {
  private readonly el: HTMLElement;
  private readonly P: Progress;
  private readonly W: Wardrobe;
  private readonly money: (eur: number) => void;
  onToggle?: (open: boolean) => void;

  constructor(P: Progress, W: Wardrobe, money: (eur: number) => void) {
    this.P = P; this.W = W; this.money = money;
    this.el = document.createElement('section');
    this.el.id = 'wish';
    document.body.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  get open() { return this.el.classList.contains('on'); }
  toggle(on = !this.open) {
    if (on === this.open) return;
    if (on) this.paint();
    this.el.classList.toggle('on', on);
    this.onToggle?.(on);
  }

  /** 한 번 뽑기(별조각은 밖에서 뺀다) */
  roll(): WishResult {
    const P = this.P;
    P.pity4++; P.pity5++; P.wishes++;
    const r = Math.random();
    if (P.pity5 >= 50 || r < 0.016) {
      P.pity5 = 0;
      return this.giveGear(5);
    }
    if (P.pity4 >= 10 || r < 0.146) {
      P.pity4 = 0;
      return this.giveGear(4);
    }
    const [emoji, name, eur] = SOUVENIRS[Math.floor(Math.random() * SOUVENIRS.length)];
    this.money(eur);
    return { star: 3, emoji, name, note: `€ +${eur}` };
  }

  private giveGear(star: 4 | 5): WishResult {
    const pool = GEAR.filter((g) => g.star === star);
    const fresh = pool.filter((g) => !this.W.owned.has(g.id));
    const src = fresh.length && Math.random() < 0.7 ? fresh : pool; // 없는 것이 조금 더 잘 나온다
    const g = src[Math.floor(Math.random() * src.length)];
    if (this.W.owned.has(g.id)) {
      const back = star === 5 ? 60 : 12;
      this.P.stars += back;
      return { star, emoji: g.emoji, name: g.name, note: `이미 있다 → ⭐ +${back}`, gear: g };
    }
    this.W.unlock(g.id, true);
    return { star, emoji: g.emoji, name: g.name, note: `새 장비! ${g.perk}`, gear: g };
  }

  private pull(n: number) {
    const P = this.P;
    if (P.stars < WISH_COST * n) { sfx.exhausted(); this.flash(`별조각이 모자라다 (⭐${P.stars} / ${WISH_COST * n}) — 상자·의뢰·부탁·모험 등급으로 모은다`); return; }
    P.stars -= WISH_COST * n;
    const res: WishResult[] = [];
    for (let i = 0; i < n; i++) res.push(this.roll());
    P.save();
    this.show(res);
  }

  private flash(t: string) {
    const m = this.el.querySelector('.msg');
    if (m) m.textContent = t;
  }

  private show(res: WishResult[]) {
    const top = Math.max(...res.map((r) => r.star));
    if (top === 5) sfx.fanfare(); else if (top === 4) sfx.questDone(); else sfx.chime();
    const box = this.el.querySelector('.results') as HTMLElement;
    box.className = `results s${top}`;
    box.innerHTML = '';
    res.sort((a, b) => b.star - a.star).forEach((r, i) => {
      const c = document.createElement('div');
      c.className = `card s${r.star}`;
      c.style.animationDelay = `${i * 0.08}s`;
      c.innerHTML = '<span class="em"></span><b></b><small class="st"></small><small class="nt"></small>';
      c.querySelector('.em')!.textContent = r.emoji;
      c.querySelector('b')!.textContent = r.name;
      c.querySelector('.st')!.textContent = '★'.repeat(r.star);
      c.querySelector('.nt')!.textContent = r.note;
      box.appendChild(c);
    });
    this.paintHead();
  }

  private paintHead() {
    const P = this.P;
    const h = this.el.querySelector('.head');
    if (h) h.innerHTML = `<b>⭐ ${P.stars}</b><span>5★까지 ${50 - P.pity5}번 · 4★까지 ${10 - P.pity4}번 · 지금까지 ${P.wishes}번</span>`;
  }

  private paint() {
    const fives = GEAR.filter((g) => g.star === 5).map((g) => `${g.emoji} ${g.name}`).join(' · ');
    this.el.innerHTML = `<div class="sheet">
      <div class="top"><div><p class="eyebrow">기원</p><h2>파리의 추억</h2><p class="sub">이번 기원의 5★: ${fives}</p></div><button class="x" type="button" title="닫기">✕</button></div>
      <div class="banner"><span>🗼</span><div><b>별이 내리는 밤의 파리</b><small>5★ 1.6% · 50번째엔 반드시 · 4★ 13% · 10번마다 반드시<br/>5★·4★은 옷장 장비 — 이미 있으면 별조각으로 돌려준다</small></div></div>
      <div class="head"></div>
      <div class="btns"><button class="one" type="button">1번 기원 <small>⭐${WISH_COST}</small></button><button class="ten primary" type="button">10번 기원 <small>⭐${WISH_COST * 10}</small></button></div>
      <p class="msg"></p>
      <div class="results"></div>
    </div>`;
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    this.el.querySelector('.one')!.addEventListener('click', () => this.pull(1));
    this.el.querySelector('.ten')!.addEventListener('click', () => this.pull(10));
    this.paintHead();
  }
}
