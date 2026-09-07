import { useGame, type Locale } from './game/store';
import english from './data/english.json';

/**
 * Display-only localisation. IDs, quiz answers and saved content remain language-neutral.
 * Literal text and interpolated messages share a checked-in English catalog.
 */
const DICT: Record<string, string> = {
  'Carnet — 한 정거장씩, 파리 여행': 'Carnet — Paris, one station at a time',
  '언어': 'Language',
  // 공통 버튼·상태
  '계속 ▸': 'Continue ▸',
  '확인': 'Confirm',
  '다시': 'Reset',
  '닫기': 'Close',
  '수집 ▸': 'Collect ▸',
  '접어 넣기 ▸': 'Tuck it away ▸',
  '지도 보기 ▸': 'View map ▸',
  '미션 완료 ▸': 'Finish mission ▸',
  '풍경을 따라 이동 ▸': 'Continue the journey ▸',
  '건너뛰기': 'Skip',
  '가속 ▲': 'Gas ▲',
  '경로를 찾는 중…': 'Finding a route…',
  '실시간 경로를 불러오지 못해 직선 도로로 대신합니다.': 'Could not fetch a live route — using a straight road instead.',
  '잠시 접기': 'Pause',
  '잠시 접기 ×': 'Pause ×',
  '재개': 'Resume',
  '포기': 'Abandon',
  '취재 →': 'Report →',
  '사기': 'Buy',
  '가격 확인하고 맛보기 →': 'Reveal price & taste →',
  '먹기': 'Eat',
  '방문하기': 'Visit',
  '다시 산책': 'Revisit',
  '편집장에게 송고': 'Submit to editor',
  '환전하기': 'Exchange',
  '새 게임': 'New game',
  '수첩 · 여권 · 지갑': 'Notebook · Passport · Wallet',
  '소리 켜기': 'Unmute',
  '소리 끄기': 'Mute',
  '풍경': 'Scenery',
  '지도 ↗': 'Map ↗',
  '이전 풍경': 'Previous view',
  '다음 풍경': 'Next view',
  '＋ 사진 담기': '＋ Capture photo',
  '도착해서 사진 담기': 'Arrive to capture',
  '✓ 앨범에 담았어요': '✓ Saved to album',
  // Intro
  '작가 이름': "Writer's name",
  '예: 김카르네': 'e.g. Jamie Carnet',
  '출신국 통화 (자국 통화 — 모든 가격에 병기됩니다)': "Home currency (shown alongside every price)",
  '여행의 첫 페이지 열기': 'Open the first page',
  '파리, 화요일 아침 09:00 · 자동 저장': 'Paris, Tuesday 09:00 · autosaves',
  // HUD
  '현재 위치': 'Current city',
  '지갑': 'Wallet',
  '체력': 'Stamina',
  '작가 평판': 'Reputation',
  '부채': 'Debt',
  // Journey
  '오늘은, 어디까지 걸어볼까.': 'How far will today take you?',
  '● 지금 머무는 도시': '● Currently here',
  '다음 여행의 미리보기': 'A preview of the road ahead',
  '아직 도착하지 않은 풍경': 'A view you have not reached yet',
  '이어 쓰는 여행': 'Trip in progress',
  '편집부의 다음 취재': "The desk's next assignment",
  '접어둔 미션 이어하기': 'Resume the mission you paused',
  '모든 취재를 마쳤어요': 'Every assignment is filed',
  '나만의 여행 앨범': 'Your travel album',
  '다음 페이지의 도시들': 'Cities on the next page',
  '이야기 진행으로 열기': 'Unlocks as the story progresses',
  '✓ 나의 발자취': '✓ A place you have walked',
  // MapView
  '메인 무대(S)': 'Flagship city (S)',
  '거점 도시(A)': 'Hub city (A)',
  '유산 노드(H)': 'Heritage node (H)',
  '안개 · 잠긴 지역': 'Fog · locked region',
  '도시 취재 완료': 'cities reported on',
  '개 도시': ' cities',
  '여행 지도를 펼치는 중…': 'Unfolding the travel map…',
  '지역 완주 · L.의 편지': "Region complete · a letter from L.",
  // common.tsx / economy.ts 데이터 문자열
  '출처: ': 'Source: ',
  'ECB 기준환율 (EUR=1)': 'ECB reference rate (EUR=1)',
  '보유': 'On hand',
  '손실': 'lost',
  '기준환율이면': 'At the reference rate that would be',
  '이 사라진다.': ' is lost to the spread.',
  '유로': 'Euro',
  '원': 'Won',
  '파운드': 'Pound',
  '스위스 프랑': 'Swiss franc',
  '공항 환전소': 'Airport exchange',
  '시내 환전소': 'City exchange counter',
  '은행 창구': 'Bank counter',
  'ATM 인출': 'ATM withdrawal',
  '편하지만 5~10%가 사라진다. 급할 때 소액만.': 'Convenient, but 5-10% vanishes. Only for small, urgent amounts.',
  '1~4%. 간판의 "수수료 0%"는 환율에 이미 녹아 있다.': '1-4%. A sign advertising "0% commission" has already baked its cut into the rate.',
  '2~3%. 영업시간이 짧고 계좌가 필요할 때가 있다.': '2-3%. Limited hours, and sometimes requires an account.',
  '정액 수수료 + 환율. 한 번에 많이 뽑을수록 유리. DCC(자국 통화 결제) 제안은 거절할 것.': 'A flat fee plus the exchange rate. Withdrawing more at once is more efficient. Always decline a DCC (pay-in-home-currency) prompt.',
  // Notebook
  '수첩': 'Notebook',
  '(예시)': '(example)',
  '저장을 지우고 처음부터 시작할까요?': 'Erase your save and start over?',
  '수첩 닫기': 'Close notebook',
  '카드': 'Cards',
  '여권': 'Passport',
  '기사': 'Articles',
  '편지': 'Letters',
  'LES SOUVENIRS': 'LES SOUVENIRS',
  '여행이 남긴 장면들.': 'The scenes your trip has left behind.',
  '장의 사진 · ': ' photos · ',
  '곳의 산책 · ': ' walks · ',
  '가지의 맛': ' tastes',
  '전체': 'All',
  '첫 사진을 기다리는 페이지': 'A page waiting for its first photo',
  "도시 화면의 '사진 담기'를 누르거나, 사진 산책에서 장소를 방문해보세요.": "Tap 'Capture photo' on a city screen, or visit a place on a photo walk.",
  '첫 풍경 만나러 가기 →': 'Meet your first view →',
  '앞으로 채워질 여행': 'The journey still to come',
  '장의 풍경': ' views',
  '· 미방문': ' · not visited',
  '문장마다 출처를 열 수 있습니다 — "실제 역사 기반"이라는 약속의 실체.': 'Every sentence links to a source — the substance behind the "based on real history" promise.',
  '아직 비어 있습니다. 미션에서 장소를 방문하고 퀴즈를 풀면 채워집니다.': 'Still empty. Visit places and answer quizzes in missions to fill this in.',
  '현금': 'Cash',
  '수수료·스프레드로 잃은 돈': 'Lost to fees and spread',
  '편집부 선지급 부채': "Debt to the editor's advance",
  '환율 보드 · 환전': 'Exchange board · Convert',
  '가격표 맞추기 · 나의 물가 감각': 'Guess-the-price · your sense of local prices',
  '아직 기록 없음.': 'No attempts yet.',
  '전체 평균 오차': 'Overall average error',
  '최근 5회 평균': 'Last 5 average',
  '시도': 'attempts',
  '예상': 'guessed',
  '실제': 'actual',
  '스탬프': 'Stamps',
  '도시 미션을 완료하면 스탬프가 찍힙니다.': 'A stamp lands here once you finish a city mission.',
  '방문 도시': 'Cities visited',
  '수집품': 'Collectibles',
  '엽서·옛 화폐·오토크롬 복제본이 여기 모입니다.': 'Postcards, old currency, and autochrome reproductions collect here.',
  '테오의 경주': "Theo's race",
  '불로뉴 메인 미션을 마치면 국경 너머에서 테오와의 경주가 시작됩니다.': 'The race against Theo begins once you finish the Boulogne main mission.',
  '먼저 도착해 특종을 냈다.': 'You got there first and filed the scoop.',
  '테오가 먼저 도착해 특종은 없었다.': 'Theo got there first — no scoop this time.',
  '테오가 이미 도착했다 — 지금 가면 특종을 놓친다.': "Theo is already there — go now and you'll miss the scoop.",
  '테오 도착 예정: ': 'Theo arrives: ',
  '테오보다 먼저 특종': 'scooped Theo',
  '테오가 먼저 다녀감': 'Theo was here first',
  '테오보다 D-': 'Theo in D-',
  '테오가 이미 도착 — 서두르세요': 'Theo is already here — hurry',
  '송고한 기사가 없습니다.': 'No articles filed yet.',
  '원고료 배율': 'fee multiplier',
  '. 등급이 높을수록 평판이 빨리 오릅니다.': '. Higher grades raise your reputation faster.',
  'L.의 편지는 지역 메인 미션을 완주하면 열립니다.': "L.'s letters unlock as you complete each region's main mission.",
  // CityPanel 탭·문구
  '오늘의 취재': "Today's assignment",
  '사진 산책': 'Photo walk',
  '기차표': 'Tickets',
  '작은 식탁': 'A small table',
  '숙소에서 자기': 'Sleep at the hostel',
  '자기': 'Sleep',
  '선행': 'Requires',
  '한 장소씩 걸으며 사진을 모으세요. 방문하면 현장 사진이 앨범에 남아요. 입장료와 30분의 여행 시간이 듭니다.': 'Walk from place to place collecting photos. Visiting adds a snapshot to your album and costs the entrance fee plus about 30 minutes.',
  '요금은 예시이며 분기별 갱신됩니다. "미리 예약"은 내일 첫차(오늘 숙박 포함), "당일"은 지금 다음 열차.': 'Fares are illustrative and refreshed quarterly. "Advance" books tomorrow\'s first departure (with tonight\'s stay); "Same day" takes the next train now.',
  '당일': 'Same day',
  '미리 예약': 'Advance',
  '숙박 포함': 'stay included',
  '진행 중인 미션이 있어 이동할 수 없습니다.': 'You cannot travel while a mission is in progress.',
  '에서 가는 직행 노선이 없습니다. 파리를 경유하세요.': ' has no direct route from here. Try connecting through Paris.',
  '가격표 맞추기 도전': 'Guess-the-price challenge',
  '선택형 미식 미션 →': 'An optional food mission →',
  '먹기 +': 'Eat +',
  '지역 잠김': 'region locked',
  '휴관': 'closed',
  '오늘 휴관': 'closed today',
  '방문 완료': 'Visited.',
  '사진을 앨범에 붙였어요.': 'Added the photo to your album.',
  '산책 기록을 남겼어요.': 'Logged the walk.',
  // Scene / 미션 스텝
  '수첩에 붙입니다': 'Adding to your notebook',
  '힌트: 파리 기준가': 'Hint: Paris base price',
  '힌트: 기준가': 'Hint: base price',
  '이 도시 물가지수': "this city's price index",
  '이 도시에서는 얼마일까요? 가격표 하나를 골라보세요.': 'What might it cost here? Pick one price tag.',
  '선택한 값은 예상가예요. 결제는 실제 가격으로 진행돼요.': 'Your pick is only a guess — you still pay the real price.',
  '거의 정확. 이 도시 물가가 손에 잡히기 시작했다.': "Very close — you're starting to get a feel for prices here.",
  '방향은 맞다. 파리 기준가에 물가지수를 곱해 보자.': "The right direction — try multiplying the Paris base price by the local index.",
  '방향은 맞다. 기준가에 물가지수를 곱해 보자.': "The right direction — try multiplying the base price by the local index.",
  '많이 빗나갔다. 카드 결제 전에 현지 통화로 한 번 더 셈해 보는 습관.': "Well off — get in the habit of doing the local-currency math before you tap your card.",
  '남음': 'left',
  '수첩 › 편지에 보관됩니다': 'Filed under Notebook › Letters',
  '지도가 넓어졌다.': 'The map has grown.',
  '수집품 획득': 'Collectible acquired',
  '여권에 스탬프가 찍혔다.': 'A stamp has landed in your passport.',
  '정답. ': 'Correct. ',
  '오답 — 기사 정확도가 조금 떨어집니다. ': 'Incorrect — this will cost a little article accuracy. ',
  '맞았다. 사진 속 풍경과 지금의 장소가 겹쳐진다.': 'A match — the photo lines up with where you are standing.',
  '아니다. 뒷면 메모를 다시 읽어보면 답이 보인다.': 'Not quite — re-read the note on the back for a clue.',
  '정확한 순서.': 'The right order.',
  '아쉽다. 정답: ': 'Close, but no — the order was: ',
  '순서대로 눌러 주세요': 'Tap them in order',
  '이가 생겼다 ▸': ' acquired ▸',
  '을(를) 충분히 갖고 있네요. 바로 다음 취재로 가도 좋아요.': " — you already have enough. Feel free to move on.",
  '도시 안 이동': 'Local transfer',
  '지금': 'now',
  '기사 조립 —': 'Assembling the article —',
  '카드를 골라 기사에 넣으세요. 등급(C/B/A/S)은 수집률과 정확도로 결정됩니다.': 'Pick which cards go into the article. Your grade (C/B/A/S) depends on coverage and accuracy.',
  '(수집하지 못한 카드)': '(card not collected)',
  // Intro — 홍보 문구
  '길을 잃어도,': 'Even if you lose your way,',
  '이야기는 남으니까.': 'the story stays with you.',
  '한 장의 사진에서 시작해 국경 너머로 이어지는 여행': 'A journey that starts with one photograph and crosses borders',
  '세계를 걷는 기록': 'A record of walking the world',
  '기차표 한 장, 카메라 하나.': 'One train ticket, one camera.',
  '당신만의 여행을 써 내려가세요.': 'Write the journey that is yours alone.',
  '파리의 작은 여행 잡지에 도착한 낡은 사진 상자. 사라진 선배 L.의 흔적을 따라 골목을 걷고, 현지 음식을 맛보고, 다음 도시로 향하는 기사를 써보세요. 라이벌 작가 테오는 이미 국경 너머로 떠났습니다 — 프랑스를 다 걷고 갈지, 그를 앞질러 갈지는 당신의 선택입니다.':
    "A worn box of photographs has arrived at a small Paris travel magazine. Follow the trail of your vanished senior colleague L. through the back streets, taste the local food, and file the story that pays for your next city. Your rival Theo has already crossed the border — whether you finish France first or race to beat him there is up to you.",
  '개의 실제 도시': ' real cities',
  '개의 취재 미션': ' assignments',
  '나만의 시선': 'a view all your own',
  '실제 장소의 사진과 출처가 있는 역사 카드. 사진을 누르면 원본과 촬영자를 볼 수 있어요. 환율·가격·교통 시간은 게임용 예시입니다.':
    'Real-place photos and sourced history cards. Tap a photo to see the original and its photographer. Exchange rates, prices, and travel times are illustrative for gameplay.',
  // CityPanel
  '메트로': 'Metro',
  '트랑실리앙': 'Transilien',
  '유로스타': 'Eurostar',
  '버스': 'Bus',
  '메인': 'Main',
  '도시 이야기': 'City story',
  '인물(메아리)': 'Figure (Echo)',
  '미식': 'Food',
  '이동': 'Transport',
  '튜토리얼': 'Tutorial',
  '도시 정보 닫기': 'Close city info',
  '인구': 'Population',
  '물가지수': 'Price index',
  '(파리=1)': '(Paris=1)',
  '내 커피 지표': 'My coffee index',
  '잠김': 'Locked',
  '의 한마디': "'s word",
  '분': 'min',
  '선행: ': 'Requires: ',
  '체력 회복 · 다음 날 08:00': 'restores stamina · next day 08:00',
  '상시': 'Always open',
  '방문 완료. ': 'Visited. ',
  ' 출발 · 하루 ': ' departs · ',
  '편 · 첫차 ': ' per day · first ',
  ' / 막차 ': ' / last ',
  '이후 다음 편 · ≈': 'onward, next departure · ≈',
  '에서 맛보는 한 끼. 먹으면 체력이 회복되고 음식 사진이 앨범에 남아요.': 'A meal to try here. Eating restores stamina and adds a photo to your album.',
  '파리 대비 ': 'vs. Paris, ',
  '% 저렴': '% cheaper',
  '파리보다 비쌈': 'pricier than Paris',
  '시장·노점': 'Market stall',
  '상점·빵집': 'Shop · bakery',
  '비스트로': 'Bistro',
  '레스토랑': 'Restaurant',
  // Scene.tsx
  '에서의 기록': ': field notes',
  '✎ 창작 대사 — 실제 기록·저작을 바탕으로 재구성한 문장입니다.': '✎ Dramatized line — reconstructed from real records and writings.',
  '❝ 기록 인용 — 실제 저작·서한·기록에 근거한 문장입니다.': '❝ Quoted record — based on real writings, letters, or records.',
  '이미 ': 'You already have plenty of ',
  '를 충분히 갖고 있네요. 바로 다음 취재로 가도 좋아요.': '. Feel free to move on to the next assignment.',
  '포토 매칭 — L.의 사진은 지금 어디일까?': "Photo match — where is L.'s photo taken?",
  '관람 약 ': 'visit ~',
  '분 · 지금 ': 'min · now ',
  '숙소에서 자고 내일 다시 오거나, 미션을 잠시 접어둘 수 있습니다.': 'You can sleep at the hostel and return tomorrow, or pause the mission.',
  '입장 ▸': 'Enter ▸',
  '자국 통화': 'home currency',
  '내 예상 ': 'My guess ',
  '오차 ': 'error ',
  '체력 +': 'Stamina +',
  '기본 원고료': 'base fee',
  '. 카드를 골라 기사에 넣으세요. 등급(C/B/A/S)은 수집률과 정확도로 결정됩니다.': '. Pick which cards go into the article — your grade (C/B/A/S) depends on coverage and accuracy.',
  '수집한 사실 카드 ': 'Fact cards collected ',
  '장 · 퀴즈 오답 ': ' · quiz misses ',
  '회 · ': ' · ',
  '이건 표지감이에요. 사실마다 출처가 붙어 있고 문장이 살아 있어요.': "This is cover-story material. Every fact is sourced and the writing is alive.",
  '좋아요. 빠진 카드 한두 장이 아깝지만, 이대로 실어요.': "Good. A card or two is missing, but let's run it as is.",
  '실을 수는 있어요. 다음엔 장소를 하나라도 더 가요.': "It's publishable. Try visiting one more place next time.",
  '원고료는 주지만… L.이라면 이렇게 안 썼을 거예요.': "You'll be paid, but... L. wouldn't have written it this way.",
  ' 송금했어요.': ' has been wired to you.',
  '수집품 획득: ': 'Collectible acquired: ',
  '기사 조립 — ': 'Assembling the article — ',
  '원고료': 'Fee',
  // 지역 이름
  '일드프랑스': 'Île-de-France',
  '프랑스 북부': 'Northern France',
  '루아르·중부': 'Loire · Central France',
  '국경 너머': 'Beyond the Border',
  '확대하면 거점·유산 도시 이름도 보여요.': 'Zoom in to see hub and heritage city names too.',
};

