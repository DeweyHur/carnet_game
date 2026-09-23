// 장소 데이터: OSM 태그 → 게임 카테고리, 그리고 손으로 고른 마레 지구 장소들.
import type { LngLat } from './graph';
import type { Rich } from './marais';

export type Cat = 'eat' | 'cafe' | 'bar' | 'bakery' | 'sweet' | 'gourmet' | 'museum' | 'sight' | 'park' | 'shop';
export type Taste = '먹기' | '카페·바' | '문화·역사' | '산책·쉼' | '가게 구경';

export const TASTE_OF: Record<Cat, Taste> = {
  eat: '먹기', bakery: '먹기', sweet: '먹기', gourmet: '먹기',
  cafe: '카페·바', bar: '카페·바',
  museum: '문화·역사', sight: '문화·역사',
  park: '산책·쉼', shop: '가게 구경',
};

export const CAT_INFO: Record<Cat, { label: string; verb: string; mins: number; cost: number }> = {
  eat: { label: '식당', verb: '들어가서 먹는다', mins: 50, cost: 22 },
  cafe: { label: '카페', verb: '앉아서 한 잔', mins: 25, cost: 5 },
  bar: { label: '바', verb: '한 잔 한다', mins: 35, cost: 8 },
  bakery: { label: '빵집', verb: '하나 사서 나온다', mins: 6, cost: 3 },
  sweet: { label: '디저트', verb: '하나 맛본다', mins: 8, cost: 5 },
  gourmet: { label: '식료품', verb: '구경한다', mins: 12, cost: 0 },
  museum: { label: '박물관·갤러리', verb: '들어가 본다', mins: 70, cost: 12 },
  sight: { label: '볼거리', verb: '잠깐 둘러본다', mins: 12, cost: 0 },
  park: { label: '공원·광장', verb: '벤치에 앉는다', mins: 15, cost: 0 },
  shop: { label: '가게', verb: '구경한다', mins: 12, cost: 0 },
};

export interface Place {
  id: string;
  name: string;
  pos: LngLat;
  cat: Cat;
  emoji: string;
  curated: boolean;
  /** 여행 전에 이미 알고 있던 곳 — 처음부터 멀리서도 핀이 보인다 */
  known?: boolean;
  blurb?: string;
  mins?: number;
  cost?: number;
  /** 명판·벽화처럼 건물이 아닌 것 — 건물을 색칠하지 않고 작은 아이콘만 */
  minor?: boolean;
  tags: Record<string, string>;
}

export interface Curated {
  match: RegExp;
  name: string;
  pos: LngLat; // OSM에서 못 찾았을 때 쓰는 대략 좌표
  cat: Cat;
  emoji: string;
  blurb: string;
  known?: boolean;
  mins?: number;
  cost?: number;
}

