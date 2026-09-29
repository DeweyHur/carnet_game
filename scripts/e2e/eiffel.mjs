import { E, start, st, climb, walk, glideTo, report, photo, body, fightBeat, ascend } from './common.mjs';
export default async (p, shot) => {
  const id = 'm-eiffel';
  await start(p, id, 'eiffel', [-40, -95]);
  await fightBeat(p, id); // 탑 아래 쥐 떼
  await walk(p, 'eiffel', [0, 0], 2); // 탑 한가운데 아래
  await ascend(p, 'eiffel'); // → 1층 58 m
  await walk(p, 'eiffel', [0, 28], 1.0); console.log('piece1', await st(p, id), await body(p));
  await walk(p, 'eiffel', [0, 12], 1.5); // 2층 바닥(42 m 네모) 아래로
  await ascend(p, 'eiffel'); // → 2층 115 m
  await walk(p, 'eiffel', [17, 0], 1.0); console.log('piece2', await st(p, id), await body(p));
  await climb(p, 'eiffel', [0, 0], 270, 900000);
  console.log('top', await st(p, id), await body(p));
  await shot('eiffel_top');
  await photo(p, id, 120);
  const g = await E(p, () => { const n = window.__walk.street().story.run('m-eiffel').npc; return n ? [n.x, n.y] : window.__bot.at('eiffel', [-30, -80]); });
  await glideTo(p, g[0], g[1]);
  await report(p, id);
};
