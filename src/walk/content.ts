// 장소 안에서 벌어지는 일: 관람 장면(사진·순간들)과 메뉴.
// 가격은 전부 대략값이고, 큐레이션하지 않은 가게의 메뉴는 "그 종류의 가게에서 흔한 메뉴"다(실제 메뉴 아님).
import type { Cat, Place } from './places';
import { ALL_RICH as RICH } from './rich';
import { CUISINE_MENUS, genericMoments } from './generic';

// ───────── 사진 후보 ─────────
const PLACE_PHOTOS: [RegExp, string[]][] = [
  [/보주 광장/, ['Place des Vosges']],
  [/위고의 집/, ['Maison de Victor Hugo']],
  [/카르나발레/, ['local:paris:carnavalet', 'Musée Carnavalet']],
  [/피카소/, ['file:Courtyard of the Musée National Picasso-Paris.jpg', 'Musée Picasso']],
  [/팔라펠/, ["file:L'As du Fallafel, Jewish Quarter, Paris 2015.jpg", "L'As du Fallafel", 'Rue des Rosiers']],
  [/핀켈슈타인/, ['file:Paris-Sacha Finkelsztajn-104-Rue des Rosiers 27-2017-gje.jpg', 'Rue des Rosiers']],
  [/셰 마리안/, ['file:Chez Marianne (Le Marais Paris) 01.jpg', 'Rue des Rosiers']],
  [/포체토/, ['file:Pozzetto Gelato Caffe Salato, 16 rue Vieille-du-Temple, Paris 2019.jpg']],
  [/오텔 드 쉴리/, ['Hôtel de Sully']],
  [/생폴 생루이/, ['Saint-Paul-Saint-Louis']],
  [/빌라주 생폴/, ['fr:Village Saint-Paul']],
  [/필리프 오귀스트/, ['Wall of Philip II Augustus']],
  [/쇼아/, ['Mémorial de la Shoah']],
  [/오텔 드 상스/, ['Hôtel de Sens']],
  [/코냑 제/, ['file:Cognacq-Jay hôtel de Donon.jpg', 'Musée Cognacq-Jay']],
  [/로지에 정원/, ['fr:Jardin des Rosiers – Joseph-Migneret']],
  [/마리아주 프레르/, ['file:Mariage Freres 30 rue du Bourg Tibourg Interieur.jpg', 'Mariage Frères']],
  [/역사 도서관/, ["file:Hôtel d'Angoulème Lamoignon - février 2019.jpg", 'fr:Hôtel de Lamoignon']],
];

export function placePhotoRefs(p: Place): string[] {
  const hit = PLACE_PHOTOS.find(([re]) => re.test(p.name));
  if (hit) return hit[1];
  const rich = RICH.find((r) => r.name === p.name);
  if (rich?.photos) return rich.photos;
  if (rich?.moments?.[0]?.photo) return rich.moments[0].photo;
  const wp = p.tags.wikipedia; // OSM의 wikipedia=fr:제목
  return wp ? [/^[a-z]{2}:/.test(wp) ? wp : `en:${wp}`] : [];
}

// ───────── 관람: 순간들 ─────────
export interface Moment { text: string; mins: number; photo?: string[] }

