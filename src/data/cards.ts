import type { FactCard } from '../game/types';

// 사실 카드: 문장 + 출처. (검수 원칙: 원문 복제 금지, 재서술)
export const CARDS: FactCard[] = [
  // ── 파리
  { id: 'p-citeco', cityId: 'paris', poiId: 'citeco', text: '시테코(Citéco)는 1882년 지어진 오텔 가이야르를 개조해 2019년 문을 연 경제·화폐 박물관이다.', sourceId: 'src:citeco' },
  { id: 'p-ticket', cityId: 'paris', text: '파리 메트로 1회권은 2025년 기준 €2.50이며, 시내 메트로·RER 구간에서 환승할 수 있다.', sourceId: 'src:idfm-fares' },
  { id: 'p-fx', cityId: 'paris', text: '유럽중앙은행(ECB)은 유로 기준 참고 환율을 매 영업일 발표하며, 누구나 무료로 볼 수 있다.', sourceId: 'src:ecb' },
  { id: 'p-paris-brest', cityId: 'paris', text: '파리-브레스트 케이크는 1910년 파리와 브레스트를 오가는 자전거 경주를 기념해 바퀴 모양으로 만들어졌다.', sourceId: 'src:paris-brest' },
  { id: 'p-lutetia', cityId: 'paris', poiId: 'cluny', text: '클뤼니 박물관은 갈로로마 시대 루테티아의 공중목욕탕 유적 위에 서 있다.', sourceId: 'src:cluny' },
  { id: 'p-arenes', cityId: 'paris', poiId: 'arenes', text: '루테티아 원형경기장은 1세기에 지어졌고, 1869년 도로 공사 중 다시 발견됐다.', sourceId: 'src:arenes' },
  { id: 'p-chapelle', cityId: 'paris', poiId: 'sainte-chapelle', text: '생트샤펠은 루이 9세가 그리스도의 가시관 성유물을 모시기 위해 지었고 1248년 봉헌됐다.', sourceId: 'src:sainte-chapelle' },
  { id: 'p-carnavalet', cityId: 'paris', poiId: 'carnavalet', text: '카르나발레 박물관은 파리의 역사를 다루는 시립 박물관으로, 상설 전시는 무료다.', sourceId: 'src:carnavalet' },
  // ── 불로뉴비양쿠르
  { id: 'b-kahn-1', cityId: 'boulogne', poiId: 'albert-kahn', text: '은행가 알베르 칸은 1909년부터 1931년까지 세계 각지에 사진가를 보내 "지구의 기록(Archives de la Planète)"을 만들었다.', sourceId: 'src:albert-kahn' },
  { id: 'b-kahn-2', cityId: 'boulogne', poiId: 'albert-kahn', text: '지구의 기록에는 약 7만 2천 장의 오토크롬(초기 컬러 사진)이 남아 있으며, 50여 개국을 담고 있다.', sourceId: 'src:albert-kahn' },
  { id: 'b-kahn-3', cityId: 'boulogne', poiId: 'albert-kahn', text: '알베르 칸은 1929년 대공황으로 파산했고, 그의 정원과 컬렉션은 이후 오드센 도(département)가 보존했다.', sourceId: 'src:albert-kahn' },
  { id: 'b-seguin', cityId: 'boulogne', poiId: 'seine-musicale', text: '라 센 뮤지칼은 옛 르노 자동차 공장이 있던 스갱 섬에 2017년 개관한 공연장이다.', sourceId: 'src:seine-musicale' },
  // ── 생드니
  { id: 'sd-suger', cityId: 'saint-denis', poiId: 'basilica', text: '쉬제르 수도원장이 1140년대에 다시 지은 생드니 성당의 성가대석은 고딕 건축의 출발점으로 꼽힌다.', sourceId: 'src:saint-denis' },
  { id: 'sd-kings', cityId: 'saint-denis', poiId: 'basilica', text: '생드니 대성당은 프랑스 왕들의 묘역으로, 다고베르 1세부터 루이 18세까지 대부분의 왕이 묻혔다.', sourceId: 'src:saint-denis' },
  { id: 'sd-market', cityId: 'saint-denis', poiId: 'sd-market', text: '생드니 시장은 화·금·일요일에 열리며 일드프랑스에서 가장 큰 시장 중 하나다.', sourceId: 'src:saint-denis-market' },
  // ── 아르장퇴유
  { id: 'ar-monet', cityId: 'argenteuil', poiId: 'seine-bank', text: '클로드 모네는 1871년부터 1878년까지 아르장퇴유에 살며 센 강의 돛단배와 다리를 그렸다.', sourceId: 'src:monet-argenteuil' },
  { id: 'ar-boat', cityId: 'argenteuil', poiId: 'seine-bank', text: '모네는 아르장퇴유에서 작은 배를 작업실로 개조해 물 위에서 그림을 그렸다.', sourceId: 'src:monet-argenteuil' },
  { id: 'ar-asperge', cityId: 'argenteuil', text: '아르장퇴유 아스파라거스는 19세기 파리 시장에 공급되던 근교 채소로, 지금은 품종 이름으로 남았다.', sourceId: 'src:argenteuil-asperge' },
  // ── 몽트뢰유
  { id: 'mt-murs', cityId: 'montreuil', poiId: 'murs', text: '몽트뢰유의 복숭아 담장은 석회를 바른 담이 낮의 열을 저장해 밤에 내놓는 원리로, 파리 근교에서 복숭아를 키울 수 있게 했다.', sourceId: 'src:murs-peches' },
  { id: 'mt-murs-2', cityId: 'montreuil', poiId: 'murs', text: '19세기 전성기에 몽트뢰유의 복숭아 담장은 수백 킬로미터에 달했다.', sourceId: 'src:murs-peches' },
  { id: 'mt-melies', cityId: 'montreuil', poiId: 'melies-site', text: '조르주 멜리에스는 1897년 몽트뢰유의 자기 집 정원에 유리 스튜디오를 세워 영화를 찍었다.', sourceId: 'src:melies' },
  // ── 베르사유
  { id: 'v-mirrors', cityId: 'versailles', poiId: 'chateau', text: '거울의 방은 1678년부터 지어졌으며 17개의 창과 마주 보는 17개의 거울 아치로 이루어져 있다.', sourceId: 'src:versailles' },
  { id: 'v-1919', cityId: 'versailles', poiId: 'chateau', text: '1919년 6월 28일 거울의 방에서 베르사유 조약이 서명되어 제1차 세계대전이 공식적으로 끝났다.', sourceId: 'src:traite-versailles' },
  { id: 'v-1871', cityId: 'versailles', poiId: 'chateau', text: '1871년 1월 18일 같은 거울의 방에서 독일 제국 선포식이 열렸다 — 1919년의 장소 선택은 그에 대한 응답이었다.', sourceId: 'src:traite-versailles' },
  // ── 샤르트르
  { id: 'ch-fire', cityId: 'chartres', poiId: 'chartres-cath', text: '1194년 화재 뒤 샤르트르 대성당은 약 30년 만에 다시 지어졌고, 그 결과 양식이 놀랍도록 통일되어 있다.', sourceId: 'src:chartres' },
  { id: 'ch-blue', cityId: 'chartres', poiId: 'chartres-cath', text: '"샤르트르 블루"는 12~13세기 스테인드글라스의 깊은 푸른색을 가리키며, 대부분의 유리가 원본 그대로 남아 있다.', sourceId: 'src:chartres' },
  { id: 'ch-unesco', cityId: 'chartres', poiId: 'chartres-cath', text: '샤르트르 대성당은 1979년 유네스코 세계유산에 등재됐다.', sourceId: 'src:chartres' },
  // ── 아미앵
  { id: 'am-cath-1', cityId: 'amiens', poiId: 'amiens-cath', text: '아미앵 대성당은 1220년 착공해 반세기 안에 본체가 완성되었다.', sourceId: 'src:amiens-cath' },
  { id: 'am-cath-2', cityId: 'amiens', poiId: 'amiens-cath', text: '아미앵 대성당은 프랑스 고딕 대성당 중 내부 부피가 가장 크며, 1981년 유네스코 세계유산이 되었다.', sourceId: 'src:amiens-cath' },
  { id: 'am-beau-dieu', cityId: 'amiens', poiId: 'amiens-cath', text: '서쪽 정면 중앙 문의 기둥 조각 "보 디외(Beau Dieu, 아름다운 신)"는 13세기 고딕 조각의 대표작으로 꼽힌다.', sourceId: 'src:amiens-cath' },
  { id: 'am-verne-1', cityId: 'amiens', poiId: 'verne-house', text: '쥘 베른은 1882년부터 1900년까지 아미앵의 이 집에서 살았고, 1905년 아미앵에서 세상을 떠났다.', sourceId: 'src:verne-maison' },
  { id: 'am-verne-2', cityId: 'amiens', poiId: 'verne-house', text: '쥘 베른은 1888년 아미앵 시의원에 선출되어 여러 해 시정에 참여했다.', sourceId: 'src:verne' },
  { id: 'am-80', cityId: 'amiens', poiId: 'verne-house', text: '『80일간의 세계일주』(1872)의 필리어스 포그는 런던을 떠나 수에즈·봄베이·캘커타·홍콩·요코하마·샌프란시스코·뉴욕을 거쳐 돌아온다.', sourceId: 'src:verne-80' },
  { id: 'am-tomb', cityId: 'amiens', poiId: 'madeleine', text: '마들렌 묘지의 쥘 베른 묘에는 1907년 세워진 조각 "불멸과 영원한 젊음을 향하여"가 있다 — 묘석을 밀고 일어나는 베른의 모습이다.', sourceId: 'src:madeleine' },
  { id: 'am-hort', cityId: 'amiens', poiId: 'hortillonnages', text: '오르티요나주는 중세부터 이어진 약 300헥타르의 습지 채소밭으로, 지금도 배로 돌아본다.', sourceId: 'src:hortillonnages' },
  { id: 'am-macaron', cityId: 'amiens', text: '마카롱 다미앵은 아몬드와 꿀로 만드는 납작한 과자로, 16세기부터 아미앵의 특산으로 전해진다.', sourceId: 'src:macaron-amiens' },
  // ── 랭스
  { id: 'r-coronation', cityId: 'reims', poiId: 'reims-cath', text: '1429년 7월 17일 잔 다르크가 지켜보는 가운데 샤를 7세가 랭스 대성당에서 대관식을 올렸다.', sourceId: 'src:reims-cath' },
  { id: 'r-reddition', cityId: 'reims', poiId: 'reddition', text: '1945년 5월 7일 새벽, 랭스의 한 학교 건물에 있던 연합군 사령부에서 독일군의 무조건 항복 문서가 서명됐다.', sourceId: 'src:reddition' },
  { id: 'r-caves', cityId: 'reims', poiId: 'caves', text: '랭스의 샴페인 저장고 상당수는 로마 시대 백악 채석장을 재활용한 것으로, 2015년 유네스코 세계유산에 포함됐다.', sourceId: 'src:champagne-unesco' },
  { id: 'r-biscuit', cityId: 'reims', text: '비스퀴 로즈 드 랭스는 1756년경으로 거슬러 올라가며, 샴페인에 적셔 먹어도 부서지지 않도록 두 번 굽는다.', sourceId: 'src:biscuit-rose' },
  // ── 루앙
  { id: 'ro-jeanne', cityId: 'rouen', poiId: 'vieux-marche', text: '잔 다르크는 1431년 5월 30일 루앙의 비외마르셰 광장에서 화형당했다.', sourceId: 'src:jeanne-rouen' },
  { id: 'ro-clock', cityId: 'rouen', poiId: 'gros-horloge', text: '대시계(Gros-Horloge)의 기계 장치는 1389년에 만들어진 것으로, 프랑스에서 가장 오래된 것 중 하나다.', sourceId: 'src:gros-horloge' },
  { id: 'ro-monet', cityId: 'rouen', poiId: 'rouen-cath', text: '모네는 1892년부터 1894년 사이 루앙 대성당 정면을 서른 점 넘게 그리며 시간에 따라 변하는 빛을 기록했다.', sourceId: 'src:monet-rouen' },
  { id: 'ro-flaubert', cityId: 'rouen', text: '『보바리 부인』의 작가 귀스타브 플로베르는 1821년 루앙에서 태어났으며, 아버지는 시립병원의 외과 의사였다.', sourceId: 'src:flaubert' },
  // ── 릴
  { id: 'li-degaulle', cityId: 'lille', poiId: 'degaulle-house', text: '샤를 드골은 1890년 11월 22일 릴의 외가에서 태어났다.', sourceId: 'src:degaulle' },
  { id: 'li-bourse', cityId: 'lille', poiId: 'vieille-bourse', text: '구 증권거래소(Vieille Bourse)는 1652~1653년 스페인 지배기 플랑드르 양식으로 지어졌고, 지금은 안뜰에서 고서 시장이 열린다.', sourceId: 'src:vieille-bourse' },
  { id: 'li-braderie', cityId: 'lille', text: '릴 브라드리는 매년 9월 첫 주말에 열리는 유럽 최대급 벼룩시장으로, 중세의 시장 전통에서 이어졌다.', sourceId: 'src:braderie' },
  { id: 'li-pba', cityId: 'lille', poiId: 'pba', text: '릴 순수미술관은 1809년 나폴레옹 시기 지방 박물관 정책으로 문을 열었고, 현재 건물은 1892년에 완성됐다.', sourceId: 'src:pba-lille' },
  // ── 오를레앙
  { id: 'or-siege', cityId: 'orleans', poiId: 'maison-jeanne', text: '1429년 5월 8일, 잔 다르크가 합류한 프랑스군이 오를레앙의 포위를 풀었다. 백년전쟁의 전환점이었다.', sourceId: 'src:siege-orleans' },
  { id: 'or-fetes', cityId: 'orleans', text: '오를레앙은 1430년부터 거의 매년 5월 8일 포위 해제를 기념하는 축제(Fêtes johanniques)를 열어 왔다.', sourceId: 'src:fetes-johanniques' },
  { id: 'or-cotignac', cityId: 'orleans', text: '코티냑은 모과로 만든 젤리로, 작은 나무 상자에 담아 파는 오를레앙의 중세 이래 특산품이다.', sourceId: 'src:cotignac' },
];

export const cardById = (id: string): FactCard => {
  const c = CARDS.find((x) => x.id === id);
  if (!c) throw new Error('unknown card ' + id);
  return c;
};
