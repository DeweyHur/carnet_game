// 옷장(🎒 / I): 칸마다 가진 것 중 하나를 골라 입는다. 아직 없는 건 흐리게, 얻는 법과 함께.
import { GEAR, SLOTS, type Slot, type Wardrobe, weaponCap, enhanceCost, WEAPON_MAX_LV } from './gear';
import { ARMOR_SLOTS, ARMOR_MAX, armorCap, armorCost, ARMOR_HP, ARMOR_DEF } from './growth';

/** 옷장이 보여 줄 능력치와 강화에 필요한 것 */
export interface ClosetCtx {
  ar(): number;
  ore(): number;
  money(): number;
  /** 강화가 열렸나(모험 등급 2) */
  canEnhance(): boolean;
  /** 비용을 치른다(모자라면 false) */
  pay(ore: number, eur: number): boolean;
  stats(): { atk: number; hp: number; crit: number; critDmg: number; def?: number };
  enhanced?(name: string, lv: number): void;
}

export class Closet {
  private readonly el: HTMLElement;
  private readonly w: Wardrobe;
  onToggle?: (open: boolean) => void;
  ctx: ClosetCtx | null = null;

  constructor(w: Wardrobe) {
    this.w = w;
    this.el = document.createElement('section');
    this.el.id = 'closet';
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

  /** 든 무기·입은 옷 강화(레벨 +1) — 무기는 공격력, 옷은 체력·방어 */
  private enhanceRow(slot: Slot): HTMLElement {
    const w = this.w, c = this.ctx;
    const weapon = slot === 'weapon';
    const id = w.loadout[slot];
    const g = GEAR.find((x) => x.id === id)!;
    const lv = w.lvOf(id);
    const box = document.createElement('div');
    box.className = 'enhance';
    if (!c) return box;
    if (!c.canEnhance()) { box.innerHTML = `<span class="lock">🔒 ${weapon ? '무기' : '옷'} 강화 — 모험 등급 2에 열린다</span>`; return box; }
    const MAX = weapon ? WEAPON_MAX_LV : ARMOR_MAX;
    const cap = weapon ? weaponCap(c.ar()) : armorCap(c.ar()), cost = weapon ? enhanceCost(lv) : armorCost(lv);
    const gain = weapon ? '공격력 +6%' : `체력 +${ARMOR_HP * 100}% · 방어 +${ARMOR_DEF * 100}%`;
    const info = document.createElement('span');
    const btn = document.createElement('button');
    btn.type = 'button';
    if (lv >= MAX) { info.textContent = `${g.emoji} ${g.name} Lv.${lv} — 최대`; btn.disabled = true; btn.textContent = '최대 레벨'; }
    else if (lv >= cap) { info.textContent = `${g.emoji} ${g.name} Lv.${lv} — 모험 등급 ${c.ar() + 1}이 되면 Lv.${Math.min(MAX, cap + (weapon ? 2 : 1))}까지`; btn.disabled = true; btn.textContent = '🔒 등급을 올리자'; }
    else {
      const ok = c.ore() >= cost.ore && c.money() >= cost.eur;
      info.innerHTML = `${g.emoji} <b></b> Lv.${lv} → <b class="up">Lv.${lv + 1}</b> · ${gain}`;
      info.querySelector('b')!.textContent = g.name;
      btn.className = ok ? 'primary' : '';
      btn.disabled = !ok;
      btn.textContent = `⬆ 강화 · 🔹${cost.ore} · €${cost.eur}${ok ? '' : ' (모자람)'}`;
      btn.addEventListener('click', () => {
        if (!c.pay(cost.ore, cost.eur)) return;
        w.levelUp(id);
        c.enhanced?.(g.name, lv + 1);
        this.paint();
      });
    }
    box.append(info, btn);
    return box;
  }

  private paint() {
    const w = this.w;
    const got = GEAR.filter((g) => w.owned.has(g.id)).length;
    const c = this.ctx, st = c?.stats();
    const statLine = st && c ? `<div class="stats"><span>⭐ 모험 등급 <b>${c.ar()}</b></span><span>⚔️ 공격력 <b>${st.atk}</b></span><span>❤️ 체력 <b>${st.hp}</b></span>${st.def ? `<span>🛡 방어 <b>${st.def}%</b></span>` : ''}<span>💥 치명타 <b>${st.crit}%</b> · ×${st.critDmg}</span><span>🔹 <b>${c.ore()}</b></span><span>€ <b>${Math.floor(c.money())}</b></span></div>` : '';
    this.el.innerHTML = `<div class="sheet"><div class="top"><div><p class="eyebrow">옷장</p><h2>무엇을 들고 입을까</h2><p class="sub">${got} / ${GEAR.length} 가짐 · 무기는 싸움 능력을, 옷은 겉모습과 작은 능력을 바꾼다</p></div><button class="x" type="button" title="닫기 (I)">✕</button></div>${statLine}</div>`;
    const sheet = this.el.querySelector('.sheet')!;
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    for (const s of SLOTS) {
      const row = document.createElement('div');
      row.className = 'slot';
      row.innerHTML = `<h3>${s.emoji} ${s.name}</h3><div class="cards"></div>`;
      const cards = row.querySelector('.cards')!;
      for (const g of GEAR.filter((x) => x.slot === s.id)) {
        const owned = w.owned.has(g.id), on = w.loadout[s.id] === g.id;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `gear${on ? ' on' : ''}${owned ? '' : ' locked'}`;
        b.innerHTML = `<span class="em"></span><b></b><small></small>`;
        b.querySelector('.em')!.textContent = owned ? g.emoji : '🔒';
        b.querySelector('b')!.textContent = owned && s.id !== 'glider' ? `${g.name} · Lv.${w.lvOf(g.id)}` : g.name;
        b.querySelector('small')!.textContent = owned ? g.perk : `얻는 법: ${g.unlock}`;
        if (owned) b.addEventListener('click', () => { if (w.equip(g.id)) this.paint(); });
        cards.appendChild(b);
      }
      if (s.id === 'weapon' || (ARMOR_SLOTS as readonly string[]).includes(s.id)) row.appendChild(this.enhanceRow(s.id));
      sheet.appendChild(row);
    }
  }
}