const MOMENTS: [RegExp, Moment[]][] = [
  [/보주 광장/, [
    { text: '아케이드 그늘에서 광장으로 나선다. 사방이 같은 높이, 같은 붉은 벽돌이다.', mins: 4, photo: ['file:Paris 3e Place des Vosges Arcades 896.jpg']},
    { text: '잔디 위에 사람들이 아무렇게나 누워 있다. 분수 소리가 네 군데서 들린다.', mins: 8 },
    { text: '한 바퀴 돌아 아케이드 아래로. 화랑 쇼윈도와 첼로 소리.', mins: 8, photo: ['file:Paris Place des Vosges 570.jpg']},
  ]],
  [/오텔 드 쉴리/, [
    { text: '큰길의 소음이 문 하나로 끊긴다. 자갈 깔린 안뜰, 벽마다 사계절 조각.', mins: 3, photo: ['file:Hôtel de Sully, cour intérieure.jpg']},
    { text: '두 번째 안뜰은 정원이다. 회양목 사이로 오랑주리가 보인다.', mins: 4, photo: ['file:Hôtel de Sully 07.jpg']},
    { text: '정원 구석, 눈에 잘 안 띄는 문. 밀고 나가면 보주 광장 아케이드 한복판이다.', mins: 3 },
  ]],
  [/위고의 집/, [
    { text: '삐걱이는 계단을 올라 3층. 붉은 다마스크 벽지의 응접실.', mins: 10, photo: ['file:Paris Maison de Victor Hugo Innen 6.jpg']},
    { text: '위고가 직접 디자인한 중국풍 방. 글만 쓴 사람이 아니었다.', mins: 12, photo: ['file:Maison de Victor Hugo Salon chinois 271220120 01.jpg']},
    { text: '서서 글을 쓰던 높은 책상. 창밖으로 보주 광장이 내려다보인다.', mins: 12, photo: ['file:Maison de Victor Hugo Paris 27122012 Chambre.jpg']},
  ]],
  [/카르나발레/, [
    { text: '첫 방부터 옛 파리의 가게 간판들이 천장까지 걸려 있다. 가위, 열쇠, 검은 고양이.', mins: 20, photo: ['file:Salle des enseignes 03684.jpg']},
    { text: '방마다 다른 시대의 파리. 혁명기의 방에는 바스티유 돌로 깎은 모형이 있다.', mins: 30, photo: ['file:Salle de la révolution du musée Carnavalet, 3ème arrondissement, Paris. PH10631.jpg']},
    { text: '프루스트의 침실을 통째로 옮겨 놓은 방. 코르크 벽.', mins: 15, photo: ['file:Chambre de Marcel Proust -Musée Carnavalet- Paris.jpg']},
    { text: '안뜰 정원으로 나온다. 기하학 무늬 화단 한가운데 벤치.', mins: 10, photo: ['file:Jardin du musée Carnavalet 2.jpg']},
  ]],
  [/피카소/, [
    { text: '입구의 큰 계단부터 본다. 17세기 소금세 징수인의 저택이다.', mins: 10, photo: ['file:Paris 3e Hôtel Salé Musée Picasso 116.jpg']},
    { text: '청색 시대에서 입체주의로. 방을 옮길 때마다 다른 사람이 그린 것 같다.', mins: 40, photo: ['file:Interior of Musée Picasso Paris Aug 2026.jpg']},
    { text: '꼭대기 층, 피카소가 모았던 남의 그림들. 세잔, 마티스.', mins: 25, photo: ['file:Le salon Jupiter (Musée Picasso, Paris) - Flickr - dalbera.jpg']},
    { text: '정원 쪽 테라스에서 숨을 돌린다.', mins: 10, photo: ['file:View of courtyard from Musée Picasso Paris Aug 2026.jpg']},
  ]],
  [/생폴 생루이/, [
    { text: '무거운 문을 밀면 온도가 몇 도 내려간다. 높은 돔 아래로 빛이 떨어진다.', mins: 5, photo: ['file:Paris (75004) Église Saint-Paul-Saint-Louis Intérieur 05.JPG']},
    { text: '입구 쪽 조개 모양 성수반 두 개는 빅토르 위고가 기증한 것이다.', mins: 4, photo: ['file:Paris (75004) Église Saint-Paul-Saint-Louis Intérieur 08.JPG']},
    { text: '왼쪽 통로에 들라크루아의 그림. 아무도 줄 서지 않는다.', mins: 4, photo: ['file:Paris (75004) Église Saint-Paul-Saint-Louis Intérieur 09.JPG']},
  ]],
  [/빌라주 생폴/, [
    { text: '아치 밑을 지나니 안뜰이다. 그 안뜰에서 또 다른 안뜰로 통로가 나 있다.', mins: 6, photo: ['file:Village Saint-Paul cour bleue.jpg']},
    { text: '은식기, 낡은 지도, 1950년대 조명. 가게 주인들은 서로 아는 사이 같다.', mins: 10, photo: ['file:Village Saint-Paul Cour Rabelais.jpg']},
    { text: '네 번째 안뜰쯤에서 방향을 잃는다. 어느 아치로 나가도 다른 골목이다.', mins: 5, photo: ['file:P1270246 Paris IV Village Saint-Paul rwk.jpg']},
  ]],
  [/필리프 오귀스트/, [
    { text: '농구 코트 옆으로 800년 된 성벽이 60미터쯤 서 있다. 망루 자리도 남아 있다.', mins: 4, photo: ['file:P1200050 Paris IV enceinte de Philippe-Auguste rwk.jpg']},
    { text: '아이들이 성벽에 공을 튀긴다. 아무도 대단하게 여기지 않는 게 대단하다.', mins: 3, photo: ['file:P1200054 Paris IV enceinte de Philippe-Auguste tour 1 rwk.jpg']},
  ]],
  [/쇼아/, [
    { text: '입구 마당의 돌벽에 이름이 빼곡하다. 7만 6천 명. 알파벳 순, 연도별.', mins: 15, photo: ['file:Wall of names, Memorial of the Shoah, Paris.jpg']},
    { text: '지하 납골당. 검은 대리석의 다윗의 별 아래 수용소의 재가 묻혀 있다.', mins: 10, photo: ['file:Crypte au Memorial de la Shoah (Paris).jpg']},
    { text: '상설 전시. 파리의 평범한 동네에서 벌어진 일들의 사진과 서류.', mins: 35 },
  ]],
  [/오텔 드 상스/, [
    { text: '뾰족한 망루와 총안. 파리 한복판에 중세 성채가 서 있다.', mins: 4 },
    { text: '뒤로 돌아가면 자수 놓은 듯한 프랑스식 정원. 벤치는 거의 비어 있다.', mins: 7, photo: ['file:Jardín Hôtel de Sens. 02.JPG']},
  ]],
  [/코냑 제/, [
    { text: '사마리텐 백화점 창업주 부부의 수집품. 방 하나하나가 18세기 살롱처럼 꾸며져 있다.', mins: 15, photo: ['file:Cognacq-Jay musée intérieur XVIIIe.jpg']},
    { text: '부셰, 프라고나르, 그리고 손바닥만 한 코담배갑들.', mins: 20, photo: ['file:MuséeCognacqJay-SalleWagram.JPG']},
    { text: '관람객은 나까지 넷. 마룻바닥 소리만 난다.', mins: 10, photo: ['file:Hôtel de Donon cabinet nord.jpg']},
  ]],
  [/로지에 정원/, [
    { text: '건물 사이 좁은 통로 끝에서 갑자기 초록이 열린다.', mins: 3, photo: ['file:Jardin des Rosiers - Joseph Migneret @ Paris (31114987335).jpg']},
    { text: '벤치에 앉는다. 담 너머 로지에 거리의 소음이 멀리서 들린다.', mins: 10, photo: ['file:Jardin des Rosiers - Joseph Migneret @ Paris (31000836101).jpg']},
  ]],
  [/역사 도서관/, [
    { text: '육중한 문 안쪽, 코린트식 벽기둥이 선 안뜰. 16세기 저택이다.', mins: 4, photo: ["file:Hôtel d'Angoulème Lamoignon - février 2019.jpg"]},
    { text: '열람실 창 너머로 고개 숙인 사람들이 보인다.', mins: 4, photo: ["file:Séeberger - Cour de l'hôtel Lamoignon - Rue Pavée - 24.jpg"]},
  ]],
];


