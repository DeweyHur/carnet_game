// 📜 기술 창(K · 🧚 메뉴): 디아블로 4 · 패스 오브 엑자일 느낌의 전체 화면 기술 나무.
// 왼쪽: 세 갈래(열)에 네 단계(행) — 다이아몬드 칸이 금속 테를 두르고, 배운 칸 사이 줄에 빛이 흐른다.
// 오른쪽: 마우스를 올린(또는 누른) 기술의 카드 — 지금 · 다음 레벨 숫자, 시너지, "배우기", 5~8 칸 소켓.
// 두 번 누르면 바로 배운다. 기술을 고른 채로 5 · 6 · 7 · 8을 누르면 그 칸에 올린다.
import { iconImg } from './icons';
import { AWAKE, MAX_LV, TIER_AR, TREES, skillOf, skillsOf, type Arsenal, type SkillDef } from './skills';
import type { CharId } from './party';

export interface SkillUiCtx {
  who(): CharId;
  name(): string;
  ar(): number;
  atk(): number;
  /** 원소(이모지 · 이름 · 색) */
  element(): { emoji: string; name: string; color: number };
  openGrowth(): void;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ'];
const LABEL: Record<string, string> = { atk: '공격력', crit: '치명타 확률', critDmg: '치명타 피해', hp: '최대 체력', def: '받는 피해 감소', aspd: '공격 속도', regen: '마나 회복', steal: '흡혈', heal: '회복' };
const STATUS: Record<string, string> = { burn: '🔥 불태움', poison: '🟢 중독', slow: '❄️ 느려짐', stun: '💫 기절', knock: '💨 밀쳐냄', pull: '🪢 끌어당김', drain: '🩸 흡혈' };
const KIND: Record<string, string> = { bolt: '투사체', nova: '범위', cone: '근접 부채꼴', line: '돌진 · 관통', leap: '도약', rain: '낙하 · 폭격', orbit: '궤도', chain: '연쇄', turret: '소환 · 포탑', trap: '덫', zone: '장판', aura: '오라', buff: '강화' };

export class SkillPanel {
  private readonly el: HTMLElement;
  private readonly a: Arsenal;
  ctx: SkillUiCtx | null = null;
  private sel: string | null = null;
  private pop: string | null = null;
  onToggle?: (open: boolean) => void;

  constructor(a: Arsenal) {
    this.a = a;
    this.el = document.createElement('section');
    this.el.id = 'skills';
    document.body.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    // 고른 기술을 5~8 칸에 바로
    window.addEventListener('keydown', (e) => {
      if (!this.open || !this.sel || !this.ctx) return;
      const i = ['Digit5', 'Digit6', 'Digit7', 'Digit8'].indexOf(e.code);
      if (i < 0) return;
      const d = skillOf(this.sel);
      if (d?.eff && this.a.lv(d.id)) { this.a.bind(this.ctx.who(), i, d.id); this.paint(); e.stopImmediatePropagation(); }
    }, true);
  }
  get open() { return this.el.classList.contains('on'); }
  toggle(on = !this.open) {
    if (on === this.open) return;
    if (on) this.paint();
    this.el.classList.toggle('on', on);
    this.onToggle?.(on);
  }
  refresh() { if (this.open) this.paint(); }

  private rows(d: SkillDef, lv: number): [string, string][] {
    const c = this.ctx!, A = this.a, out: [string, string][] = [];
    if (d.passive) for (const [k, v] of Object.entries(d.passive)) out.push([LABEL[k] ?? k, `+${k === 'steal' ? (v * lv * 100).toFixed(1) + '%' : pct(v * lv)}`]);
    if (d.dmg) out.push(['피해', `${Math.round(c.atk() * A.power(d, lv))} <small>(공격력 ${pct(A.power(d, lv))})</small>`]);
    if (d.buff) for (const [k, v] of Object.entries(d.buff)) out.push([LABEL[k] ?? k, `+${pct(v * (1 + 0.08 * (lv - 1)))}`]);
    if (d.heal) out.push(['회복', `${pct(d.heal * (1 + 0.08 * (lv - 1)))}씩`]);
    if (d.eff && 'secs' in d.eff && d.eff.secs > 0.2) out.push(['지속', `${d.eff.secs}초`]);
    return out;
  }

