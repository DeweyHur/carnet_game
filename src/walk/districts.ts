// 지구(동네)와 그 사이를 잇는 지하철. 지구를 늘릴 때 손대는 곳은 여기 한 군데다.
import type { LngLat } from './graph';
import type { Curated } from './places';
import { CURATED_MARAIS } from './places';
import { CURATED_SG } from './saintgermain';

export type DistrictId = 'marais' | 'saint-germain';

export interface Exit {
  label: string; // 출구 표지에 적힌 것
  note: string; // 올라오면 무엇이 보이나
  pos: LngLat;
  mins: number; // 개찰구에서 지상까지
}

export interface Station {
  name: string;
  lines: string[];
  pos: LngLat; // 지상 입구
  exits: Exit[]; // 이 역에 내렸을 때 고를 수 있는 출구
}

export interface District {
  id: DistrictId;
  name: string; // 마레
  full: string; // 마레 지구 · 3·4구
  data: string; // public/walk/*.json
  curated: Curated[];
  station: Station;
  /** 처음 시작할 때 서 있는 자리(마레만 쓴다) */
  start: LngLat;
  /** 지상으로 올라온 순간 한 줄 */
  surface: string;
}

export const DISTRICTS: Record<DistrictId, District> = {
  marais: {
    id: 'marais',
    name: '마레',
    full: '마레 지구 · 3·4구',
    data: 'walk/marais.json',
    curated: CURATED_MARAIS,
    start: [2.3612, 48.8552],
    surface: '리볼리 거리의 소음. 등 뒤로 생폴 성당의 정면이 골목 끝에 솟아 있다.',
    station: {
      name: 'Saint-Paul',
      lines: ['1'],
      pos: [2.3612, 48.8552],
      exits: [
        { label: 'Rue de Rivoli — 생폴 성당 쪽', note: '큰길로 곧장. 성당 정면과 로지에 거리 방향.', pos: [2.3612, 48.8552], mins: 2 },
        { label: 'Rue Saint-Antoine — 보주 광장 쪽', note: '동쪽으로 조금 더. 광장과 쉴리 저택이 가깝다.', pos: [2.3630, 48.8550], mins: 3 },
      ],
    },
  },
  'saint-germain': {
    id: 'saint-germain',
    name: '생제르맹',
    full: '생제르맹–라탱 · 5·6구',
    data: 'walk/saint-germain.json',
    curated: CURATED_SG,
    start: [2.3443, 48.8534],
    surface: '계단을 올라오면 바로 분수 소리. 강 건너로 시테섬이 보인다.',
    station: {
      name: 'Saint-Michel',
      lines: ['4'],
      pos: [2.3443, 48.8534],
      exits: [
        { label: 'Place Saint-Michel — 분수 쪽', note: '대천사 분수 앞. 사람이 제일 많고 어디로든 갈 수 있다.', pos: [2.3443, 48.8534], mins: 2 },
        { label: 'Quai des Grands-Augustins — 강 쪽', note: '강변으로 바로. 헌책 좌판과 다리, 노트르담 쪽 풍경.', pos: [2.3430, 48.8540], mins: 3 },
        { label: 'Rue de la Huchette — 골목 쪽', note: '좁은 식당 골목 한복판. 생세브랭 성당이 코앞이다.', pos: [2.3457, 48.8528], mins: 2 },
      ],
    },
  },
};

// ───────── 지하철 ─────────
export const FARE = 2.55; // 2026년 Île-de-France 메트로·전철 1회권

export type Leg =
  | { kind: 'ride'; line: string; color: string; from: string; to: string; dirs: [string, string]; right: 0 | 1; stops: number; mins: number; via: string }
  | { kind: 'transfer'; at: string; from: string; to: string; mins: number; note: string };

export interface Journey {
  to: DistrictId;
  mins: number; // 안내에 적히는 대략 시간
  legs: Leg[];
}

const LINE_COLOR: Record<string, string> = { '1': '#ffcd00', '4': '#bf3283', '11': '#8d5e2a' };
const c = (l: string) => LINE_COLOR[l] ?? '#555';

export const JOURNEYS: Record<string, Journey> = {
  'marais>saint-germain': {
    to: 'saint-germain',
    mins: 16,
    legs: [
      { kind: 'ride', line: '1', color: c('1'), from: 'Saint-Paul', to: 'Châtelet', dirs: ['La Défense', 'Château de Vincennes'], right: 0, stops: 2, mins: 4, via: 'Hôtel de Ville' },
      { kind: 'transfer', at: 'Châtelet', from: '1', to: '4', mins: 5, note: '1호선에서 4호선까지 통로가 길다. 사람들 사이를 따라 걷는 수밖에 없다.' },
      { kind: 'ride', line: '4', color: c('4'), from: 'Châtelet', to: 'Saint-Michel', dirs: ['Porte de Clignancourt', 'Bagneux – Lucie Aubrac'], right: 1, stops: 2, mins: 4, via: 'Cité' },
    ],
  },
  'saint-germain>marais': {
    to: 'marais',
    mins: 16,
    legs: [
      { kind: 'ride', line: '4', color: c('4'), from: 'Saint-Michel', to: 'Châtelet', dirs: ['Porte de Clignancourt', 'Bagneux – Lucie Aubrac'], right: 0, stops: 2, mins: 4, via: 'Cité' },
      { kind: 'transfer', at: 'Châtelet', from: '4', to: '1', mins: 5, note: '올라갔다 내려갔다 하는 환승. 표지판의 노란 1호선만 따라간다.' },
      { kind: 'ride', line: '1', color: c('1'), from: 'Châtelet', to: 'Saint-Paul', dirs: ['La Défense', 'Château de Vincennes'], right: 1, stops: 2, mins: 4, via: 'Hôtel de Ville' },
    ],
  },
};

export const journeyFor = (from: DistrictId, to: DistrictId) => JOURNEYS[`${from}>${to}`];
export const otherDistrict = (id: DistrictId): DistrictId => (id === 'marais' ? 'saint-germain' : 'marais');
