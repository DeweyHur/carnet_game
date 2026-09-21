// 손으로 쓰지 않은 장소를 위한 내용: 태그로 만든 소개문, 종류별로 돌려 쓰는 순간들, 요리 종류별 메뉴.
// 실제 가게에 대해 모르는 것을 아는 척하지 않는다 — 종류에서 흔히 기대되는 것만 말하고, 메뉴에는 그 뜻을 표시한다.
import type { Cat, Place } from './places';
import type { Dish, Moment, Tag } from './content';

const D = (name: string, fr: string, desc: string, price: number, mins: number, emoji: string, tags: Tag[], photo?: string[]): Dish => ({ name, fr, desc, price, mins, emoji, tags, photo });

/** 같은 장소는 늘 같은 변형을 고르도록 id로 해시 */
export function pickVariant<T>(id: string, arr: T[]): T {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

// ───────── 소개문 ─────────
const CUISINE_KO: [RegExp, string][] = [
  [/french|regional|local|bistro/, '프랑스 음식'], [/pizza/, '피자'], [/italian|pasta/, '이탈리아 음식'], [/thai/, '태국 음식'], [/chinese|noodle|shaanxi|cantonese|sichuan/, '중국 음식'],
  [/japanese|sushi|ramen/, '일본 음식'], [/korean/, '한국 음식'], [/vietnamese/, '베트남 음식'], [/indian/, '인도 음식'], [/lebanese|middle_eastern|falafel|israeli/, '중동 음식'],
  [/spanish|tapas/, '스페인 음식'], [/portuguese/, '포르투갈 음식'], [/american|burger|diner/, '미국식'], [/mexican/, '멕시코 음식'], [/brazilian/, '브라질 음식'], [/peruvian/, '페루 음식'],
  [/taiwanese|bubble_tea/, '대만식'], [/crepe|pancake|breton/, '크레프'], [/sandwich|wrap/, '샌드위치'], [/kebab/, '케밥'], [/seafood|fish/, '해산물'], [/vegan|vegetarian|végétarienne/, '채식'],
  [/coffee_shop|coffee/, '스페셜티 커피'], [/teahouse|tea/, '차'], [/mediterranean/, '지중해 음식'], [/asian/, '아시아 음식'], [/poke/, '포케'], [/juice/, '주스'], [/donut/, '도넛'], [/ice_cream/, '아이스크림'],
];
const cuisineKo = (c: string) => { const lc = c.toLowerCase(); return CUISINE_KO.filter(([re]) => re.test(lc)).map(([, k]) => k); };

const SHOP_KO: Record<string, string> = {
  bakery: '빵집', pastry: '파티스리', confectionery: '과자 가게', chocolate: '쇼콜라티에', cheese: '치즈 가게', deli: '식료품점', wine: '와인 가게', tea: '찻잎 가게', coffee: '원두 가게', spices: '향신료 가게',
  books: '서점', antiques: '골동품점', art: '화랑', second_hand: '빈티지 가게', music: '음반 가게', stationery: '문구점',
};
const HIST_KO: Record<string, string> = { manor: '옛 귀족 저택(오텔 파르티퀼리에)', castle: '옛 성채', memorial: '기념 명판', monument: '기념물', tower: '옛 탑', building: '오래된 건물', city_gate: '옛 성문' };
const AMEN_KO: Record<string, string> = { place_of_worship: '예배당', library: '도서관', theatre: '극장', arts_centre: '문화 공간', fountain: '분수' };

function hours(h?: string): string {
  if (!h) return '';
  if (/24\/7/.test(h)) return ' 늘 열려 있다.';
  const closed = /(Mo|Tu|We|Th|Fr|Sa|Su)[^;,]*\boff\b/.exec(h);
  const map: Record<string, string> = { Mo: '월', Tu: '화', We: '수', Th: '목', Fr: '금', Sa: '토', Su: '일' };
  if (closed) return ` ${map[closed[1]]}요일엔 쉰다.`;
  const days = /^(Mo|Tu|We|Th|Fr|Sa|Su)-(Mo|Tu|We|Th|Fr|Sa|Su)\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/.exec(h);
  if (days) return ` ${map[days[1]]}–${map[days[2]]} ${days[3]}~${days[4]}.`;
  return '';
}

/** 태그로 만드는 소개문. 없는 사실은 만들지 않는다. */
export function describe(p: Place): string {
  const t = p.tags;
  const kinds = t.cuisine ? cuisineKo(t.cuisine) : [];
  const parts: string[] = [];
  if (t.amenity === 'restaurant') parts.push(kinds.length ? `${kinds.join('·')} 식당.` : '식당.');
  else if (t.amenity === 'fast_food') parts.push(kinds.length ? `${kinds.join('·')}. 창구에서 사서 들고 걷거나 안에서 잠깐.` : '간단히 먹는 곳. 들고 걸을 수 있다.');
  else if (t.amenity === 'cafe') parts.push(kinds.length ? `${kinds.join('·')} 카페.` : '카페. 서서 마시면 더 싸다.');
  else if (t.amenity === 'bar') parts.push('바. 저녁이면 인도까지 사람들이 서서 마신다.');
  else if (t.amenity === 'pub') parts.push('펍. 경기가 있는 날엔 시끄럽다.');
  else if (t.amenity === 'ice_cream') parts.push('아이스크림 창구.');
  else if (t.shop && SHOP_KO[t.shop]) parts.push(`${SHOP_KO[t.shop]}.`);
  else if (t.tourism === 'gallery') parts.push('작은 갤러리. 문이 열려 있으면 누구나 들어가도 된다.');
  else if (t.tourism === 'museum') parts.push('박물관.');
  else if (t.tourism === 'artwork') parts.push('거리의 작품. 벽이나 모퉁이를 잘 봐야 보인다.');
  else if (t.historic && HIST_KO[t.historic]) parts.push(`${HIST_KO[t.historic]}.`);
  else if (t.amenity && AMEN_KO[t.amenity]) parts.push(`${AMEN_KO[t.amenity]}.`);
  else if (t.leisure === 'park' || t.leisure === 'garden') parts.push('작은 공원. 벤치가 있다.');
  if (t.description) parts.push(t.description);
  const h = hours(t.opening_hours);
  if (h) parts.push(h.trim());
  if (!parts.length) parts.push('지나가다 눈에 들어온 곳.');
  return parts.join(' ');
}

// ───────── 순간들 ─────────
const MOMENT_SETS: Partial<Record<Cat | 'gallery' | 'books' | 'antiques' | 'second_hand' | 'church' | 'memorial' | 'artwork' | 'manor' | 'library' | 'theatre' | 'fountain', Moment[][]>> = {
  gallery: [
    [{ text: '유리문을 민다. 안은 흰 벽과 조용한 신발 소리.', mins: 4 }, { text: '한 점 앞에서 걸음이 멈춘다. 가격표는 없다. 물어보면 알려 준다.', mins: 8 }],
    [{ text: '문에 붙은 전시 제목을 읽고 들어간다.', mins: 3 }, { text: '작가가 책상에 앉아 있다. 눈이 마주치면 고개만 끄덕인다.', mins: 8 }],
    [{ text: '진열창부터 본다. 안쪽 방이 하나 더 있다.', mins: 4 }, { text: '작은 방 하나에 큰 그림 하나.', mins: 6 }],
  ],
  books: [
    [{ text: '문에 달린 종. 종이 냄새.', mins: 3 }, { text: '한 권을 꺼내 몇 장 넘긴다. 프랑스어라 그림만 본다.', mins: 8 }],
    [{ text: '좁은 통로 양쪽으로 천장까지 책.', mins: 4 }, { text: '계산대 옆에 주인이 읽고 있던 책이 펼쳐져 있다.', mins: 6 }],
  ],
  antiques: [
    [{ text: '먼지 냄새와 놋쇠 냄새. 손대지 말라는 표지는 없다.', mins: 4 }, { text: '은식기, 낡은 지도, 누군가의 결혼 사진.', mins: 8 }],
    [{ text: '가게보다 창고 같다. 안쪽으로 갈수록 오래된 것들.', mins: 5 }, { text: '작은 것 하나를 들었다 놓는다.', mins: 6 }],
  ],
  second_hand: [
    [{ text: '옷걸이가 빽빽하다. 한쪽 끝에서부터 밀어 본다.', mins: 6 }, { text: '거울 앞에서 재킷 하나를 걸쳐 본다.', mins: 6 }],
  ],
  church: [
    [{ text: '무거운 문. 안은 몇 도 서늘하다.', mins: 3 }, { text: '뒷자리에 앉는다. 촛불 몇 개.', mins: 6 }],
    [{ text: '문이 열려 있다. 발소리가 울려서 발끝으로 걷는다.', mins: 4 }, { text: '옆 예배당의 그림 한 점.', mins: 5 }],
  ],
  memorial: [
    [{ text: '벽의 명판. 이름과 날짜. 꽃 한 송이가 꽂혀 있다.', mins: 2 }],
    [{ text: '지나치다 돌아와 읽는다. 여기서 누군가가 살았거나, 끌려갔다.', mins: 3 }],
  ],
  artwork: [
    [{ text: '모퉁이 위쪽, 타일 조각으로 된 작은 그림. 못 보고 지나가는 사람이 더 많다.', mins: 2 }],
    [{ text: '벽 한쪽의 그림. 누가 언제 그렸는지 아무 표시가 없다.', mins: 3 }],
  ],
  manor: [
    [{ text: '큰 문이 닫혀 있다. 틈으로 자갈 깔린 안뜰.', mins: 3 }, { text: '문패를 읽는다. 17세기 저택. 지금은 사무실이거나 아파트.', mins: 2 }],
    [{ text: '문이 열려 있어 안뜰까지 들어간다. 사방이 창문이라 눈치가 보인다.', mins: 5 }],
  ],
  library: [
    [{ text: '유리문 너머 열람실. 고개 숙인 사람들.', mins: 3 }, { text: '로비의 전시 몇 점만 보고 나온다.', mins: 5 }],
  ],
  theatre: [
    [{ text: '오늘 밤 공연 포스터. 표는 남았다고 쓰여 있다.', mins: 3 }],
  ],
  fountain: [
    [{ text: '돌 분수. 물이 나오는 날도 있고 아닌 날도 있다.', mins: 3 }],
  ],
  museum: [
    [{ text: '표를 끊고 첫 전시실로. 발소리가 울린다.', mins: 20 }, { text: '한 작품 앞에서 걸음이 멈춘다. 설명을 끝까지 읽는다.', mins: 25 }, { text: '기념품 가게를 지나 출구로.', mins: 10 }],
    [{ text: '입구의 안뜰부터 오래됐다. 계단을 오른다.', mins: 10 }, { text: '방을 옮길 때마다 시대가 바뀐다.', mins: 30 }, { text: '창가에서 안뜰을 내려다본다.', mins: 10 }],
  ],
  sight: [
    [{ text: '잠깐 걸음을 멈추고 올려다본다.', mins: 5 }, { text: '한 바퀴 둘러본다. 안내판은 프랑스어뿐이다.', mins: 7 }],
    [{ text: '사진 한 장. 지나가던 사람도 따라 찍는다.', mins: 4 }, { text: '안내판을 읽는다. 연도가 네 자리다.', mins: 5 }],
  ],
  park: [
    [{ text: '철문을 지나 자갈길로 들어선다.', mins: 4 }, { text: '초록색 철제 벤치에 앉는다. 비둘기, 유모차, 신문 읽는 노인.', mins: 11 }],
    [{ text: '잔디 가장자리에 앉는다. 담장 너머로 옛 지붕.', mins: 8 }, { text: '한 바퀴 돌고 나온다.', mins: 5 }],
  ],
  shop: [
    [{ text: '문에 달린 종이 울린다. 주인이 "봉주르" 하고 고개만 든다.', mins: 4 }, { text: '천천히 한 바퀴. 뭔가 하나를 들었다 놓는다.', mins: 8 }],
  ],
  gourmet: [
    [{ text: '문을 열자 냄새부터 다르다.', mins: 4 }, { text: '진열장을 끝에서 끝까지 본다. 가격표를 보고 조용히 내려놓는다.', mins: 8 }],
    [{ text: '시식을 권한다. 작은 조각 하나.', mins: 4 }, { text: '작은 병 하나를 고른다. 종이에 싸 준다.', mins: 6 }],
  ],
};

export function genericMoments(p: Place): Moment[] {
  const t = p.tags;
  const key = t.tourism === 'gallery' ? 'gallery' : t.shop === 'books' ? 'books' : t.shop === 'antiques' ? 'antiques' : t.shop === 'second_hand' ? 'second_hand'
    : t.amenity === 'place_of_worship' ? 'church' : t.historic === 'memorial' || t.historic === 'monument' ? 'memorial' : t.tourism === 'artwork' ? 'artwork'
    : t.historic === 'manor' || t.historic === 'castle' ? 'manor' : t.amenity === 'library' ? 'library' : t.amenity === 'theatre' ? 'theatre' : t.amenity === 'fountain' ? 'fountain' : p.cat;
  const sets = MOMENT_SETS[key as keyof typeof MOMENT_SETS] ?? MOMENT_SETS.sight!;
  return pickVariant(p.id, sets);
}

// ───────── 메뉴(요리 종류별) ─────────
export const CUISINE_MENUS: [RegExp, Dish[]][] = [
  [/thai/, [
    D('팟타이', 'Pad thaï', '', 14, 30, '🍜', ['savory', 'classic'], ['Pad thai']),
    D('그린 커리', 'Curry vert', '', 15, 35, '🍛', ['savory', 'classic'], ['Green curry']),
    D('타이 아이스티', 'Thé glacé thaï', '', 4, 5, '🧋', ['drink'], ['Thai tea']),
  ]],
  [/vietnam/, [
    D('쌀국수', 'Phở', '', 13, 30, '🍜', ['savory', 'classic'], ['Pho']),
    D('반미', 'Bánh mì', '', 8, 12, '🥖', ['savory', 'street'], ['Bánh mì']),
    D('연유 커피', 'Cà phê sữa đá', '', 5, 8, '🧊', ['drink', 'classic'], ['Vietnamese iced coffee']),
  ]],
  [/chinese|cantonese|sichuan|noodle|shaanxi|taiwan/, [
    D('오늘의 정식', 'Menu du jour', '', 13, 35, '🍱', ['savory']),
    D('만두 한 판', 'Raviolis', '', 9, 20, '🥟', ['savory', 'classic'], ['Jiaozi']),
    D('볶음면', 'Nouilles sautées', '', 12, 25, '🍜', ['savory', 'classic'], ['Chow mein']),
    D('버블티', 'Bubble tea', '', 5, 8, '🧋', ['drink', 'trendy'], ['Bubble tea']),
  ]],
  [/korean/, [
    D('비빔밥', 'Bibimbap', '', 15, 30, '🍚', ['savory', 'classic'], ['Bibimbap']),
    D('김치찌개', 'Kimchi jjigae', '', 15, 30, '🍲', ['savory', 'classic'], ['Kimchi-jjigae']),
    D('치맥', 'Poulet frit + bière', '', 18, 40, '🍗', ['savory', 'trendy', 'alcohol'], ['Korean fried chicken']),
  ]],
  [/indian/, [
    D('버터 치킨', 'Butter chicken', '난과 함께.', 16, 35, '🍛', ['savory', 'classic'], ['Butter chicken']),
    D('탈리', 'Thali', '한 쟁반에 조금씩.', 17, 35, '🍽️', ['savory', 'classic'], ['Thali']),
    D('라씨', 'Lassi', '', 5, 8, '🥛', ['drink', 'classic'], ['Lassi']),
  ]],
  [/mexican/, [
    D('타코 세 개', 'Tacos', '', 12, 25, '🌮', ['savory', 'street', 'classic'], ['Taco']),
    D('과카몰리와 칩', 'Guacamole', '', 8, 15, '🥑', ['savory'], ['Guacamole']),
    D('마르가리타', 'Margarita', '', 10, 20, '🍹', ['drink', 'alcohol'], ['Margarita']),
  ]],
  [/portug/, [
    D('파스텔 드 나타', 'Pastel de nata', '', 2.5, 5, '🥧', ['sweet', 'classic', 'street'], ['Pastel de nata']),
    D('바칼라우', 'Bacalhau', '소금 대구.', 18, 40, '🐟', ['savory', 'classic'], ['Bacalhau']),
    D('비카', 'Bica', '', 2, 3, '☕', ['drink']),
  ]],
  [/peru/, [
    D('세비체', 'Ceviche', '', 16, 30, '🐟', ['savory', 'classic'], ['Ceviche']),
    D('로모 살타도', 'Lomo saltado', '', 19, 40, '🥩', ['savory', 'classic'], ['Lomo saltado']),
  ]],
  [/brazil/, [
    D('페이조아다', 'Feijoada', '검은콩 스튜.', 18, 40, '🍲', ['savory', 'classic'], ['Feijoada']),
    D('카이피리냐', 'Caipirinha', '', 9, 15, '🍹', ['drink', 'alcohol', 'classic'], ['Caipirinha']),
  ]],
  [/spanish|tapas/, [
    D('타파스 세 가지', 'Tapas', '하몽·감자 브라바스·오징어.', 18, 40, '🥘', ['savory', 'classic'], ['Tapas']),
    D('토르티야', 'Tortilla', '', 8, 15, '🍳', ['savory', 'classic'], ['local:food:tortilla']),
    D('상그리아', 'Sangria', '', 7, 15, '🍹', ['drink', 'alcohol'], ['Sangria']),
  ]],
  [/lebanese|middle|falafel|israeli|kebab|turkish/, [
    D('팔라펠 피타', 'Fallafel', '', 9, 20, '🥙', ['savory', 'street'], ['Falafel']),
    D('후무스 접시', 'Houmous', '따뜻한 피타와 함께.', 10, 25, '🫓', ['savory'], ['Hummus']),
    D('케밥', 'Kebab', '', 10, 20, '🥙', ['savory', 'street'], ['Doner kebab']),
    D('민트 티', 'Thé à la menthe', '', 4, 10, '🍵', ['drink'], ['Maghrebi mint tea']),
  ]],
  [/italian|pizza|pasta/, [
    D('마르게리타', 'Margherita', '토마토, 모차렐라, 바질.', 13, 35, '🍕', ['savory', 'classic'], ['Pizza Margherita']),
    D('오늘의 파스타', 'Pâtes du jour', '칠판에 적혀 있다.', 16, 35, '🍝', ['savory'], ['Pasta']),
    D('티라미수', 'Tiramisu', '', 8, 10, '🍰', ['sweet', 'classic'], ['Tiramisu']),
    D('스프리츠', 'Spritz', '', 9, 15, '🍹', ['drink', 'alcohol', 'trendy'], ['Spritz (cocktail)']),
  ]],
  [/japanese|sushi|ramen/, [
    D('스시 모둠', 'Assortiment de sushis', '', 18, 35, '🍣', ['savory'], ['Sushi']),
    D('라멘', 'Ramen', '', 14, 30, '🍜', ['savory', 'trendy'], ['Ramen']),
    D('벤토', 'Bento', '', 15, 30, '🍱', ['savory'], ['Bento']),
    D('녹차', 'Thé vert', '', 4, 8, '🍵', ['drink']),
  ]],
  [/poke|hawai/, [D('포케 볼', 'Poke bowl', '', 13, 20, '🥗', ['savory', 'trendy'], ['Poke (dish)'])]],
  [/crepe|crêpe|breton|pancake/, [
    D('갈레트 콩플레트', 'Galette complète', '메밀 갈레트에 햄, 치즈, 달걀.', 11, 30, '🥞', ['savory', 'classic'], ['Galette-saucisse', 'fr:Galette complète']),
    D('버터 설탕 크레프', 'Crêpe beurre-sucre', '', 5, 12, '🧈', ['sweet', 'classic'], ['Crêpe']),
    D('시드르 한 사발', 'Bolée de cidre', '', 5, 10, '🍏', ['drink', 'alcohol', 'classic'], ['Cider']),
  ]],
  [/burger|american|diner/, [
    D('치즈버거와 감자튀김', 'Cheeseburger frites', '', 16, 30, '🍔', ['savory', 'trendy'], ['Cheeseburger']),
    D('팬케이크', 'Pancakes', '', 10, 25, '🥞', ['sweet', 'classic'], ['Pancake']),
    D('밀크셰이크', 'Milkshake', '', 7, 10, '🥤', ['sweet', 'drink'], ['Milkshake']),
  ]],
  [/sandwich|wrap/, [
    D('오늘의 샌드위치', 'Sandwich', '', 8, 12, '🥪', ['savory', 'street']),
    D('샐러드', 'Salade', '', 10, 15, '🥗', ['savory', 'trendy']),
    D('레모네이드', 'Citronnade', '', 4, 5, '🍋', ['drink']),
  ]],
  [/seafood|fish/, [
    D('홍합과 감자튀김', 'Moules-frites', '', 18, 35, '🦪', ['savory', 'classic'], ['local:food:moules']),
    D('굴 반 다스', 'Huîtres', '', 18, 25, '🦪', ['savory', 'classic'], ['Oyster']),
    D('오늘의 생선', 'Poisson du jour', '', 24, 45, '🐟', ['savory']),
  ]],
  [/vegan|vegetarian|végétarienne|salad/, [
    D('오늘의 한 접시', 'Assiette du jour', '채소·곡물·단백질 하나.', 15, 35, '🥗', ['savory', 'trendy']),
    D('수프', 'Soupe', '', 8, 20, '🥣', ['savory']),
    D('당근 케이크', 'Carrot cake', '', 6, 10, '🥕', ['sweet', 'trendy'], ['Carrot cake']),
  ]],
  [/coffee_shop|coffee|brunch/, [
    D('플랫 화이트', 'Flat white', '', 5, 12, '🥛', ['drink', 'trendy'], ['Flat white']),
    D('필터 커피', 'Filtre', '', 4.5, 10, '☕', ['drink', 'trendy']),
    D('아보카도 토스트', 'Avocado toast', '', 12, 25, '🥑', ['savory', 'trendy'], ['Avocado toast']),
    D('바나나 브레드', 'Banana bread', '', 4.5, 6, '🍌', ['sweet', 'trendy'], ['Banana bread']),
  ]],
  [/bubble_tea/, [D('버블티', 'Bubble tea', '', 6, 8, '🧋', ['drink', 'trendy', 'street'], ['Bubble tea'])]],
  [/teahouse|^tea$/, [
    D('차 한 주전자', 'Théière', '', 7, 25, '🫖', ['drink', 'classic']),
    D('오늘의 케이크', 'Gâteau', '', 7, 15, '🍰', ['sweet', 'classic']),
  ]],
  [/juice/, [D('생과일 주스', 'Jus pressé', '', 6, 8, '🧃', ['drink', 'trendy'])]],
  [/donut/, [D('도넛 두 개', 'Donuts', '', 6, 6, '🍩', ['sweet', 'street', 'trendy'], ['Doughnut'])]],
  [/ice_cream|glace/, [D('아이스크림 두 스쿱', '2 boules', '', 5, 8, '🍨', ['sweet', 'street'], ['Gelato'])]],
];
