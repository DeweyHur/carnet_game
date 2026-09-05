import type { City, Edge, RegionId } from '../game/types';

export const REGIONS: Record<RegionId, { name: string; blurb: string }> = {
  idf: { name: '일드프랑스', blurb: '파리와 근교. 《Carnet》 편집부가 있는 시작 지역.' },
  nord: { name: '프랑스 북부', blurb: '피카르디·노르망디·샹파뉴·플랑드르. 대성당과 국경의 땅.' },
  centre: { name: '루아르·중부', blurb: '샤르트르와 오를레앙. 순례길과 잔 다르크의 길.' },
};

export const CITIES: City[] = [
  {
    id: 'paris', tier: 'S', region: 'idf', country: 'FR',
    names: { ko: '파리', fr: 'Paris', en: 'Paris' },
    coord: [2.3522, 48.8566], population: 2100000, priceIndex: 1.0, hostelEur: 45,
    heritage: ['UNESCO: 파리 센 강변(1991)'],
    blurb: '루테티아라는 갈로로마 도시에서 시작해 2천 년을 쌓아 올린 도시. 《Carnet》 편집부는 2구 파사주 안쪽에 있다.',
    guide: { name: '엘렌', archetype: '박물관 도슨트', color: '#b56b45',
      intro: '시테코의 도슨트. "돈은 숫자가 아니라 이야기예요. 지폐 한 장에 나라 하나가 들어 있죠."' },
    pois: [
      { id: 'carnet-office', name: '《Carnet》 편집부 (2구, 창작 장소)', type: 'office', feeEur: 0, note: '마고 편집장이 있는 곳. 미션 배정과 원고 송고.' },
      { id: 'citeco', name: '시테코 Citéco — 경제·화폐 시티 (17구)', type: 'museum', feeEur: 12, closedDays: [1], hours: '14:00-18:00 (주말 10:00-18:00)', note: '1882년 지어진 오텔 가이야르(Hôtel Gaillard) 안, 2019년 개관.', sourceId: 'src:citeco' },
      { id: 'carnavalet', name: '카르나발레 박물관 — 파리 역사', type: 'museum', feeEur: 0, closedDays: [1], hours: '10:00-18:00', note: '상설 전시 무료.', sourceId: 'src:carnavalet' },
      { id: 'cluny', name: '클뤼니 박물관 — 중세·루테티아 목욕탕', type: 'museum', feeEur: 12, closedDays: [1], hours: '09:30-18:15', sourceId: 'src:cluny' },
      { id: 'sainte-chapelle', name: '생트샤펠', type: 'chapel', feeEur: 13, hours: '09:00-19:00', sourceId: 'src:sainte-chapelle' },
      { id: 'arenes', name: '루테티아 원형경기장', type: 'ruin', feeEur: 0, hours: '08:00-20:30', sourceId: 'src:arenes' },
    ],
    foods: [
      { id: 'croissant', name: '크루아상', nameLocal: 'Croissant', baseEur: 1.5, venue: 'shop', stamina: 6, origin: '빈의 킵펠(kipferl)에서 유래해 19세기 파리에서 버터 페이스트리로 정착했다.', sourceId: 'src:croissant' },
      { id: 'jambon-beurre', name: '잠봉뵈르', nameLocal: 'Jambon-beurre', baseEur: 6, venue: 'shop', stamina: 20, origin: '바게트에 햄과 버터만 넣은 프랑스 국민 샌드위치. 한 해 십억 개 넘게 팔린다고 알려져 있다.', sourceId: 'src:jambon-beurre' },
      { id: 'cafe', name: '카페 (에스프레소)', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다 — 프랑스 카페의 오래된 관습.', sourceId: 'src:jambon-beurre' },
      { id: 'croque', name: '크로크무슈', nameLocal: 'Croque-monsieur', baseEur: 11, venue: 'bistro', stamina: 25, origin: '1910년경 파리 카페 메뉴에 등장한 햄·치즈 토스트.', sourceId: 'src:jambon-beurre' },
      { id: 'onion-soup', name: '오니언 수프', nameLocal: 'Soupe à l’oignon', baseEur: 12, venue: 'bistro', stamina: 25, origin: '레알 중앙시장 시절 새벽 노동자와 야행객의 국물.', sourceId: 'src:carnavalet' },
      { id: 'paris-brest', name: '파리-브레스트', nameLocal: 'Paris-Brest', baseEur: 6.5, venue: 'shop', stamina: 12, origin: '1910년 파리–브레스트 자전거 경주를 기념해 바퀴 모양으로 만든 슈 과자.', sourceId: 'src:paris-brest' },
    ],
    missionIds: ['paris-opening', 'paris-lutetia'],
  },
  {
    id: 'boulogne', tier: 'A', region: 'idf', country: 'FR',
    names: { ko: '불로뉴비양쿠르', fr: 'Boulogne-Billancourt', en: 'Boulogne-Billancourt' },
    coord: [2.24, 48.8352], population: 121000, priceIndex: 0.95, hostelEur: 50,
    blurb: '센 강 서쪽, 르노 공장이 있던 섬과 알베르 칸의 정원이 있는 도시. L.의 사진 상자가 가리키는 첫 좌표.',
    guide: { name: '카림', archetype: '사서(아카이브 담당)', color: '#4f6d7a',
      intro: '알베르 칸 박물관의 아카이브 담당. "7만 2천 장의 유리판을 하나씩 스캔하다 보면, 세상이 한때 얼마나 조용했는지 알게 돼요."' },
    pois: [
      { id: 'albert-kahn', name: '알베르 칸 박물관·정원', type: 'museum', feeEur: 8, closedDays: [1], hours: '11:00-19:00', note: '2022년 재개관(건축: 구마 겐고).', sourceId: 'src:albert-kahn-musee' },
      { id: 'seine-musicale', name: '라 센 뮤지칼 (스갱 섬)', type: 'venue', feeEur: 0, hours: '외부 관람 상시', note: '옛 르노 공장 터, 2017년 개관.', sourceId: 'src:seine-musicale' },
    ],
    foods: [
      { id: 'croissant', name: '크루아상', nameLocal: 'Croissant', baseEur: 1.5, venue: 'shop', stamina: 6, origin: '빈의 킵펠에서 유래한 버터 페이스트리.', sourceId: 'src:croissant' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'lunch-formule', name: '점심 정식', nameLocal: 'Formule déjeuner', baseEur: 18, venue: 'bistro', stamina: 40, origin: '전채+본식 또는 본식+디저트. 프랑스 직장인의 점심 규칙.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['boulogne-archives'],
  },
  {
    id: 'saint-denis', tier: 'A', region: 'idf', country: 'FR',
    names: { ko: '생드니', fr: 'Saint-Denis', en: 'Saint-Denis' },
    coord: [2.3583, 48.9362], population: 113000, priceIndex: 0.9, hostelEur: 38,
    blurb: '고딕 건축이 태어난 대성당과 프랑스 왕들의 묘역. 화·금·일에는 일드프랑스에서 가장 큰 시장이 선다.',
    guide: { name: '파티마', archetype: '시장 상인', color: '#c0392b',
      intro: '생드니 시장의 향신료 가판대 주인. "왕들은 저기 누워 있고, 우리는 여기서 장사를 하죠. 천 년째."' },
    pois: [
      { id: 'basilica', name: '생드니 대성당 (왕실 묘역)', type: 'cathedral', feeEur: 11, hours: '10:00-18:15', sourceId: 'src:saint-denis' },
      { id: 'sd-market', name: '생드니 시장', type: 'market', feeEur: 0, closedDays: [1, 3, 4, 6], hours: '화·금·일 오전', sourceId: 'src:saint-denis-market' },
    ],
    foods: [
      { id: 'msemen', name: '므세멘 (시장 노점)', nameLocal: 'Msemen', baseEur: 2, venue: 'market', stamina: 12, origin: '마그레브식 팬케이크. 생드니 시장의 다문화 식탁을 대표한다.', sourceId: 'src:saint-denis-market' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'lunch-formule', name: '점심 정식', nameLocal: 'Formule déjeuner', baseEur: 18, venue: 'bistro', stamina: 40, origin: '전채+본식 또는 본식+디저트.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['saint-denis-kings'],
  },
  {
    id: 'argenteuil', tier: 'A', region: 'idf', country: 'FR',
    names: { ko: '아르장퇴유', fr: 'Argenteuil', en: 'Argenteuil' },
    coord: [2.2478, 48.9472], population: 110000, priceIndex: 0.9, hostelEur: 40,
    blurb: '모네가 1871년부터 1878년까지 살며 센 강의 돛단배를 그린 곳. 한때 파리 식탁의 아스파라거스 산지.',
    guide: { name: '루이', archetype: '미술 학생', color: '#5b8c5a',
      intro: '파리 미술학교 학생, 주말마다 강가에서 스케치. "모네가 여기서 본 빛은 지금도 같은 각도로 떨어져요."' },
    pois: [
      { id: 'musee-argenteuil', name: '아르장퇴유 박물관', type: 'museum', feeEur: 0, closedDays: [1, 2], hours: '수–일', sourceId: 'src:musee-argenteuil' },
      { id: 'seine-bank', name: '센 강변 (모네의 뱃놀이 장소)', type: 'walk', feeEur: 0, hours: '상시', sourceId: 'src:monet-argenteuil' },
    ],
    foods: [
      { id: 'asperge', name: '아르장퇴유 아스파라거스 요리', nameLocal: 'Asperges d’Argenteuil', baseEur: 14, venue: 'bistro', stamina: 30, origin: '19세기 파리 근교 채소 산지의 대표 작물. 지금은 지명이 품종명으로 남았다.', sourceId: 'src:argenteuil-asperge' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'jambon-beurre', name: '잠봉뵈르', nameLocal: 'Jambon-beurre', baseEur: 6, venue: 'shop', stamina: 20, origin: '프랑스 국민 샌드위치.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['argenteuil-light'],
  },
  {
    id: 'montreuil', tier: 'A', region: 'idf', country: 'FR',
    names: { ko: '몽트뢰유', fr: 'Montreuil', en: 'Montreuil' },
    coord: [2.4436, 48.8638], population: 111000, priceIndex: 0.9, hostelEur: 40,
    blurb: '복숭아를 키우던 돌담(murs à pêches)과 멜리에스가 1897년 세운 영화 스튜디오의 도시.',
    guide: { name: '가스파르', archetype: '농부(담장 정원사)', color: '#8e6c3a',
      intro: '복숭아 담장 보존회의 정원사. "담이 햇빛을 저장했어요. 그래서 파리 북쪽에서 복숭아가 됐죠."' },
    pois: [
      { id: 'murs', name: '복숭아 담장 (murs à pêches)', type: 'heritage', feeEur: 0, hours: '주말 개방', closedDays: [1, 2, 3, 4, 5], sourceId: 'src:murs-peches' },
      { id: 'mhv', name: '살아있는 역사 박물관', type: 'museum', feeEur: 0, closedDays: [1, 2], hours: '수–일 14:00-17:30', sourceId: 'src:mhv' },
      { id: 'melies-site', name: '멜리에스 스튜디오 터', type: 'site', feeEur: 0, hours: '외부', sourceId: 'src:melies' },
    ],
    foods: [
      { id: 'peche', name: '몽트뢰유 복숭아 (제철)', nameLocal: 'Pêche de Montreuil', baseEur: 2.5, venue: 'market', stamina: 8, origin: '17~19세기 석회 담장의 축열로 키운 파리 근교 복숭아. 왕실에도 납품됐다.', sourceId: 'src:peche-montreuil' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'lunch-formule', name: '점심 정식', nameLocal: 'Formule déjeuner', baseEur: 18, venue: 'bistro', stamina: 40, origin: '전채+본식 또는 본식+디저트.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['montreuil-glass'],
  },
  {
    id: 'versailles', tier: 'H', region: 'idf', country: 'FR',
    names: { ko: '베르사유', fr: 'Versailles', en: 'Versailles' },
    coord: [2.1301, 48.8049], population: 84000, priceIndex: 0.98, hostelEur: 55,
    heritage: ['UNESCO: 베르사유 궁전과 정원(1979)'],
    blurb: '루이 14세의 사냥 별장이 유럽 절대왕정의 무대가 된 곳. 1919년 거울의 방에서 1차대전을 끝내는 조약이 서명됐다.',
    guide: { name: '오딜', archetype: '시계공', color: '#6c5b7b',
      intro: '궁전 시계 복원 기술자. "거울의 방 시계는 1919년 6월 28일 오후 3시를 지나갔어요. 그날도 그냥 째깍거렸죠."' },
    pois: [
      { id: 'chateau', name: '베르사유 궁전 — 거울의 방', type: 'palace', feeEur: 21, closedDays: [1], hours: '09:00-18:30', sourceId: 'src:versailles-chateau' },
      { id: 'gardens', name: '정원', type: 'garden', feeEur: 0, hours: '08:00-20:30', sourceId: 'src:versailles-chateau' },
    ],
    foods: [
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'jambon-beurre', name: '잠봉뵈르', nameLocal: 'Jambon-beurre', baseEur: 6, venue: 'shop', stamina: 20, origin: '프랑스 국민 샌드위치.', sourceId: 'src:jambon-beurre' },
      { id: 'lunch-formule', name: '점심 정식', nameLocal: 'Formule déjeuner', baseEur: 18, venue: 'bistro', stamina: 40, origin: '전채+본식 또는 본식+디저트.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['versailles-mirrors'],
  },
  {
    id: 'chartres', tier: 'H', region: 'centre', country: 'FR',
    names: { ko: '샤르트르', fr: 'Chartres', en: 'Chartres' },
    coord: [1.4894, 48.4469], population: 38000, priceIndex: 0.8, hostelEur: 35,
    heritage: ['UNESCO: 샤르트르 대성당(1979)'],
    blurb: '보스 평원 위로 두 첨탑이 먼저 보이는 순례 도시. 12~13세기 스테인드글라스의 푸른빛이 "샤르트르 블루"다.',
    guide: { name: '베르나르', archetype: '사서', color: '#2e5c8a',
      intro: '교구 도서관 사서. "1194년 불이 났을 때 사람들은 절망 대신 더 큰 성당을 지었어요. 30년 만에."' },
    pois: [
      { id: 'chartres-cath', name: '샤르트르 대성당', type: 'cathedral', feeEur: 0, hours: '08:30-19:30', sourceId: 'src:chartres' },
      { id: 'chartres-crypt', name: '지하 예배당 투어', type: 'tour', feeEur: 4, hours: '11:00·14:15·16:30', sourceId: 'src:chartres' },
    ],
    foods: [
      { id: 'pate-chartres', name: '샤르트르 파테', nameLocal: 'Pâté de Chartres', baseEur: 9, venue: 'shop', stamina: 22, origin: '파이 크러스트에 싼 사냥고기 파테. 순례자와 여행자의 휴대식이었다.', sourceId: 'src:pate-chartres' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'lunch-formule', name: '점심 정식', nameLocal: 'Formule déjeuner', baseEur: 18, venue: 'bistro', stamina: 40, origin: '전채+본식 또는 본식+디저트.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['chartres-blue'],
  },
  {
    id: 'amiens', tier: 'A', region: 'nord', country: 'FR',
    names: { ko: '아미앵', fr: 'Amiens', en: 'Amiens' },
    coord: [2.2957, 49.8942], population: 135000, priceIndex: 0.82, hostelEur: 32,
    heritage: ['UNESCO: 아미앵 대성당(1981)'],
    blurb: '프랑스 최대 규모의 고딕 대성당, 쥘 베른이 20년 가까이 산 집, 그리고 300헥타르의 수상정원.',
    guide: { name: '노에미', archetype: '뱃사공', color: '#3a7d7b',
      intro: '오르티요나주(수상정원)의 뱃사공. "대성당 정면은 오후 빛이 좋아요. 배는 아침이 좋고요."' },
    pois: [
      { id: 'amiens-cath', name: '아미앵 대성당', type: 'cathedral', feeEur: 0, hours: '08:30-18:30', sourceId: 'src:amiens-cath' },
      { id: 'verne-house', name: '쥘 베른의 집', type: 'museum', feeEur: 9, closedDays: [2], hours: '10:00-12:30, 14:00-18:00', note: '화요일 휴관(비수기).', sourceId: 'src:verne-maison' },
      { id: 'madeleine', name: '마들렌 묘지', type: 'cemetery', feeEur: 0, hours: '08:00-18:00', sourceId: 'src:madeleine' },
      { id: 'hortillonnages', name: '오르티요나주 (수상정원) 뱃놀이', type: 'boat', feeEur: 7, hours: '4~10월', sourceId: 'src:hortillonnages' },
      { id: 'hort-market', name: '수상정원 시장 (토요일)', type: 'market', feeEur: 0, hours: '토 오전', sourceId: 'src:hortillonnages' },
    ],
    foods: [
      { id: 'macaron-amiens', name: '마카롱 다미앵', nameLocal: 'Macaron d’Amiens', baseEur: 2, venue: 'shop', stamina: 8, origin: '아몬드·꿀·달걀로 만드는 납작한 과자. 16세기부터 아미앵의 특산으로 전해진다.', sourceId: 'src:macaron-amiens' },
      { id: 'ficelle', name: '피셀 피카르드', nameLocal: 'Ficelle picarde', baseEur: 12, venue: 'bistro', stamina: 30, origin: '햄·버섯·크림을 만 크레프 그라탱. 1950년대 아미앵에서 창작됐다고 전해진다.', sourceId: 'src:ficelle' },
      { id: 'hort-veg', name: '수상정원 채소 바구니', nameLocal: 'Légumes des hortillonnages', baseEur: 5, venue: 'market', stamina: 15, origin: '중세부터 이어진 습지 채소밭의 수확물. 배로 실어 나른다.', sourceId: 'src:hortillonnages' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['amiens-80days'],
  },
  {
    id: 'reims', tier: 'A', region: 'nord', country: 'FR',
    names: { ko: '랭스', fr: 'Reims', en: 'Reims' },
    coord: [4.0317, 49.2583], population: 180000, priceIndex: 0.85, hostelEur: 36,
    heritage: ['UNESCO: 랭스 대성당·생레미 수도원·토 궁전(1991)', 'UNESCO: 샹파뉴 언덕·메종·저장고(2015)'],
    blurb: '프랑스 왕들이 대관식을 올린 대성당, 1945년 5월 7일 독일이 항복문서에 서명한 학교 건물, 그리고 지하 백 킬로미터의 샴페인 저장고.',
    guide: { name: '셀린', archetype: '양조가', color: '#a67c52',
      intro: '샴페인 메종의 셀러 마스터. "지하 저장고는 로마 시대 채석장이에요. 돌을 파낸 자리에 병을 채웠죠."' },
    pois: [
      { id: 'reims-cath', name: '랭스 대성당', type: 'cathedral', feeEur: 0, hours: '07:30-19:15', sourceId: 'src:reims-cath' },
      { id: 'reddition', name: '항복 박물관 (Musée de la Reddition)', type: 'museum', feeEur: 5, closedDays: [2], hours: '10:00-18:00', sourceId: 'src:reddition' },
      { id: 'caves', name: '샴페인 지하 저장고 투어', type: 'tour', feeEur: 25, hours: '예약제', sourceId: 'src:champagne-unesco' },
    ],
    foods: [
      { id: 'biscuit-rose', name: '비스퀴 로즈', nameLocal: 'Biscuit rose de Reims', baseEur: 4, venue: 'shop', stamina: 8, origin: '1756년으로 거슬러 올라가는 분홍색 비스킷. 샴페인에 적셔 먹는다.', sourceId: 'src:biscuit-rose' },
      { id: 'champagne-glass', name: '샴페인 한 잔', nameLocal: 'Coupe de champagne', baseEur: 9, venue: 'bistro', stamina: 5, origin: '샹파뉴 지방에서만 그 이름을 쓸 수 있는 발포 와인.', sourceId: 'src:champagne-reims' },
      { id: 'jambon-reims', name: '랭스 햄', nameLocal: 'Jambon de Reims', baseEur: 10, venue: 'bistro', stamina: 25, origin: '파슬리와 함께 젤리에 굳힌 샹파뉴 지방의 햄.', sourceId: 'src:biscuit-rose' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['reims-crown'],
  },
  {
    id: 'rouen', tier: 'A', region: 'nord', country: 'FR',
    names: { ko: '루앙', fr: 'Rouen', en: 'Rouen' },
    coord: [1.0993, 49.4432], population: 112000, priceIndex: 0.84, hostelEur: 34,
    blurb: '잔 다르크가 1431년 화형당한 광장, 14세기 대시계, 모네가 서른 번 넘게 그린 대성당 정면.',
    guide: { name: '마르셀', archetype: '시계공', color: '#7a5c3e',
      intro: '대시계(Gros-Horloge) 관리인. "1389년부터 돌아가는 기계예요. 바늘은 하나뿐이죠 — 그때는 시(時)면 충분했어요."' },
    pois: [
      { id: 'historial', name: '잔 다르크 역사관', type: 'museum', feeEur: 11, closedDays: [1], hours: '10:00-19:00', sourceId: 'src:historial' },
      { id: 'gros-horloge', name: '대시계 (Gros-Horloge)', type: 'monument', feeEur: 8, closedDays: [1], hours: '10:00-13:00, 14:00-19:00', sourceId: 'src:gros-horloge' },
      { id: 'rouen-cath', name: '루앙 대성당', type: 'cathedral', feeEur: 0, hours: '09:00-19:00', sourceId: 'src:monet-rouen' },
      { id: 'vieux-marche', name: '비외마르셰 광장', type: 'square', feeEur: 0, hours: '상시', sourceId: 'src:jeanne-rouen' },
    ],
    foods: [
      { id: 'canard', name: '루앙식 오리', nameLocal: 'Canard à la rouennaise', baseEur: 28, venue: 'restaurant', stamina: 45, origin: '피를 넣은 소스로 만드는 루앙의 오리 요리. 19세기 요리사 조합의 의례가 됐다.', sourceId: 'src:canard-rouen' },
      { id: 'sucre-pomme', name: '사과 설탕', nameLocal: 'Sucre de pomme', baseEur: 5, venue: 'shop', stamina: 8, origin: '노르망디 사과즙으로 만든 막대 사탕. 루앙의 옛 특산.', sourceId: 'src:sucre-pomme' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'lunch-formule', name: '점심 정식', nameLocal: 'Formule déjeuner', baseEur: 18, venue: 'bistro', stamina: 40, origin: '전채+본식 또는 본식+디저트.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['rouen-clock'],
  },
  {
    id: 'lille', tier: 'A', region: 'nord', country: 'FR',
    names: { ko: '릴', fr: 'Lille', en: 'Lille' },
    coord: [3.0573, 50.6292], population: 235000, priceIndex: 0.88, hostelEur: 36,
    blurb: '플랑드르의 상업 도시. 1652년 구 증권거래소, 1890년 드골이 태어난 집, 9월 첫 주말의 거대한 벼룩시장.',
    guide: { name: '야신', archetype: '택시기사', color: '#2c3e50',
      intro: '릴 토박이 택시기사. "브라드리 주말엔 운전을 못 해요. 길이 전부 홍합 껍데기로 덮이니까."' },
    pois: [
      { id: 'pba', name: '릴 순수미술관', type: 'museum', feeEur: 7, closedDays: [2], hours: '10:00-18:00', sourceId: 'src:pba-lille' },
      { id: 'degaulle-house', name: '드골 생가', type: 'museum', feeEur: 6, closedDays: [1, 2], hours: '10:00-17:00', sourceId: 'src:degaulle' },
      { id: 'vieille-bourse', name: '구 증권거래소', type: 'monument', feeEur: 0, closedDays: [1], hours: '13:00-19:00 (고서 시장)', sourceId: 'src:vieille-bourse' },
    ],
    foods: [
      { id: 'carbonnade', name: '카르보나드 플라망드', nameLocal: 'Carbonade flamande', baseEur: 16, venue: 'bistro', stamina: 40, origin: '맥주와 향신료 빵으로 졸인 플랑드르식 소고기 스튜.', sourceId: 'src:carbonnade' },
      { id: 'welsh', name: '웰시', nameLocal: 'Welsh', baseEur: 13, venue: 'bistro', stamina: 35, origin: '체다 치즈를 맥주에 녹여 빵과 햄 위에 부은 요리. 영국 이름이 북프랑스 명물이 됐다.', sourceId: 'src:welsh' },
      { id: 'moules', name: '홍합감자', nameLocal: 'Moules-frites', baseEur: 17, venue: 'bistro', stamina: 40, origin: '브라드리 기간 식당들은 홍합 껍데기를 문 앞에 쌓아 높이를 겨룬다.', sourceId: 'src:braderie' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['lille-braderie'],
  },
  {
    id: 'orleans', tier: 'A', region: 'centre', country: 'FR',
    names: { ko: '오를레앙', fr: 'Orléans', en: 'Orléans' },
    coord: [1.9039, 47.9029], population: 116000, priceIndex: 0.83, hostelEur: 34,
    blurb: '1429년 5월 8일 잔 다르크가 포위를 푼 루아르 강의 도시. 매년 그날을 축제로 기억한다.',
    guide: { name: '클레르', archetype: '역무원', color: '#8a3b5c',
      intro: '오를레앙 역의 역무원. "5월 8일엔 기차가 붐벼요. 6백 년째 같은 날을 축하하러 오니까."' },
    pois: [
      { id: 'maison-jeanne', name: '잔 다르크의 집', type: 'museum', feeEur: 6, closedDays: [1], hours: '10:00-18:00', sourceId: 'src:siege-orleans' },
      { id: 'orleans-cath', name: '생트크루아 대성당', type: 'cathedral', feeEur: 0, hours: '09:15-18:00', sourceId: 'src:siege-orleans' },
      { id: 'loire-quai', name: '루아르 강변', type: 'walk', feeEur: 0, hours: '상시', sourceId: 'src:siege-orleans' },
    ],
    foods: [
      { id: 'cotignac', name: '코티냑 (모과 젤리)', nameLocal: 'Cotignac d’Orléans', baseEur: 3, venue: 'shop', stamina: 6, origin: '작은 나무 상자에 담긴 모과 젤리. 중세부터 이어진 오를레앙 특산으로, 왕에게 헌상됐다는 기록이 있다.', sourceId: 'src:cotignac' },
      { id: 'cafe', name: '카페', nameLocal: 'Un café', baseEur: 3.5, venue: 'bistro', stamina: 8, origin: '카운터에서 서서 마시면 더 싸다.', sourceId: 'src:jambon-beurre' },
      { id: 'lunch-formule', name: '점심 정식', nameLocal: 'Formule déjeuner', baseEur: 18, venue: 'bistro', stamina: 40, origin: '전채+본식 또는 본식+디저트.', sourceId: 'src:jambon-beurre' },
    ],
    missionIds: ['orleans-may8'],
  },
];

export const cityById = (id: string): City => {
  const c = CITIES.find((x) => x.id === id);
  if (!c) throw new Error('unknown city ' + id);
  return c;
};

// ─── 이동 그래프 (기획서 §3.2 MVP 이동표) ─────────────────────────────────
// 요금은 "예시"이며 분기별 갱신 대상. [미리 예약 최저, 당일 최고]
const E = (
  from: string, to: string, mode: Edge['mode'], operator: string, station: string,
  minutes: number, fare: [number, number], perDay: number, first: string, last: string,
  windowFact?: string, windowFactSource?: string,
): Edge => ({ from, to, mode, operator, station, minutes, fareEur: fare, perDay, first, last, windowFact, windowFactSource });

export const EDGES: Edge[] = [
  E('paris', 'boulogne', 'metro', 'RATP', '메트로 9호선', 20, [2.5, 2.5], 300, '05:30', '00:40',
    '파리 메트로 1회권(t+)은 2025년 기준 €2.50. 메트로·RER 파리 시내 구간에서 환승 포함.', 'src:idfm-fares'),
  E('paris', 'saint-denis', 'metro', 'RATP', '메트로 13호선', 25, [2.5, 2.5], 250, '05:30', '00:40'),
  E('paris', 'montreuil', 'metro', 'RATP', '메트로 9호선', 20, [2.5, 2.5], 300, '05:30', '00:40'),
  E('paris', 'argenteuil', 'transilien', 'SNCF Transilien', '생라자르역 · J선', 15, [2.5, 2.5], 80, '05:20', '00:30'),
  E('paris', 'versailles', 'rer', 'RER C / Transilien N', '몽파르나스역 · N선', 25, [2.5, 5], 90, '05:10', '00:20'),
  E('paris', 'chartres', 'ter', 'SNCF TER', '몽파르나스역', 65, [12, 17], 20, '06:10', '22:40',
    '보스 평원은 프랑스의 곡창. 지평선 위로 샤르트르 대성당의 두 첨탑이 먼저 보인다.', 'src:chartres'),
  E('paris', 'rouen', 'ter', 'TER Nomad', '생라자르역', 80, [18, 25], 20, '06:00', '22:30',
    '파리–루앙 노선(1843)은 프랑스 초기 철도 중 하나로, 센 강 계곡을 따라 달린다.', 'src:ter-nomad'),
  E('paris', 'amiens', 'ter', 'SNCF TER', '북역', 70, [17, 23], 22, '06:05', '22:50',
    '북역을 떠나 피카르디 평원으로. 아미앵 대성당은 프랑스 고딕 대성당 중 내부 부피가 가장 크다.', 'src:amiens-cath'),
  E('paris', 'reims', 'tgv', 'SNCF TGV', '동역', 46, [15, 45], 12, '06:40', '21:50',
    'LGV 동부선(2007 개통) 위를 달린다. 이 구간의 영업 최고속도는 320km/h.', 'src:lgv-est'),
  E('paris', 'reims', 'ter', 'SNCF TER', '동역', 90, [20, 27], 8, '06:20', '21:20'),
  E('paris', 'lille', 'tgv', 'SNCF TGV', '북역', 62, [20, 55], 25, '06:15', '22:10',
    'LGV 북부선(1993)은 파리와 릴·브뤼셀·런던을 잇는다. 유로스타도 같은 선로를 쓴다.', 'src:lgv-nord'),
  E('paris', 'orleans', 'intercites', 'Rémi · Intercités', '오스테를리츠역', 65, [15, 22], 18, '06:00', '22:30',
    '오스테를리츠역은 1805년 전투 이름을 땄다. 루아르 계곡행 열차의 출발지.', 'src:remi'),
  // 지역 내 횡단 노선
  E('amiens', 'lille', 'ter', 'SNCF TER', '아미앵역', 80, [14, 20], 14, '06:00', '21:30'),
  E('amiens', 'rouen', 'ter', 'SNCF TER', '아미앵역', 90, [15, 22], 8, '06:30', '20:30'),
  E('chartres', 'orleans', 'ter', 'Rémi', '샤르트르역', 75, [10, 15], 8, '06:40', '20:10'),
];

/** 양방향 조회 */
export function edgesFrom(cityId: string): Edge[] {
  return EDGES.filter((e) => e.from === cityId || e.to === cityId).map((e) =>
    e.from === cityId ? e : { ...e, from: cityId, to: e.from, station: cityById(cityId).names.ko + '역' },
  );
}
