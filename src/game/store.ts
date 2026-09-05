import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Currency, Edge, RegionId, Step } from './types';
import { CITIES, cityById } from '../data/cities';
import { cardById } from '../data/cards';
import { MISSIONS, missionById, FINAL_LETTER } from '../data/missions';
import { CARD_FEE, FX_EUR, FX_CHANNELS, foodPrice, gradeArticle, quote, toEur, type FxChannel, type Grade } from './economy';

export const START_WEEKDAY = 2; // 2026-09-08 화요일
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const WAKE_MINUTE = 8 * 60;
export const CURFEW_MINUTE = 22 * 60;

export interface ActiveMission {
  missionId: string;
  step: number;
  wrong: number; // 퀴즈 오답 수
  pendingSleep?: boolean; // 휴관으로 막힘
}

export interface Article { missionId: string; cityId: string; grade: Grade; fee: number; day: number; cards: string[] }
export interface Letter { title: string; text: string; day: number }
export interface Guess { foodId: string; cityId: string; expected: number; actual: number }
export interface LogEntry { id: number; text: string; kind: 'info' | 'money' | 'card' | 'warn' | 'story' }

export interface GameState {
  started: boolean;
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
  travelling: { edge: Edge; arriveMinute: number } | null;
  paused: boolean;

  // actions
  setPaused: (p: boolean) => void;
  newGame: (name: string, home: Currency) => void;
  reset: () => void;
  addLog: (text: string, kind?: LogEntry['kind']) => void;
  spendMinutes: (m: number, stamina?: number) => void;
  payEur: (eur: number, label: string) => boolean;
  exchange: (amount: number, from: Currency, to: Currency, ch: FxChannel) => void;
  buyFood: (foodId: string, guessEur?: number) => { price: number } | null;
  visitPoi: (poiId: string, minutes: number) => { ok: boolean; reason?: string };
  sleep: () => void;
  travel: (edge: Edge, advance: boolean) => { ok: boolean; reason?: string };
  arrive: () => void;
  startMission: (missionId: string) => void;
  currentStep: () => Step | null;
  nextStep: () => void;
  answer: (correct: boolean) => void;
  submitArticle: (selected: string[]) => { grade: Grade; fee: number } | null;
  abandonMission: () => void;
}

export const weekdayOf = (day: number) => (START_WEEKDAY + day - 1) % 7;
export const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const parseHm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

type Actions = 'newGame' | 'reset' | 'addLog' | 'spendMinutes' | 'payEur' | 'exchange' | 'buyFood' | 'visitPoi' | 'sleep' | 'travel' | 'arrive' | 'startMission' | 'currentStep' | 'nextStep' | 'answer' | 'submitArticle' | 'abandonMission' | 'setPaused';
type Data = Omit<GameState, Actions>;
const fresh = (): Data => ({
  started: false, playerName: '', home: 'KRW', day: 1, minute: 9 * 60, cityId: 'paris',
  wallet: { EUR: 0, KRW: 3_000_000, GBP: 0, CHF: 0 },
  stamina: 100, reputation: 0, debt: 0,
  unlocked: ['idf'], visited: ['paris'], cards: [], articles: [], stamps: [], collectibles: [], letters: [],
  completed: [], active: null, guesses: [], fxLost: 0, log: [], finalShown: false, travelling: null, paused: false,
});

