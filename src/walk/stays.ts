// 숙소. 이름·위치·별점은 실제(OpenStreetMap, 2026-09).
// 1박 값과 조식은 등급·동네로 만든 **대략값**이다 — 실제 요금이 아니고, 화면에도 그렇게 적는다.
import type { LngLat } from './graph';
import type { DistrictId } from './districts';

export type Tier = 'hostel' | 'budget' | 'mid' | 'upper' | 'luxe';
export const TIER_LABEL: Record<Tier, string> = { hostel: '호스텔', budget: '2성', mid: '3성', upper: '4성', luxe: '5성' };

export interface Stay {
  id: string;
  name: string;
  district: DistrictId;
  pos: LngLat;
  tier: Tier;
  stars: number | null;
  night: number; // 1박 대략값(€)
  breakfast: { included: boolean; price: number }; // price 0 = 안 판다
  note: string;
}

export const STAYS: Stay[] = [
  { id: 's1', name: "MIJE Fourcy", district: 'marais', pos: [2.359175, 48.854761], tier: 'hostel', stars: null, night: 50,
    breakfast: { included: true, price: 0 },
    note: "17세기 저택을 개조한 청소년 숙소. 마레 한복판에 이 값으로 묵을 수 있는 거의 유일한 곳이고, 아침이 값에 포함된다. 방은 여럿이 같이 쓴다." },
  { id: 's2', name: "D'win", district: 'marais', pos: [2.353759, 48.858639], tier: 'budget', stars: 2, night: 115,
    breakfast: { included: false, price: 12 },
    note: "생폴과 퐁피두 사이의 작은 2성 호텔. 방은 좁지만 위치가 전부다." },
  { id: 's3', name: "Hôtel Marais de Launay", district: 'marais', pos: [2.368554, 48.858593], tier: 'mid', stars: 3, night: 170,
    breakfast: { included: false, price: 15 },
    note: "북마레 조용한 쪽의 3성. 아침은 따로 계산한다." },
  { id: 's4', name: "Hôtel Beaubourg", district: 'marais', pos: [2.353353, 48.860007], tier: 'mid', stars: 3, night: 170,
    breakfast: { included: false, price: 15 },
    note: "퐁피두 뒤 골목의 3성. 돌벽이 남은 오래된 건물." },
  { id: 's5', name: "Hôtel Pavillon de la reine", district: 'marais', pos: [2.366129, 48.856435], tier: 'upper', stars: 4, night: 265,
    breakfast: { included: false, price: 26 },
    note: "보주 광장 아케이드 안쪽에 숨은 4성. 안뜰을 지나 들어간다." },
  { id: 's6', name: "Hôtel du Jeu de Paume", district: 'marais', pos: [2.356153, 48.85204], tier: 'upper', stars: 4, night: 265,
    breakfast: { included: true, price: 0 },
    note: "생루이섬의 17세기 실내 테니스장을 고친 4성. 섬 안이라 밤이 조용하다." },
  { id: 's7', name: "Foyer International des Étudiantes", district: 'saint-germain', pos: [2.339984, 48.844666], tier: 'hostel', stars: null, night: 50,
    breakfast: { included: true, price: 0 },
    note: "뤽상부르 공원 앞 학생 기숙사형 숙소. 값이 아주 싸고 조용하지만 규칙이 있다." },
  { id: 's8', name: "Le Petit Belloy", district: 'saint-germain', pos: [2.342175, 48.850213], tier: 'budget', stars: 2, night: 120,
    breakfast: { included: false, price: 12 },
    note: "라탱 지구 한복판의 작은 2성." },
  { id: 's9', name: "Wyld Saint-Germain", district: 'saint-germain', pos: [2.347846, 48.848662], tier: 'mid', stars: 3, night: 180,
    breakfast: { included: false, price: 15 },
    note: "요즘 지은 3성. 공용 공간이 넓다." },
  { id: 's10', name: "Hôtel de Suez", district: 'saint-germain', pos: [2.342652, 48.849796], tier: 'mid', stars: 3, night: 180,
    breakfast: { included: true, price: 0 },
    note: "생미셸 대로변 3성. 창을 열면 대로 소음이 들어온다." },
  { id: 's11', name: "Grand Cœur Latin", district: 'saint-germain', pos: [2.342072, 48.84823], tier: 'upper', stars: 4, night: 280,
    breakfast: { included: false, price: 26 },
    note: "소르본 근처 4성. 방이 75개로 이 동네치곤 크다." },
  { id: 's12', name: "Atmosphères", district: 'saint-germain', pos: [2.348045, 48.848536], tier: 'upper', stars: 4, night: 280,
    breakfast: { included: false, price: 26 },
    note: "라탱 지구 4성. 조식은 따로." },
  { id: 's13', name: "Le Village Hostel", district: 'montmartre', pos: [2.344315, 48.883949], tier: 'hostel', stars: null, night: 45,
    breakfast: { included: true, price: 0 },
    note: "사크레쾨르 언덕 밑 호스텔. 테라스에서 성당이 보인다." },
  { id: 's14', name: "Hôtel André Gill", district: 'montmartre', pos: [2.340242, 48.882792], tier: 'budget', stars: 2, night: 105,
    breakfast: { included: false, price: 12 },
    note: "아베스 골목 안쪽 2성. 계단이 가파르다." },
  { id: 's15', name: "Hôtel Moulin Plaza", district: 'montmartre', pos: [2.332892, 48.883038], tier: 'mid', stars: 3, night: 155,
    breakfast: { included: false, price: 15 },
    note: "블랑슈 쪽 3성. 물랭 루주가 걸어서 몇 분." },
  { id: 's16', name: "Hôtel George", district: 'montmartre', pos: [2.336383, 48.879555], tier: 'mid', stars: 3, night: 155,
    breakfast: { included: false, price: 15 },
    note: "언덕 아래 남쪽 3성. 역이 가깝다." },
  { id: 's17', name: "Terrass'' Hôtel", district: 'montmartre', pos: [2.333045, 48.886581], tier: 'upper', stars: 4, night: 240,
    breakfast: { included: true, price: 0 },
    note: "몽마르트르 묘지 옆 4성. 옥상 테라스에서 파리 전경이 보이는 걸로 유명하다." },
  { id: 's18', name: "Adagio Paris Montmartre", district: 'montmartre', pos: [2.342548, 48.883116], tier: 'upper', stars: 4, night: 240,
    breakfast: { included: false, price: 26 },
    note: "부엌이 딸린 레지던스형 4성. 오래 묵을 때 좋다." },
  { id: 's19', name: "The People", district: 'belleville', pos: [2.378869, 48.870017], tier: 'hostel', stars: null, night: 35,
    breakfast: { included: true, price: 0 },
    note: "벨빌의 큰 호스텔. 1층 바가 동네 사람들로 붐빈다." },
  { id: 's20', name: "Hôtel de la Perdrix Rouge", district: 'belleville', pos: [2.388892, 48.875415], tier: 'budget', stars: 2, night: 85,
    breakfast: { included: false, price: 12 },
    note: "조레스·벨빌 북쪽의 오래된 2성." },
  { id: 's21', name: "Ideal Hotel", district: 'belleville', pos: [2.375401, 48.867638], tier: 'mid', stars: 3, night: 130,
    breakfast: { included: false, price: 15 },
    note: "벨빌 남쪽의 3성. 값이 이 도시 기준으로 싸다." },
  { id: 's22', name: "Huni Hôtel", district: 'belleville', pos: [2.387775, 48.874241], tier: 'mid', stars: 3, night: 130,
    breakfast: { included: true, price: 0 },
    note: "피레네 쪽 3성. 관광객이 거의 없는 동네." },
  { id: 's23', name: "Novotel Paris 20 Belleville", district: 'belleville', pos: [2.380595, 48.869551], tier: 'upper', stars: 4, night: 200,
    breakfast: { included: true, price: 0 },
    note: "체인 4성. 예측 가능한 방과 조식." },
  { id: 's24', name: "Adveniat", district: 'champs-elysees', pos: [2.308703, 48.865853], tier: 'hostel', stars: null, night: 60,
    breakfast: { included: true, price: 0 },
    note: "샹젤리제 뒤편 교회가 운영하는 숙소. 이 동네 값을 생각하면 놀랍게 싸다." },
  { id: 's25', name: "Hôtel Plaza Élysées", district: 'champs-elysees', pos: [2.30576, 48.874647], tier: 'mid', stars: 3, night: 210,
    breakfast: { included: false, price: 15 },
    note: "대로 북쪽 3성." },
  { id: 's26', name: "Hôtel Belfast", district: 'champs-elysees', pos: [2.293877, 48.875643], tier: 'mid', stars: 3, night: 210,
    breakfast: { included: false, price: 15 },
    note: "개선문 서쪽 3성. 대로에서 한 블록 비켜 있다." },
  { id: 's27', name: "Hôtel du Rond-Point des Champs-Élysées", district: 'champs-elysees', pos: [2.310694, 48.870409], tier: 'upper', stars: 4, night: 330,
    breakfast: { included: true, price: 0 },
    note: "대로 한복판 4성." },
  { id: 's28', name: "Hôtel Warwick", district: 'champs-elysees', pos: [2.30331, 48.872123], tier: 'upper', stars: 4, night: 330,
    breakfast: { included: true, price: 0 },
    note: "몽테뉴 거리 가까운 4성." },
  { id: 's29', name: "Château des Fleurs", district: 'champs-elysees', pos: [2.298413, 48.871774], tier: 'luxe', stars: 5, night: 650,
    breakfast: { included: true, price: 0 },
    note: "개선문 근처 5성. 방이 37개뿐인 작은 고급 호텔." },
];

export const staysIn = (d: DistrictId) => STAYS.filter((s) => s.district === d);
