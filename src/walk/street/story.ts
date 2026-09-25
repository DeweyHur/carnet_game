// 메인 이벤트(파리의 대표 랜드마크마다 하나 + 마지막 하나)와 서브 이벤트(랜드마크 둘레의 짧은 부탁·퀴즈).
// 순서는 자유 — 어디에 내려앉든 가까운 랜드마크부터. 이벤트는 '할 일(beat)'을 차례로 지난다:
//   reach  어느 자리에 서기          high   랜드마크 위로 올라가기(땅에서 몇 m)
//   photo  조건에 맞게 사진 찍기(3)  fetch  흩어진 물건 줍기
//   sit    그 자리에 앉아 있기(4)    talk   맡긴 사람에게 돌아가 말하기
//   check  그 밖의 조건(밤의 에펠탑 등)
// 퀴즈(서브)는 말을 걸면 세 가지 중에 고른다.
import * as THREE from 'three';
import type { Npc, Role } from '../town/crowd';
import type { StreetCtx } from './index';
import type { StreetUi, Anchor } from './ui';
import { LANDMARKS } from '../town/landmarks';
import * as sfx from '../sound';

export interface StoryHost {
  readonly ui: StreetUi;
  readonly c: StreetCtx;
  readonly items: THREE.Group;
  helped(what: string): void;
  /** 에펠탑이 지금 반짝이나 */
  sparkling(): boolean;
}

type UV = [number, number];
type Beat =
  | { kind: 'reach'; at: UV; r: number; line: string; done?: string }
  | { kind: 'high'; at: UV; r: number; dz: number; line: string; done?: string }
  | { kind: 'photo'; line: string; minDz?: number; face?: number; faceTol?: number; of?: UV; dist?: [number, number]; nearGiver?: boolean; label: string }
  | { kind: 'fetch'; what: string; emoji: string; spots: [number, number, number][]; line: string }
  | { kind: 'sit'; at: UV; r: number; minDz?: number; secs: number; line: string; done?: string }
  | { kind: 'talk'; line: string; fr: string; ko: string }
  | { kind: 'check'; line: string; test: (s: Story) => boolean; done?: string };

export interface Chapter {
  id: string;
  main: boolean;
  landmark: string;
  title: string;
  emoji: string;
  giver?: { name: string; role: Role; at: UV; facing: number; call: string };
  intro: { fr: string; ko: string };
  beats: Beat[];
  quiz?: { q: string; choices: string[]; answer: number; fact: string };
  outro: { fr: string; ko: string };
  reward: { eur: number; note: string };
  /** 메인: 다른 것들을 다 마쳐야 열린다 */
  after?: string[];
}

