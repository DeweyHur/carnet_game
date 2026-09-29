// 모험(원신처럼): 모험 등급(경험치) · 별조각(기원에 쓰는 것) · 바람 깃털(성상에 바쳐 기력을 키운다) ·
// 순간이동 포인트 · 연 보물상자 · 오늘의 의뢰 · 기원 천장. 판이 끝나도 남는다(localStorage).

export const AR_MAX = 30;
/** 처음부터 켜져 있는 순간이동 포인트 */
export const START_WAYPOINTS = ['wp-eiffel', 'wp-trocadero', 'wp-marais'];

/** 모험 등급에 따라 하나씩 열리는 것(원신처럼 — 처음엔 헷갈리지 않게 꼭 필요한 것만) */
export type Feature = 'wish' | 'enhance' | 'growth' | 'commission' | 'domain';
export const FEATURES: { id: Feature; ar: number; emoji: string; name: string; what: string }[] = [
  { id: 'wish', ar: 2, emoji: '✨', name: '기원', what: '별조각 ⭐160으로 한 번 — 새 무기·옷이 나온다. 오른쪽 위 ✨' },
  { id: 'enhance', ar: 2, emoji: '🔹', name: '무기 강화', what: '요괴·보물상자에서 나오는 🔹 연마석과 €로 무기 레벨을 올린다. 🎒 옷장 → 무기 칸' },
  { id: 'growth', ar: 2, emoji: '🌟', name: '성장 — 특성 · 스킬 트리', what: '특성 레벨(보통 공격·E·Q — 📘 파리의 가르침)과 스킬 트리(등급마다 스킬 포인트 1). 🧚 메뉴 → 🌟 성장 · K' },
  { id: 'commission', ar: 3, emoji: '📜', name: '오늘의 의뢰', what: '날마다 네 가지 — 하나마다 ⭐10 · 경험치 250, 넷 모두면 ⭐60 더. 📖 수첩에서 본다' },
  { id: 'domain', ar: 5, emoji: '🌀', name: '비경', what: '파리 땅 밑의 도전 던전 — 하수도(알마 다리) · 카타콤(팡테옹) · 채석장(몽마르트르). 미니맵 🌀' },
];
/** 이 등급에서 다음 등급까지 필요한 경험치 */
export const arNeed = (ar: number) => Math.round(250 + ar * 90 + ar * ar * 6);

export type CommissionKind = 'photo' | 'bonjour' | 'chest' | 'waypoint' | 'discover' | 'walk' | 'eat' | 'quest' | 'glide' | 'climb' | 'defeat';
export interface Commission { kind: CommissionKind; goal: number; got: number; done: boolean }
export const COMMISSION_TEXT: Record<CommissionKind, (n: number) => string> = {
  photo: (n) => `📷 사진 ${n}장 찍기`,
  bonjour: (n) => `👋 "봉주르" ${n}번`,
  chest: (n) => `🎁 보물상자 ${n}개 열기`,
  waypoint: (n) => `🔷 순간이동 포인트 ${n}곳 쓰기(활성화·이동)`,
  discover: (n) => `✨ 새 장소 ${n}곳 발견`,
  walk: (n) => `🚶 ${n} m 걷기`,
  eat: (n) => `🥐 먹거나 마시기 ${n}번`,
  quest: (n) => `❗ 부탁(메인·서브·거리) ${n}개 해결`,
  glide: (n) => `🪂 글라이더·낙하산으로 ${n}초 날기`,
  climb: (n) => `🧗 벽을 ${n} m 오르기`,
  defeat: (n) => `⚔️ 요괴 ${n}마리 물리치기`,
};
// 'eat'(먹기)은 허기가 없어져 뽑지 않는다(예전 저장에 있으면 새로 뽑는다)
const POOL: [CommissionKind, number][] = [['photo', 3], ['bonjour', 5], ['chest', 3], ['waypoint', 1], ['discover', 4], ['walk', 800], ['quest', 1], ['glide', 40], ['climb', 30], ['defeat', 6]];

interface Save {
  ar: number; xp: number; stars: number; plumes: number; offered: number;
  waypoints: string[]; chests: string[]; plumesGot: string[]; rings: string[];
  day: string; commissions: Commission[]; commissionBonus: boolean;
  pity4: number; pity5: number; wishes: number;
  last?: string;
  /** 처음부터 켜 두는 순간이동 포인트를 줬나 */
  granted?: boolean;
  /** 연마석(무기 강화) */
  ore?: number;
  /** 열린 것 */
  features?: Feature[];
}
const KEY = 'carnet-progress-v1';
const today = () => new Date().toISOString().slice(0, 10);

export class Progress {
  ar = 1; xp = 0; stars = 160; plumes = 0; offered = 0;
  readonly waypoints = new Set<string>();
  readonly chests = new Set<string>();
  readonly plumesGot = new Set<string>();
  readonly rings = new Set<string>();
  day = '';
  commissions: Commission[] = [];
  commissionBonus = false;
  pity4 = 0; pity5 = 0; wishes = 0;
  /** 마지막으로 켜거나 순간이동한 포인트(이어서 하기) */
  last = '';
  granted = false;
  ore = 0;
  readonly features = new Set<Feature>();
  /** 새로 열렸다 */
  onFeature?: (f: (typeof FEATURES)[number]) => void;
  onXp?: (gain: number, why: string) => void;
  onRank?: (ar: number, reward: { stars: number; eur: number; ore: number }) => void;
  onCommission?: (c: Commission, all: boolean) => void;
  onChange?: () => void;