// 가격·시간은 전부 프로토타입용 대략값.
export const CURATED_MARAIS: Curated[] = [
  { match: /^place des vosges$/i, name: '보주 광장 Place des Vosges', pos: [2.3655, 48.8556], cat: 'park', emoji: '⛲', known: true, mins: 20,
    blurb: '1612년에 완성된, 파리에서 가장 오래된 계획 광장. 사방이 똑같은 붉은 벽돌 건물과 아케이드로 둘러싸여 있다. 잔디에 앉은 사람들 틈에 끼면 된다.' },
  { match: /maison de victor hugo/i, name: '빅토르 위고의 집', pos: [2.3661, 48.8548], cat: 'museum', emoji: '🖋️', cost: 0, mins: 40,
    blurb: '보주 광장 모퉁이 6번지. 위고가 1832년부터 16년을 살며 《레 미제라블》의 상당 부분을 쓴 아파트. 상설 전시는 무료.' },
  { match: /mus[ée]e carnavalet/i, name: '카르나발레 박물관', pos: [2.3625, 48.8574], cat: 'museum', emoji: '🏛️', cost: 0, mins: 75,
    blurb: '파리라는 도시 자체의 역사 박물관. 옛 가게 간판들이 걸린 방이 유명하다. 상설 전시는 무료라서 부담 없이 들어갈 수 있다.' },
  { match: /mus[ée]e (national )?picasso/i, name: '피카소 미술관', pos: [2.3623, 48.8598], cat: 'museum', emoji: '🎨', known: true, cost: 16, mins: 90,
    blurb: '17세기 저택 오텔 살레(Hôtel Salé) 안에 있는 피카소 컬렉션. 건물 계단만 봐도 값을 한다.' },
  { match: /as du fa/i, name: "라스 뒤 팔라펠 L'As du Fallafel", pos: [2.3591, 48.8574], cat: 'eat', emoji: '🥙', known: true, cost: 10, mins: 25,
    blurb: '로지에 거리의 그 줄. 창구에서 사서 걸으면서 먹는 게 정석이다. 안식일인 토요일에는 문을 닫는다.' },
  { match: /finkelsztajn|boutique jaune/i, name: '사샤 핀켈슈타인 (노란 가게)', pos: [2.3597, 48.8572], cat: 'bakery', emoji: '🥯', cost: 5, mins: 8,
    blurb: '1946년부터 같은 자리를 지킨 노란 간판의 유대식 빵집. 치즈케이크와 양귀비씨 과자. 멀리서도 간판 색이 눈에 띈다.' },
  { match: /chez marianne/i, name: '셰 마리안', pos: [2.3583, 48.8575], cat: 'eat', emoji: '🧆', cost: 18, mins: 45,
    blurb: '모퉁이에 자리한 중동·유대식 메제 집. 여러 가지를 조금씩 골라 한 접시로 받는다.' },
  { match: /miznon/i, name: '미즈논 Miznon', pos: [2.3583, 48.8568], cat: 'eat', emoji: '🥬', cost: 13, mins: 30,
    blurb: '피타에 뭐든 넣어 주는 시끄럽고 유쾌한 집. 통으로 구운 콜리플라워가 명물.' },
  { match: /h[ôo]tel de sully/i, name: '오텔 드 쉴리', pos: [2.3641, 48.8548], cat: 'sight', emoji: '🚪', mins: 10,
    blurb: '17세기 귀족 저택. 안뜰을 끝까지 가로지르면 구석의 작은 문이 보주 광장 아케이드로 곧장 통한다. 아는 사람만 쓰는 지름길.' },
  { match: /saint-paul-saint-louis/i, name: '생폴 생루이 성당', pos: [2.3616, 48.8546], cat: 'sight', emoji: '⛪', mins: 12,
    blurb: '17세기 예수회 성당. 큰길에서 보면 정면이 갑자기 골목 끝에 솟아 있다. 안은 조용하고 서늘하다.' },
  { match: /village saint-paul/i, name: '빌라주 생폴', pos: [2.362, 48.8533], cat: 'shop', emoji: '🪞', mins: 20,
    blurb: '건물 사이 안뜰들이 미로처럼 이어지는 골동품·공방 골목. 아치 입구를 모르면 그냥 지나치기 쉽다.' },
  { match: /enceinte de philippe|philippe[- ]auguste/i, name: '필리프 오귀스트 성벽', pos: [2.3611, 48.8533], cat: 'sight', emoji: '🧱', mins: 6,
    blurb: '12세기 말 파리를 둘러쌌던 성벽의 가장 긴 잔존 구간. 지금은 학교 운동장 담장 노릇을 한다.' },
  { match: /m[ée]morial de la shoah/i, name: '쇼아 기념관', pos: [2.3563, 48.8549], cat: 'museum', emoji: '🕯️', cost: 0, mins: 60,
    blurb: '프랑스에서 강제 이송된 유대인들의 이름이 새겨진 벽이 입구에 있다. 입장 무료.' },
  { match: /h[ôo]tel de sens|biblioth[èe]que forney/i, name: '오텔 드 상스', pos: [2.359, 48.8535], cat: 'sight', emoji: '🏰', mins: 10,
    blurb: '파리에 몇 안 남은 중세 저택. 뾰족한 망루가 달려 있고, 뒤편 정원은 누구나 들어갈 수 있다.' },
  { match: /cognacq/i, name: '코냑 제 박물관', pos: [2.3616, 48.8584], cat: 'museum', emoji: '🖼️', cost: 0, mins: 45,
    blurb: '백화점 창업주 부부가 모은 18세기 미술을 저택에 걸어 둔 작은 박물관. 상설 전시는 무료이고 한산하다.' },
  { match: /jardin des rosiers/i, name: '로지에 정원', pos: [2.3605, 48.8575], cat: 'park', emoji: '🌿', mins: 12,
    blurb: '건물들 뒤에 숨은 작은 정원. 로지에 거리의 인파에서 열 걸음만 벗어나면 된다.' },
  { match: /mariage fr[èe]res/i, name: '마리아주 프레르', pos: [2.356, 48.8575], cat: 'gourmet', emoji: '🫖', mins: 15, cost: 0,
    blurb: '1854년에 문을 연 홍차 상점. 검은 차통이 벽을 가득 채우고 있다. 안쪽에 티 살롱이 있다.' },
  { match: /^carette/i, name: '카레트 Carette', pos: [2.3648, 48.856], cat: 'cafe', emoji: '🍰', cost: 12, mins: 35,
    blurb: '보주 광장 아케이드 아래의 살롱 드 테. 진한 쇼콜라 쇼와 광장 풍경.' },
  { match: /pozzetto/i, name: '포체토 Pozzetto', pos: [2.3571, 48.8565], cat: 'sweet', emoji: '🍨', cost: 5, mins: 8,
    blurb: '창구에서 떠 주는 이탈리아식 젤라토. 들고 걸으면 된다.' },
  { match: /biblioth[èe]que historique|lamoignon/i, name: '파리 역사 도서관', pos: [2.362, 48.857], cat: 'sight', emoji: '📚', mins: 8,
    blurb: '16세기 저택 오텔 드 라무아뇽에 들어선 도서관. 안뜰까지는 그냥 들어가 볼 수 있다.' },
];

