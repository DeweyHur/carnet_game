export const METRO_SOURCES = {
  fares: 'https://www.iledefrance-mobilites.fr/tarifs-titre-de-transport-en-commun-2026',
  single: 'https://www.iledefrance-mobilites.fr/titres-et-tarifs/detail/ticket-metro-train-rer',
  week: 'https://www.iledefrance-mobilites.fr/titres-et-tarifs/detail/forfait-navigo-semaine',
  day: 'https://www.iledefrance-mobilites.fr/titres-et-tarifs/detail/forfait-navigo-jour',
};
export interface MetroLeg { line: '1' | '6' | '12'; direction: string; stations: string[] }
export const STATION_PHOTOS: Record<string, string> = {
  'Palais Royal – Musée du Louvre': 'paris:metro-palais-royal',
  'Tuileries': 'paris:metro-tuileries',
  'Champs-Élysées – Clemenceau': 'paris:metro-champs',
  'Franklin D. Roosevelt': 'paris:metro-franklin',
  'George V': 'paris:metro-george',
  'Kléber': 'paris:metro-kleber',
  'Boissière': 'paris:metro-boissiere',
  'Madeleine': 'paris:metro-madeleine',
  'Saint-Lazare': 'paris:metro-saint-lazare',
  'Trinité – d’Estienne d’Orves': 'paris:metro-trinite',
  'Notre-Dame-de-Lorette': 'paris:metro-lorette',
  'Saint-Georges': 'paris:metro-saint-georges',
  'Pigalle': 'paris:metro-pigalle',
  'Concorde': 'paris:metro-concorde',
  'Charles de Gaulle – Étoile': 'paris:metro-etoile',
  'Trocadéro': 'paris:metro-trocadero',
  'Passy': 'paris:metro-passy',
  'Bir-Hakeim': 'paris:metro-bir-hakeim',
  'Abbesses': 'paris:metro-abbesses',
};
export interface MetroTrip { id: string; title: string; subtitle: string; photo: string; stationPhoto: string; duration: string; walk: string; moment: string; legs: MetroLeg[] }
const fromLouvre = ['Palais Royal – Musée du Louvre', 'Tuileries', 'Concorde'];
export const METRO_TRIPS: MetroTrip[] = [
  { id: 'eiffel', title: '루브르에서 에펠탑까지', subtitle: '미술관의 오후, 센 강 위의 한 장면', photo: 'paris', stationPhoto: 'paris:metro-bir-hakeim', duration: '약 35–45분', walk: 'Bir-Hakeim 하차 → Quai Jacques Chirac 방향으로 걸어 에펠탑까지 약 10–15분. 주변 산책 시간은 더 넉넉하게 잡아요.', moment: 'Passy를 떠나 Bir-Hakeim으로 가는 순간, 열차가 센 강 위로 나옵니다. 에펠탑을 바라보고 싶다면 진행 방향 왼쪽 창가를 눈여겨보세요. 내린 뒤에는 강변에서 잠깐 쉬어가도 좋아요.', legs: [
    { line: '1', direction: 'La Défense', stations: [...fromLouvre, 'Champs-Élysées – Clemenceau', 'Franklin D. Roosevelt', 'George V', 'Charles de Gaulle – Étoile'] },
    { line: '6', direction: 'Nation', stations: ['Charles de Gaulle – Étoile', 'Kléber', 'Boissière', 'Trocadéro', 'Passy', 'Bir-Hakeim'] },
  ] },
  { id: 'montmartre', title: '몽마르트르의 작은 오후', subtitle: '초록색 12호선 끝에 기다리는 언덕 산책', photo: 'paris:montmartre', stationPhoto: 'paris:metro-abbesses', duration: '약 35–50분', walk: 'Abbesses 하차 → 아베스 광장 → Rue Yvonne le Tac → Rue Tardieu → 사크레쾨르. 언덕과 계단을 포함해 도보 약 15–20분.', moment: '아베스 광장에서 커피 한 잔을 고르고 천천히 언덕으로 올라가 보세요. 정상에 도착하면 파리의 지붕들이 한눈에 펼쳐집니다. 깊은 역이라 지상으로 나갈 때는 엘리베이터 표지를 찾아보세요.', legs: [
    { line: '1', direction: 'La Défense', stations: fromLouvre },
    { line: '12', direction: 'Mairie d’Aubervilliers', stations: ['Concorde', 'Madeleine', 'Saint-Lazare', 'Trinité – d’Estienne d’Orves', 'Notre-Dame-de-Lorette', 'Saint-Georges', 'Pigalle', 'Abbesses'] },
  ] },
  { id: 'seine', title: '창가에 앉아, 센 강을 건너다', subtitle: '트로카데로에서 시작하는 짧고 멋진 6호선 여행', photo: 'paris', stationPhoto: 'paris:metro-bir-hakeim', duration: '약 15–25분', walk: 'Bir-Hakeim 역에서 내려 다리와 센 강변으로 약 5분. 에펠탑까지 걷는다면 약 10–15분을 더 잡아요.', moment: '트로카데로 광장에서 에펠탑을 먼저 보고 지하철을 타보세요. Passy와 Bir-Hakeim 사이에서는 강과 철교가 여행의 풍경이 됩니다. 짧은 이동도 여행의 하이라이트가 될 수 있어요.', legs: [
    { line: '6', direction: 'Nation', stations: ['Trocadéro', 'Passy', 'Bir-Hakeim'] },
  ] },
];
export function tripStops(trip: MetroTrip) {
  return trip.legs.flatMap((leg, legIndex) => leg.stations.map((name, stationIndex) => ({ name, legIndex, stationIndex, line: leg.line, direction: leg.direction, transfer: stationIndex === 0 && legIndex > 0 })));
}
// Compare adult non-airport rail journeys within one calendar day. Card fees excluded.
export const dayComparison = (journeys: number) => ({ single: Math.round(journeys * 255) / 100, day: 12.3, cheaper: journeys * 255 < 1230 ? 'single' : 'day' });
