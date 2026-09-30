// 🔥💧❄️⚡ 원소 반응(원신처럼): 맞힌 원소가 적에게 남고(오라, 5초), 다른 원소로 치면 반응이 터진다.
// 캐릭터마다 원소가 다르고, 기술은 상태 이상에 따라 원소가 바뀐다(불태움 → 불, 느려짐 → 얼음, 중독 → 독, 번개 사슬 → 번개).
// 바람 · 대지 · 소리는 오라를 남기지 않고 남은 오라를 터뜨리기만 한다(확산 · 결정화 · 공명).
// 정예 몬스터의 옷(접두어)도 여기 — 빠른 · 단단한 · 불타는 · 흡혈하는 · 분열하는 · 폭발하는 · ○의 방패.

export type Elem = 'wind' | 'water' | 'earth' | 'fire' | 'light' | 'sound' | 'toxic' | 'moon' | 'ice' | 'bolt';
export const ELEM: Record<Elem, { name: string; emoji: string; color: number }> = {
  wind: { name: '바람', emoji: '🌬', color: 0x9ff3e0 },
  water: { name: '물', emoji: '💧', color: 0x6fc3ff },
  earth: { name: '강철', emoji: '⚙️', color: 0xd9b44a },
  fire: { name: '불', emoji: '🔥', color: 0xff8a4a },
  light: { name: '빛', emoji: '✨', color: 0xffe28a },
  sound: { name: '소리', emoji: '🔔', color: 0xd8b0ff },
  toxic: { name: '독', emoji: '☠️', color: 0x7be36a },
  moon: { name: '달빛', emoji: '🌙', color: 0xb79bff },
  ice: { name: '얼음', emoji: '❄️', color: 0x9fdcff },
  bolt: { name: '번개', emoji: '⚡', color: 0xfff27a },
};
/** 적에게 남는 원소(오라) */
export const AURA = new Set<Elem>(['water', 'fire', 'light', 'toxic', 'moon', 'ice', 'bolt']);
/** 캐릭터의 원소 */
export const CHAR_ELEM: Record<string, Elem> = { traveler: 'wind', julie: 'water', gustave: 'earth', marcel: 'fire', amelie: 'light', quentin: 'sound', elodie: 'toxic', lune: 'moon' };

export type Effect = 'none' | 'freeze' | 'arc' | 'blast' | 'vuln' | 'spread' | 'crystal' | 'stun';
export interface Reaction { name: string; mul: number; effect: Effect; color: number }
const R = (name: string, mul: number, effect: Effect, color: number): Reaction => ({ name, mul, effect, color });
const pair = (a: Elem, b: Elem) => [a, b].sort().join('+');
const TABLE: Record<string, Reaction> = {
  [pair('fire', 'water')]: R('증발', 1.8, 'none', 0xffffff),
  [pair('fire', 'ice')]: R('녹음', 2.0, 'none', 0xffb070),
  [pair('water', 'ice')]: R('빙결', 1.1, 'freeze', 0x9fdcff),
  [pair('bolt', 'water')]: R('감전', 1.2, 'arc', 0xc9a5ff),
  [pair('bolt', 'fire')]: R('과부하', 1.3, 'blast', 0xff6f9a),
  [pair('bolt', 'ice')]: R('초전도', 1.1, 'vuln', 0xb8c8ff),
  [pair('toxic', 'fire')]: R('점화 폭발', 1.5, 'blast', 0xc6ff4a),
  [pair('toxic', 'water')]: R('번짐', 1.2, 'spread', 0x7be36a),
  [pair('light', 'moon')]: R('일식', 2.5, 'stun', 0xfff3b0),
  [pair('light', 'toxic')]: R('정화', 1.6, 'none', 0xfff3b0),
  [pair('moon', 'water')]: R('밀물', 1.5, 'freeze', 0x8fb0ff),
  [pair('moon', 'fire')]: R('푸른 불꽃', 1.7, 'none', 0x8f9bff),
};
/** 오라(aura)가 남은 적을 incoming으로 쳤을 때의 반응(없으면 null) */
export function react(aura: Elem, incoming: Elem): Reaction | null {
  if (aura === incoming) return null;
  if (incoming === 'wind') return R('확산', 1.2, 'spread', ELEM[aura].color);
  if (incoming === 'earth') return R('결정화', 1.2, 'crystal', 0xffd98a);
  if (incoming === 'sound') return R('공명', 1.5, 'stun', 0xd8b0ff);
  return TABLE[pair(aura, incoming)] ?? null;
}

// ───────── 정예의 접두어 ─────────
export type Affix = 'fast' | 'armored' | 'burning' | 'vampiric' | 'splitting' | 'volatile' | 'ward';
export const AFFIX: Record<Affix, { name: string; what: string }> = {
  fast: { name: '빠른', what: '움직임 1.5배' },
  armored: { name: '단단한', what: '받는 피해 −50% — 원소 반응으로 갑옷을 깬다' },
  burning: { name: '불타는', what: '맞으면 몸에 불이 붙는다' },
  vampiric: { name: '흡혈하는', what: '때릴 때마다 체력을 되찾는다' },
  splitting: { name: '분열하는', what: '쓰러지면 작은 둘로 갈라진다' },
  volatile: { name: '폭발하는', what: '쓰러지면 1초 뒤 터진다 — 빨간 원에서 벗어나자' },
  ward: { name: '방패', what: '한 원소에 거의 다치지 않는다 — 다른 원소로' },
};
export const AFFIX_POOL: Affix[] = ['fast', 'armored', 'burning', 'vampiric', 'splitting', 'volatile', 'ward'];
