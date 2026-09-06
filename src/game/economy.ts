import type { City, Currency, Food, VenueTier } from './types';

/** 예시 환율(EUR 기준). 실서비스는 ECB 일별 기준환율 + frankfurter로 갱신. (기획서 §3.3) */
export const FX_EUR: Record<Currency, number> = { EUR: 1, KRW: 1520, GBP: 0.85, CHF: 0.94 };
export const FX_DATE = '2026-09-08 (예시)';

export const CURRENCY_META: Record<Currency, { symbol: string; name: string; digits: number }> = {
  EUR: { symbol: '€', name: '유로', digits: 2 },
  KRW: { symbol: '₩', name: '원', digits: 0 },
  GBP: { symbol: '£', name: '파운드', digits: 2 },
  CHF: { symbol: 'CHF ', name: '스위스 프랑', digits: 2 },
};

export function fmt(amount: number, cur: Currency): string {
  const m = CURRENCY_META[cur];
  const n = m.digits === 0 ? Math.round(amount).toLocaleString('ko-KR') : amount.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${m.symbol}${n}`;
}

/** EUR 금액을 다른 통화로 (기준환율) */
export const eurTo = (eur: number, cur: Currency) => eur * FX_EUR[cur];
export const toEur = (amount: number, cur: Currency) => amount / FX_EUR[cur];
/** from 통화 금액을 to 통화로 (기준환율, EUR을 거쳐 계산) */
export const convert = (amount: number, from: Currency, to: Currency) => eurTo(toEur(amount, from), to);
/** 도시가 실제로 쓰는 통화. 없으면 EUR(유로존 프랑스 도시 기본값). */
export const cityCurrency = (city: City): Currency => city.currency ?? 'EUR';

/** 환전 경로 5종과 스프레드 (기획서 §3.3) */
export type FxChannel = 'airport' | 'city' | 'bank' | 'atm';
export const FX_CHANNELS: Record<FxChannel, { name: string; spread: number; fixedEur: number; tip: string }> = {
  airport: { name: '공항 환전소', spread: 0.07, fixedEur: 0, tip: '편하지만 5~10%가 사라진다. 급할 때 소액만.' },
  city: { name: '시내 환전소', spread: 0.025, fixedEur: 0, tip: '1~4%. 간판의 "수수료 0%"는 환율에 이미 녹아 있다.' },
  bank: { name: '은행 창구', spread: 0.025, fixedEur: 0, tip: '2~3%. 영업시간이 짧고 계좌가 필요할 때가 있다.' },
  atm: { name: 'ATM 인출', spread: 0.005, fixedEur: 5, tip: '정액 수수료 + 환율. 한 번에 많이 뽑을수록 유리. DCC(자국 통화 결제) 제안은 거절할 것.' },
};

export const CARD_FEE = 0.015; // 해외 카드 결제 수수료 1.5%

/** from 통화 amount를 to 통화로 바꿨을 때 받는 금액 */
export function quote(amount: number, from: Currency, to: Currency, ch: FxChannel): { receive: number; mid: number; lost: number } {
  const midEur = toEur(amount, from);
  const mid = eurTo(midEur, to);
  const c = FX_CHANNELS[ch];
  const afterSpread = midEur * (1 - c.spread) - c.fixedEur;
  const receive = Math.max(0, eurTo(afterSpread, to));
  return { receive, mid, lost: mid - receive };
}

const VENUE_COEF: Record<VenueTier, number> = { market: 0.8, shop: 1.0, bistro: 1.0, restaurant: 1.15 };
export const VENUE_NAME: Record<VenueTier, string> = { market: '시장·노점', shop: '상점·빵집', bistro: '비스트로', restaurant: '레스토랑' };

/** 실제 가격 = 파리 기준가 × 도시 물가지수 × 판매처 계수 */
export function foodPrice(food: Food, city: City): number {
  return Math.round(food.baseEur * city.priceIndex * VENUE_COEF[food.venue] * 10) / 10;
}

/** '내 커피 한 잔' 지표: 자국 도시 카페 가격 대비 배율 (서울 아메리카노 ≈ ₩4,500 예시) */
export const HOME_COFFEE_KRW = 4500;
export function coffeeIndex(city: City): number {
  const cafe = city.foods.find((f) => f.id === 'cafe');
  const amount = cafe ? foodPrice(cafe, city) : 3.5 * city.priceIndex;
  return convert(amount, cityCurrency(city), 'KRW') / HOME_COFFEE_KRW;
}

export type Grade = 'S' | 'A' | 'B' | 'C';
export function gradeArticle(collected: number, total: number, wrong: number): { grade: Grade; ratio: number; mult: number } {
  const ratio = total === 0 ? 1 : collected / total;
  const accuracy = Math.max(0, 1 - wrong * 0.15);
  const score = ratio * accuracy;
  const grade: Grade = score >= 0.95 ? 'S' : score >= 0.75 ? 'A' : score >= 0.5 ? 'B' : 'C';
  const mult = { S: 1.35, A: 1.1, B: 0.9, C: 0.6 }[grade];
  return { grade, ratio, mult };
}
