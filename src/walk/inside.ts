// 장소 안: 관람 장면(파노라마 사진 + 순간들 + 사진 찍기)과 메뉴판.
import type { Place } from './places';
import { GENERIC_MENU_NOTE, momentsFor, placePhotoRefs } from './content';
import type { Dish, Menu } from './content';
import { findPhoto, preload } from './photos';
import type { Photo } from './photos';
import * as sfx from './sound';

export interface Shot { src: string; x: number; place: string; credit: string }
export interface VisitResult { mins: number; seen: number; total: number; shots: Shot[] }
export interface MealResult { mins: number; cost: number; dishes: Dish[] }

const root = () => document.querySelector('#inside') as HTMLElement;
const euro = (n: number) => `€${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function show(node: HTMLElement) {
  const r = root();
  r.replaceChildren(node);
  r.classList.add('on');
}
function hide() {
  const r = root();
  r.classList.remove('on');
  setTimeout(() => { if (!r.classList.contains('on')) r.replaceChildren(); }, 400);
}

// ───────── 파노라마 ─────────
class Pano {
  readonly box = el('div', 'pano');
  private img: HTMLImageElement | null = null;
  private x = 0.5; // 0..1, 사진의 어느 부분을 보고 있나
  private target = 0.5;
  private drag: { px: number; x: number } | null = null;
  private raf = 0;
  private drift = 1;
  private maxShift = 0;

  constructor(emoji: string) {
    this.box.append(el('div', 'pano-fallback', emoji));
    this.box.addEventListener('pointerdown', (e) => { this.drag = { px: e.clientX, x: this.x }; this.box.setPointerCapture(e.pointerId); });
    this.box.addEventListener('pointermove', (e) => {
      if (!this.drag || !this.maxShift) return;
      this.x = this.target = Math.min(1, Math.max(0, this.drag.x - (e.clientX - this.drag.px) / this.maxShift));
    });
    const end = () => { this.drag = null; };
    this.box.addEventListener('pointerup', end);
    this.box.addEventListener('pointercancel', end);
    const tick = () => {
      if (!this.drag) {
        // 가만히 두면 아주 천천히 좌우로 흐른다
        this.target += this.drift * 0.00035;
        if (this.target > 1 || this.target < 0) { this.drift *= -1; this.target = Math.min(1, Math.max(0, this.target)); }
        this.x += (this.target - this.x) * 0.04;
      }
      this.layout();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  setPhoto(p: Photo) {
    const img = el('img', 'pano-img');
    img.src = p.src;
    img.alt = '';
    img.draggable = false;
    this.img = img;
    this.box.prepend(img);
    this.box.classList.add('has-photo');
  }

  /** 다음 순간으로 넘어갈 때 시선을 사진의 다른 부분으로 옮긴다 */
  lookAt(frac: number) { this.target = Math.min(1, Math.max(0, frac)); }
  get position() { return this.x; }

  private layout() {
    const img = this.img;
    if (!img || !img.naturalWidth) return;
    const W = this.box.clientWidth;
    const H = this.box.clientHeight;
    // 화면보다 최소 1.7배 넓게 — 한눈에 안 들어와야 둘러보는 맛이 난다
    const scale = Math.max(H / img.naturalHeight, (W * 1.7) / img.naturalWidth);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    this.maxShift = w - W;
    img.style.width = `${w}px`;
    img.style.height = `${h}px`;
    img.style.transform = `translate(${-this.x * this.maxShift}px, ${-(h - H) / 2}px)`;
  }

  destroy() { cancelAnimationFrame(this.raf); }
}

// ───────── 관람 ─────────
export function openVisit(p: Place): Promise<VisitResult> {
  return new Promise((resolve) => {
    const moments = momentsFor(p);
    const wrap = el('div', 'visit');
    const pano = new Pano(p.emoji);
    const top = el('div', 'visit-top');
    top.append(el('b', '', p.name));
    const credit = el('a', 'credit');
    credit.target = '_blank';
    credit.rel = 'noopener';
    top.append(credit);
    const flash = el('div', 'flash');
    const dock = el('div', 'visit-dock');
    const dots = el('div', 'dots');
    moments.forEach(() => dots.append(el('i', '')));
    const caption = el('p', 'caption');
    const acts = el('div', 'acts');
    const more = el('button', 'primary');
    const leave = el('button', '', '이만 나간다');
    const cam = el('button', 'cam', '📷');
    cam.title = '사진 찍기';
    acts.append(more, cam, leave);
    dock.append(dots, caption, acts);
    wrap.append(pano.box, flash, top, dock);
    show(wrap);
    sfx.inside(true);

    let photo: Photo | null = null;
    cam.hidden = true;
    void findPhoto(placePhotoRefs(p)).then(async (ph) => {
      if (!ph || !(await preload(ph))) return;
      photo = ph;
      pano.setPhoto(ph);
      credit.textContent = `사진 ${ph.credit}`;
      credit.href = ph.sourceUrl;
      cam.hidden = false;
    });

    let i = 0;
    let mins = 0;
    const shots: Shot[] = [];
    const render = () => {
      const m = moments[i];
      mins += m.mins;
      caption.classList.remove('in');
      void caption.offsetWidth;
      caption.textContent = m.text;
      caption.classList.add('in');
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k <= i));
      pano.lookAt(moments.length === 1 ? 0.5 : 0.12 + (0.76 * i) / (moments.length - 1));
      const last = i === moments.length - 1;
      more.textContent = last ? '다 봤다, 나간다' : '더 본다';
      leave.hidden = last;
      sfx.pageTurn();
    };
    const done = () => {
      pano.destroy();
      sfx.inside(false);
      hide();
      resolve({ mins, seen: i + 1, total: moments.length, shots });
    };
    more.onclick = () => { if (i === moments.length - 1) done(); else { i++; render(); } };
    leave.onclick = done;
    cam.onclick = () => {
      if (!photo || shots.length >= 4) return;
      shots.push({ src: photo.src, x: pano.position, place: p.name, credit: photo.credit });
      sfx.shutter();
      flash.classList.remove('go');
      void flash.offsetWidth;
      flash.classList.add('go');
      cam.textContent = `📷 ${shots.length}`;
    };
    render();
  });
}

// ───────── 메뉴 ─────────
export function openMenu(p: Place, menu: Menu, money: number): Promise<MealResult | null> {
  return new Promise((resolve) => {
    const wrap = el('div', 'menu');
    const sheet = el('div', 'menu-sheet');
    sheet.append(el('p', 'menu-eyebrow', 'La carte'), el('h2', '', p.name), el('p', 'menu-note', menu.exact ? (menu.note ?? '') : GENERIC_MENU_NOTE));
    const list = el('div', 'dishes');
    const picked = new Set<Dish>();
    const foot = el('div', 'menu-foot');
    const total = el('span', 'total');
    const order = el('button', 'primary', '주문한다');
    const out = el('button', '', '그냥 나간다');
    foot.append(total, order, out);

    const sum = () => Math.round([...picked].reduce((s, d) => s + d.price, 0) * 100) / 100;
    const refresh = () => {
      const s = sum();
      total.textContent = picked.size ? `${picked.size}개 · ${euro(s)}` : '골라 보세요';
      order.disabled = !picked.size || s > money;
      order.textContent = s > money ? '돈이 모자라요' : '주문한다';
    };
    for (const d of menu.dishes) {
      const row = el('button', 'dish');
      const thumb = el('span', 'dish-pic', d.emoji);
      const mid = el('span', 'dish-mid');
      mid.append(el('b', '', d.name));
      if (d.fr) mid.append(el('i', '', d.fr));
      if (d.desc) mid.append(el('small', '', d.desc));
      row.append(thumb, mid, el('span', 'dish-price', d.price ? euro(d.price) : '무료'));
      row.onclick = () => {
        if (picked.has(d)) picked.delete(d); else picked.add(d);
        row.classList.toggle('picked', picked.has(d));
        sfx.tick();
        refresh();
      };
      list.append(row);
      if (d.photo) void findPhoto(d.photo).then((ph) => { if (ph) { thumb.textContent = ''; thumb.style.backgroundImage = `url("${ph.src}")`; thumb.title = ph.credit; } });
    }
    sheet.append(list, foot);
    wrap.append(sheet);
    show(wrap);
    sfx.inside(true);
    refresh();

    out.onclick = () => { sfx.inside(false); hide(); resolve(null); };
    order.onclick = () => {
      const dishes = [...picked];
      const street = dishes.every((d) => d.tags.includes('street') || !d.price);
      const mins = Math.max(...dishes.map((d) => d.mins)) + (dishes.length - 1) * (street ? 2 : 6);
      void serve(p, dishes, street).then(() => { sfx.inside(false); hide(); resolve({ mins, cost: sum(), dishes }); });
    };
  });
}

/** 주문한 것이 나온다 */
function serve(p: Place, dishes: Dish[], street: boolean): Promise<void> {
  return new Promise((resolve) => {
    const wrap = el('div', 'serve');
    const table = el('div', 'table');
    for (const d of dishes) {
      const plate = el('div', 'plate');
      const pic = el('div', 'plate-pic', d.emoji);
      plate.append(pic, el('b', '', d.name));
      table.append(plate);
      if (d.photo) void findPhoto(d.photo).then((ph) => { if (ph) { pic.textContent = ''; pic.style.backgroundImage = `url("${ph.src}")`; pic.title = ph.credit; } });
    }
    const line = el('p', 'serve-line', street ? '종이에 싸서 건네받는다. 들고 걸으면 된다.' : `${p.name}. 자리에 앉아 기다리니 하나씩 나온다.`);
    const ok = el('button', 'primary', street ? '받아 들고 나간다' : '잘 먹었습니다');
    wrap.append(table, line, ok);
    show(wrap);
    sfx.served();
    ok.onclick = () => resolve();
  });
}
