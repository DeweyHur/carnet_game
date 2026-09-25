import { E, start, st, climb, walk, report, photo, body, glideTo } from './common.mjs';
export default async (p, shot) => {
  const id = 'm-louvre';
  await start(p, id, 'louvre', [-50, -32]);
  await walk(p, 'louvre', [-120, 34], 1.2); console.log('map1', await st(p, id));
  await walk(p, 'louvre', [-72, -44], 1.2); console.log('map2', await st(p, id));
  await walk(p, 'louvre', [-30, 0], 1.5);
  await climb(p, 'louvre', [0, 0], 21.5, 200000); console.log('pyramid top', await st(p, id), await body(p));
  await walk(p, 'louvre', [0, 0], 0.8); console.log('map3', await st(p, id));
  await shot('louvre_top');
  const g = await E(p, () => { const n = window.__walk.street().story.run('m-louvre').npc; return n ? [n.x, n.y] : window.__bot.at('louvre', [-38, -26]); });
  await glideTo(p, g[0], g[1]);
  await report(p, id);
  await walk(p, 'louvre', [-50, 0], 1.5);
  await photo(p, id, 115);
};
