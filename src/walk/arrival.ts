// 오늘 아침 파리에 도착한다. 어디서 묵을지 고르고, 공항에서 그 숙소까지 온다.
// 여기서 정한 것(값·조식·표)이 하루 내내 따라다닌다.
import { DISTRICTS } from './districts';
import { AIRPORT_TICKET, LIBERTE_CARD, TAXI_FLAT } from './trip';
import type { Pass } from './trip';
import { STAYS, TIER_LABEL } from './stays';
import type { Stay } from './stays';
import * as sfx from './sound';

export interface Arrival { stay: Stay; ride: RideChoice; pass: Pass }
export interface RideChoice { id: 'rer' | 'taxi'; label: string; mins: number; cost: number; tired: number; note: string }

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();

/** 좌안(5·6구)이면 택시 정액이 더 비싸다 */
const leftBank = (s: Stay) => s.district === 'saint-germain';

const rides = (stay: Stay): RideChoice[] => [
  { id: 'rer', label: 'RER B — 공항철도', mins: 52, cost: AIRPORT_TICKET, tired: 16,
    note: '터미널에서 역까지 걷고, 표를 사고, 개찰을 지나 승강장까지 계단. 캐리어를 들고 오르내려야 하고 아침이라 붐빈다. 시내까지 35분.' },
  { id: 'taxi', label: '택시 — 정액 요금', mins: 62, cost: leftBank(stay) ? TAXI_FLAT.left : TAXI_FLAT.right, tired: 4,
    note: `공항 택시 승강장은 줄이 있지만 값은 정해져 있다(${leftBank(stay) ? '좌안 €65' : '우안 €56'}). 문 앞까지 데려다준다. 아침 정체에 걸리면 더 걸린다.` },
];

function sheet(eyebrow: string, title: string, sub?: string) {
  const w = el('div', 'dest-sheet');
  w.appendChild(el('p', 'metro-eyebrow', eyebrow));
  w.appendChild(el('h2', '', title));
  if (sub) w.appendChild(el('p', 'metro-sub', sub));
  return w;
}

/** ① 어디서 묵을까 ② 공항에서 어떻게 올까 ③ 표는 어떻게 살까 */
export function openArrival(): Promise<Arrival> {
  return new Promise((resolve) => {
    const root = $('#trip');
    const show = (node: HTMLElement) => { root.replaceChildren(node); root.classList.add('on'); root.scrollTop = 0; };
    let stay: Stay;
    let ride: RideChoice;

    const pickStay = () => {
      const w = sheet('오늘 아침, 파리 도착', '어디서 묵을까', '먼저 묵을 곳을 정합니다. 어느 동네에 묵느냐가 하루의 동선을 거의 정해요. 값과 조식은 등급·동네로 잡은 대략값입니다.');
      for (const d of Object.values(DISTRICTS)) {
        const list = STAYS.filter((s) => s.district === d.id);
        if (!list.length) continue;
        const card = el('section', 'dcard');
        const head = el('div', 'dhead static');
        head.appendChild(el('b', '', d.name));
        head.appendChild(el('small', '', d.blurb));
        card.appendChild(head);
        const stays = el('div', 'stays');
        for (const s of list) {
          const b = el('button', 'stay') as HTMLButtonElement;
          const top = el('div', 'stay-top');
          top.appendChild(el('b', '', s.name));
          top.appendChild(el('em', 'stay-tier', s.stars ? `${'★'.repeat(s.stars)} ${TIER_LABEL[s.tier]}` : TIER_LABEL[s.tier]));
          top.appendChild(el('span', 'stay-price', `€${s.night}`));
          b.appendChild(top);
          b.appendChild(el('small', 'stay-bf', s.breakfast.included ? '조식 포함' : s.breakfast.price ? `조식 €${s.breakfast.price} 별도` : '조식 없음'));
          if (s.note) b.appendChild(el('small', 'stay-note', s.note));
          b.onclick = () => { blurActive(); stay = s; sfx.tick(); pickRide(); };
          stays.appendChild(b);
        }
        card.appendChild(stays);
        w.appendChild(card);
      }
      w.appendChild(el('p', 'dwalk', '1박 값과 조식은 실제 요금이 아니라 등급·동네로 잡은 프로토타입 대략값입니다. 숙소 이름·위치·별점은 OpenStreetMap의 실제 정보예요.'));
      show(w);
    };

    const pickRide = () => {
      const w = sheet('샤를드골 공항 · 오전 7시 40분', '시내까지 어떻게 갈까', `${stay.name}까지 가야 합니다. 캐리어가 하나 있어요.`);
      const list = el('div', 'dways');
      for (const r of rides(stay)) {
        const b = el('button', 'dway') as HTMLButtonElement;
        const top = el('div', 'dway-top');
        top.appendChild(el('b', '', r.label));
        top.appendChild(el('span', 'dmins', `${r.mins}분`));
        b.appendChild(top);
        b.appendChild(el('small', 'dsum', `€${r.cost.toFixed(2)} · 도착하면 ${r.tired >= 12 ? '꽤 지쳐 있다' : '멀쩡하다'}`));
        b.appendChild(el('small', 'dchar', r.note));
        b.onclick = () => { blurActive(); ride = r; sfx.tick(); pickPass(); };
        list.appendChild(b);
      }
      w.appendChild(list);
      show(w);
    };

    const pickPass = () => {
      const w = sheet('표를 어떻게 살까', '하루 동안 쓸 표', '파리는 2025년부터 메트로표와 버스표가 갈라졌습니다. 낱장으로 사면 버스에서 지하철로 갈아탈 때 한 장을 더 사야 해요.');
      const list = el('div', 'dways');
      const opt = (id: Pass, label: string, mins: string, sum: string, note: string) => {
        const b = el('button', 'dway') as HTMLButtonElement;
        const top = el('div', 'dway-top');
        top.appendChild(el('b', '', label));
        top.appendChild(el('span', 'dmins', mins));
        b.appendChild(top);
        b.appendChild(el('small', 'dsum', sum));
        b.appendChild(el('small', 'dchar', note));
        b.onclick = () => { blurActive(); sfx.enter(); root.classList.remove('on'); root.replaceChildren(); resolve({ stay, ride, pass: id }); };
        list.appendChild(b);
      };
      opt('single', '탈 때마다 낱장으로', '€0', '메트로 €2.55 · 버스 €2.05 · 섞으면 두 장',
        '준비할 게 없다. 대신 버스와 지하철을 섞는 날엔 값이 두 배가 된다.');
      opt('liberte', 'Navigo Liberté+', `€${LIBERTE_CARD}`, '메트로 €2.04 · 버스 €1.64 · 버스↔지하철 환승 됨',
        `카드값 €${LIBERTE_CARD}을 한 번 내면 회당 값이 싸지고, 유일하게 버스와 지하철 사이 환승이 된다.`);
      w.appendChild(list);
      show(w);
    };

    pickStay();
  });
}

