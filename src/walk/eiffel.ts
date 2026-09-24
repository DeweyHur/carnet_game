// 에펠탑 둘레(7·15·16구): 샹드마르스·트로카데로·센 강변. 게임이 여기서 시작한다(낙하산).
// OSM 원본을 구울 수 없는 곳이라 손으로 그린 길과 장소를 샹젤리제 지구 데이터에 덧붙인다.
// 좌표는 탑을 원점으로 한 축 좌표(u = 샹드마르스 쪽 남동 133.6°, v = 북동 43.6°, 미터)로 적고 경위도로 바꾼다.
import type { LngLat } from './graph';
import type { Curated } from './places';
import type { RawPlace } from './places';
import type { WalkData } from './data';

export const EIFFEL_POS: LngLat = [2.29448, 48.85826];
const AX = (133.6 * Math.PI) / 180, AY = (43.6 * Math.PI) / 180;
const M_LNG = 111320 * Math.cos((48.858 * Math.PI) / 180), M_LAT = 111130;

/** 축 좌표(m) → 경위도 */
export function ax(u: number, v: number): LngLat {
  const e = u * Math.sin(AX) + v * Math.sin(AY);
  const n = u * Math.cos(AX) + v * Math.cos(AY);
  return [EIFFEL_POS[0] + e / M_LNG, EIFFEL_POS[1] + n / M_LAT];
}
/** 경위도 → 축 좌표(m) */
export function toAx(p: LngLat): [number, number] {
  const e = (p[0] - EIFFEL_POS[0]) * M_LNG, n = (p[1] - EIFFEL_POS[1]) * M_LAT;
  return [e * Math.sin(AX) + n * Math.cos(AX), e * Math.sin(AY) + n * Math.cos(AY)];
}

type UV = [number, number];
const line = (...pts: UV[]) => pts.map(([u, v]) => ax(u, v));
// 길은 축 좌표로 모아 두었다가 서로 만나는 점에 꼭짓점을 넣고(그래야 그래프에서 이어진다) 경위도로 바꾼다
const uvl = (...pts: UV[]): UV[] => pts;
const seg = (u0: number, v0: number, u1: number, v1: number): UV[] => [[u0, v0], [u1, v1]];

/** 교차점·T자 접점에 꼭짓점을 넣는다(0.5 m로 반올림 — 양쪽 길이 같은 점을 갖게) */
function node(polys: UV[][]): UV[][] {
  const r = (x: number) => Math.round(x * 2) / 2;
  const segs: { a: UV; b: UV; pi: number; si: number }[] = [];
  polys.forEach((pl, pi) => { for (let si = 0; si + 1 < pl.length; si++) segs.push({ a: pl[si], b: pl[si + 1], pi, si }); });
  const extra = polys.map((pl) => pl.map(() => [] as { t: number; p: UV }[]));
  const add = (s: { a: UV; b: UV; pi: number; si: number }, t: number, p: UV) => extra[s.pi][s.si].push({ t, p });
  for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
    const A = segs[i], B = segs[j];
    if (A.pi === B.pi && Math.abs(A.si - B.si) <= 1) continue;
    const dx1 = A.b[0] - A.a[0], dy1 = A.b[1] - A.a[1], dx2 = B.b[0] - B.a[0], dy2 = B.b[1] - B.a[1];
    const den = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(den) < 1e-9) continue;
    const ex = B.a[0] - A.a[0], ey = B.a[1] - A.a[1];
    const t = (ex * dy2 - ey * dx2) / den, u = (ex * dy1 - ey * dx1) / den;
    const L1 = Math.hypot(dx1, dy1), L2 = Math.hypot(dx2, dy2);
    const e1 = 3 / L1, e2 = 3 / L2; // 끝이 3 m 안에서 멈춰도 만난 것으로(T자)
    if (t < -e1 || t > 1 + e1 || u < -e2 || u > 1 + e2) continue;
    const p: UV = [r(A.a[0] + dx1 * t), r(A.a[1] + dy1 * t)];
    add(A, Math.max(0, Math.min(1, t)), p);
    add(B, Math.max(0, Math.min(1, u)), p);
  }
  return polys.map((pl, pi) => {
    const out: UV[] = [];
    const push = (p: UV) => { const q: UV = [r(p[0]), r(p[1])]; const l = out[out.length - 1]; if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q); };
    // 원래 꼭짓점과 만난 점을 순서대로(끝이 3 m 모자라게 멈춘 길은 짧은 토막으로 이어진다)
    for (let si = 0; si < pl.length; si++) {
      push(pl[si]);
      if (si + 1 < pl.length) for (const h of extra[pi][si].sort((a, b) => a.t - b.t)) push(h.p);
    }
    const dense: UV[] = [];
    for (let i = 0; i < out.length; i++) {
      if (i) { const a = out[i - 1], b = out[i]; const n = Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / 60); for (let k = 1; k <= n; k++) dense.push([r(a[0] + ((b[0] - a[0]) * k) / (n + 1)), r(a[1] + ((b[1] - a[1]) * k) / (n + 1))]); }
      dense.push(out[i]);
    }
    return dense;
  });
}

