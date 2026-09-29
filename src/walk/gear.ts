// 장비(옷장): 무기 · 모자 · 윗옷 · 가방 · 신발 · 글라이더 — 하나씩 입고, 입은 것에 따라 겉모습과 능력이 바뀐다.
// 무기는 손에 쥔 모양과 싸움 능력(공격력·치명타·사거리·폭발·흡혈)이 다르다.
// 처음부터 있는 것 몇 가지, 나머지는 부탁을 들어주거나 걷다 보면 생긴다.

export type Slot = 'weapon' | 'head' | 'top' | 'back' | 'feet' | 'glider';
export const SLOTS: { id: Slot; name: string; emoji: string }[] = [
  { id: 'weapon', name: '무기', emoji: '🗡' },
  { id: 'head', name: '모자', emoji: '🎩' },
  { id: 'top', name: '윗옷', emoji: '🧥' },
  { id: 'back', name: '가방', emoji: '🎒' },
  { id: 'feet', name: '신발', emoji: '👟' },
  { id: 'glider', name: '글라이더', emoji: '🪂' },
];

export interface Gear {
  id: string;
  slot: Slot;
  name: string;
  emoji: string;
  /** 능력(한 줄) */
  perk: string;
  /** 처음부터 있나 — 아니면 얻는 법 */
  unlock?: string;
  /** 기원에서 나오는 등급(없으면 기원에 안 나온다) */
  star?: 4 | 5;
}

