// 벨빌·메닐몽탕(20·19·11구) 손으로 쓴 장소들. 관광지가 아니라 사람 사는 동네다.
import type { Curated } from './places';
import type { Rich } from './marais';

export const CURATED_BELLEVILLE: Curated[] = [
  { match: /parc de belleville/i, name: '벨빌 공원', photo: ['Parc de Belleville'], pos: [2.3838, 48.8714], cat: 'park', emoji: '🌆', known: true, star: true, mins: 35,
    blurb: '언덕을 계단식으로 깎아 만든 공원. 맨 위 테라스에서 파리 시내가 한눈에 들어오는데, 에펠탑이 정면으로 보이면서도 사람은 몽마르트르의 십분의 일이다. 해 질 때가 제일 좋다.' },
  { match: /rue de belleville/i, name: '벨빌 거리', photo: ['fr:Rue de Belleville'], pos: [2.3800, 48.8724], cat: 'gourmet', emoji: '🥟', star: true, mins: 30,
    blurb: '언덕을 따라 올라가는 이 동네의 중심 거리. 중국·베트남 식당과 튀니지 빵집, 아프리카 식료품점이 번갈아 나온다. 파리에서 가장 싸게, 가장 여러 나라 음식을 먹을 수 있는 거리 중 하나다.' },
  { match: /rue d[ée]noyez/i, name: '드누아예 거리', photo: ['fr:Rue Dénoyez'], pos: [2.3785, 48.8722], cat: 'sight', emoji: '🎨', star: true, mins: 15,
    blurb: '담벼락이 통째로 그라피티 캔버스인 짧은 골목. 그림이 몇 주 단위로 덮여 바뀌기 때문에 오늘 본 벽은 오늘 것이다. 재개발이 진행 중이라 해마다 모습이 달라진다.' },
  { match: /march[ée] de belleville/i, name: '벨빌 시장', pos: [2.3776, 48.8710], cat: 'gourmet', emoji: '🧺', mins: 30,
    blurb: '대로 가운데 길게 서는 노천 시장(화·금 오전). 파리에서 값이 가장 싼 시장으로 꼽힌다. 끝날 무렵엔 상인들이 목청껏 떨이를 외친다.' },
  { match: /notre-dame-de-la-croix/i, name: '노트르담 드 라 크루아', pos: [2.3861, 48.8674], cat: 'sight', emoji: '⛪', mins: 15,
    blurb: '메닐몽탕 언덕에 서서 계단 위로 솟은 큰 성당. 파리에서 노트르담 다음으로 긴 축에 드는데 관광객은 거의 없다. 앞 계단이 동네 사람들의 만남 장소.' },
  { match: /rue des cascades/i, name: '카스카드 거리', pos: [2.3855, 48.8707], cat: 'sight', emoji: '🚿', mins: 15,
    blurb: '옛날 이 언덕의 샘물을 파리로 보내던 수로 위에 난 길. 이름이 「폭포」인 이유다. 낮은 집과 담쟁이, 군데군데 남은 돌 저수구. 영화에 자주 나오는 골목이다.' },
  { match: /villa castel|rue du transvaal/i, name: '빌라 카스텔 골목', pos: [2.3849, 48.8715], cat: 'sight', emoji: '🌿', mins: 12,
    blurb: '철문 안으로 들어가면 나오는, 화분과 담쟁이로 덮인 사유 골목. 트뤼포가 여기서 찍었다. 사람이 사는 곳이니 조용히 지나간다.' },
  { match: /[ée]dith piaf|piaf/i, name: '에디트 피아프 명판', pos: [2.3825, 48.8729], cat: 'sight', emoji: '🎤', minor: true, mins: 5,
    blurb: '벨빌 거리 72번지 계단 앞 명판 — 1915년 이 집 계단에서 피아프가 태어났다고 적혀 있다. 실제로는 병원에서 태어났다는 게 정설이지만, 동네는 이 이야기를 지킨다.' },
  { match: /aux folies/i, name: '오 폴리', pos: [2.3789, 48.8722], cat: 'bar', emoji: '🍺', cost: 5, mins: 40,
    blurb: '드누아예 거리 입구의 오래된 카페. 값이 싸고 저녁이면 인도까지 사람이 넘친다. 옛날엔 피아프가 노래하던 뮤직홀이었다.' },
  { match: /la bellevilloise/i, name: '라 벨빌루아즈', pos: [2.3873, 48.8672], cat: 'bar', emoji: '🎶', cost: 12, mins: 70,
    blurb: '1877년 노동자 협동조합 건물이 지금은 공연장·전시장·식당이 섞인 문화 공간. 일요일 재즈 브런치가 유명하다.' },
  { match: /la maroquinerie/i, name: '라 마로키느리', pos: [2.3884, 48.8687], cat: 'bar', emoji: '🎸', cost: 20, mins: 90,
    blurb: '옛 가죽 공장 자리의 작은 공연장. 지금은 큰 밴드가 된 이들이 파리에서 처음 선 무대인 경우가 많다. 안뜰 테라스가 있다.' },
  { match: /r[ée]gard saint-martin|regard/i, name: '생마르탱 저수구', pos: [2.3846, 48.8703], cat: 'sight', emoji: '🪨', minor: true, mins: 6,
    blurb: '길가에 뜬금없이 서 있는 작은 돌집. 중세부터 언덕의 샘물을 모아 파리로 내려보내던 점검구다. 안내판이 없으면 창고로 보인다.' },
  { match: /rue ramponeau/i, name: '람포노 거리', pos: [2.3792, 48.8717], cat: 'shop', emoji: '🧵', mins: 12,
    blurb: '벽화와 작업실, 값싼 잡화점이 섞인 골목. 1871년 파리 코뮌의 마지막 바리케이드가 이 거리에 있었다.' },
  { match: /parc des buttes[- ]chaumont/i, name: '뷔트쇼몽 공원', pos: [2.3820, 48.8800], cat: 'park', emoji: '🏞️', mins: 45,
    blurb: '옛 채석장을 통째로 공원으로 만든 곳. 절벽 위 신전과 흔들다리, 인공 폭포가 있다. 벨빌에서 북쪽으로 조금 더 걸으면 나온다.' },
];

export const RICH_BELLEVILLE: Rich[] = [
  { match: /^le barbouquin$/i, name: '르 바르부캥', cat: 'cafe', emoji: '📖', mins: 35, cost: 5,
    blurb: '헌책이 벽을 두른 동네 카페. 책을 가져가고 두고 가도 된다. 드누아예 거리 모퉁이.' },
  { match: /^la vielleuse$|^le vieux belleville$/i, name: '옛 벨빌 카페', cat: 'bar', emoji: '🪗', mins: 60, cost: 14,
    blurb: '아코디언과 샹송이 남아 있는 옛날식 카페. 예약이 없으면 자리가 없을 때가 많다.',
    moments: [
      { text: '문을 열면 담배 없는 시대에도 남은 특유의 냄새와 아코디언 소리.', mins: 5 },
      { text: '옆 테이블 사람들이 다 아는 노래를 따라 부르기 시작한다.', mins: 20 },
    ] },
];
