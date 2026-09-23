// 지구(동네)와 그 사이를 잇는 지하철. 지구를 늘릴 때 손대는 곳은 여기 한 군데다.
import type { LngLat } from './graph';
import type { Curated } from './places';
import { CURATED_MARAIS } from './places';
import { CURATED_SG } from './saintgermain';
import { CURATED_MONTMARTRE } from './montmartre';
import { CURATED_BELLEVILLE } from './belleville';
import { CURATED_CHAMPS } from './champs';
import { STATION_POS } from './stations';
import { BUS_LINES } from './bus';

export type DistrictId = 'marais' | 'saint-germain' | 'montmartre' | 'belleville' | 'champs-elysees';

/** 지하철 출입구 하나(OSM railway=subway_entrance). 들어갈 때도 나올 때도 같은 구멍이다. */
export interface Gate {
  ref: string; // 표지판의 출구 번호(sortie)
  label: string; // 출구 이름 — 표지판에 적힌 그대로
  note: string; // 올라오면 무엇이 보이나
  pos: LngLat;
  mins: number; // 개찰구에서 지상까지
}

export interface Station {
  name: string; // LINES의 역 이름과 정확히 같아야 한다
  lines: string[];
  gates: Gate[];
  photo?: string[];
}

export interface District {
  id: DistrictId;
  name: string;
  full: string;
  blurb: string; // 목적지 고를 때 보이는 한 줄
  data: string; // public/walk/*.json
  curated: Curated[];
  stations: Station[];
  bbox: [number, number, number, number]; // s,w,n,e — 이 안의 버스 정류장이 이 동네의 정류장
  start: LngLat; // 게임을 시작하는 자리(마레만 쓴다)
}

const G = (ref: string, label: string, note: string, pos: LngLat, mins = 2): Gate => ({ ref, label, note, pos, mins });

