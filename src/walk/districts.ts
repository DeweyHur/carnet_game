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
  photo?: string[]; // 위키미디어 공용 후보(승강장 등)
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
      photo: ['file:Station Saint Paul Métro Paris - Paris IV (FR75) - 2025-10-17 - 3.jpg', 'file:St-Paul (1) par Cramos.JPG'],
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
      photo: ['file:Saint-Michel-quais-depuis-puits-dacces.jpg'],
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

/** 노선의 전체 역 순서. 방향 이름(종착역)·정거장 수·중간 역이 전부 여기서 나온다. */
export const LINES: Record<string, { color: string; ink: string; stations: string[] }> = {
  '1': {
    color: '#ffcd00', ink: '#1f1b16',
    stations: ['La Défense', 'Esplanade de La Défense', 'Pont de Neuilly', 'Les Sablons', 'Porte Maillot', 'Argentine', 'Charles de Gaulle – Étoile', 'George V', 'Franklin D. Roosevelt', 'Champs-Élysées – Clemenceau', 'Concorde', 'Tuileries', 'Palais Royal – Musée du Louvre', 'Louvre – Rivoli', 'Châtelet', 'Hôtel de Ville', 'Saint-Paul', 'Bastille', 'Gare de Lyon', 'Reuilly – Diderot', 'Nation', 'Porte de Vincennes', 'Saint-Mandé', 'Bérault', 'Château de Vincennes'],
  },
  '4': {
    color: '#bf3283', ink: '#fff',
    stations: ['Porte de Clignancourt', 'Simplon', 'Marcadet – Poissonniers', 'Château Rouge', 'Barbès – Rochechouart', 'Gare du Nord', "Gare de l'Est", "Château d'Eau", 'Strasbourg – Saint-Denis', 'Réaumur – Sébastopol', 'Étienne Marcel', 'Les Halles', 'Châtelet', 'Cité', 'Saint-Michel', 'Odéon', 'Saint-Germain-des-Prés', 'Saint-Sulpice', 'Saint-Placide', 'Montparnasse – Bienvenüe', 'Vavin', 'Raspail', 'Denfert-Rochereau', 'Mouton-Duvernet', 'Alésia', "Porte d'Orléans", 'Mairie de Montrouge', 'Barbara', 'Bagneux – Lucie Aubrac'],
  },
};

export type Leg =
  | { kind: 'ride'; line: string; from: string; to: string; photo?: string[] }
  | { kind: 'transfer'; at: string; from: string; to: string; mins: number; note: string; photo?: string[] };

export interface Ride {
  stations: string[]; // 노선 전체
  a: number; b: number; // 출발·도착 인덱스
  dirs: [string, string]; // [위쪽 종착역, 아래쪽 종착역] = stations[0], stations.at(-1)
  right: 0 | 1; // 맞는 방향
  stops: number;
  mins: number;
  color: string;
  ink: string;
}

/** 노선표에서 방향·정거장 수·소요 시간을 계산한다. 손으로 적어 두면 틀린다. */
export function rideInfo(l: { line: string; from: string; to: string }): Ride {
  const L = LINES[l.line];
  const a = L.stations.indexOf(l.from);
  const b = L.stations.indexOf(l.to);
  if (a < 0 || b < 0) throw new Error(`${l.line}호선에 없는 역: ${a < 0 ? l.from : l.to}`);
  const stops = Math.abs(b - a);
  return {
    stations: L.stations, a, b,
    dirs: [L.stations[0], L.stations[L.stations.length - 1]],
    right: b > a ? 1 : 0,
    stops,
    mins: Math.max(2, Math.round(stops * 1.6) + 1),
    color: L.color, ink: L.ink,
  };
}

export interface Journey { to: DistrictId; legs: Leg[] }

const HARP = 'file:2018 Paris Metro harpist at Chatelet station between no. 1 and no. 4 lines.jpg';
const MP05 = 'file:Rame MP05 Station Gare Lyon Métro Paris Ligne 1 - Paris XII (FR75) - 2025-10-31 - 1.jpg';

export const JOURNEYS: Record<string, Journey> = {
  'marais>saint-germain': {
    to: 'saint-germain',
    legs: [
      { kind: 'ride', line: '1', from: 'Saint-Paul', to: 'Châtelet', photo: [MP05] },
      { kind: 'transfer', at: 'Châtelet', from: '1', to: '4', mins: 5, photo: [HARP, 'file:St-Paul couloirs par Cramos.JPG'],
        note: '1호선에서 4호선까지 통로가 길다. 사람들 사이를 따라 걷는 수밖에 없고, 중간에 악기 소리가 들린다.' },
      { kind: 'ride', line: '4', from: 'Châtelet', to: 'Saint-Michel', photo: ['file:Metro Paris - Ligne 4 - station Chatelet 01.jpg', 'file:MP89cc Ligne 4.jpg'] },
    ],
  },
  'saint-germain>marais': {
    to: 'marais',
    legs: [
      { kind: 'ride', line: '4', from: 'Saint-Michel', to: 'Châtelet', photo: ['file:MP89cc Ligne 4.jpg'] },
      { kind: 'transfer', at: 'Châtelet', from: '4', to: '1', mins: 5, photo: [HARP, 'file:M4 Châtelet rush hour.jpg'],
        note: '올라갔다 내려갔다 하는 환승. 표지판의 노란 1호선만 따라간다.' },
      { kind: 'ride', line: '1', from: 'Châtelet', to: 'Saint-Paul', photo: [MP05] },
    ],
  },
};

/** 안내에 적히는 대략 시간(표 찍고 내려가는 3분 + 출구 2분 포함) */
export const journeyMins = (j: Journey) =>
  5 + j.legs.reduce((n, l) => n + (l.kind === 'transfer' ? l.mins : rideInfo(l).mins), 0);

export const journeyFor = (from: DistrictId, to: DistrictId) => JOURNEYS[`${from}>${to}`];
export const otherDistrict = (id: DistrictId): DistrictId => (id === 'marais' ? 'saint-germain' : 'marais');
