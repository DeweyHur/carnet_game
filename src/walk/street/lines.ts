// 거리에서 듣는 말. 프랑스어 한 줄 + 한국어. 여행 계획에 실제로 쓸모 있는 이야기를 섞었다.

export interface Line { fr: string; ko: string }

const L = (fr: string, ko: string): Line => ({ fr, ko });
export const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** 인사를 먼저 받았을 때 */
export const GREET_BACK = ['Bonjour !', 'Bonjour, ça va ?', 'Bonjour madame, monsieur !', 'Salut !', 'Bonjour, bonne journée !'];
/** 인사 없이 대뜸 말을 걸었을 때 — 파리에서는 이게 제일 큰 실례다 */
export const NO_GREETING: Line[] = [
  L('… Bonjour, d’abord.', '…먼저 "봉주르"부터요. (파리에서는 말 걸기 전에 꼭 인사한다)'),
  L('On dit bonjour, non ?', '인사부터 하는 거 아닌가요? (가게에 들어갈 때도, 길을 물을 때도 봉주르)'),
  L('Hmm. Bonjour quand même.', '흠. 그래도 봉주르. (살짝 기분이 상했다)'),
];
/** 인사 받고 반응(몸짓만) */
export const WAVE_BACK = ['Bonjour !', 'Coucou !', 'Salut !', 'Bonjour ~', '👋'];

/** 현지인이 알려 주는 쓸모 있는 이야기 */
export const TIPS: Line[] = [
  L('Au comptoir, le café est moins cher qu’en terrasse.', '카페는 바(카운터)에 서서 마시면 테라스보다 싸요. 같은 에스프레소가 1~2유로 차이.'),
  L('Demandez une carafe d’eau, c’est gratuit.', '식당에서 "윈 카라프 도(물 한 병)" 하면 수돗물은 공짜예요. 생수를 시키면 돈 내요.'),
  L('Le dimanche, beaucoup de boutiques sont fermées.', '일요일엔 가게가 많이 닫아요. 마레는 예외라 일요일에도 열어요.'),
  L('Les boulangeries ressortent le pain vers seize heures.', '빵집은 오후 네 시쯤 바게트를 한 번 더 구워 내요. 그때가 제일 따끈해요.'),
  L('Les musées nationaux sont gratuits le premier dimanche… mais il y a du monde !', '국립 박물관은 첫째 일요일 무료지만 줄이 엄청 길어요.'),
  L('Validez votre ticket, les contrôleurs sont partout.', '지하철 표는 꼭 찍고, 내릴 때까지 버리지 마세요. 검표원이 자주 와요.'),
  L('Méfiez-vous des pickpockets près des stations.', '역 근처와 사람 많은 광장에선 가방을 앞으로 메요. 소매치기가 있어요.'),
  L('Le déjeuner, c’est de midi à quatorze heures. Après, la cuisine ferme.', '점심은 12시~2시. 그 뒤엔 부엌을 닫는 식당이 많아요.'),
  L('La formule du midi est bien moins chère que la carte du soir.', '점심 "포르뮐(세트)"이 저녁 단품보다 훨씬 싸요.'),
  L('Les fontaines Wallace, l’eau est potable !', '초록색 월리스 분수 물은 마셔도 돼요. 빈 병을 들고 다니면 좋아요.'),
  L('Dites "pardon" si vous bousculez quelqu’un.', '부딪히면 "파르동" 한마디. 그걸로 대부분 괜찮아져요.'),
  L('Le Navigo Easy, c’est pratique pour ne pas perdre ses tickets.', '나비고 이지 카드에 표를 충전하면 종이표를 잃어버릴 일이 없어요.'),
  L('Les bus, on monte à l’avant et on valide.', '버스는 앞문으로 타서 기사 옆 단말기에 표를 찍어요.'),
  L('Au marché, on ne touche pas les fruits, on demande.', '시장에서는 과일을 직접 만지지 말고 달라고 해요.'),
  L('Le soir, les quais de Seine, c’est magnifique.', '저녁엔 센 강변을 꼭 걸어 보세요. 해 질 녘이 제일 예뻐요.'),
];

