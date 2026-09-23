// 오늘 아침 파리에 도착한다. 어디서 묵을지 고르고, 공항에서 그 숙소까지 온다.
// 목록만 보면 왜 거기여야 하는지 알 수 없으니, 고르는 내내 지도가 같이 돈다.
import { DISTRICTS } from './districts';
import type { District } from './districts';
import { AIRPORT_TICKET, LIBERTE_CARD, TAXI_FLAT } from './trip';
import type { Pass } from './trip';
import { STAYS, TIER_LABEL } from './stays';
import type { Stay } from './stays';
import type { Curated } from './places';
import type { LngLat } from './graph';
import * as sfx from './sound';
import { findPhoto } from './photos';

export interface Arrival { stay: Stay; ride: RideChoice; pass: Pass }
export interface RideChoice { id: 'rer' | 'taxi'; label: string; mins: number; cost: number; tired: number; note: string }

/** 숙소를 고르는 동안 뒤에서 도는 지도. main.ts가 구현한다. */
export interface StayMap {
  /** 파리 전체 — 동네 다섯 곳을 핀으로 */
  overview(items: { d: District; pos: LngLat }[], pick: (id: string) => void): void;
  /** 한 동네 — 숙소와 그 동네 대표 명소를 핀으로 */
  district(d: District, stays: Stay[], sights: Curated[], pick: (id: string) => void): void;
  /** 고른 숙소를 강조하고, 지하철 입구·명소까지 선을 긋는다 */
  focus(stay: Stay, links: { to: LngLat; label: string }[]): void;
  /** 공항에서 숙소까지 — 얼마나 먼지 한눈에 */
  airport(from: LngLat, to: LngLat): void;
  clear(): void;
}

export const CDG: LngLat = [2.5479, 49.0097]; // 샤를드골 2터미널

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();
const metres = (a: LngLat, b: LngLat) => Math.hypot((a[0] - b[0]) * 73000, (a[1] - b[1]) * 111320);
export const walkMins = (a: LngLat, b: LngLat) => Math.max(1, Math.round((metres(a, b) * 1.3) / 1.35 / 60));

const leftBank = (s: Stay) => s.district === 'saint-germain';
const centreOf = (d: District): LngLat => d.stations[0].gates[0].pos;
const sightsOf = (d: District) => d.curated.filter((c) => c.star).slice(0, 3);
/** 이 숙소에서 가장 가까운 지하철 입구 */
const nearestGate = (d: District, s: Stay) =>
  d.stations.flatMap((st) => st.gates.map((g) => ({ st, g }))).reduce((a, b) => (metres(s.pos, b.g.pos) < metres(s.pos, a.g.pos) ? b : a));

const rides = (stay: Stay): RideChoice[] => [
  { id: 'rer', label: 'RER B — 공항철도', mins: 52, cost: AIRPORT_TICKET, tired: 16,
    note: '터미널에서 역까지 걷고, 표를 사고, 개찰을 지나 승강장까지 계단. 캐리어를 들고 오르내려야 하고 아침이라 붐빈다. 시내까지 35분.' },
  { id: 'taxi', label: '택시 — 정액 요금', mins: 62, cost: leftBank(stay) ? TAXI_FLAT.left : TAXI_FLAT.right, tired: 4,
    note: `공항 택시 승강장은 줄이 있지만 값은 정해져 있다(${leftBank(stay) ? '좌안 €65' : '우안 €56'}). 문 앞까지 데려다준다. 아침 정체에 걸리면 더 걸린다.` },
];

/**
 * 사진 한 장. 숙소 자체의 사진은 자유 라이선스로 구할 수 없어서,
 * 걸어서 몇 분 거리의 실제 장소를 대신 보여 주고 무엇인지 밝힌다.
 */
function photoBox(refs: string[] | undefined, caption: string): HTMLElement {
  const box = el('div', 'metro-photo');
  if (!refs?.length) return box;
  void findPhoto(refs).then((ph) => {
    if (!ph || !box.isConnected) return;
    box.style.backgroundImage = `url("${ph.src}")`;
    box.classList.add('on');
    box.appendChild(el('small', 'photo-cap', caption));
    box.appendChild(el('small', 'metro-credit', ph.credit));
  });
  return box;
}