  constructor() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Save> | null;
      if (d) {
        this.ar = d.ar ?? 1; this.xp = d.xp ?? 0; this.stars = d.stars ?? 160; this.plumes = d.plumes ?? 0; this.offered = d.offered ?? 0;
        for (const x of d.waypoints ?? []) this.waypoints.add(x);
        for (const x of d.chests ?? []) this.chests.add(x);
        for (const x of d.plumesGot ?? []) this.plumesGot.add(x);
        for (const x of d.rings ?? []) this.rings.add(x);
        this.day = d.day ?? ''; this.commissions = d.commissions ?? []; this.commissionBonus = !!d.commissionBonus;
        this.pity4 = d.pity4 ?? 0; this.pity5 = d.pity5 ?? 0; this.wishes = d.wishes ?? 0; this.last = d.last ?? ''; this.granted = !!d.granted; this.ore = d.ore ?? 0; for (const f of d.features ?? []) this.features.add(f);
      }
    } catch { /* 처음부터 */ }
    if (this.commissions.some((c) => c.kind === 'eat')) this.commissions = [];
    // 처음부터 켜 둔 순간이동 포인트: 샹드마르스(에펠탑) · 트로카데로 · 마레
    // 예전 저장: 등급에 맞는 것은 조용히 연다
    for (const f of FEATURES) if (this.ar >= f.ar) this.features.add(f.id);
    if (!this.granted) { this.granted = true; for (const id of START_WAYPOINTS) this.waypoints.add(id); this.save(); }
    this.rollDay();
  }

  save() {
    const d: Save = { ar: this.ar, xp: this.xp, stars: this.stars, plumes: this.plumes, offered: this.offered, waypoints: [...this.waypoints], chests: [...this.chests], plumesGot: [...this.plumesGot], rings: [...this.rings], day: this.day, commissions: this.commissions, commissionBonus: this.commissionBonus, pity4: this.pity4, pity5: this.pity5, wishes: this.wishes, last: this.last, granted: this.granted, ore: this.ore, features: [...this.features] };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 무시 */ }
    this.onChange?.();
  }

  /** 날이 바뀌면 의뢰 넷을 새로 뽑는다(날짜로 섞어 날마다 같은 넷) */
  rollDay() {
    const d = today();
    if (this.day === d && this.commissions.length) return;
    this.day = d;
    let seed = [...d].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const pool = POOL.slice();
    this.commissions = [];
    while (this.commissions.length < 4) { const [kind, goal] = pool.splice(Math.floor(rnd() * pool.length), 1)[0]; this.commissions.push({ kind, goal, got: 0, done: false }); }
    this.commissionBonus = false;
    this.save();
  }

  /** 기력 단계(바친 깃털 4개마다 한 단계, 최대 10) — 기력 소모가 단계마다 7%씩 준다 */
  get staminaLevel() { return Math.min(10, Math.floor(this.offered / 4)); }
  get staminaCost() { return 1 / (1 + 0.1 * this.staminaLevel); }

  addXp(n: number, why: string) {
    if (this.ar >= AR_MAX) return;
    this.xp += n;
    this.onXp?.(n, why);
    while (this.ar < AR_MAX && this.xp >= arNeed(this.ar)) {
      this.xp -= arNeed(this.ar);
      this.ar++;
      const reward = { stars: 40 + this.ar * 5, eur: 10 + this.ar * 2, ore: 3 + this.ar };
      this.stars += reward.stars;
      this.ore += reward.ore;
      this.onRank?.(this.ar, reward);
      for (const f of FEATURES) if (this.ar >= f.ar) this.open(f.id);
    }
    this.save();
  }
  addStars(n: number) { this.stars += n; this.save(); }
  addOre(n: number) { this.ore += n; this.save(); }
  /** 열렸나 */
  has(f: Feature) { return this.features.has(f); }
  /** 연다(처음이면 알린다) — 첫걸음이 등급보다 먼저 열 수도 있다 */
  open(f: Feature) {
    if (this.features.has(f)) return;
    this.features.add(f);
    const def = FEATURES.find((x) => x.id === f);
    if (def) this.onFeature?.(def);
    this.save();
  }

  /** 의뢰 진행: kind를 n만큼 */
  bump(kind: CommissionKind, n = 1) {
    if (!this.features.has('commission')) return; // 모험 등급 3부터
    this.rollDay();
    let changed = false;
    for (const c of this.commissions) {
      if (c.kind !== kind || c.done) continue;
      c.got = Math.min(c.goal, c.got + n);
      changed = true;
      if (c.got >= c.goal) {
        c.done = true;
        const all = this.commissions.every((x) => x.done);
        this.onCommission?.(c, all);
        this.addXp(250, '오늘의 의뢰');
        this.stars += 10;
        if (all && !this.commissionBonus) { this.commissionBonus = true; this.stars += 60; this.addXp(500, '의뢰 넷을 모두'); }
      }
    }
    if (changed) this.save();
  }
}
