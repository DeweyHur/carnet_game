// 첫걸음(프롤로그): 헬기 대신 에펠탑 앞 샹드마르스 잔디밭에서 시작해, 리리를 따라 한 가지씩 해 본다.
// 지도(켜 둔 순간이동 포인트) → 보물상자 → 퀴즈 → 요괴 야영지 → 사진(📷) → 쥐왕과의 만남(지금은 못 이긴다!) →
// 상승으로 탑 1층 → 글라이더 → 기원 → 수첩.
// 2장 🌗 낮과 밤: 밤으로 바꾸기 → 첫 밤 습격 → 밤에만 나는 달빛 나비 → 낮으로 → 쥘리에게 보여 주면 쥘리가 동료가 된다 → 파티에서 바꿔 보기.
// 처음엔 나를 만들기(캐릭터 만들기)부터, 싸움은 4단 콤보·강공격·반격을 하나씩 연습한다.
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
import * as THREE from 'three';

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
  // ── 2판(긴 첫걸음) ──
  /** 캐릭터를 만들었나 · 만들기 창 열기 */
  created(): boolean;
  openCreator(): void;
  /** 싸움 연습: 맞힌 회오리 베기 · 강공격 · 반격 수 */
  tally(): { atk4: number; charge: number; counter: number };
  /** 연습용 적 무리 */
  drill(key: string, at: [number, number], foes: string[]): void;
  drillDone(key: string): boolean;
  /** 스킬 트리: 찍은 점수 · 한 점 주기(🌟 성장을 연다) */
  spUsed(): number;
  giveSp(): void;
  /** 밤 모드인가 · 넘긴 습격 물결 수 */
  night(): boolean;
  wavesCleared(): number;
  /** 동료 열기 · 지금 캐릭터 */
  unlockChar(id: string): void;
  activeChar(): string;
  /** 파리의 두 얼굴을 몇 단계 풀었나 */
  taleStep(): number;
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
const DRILL_AT = lmPoint('eiffel', -26, -176);
/** 달빛 나비: 밤에만 잔디 위를 난다 */
const MOTH_AT = lmPoint('eiffel', -64, -150);
const OLD_IDS = ['map', 'chest', 'quiz', 'camp', 'photo', 'king', 'ascend', 'glide', 'wish', 'journal'];

type StepId = 'create' | 'map' | 'chest' | 'quiz' | 'camp' | 'combo' | 'charge' | 'counter' | 'photo' | 'king' | 'ascend' | 'glide' | 'wish' | 'growth' | 'journal'
  | 'night' | 'wave' | 'moth' | 'day' | 'julie' | 'party' | 'tale';
interface Step {
  id: StepId;
  title: string;
  /** 지금 할 일(키보드 / 터치) */
  line: (touch: boolean) => string;
  lili: (touch: boolean) => string;
  reward: { xp: number; stars: number; eur?: number };
}

