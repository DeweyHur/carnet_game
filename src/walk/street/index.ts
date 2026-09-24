// 거리에서 무엇과 어떻게 주고받나. 카드가 튀어나오는 대신, 다가가서 바라보면 이름표가 뜨고
// E(행동)·R(살펴보기)·몸짓(1 인사 2 춤 3 사진 4 앉기)으로 사람·가게·분수·가판대·테라스와 직접 주고받는다.
// 길에서는 가끔 일이 생긴다: 길을 묻는 관광객, 사진 부탁, 지붕 위로 날아간 풍선, 잃어버린 강아지.
import * as THREE from 'three';
import type { Hero } from '../hero';
import type { Frame as InputFrame } from '../hero/input';
import type { Place } from '../places';
import type { Npc } from '../town/crowd';
import type { Front, SeatSpot, Spot } from '../town';
import { World } from '../hero/world';
import { StreetUi } from './ui';
import type { Anchor } from './ui';
import * as T from './lines';
import * as sfx from '../sound';

export interface StreetCtx {
  hero: Hero;
  S: { clock: number; money: number; hunger: number; tired: number; saved: Set<string> };
  places: () => Place[];
  visited: (p: Place) => boolean;
  info: (p: Place) => { label: string; blurb: string; meta: string };
  toast: (s: string) => void;
  hint: (s: string) => void;
  enter: (p: Place) => void;
  metro: () => void;
  bus: (stop: string) => void;
  reveal: (p: Place, how: string) => void;
  guide: (p: Place) => void;
  toggleSave: (p: Place) => boolean;
  pay: (eur: number, what: string) => boolean;
  eat: (amount: number, sat?: number) => void;
  rest: (amount: number) => void;
  passTime: (mins: number) => void;
  shot: (label: string) => void;
  terrace: (p: Place | undefined, what: string, cost: number, mins: number) => void;
  frozen: () => boolean;
}

type Target =
  | { kind: 'place'; place: Place; front: Front | null; x: number; y: number }
  | { kind: 'spot'; spot: Spot }
  | { kind: 'npc'; npc: Npc }
  | { kind: 'item'; item: Item };

interface Item { kind: 'balloon' | 'dog'; x: number; y: number; z: number; mesh: THREE.Object3D; t: number; follow: boolean; flee: number }

interface Quest {
  kind: 'way' | 'photo' | 'balloon' | 'dog';
  npc: Npc;
  place?: Place;
  item?: Item;
  line: string;
  t: number;
}

export interface StreetStats { bonjour: number; rude: number; helped: number; tips: string[]; photos: number; danced: number; drinks: number; bumps: number; quests: string[]; portraits: number; told: number }

const bearingOf = (x: number, y: number) => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
const angleDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;

const ICON: Record<Spot['kind'], string> = { fountain: '⛲', morris: '📜', kiosk: '📰', metro: 'Ⓜ', bus: '🚌', velib: '🚲', bench: '🪑', terrace: '☕' };
const ROLE_NAME: Record<string, string> = {
  passer: '파리 사람', tourist: '관광객', jogger: '조깅하는 사람', dogwalker: '개와 산책하는 사람', kid: '아이', waiter: '웨이터', sitter: '카페 손님', reader: '신문 읽는 사람',
  musician: '아코디언 악사', vendor: '크레프 장수', painter: '거리 화가', mime: '마임 배우', cyclist: '자전거 탄 사람', quest: '사람',
};

export class Street {
  readonly ui: StreetUi;
  readonly stats: StreetStats = { bonjour: 0, rude: 0, helped: 0, tips: [], photos: 0, danced: 0, drinks: 0, bumps: 0, quests: [], portraits: 0, told: 0 };
  private focusT: Target | null = null;
  private quest: Quest | null = null;
  private eventT = 45; // 다음 사건까지(초, 걸은 시간 기준)
  private busy = false;
  private local = new Map<string, [number, number]>();
  private frameRef: unknown = null;
  private items = new THREE.Group();
  private mapBought = new Set<string>();
  private lastDrink = -99;
  private danceAcc = 0;
  private amazeT = 0;
  private cardPlace: Place | null = null;
  private readonly c: StreetCtx;
  district = '';