// 센 강: 남쪽 강둑(케 브랑리)과 북쪽 강둑(뉴욕 거리). 비르아켐 다리 → 이에나 다리 → 알마 다리 쪽으로 휘어진다.
const QUAI: [number, number][] = [[-133, -700], [-133, -581], [-160, -300], [-168, 0], [-150, 200], [-130, 350], [-60, 600], [15, 787], [60, 900]];
const NORTH = QUAI.map(([u, v]) => [u - 168, v] as [number, number]);

// 샹드마르스 가로·세로 길 (u 위치)
const CROSS = [90, 300, 480, 680, 880];

function ways(): { ways: LngLat[][]; links: LngLat[][] } {
  const w: UV[][] = [];
  // 강변 두 길
  w.push(QUAI, NORTH);
  // 다리: 비르아켐 · 이에나 · 알마
  w.push(seg(-133, -581, -301, -581), seg(-168, 0, -336, 0), seg(15, 787, -153, 787));
  // 탑 발밑 광장(구스타브 에펠 거리)과 탑 둘레 고리
  w.push(seg(-100, -175, -100, 175));
  w.push(uvl([-100, -70], [-60, -75], [0, -80], [60, -75], [95, -40], [100, 0], [95, 40], [60, 75], [0, 80], [-60, 75], [-100, 70]));
  // 이에나 다리 → 탑 밑 → 샹드마르스 가운데 축
  w.push(seg(-168, 0, -100, 0), seg(100, 0, 880, 0));
  // 쉬프랑 대로(남서)·부르도네 대로(북동)와 그 안쪽 산책길
  w.push(seg(-160, -175, 960, -175), seg(-150, 175, 960, 175));
  w.push(seg(90, -95, 900, -95), seg(90, 95, 900, 95));
  for (const u of CROSS) w.push(seg(u, -175, u, 175));
  // 에콜 밀리테르 앞(퐁트누아 광장 쪽) — 라모트피케 대로
  w.push(seg(960, -620, 960, 700));
  // 7구 골목(북동): 클레르 거리 시장 등
  for (const v of [300, 420, 560]) w.push(seg(v === 560 ? -90 : 60, v, 900, v));
  for (const u of [100, 250, 420, 600, 780]) w.push(seg(u, 175, u, 700));
  // 라프 대로: 알마 다리에서 사선으로
  w.push(uvl([15, 787], [120, 690], [250, 560], [300, 420]));
  // 15구 골목(남서)
  for (const v of [-300, -430, -560]) w.push(seg(-100, v, 900, v));
  for (const u of [100, 260, 440, 620, 800]) w.push(seg(u, -175, u, -620));
  // 트로카데로 정원: 가운데 계단 축·양옆 굽은 길·분수 둘레
  w.push(seg(-336, 0, -700, 0));
  w.push(uvl([-336, -40], [-380, -110], [-470, -150], [-520, -160]));
  w.push(uvl([-336, 40], [-380, 110], [-470, 150], [-520, 160]));
  w.push(seg(-420, -150, -420, 150), seg(-520, -330, -520, 330));
  // 샤요 궁 날개 바깥으로 도는 길(날개 사이 틈으로는 가운데 축이 지나간다)
  w.push(uvl([-520, -330], [-470, -350], [-330, -340]));
  w.push(uvl([-520, 330], [-470, 350], [-330, 340]));
  // 뉴욕 거리 → 트로카데로 양옆
  w.push(seg(-330, -340, -318, -300), seg(-330, 340, -290, 350));
  // 트로카데로 광장
  w.push(uvl([-700, 0], [-720, -60], [-760, -80], [-800, -60], [-820, 0], [-800, 60], [-760, 80], [-720, 60], [-700, 0]));
  // 이어 붙일 길(샹젤리제 지구 데이터의 가장 가까운 점에 끝을 붙인다):
  //  이에나 거리(트로카데로 → 에투알), 클레베르 거리, 알마 광장 → 조르주 5세 거리, 마르소 거리, 프레지당 윌슨 거리
  const links: LngLat[][] = [
    line([-760, 80], [-860, 360], [-960, 640], [-1060, 900]),
    line([-800, 60], [-930, 300], [-1100, 620]),
    line([-153, 787], [-260, 920], [-360, 1060]),
    line([-153, 787], [-330, 880], [-500, 960]),
    line([-700, 0], [-620, 300], [-480, 560], [-300, 740], [-153, 787]),
  ];
  return { ways: node(w).map((pl) => pl.map(([u, v]) => ax(u, v))), links };
}