export const DISTRICTS: Record<DistrictId, District> = {
  marais: {
    id: 'marais', name: '마레', full: '마레 지구 · 3·4구',
    blurb: '좁은 골목, 17세기 저택, 유대인 거리와 부티크. 걸어 다니기 가장 좋은 동네.',
    data: 'walk/marais.json', curated: CURATED_MARAIS,
    bbox: [48.8520, 2.3530, 48.8625, 2.3700],
    start: [2.360296, 48.855267],
    stations: [
      { name: 'Saint-Paul', lines: ['1'],
        photo: ['file:Station Saint Paul Métro Paris - Paris IV (FR75) - 2025-10-17 - 3.jpg', 'file:St-Paul (1) par Cramos.JPG'],
        // 생폴 역은 리볼리 거리 양쪽에 구멍이 하나씩, 그게 전부다(OSM).
        gates: [
          G('1', 'Rue de Rivoli — 남쪽 보도', '생폴 성당 정면과 생탕투안 거리, 보주 광장 방향.', [2.360296, 48.855267]),
          G('1', 'Rue de Rivoli — 북쪽 보도', '길을 건너지 않고 로지에 거리와 마레 안쪽으로.', [2.360125, 48.855312]),
        ] },
      { name: 'Rambuteau', lines: ['11'],
        gates: [
          G('1', 'Rue Beaubourg — 퐁피두 센터', '퐁피두 센터의 색색 파이프가 바로 보인다.', [2.353465, 48.861408]),
          G('2', 'Rue Rambuteau', '북마레 쪽. 갤러리와 옷가게가 이어지는 골목.', [2.353607, 48.861269]),
          G('3', "Rue Geoffroy l'Angevin", '조용한 뒷골목으로 바로 올라온다.', [2.353493, 48.86105]),
        ] },
    ],
  },
  'saint-germain': {
    id: 'saint-germain', name: '생제르맹', full: '생제르맹–라탱 · 5·6구',
    blurb: '강변 헌책 좌판, 오래된 카페와 서점, 대학과 공원. 마레보다 넓고 평평하다.',
    data: 'walk/saint-germain.json', curated: CURATED_SG,
    bbox: [48.8440, 2.3300, 48.8580, 2.3490],
    start: [2.34423, 48.853265],
    stations: [
      { name: 'Saint-Michel', lines: ['4'], photo: ['file:Saint-Michel-quais-depuis-puits-dacces.jpg'],
        gates: [
          G('1', 'Quai Saint-Michel — 노트르담 쪽', '강변으로 바로 나온다. 헌책 좌판, 다리 건너 노트르담.', [2.34447, 48.853499], 3),
          G('2', 'Place Saint-Michel', '광장 한복판. 사람이 제일 많고 어디로든 갈 수 있다.', [2.34423, 48.853265]),
          G('3', 'Fontaine Saint-Michel — 분수 앞', '대천사 분수 바로 앞. 파리 사람들의 약속 장소.', [2.343635, 48.853288]),
          G('4', 'Place Saint-André-des-Arts', '광장 뒤 좁은 골목 쪽. 부시 거리와 오데옹 방향.', [2.342704, 48.853146]),
        ] },
      { name: 'Odéon', lines: ['4'],
        gates: [
          G('1', "Rue de l'École de Médecine", '의과대학 옛 건물 쪽 조용한 골목.', [2.339659, 48.852131]),
          G('2', "Carrefour de l'Odéon — 동쪽", '오데옹 사거리. 영화관과 식당이 모인 자리.', [2.339328, 48.852224]),
          G('2', "Carrefour de l'Odéon — 서쪽", '뤽상부르 공원과 오데옹 극장 방향.', [2.338939, 48.852317]),
        ] },
    ],
  },
  montmartre: {
    id: 'montmartre', name: '몽마르트르', full: '몽마르트르 · 18구',
    blurb: '언덕 위 하얀 성당, 화가들의 광장, 계단과 포도밭. 오르내리는 만큼 풍경이 바뀐다.',
    data: 'walk/montmartre.json', curated: CURATED_MONTMARTRE,
    bbox: [48.8790, 2.3320, 48.8905, 2.3480],
    start: [2.338642, 48.884804],
    stations: [
      { name: 'Abbesses', lines: ['12'],
        gates: [
          G('1', 'Place des Abbesses — 기마르 입구', '초록 아르누보 지붕 아래로 올라온다. 역이 36m 깊이라 엘리베이터를 타는 게 낫다.', [2.338652, 48.884459], 4),
        ] },
      { name: 'Anvers', lines: ['2'],
        gates: [
          G('1', 'Boulevard de Rochechouart — 사크레쾨르 쪽', '대로로 나오면 정면 언덕 위에 하얀 성당이 보인다. 여기서부터 계단 또는 푸니쿨라.', [2.344062, 48.882883], 3),
        ] },
    ],
  },
  belleville: {
    id: 'belleville', name: '벨빌', full: '벨빌·메닐몽탕 · 20·11구',
    blurb: '언덕 위 전망 공원, 벽화 골목, 여러 나라 밥집. 관광지가 아니라 사람 사는 동네.',
    data: 'walk/belleville.json', curated: CURATED_BELLEVILLE,
    bbox: [48.8650, 2.3730, 48.8770, 2.3900],
    start: [2.376955, 48.872293],
    stations: [
      { name: 'Belleville', lines: ['2', '11'],
        gates: [
          G('1', 'Boulevard de Belleville', '노천 시장이 서는 대로 가운데로 나온다.', [2.377257, 48.871996]),
          G('2', 'Rue de Belleville', '언덕을 올라가는 밥집 거리의 시작점.', [2.376955, 48.872293]),
          G('3', 'Boulevard de la Villette', '북쪽 대로. 뷔트쇼몽 공원 방향.', [2.376732, 48.872493]),
          G('5', 'Rue du Faubourg du Temple', '남쪽 번화가 쪽. 값싼 가게가 이어진다.', [2.376617, 48.872096]),
        ] },
    ],
  },
  'champs-elysees': {
    id: 'champs-elysees', name: '샹젤리제', full: '샹젤리제·에투알 · 8구',
    blurb: '개선문과 1.9km 대로, 유리 지붕의 궁전들. 블록이 크고 대로가 넓다.',
    data: 'walk/champs-elysees.json', curated: CURATED_CHAMPS,
    bbox: [48.8655, 2.2925, 48.8765, 2.3150],
    start: [2.30061, 48.872207],
    stations: [
      { name: 'George V', lines: ['1'],
        gates: [
          G('1', 'Champs-Élysées — 북쪽 보도', '대로 한복판. 개선문이 왼쪽에 보인다.', [2.30061, 48.872207]),
          G('1', 'Champs-Élysées — 서쪽', '같은 대로, 개선문에 조금 더 가깝다.', [2.300466, 48.872252]),
          G('2', 'Avenue George V', '조용한 명품 거리 쪽. 몽테뉴 거리와 극장 방향.', [2.300545, 48.871836]),
        ] },
      { name: 'Charles de Gaulle – Étoile', lines: ['1', '2'],
        gates: [
          G('2', 'Avenue de Friedland', '개선문 지하도 입구가 가깝다. 대로 건너지 말 것.', [2.296411, 48.874186], 3),
          G('3', 'Avenue Hoche', '북쪽 대로. 사람이 덜하다.', [2.295934, 48.874567], 3),
          G('4', 'Avenue de Wagram', '개선문 북쪽. 자크마르앙드레 쪽으로 걸어가기 좋다.', [2.295419, 48.874705], 3),
          G('6', 'Avenue de la Grande Armée', '개선문 서쪽 뒤편. 라데팡스 방향.', [2.293519, 48.874581], 3),
        ] },
    ],
  },
};

