// 첫걸음(프롤로그): 헬기 대신 에펠탑 앞 샹드마르스 잔디밭에서 시작해, 리리를 따라 한 가지씩 해 본다.
// 지도(켜 둔 순간이동 포인트) → 보물상자 → 퀴즈 → 요괴 야영지 → 사진(📷) → 쥐왕과의 만남(지금은 못 이긴다!) →
// 상승으로 탑 1층 → 글라이더 → 기원 → 수첩.
// 모두 에펠탑 둘레 250 m 안이라 헤맬 일이 없다. 한 단계마다 빛기둥 · 리리의 한마디 · 작은 보상.
// 이미 한 것은 저절로 넘어가고, 건너뛸 수도 있다. 진행은 localStorage에 남는다.
import type { Hero } from './hero';
import type { LngLat } from './graph';
import type { Progress } from './progress';
import type { Explore } from './explore';
import { lmPoint } from './explore';
import type { Story } from './street/story';
import type { Companion } from './companion';
import { WISH_COST } from './wish';
import * as sfx from './sound';

export interface PrologueCtx {
  hero: Hero;
  progress: Progress;
  explore: () => Explore | null;
  story: () => Story | null;
  companion: () => Companion | null;
  journalOpen(): boolean;
  wishOpen(): boolean;
  toast(s: string): void;
  hint(s: string): void;
  money(eur: number): void;
  /** 프롤로그 동안 다른 안내(거리 한 줄·발견 알림·리리의 잡담)를 멈춘다 */
  quiet(on: boolean): void;
  touch(): boolean;
  /** 큰 지도를 보고 있나 */
  mapOpen(): boolean;
  /** 지금까지 찍은 사진 수 */
  photos(): number;
  /** 쥐왕(없으면 null) · 달려들게 하기 · 쓰러진 횟수 */
  king(): { x: number; y: number; fighting: boolean } | null;
  provoke(on: boolean): void;
  downs(): number;
}
/** 쥐왕의 굴: 샹드마르스 끝(에콜 밀리테르 쪽) */
export const KING_AT: LngLat = lmPoint('eiffel', 0, -470);

const KEY = 'carnet-prologue-v1';
/** 시작 자리: 샹드마르스 잔디밭, 탑을 바라보며 */
export const PROLOGUE_START: LngLat = lmPoint('eiffel', 0, -188);
export const TOWER: LngLat = lmPoint('eiffel', 0, 0);
const CHEST_KEY = 'pro:chest', CAMP_KEY = 'pro:camp';
const CHEST_AT = lmPoint('eiffel', 16, -152);
const CAMP_AT = lmPoint('eiffel', -38, -112);
const JULIE_AT = lmPoint('eiffel', 40, -104);

type StepId = 'map' | 'chest' | 'quiz' | 'camp' | 'photo' | 'king' | 'ascend' | 'glide' | 'wish' | 'journal';
interface Step {
  id: StepId;
  title: string;
  /** 지금 할 일(키보드 / 터치) */
  line: (touch: boolean) => string;
  lili: (touch: boolean) => string;
  reward: { xp: number; stars: number; eur?: number };
}