export interface Morning { mins: number; cost: number; fed: number; line: string }

/** 숙소에 닿았다. 체크인 시간 전이면 짐만 맡기고, 아침을 어떻게 할지 고른다. */
export function openMorning(stay: Stay, clockMins: number): Promise<Morning> {
  return new Promise((resolve) => {
    const root = $('#trip');
    const early = clockMins < 15 * 60;
    const w = sheet(stay.name, early ? '체크인은 오후 3시부터입니다' : '체크인', early
      ? '프런트에서 캐리어를 맡아 줍니다. 가방을 내려놓으니 어깨가 가벼워집니다. 방은 오후에.'
      : '방 열쇠를 받았습니다.');
    const done = (m: Morning) => { root.classList.remove('on'); root.replaceChildren(); sfx.enter(); resolve(m); };
    const list = el('div', 'dways');
    const opt = (label: string, mins: string, sum: string, note: string, m: Morning) => {
      const b = el('button', 'dway') as HTMLButtonElement;
      const top = el('div', 'dway-top');
      top.appendChild(el('b', '', label));
      top.appendChild(el('span', 'dmins', mins));
      b.appendChild(top);
      b.appendChild(el('small', 'dsum', sum));
      b.appendChild(el('small', 'dchar', note));
      b.onclick = () => { blurActive(); done(m); };
      list.appendChild(b);
    };
    if (stay.breakfast.included) {
      opt('숙소에서 아침을 먹는다', '35분', '값에 포함', '바게트와 크루아상, 커피. 배가 든든해진다.',
        { mins: 35, cost: 0, fed: 55, line: '아침을 먹고 나왔다. 오늘은 든든하다.' });
    } else if (stay.breakfast.price) {
      opt('숙소 조식을 먹는다', '35분', `€${stay.breakfast.price}`, '편하지만 동네 빵집보다 비싸다. 파리에서 조식은 대체로 밖이 낫다.',
        { mins: 35, cost: stay.breakfast.price, fed: 55, line: '아침을 먹고 나왔다.' });
    }
    opt('나가서 찾아본다', '0분', '€0', '거리에서 빵집을 찾아야 한다. 아침 시간엔 어디든 갓 구운 냄새가 난다.',
      { mins: 0, cost: 0, fed: 0, line: '아직 아무것도 못 먹었다. 빵집을 찾아야겠다.' });
    w.appendChild(list);
    w.appendChild(el('p', 'dwalk', early ? '짐을 맡겼습니다. 오후에 방으로 들어갈 수 있어요.' : ''));
    root.replaceChildren(w);
    root.classList.add('on');
    root.scrollTop = 0;
  });
}