export const ALL_DISTRICTS = Object.values(DISTRICTS);
export const otherDistricts = (id: DistrictId) => ALL_DISTRICTS.filter((d) => d.id !== id);

// ───────── 노선 ─────────
export type Mode = 'metro' | 'bus';

export const FARE: Record<Mode, number> = {
  metro: 2.55, // 메트로·전철·RER 1회권 (같은 계열끼리 2시간 환승)
  bus: 2.05, // 버스·트램 1회권 (지상 교통끼리 1시간 30분 환승)
};
// 버스와 메트로는 표가 다르다 — 섞어 타면 두 장을 산다. (Navigo Liberté+만 예외)

const PACE: Record<Mode, number> = { metro: 1.6, bus: 2.4 }; // 한 정거장에 걸리는 분
const BOARD: Record<Mode, number> = { metro: 3, bus: 6 }; // 개찰·플랫폼 / 정류장에서 기다리기
const CORRIDOR = 5; // 같은 역 안에서 노선 갈아타기
const NEAR_M = 220; // 이 안이면 걸어서 갈아탄다

export interface LineDef { mode: Mode; color: string; ink: string; label: string; stations: string[] }

const METRO: Record<string, Omit<LineDef, 'mode' | 'label'>> = {
  '1': { color: '#ffcd00', ink: '#1f1b16', stations: ['La Défense', 'Esplanade de La Défense', 'Pont de Neuilly', 'Les Sablons', 'Porte Maillot', 'Argentine', 'Charles de Gaulle – Étoile', 'George V', 'Franklin D. Roosevelt', 'Champs-Élysées – Clemenceau', 'Concorde', 'Tuileries', 'Palais Royal – Musée du Louvre', 'Louvre – Rivoli', 'Châtelet', 'Hôtel de Ville', 'Saint-Paul', 'Bastille', 'Gare de Lyon', 'Reuilly – Diderot', 'Nation', 'Porte de Vincennes', 'Saint-Mandé', 'Bérault', 'Château de Vincennes'] },
  '2': { color: '#0064b0', ink: '#fff', stations: ['Porte Dauphine', 'Victor Hugo', 'Charles de Gaulle – Étoile', 'Ternes', 'Courcelles', 'Monceau', 'Villiers', 'Rome', 'Place de Clichy', 'Blanche', 'Pigalle', 'Anvers', 'Barbès – Rochechouart', 'La Chapelle', 'Stalingrad', 'Jaurès', 'Colonel Fabien', 'Belleville', 'Couronnes', 'Ménilmontant', 'Père Lachaise', 'Philippe Auguste', 'Alexandre Dumas', 'Avron', 'Nation'] },
  '4': { color: '#bf3283', ink: '#fff', stations: ['Porte de Clignancourt', 'Simplon', 'Marcadet – Poissonniers', 'Château Rouge', 'Barbès – Rochechouart', 'Gare du Nord', "Gare de l'Est", "Château d'Eau", 'Strasbourg – Saint-Denis', 'Réaumur – Sébastopol', 'Étienne Marcel', 'Les Halles', 'Châtelet', 'Cité', 'Saint-Michel', 'Odéon', 'Saint-Germain-des-Prés', 'Saint-Sulpice', 'Saint-Placide', 'Montparnasse – Bienvenüe', 'Vavin', 'Raspail', 'Denfert-Rochereau', 'Mouton-Duvernet', 'Alésia', "Porte d'Orléans", 'Mairie de Montrouge', 'Barbara', 'Bagneux – Lucie Aubrac'] },
  '11': { color: '#8d5e2a', ink: '#fff', stations: ['Châtelet', 'Hôtel de Ville', 'Rambuteau', 'Arts et Métiers', 'République', 'Goncourt', 'Belleville', 'Pyrénées', 'Jourdain', 'Place des Fêtes', 'Télégraphe', 'Porte des Lilas', 'Mairie des Lilas', 'Serge Gainsbourg', 'Romainville – Carnot', 'Montreuil – Hôpital', 'La Dhuys', 'Coteaux Beauclair', 'Rosny – Bois-Perrier'] },
  '12': { color: '#007852', ink: '#fff', stations: ["Mairie d'Aubervilliers", 'Aimé Césaire', 'Front Populaire', 'Porte de la Chapelle', 'Marx Dormoy', 'Marcadet – Poissonniers', 'Jules Joffrin', 'Lamarck – Caulaincourt', 'Abbesses', 'Pigalle', 'Saint-Georges', 'Notre-Dame-de-Lorette', "Trinité – d'Estienne d'Orves", 'Saint-Lazare', 'Madeleine', 'Concorde', 'Assemblée nationale', 'Rue du Bac', 'Sèvres – Babylone', 'Rennes', 'Montparnasse – Bienvenüe', 'Falguière', 'Volontaires', 'Vaugirard', 'Convention', 'Porte de Versailles', 'Corentin Celton', "Mairie d'Issy"] },
};

