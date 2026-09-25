// 장비(옷장): 모자 · 윗옷 · 가방 · 신발 · 글라이더 — 하나씩 입고, 입은 것에 따라 겉모습과 작은 능력이 바뀐다.
// 처음부터 있는 것 몇 가지, 나머지는 부탁을 들어주거나 걷다 보면 생긴다.

export type Slot = 'head' | 'top' | 'back' | 'feet' | 'glider';
export const SLOTS: { id: Slot; name: string; emoji: string }[] = [
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
}

export const GEAR: Gear[] = [
  { id: 'beret', slot: 'head', name: '빨간 베레모', emoji: '🔴', perk: '파리 사람 분위기(능력 없음)' },
  { id: 'panama', slot: 'head', name: '파나마 모자', emoji: '👒', perk: '햇볕 아래 지침이 15% 덜 쌓인다', unlock: '에펠탑 1층에 걸린 모자를 찾아 주기' },
  { id: 'aviator', slot: 'head', name: '비행 모자·고글', emoji: '🥽', perk: '높은 데서 떨어져도 1.6배까지 다치지 않는다', unlock: '에펠탑 2층 3분 도전' },
  { id: 'marin', slot: 'head', name: '선원 모자', emoji: '⚓', perk: '헤엄칠 때 기력이 40% 덜 든다', unlock: '센 강 유람선 타기' },
  { id: 'none', slot: 'head', name: '맨머리', emoji: '💇', perk: '머리카락이 바람에 날린다' },

  { id: 'jacket', slot: 'top', name: '파랑 재킷', emoji: '🧥', perk: '기본 여행복(능력 없음)' },
  { id: 'trench', slot: 'top', name: '트렌치코트', emoji: '🧥', perk: '글라이더가 15% 덜 가라앉는다', unlock: '랜드마크 5곳 보기' },
  { id: 'mariniere', slot: 'top', name: '마리니에르', emoji: '👕', perk: '인사하면 사람들이 더 반기고 더 많이 알려 준다', unlock: '샹드마르스 소풍 도와주기' },
  { id: 'leather', slot: 'top', name: '가죽 재킷', emoji: '🖤', perk: '사람과 세게 부딪혀도 휘청이지 않는다', unlock: '"봉주르" 10번' },

  { id: 'backpack', slot: 'back', name: '배낭', emoji: '🎒', perk: '기력 바퀴가 12% 크다' },
  { id: 'camera', slot: 'back', name: '카메라 가방', emoji: '📷', perk: '사진을 찍으면 엽서로 팔린다(+€2)', unlock: '트로카데로에서 탑 사진 찍어 주기' },
  { id: 'satchel', slot: 'back', name: '가죽 서류가방', emoji: '💼', perk: '가게·카페에서 10% 덜 낸다', unlock: '가게 3곳 들어가기' },

  { id: 'boots', slot: 'feet', name: '갈색 부츠', emoji: '🥾', perk: '기본(능력 없음)' },
  { id: 'sneakers', slot: 'feet', name: '운동화', emoji: '👟', perk: '달리기가 8% 빠르다' },
  { id: 'hiking', slot: 'feet', name: '등산화', emoji: '🥾', perk: '벽을 탈 때 기력이 20% 덜 든다', unlock: '1 km 걷기' },

  { id: 'tricolore', slot: 'glider', name: '크림·빨강 글라이더', emoji: '🪂', perk: '기본' },
  { id: 'azure', slot: 'glider', name: '하늘색 글라이더', emoji: '🩵', perk: '겉모습만' },
  { id: 'flag', slot: 'glider', name: '삼색기 글라이더', emoji: '🇫🇷', perk: '겉모습만', unlock: '미니 에펠탑 사기' },
  { id: 'golden', slot: 'glider', name: '금빛 낙하산', emoji: '🟡', perk: '빠르고 기력을 쓰지 않는다', unlock: '???' },
];

export type Loadout = Record<Slot, string>;
export const DEFAULT_LOADOUT: Loadout = { head: 'beret', top: 'jacket', back: 'backpack', feet: 'boots', glider: 'tricolore' };
const STARTER = new Set(GEAR.filter((g) => !g.unlock).map((g) => g.id));

/** 몸에 미치는 것(곱) */
export interface Mods { run: number; climb: number; glide: number; hurt: number; swim: number; steady: boolean }
export function modsOf(l: Loadout): Mods {
  return {
    run: l.feet === 'sneakers' ? 1.08 : 1,
    climb: l.feet === 'hiking' ? 0.8 : 1,
    glide: l.top === 'trench' ? 0.85 : 1,
    hurt: l.head === 'aviator' ? 1.6 : 1,
    swim: l.head === 'marin' ? 0.6 : 1,
    steady: l.top === 'leather',
  };
}

const KEY = 'carnet-gear-v1';
export class Wardrobe {
  loadout: Loadout = { ...DEFAULT_LOADOUT };
  readonly owned = new Set<string>(STARTER);
  onChange?: (l: Loadout) => void;
  /** 새로 얻었다(알림은 밖에서) */
  onUnlock?: (g: Gear) => void;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw) as { loadout?: Partial<Loadout>; owned?: string[] };
        for (const id of d.owned ?? []) if (GEAR.some((g) => g.id === id)) this.owned.add(id);
        for (const s of SLOTS) { const v = d.loadout?.[s.id]; if (v && this.owned.has(v)) this.loadout[s.id] = v; }
      }
    } catch { /* 저장소를 못 쓰면 처음부터 */ }
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify({ loadout: this.loadout, owned: [...this.owned] })); } catch { /* 무시 */ } }

  has(id: string) { return Object.values(this.loadout).includes(id); }
  equip(id: string) {
    const g = GEAR.find((x) => x.id === id);
    if (!g || !this.owned.has(id)) return false;
    this.loadout = { ...this.loadout, [g.slot]: id };
    this.save();
    this.onChange?.(this.loadout);
    return true;
  }
  unlock(id: string) {
    if (this.owned.has(id)) return;
    const g = GEAR.find((x) => x.id === id);
    if (!g) return;
    this.owned.add(id);
    this.save();
    this.onUnlock?.(g);
  }
}