export function momentsFor(p: Place): Moment[] {
  const hand = MOMENTS.find(([re]) => re.test(p.name))?.[1];
  if (hand) return hand;
  const rich = RICH.find((r) => r.name === p.name);
  if (rich?.moments) return rich.moments;
  return genericMoments(p);
}

// ───────── 먹기: 메뉴 ─────────
export type Tag = 'savory' | 'sweet' | 'drink' | 'alcohol' | 'classic' | 'trendy' | 'street';
export interface Dish { name: string; fr?: string; desc: string; price: number; mins: number; emoji: string; tags: Tag[]; photo?: string[] }
export interface Menu { dishes: Dish[]; exact: boolean; note?: string }

const D = (name: string, fr: string, desc: string, price: number, mins: number, emoji: string, tags: Tag[], photo?: string[]): Dish => ({ name, fr, desc, price, mins, emoji, tags, photo });

const CURATED_MENUS: [RegExp, Dish[]][] = [
  [/팔라펠/, [
    D('팔라펠 스페셜', 'Fallafel spécial', '피타가 터지도록 넣은 팔라펠, 튀긴 가지, 양배추, 후무스, 매운 소스. 포크를 같이 준다.', 10, 20, '🥙', ['savory', 'street', 'classic'], ['Falafel']),
    D('샤와르마 피타', 'Chawarma', '칠면조와 양고기 샤와르마. 팔라펠보다 묵직하다.', 13, 20, '🌯', ['savory', 'street'], ['Shawarma']),
    D('레모네이드', 'Citronnade', '민트를 띄운 집에서 만든 레모네이드.', 4, 3, '🍋', ['drink']),
  ]],
  [/핀켈슈타인/, [
    D('치즈케이크', 'Vatrouchka', '묵직한 동유럽식 치즈케이크 한 조각.', 5, 8, '🍰', ['sweet', 'classic'], ['Cheesecake']),
    D('양귀비씨 슈트루델', 'Strudel au pavot', '까만 양귀비씨가 꽉 찬 롤.', 4, 6, '🥐', ['sweet', 'classic'], ['Poppy seed roll']),
    D('파스트라미 샌드위치', 'Sandwich pastrami', '양파빵에 파스트라미와 오이 피클.', 9, 12, '🥪', ['savory', 'classic'], ['Pastrami']),
  ]],
  [/셰 마리안/, [
    D('메제 네 가지', 'Assiette 4 éléments', '진열장에서 네 가지를 고른다. 후무스, 가지 캐비어, 타불레, 팔라펠.', 16, 40, '🧆', ['savory', 'classic'], ['Meze']),
    D('메제 여섯 가지', 'Assiette 6 éléments', '여섯 가지. 둘이 나눠도 된다.', 21, 50, '🍽️', ['savory', 'classic'], ['Meze']),
    D('민트 티', 'Thé à la menthe', '작은 유리잔에 설탕 듬뿍.', 4, 10, '🍵', ['drink', 'classic'], ['Maghrebi mint tea']),
    D('바클라바', 'Baklava', '시럽에 절인 한 입 과자.', 4, 5, '🍯', ['sweet', 'classic'], ['Baklava']),
  ]],
  [/미즈논/, [
    D('통구이 콜리플라워', 'Chou-fleur rôti', '통째로 구워 종이에 싸서 준다. 손으로 뜯어 먹는다.', 9, 20, '🥬', ['savory', 'trendy'], ['Cauliflower']),
    D('뵈프 부르기뇽 피타', 'Pita bœuf bourguignon', '프랑스 스튜를 피타에 넣었다. 말이 안 되는데 맛있다.', 14, 20, '🥙', ['savory', 'trendy'], ['Beef bourguignon']),
    D('라타투이 피타', 'Pita ratatouille', '달걀을 얹은 라타투이.', 12, 20, '🍅', ['savory', 'trendy'], ['Ratatouille']),
  ]],
  [/카레트/, [
    D('쇼콜라 쇼', 'Chocolat chaud', '숟가락이 설 만큼 진하다. 생크림이 따로 나온다.', 9, 30, '☕', ['drink', 'sweet', 'classic'], ['Hot chocolate']),
    D('마카롱 세 개', 'Macarons', '피스타치오, 장미, 솔티드 캐러멜.', 8, 10, '🧁', ['sweet', 'classic'], ['Macaron']),
    D('밀푀유', 'Millefeuille', '바닐라 크림과 캐러멜화된 파이 세 겹.', 11, 20, '🍰', ['sweet', 'classic'], ['Mille-feuille']),
    D('클럽 샌드위치', 'Club sandwich', '광장을 보며 먹는 값이 포함돼 있다.', 22, 35, '🥪', ['savory'], ['Club sandwich']),
  ]],
  [/포체토/, [
    D('젤라토 작은 컵', 'Piccolo', '두 가지 맛. 피스타치오와 잔두야를 권한다.', 5, 8, '🍨', ['sweet', 'street'], ['Gelato']),
    D('젤라토 큰 컵', 'Grande', '세 가지 맛.', 7, 10, '🍧', ['sweet', 'street'], ['Gelato']),
    D('에스프레소', 'Espresso', '서서 한 모금에.', 2, 3, '☕', ['drink'], ['local:food:cafe']),
  ]],
  [/마리아주 프레르/, [
    D('티 살롱에서 차 한 주전자', 'Thé au salon', '수백 가지 중에서 고른다. 마르코 폴로가 가장 유명하다.', 12, 35, '🫖', ['drink', 'classic'], ['Mariage Frères']),
    D('차 100g 사 가기', 'Thé en vrac', '검은 차통에서 덜어 저울에 단다.', 14, 10, '🎁', ['classic']),
    D('둘러만 본다', '', '향만 맡아도 된다.', 0, 10, '👃', []),
  ]],
];

