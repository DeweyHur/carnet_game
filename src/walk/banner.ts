// 큰 알림(원신처럼 화면 가운데): 모험 등급 UP · 🔓 새로 열림. 하나씩 차례로, 누르거나 몇 초 뒤 닫힌다.
import * as sfx from './sound';

interface Card { kind: 'rank' | 'unlock'; html: string; secs: number }

export class Banner {
  private readonly el: HTMLElement;
  private queue: Card[] = [];
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private shownAt = 0;
  onClose?: () => void;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'banner';
    // 방금 뜬 카드는 0.4초 동안 눌러도 넘어가지 않는다(연달아 누르다 건너뛰지 않게)
    this.el.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (performance.now() - this.shownAt > 400) this.next(); });
    document.body.appendChild(this.el);
  }
  get showing() { return this.busy; }

  /** 모험 등급이 올랐다 */
  rank(ar: number, gifts: string[], nextLine: string) {
    const chips = gifts.map((g) => `<span>${g}</span>`).join('');
    this.push({ kind: 'rank', secs: 5, html: `<p class="k">모험 등급 UP</p><b class="ar">${ar}</b><div class="chips">${chips}</div><p class="n">${nextLine}</p><small>눌러서 닫기</small>` });
  }
  /** 새 기능이 열렸다 */
  unlock(emoji: string, name: string, what: string) {
    this.push({ kind: 'unlock', secs: 7, html: `<p class="k">🔓 새로 열림</p><b class="nm"><em>${emoji}</em>${name}</b><p class="w">${what}</p><small>눌러서 닫기</small>` });
  }

  private push(c: Card) {
    this.queue.push(c);
    if (!this.busy) this.next();
  }
  private next() {
    if (this.timer) clearTimeout(this.timer);
    const c = this.queue.shift();
    if (!c) { this.el.classList.remove('on'); this.busy = false; this.onClose?.(); return; }
    this.busy = true;
    this.shownAt = performance.now();
    this.el.className = `banner on ${c.kind}`;
    this.el.innerHTML = `<div class="card">${c.html}</div>`;
    if (c.kind === 'rank') sfx.fanfare(); else sfx.spotBig();
    this.timer = setTimeout(() => this.next(), c.secs * 1000);
  }
}
