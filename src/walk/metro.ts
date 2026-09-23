// 지하철로 다른 지구에 간다. 로딩 화면이 아니라, 초행자가 실제로 헤매는 자리만 골라 넣었다.
// 방향(종착역 이름)을 고르고, 환승 통로를 걷고, 어느 출구로 올라올지 고른다.
import * as sfx from './sound';
import { FARE } from './districts';
import type { District, Exit, Journey, Leg } from './districts';

export interface MetroResult { mins: number; cost: number; exit: Exit; wrong: number }

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const badge = (line: string, color: string) => {
  const b = el('i', 'mline', line);
  b.style.background = color;
  b.style.color = line === '1' ? '#1f1b16' : '#fff';
  return b;
};

/** 화면 밖으로 밀려난 버튼에 포커스가 남으면 문서가 스크롤돼 요약 패널이 딸려 올라온다 */
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();

const WRONG_MINS = 7; // 반대 방향 플랫폼에 서서 한 정거장 갔다가 되돌아오기

/**
 * 역에 내려가서 목적지 지구의 지상까지. 취소하면 null.
 * 도중에 dest 지구 데이터를 미리 받아 두라고 preload를 불러 준다.
 */
export function openMetro(from: District, dest: District, j: Journey, preload: () => void): Promise<MetroResult | null> {
  return new Promise((resolve) => {
    const root = $('#metro');
    let mins = 0;
    let wrong = 0;
    let step = 0;

    const show = (node: HTMLElement) => { root.replaceChildren(node); root.classList.add('on'); };
    const close = (r: MetroResult | null) => { root.classList.remove('on'); root.replaceChildren(); resolve(r); };

    const shell = (line: string, title: string, sub?: string) => {
      const w = el('div', 'metro-sheet');
      w.appendChild(el('p', 'metro-eyebrow', line));
      w.appendChild(el('h2', '', title));
      if (sub) w.appendChild(el('p', 'metro-sub', sub));
      const t = el('p', 'metro-run');
      t.textContent = mins ? `여기까지 ${mins}분` : '';
      w.appendChild(t);
      return w;
    };

    // ── 0. 들어갈까
    const gate = () => {
      const w = shell(`Ⓜ ${from.station.name}`, `${dest.name}까지 가려면`, `${j.legs.filter((l) => l.kind === 'ride').map((l) => `${l.kind === 'ride' ? l.line : ''}호선`).join(' → ')} · 환승 ${j.legs.filter((l) => l.kind === 'transfer').length}번 · 약 ${j.mins}분`);
      const ticket = el('div', 'ticket');
      ticket.appendChild(el('b', '', 'Ticket t+'));
      ticket.appendChild(el('span', '', `메트로·전철 1회권 €${FARE.toFixed(2)}`));
      w.appendChild(ticket);
      const acts = el('div', 'acts');
      const go = el('button', 'primary', '표를 찍고 내려간다') as HTMLButtonElement;
      go.onclick = () => { blurActive(); sfx.tick(); mins += 3; preload(); next(); };
      const no = el('button', '', '그만둔다');
      no.onclick = () => close(null);
      acts.append(go, no);
      w.appendChild(acts);
      show(w);
    };

    // ── 1~n. 각 구간
    const leg = (l: Leg) => {
      if (l.kind === 'transfer') {
        const w = shell(`${l.at} 환승`, `${l.from}호선에서 ${l.to}호선으로`, l.note);
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
        return;
      }
      const w = shell(`${l.from} 승강장`, '어느 방향?', `여기서 ${l.stops}정거장. 파리 지하철은 가는 방향을 종착역 이름으로 적어 둔다.`);
      const badgeRow = el('div', 'metro-line');
      badgeRow.append(badge(l.line, l.color), el('span', '', `${l.from} → ${l.to}`));
      w.appendChild(badgeRow);
      const picks = el('div', 'dirs');
      l.dirs.forEach((d, i) => {
        const b = el('button', 'dir') as HTMLButtonElement;
        b.appendChild(el('small', '', 'direction'));
        b.appendChild(el('b', '', d));
        b.onclick = () => {
          blurActive();
          if (i === l.right) {
            sfx.enter();
            mins += l.mins;
            [...picks.children].forEach((c) => ((c as HTMLButtonElement).disabled = true));
            b.classList.add('ok');
            const ride = el('p', 'metro-ride', `${l.via}를 지나 ${l.to}. 창밖은 어둡고, 유리에 얼굴이 비친다.`);
            w.appendChild(ride);
            setTimeout(next, 1400);
          } else {
            wrong++;
            mins += WRONG_MINS;
            b.classList.add('bad');
            const p = w.querySelector('.metro-wrong') ?? w.appendChild(el('p', 'metro-wrong'));
            p.textContent = `반대 방향이었다. 한 정거장 가서 내려 반대편 승강장으로 건너왔다. (+${WRONG_MINS}분)`;
            const run = w.querySelector('.metro-run');
            if (run) run.textContent = `여기까지 ${mins}분`;
          }
        };
        picks.appendChild(b);
      });
      w.appendChild(picks);
      show(w);
    };

    // ── 마지막. 어느 출구로
    const exits = () => {
      const w = shell(`Ⓜ ${dest.station.name} 도착`, '어느 출구로 올라갈까', '같은 역이라도 출구마다 다른 데로 나온다. 지상에서 보이는 첫 장면이 달라진다.');
      const list = el('div', 'exits');
      for (const x of dest.station.exits) {
        const b = el('button', 'exit') as HTMLButtonElement;
        b.appendChild(el('b', '', `Sortie · ${x.label}`));
        b.appendChild(el('small', '', x.note));
        b.onclick = () => {
          blurActive();
          [...list.children].forEach((c) => ((c as HTMLButtonElement).disabled = true));
          mins += x.mins;
          for (let i = 0; i < 6; i++) sfx.stair(i);
          sfx.surface();
          setTimeout(() => close({ mins, cost: FARE, exit: x, wrong }), 1500);
        };
        list.appendChild(b);
      }
      w.appendChild(list);
      show(w);
    };

    const next = () => {
      if (step < j.legs.length) { leg(j.legs[step++]); return; }
      exits();
    };

    gate();
  });
}
