// 성장(원신처럼): 특성 레벨(보통 공격 · 원소 스킬 · 원소 폭발 — 📘 파리의 가르침 + €) · 스킬 트리(모험 등급마다 스킬 포인트) ·
// 옷 강화(모자·윗옷·가방·신발 — 🔹 연마석 + €, 체력·방어). 싸움(combat.ts)은 mods()만 읽는다. 판이 끝나도 남는다.

export type Talent = 'normal' | 'skill' | 'burst';
export const TALENTS: { id: Talent; emoji: string; name: string; per: number; what: string }[] = [
  { id: 'normal', emoji: '⚔️', name: '보통 공격 · 파리 우산 검술', per: 0.1, what: '4단 콤보 · 강공격 · 내려찍기 피해' },
  { id: 'skill', emoji: '🌀', name: '원소 스킬 · 바람 소용돌이', per: 0.12, what: 'E 피해' },
  { id: 'burst', emoji: '🌪️', name: '원소 폭발 · 센 강의 회오리', per: 0.12, what: 'Q 피해' },
];
export const TALENT_MAX = 10;
/** 모험 등급이 올라야 더 올린다(원신의 돌파처럼): 등급 1 → Lv.2, 3마다 하나씩, 최대 10 */
export const talentCap = (ar: number) => Math.min(TALENT_MAX, 2 + Math.floor(ar / 3));
/** lv → lv+1: 📘 · € */
export const talentCost = (lv: number) => ({ books: 2 * lv, eur: 15 * lv });

export type Branch = 'blade' | 'body' | 'wind';
export const BRANCHES: { id: Branch; emoji: string; name: string }[] = [
  { id: 'blade', emoji: '⚔️', name: '검술' },
  { id: 'body', emoji: '🛡', name: '생존' },
  { id: 'wind', emoji: '🌪', name: '바람' },
];
export interface Node { id: string; branch: Branch; tier: number; emoji: string; name: string; what: string; max: number; req?: [string, number] }
export const NODES: Node[] = [
  { id: 'edge', branch: 'blade', tier: 0, emoji: '🗡', name: '날 벼리기', what: '공격력 +6%', max: 3 },
  { id: 'vital', branch: 'blade', tier: 1, emoji: '🎯', name: '급소 찌르기', what: '치명타 확률 +4%', max: 3, req: ['edge', 1] },
  { id: 'pierce', branch: 'blade', tier: 1, emoji: '🤺', name: '돌진 찌르기', what: '강공격 기력 −50% · 피해 +30%', max: 1, req: ['edge', 2] },
  { id: 'finisher', branch: 'blade', tier: 2, emoji: '🌀', name: '회오리 마무리', what: '4타 회오리 베기 피해 +50%', max: 1, req: ['vital', 1] },
  { id: 'coup', branch: 'blade', tier: 3, emoji: '💥', name: '파리의 일격', what: '치명타 피해 +20%', max: 2, req: ['finisher', 1] },

  { id: 'vigor', branch: 'body', tier: 0, emoji: '❤️', name: '튼튼한 다리', what: '체력 +8%', max: 3 },
  { id: 'coat', branch: 'body', tier: 1, emoji: '🧥', name: '두꺼운 코트', what: '받는 피해 −6%', max: 3, req: ['vigor', 1] },
  { id: 'feint', branch: 'body', tier: 1, emoji: '💨', name: '파리지앵 발놀림', what: '반격할 수 있는 틈 +0.5초', max: 1, req: ['vigor', 2] },
  { id: 'bite', branch: 'body', tier: 2, emoji: '🥐', name: '크루아상 한 입', what: '맞힐 때마다 체력 0.6% 회복', max: 2, req: ['coat', 1] },
  { id: 'second', branch: 'body', tier: 3, emoji: '🔥', name: '두 번째 숨', what: '쓰러질 뻔하면 한 번 체력 30%로 버틴다(90초마다)', max: 1, req: ['bite', 1] },

  { id: 'breeze', branch: 'wind', tier: 0, emoji: '🍃', name: '산들바람', what: '원소 스킬 재사용 −0.6초', max: 3 },
  { id: 'gather', branch: 'wind', tier: 1, emoji: '🔋', name: '바람 모으기', what: '원소 에너지 +12%', max: 3, req: ['breeze', 1] },
  { id: 'gust', branch: 'wind', tier: 1, emoji: '🌬', name: '돌풍', what: '원소 스킬 범위 +1 m · 피해 +15%', max: 2, req: ['breeze', 2] },
  { id: 'eye', branch: 'wind', tier: 2, emoji: '👁', name: '폭풍의 눈', what: '원소 폭발 피해 +25%', max: 2, req: ['gather', 2] },
  { id: 'tail', branch: 'wind', tier: 3, emoji: '⛵', name: '순풍', what: '원소 폭발 뒤 6초 공격력 +20%', max: 1, req: ['eye', 1] },
];

/** 옷 강화: 모자·윗옷·가방·신발 */
export const ARMOR_SLOTS = ['head', 'top', 'back', 'feet'] as const;
export const ARMOR_MAX = 10;
export const armorCap = (ar: number) => Math.min(ARMOR_MAX, 1 + ar);
export const armorCost = (lv: number) => ({ ore: 1 + lv, eur: 5 * lv });
/** 옷 레벨 하나마다(1 넘는 만큼): 체력 +2.5% · 방어(받는 피해 −1%) */
export const ARMOR_HP = 0.025, ARMOR_DEF = 0.01;