const STEPS: Step[] = [
  { id: 'create', title: '나를 만들기', reward: { xp: 0, stars: 10 },
    line: () => '👤 오른쪽 판에서 이름과 생김새를 고르고 "✔ 이대로 파리로"',
    lili: () => '어서 와, 파리에! 나는 요정 리리야. 먼저 너를 알려 줘 — 이름이랑, 어떤 모습인지!' },
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
  { id: 'combo', title: '4단 콤보', reward: { xp: 40, stars: 10 },
    line: (t) => `⚔️ 연습: ${t ? '⚔️ 단추' : '마우스'}를 박자 맞춰 네 번 — 마지막 회오리 베기로 슬라임 맞히기`,
    lili: (t) => `잘 싸웠어! 이번엔 연습이야. ${t ? '⚔️ 단추' : '마우스'}를 톡-톡-톡-톡, 너무 빠르지도 느리지도 않게 네 번 치면 마지막에 한 바퀴 도는 회오리 베기가 나가!` },
  { id: 'charge', title: '강공격', reward: { xp: 40, stars: 10 },
    line: (t) => `⚔️ 연습: ${t ? '⚔️ 단추' : '마우스'}를 0.4초 넘게 꾹 눌렀다 떼기 — 강공격으로 슬라임 꿰뚫기`,
    lili: (t) => `다음은 강공격! ${t ? '⚔️ 단추' : '마우스 왼쪽'}를 꾹 누르고 있다가 떼면 앞으로 내달리며 찔러. 줄지어 선 적을 한 번에 꿰뚫지. 기력을 조금 써.` },
  { id: 'counter', title: '구르기 반격', reward: { xp: 50, stars: 15 },
    line: (t) => `💨 연습: ${t ? '구르기 단추' : 'V'}로 구른 직후 바로 공격 — "반격!"(반드시 치명타)`,
    lili: (t) => `마지막 연습! ${t ? '구르기 단추' : 'V'}로 구르고, 구르기가 끝나자마자 공격하면 "반격"이야. 반드시 치명타가 터져! 구르는 중에 미리 눌러도 돼.` },
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
  { id: 'growth', title: '스킬 트리', reward: { xp: 40, stars: 10 },
    line: (t) => `🌟 🧚 메뉴 → 🌟 성장${t ? '' : '(K)'} → 스킬 트리에서 한 칸 찍기 (리리가 스킬 포인트 1점을 줬다)`,
    lili: (t) => `강해지는 법을 알려 줄게! 🧚 메뉴의 🌟 성장${t ? '' : ', 키보드는 K'} — 스킬 트리에 점수를 찍으면 공격력·체력·스킬이 세져. 리리가 1점 줄게, 찍어 봐!` },
  { id: 'journal', title: '파리 수첩', reward: { xp: 0, stars: 0 },
    line: (t) => `📖 파리 수첩 열어 보기 (${t ? '📖 단추' : 'J 또는 📖 단추'})`,
    lili: () => '📖 파리 수첩엔 메인 이벤트·서브 이벤트·오늘의 의뢰가 다 적혀 있어. 한번 열어 봐! 그다음은… 파리의 밤이야.' },
  { id: 'night', title: '🌗 밤으로', reward: { xp: 40, stars: 10 },
    line: () => '🌙 오른쪽 위 🧚 메뉴 → "🌙 밤 습격" 누르기 — 파리의 밤으로',
    lili: () => '파리엔 얼굴이 둘이야. 낮엔 사람들, 밤엔… 요괴들! 🧚 메뉴를 열고 "🌙 밤 습격"을 눌러 봐. 언제든 다시 낮으로 바꿀 수 있어.' },
  { id: 'wave', title: '첫 밤 습격', reward: { xp: 120, stars: 30 },
    line: () => '🌙 몰려오는 요괴 1물결 모두 물리치기 — 위 가운데 판에 남은 수',
    lili: (t) => `봐, 사람들은 모두 집에 들어갔어. 이제 요괴들이 물결마다 몰려와! 배운 대로 — 콤보, 강공격, ${t ? '구르기' : 'V'}로 피하고 반격!` },
  { id: 'moth', title: '달빛 나비', reward: { xp: 60, stars: 20 },
    line: () => '🦋 잔디 위를 나는 달빛 나비 잡기 — 밤에만 보인다 (빛기둥 쪽, 가까이 가면 잡힌다)',
    lili: () => '잘 버텼어! 저기 봐 — 반짝이는 나비! 달빛 나비는 밤에만 날아. 쥘리가 늘 보고 싶어 했는데… 잡으러 가자!' },
  { id: 'day', title: '🌗 낮으로', reward: { xp: 30, stars: 10 },
    line: () => '☀️ 🧚 메뉴 → "☀️ 낮으로" — 아침이 오면 사람들이 돌아온다',
    lili: () => '나비를 잡았다! 밤엔 쥘리가 없어. 🧚 메뉴에서 "☀️ 낮으로"를 누르면 아침이 와. 그때 보여 주자!' },
  { id: 'julie', title: '쥘리에게', reward: { xp: 100, stars: 30 },
    line: () => '🦋 가이드 쥘리에게 달빛 나비 보여 주기 (빛기둥 쪽으로 가까이)',
    lili: () => '아침이다! 쥘리한테 가 보자. 낮에 한 일이 밤을 열고, 밤에 얻은 게 낮을 여는 거 — 파리는 늘 그래.' },
  { id: 'party', title: '👥 동료', reward: { xp: 60, stars: 20 },
    line: (t) => `👥 🧚 메뉴 → 👥 파티${t ? '' : '(P)'} → 쥘리 "이 사람으로" — 동료로 바꿔 보기`,
    lili: (t) => `쥘리가 동료가 됐어! 🧚 메뉴의 👥 파티${t ? '' : ', 키보드는 P'}에서 쥘리로 바꿔 봐. 쥘리는 물의 힘 — 스킬을 쓰면 체력이 차! 부탁을 들어주면 동료가 더 생겨.` },
  { id: 'tale', title: '🌗 파리의 두 얼굴', reward: { xp: 60, stars: 20 },
    line: (t) => `📓 빛기둥 쪽 벤치의 낡은 수첩 조각 읽기 (${t ? '손 단추' : 'F'}) — 낮·밤 이야기의 시작`,
    lili: () => '마지막으로 하나 더! 저 벤치에 낡은 수첩 조각이 있어. 낮과 밤을 오가며 푸는 이야기, "파리의 두 얼굴"의 시작이야!' },
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
  private base = 0;
  private drillN = 0;
  private moth: THREE.Group | null = null;
  private caught = false;
  /** 달빛 나비 같은 것(장면에 넣는다) */
  readonly group = new THREE.Group();
  onDone?: () => void;

  constructor(c: PrologueCtx) {
    this.c = c;
    this.el = document.createElement('div');
    this.el.className = 'pro';
    this.el.innerHTML = '<p class="h"><b>🌱 첫걸음</b><span class="n"></span><button type="button" class="skip" title="첫걸음 건너뛰기">건너뛰기</button></p><p class="t"></p><p class="dots"></p>';
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.querySelector('.skip')!.addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); this.finish(true); });
    document.body.appendChild(this.el);
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { step: number; v?: number } | null;
      if (d && d.v === 2) this.step = d.step;
      else if (d) this.step = d.step >= OLD_IDS.length ? STEPS.length : Math.max(0, STEPS.findIndex((s) => s.id === OLD_IDS[d.step])); // 예전 첫걸음(10단계)
    } catch { /* 처음 */ }
  }

  /** 끝냈거나 건너뛰었다 */
  get done() { return this.step >= STEPS.length; }
  get running() { return this.active; }
  get stepId(): StepId | null { return this.active ? STEPS[this.step]?.id ?? null : null; }

  private save() { try { localStorage.setItem(KEY, JSON.stringify({ step: this.step, v: 2 })); } catch { /* 무시 */ } }

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
      P.open('wish'); // 기원 단추가 나타난다(등급 2 전이라도)
      this.wishes0 = P.wishes;
      if (P.stars < WISH_COST) { const give = WISH_COST - P.stars; P.addStars(give); this.c.toast(`🧚 리리가 별조각 ⭐${give}을 나눠 줬다`); }
      this.nudge('#wish-go');
    } else if (s.id === 'journal') this.nudge('#journal-go');
    else if (s.id === 'photo') { this.photos0 = this.c.photos(); this.nudge('#photo-go'); }
    else if (s.id === 'map') { this.sawMap = false; this.nudge(null); }
    else if (s.id === 'create') { this.nudge(null); if (!this.c.created()) setTimeout(() => { if (STEPS[this.step] === s) this.c.openCreator(); }, 600); }
    else if (s.id === 'combo' || s.id === 'charge' || s.id === 'counter') { const t = this.c.tally(); this.base = s.id === 'combo' ? t.atk4 : s.id === 'charge' ? t.charge : t.counter; this.spawnDrill(); this.nudge(null); }
    else if (s.id === 'growth') { this.c.giveSp(); this.base = this.c.spUsed(); this.nudge('#menu-go'); }
    else if (s.id === 'night' || s.id === 'day' || s.id === 'party') this.nudge('#menu-go');
    else if (s.id === 'wave') { this.base = this.c.wavesCleared(); this.nudge(null); }
    else if (s.id === 'moth') { this.caught = false; this.nudge(null); }
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
      case 'combo': case 'charge': case 'counter': return this.local(DRILL_AT);
      case 'moth': return this.local(MOTH_AT);
      case 'julie': { const n = this.c.story()?.run('s-eiffel-quiz').npc; return n ? [n.x, n.y] : this.local(JULIE_AT); }
      case 'tale': return this.local(lmPoint('eiffel', 34, -128));
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
      case 'create': return this.c.created();
      case 'combo': return this.c.tally().atk4 > this.base;
      case 'charge': return this.c.tally().charge > this.base;
      case 'counter': return this.c.tally().counter > this.base;
      case 'growth': return this.c.spUsed() > this.base;
      case 'night': return this.c.night();
      case 'wave': return this.c.wavesCleared() > this.base;
      case 'moth': return this.caught;
      case 'day': return !this.c.night();
      case 'julie': {
        if (this.c.night()) return false;
        const [jx, jy] = this.beacon() ?? this.local(JULIE_AT);
        return Math.hypot(jx - b.x, jy - b.y) < 3.6;
      }
      case 'party': return this.c.activeChar() !== 'traveler';
      case 'tale': return this.c.taleStep() >= 1;
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
    if ((s.id === 'combo' || s.id === 'charge' || s.id === 'counter') && this.c.drillDone(`drill:${this.drillN}`)) this.spawnDrill(); // 다 쓰러뜨렸는데 아직이면 다시
    if (s.id === 'moth') this.stepMoth(dt);
    else if (this.moth) this.moth.visible = false;
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
    if (s.id === 'julie') { this.c.unlockChar('julie'); setTimeout(() => this.c.companion()?.line('쥘리: "달빛 나비?! 정말 밤에만 나는구나… 고마워! 나도 같이 다닐래!"', 7), 900); }
    this.step++;
    this.save();
    if (this.step >= STEPS.length) { this.finish(false); return; }
    this.enter();
  }

  private spawnDrill() {
    this.drillN++;
    this.c.drill(`drill:${this.drillN}`, this.local(DRILL_AT), ['slime', 'slime', 'slime']);
  }

  /** 달빛 나비: 밤에만 보이고, 잔디 위를 맴돌다 가까이 가면 잡힌다 */
  private stepMoth(dt: number) {
    if (!this.moth) {
      const g = new THREE.Group();
      const wingM = new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12).scale(1, 1.4, 1).translate(sx * 0.2, 0, 0), wingM);
        w.userData.sx = sx;
        g.add(w);
      }
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshBasicMaterial({ color: 0xb79bff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      g.add(glow);
      this.group.add(g);
      this.moth = g;
    }
    const m = this.moth, h = this.c.hero, b = h.body, t = this.stepT;
    const [cx, cy] = this.local(MOTH_AT);
    const x = cx + Math.sin(t * 0.7) * 3, y = cy + Math.cos(t * 0.9) * 2.5;
    const z = h.world.terrain(x, y) + 1.3 + Math.sin(t * 2.3) * 0.3;
    m.position.set(x, y, z);
    m.visible = this.c.night();
    m.children.forEach((c) => { if (c.userData.sx) c.rotation.y = c.userData.sx * Math.sin(t * 16) * 0.9; });
    void dt;
    if (!this.c.night()) return;
    if (Math.hypot(x - b.x, y - b.y) < 2 && Math.abs(b.z + 1 - z) < 2.2) { this.caught = true; m.visible = false; sfx.served(); }
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
    if (this.moth) this.moth.visible = false;
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
