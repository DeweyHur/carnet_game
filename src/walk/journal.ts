// 파리 수첩(📖 / J): 메인 이벤트(랜드마크 도장)와 서브 이벤트. 하나를 골라 '안내'하면 빛기둥과 위쪽 한 줄이 그걸 따른다.
import { CHAPTERS, type Story } from './street/story';
import { arNeed, AR_MAX, COMMISSION_TEXT, type Progress } from './progress';
import { WAYPOINTS } from './explore';

export class Journal {
  private readonly el: HTMLElement;
  private story: () => Story | null;
  private progress: () => Progress | null;
  onToggle?: (open: boolean) => void;

  constructor(story: () => Story | null, progress: () => Progress | null = () => null) {
    this.story = story;
    this.progress = progress;
    this.el = document.createElement('section');
    this.el.id = 'journal';
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

  /** 열려 있으면 다시 그린다(진행이 바뀌었을 때) */
  refresh() { if (this.open) this.paint(); }

  private paint() {
    const s = this.story();
    if (!s) return;
    const mains = CHAPTERS.filter((c) => c.main);
    const five = mains.filter((c) => c.id !== 'm-finale');
    const got = five.filter((c) => s.done.has(c.id)).length;
    const subs = CHAPTERS.filter((c) => !c.main);
    const subDone = subs.filter((c) => s.done.has(c.id)).length;
    const km = (d: number) => (d === Infinity ? '' : d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`);
    const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
    const stamps = five.map((c) => `<span class="stamp${s.done.has(c.id) ? ' on' : ''}" title="${esc(s.landmarkName(c))}">${c.emoji}</span>`).join('');
    const card = (c: (typeof CHAPTERS)[number]) => {
      const done = s.done.has(c.id), open = s.available(c), tracked = s.tracked === c.id;
      const status = done ? '✓ 완료' : !open ? '🔒 다섯 곳을 모두 마치면' : s.started.has(c.id) ? s.lineOf(c) : c.giver ? `${s.landmarkName(c)}의 ${c.giver.name}` : s.lineOf(c);
      return `<div class="ev${done ? ' done' : ''}${tracked ? ' tracked' : ''}${open ? '' : ' locked'}">
        <span class="em">${c.emoji}</span>
        <div class="tx"><b>${esc(c.title)}</b><small class="where">${esc(s.landmarkName(c))}${!done && open ? ` · ${km(s.distTo(c))}` : ''}${c.reward.eur ? ` · €${c.reward.eur}` : ''}</small><small>${esc(status)}</small></div>
        ${!done && open ? `<button type="button" data-track="${c.id}">${tracked ? '안내 중' : '안내'}</button>` : ''}
      </div>`;
    };
    const known = subs.filter((c) => s.started.has(c.id) || s.done.has(c.id) || s.distTo(c) < 400);
    const P = this.progress();
    let adv = '';
    if (P) {
      P.rollDay();
      const pct = P.ar >= AR_MAX ? 100 : Math.round((P.xp / arNeed(P.ar)) * 100);
      const com = P.commissions.map((c) => `<li class="${c.done ? 'done' : ''}"><span>${esc(COMMISSION_TEXT[c.kind](c.goal))}</span><small>${c.kind === 'walk' ? Math.round(c.got) : c.got}/${c.goal}</small></li>`).join('');
      adv = `<div class="adv">
        <div class="rank"><b>모험 등급 ${P.ar}</b><span class="bar"><i style="width:${pct}%"></i></span><small>${P.ar >= AR_MAX ? '최고 등급' : `${P.xp} / ${arNeed(P.ar)}`}</small></div>
        <div class="nums"><span>⭐ ${P.stars}<small>별조각(기원)</small></span><span>🪶 ${P.plumes}<small>바람 깃털 · 바친 것 ${P.offered}</small></span><span>💪 ${P.staminaLevel}단계<small>기력 소모 −${Math.round((1 - P.staminaCost) * 100)}%</small></span></div>
        <h3>📜 오늘의 의뢰 <small>${P.commissions.filter((c) => c.done).length}/4 · 하나마다 ⭐10 · 넷 모두 ⭐60 더</small></h3>
        <ul class="com">${com}</ul>
        <h3>🧭 탐험 <small>순간이동 포인트 ${WAYPOINTS.filter((w) => P.waypoints.has(w.id)).length}/${WAYPOINTS.length} · 연 보물상자 ${P.chests.size} · 찾은 바람 깃털 ${P.plumesGot.size}</small></h3>
      </div>`;
    }
    this.el.innerHTML = `<div class="sheet">
      <div class="top"><div><p class="eyebrow">파리 수첩</p><h2>모험</h2><p class="sub">원신처럼 — 보물상자·순간이동 포인트·부탁·의뢰로 모험 등급이 오르고, 별조각으로 ✨ 기원을 한다</p></div><button class="x" type="button" title="닫기 (J)">✕</button></div>
      ${adv}
      <div class="top"><div><h2>메인 이벤트</h2><p class="sub">대표 랜드마크마다 하나 — 도장 ${got}/5 · 순서는 자유</p></div></div>
      <div class="stamps">${stamps}</div>
      <div class="list">${mains.map(card).join('')}</div>
      <h3>서브 이벤트 <small>${subDone}/${subs.length} · 랜드마크 둘레의 작은 부탁과 퀴즈</small></h3>
      <div class="list">${known.map(card).join('') || '<p class="empty">랜드마크 가까이 가면 ❗·❓ 표시가 붙은 사람들이 있다.</p>'}</div>
    </div>`;
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('[data-track]')) b.addEventListener('click', () => { const id = b.dataset.track!; s.tracked = s.tracked === id ? null : id; this.paint(); });
  }
}