  constructor(c: StreetCtx) {
    this.c = c;
    this.ui = new StreetUi((x, y, z, out) => c.hero.town.project(x, y, z, out));
    c.hero.crowd.scene.add(this.items);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.ui.talking) this.ui.onTalkKey?.(-1); });
  }

  /** 대화 중이거나 연출 중이면 걷기를 멈춘다 */
  get holding() { return this.busy || this.ui.talking; }

  private pos(p: Place): [number, number] {
    if (this.frameRef !== this.c.hero.frame) { this.local.clear(); this.frameRef = this.c.hero.frame; }
    let v = this.local.get(p.id);
    if (!v) this.local.set(p.id, (v = this.c.hero.frame.toLocal(p.pos)));
    return v;
  }

  /** 동네가 바뀌었다 */
  reset(district: string) {
    this.district = district;
    this.focusT = null;
    this.ui.focus(null);
    this.ui.hideCard();
    this.ui.clearBubbles();
    this.endQuest(null);
    this.local.clear();
  }

  // ───────── 매 프레임 ─────────
  update(dt: number, f: InputFrame, live: boolean) {
    const h = this.c.hero, b = h.body;
    this.ui.update();
    if (this.ui.talking) {
      this.c.hero.hud.setPrompt(null);
      this.c.hero.hud.setPrompt2(null);
      this.ui.focus(null);
      if (f.emote) this.ui.onTalkKey?.(['wave', 'dance', 'photo', 'sit'].indexOf(f.emote));
      if (f.interact) this.ui.onTalkKey?.(0);
      return;
    }
    if (!live) { this.ui.focus(null); return; }
    this.items.visible = true;
    this.stepItems(dt);
    this.stepQuest(dt);
    this.ambient(dt);
    // 몸짓
    if (f.emote && !this.busy) this.emote(f.emote);
    // 무엇을 보고 있나
    this.focusT = b.mode === 'ground' || b.mode === 'sit' ? this.pickFocus() : null;
    this.paintFocus();
    if (this.busy) return;
    if (f.interact) this.primary();
    else if (f.secondary) this.secondary();
    // 멀어지면 안내판을 닫는다
    if (this.cardPlace) {
      const [px, py] = this.pos(this.cardPlace);
      if (Math.hypot(px - b.x, py - b.y) > 11) { this.ui.hideCard(); this.cardPlace = null; }
    }
    // 걸은 만큼 사건이 가까워진다
    if (b.speed > 0.5 && !this.quest) this.eventT -= dt;
    if (this.eventT < 0 && !this.quest) { this.eventT = 70 + Math.random() * 60; this.startEvent(); }
  }

  // ───────── 바라보기 ─────────
  private pickFocus(): Target | null {
    const h = this.c.hero, b = h.body;
    const facing = b.facing;
    let best: Target | null = null, bd = Infinity;
    const consider = (t: Target, x: number, y: number, r: number, bonus = 0) => {
      const d = Math.hypot(x - b.x, y - b.y);
      if (d > r) return;
      const off = Math.abs(angleDiff(facing, bearingOf(x - b.x, y - b.y)));
      if (off > 75 && d > 1.8) return;
      const s = d + off / 40 - bonus;
      if (s < bd) { bd = s; best = t; }
    };
    for (const it of this.quest?.item && !this.quest.item.follow ? [this.quest.item] : []) consider({ kind: 'item', item: it }, it.x, it.y, it.kind === 'balloon' ? 2.2 : 2.6, 3);
    const npc = h.crowd.nearest(b.x, b.y, facing, 3.4, (n) => !n.bike);
    if (npc) consider({ kind: 'npc', npc }, npc.x, npc.y, 3.4, this.quest?.npc === npc ? 3 : 0.8);
    for (const sp of h.town.spots) {
      if (sp.kind === 'bench' && Math.hypot(sp.x - b.x, sp.y - b.y) > 2.2) continue;
      consider({ kind: 'spot', spot: sp }, sp.x, sp.y, sp.kind === 'metro' ? 4.5 : sp.kind === 'terrace' ? 3.6 : 3.2, sp.kind === 'metro' ? 0.5 : 0);
    }
    for (const p of this.c.places()) {
      const [px, py] = this.pos(p);
      if (Math.abs(px - b.x) > 9 || Math.abs(py - b.y) > 9) continue;
      const fr = p.minor ? null : h.town.front({ id: p.id, x: px, y: py });
      const x = fr ? fr.x + fr.nx * 0.6 : px, y = fr ? fr.y + fr.ny * 0.6 : py;
      consider({ kind: 'place', place: p, front: fr, x, y }, x, y, 7);
    }
    return best;
  }

  private anchorOf(t: Target): () => Anchor | null {
    switch (t.kind) {
      case 'npc': return () => ({ x: t.npc.x, y: t.npc.y, z: t.npc.z + 2.05 * t.npc.scale + (t.npc.state === 'sit' ? -0.7 : 0) });
      case 'spot': return () => ({ x: t.spot.x, y: t.spot.y, z: t.spot.kind === 'metro' ? 3.4 : t.spot.kind === 'morris' ? 4.4 : t.spot.kind === 'kiosk' ? 3.4 : 2.4 });
      case 'item': return () => ({ x: t.item.x, y: t.item.y, z: t.item.z + (t.item.kind === 'balloon' ? 1.6 : 0.9) });
      case 'place': return () => ({ x: t.x, y: t.y, z: t.front ? 3.0 : 2.2 });
    }
  }

  private paintFocus() {
    const t = this.focusT;
    const hud = this.c.hero.hud;
    if (!t) { this.ui.focus(null); hud.setPrompt(this.sittingPrompt()); hud.setPrompt2(null); return; }
    const [icon, name, sub] = this.label(t);
    this.ui.focus(this.anchorOf(t), icon, name, sub);
    const [p1, p2] = this.verbs(t);
    hud.setPrompt(p1 ? { verb: p1, what: `${icon} ${name}` } : this.sittingPrompt());
    hud.setPrompt2(p2 ? { verb: p2 } : null);
  }

  private sittingPrompt() {
    const b = this.c.hero.body;
    return b.mode === 'sit' ? { verb: '일어서기', what: '(움직이면 일어선다)' } : null;
  }

  private label(t: Target): [string, string, string] {
    switch (t.kind) {
      case 'place': return [t.place.emoji, t.place.name, this.c.visited(t.place) ? '다녀옴' : this.c.S.saved.has(t.place.id) ? '♥ 찜' : ''];
      case 'spot': {
        const s = t.spot;
        const name = s.kind === 'metro' ? `${s.ref} 역` : s.kind === 'bus' ? `${s.ref} 정류장` : s.kind === 'fountain' ? '월리스 분수' : s.kind === 'morris' ? '모리스 기둥' : s.kind === 'kiosk' ? '신문 가판대' : s.kind === 'terrace' ? `${s.label} 테라스` : s.kind === 'bench' ? '벤치' : '벨리브';
        return [ICON[s.kind], name, s.kind === 'metro' ? (s.label ?? '').split('—')[0].trim() : ''];
      }
      case 'npc': {
        const n = t.npc;
        const q = this.quest?.npc === n ? '❗' : '';
        return [q || (n.greeted ? '🙂' : '💬'), ROLE_NAME[n.role] ?? '사람', n.greeted ? '인사함' : ''];
      }
      case 'item': return t.item.kind === 'balloon' ? ['🎈', '빨간 풍선', ''] : ['🐶', '비스코트', '길 잃은 강아지'];
    }
  }

  private verbs(t: Target): [string | null, string | null] {
    const b = this.c.hero.body;
    switch (t.kind) {
      case 'place': return [this.c.visited(t.place) ? '다시 들어가기' : t.place.cat === 'park' ? '둘러보기' : '들어가기', '살펴보기'];
      case 'spot': {
        const s = t.spot;
        switch (s.kind) {
          case 'metro': return ['지하철 타러 내려가기', null];
          case 'bus': return ['버스 기다리기', null];
          case 'fountain': return ['물 마시기', null];
          case 'morris': return ['포스터 보기', null];
          case 'kiosk': return [this.mapBought.has(this.district) ? '신문 사기 €2.5' : '동네 지도 사기 €3', null];
          case 'terrace': return [b.mode === 'sit' ? '주문하기' : '테라스에 앉기', '메뉴 살펴보기'];
          case 'bench': return [b.mode === 'sit' ? null : '앉기', this.c.hero.crowd.pigeonsNear(s.x, s.y, 8) ? '비둘기에게 모이 주기' : null];
          default: return [null, null];
        }
      }
      case 'npc': {
        const n = t.npc;
        if (this.quest?.npc === n && this.quest.kind === 'way') return ['그쪽을 보고 가리키기', '다시 물어보기'];
        if (this.quest?.npc === n && this.quest.kind === 'photo') return ['사진 찍어 주기 (3)', null];
        if (this.quest?.npc === n && (this.quest.kind === 'balloon' || this.quest.kind === 'dog')) return [this.quest.item?.follow || this.c.hero.body.carry === 'balloon' ? '돌려주기' : '말 걸기', null];
        switch (n.role) {
          case 'musician': return ['동전 주기 €1', '같이 춤추기'];
          case 'mime': return ['동전 주기 €1', '인사하기 (1)'];
          case 'vendor': return ['크레프 사기', null];
          case 'painter': return ['초상화 부탁하기', null];
          case 'waiter': return ['자리 부탁하기', null];
          default: return ['말 걸기', n.greeted ? null : '인사하기 (1)'];
        }
      }
      case 'item': return [t.item.kind === 'balloon' ? '풍선 잡기' : '살살 다가가 데려가기', null];
    }
  }

  // ───────── E ─────────
  private primary() {
    const t = this.focusT;
    const b = this.c.hero.body;
    if (!t) { return; }
    switch (t.kind) {
      case 'place': this.ui.hideCard(); this.cardPlace = null; this.c.enter(t.place); return;
      case 'item': this.takeItem(t.item); return;
      case 'npc': void this.talkTo(t.npc); return;
      case 'spot': {
        const s = t.spot;
        switch (s.kind) {
          case 'metro': this.c.metro(); return;
          case 'bus': this.c.bus(s.ref ?? ''); return;
          case 'fountain': this.drink(); return;
          case 'morris': this.poster(s); return;
          case 'kiosk': void this.kiosk(); return;
          case 'bench': { const seat = this.c.hero.town.seatNear(b.x, b.y, 2.4); if (seat) this.sitAt(seat); return; }
          case 'terrace': void this.terrace(s); return;
        }
      }
    }
  }

  // ───────── R ─────────
  private secondary() {
    const t = this.focusT;
    if (!t) return;
    if (t.kind === 'place') { this.inspect(t.place, t.front); return; }
    if (t.kind === 'spot' && t.spot.kind === 'terrace') { const p = this.c.places().find((q) => q.id === t.spot.ref); if (p) this.inspect(p, this.c.hero.town.front({ id: p.id, x: this.pos(p)[0], y: this.pos(p)[1] })); return; }
    if (t.kind === 'spot' && t.spot.kind === 'bench') { this.feed(); return; }
    if (t.kind === 'npc') {
      if (t.npc.role === 'musician') { this.emote('dance'); return; }
      if (this.quest?.npc === t.npc && this.quest.kind === 'way' && this.quest.place) { this.ui.say(this.npcAt(t.npc), T.ASK_WAY(this.quest.place.name).fr, 3); this.c.hint(`"${this.quest.place.name}"이 있는 쪽을 보고 E. (방향만 맞으면 된다)`); return; }
      this.emote('wave');
    }
  }

  private npcAt(n: Npc) { return () => ({ x: n.x, y: n.y, z: n.z + 2.1 * n.scale + (n.state === 'sit' ? -0.7 : 0) }); }

  /** 밖(지도에서 찍어 걸어온 경우 등)에서 안내판을 연다 */
  inspectPlace(p: Place) {
    const [px, py] = this.pos(p);
    this.inspect(p, p.minor ? null : this.c.hero.town.front({ id: p.id, x: px, y: py }));
  }

  // ───────── 가게 앞 안내판(살펴보기) ─────────
  private inspect(p: Place, fr: Front | null) {
    const b = this.c.hero.body;
    const [px, py] = this.pos(p);
    b.facing = bearingOf((fr?.x ?? px) - b.x, (fr?.y ?? py) - b.y);
    b.doAct('think');
    sfx.pageTurn();
    const info = this.c.info(p);
    this.cardPlace = p;
    const at = () => ({ x: fr ? fr.x + fr.nx * 0.9 : px, y: fr ? fr.y + fr.ny * 0.9 : py, z: fr ? 4.6 : 3.2 });
    this.ui.showCard(at, (root) => {
      const head = document.createElement('div');
      head.className = 'wc-head';
      head.innerHTML = `<span class="em"></span><div><b></b><small></small></div>`;
      head.querySelector('.em')!.textContent = p.emoji;
      head.querySelector('b')!.textContent = p.name;
      head.querySelector('small')!.textContent = info.label;
      const blurb = document.createElement('p');
      blurb.textContent = info.blurb;
      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = info.meta;
      const row = document.createElement('div');
      row.className = 'wc-acts';
      const heart = document.createElement('button');
      const paint = () => { heart.textContent = this.c.S.saved.has(p.id) ? '♥ 찜함' : '♡ 찜'; };
      paint();
      heart.onclick = (e) => { e.stopPropagation(); this.c.toggleSave(p); paint(); };
      const go = document.createElement('button');
      go.className = 'primary';
      go.innerHTML = '<kbd>E</kbd> 들어가기';
      go.onclick = (e) => { e.stopPropagation(); this.ui.hideCard(); this.cardPlace = null; this.c.enter(p); };
      row.append(go, heart);
      root.append(head, blurb, meta, row);
    });
  }

  // ───────── 몸짓 ─────────
  private emote(kind: 'wave' | 'dance' | 'photo' | 'sit') {
    const h = this.c.hero, b = h.body;
    switch (kind) {
      case 'wave': {
        if (!b.wave()) return;
        sfx.bonjour();
        // 가까이서 이쪽을 볼 수 있는 사람이 인사를 받는다
        const n = h.crowd.nearest(b.x, b.y, b.facing, 9, (q) => !q.bike && q.role !== 'jogger');
        if (n) {
          if (!n.greeted) { n.greeted = true; this.stats.bonjour++; n.mood = Math.min(1, n.mood + 0.4); }
          setTimeout(() => { h.crowd.gesture(n, 'wave', 1.4); this.ui.say(this.npcAt(n), n.mood < -0.3 ? 'Mouais…' : T.pick(T.WAVE_BACK), 2.2); }, 350);
        }
        return;
      }
      case 'dance':
        if (b.doAct('dance')) { sfx.jump(); this.c.hint('춤춘다! 움직이면 멈춘다. 악사 옆에서 추면 구경꾼이 모인다.'); setTimeout(() => this.c.hint(''), 3500); }
        return;
      case 'photo':
        if (b.doAct('photo')) sfx.tick();
        return;
      case 'sit': {
        if (b.mode === 'sit') return;
        const seat = h.town.seatNear(b.x, b.y, 1.8);
        if (seat && !this.seatTaken(seat)) this.sitAt(seat);
        else if (b.sit(null)) this.c.hint('바닥에 앉아 쉰다. 앉아 있으면 기력과 지침이 돌아온다.');
        return;
      }
    }
  }

  private seatTaken(s: SeatSpot) {
    return this.c.hero.crowd.npcs.some((n) => n.anchor && n.state === 'sit' && Math.hypot(n.anchor.x - s.x, n.anchor.y - s.y) < 0.3);
  }

  private sitAt(seat: SeatSpot) {
    const b = this.c.hero.body;
    if (this.seatTaken(seat)) { this.c.toast('누가 앉아 있다'); return; }
    if (b.sit({ x: seat.x, y: seat.y, z: seat.z, facing: seat.facing })) sfx.sit();
  }

  /** 사진이 찍혔다(몸의 셔터 이벤트) — 무엇을 찍었나 본다 */
  onShutter() {
    const h = this.c.hero, b = h.body;
    const yaw = h.cam.yaw;
    let label = '';
    const q = this.quest;
    if (q?.kind === 'photo' && Math.hypot(q.npc.x - b.x, q.npc.y - b.y) < 7) {
      label = '관광객 부부';
      this.finishQuest(T.PHOTO_OK, `사진 부탁을 들어줬다`);
    }
    if (!label && h.crowd.pigeonsNear(b.x, b.y, 2.6) >= 3) { label = '비둘기들'; if (b.crouch || b.mode === 'act') this.c.toast('🐦 비둘기를 코앞에서 찍었다! (웅크리고 다가가면 날아가지 않는다)'); }
    if (!label) {
      const n = h.crowd.nearest(b.x, b.y, yaw, 12, (x) => x.role === 'musician' || x.role === 'mime' || x.role === 'painter');
      if (n) label = ROLE_NAME[n.role];
    }
    if (!label) {
      let bd = Infinity;
      for (const p of this.c.places()) {
        if (!p.curated) continue;
        const [px, py] = this.pos(p);
        const d = Math.hypot(px - b.x, py - b.y);
        if (d > 70 || Math.abs(angleDiff(yaw, bearingOf(px - b.x, py - b.y))) > 28) continue;
        if (d < bd) { bd = d; label = p.name; }
      }
    }
    this.stats.photos++;
    this.c.shot(label || '파리의 골목');
  }

  // ───────── 분수·포스터·가판대·테라스 ─────────
  private drink() {
    const b = this.c.hero.body;
    if (this.c.S.clock - this.lastDrink < 3) { this.c.toast('방금 마셨다'); return; }
    if (!b.doAct('drink')) return;
    this.lastDrink = this.c.S.clock;
    sfx.drink();
    setTimeout(() => {
      b.stamina = b.maxStamina; b.exhausted = false;
      this.c.rest(4);
      this.stats.drinks++;
      this.c.toast('💧 시원하다. 기력이 돌아왔다 (지침 −4)');
    }, 1500);
  }

  private poster(s: Spot) {
    const b = this.c.hero.body;
    b.facing = bearingOf(s.x - b.x, s.y - b.y);
    b.doAct('think');
    const cands = this.c.places().filter((p) => p.curated && (p.cat === 'museum' || p.cat === 'sight' || p.cat === 'park') && !p.known);
    const p = cands.sort((a, c) => Math.hypot(...sub(this.pos(a), [b.x, b.y])) - Math.hypot(...sub(this.pos(c), [b.x, b.y])))[0];
    if (!p) { this.ui.say(() => ({ x: s.x, y: s.y, z: 4.2 }), `${T.pick(T.POSTERS)} · 오늘 밤`, 3); return; }
    this.ui.say(() => ({ x: s.x, y: s.y, z: 4.2 }), `${T.pick(T.POSTERS)} · ${p.name}`, 4, 'poster');
    this.c.reveal(p, '포스터에서 봤다');
    this.c.toast(`📜 포스터: ${p.emoji} ${p.name} — 지도에 표시했다 (R: 길 안내)`);
    this.lastReveal = p;
  }
  lastReveal: Place | null = null;

  private async kiosk() {
    const h = this.c.hero;
    if (!this.mapBought.has(this.district)) {
      const i = await this.ui.talk('신문 가판대', 'Un plan du quartier ? Trois euros.', '이 동네 지도 한 장? 3유로예요. 볼거리가 다 적혀 있어요.', ['사요 (€3)', '괜찮아요']);
      if (i !== 0 || !this.c.pay(3, '동네 지도')) return;
      this.mapBought.add(this.district);
      sfx.pageTurn();
      h.body.carry = 'book';
      const list = this.c.places().filter((p) => p.curated && !p.known);
      for (const p of list) this.c.reveal(p, '지도에서');
      this.c.toast(`🗺 지도를 펼쳤다: 볼거리 ${list.length}곳이 지도에 표시됐다`);
      setTimeout(() => { if (h.body.carry === 'book') h.body.carry = null; }, 9000);
      return;
    }
    const i = await this.ui.talk('신문 가판대', 'Le Parisien, deux euros cinquante.', '르 파리지앵 한 부, 2.5유로예요.', ['사요 (€2.5)', '괜찮아요']);
    if (i !== 0 || !this.c.pay(2.5, '신문')) return;
    const tip = T.pick(T.TIPS);
    h.body.carry = 'book';
    setTimeout(() => { if (h.body.carry === 'book') h.body.carry = null; }, 9000);
    this.stats.tips.push(tip.ko);
    this.c.toast(`📰 신문 한쪽 구석: ${tip.ko}`);
  }

  private async terrace(s: Spot) {
    const h = this.c.hero, b = h.body;
    const p = this.c.places().find((q) => q.id === s.ref);
    if (b.mode !== 'sit') {
      const seats = h.town.seats.filter((x) => x.place === s.ref && !this.seatTaken(x));
      if (!seats.length) { this.c.toast('테라스가 꽉 찼다'); return; }
      const seat = seats.sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
      this.sitAt(seat);
    }
    // 웨이터가 온다
    const w = h.crowd.npcs.find((n) => n.tag === `waiter:${s.ref}`);
    if (w?.anchor) { w.anchor = { ...w.anchor, x: b.x + Math.sin((b.facing * Math.PI) / 180) * 0.9, y: b.y + Math.cos((b.facing * Math.PI) / 180) * 0.9, facing: bearingOf(b.x - w.x, b.y - w.y) }; }
    this.busy = true;
    await wait(900);
    const i = await this.ui.talk(w ? '웨이터' : p?.name ?? '카페', T.WAITER_HELLO.fr, T.WAITER_HELLO.ko, ['에스프레소 €2.5', '카페 크렘 €4.5', '와인 한 잔 €6.5', '괜찮아요']);
    this.busy = false;
    const menu: [string, number, number][] = [['에스프레소', 2.5, 12], ['카페 크렘', 4.5, 20], ['와인 한 잔', 6.5, 25]];
    if (i < 0 || i > 2) return;
    const [what, cost, mins] = menu[i];
    if (!this.c.pay(cost, what)) return;
    sfx.served();
    b.carry = i === 2 ? null : 'coffee';
    if (w) this.ui.say(this.npcAt(w), 'Et voilà !', 2);
    this.c.terrace(p, what, cost, mins);
    this.c.toast(`☕ ${what} · ${mins}분 · €${cost} — 사람 구경하며 쉬었다 (지침 −12)`);
    setTimeout(() => { if (b.carry === 'coffee') b.carry = null; }, 14000);
  }

  private feed() {
    const h = this.c.hero, b = h.body;
    if (!b.doAct('feed')) return;
    sfx.feed();
    setTimeout(() => { if (h.crowd.feed(b.x + Math.sin((b.facing * Math.PI) / 180) * 1.5, b.y + Math.cos((b.facing * Math.PI) / 180) * 1.5)) this.c.toast('🐦 비둘기가 우르르 몰려왔다 (지금 3을 누르면 사진!)'); }, 700);
  }

  // ───────── 사람과 말하기 ─────────
  private async talkTo(n: Npc) {
    const h = this.c.hero, b = h.body;
    const at = this.npcAt(n);
    b.facing = bearingOf(n.x - b.x, n.y - b.y);
    h.crowd.hold(n, b.x, b.y, 8);
    const q = this.quest;
    // 부탁을 들어주는 중
    if (q && q.npc === n) { await this.questTalk(q); return; }
    if (n.role === 'jogger') { const l = T.pick(T.BUSY); this.ui.say(at, l.fr, 2); return; }
    if (n.role === 'musician' || n.role === 'mime') { this.tipPerformer(n); return; }
    if (n.role === 'vendor') { await this.crepe(n); return; }
    if (n.role === 'painter') { await this.portrait(n); return; }
    if (n.role === 'waiter') { const s = h.town.spots.find((x) => x.kind === 'terrace' && x.ref === n.tag?.slice(7)); if (s) await this.terrace(s); return; }
    this.busy = true;
    try {
      // 인사 없이 말을 걸면
      if (!n.greeted) {
        this.stats.rude++;
        n.mood -= 0.35;
        const l = T.pick(T.NO_GREETING);
        this.ui.say(at, l.fr, 2.5);
        const i = await this.ui.talk(ROLE_NAME[n.role], l.fr, l.ko, ['봉주르! (인사한다)', '그냥 간다']);
        if (i !== 0) return;
        b.wave();
        sfx.bonjour();
        n.greeted = true;
        this.stats.bonjour++;
        this.ui.say(at, 'Bonjour.', 1.6);
        await wait(700);
      }
      n.talked++;
      if (n.talked > 2) { this.ui.say(at, 'Encore vous ? Bonne journée !', 2.2); return; }
      // 관광객은 가끔 부탁을 한다
      if (!this.quest && n.role === 'tourist' && Math.random() < 0.55) { this.busy = false; await this.startAsk(n); return; }
      // 가까운 곳 하나를 알려 주거나, 쓸모 있는 이야기를 해 준다
      const p = n.mood > -0.2 && Math.random() < 0.6 ? this.unseenNear(400) : null;
      if (p) {
        const [px, py] = this.pos(p);
        h.crowd.gesture(n, 'point', 2.5);
        n.facing = bearingOf(px - n.x, py - n.y);
        const l = T.REVEAL(p.name);
        this.ui.say(at, l.fr, 3);
        this.c.reveal(p, '현지인이 알려 줬다');
        this.stats.told++;
        const i = await this.ui.talk(ROLE_NAME[n.role], l.fr, `${l.ko} (${p.emoji} ${p.name} — 지도에 표시했다)`, ['거기로 안내해 줘요', '메르시!']);
        if (i === 0) this.c.guide(p);
        return;
      }
      const tip = T.pick(T.TIPS);
      this.ui.say(at, tip.fr, 3);
      if (!this.stats.tips.includes(tip.ko)) this.stats.tips.push(tip.ko);
      await this.ui.talk(ROLE_NAME[n.role], tip.fr, tip.ko, ['메르시!']);
    } finally {
      this.busy = false;
    }
  }

  private unseenNear(r: number): Place | null {
    const b = this.c.hero.body;
    let best: Place | null = null, bd = r;
    for (const p of this.c.places()) {
      if (p.known || this.c.visited(p) || p.minor) continue;
      const [px, py] = this.pos(p);
      const d = Math.hypot(px - b.x, py - b.y) - (p.curated ? 120 : 0);
      if (d < bd && Math.hypot(px - b.x, py - b.y) > 25) { bd = d; best = p; }
    }
    return best;
  }

  private tipPerformer(n: Npc) {
    const h = this.c.hero, b = h.body;
    if (!this.c.pay(1, '거리 공연')) return;
    b.doAct('tip');
    sfx.coin();
    setTimeout(() => {
      this.ui.say(this.npcAt(n), n.role === 'mime' ? '🙇' : T.MUSICIAN_MERCI.fr, 2.6);
      h.crowd.gesture(n, n.role === 'mime' ? 'wave' : 'play', 3);
      this.c.rest(2);
    }, 700);
  }

  private async crepe(n: Npc) {
    const h = this.c.hero, b = h.body;
    this.busy = true;
    const i = await this.ui.talk('크레프 장수', T.VENDOR_HELLO.fr, T.VENDOR_HELLO.ko, ['누텔라 €4.5', '버터·설탕 €3.5', '햄·치즈 갈레트 €6.5', '괜찮아요']);
    this.busy = false;
    const menu: [string, number, number][] = [['누텔라 크레프', 4.5, 22], ['버터·설탕 크레프', 3.5, 16], ['햄·치즈 갈레트', 6.5, 34]];
    if (i < 0 || i > 2) return;
    const [what, cost, fill] = menu[i];
    if (!this.c.pay(cost, what)) return;
    this.ui.say(this.npcAt(n), 'Et voilà, bon appétit !', 2);
    sfx.served();
    b.carry = 'crepe';
    b.doAct('eat');
    this.c.eat(fill);
    this.c.passTime(6);
    this.c.toast(`🥞 ${what} · €${cost} — 걸으면서 먹는다 (허기 −${fill})`);
    setTimeout(() => { if (b.carry === 'crepe') b.carry = null; }, 25000);
  }

  private async portrait(n: Npc) {
    const h = this.c.hero, b = h.body;
    this.busy = true;
    const i = await this.ui.talk('거리 화가', T.PAINTER_HELLO.fr, T.PAINTER_HELLO.ko, ['부탁해요 (€20)', '다음에요']);
    this.busy = false;
    if (i !== 0 || !this.c.pay(20, '초상화')) return;
    b.facing = bearingOf(n.x - b.x, n.y - b.y);
    b.sit(null);
    this.busy = true;
    await this.ui.fade(true, '#f3ead9');
    this.c.passTime(20);
    this.c.rest(8);
    // 화가 쪽에서 본 얼굴을 한 장 남긴다
    const yaw = (b.facing + 180) % 360;
    h.cam.yaw = yaw; h.cam.pitch = 8; h.cam.wantDist = 3;
    await this.ui.fade(false);
    await wait(600);
    this.stats.portraits++;
    this.c.shot('몽마르트르 초상화');
    this.ui.say(this.npcAt(n), 'Voilà ! Très joli.', 2.5);
    this.busy = false;
    h.cam.wantDist = 6.5;
  }

  // ───────── 사건(부탁) ─────────
  private startEvent() {
    const h = this.c.hero, b = h.body;
    const r = Math.random();
    if (r < 0.45) {
      // 관광객이 다가와 묻는다
      const n = h.crowd.nearest(b.x, b.y, b.facing + 180, 40, (q) => q.role === 'tourist' && !q.anchor) ?? h.crowd.nearest(b.x, b.y, b.facing, 40, (q) => q.role === 'tourist' && !q.anchor);
      if (!n) { this.eventT = 20; return; }
      void this.startAsk(n, true);
    } else if (r < 0.75) this.startBalloon();
    else this.startDog();
  }

  private async startAsk(n: Npc, approach = false) {
    const h = this.c.hero, b = h.body;
    const photo = Math.random() < 0.45;
    if (photo) {
      this.quest = { kind: 'photo', npc: n, line: '관광객이 사진을 부탁했다 — 그쪽을 보고 3', t: 0 };
    } else {
      const known = this.c.places().filter((p) => p.curated && !p.minor);
      const p = known.sort(() => Math.random() - 0.5).find((q) => { const [x, y] = this.pos(q); const d = Math.hypot(x - b.x, y - b.y); return d > 40 && d < 700; });
      if (!p) { this.eventT = 20; return; }
      this.quest = { kind: 'way', npc: n, place: p, line: `관광객이 ${p.name} 가는 길을 묻는다 — 그쪽을 보고 E`, t: 0 };
    }
    n.tag = 'quest-ask';
    if (approach) {
      n.state = 'follow';
      n.followTarget = { x: b.x, y: b.y };
      this.ui.say(this.npcAt(n), 'Excusez-moi !', 2.5);
      sfx.spot();
    }
    this.ui.questLine(`❗ ${this.quest.line}`);
    if (!approach) await this.questTalk(this.quest);
  }

  private async questTalk(q: Quest) {
    const h = this.c.hero, b = h.body;
    const n = q.npc;
    const at = this.npcAt(n);
    n.state = 'chat'; n.timer = 30; n.followTarget = null;
    if (q.kind === 'photo') {
      this.ui.say(at, T.ASK_PHOTO.fr, 3);
      await this.ui.talk('관광객', T.ASK_PHOTO.fr, `${T.ASK_PHOTO.ko} — 두세 걸음 물러나서 이쪽을 보고 3(사진).`, ['좋아요']);
      h.crowd.gesture(n, 'wave', 30);
      return;
    }
    if (q.kind === 'way' && q.place) {
      const [px, py] = this.pos(q.place);
      const off = Math.abs(angleDiff(b.facing, bearingOf(px - b.x, py - b.y)));
      if (q.t > 0) {
        // 두 번째부터는 가리키는 것으로 답한다
        b.point(b.facing);
        sfx.tick();
        await wait(600);
        if (off < 38) this.finishQuest(T.WAY_OK, `${q.place.name} 가는 길을 알려 줬다`);
        else { this.ui.say(at, T.WAY_BAD.fr, 3); this.c.toast(`방향이 틀렸다(${Math.round(off)}° 차이). 🗺 지도(M)에서 ${q.place.name}이 어느 쪽인지 봐도 된다`); q.t++; if (q.t > 3) this.endQuest(T.WAY_BAD); }
        return;
      }
      q.t = 1;
      const l = T.ASK_WAY(q.place.name);
      this.ui.say(at, l.fr, 3);
      await this.ui.talk('관광객', l.fr, `${l.ko} — ${q.place.emoji} ${q.place.name} 쪽을 보고 E로 가리켜 준다.`, ['알았어요']);
      return;
    }
    if (q.kind === 'balloon') {
      if (b.carry === 'balloon') { b.carry = null; this.finishQuest(T.BALLOON_BACK, '지붕 위 풍선을 찾아 줬다'); return; }
      await this.ui.talk('아이', T.BALLOON.fr, `${T.BALLOON.ko} — 빛기둥이 선 지붕으로 올라가서(벽에 붙어 계속 밀기) 풍선을 잡아 오자.`, ['찾아 줄게']);
      return;
    }
    if (q.kind === 'dog') {
      if (q.item?.follow && Math.hypot(q.item.x - n.x, q.item.y - n.y) < 6) { this.finishQuest(T.DOG_BACK, '잃어버린 강아지를 찾아 줬다'); return; }
      await this.ui.talk('개 주인', T.DOG_LOST.fr, `${T.DOG_LOST.ko} — 빛기둥 쪽. 뛰어가면 놀라 도망간다. 웅크리고(C) 살살 다가가자.`, ['찾아 볼게요']);
    }
  }

  private finishQuest(l: T.Line, what: string) {
    const q = this.quest;
    if (!q) return;
    const n = q.npc;
    this.ui.say(this.npcAt(n), l.fr, 3);
    this.c.hero.crowd.gesture(n, 'wave', 2);
    this.stats.helped++;
    this.stats.quests.push(what);
    sfx.spotBig();
    this.c.rest(4);
    // 보답: 현지인만 아는 곳 하나
    const p = this.unseenNear(600);
    if (p) { this.c.reveal(p, '고맙다며 알려 줬다'); this.c.toast(`✨ ${what}. 고맙다며 ${p.emoji} ${p.name}을 알려 줬다 (지도에 표시)`); }
    else this.c.toast(`✨ ${what} (지침 −4)`);
    this.endQuest(null);
  }

  private endQuest(l: T.Line | null) {
    const q = this.quest;
    if (q) {
      if (l) this.ui.say(this.npcAt(q.npc), l.fr, 3);
      q.npc.tag = undefined;
      q.npc.state = q.npc.bike ? 'ride' : 'walk'; q.npc.timer = 10;
      q.npc.followTarget = null;
      if (q.npc.role === 'quest') q.npc.role = 'passer';
      if (q.npc.anchor && q.kind !== 'way' && q.kind !== 'photo') { q.npc.anchor = null; q.npc.home = null; }
      if (q.item) { this.items.remove(q.item.mesh); }
      if (this.c.hero.body.carry === 'balloon') this.c.hero.body.carry = null;
    }
    this.quest = null;
    this.ui.questLine('');
    this.eventT = Math.max(this.eventT, 60);
  }

  /** 지금 가야 할 곳(빛기둥) — 로컬 좌표 */
  get beacon(): [number, number] | null {
    const q = this.quest;
    if (!q) return null;
    if (q.item && !q.item.follow && !(q.kind === 'balloon' && this.c.hero.body.carry === 'balloon')) return [q.item.x, q.item.y];
    if (q.kind === 'balloon' || q.kind === 'dog') return [q.npc.x, q.npc.y];
    return null;
  }

  private startBalloon() {
    const h = this.c.hero, b = h.body;
    // 아이 하나와, 가까운 지붕 하나
    const roof = this.findRoof(b.x, b.y);
    if (!roof) { this.eventT = 20; return; }
    const [fx, fy] = [Math.sin((b.facing * Math.PI) / 180), Math.cos((b.facing * Math.PI) / 180)];
    const kx = b.x + fx * 7 + fy * 2, ky = b.y + fy * 7 - fx * 2;
    if (h.world.buildingTopAt(kx, ky) > 0) { this.eventT = 20; return; }
    const kid = h.crowd.spawn('kid', kx, ky, bearingOf(roof.x - kx, roof.y - ky), { state: 'stand', anchor: { x: kx, y: ky, z: 0, facing: bearingOf(roof.x - kx, roof.y - ky) }, home: null, speed: 0 });
    kid.role = 'quest';
    kid.scale = 0.66;
    kid.tag = 'quest-kid';
    const mesh = balloonMesh();
    const it: Item = { kind: 'balloon', x: kx, y: ky, z: 1.2, mesh, t: 0, follow: false, flee: 0 };
    this.items.add(mesh);
    this.quest = { kind: 'balloon', npc: kid, item: it, line: '아이의 풍선이 지붕 위에 걸렸다 — 올라가서 잡아 오자', t: 0 };
    // 풍선이 두둥실 날아가 지붕에 걸린다
    const from = { x: kx, y: ky, z: 1.2 }, to = { x: roof.x, y: roof.y, z: roof.z + 0.3 };
    const t0 = performance.now();
    const fly = () => {
      const k = Math.min(1, (performance.now() - t0) / 3500);
      const e = k * k * (3 - 2 * k);
      it.x = from.x + (to.x - from.x) * e; it.y = from.y + (to.y - from.y) * e; it.z = from.z + (to.z - from.z) * e + Math.sin(k * Math.PI) * 4;
      if (k < 1 && this.quest?.item === it) requestAnimationFrame(fly);
    };
    requestAnimationFrame(fly);
    this.ui.say(this.npcAt(kid), 'Mon ballon !! 😭', 4);
    sfx.spotBig();
    this.ui.questLine(`🎈 ${this.quest.line}`);
    this.c.toast('🎈 아이의 풍선이 지붕 위로 날아갔다! 말을 걸어 보자');
  }

  private findRoof(x: number, y: number): { x: number; y: number; z: number } | null {
    const w = this.c.hero.world;
    let best: { x: number; y: number; z: number } | null = null, bd = Infinity;
    for (const s of w.near(x, y, 60)) {
      if (s.kind !== 'building' || s.top < 7 || s.top > 24 || !s.render) continue;
      const cx = s.render.cx, cy = s.render.cy;
      const d = Math.hypot(cx - x, cy - y);
      if (d < 18 || d > 60 || !World.contains(s, cx, cy)) continue;
      // 망사르드가 있으면 그 위(가장 높은 곳)
      const z = w.ground(cx, cy, 100, 0);
      const score = Math.abs(d - 35) + Math.abs(z - 14) * 0.5;
      if (score < bd) { bd = score; best = { x: cx, y: cy, z }; }
    }
    return best;
  }

  private startDog() {
    const h = this.c.hero, b = h.body;
    const owner = h.crowd.nearest(b.x, b.y, b.facing, 30, (q) => q.role === 'passer' && !q.anchor);
    if (!owner) { this.eventT = 20; return; }
    // 강아지는 50~90 m 떨어진 길 위
    const nodes = h.crowd.graphNodes;
    const cands = nodes.filter(([x, y]) => { const d = Math.hypot(x - b.x, y - b.y); return d > 50 && d < 90; });
    if (!cands.length) { this.eventT = 20; return; }
    const [dx, dy] = cands[Math.floor(Math.random() * cands.length)];
    owner.role = 'quest';
    owner.anchor = { x: owner.x, y: owner.y, z: 0, facing: owner.facing };
    owner.state = 'stand';
    owner.tag = 'quest-owner';
    const mesh = dogMesh();
    const it: Item = { kind: 'dog', x: dx, y: dy, z: 0, mesh, t: 0, follow: false, flee: 0 };
    this.items.add(mesh);
    this.quest = { kind: 'dog', npc: owner, item: it, line: '길 잃은 강아지 비스코트를 찾아 주자 (웅크리고 다가가기)', t: 0 };
    this.ui.say(this.npcAt(owner), 'Biscotte ! Biscotte !', 4);
    sfx.bark();
    this.ui.questLine(`🐶 ${this.quest.line}`);
    this.c.toast('🐶 누가 강아지를 부르며 찾고 있다. 말을 걸어 보자');
  }

  private takeItem(it: Item) {
    const b = this.c.hero.body;
    if (it.kind === 'balloon') {
      b.carry = 'balloon';
      this.items.remove(it.mesh);
      it.follow = true;
      sfx.grab();
      this.c.toast('🎈 풍선을 잡았다! 아이에게 돌려주자 (지붕에서 뛰어내려 글라이더로)');
      return;
    }
    if (b.speed > 2.5) { it.flee = 2; this.c.toast('강아지가 놀라 달아났다. 천천히!'); return; }
    it.follow = true;
    b.doAct('pet');
    sfx.bark();
    this.c.toast('🐶 비스코트가 꼬리를 흔들며 따라온다. 주인에게 데려가자');
  }

  private stepItems(dt: number) {
    const q = this.quest;
    const it = q?.item;
    if (!it) return;
    const h = this.c.hero, b = h.body;
    it.t += dt;
    if (it.kind === 'balloon') {
      it.mesh.visible = !it.follow;
      it.mesh.position.set(it.x, it.y, it.z + Math.sin(it.t * 2) * 0.15);
      // 지붕 위에서 가까이 가면 잡을 수 있다(높이도 맞아야)
      if (!it.follow && Math.hypot(it.x - b.x, it.y - b.y) < 1.6 && Math.abs(it.z - b.z) < 2.2 && b.mode !== 'climb') this.takeItem(it);
      return;
    }
    // 강아지
    const d = Math.hypot(it.x - b.x, it.y - b.y);
    let tx = it.x, ty = it.y, sp = 0;
    if (it.follow) {
      const [fx, fy] = [Math.sin(((b.facing + 150) * Math.PI) / 180), Math.cos(((b.facing + 150) * Math.PI) / 180)];
      tx = b.x + fx * 1.3; ty = b.y + fy * 1.3;
      sp = Math.min(6, Math.hypot(tx - it.x, ty - it.y) * 2.5);
    } else {
      // 뛰어오면 놀라서 달아난다
      if (d < 5 && b.speed > 3 && !b.crouch) it.flee = 1.6;
      if (it.flee > 0) { it.flee -= dt; tx = it.x + (it.x - b.x); ty = it.y + (it.y - b.y); sp = 4.5; }
      else if (Math.sin(it.t * 0.7) > 0.6) { tx = it.x + Math.sin(it.t) * 3; ty = it.y + Math.cos(it.t * 1.3) * 3; sp = 1; }
    }
    const dd = Math.hypot(tx - it.x, ty - it.y);
    if (dd > 0.05 && sp > 0) {
      const nx = it.x + ((tx - it.x) / dd) * sp * dt, ny = it.y + ((ty - it.y) / dd) * sp * dt;
      if (h.world.buildingTopAt(nx, ny) === 0) { it.x = nx; it.y = ny; }
      it.mesh.rotation.z = -Math.atan2(tx - it.x, ty - it.y);
    }
    it.mesh.position.set(it.x, it.y, 0);
    const legs = it.mesh.userData.legs as THREE.Object3D[];
    const ph = it.t * (sp > 0.3 ? 16 : 0);
    legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0)) * 0.6; });
    if (it.follow && q && Math.hypot(it.x - q.npc.x, it.y - q.npc.y) < 3) this.finishQuest(T.DOG_BACK, '잃어버린 강아지를 찾아 줬다');
  }

  private stepQuest(_dt: number) {
    const q = this.quest;
    if (!q) return;
    const b = this.c.hero.body;
    // 다가오던 관광객이 곁에 오면 말을 건다
    if (q.npc.state === 'follow' && q.npc.followTarget) {
      q.npc.followTarget = { x: b.x, y: b.y };
      if (Math.hypot(q.npc.x - b.x, q.npc.y - b.y) < 2.2) { q.npc.state = 'chat'; q.npc.timer = 40; q.npc.followTarget = null; void this.questTalk(q); }
    }
    // 너무 멀어지면 포기
    if (Math.hypot(q.npc.x - b.x, q.npc.y - b.y) > 160) this.endQuest(null);
  }

  /** 주변 사람들의 반응: 춤·벽타기·활공·부딪힘 */
  private ambient(dt: number) {
    const h = this.c.hero, b = h.body;
    if (h.bumped) {
      this.stats.bumps++;
      this.ui.say(this.npcAt(h.bumped), T.pick(T.BUMP), 2);
      sfx.bump();
      if (this.stats.bumps === 1) this.c.toast('사람과 부딪혔다. 붐비는 보도에선 걷거나, 구르기(V)로 비켜 가자');
    }
    if (b.mode === 'act' && b.act?.kind === 'dance') {
      this.danceAcc += dt;
      this.stats.danced += dt;
      if (this.danceAcc > 1.4) {
        this.danceAcc = 0;
        const musician = h.crowd.nearest(b.x, b.y, b.facing, 12, (n) => n.role === 'musician');
        for (const n of h.crowd.npcs) {
          const d = Math.hypot(n.x - b.x, n.y - b.y);
          if (d > (musician ? 12 : 7) || n.bike || Math.random() > (musician ? 0.5 : 0.25)) continue;
          if (n.anchor || n.state !== 'walk') { h.crowd.gesture(n, musician && Math.random() < 0.3 ? 'dance' : 'clap', 2.5); if (Math.random() < 0.3) this.ui.say(this.npcAt(n), T.pick(T.CHEER), 1.6); }
        }
        if (musician && Math.random() < 0.18) { this.c.S.money = Math.round((this.c.S.money + 0.5) * 100) / 100; this.c.toast('🪙 구경꾼이 동전을 던져 줬다 (+€0.5)'); sfx.coin(); }
      }
    }
    // 벽을 타거나 지붕에서 날면 사람들이 쳐다본다
    this.amazeT -= dt;
    if ((b.mode === 'climb' || b.mode === 'glide') && this.amazeT < 0) {
      this.amazeT = 3.5;
      const n = h.crowd.nearest(b.x, b.y, b.facing + 180, 18, (q) => !q.bike);
      if (n) { this.ui.say(this.npcAt(n), T.pick(T.AMAZED), 2); h.crowd.gesture(n, 'point', 2); n.facing = bearingOf(b.x - n.x, b.y - n.y); }
    }
  }

  /** 오늘의 기록에 넣을 줄들 */
  summary(): string[] {
    const s = this.stats;
    const out: string[] = [];
    if (s.bonjour || s.rude) out.push(s.rude > s.bonjour ? `인사 없이 말을 건 게 ${s.rude}번이에요. 파리에서는 가게·길 어디서든 "봉주르"가 먼저예요.` : `"봉주르"를 ${s.bonjour}번 건넸어요. 인사부터 하니 사람들이 더 많은 걸 알려 줬어요.`);
    if (s.helped) out.push(`길에서 ${s.helped}번 도움을 줬어요: ${s.quests.slice(0, 3).join(', ')}.`);
    if (s.told) out.push(`현지인이 알려 준 곳이 ${s.told}곳이에요.`);
    if (s.tips.length) out.push(`들은 이야기: ${s.tips.slice(0, 2).join(' / ')}`);
    if (s.danced > 5) out.push(`거리에서 ${Math.round(s.danced)}초 동안 춤췄어요.`);
    if (s.drinks) out.push(`월리스 분수에서 물을 ${s.drinks}번 마셨어요 — 물병 하나면 물값이 안 들어요.`);
    if (s.bumps >= 3) out.push(`사람과 ${s.bumps}번 부딪혔어요. 붐비는 보도에선 천천히!`);
    return out;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]];

