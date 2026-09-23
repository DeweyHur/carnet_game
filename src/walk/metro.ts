// 지하철로 다른 지구에 간다. 로딩 화면이 아니라, 초행자가 실제로 헤매는 자리만 골라 넣었다.
// 노선도를 보고 방향을 고르고, 환승 통로를 걷고, 어느 출구로 올라올지 고른다.
import * as sfx from './sound';
import { FARE, journeyMins, rideInfo } from './districts';
import type { District, Exit, Journey, Leg, Ride } from './districts';
import { findPhoto } from './photos';
import { STATION_POS } from './stations';
import type { LngLat } from './graph';

export interface MetroResult { mins: number; cost: number; exit: Exit; wrong: number }

/** 지하철을 타는 동안 뒤에 보이는 지도. main.ts가 구현한다. */
export interface MetroMap {
  /** 이번 구간을 지도에 그리고 화면에 맞춘다 */
  ride(color: string, stops: { name: string; pos: LngLat }[]): void;
  /** 전동차를 from에서 to까지 ms 동안 움직인다 */
  train(from: LngLat, to: LngLat, ms: number): void;
  /** 출구를 지도에 찍는다. 핀을 누르면 pick(i) */
  exits(list: Exit[], at: LngLat, pick: (i: number) => void): void;
  markExit(i: number): void;
  clear(): void;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
/** 화면 밖으로 밀려난 버튼에 포커스가 남으면 문서가 스크롤된다 */
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();

const WRONG_MINS = 7; // 반대 방향 플랫폼에 서서 한 정거장 갔다가 되돌아오기

/** 사진 한 장을 비동기로 채운다. 못 찾으면 자리를 차지하지 않는다. */
function photoBox(refs: string[] | undefined): HTMLElement {
  const box = el('div', 'metro-photo');
  if (!refs?.length) return box;
  void findPhoto(refs).then((ph) => {
    if (!ph || !box.isConnected) return;
    box.style.backgroundImage = `url("${ph.src}")`;
    box.classList.add('on');
    box.appendChild(el('small', 'metro-credit', ph.credit));
  });
  return box;
}

/**
 * 세로 노선도. 위가 stations[0] 방향, 아래가 마지막 역 방향.
 * 지금 서 있는 역과 내려야 할 역을 표시하고, 필요한 만큼만 잘라 보여 준다.
 */
function routeMap(r: Ride, onPick?: (dir: 0 | 1) => void) {
  const wrap = el('div', 'route');
  wrap.style.setProperty('--c', r.color);
  const lo = Math.max(0, Math.min(r.a, r.b) - 1);
  const hi = Math.min(r.stations.length - 1, Math.max(r.a, r.b) + 1);

  const end = (dir: 0 | 1) => {
    const name = r.dirs[dir];
    const cut = dir === 0 ? lo > 0 : hi < r.stations.length - 1;
    const node = el(onPick ? 'button' : 'div', `term ${onPick ? 'pick' : ''}`);
    node.appendChild(el('span', 'arrow', dir === 0 ? '↑' : '↓'));
    const mid = el('span', 'term-mid');
    const far = dir === 0 ? lo : r.stations.length - 1 - hi;
    mid.appendChild(el('small', '', cut ? `direction · 종점까지 ${far}개 역` : 'direction'));
    mid.appendChild(el('b', '', name));
    node.appendChild(mid);
    if (onPick) (node as HTMLButtonElement).onclick = () => onPick(dir);
    return node;
  };

  wrap.appendChild(end(0));
  const rail = el('div', 'rail');
  for (let i = lo; i <= hi; i++) {
    const row = el('div', 'stop');
    row.dataset.i = String(i);
    row.appendChild(el('i', 'dot'));
    row.appendChild(el('span', 'nm', r.stations[i]));
    if (i === r.a) { row.classList.add('here'); row.appendChild(el('em', 'tag now', '지금 여기')); }
    if (i === r.b) { row.classList.add('target'); row.appendChild(el('em', 'tag off', '여기서 내린다')); }
    rail.appendChild(row);
  }
  wrap.appendChild(rail);
  wrap.appendChild(end(1));
  return { wrap, rail };
}

/**
 * 역에 내려가서 목적지 지구의 지상까지. 취소하면 null.
 * 타는 동안 목적지 지구 데이터를 미리 받아 두라고 preload를 불러 준다.
 */
export function openMetro(from: District, dest: District, j: Journey, preload: () => void, gis: MetroMap): Promise<MetroResult | null> {
  return new Promise((resolve) => {
    const root = $('#metro');
    let mins = 0;
    let wrong = 0;
    let step = 0;

    const show = (node: HTMLElement, onMap = false) => {
      root.replaceChildren(node);
      root.classList.add('on');
      root.classList.toggle('mapmode', onMap); // 지도가 뒤로 보이게 아래쪽 패널만 남긴다
      root.scrollTop = 0;
    };
    const close = (r: MetroResult | null) => { root.classList.remove('on', 'mapmode'); root.replaceChildren(); resolve(r); };

    const shell = (line: string, title: string, sub?: string, photo?: string[]) => {
      const w = el('div', 'metro-sheet');
      w.appendChild(photoBox(photo));
      w.appendChild(el('p', 'metro-eyebrow', line));
      w.appendChild(el('h2', '', title));
      if (sub) w.appendChild(el('p', 'metro-sub', sub));
      const t = el('p', 'metro-run');
      t.textContent = mins ? `여기까지 ${mins}분` : '';
      w.appendChild(t);
      return w;
    };
    const bumpRun = (w: HTMLElement) => { const r = w.querySelector('.metro-run'); if (r) r.textContent = `여기까지 ${mins}분`; };

    // ── 0. 들어갈까
    const gate = () => {
      const lines = j.legs.filter((l) => l.kind === 'ride').map((l) => `${l.line}호선`).join(' → ');
      const nTransfer = j.legs.filter((l) => l.kind === 'transfer').length;
      const w = shell(`Ⓜ ${from.station.name}`, `${dest.name}까지 가려면`, `${lines} · 환승 ${nTransfer}번 · 약 ${journeyMins(j)}분`, from.station.photo);
      const ticket = el('div', 'ticket');
      ticket.appendChild(el('b', '', 'Ticket t+'));
      ticket.appendChild(el('span', '', `메트로·전철 1회권 €${FARE.toFixed(2)}`));
      w.appendChild(ticket);
      const acts = el('div', 'acts');
      const go = el('button', 'primary', '표를 찍고 내려간다') as HTMLButtonElement;
      go.onclick = () => { blurActive(); sfx.tick(); mins += 3; preload(); next(); };
      const no = el('button', '', '그만둔다');
      no.onclick = () => { blurActive(); close(null); };
      acts.append(go, no);
      w.appendChild(acts);
      show(w);
    };

    // ── 환승
    const transfer = (l: Extract<Leg, { kind: 'transfer' }>) => {
      const w = shell(`${l.at} 환승`, `${l.from}호선에서 ${l.to}호선으로`, l.note, l.photo);
      const acts = el('div', 'acts');
      const go = el('button', 'primary', `통로를 걷는다 (${l.mins}분)`) as HTMLButtonElement;
      go.onclick = () => {
        blurActive();
        go.disabled = true;
        for (let i = 0; i < 5; i++) sfx.stair(i);
        mins += l.mins;
        setTimeout(next, 900);
      };
      acts.appendChild(go);
      w.appendChild(acts);
      show(w);
    };

    // ── 타기: 노선도에서 방향을 고른다
    const ride = (l: Extract<Leg, { kind: 'ride' }>) => {
      const r = rideInfo(l);
      const w = shell(`Ⓜ${l.line} · ${l.from} 승강장`, `${l.to}까지 ${r.stops}정거장`,
        '파리 지하철은 가는 방향을 종착역 이름으로 적어 둔다. 노선도에서 내려야 할 역이 위인지 아래인지 보고 고르면 된다.', l.photo);

      const pick = (dir: 0 | 1) => {
        blurActive();
        if (dir !== r.right) {
          wrong++;
          mins += WRONG_MINS;
          bumpRun(w);
          const p = (w.querySelector('.metro-wrong') as HTMLElement | null) ?? w.appendChild(el('p', 'metro-wrong'));
          p.textContent = `${r.dirs[dir]} 방향은 반대쪽이다. 한 정거장 가서 내려 반대편 승강장으로 건너왔다. (+${WRONG_MINS}분)`;
          const b = wrap.querySelectorAll('.term.pick')[dir];
          b.classList.add('bad');
          return;
        }
        sfx.enter();
        mins += r.mins;
        for (const b of wrap.querySelectorAll('.term.pick')) (b as HTMLButtonElement).disabled = true;
        wrap.querySelectorAll('.term.pick')[dir].classList.add('ok');
        setTimeout(() => running(l, r), 700);
      };

      const { wrap } = routeMap(r, pick);
      w.appendChild(wrap);
      show(w);
    };

    /** 달리는 중: 지도가 뒤로 보이고, 지나는 역이 지도와 패널에 같이 표시된다 */
    const running = (l: Extract<Leg, { kind: 'ride' }>, r: Ride) => {
      const stepDir = r.b > r.a ? 1 : -1;
      const names: string[] = [];
      for (let i = r.a; i !== r.b + stepDir; i += stepDir) names.push(r.stations[i]);
      const stops = names.map((n) => ({ name: n, pos: STATION_POS[n] })).filter((x) => x.pos);

      const w = el('div', 'metro-sheet riding');
      const badge = el('i', 'mline', l.line);
      badge.style.background = r.color;
      badge.style.color = r.ink;
      const head = el('div', 'ride-head');
      head.append(badge, el('b', '', `${l.from} → ${l.to}`));
      w.appendChild(head);
      const chips = el('div', 'ride-chips');
      const nodes = names.map((n, i) => {
        const c = el('span', 'chip', n);
        if (i === 0) c.classList.add('on');
        chips.appendChild(c);
        return c;
      });
      w.appendChild(chips);
      const say = el('p', 'ride-say', '문이 닫힌다.');
      w.appendChild(say);
      const run = el('p', 'metro-run', `여기까지 ${mins}분`);
      w.appendChild(run);
      show(w, stops.length > 1);

      if (stops.length > 1) gis.ride(r.color, stops);
      const HOP = 1500;
      let k = 0;
      const hop = () => {
        const from = stops[k]?.pos, to = stops[k + 1]?.pos;
        if (from && to) gis.train(from, to, HOP);
        k++;
        nodes.forEach((c, i) => c.classList.toggle('on', i === k));
        sfx.tick();
        const last = k >= names.length - 1;
        say.textContent = last ? `${names[k]}. 여기서 내린다.` : `${names[k]} 통과.`;
        if (!last) setTimeout(hop, HOP + 250);
        else setTimeout(next, 1400);
      };
      setTimeout(hop, stops.length > 1 ? 1700 : 500);
    };

    // ── 마지막. 어느 출구로
    const exits = () => {
      const w = shell(`Ⓜ ${dest.station.name} 도착`, '어느 출구로 올라갈까',
        '지도에 찍힌 번호가 출구 위치다. 같은 역이라도 출구마다 다른 데로 나오고, 지상에서 보이는 첫 장면이 달라진다.', dest.station.photo);
      const list = el('div', 'exits');
      const take = (i: number) => {
        const x = dest.station.exits[i];
        blurActive();
        for (const c of list.children) (c as HTMLButtonElement).disabled = true;
        gis.markExit(i);
        mins += x.mins;
        for (let n = 0; n < 6; n++) sfx.stair(n);
        sfx.surface();
        setTimeout(() => close({ mins, cost: FARE, exit: x, wrong }), 1500);
      };
      dest.station.exits.forEach((x, i) => {
        const b = el('button', 'exit') as HTMLButtonElement;
        const no = el('em', 'exit-no', String(i + 1));
        const mid = el('span', 'exit-mid');
        mid.appendChild(el('b', '', `Sortie · ${x.label}`));
        mid.appendChild(el('small', '', x.note));
        b.append(no, mid);
        b.onclick = () => take(i);
        list.appendChild(b);
      });
      w.appendChild(list);
      show(w, true);
      const at = STATION_POS[dest.station.name] ?? dest.station.pos;
      gis.exits(dest.station.exits, at, take);
    };

    const next = () => {
      if (step >= j.legs.length) { exits(); return; }
      const l = j.legs[step++];
      if (l.kind === 'transfer') transfer(l); else ride(l);
    };

    gate();
  });
}
