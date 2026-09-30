// 👥 캐릭터: 직접 만든 여행자 + 파리에서 만나 하나씩 동료가 되는 일곱 사람. 한 번에 한 사람으로 다닌다(파티 창 P에서 바꾼다).
// 사람마다 생김새(피부·머리·키·목도리 색)와 싸움 성격(원소 · 능력)이 다르다. 모험 등급·특성·스킬 트리·장비는 함께 쓴다.
import { DEFAULT_LOOK, type Look } from './hero/figure';

export type CharId = 'traveler' | 'julie' | 'gustave' | 'marcel' | 'amelie' | 'quentin' | 'elodie' | 'lune';

/** 싸움 성격(combat.ts가 성장 mods에 곱한다) */
export interface Kit {
  atk?: number; hp?: number; def?: number; crit?: number; critDmg?: number;
  skill?: number; burst?: number; energy?: number; eCd?: number; steal?: number; chargeCost?: number;
  /** 원소 스킬을 쓰면 체력 회복(최대 체력의 몫) */
  eHeal?: number;
  /** 밤에 공격력 배율 */
  night?: number;
}
export interface Char {
  id: CharId;
  name: string;
  /** 한 줄 소개 */
  role: string;
  /** 원소(이모지 · 이름 · 색) */
  element: { emoji: string; name: string; color: number };
  skill: string; burst: string;
  /** 보통 공격(싸움 모양) */
  attack: string;
  /** 늘 입는 옷(모자 · 윗옷 모양 · [윗옷, 옷자락, 바지] 색) — 여행자는 옷장대로 */
  wear?: { head: string; top: string; colors?: [number, number, number] };
  perk: string;
  kit: Kit;
  look: Look;
  /** 여는 법 */
  unlock: string;
}

export const CHARS: Char[] = [
  {
    id: 'traveler', name: '여행자', role: '파리에 막 도착한 사람 — 바로 당신', element: { emoji: '🌬', name: '바람', color: 0x9ff3e0 },
    skill: '바람 소용돌이', burst: '센 강의 회오리', attack: '우산 검술 — 4단 베기, 넷째는 한 바퀴 회오리 베기', perk: '균형 잡힌 기본 — 스킬 트리를 가장 잘 받는다', kit: {},
    look: DEFAULT_LOOK, unlock: '처음부터',
  },
  {
    id: 'julie', name: '쥘리', role: '에펠탑 가이드 · 퀴즈를 좋아한다', element: { emoji: '💧', name: '센 강의 물', color: 0x6fc3ff },
    skill: '물보라', burst: '센 강의 밀물', attack: '물채찍 — 길고 좁게 휘갈긴다(4.6 m), 넷째는 앞으로 뻗는 물줄기', wear: { head: 'none', top: 'jacket', colors: [0xf0c34a, 0xc99a2a, 0x2f4c6a] }, perk: '원소 스킬을 쓰면 체력 8% 회복 · 체력 +15%', kit: { eHeal: 0.08, hp: 1.15, skill: 0.9 },
    look: { skin: 0xd9a57b, hair: 0x6b3a1e, style: 'ponytail', eyes: 0x3b5a2e, height: 0.97, accent: 0x2f8fd8, extra: '' },
    unlock: '첫걸음 — 달빛 나비를 쥘리에게 보여 주기',
  },
  {
    id: 'gustave', name: '귀스타브', role: '탑 안내인 · 강철을 믿는 사람', element: { emoji: '⚙️', name: '강철', color: 0xc9ccd0 },
    skill: '리벳 박기', burst: '철의 귀부인', attack: '리벳 망치 — 느리고 넓고 묵직하게, 셋째·넷째는 땅을 내리쳐 둘레를 날린다', wear: { head: 'tophat', top: 'trench', colors: [0x5a5f6a, 0x44484f, 0x2a2a2e] }, perk: '공격력 +10% · 받는 피해 −15% · 강공격 기력 −30%', kit: { atk: 1.1, def: 0.15, chargeCost: 0.7 },
    look: { skin: 0xf0c8a4, hair: 0x9a9a98, style: 'short', eyes: 0x3a3a50, height: 1.07, accent: 0x5a5f6a, extra: 'mustache' },
    unlock: '메인 이벤트 「철의 귀부인」(에펠탑)',
  },
  {
    id: 'marcel', name: '마르셀', role: '퇴역 군인 · 불꽃을 지키는 사람', element: { emoji: '🔥', name: '불꽃', color: 0xff8a4a },
    skill: '불씨 찌르기', burst: '꺼지지 않는 불꽃', attack: '총검 찌르기 — 아주 빠른 찌르기, 넷째는 앞에서 터지는 불꽃(불태움)', wear: { head: 'beret', top: 'napoleon' }, perk: '체력 +25% · 맞힐 때마다 체력 1% 회복', kit: { hp: 1.25, steal: 0.01 },
    look: { skin: 0xe8b890, hair: 0xe8e4dc, style: 'short', eyes: 0x2d2016, height: 1.02, accent: 0xb3262c, extra: 'beard' },
    unlock: '메인 이벤트 「꺼지지 않는 불꽃」(개선문)',
  },
  {
    id: 'amelie', name: '아멜리', role: '루브르 안내원 · 빠른 손', element: { emoji: '🖼', name: '빛', color: 0xffe28a },
    skill: '액자 번쩍', burst: '모나리자의 미소', attack: '액자 던지기 — 멀리(14 m) 날아가 맞힌다, 넷째는 세 장을 부채꼴로', wear: { head: 'none', top: 'jacket', colors: [0x1b1b22, 0x121216, 0xe8e4dc] }, perk: '원소 스킬 재사용 −1.5초 · 스킬 피해 +20%', kit: { eCd: 1.5, skill: 1.2 },
    look: { skin: 0xf6d3b8, hair: 0x14110f, style: 'bob', eyes: 0x2d2016, height: 0.95, accent: 0xf0c34a, extra: '' },
    unlock: '메인 이벤트 「유리 피라미드」(루브르)',
  },
  {
    id: 'quentin', name: '캉탱', role: '노트르담 종지기 · 큰 소리', element: { emoji: '🔔', name: '종소리', color: 0xd8b0ff },
    skill: '작은 종', burst: '에마뉘엘의 울림', attack: '종 울리기 — 둘레를 한꺼번에 울린다, 넷째는 큰 고리로 기절', wear: { head: 'none', top: 'trench', colors: [0x4a3560, 0x35264a, 0x2a2a2e] }, perk: '원소 폭발 피해 +40% · 원소 에너지 +25%', kit: { burst: 1.4, energy: 1.25 },
    look: { skin: 0xe2b08a, hair: 0x4a3322, style: 'short', eyes: 0x3a2a20, height: 1.04, accent: 0x5b3b8c, extra: 'glasses' },
    unlock: '메인 이벤트 「종지기의 부탁」(노트르담)',
  },
  {
    id: 'elodie', name: '엘로디', role: '몽마르트르 거리 화가', element: { emoji: '🎨', name: '물감', color: 0xff6fb0 },
    skill: '붓 휘두르기', burst: '파리의 색', attack: '큰 붓 — 가장 빠르고 넓게 휘날린다, 맞은 자리에 물감', wear: { head: 'beret', top: 'mariniere' }, perk: '치명타 +12% · 치명타 피해 +30%', kit: { crit: 0.12, critDmg: 0.3 },
    look: { skin: 0xf3cfb0, hair: 0xc4432a, style: 'bun', eyes: 0x2e4a6a, height: 0.96, accent: 0xff6fb0, extra: '' },
    unlock: '메인 이벤트 「몽마르트르에서 내려다보기」(사크레쾨르)',
  },
  {
    id: 'lune', name: '륀', role: '밤의 파리에서 온 아이 · 떨어진 별의 주인', element: { emoji: '🌙', name: '달빛', color: 0xb79bff },
    skill: '달그림자', burst: '별똥비', attack: '달그림자 베기 — 칠 때마다 적 곁으로 스르르, 넷째는 적 뒤로 돌아가 한 바퀴', wear: { head: 'none', top: 'trench', colors: [0x2a2250, 0x1c163a, 0xe9e4ff] }, perk: '밤에 공격력 +30% · 공격력 +5%', kit: { atk: 1.05, night: 1.3 },
    look: { skin: 0xf4e4f0, hair: 0xe9e4ff, style: 'long', eyes: 0x6a4bd6, height: 0.93, accent: 0x6a4bd6, extra: '' },
    unlock: '🌗 파리의 두 얼굴을 끝까지',
  },
];