// 좌표는 랜드마크 좌표계(u = 주축 방향, v = 그 왼쪽). 높이 dz는 랜드마크가 선 땅에서.
export const CHAPTERS: Chapter[] = [
  // ───────── 메인 ─────────
  {
    id: 'm-eiffel', main: true, landmark: 'eiffel', title: '철의 귀부인', emoji: '🗼',
    giver: { name: '귀스타브 (탑 안내인)', role: 'reader', at: [-30, -80], facing: 0, call: 'Vous voulez voir Paris d’en haut ?' },
    intro: { fr: 'En 1889, tout le monde détestait cette tour. Montez tout en haut, et vous comprendrez pourquoi on l’a gardée.', ko: '1889년엔 다들 이 탑을 싫어했어요. "흉물"이라고요. 꼭대기까지 올라가 보면 왜 허물지 않았는지 알게 될 거예요. 꼭대기에서 파리를 한 장 찍어 와 줄래요?' },
    beats: [
      { kind: 'high', at: [0, 0], r: 24, dz: 270, line: '🗼 에펠탑 꼭대기(276 m)까지 — 다리를 타고 층마다 쉬어 가며', done: '🗼 꼭대기! 바람이 세다. 파리가 발밑에 깔려 있다' },
      { kind: 'photo', minDz: 240, line: '📷 꼭대기에서 파리를 한 장 (3)', label: '에펠탑 꼭대기에서 본 파리' },
      { kind: 'talk', line: '🗼 귀스타브에게 사진을 보여 주자 (뛰어내려 글라이더로)', fr: 'Voilà ! Vous avez vu ? Paris entier. Gustave Eiffel avait raison.', ko: '봤죠? 파리 전체요. 에펠 씨 말이 맞았어요 — 이 탑은 무선 전신 안테나로 쓸모가 생겨서 살아남았답니다.' },
    ],
    outro: { fr: 'Merci ! Gardez cette photo.', ko: '고마워요! 그 사진은 간직해요.' },
    reward: { eur: 30, note: '에펠탑 꼭대기에서 파리를 내려다봤다' },
  },
  {
    id: 'm-arc', main: true, landmark: 'arc', title: '꺼지지 않는 불꽃', emoji: '🏛',
    giver: { name: '마르셀 (퇴역 군인)', role: 'passer', at: [-40, 32], facing: 0, call: 'Jeune homme ! Un instant.' },
    intro: { fr: 'Sous l’Arc dort un soldat inconnu. Chaque soir depuis 1923, on ranime sa flamme.', ko: '개선문 아래엔 이름 모를 병사가 잠들어 있어요. 1923년부터 매일 저녁 그 불꽃을 다시 지핀답니다. 불꽃 앞에 잠깐 서 있다가, 옥상에 올라가 샹젤리제를 봐 주세요. 내 다리로는 이제 284계단이 무리라서.' },
    beats: [
      { kind: 'reach', at: [0, 0], r: 3.2, line: '🔥 아치 한가운데, 꺼지지 않는 불꽃 앞에 서자', done: '🔥 무명용사의 불꽃 앞에 섰다 — 잠깐 고개를 숙인다' },
      { kind: 'high', at: [0, 0], r: 26, dz: 49, line: '🏛 개선문 옥상 테라스(50 m)로 — 기둥 벽을 타고 올라가자', done: '🏛 옥상! 열두 길이 별처럼 뻗어 나간다(그래서 "에투알", 별 광장)' },
      { kind: 'photo', minDz: 44, face: 112, faceTol: 25, line: '📷 옥상에서 샹젤리제 쪽(동남, 콩코르드 방향)을 보고 한 장 (3)', label: '개선문 위에서 본 샹젤리제' },
      { kind: 'talk', line: '🏛 마르셀에게 돌아가자', fr: 'Les Champs, jusqu’à la Concorde… Merci, vraiment.', ko: '샹젤리제가 콩코르드까지… 정말 고마워요. 옛날엔 저 길을 행진했었지.' },
    ],
    outro: { fr: 'Bonne route !', ko: '좋은 여행 해요!' },
    reward: { eur: 25, note: '개선문 불꽃 앞에 서고 옥상에서 샹젤리제를 봤다' },
  },
  {
    id: 'm-louvre', main: true, landmark: 'louvre', title: '유리 피라미드', emoji: '🔺',
    giver: { name: '아멜리 (루브르 안내원)', role: 'tourist', at: [-38, -26], facing: 60, call: 'Au secours ! Mes plans du musée !' },
    intro: { fr: 'Le vent a emporté mes plans du musée ! Il en manque trois… dont un sur la pyramide, je crois.', ko: '바람에 박물관 안내도가 날아갔어요! 세 장이 없어요… 하나는 피라미드 위에 걸린 것 같아요. 유리 위는 미끄러우니 조심해요!' },
    beats: [
      { kind: 'fetch', what: '박물관 안내도', emoji: '🗺', spots: [[-120, 34, 0], [-72, -44, 0], [0, 0, 21.7]], line: '🗺 날아간 박물관 안내도 세 장을 찾자' },
      { kind: 'talk', line: '🗺 아멜리에게 안내도를 돌려주자', fr: 'Merci ! Maintenant, une photo : on fait semblant de tenir la pointe de la pyramide !', ko: '고마워요! 이제 관광객들이 다 하는 그 사진 — 멀찍이 서서 손끝으로 피라미드 꼭짓점을 잡는 척하는 사진, 하나 찍어 봐요.' },
      { kind: 'photo', of: [0, 0], dist: [22, 90], faceTol: 12, line: '📷 피라미드에서 20~90 m 떨어져, 꼭짓점을 정면으로 두고 한 장 (3)', label: '루브르 피라미드' },
    ],
    outro: { fr: 'Parfait ! Revenez voir la Joconde.', ko: '완벽해요! 다음엔 모나리자 보러 와요 — 생각보다 작아요.' },
    reward: { eur: 28, note: '루브르 안내도를 되찾고 피라미드 사진을 찍었다' },
  },
  {
    id: 'm-notre-dame', main: true, landmark: 'notre-dame', title: '종지기의 부탁', emoji: '🔔',
    giver: { name: '캉탱 (종지기)', role: 'reader', at: [-92, 12], facing: 90, call: 'Vous avez le vertige ?' },
    intro: { fr: 'Tout part d’ici : le point zéro des routes de France. Trouvez-le, puis montez voir mes gargouilles.', ko: '프랑스의 모든 길은 여기서 시작해요 — 광장 바닥의 "푸앵 제로(0 km)". 그걸 밟고 나서, 탑 꼭대기에 올라가 내 가고일들한테 안부 좀 전해 줘요. 불이 난 뒤로 다시 올라갈 수 있게 됐거든요.' },
    beats: [
      { kind: 'reach', at: [-100, 0], r: 2.6, line: '⭐ 성당 앞 광장의 "푸앵 제로"(파리 거리의 기준점)를 밟자', done: '⭐ 푸앵 제로! 여기를 밟으면 파리에 다시 온다는 말이 있다' },
      { kind: 'high', at: [-56, 0], r: 24, dz: 67, line: '🔔 탑 꼭대기(69 m)로 — 앞면을 타고 올라가자', done: '🔔 탑 위! 가고일들이 파리를 내려다보고 있다' },
      { kind: 'photo', minDz: 60, line: '📷 탑 위에서 가고일 너머 파리를 한 장 (3)', label: '노트르담 탑 위에서 본 파리' },
      { kind: 'talk', line: '🔔 캉탱에게 돌아가자', fr: 'Elles vont bien ? Ah, mes belles !', ko: '다들 잘 있던가요? 아, 내 예쁜이들! 2019년 불 속에서도 저 탑은 버텼어요.' },
    ],
    outro: { fr: 'Le bourdon Emmanuel vous salue.', ko: '큰 종 "에마뉘엘"이 인사하네요.' },
    reward: { eur: 25, note: '푸앵 제로를 밟고 노트르담 탑에 올랐다' },
  },
  {
    id: 'm-sacre-coeur', main: true, landmark: 'sacre-coeur', title: '몽마르트르에서 내려다보기', emoji: '🎨',
    giver: { name: '엘로디 (거리 화가)', role: 'painter', at: [-78, 16], facing: 90, call: 'Vous voulez poser pour moi ?' },
    intro: { fr: 'Je peins Paris depuis les marches. Montez, asseyez-vous, regardez… et dites-moi ce que je dois peindre.', ko: '계단에서 파리를 그리고 있어요. 올라가서 앉아 봐요, 가만히 내려다보고… 그다음엔 돔 위에서 본 걸 알려 줘요. 오늘 그림은 당신이 정해요.' },
    beats: [
      { kind: 'high', at: [-30, 0], r: 42, dz: 11.4, line: '⛪ 큰 계단을 올라 성당 앞까지(몽마르트르 언덕 꼭대기)', done: '⛪ 파리에서 가장 높은 언덕. 발밑에 도시가 펼쳐진다' },
      { kind: 'sit', at: [-30, 0], r: 42, minDz: 11, secs: 8, line: '🪑 성당 앞 계단에 앉아 파리를 내려다보자 (4 앉기)', done: '🪑 한참 앉아 있었다. 아코디언 소리가 어디선가 들린다' },
      { kind: 'high', at: [10, 0], r: 14, dz: 45, line: '⛪ 큰 돔 꼭대기로 — 드럼 벽을 타고 올라가자', done: '⛪ 돔 위! 에펠탑과 몽파르나스 타워가 한눈에' },
      { kind: 'talk', line: '🎨 엘로디에게 무엇을 봤는지 말해 주자', fr: 'Alors ? … Les toits gris et la tour au loin. D’accord, je la peins pour vous !', ko: '그래서요? … 회색 지붕들과 멀리 탑. 좋아요, 당신 걸로 그려 줄게요!' },
    ],
    outro: { fr: 'Voilà, encore frais. Ne la pliez pas !', ko: '자, 아직 안 말랐으니 접지 마요!' },
    reward: { eur: 20, note: '몽마르트르 언덕에서 파리를 내려다보고 그림을 받았다' },
  },
  {
    id: 'm-finale', main: true, landmark: 'eiffel', title: '빛의 도시', emoji: '✨', after: ['m-eiffel', 'm-arc', 'm-louvre', 'm-notre-dame', 'm-sacre-coeur'],
    intro: { fr: '', ko: '다섯 곳의 부탁을 다 들어줬다. 마지막으로 — 밤 9시가 넘으면 정시마다 5분, 에펠탑이 반짝인다.' },
    beats: [
      { kind: 'check', line: '✨ 밤 9시 이후 정시, 에펠탑이 반짝이는 걸 보자 (3 km 안)', test: (s) => s.sparkleNear(3000), done: '✨ 탑이 반짝인다. 오늘 하루가 한 장의 그림이 됐다' },
    ],
    outro: { fr: '', ko: '' },
    reward: { eur: 0, note: '반짝이는 에펠탑으로 파리의 하루를 마쳤다' },
  },

  // ───────── 서브 ─────────
  {
    id: 's-eiffel-quiz', main: false, landmark: 'eiffel', title: '탑은 몇 년짜리였을까', emoji: '❓',
    giver: { name: '가이드 쥘리', role: 'tourist', at: [60, 70], facing: 180, call: 'Petite question ?' },
    intro: { fr: '', ko: '' }, beats: [],
    quiz: { q: '에펠탑은 1889년 만국박람회 때 세우면서, 처음엔 몇 년만 두기로 했을까?', choices: ['20년', '100년', '영원히'], answer: 0, fact: '처음 허가는 20년. 무선 전신 안테나로 쓸모가 생겨 허물지 않았다.' },
    outro: { fr: 'Bravo !', ko: '정답!' }, reward: { eur: 5, note: '에펠탑 퀴즈' },
  },
  {
    id: 's-arc-plane', main: false, landmark: 'arc', title: '옥상에 걸린 장난감 비행기', emoji: '✈️',
    giver: { name: '레오 (아이)', role: 'kid', at: [-52, -40], facing: 60, call: 'Mon avion ! Il est là-haut !' },
    intro: { fr: 'Mon avion est tombé sur le toit de l’Arc !', ko: '내 비행기가 개선문 지붕에 떨어졌어요! 꺼내 줄 수 있어요?' },
    beats: [
      { kind: 'fetch', what: '장난감 비행기', emoji: '✈️', spots: [[6, -14, 50.1]], line: '✈️ 개선문 옥상(50 m)에 걸린 장난감 비행기' },
      { kind: 'talk', line: '✈️ 레오에게 비행기를 돌려주자', fr: 'Mon avion ! Merci !', ko: '내 비행기! 고마워요! (아이가 비행기를 날리며 뛰어간다)' },
    ],
    outro: { fr: 'Merci !', ko: '고마워요!' }, reward: { eur: 6, note: '개선문 옥상의 장난감 비행기를 꺼내 줬다' },
  },
  {
    id: 's-arc-quiz', main: false, landmark: 'arc', title: '별 광장', emoji: '❓',
    giver: { name: '가이드 소피', role: 'tourist', at: [46, -34], facing: 270, call: 'Un petit quiz ?' },
    intro: { fr: '', ko: '' }, beats: [],
    quiz: { q: '개선문이 선 광장을 "에투알(별)"이라 부르는 까닭은?', choices: ['길 열두 개가 별처럼 뻗어서', '밤에 별이 잘 보여서', '나폴레옹의 별명이라서'], answer: 0, fact: '샤를 드골 광장 — 열두 길이 별 모양으로 모인다. 차들은 차선 없이 돈다.' },
    outro: { fr: 'Exact !', ko: '정답!' }, reward: { eur: 5, note: '개선문 퀴즈' },
  },
  {
    id: 's-louvre-quiz', main: false, landmark: 'louvre', title: '피라미드 퀴즈', emoji: '❓',
    giver: { name: '건축학도 이네스', role: 'reader', at: [40, 36], facing: 200, call: 'Vous aimez l’architecture ?' },
    intro: { fr: '', ko: '' }, beats: [],
    quiz: { q: '루브르의 유리 피라미드는 언제 생겼을까?', choices: ['1989년', '1889년', '1793년'], answer: 0, fact: '건축가 I. M. 페이, 유리 673장. 처음엔 반대가 심했지만 지금은 루브르의 얼굴이다.' },
    outro: { fr: 'Exactement !', ko: '정답!' }, reward: { eur: 5, note: '루브르 퀴즈' },
  },
  {
    id: 's-louvre-photo', main: false, landmark: 'louvre', title: '신혼부부의 사진', emoji: '💑',
    giver: { name: '신혼부부', role: 'tourist', at: [-60, 22], facing: 90, call: 'Pardon, une photo ?' },
    intro: { fr: 'Vous pouvez nous prendre en photo avec la pyramide ?', ko: '피라미드가 나오게 우리 사진 좀 찍어 줄래요?' },
    beats: [{ kind: 'photo', nearGiver: true, of: [0, 0], faceTol: 40, line: '📷 부부 가까이서 피라미드 쪽을 보고 한 장 (3)', label: '루브르 앞 신혼부부' }],
    outro: { fr: 'Merci ! C’est magnifique !', ko: '고마워요! 너무 예뻐요!' }, reward: { eur: 0, note: '루브르 앞에서 부부 사진을 찍어 줬다' },
  },
  {
    id: 's-nd-books', main: false, landmark: 'notre-dame', title: '날아간 헌책', emoji: '📚',
    giver: { name: '부키니스트 (헌책 장수)', role: 'reader', at: [-104, 30], facing: 200, call: 'Mes livres ! Le vent !' },
    intro: { fr: 'Un coup de vent et hop, deux livres envolés !', ko: '센 강가의 초록 상자 헌책방이에요. 돌풍에 책 두 권이 날아갔어요!' },
    beats: [
      { kind: 'fetch', what: '헌책', emoji: '📕', spots: [[-132, 26, 0], [58, -26, 0]], line: '📕 바람에 날아간 헌책 두 권을 찾자' },
      { kind: 'talk', line: '📚 부키니스트에게 책을 돌려주자', fr: 'Merci ! Tenez, un vieux guide de Paris, pour vous.', ko: '고마워요! 자, 옛날 파리 안내서 한 권 가져가요.' },
    ],
    outro: { fr: 'Bonne lecture !', ko: '재미있게 읽어요!' }, reward: { eur: 4, note: '센 강가 헌책 장수의 책을 찾아 줬다' },
  },
  {
    id: 's-nd-quiz', main: false, landmark: 'notre-dame', title: '푸앵 제로 퀴즈', emoji: '❓',
    giver: { name: '순례자 마테오', role: 'tourist', at: [-112, -20], facing: 60, call: 'Une devinette ?' },
    intro: { fr: '', ko: '' }, beats: [],
    quiz: { q: '노트르담 앞 광장 바닥의 청동 별 "푸앵 제로"는 무엇일까?', choices: ['프랑스 도로 거리를 재는 기준점', '성당의 첫 번째 돌', '센 강이 넘친 높이'], answer: 0, fact: '파리에서 "몇 km"라고 할 때 여기서 잰다. 밟으면 파리에 다시 온다는 말도.' },
    outro: { fr: 'Bien joué !', ko: '정답!' }, reward: { eur: 5, note: '노트르담 퀴즈' },
  },
  {
    id: 's-sc-amelie', main: false, landmark: 'sacre-coeur', title: '찢어진 사진 조각', emoji: '🧩',
    giver: { name: '니노 (사진 모으는 사람)', role: 'passer', at: [-84, -18], facing: 60, call: 'Vous n’auriez pas vu des bouts de photo ?' },
    intro: { fr: 'Je collectionne les photos déchirées des cabines… Trois morceaux se sont envolés dans l’escalier.', ko: '즉석 사진기 앞에 버려진 찢어진 사진을 모아요(영화 〈아멜리에〉처럼). 세 조각이 계단 쪽으로 날아갔어요.' },
    beats: [
      { kind: 'fetch', what: '사진 조각', emoji: '🧩', spots: [[-62, 8, 2.4], [-50, -9, 7.2], [-34, 20, 12]], line: '🧩 계단에 흩어진 사진 조각 세 개' },
      { kind: 'talk', line: '🧩 니노에게 조각을 가져가자', fr: 'C’est… vous ! Sur la photo ! Incroyable.', ko: '맞춰 보니… 이거 당신이에요! 어떻게 이런 일이.' },
    ],
    outro: { fr: 'Gardez-la.', ko: '가져요, 당신 사진이니까.' }, reward: { eur: 3, note: '몽마르트르 계단의 사진 조각을 모았다' },
  },
  {
    id: 's-sc-quiz', main: false, landmark: 'sacre-coeur', title: '하얀 돌 퀴즈', emoji: '❓',
    giver: { name: '수녀 클레르', role: 'passer', at: [-40, 30], facing: 200, call: 'Vous savez pourquoi elle est si blanche ?' },
    intro: { fr: '', ko: '' }, beats: [],
    quiz: { q: '사크레쾨르가 언제나 하얀 까닭은?', choices: ['비를 맞으면 돌이 석회를 내뿜어 더 하얘져서', '해마다 새로 칠해서', '대리석으로만 지어서'], answer: 0, fact: '샤토-랑동의 트라베르틴 돌. 비가 올수록 하얘진다 — 매연에도 끄떡없다.' },
    outro: { fr: 'Bravo !', ko: '정답!' }, reward: { eur: 5, note: '사크레쾨르 퀴즈' },
  },
];