export function useT() {
  const lang = useGame((s) => s.lang);
  return (ko: string): string => t(lang, ko);
}

export function t(lang: Locale, ko: string): string {
  return lang === 'en' ? translateEnglish(ko) : ko;
}

export const ENGLISH: Record<string, string> = { ...DICT, ...english };
const hangul = /[가-힣]/;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templates = Object.entries(ENGLISH).filter(([key]) => /\{\d+\}/.test(key))
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, '').length - a.replace(/\{\d+\}/g, '').length)
  .map(([key, value]) => ({ pattern: new RegExp('^' + key.split(/\{\d+\}/).map(escapeRegex).join('(.*?)') + '$', 's'), value }));
const phrases = Object.keys(ENGLISH).filter((key) => key.length > 1 && hangul.test(key) && !/\{\d+\}/.test(key)).sort((a, b) => b.length - a.length);
const phrasePattern = new RegExp(phrases.map(escapeRegex).join('|'), 'g');
const cache = new Map<string, string>();
export function translateEnglish(text: string): string {
  if (!hangul.test(text)) return text;
  const exact = ENGLISH[text];
  if (exact !== undefined) return exact;
  const cached = cache.get(text);
  if (cached !== undefined) return cached;
  let result: string | undefined;
  for (const template of templates) {
    const match = template.pattern.exec(text);
    if (!match) continue;
    result = template.value.replace(/\{(\d+)\}/g, (_, i: string) => translateEnglish(match[Number(i) + 1] ?? ''));
    break;
  }
  // Supports older saved messages assembled from already-translated fragments.
  result ??= text.replace(phrasePattern, (key) => ENGLISH[key]);
  if (cache.size > 3000) cache.clear();
  cache.set(text, result);
  return result;
}

/** Translate only displayed text, never mutate data or React elements. */
export function translateDisplay<T>(value: T): T {
  if (useGame.getState().lang !== 'en') return value;
  if (typeof value === 'string') return translateEnglish(value) as T;
  if (Array.isArray(value)) return value.map(translateDisplay) as T;
  return value;
}

/** "N일차" ↔ "Day N" */
export function dayLabel(lang: Locale, day: number): string {
  return lang === 'en' ? `Day ${day}` : `${day}일차`;
}

const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** WEEKDAYS[wd] + "요일" 형태를 언어에 맞게. wd: 0=일 ... 6=토 */
export function weekdayLabel(lang: Locale, wd: number, weekdaysKo: string[]): string {
  return lang === 'en' ? WEEKDAY_EN[wd] : `${weekdaysKo[wd]}요일`;
}