export const GEAR: Gear[] = [
  { id: 'umbrella', slot: 'weapon', name: '접은 파리 우산', emoji: '☂️', perk: '공격력 ×1.0 · 치명타 15% — 균형 잡힌 기본 무기' },
  { id: 'baguette', slot: 'weapon', name: '바게트 검', emoji: '🥖', perk: '공격력 ×0.9 · 맞힐 때마다 체력 2% 회복', unlock: '보물상자 3개 열기', star: 4 },
  { id: 'cane', slot: 'weapon', name: '멋쟁이 지팡이 검', emoji: '🦯', perk: '공격력 ×1.0 · 치명타 30% · 치명타 피해 ×2.0', unlock: '기원(4★)', star: 4 },
  { id: 'oar', slot: 'weapon', name: '센 강 뱃사공의 노', emoji: '🛶', perk: '공격력 ×1.3 · 사거리 +0.9 m · 치명타 10%', unlock: '모험 등급 5', star: 4 },
  { id: 'rapier', slot: 'weapon', name: '삼총사의 레이피어', emoji: '🤺', perk: '공격력 ×1.15 · 치명타 25% · 원소 스킬 피해 +40%', unlock: '비경 ★★★ 한 번', star: 4 },
  { id: 'flagpole', slot: 'weapon', name: '혁명의 깃발', emoji: '🚩', perk: '공격력 ×1.2 · 사거리 +0.6 m · 원소 폭발 피해 +60% · 에너지 +30%', unlock: '기원(5★)', star: 5 },
  { id: 'jeanne', slot: 'weapon', name: '잔 다르크의 검', emoji: '⚔️', perk: '공격력 ×1.45 · 치명타 25% · 치명타 피해 ×2.0 — 가장 센 검', unlock: '쥐왕 쓰러뜨리기 · 기원(5★)', star: 5 },

  { id: 'beret', slot: 'head', name: '빨간 베레모', emoji: '🔴', perk: '파리 사람 분위기(능력 없음)' },
  { id: 'panama', slot: 'head', name: '파나마 모자', emoji: '👒', perk: '달리기가 5% 빠르다', unlock: '에펠탑 1층에 걸린 모자를 찾아 주기' , star: 4 },
  { id: 'aviator', slot: 'head', name: '비행 모자·고글', emoji: '🥽', perk: '높은 데서 떨어져도 1.6배까지 다치지 않는다', unlock: '에펠탑 2층 3분 도전' , star: 4 },
  { id: 'marin', slot: 'head', name: '선원 모자', emoji: '⚓', perk: '헤엄칠 때 기력이 40% 덜 든다', unlock: '센 강에 뛰어들기' , star: 4 },
  { id: 'tophat', slot: 'head', name: '오페라 실크해트', emoji: '🎩', perk: '모험 경험치 +15%', unlock: '기원(5★)', star: 5 },
  { id: 'none', slot: 'head', name: '맨머리', emoji: '💇', perk: '머리카락이 바람에 날린다' },

  { id: 'jacket', slot: 'top', name: '파랑 재킷', emoji: '🧥', perk: '기본 여행복(능력 없음)' },
  { id: 'trench', slot: 'top', name: '트렌치코트', emoji: '🧥', perk: '글라이더가 15% 덜 가라앉는다', unlock: '랜드마크 5곳 보기' , star: 4 },
  { id: 'mariniere', slot: 'top', name: '마리니에르', emoji: '👕', perk: '인사하면 사람들이 더 반기고 더 오래 이야기한다', unlock: '샹드마르스 소풍 도와주기' , star: 4 },
  { id: 'napoleon', slot: 'top', name: '나폴레옹 코트', emoji: '🎖', perk: '전력 질주 기력 −30%', unlock: '기원(5★)', star: 5 },
  { id: 'leather', slot: 'top', name: '가죽 재킷', emoji: '🖤', perk: '사람과 세게 부딪혀도 휘청이지 않는다', unlock: '"봉주르" 10번' , star: 4 },

  { id: 'backpack', slot: 'back', name: '배낭', emoji: '🎒', perk: '기력 바퀴가 12% 크다' },
  { id: 'camera', slot: 'back', name: '카메라 가방', emoji: '📷', perk: '사진을 찍으면 엽서로 팔린다(+€2)', unlock: '트로카데로에서 탑 사진 찍어 주기' , star: 4 },
  { id: 'satchel', slot: 'back', name: '가죽 서류가방', emoji: '💼', perk: '보물상자에서 얻는 € +50%', unlock: '보물상자 5개 열기' , star: 4 },

  { id: 'boots', slot: 'feet', name: '갈색 부츠', emoji: '🥾', perk: '기본(능력 없음)' },
  { id: 'sneakers', slot: 'feet', name: '운동화', emoji: '👟', perk: '달리기가 8% 빠르다' },
  { id: 'hiking', slot: 'feet', name: '등산화', emoji: '🥾', perk: '벽을 탈 때 기력이 20% 덜 든다', unlock: '1 km 걷기' , star: 4 },

  { id: 'tricolore', slot: 'glider', name: '크림·빨강 글라이더', emoji: '🪂', perk: '기본' },
  { id: 'azure', slot: 'glider', name: '하늘색 글라이더', emoji: '🩵', perk: '겉모습만' },
  { id: 'flag', slot: 'glider', name: '삼색기 글라이더', emoji: '🇫🇷', perk: '겉모습만', unlock: '비경 한 곳 깨기' , star: 4 },
  { id: 'butterfly', slot: 'glider', name: '나비 글라이더', emoji: '🦋', perk: '글라이더 기력 −40%', unlock: '기원(5★)', star: 5 },
  { id: 'golden', slot: 'glider', name: '금빛 낙하산', emoji: '🟡', perk: '빠르고 기력을 쓰지 않는다', unlock: '???' },
];

export type Loadout = Record<Slot, string>;
export const DEFAULT_LOADOUT: Loadout = { weapon: 'umbrella', head: 'beret', top: 'jacket', back: 'backpack', feet: 'boots', glider: 'tricolore' };
const STARTER = new Set(GEAR.filter((g) => !g.unlock).map((g) => g.id));