/** 알려 준 장소 */
export const REVEAL = (name: string): Line => pick([
  L(`Vous connaissez ${name} ? C’est juste par là.`, `${name} 가 봤어요? 바로 저쪽이에요.`),
  L(`Allez voir ${name}, les touristes ne le connaissent pas.`, `${name}에 가 봐요. 관광객들은 잘 몰라요.`),
  L(`Moi, j’adore ${name}. C’est à deux pas.`, `저는 ${name}를 좋아해요. 엎어지면 코 닿을 데예요.`),
]);

export const BUSY: Line[] = [L('Pardon, pas le temps !', '미안해요, 바빠서요!'), L('Désolé, je suis pressé.', '죄송해요, 급해서요.')];

/** 부딪혔을 때 */
export const BUMP = ['Attention !', 'Oh là là !', 'Eh ! Pardon ?!', 'Mais enfin !', 'Aïe !'];
/** 벽을 타거나 지붕에서 날 때 구경꾼 */
export const AMAZED = ['Oh là là !', 'Mais il est fou !', 'Incroyable !', 'Regarde !', 'C’est du parkour ?'];
/** 춤추면 */
export const CHEER = ['Bravo !', 'Ouais !', 'Allez !', 'Magnifique !', '👏'];

// ───────── 부탁·사건 ─────────
export const ASK_WAY = (name: string): Line => L(`Excusez-moi… ${name}, c’est par où ?`, `실례지만… ${name}이 어느 쪽이에요?`);
export const WAY_OK: Line = L('Ah, merci beaucoup ! Vous êtes d’ici ?', '아, 정말 고마워요! 여기 사세요?');
export const WAY_BAD: Line = L('Hmm… vous êtes sûr ? Je vais demander à quelqu’un d’autre.', '음… 확실해요? 다른 사람한테도 물어볼게요.');
export const ASK_PHOTO: Line = L('Pardon, vous pouvez nous prendre en photo ?', '저기, 사진 한 장 찍어 주실래요?');
export const PHOTO_OK: Line = L('Super, merci ! Elle est très belle.', '와, 고마워요! 정말 잘 나왔어요.');
export const BALLOON: Line = L('Mon ballon ! Il est parti sur le toit !', '내 풍선! 지붕 위로 날아갔어요!');
export const BALLOON_BACK: Line = L('Mon ballon ! Merci, merci !', '내 풍선이다! 고마워요, 고마워요!');
export const DOG_LOST: Line = L('Vous n’avez pas vu mon chien ? Il s’appelle Biscotte…', '혹시 우리 강아지 못 봤어요? 이름은 비스코트인데…');
export const DOG_BACK: Line = L('Biscotte ! Oh merci, vous êtes un ange.', '비스코트! 고마워요, 천사 같은 분이네요.');

export const WAITER_HELLO: Line = L('Bonjour ! Qu’est-ce que je vous sers ?', '봉주르! 뭘 드릴까요?');
export const VENDOR_HELLO: Line = L('Une crêpe ? Nutella, sucre, jambon-fromage…', '크레프 하나 드려요? 누텔라, 설탕, 햄 치즈…');
export const MUSICIAN_MERCI: Line = L('Merci ! Une petite valse pour vous.', '고마워요! 당신을 위해 왈츠 한 곡.');
export const PAINTER_HELLO: Line = L('Un portrait ? Vingt minutes, vingt euros.', '초상화 한 장? 20분이면 돼요, 20유로.');
export const MIME: Line = L('…', '(마임 배우가 보이지 않는 벽에 갇힌 척한다. 말은 하지 않는다.)');

/** 모리스 기둥 포스터 */
export const POSTERS = ['EXPOSITION', 'CONCERT', 'THÉÂTRE', 'CINÉMA', 'FESTIVAL'];