function sheet(eyebrow: string, title: string, sub?: string) {
  const w = el('div', 'dest-sheet');
  w.appendChild(el('p', 'metro-eyebrow', eyebrow));
  w.appendChild(el('h2', '', title));
  if (sub) w.appendChild(el('p', 'metro-sub', sub));
  return w;
}

/** ① 어느 동네 ② 어느 숙소 ③ 공항에서 어떻게 ④ 표 */
export function openArrival(gis: StayMap): Promise<Arrival> {
  return new Promise((resolve) => {
    const root = $('#trip');
    const show = (node: HTMLElement) => { root.replaceChildren(node); root.classList.add('on', 'mapmode'); root.scrollTop = 0; };
    let stay: Stay;
    let ride: RideChoice;

    // ── ① 어느 동네에 묵을까
    const pickArea = () => {
      const areas = Object.values(DISTRICTS).filter((d) => STAYS.some((s) => s.district === d.id));
      gis.overview(areas.map((d) => ({ d, pos: centreOf(d) })), (id) => pickStay(DISTRICTS[id as District['id']]));
      const w = sheet('오늘 아침, 파리 도착', '어느 동네에 묵을까', '지도에 다섯 동네가 찍혀 있어요. 어디에 묵느냐가 하루의 동선을 거의 정합니다.');
      const list = el('div', 'dways');
      for (const d of areas) {
        const b = el('button', 'dway') as HTMLButtonElement;
        const top = el('div', 'dway-top');
        top.appendChild(el('b', '', d.name));
        const cheapest = Math.min(...STAYS.filter((s) => s.district === d.id).map((s) => s.night));
        top.appendChild(el('span', 'dmins', `€${cheapest}~`));
        b.appendChild(top);
        b.appendChild(el('small', 'dchar', d.blurb));
        const lead = sightsOf(d).find((c) => c.photo);
        if (lead) b.appendChild(photoBox(lead.photo, `${d.name} · ${lead.name}`));
        b.onclick = () => { blurActive(); sfx.tick(); pickStay(d); };
        list.appendChild(b);
      }
      w.appendChild(list);
      show(w);
    };

    // ── ② 그 동네 어느 숙소
    const pickStay = (d: District) => {
      const list = STAYS.filter((s) => s.district === d.id);
      const sights = sightsOf(d);
      const byId = new Map(list.map((s) => [s.id, s]));
      const look = (s: Stay) => {
        const { st, g } = nearestGate(d, s);
        gis.focus(s, [
          { to: g.pos, label: `Ⓜ ${st.name} 도보 ${walkMins(s.pos, g.pos)}분` },
          ...sights.map((c) => ({ to: c.pos, label: `${c.name} 도보 ${walkMins(s.pos, c.pos)}분` })),
        ]);
      };
      gis.district(d, list, sights, (id) => { const s = byId.get(id); if (s) { look(s); choose(s); } });

      const w = sheet(d.name, '어디서 묵을까', '지도의 핀이 숙소이고, 노란 핀이 이 동네의 대표적인 볼거리예요. 값과 조식은 등급·동네로 잡은 대략값입니다.');
      const stays = el('div', 'stays');
      for (const s of list) {
        const { st, g } = nearestGate(d, s);
        const b = el('button', 'stay') as HTMLButtonElement;
        b.dataset.id = s.id;
        const top = el('div', 'stay-top');
        top.appendChild(el('b', '', s.name));
        top.appendChild(el('em', 'stay-tier', s.stars ? `${'★'.repeat(s.stars)}` : TIER_LABEL[s.tier]));
        top.appendChild(el('span', 'stay-price', `€${s.night}`));
        b.appendChild(top);
        const facts = el('small', 'stay-bf');
        facts.textContent = `${s.breakfast.included ? '조식 포함' : s.breakfast.price ? `조식 €${s.breakfast.price} 별도` : '조식 없음'} · Ⓜ ${st.name} 도보 ${walkMins(s.pos, g.pos)}분`
          + (sights[0] ? ` · ${sights[0].name} 도보 ${walkMins(s.pos, sights[0].pos)}분` : '');
        b.appendChild(facts);
        if (s.note) b.appendChild(el('small', 'stay-note', s.note));
        b.onmouseenter = () => look(s);
        b.onfocus = () => look(s);
        b.onclick = () => { blurActive(); look(s); choose(s); };
        stays.appendChild(b);
      }
      w.appendChild(stays);
      const acts = el('div', 'acts');
      const back = el('button', '', '← 다른 동네');
      back.onclick = () => { blurActive(); pickArea(); };
      acts.appendChild(back);
      w.appendChild(acts);
      show(w);
    };

    // ── 고른 숙소 확인
    const choose = (s: Stay) => {
      const d = DISTRICTS[s.district];
      const { st, g } = nearestGate(d, s);
      const w = sheet(d.name, s.name, s.note);
      const near = sightsOf(d).filter((c) => c.photo).sort((a, b) => metres(s.pos, a.pos) - metres(s.pos, b.pos))[0];
      if (near) w.appendChild(photoBox(near.photo, `숙소 사진이 아니라, 걸어서 ${walkMins(s.pos, near.pos)}분 거리의 ${near.name}`));
      const facts = el('div', 'facts');
      const add = (k: string, v: string) => { const r = el('div', 'fact'); r.append(el('span', 'fk', k), el('b', '', v)); facts.appendChild(r); };
      add('1박', `€${s.night} (대략값)`);
      add('조식', s.breakfast.included ? '포함' : s.breakfast.price ? `€${s.breakfast.price} 별도` : '없음');
      add('가장 가까운 역', `${st.name} · 도보 ${walkMins(s.pos, g.pos)}분`);
      for (const c of sightsOf(d)) add(c.name, `도보 ${walkMins(s.pos, c.pos)}분`);
      w.appendChild(facts);
      const acts = el('div', 'acts');
      const go = el('button', 'primary', '여기로 정한다') as HTMLButtonElement;
      go.onclick = () => { blurActive(); stay = s; sfx.enter(); pickRide(); };
      const back = el('button', '', '← 다시 고르기');
      back.onclick = () => { blurActive(); pickStay(d); };
      acts.append(go, back);
      w.appendChild(acts);
      show(w);
    };

    // ── ③ 공항에서 시내로
    const pickRide = () => {
      gis.airport(CDG, stay.pos);
      const w = sheet('샤를드골 공항 · 오전 7시 40분', '시내까지 어떻게 갈까', `${stay.name}까지 25km쯤 됩니다. 캐리어가 하나 있어요.`);
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

    // ── ④ 표
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
        b.onclick = () => {
          blurActive(); sfx.enter();
          gis.clear();
          root.classList.remove('on', 'mapmode');
          root.replaceChildren();
          resolve({ stay, ride, pass: id });
        };
        list.appendChild(b);
      };
      opt('single', '탈 때마다 낱장으로', '€0', '메트로 €2.55 · 버스 €2.05 · 섞으면 두 장',
        '준비할 게 없다. 대신 버스와 지하철을 섞는 날엔 값이 두 배가 된다.');
      opt('liberte', 'Navigo Liberté+', `€${LIBERTE_CARD}`, '메트로 €2.04 · 버스 €1.64 · 버스↔지하철 환승 됨',
        `카드값 €${LIBERTE_CARD}을 한 번 내면 회당 값이 싸지고, 유일하게 버스와 지하철 사이 환승이 된다.`);
      w.appendChild(list);
      show(w);
    };

    pickArea();
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
    const done = (m: Morning) => { root.classList.remove('on', 'mapmode'); root.replaceChildren(); sfx.enter(); resolve(m); };
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
    root.replaceChildren(w);
    root.classList.add('on', 'mapmode');
    root.scrollTop = 0;
  });
}