const STEPS: Step[] = [
  { id: 'map', title: '지도와 순간이동', reward: { xp: 0, stars: 10 },
    line: (t) => `🗺 왼쪽 위 미니맵을 ${t ? '눌러' : '누르거나 M으로'} 지도를 열고, 켜 둔 🔷 에펠탑·트로카데로·마레를 본 뒤 닫기`,
    lili: (t) => `안녕! 나는 리리야. 여기는 에펠탑 앞 샹드마르스! 순간이동 포인트 세 곳은 리리가 미리 켜 뒀어 — 왼쪽 위 동그란 미니맵을 ${t ? '눌러' : '누르거나 M을 눌러'} 지도를 열어 봐! 🔷를 누르면 그리로 순간이동이야.` },
  { id: 'chest', title: '보물상자', reward: { xp: 0, stars: 10 },
    line: (t) => `🎁 빛기둥 쪽 보물상자 열기 (${t ? '손 단추' : 'F'})`,
    lili: (t) => `멀리 갈 땐 지도에서 🔷를 누르면 돼. 이제 저기 보물상자! 가까이 가서 ${t ? '손 단추' : 'F'}로 열어 봐!` },
  { id: 'quiz', title: '가이드 쥘리의 퀴즈', reward: { xp: 0, stars: 10 },
    line: (t) => `❓ 가이드 쥘리에게 말 걸고 퀴즈 풀기 (${t ? '손 단추' : 'F'})`,
    lili: () => '파리엔 도움이 필요한 사람이 많아. 저기 ❓ 표시가 뜬 가이드 쥘리가 퀴즈를 낸대. 맞히면 보상도 있어!' },
  { id: 'camp', title: '요괴 야영지', reward: { xp: 60, stars: 20 },
    line: (t) => t ? '⚔️ 봉인된 상자를 지키는 쥐 기사·슬라임 물리치기 (⚔️ · 🌀 · 🌪️ 단추)' : '⚔️ 봉인된 상자를 지키는 쥐 기사·슬라임 물리치기 (마우스 톡 = 공격 · E 스킬 · Q 폭발 · V 구르기)',
    lili: (t) => `앗, 하수도 쥐 기사랑 안개 슬라임이 상자를 지키고 있어! 에펠탑 밑엔 쥐가 정말 많거든. 우산으로 혼내 주자! ${t ? '⚔️ 단추로 때리고, 🌀 단추가 스킬이야.' : '마우스를 톡 치면 공격, E는 바람 소용돌이!'}` },
  { id: 'photo', title: '사진', reward: { xp: 30, stars: 10 },
    line: (t) => `📷 오른쪽 위 📷 단추${t ? '' : '(또는 3)'}로 사진 한 장 — 탑을 화면 가운데 두고`,
    lili: (t) => `부탁 중엔 사진을 찍어야 하는 게 많아! 사진기는 오른쪽 위 반짝이는 📷 단추${t ? '' : ', 키보드는 3'}이야. 탑을 보고 한 장 찍어 봐!` },
  { id: 'king', title: '쥐왕', reward: { xp: 80, stars: 30 },
    line: () => '👑 샹드마르스 끝, 빨간 원 안의 쥐왕을 보러 가자 — 덤비면 구르기(V)로 피하며 도망치기',
    lili: () => '…잠깐. 저 끝의 빨간 원 보여? 에펠탑 쥐들의 왕, 쥐왕이 사는 곳이야. 가까이서 한번 보기만 하자. 덤비면… 바로 도망쳐!' },
  { id: 'ascend', title: '상승', reward: { xp: 60, stars: 20 },
    line: (t) => `⤒ 에펠탑 한가운데 아래에 서서 ${t ? '⤒ 단추' : 'T'} — 1층(58 m)으로 솟아오르기`,
    lili: (t) => `이번엔 특별한 기술! 탑 한가운데 바로 아래에 서면 머리 위에 1층 바닥이 있지? 거기서 ${t ? '⤒ 단추' : 'T'}를 누르면 지붕을 뚫고 솟아올라!` },
  { id: 'glide', title: '글라이더', reward: { xp: 60, stars: 20 },
    line: (t) => `🪂 1층에서 뛰어내려 공중에서 ${t ? '점프 단추' : 'Space'} — 글라이더로 잔디밭에 내려앉기`,
    lili: (t) => `와, 높다! 파리가 다 보여! 이제 난간 밖으로 뛰어내려서 공중에서 ${t ? '점프 단추' : 'Space'}를 눌러 봐. 글라이더가 펴져!` },
  { id: 'wish', title: '기원', reward: { xp: 0, stars: 0 },
    line: () => '✨ 위쪽 ✨ 단추 → 기원 1번 (별조각 ⭐160)',
    lili: () => '잘했어! 여기까지 오면서 별조각이 모였지? 위쪽 ✨ 단추를 누르면 "기원"을 할 수 있어. 좋은 옷이 나올지도!' },
  { id: 'journal', title: '파리 수첩', reward: { xp: 0, stars: 0 },
    line: (t) => `📖 파리 수첩 열어 보기 (${t ? '📖 단추' : 'J 또는 📖 단추'})`,
    lili: () => '마지막! 📖 파리 수첩엔 메인 이벤트·서브 이벤트·오늘의 의뢰가 다 적혀 있어. 한번 열어 봐!' },
];