const GENERIC: [string, RegExp, Cat, string][] = [
  ['tourism', /^museum$/, 'museum', '🏛️'],
  ['tourism', /^gallery$/, 'museum', '🖼️'],
  ['tourism', /^artwork$/, 'sight', '🎨'],
  ['tourism', /^(attraction|viewpoint)$/, 'sight', '✨'],
  ['historic', /^(memorial|monument)$/, 'sight', '🪧'],
  ['historic', /^(manor|castle|building|city_gate|tower)$/, 'sight', '🏰'],
  ['historic', /./, 'sight', '🏛️'],
  ['amenity', /^fountain$/, 'sight', '⛲'],
  ['leisure', /^(park|garden)$/, 'park', '🌳'],
  ['amenity', /^restaurant$/, 'eat', '🍽️'],
  ['amenity', /^fast_food$/, 'eat', '🥙'],
  ['amenity', /^cafe$/, 'cafe', '☕'],
  ['amenity', /^(bar|pub)$/, 'bar', '🍷'],
  ['amenity', /^ice_cream$/, 'sweet', '🍨'],
  ['amenity', /^place_of_worship$/, 'sight', '⛪'],
  ['amenity', /^(library|theatre|arts_centre)$/, 'sight', '🎭'],
  ['shop', /^bakery$/, 'bakery', '🥖'],
  ['shop', /^(pastry|confectionery|chocolate)$/, 'sweet', '🍫'],
  ['shop', /^(cheese|deli|wine|tea|coffee|spices)$/, 'gourmet', '🧀'],
  ['shop', /^(books|antiques|art|second_hand|music|stationery)$/, 'shop', '📖'],
];

/** 구워 둔 지구 데이터의 한 장소(태그 그대로) */
export interface RawPlace { id: string; pos: LngLat; tags: Record<string, string> }

export function parsePlaces(raw: RawPlace[], curated: Curated[], rich: Rich[]): Place[] {
  const out: Place[] = [];
  const usedCurated = new Set<Curated>();
  const usedRich = new Set<Rich>();
  for (const e of raw) {
    const tags = e.tags;
    if (!tags?.name) continue;
    const cur = curated.find((c) => c.match.test(tags.name));
    if (cur) {
      if (usedCurated.has(cur)) continue;
      usedCurated.add(cur);
      out.push({ id: e.id, pos: e.pos, curated: true, tags, ...pick(cur) });
      continue;
    }
    const r = rich.find((x) => x.match.test(tags.name));
    if (r) {
      if (usedRich.has(r)) continue;
      usedRich.add(r);
      out.push({ id: e.id, pos: e.pos, curated: true, tags, name: r.name, cat: r.cat, emoji: r.emoji, blurb: r.blurb, mins: r.mins, cost: r.cost });
      continue;
    }
    const g = GENERIC.find(([k, re]) => tags[k] !== undefined && re.test(tags[k]));
    if (!g) continue;
    const minor = tags.historic === 'memorial' || tags.historic === 'monument' || tags.tourism === 'artwork';
    out.push({ id: e.id, name: tags.name, pos: e.pos, cat: g[2], emoji: g[3], curated: false, minor, tags });
  }
  for (const cur of curated) {
    if (!usedCurated.has(cur)) out.push({ id: `cur-${cur.name}`, pos: cur.pos, curated: true, tags: {}, ...pick(cur) });
  }
  return thin(out);
}

const pick = (c: Curated) => ({ name: c.name, cat: c.cat, emoji: c.emoji, blurb: c.blurb, known: c.known, mins: c.mins, cost: c.cost });

/** 같은 자리에 겹친 일반 장소를 솎아낸다(큐레이션 장소는 항상 남긴다). */
function thin(list: Place[]): Place[] {
  const kept: Place[] = list.filter((p) => p.curated);
  const near = (a: Place, b: Place) => Math.abs(a.pos[0] - b.pos[0]) < 0.00011 && Math.abs(a.pos[1] - b.pos[1]) < 0.00007;
  for (const p of list) if (!p.curated && !kept.some((k) => near(k, p))) kept.push(p);
  return kept;
}
