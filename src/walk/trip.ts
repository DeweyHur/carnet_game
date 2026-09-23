// 여행 준비물: 몸 상태(허기·지침)와 표.
// 요금은 2026년 Île-de-France 기준. 낱장은 수단별로 따로 사야 하고,
// Navigo Liberté+만 버스↔지하철 환승이 되고 회당 값도 싸다.
import type { Mode } from './districts';

export const SINGLE: Record<Mode, number> = { metro: 2.55, bus: 2.05 };
export const LIBERTE: Record<Mode, number> = { metro: 2.04, bus: 1.64 };
export const LIBERTE_CARD = 2; // Navigo Easy 카드값(한 번)
export const AIRPORT_TICKET = 14; // 공항↔파리 1회권
/** 공항 택시 정액 — 우안 56, 좌안 65 (2026) */
export const TAXI_FLAT = { right: 56, left: 65 };

export type Pass = 'single' | 'liberte';

/** 이 여정에 드는 돈. 낱장은 수단마다 한 장씩, Liberté+는 한 번만 (환승이 되니까). */
export function fareFor(modes: Mode[], pass: Pass): number {
  if (!modes.length) return 0;
  const table = pass === 'liberte' ? LIBERTE : SINGLE;
  const cost = pass === 'liberte' ? Math.max(...modes.map((m) => table[m])) : modes.reduce((n, m) => n + table[m], 0);
  return Math.round(cost * 100) / 100;
}

// ───────── 몸 상태 ─────────
// 0이 멀쩡하고 100이 한계. 막지는 않는다 — 걷는 속도와 눈에 들어오는 범위가 줄고, 말투가 바뀐다.
export interface Body { hunger: number; tired: number }

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** 시간이 흐르고 걸은 만큼 쌓인다 */
export function drain(b: Body, mins: number, metres: number) {
  b.hunger = clamp(b.hunger + mins * 0.11);
  b.tired = clamp(b.tired + mins * 0.02 + (metres / 100) * 0.75);
}
export function eat(b: Body, amount: number, sat = 0) {
  b.hunger = clamp(b.hunger - amount);
  b.tired = clamp(b.tired - sat);
}
export function rest(b: Body, amount: number) {
  b.tired = clamp(b.tired - amount);
}

/** 지치면 느려진다(최대 30%) */
export const paceFactor = (b: Body) => 1 - 0.3 * (b.tired / 100);
/** 배고프면 주변이 덜 눈에 들어온다(최대 25%) */
export const sightFactor = (b: Body) => 1 - 0.25 * (b.hunger / 100);

const LEVELS: [number, string][] = [[80, 'bad'], [55, 'warn'], [0, 'ok']];
export const level = (n: number) => LEVELS.find(([t]) => n >= t)![1];

export function bodyLine(b: Body): string {
  if (b.hunger >= 80 && b.tired >= 80) return '배가 고프고 다리가 무겁다. 어디든 앉아서 뭘 좀 먹는 게 낫겠다.';
  if (b.hunger >= 80) return '배가 몹시 고프다. 눈에 들어오는 건 죄다 먹는 것뿐이다.';
  if (b.tired >= 80) return '다리가 무겁다. 계단이 유난히 높아 보인다.';
  if (b.hunger >= 55) return '슬슬 배가 고프다.';
  if (b.tired >= 55) return '조금 지쳤다. 벤치나 카페가 반갑다.';
  return '';
}
