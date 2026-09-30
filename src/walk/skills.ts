// 📜 기술(디아블로 2처럼): 캐릭터마다 세 갈래 × 네 단계 = 열두 기술. 모험 등급마다 그 캐릭터의 기술 포인트 1점.
// 단계는 모험 등급 1 · 3 · 6 · 10에 열리고, 위 단계를 한 점이라도 찍어야 아래가 열린다. 기술 레벨은 20까지,
// 같은 갈래의 다른 기술 레벨마다 피해 +6%(시너지). 쓰는 기술(마나 · 재사용)은 5 · 6 · 7 · 8 칸에 올려 쓰고,
// 익히는 기술(패시브)은 늘 켜져 있다. 효과는 몇 가지 틀(화살 · 고리 · 부채꼴 · 돌진 · 도약 · 비 · 궤도 · 사슬 ·
// 포탑 · 덫 · 불길 · 오라 · 강화)을 기술마다 다르게 조합한다. 불태움 · 독 · 느려짐 · 기절 · 밀침 · 끌어당김 · 흡혈.
import * as THREE from 'three';
import type { MoveApi, FoeLike } from './moves';
import type { CharId } from './party';
import * as sfx from './sound';
import { CHAR_ELEM, type Elem } from './elements';

export type Status = 'burn' | 'poison' | 'slow' | 'stun' | 'knock' | 'pull' | 'drain';
export type Eff =
  | { k: 'bolt'; n?: number; spread?: number; speed?: number; range?: number; pierce?: boolean; boom?: number; size?: number }
  | { k: 'nova'; r: number; at?: 'self' | 'target' }
  | { k: 'cone'; r: number; deg: number; hits?: number }
  | { k: 'line'; len: number; w: number; dash?: boolean }
  | { k: 'leap'; range: number; r: number }
  | { k: 'rain'; n: number; every: number; r: number; area: number; tall?: boolean }
  | { k: 'orbit'; n: number; secs: number; r: number }
  | { k: 'chain'; jumps: number; range: number }
  | { k: 'turret'; secs: number; every: number; range: number; n?: number }
  | { k: 'trap'; secs: number; r: number; n?: number }
  | { k: 'zone'; secs: number; r: number; at?: 'self' | 'target' }
  | { k: 'aura'; secs: number; r: number }
  | { k: 'buff'; secs: number };
/** 익히는 기술(레벨마다) · 강화(한 번에) */
export interface Boost { atk?: number; crit?: number; critDmg?: number; hp?: number; def?: number; aspd?: number; regen?: number; steal?: number; heal?: number }
export interface SkillDef {
  id: string; char: CharId; tree: number; tier: number;
  emoji: string; name: string; desc: string;
  /** 쓰는 기술 */ eff?: Eff; dmg?: number; cost?: number; cd?: number; status?: Status; heal?: number;
  /** 강화(버프): 레벨 1 값 · 레벨마다 더하는 몫(×) */ buff?: Boost;
  /** 익히는 기술: 레벨마다 */ passive?: Boost;
}
/** 갈래 이름(캐릭터마다 셋) */
export const TREES: Record<CharId, [string, string, string]> = {
  traveler: ['🗡 바람 검술', '🌪 폭풍', '🧭 여행자의 지혜'],
  julie: ['🌊 물채찍술', '❄️ 얼음 마법', '💧 치유의 물'],
  gustave: ['🔨 망치', '⚙️ 기계 장치', '🛡 강철 방어'],
  marcel: ['🔫 총검술', '🔥 화염', '📯 군인의 함성'],
  amelie: ['🖼 던지기', '✨ 빛의 마법', '🎭 예술의 속임수'],
  quentin: ['🔔 종 울림', '🕯 가호', '📢 소리'],
  elodie: ['🖌 붓놀림', '🌈 색의 마법', '🐦 그림 친구'],
  lune: ['🌑 그림자 무술', '🌠 별의 마법', '🌙 밤의 기운'],
};
/** 단계가 열리는 모험 등급 */
export const TIER_AR = [1, 3, 6, 10];
export const MAX_LV = 20;
const COLOR: Record<CharId, number> = { traveler: 0x9ff3e0, julie: 0x6fc3ff, gustave: 0xc9ccd0, marcel: 0xff8a4a, amelie: 0xffe28a, quentin: 0xd8b0ff, elodie: 0xff6fb0, lune: 0xb79bff };

type A = Omit<SkillDef, 'id' | 'char' | 'tree' | 'tier'>;
const defs: SkillDef[] = [];
const put = (char: CharId, rows: [A, A, A, A][]) => rows.forEach((row, tree) => row.forEach((d, tier) => defs.push({ ...d, id: `${char}.${tree}${tier}`, char, tree, tier })));