/** 건물을 세우지 않는 곳(공원·강·광장) — 축 좌표 다각형 */
export interface Zone { kind: 'park' | 'water' | 'plaza'; ring: LngLat[] }
const rect = (u0: number, v0: number, u1: number, v1: number) => line([u0, v0], [u1, v0], [u1, v1], [u0, v1], [u0, v0]);
export const EIFFEL_ZONES: Zone[] = [
  { kind: 'park', ring: rect(-150, -170, 960, 170) }, // 샹드마르스(탑 발밑 포함)
  { kind: 'water', ring: [...line(...QUAI.map(([u, v]) => [u - 6, v] as [number, number])), ...line(...NORTH.map(([u, v]) => [u + 6, v] as [number, number]).reverse()), ax(QUAI[0][0] - 6, QUAI[0][1])] },
  { kind: 'park', ring: rect(-600, -300, -340, 300) }, // 트로카데로 정원
  { kind: 'plaza', ring: rect(-660, -300, -600, 300) }, // 인권 광장(샤요 궁 앞)
  { kind: 'plaza', ring: rect(-840, -110, -690, 110) }, // 트로카데로 광장
  { kind: 'park', ring: rect(-60, 330, 60, 500) }, // 케 브랑리 박물관 정원
];

// 가게·카페(일반 장소) — 길에서 6 m쯤 떨어진 자리(가게 앞을 찾을 수 있게)
const P = (id: string, u: number, v: number, t: Record<string, string>): RawPlace => ({ id: `eiffel-${id}`, pos: ax(u, v), tags: t });
const PLACES: RawPlace[] = [
  // 클레르 거리(v = 420) 시장 골목
  P('cler1', 330, 426, { name: 'Café du Marché', amenity: 'cafe' }),
  P('cler2', 380, 414, { name: 'Fromagerie Cler', shop: 'cheese' }),
  P('cler3', 470, 426, { name: 'Boulangerie du Champ de Mars', shop: 'bakery' }),
  P('cler4', 520, 414, { name: 'Le Petit Cler', amenity: 'restaurant' }),
  P('cler5', 560, 426, { name: 'Chocolatier Cler', shop: 'chocolate' }),
  P('cler6', 640, 414, { name: 'Primeur de la rue Cler', shop: 'greengrocer' }),
  P('cler7', 700, 426, { name: 'Le Tourville', amenity: 'bar' }),
  // 생도미니크 거리(u = 250)
  P('dom1', 256, 240, { name: 'Café Saint-Dominique', amenity: 'cafe' }),
  P('dom2', 244, 350, { name: 'Crêperie de la Tour', amenity: 'restaurant', cuisine: 'crepe' }),
  P('dom3', 256, 480, { name: 'Librairie du Gros Caillou', shop: 'books' }),
  P('dom4', 244, 620, { name: 'Pâtisserie Saint-Dominique', shop: 'pastry' }),
  // 부르도네 대로 가
  P('bou1', 150, 181, { name: 'Brasserie de la Tour', amenity: 'restaurant' }),
  P('bou2', 400, 181, { name: 'Le Champ de Mars', amenity: 'cafe' }),
  P('bou3', 640, 181, { name: 'Glacier du Parc', amenity: 'ice_cream' }),
  // 쉬프랑 대로 가(남서)
  P('suf1', 200, -181, { name: 'Café Suffren', amenity: 'cafe' }),
  P('suf2', 460, -181, { name: 'Bistrot du 15e', amenity: 'restaurant' }),
  P('suf3', 720, -181, { name: 'Boulangerie Suffren', shop: 'bakery' }),
  P('fed1', 106, -380, { name: 'Le Bir-Hakeim', amenity: 'bar' }),
  P('fed2', 266, -500, { name: 'Épicerie Fine Grenelle', shop: 'deli' }),
  // 트로카데로 광장
  P('tro1', -760, 96, { name: 'Café du Trocadéro', amenity: 'cafe' }),
  P('tro2', -800, -76, { name: 'Carette', amenity: 'cafe' }),
];

