import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency, Edge, RegionId, Step } from './types';
import { CITIES, cityById } from '../data/cities';
import { cardById } from '../data/cards';
import { photoById, placePhoto } from '../data/photos';
import { MISSIONS, missionById, FINAL_LETTER, EPILOGUE_LETTER } from '../data/missions';
import { CARD_FEE, FX_EUR, FX_CHANNELS, cityCurrency, convert, foodPrice, fmt, gradeArticle, quote, toEur, type FxChannel, type Grade } from './economy';
import { theoArrivalDay } from './rival';
import { createDrive, driverLevel, scoreDrive, upgradePrice, upgradeUnlock, type DriveRun, type DriveState, type DriveContract, type CarUpgrades, type Upgrade, type DriveResult } from './driving';
import { sfxArrive, sfxCard, sfxCash, sfxCorrect, sfxDepart, sfxDoor, sfxLose, sfxStamp, sfxWin, sfxWrong, setMuted as setAudioMuted } from '../audio';

export const START_WEEKDAY = 2; // 2026-09-08 화요일
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const WAKE_MINUTE = 8 * 60;
export const CURFEW_MINUTE = 22 * 60;

export interface ActiveMission {
  missionId: string;
  step: number;
  wrong: number; // 퀴즈 오답 수
  pendingSleep?: boolean; // 휴관으로 막힘
  result?: { kind: 'answer'; correct: boolean; picked?: number } | { kind: 'buy'; expected?: number; price: number } | { kind: 'article'; grade: Grade; fee: number };
}

export interface Article { missionId: string; cityId: string; grade: Grade; fee: number; day: number; cards: string[] }
export interface Letter { title: string; text: string; day: number }
export interface Guess { foodId: string; cityId: string; expected: number; actual: number }
export interface Snapshot { photoId: string; cityId: string; day: number }
export interface LogEntry { id: number; text: string; kind: 'info' | 'money' | 'card' | 'warn' | 'story' }
export interface RaceResult { cityId: string; won: boolean; day: number }

export type Locale = 'ko' | 'en';

export interface GameState {
  started: boolean;
  lang: Locale;
  playerName: string;
  home: Currency;
  day: number;
  minute: number;
  cityId: string;
  wallet: Record<Currency, number>;
  stamina: number;
  reputation: number;
  debt: number;
  unlocked: RegionId[];
  visited: string[];
  cards: string[];
  articles: Article[];
  stamps: { cityId: string; day: number }[];
  collectibles: string[];
  letters: Letter[];
  completed: string[];
  active: ActiveMission | null;
  guesses: Guess[];
  fxLost: number; // 환전·카드 수수료로 잃은 누적 EUR
  log: LogEntry[];
  finalShown: boolean;
  voyageShown: boolean;
  travelling: { edge: Edge; arriveMinute: number } | null;
  paused: boolean;
  snapshots: Snapshot[];
  visitedPois: string[];
  tastedFoods: string[];
  /** 불로뉴 메인 미션에서 국경 너머가 해금된 날. 테오의 국경 경주 시작점. */
  theoStartDay: number | null;
  theoRace: RaceResult[];
  muted: boolean;
  driverXp: number;
  driveSerial: number;
  carUpgrades: CarUpgrades;
  driveRun: DriveRun | null;
  driveHistory: { id: number; cityId: string; day: number; result: DriveResult }[];
  driveRewardedKeys: string[];

  // actions
  setPaused: (p: boolean) => void;
  beginDrive: (contract: DriveContract, label: string, missionKey?: string) => void;
  saveDrive: (id: number, state: DriveState) => void;
  settleDrive: (id: number) => void;
  endDrive: () => void;
  upgradeCar: (part: Upgrade) => boolean;
  setLang: (l: Locale) => void;
  setMuted: (m: boolean) => void;
  capturePhoto: (photoId: string) => void;
  newGame: (name: string, home: Currency) => void;
  reset: () => void;
  addLog: (text: string, kind?: LogEntry['kind']) => void;
  spendMinutes: (m: number, stamina?: number) => void;
  pay: (amount: number, currency: Currency, label: string) => boolean;
  exchange: (amount: number, from: Currency, to: Currency, ch: FxChannel) => void;
  buyFood: (foodId: string, guessEur?: number) => { price: number } | null;
  visitPoi: (poiId: string, minutes: number) => { ok: boolean; reason?: string };
  sleep: () => void;
  travel: (edge: Edge, advance: boolean) => { ok: boolean; reason?: string };
  arrive: () => void;
  startMission: (missionId: string) => void;
  currentStep: () => Step | null;
  nextStep: () => void;
  answer: (correct: boolean, picked?: number) => void;
  submitArticle: (selected: string[]) => { grade: Grade; fee: number } | null;
  abandonMission: () => void;
}

