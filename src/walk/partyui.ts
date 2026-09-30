// 캐릭터 만들기(처음 · 파티 창의 ✏️)와 👥 파티 창(P · 🧚 메뉴). 만들기는 오른쪽 판, 왼쪽엔 진짜 캐릭터가 얼굴 쪽을 보고 선다.
import { CHARS, type CharId, type Party } from './party';
import type { Extra, HairStyle, Look } from './hero/figure';

const SKINS = [0xf8dcc4, 0xf2c9a0, 0xe2b08a, 0xc98e62, 0x9b6a45, 0x6b4630];
const HAIRS = [0x14110f, 0x3b2a1e, 0x6b3a1e, 0xa8652e, 0xd9b26a, 0xc4432a, 0x9a9a98, 0xe9e4ff];
const EYES = [0x2d2016, 0x2e4a6a, 0x3b5a2e, 0x6a4bd6, 0x8a5a2a];
const ACCENTS = [0xe0493a, 0x2f8fd8, 0xf0c34a, 0x3f9a5a, 0xff6fb0, 0x6a4bd6];
const STYLES: [HairStyle, string][] = [['short', '짧게'], ['bob', '단발'], ['ponytail', '포니테일'], ['bun', '올림머리'], ['long', '긴 머리']];
const HEIGHTS: [number, string][] = [[0.93, '작게'], [1, '보통'], [1.07, '크게']];
const EXTRAS: [Extra, string][] = [['', '없음'], ['glasses', '👓 안경'], ['mustache', '콧수염'], ['beard', '턱수염']];
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export class Creator {
  private readonly el: HTMLElement;
  private look!: Look;
  private name = '';
  /** 처음 만들기(닫을 수 없다) / 고치기 */
  private first = true;
  onPreview?: (l: Look) => void;
  onDone?: (name: string, l: Look) => void;
  onToggle?: (open: boolean) => void;

  constructor() {
    this.el = document.createElement('section');
    this.el.id = 'creator';
    document.body.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('keydown', (e) => e.stopPropagation()); // 이름을 치는 동안 게임 키가 먹지 않게
  }
  get open() { return this.el.classList.contains('on'); }
  show(name: string, look: Look, first: boolean) {
    this.name = name; this.look = { ...look }; this.first = first;
    this.paint();
    this.el.classList.add('on');
    this.onToggle?.(true);
    this.onPreview?.(this.look);
  }
  close() {
    if (!this.open) return;
    // 판 안에 남은 초점을 풀어 준다 — 아니면 게임 키가 이 판에 막힌다
    if (document.activeElement instanceof HTMLElement && this.el.contains(document.activeElement)) document.activeElement.blur();
    this.el.classList.remove('on');
    this.onToggle?.(false);
  }

  private paint() {
    const L = this.look;
    const sw = (key: keyof Look, list: number[]) => list.map((c) => `<button type="button" class="sw${L[key] === c ? ' on' : ''}" data-k="${key}" data-v="${c}" style="background:${hex(c)}" title="${hex(c)}"></button>`).join('');
    const opt = <T extends string | number>(key: keyof Look, list: [T, string][]) => list.map(([v, t]) => `<button type="button" class="op${L[key] === v ? ' on' : ''}" data-k="${key}" data-v="${v}">${t}</button>`).join('');
    this.el.innerHTML = `<div class="sheet">
      <p class="eyebrow">${this.first ? '첫걸음 · 나를 만들기' : '여행자 꾸미기'}</p><h2>${this.first ? '파리에 온 여행자는 어떤 사람일까' : '여행자의 생김새'}</h2>
      <label class="nm">이름 <input type="text" maxlength="12" placeholder="여행자" /></label>
      <h3>피부</h3><div class="row">${sw('skin', SKINS)}</div>
      <h3>머리 색</h3><div class="row">${sw('hair', HAIRS)}</div>
      <h3>머리 모양</h3><div class="row">${opt('style', STYLES)}</div>
      <h3>눈</h3><div class="row">${sw('eyes', EYES)}</div>
      <h3>키</h3><div class="row">${opt('height', HEIGHTS)}</div>
      <h3>목도리 색</h3><div class="row">${sw('accent', ACCENTS)}</div>
      <h3>덧붙이기</h3><div class="row">${opt('extra', EXTRAS)}</div>
      <div class="go"><button type="button" class="rnd">🎲 무작위</button>${this.first ? '' : '<button type="button" class="cancel">그만두기</button>'}<button type="button" class="ok primary">✔ ${this.first ? '이대로 파리로' : '저장'}</button></div>
    </div>`;
    const inp = this.el.querySelector('input')!;
    inp.value = this.name === '여행자' ? '' : this.name;
    inp.addEventListener('input', () => { this.name = inp.value; });
    for (const b of this.el.querySelectorAll<HTMLButtonElement>('[data-k]')) {
      b.addEventListener('click', () => {
        const k = b.dataset.k as keyof Look, raw = b.dataset.v!;
        const v = k === 'style' || k === 'extra' ? raw : Number(raw);
        (this.look as unknown as Record<string, unknown>)[k] = v;
        this.onPreview?.(this.look);
        for (const q of this.el.querySelectorAll<HTMLElement>(`[data-k="${k}"]`)) q.classList.toggle('on', q === b);
      });
    }
    this.el.querySelector('.rnd')!.addEventListener('click', () => {
      this.look = { skin: pick(SKINS), hair: pick(HAIRS), style: pick(STYLES)[0], eyes: pick(EYES), height: pick(HEIGHTS)[0], accent: pick(ACCENTS), extra: Math.random() < 0.6 ? '' : pick(EXTRAS)[0] };
      this.name = inp.value; this.paint(); this.onPreview?.(this.look);
    });
    this.el.querySelector('.cancel')?.addEventListener('click', () => this.close());
    this.el.querySelector('.ok')!.addEventListener('click', () => { const n = inp.value.trim() || '여행자'; this.close(); this.onDone?.(n, this.look); });
  }
}

