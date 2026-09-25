import { E, start, st, climb, walk, glideTo, report, photo, body } from './common.mjs';
export default async (p, shot) => {
  const id = 'm-notre-dame';
  await start(p, id, 'notre-dame', [-118, 20], 'saint-germain');
  await walk(p, 'notre-dame', [-100, 0], 1.2);
  console.log('zero', await st(p, id));
  const c = await climb(p, 'notre-dame', [-56, 13], 67, 300000);
  console.log('after climb', await st(p, id), await body(p));
  await shot('nd_top');
  await photo(p, id, 290);
  const g = await E(p, () => { const n = window.__walk.street().story.run('m-notre-dame').npc; return n ? [n.x, n.y] : null; });
  const gp = g ?? await E(p, () => window.__bot.at('notre-dame', [-92, 12]));
  await glideTo(p, gp[0], gp[1]);
  await report(p, id);
};