interface Save { created: boolean; name: string; look: Look; unlocked: CharId[]; active: CharId }
const KEY = 'carnet-party-v1';

export class Party {
  created = false;
  /** 여행자의 이름과 생김새(만들기) */
  name = '여행자';
  look: Look = { ...DEFAULT_LOOK };
  readonly unlocked = new Set<CharId>(['traveler']);
  active: CharId = 'traveler';
  onChange?: () => void;
  /** 새 동료(알림은 밖에서) */
  onUnlock?: (c: Char) => void;

  constructor() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Save> | null;
      if (d) {
        this.created = !!d.created; this.name = d.name || '여행자'; this.look = { ...DEFAULT_LOOK, ...(d.look ?? {}) };
        for (const id of d.unlocked ?? []) if (CHARS.some((c) => c.id === id)) this.unlocked.add(id);
        if (d.active && this.unlocked.has(d.active)) this.active = d.active;
      }
    } catch { /* 처음부터 */ }
  }
  private save() {
    const d: Save = { created: this.created, name: this.name, look: this.look, unlocked: [...this.unlocked], active: this.active };
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* 무시 */ }
    this.onChange?.();
  }
  get char(): Char { return CHARS.find((c) => c.id === this.active)!; }
  /** 이 캐릭터의 이름(여행자는 만든 이름) */
  nameOf(c: Char) { return c.id === 'traveler' ? this.name : c.name; }
  lookOf(c: Char): Look { return c.id === 'traveler' ? this.look : c.look; }
  create(name: string, look: Look) {
    this.name = name.trim().slice(0, 12) || '여행자';
    this.look = { ...look };
    this.created = true;
    this.save();
  }
  unlock(id: CharId) {
    if (this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    this.save();
    this.onUnlock?.(CHARS.find((c) => c.id === id)!);
    return true;
  }
  select(id: CharId) {
    if (!this.unlocked.has(id) || this.active === id) return false;
    this.active = id;
    this.save();
    return true;
  }
}