const BISTRO: Dish[] = [
  D('양파 수프', "Soupe à l'oignon", '치즈를 덮어 오븐에 구운 그 수프.', 11, 20, '🥣', ['savory', 'classic'], ['local:food:onion-soup']),
  D('크로크무슈', 'Croque-monsieur', '햄과 치즈, 베샤멜. 샐러드가 곁들여진다.', 13, 25, '🥪', ['savory', 'classic'], ['local:food:croque']),
  D('오늘의 요리', 'Plat du jour', '칠판에 분필로 적혀 있다. 물어보면 설명해 준다.', 17, 40, '🍲', ['savory', 'classic'], ['Pot-au-feu']),
  D('스테이크와 감자튀김', 'Steak frites', '굽기를 묻는다. "아 푸앵"이 미디엄.', 22, 45, '🥩', ['savory', 'classic'], ['Steak frites']),
  D('크렘 브륄레', 'Crème brûlée', '숟가락으로 설탕 막을 깬다.', 8, 12, '🍮', ['sweet', 'classic'], ['Crème brûlée']),
  D('와인 한 잔', 'Verre de vin', '하우스 와인.', 6, 10, '🍷', ['drink', 'alcohol'], ['Red wine']),
];
const BY_CUISINE: [RegExp, Dish[]][] = [
  [/italian|pizza/, [
    D('마르게리타', 'Margherita', '토마토, 모차렐라, 바질.', 13, 35, '🍕', ['savory', 'classic'], ['Pizza Margherita']),
    D('오늘의 파스타', 'Pâtes du jour', '칠판에 적혀 있다.', 16, 35, '🍝', ['savory'], ['Pasta']),
    D('티라미수', 'Tiramisu', '', 8, 10, '🍰', ['sweet', 'classic'], ['Tiramisu']),
    D('스프리츠', 'Spritz', '', 9, 15, '🍹', ['drink', 'alcohol', 'trendy'], ['Spritz (cocktail)']),
  ]],
  [/japanese|sushi|ramen/, [
    D('라멘', 'Ramen', '', 14, 30, '🍜', ['savory', 'trendy'], ['Ramen']),
    D('점심 벤토', 'Bento', '', 16, 35, '🍱', ['savory'], ['Bento']),
    D('녹차', 'Thé vert', '', 4, 8, '🍵', ['drink']),
  ]],
  [/crepe|crêpe|breton/, [
    D('갈레트 콩플레트', 'Galette complète', '메밀 갈레트에 햄, 치즈, 달걀.', 11, 30, '🥞', ['savory', 'classic'], ['Galette-saucisse', 'fr:Galette complète']),
    D('버터 설탕 크레프', 'Crêpe beurre-sucre', '', 5, 12, '🧈', ['sweet', 'classic'], ['Crêpe']),
    D('시드르 한 사발', 'Bolée de cidre', '사기 사발에 따라 준다.', 5, 10, '🍏', ['drink', 'alcohol', 'classic'], ['Cider']),
  ]],
  [/falafel|israeli|lebanese|middle_eastern|kebab|jewish/, [
    D('팔라펠 피타', 'Fallafel', '', 9, 20, '🥙', ['savory', 'street'], ['Falafel']),
    D('후무스 접시', 'Houmous', '따뜻한 피타와 함께.', 10, 25, '🫓', ['savory'], ['Hummus']),
    D('민트 티', 'Thé à la menthe', '', 4, 10, '🍵', ['drink'], ['Maghrebi mint tea']),
  ]],
  [/burger|american/, [
    D('치즈버거와 감자튀김', 'Cheeseburger frites', '', 16, 30, '🍔', ['savory', 'trendy'], ['Cheeseburger']),
    D('밀크셰이크', 'Milkshake', '', 7, 10, '🥤', ['sweet', 'drink'], ['Milkshake']),
  ]],
];
const BY_CAT: Partial<Record<Cat, Dish[]>> = {
  cafe: [
    D('에스프레소', 'Un café', '카운터에 서서 마시면 더 싸다.', 3, 8, '☕', ['drink', 'classic'], ['local:food:cafe']),
    D('카페 크렘', 'Café crème', '프랑스식 카페라테.', 5, 20, '🥛', ['drink', 'classic'], ['Café au lait']),
    D('쇼콜라 쇼', 'Chocolat chaud', '', 6, 20, '🍫', ['drink', 'sweet'], ['Hot chocolate']),
    D('크루아상', 'Croissant', '오전에만 있다.', 2, 5, '🥐', ['sweet', 'classic'], ['local:food:croissant']),
    D('타르트 타탱', 'Tarte Tatin', '뒤집어 구운 사과 타르트.', 8, 15, '🥧', ['sweet', 'classic'], ['Tarte Tatin']),
  ],
  bar: [
    D('와인 한 잔', 'Verre de vin', '', 6, 25, '🍷', ['drink', 'alcohol', 'classic'], ['Red wine']),
    D('생맥주', 'Un demi', '25cl. "엉 드미"라고 한다.', 5, 20, '🍺', ['drink', 'alcohol'], ['Draught beer']),
    D('샤퀴트리 플레이트', 'Planche', '소시송, 파테, 코르니숑.', 15, 35, '🥓', ['savory', 'alcohol', 'classic'], ['Charcuterie']),
    D('내추럴 와인 한 잔', 'Vin nature', '주인이 병을 보여 주며 설명한다.', 8, 25, '🍇', ['drink', 'alcohol', 'trendy'], ['Natural wine']),
  ],
  bakery: [
    D('바게트 트라디시옹', 'Tradition', '끝을 뜯어 먹으며 걷는다.', 1.4, 3, '🥖', ['savory', 'classic', 'street'], ['Baguette']),
    D('크루아상', 'Croissant', '', 1.5, 4, '🥐', ['sweet', 'classic', 'street'], ['local:food:croissant']),
    D('팽 오 쇼콜라', 'Pain au chocolat', '', 1.7, 4, '🍫', ['sweet', 'classic', 'street'], ['Pain au chocolat']),
    D('잠봉뵈르', 'Jambon-beurre', '바게트에 햄과 버터뿐. 그래서 빵집마다 다르다.', 5.5, 10, '🥪', ['savory', 'classic', 'street'], ['local:food:jambon-beurre']),
    D('플랑', 'Flan pâtissier', '두툼한 커스터드 타르트.', 3.5, 6, '🍮', ['sweet', 'classic'], ['Flan pâtissier', 'Custard tart']),
  ],
  sweet: [
    D('에클레르', 'Éclair', '초콜릿 또는 커피.', 5, 6, '🍫', ['sweet', 'classic'], ['Éclair']),
    D('마카롱 세 개', 'Macarons', '', 7, 6, '🧁', ['sweet', 'classic'], ['Macaron']),
    D('파리 브레스트', 'Paris-Brest', '프랄린 크림을 채운 바퀴 모양 슈.', 7, 8, '🥯', ['sweet', 'classic'], ['local:food:paris-brest']),
    D('아이스크림 한 스쿱', 'Une boule', '', 4, 6, '🍨', ['sweet', 'street'], ['Gelato']),
  ],
};

export function menuFor(p: Place): Menu | null {
  const cur = CURATED_MENUS.find(([re]) => re.test(p.name));
  if (cur) return { dishes: cur[1], exact: true, note: '이 집에서 유명한 것들. 가격은 대략입니다.' };
  const rich = RICH.find((r) => r.name === p.name);
  if (rich?.dishes) return { dishes: rich.dishes, exact: !!rich.menuNote, note: rich.menuNote ?? GENERIC_MENU_NOTE };
  if (rich?.moments) return null; // 볼거리로 쓴 곳
  const c = (p.tags.cuisine ?? '').toLowerCase();
  const byCuisine = c ? (CUISINE_MENUS.find(([re]) => re.test(c))?.[1] ?? BY_CUISINE.find(([re]) => re.test(c))?.[1]) : undefined;
  if (byCuisine) return { dishes: byCuisine, exact: false };
  if (p.cat === 'eat') return { dishes: BISTRO, exact: false };
  const dishes = BY_CAT[p.cat];
  return dishes ? { dishes, exact: false } : null;
}

export const GENERIC_MENU_NOTE = '이 가게의 실제 메뉴는 아니에요. 파리의 이런 가게에서 흔히 보는 메뉴와 대략 가격입니다.';