const BUS_COLOR = '#5b7f3a';

export const LINES: Record<string, LineDef> = {
  ...Object.fromEntries(Object.entries(METRO).map(([k, v]) => [k, { ...v, mode: 'metro' as const, label: `${k}호선` }])),
  ...Object.fromEntries(Object.entries(BUS_LINES).map(([k, v]) => [
    `bus${k}`,
    { mode: 'bus' as const, color: BUS_COLOR, ink: '#fff', label: `${k}번 버스`, stations: v.stops.map((st) => st[0]) },
  ])),
};

/** 정류장·역의 좌표 */
export function stopPos(lineKey: string, station: string): LngLat | undefined {
  const def = LINES[lineKey];
  if (def?.mode === 'bus') return BUS_LINES[lineKey.slice(3)].stops.find((st) => st[0] === station)?.[1];
  return STATION_POS[station];
}
export const stationPos = (name: string): LngLat | undefined => STATION_POS[name];

export type Leg =
  | { kind: 'ride'; line: string; from: string; to: string; photo?: string[] }
  | { kind: 'transfer'; at: string; from: string; to: string; mins: number; note: string; street: boolean; photo?: string[] };

export interface Ride {
  stations: string[];
  a: number; b: number;
  dirs: [string, string];
  right: 0 | 1;
  stops: number;
  mins: number;
  color: string;
  ink: string;
  mode: Mode;
  label: string;
}

export function rideInfo(l: { line: string; from: string; to: string }): Ride {
  const L = LINES[l.line];
  const a = L.stations.indexOf(l.from);
  const b = L.stations.indexOf(l.to);
  if (a < 0 || b < 0) throw new Error(`${L.label}에 없는 정류장: ${a < 0 ? l.from : l.to}`);
  const stops = Math.abs(b - a);
  return {
    stations: L.stations, a, b,
    dirs: [L.stations[0], L.stations[L.stations.length - 1]],
    right: b > a ? 1 : 0,
    stops,
    mins: Math.max(2, Math.round(stops * PACE[L.mode]) + 1),
    color: L.color, ink: L.ink, mode: L.mode, label: L.label,
  };
}

// ───────── 여정 계산 ─────────
const WALK_MPS = 1.35;
const DETOUR = 1.3;
const metres = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * 73000, (a[1] - b[1]) * 111320);
const walkMins = (a: LngLat, b: LngLat) => (metres(a, b) * DETOUR) / WALK_MPS / 60;

const HARP = 'file:2018 Paris Metro harpist at Chatelet station between no. 1 and no. 4 lines.jpg';
const TRAIN_PHOTO: Record<string, string[]> = {
  '1': ['file:Rame MP05 Station Gare Lyon Métro Paris Ligne 1 - Paris XII (FR75) - 2025-10-31 - 1.jpg'],
  '4': ['file:MP89cc Ligne 4.jpg', 'file:Metro Paris - Ligne 4 - station Chatelet 01.jpg'],
};