export class PartyPanel {
  private readonly el: HTMLElement;
  private readonly p: Party;
  onToggle?: (open: boolean) => void;
  onSelect?: (id: CharId) => void;
  onEdit?: () => void;

  constructor(p: Party) {
    this.p = p;
    this.el = document.createElement('section');
    this.el.id = 'party';
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
    const p = this.p;
    this.el.innerHTML = `<div class="sheet"><div class="top"><div><p class="eyebrow">파티</p><h2>👥 누구로 다닐까</h2><p class="sub">${p.unlocked.size} / ${CHARS.length}명 — 파리에서 부탁을 들어주면 한 사람씩 동료가 된다. 모험 등급 · 특성 · 스킬 트리 · 장비는 함께 쓴다.</p></div><button class="x" type="button" title="닫기 (P)">✕</button></div><div class="cards"></div></div>`;
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    const box = this.el.querySelector('.cards')!;
    for (const c of CHARS) {
      const own = p.unlocked.has(c.id), on = p.active === c.id;
      const L = p.lookOf(c);
      const card = document.createElement('div');
      card.className = `pc${on ? ' on' : ''}${own ? '' : ' locked'}`;
      card.dataset.char = c.id;
      card.style.setProperty('--el', hex(c.element.color));
      card.innerHTML = `<div class="face" style="--skin:${hex(L.skin)};--hair:${hex(L.hair)}"><i></i></div>
        <div class="info"><b></b><small class="el">${c.element.emoji} ${c.element.name}</small><small class="role"></small>
        ${own ? `<small class="atk">⚔️ ${c.attack}</small><small class="kit">🌀 ${c.skill} · 🌪️ ${c.burst}</small><small class="perk"></small>` : `<small class="how">🔒 ${c.unlock}</small>`}</div>
        <div class="act"></div>`;
      card.querySelector('b')!.textContent = own ? p.nameOf(c) : '???';
      card.querySelector('.role')!.textContent = own ? c.role : '아직 만나지 못했다';
      if (own) card.querySelector('.perk')!.textContent = c.perk;
      const act = card.querySelector('.act')!;
      if (own) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = on ? '' : 'primary';
        b.disabled = on;
        b.textContent = on ? '함께 다니는 중' : '이 사람으로';
        b.addEventListener('click', () => { if (p.select(c.id)) { this.onSelect?.(c.id); this.paint(); } });
        act.appendChild(b);
        if (c.id === 'traveler') {
          const e = document.createElement('button');
          e.type = 'button'; e.textContent = '✏️ 꾸미기';
          e.addEventListener('click', () => { this.toggle(false); this.onEdit?.(); });
          act.appendChild(e);
        }
      }
      box.appendChild(card);
    }
  }
}