let logId = 1;

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...fresh(),

      newGame: (name, home) => {
        const base = fresh();
        set({ ...base, started: true, playerName: name || '신입 작가', home,
          wallet: { EUR: 0, KRW: 0, GBP: 0, CHF: 0, [home]: Math.round(2000 * FX_EUR[home]) } as Record<Currency, number> });
        get().addLog('《Carnet》 편집부에 첫 출근. 예산 €2,000 상당 (자국 통화).', 'story');
      },
      reset: () => set({ ...fresh() }),

      addLog: (text, kind = 'info') => set((s) => ({ log: [...s.log.slice(-40), { id: logId++, text, kind }] })),

      spendMinutes: (m, st = 0) => set((s) => ({ minute: s.minute + m, stamina: Math.max(0, s.stamina - st) })),

      payEur: (eur, label) => {
        const s = get();
        const w = { ...s.wallet };
        let fxLost = s.fxLost;
        if (w.EUR >= eur) {
          w.EUR = Math.round((w.EUR - eur) * 100) / 100;
          set({ wallet: w });
          get().addLog(`${label}: −€${eur.toFixed(2)} (현금)`, 'money');
          return true;
        }
        // 부족분은 카드 결제(자국 통화 계좌에서 인출, 수수료 1.5%)
        const remain = eur - w.EUR;
        const homeNeed = remain * FX_EUR[s.home] * (1 + CARD_FEE);
        if (w[s.home] >= homeNeed) {
          w.EUR = 0;
          w[s.home] = Math.round(w[s.home] - homeNeed);
          fxLost += remain * CARD_FEE;
          set({ wallet: w, fxLost });
          get().addLog(`${label}: −€${eur.toFixed(2)} (현금 부족분 €${remain.toFixed(2)}은 카드, 수수료 1.5%)`, 'money');
          return true;
        }
        // 파산 → 편집장 선지급 €300, 이자 10%
        const adv = 300;
        w.EUR = Math.round((w.EUR + adv) * 100) / 100;
        set({ wallet: w, debt: s.debt + adv * 1.1 });
        get().addLog('잔고 부족. 마고 편집장이 €300을 선지급했다 (이자 10%, 원고료에서 차감).', 'warn');
        return get().payEur(eur, label);
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
        const price = foodPrice(food, city);
        get().payEur(price, `${food.name} 구매`);
        set((st) => ({
          stamina: Math.min(100, st.stamina + food.stamina), minute: st.minute + 15,
          guesses: guessEur !== undefined ? [...st.guesses, { foodId, cityId: city.id, expected: guessEur, actual: price }] : st.guesses,
        }));
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
        if (poi.feeEur > 0) get().payEur(poi.feeEur, `${poi.name} 입장`);
        set({ minute: s.minute + minutes, stamina: Math.max(0, s.stamina - Math.round(minutes / 8)) });
        if (!s.visited.includes(city.id)) set({ visited: [...s.visited, city.id] });
        return { ok: true };
      },

      sleep: () => {
        const s = get();
        const city = cityById(s.cityId);
        const cost = Math.round(city.hostelEur * city.priceIndex);
        get().payEur(cost, `${city.names.ko} 호스텔 1박`);
        const late = s.minute > 24 * 60;
        set({ day: s.day + 1, minute: WAKE_MINUTE, stamina: late ? 80 : 100,
          active: s.active ? { ...s.active, pendingSleep: false } : null });
        get().addLog(`${s.day + 1}일차 아침. ${WEEKDAYS[weekdayOf(s.day + 1)]}요일.`, 'info');
      },

      travel: (edge, advance) => {
        const s = get();
        const dest = cityById(edge.to);
        if (!s.unlocked.includes(dest.region)) return { ok: false, reason: '아직 잠긴 지역입니다.' };
        if (s.active) return { ok: false, reason: '진행 중인 미션이 있습니다. 먼저 끝내거나 포기하세요.' };
        const [lo, hi] = edge.fareEur;
        const fare = advance ? lo : hi;
        const first0 = parseHm(edge.first);
        let last = parseHm(edge.last);
        if (last < first0) last += 24 * 60; // 자정 넘는 막차
        if (!advance && s.minute > last) return { ok: false, reason: `막차(${edge.last})가 떠났습니다. 내일 첫차를 예약하세요.` };
        get().payEur(fare, `${dest.names.ko}행 ${edge.operator} (${advance ? '미리 예약' : '당일'})`);
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
              }
              break;
            }
            case 'letter': set({ letters: [...s.letters, { ...step, day: s.day }] }); break;
            case 'unlock': {
              const u = Array.from(new Set([...s.unlocked, ...step.regions]));
              set({ unlocked: u });
              get().addLog(step.note, 'story');
              break;
            }
            case 'collect': set({ collectibles: [...s.collectibles, step.item] }); get().addLog(`수집품: ${step.item}`, 'card'); break;
            case 'stamp': {
              if (!s.stamps.some((x) => x.cityId === m.cityId)) set({ stamps: [...s.stamps, { cityId: m.cityId, day: s.day }] });
              break;
            }
            case 'move': {
              get().payEur(2.5, `${step.zone} 이동 (1회권)`);
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
          // 프로토타입 엔딩: 북부·중부 전부 완료
          const remote = MISSIONS.filter((x) => ['nord', 'centre'].includes(cityById(x.cityId).region));
          if (!get().finalShown && remote.every((x) => completed.includes(x.id))) {
            set({ finalShown: true, letters: [...get().letters, { ...FINAL_LETTER, day: get().day }] });
          }
        } else {
          set({ active: { ...a, step: next } });
        }
      },

      answer: (correct) => {
        const a = get().active;
        if (!a) return;
        const step = missionById(a.missionId).steps[a.step];
        const cardId = step && 'cardId' in step ? step.cardId : undefined;
        if (cardId && !get().cards.includes(cardId)) {
          set({ cards: [...get().cards, cardId] });
          get().addLog(`사실 카드 수집: ${cardById(cardId).text.slice(0, 40)}…`, 'card');
        }
        set({ active: { ...a, wrong: a.wrong + (correct ? 0 : 1) }, minute: get().minute + 5 });
      },

      submitArticle: (selected) => {
        const s = get();
        const a = s.active;
        if (!a) return null;
        const m = missionById(a.missionId);
        const step = m.steps[a.step];
        if (!step || step.t !== 'article') return null;
        const valid = selected.filter((c) => m.cardIds.includes(c) && s.cards.includes(c));
        const g = gradeArticle(valid.length, m.cardIds.length, a.wrong);
        const repMult = 1 + s.reputation * 0.01;
        let fee = Math.round(step.baseFee * g.mult * repMult);
        let debt = s.debt;
        if (debt > 0) { const pay = Math.min(debt, fee); debt -= pay; fee -= pay; get().addLog(`선지급금 상환 −€${pay.toFixed(0)}`, 'warn'); }
        const w = { ...s.wallet, EUR: Math.round((s.wallet.EUR + fee) * 100) / 100 };
        const repGain = { S: 4, A: 3, B: 2, C: 1 }[g.grade];
        set({ wallet: w, debt, reputation: s.reputation + repGain, minute: s.minute + 45,
          articles: [...s.articles, { missionId: m.id, cityId: m.cityId, grade: g.grade, fee, day: s.day, cards: valid }] });
        get().addLog(`기사 송고 「${m.title}」 — 등급 ${g.grade}, 원고료 €${fee}`, 'money');
        return { grade: g.grade, fee };
      },

      abandonMission: () => set({ active: null, paused: false }),
      setPaused: (p) => set({ paused: p }),
    }),
    { name: 'carnet-save-v1', partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function')) as GameState },
  ),
);

export const allCities = CITIES;
