import { E, start, st, climb, glideTo, report, body } from './common.mjs';
export default async (p, shot) => {
  const id = 'm-sacre-coeur';
  await start(p, id, 'sacre-coeur', [-96, 12], 'montmartre');
  await climb(p, 'sacre-coeur', [-30, 0], 11.4, 120000); // 큰 계단
  console.log('steps', await st(p, id));
  await E(p, () => window.__bot.press('Digit4'));
  await p.waitForTimeout(11000);
  console.log('sat', await st(p, id), await body(p));
  await climb(p, 'sacre-coeur', [10, 0], 45, 400000); // 돔
  console.log('dome', await st(p, id), await body(p));
  await shot('sc_dome');
  const g = await E(p, () => { const n = window.__walk.street().story.run('m-sacre-coeur').npc; return n ? [n.x, n.y] : window.__bot.at('sacre-coeur', [-78, 16]); });
  await glideTo(p, g[0], g[1]);
  await report(p, id);
};