put('traveler', [
  [{ emoji: '🌬', name: '질풍 베기', desc: '앞을 넓게 두 번 벤다', eff: { k: 'cone', r: 3.4, deg: 130, hits: 2 }, dmg: 0.9, cost: 8, cd: 1.2 },
    { emoji: '🗡', name: '검의 바람', desc: '공격력이 오른다', passive: { atk: 0.04 } },
    { emoji: '💨', name: '회오리 돌진', desc: '8 m 앞으로 내달리며 꿰뚫고 날려 보낸다', eff: { k: 'line', len: 8, w: 1.2, dash: true }, dmg: 2.2, cost: 14, cd: 4, status: 'knock' },
    { emoji: '⚔️', name: '천 개의 칼바람', desc: '칼바람 여섯이 몸 둘레를 5초 동안 돈다', eff: { k: 'orbit', n: 6, secs: 5, r: 2.6 }, dmg: 0.55, cost: 30, cd: 14 }],
  [{ emoji: '🍃', name: '바람 화살', desc: '곧게 날아가는 바람 화살', eff: { k: 'bolt', speed: 28 }, dmg: 1.3, cost: 6, cd: 0.5 },
    { emoji: '🌀', name: '돌풍 고리', desc: '둘레를 밀어내는 돌풍', eff: { k: 'nova', r: 5 }, dmg: 1.4, cost: 14, cd: 5, status: 'knock' },
    { emoji: '⚡', name: '번개 사슬', desc: '적에서 적으로 다섯 번 튀는 번개', eff: { k: 'chain', jumps: 5, range: 8 }, dmg: 1.5, cost: 18, cd: 3 },
    { emoji: '⛈', name: '대폭풍', desc: '둘레 10 m에 번개가 열두 번 내리친다', eff: { k: 'rain', n: 12, every: 0.25, r: 2.2, area: 10, tall: true }, dmg: 1.2, cost: 40, cd: 18, status: 'stun' }],
  [{ emoji: '👟', name: '가벼운 발', desc: '공격이 빨라진다', passive: { aspd: 0.03 } },
    { emoji: '🛡', name: '바람의 가호', desc: '10초 동안 받는 피해가 준다', eff: { k: 'buff', secs: 10 }, buff: { def: 0.2 }, cost: 16, cd: 20 },
    { emoji: '🫁', name: '숨 고르기', desc: '마나가 빨리 찬다 · 체력이 오른다', passive: { regen: 0.1, hp: 0.02 } },
    { emoji: '👁', name: '바람의 눈', desc: '12초 동안 공격력 · 치명타가 크게 오른다', eff: { k: 'buff', secs: 12 }, buff: { atk: 0.15, crit: 0.2 }, cost: 30, cd: 30 }],
]);
put('julie', [
  [{ emoji: '🪢', name: '물채찍 휘감기', desc: '5 m 앞의 적을 휘감아 끌어온다', eff: { k: 'cone', r: 5.2, deg: 50 }, dmg: 1.2, cost: 8, cd: 1.5, status: 'pull' },
    { emoji: '📏', name: '긴 채찍', desc: '공격력이 오른다', passive: { atk: 0.04 } },
    { emoji: '⛲', name: '물기둥', desc: '가장 가까운 적 발밑에서 물기둥이 솟는다', eff: { k: 'nova', r: 3, at: 'target' }, dmg: 2.4, cost: 14, cd: 4, status: 'knock' },
    { emoji: '🌊', name: '해일 채찍', desc: '12 m를 휩쓰는 거대한 물결', eff: { k: 'line', len: 12, w: 2.2 }, dmg: 3, cost: 30, cd: 12, status: 'knock' }],
  [{ emoji: '🧊', name: '얼음 화살', desc: '맞은 적을 느리게 한다', eff: { k: 'bolt', speed: 24 }, dmg: 1.2, cost: 6, cd: 0.5, status: 'slow' },
    { emoji: '❄️', name: '서리 고리', desc: '둘레를 얼려 느리게 한다', eff: { k: 'nova', r: 5.5 }, dmg: 1.2, cost: 14, cd: 5, status: 'slow' },
    { emoji: '🔵', name: '얼음 구슬', desc: '천천히 날아가다 터지는 얼음 덩이', eff: { k: 'bolt', speed: 11, boom: 4, size: 0.5, pierce: true }, dmg: 1.8, cost: 20, cd: 4, status: 'slow' },
    { emoji: '🌨', name: '눈보라', desc: '둘레 10 m에 얼음이 쏟아진다', eff: { k: 'rain', n: 16, every: 0.2, r: 2.4, area: 10 }, dmg: 1, cost: 40, cd: 18, status: 'slow' }],
  [{ emoji: '💧', name: '맑은 샘', desc: '체력이 오른다', passive: { hp: 0.05 } },
    { emoji: '🫧', name: '치유의 물방울', desc: '체력을 곧바로 채운다', eff: { k: 'buff', secs: 0.1 }, buff: { heal: 0.2 }, cost: 18, cd: 10 },
    { emoji: '🌧', name: '정화의 비', desc: '8초 동안 둘레에 비가 내려 적을 적시고 나를 채운다', eff: { k: 'aura', secs: 8, r: 4 }, dmg: 0.4, cost: 26, cd: 16, heal: 0.02 },
    { emoji: '💎', name: '생명의 물', desc: '맞힐 때마다 체력을 조금 빨아들인다', passive: { steal: 0.004 } }],
]);
put('gustave', [
  [{ emoji: '🪓', name: '대지 가르기', desc: '땅을 가르는 7 m 충격', eff: { k: 'line', len: 7, w: 1.3 }, dmg: 1.8, cost: 10, cd: 2, status: 'stun' },
    { emoji: '💪', name: '단련된 팔', desc: '공격력이 오른다', passive: { atk: 0.05 } },
    { emoji: '🦘', name: '도약 강타', desc: '10 m 뛰어올라 내리찍는다', eff: { k: 'leap', range: 10, r: 3.8 }, dmg: 2.6, cost: 16, cd: 5, status: 'stun' },
    { emoji: '🌋', name: '대지진', desc: '둘레 8 m가 흔들린다', eff: { k: 'nova', r: 8 }, dmg: 3, cost: 34, cd: 14, status: 'stun' }],
  [{ emoji: '🔩', name: '리벳 포탑', desc: '10초 동안 가까운 적에게 리벳을 쏘는 포탑', eff: { k: 'turret', secs: 10, every: 0.7, range: 12 }, dmg: 0.8, cost: 18, cd: 8 },
    { emoji: '💥', name: '증기 폭발 덫', desc: '밟으면 터지는 증기 덫 셋', eff: { k: 'trap', secs: 20, r: 3, n: 3 }, dmg: 2.2, cost: 16, cd: 6, status: 'knock' },
    { emoji: '⚙️', name: '회전 톱니', desc: '톱니 넷이 6초 동안 몸 둘레를 돈다', eff: { k: 'orbit', n: 4, secs: 6, r: 2.4 }, dmg: 0.8, cost: 24, cd: 12 },
    { emoji: '🗼', name: '에펠 포대', desc: '15초 동안 세 발씩 쏘는 큰 포탑', eff: { k: 'turret', secs: 15, every: 0.9, range: 16, n: 3 }, dmg: 1.1, cost: 45, cd: 25 }],
  [{ emoji: '🧱', name: '두꺼운 갑옷', desc: '받는 피해가 준다', passive: { def: 0.03 } },
    { emoji: '🛡', name: '강철 피부', desc: '12초 동안 받는 피해 −35%', eff: { k: 'buff', secs: 12 }, buff: { def: 0.35 }, cost: 20, cd: 24 },
    { emoji: '🫀', name: '강철 심장', desc: '체력이 크게 오른다', passive: { hp: 0.06 } },
    { emoji: '🌵', name: '가시 갑옷', desc: '10초 동안 가까이 온 적을 찌른다', eff: { k: 'aura', secs: 10, r: 3 }, dmg: 0.7, cost: 30, cd: 20 }],
]);
put('marcel', [
  [{ emoji: '🔪', name: '연속 찌르기', desc: '좁고 길게 세 번 찌른다', eff: { k: 'cone', r: 4.4, deg: 32, hits: 3 }, dmg: 0.7, cost: 8, cd: 1.2 },
    { emoji: '🎖', name: '총검술', desc: '공격력이 오른다', passive: { atk: 0.04 } },
    { emoji: '🏇', name: '돌격', desc: '9 m 돌진하며 불태운다', eff: { k: 'line', len: 9, w: 1.2, dash: true }, dmg: 2, cost: 14, cd: 4, status: 'burn' },
    { emoji: '🚩', name: '마지막 돌격', desc: '15 m를 꿰뚫는 불꽃 돌진', eff: { k: 'line', len: 15, w: 1.8, dash: true }, dmg: 3.4, cost: 32, cd: 14, status: 'burn' }],
  [{ emoji: '🔥', name: '화염구', desc: '맞으면 터지는 불덩이', eff: { k: 'bolt', speed: 22, boom: 2.6 }, dmg: 1.5, cost: 8, cd: 0.8, status: 'burn' },
    { emoji: '🧱', name: '불의 벽', desc: '앞에 6초 동안 타오르는 불길', eff: { k: 'zone', secs: 6, r: 3, at: 'target' }, dmg: 0.6, cost: 16, cd: 8, status: 'burn' },
    { emoji: '💥', name: '화염 폭발', desc: '둘레가 한꺼번에 터진다', eff: { k: 'nova', r: 5 }, dmg: 2.2, cost: 22, cd: 7, status: 'burn' },
    { emoji: '☄️', name: '메테오', desc: '하늘에서 불덩이 여섯이 떨어진다', eff: { k: 'rain', n: 6, every: 0.45, r: 3.4, area: 12, tall: true }, dmg: 2.4, cost: 45, cd: 20, status: 'burn' }],
  [{ emoji: '📯', name: '전투 함성', desc: '12초 동안 공격력 +20%', eff: { k: 'buff', secs: 12 }, buff: { atk: 0.2 }, cost: 14, cd: 20 },
    { emoji: '❤️‍🔥', name: '용기', desc: '체력이 오른다', passive: { hp: 0.05 } },
    { emoji: '📢', name: '함성', desc: '둘레의 적을 얼어붙게 한다(기절)', eff: { k: 'nova', r: 6 }, dmg: 0.6, cost: 18, cd: 10, status: 'stun' },
    { emoji: '🗿', name: '불굴', desc: '10초 동안 받는 피해 −30% · 흡혈', eff: { k: 'buff', secs: 10 }, buff: { def: 0.3, steal: 0.02 }, cost: 30, cd: 30 }],
]);
put('amelie', [
  [{ emoji: '🖼', name: '액자 다발', desc: '액자 셋을 부채꼴로', eff: { k: 'bolt', n: 3, spread: 16, speed: 24 }, dmg: 0.9, cost: 8, cd: 0.8 },
    { emoji: '🎯', name: '정확한 손', desc: '치명타가 오른다', passive: { crit: 0.025 } },
    { emoji: '📌', name: '관통 액자', desc: '줄지어 선 적을 모두 꿰뚫는다', eff: { k: 'bolt', speed: 30, pierce: true, range: 20 }, dmg: 1.9, cost: 12, cd: 2 },
    { emoji: '🌪', name: '액자 폭풍', desc: '사방으로 액자 열두 장', eff: { k: 'bolt', n: 12, spread: 360, speed: 22 }, dmg: 1.1, cost: 32, cd: 12 }],
  [{ emoji: '✨', name: '성스러운 빛', desc: '맞으면 터지는 빛 덩이', eff: { k: 'bolt', speed: 20, boom: 2.4 }, dmg: 1.4, cost: 8, cd: 0.8, status: 'drain' },
    { emoji: '🔨', name: '빛의 망치', desc: '빛 망치 셋이 넓게 돈다', eff: { k: 'orbit', n: 3, secs: 6, r: 3.4 }, dmg: 0.9, cost: 20, cd: 10 },
    { emoji: '📸', name: '눈부신 섬광', desc: '앞 부채꼴을 기절시킨다', eff: { k: 'cone', r: 9, deg: 100 }, dmg: 1.2, cost: 16, cd: 8, status: 'stun' },
    { emoji: '🌅', name: '천상의 빛', desc: '빛기둥 열이 내리친다', eff: { k: 'rain', n: 10, every: 0.25, r: 2.6, area: 11, tall: true }, dmg: 1.5, cost: 42, cd: 18 }],
  [{ emoji: '🪞', name: '미끼 그림', desc: '12초 동안 적을 쏘는 그림', eff: { k: 'turret', secs: 12, every: 0.9, range: 11 }, dmg: 0.9, cost: 16, cd: 10 },
    { emoji: '🎭', name: '빛 함정', desc: '밟으면 번쩍이는 함정 둘(기절)', eff: { k: 'trap', secs: 20, r: 3.2, n: 2 }, dmg: 1.6, cost: 14, cd: 7, status: 'stun' },
    { emoji: '🩰', name: '가벼운 손놀림', desc: '공격이 빨라진다', passive: { aspd: 0.03 } },
    { emoji: '🏛', name: '걸작', desc: '12초 동안 치명타 피해 +80%', eff: { k: 'buff', secs: 12 }, buff: { critDmg: 0.8, crit: 0.1 }, cost: 30, cd: 28 }],
]);
put('quentin', [
  [{ emoji: '🔔', name: '맑은 종', desc: '둘레를 울린다', eff: { k: 'nova', r: 4 }, dmg: 1.2, cost: 8, cd: 1.2 },
    { emoji: '🎼', name: '종지기의 팔', desc: '공격력이 오른다', passive: { atk: 0.04 } },
    { emoji: '〰️', name: '울림 파동', desc: '앞으로 길게 퍼지는 소리의 물결', eff: { k: 'cone', r: 10, deg: 40 }, dmg: 1.8, cost: 14, cd: 3, status: 'knock' },
    { emoji: '🛎', name: '대종', desc: '둘레 8 m를 크게 울려 기절시킨다', eff: { k: 'nova', r: 8 }, dmg: 2.8, cost: 34, cd: 14, status: 'stun' }],
  [{ emoji: '💪', name: '힘의 가호', desc: '20초 동안 공격력 +25%', eff: { k: 'buff', secs: 20 }, buff: { atk: 0.25 }, cost: 16, cd: 25 },
    { emoji: '🌵', name: '가시의 가호', desc: '10초 동안 둘레를 계속 찌른다', eff: { k: 'aura', secs: 10, r: 4 }, dmg: 0.6, cost: 20, cd: 16 },
    { emoji: '💚', name: '회복의 가호', desc: '10초 동안 체력이 찬다', eff: { k: 'aura', secs: 10, r: 0.1 }, dmg: 0, heal: 0.025, cost: 20, cd: 20 },
    { emoji: '🕯', name: '신성한 불꽃', desc: '12초 동안 둘레를 태우는 오라', eff: { k: 'aura', secs: 12, r: 5 }, dmg: 1.1, cost: 38, cd: 24, status: 'burn' }],
  [{ emoji: '😖', name: '귀청 찢기', desc: '앞의 적을 기절시킨다', eff: { k: 'cone', r: 5, deg: 90 }, dmg: 0.8, cost: 10, cd: 5, status: 'stun' },
    { emoji: '🧱', name: '두꺼운 망토', desc: '받는 피해가 준다', passive: { def: 0.03 } },
    { emoji: '🔗', name: '공명', desc: '소리가 적에서 적으로 여섯 번', eff: { k: 'chain', jumps: 6, range: 9 }, dmg: 1.5, cost: 18, cd: 3 },
    { emoji: '⛪', name: '종탑의 울림', desc: '하늘에서 종소리가 여덟 번 떨어진다', eff: { k: 'rain', n: 8, every: 0.35, r: 3.2, area: 11 }, dmg: 1.9, cost: 42, cd: 18, status: 'stun' }],
]);
put('elodie', [
  [{ emoji: '🎨', name: '물감 튀기기', desc: '앞으로 넓게 물감을 뿌린다', eff: { k: 'cone', r: 4.2, deg: 110, hits: 2 }, dmg: 0.8, cost: 8, cd: 1 },
    { emoji: '✋', name: '빠른 손목', desc: '공격이 빨라진다', passive: { aspd: 0.03 } },
    { emoji: '🌀', name: '색의 소용돌이', desc: '물감 다섯 방울이 몸 둘레를 돈다', eff: { k: 'orbit', n: 5, secs: 6, r: 2.4 }, dmg: 0.7, cost: 20, cd: 10, status: 'poison' },
    { emoji: '🖼', name: '걸작 붓질', desc: '14 m를 한 번에 그어 버린다', eff: { k: 'line', len: 14, w: 1.6 }, dmg: 3.2, cost: 32, cd: 12 }],
  [{ emoji: '🧪', name: '독 물감', desc: '맞은 적을 중독시킨다', eff: { k: 'bolt', speed: 22 }, dmg: 1, cost: 6, cd: 0.5, status: 'poison' },
    { emoji: '🔗', name: '색 사슬', desc: '물감이 적에서 적으로 다섯 번', eff: { k: 'chain', jumps: 5, range: 8 }, dmg: 1.4, cost: 16, cd: 3, status: 'poison' },
    { emoji: '🟢', name: '물감 웅덩이', desc: '8초 동안 독 웅덩이', eff: { k: 'zone', secs: 8, r: 3.4, at: 'target' }, dmg: 0.5, cost: 18, cd: 9, status: 'poison' },
    { emoji: '🌈', name: '무지개 폭발', desc: '둘레 8 m가 무지개로 터진다', eff: { k: 'nova', r: 8 }, dmg: 3, cost: 40, cd: 16 }],
  [{ emoji: '🐦', name: '그린 새', desc: '10초 동안 적을 쪼는 그림 새', eff: { k: 'turret', secs: 10, every: 0.6, range: 11 }, dmg: 0.6, cost: 14, cd: 8 },
    { emoji: '🐈', name: '그린 고양이', desc: '12초 동안 두 발씩 쏘는 그림 고양이', eff: { k: 'turret', secs: 12, every: 0.8, range: 12, n: 2 }, dmg: 0.7, cost: 20, cd: 12 },
    { emoji: '🖌', name: '생생한 색', desc: '치명타가 오른다', passive: { crit: 0.025 } },
    { emoji: '🐉', name: '살아난 그림', desc: '15초 동안 세 발씩 불을 뿜는 그림 용', eff: { k: 'turret', secs: 15, every: 0.7, range: 15, n: 3 }, dmg: 1, cost: 45, cd: 25, status: 'burn' }],
]);
put('lune', [
  [{ emoji: '🦶', name: '그림자 발차기', desc: '적에게 뛰어들어 찬다', eff: { k: 'leap', range: 8, r: 2.2 }, dmg: 1.8, cost: 8, cd: 1.5, status: 'knock' },
    { emoji: '🎯', name: '급소', desc: '치명타가 오른다', passive: { crit: 0.025 } },
    { emoji: '👥', name: '그림자 분신', desc: '12초 동안 곁에서 달그림자를 쏘는 분신', eff: { k: 'turret', secs: 12, every: 0.5, range: 9 }, dmg: 0.7, cost: 20, cd: 14 },
    { emoji: '🌑', name: '월식', desc: '적 무리 한가운데로 떨어져 모두 벤다', eff: { k: 'leap', range: 14, r: 6 }, dmg: 3.4, cost: 36, cd: 14, status: 'stun' }],
  [{ emoji: '⭐', name: '별 화살', desc: '별 둘을 쏜다', eff: { k: 'bolt', n: 2, spread: 10, speed: 26 }, dmg: 0.9, cost: 6, cd: 0.5 },
    { emoji: '💫', name: '별 사슬', desc: '별빛이 적에서 적으로 여섯 번', eff: { k: 'chain', jumps: 6, range: 9 }, dmg: 1.5, cost: 18, cd: 3 },
    { emoji: '🌙', name: '초승달 칼날', desc: '초승달 셋이 몸 둘레를 돈다', eff: { k: 'orbit', n: 3, secs: 7, r: 2.8 }, dmg: 1, cost: 24, cd: 12 },
    { emoji: '🌠', name: '유성우', desc: '별 열넷이 쏟아진다', eff: { k: 'rain', n: 14, every: 0.22, r: 2.4, area: 12, tall: true }, dmg: 1.4, cost: 45, cd: 20 }],
  [{ emoji: '🌘', name: '밤의 힘', desc: '공격력이 오른다', passive: { atk: 0.04 } },
    { emoji: '🧥', name: '어둠 망토', desc: '10초 동안 받는 피해 −30% · 공격 속도 +15%', eff: { k: 'buff', secs: 10 }, buff: { def: 0.3, aspd: 0.15 }, cost: 18, cd: 22 },
    { emoji: '🌌', name: '고요한 밤', desc: '마나가 빨리 찬다', passive: { regen: 0.12 } },
    { emoji: '🌕', name: '만월', desc: '12초 동안 공격력 +30% · 치명타 +25%', eff: { k: 'buff', secs: 12 }, buff: { atk: 0.3, crit: 0.25 }, cost: 38, cd: 34 }],
]);
export const SKILLS = defs;

