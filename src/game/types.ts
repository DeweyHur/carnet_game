import type { Expression } from './expression';

// ─── 카르네(Carnet) 핵심 데이터 타입 ─────────────────────────────────────────
// 기획서 4장 "도시 데이터 스키마"를 프로토타입 규모로 축약한 것.

export type Tier = 'S' | 'A' | 'B' | 'H';
export type RegionId = 'idf' | 'nord' | 'centre' | 'border';
export type Currency = 'EUR' | 'KRW' | 'GBP' | 'CHF';

export interface Source {
  id: string;
  title: string;
  url: string;
  license: string;
}

export interface Poi {
  id: string;
  name: string;
  type: string; // cathedral, museum, market, ...
  feeEur: number; // 이 도시 통화 기준 실제 입장료(City.currency)
  /** 0=일 1=월 … 6=토. 비어 있으면 연중무휴 */
  closedDays?: number[];
  hours?: string; // 표시용 "09:00-18:00"
  note?: string;
  sourceId?: string;
  /** [lon, lat] — 도시 내부 지도에서의 실제 위치. 없으면 도시 중심 부근에 표시. */
  coord?: [number, number];
  /** 실제 사진이 생기면 그림 대신 쓰인다 (public/ 경로 또는 URL) */
  imageUrl?: string;
}

export type VenueTier = 'market' | 'bistro' | 'restaurant' | 'shop';

export interface Food {
  id: string;
  name: string;
  nameLocal: string;
  /** 이 도시 통화 기준 상품 기준가. 실제 가격 = base × 도시 물가지수 × 판매처 계수 */
  baseEur: number;
  venue: VenueTier;
  stamina: number; // 회복량
  origin: string; // 기원 이야기(한 문장)
  sourceId: string;
  /** 실제 사진이 생기면 그림 대신 쓰인다 */
  imageUrl?: string;
}

/** 안내인 초상의 생김새. 없으면 이름 해시로 자동 생성된다. */
export type HairStyle = 'short' | 'bob' | 'messy' | 'updo' | 'beret' | 'cap' | 'veil';

export interface GuideLook {
  style: HairStyle;
  hair: string;
  skin: string;
  glasses?: boolean;
  /** 목에 두른 스카프 색 */
  scarf?: string;
  /** 목에 건 카메라 */
  camera?: boolean;
  stubble?: boolean;
  /** 모자·베레 색 (기본값은 안내인 색) */
  hat?: string;
}

export interface Guide {
  name: string;
  archetype: string;
  intro: string;
  color: string; // 아바타 배경색
  /** 이 도시 안내인의 기본 표정 */
  mood?: Expression;
  /** 생김새 — 직업·나이에 맞춰 도시 데이터가 정한다 */
  look?: GuideLook;
}

export interface City {
  id: string;
  tier: Tier;
  region: RegionId;
  country: string;
  names: { ko: string; fr: string; en: string };
  /** [lon, lat] — MapLibre 순서 */
  coord: [number, number];
  population: number;
  priceIndex: number; // 파리=1.00
  /** 이 도시에서 실제로 쓰는 통화. 없으면 EUR(유로존 프랑스 도시 기본값). */
  currency?: Currency;
  heritage?: string[];
  blurb: string;
  guide: Guide;
  pois: Poi[];
  foods: Food[];
  missionIds: string[];
  hostelEur: number; // 1박 기준(이 도시 통화)
  /** 도시 내 1회권 요금(이 도시 통화). 없으면 €2.50 상당. */
  transitFareEur?: number;
}

export type Mode = 'metro' | 'rer' | 'transilien' | 'ter' | 'tgv' | 'intercites' | 'eurostar' | 'bus';

export interface Edge {
  from: string;
  to: string;
  mode: Mode;
  operator: string;
  station: string; // 출발역(파리 기준)
  minutes: number;
  fareEur: [number, number]; // [미리 예약 최저, 당일 최고]
  perDay: number;
  first: string; // 첫차 "06:10"
  last: string; // 막차
  windowFact?: string; // 차창 밖 사실 카드
  windowFactSource?: string;
}

export interface FactCard {
  id: string;
  cityId: string;
  poiId?: string;
  text: string;
  sourceId: string;
  /** 대사 중 창작 부분 여부 (메아리 장면용) */
  fiction?: boolean;
}

// ─── 미션 스텝(선형 스크립트) ────────────────────────────────────────────────
export type Speaker = 'margot' | 'guide' | 'L' | 'theo' | 'echo' | 'narrator' | 'player';

export type Step =
  | { t: 'say'; who: Speaker; text: string; name?: string; fiction?: boolean; mood?: Expression }
  | { t: 'card'; cardId: string; who?: Speaker; text?: string; mood?: Expression }
  /** 편집부에서 오는 휴대폰 메시지 — 얼굴 대신 메신저 화면으로 나온다 */
  | { t: 'message'; from: Speaker; text: string; subject?: string }
  | { t: 'quiz'; who?: Speaker; q: string; options: string[]; answer: number; cardId: string; explain?: string }
  | { t: 'photo'; photoId: string; hint: string; options: string[]; answer: number; cardId?: string }
  | { t: 'visit'; poiId: string; minutes: number }
  | { t: 'buy'; foodId: string; guess?: boolean }
  | { t: 'order'; prompt: string; items: string[]; cardId: string } // items = 정답 순서(UI에서 섞음)
  | { t: 'exchange'; from: Currency; to: Currency; hint: string }
  | { t: 'move'; zone: string; minutes: number; poiId?: string } // 도시 내 구역 이동(1회권). poiId: 도착지가 명확한 장소일 때 지도 강조용
  | { t: 'article'; baseFee: number }
  | { t: 'letter'; text: string; title: string }
  | { t: 'unlock'; regions: RegionId[]; note: string }
  | { t: 'collect'; item: string }
  | { t: 'stamp' };

export type MissionType = 'main' | 'city' | 'echo' | 'food' | 'transport' | 'tutorial';

export interface Mission {
  id: string;
  cityId: string;
  title: string;
  type: MissionType;
  minutes: number; // 표시용 예상 소요
  summary: string;
  cardIds: string[]; // 이 미션에서 모을 수 있는 카드 전체
  steps: Step[];
  requires?: string[]; // 선행 미션
}