  private card(id: string) {
    const c = this.ctx!, A = this.a, d = skillOf(id)!, lv = A.lv(d.id), why = A.why(d.id), ch = c.who();
    const now = lv ? this.rows(d, lv) : [], next = lv < MAX_LV ? this.rows(d, lv + 1) : [];
    const keys = [...new Set([...now.map((r) => r[0]), ...next.map((r) => r[0])])];
    const val = (rows: [string, string][], k: string) => rows.find((r) => r[0] === k)?.[1] ?? '—';
    const box = this.el.querySelector('.st-card')!;
    box.className = `st-card${d.eff ? '' : ' pas'}`;
    box.innerHTML = `
      <div class="cd-top"><div class="cd-gem"><i>${iconImg(d, 160)}</i></div>
        <div class="cd-name"><b></b><div class="chips"><span>${TREES[ch][d.tree]}</span><span>${ROMAN[d.tier]} · 등급 ${TIER_AR[d.tier]}</span><span class="${d.eff ? 'act' : 'pas'}">${d.eff ? `쓰는 기술 · ${KIND[d.eff.k]}` : '익히는 기술'}</span></div></div></div>
      <div class="cd-lv"><div class="bar"><i style="width:${(lv / MAX_LV) * 100}%"></i></div><span>Lv <b>${lv}</b> / ${MAX_LV}</span></div>
      <p class="cd-desc"></p>
      ${d.status ? `<p class="cd-status">${STATUS[d.status]}</p>` : ''}
      <table class="cd-tab"><thead><tr><th></th><th>지금</th><th>${lv ? '다음' : '배우면'}</th></tr></thead><tbody>
        ${keys.map((k) => `<tr><td>${k}</td><td>${lv ? val(now, k) : '—'}</td><td class="up">${lv < MAX_LV ? val(next, k) : '최대'}</td></tr>`).join('')}
        ${d.cost ? `<tr><td>🔷 마나</td><td>${lv ? A.cost(d, lv) : '—'}</td><td>${lv < MAX_LV ? A.cost(d, lv + 1) : '—'}</td></tr>` : ''}
        ${d.cd ? `<tr><td>⏱ 재사용</td><td colspan="2">${d.cd}초</td></tr>` : ''}
      </tbody></table>
      ${d.eff ? `<div class="cd-aw"><h4>✦ 각성 <small>레벨이 닿으면 둘 중 하나 — 언제든 바꿀 수 있다</small></h4>${([0, 1] as const).map((t) => `<div class="awr${lv >= (t ? 10 : 5) ? '' : ' lock'}"><em>Lv ${t ? 10 : 5}</em>${AWAKE[d.eff!.k][t].map((o, i) => `<button type="button" data-t="${t}" data-i="${i}" class="${A.awake[d.id]?.[t] === i ? 'on' : ''}" ${lv >= (t ? 10 : 5) ? '' : 'disabled'}><b>${o.name}</b><span>${o.what}</span></button>`).join('')}</div>`).join('')}</div>` : ''}
      ${d.dmg ? `<p class="cd-syn"><b>시너지 +${A.synergy(d)}%</b> — 같은 갈래 다른 기술 레벨마다 +6%</p>` : ''}
      <button type="button" class="cd-learn${why ? '' : ' go'}" ${why ? 'disabled' : ''}>${why ? `🔒 ${why}` : lv ? `레벨 올리기 <kbd>Lv ${lv + 1}</kbd>` : '배우기'}</button>
      ${d.eff ? `<div class="cd-sock"><small>${lv ? '칸에 올리기 — 누르거나 5~8 키' : '배우면 빈 칸에 저절로 올라간다'}</small><div>${[0, 1, 2, 3].map((i) => { const on = A.slotsOf(ch)[i]; const od = on ? skillOf(on) : null; return `<button type="button" data-i="${i}" class="${on === d.id ? 'on' : ''}" ${lv ? '' : 'disabled'}><i>${od ? iconImg(od, 64) : ''}</i><kbd>${i + 5}</kbd></button>`; }).join('')}</div></div>` : ''}`;
    box.querySelector('.cd-name b')!.textContent = d.name;
    box.querySelector('.cd-desc')!.textContent = d.desc;
    box.querySelector('.cd-learn')!.addEventListener('click', () => this.learn(d.id));
    box.querySelectorAll<HTMLButtonElement>('.cd-aw button').forEach((btn) => btn.addEventListener('click', () => { if (A.choose(d.id, Number(btn.dataset.t) as 0 | 1, Number(btn.dataset.i) as 0 | 1)) { this.pop = d.id; this.paint(); } }));
    box.querySelectorAll<HTMLButtonElement>('.cd-sock button').forEach((btn) => btn.addEventListener('click', () => { A.bind(ch, Number(btn.dataset.i), d.id); this.paint(); }));
  }

  private learn(id: string) {
    if (!this.a.learn(id)) return;
    this.pop = id;
    this.paint();
  }