/** ✦ 각성(디아블로 4 · PoE처럼): 쓰는 기술은 Lv5 · Lv10에 둘 중 하나를 고른다 — 기술의 모양이 바뀐다(언제든 바꿀 수 있다) */
export interface Awake { id: string; name: string; what: string }
type K = Eff['k'];
export const AWAKE: Record<K, [[Awake, Awake], [Awake, Awake]]> = {
  bolt: [[{ id: 'split', name: '갈래', what: '두 발 더 · 한 발 피해 −25%' }, { id: 'big', name: '거대화', what: '꿰뚫고 터진다(폭발 +1.5 m)' }], [{ id: 'shards', name: '파편', what: '맞으면 작은 파편 셋이 사방으로' }, { id: 'return', name: '부메랑', what: '끝까지 가면 되돌아온다' }]],
  nova: [[{ id: 'twice', name: '메아리', what: '0.5초 뒤 한 번 더' }, { id: 'implode', name: '끌어모으기', what: '가운데로 끌어모은 뒤 터진다' }], [{ id: 'wide', name: '확장', what: '반경 +50%' }, { id: 'weaken', name: '약점 노출', what: '맞은 적이 6초 동안 받는 피해 +30%' }]],
  cone: [[{ id: 'again', name: '연타', what: '한 번 더 휘두른다' }, { id: 'wide', name: '넓은 휘두르기', what: '각도 +60°' }], [{ id: 'crit', name: '급소 노리기', what: '피해 +30%' }, { id: 'mana', name: '마나 흡수', what: '맞힌 적마다 마나 +2' }]],
  line: [[{ id: 'long', name: '긴 궤적', what: '길이 +50%' }, { id: 'trail', name: '남은 자국', what: '지나간 자리에 3초 동안 원소가 남는다' }], [{ id: 'return', name: '왕복', what: '0.4초 뒤 거꾸로 한 번 더' }, { id: 'boom', name: '끝 폭발', what: '끝에서 터진다' }]],
  leap: [[{ id: 'wide', name: '큰 착지', what: '착지 반경 +60%' }, { id: 'double', name: '이단 도약', what: '다음 적에게 한 번 더 뛴다' }], [{ id: 'guard', name: '불굴의 착지', what: '착지 뒤 1.5초 무적' }, { id: 'quake', name: '여진', what: '충격파가 두 번 더 퍼진다' }]],
  rain: [[{ id: 'more', name: '폭우', what: '개수 +50%' }, { id: 'big', name: '거대한 낙하', what: '반경 +40%' }], [{ id: 'finale', name: '마지막 한 방', what: '끝에 커다란 한 방' }, { id: 'slowall', name: '짓누름', what: '맞은 적이 느려진다' }]],
  orbit: [[{ id: 'more', name: '더 많은 궤도', what: '두 개 더' }, { id: 'long', name: '긴 궤도', what: '지속 +50%' }], [{ id: 'burst', name: '흩뿌리기', what: '끝나면 사방으로 날아간다' }, { id: 'mana', name: '마나 궤도', what: '맞힐 때마다 마나 +1' }]],
  chain: [[{ id: 'more', name: '긴 사슬', what: '세 번 더 튄다' }, { id: 'fork', name: '갈라지는 사슬', what: '첫 적에서 둘로 갈라진다' }], [{ id: 'grow', name: '증폭', what: '튈수록 세진다(+15%씩)' }, { id: 'boom', name: '종착 폭발', what: '마지막 적에서 터진다' }]],
  turret: [[{ id: 'two', name: '쌍둥이', what: '둘을 세운다' }, { id: 'rapid', name: '속사', what: '50% 빨리 쏜다' }], [{ id: 'boom', name: '자폭', what: '사라질 때 크게 터진다' }, { id: 'chill', name: '냉기 탄', what: '맞은 적이 느려진다' }]],
  trap: [[{ id: 'more', name: '덫 무더기', what: '두 개 더' }, { id: 'wide', name: '큰 덫', what: '반경 +50%' }], [{ id: 'chain', name: '연쇄', what: '하나가 터지면 가까운 덫도 함께' }, { id: 'pull', name: '끌어들이기', what: '터지기 전에 둘레를 끌어들인다' }]],
  zone: [[{ id: 'follow', name: '따라오기', what: '나를 따라다닌다' }, { id: 'wide', name: '넓게', what: '반경 +50%' }], [{ id: 'boom', name: '끝 폭발', what: '끝날 때 터진다' }, { id: 'heal', name: '생명의 장', what: '안에 있으면 체력이 찬다' }]],
  aura: [[{ id: 'wide', name: '넓은 오라', what: '반경 +50%' }, { id: 'long', name: '긴 오라', what: '지속 +50%' }], [{ id: 'boom', name: '마무리 폭발', what: '끝날 때 크게 터진다' }, { id: 'mana', name: '마나 오라', what: '틱마다 마나 +1' }]],
  buff: [[{ id: 'long', name: '오래가는', what: '지속 +50%' }, { id: 'strong', name: '강렬한', what: '효과 +50%' }], [{ id: 'shock', name: '충격파', what: '쓸 때 둘레를 날려 버린다' }, { id: 'cd', name: '숨 고르기', what: '재사용 −30%' }]],
};
export const skillOf = (id: string) => SKILLS.find((s) => s.id === id);
export const skillsOf = (c: CharId) => SKILLS.filter((s) => s.char === c);