const key = (line: string, station: string) => `${line}@${station}`;
const split = (k: string): [string, string] => { const i = k.indexOf('@'); return [k.slice(0, i), k.slice(i + 1)]; };

/** 노선 사이를 갈아탈 수 있는 곳을 미리 찾아 둔다(같은 역 이름 또는 걸어갈 만한 거리). */
let LINKS: Map<string, { to: string; mins: number; street: boolean }[]> | null = null;
function links() {
  if (LINKS) return LINKS;
  const nodes: { k: string; line: string; station: string; pos: LngLat; mode: Mode }[] = [];
  for (const [lk, def] of Object.entries(LINES)) {
    for (const st of def.stations) {
      const pos = stopPos(lk, st);
      if (pos) nodes.push({ k: key(lk, st), line: lk, station: st, pos, mode: def.mode });
    }
  }
  const m = new Map<string, { to: string; mins: number; street: boolean }[]>();
  const add = (a: string, b: string, mins: number, street: boolean) => {
    (m.get(a) ?? m.set(a, []).get(a)!).push({ to: b, mins, street });
  };
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const A = nodes[i], B = nodes[j];
      if (A.line === B.line) continue;
      const sameName = A.station === B.station;
      const d = metres(A.pos, B.pos);
      if (sameName && A.mode === 'metro' && B.mode === 'metro') { add(A.k, B.k, CORRIDOR, false); add(B.k, A.k, CORRIDOR, false); continue; }
      if (d <= NEAR_M) {
        const t = Math.max(2, Math.round(walkMins(A.pos, B.pos) + 1));
        add(A.k, B.k, t, true); add(B.k, A.k, t, true);
      }
    }
  }
  LINKS = m;
  return m;
}

export interface Journey {
  to: DistrictId;
  legs: Leg[];
  mins: number; // 도보 + 대기 + 타는 시간 전부
  walk: number; // 지금 자리에서 타는 곳까지
  fare: number;
  modes: Mode[];
  from: string;
  arrive: string;
  arriveMode: Mode;
}

interface PlanOpts { at?: LngLat; only?: Mode }

