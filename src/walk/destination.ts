// "어디 갈까" — ① 어디로 갈지 고르고 ② 어떻게 갈지 고른다.
// 지하철은 빠르지만 지하, 버스는 느리지만 창밖이 보인다. 표가 달라서 섞으면 두 장이다.
import { LINES, rideInfo } from './districts';
import type { Curated } from './places';
import type { District, Journey, Options } from './districts';
import type { LngLat } from './graph';

export interface Dest { district: District; place?: Curated; journey: Journey }

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const el = (tag: string, cls?: string, text?: string) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const blurActive = () => (document.activeElement as HTMLElement | null)?.blur();

const badges = (j: Journey) => {
  const row = el('span', 'dlines');
  const rides = j.legs.filter((l): l is Extract<Journey['legs'][number], { kind: 'ride' }> => l.kind === 'ride');
  rides.forEach((l, i) => {
    if (i) row.appendChild(el('span', 'darrow', '→'));
    const def = LINES[l.line];
    const b = el('i', `mline ${def.mode === 'bus' ? 'bus' : ''}`, def.mode === 'bus' ? l.line.slice(3) : l.line);
    b.style.background = def.color;
    b.style.color = def.ink;
    row.appendChild(b);
  });
  return row;
};

const summary = (j: Journey) => {
  const rides = j.legs.filter((l) => l.kind === 'ride') as Extract<Journey['legs'][number], { kind: 'ride' }>[];
  const stops = rides.reduce((a, l) => a + rideInfo(l).stops, 0);
  const n = j.legs.filter((l) => l.kind === 'transfer').length;
  const w = j.walk >= 2 ? `도보 ${j.walk}분 + ` : '';
  return `${j.from} → ${j.arrive} · ${stops}정거장 · ${n ? `갈아타기 ${n}번` : '갈아타기 없음'} · ${w}약 ${j.mins}분 · €${j.fare.toFixed(2)}`;
};

const CHARACTER: Record<string, string> = {
  metro: '빠르다. 대신 타고 가는 동안은 아무것도 안 보인다.',
  bus: '느리다. 대신 창밖으로 도시가 지나간다.',
  mixed: '제일 빠르지만 버스표와 메트로표를 따로 사야 해서 값이 두 배다.',
};

export function openDestination(here: District, others: District[], plan: (from: District, to: District, goal?: LngLat) => Options): Promise<Dest | null> {
  return new Promise((resolve) => {
    const root = $('#dest');
    const close = (d: Dest | null) => { root.classList.remove('on'); root.replaceChildren(); resolve(d); };
    const show = (node: HTMLElement) => { root.replaceChildren(node); root.classList.add('on'); root.scrollTop = 0; };

    // ── ② 어떻게 갈까
    const how = (d: District, place: Curated | undefined, base: Options) => {
      // 명소를 골랐으면 그 자리까지 걷는 시간까지 넣어 다시 계산한다
      const opts = place ? plan(here, d, place.pos) : base;
      const w = el('div', 'dest-sheet');
      w.appendChild(el('p', 'metro-eyebrow', place ? d.name : '동네로'));
      w.appendChild(el('h2', '', `${place ? place.name : d.name}까지 어떻게 갈까`));
      if (place) w.appendChild(el('p', 'metro-sub', place.blurb));

      const list = el('div', 'dways');
      const row = (label: string, j: Journey, tag: string) => {
        const b = el('button', 'dway') as HTMLButtonElement;
        const top = el('div', 'dway-top');
        top.appendChild(el('b', '', label));
        top.appendChild(badges(j));
        top.appendChild(el('span', 'dmins', `${j.mins}분`));
        b.appendChild(top);
        b.appendChild(el('small', 'dsum', summary(j) + (j.walkEnd >= 2 ? ` · 내려서 도보 ${j.walkEnd}분` : '')));
        b.appendChild(el('small', 'dchar', CHARACTER[tag]));
        b.onclick = () => { blurActive(); close({ district: d, place, journey: j }); };
        list.appendChild(b);
      };
      const best = Math.min(opts.metro?.mins ?? Infinity, opts.bus?.mins ?? Infinity, opts.mixed?.mins ?? Infinity);
      if (opts.metro) row(`지하철${opts.metro.mins === best ? ' · 가장 빠름' : ''}`, opts.metro, 'metro');
      if (opts.bus) row(`버스${opts.bus.mins === best ? ' · 가장 빠름' : ''}`, opts.bus, 'bus');
      if (opts.mixed) row('버스 + 지하철', opts.mixed, 'mixed');
      if (!opts.metro && !opts.bus && !opts.mixed) list.appendChild(el('p', 'metro-sub', '그쪽으로 가는 길을 찾지 못했어요.'));
      w.appendChild(list);

      const foot = el('p', 'dwalk', `걸어서는 약 ${opts.walkMins}분 — 이 프로토타입은 동네 안에서만 걸을 수 있어요.`);
      w.appendChild(foot);

      const acts = el('div', 'acts');
      const back = el('button', '', '← 다른 데 고르기');
      back.onclick = () => { blurActive(); where(); };
      acts.appendChild(back);
      w.appendChild(acts);
      show(w);
    };

    // ── ① 어디로
    const where = () => {
      const w = el('div', 'dest-sheet');
      w.appendChild(el('p', 'metro-eyebrow', `지금 ${here.name}`));
      w.appendChild(el('h2', '', '어디 갈까'));
      w.appendChild(el('p', 'metro-sub', '동네를 고르거나, 가고 싶은 곳을 바로 골라도 됩니다. 가는 방법은 그다음에 고릅니다.'));

      for (const d of others) {
        const opts = plan(here, d);
        const fastest = [opts.metro, opts.bus, opts.mixed].filter((x): x is Journey => !!x).sort((a, b) => a.mins - b.mins)[0];
        const card = el('section', 'dcard');
        const head = el('button', 'dhead') as HTMLButtonElement;
        head.appendChild(el('b', '', d.name));
        head.appendChild(el('small', '', d.blurb));
        if (fastest) {
          const r = el('div', 'droute');
          r.appendChild(badges(fastest));
          const ways: string[] = [];
          if (opts.metro) ways.push(`지하철 ${opts.metro.mins}분`);
          if (opts.bus) ways.push(`버스 ${opts.bus.mins}분`);
          r.appendChild(el('span', 'dsum', ways.join(' · ')));
          head.appendChild(r);
        } else head.appendChild(el('small', 'dsum', '길을 찾지 못했습니다'));
        head.disabled = !fastest;
        head.onclick = () => { blurActive(); how(d, undefined, opts); };
        card.appendChild(head);

        if (fastest) {
          const stars = d.curated.filter((c) => c.star);
          const rest = d.curated.filter((c) => !c.star && !c.minor);
          const listEl = el('div', 'dplaces');
          for (const c of [...stars, ...rest]) {
            const b = el('button', 'dplace') as HTMLButtonElement;
            b.appendChild(el('span', 'dp-emoji', c.emoji));
            b.appendChild(el('span', 'dp-name', c.name));
            b.onclick = () => { blurActive(); how(d, c, opts); };
            listEl.appendChild(b);
          }
          card.appendChild(listEl);
        }
        w.appendChild(card);
      }

      const acts = el('div', 'acts');
      const no = el('button', '', '아직 여기 더 있을래');
      no.onclick = () => { blurActive(); close(null); };
      acts.appendChild(no);
      w.appendChild(acts);
      show(w);
    };

    where();
  });
}
