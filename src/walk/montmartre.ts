// 몽마르트르(18구) 손으로 쓴 장소들.
// 주의: 걷기 엔진은 평지 전제다. 언덕은 그림으로 안 보이니 글과 계단·푸니쿨라로 알린다.
import type { Curated } from './places';
import type { Rich } from './marais';

export const CURATED_MONTMARTRE: Curated[] = [
  { match: /sacr[ée][- ]c[œoe]ur/i, name: '사크레쾨르 대성당', pos: [2.3431, 48.8867], cat: 'sight', emoji: '⛪', known: true, star: true, mins: 40,
    blurb: '파리에서 가장 높은 언덕 위의 하얀 성당. 비를 맞을수록 하얘지는 돌로 지었다. 계단 앞에 앉아 파리 전체를 내려다보는 게 절반이고, 나머지 절반은 안의 어둠과 천장 모자이크다. 입장 무료, 돔은 따로 유료.' },
  { match: /place du tertre/i, name: '테르트르 광장', pos: [2.3406, 48.8865], cat: 'sight', emoji: '🎨', known: true, star: true, mins: 25,
    blurb: '화가들이 이젤을 펴고 초상화를 그려 주는 작은 광장. 값은 부르는 게 값이라 먼저 물어야 한다. 사람이 가장 몰리는 곳이고, 여기서 한 골목만 벗어나면 갑자기 조용해진다.' },
  { match: /mus[ée]e de montmartre/i, name: '몽마르트르 박물관', pos: [2.3401, 48.8884], cat: 'museum', emoji: '🏡', star: true, cost: 15, mins: 70,
    blurb: '르누아르·위트릴로·발라동이 실제로 살며 그렸던 집. 언덕에서 가장 오래된 건물 중 하나다. 뒤편 르누아르 정원에서 포도밭과 지붕들이 내려다보이는데, 그 자리가 이 동네에서 제일 조용하다.' },
  { match: /mur des je t.aime|je t.aime/i, name: '사랑해 벽', pos: [2.3384, 48.8843], cat: 'sight', emoji: '💬', mins: 8,
    blurb: '아베스 역 옆 작은 공원의 파란 타일 벽. 311개 언어로 「사랑해」가 적혀 있다. 한국어도 있다. 사진 한 장 찍고 지나가는 곳.' },
  { match: /moulin de la galette|blute-fin/i, name: '물랭 드 라 갈레트', pos: [2.3358, 48.8876], cat: 'sight', emoji: '🌾', mins: 10,
    blurb: '르누아르가 춤추는 사람들을 그린 그 풍차. 언덕에 남은 두 대 중 하나이고, 지금은 사유지라 밖에서만 본다. 올라오는 길(rue Lepic)이 가파르다.' },
  { match: /moulin rouge/i, name: '물랭 루주', pos: [2.3323, 48.8842], cat: 'sight', emoji: '🔴', known: true, mins: 10,
    blurb: '1889년부터 그 자리의 빨간 풍차. 공연은 비싸고 예약제라, 대개는 간판만 보고 지나간다. 주변은 관광지 특유의 번잡함이 있다.' },
  { match: /maison rose/i, name: '라 메종 로즈', pos: [2.3396, 48.8886], cat: 'eat', emoji: '🌸', cost: 28, mins: 60,
    blurb: '분홍 벽에 초록 창틀. 위트릴로가 그려서 유명해진 모퉁이 집이고, 지금도 식당이다. 사진 찍는 줄이 늘 조금 있다.' },
  { match: /clos montmartre|vigne/i, name: '클로 몽마르트르 포도밭', pos: [2.3400, 48.8889], cat: 'park', emoji: '🍇', mins: 10,
    blurb: '파리 시내에 남은 몇 안 되는 포도밭. 언덕 북쪽 비탈에 1930년대부터 있다. 평소엔 담 너머로만 보고, 10월 수확 축제 때 연다.' },
  { match: /lapin agile/i, name: '오 라팽 아질', pos: [2.3407, 48.8895], cat: 'bar', emoji: '🐇', cost: 35, mins: 90,
    blurb: '피카소가 드나들던 시절 그대로의 작은 카바레. 지금도 밤마다 샹송을 부른다. 낮에는 문 닫힌 시골집처럼 보인다.' },
  { match: /place des abbesses|^abbesses$/i, name: '아베스 광장', pos: [2.3383, 48.8843], cat: 'sight', emoji: 'Ⓜ', mins: 10,
    blurb: '기마르가 만든 초록 아르누보 지하철 입구가 원형 그대로 남은 두 곳 중 하나. 역이 36m 깊이라 계단으로 올라오면 다리가 풀린다 — 엘리베이터를 타는 게 맞다.' },
  { match: /saint-pierre de montmartre/i, name: '생피에르 드 몽마르트르', pos: [2.3413, 48.8868], cat: 'sight', emoji: '🪨', mins: 12,
    blurb: '사크레쾨르 바로 옆에 붙어 있어 지나치기 쉬운, 12세기 성당. 파리에서 가장 오래된 축에 든다. 안에 로마 시대 기둥이 그대로 서 있고, 관광객이 거의 없다.' },
  { match: /halle saint-pierre/i, name: '알 생피에르', pos: [2.3448, 48.8853], cat: 'museum', emoji: '🖍️', cost: 10, mins: 50,
    blurb: '언덕 아래 옛 시장 건물에 들어선 아르 브뤼(아웃사이더 아트) 미술관. 미술 교육을 받지 않은 사람들의 그림을 모은다. 1층 서점과 카페는 그냥 들어가도 된다.' },
  { match: /espace dal[íi]|dal[íi] paris/i, name: '달리 파리', pos: [2.3400, 48.8862], cat: 'museum', emoji: '🕰️', cost: 14, mins: 45,
    blurb: '테르트르 광장 옆 지하의 달리 조각·판화 전시. 어두운 방에 녹는 시계와 코끼리들이 놓여 있다. 규모는 작다.' },
  { match: /rue lepic/i, name: '르픽 거리', pos: [2.3363, 48.8849], cat: 'gourmet', emoji: '🥖', mins: 20,
    blurb: '언덕을 감고 올라가는 장보는 거리. 아래쪽엔 채소·치즈·생선 가게가, 위로 갈수록 경사가 붙는다. 반 고흐 형제가 54번지에 살았다.' },
  { match: /marcel aym[ée]|passe-muraille/i, name: '벽을 지나가는 남자', pos: [2.3376, 48.8879], cat: 'sight', emoji: '🚶', mins: 6,
    blurb: '벽에서 반쯤 빠져나온 청동 남자. 마르셀 에메의 단편 주인공이다. 손이 반질반질한 건 다들 잡고 사진을 찍어서다.' },
  { match: /funiculaire/i, name: '몽마르트르 푸니쿨라', pos: [2.3425, 48.8857], cat: 'sight', emoji: '🚡', mins: 5,
    blurb: '계단 200여 개를 대신 올라가 주는 케이블카. 메트로 표를 그대로 쓴다(한 번 탈 때 1회권). 줄이 길면 옆 계단이 더 빠를 때도 있다.' },
];