/** 싸움이 읽는 것 */
export interface GrowthMods {
  atk: number; normal: number; skill: number; burst: number;
  crit: number; critDmg: number; hp: number; def: number; steal: number;
  eCd: number; eRange: number; energy: number; counter: number;
  chargeCost: number; charge: number; finisher: number; second: boolean; tail: boolean;
}
export const NO_MODS: GrowthMods = { atk: 1, normal: 1, skill: 1, burst: 1, crit: 0, critDmg: 0, hp: 1, def: 0, steal: 0, eCd: 0, eRange: 0, energy: 1, counter: 0, chargeCost: 1, charge: 1, finisher: 1, second: false, tail: false };

interface Save { talents?: Partial<Record<Talent, number>>; ranks?: Record<string, number>; books?: number; bonusSp?: number }
const KEY = 'carnet-growth-v1';

export class Growth {
  readonly talents: Record<Talent, number> = { normal: 1, skill: 1, burst: 1 };
  readonly ranks: Record<string, number> = {};
  /** 📘 파리의 가르침(특성 레벨) — 밤 습격의 요괴가 떨어뜨린다 */
  books = 0;
  /** 등급 말고 따로 얻은 스킬 포인트(밤 습격 5물결마다) */
  bonusSp = 0;
  onChange?: () => void;

  constructor() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Save | null;
      if (d) {
        for (const t of TALENTS) this.talents[t.id] = Math.max(1, Math.min(TALENT_MAX, d.talents?.[t.id] ?? 1));
        for (const n of NODES) { const r = d.ranks?.[n.id]; if (r) this.ranks[n.id] = Math.min(n.max, r); }
        this.books = d.books ?? 0; this.bonusSp = d.bonusSp ?? 0;
      }
    } catch { /* 처음부터 */ }
  }
  save() {
    const d: Save = { talents: this.talents, ranks: this.ranks, books: this.books, bonusSp: this.bonusSp };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 무시 */ }
    this.onChange?.();
  }

  rank(id: string) { return this.ranks[id] ?? 0; }
  /** 모험 등급 1마다 1점(등급 2부터) + 밤 습격에서 얻은 것 */
  spTotal(ar: number) { return Math.max(0, ar - 1) + this.bonusSp; }
  spUsed() { return Object.values(this.ranks).reduce((a, b) => a + b, 0); }
  spFree(ar: number) { return this.spTotal(ar) - this.spUsed(); }
  /** 찍을 수 있나(점수·선행·최대) — 안 되면 까닭 */
  why(id: string, ar: number): string | null {
    const n = NODES.find((x) => x.id === id);
    if (!n) return '없는 칸';
    if (this.rank(id) >= n.max) return '최대';
    if (n.req && this.rank(n.req[0]) < n.req[1]) { const r = NODES.find((x) => x.id === n.req![0])!; return `${r.name} ${n.req[1]} 먼저`; }
    if (this.spFree(ar) <= 0) return '스킬 포인트 없음';
    return null;
  }
  learn(id: string, ar: number) {
    if (this.why(id, ar)) return false;
    this.ranks[id] = this.rank(id) + 1;
    this.save();
    return true;
  }
  /** 특성 레벨 올리기(€는 밖에서 치른다) */
  canTalent(t: Talent, ar: number, eur: number): string | null {
    const lv = this.talents[t];
    if (lv >= TALENT_MAX) return '최대';
    if (lv >= talentCap(ar)) return `모험 등급을 올리자`;
    const c = talentCost(lv);
    if (this.books < c.books) return `📘 ${c.books - this.books} 모자람`;
    if (eur < c.eur) return `€ ${Math.ceil(c.eur - eur)} 모자람`;
    return null;
  }
  levelTalent(t: Talent) {
    const c = talentCost(this.talents[t]);
    this.books -= c.books;
    this.talents[t]++;
    this.save();
    return c.eur;
  }
  addBooks(n: number) { this.books += n; this.save(); }
  addSp(n: number) { this.bonusSp += n; this.save(); }

  /** 싸움에 주는 것. armor = 입은 옷들의 (레벨 − 1) 합 */
  mods(armor: number): GrowthMods {
    const r = (id: string) => this.rank(id);
    const T = (t: Talent) => 1 + TALENTS.find((x) => x.id === t)!.per * (this.talents[t] - 1);
    return {
      atk: 1 + 0.06 * r('edge'),
      normal: T('normal'),
      skill: T('skill') * (1 + 0.15 * r('gust')),
      burst: T('burst') * (1 + 0.25 * r('eye')),
      crit: 0.04 * r('vital'),
      critDmg: 0.2 * r('coup'),
      hp: 1 + 0.08 * r('vigor') + ARMOR_HP * armor,
      def: Math.min(0.6, 0.06 * r('coat') + ARMOR_DEF * armor),
      steal: 0.006 * r('bite'),
      eCd: 0.6 * r('breeze'),
      eRange: r('gust'),
      energy: 1 + 0.12 * r('gather'),
      counter: 0.5 * r('feint'),
      chargeCost: r('pierce') ? 0.5 : 1,
      charge: r('pierce') ? 1.3 : 1,
      finisher: r('finisher') ? 1.5 : 1,
      second: r('second') > 0,
      tail: r('tail') > 0,
    };
  }
}