export class Prologue {
  private readonly c: PrologueCtx;
  private readonly el: HTMLElement;
  private step = 0;
  private stepT = 0;
  private glideT = 0;
  private wishes0 = 0;
  private active = false;
  private nudged: HTMLElement | null = null;
  private remindT = 0;
  private sawMap = false;
  private photos0 = 0;
  private downs0 = 0;
  private kingT = 0;
  private kingSeen = false;
  private kingEnd: 'down' | 'survived' | 'fled' | '' = '';
  onDone?: () => void;

  constructor(c: PrologueCtx) {
    this.c = c;
    this.el = document.createElement('div');
    this.el.className = 'pro';
    this.el.innerHTML = '<p class="h"><b>🌱 첫걸음</b><span class="n"></span><button type="button" class="skip" title="첫걸음 건너뛰기">건너뛰기</button></p><p class="t"></p><p class="dots"></p>';
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.querySelector('.skip')!.addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); this.finish(true); });
    document.body.appendChild(this.el);
    try { const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { step: number } | null; if (d) this.step = d.step; } catch { /* 처음 */ }
  }

  /** 끝냈거나 건너뛰었다 */
  get done() { return this.step >= STEPS.length; }
  get running() { return this.active; }
  get stepId(): StepId | null { return this.active ? STEPS[this.step]?.id ?? null : null; }

  private save() { try { localStorage.setItem(KEY, JSON.stringify({ step: this.step })); } catch { /* 무시 */ } }

  /** 시작(이미 끝냈으면 아무것도 안 한다) */
  begin() {
    if (this.done) return;
    const ex = this.c.explore();
    ex?.addFixed(CHEST_KEY, CHEST_AT, 'chest', 'exquisite');
    ex?.addFixed(CAMP_KEY, CAMP_AT, 'camp', 'exquisite');
    this.sawMap = false;
    this.active = true;
    this.c.quiet(true);
    this.el.classList.add('on');
    this.enter(1.2);
  }

  private enter(delay = 0.6) {
    const s = STEPS[this.step];
    this.stepT = 0;
    this.glideT = 0;
    this.remindT = 25;
    this.paint();
    if (s.id === 'wish') {
      const P = this.c.progress;
      this.wishes0 = P.wishes;
      if (P.stars < WISH_COST) { const give = WISH_COST - P.stars; P.addStars(give); this.c.toast(`🧚 리리가 별조각 ⭐${give}을 나눠 줬다`); }
      this.nudge('#wish-go');
    } else if (s.id === 'journal') this.nudge('#journal-go');
    else if (s.id === 'photo') { this.photos0 = this.c.photos(); this.nudge('#photo-go'); }
    else if (s.id === 'map') { this.sawMap = false; this.nudge(null); }
    else if (s.id === 'king') { this.downs0 = this.c.downs(); this.kingT = 0; this.kingSeen = false; this.kingEnd = ''; this.c.provoke(true); this.nudge(null); }
    else this.nudge(null);
    setTimeout(() => { if (this.active && STEPS[this.step] === s) this.c.companion()?.line(s.lili(this.c.touch()), 7, this.beacon() ?? undefined); }, delay * 1000);
  }

  private nudge(sel: string | null) {
    this.nudged?.classList.remove('nudge');
    this.nudged = sel ? document.querySelector<HTMLElement>(sel) : null;
    this.nudged?.classList.add('nudge');
  }

  private paint() {
    const s = STEPS[this.step];
    if (!s) return;
    this.el.querySelector('.n')!.textContent = `${this.step + 1}/${STEPS.length} · ${s.title}`;
    this.el.querySelector('.t')!.textContent = s.line(this.c.touch());
    this.el.querySelector('.dots')!.innerHTML = STEPS.map((_, i) => `<i class="${i < this.step ? 'ok' : i === this.step ? 'now' : ''}"></i>`).join('');
  }

  private local(p: LngLat): [number, number] { return this.c.hero.frame.toLocal(p) as [number, number]; }

  /** 빛기둥(로컬) */
  beacon(): [number, number] | null {
    if (!this.active) return null;
    const s = STEPS[this.step];
    switch (s?.id) {
      case 'king': { const k = this.c.king(); return k ? [k.x, k.y] : this.local(KING_AT); }
      case 'chest': return this.local(CHEST_AT);
      case 'quiz': { const n = this.c.story()?.run('s-eiffel-quiz').npc; return n ? [n.x, n.y] : this.local(JULIE_AT); }
      case 'camp': return this.local(CAMP_AT);
      case 'ascend': return this.local(TOWER);
      case 'glide': return this.c.hero.body.z - this.c.hero.world.terrain(this.c.hero.body.x, this.c.hero.body.y) > 20 ? this.local(lmPoint('eiffel', 0, -150)) : this.local(TOWER);
      default: return null;
    }
  }

  /** 이 단계를 마쳤는가 */
  private met(s: Step, dt: number): boolean {
    const P = this.c.progress, h = this.c.hero, b = h.body;
    switch (s.id) {
      case 'map': if (this.c.mapOpen()) this.sawMap = true; return this.sawMap && !this.c.mapOpen();
      case 'photo': return this.c.photos() > this.photos0;
      case 'king': {
        // 쥐왕이 달려들어 쓰러뜨렸거나, 달려든 뒤 멀리 도망쳤거나, 20초를 버텼으면
        const k = this.c.king();
        if (k?.fighting) { this.kingT += dt; this.kingSeen = true; }
        const far = k ? Math.hypot(k.x - b.x, k.y - b.y) > 60 : true;
        if (this.c.downs() > this.downs0) { this.kingEnd = 'down'; return true; }
        if (this.kingSeen && (this.kingT > 20 || (far && !k?.fighting))) { this.kingEnd = this.kingT > 20 ? 'survived' : 'fled'; return true; }
        return false;
      }
      case 'chest': return P.chests.has(CHEST_KEY);
      case 'quiz': return !!this.c.story()?.done.has('s-eiffel-quiz');
      case 'camp': return P.chests.has(CAMP_KEY);
      case 'ascend': {
        const [tx, ty] = this.local(TOWER);
        return b.mode === 'ground' && b.z - h.world.terrain(b.x, b.y) > 45 && Math.hypot(b.x - tx, b.y - ty) < 70;
      }
      case 'glide': {
        if (b.mode === 'glide') this.glideT += dt;
        return this.glideT > 1.5 && b.mode === 'ground' && b.z - h.world.terrain(b.x, b.y) < 3;
      }
      case 'wish': return P.wishes > this.wishes0 && !this.c.wishOpen();
      case 'journal': return this.c.journalOpen();
    }
  }

  update(dt: number, live: boolean) {
    if (this.active && this.c.mapOpen()) this.sawMap = true; // 지도를 여는 동안엔 아래가 돌지 않는다
    this.el.classList.toggle('on', this.active && live);
    if (!this.active || !live) return;
    const s = STEPS[this.step];
    if (!s) return;
    this.stepT += dt;
    // 싸움 단계: 봉인이 풀리면 한 줄을 바꾼다
    if (s.id === 'camp') {
      const open = this.c.explore()?.isLocked(CAMP_KEY) === false;
      const t = this.el.querySelector('.t')!;
      const want = open ? `🎁 봉인이 풀렸다! 상자 열기 (${this.c.touch() ? '손 단추' : 'F'})` : s.line(this.c.touch());
      if (t.textContent !== want) { t.textContent = want; if (open) this.c.companion()?.line('해냈다! 봉인이 풀렸어. 상자를 열어 봐!', 4); }
    }
    if (s.id === 'wish' && this.c.progress.wishes > this.wishes0 && this.c.wishOpen()) {
      const t = this.el.querySelector('.t')!;
      if (t.textContent !== '✨ 결과를 봤으면 ✕로 닫기') t.textContent = '✨ 결과를 봤으면 ✕로 닫기';
    }
    // 글라이더 단계: 펴지 않고 떨어지고 있으면 알려 준다
    if (s.id === 'glide') {
      const b = this.c.hero.body;
      if (b.mode === 'air' && b.vz < -8 && this.glideT === 0 && (this.remindT -= dt) < 22) { this.remindT = 60; this.c.companion()?.line(`지금이야! ${this.c.touch() ? '점프 단추' : 'Space'}!`, 2.5); }
      // 글라이더 없이 내려와 버렸으면 다시 올라가라고
      if (b.mode === 'ground' && this.glideT < 1.5 && this.stepT > 3 && b.z - this.c.hero.world.terrain(b.x, b.y) < 3 && (this.remindT -= dt) < 0) {
        this.remindT = 30;
        this.c.companion()?.line(`다시 탑 아래에서 ${this.c.touch() ? '⤒' : 'T'}로 올라가서, 뛰어내린 뒤 공중에서 ${this.c.touch() ? '점프 단추' : 'Space'}!`, 6);
      }
    } else if ((this.remindT -= dt) < 0) {
      this.remindT = 40;
      this.c.companion()?.line(s.lili(this.c.touch()), 6, this.beacon() ?? undefined);
    }
    if (this.met(s, dt)) this.advance();
  }

  private advance() {
    const s = STEPS[this.step];
    const P = this.c.progress;
    if (s.reward.xp) P.addXp(s.reward.xp, `첫걸음 · ${s.title}`);
    if (s.reward.stars) P.addStars(s.reward.stars);
    if (s.reward.eur) this.c.money(s.reward.eur);
    sfx.questDone();
    this.c.toast(`🌱 첫걸음 ${this.step + 1}/${STEPS.length} · ${s.title} ✓${s.reward.stars ? ` · ⭐${s.reward.stars}` : ''}${s.reward.xp ? ` · 모험 경험치 +${s.reward.xp}` : ''}`);
    if (s.id === 'king') {
      this.c.provoke(false);
      const why = this.kingEnd === 'down' ? '봤지?! 두 방에 쓰러졌어…' : this.kingEnd === 'survived' ? '와, 버텼어! 그래도 흠집 하나 못 냈지…' : '휴, 겨우 도망쳤다…';
      setTimeout(() => this.c.companion()?.line(`${why} 저건 쥐왕 Lv.40 — 지금 우리 힘으론 절대 못 이겨. 모험 등급을 20쯤 올리고 다시 오자. 그땐 꼭 이기는 거야!`, 9), 1600);
    }
    this.step++;
    this.save();
    if (this.step >= STEPS.length) { this.finish(false); return; }
    this.enter();
  }

  private finish(skipped: boolean) {
    const was = this.active;
    this.c.provoke(false);
    this.step = STEPS.length;
    this.save();
    this.active = false;
    this.nudge(null);
    this.el.classList.remove('on');
    this.c.quiet(false);
    if (!was) return;
    if (!skipped) {
      this.c.progress.addStars(100);
      this.c.progress.addXp(200, '첫걸음을 마쳤다');
      this.c.money(20);
      setTimeout(() => sfx.fanfare(), 400);
      this.c.toast('🎉 첫걸음 완료! ⭐100 · €20 · 모험 경험치 +200');
      setTimeout(() => this.c.companion()?.line('이제 진짜 모험이야! 탑 안내인 귀스타브 아저씨가 부탁이 있대. 빛기둥을 따라가 봐!', 7), 2500);
    }
    const st = this.c.story();
    if (st && !st.done.has('m-eiffel')) { st.tracked = 'm-eiffel'; st.onChange?.(); }
    this.onDone?.();
  }
}