interface Run { ch: Chapter; beat: number; got: number; sitT: number; npc: Npc | null; called: boolean; items: THREE.Object3D[]; picked: boolean[] }

const bearingOf = (x: number, y: number) => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
const angleDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;
const KEY = 'carnet-story-v1';
/** 받침이 있으면 a, 없으면 b(을/를·이/가·은/는) */
const josa = (word: string, a: string, b: string) => { const w = word.replace(/\s*\(.*\)$/, ''); const c = w.charCodeAt(w.length - 1); return w + (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 ? a : b); };

export class Story {
  private readonly h: StoryHost;
  /** 끝낸 이벤트(메인은 저장된다) */
  readonly done = new Set<string>();
  /** 시작한(말을 들은) 이벤트 */
  readonly started = new Set<string>();
  private runs = new Map<string, Run>();
  /** 안내(빛기둥·위쪽 한 줄)를 받는 이벤트 */
  tracked: string | null = null;
  private frameRef: unknown = null;
  private lastLine = '';
  private seenLm = new Set<string>();
  onChange?: () => void;

  constructor(h: StoryHost) {
    this.h = h;
    try { for (const id of JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]) if (CHAPTERS.some((c) => c.id === id && c.main)) this.done.add(id); } catch { /* 처음부터 */ }
    for (const ch of CHAPTERS) this.runs.set(ch.id, { ch, beat: 0, got: 0, sitT: 0, npc: null, called: false, items: [], picked: [] });
  }
  private save() { try { localStorage.setItem(KEY, JSON.stringify(CHAPTERS.filter((c) => c.main && this.done.has(c.id)).map((c) => c.id))); } catch { /* 무시 */ } }

  private get hero() { return this.h.c.hero; }

  /** 랜드마크 자리(로컬)·땅 높이·방위 */
  private lm(id: string): { x: number; y: number; z: number; rot: number } | null {
    const l = this.hero.town.landmarks.find((q) => q.id === id);
    const L = LANDMARKS.find((q) => q.id === id);
    if (!l || !L) return null;
    return { x: l.x, y: l.y, z: l.z, rot: ((90 - L.bearing) * Math.PI) / 180 };
  }
  private at(id: string, [u, v]: UV): [number, number] | null {
    const L = this.lm(id);
    if (!L) return null;
    const c = Math.cos(L.rot), s = Math.sin(L.rot);
    let x = L.x + u * c - v * s, y = L.y + u * s + v * c;
    // 강 위로 잡혔으면(지도 자료에 따라 강가가 다르다) 랜드마크 쪽으로 당겨 뭍에 둔다
    const w = this.hero.world;
    for (let k = 0; k < 12 && w.water(x, y); k++) { x += (L.x - x) * 0.15; y += (L.y - y) * 0.15; }
    return [x, y];
  }

  available(ch: Chapter) { return !ch.after || ch.after.every((id) => this.done.has(id)); }
  run(id: string) { return this.runs.get(id)!; }
  /** 지금 할 일 한 줄 */
  lineOf(ch: Chapter): string {
    if (this.done.has(ch.id)) return '완료';
    if (!this.started.has(ch.id)) return ch.giver ? `${ch.giver.name}에게 말을 걸자` : ch.intro.ko;
    const r = this.run(ch.id), b = ch.beats[r.beat];
    if (!b) return '';
    return b.kind === 'fetch' ? `${b.line} (${r.got}/${b.spots.length})` : b.line;
  }
  landmarkName(ch: Chapter) { return LANDMARKS.find((l) => l.id === ch.landmark)?.name ?? ch.landmark; }
  distTo(ch: Chapter) { const L = this.lm(ch.landmark), b = this.hero.body; return L ? Math.hypot(L.x - b.x, L.y - b.y) : Infinity; }

  sparkleNear(r: number) { const L = this.lm('eiffel'), b = this.hero.body; return !!L && this.h.sparkling() && Math.hypot(L.x - b.x, L.y - b.y) < r; }

  /** 원점이 바뀌면(동네 이동) 로컬에 둔 것들을 치운다 */
  private refresh() {
    if (this.frameRef === this.hero.frame) return;
    this.frameRef = this.hero.frame;
    for (const r of this.runs.values()) { r.npc = null; for (const m of r.items) this.h.items.remove(m); r.items = []; }
  }

  owns(n: Npc) { return !!n.tag?.startsWith('story:'); }
  runOf(n: Npc | null) { if (!n) return null; for (const r of this.runs.values()) if (r.npc === n) return r; return null; }
  giverOf(n: Npc) { return this.runOf(n); }

  label(n: Npc): [string, string, string] | null {
    const r = this.runOf(n);
    if (!r || !r.ch.giver) return null;
    const done = this.done.has(r.ch.id);
    const mark = done ? '🙂' : r.ch.main ? '⭐' : r.ch.quiz ? '❓' : '❗';
    return [mark, r.ch.giver.name, done ? '고마워함' : r.ch.main ? `메인 · ${r.ch.title}` : r.ch.title];
  }
  verb(n: Npc): string | null {
    const r = this.runOf(n);
    if (!r) return null;
    const b = r.ch.beats[r.beat];
    if (this.started.has(r.ch.id) && b?.kind === 'talk') return '돌아왔다고 말하기';
    return r.ch.quiz && !this.done.has(r.ch.id) ? '퀴즈 풀기' : '말 걸기';
  }

  /** 빛기둥: 추적 중인 이벤트의 다음 자리 */
  get beacon(): [number, number] | null {
    const id = this.tracked;
    if (!id) return null;
    const r = this.run(id), ch = r.ch;
    if (this.done.has(id) || !this.available(ch)) return null;
    if (!this.started.has(id)) {
      if (r.npc) return [r.npc.x, r.npc.y];
      return ch.giver ? this.at(ch.landmark, ch.giver.at) : (() => { const L = this.lm(ch.landmark); return L ? [L.x, L.y] as [number, number] : null; })();
    }
    const b = ch.beats[r.beat];
    if (!b) return null;
    switch (b.kind) {
      case 'reach': case 'high': case 'sit': return this.at(ch.landmark, b.at);
      case 'fetch': { const i = r.picked.findIndex((p) => !p); return i >= 0 ? this.at(ch.landmark, [b.spots[i][0], b.spots[i][1]]) : null; }
      case 'talk': return r.npc ? [r.npc.x, r.npc.y] : ch.giver ? this.at(ch.landmark, ch.giver.at) : null;
      case 'photo': return b.of ? this.at(ch.landmark, b.of) : null;
      default: return ch.landmark === 'eiffel' ? (() => { const L = this.lm('eiffel'); return L ? [L.x, L.y] as [number, number] : null; })() : null;
    }
  }

  // ───────── 매 프레임 ─────────
  update(dt: number, showLine: boolean) {
    this.refresh();
    const h = this.hero, b = h.body;
    for (const r of this.runs.values()) {
      const ch = r.ch;
      if (!this.available(ch)) continue;
      const L = this.lm(ch.landmark);
      if (!L) continue;
      const dL = Math.hypot(L.x - b.x, L.y - b.y);
      // 처음 가까이 오면 알린다(메인만)
      if (ch.main && dL < 320 && !this.seenLm.has(ch.id) && !this.done.has(ch.id) && ch.giver) {
        this.seenLm.add(ch.id);
        this.h.c.toast(`📖 메인 이벤트 · ${ch.emoji} ${ch.title} — ${this.landmarkName(ch)}의 ${josa(ch.giver.name, '을', '를')} 찾아보자`);
        if (!this.tracked || this.done.has(this.tracked)) this.tracked = ch.id;
        this.onChange?.();
      }
      if (ch.giver) this.placeGiver(r, L);
      if (this.started.has(ch.id) && !this.done.has(ch.id)) this.stepBeat(r, dt, L);
    }
    // 마지막 메인: 다섯을 마치면 열린다
    const fin = this.run('m-finale');
    if (this.available(fin.ch) && !this.started.has('m-finale') && !this.done.has('m-finale')) {
      this.started.add('m-finale');
      this.tracked = 'm-finale';
      setTimeout(() => { sfx.fanfare(); this.h.c.toast('📖 마지막 메인 이벤트 · ✨ 빛의 도시 — 밤 9시 이후 정시, 반짝이는 에펠탑을 보자'); }, 3000);
      this.onChange?.();
    }
    if (showLine) {
      const id = this.tracked;
      const s = id && !this.done.has(id) && this.started.has(id) ? `${this.run(id).ch.main ? '⭐ ' : ''}${this.lineOf(this.run(id).ch)}` : '';
      if (s !== this.lastLine) { this.lastLine = s; this.h.ui.questLine(s); }
    } else this.lastLine = '\u0000';
  }

  private placeGiver(r: Run, L: { x: number; y: number; z: number; rot: number }) {
    const h = this.hero, b = h.body, g = r.ch.giver!;
    const [x, y] = this.at(r.ch.landmark, g.at)!;
    const d = Math.hypot(x - b.x, y - b.y);
    if (r.npc && !h.crowd.npcs.includes(r.npc)) r.npc = null;
    if (!r.npc && d < 110) {
      const facing = (90 - (L.rot * 180) / Math.PI + g.facing + 360) % 360;
      const z = h.world.terrain(x, y);
      r.npc = h.crowd.spawn(g.role, x, y, facing, { state: 'stand', anchor: { x, y, z, facing }, home: null, speed: 0, tag: `story:${r.ch.id}` });
      r.npc.z = z;
    }
    if (r.npc && !r.called && d < 20 && b.mode === 'ground' && !this.done.has(r.ch.id) && !this.started.has(r.ch.id)) {
      r.called = true;
      this.h.ui.say(this.npcAt(r.npc), g.call, 3, '', r.npc.id);
      h.crowd.gesture(r.npc, 'wave', 2);
      sfx.spot();
    }
  }

  private npcAt(n: Npc): () => Anchor { return () => ({ x: n.x, y: n.y, z: n.z + 2.1 * n.scale }); }

  private stepBeat(r: Run, dt: number, L: { x: number; y: number; z: number }) {
    const ch = r.ch, bt = ch.beats[r.beat];
    if (!bt) return;
    const b = this.hero.body;
    const here = (at: UV, rad: number) => { const p = this.at(ch.landmark, at)!; return Math.hypot(p[0] - b.x, p[1] - b.y) < rad; };
    const dz = b.z - L.z;
    switch (bt.kind) {
      case 'reach': if (here(bt.at, bt.r) && Math.abs(dz) < 3) this.advance(r, bt.done); break;
      case 'high': if (here(bt.at, bt.r) && dz >= bt.dz && b.mode !== 'air') this.advance(r, bt.done); break;
      case 'sit':
        if (b.mode === 'sit' && here(bt.at, bt.r) && dz >= (bt.minDz ?? -99)) { r.sitT += dt; if (r.sitT >= bt.secs) this.advance(r, bt.done); } else r.sitT = 0;
        break;
      case 'check': if (bt.test(this)) this.advance(r, bt.done); break;
      case 'fetch': this.stepFetch(r, bt); break;
      default: break;
    }
  }

  private stepFetch(r: Run, bt: Extract<Beat, { kind: 'fetch' }>) {
    const b = this.hero.body, t = performance.now() / 1000;
    if (r.items.length !== bt.spots.length) {
      for (const m of r.items) this.h.items.remove(m);
      r.items = bt.spots.map(([u, v, z], i) => {
        const [x, y] = this.at(r.ch.landmark, [u, v])!;
        const m = this.makeItem(bt.emoji);
        const want = this.lm(r.ch.landmark)!.z + z;
        m.position.set(x, y, this.hero.world.ground(x, y, want, 1.5) + 0.05); // 계단·지붕 위에 올려놓는다
        m.visible = !r.picked[i];
        this.h.items.add(m);
        return m;
      });
      if (r.picked.length !== bt.spots.length) r.picked = bt.spots.map(() => false);
    }
    r.items.forEach((m, i) => {
      if (r.picked[i]) { m.visible = false; return; }
      m.rotation.z = t * 1.2 + i;
      m.children[1].position.z = 0.5 + Math.sin(t * 3 + i) * 0.12;
      if (Math.hypot(m.position.x - b.x, m.position.y - b.y) < 1.6 && Math.abs(m.position.z - b.z) < 2.2 && b.mode !== 'climb') {
        r.picked[i] = true;
        r.got++;
        m.visible = false;
        sfx.grab();
        this.h.c.toast(`${bt.emoji} ${josa(bt.what, '을', '를')} 주웠다 (${r.got}/${bt.spots.length})`);
        if (r.got >= bt.spots.length) this.advance(r);
        this.onChange?.();
      }
    });
  }

  /** 줍는 것: 빛나는 원판 + 떠 있는 그림(이모지 캔버스) */
  private makeItem(emoji: string) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 24), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.8, depthWrite: false }));
    ring.position.z = 0.03;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c2 = cv.getContext('2d')!;
    c2.font = '48px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText(emoji, 32, 36);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
    spr.scale.set(0.8, 0.8, 0.8);
    spr.position.z = 0.5;
    g.add(ring, spr);
    return g;
  }

  private advance(r: Run, msg?: string) {
    r.beat++;
    r.got = 0;
    r.sitT = 0;
    for (const m of r.items) this.h.items.remove(m);
    r.items = []; r.picked = [];
    if (msg) { this.h.c.toast(msg); sfx.chime(); }
    if (r.beat >= r.ch.beats.length) this.complete(r);
    else if (msg === undefined) sfx.questStart();
    this.onChange?.();
  }

  private complete(r: Run) {
    const ch = r.ch;
    this.done.add(ch.id);
    if (ch.main) this.save();
    if (ch.reward.eur) this.h.c.S.money = Math.round((this.h.c.S.money + ch.reward.eur) * 100) / 100;
    this.h.helped(ch.reward.note);
    if (r.npc && ch.outro.fr) { this.h.ui.say(this.npcAt(r.npc), ch.outro.fr, 3, '', r.npc.id); this.hero.crowd.gesture(r.npc, 'clap', 2.5); }
    sfx.questDone();
    if (ch.main) {
      const n = CHAPTERS.filter((c) => c.main && c.id !== 'm-finale' && this.done.has(c.id)).length;
      setTimeout(() => sfx.fanfare(), 600);
      this.h.c.toast(`📖 메인 이벤트 완료 · ${ch.emoji} ${ch.title}${ch.reward.eur ? ` · €${ch.reward.eur}` : ''}${ch.id === 'm-finale' ? '' : ` — 수첩 도장 ${n}/5`}`);
      if (ch.id === 'm-finale') setTimeout(() => this.h.c.toast('🎉 파리 수첩의 메인 이벤트를 모두 마쳤다!'), 3500);
    } else this.h.c.toast(`✨ ${ch.reward.note}${ch.reward.eur ? ` · €${ch.reward.eur}` : ''}`);
    if (this.tracked === ch.id) this.tracked = this.nextTrack();
  }

  /** 다음으로 안내할 것: 시작한 것 중 가까운 것 > 아직 안 한 메인 중 가까운 것 */
  nextTrack(): string | null {
    const open = CHAPTERS.filter((c) => !this.done.has(c.id) && this.available(c));
    const started = open.filter((c) => this.started.has(c.id)).sort((a, b) => this.distTo(a) - this.distTo(b));
    if (started.length) return started[0].id;
    const mains = open.filter((c) => c.main).sort((a, b) => this.distTo(a) - this.distTo(b));
    return mains[0]?.id ?? null;
  }

  // ───────── 말 걸기 ─────────
  async talk(n: Npc) {
    const r = this.runOf(n);
    if (!r) return;
    const ch = r.ch, ui = this.h.ui, b = this.hero.body;
    b.facing = bearingOf(n.x - b.x, n.y - b.y);
    n.greeted = true;
    const name = ch.giver!.name;
    if (this.done.has(ch.id)) { ui.say(this.npcAt(n), ch.outro.fr || 'Merci encore !', 2.2, '', n.id); return; }
    if (ch.quiz) {
      const q = ch.quiz;
      const i = await ui.talk(name, 'Petite question…', q.q, q.choices);
      if (i === q.answer) {
        this.started.add(ch.id);
        this.h.c.toast(`⭕ ${q.fact}`);
        r.beat = ch.beats.length;
        this.complete(r);
      } else if (i >= 0) {
        sfx.exhausted();
        ui.say(this.npcAt(n), 'Non… réfléchissez encore !', 2.2, '', n.id);
        this.h.c.toast('❌ 아쉽다 — 다시 말을 걸면 또 풀 수 있다');
      }
      this.onChange?.();
      return;
    }
    if (!this.started.has(ch.id)) {
      const i = await ui.talk(name, ch.intro.fr, ch.intro.ko, [ch.main ? '도와줄게요 (메인 이벤트)' : '도와줄게요', '나중에요']);
      if (i !== 0) return;
      this.started.add(ch.id);
      this.tracked = ch.id;
      sfx.questStart();
      this.h.c.toast(`${ch.main ? '📖 메인' : '📝 서브'} · ${ch.emoji} ${ch.title} — ${this.lineOf(ch)}`);
      this.onChange?.();
      return;
    }
    const bt = ch.beats[r.beat];
    if (bt?.kind === 'talk') {
      await ui.talk(name, bt.fr, bt.ko, ['메르시!']);
      this.advance(r);
      return;
    }
    ui.say(this.npcAt(n), 'Alors ? Ça avance ?', 2, '', n.id);
    this.h.c.hint(this.lineOf(ch));
  }

  private sayT: ReturnType<typeof setTimeout> | null = null;
  /** 사진 안내는 아래 한 줄로(사진 알림과 겹치지 않게) */
  private say(t: string) { this.h.c.hint(t); if (this.sayT) clearTimeout(this.sayT); this.sayT = setTimeout(() => this.h.c.hint(''), 4000); }

  /** 사진: 조건에 맞는 이벤트가 있으면 라벨을 돌려준다 */
  onShutter(yaw: number): string | null {
    const b = this.hero.body;
    for (const r of this.runs.values()) {
      const ch = r.ch, bt = ch.beats[r.beat];
      if (!bt || bt.kind !== 'photo' || !this.started.has(ch.id) || this.done.has(ch.id)) continue;
      const L = this.lm(ch.landmark);
      if (!L) continue;
      if (bt.minDz !== undefined && b.z - L.z < bt.minDz) continue;
      if (bt.nearGiver && (!r.npc || Math.hypot(r.npc.x - b.x, r.npc.y - b.y) > 9)) { this.say('부부 가까이에서 찍어 주자'); continue; }
      if (bt.face !== undefined && Math.abs(angleDiff(yaw, bt.face)) > (bt.faceTol ?? 20)) { this.say('방향이 조금 다르다 — 안내한 쪽을 보고 찍자'); continue; }
      if (bt.of) {
        const [ox, oy] = this.at(ch.landmark, bt.of)!;
        const d = Math.hypot(ox - b.x, oy - b.y);
        if (bt.dist && (d < bt.dist[0] || d > bt.dist[1])) { this.say(d < bt.dist[0] ? '너무 가깝다 — 조금 물러서서 다시 (3)' : '너무 멀다 — 조금 다가가서 다시 (3)'); continue; }
        if (Math.abs(angleDiff(yaw, bearingOf(ox - b.x, oy - b.y))) > (bt.faceTol ?? 20)) { this.say('한가운데 오게 — 정면으로 보고 다시 (3)'); continue; }
      }
      this.advance(r);
      return bt.label;
    }
    return null;
  }

  summary(): string[] {
    const mains = CHAPTERS.filter((c) => c.main && this.done.has(c.id));
    const subs = CHAPTERS.filter((c) => !c.main && this.done.has(c.id));
    const out: string[] = [];
    if (mains.length) out.push(`메인 이벤트 ${mains.length}개: ${mains.map((c) => `${c.emoji} ${c.title}`).join(', ')}.`);
    if (subs.length) out.push(`랜드마크 둘레의 작은 일 ${subs.length}개를 해결했어요.`);
    return out;
  }
}