/** 출발 후보 → 도착 후보 중 가장 빠른 여정. only를 주면 그 수단만 쓴다. */
export function planJourney(to: DistrictId, from: District, dest: District, opts: PlanOpts = {}): Journey | null {
  const allowed = (lk: string) => !opts.only || LINES[lk].mode === opts.only;
  const boardPoints = (d: District) => {
    const out: { k: string; pos: LngLat }[] = [];
    for (const st of d.stations) for (const l of st.lines) if (allowed(l)) out.push({ k: key(l, st.name), pos: st.gates[0].pos });
    // 버스는 정류장이 곧 타는 곳 — 지구 안에 있는 정류장을 전부 후보로
    for (const [lk, def] of Object.entries(LINES)) {
      if (def.mode !== 'bus' || !allowed(lk)) continue;
      for (const st of def.stations) {
        const pos = stopPos(lk, st);
        if (pos && inside(d, pos)) out.push({ k: key(lk, st), pos });
      }
    }
    return out;
  };
  const starts = boardPoints(from);
  const goalList = boardPoints(dest);
  if (!starts.length || !goalList.length) return null;
  const goals = new Map(goalList.map((g) => [g.k, g.pos]));

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const prevStreet = new Map<string, boolean>();
  const walk0 = new Map<string, number>();
  const queue: { k: string; d: number }[] = [];
  for (const s of starts) {
    const w = opts.at ? walkMins(opts.at, s.pos) : 0;
    if (w < (dist.get(s.k) ?? Infinity)) { dist.set(s.k, w); walk0.set(s.k, w); queue.push({ k: s.k, d: w }); }
  }

  let best: string | null = null;
  const L = links();
  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const cur = queue.shift()!;
    if (cur.d > (dist.get(cur.k) ?? Infinity)) continue;
    if (goals.has(cur.k)) { best = cur.k; break; }
    const [line, station] = split(cur.k);
    const arr = LINES[line].stations;
    const i = arr.indexOf(station);
    const pace = PACE[LINES[line].mode];
    const push = (k: string, d: number, street?: boolean) => {
      if (d < (dist.get(k) ?? Infinity)) { dist.set(k, d); prev.set(k, cur.k); if (street !== undefined) prevStreet.set(k, street); queue.push({ k, d }); }
    };
    if (i > 0) push(key(line, arr[i - 1]), cur.d + pace);
    if (i < arr.length - 1) push(key(line, arr[i + 1]), cur.d + pace);
    for (const e of L.get(cur.k) ?? []) if (allowed(split(e.to)[0])) push(e.to, cur.d + e.mins, e.street);
  }
  if (!best) return null;

  const path: string[] = [];
  for (let k: string | undefined = best; k; k = prev.get(k)) path.unshift(k);

  const legs: Leg[] = [];
  let segStart = path[0];
  for (let i = 1; i < path.length; i++) {
    const [pl, ps] = split(path[i - 1]);
    const [cl, cs] = split(path[i]);
    if (cl === pl) continue;
    const startStation = split(segStart)[1];
    if (ps !== startStation) legs.push({ kind: 'ride', line: pl, from: startStation, to: ps, photo: TRAIN_PHOTO[pl] });
    const street = prevStreet.get(path[i]) ?? true;
    const a = LINES[pl], b = LINES[cl];
    legs.push({
      kind: 'transfer', at: cs, from: a.label, to: b.label,
      mins: street ? Math.max(2, Math.round(walkMins(stopPos(pl, ps) ?? [0, 0], stopPos(cl, cs) ?? [0, 0]) + 1)) : CORRIDOR,
      street,
      photo: street ? undefined : [HARP],
      note: street
        ? `${a.label}에서 내려 ${cs}까지 걸어가 ${b.label}로 갈아탄다. 밖으로 나와 길을 건너야 할 수도 있다.`
        : `${a.label}에서 ${b.label}로. 표지판의 노선 번호와 종착역 이름만 따라가면 된다.`,
    });
    segStart = path[i];
  }
  const [lastLine, lastStation] = split(path[path.length - 1]);
  if (split(segStart)[1] !== lastStation) legs.push({ kind: 'ride', line: lastLine, from: split(segStart)[1], to: lastStation, photo: TRAIN_PHOTO[lastLine] });
  if (!legs.some((l) => l.kind === 'ride')) return null;

  const modes = [...new Set(legs.filter((l): l is Extract<Leg, { kind: 'ride' }> => l.kind === 'ride').map((l) => LINES[l.line].mode))];
  const walk = Math.round(walk0.get(path[0]) ?? 0);
  const board = Math.max(...modes.map((m) => BOARD[m]));
  const mins = walk + board + legs.reduce((n, l) => n + (l.kind === 'transfer' ? l.mins : rideInfo(l).mins), 0);
  const fare = Math.round(modes.reduce((n, m) => n + FARE[m], 0) * 100) / 100;
  return { to, legs, mins, walk, fare, modes, from: split(path[0])[1], arrive: lastStation, arriveMode: LINES[lastLine].mode };
}

const inside = (d: District, p: LngLat) => {
  const b = d.bbox;
  return p[1] >= b[0] && p[0] >= b[1] && p[1] <= b[2] && p[0] <= b[3];
};

export interface Options { metro: Journey | null; bus: Journey | null; mixed: Journey | null; walkMins: number }

/** 지하철만 / 버스만 / (확실히 빠를 때만) 섞어서 — 셋을 비교해 보여 준다. */
export function planOptions(from: District, dest: District, at?: LngLat): Options {
  const metro = planJourney(dest.id, from, dest, { at, only: 'metro' });
  const bus = planJourney(dest.id, from, dest, { at, only: 'bus' });
  const any = planJourney(dest.id, from, dest, { at });
  const bestSingle = Math.min(metro?.mins ?? Infinity, bus?.mins ?? Infinity);
  const mixed = any && any.modes.length > 1 && any.mins + 6 < bestSingle ? any : null;
  const a = at ?? from.stations[0].gates[0].pos;
  const b = dest.stations[0].gates[0].pos;
  return { metro, bus, mixed, walkMins: Math.round(walkMins(a, b)) };
}

export const journeyFor = (from: DistrictId, to: DistrictId, at?: LngLat) =>
  planJourney(to, DISTRICTS[from], DISTRICTS[to], { at });
