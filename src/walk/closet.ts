// 옷장(🎒 / I): 칸마다 가진 것 중 하나를 골라 입는다. 아직 없는 건 흐리게, 얻는 법과 함께.
import { GEAR, SLOTS, type Wardrobe } from './gear';

export class Closet {
  private readonly el: HTMLElement;
  private readonly w: Wardrobe;
  onToggle?: (open: boolean) => void;

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

  private paint() {
    const w = this.w;
    const got = GEAR.filter((g) => w.owned.has(g.id)).length;
    this.el.innerHTML = `<div class="sheet"><div class="top"><div><p class="eyebrow">옷장</p><h2>무엇을 입을까</h2><p class="sub">${got} / ${GEAR.length} 가짐 · 입은 대로 겉모습과 작은 능력이 바뀐다</p></div><button class="x" type="button" title="닫기 (I)">✕</button></div></div>`;
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
        b.querySelector('b')!.textContent = g.name;
        b.querySelector('small')!.textContent = owned ? g.perk : `얻는 법: ${g.unlock}`;
        if (owned) b.addEventListener('click', () => { if (w.equip(g.id)) this.paint(); });
        cards.appendChild(b);
      }
      sheet.appendChild(row);
    }
  }
}