/** 무기의 싸움 능력 */
export interface WeaponStats { atk: number; crit: number; critDmg: number; reach: number; skill: number; burst: number; energy: number; heal: number }
const W0: WeaponStats = { atk: 1, crit: 0.15, critDmg: 1.8, reach: 0, skill: 1, burst: 1, energy: 1, heal: 0 };
const WEAPON_STATS: Record<string, Partial<WeaponStats>> = {
  umbrella: {},
  baguette: { atk: 0.9, heal: 0.02 },
  cane: { crit: 0.3, critDmg: 2.0 },
  oar: { atk: 1.3, reach: 0.9, crit: 0.1 },
  rapier: { atk: 1.15, crit: 0.25, skill: 1.4 },
  flagpole: { atk: 1.2, reach: 0.6, burst: 1.6, energy: 1.3 },
  jeanne: { atk: 1.45, crit: 0.25, critDmg: 2.0 },
};
/** 무기 능력(레벨마다 공격력 +6%) */
export function weaponOf(id: string, lv = 1): WeaponStats { const w = { ...W0, ...(WEAPON_STATS[id] ?? {}) }; w.atk *= 1 + 0.06 * (lv - 1); return w; }
export const WEAPON_MAX_LV = 20;
/** 모험 등급마다 강화할 수 있는 끝(원신의 돌파처럼 — 등급을 올려야 더 올린다) */
export const weaponCap = (ar: number) => Math.min(WEAPON_MAX_LV, 2 + ar * 2);
/** lv → lv+1 비용: 🔹 연마석 · € */
export const enhanceCost = (lv: number) => ({ ore: 2 + lv, eur: 8 * lv });

/** 몸에 미치는 것(곱) */
export interface Mods { run: number; climb: number; glide: number; hurt: number; swim: number; steady: boolean; gcost: number; scost: number }
export function modsOf(l: Loadout): Mods {
  return {
    run: (l.feet === 'sneakers' ? 1.08 : 1) * (l.head === 'panama' ? 1.05 : 1),
    climb: l.feet === 'hiking' ? 0.8 : 1,
    glide: l.top === 'trench' ? 0.85 : 1,
    hurt: l.head === 'aviator' ? 1.6 : 1,
    swim: l.head === 'marin' ? 0.6 : 1,
    steady: l.top === 'leather',
    gcost: l.glider === 'butterfly' ? 0.6 : 1,
    scost: l.top === 'napoleon' ? 0.7 : 1,
  };
}

const KEY = 'carnet-gear-v1';
export class Wardrobe {
  loadout: Loadout = { ...DEFAULT_LOADOUT };
  readonly owned = new Set<string>(STARTER);
  /** 무기 레벨(없으면 1) */
  readonly weaponLv: Record<string, number> = {};
  onChange?: (l: Loadout) => void;
  /** 새로 얻었다(알림은 밖에서) */
  onUnlock?: (g: Gear) => void;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as { loadout?: Partial<Loadout>; owned?: string[]; weaponLv?: Record<string, number> };
        Object.assign(this.weaponLv, d.weaponLv ?? {});
        for (const id of d.owned ?? []) if (GEAR.some((g) => g.id === id)) this.owned.add(id);
        for (const s of SLOTS) { const v = d.loadout?.[s.id]; if (v && this.owned.has(v)) this.loadout[s.id] = v; }
      }
    } catch { /* 저장소를 못 쓰면 처음부터 */ }
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify({ loadout: this.loadout, owned: [...this.owned], weaponLv: this.weaponLv })); } catch { /* 무시 */ } }

  has(id: string) { return Object.values(this.loadout).includes(id); }
  lvOf(id: string) { return this.weaponLv[id] ?? 1; }
  /** 무기 레벨을 하나 올린다(비용은 밖에서 확인·지불) */
  levelUp(id: string) { this.weaponLv[id] = this.lvOf(id) + 1; this.save(); this.onChange?.(this.loadout); }
  equip(id: string) {
    const g = GEAR.find((x) => x.id === id);
    if (!g || !this.owned.has(id)) return false;
    this.loadout = { ...this.loadout, [g.slot]: id };
    this.save();
    this.onChange?.(this.loadout);
    return true;
  }
  unlock(id: string, silent = false) {
    if (this.owned.has(id)) return;
    const g = GEAR.find((x) => x.id === id);
    if (!g) return;
    this.owned.add(id);
    this.save();
    if (!silent) this.onUnlock?.(g);
  }
}
