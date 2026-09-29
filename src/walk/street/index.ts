// 거리에서 무엇과 어떻게 주고받나. 다가가서 바라보면 이름표가 뜨고 F(행동)·몸짓(1 인사 2 춤 3 사진 4 앉기)으로
// 사람·벤치와 주고받는다. 길에서는 가끔 일이 생긴다: 사진 부탁, 지붕 위로 날아간 풍선, 잃어버린 강아지.
import * as THREE from 'three';
import type { Hero } from '../hero';
import type { Frame as InputFrame } from '../hero/input';
import type { Npc } from '../town/crowd';
import type { SeatSpot, Spot } from '../town';
import { World } from '../hero/world';
import { StreetUi } from './ui';
import type { Anchor } from './ui';
import * as T from './lines';
import * as sfx from '../sound';
import { EiffelQuests } from './eiffel';
import { Story } from './story';

export interface StreetCtx {
  hero: Hero;
  S: { clock: number; money: number };
  toast: (s: string) => void;
  hint: (s: string) => void;
  shot: (label: string) => void;
  frozen: () => boolean;
  /** 마리니에르를 입었나(사람들이 더 반긴다) */
  charm?: () => boolean;
  /** 장비를 얻었다 */
  gear?: (id: string) => void;
  /** 이야기 속 싸움: 그 자리에 적 무리를 세운다(이미 있으면 그대로) · 다 물리쳤나 */
  fight?: (key: string, x: number, y: number, z: number, foes: string[], ring?: number) => void;
  fightDone?: (key: string) => boolean;
  /** 모험 경험치·별조각(원신처럼) */
  xp?: (xp: number, stars: number, why: string) => void;
}

type Target =
  | { kind: 'spot'; spot: Spot }
  | { kind: 'npc'; npc: Npc }
  | { kind: 'item'; item: Item };

interface Item { kind: 'balloon' | 'dog'; x: number; y: number; z: number; mesh: THREE.Object3D; t: number; follow: boolean; flee: number }

interface Quest {
  kind: 'photo' | 'balloon' | 'dog';
  npc: Npc;
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
  readonly items = new THREE.Group();
  private danceAcc = 0;
  private amazeT = 0;
  private landmarkT = 0;
  private focusTick = 0;
  readonly landmarksSeen = new Set<string>();
  readonly c: StreetCtx;
  readonly eiffel: EiffelQuests;
  readonly story: Story;
  /** 프롤로그가 위쪽 한 줄을 쓰는 동안 */
  suppressLine = false;
  district = '';