interface Save { ranks: Record<string, number>; slots: Partial<Record<CharId, (string | null)[]>>; awake?: Record<string, [number | null, number | null]> }
const KEY = 'carnet-skills-v1';
const dirOf = (deg: number): [number, number] => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
const bearing = (dx: number, dy: number) => ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
const angDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const glow = (color: number, opacity = 0.85) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });

export interface ArsenalCtx {
  api: MoveApi & { slow(f: FoeLike, secs: number): void; vuln(f: FoeLike, secs: number): void };
  who(): CharId;
  ar(): number;
  /** 싸울 수 있나(창·지도·대화가 아닌 때) */
  live(): boolean;
  /** 동작(스킬 자세) — 공격 중이면 false */
  act(big: boolean): boolean;
  hint(s: string): void;
  learned?(d: SkillDef, first: boolean): void;
}

/** 기술 상태 + 쓰는 엔진 */
export class Arsenal {
  private readonly c: ArsenalCtx;
  readonly ranks: Record<string, number> = {};
  private slots: Partial<Record<CharId, (string | null)[]>> = {};
  /** 각성 고른 것: [Lv5 쪽, Lv10 쪽] (0 · 1 · 없음) */
  readonly awake: Record<string, [number | null, number | null]> = {};
  mp = 50;
  private cds = new Map<string, number>();
  /** 켜진 강화: 끝나는 시각(초) */
  private buffs: { d: SkillDef; lv: number; t: number }[] = [];
  private shots: { x: number; y: number; z: number; dx: number; dy: number; left: number; speed: number; d: SkillDef; lv: number; obj: THREE.Object3D; hit: Set<FoeLike>; pierce: boolean; boom: number; range?: number; back?: boolean; shard?: boolean; mul?: number; slow?: boolean }[] = [];
  private timed: { t: number; fn: () => void }[] = [];
  private orbits: { d: SkillDef; lv: number; t: number; secs: number; objs: THREE.Object3D[]; last: Map<FoeLike, number>; r: number }[] = [];
  private turrets: { d: SkillDef; lv: number; x: number; y: number; z: number; t: number; secs: number; fire: number; obj: THREE.Object3D; every: number; range: number; n: number }[] = [];
  private traps: { d: SkillDef; lv: number; x: number; y: number; z: number; t: number; obj: THREE.Object3D; r: number }[] = [];
  private zones: { d: SkillDef; lv: number; x: number; y: number; z: number; t: number; tick: number; obj: THREE.Object3D; self: boolean; r: number; mul: number }[] = [];
  private dots = new Map<FoeLike, { kind: 'burn' | 'poison'; t: number; tick: number; dmg: number }>();
  private clock = 0;
  /** 쓴 횟수(첫걸음) */
  casts = 0;
  onChange?: () => void;
  readonly el: HTMLElement;
  private readonly mpEl: HTMLElement;