  private paint() {
    const c = this.ctx, A = this.a;
    if (!c) return;
    const ch = c.who(), ar = c.ar(), all = skillsOf(ch), el = c.element(), free = A.spFree(ch);
    if (!this.sel || skillOf(this.sel)?.char !== ch) this.sel = all[0].id;
    this.el.style.setProperty('--el', hex(el.color));
    this.el.innerHTML = `<div class="st-fx"></div>
      <header class="st-head">
        <div class="st-title"><span class="st-el">${el.emoji} ${el.name}</span><h1></h1><p>기술 나무 · 세 갈래 · 네 단계</p></div>
        <div class="st-pts${free > 0 ? ' has' : ''}"><div class="gem"><b>${Math.max(0, free)}</b></div><small>기술 포인트<br><em>모험 등급마다 +1</em></small></div>
        <div class="st-acts"><button class="gro" type="button">🌟 특성 · 재능</button><button class="x" type="button" title="닫기 (K)">✕</button></div>
      </header>
      <main class="st-main"><div class="st-trees"><div class="st-rows">${ROMAN.map((r, i) => `<div class="${ar >= TIER_AR[i] ? 'open' : ''}"><b>${r}</b><small>등급 ${TIER_AR[i]}</small></div>`).join('')}</div></div><aside class="st-card"></aside></main>
      <footer class="st-foot"><span>누르기 <kbd>자세히</kbd></span><span>두 번 누르기 <kbd>배우기</kbd></span><span>고른 채로 <kbd>5</kbd><kbd>6</kbd><kbd>7</kbd><kbd>8</kbd> <kbd>칸에 올리기</kbd></span><span class="slots">${A.slotsOf(ch).map((id, i) => `<i title="${i + 5}">${id ? iconImg(skillOf(id)!, 64) : ''}<kbd>${i + 5}</kbd></i>`).join('')}</span></footer>`;
    this.el.querySelector('.st-title h1')!.textContent = c.name();
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    this.el.querySelector('.gro')!.addEventListener('click', () => { this.toggle(false); c.openGrowth(); });
    const trees = this.el.querySelector('.st-trees')!;
    TREES[ch].forEach((name, t) => {
      const col = document.createElement('section');
      col.className = 'st-br';
      const pts = all.filter((s) => s.tree === t).reduce((a, s) => a + A.lv(s.id), 0);
      col.innerHTML = `<h3><em>${name.split(' ')[0]}</em><span>${name.split(' ').slice(1).join(' ')}</span><small>${pts}점</small></h3><ol></ol>`;
      const ol = col.querySelector('ol')!;
      for (const d of all.filter((s) => s.tree === t).sort((a, b) => a.tier - b.tier)) {
        const lv = A.lv(d.id), why = A.why(d.id);
        const up = d.tier > 0 ? all.find((s) => s.tree === t && s.tier === d.tier - 1)! : null;
        const locked = ar < TIER_AR[d.tier] || (!!up && !A.lv(up.id));
        const li = document.createElement('li');
        li.className = `${lv ? 'got' : ''}${up && A.lv(up.id) ? ' lit' : ''}`;
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.skill = d.id;
        b.className = `node${lv ? ' got' : ''}${lv >= MAX_LV ? ' max' : ''}${locked ? ' locked' : ''}${!why ? ' can' : ''}${this.sel === d.id ? ' sel' : ''}${d.eff ? '' : ' pas'}${this.pop === d.id ? ' pop' : ''}`;
        const awk = A.awake[d.id];
        b.innerHTML = `<span class="dia"></span><i>${iconImg(d, 96)}${locked ? '<b class="lk">🔒</b>' : ''}</i><span class="lvp">${lv}<small>/${MAX_LV}</small></span>${awk && (awk[0] !== null || awk[1] !== null) ? '<b class="awk">✦</b>' : d.eff && lv >= 5 ? '<b class="awk ready">✦</b>' : ''}`;
        b.title = d.name;
        const nm = document.createElement('p');
        nm.className = 'nm';
        nm.textContent = d.name;
        b.addEventListener('pointerenter', () => this.card(d.id));
        b.addEventListener('pointerleave', () => this.card(this.sel!));
        b.addEventListener('click', () => { this.sel = d.id; this.el.querySelectorAll('.node.sel').forEach((q) => q.classList.remove('sel')); b.classList.add('sel'); this.card(d.id); });
        b.addEventListener('dblclick', () => { this.sel = d.id; this.learn(d.id); });
        li.append(b, nm);
        ol.appendChild(li);
      }
      trees.appendChild(col);
    });
    this.pop = null;
    this.card(this.sel!);
  }
}