  constructor(c: StreetCtx) {
    this.c = c;
    this.ui = new StreetUi((x, y, z, out) => c.hero.town.project(x, y, z, out));
    c.hero.crowd.scene.add(this.items);
    this.eiffel = new EiffelQuests({ ui: this.ui, c, items: this.items, helped: (what) => { this.stats.helped++; this.stats.quests.push(what); } });
    this.story = new Story({ ui: this.ui, c, items: this.items, helped: (what) => { this.stats.helped++; this.stats.quests.push(what); }, sparkling: () => this.eiffel.sparkling });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.ui.talking) this.ui.onTalkKey?.(-1); });
  }

  /** 지금 사진이 필요한가(📷 단추를 반짝인다) */
  get wantsPhoto() { return this.quest?.kind === 'photo' || this.eiffel.active === 'photo' || this.story.wantsPhoto; }

  /** 대화 중이거나 연출 중이면 걷기를 멈춘다 */
  get holding() { return this.busy || this.ui.talking; }

  /** 동네가 바뀌었다 */
  reset(district: string) {
    this.district = district;
    this.focusT = null;
    this.ui.focus(null);
    this.ui.hideCard();
    this.ui.clearBubbles();
    this.endQuest(null);
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
    this.eiffel.update(dt);
    this.story.update(dt, !this.quest && !this.eiffel.active && !this.suppressLine);
    this.landmarkT -= dt;
    if (this.landmarkT < 0) { this.landmarkT = 1; this.spotLandmarks(); }
    this.ambient(dt);
    // 몸짓
    if (f.emote && !this.busy) this.emote(f.emote);
    // 무엇을 보고 있나
    // 바라보는 것은 세 프레임에 한 번만 다시 고른다(가게 수백 곳을 매 프레임 훑지 않게)
    this.focusTick = (this.focusTick + 1) % 3;
    if (this.focusTick === 0 || f.interact) this.focusT = b.mode === 'ground' || b.mode === 'sit' ? this.pickFocus() : null;
    this.paintFocus();
    if (this.busy) return;
    if (f.interact) this.primary();
    // 걸은 만큼 사건이 가까워진다
    if (b.speed > 0.5 && !this.quest && !this.eiffel.active && !this.suppressLine) this.eventT -= dt; // 첫걸음 동안엔 거리 사건을 미룬다
    if (this.eventT < 0 && !this.quest && !this.eiffel.active) { this.eventT = 70 + Math.random() * 60; this.startEvent(); }
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
    if (npc) consider({ kind: 'npc', npc }, npc.x, npc.y, 3.4, this.quest?.npc === npc || this.eiffel.giverOf(npc) || this.story.giverOf(npc) ? 3 : 0.8);
    // 앉을 수 있는 벤치만(가판대·분수·지하철 입구는 그냥 거리 풍경)
    for (const sp of h.town.spots) if (sp.kind === 'bench' && b.mode !== 'sit' && Math.hypot(sp.x - b.x, sp.y - b.y) < 2.2) consider({ kind: 'spot', spot: sp }, sp.x, sp.y, 2.2);
    return best;
  }

  private anchorOf(t: Target): () => Anchor | null {
    switch (t.kind) {
      case 'npc': return () => ({ x: t.npc.x, y: t.npc.y, z: t.npc.z + 2.05 * t.npc.scale + (t.npc.state === 'sit' ? -0.7 : 0) });
      case 'spot': { const gz = this.c.hero.world.terrain(t.spot.x, t.spot.y); return () => ({ x: t.spot.x, y: t.spot.y, z: gz + (t.spot.kind === 'metro' ? 3.4 : t.spot.kind === 'morris' ? 4.4 : t.spot.kind === 'kiosk' ? 3.4 : 2.4) }); }
      case 'item': return () => ({ x: t.item.x, y: t.item.y, z: t.item.z + (t.item.kind === 'balloon' ? 1.6 : 0.9) });
    }
  }

  private paintFocus() {
    const t = this.focusT;
    const hud = this.c.hero.hud;
    if (!t) { this.ui.focus(null); hud.setPrompt(this.sittingPrompt()); hud.setPrompt2(null); return; }
    const [icon, name, sub] = this.label(t);
    this.ui.focus(this.anchorOf(t), icon, name, sub);
    const p1 = this.verb(t);
    hud.setPrompt(p1 ? { verb: p1, what: `${icon} ${name}` } : this.sittingPrompt());
    hud.setPrompt2(null);
  }

  private sittingPrompt() {
    const b = this.c.hero.body;
    return b.mode === 'sit' ? { verb: '일어서기', what: '(움직이면 일어선다)' } : null;
  }

  private label(t: Target): [string, string, string] {
    switch (t.kind) {
      case 'spot': {
        const s = t.spot;
        const name = s.kind === 'metro' ? `${s.ref} 역` : s.kind === 'bus' ? `${s.ref} 정류장` : s.kind === 'fountain' ? '월리스 분수' : s.kind === 'morris' ? '모리스 기둥' : s.kind === 'kiosk' ? '신문 가판대' : s.kind === 'terrace' ? `${s.label} 테라스` : s.kind === 'bench' ? '벤치' : '벨리브';
        return [ICON[s.kind], name, s.kind === 'metro' ? (s.label ?? '').split('—')[0].trim() : ''];
      }
      case 'npc': {
        const n = t.npc;
        const e = this.eiffel.label(n) ?? this.story.label(n);
        if (e) return e;
        const q = this.quest?.npc === n ? '❗' : '';
        return [q || (n.greeted ? '🙂' : '💬'), ROLE_NAME[n.role] ?? '사람', n.greeted ? '인사함' : ''];
      }
      case 'item': return t.item.kind === 'balloon' ? ['🎈', '빨간 풍선', ''] : ['🐶', '비스코트', '길 잃은 강아지'];
    }
  }




  private verb(t: Target): string | null {
    switch (t.kind) {
      case 'spot': return '앉기';
      case 'npc': {
        const n = t.npc;
        const ev = this.eiffel.verb(n) ?? this.story.verb(n);
        if (ev) return ev;
        if (this.quest?.npc === n && this.quest.kind === 'photo') return '사진 찍어 주기 (3)';
        if (this.quest?.npc === n) return this.quest.item?.follow || this.c.hero.body.carry === 'balloon' ? '돌려주기' : '말 걸기';
        return '말 걸기';
      }
      case 'item': return t.item.kind === 'balloon' ? '풍선 잡기' : '살살 다가가 데려가기';
    }
  }

  // ───────── F ─────────
  private primary() {
    const t = this.focusT;
    const b = this.c.hero.body;
    if (!t) return;
    switch (t.kind) {
      case 'item': this.takeItem(t.item); return;
      case 'npc': void this.talkTo(t.npc); return;
      case 'spot': { const seat = this.c.hero.town.seatNear(b.x, b.y, 2.4); if (seat) this.sitAt(seat); return; }
    }
  }

  private npcAt(n: Npc) { return () => ({ x: n.x, y: n.y, z: n.z + 2.1 * n.scale + (n.state === 'sit' ? -0.7 : 0) }); }



  // ───────── 몸짓 ─────────
  private emote(kind: 'wave' | 'dance' | 'photo' | 'sit') {
    const h = this.c.hero, b = h.body;
    switch (kind) {
      case 'wave': {
        if (!b.wave()) return;
        sfx.bonjour();
        sfx.say('Bonjour !', 4242);
        // 가까이서 이쪽을 볼 수 있는 사람이 인사를 받는다
        const n = h.crowd.nearest(b.x, b.y, b.facing, 9, (q) => !q.bike && q.role !== 'jogger');
        if (n) {
          if (!n.greeted) { n.greeted = true; this.stats.bonjour++; n.mood = Math.min(1, n.mood + (this.c.charm?.() ? 0.7 : 0.4)); }
          setTimeout(() => { h.crowd.gesture(n, 'wave', 1.4); this.ui.say(this.npcAt(n), n.mood < -0.3 ? 'Mouais…' : T.pick(T.WAVE_BACK), 2.2, '', n.id); }, 350);
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

  /** 랜드마크에 가까이 오면(또는 지붕 위에서 보이면) 알린다 */
  private spotLandmarks() {
    const b = this.c.hero.body;
    for (const l of this.c.hero.town.landmarks) {
      if (this.landmarksSeen.has(l.id) || !l.clear) continue;
      const d = Math.hypot(l.x - b.x, l.y - b.y);
      const high = b.z > 12 && d < 1500;
      if (d > l.clear + 90 && !high) continue;
      this.landmarksSeen.add(l.id);
      sfx.fanfare();
      this.ui.say(() => ({ x: l.x, y: l.y, z: l.z + 30 }), `✨ ${l.emoji} ${l.name}`, 4, 'found big');
      this.c.toast(`${l.emoji} ${l.name}${high ? ' — 지붕 위에서 보인다' : ''}`);
    }
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
    if (!label) label = this.story.onShutter(yaw) ?? '';
    if (!label) label = this.eiffel.onShutter(yaw) ?? '';
    if (!label && h.crowd.pigeonsNear(b.x, b.y, 2.6) >= 3) { label = '비둘기들'; if (b.crouch || b.mode === 'act') this.c.toast('🐦 비둘기를 코앞에서 찍었다! (웅크리고 다가가면 날아가지 않는다)'); }
    if (!label) {
      const n = h.crowd.nearest(b.x, b.y, yaw, 12, (x) => x.role === 'musician' || x.role === 'mime' || x.role === 'painter');
      if (n) label = ROLE_NAME[n.role];
    }
    if (!label) {
      // 화면 가운데 가까이 보이는 랜드마크(멀어도 된다)
      let bd = Infinity;
      for (const l of h.town.landmarks) {
        if (!l.clear) continue;
        const d = Math.hypot(l.x - b.x, l.y - b.y);
        if (d > 6000 || Math.abs(angleDiff(yaw, bearingOf(l.x - b.x, l.y - b.y))) > 22) continue;
        if (d < bd) { bd = d; label = l.name; }
      }
    }
    this.stats.photos++;
    this.c.shot(label || '파리의 골목');
  }






  // ───────── 사람과 말하기 ─────────
  private async talkTo(n: Npc) {
    const h = this.c.hero, b = h.body;
    const at = this.npcAt(n);
    b.facing = bearingOf(n.x - b.x, n.y - b.y);
    h.crowd.hold(n, b.x, b.y, 8);
    const q = this.quest;
    // 에펠탑 둘레의 부탁·가게
    if (this.eiffel.owns(n)) { this.busy = true; try { await this.eiffel.talk(n); } finally { this.busy = false; } return; }
    if (this.story.owns(n)) { this.busy = true; try { await this.story.talk(n); } finally { this.busy = false; } return; }
    // 부탁을 들어주는 중
    if (q && q.npc === n) { await this.questTalk(q); return; }
    if (n.role === 'jogger') { const l = T.pick(T.BUSY); this.ui.say(at, l.fr, 2); return; }
    this.busy = true;
    try {
      // 먼저 인사(봉주르) — 말을 걸면 저절로 한다
      if (!n.greeted) {
        b.wave();
        sfx.bonjour();
        sfx.say('Bonjour !', 4242);
        n.greeted = true;
        this.stats.bonjour++;
        this.ui.say(at, 'Bonjour !', 1.6);
        await wait(600);
      }
      n.talked++;
      if (n.talked > (this.c.charm?.() ? 4 : 2)) { this.ui.say(at, 'Encore vous ? Bonne journée !', 2.2); return; }
      // 관광객은 가끔 사진을 부탁한다
      if (!this.quest && n.role === 'tourist' && Math.random() < 0.5) { this.busy = false; await this.startAsk(n); return; }
      const tip = T.pick(T.TIPS);
      this.ui.say(at, tip.fr, 3);
      if (!this.stats.tips.includes(tip.ko)) this.stats.tips.push(tip.ko);
      await this.ui.talk(ROLE_NAME[n.role], tip.fr, tip.ko, ['메르시!']);
    } finally {
      this.busy = false;
    }
  }





  // ───────── 사건(부탁) ─────────
  private startEvent() {
    const h = this.c.hero, b = h.body;
    const r = Math.random();
    if (r < 0.35) {
      // 관광객이 다가와 묻는다
      const n = h.crowd.nearest(b.x, b.y, b.facing + 180, 40, (q) => q.role === 'tourist' && !q.anchor) ?? h.crowd.nearest(b.x, b.y, b.facing, 40, (q) => q.role === 'tourist' && !q.anchor);
      if (!n) { this.eventT = 20; return; }
      void this.startAsk(n, true);
    } else if (r < 0.75) this.startBalloon();
    else this.startDog();
  }

  private async startAsk(n: Npc, approach = false) {
    const h = this.c.hero, b = h.body;
    this.quest = { kind: 'photo', npc: n, line: '관광객이 사진을 부탁했다 — 그쪽을 보고 3', t: 0 };
    n.tag = 'quest-ask';
    if (approach) {
      n.state = 'follow';
      n.followTarget = { x: b.x, y: b.y };
      this.ui.say(this.npcAt(n), 'Excusez-moi !', 2.5, '', n.id);
      sfx.spot();
    }
    this.ui.questLine(`❗ ${this.quest.line}`);
    sfx.questStart();
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
    this.ui.say(this.npcAt(n), l.fr, 3, '', n.id);
    this.c.hero.crowd.gesture(n, 'wave', 2);
    this.stats.helped++;
    this.stats.quests.push(what);
    sfx.questDone();
    this.c.xp?.(50, 10, what);
    this.c.toast(`✨ ${what}`);
    this.endQuest(null);
  }

  private endQuest(l: T.Line | null) {
    const q = this.quest;
    if (q) {
      if (l) this.ui.say(this.npcAt(q.npc), l.fr, 3, '', q.npc.id);
      q.npc.tag = undefined;
      q.npc.state = q.npc.bike ? 'ride' : 'walk'; q.npc.timer = 10;
      q.npc.followTarget = null;
      if (q.npc.role === 'quest') q.npc.role = 'passer';
      if (q.npc.anchor && q.kind !== 'photo') { q.npc.anchor = null; q.npc.home = null; }
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
    if (!q) return this.eiffel.beacon ?? this.story.beacon;
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
    const kz = h.world.terrain(kx, ky);
    const it: Item = { kind: 'balloon', x: kx, y: ky, z: kz + 1.2, mesh, t: 0, follow: false, flee: 0 };
    this.items.add(mesh);
    this.quest = { kind: 'balloon', npc: kid, item: it, line: '아이의 풍선이 지붕 위에 걸렸다 — 올라가서 잡아 오자', t: 0 };
    // 풍선이 두둥실 날아가 지붕에 걸린다
    const from = { x: kx, y: ky, z: kz + 1.2 }, to = { x: roof.x, y: roof.y, z: roof.z + 0.3 };
    const t0 = performance.now();
    const fly = () => {
      const k = Math.min(1, (performance.now() - t0) / 3500);
      const e = k * k * (3 - 2 * k);
      it.x = from.x + (to.x - from.x) * e; it.y = from.y + (to.y - from.y) * e; it.z = from.z + (to.z - from.z) * e + Math.sin(k * Math.PI) * 4;
      if (k < 1 && this.quest?.item === it) requestAnimationFrame(fly);
    };
    requestAnimationFrame(fly);
    this.ui.say(this.npcAt(kid), 'Mon ballon !! 😭', 4, '', kid.id);
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
    this.ui.say(this.npcAt(owner), 'Biscotte ! Biscotte !', 4, '', owner.id);
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
    it.mesh.position.set(it.x, it.y, h.world.terrain(it.x, it.y));
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
      this.ui.say(this.npcAt(h.bumped), T.pick(T.BUMP), 2, '', h.bumped.id);
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
          if (n.anchor || n.state !== 'walk') { h.crowd.gesture(n, musician && Math.random() < 0.3 ? 'dance' : 'clap', 2.5); if (Math.random() < 0.2) sfx.applause(6); if (Math.random() < 0.3) this.ui.say(this.npcAt(n), T.pick(T.CHEER), 1.6, '', n.id); }
        }
      }
    }
    // 벽을 타거나 지붕에서 날면 사람들이 쳐다본다
    this.amazeT -= dt;
    if ((b.mode === 'climb' || b.mode === 'glide') && this.amazeT < 0) {
      this.amazeT = 3.5;
      const n = h.crowd.nearest(b.x, b.y, b.facing + 180, 18, (q) => !q.bike);
      if (n) { this.ui.say(this.npcAt(n), T.pick(T.AMAZED), 2, '', n.id); h.crowd.gesture(n, 'point', 2); n.facing = bearingOf(b.x - n.x, b.y - n.y); }
    }
  }

}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