export const weekdayOf = (day: number) => (START_WEEKDAY + day - 1) % 7;
export const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const parseHm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

type Actions = 'newGame' | 'reset' | 'addLog' | 'spendMinutes' | 'pay' | 'exchange' | 'buyFood' | 'visitPoi' | 'sleep' | 'travel' | 'arrive' | 'startMission' | 'currentStep' | 'nextStep' | 'answer' | 'submitArticle' | 'abandonMission' | 'setPaused' | 'setLang' | 'setMuted' | 'capturePhoto' | 'beginDrive' | 'saveDrive' | 'settleDrive' | 'endDrive' | 'upgradeCar';
type Data = Omit<GameState, Actions>;
const fresh = (): Data => ({
  started: false, lang: 'ko', playerName: '', home: 'KRW', day: 1, minute: 9 * 60, cityId: 'paris',
  wallet: { EUR: 0, KRW: 3_000_000, GBP: 0, CHF: 0 },
  stamina: 100, reputation: 0, debt: 0,
  unlocked: ['idf'], visited: ['paris'], cards: [], articles: [], stamps: [], collectibles: [], letters: [],
  completed: [], active: null, guesses: [], fxLost: 0, log: [], finalShown: false, voyageShown: false, travelling: null, paused: false,
  snapshots: [], visitedPois: [], tastedFoods: [], theoStartDay: null, theoRace: [], muted: false,
  driverXp: 0, driveSerial: 0, carUpgrades: { handling: 0, boost: 0, bumper: 0 }, driveRun: null, driveHistory: [], driveRewardedKeys: [],
});

