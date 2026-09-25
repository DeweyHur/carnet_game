import { E, start, st, climb, walk, glideTo, report, photo, body } from './common.mjs';
export default async (p, shot) => {
  const id = 'm-eiffel';
  await start(p, id, 'eiffel', [-40, -95]);
  await walk(p, 'eiffel', [-75, -62], 2); // 남서 다리 바깥쪽
  await climb(p, 'eiffel', [0, 0], 270, 900000);
  console.log('top', await st(p, id), await body(p));
  await shot('eiffel_top');
  await photo(p, id, 120);
  const g = await E(p, () => { const n = window.__walk.street().story.run('m-eiffel').npc; return n ? [n.x, n.y] : window.__bot.at('eiffel', [-30, -80]); });
  await glideTo(p, g[0], g[1]);
  await report(p, id);
};
