import { E, start, st, climb, walk, glideTo, report, photo, body } from './common.mjs';
export default async (p, shot) => {
  const id = 'm-arc';
  await start(p, id, 'arc', [-50, 44]);
  await walk(p, 'arc', [0, 0], 2.5);
  console.log('flame', await st(p, id));
  await walk(p, 'arc', [-26, 0], 2); // 아치 밖(서쪽)으로 나가서
  await walk(p, 'arc', [-26, -34], 2);
  await walk(p, 'arc', [0, -34], 2);
  await climb(p, 'arc', [0, 0], 49, 400000);
  console.log('roof', await st(p, id), await body(p));
  await shot('arc_roof');
  await photo(p, id, 112);
  const g = await E(p, () => { const n = window.__walk.street().story.run('m-arc').npc; return n ? [n.x, n.y] : window.__bot.at('arc', [-40, 32]); });
  await glideTo(p, g[0], g[1]);
  await report(p, id);
};
