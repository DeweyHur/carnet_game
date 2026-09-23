// "어디 갈까" — 동네를 고르거나, 그 동네의 가고 싶은 곳을 고른다.
// 고르면 게임이 알아서 어느 역·몇 호선·어디서 환승인지까지 계산해 보여 준다.
import { LINES, rideInfo } from './districts';
import type { Curated } from './places';
import type { District, Journey } from './districts';

export interface Dest { district: District; place?: Curated }

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();

/** 1호선 → 4호선 같은 한 줄 요약 */
function routeLine(j: Journey) {
  const row = el('div', 'droute');
  const rides = j.legs.filter((l) => l.kind === 'ride') as Extract<Journey['legs'][number], { kind: 'ride' }>[];
  rides.forEach((l, i) => {
    if (i) row.appendChild(el('span', 'darrow', '→'));
    const b = el('i', 'mline', l.line);
    b.style.background = LINES[l.line].color;
    b.style.color = LINES[l.line].ink;
    row.appendChild(b);
  });
  const n = j.legs.filter((l) => l.kind === 'transfer').length;
  const stops = rides.reduce((a, l) => a + rideInfo(l).stops, 0);
  const w = j.walk >= 2 ? `입구까지 도보 ${j.walk}분 + ` : '';
  row.appendChild(el('span', 'dsum', `${j.from} → ${j.arrive} · ${stops}정거장 · ${n ? `환승 ${n}번` : '환승 없음'} · ${w}약 ${j.mins}분`));
  return row;
}

export function openDestination(here: District, others: District[], plan: (from: District, to: District) => Journey | null): Promise<Dest | null> {
  return new Promise((resolve) => {
    const root = $('#dest');
    const close = (d: Dest | null) => { root.classList.remove('on'); root.replaceChildren(); resolve(d); };

    const sheet = el('div', 'dest-sheet');
    sheet.appendChild(el('p', 'metro-eyebrow', `지금 ${here.name}`));
    sheet.appendChild(el('h2', '', '어디 갈까'));
    sheet.appendChild(el('p', 'metro-sub', '동네를 고르면 그 동네 아무 데나 내려 주고, 가고 싶은 곳을 고르면 거기서 가장 가까운 출구까지 안내합니다.'));

    for (const d of others) {
      const j = plan(here, d);
      const card = el('section', 'dcard');
      const head = el('button', 'dhead') as HTMLButtonElement;
      head.appendChild(el('b', '', d.name));
      head.appendChild(el('small', '', d.blurb));
      if (j) head.appendChild(routeLine(j));
      else head.appendChild(el('small', 'dsum', '길을 찾지 못했습니다'));
      head.disabled = !j;
      head.onclick = () => { blurActive(); close({ district: d }); };
      card.appendChild(head);

      const stars = d.curated.filter((c) => c.star);
      const rest = d.curated.filter((c) => !c.star && !c.minor);
      if (j && (stars.length || rest.length)) {
        const list = el('div', 'dplaces');
        const add = (c: Curated) => {
          const b = el('button', 'dplace') as HTMLButtonElement;
          b.appendChild(el('span', 'dp-emoji', c.emoji));
          b.appendChild(el('span', 'dp-name', c.name));
          b.onclick = () => { blurActive(); close({ district: d, place: c }); };
          list.appendChild(b);
        };
        stars.forEach(add);
        rest.forEach(add);
        card.appendChild(list);
      }
      sheet.appendChild(card);
    }

    const acts = el('div', 'acts');
    const no = el('button', '', '아직 여기 더 있을래');
    no.onclick = () => { blurActive(); close(null); };
    acts.appendChild(no);
    sheet.appendChild(acts);

    root.replaceChildren(sheet);
    root.classList.add('on');
    root.scrollTop = 0;
  });
}