  constructor(c: ArsenalCtx) {
    this.c = c;
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Save | null;
      if (d) { for (const [k, v] of Object.entries(d.ranks ?? {})) if (skillOf(k)) this.ranks[k] = Math.min(MAX_LV, v); this.slots = d.slots ?? {}; Object.assign(this.awake, d.awake ?? {}); }
    } catch { /* 처음부터 */ }
    this.el = document.createElement('div');
    this.el.className = 'skbar';
    document.body.appendChild(this.el);
    this.mpEl = document.createElement('div');
    this.mpEl.className = 'mpbar';
    this.mpEl.innerHTML = '<i></i><span></span>';
    document.body.appendChild(this.mpEl);
    this.paintBar();
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify({ ranks: this.ranks, slots: this.slots, awake: this.awake })); } catch { /* 무시 */ } this.onChange?.(); this.paintBar(); }

  // ───────── 포인트 · 배우기 ─────────
  lv(id: string) { return this.ranks[id] ?? 0; }
  /** 이 캐릭터의 기술 포인트(모험 등급 + 1) */
  spTotal(ar = this.c.ar()) { return ar + 1; }
  spUsed(ch: CharId) { return skillsOf(ch).reduce((a, s) => a + this.lv(s.id), 0); }
  spFree(ch: CharId) { return this.spTotal() - this.spUsed(ch); }
  why(id: string): string | null {
    const d = skillOf(id);
    if (!d) return '없는 기술';
    if (this.lv(id) >= MAX_LV) return '최대';
    if (this.c.ar() < TIER_AR[d.tier]) return `모험 등급 ${TIER_AR[d.tier]}`;
    if (d.tier > 0) { const up = skillsOf(d.char).find((s) => s.tree === d.tree && s.tier === d.tier - 1)!; if (!this.lv(up.id)) return `${up.name} 먼저`; }
    if (this.spFree(d.char) <= 0) return '기술 포인트 없음';
    return null;
  }
  learn(id: string) {
    if (this.why(id)) return false;
    const d = skillOf(id)!, first = !this.lv(id);
    this.ranks[id] = this.lv(id) + 1;
    // 처음 배운 쓰는 기술은 빈 칸에 올린다
    if (first && d.eff) { const s = this.slotsOf(d.char); const i = s.indexOf(null); if (i >= 0 && !s.includes(id)) { s[i] = id; this.slots[d.char] = s; } }
    this.save();
    this.c.learned?.(d, first);
    return true;
  }
  /** 각성 고르기(tier 0 = Lv5, 1 = Lv10) — 레벨이 닿았으면 언제든 바꾼다 */
  choose(id: string, tier: 0 | 1, pick: 0 | 1) {
    const d = skillOf(id);
    if (!d?.eff || this.lv(id) < (tier ? 10 : 5)) return false;
    const a = this.awake[id] ?? [null, null];
    a[tier] = pick;
    this.awake[id] = a;
    this.save();
    return true;
  }
  /** 이 기술에 이 각성이 켜졌나 */
  aw(d: SkillDef, key: string) {
    if (!d.eff) return false;
    const a = this.awake[d.id], opts = AWAKE[d.eff.k];
    return !!a && ((a[0] !== null && this.lv(d.id) >= 5 && opts[0][a[0]].id === key) || (a[1] !== null && this.lv(d.id) >= 10 && opts[1][a[1]].id === key));
  }
  /** 각성이 바꾼 모양 */
  effOf(d: SkillDef): Eff {
    const e = { ...d.eff! } as Eff & Record<string, number | boolean | string | undefined>;
    const on = (k: string) => this.aw(d, k);
    switch (e.k) {
      case 'bolt': if (on('split')) { e.n = (e.n ?? 1) + 2; e.spread = Math.max(e.spread ?? 0, 24); } if (on('big')) { e.boom = (e.boom ?? 0) + 1.5; e.pierce = true; } break;
      case 'nova': if (on('wide')) e.r *= 1.5; break;
      case 'cone': if (on('again')) e.hits = (e.hits ?? 1) + 1; if (on('wide')) e.deg += 60; break;
      case 'line': if (on('long')) e.len *= 1.5; break;
      case 'leap': if (on('wide')) e.r *= 1.6; break;
      case 'rain': if (on('more')) e.n = Math.round(e.n * 1.5); if (on('big')) e.r *= 1.4; break;
      case 'orbit': if (on('more')) e.n += 2; if (on('long')) e.secs *= 1.5; break;
      case 'chain': if (on('more')) e.jumps += 3; break;
      case 'turret': if (on('rapid')) e.every *= 0.66; break;
      case 'trap': if (on('more')) e.n = (e.n ?? 1) + 2; if (on('wide')) e.r *= 1.5; break;
      case 'zone': if (on('wide')) e.r *= 1.5; break;
      case 'aura': if (on('wide')) e.r *= 1.5; if (on('long')) e.secs *= 1.5; break;
      case 'buff': if (on('long')) e.secs *= 1.5; break;
    }
    return e;
  }
  slotsOf(ch: CharId): (string | null)[] { const s = this.slots[ch] ?? [null, null, null, null]; while (s.length < 4) s.push(null); return s.slice(0, 4); }
  bind(ch: CharId, i: number, id: string | null) {
    if (id && !skillOf(id)?.eff) return; // 익히는 기술은 칸에 올리지 않는다
    const s = this.slotsOf(ch).map((x) => (x === id ? null : x));
    s[i] = id;
    this.slots[ch] = s;
    this.save();
  }

  // ───────── 숫자 ─────────
  /** 피해 배율: 레벨마다 +15%, 같은 갈래의 다른 기술 레벨마다 +6%(시너지) */
  power(d: SkillDef, lv = this.lv(d.id)) {
    const syn = skillsOf(d.char).filter((s) => s.tree === d.tree && s.id !== d.id).reduce((a, s) => a + this.lv(s.id), 0);
    const aw = (this.aw(d, 'split') ? 0.75 : 1) * (this.aw(d, 'crit') ? 1.3 : 1);
    return (d.dmg ?? 0) * (1 + 0.15 * (lv - 1)) * (1 + 0.06 * syn) * aw;
  }
  synergy(d: SkillDef) { return skillsOf(d.char).filter((s) => s.tree === d.tree && s.id !== d.id).reduce((a, s) => a + this.lv(s.id), 0) * 6; }
  cost(d: SkillDef, lv = this.lv(d.id)) { return Math.round((d.cost ?? 0) * (1 + 0.04 * (lv - 1))); }
  /** 강화 값(레벨마다 +8%) */
  buffVal(d: SkillDef, lv: number, k: keyof Boost) { return (d.buff?.[k] ?? 0) * (1 + 0.08 * (lv - 1)) * (this.aw(d, 'strong') ? 1.5 : 1); }
  /** 지금 캐릭터의 익히는 기술 + 켜진 강화 */
  boost(): Required<Boost> {
    const o: Required<Boost> = { atk: 0, crit: 0, critDmg: 0, hp: 0, def: 0, aspd: 0, regen: 0, steal: 0, heal: 0 };
    for (const d of skillsOf(this.c.who())) { const lv = this.lv(d.id); if (!lv || !d.passive) continue; for (const k of Object.keys(d.passive) as (keyof Boost)[]) o[k] += (d.passive[k] ?? 0) * lv; }
    for (const b of this.buffs) for (const k of Object.keys(b.d.buff ?? {}) as (keyof Boost)[]) if (k !== 'heal') o[k] += this.buffVal(b.d, b.lv, k);
    return o;
  }
  get maxMp() { return Math.round(50 + this.c.ar() * 5); }

  // ───────── 쓰기 ─────────
  cast(slot: number) {
    const ch = this.c.who(), id = this.slotsOf(ch)[slot];
    if (!id) { this.c.hint(`${slot + 5}번 칸이 비었다 — 📜 기술(K)에서 배우고 올리자`); setTimeout(() => this.c.hint(''), 2200); return false; }
    const d = skillOf(id)!, lv = this.lv(id);
    if (!lv || !d.eff || !this.c.live()) return false;
    if ((this.cds.get(id) ?? 0) > this.clock) { this.bump(slot); return false; }
    const cost = this.cost(d, lv);
    if (this.mp < cost) { this.c.hint('🔷 마나가 모자라다'); setTimeout(() => this.c.hint(''), 1200); this.bump(slot); return false; }
    const big = d.tier === 3;
    if (!this.c.act(big)) return false;
    this.mp -= cost;
    this.cds.set(id, this.clock + (d.cd ?? 1) * (this.aw(d, 'cd') ? 0.7 : 1));
    this.casts++;
    const b = this.c.api.hero.body;
    this.c.api.float(b.x, b.y, b.z + 2.9, `${d.emoji} ${d.name}`, 'skname');
    this.after(big ? 0.3 : 0.16, () => this.fire(d, lv));
    this.paintBar();
    return true;
  }
  private bump(slot: number) { const e = this.el.children[slot] as HTMLElement | undefined; e?.classList.remove('no'); void e?.offsetWidth; e?.classList.add('no'); }
  private after(t: number, fn: () => void) { this.timed.push({ t, fn }); }

  private get b() { return this.c.api.hero.body; }
  private alive() { return this.c.api.foes().filter((f) => f.state !== 'dead'); }
  private nearest(max: number, from?: [number, number], skip?: Set<FoeLike>): FoeLike | null {
    const [x, y] = from ?? [this.b.x, this.b.y];
    let best: FoeLike | null = null, bd = max;
    for (const f of this.alive()) { if (skip?.has(f)) continue; const d = Math.hypot(f.x - x, f.y - y); if (d < bd && Math.abs(f.z - this.b.z) < 8) { bd = d; best = f; } }
    return best;
  }
  private aimAt(max: number) { const t = this.nearest(max); if (t) this.b.facing = bearing(t.x - this.b.x, t.y - this.b.y); return t; }
  /** 기술의 원소: 불태움 → 불 · 느려짐 → 얼음 · 중독 → 독 · 여행자의 번개(사슬 · 대폭풍) → 번개 · 그 밖엔 캐릭터 원소 */
  elemOf(d: SkillDef): Elem {
    if (d.status === 'burn') return 'fire';
    if (d.status === 'slow') return 'ice';
    if (d.status === 'poison') return 'toxic';
    if (d.char === 'traveler' && (d.eff?.k === 'chain' || (d.eff?.k === 'rain' && d.eff.tall))) return 'bolt';
    return CHAR_ELEM[d.char];
  }
  private color(d: SkillDef) { return d.status === 'burn' ? 0xff8a4a : d.status === 'poison' ? 0x7be36a : d.status === 'slow' ? 0x9fdcff : COLOR[d.char]; }
  /** 한 대 + 상태 */
  private hit(f: FoeLike, d: SkillDef, lv: number, mul = 1, from?: [number, number]) {
    if (f.state === 'dead') return;
    const A = this.c.api, p = this.power(d, lv) * mul;
    A.hit(f, A.atk() * p, 'skill', this.elemOf(d));
    const [ox, oy] = from ?? [this.b.x, this.b.y];
    switch (d.status) {
      case 'burn': case 'poison': this.dots.set(f, { kind: d.status, t: d.status === 'burn' ? 3 : 5, tick: 0.5, dmg: A.atk() * p * (d.status === 'burn' ? 0.2 : 0.18) }); break;
      case 'slow': this.c.api.slow(f, 2.5); break;
      case 'stun': A.stun(f, 1.3); break;
      case 'knock': A.push(f, f.x - ox, f.y - oy, 9); break;
      case 'pull': A.pull(f, ox, oy, 0.7); break;
      case 'drain': A.heal(0.01); break;
    }
    if (d.heal) A.heal(d.heal);
  }
  private circle(x: number, y: number, r: number, d: SkillDef, lv: number, mul = 1) {
    let n = 0;
    for (const f of this.alive()) if (Math.hypot(f.x - x, f.y - y) - (this.c.api.big(f) ? 2.4 : 0.4) <= r && Math.abs(f.z + f.lift - this.b.z) < 5) { this.hit(f, d, lv, mul, [x, y]); n++; }
    return n;
  }
  /** 원 안의 적 */
  private inside(x: number, y: number, r: number) { return this.alive().filter((f) => Math.hypot(f.x - x, f.y - y) - (this.c.api.big(f) ? 2.4 : 0.4) <= r && Math.abs(f.z + f.lift - this.b.z) < 5); }
  private ground(x: number, y: number) { return this.c.api.W().ground(x, y, this.b.z + 3, 8); }
  private mark(obj: THREE.Object3D) { this.c.api.group.add(obj); }
  private drop(obj: THREE.Object3D) {
    this.c.api.group.remove(obj);
    obj.traverse((q) => { const m = q as THREE.Mesh; m.geometry?.dispose(); const mat = m.material as THREE.Material | undefined; mat?.dispose?.(); });
  }
  private pillar(x: number, y: number, color: number, h: number, life: number, r = 0.7) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, h, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, h / 2), glow(color, 0.6));
    m.position.set(x, y, this.ground(x, y));
    this.c.api.fx(m, life, (o, t) => { ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t / life); });
    this.mark(m);
  }
  private disc(x: number, y: number, r: number, color: number, opacity = 0.35) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    m.position.set(x, y, this.ground(x, y) + 0.06);
    this.mark(m);
    return m;
  }
  private orb(color: number, size = 0.28) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshBasicMaterial({ color })));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(size * 2.2, 12, 10), glow(color, 0.3)));
    return g;
  }
  private dash(tx: number, ty: number) {
    const b = this.b, W = this.c.api.W();
    for (let i = 0; i < 10; i++) { const p = { x: b.x + (tx - b.x) / (10 - i), y: b.y + (ty - b.y) / (10 - i) }; W.collide(p, b.z, 0.3, 1.7, 0.5); b.x = p.x; b.y = p.y; }
    b.z = W.ground(b.x, b.y, b.z + 0.6, 1.5);
  }

  private fire(d: SkillDef, lv: number) {
    const A = this.c.api, b = this.b, e = this.effOf(d), col = this.color(d);
    const aw = (k: string) => this.aw(d, k);
    const snd = () => { if (d.status === 'burn') sfx.fire(); else if (d.status === 'slow') sfx.splash(); else if (d.char === 'quentin') sfx.bell(d.tier); else sfx.skillBlast(); };
    switch (e.k) {
      case 'bolt': {
        this.aimAt(e.range ?? 16);
        const n = e.n ?? 1, spread = e.spread ?? 0;
        for (let i = 0; i < n; i++) {
          const a = b.facing + (n === 1 ? 0 : spread >= 360 ? (i / n) * 360 : -spread / 2 + (spread * i) / (n - 1));
          const [dx, dy] = dirOf(a);
          const obj = this.orb(col, e.size ?? 0.22);
          obj.position.set(b.x + dx * 0.8, b.y + dy * 0.8, b.z + 1.2);
          this.mark(obj);
          this.shots.push({ x: obj.position.x, y: obj.position.y, z: obj.position.z, dx, dy, left: e.range ?? 16, range: e.range ?? 16, speed: e.speed ?? 24, d, lv, obj, hit: new Set(), pierce: !!e.pierce, boom: e.boom ?? 0 });
        }
        sfx.throwFrame();
        break;
      }
      case 'nova': {
        const t = e.at === 'target' ? this.aimAt(14) : null;
        const [x, y] = t ? [t.x, t.y] : [b.x, b.y];
        const go = () => {
          A.ring(x, y, this.ground(x, y) + 0.3, col, e.r);
          if (e.at === 'target') this.pillar(x, y, col, 8, 0.5, 1.2);
          for (const f of this.inside(x, y, e.r)) { this.hit(f, d, lv, 1, [x, y]); if (aw('weaken')) A.vuln(f, 6); }
          snd(); A.shake(e.r > 6 ? 0.3 : 0.15);
        };
        if (aw('implode')) { for (const f of this.inside(x, y, e.r * 1.6)) A.pull(f, x, y, 0.85); A.ring(x, y, this.ground(x, y) + 0.3, col, e.r * 1.6); this.after(0.25, go); } else go();
        if (aw('twice')) this.after(0.5, go);
        break;
      }
      case 'cone': {
        this.aimAt(e.r + 3);
        const hits = e.hits ?? 1;
        for (let h = 0; h < hits; h++) this.after(h * 0.14, () => {
          const a0 = ((90 - b.facing) * Math.PI) / 180, span = (e.deg * Math.PI) / 180;
          const m = new THREE.Mesh(new THREE.RingGeometry(0.6, e.r, 24, 1, a0 - span / 2, span), glow(col, 0.7));
          m.position.set(b.x, b.y, b.z + 1); m.rotation.x = h % 2 ? -0.25 : 0.25;
          A.fx(m, 0.22, (o, t) => { o.scale.setScalar(1 + t); ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t / 0.22); });
          this.mark(m);
          for (const f of this.alive()) { const dx = f.x - b.x, dy = f.y - b.y, dd = Math.hypot(dx, dy), size = A.big(f) ? 2.4 : 0.5; if (dd - size > e.r || Math.abs(f.z - b.z) > 4) continue; if (dd > size && Math.abs(angDiff(b.facing, bearing(dx, dy))) > e.deg / 2) continue; this.hit(f, d, lv, 1 / Math.sqrt(hits)); if (aw('mana')) this.mp = Math.min(this.maxMp, this.mp + 2); }
          sfx.whoosh(h % 3);
        });
        break;
      }
      case 'line': {
        this.aimAt(e.len);
        const [fx, fy] = dirOf(b.facing), x0 = b.x, y0 = b.y;
        let len = e.len;
        if (e.dash) { this.dash(b.x + fx * e.len, b.y + fy * e.len); len = Math.hypot(b.x - x0, b.y - y0); A.iframes(0.4); }
        const m = new THREE.Mesh(new THREE.BoxGeometry(e.w * 1.4, len, 0.15).translate(0, len / 2, 0), glow(col, 0.75));
        m.position.set(x0, y0, b.z + 0.8); m.rotation.z = (-b.facing * Math.PI) / 180;
        A.fx(m, 0.3, (o, t) => { ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - t / 0.3); o.scale.x = 1 - t / 0.3; });
        this.mark(m);
        const sweep = (sx: number, sy: number, ux: number, uy: number, mul: number) => { for (const f of this.alive()) { const rx = f.x - sx, ry = f.y - sy, along = rx * ux + ry * uy, side = Math.abs(rx * uy - ry * ux), size = A.big(f) ? 2.4 : 0.5; if (along < -0.8 || along > len + size || side > e.w + size || Math.abs(f.z - b.z) > 4) continue; this.hit(f, d, lv, mul, [sx, sy]); } };
        sweep(x0, y0, fx, fy, 1);
        const x1 = x0 + fx * len, y1 = y0 + fy * len;
        if (aw('trail')) for (let k = 1; k <= 3; k++) { const px = x0 + fx * len * (k / 4), py = y0 + fy * len * (k / 4); const zm = this.disc(px, py, 1.4, col, 0.4); this.zones.push({ d, lv, x: px, y: py, z: zm.position.z, t: 3, tick: 0, obj: zm, self: false, r: 1.4, mul: 0.25 }); }
        if (aw('return')) this.after(0.4, () => { sweep(x1, y1, -fx, -fy, 0.8); A.ring(x1, y1, b.z + 0.5, col, 1.5); sfx.whoosh(2); });
        if (aw('boom')) this.after(0.1, () => { A.ring(x1, y1, this.ground(x1, y1) + 0.3, col, 3); A.burst(x1, y1, b.z + 1, col); for (const f of this.inside(x1, y1, 3)) this.hit(f, d, lv, 1.2, [x1, y1]); sfx.fire(); });
        snd(); A.shake(0.18);
        break;
      }
      case 'leap': {
        const t = this.aimAt(e.range);
        const [fx, fy] = dirOf(b.facing);
        const [tx, ty] = t ? [t.x - fx * 0.8, t.y - fy * 0.8] : [b.x + fx * e.range * 0.6, b.y + fy * e.range * 0.6];
        this.dash(tx, ty); A.iframes(aw('guard') ? 1.5 : 0.5); sfx.blink();
        const land = () => { A.ring(b.x, b.y, b.z + 0.2, col, e.r); this.circle(b.x, b.y, e.r, d, lv); sfx.land(); A.shake(0.25); if (aw('quake')) for (const k of [1, 2]) this.after(k * 0.25, () => { A.ring(b.x, b.y, b.z + 0.2, col, e.r + k * 2); this.circle(b.x, b.y, e.r + k * 2, d, lv, 0.6); }); };
        this.after(0.08, land);
        if (aw('double')) this.after(0.55, () => { const n = this.nearest(e.range); if (n) { this.dash(n.x, n.y); sfx.blink(); this.after(0.08, land); } });
        break;
      }
      case 'rain': {
        for (let i = 0; i < e.n; i++) this.after(0.15 + i * e.every, () => {
          const fs = this.alive().filter((f) => Math.hypot(f.x - b.x, f.y - b.y) < e.area);
          const f = fs[Math.floor(Math.random() * fs.length)];
          const [x, y] = f ? [f.x + (Math.random() - 0.5), f.y + (Math.random() - 0.5)] : [b.x + (Math.random() - 0.5) * e.area, b.y + (Math.random() - 0.5) * e.area];
          this.pillar(x, y, col, e.tall ? 40 : 14, 0.3, e.tall ? 0.45 : 0.8);
          A.ring(x, y, this.ground(x, y) + 0.2, col, e.r);
          for (const f of this.inside(x, y, e.r)) { this.hit(f, d, lv, 1, [x, y]); if (aw('slowall')) A.slow(f, 2.5); }
          if (e.tall) sfx.meteor(); else sfx.splash();
        });
        if (aw('finale')) this.after(0.3 + e.n * e.every, () => { this.pillar(b.x, b.y, col, 50, 0.6, 2); A.ring(b.x, b.y, b.z + 0.2, col, e.r * 2.2); for (const f of this.inside(b.x, b.y, e.r * 2.2)) this.hit(f, d, lv, 3, [b.x, b.y]); A.shake(0.4); sfx.kill(true); });
        break;
      }
      case 'orbit': {
        const objs = Array.from({ length: e.n }, () => { const o = this.orb(col, 0.3); this.mark(o); return o; });
        this.orbits.push({ d, lv, t: 0, secs: e.secs, objs, last: new Map(), r: e.r });
        void aw;
        snd();
        break;
      }
      case 'chain': {
        let from: [number, number] = [b.x, b.y];
        const seen = new Set<FoeLike>();
        let f = this.aimAt(e.range);
        for (let j = 0; j < e.jumps && f; j++) {
          seen.add(f);
          const [x0, y0] = from, L = Math.hypot(f.x - x0, f.y - y0) || 0.1;
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, L, 0.12).translate(0, L / 2, 0), glow(col === COLOR.traveler ? 0xfff27a : col, 0.9));
          m.position.set(x0, y0, b.z + 1.1); m.rotation.z = -Math.atan2(f.x - x0, f.y - y0);
          A.fx(m, 0.25, (o, t) => { ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t / 0.25); });
          this.mark(m);
          this.hit(f, d, lv, Math.pow(aw('grow') ? 1.15 : 0.9, j), from);
          if (j === 0 && aw('fork')) { const g2 = this.nearest(e.range, [f.x, f.y], new Set([...seen])); if (g2) { seen.add(g2); this.hit(g2, d, lv, 0.9, [f.x, f.y]); A.ring(g2.x, g2.y, b.z + 1, col, 1); } }
          from = [f.x, f.y];
          const last = f;
          f = this.nearest(e.range, from, seen);
          if (!f && aw('boom')) { A.ring(last.x, last.y, b.z + 0.5, col, 3); A.burst(last.x, last.y, b.z + 1, col); for (const q of this.inside(last.x, last.y, 3)) this.hit(q, d, lv, 1.5, [last.x, last.y]); }
        }
        sfx.flash();
        break;
      }
      case 'turret': {
        const [fx, fy] = dirOf(b.facing + 140);
        const x = b.x + fx * 1.6, y = b.y + fy * 1.6, z = this.ground(x, y);
        const g = new THREE.Group();
        g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.1, 10).rotateX(Math.PI / 2).translate(0, 0, 0.55), new THREE.MeshToonMaterial({ color: COLOR[d.char] })));
        const head = this.orb(col, 0.25); head.position.z = 1.3; g.add(head);
        g.position.set(x, y, z);
        this.mark(g);
        this.turrets.push({ d, lv, x, y, z, t: 0, secs: e.secs, fire: 0.3, obj: g, every: e.every, range: e.range, n: e.n ?? 1 });
        if (aw('two')) { const [gx, gy] = dirOf(b.facing - 140); const x2 = b.x + gx * 1.6, y2 = b.y + gy * 1.6, z2 = this.ground(x2, y2); const g2 = g.clone(); g2.position.set(x2, y2, z2); this.mark(g2); this.turrets.push({ d, lv, x: x2, y: y2, z: z2, t: 0, secs: e.secs, fire: 0.5, obj: g2, every: e.every, range: e.range, n: e.n ?? 1 }); }
        sfx.shield();
        break;
      }
      case 'trap': {
        const n = e.n ?? 1, [fx, fy] = dirOf(b.facing);
        for (let i = 0; i < n; i++) {
          const x = b.x + fx * (2.5 + i * 2) + (i - (n - 1) / 2) * fy * 1.5, y = b.y + fy * (2.5 + i * 2) - (i - (n - 1) / 2) * fx * 1.5;
          const m = this.disc(x, y, 0.8, col, 0.6);
          this.traps.push({ d, lv, x, y, z: m.position.z, t: e.secs, obj: m, r: e.r });
        }
        sfx.grab();
        break;
      }
      case 'zone': {
        const t = e.at === 'target' ? this.aimAt(12) : null;
        const [fx, fy] = dirOf(b.facing);
        const [x, y] = t ? [t.x, t.y] : e.at === 'target' ? [b.x + fx * 5, b.y + fy * 5] : [b.x, b.y];
        const m = this.disc(x, y, e.r, col, 0.4);
        this.zones.push({ d, lv, x, y, z: m.position.z, t: e.secs, tick: 0, obj: m, self: aw('follow'), r: e.r, mul: 1 });
        snd();
        break;
      }
      case 'aura': {
        const m = this.disc(b.x, b.y, Math.max(1, e.r), col, 0.22);
        this.zones.push({ d, lv, x: b.x, y: b.y, z: m.position.z, t: e.secs, tick: 0, obj: m, self: true, r: e.r, mul: 1 });
        snd();
        break;
      }
      case 'buff': {
        if (d.buff?.heal) { A.heal(this.buffVal(d, lv, 'heal')); A.float(b.x, b.y, b.z + 2.4, `+${Math.round(this.buffVal(d, lv, 'heal') * 100)}%`, 'heal'); }
        if (e.secs > 0.2) { this.buffs = this.buffs.filter((q) => q.d !== d); this.buffs.push({ d, lv, t: this.clock + e.secs }); }
        A.ring(b.x, b.y, b.z + 0.2, col, 2.2); A.ring(b.x, b.y, b.z + 1.6, col, 1.6);
        if (aw('shock')) { A.ring(b.x, b.y, b.z + 0.4, col, 5); for (const f of this.inside(b.x, b.y, 5)) { A.hit(f, A.atk() * 1.5, 'skill', this.elemOf(d)); A.push(f, f.x - b.x, f.y - b.y, 9); } A.shake(0.25); }
        sfx.questStart();
        break;
      }
    }
  }

  // ───────── 매 프레임 ─────────
  private frameRef: unknown = null;
  update(dt: number, live: boolean) {
    if (this.frameRef !== this.c.api.hero.frame) { this.frameRef = this.c.api.hero.frame; this.clear(); } // 원점이 바뀌면 비운다
    this.clock += dt;
    const boost = this.boost();
    this.mp = Math.min(this.maxMp, this.mp + dt * 4 * (1 + boost.regen));
    this.buffs = this.buffs.filter((q) => q.t > this.clock);
    for (const e of this.timed.slice()) { e.t -= dt; if (e.t <= 0) { this.timed.splice(this.timed.indexOf(e), 1); if (live) e.fn(); } }
    const A = this.c.api, b = this.b;
    // 화살
    for (const s of this.shots.slice()) {
      // 빠른 화살은 한 프레임에 몇 m씩 간다 — 0.5 m씩 나눠 가며 본다(가까운 적을 건너뛰지 않게)
      const total = s.speed * dt, parts = Math.max(1, Math.ceil(total / 0.5));
      let end = false;
      for (let q = 0; q < parts && !end; q++) {
      const step = total / parts;
      s.x += s.dx * step; s.y += s.dy * step; s.left -= step;
      if (s.left <= 0) end = true;
      for (const f of this.alive()) {
        if (s.hit.has(f)) continue;
        if (Math.hypot(f.x - s.x, f.y - s.y) < (A.big(f) ? 2.6 : 1) && Math.abs(f.z + f.lift + 0.8 - s.z) < (A.big(f) ? 4 : 2)) {
          s.hit.add(f);
          if (s.boom) { A.ring(s.x, s.y, s.z - 0.8, this.color(s.d), s.boom); A.burst(s.x, s.y, s.z, this.color(s.d)); this.circle(s.x, s.y, s.boom, s.d, s.lv, s.mul ?? 1); sfx.fire(); if (!s.pierce) { end = true; break; } continue; }
          this.hit(f, s.d, s.lv, s.mul ?? 1);
          if (s.slow) A.slow(f, 2.5);
          if (!s.shard && this.aw(s.d, 'shards')) for (let k = 0; k < 3; k++) { const [ux, uy] = dirOf(Math.random() * 360); const o = this.orb(this.color(s.d), 0.12); o.position.set(s.x, s.y, s.z); this.mark(o); this.shots.push({ x: s.x, y: s.y, z: s.z, dx: ux, dy: uy, left: 6, speed: 20, d: s.d, lv: s.lv, obj: o, hit: new Set([f]), pierce: false, boom: 0, shard: true, mul: 0.4 }); }
          if (!s.pierce) { end = true; break; }
        }
      }
      }
      s.obj.position.set(s.x, s.y, s.z);
      if (end && s.left <= 0 && !s.back && !s.shard && this.aw(s.d, 'return')) { s.back = true; s.dx = -s.dx; s.dy = -s.dy; s.left = s.range ?? 16; s.hit.clear(); end = false; }
      if (end) { this.drop(s.obj); this.shots.splice(this.shots.indexOf(s), 1); }
    }
    // 궤도
    for (const o of this.orbits.slice()) {
      o.t += dt;
      o.objs.forEach((obj, i) => { const a = o.t * 4 + (i / o.objs.length) * Math.PI * 2; obj.position.set(b.x + Math.cos(a) * o.r, b.y + Math.sin(a) * o.r, b.z + 1.1); });
      for (const obj of o.objs) for (const f of this.alive()) {
        if (Math.hypot(f.x - obj.position.x, f.y - obj.position.y) < (A.big(f) ? 2.4 : 1) && (o.last.get(f) ?? -9) < this.clock - 0.4) { o.last.set(f, this.clock); this.hit(f, o.d, o.lv, 1, [b.x, b.y]); if (this.aw(o.d, 'mana')) this.mp = Math.min(this.maxMp, this.mp + 1); }
      }
      if (o.t > o.secs) {
        if (this.aw(o.d, 'burst')) for (const obj of o.objs) { const [ux, uy] = [obj.position.x - b.x, obj.position.y - b.y]; const L = Math.hypot(ux, uy) || 1; const q = this.orb(this.color(o.d), 0.26); q.position.copy(obj.position); this.mark(q); this.shots.push({ x: q.position.x, y: q.position.y, z: q.position.z, dx: ux / L, dy: uy / L, left: 12, speed: 22, d: o.d, lv: o.lv, obj: q, hit: new Set(), pierce: true, boom: 0, mul: 1.2 }); }
        for (const obj of o.objs) this.drop(obj); this.orbits.splice(this.orbits.indexOf(o), 1);
      }
    }
    // 포탑
    for (const T of this.turrets.slice()) {
      T.t += dt; T.fire -= dt;
      T.obj.children[1].position.z = 1.3 + Math.sin(T.t * 4) * 0.1;
      if (T.fire <= 0) {
        T.fire = T.every;
        const f = this.nearest(T.range, [T.x, T.y]);
        if (f) for (let i = 0; i < T.n; i++) {
          const a = bearing(f.x - T.x, f.y - T.y) + (i - (T.n - 1) / 2) * 8, [dx, dy] = dirOf(a);
          const obj = this.orb(this.color(T.d), 0.16); obj.position.set(T.x, T.y, T.z + 1.3); this.mark(obj);
          this.shots.push({ x: T.x, y: T.y, z: T.z + 1.3, dx, dy, left: T.range + 2, speed: 26, d: T.d, lv: T.lv, obj, hit: new Set(), pierce: false, boom: 0, shard: true, slow: this.aw(T.d, 'chill') });
        }
      }
      if (T.t > T.secs) { if (this.aw(T.d, 'boom')) { A.ring(T.x, T.y, T.z + 0.3, this.color(T.d), 4); A.burst(T.x, T.y, T.z + 1, this.color(T.d)); this.circle(T.x, T.y, 4, T.d, T.lv, 2); sfx.kill(true); } this.drop(T.obj); this.turrets.splice(this.turrets.indexOf(T), 1); }
    }
    // 덫
    for (const t of this.traps.slice()) {
      t.t -= dt;
      const r = t.r;
      const tripped = t.t > 900 || this.alive().some((f) => Math.hypot(f.x - t.x, f.y - t.y) < 1.4);
      if (tripped || t.t <= 0) {
        if (tripped && this.aw(t.d, 'pull')) for (const f of this.inside(t.x, t.y, r * 1.6)) A.pull(f, t.x, t.y, 0.8);
        if (tripped && this.aw(t.d, 'chain')) for (const q of this.traps) if (q !== t && Math.hypot(q.x - t.x, q.y - t.y) < 6 && q.t < 900) q.t = 999;
        if (tripped) { A.ring(t.x, t.y, t.z + 0.2, this.color(t.d), r); A.burst(t.x, t.y, t.z + 0.8, this.color(t.d)); this.circle(t.x, t.y, r, t.d, t.lv); sfx.fire(); A.shake(0.15); }
        this.drop(t.obj); this.traps.splice(this.traps.indexOf(t), 1);
      }
    }
    // 불길 · 오라
    for (const z of this.zones.slice()) {
      z.t -= dt; z.tick -= dt;
      if (z.self) { z.x = b.x; z.y = b.y; z.obj.position.set(b.x, b.y, this.ground(b.x, b.y) + 0.06); }
      (z.obj as THREE.Mesh).rotation.z += dt;
      if (z.tick <= 0) {
        z.tick = 0.5;
        const r = z.r;
        if (z.d.dmg) this.circle(z.x, z.y, r, z.d, z.lv, z.mul);
        else if (z.d.heal) A.heal(z.d.heal * (1 + 0.08 * (z.lv - 1)));
        if (this.aw(z.d, 'heal') && Math.hypot(b.x - z.x, b.y - z.y) < r) A.heal(0.02);
        if (this.aw(z.d, 'mana')) this.mp = Math.min(this.maxMp, this.mp + 1);
      }
      if (z.t <= 0) { if (z.mul === 1 && this.aw(z.d, 'boom')) { const R = z.r * 1.2 + (z.d.eff?.k === 'aura' ? 2 : 0); A.ring(z.x, z.y, z.z + 0.3, this.color(z.d), R); A.burst(z.x, z.y, z.z + 1, this.color(z.d)); for (const f of this.inside(z.x, z.y, R)) this.hit(f, z.d, z.lv, z.d.eff?.k === 'aura' ? 2.5 : 2, [z.x, z.y]); sfx.kill(true); A.shake(0.3); } this.drop(z.obj); this.zones.splice(this.zones.indexOf(z), 1); }
    }
    // 불태움 · 독
    for (const [f, s] of this.dots) {
      if (f.state === 'dead') { this.dots.delete(f); continue; }
      s.t -= dt; s.tick -= dt;
      if (s.tick <= 0) { s.tick = 0.5; A.hit(f, s.dmg, 'burst', null); }
      if (s.t <= 0) this.dots.delete(f);
    }
    this.paintTick -= dt;
    if (this.paintTick <= 0) { this.paintTick = 0.1; this.paintCd(); }
  }
  private paintTick = 0;

  /** 비운다(원점이 바뀌거나 비경) */
  clear() {
    for (const s of this.shots) this.drop(s.obj);
    for (const o of this.orbits) for (const obj of o.objs) this.drop(obj);
    for (const t of this.turrets) this.drop(t.obj);
    for (const t of this.traps) this.drop(t.obj);
    for (const z of this.zones) this.drop(z.obj);
    this.shots = []; this.orbits = []; this.turrets = []; this.traps = []; this.zones = []; this.timed = []; this.dots.clear();
  }

  // ───────── 화면: 기술 칸(5·6·7·8) · 마나 ─────────
  onCast?: (slot: number) => void;
  paintBar() {
    const ch = this.c.who(), s = this.slotsOf(ch);
    this.el.innerHTML = s.map((id, i) => {
      const d = id ? skillOf(id) : null;
      return `<button type="button" data-slot="${i}" class="${d ? '' : 'empty'}" title="${d ? `${d.name} Lv.${this.lv(d.id)} · 🔷${this.cost(d)}` : '빈 칸 — 📜 기술(K)'}"><em>${d?.emoji ?? '＋'}</em><kbd>${i + 5}</kbd><i></i></button>`;
    }).join('');
    this.el.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => btn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.onCast?.(Number(btn.dataset.slot)); }));
    this.el.classList.toggle('on', s.some((x) => x));
    this.layoutTouch();
    this.paintCd();
  }
  /** 휴대폰: 공격 단추(⚔️)를 둘러싼 호 위에 네 칸을 놓는다(원신처럼) — E · Q · 달리기 단추와 겹치지 않는 각도 */
  layoutTouch() {
    const touch = document.body.classList.contains('touch-play');
    const atk = document.querySelector('.cbt .atk') as HTMLElement | null;
    const btns = [...this.el.querySelectorAll<HTMLElement>('button')];
    if (!touch || !atk || !atk.getBoundingClientRect().width) { for (const b of btns) { b.style.left = ''; b.style.top = ''; } this.el.classList.remove('arc'); return; }
    const r = atk.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const R = Math.max(170, r.width * 2.2);
    this.el.classList.add('arc');
    btns.forEach((b, i) => {
      const ang = ([190, 160, 130, 105][i] * Math.PI) / 180; // 왼쪽 아래(190°)에서 위(105°)로 — 행동 안내(F)와 E·Q를 비켜 간다
      const w = b.offsetWidth || 42;
      b.style.left = `${Math.round(cx + Math.cos(ang) * R - w / 2)}px`;
      b.style.top = `${Math.round(cy - Math.sin(ang) * R - w / 2)}px`;
    });
  }
  private paintCd() {
    const ch = this.c.who(), s = this.slotsOf(ch);
    s.forEach((id, i) => {
      const btn = this.el.children[i] as HTMLElement | undefined; if (!btn || !id) return;
      const d = skillOf(id)!, left = Math.max(0, (this.cds.get(id) ?? 0) - this.clock);
      (btn.querySelector('i') as HTMLElement).style.setProperty('--p', `${Math.min(1, left / (d.cd ?? 1)) * 100}%`);
      btn.classList.toggle('dry', this.mp < this.cost(d));
    });
    const m = this.mpEl.querySelector('i') as HTMLElement;
    m.style.width = `${(this.mp / this.maxMp) * 100}%`;
    this.mpEl.querySelector('span')!.textContent = `🔷 ${Math.floor(this.mp)} / ${this.maxMp}`;
  }
  show(on: boolean) { this.el.style.display = on ? '' : 'none'; this.mpEl.style.display = on ? '' : 'none'; }
}
