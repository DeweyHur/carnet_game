// 📜 기술 창(K · 🧚 메뉴): 지금 캐릭터의 세 갈래 기술 나무. 칸을 누르면 아래에 자세히(지금 · 다음 레벨 숫자, 마나, 재사용, 시너지)
// "배우기 +1"과 5 · 6 · 7 · 8 칸에 올리기. 공통 특성·재능(🌟)으로 가는 단추도 있다.
import { MAX_LV, TIER_AR, TREES, skillOf, skillsOf, type Arsenal, type SkillDef } from './skills';
import type { CharId } from './party';

export interface SkillUiCtx {
  who(): CharId;
  name(): string;
  ar(): number;
  atk(): number;
  openGrowth(): void;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;

export class SkillPanel {
  private readonly el: HTMLElement;
  private readonly a: Arsenal;
  ctx: SkillUiCtx | null = null;
  private sel: string | null = null;
  onToggle?: (open: boolean) => void;

  constructor(a: Arsenal) {
    this.a = a;
    this.el = document.createElement('section');
    this.el.id = 'skills';
    document.body.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === this.el) this.toggle(false); });
  }
  get open() { return this.el.classList.contains('on'); }
  toggle(on = !this.open) {
    if (on === this.open) return;
    if (on) this.paint();
    this.el.classList.toggle('on', on);
    this.onToggle?.(on);
  }
  refresh() { if (this.open) this.paint(); }

  /** 레벨 lv에서 하는 일(숫자) */
  private numbers(d: SkillDef, lv: number) {
    const c = this.ctx!, A = this.a;
    const bits: string[] = [];
    if (d.passive) for (const [k, v] of Object.entries(d.passive)) bits.push(`${LABEL[k] ?? k} +${k === 'steal' ? (v * lv * 100).toFixed(1) + '%' : pct(v * lv)}`);
    if (d.dmg) bits.push(`피해 ${Math.round(c.atk() * A.power(d, lv))} (공격력의 ${pct(A.power(d, lv))})`);
    if (d.buff) for (const [k, v] of Object.entries(d.buff)) bits.push(`${LABEL[k] ?? k} +${pct(v * (1 + 0.08 * (lv - 1)))}`);
    if (d.heal) bits.push(`체력 ${pct(d.heal * (1 + 0.08 * (lv - 1)))}씩`);
    if (d.cost) bits.push(`🔷 ${A.cost(d, lv)}`);
    if (d.cd) bits.push(`⏱ ${d.cd}초`);
    return bits.join(' · ');
  }

  private paint() {
    const c = this.ctx, A = this.a;
    if (!c) return;
    const ch = c.who(), ar = c.ar(), trees = TREES[ch], all = skillsOf(ch);
    const free = A.spFree(ch);
    if (!this.sel || skillOf(this.sel)?.char !== ch) this.sel = all[0].id;
    this.el.innerHTML = `<div class="sheet"><div class="top"><div><p class="eyebrow">기술 · ${c.name()}</p><h2>📜 기술 나무</h2>
      <p class="sub">모험 등급마다 기술 포인트 1점(캐릭터마다 따로) · 단계는 등급 ${TIER_AR.join(' · ')}에 열리고 위 칸을 먼저 · 같은 갈래 다른 기술 레벨마다 피해 +6%</p></div>
      <div class="tr"><button class="gro" type="button">🌟 특성 · 공통 재능</button><button class="x" type="button" title="닫기 (K)">✕</button></div></div>
      <div class="stats"><span class="sp">기술 포인트 <b>${free}</b></span><span>⭐ 모험 등급 <b>${ar}</b></span><span>칸: ${A.slotsOf(ch).map((id, i) => `<b>${i + 5}</b> ${id ? skillOf(id)!.emoji : '—'}`).join(' ')}</span></div>
      <div class="trees"></div><div class="detail"></div></div>`;
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    this.el.querySelector('.gro')!.addEventListener('click', () => { this.toggle(false); c.openGrowth(); });
    const box = this.el.querySelector('.trees')!;
    trees.forEach((name, t) => {
      const col = document.createElement('div');
      col.className = 'tree';
      col.innerHTML = `<h4>${name}</h4>`;
      for (const d of all.filter((s) => s.tree === t).sort((a, b) => a.tier - b.tier)) {
        const lv = A.lv(d.id), why = A.why(d.id), locked = ar < TIER_AR[d.tier] || (d.tier > 0 && !A.lv(all.find((s) => s.tree === t && s.tier === d.tier - 1)!.id));
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.skill = d.id;
        b.className = `sk${lv ? ' got' : ''}${locked ? ' locked' : ''}${!why ? ' can' : ''}${this.sel === d.id ? ' sel' : ''}${d.eff ? '' : ' pas'}`;
        b.innerHTML = `<em>${locked ? '🔒' : d.emoji}</em><b></b><small>${d.eff ? '쓰는 기술' : '익히는 기술'} · 등급 ${TIER_AR[d.tier]}</small><span class="lv">${lv}</span>`;
        b.querySelector('b')!.textContent = d.name;
        b.addEventListener('click', () => { this.sel = d.id; this.paint(); });
        col.appendChild(b);
      }
      box.appendChild(col);
    });
    // 자세히
    const d = skillOf(this.sel!)!, lv = A.lv(d.id), why = A.why(d.id);
    const det = this.el.querySelector('.detail')!;
    det.innerHTML = `<div class="dh"><em>${d.emoji}</em><div><b></b><small>${TREES[ch][d.tree]} · ${d.eff ? '쓰는 기술(5~8 칸)' : '익히는 기술(늘 켜짐)'} · Lv.${lv}/${MAX_LV}</small></div></div>
      <p class="ds"></p>
      ${lv ? `<p class="nw">지금: ${this.numbers(d, lv)}</p>` : ''}
      ${lv < MAX_LV ? `<p class="nx">${lv ? '다음' : '배우면'}: ${this.numbers(d, lv + 1)}</p>` : ''}
      ${d.dmg ? `<p class="syn">시너지 +${A.synergy(d)}% (같은 갈래 다른 기술 레벨마다 +6%)</p>` : ''}
      <div class="act"><button type="button" class="learn ${why ? '' : 'primary'}" ${why ? 'disabled' : ''}>${why ? `🔒 ${why}` : lv ? '⬆ 레벨 올리기 (+1)' : '✨ 배우기'}</button>
      ${d.eff && lv ? `<span class="bind">칸에 올리기 ${[0, 1, 2, 3].map((i) => `<button type="button" data-i="${i}" class="${A.slotsOf(ch)[i] === d.id ? 'on' : ''}">${i + 5}</button>`).join('')}</span>` : ''}</div>`;
    det.querySelector('b')!.textContent = d.name;
    det.querySelector('.ds')!.textContent = d.desc;
    det.querySelector('.learn')!.addEventListener('click', () => { if (A.learn(d.id)) this.paint(); });
    det.querySelectorAll<HTMLButtonElement>('.bind button').forEach((btn) => btn.addEventListener('click', () => { A.bind(ch, Number(btn.dataset.i), d.id); this.paint(); }));
  }
}
const LABEL: Record<string, string> = { atk: '공격력', crit: '치명타', critDmg: '치명타 피해', hp: '체력', def: '받는 피해 감소', aspd: '공격 속도', regen: '마나 회복', steal: '흡혈', heal: '회복' };