export const RICH_MONTMARTRE: Rich[] = [
  { match: /^le consulat$/i, name: '르 콩쉴라', cat: 'cafe', emoji: '🪟', mins: 40, cost: 9,
    blurb: '모퉁이의 빨간 차양 카페. 백 년 넘게 그림에 등장한 자리라 값은 풍경 값이다.' },
  { match: /^square louise michel|^square marcel bleustein/i, name: '루이즈 미셸 공원', cat: 'park', emoji: '🪜', mins: 15,
    blurb: '사크레쾨르 앞의 계단식 잔디밭. 계단마다 사람들이 앉아 도시를 내려다보며 해가 지기를 기다린다.',
    moments: [
      { text: '계단을 한 층씩 올라간다. 오를수록 지붕이 낮아지고 하늘이 넓어진다.', mins: 6 },
      { text: '잔디 턱에 앉는다. 어디선가 기타 소리, 관광객 무리, 맥주를 파는 사람.', mins: 9 },
    ] },
  { match: /^le grenier [àa] pain|^coquelicot/i, name: '언덕 빵집', cat: 'bakery', emoji: '🥐', mins: 8, cost: 3,
    blurb: '아베스 일대의 동네 빵집. 파리 바게트 대회에서 이름이 오르내린 집들이 이 근처에 몇 있다.' },
];