let logId = 1;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...fresh(),

      newGame: (name, home) => {
        const base = fresh();
        set({ ...base, lang: get().lang, started: true, playerName: name || '신입 작가', home,
          wallet: { EUR: 0, KRW: 0, GBP: 0, CHF: 0, [home]: Math.round(2000 * FX_EUR[home]) } as Record<Currency, number> });
        get().addLog('《Carnet》 편집부에 첫 출근. 예산 €2,000 상당 (자국 통화).', 'story');
      },
      reset: () => set({ ...fresh(), lang: get().lang }),

      beginDrive: (contract, label, missionKey) => {
        const s = get();
        if (s.travelling || s.driveRun || (!missionKey && s.active)) return;
        if (missionKey && (!s.active || `${s.active.missionId}:${s.active.step}` !== missionKey || get().currentStep()?.t !== 'move')) return;
        const id = s.driveSerial + 1;
        set({ driveSerial: id, driveRun: { id, cityId: s.cityId, label, missionKey, contract, upgrades: { ...s.carUpgrades }, state: createDrive(id * 971 + s.day * 31) } });
      },
      saveDrive: (id, state) => {
        const run = get().driveRun;
        if (!run || run.id !== id || run.result || state.elapsed < run.state.elapsed) return;
        set({ driveRun: { ...run, state } });
      },
      settleDrive: (id) => {
        const s = get(); const run = s.driveRun;
        if (!run || run.id !== id || run.result || !run.state.finished) return;
        const replay = !!run.missionKey && s.driveRewardedKeys.includes(run.missionKey);
        const result = scoreDrive(run.state, run.contract, driverLevel(s.driverXp));
        if (replay) { result.earned = 0; result.xp = 0; result.gross = 0; result.repairs = 0; }
        set({ driverXp: s.driverXp + result.xp, wallet: { ...s.wallet, EUR: Math.round((s.wallet.EUR + result.earned) * 100) / 100 },
          driveRun: { ...run, result }, minute: s.minute + (run.missionKey ? 0 : 15),
          driveHistory: [...s.driveHistory.slice(-49), { id, cityId: run.cityId, day: s.day, result }],
          driveRewardedKeys: run.missionKey && !replay ? [...s.driveRewardedKeys, run.missionKey] : s.driveRewardedKeys });
        get().addLog(`드라이브 ${result.grade} · +€${result.earned} · 운전 경험치 +${result.xp}${driverLevel(s.driverXp + result.xp) > driverLevel(s.driverXp) ? ' · 레벨 업!' : ''}`, 'money');
        if (result.arrived) sfxWin(); else sfxLose();
      },
      endDrive: () => set({ driveRun: null }),
      upgradeCar: (part) => {
        const s = get(); const rank = s.carUpgrades[part];
        if (s.driveRun || rank === undefined || rank >= 3 || driverLevel(s.driverXp) < upgradeUnlock(rank) || s.wallet.EUR < upgradePrice(rank)) return false;
        set({ wallet: { ...s.wallet, EUR: Math.round((s.wallet.EUR - upgradePrice(rank)) * 100) / 100 }, carUpgrades: { ...s.carUpgrades, [part]: rank + 1 } });
        sfxCash(); return true;
      },

      capturePhoto: (photoId) => {
        const s = get();
        const photo = photoById(photoId);
        if (!photo || s.travelling || s.snapshots.some((p) => p.photoId === photo.id)) return;
        if (photo.id !== s.cityId && !photo.id.startsWith(`${s.cityId}:`) && !photo.id.startsWith('food:')) return;
        set({ snapshots: [...s.snapshots, { photoId: photo.id, cityId: s.cityId, day: s.day }] });
        get().addLog(`사진 앨범에 붙였어요 · ${photo.title}`, 'card');
      },

      addLog: (text, kind = 'info') => set((s) => ({ log: [...s.log.slice(-40), { id: logId++, text, kind }] })),

      spendMinutes: (m, st = 0) => set((s) => ({ minute: s.minute + m, stamina: Math.max(0, s.stamina - st) })),

      // amount는 currency 기준 실제 금액(도시 통화 또는 EUR). 부족하면 카드(자국 통화, 수수료 1.5%) → 편집장 선지급 순.
      pay: (amount, currency, label) => {
        const s = get();
        const w = { ...s.wallet };
        let fxLost = s.fxLost;
        if (w[currency] >= amount) {
          w[currency] = Math.round((w[currency] - amount) * 100) / 100;
          set({ wallet: w });
          get().addLog(`${label}: −${fmt(amount, currency)} (현금)`, 'money');
          return true;
        }
        // 부족분은 카드 결제(자국 통화 계좌에서 인출, 수수료 1.5%)
        const remain = amount - w[currency];
        const homeNeed = convert(remain, currency, s.home) * (1 + CARD_FEE);
        if (w[s.home] >= homeNeed) {
          w[currency] = 0;
          w[s.home] = Math.round(w[s.home] - homeNeed);
          fxLost += toEur(remain, currency) * CARD_FEE;
          set({ wallet: w, fxLost });
          get().addLog(`${label}: −${fmt(amount, currency)} (현금 부족분 ${fmt(remain, currency)}은 카드, 수수료 1.5%)`, 'money');
          return true;
        }
        // 파산 → 편집장 선지급 €300 상당, 이자 10%
        const advLocal = convert(300, 'EUR', currency);
        w[currency] = Math.round((w[currency] + advLocal) * 100) / 100;
        set({ wallet: w, debt: s.debt + 300 * 1.1 });
        get().addLog(`잔고 부족. 마고 편집장이 ${fmt(advLocal, currency)}(≈€300)을 선지급했다 (이자 10%, 원고료에서 차감).`, 'warn');
        return get().pay(amount, currency, label);
      },

      exchange: (amount, from, to, ch) => {
        const s = get();
        if (amount <= 0 || s.wallet[from] < amount) return;
        const q = quote(amount, from, to, ch);
        const w = { ...s.wallet };
        w[from] -= amount;
        w[to] = Math.round((w[to] + q.receive) * 100) / 100;
        set({ wallet: w, fxLost: s.fxLost + toEur(q.lost, to), minute: s.minute + 10 });
        get().addLog(`${FX_CHANNELS[ch].name}에서 환전: ${amount.toLocaleString()} ${from} → ${q.receive.toFixed(2)} ${to} (스프레드 손실 ≈ ${q.lost.toFixed(2)} ${to})`, 'money');
      },

      buyFood: (foodId, guessEur) => {
        const s = get();
        const city = cityById(s.cityId);
        const food = city.foods.find((f) => f.id === foodId);
        if (!food) return null;
        const missionStep = get().currentStep();
        const missionPurchase = missionStep?.t === 'buy' && missionStep.foodId === foodId;
        if (missionPurchase && s.active?.result?.kind === 'buy') return { price: s.active.result.price };
        const price = foodPrice(food, city);
        get().pay(price, cityCurrency(city), `${food.name} 구매`);
        set((st) => ({
          stamina: Math.min(100, st.stamina + food.stamina), minute: st.minute + 15,
          guesses: guessEur !== undefined ? [...st.guesses, { foodId, cityId: city.id, expected: guessEur, actual: price }] : st.guesses,
          tastedFoods: Array.from(new Set([...st.tastedFoods, `${city.id}:${foodId}`])),
        }));
        get().capturePhoto(`food:${foodId}`);
        if (missionPurchase && get().active) set({ active: { ...get().active!, result: { kind: 'buy', expected: guessEur, price } } });
        sfxCash();
        return { price };
      },

      visitPoi: (poiId, minutes) => {
        const s = get();
        const city = cityById(s.cityId);
        const poi = city.pois.find((p) => p.id === poiId);
        if (!poi) return { ok: false, reason: '장소 없음' };
        const wd = weekdayOf(s.day);
        if (poi.closedDays?.includes(wd)) return { ok: false, reason: `${poi.name}은(는) ${WEEKDAYS[wd]}요일 휴관입니다. 실제 개장 요일을 따릅니다.` };
        if (s.minute + minutes > CURFEW_MINUTE) return { ok: false, reason: '너무 늦었습니다. 오늘은 여기까지 — 숙소에서 자고 내일 다시.' };
        if (s.stamina < 15) return { ok: false, reason: '체력이 바닥났습니다. 뭔가 먹거나 자야 합니다.' };
        if (poi.feeEur > 0) get().pay(poi.feeEur, cityCurrency(city), `${poi.name} 입장`);
        set({ minute: s.minute + minutes, stamina: Math.max(0, s.stamina - Math.round(minutes / 8)) });
        set({ visitedPois: Array.from(new Set([...s.visitedPois, `${city.id}:${poiId}`])) });
        const photo = placePhoto(city.id, poiId);
        if (photo) get().capturePhoto(photo.id);
        if (!s.visited.includes(city.id)) set({ visited: [...s.visited, city.id] });
        sfxDoor();
        return { ok: true };
      },

      sleep: () => {
        const s = get();
        const city = cityById(s.cityId);
        const cost = Math.round(city.hostelEur * city.priceIndex);
        get().pay(cost, cityCurrency(city), `${city.names.ko} 호스텔 1박`);
        const late = s.minute > 24 * 60;
        set({ day: s.day + 1, minute: WAKE_MINUTE, stamina: late ? 80 : 100,
          active: s.active ? { ...s.active, pendingSleep: false } : null });
        get().addLog(`${s.day + 1}일차 아침. ${WEEKDAYS[weekdayOf(s.day + 1)]}요일.`, 'info');
      },

      travel: (edge, advance) => {
        const s = get();
        if (s.travelling || edge.from !== s.cityId) return { ok: false, reason: '현재 도시에서 출발하는 노선을 골라주세요.' };
        const dest = cityById(edge.to);
        if (!s.unlocked.includes(dest.region)) return { ok: false, reason: '아직 잠긴 지역입니다.' };
        if (s.active) return { ok: false, reason: '진행 중인 미션이 있습니다. 먼저 끝내거나 포기하세요.' };
        const [lo, hi] = edge.fareEur;
        const fare = advance ? lo : hi;
        const first0 = parseHm(edge.first);
        let last = parseHm(edge.last);
        if (last < first0) last += 24 * 60; // 자정 넘는 막차
        if (!advance && s.minute > last) return { ok: false, reason: `막차(${edge.last})가 떠났습니다. 내일 첫차를 예약하세요.` };
        get().pay(fare, 'EUR', `${dest.names.ko}행 ${edge.operator} (${advance ? '미리 예약' : '당일'})`);
        let minute = s.minute;
        let day = s.day;
        if (advance) {
          // 내일 첫차: 오늘 숙박 후 출발
          get().sleep();
          day = get().day;
          minute = Math.max(parseHm(edge.first), WAKE_MINUTE);
        } else {
          const first = parseHm(edge.first);
          if (minute < first) minute = first;
          // 다음 출발까지 대기 (하루 편수로 배차 간격 근사)
          const headway = Math.max(5, Math.round((last - first) / edge.perDay));
          minute += Math.round(headway / 2);
        }
        const arrive = minute + edge.minutes;
        set({ day, minute, travelling: { edge, arriveMinute: arrive } });
        sfxDepart();
        return { ok: true };
      },

      arrive: () => {
        const s = get();
        if (!s.travelling) return;
        const { edge, arriveMinute } = s.travelling;
        const dest = cityById(edge.to);
        set({ cityId: edge.to, minute: arriveMinute, travelling: null,
          stamina: Math.max(0, s.stamina - Math.round(edge.minutes / 15)),
          visited: s.visited.includes(edge.to) ? s.visited : [...s.visited, edge.to] });
        sfxArrive();
        get().addLog(`${dest.names.ko} 도착 (${clock(arriveMinute)}).`, 'story');
      },

      startMission: (missionId) => {
        const s = get();
        const m = missionById(missionId);
        if (s.active || s.completed.includes(missionId) || m.cityId !== s.cityId) return;
        if (m.requires?.some((r) => !s.completed.includes(r))) return;
        set({ active: { missionId, step: 0, wrong: 0 }, paused: false });
      },

      currentStep: () => {
        const a = get().active;
        if (!a) return null;
        return missionById(a.missionId).steps[a.step] ?? null;
      },

      // 현재 스텝의 자동 효과를 적용하고 다음으로
      nextStep: () => {
        const s = get();
        const a = s.active;
        if (!a) return;
        const m = missionById(a.missionId);
        const step = m.steps[a.step];
        if (step) {
          switch (step.t) {
            case 'card': {
              if (!s.cards.includes(step.cardId)) {
                set({ cards: [...s.cards, step.cardId] });
                get().addLog(`사실 카드 수집: ${cardById(step.cardId).text.slice(0, 40)}…`, 'card');
                sfxCard();
              }
              break;
            }
            case 'letter': set({ letters: [...s.letters, { ...step, day: s.day }] }); break;
            case 'unlock': {
              const u = Array.from(new Set([...s.unlocked, ...step.regions]));
              const patch: Partial<Data> = { unlocked: u };
              if (step.regions.includes('border') && s.theoStartDay === null) patch.theoStartDay = s.day;
              set(patch);
              get().addLog(step.note, 'story');
              break;
            }
            case 'collect': set({ collectibles: [...s.collectibles, step.item] }); get().addLog(`수집품: ${step.item}`, 'card'); break;
            case 'stamp': {
              if (!s.stamps.some((x) => x.cityId === m.cityId)) {
                const city = cityById(m.cityId);
                set({ stamps: [...s.stamps, { cityId: m.cityId, day: s.day }] });
                sfxStamp();
                if (city.region === 'border' && !s.theoRace.some((r) => r.cityId === m.cityId)) {
                  const arrival = theoArrivalDay(m.cityId, s.theoStartDay);
                  const won = arrival !== null && s.day <= arrival;
                  set((st) => ({
                    theoRace: [...st.theoRace, { cityId: m.cityId, won, day: st.day }],
                    reputation: won ? st.reputation + 2 : st.reputation,
                    wallet: won ? { ...st.wallet, EUR: Math.round((st.wallet.EUR + 20) * 100) / 100 } : st.wallet,
                  }));
                  setTimeout(() => (won ? sfxWin() : sfxLose()), 250);
                  get().addLog(
                    won ? `테오보다 먼저 ${city.names.ko}에 도착! 특종 보너스 +€20, 평판 +2.` : `${city.names.ko}엔 테오가 먼저 다녀갔다. 이번엔 특종 보너스 없음 — 그래도 기록은 기록.`,
                    won ? 'money' : 'warn',
                  );
                }
              }
              break;
            }
            case 'move': {
              const moveCity = cityById(m.cityId);
              get().pay(moveCity.transitFareEur ?? 2.5, cityCurrency(moveCity), `${step.zone} 현지 이동비`);
              set({ minute: get().minute + step.minutes, stamina: Math.max(0, get().stamina - 3) });
              break;
            }
            case 'say': set({ minute: s.minute + 2 }); break;
            default: break;
          }
        }
        const next = a.step + 1;
        if (next >= m.steps.length) {
          const completed = [...get().completed, m.id];
          set({ active: null, completed });
          get().addLog(`미션 완료: 「${m.title}」`, 'story');
          // 북부·중부 소도시 전부 완료 → 축하 편지 (국경 너머는 불로뉴 미션에서 이미 해금됨)
          const remote = MISSIONS.filter((x) => !x.id.includes('-discovery-') && ['nord', 'centre'].includes(cityById(x.cityId).region));
          if (!get().finalShown && remote.every((x) => completed.includes(x.id))) {
            set({ finalShown: true, letters: [...get().letters, { ...FINAL_LETTER, day: get().day }] });
          }
          // 국경 너머(런던·브뤼셀·제네바·쾰른·바르셀로나) 전부 완료 → 완결 편지
          const border = MISSIONS.filter((x) => !x.id.includes('-discovery-') && cityById(x.cityId).region === 'border');
          if (!get().voyageShown && border.length > 0 && border.every((x) => completed.includes(x.id))) {
            set({ voyageShown: true, letters: [...get().letters, { ...EPILOGUE_LETTER, day: get().day }] });
          }
        } else {
          set({ active: { ...a, step: next, result: undefined } });
        }
      },

      answer: (correct, picked) => {
        const a = get().active;
        if (!a || a.result) return;
        const step = missionById(a.missionId).steps[a.step];
        if (step?.t === 'photo') get().capturePhoto(step.photoId);
        const cardId = step && 'cardId' in step ? step.cardId : undefined;
        if (cardId && !get().cards.includes(cardId)) {
          set({ cards: [...get().cards, cardId] });
          get().addLog(`사실 카드 수집: ${cardById(cardId).text.slice(0, 40)}…`, 'card');
        }
        set({ active: { ...a, wrong: a.wrong + (correct ? 0 : 1), result: { kind: 'answer', correct, picked } }, minute: get().minute + 5 });
        if (correct) sfxCorrect(); else sfxWrong();
      },

      submitArticle: (selected) => {
        const s = get();
        const a = s.active;
        if (!a) return null;
        if (a.result?.kind === 'article') return { grade: a.result.grade, fee: a.result.fee };
        const previous = s.articles.find((article) => article.missionId === a.missionId);
        if (previous) {
          set({ active: { ...a, result: { kind: 'article', grade: previous.grade, fee: previous.fee } } });
          return { grade: previous.grade, fee: previous.fee };
        }
        const m = missionById(a.missionId);
        const step = m.steps[a.step];
        if (!step || step.t !== 'article') return null;
        const valid = [...new Set(selected)].filter((c) => m.cardIds.includes(c) && s.cards.includes(c));
        const g = gradeArticle(valid.length, m.cardIds.length, a.wrong);
        const repMult = 1 + s.reputation * 0.01;
        let fee = Math.round(step.baseFee * g.mult * repMult);
        let debt = s.debt;
        if (debt > 0) { const pay = Math.min(debt, fee); debt -= pay; fee -= pay; get().addLog(`선지급금 상환 −€${pay.toFixed(0)}`, 'warn'); }
        const w = { ...s.wallet, EUR: Math.round((s.wallet.EUR + fee) * 100) / 100 };
        const repGain = { S: 4, A: 3, B: 2, C: 1 }[g.grade];
        set({ wallet: w, debt, reputation: s.reputation + repGain, minute: s.minute + 45,
          active: { ...a, result: { kind: 'article', grade: g.grade, fee } },
          articles: [...s.articles, { missionId: m.id, cityId: m.cityId, grade: g.grade, fee, day: s.day, cards: valid }] });
        get().addLog(`기사 송고 「${m.title}」 — 등급 ${g.grade}, 원고료 €${fee}`, 'money');
        return { grade: g.grade, fee };
      },

      abandonMission: () => set({ active: null, paused: false, driveRun: null }),
      setPaused: (p) => set({ paused: p }),
      setLang: (l) => set({ lang: l }),
      setMuted: (m) => { setAudioMuted(m); set({ muted: m }); },
    }),
    { name: 'carnet-save-v1', partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as GameState },
  ),
);

export const allCities = CITIES;
