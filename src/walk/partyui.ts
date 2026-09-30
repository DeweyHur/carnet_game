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

/** 캐릭터 얼굴 그림(캔버스): 원소 빛 배경 · 옷깃 · 머리(뒤) · 얼굴 · 앞머리 · 눈 · 모자 · 안경/수염 */
export function portrait(look: Look, el: number, wear?: { head: string; colors?: [number, number, number] }, size = 112): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = size * 2;
  const g = c.getContext('2d')!; g.scale(2 * size / 112, 2 * size / 112);
  const H = (n: number) => hex(n);
  const shade = (n: number, k: number) => { const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  // 배경: 원소 빛
  const bg = g.createRadialGradient(56, 40, 6, 56, 56, 70); bg.addColorStop(0, shade(el, 1.15)); bg.addColorStop(0.6, shade(el, 0.55)); bg.addColorStop(1, shade(el, 0.25));
  g.fillStyle = bg; g.fillRect(0, 0, 112, 112);
  const cx = 56, cy = 54;
  // 뒷머리(긴 머리 · 포니테일 · 단발)
  g.fillStyle = H(look.hair);
  if (look.style === 'long') { g.beginPath(); g.ellipse(cx, cy + 22, 30, 38, 0, 0, Math.PI * 2); g.fill(); }
  if (look.style === 'bob') { g.beginPath(); g.ellipse(cx, cy + 8, 32, 30, 0, 0, Math.PI * 2); g.fill(); }
  if (look.style === 'ponytail') { g.beginPath(); g.ellipse(cx + 30, cy + 10, 9, 24, -0.4, 0, Math.PI * 2); g.fill(); }
  if (look.style === 'bun') { g.beginPath(); g.arc(cx, cy - 32, 12, 0, Math.PI * 2); g.fill(); }
  // 옷깃 · 어깨
  const top = wear?.colors?.[0] ?? 0x2f6db5;
  g.fillStyle = H(top); g.beginPath(); g.ellipse(cx, 118, 44, 30, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = H(look.accent); g.beginPath(); g.ellipse(cx, 90, 20, 8, 0, 0, Math.PI * 2); g.fill();
  // 목 · 얼굴
  g.fillStyle = H(look.skin); g.fillRect(cx - 7, cy + 18, 14, 14);
  g.beginPath(); g.ellipse(cx, cy, 25, 27, 0, 0, Math.PI * 2); g.fill();
  const ch = g.createRadialGradient(cx, cy + 14, 4, cx, cy + 10, 30); ch.addColorStop(0, 'rgba(0,0,0,0)'); ch.addColorStop(1, 'rgba(120,60,40,0.18)');
  g.fillStyle = ch; g.beginPath(); g.ellipse(cx, cy, 25, 27, 0, 0, Math.PI * 2); g.fill();
  // 볼
  g.fillStyle = 'rgba(240,120,110,0.35)'; for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * 15, cy + 9, 5, 3, 0, 0, Math.PI * 2); g.fill(); }
  // 눈
  for (const sx of [-1, 1]) {
    const ex = cx + sx * 10, ey = cy + 1;
    g.fillStyle = '#fbf7f2'; g.beginPath(); g.ellipse(ex, ey, 5.5, 7, 0, 0, Math.PI * 2); g.fill();
    const ir = g.createLinearGradient(ex, ey - 6, ex, ey + 7); ir.addColorStop(0, shade(look.eyes, 0.5)); ir.addColorStop(1, shade(look.eyes, 1.5));
    g.fillStyle = ir; g.beginPath(); g.ellipse(ex, ey + 1, 4.3, 5.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#140d0a'; g.beginPath(); g.ellipse(ex, ey + 1.4, 2, 3, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 1.6, ey - 1.6, 1.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1e1411'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - sx * 6, ey - 3); g.quadraticCurveTo(ex, ey - 9, ex + sx * 6.5, ey - 3); g.stroke();
    g.strokeStyle = H(look.hair); g.lineWidth = 1.6; g.beginPath(); g.moveTo(ex - sx * 5, ey - 12); g.quadraticCurveTo(ex, ey - 14.5, ex + sx * 6, ey - 12); g.stroke();
  }
  g.strokeStyle = '#8a3a2a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 3.5, cy + 15); g.quadraticCurveTo(cx, cy + 18, cx + 3.5, cy + 15); g.stroke();
  // 앞머리: 둥근 모자처럼 덮고 삐죽삐죽
  g.fillStyle = H(look.hair);
  g.beginPath(); g.moveTo(cx - 27, cy - 2); g.bezierCurveTo(cx - 30, cy - 34, cx + 30, cy - 34, cx + 27, cy - 2);
  const spikes = 7;
  for (let i = spikes; i >= 0; i--) { const x = cx - 26 + (52 * i) / spikes; const y = cy - 6 - (i % 2 ? 8 : 0) - Math.abs(i - spikes / 2) * 1.5; g.lineTo(x, y); }
  g.closePath(); g.fill();
  const gl = g.createLinearGradient(cx - 20, cy - 30, cx + 10, cy - 10); gl.addColorStop(0, 'rgba(255,255,255,0.25)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl; g.beginPath(); g.ellipse(cx - 8, cy - 22, 14, 5, -0.3, 0, Math.PI * 2); g.fill();
  if (look.style === 'bob' || look.style === 'long') { g.fillStyle = H(look.hair); for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * 24, cy + 10, 6, 18, sx * 0.1, 0, Math.PI * 2); g.fill(); } }
  // 덧붙이기
  if (look.extra === 'glasses') { g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.6; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * 10, cy + 1, 7, 0, Math.PI * 2); g.stroke(); } g.beginPath(); g.moveTo(cx - 3, cy); g.lineTo(cx + 3, cy); g.stroke(); }
  if (look.extra === 'mustache') { g.fillStyle = H(look.hair); for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(cx + sx * 5, cy + 12, 6, 2.4, sx * 0.3, 0, Math.PI * 2); g.fill(); } }
  if (look.extra === 'beard') { g.fillStyle = H(look.hair); g.beginPath(); g.ellipse(cx, cy + 20, 17, 11, 0, 0, Math.PI); g.fill(); g.beginPath(); g.ellipse(cx, cy + 12, 9, 3, 0, 0, Math.PI * 2); g.fill(); }
  // 모자
  if (wear?.head === 'tophat') { g.fillStyle = '#16161a'; g.fillRect(cx - 18, cy - 58, 36, 30); g.beginPath(); g.ellipse(cx, cy - 27, 30, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#b3262c'; g.fillRect(cx - 18, cy - 34, 36, 5); }
  if (wear?.head === 'beret' || (!wear && look)) { if (wear?.head === 'beret' || !wear) { g.fillStyle = '#b8322f'; g.beginPath(); g.ellipse(cx + 4, cy - 26, 26, 9, 0.18, 0, Math.PI * 2); g.fill(); } }
  return c;
}

const DESC: Record<string, string> = {};
export class PartyPanel {
  private readonly el: HTMLElement;
  private readonly p: Party;
  private view: CharId | null = null;
  onToggle?: (open: boolean) => void;
  onSelect?: (id: CharId) => void;
  onEdit?: () => void;
  /** 고르기 전 미리 보기(진짜 캐릭터의 생김새만) — null이면 되돌린다 */
  onPreview?: (id: CharId | null) => void;

  constructor(p: Party) {
    this.p = p;
    this.el = document.createElement('section');
    this.el.id = 'party';
    document.body.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }
  get open() { return this.el.classList.contains('on'); }
  toggle(on = !this.open) {
    if (on === this.open) return;
    if (on) { this.view = this.p.active; this.paint(); } else this.onPreview?.(null);
    this.el.classList.toggle('on', on);
    this.onToggle?.(on);
  }
  refresh() { if (this.open) this.paint(); }

  private paint() {
    const p = this.p;
    const id = this.view ?? p.active;
    const c = CHARS.find((x) => x.id === id)!;
    const own = p.unlocked.has(c.id), on = p.active === c.id;
    this.el.style.setProperty('--el', hex(c.element.color));
    this.el.innerHTML = `<div class="pt-shade"></div>
      <div class="pt-left"><p class="pt-el">${c.element.emoji} ${c.element.name}</p><h1></h1><p class="pt-role"></p>
        <div class="pt-meta"><span>${p.unlocked.size} / ${CHARS.length} 동료</span>${on ? '<span class="now">함께 다니는 중</span>' : ''}</div></div>
      <aside class="pt-panel">
        <header><div><p class="eyebrow">파티</p><h2>👥 동료</h2></div><button class="x" type="button" title="닫기 (P)">✕</button></header>
        <div class="pt-roster"></div>
        <div class="pt-info"></div>
        <div class="pt-go"></div>
      </aside>`;
    this.el.querySelector('.pt-left h1')!.textContent = own ? p.nameOf(c) : '???';
    this.el.querySelector('.pt-role')!.textContent = own ? c.role : `🔒 ${c.unlock}`;
    this.el.querySelector('.x')!.addEventListener('click', () => this.toggle(false));
    const roster = this.el.querySelector('.pt-roster')!;
    for (const q of CHARS) {
      const b = document.createElement('button');
      const has = p.unlocked.has(q.id);
      b.type = 'button';
      b.dataset.char = q.id;
      b.className = `pt-av${q.id === id ? ' sel' : ''}${q.id === p.active ? ' with' : ''}${has ? '' : ' locked'}`;
      b.style.setProperty('--c', hex(q.element.color));
      b.append(portrait(p.lookOf(q), q.element.color, q.wear, 72));
      const tag = document.createElement('span'); tag.textContent = has ? p.nameOf(q) : '???'; b.append(tag);
      const em = document.createElement('i'); em.textContent = has ? q.element.emoji : '🔒'; b.append(em);
      b.addEventListener('click', () => { this.view = q.id; if (has) this.onPreview?.(q.id); this.paint(); });
      roster.appendChild(b);
    }
    const info = this.el.querySelector('.pt-info')!;
    if (own) {
      info.innerHTML = `<div class="pt-kit"><em>⚔️</em><div><b>보통 공격</b><small></small></div></div>
        <div class="pt-kit"><em>🌀</em><div><b>원소 스킬 · E</b><small>${c.skill}</small></div></div>
        <div class="pt-kit"><em>🌪️</em><div><b>원소 폭발 · Q</b><small>${c.burst}</small></div></div>
        <div class="pt-perk"><b>고유 능력</b><span></span></div>`;
      (info.querySelectorAll('.pt-kit small')[0] as HTMLElement).textContent = c.attack;
      (info.querySelector('.pt-perk span') as HTMLElement).textContent = c.perk;
    } else info.innerHTML = `<div class="pt-lock"><b>🔒 아직 만나지 못했다</b><span></span></div>`;
    if (!own) (info.querySelector('.pt-lock span') as HTMLElement).textContent = c.unlock;
    const go = this.el.querySelector('.pt-go')!;
    if (own) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = on ? 'cur' : 'go';
      b.disabled = on;
      b.textContent = on ? '✓ 함께 다니는 중' : `${p.nameOf(c)}(으)로 다니기`;
      b.addEventListener('click', () => { if (p.select(c.id)) { this.onSelect?.(c.id); } });
      go.appendChild(b);
      if (c.id === 'traveler') { const e = document.createElement('button'); e.type = 'button'; e.className = 'edit'; e.textContent = '✏️ 꾸미기'; e.addEventListener('click', () => { this.toggle(false); this.onEdit?.(); }); go.appendChild(e); }
    }
    void DESC;
  }
}
