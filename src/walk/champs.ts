// 샹젤리제·에투알(8구) 손으로 쓴 장소들. 블록이 크고 대로가 넓다 — 골목의 재미 대신 규모의 재미.
import type { Curated } from './places';
import type { Rich } from './marais';

export const CURATED_CHAMPS: Curated[] = [
  { match: /arc de triomphe/i, name: '개선문', photo: ['Arc de Triomphe'], pos: [2.2950, 48.8738], cat: 'museum', emoji: '🏛️', known: true, star: true, cost: 16, mins: 60,
    blurb: '열두 개 대로가 별처럼 모이는 한복판. 길을 건너지 말고 샹젤리제 쪽 지하도로 들어가야 한다(위험해서 횡단보도가 없다). 284계단을 올라가면 파리에서 가장 파리다운 전망 — 에펠탑이 나오는 사진은 여기서 찍힌다. 아래엔 무명용사의 불꽃.' },
  { match: /champs-[ée]lys[ée]es/i, name: '샹젤리제 거리', photo: ['Avenue des Champs-Élysées'], pos: [2.3050, 48.8710], cat: 'sight', emoji: '🛣️', known: true, star: true, mins: 40,
    blurb: '개선문에서 콩코르드까지 1.9km 곧게 뻗은 대로. 위쪽 절반은 브랜드 매장과 사람, 아래쪽 절반은 갑자기 나무 그늘과 공원이 된다. 걸어 보면 생각보다 길다 — 끝까지 걸을 생각이면 30분은 잡아야 한다.' },
  { match: /petit palais/i, name: '프티 팔레', photo: ['Petit Palais'], pos: [2.3147, 48.8661], cat: 'museum', emoji: '🖼️', star: true, cost: 0, mins: 70,
    blurb: '1900년 만국박람회 때 지은 건물이 그대로 시립미술관. 상설 전시가 무료다. 가운데 반원형 안뜰 정원에 카페가 있는데, 이 동네에서 가장 조용히 쉴 수 있는 자리다.' },
  { match: /grand palais/i, name: '그랑 팔레', pos: [2.3125, 48.8661], cat: 'sight', emoji: '🪟', mins: 20,
    blurb: '유리와 철골로 된 거대한 지붕. 대형 전시와 행사 때만 열리고, 평소엔 밖에서 그 지붕을 올려다본다. 프티 팔레와 길 하나를 사이에 두고 마주 본다.' },
  { match: /avenue montaigne/i, name: '몽테뉴 거리', pos: [2.3035, 48.8665], cat: 'shop', emoji: '👜', mins: 20,
    blurb: '샹젤리제에서 갈라져 나온 명품 거리. 사는 곳이라기보다 쇼윈도와 건물을 보는 거리다. 샹젤리제보다 훨씬 조용하다.' },
  { match: /th[ée][âa]tre des champs-[ée]lys[ée]es/i, name: '샹젤리제 극장', pos: [2.3020, 48.8659], cat: 'sight', emoji: '🎭', mins: 12,
    blurb: '1913년 스트라빈스키 「봄의 제전」 초연 때 관객이 야유하며 난장판이 된 그 극장. 겉은 밋밋한 콘크리트 같지만, 철근 콘크리트로 지은 최초의 극장 건물이다.' },
  { match: /jacquemart-andr[ée]/i, name: '자크마르앙드레 미술관', photo: ['Musée Jacquemart-André'], pos: [2.3105, 48.8757], cat: 'museum', emoji: '🕯️', star: true, cost: 17, mins: 80,
    blurb: '19세기 수집가 부부의 저택을 그대로 둔 미술관. 겨울 정원과 대리석 계단이 집 자체의 볼거리고, 티 살롱은 파리에서 가장 아름다운 카페로 자주 꼽힌다. 큰 미술관에 지쳤을 때 오는 곳.' },
  { match: /saint-philippe-du-roule/i, name: '생필리프뒤룰 성당', pos: [2.3097, 48.8729], cat: 'sight', emoji: '🏛️', mins: 12,
    blurb: '신전처럼 생긴 18세기 성당. 큰길가에 있는데도 안은 늘 비어 있어 잠깐 앉기 좋다.' },
  { match: /rue de ponthieu/i, name: '퐁티외 거리', pos: [2.3080, 48.8715], cat: 'eat', emoji: '🍽️', mins: 20,
    blurb: '샹젤리제 바로 뒤에 숨은 좁은 거리. 대로변 값의 절반쯤 하는 식당과 바가 늘어서 있다. 점심때 이 동네에서 일하는 사람들이 여기로 넘어온다.' },
  { match: /rue washington|rue de berri/i, name: '워싱턴·베리 거리', pos: [2.3020, 48.8725], cat: 'gourmet', emoji: '🧀', mins: 15,
    blurb: '대로에서 한 블록만 들어오면 나오는 생활 골목. 빵집과 치즈 가게, 동네 카페가 있다. 샹젤리제에 관광객만 사는 게 아니라는 증거.' },
  { match: /drugstore publicis/i, name: '퓌블리시스 드럭스토어', pos: [2.2963, 48.8724], cat: 'shop', emoji: '💊', mins: 15,
    blurb: '개선문 앞 유리 건물. 서점·약국·식당·영화관이 한데 있고 늦게까지 연다. 밤에 뭔가 필요해지면 이 동네에서는 여기다.' },
  { match: /place de la concorde/i, name: '콩코르드 광장', pos: [2.3213, 48.8656], cat: 'sight', emoji: '🗿', mins: 20,
    blurb: '샹젤리제 동쪽 끝. 가운데 이집트 오벨리스크가 서 있고, 혁명기에 단두대가 놓였던 자리다. 광장이 워낙 넓어 건너는 데만 한참 걸린다.' },
  { match: /lido|^l.atelier|fouquet/i, name: '대로변 노포', pos: [2.3010, 48.8713], cat: 'cafe', emoji: '☕', cost: 12, mins: 40,
    blurb: '샹젤리제 대로변의 오래된 카페·브라스리들. 커피 한 잔 값이 놀랍지만, 그 값에 사는 건 이 대로를 마주 보는 테라스 자리다.' },
];

export const RICH_CHAMPS: Rich[] = [
  { match: /^jardin des champs-[ée]lys[ée]es|^jardins des champs/i, name: '샹젤리제 정원', cat: 'park', emoji: '🌳', mins: 20,
    blurb: '대로 아래쪽 절반을 감싼 나무 그늘. 매장이 끝나고 갑자기 공원이 시작되는 지점이 이 거리의 반전이다.',
    moments: [
      { text: '매장 유리가 끝나고 나무가 시작된다. 소리가 한 겹 줄어든다.', mins: 6 },
      { text: '벤치에 앉는다. 회전목마 소리와 멀리 그랑 팔레의 유리 지붕.', mins: 12 },
    ] },
];