/** 손으로 쓴 볼거리 */
export const CURATED_EIFFEL: Curated[] = [
  { match: /^tour eiffel$/i, name: '에펠탑', pos: EIFFEL_POS, cat: 'sight', emoji: '🗼', known: true, star: true, cost: 29, mins: 90,
    blurb: '1889년 만국박람회의 입구로 지은 324 m 철탑. 원래 20년 뒤 헐 예정이었다. 2층까지는 계단(674칸)으로도 오를 수 있고, 밤이면 매 정시 5분 동안 반짝인다. 게임에서는 다리를 타고 꼭대기까지 오를 수 있다.' },
  { match: /champ-de-mars/i, name: '샹드마르스 공원', pos: ax(450, 0), cat: 'park', emoji: '🌳', known: true, star: true, mins: 30,
    blurb: '탑 발밑에서 에콜 밀리테르까지 1 km 가까이 이어지는 잔디밭. 해 질 녘엔 파리 사람들이 와인과 치즈를 들고 소풍을 나온다. 잔디에 앉아도 된다(파리 공원 중엔 안 되는 곳이 많다).' },
  { match: /trocad[ée]ro/i, name: '트로카데로·샤요 궁', pos: ax(-610, 0), cat: 'sight', emoji: '🏛️', known: true, star: true, mins: 25,
    blurb: '강 건너 언덕 위, 두 날개를 편 샤요 궁 앞 광장. 에펠탑 전체가 한 장에 들어오는 가장 유명한 사진 자리다. 해 뜰 무렵에 가야 사람 없이 찍는다.' },
  { match: /varsovie/i, name: '바르샤바 분수', pos: ax(-420, 0), cat: 'sight', emoji: '⛲', mins: 10,
    blurb: '트로카데로 정원 가운데 길게 뻗은 분수. 스무 개 물대포가 탑 쪽으로 물을 쏜다. 여름엔 사람들이 발을 담근다.' },
  { match: /pont d.i[ée]na/i, name: '이에나 다리', pos: ax(-250, 0), cat: 'sight', emoji: '🌉', minor: true, mins: 5,
    blurb: '탑과 트로카데로를 곧게 잇는 다리. 나폴레옹이 이긴 예나 전투에서 이름을 땄다. 다리 한가운데서 보면 탑이 정면으로 선다.' },
  { match: /bir-hakeim/i, name: '비르아켐 다리', pos: ax(-215, -581), cat: 'sight', emoji: '🚇', mins: 10,
    blurb: '위층엔 지하철 6호선이, 아래층엔 사람과 차가 지나는 2층 다리. 영화 「인셉션」의 그 다리. 철 기둥 사이로 탑이 액자처럼 보인다.' },
  { match: /quai branly/i, name: '케 브랑리 박물관', pos: ax(-30, 400), cat: 'museum', emoji: '🗿', star: true, cost: 14, mins: 70,
    blurb: '아프리카·오세아니아·아시아·아메리카의 유물 박물관. 벽 한 면이 통째로 풀과 이끼로 덮인 식물 벽이 명물이다. 정원은 무료.' },
  { match: /rue cler/i, name: '클레르 거리 시장', pos: ax(500, 420), cat: 'gourmet', emoji: '🧀', star: true, mins: 25,
    blurb: '차가 다니지 않는 시장 골목. 치즈 가게·과일 가게·빵집·생선 가게가 이어지고, 카페 테라스는 동네 사람들로 찬다. 탑 둘레 관광지 값에 지쳤을 때 오는 곳.' },
  { match: /mur pour la paix/i, name: '평화의 벽', pos: ax(880, 0), cat: 'sight', emoji: '🕊️', minor: true, mins: 8,
    blurb: '샹드마르스 끝의 유리 벽. 49개 언어로 "평화"가 새겨져 있다. 한국어도 있으니 찾아보자.' },
  { match: /[ée]cole militaire/i, name: '에콜 밀리테르', pos: ax(1010, 0), cat: 'sight', emoji: '🎖️', mins: 8,
    blurb: '루이 15세가 세운 사관학교. 나폴레옹이 여기서 공부했다. 샹드마르스는 원래 이 학교의 연병장(마르스 = 전쟁의 신)이었다.' },
  { match: /carrousel/i, name: '에펠탑 회전목마', pos: ax(-130, -55), cat: 'sight', emoji: '🎠', minor: true, mins: 5, cost: 3,
    blurb: '탑 발밑 강가의 오래된 회전목마. 한 바퀴 3유로. 어른도 탄다.' },
  { match: /bateaux/i, name: '센 강 유람선 선착장', pos: ax(-150, 120), cat: 'sight', emoji: '⛴️', star: true, mins: 60, cost: 17,
    blurb: '탑 바로 앞 포르 드 라 부르도네 선착장. 한 시간 동안 노트르담까지 갔다 돌아온다. 해 질 녘 배가 제일 좋다 — 돌아올 무렵 탑에 불이 들어온다.' },
];

/** 샹젤리제 지구 데이터에 에펠탑 둘레를 붙인다(이어 붙일 길은 가장 가까운 기존 점에 끝을 맞춘다) */
export function mergeEiffel(d: WalkData): WalkData {
  const { ways: w, links } = ways();
  const verts: LngLat[] = [];
  for (const way of d.ways) for (const p of way) verts.push(p);
  const snap = (p: LngLat): LngLat => {
    let best = p, bd = 250;
    for (const q of verts) {
      const dm = Math.hypot((q[0] - p[0]) * M_LNG, (q[1] - p[1]) * M_LAT);
      if (dm < bd) { bd = dm; best = q; }
    }
    return best;
  };
  const linked = links.map((l) => [...l.slice(0, -1), snap(l[l.length - 1])]);
  return { ways: [...d.ways, ...w, ...linked], places: [...d.places, ...PLACES] };
}
