// 거리 위에 뜨는 것들(DOM): 사람 머리 위 말풍선, 지금 바라보는 것의 이름표, 대화 상자, 가게 앞 안내판, 사진 플래시.
// 자리는 매 프레임 거리(Town)의 투영으로 3D 좌표 → 화면 좌표를 구해 옮긴다.

import * as sfx from '../sound';

export interface Anchor { x: number; y: number; z: number }
export type Project = (x: number, y: number, z: number, out: { x: number; y: number }) => boolean;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

interface Bubble { node: HTMLElement; at: () => Anchor | null; until: number; }

export class StreetUi {
  private layer = el('div', 'street-layer');
  private bubbles: Bubble[] = [];
  private tag = el('div', 'wtag');
  private tagAt: (() => Anchor | null) | null = null;
  private card = el('div', 'wcard');
  private cardAt: (() => Anchor | null) | null = null;
  readonly talkBox = el('div', 'talk');
  private fadeEl = el('div', 'fade');
  private flash = el('div', 'flash');
  private quest = el('div', 'questline');
  private p = { x: 0, y: 0 };
  private readonly project: Project;
  onTalkKey?: (i: number) => void;

  constructor(project: Project) {
    this.project = project;
    document.body.append(this.layer, this.talkBox, this.fadeEl, this.flash, this.quest);
    this.layer.append(this.tag, this.card);
    this.talkBox.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.card.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  /** 머리 위 말풍선 */
  say(at: () => Anchor | null, text: string, secs = 2.6, kind = '', voice?: number) {
    if (voice !== undefined) sfx.say(text, voice, false);
    // 같은 자리(사람)에 이미 떠 있으면 바꿔 쓴다
    const old = this.bubbles.find((b) => b.at === at);
    const node = old?.node ?? el('div', `bubble ${kind}`);
    node.className = `bubble ${kind}`;
    node.textContent = text;
    if (old) old.until = performance.now() + secs * 1000;
    else { this.layer.appendChild(node); this.bubbles.push({ node, at, until: performance.now() + secs * 1000 }); }
  }

  /** 바라보는 것의 이름표(없으면 null) */
  focus(at: (() => Anchor | null) | null, icon = '', name = '', sub = '') {
    this.tagAt = at;
    if (!at) { this.tag.classList.remove('on'); this.tag.style.opacity = '0'; return; }
    const sig = `${icon}|${name}|${sub}`;
    if (this.tag.dataset.sig !== sig) {
      this.tag.dataset.sig = sig;
      this.tag.replaceChildren(el('span', 'ic', icon), el('b', '', name), ...(sub ? [el('small', '', sub)] : []));
    }
    this.tag.classList.add('on');
  }

  /** 가게 앞 안내판(살펴보기) */
  showCard(at: () => Anchor | null, build: (root: HTMLElement) => void) {
    this.cardAt = at;
    this.card.replaceChildren();
    build(this.card);
    this.card.classList.add('on');
  }
  hideCard() { this.cardAt = null; this.card.classList.remove('on'); this.card.style.opacity = '0'; }
  get cardOpen() { return !!this.cardAt; }

  /** 대화: 말하는 사람·프랑스어·한국어·선택지. 고른 번호를 돌려준다(닫으면 -1). */
  talk(who: string, fr: string, ko: string, choices: string[]): Promise<number> {
    if (fr) sfx.say(fr, who.length * 97 + who.charCodeAt(0));
    sfx.pop();
    return new Promise((resolve) => {
      const box = this.talkBox;
      box.replaceChildren();
      box.appendChild(el('p', 'who', who));
      if (fr) box.appendChild(el('p', 'fr', fr));
      box.appendChild(el('p', 'ko', ko));
      const row = el('div', 'choices');
      const done = (i: number) => { box.classList.remove('on'); document.body.classList.remove('talking'); this.onTalkKey = undefined; resolve(i); };
      choices.forEach((c, i) => {
        const b = el('button', i === 0 ? 'primary' : '', '');
        b.append(el('kbd', '', String(i + 1)), document.createTextNode(c));
        b.addEventListener('click', (e) => { e.stopPropagation(); sfx.select(); done(i); });
        row.appendChild(b);
      });
      box.appendChild(row);
      box.classList.add('on');
      document.body.classList.add('talking');
      this.onTalkKey = (i) => { if (i < 0) done(-1); else if (i < choices.length) done(i); };
    });
  }
  get talking() { return this.talkBox.classList.contains('on'); }

  /** 화면을 잠깐 어둡게(문 열고 들어갈 때 등) */
  fade(on: boolean, color = '#0b0a09') {
    this.fadeEl.style.background = color;
    this.fadeEl.classList.toggle('on', on);
    return new Promise((r) => setTimeout(r, 420));
  }

  /** 사진 찍을 때 번쩍 + 찍은 사진이 모서리로 날아간다 */
  shutter(src: string | null) {
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
    if (!src) return;
    const t = el('div', 'polaroid');
    t.style.backgroundImage = `url("${src}")`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('fly'), 700);
    setTimeout(() => t.remove(), 2200);
  }

  /** 지금 하고 있는 일(퀘스트) 한 줄 */
  questLine(text: string) { this.quest.textContent = text; this.quest.classList.toggle('on', !!text); }

  /** 매 프레임: 떠 있는 것들을 제자리로 */
  update() {
    const now = performance.now();
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      const a = b.at();
      if (now > b.until || !a) { b.node.remove(); this.bubbles.splice(i, 1); continue; }
      this.place(b.node, a, now > b.until - 300 ? 0 : 1);
    }
    if (this.tagAt) { const a = this.tagAt(); if (a) this.place(this.tag, a, 1); else this.tag.style.opacity = '0'; }
    if (this.cardAt) { const a = this.cardAt(); if (a) this.place(this.card, a, 1); else this.hideCard(); }
  }

  private place(node: HTMLElement, a: Anchor, alpha: number) {
    if (!this.project(a.x, a.y, a.z, this.p)) { node.style.opacity = '0'; return; }
    node.style.opacity = String(alpha);
    node.style.transform = `translate(${Math.round(this.p.x)}px, ${Math.round(this.p.y)}px) translate(-50%, -100%)`;
  }

  clearBubbles() { for (const b of this.bubbles) b.node.remove(); this.bubbles.length = 0; }
}
