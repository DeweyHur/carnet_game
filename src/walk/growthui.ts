// 🌟 성장 창(K · 리리 메뉴): 특성 레벨(보통 공격 · 원소 스킬 · 원소 폭발)과 스킬 트리(검술 · 생존 · 바람).
import { BRANCHES, NODES, TALENTS, TALENT_MAX, talentCap, talentCost, type Growth, type Talent } from './growth';

export interface GrowthCtx {
  ar(): number;
  money(): number;
  pay(eur: number): boolean;
  /** 무엇이 올랐다(소리·알림) */
  learned?(what: string): void;
}

export class GrowthPanel {
  private readonly el: HTMLElement;
  private readonly g: Growth;
  ctx: GrowthCtx | null = null;
  onToggle?: (open: boolean) => void;

  constructor(g: Growth) {
    this.g = g;
    this.el = document.createElement('section');
    this.el.id = 'growth';
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

  private paint() {
    const g = this.g, c = this.ctx;
    if (!c) return;
    const ar = c.ar(), free = g.spFree(ar);
    this.el.innerHTML = `<div class="sheet"><div class="top"><div><p class="eyebrow">성장</p><h2>🌟 특성 · 스킬 트리</h2>
      <p class="sub">특성은 📘 파리의 가르침(밤 습격의 요괴가 떨어뜨린다)과 €로 · 스킬 포인트는 모험 등급마다 1점, 밤 습격 5물결마다 1점</p></div>
      <button class="x" type="button" title="닫기 (K)">✕</button></div>
      <div class="stats"><span>⭐ 모험 등급 <b>${ar}</b></span><span>📘 <b>${g.books}</b></span><span>€ <b>${Math.floor(c.money())}</b></span><span class="sp">스킬 포인트 <b>${free}</b> / ${g.spTotal(ar)}</span></div>
      <h3>특성 레벨 <small>모험 등급 ${ar} — Lv.${talentCap(ar)}까지</small></h3><div class="talents"></div>
      <h3>스킬 트리 <small>위에서부터 차례로 — 앞 칸을 찍어야 다음 칸이 열린다</small></h3><div class="tree"></div></div>`;
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    const tl = this.el.querySelector('.talents')!;
    for (const t of TALENTS) {
      const lv = g.talents[t.id];
      const row = document.createElement('div');
      row.className = 'talent';
      const why = g.canTalent(t.id, ar, c.money());
      const cost = talentCost(lv);
      const now = Math.round(t.per * (lv - 1) * 100), next = Math.round(t.per * lv * 100);
      row.innerHTML = `<em>${t.emoji}</em><div><b></b><small>${t.what} +${now}%${lv < TALENT_MAX ? ` → <i>+${next}%</i>` : ''}</small></div><span class="lv">Lv.${lv}</span><button type="button"></button>`;
      row.querySelector('b')!.textContent = t.name;
      const btn = row.querySelector('button')!;
      if (lv >= TALENT_MAX) { btn.textContent = '최대'; btn.disabled = true; }
      else {
        btn.textContent = `⬆ 📘${cost.books} · €${cost.eur}${why ? ` (${why})` : ''}`;
        btn.disabled = !!why;
        if (!why) btn.className = 'primary';
        btn.addEventListener('click', () => this.levelTalent(t.id));
      }
      tl.appendChild(row);
    }
    const tree = this.el.querySelector('.tree')!;
    for (const br of BRANCHES) {
      const col = document.createElement('div');
      col.className = 'branch';
      col.innerHTML = `<h4>${br.emoji} ${br.name}</h4>`;
      for (const n of NODES.filter((x) => x.branch === br.id).sort((a, b) => a.tier - b.tier)) {
        const r = g.rank(n.id), why = g.why(n.id, ar);
        const locked = !!n.req && g.rank(n.req[0]) < n.req[1];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `node t${n.tier}${r ? ' got' : ''}${r >= n.max ? ' max' : ''}${locked ? ' locked' : ''}${!why ? ' can' : ''}`;
        b.innerHTML = `<em>${locked ? '🔒' : n.emoji}</em><b></b><small></small><span class="pips">${'●'.repeat(r)}${'○'.repeat(n.max - r)}</span>`;
        b.querySelector('b')!.textContent = n.name;
        b.querySelector('small')!.textContent = locked && why ? `${n.what} — ${why}` : n.what;
        b.title = why ?? '찍기';
        b.disabled = !!why;
        b.dataset.node = n.id;
        b.addEventListener('click', () => { if (g.learn(n.id, ar)) { c.learned?.(`${n.emoji} ${n.name} ${g.rank(n.id)}/${n.max}`); this.paint(); } });
        col.appendChild(b);
      }
      tree.appendChild(col);
    }
  }

  private levelTalent(t: Talent) {
    const g = this.g, c = this.ctx!;
    if (g.canTalent(t, c.ar(), c.money())) return;
    const cost = talentCost(g.talents[t]);
    if (!c.pay(cost.eur)) return;
    g.levelTalent(t);
    const d = TALENTS.find((x) => x.id === t)!;
    c.learned?.(`${d.emoji} ${d.name} Lv.${g.talents[t]}`);
    this.paint();
  }
}