function balloonMesh() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12).scale(1, 1, 1.2), new THREE.MeshToonMaterial({ color: 0xe63a3a }));
  m.position.z = 1.1;
  g.add(m);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0.7)]), new THREE.LineBasicMaterial({ color: 0xffffff })));
  return g;
}

function dogMesh() {
  const g = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({ color: 0xc9a45a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 3, 8), mat);
  body.position.z = 0.32;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6).scale(1, 1.3, 1), mat);
  head.position.set(0, 0.3, 0.45);
  const ear = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.1), new THREE.MeshToonMaterial({ color: 0x6b4a2a }));
  ear.position.set(0.07, 0.28, 0.54);
  const ear2 = ear.clone(); ear2.position.x = -0.07;
  const legs: THREE.Object3D[] = [];
  for (const [x, y] of [[-0.07, 0.15], [0.07, 0.15], [-0.07, -0.15], [0.07, -0.15]]) {
    const l = new THREE.Group();
    l.position.set(x, y, 0.27);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.24).translate(0, 0, -0.12), mat);
    l.add(m);
    legs.push(l);
    g.add(l);
  }
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 5, 12).rotateX(Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xd9483b }));
  collar.position.set(0, 0.2, 0.42);
  g.add(body, head, ear, ear2, collar);
  g.userData.legs = legs;
  return g;
}
