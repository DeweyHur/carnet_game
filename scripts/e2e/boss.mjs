import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await E(p, async () => { await window.__walk.arrive('saint-germain'); });
  await p.waitForTimeout(2500);
  const spot = await E(p, () => window.__walk.explore().bossSpot());
  await E(p, (s) => { const h = window.__walk.hero(), b = h.body; b.place(s[0] - 30, s[1], h.world.ground(s[0] - 30, s[1], 400, 0)); b.mode = 'ground'; h.cam.snap(b); }, spot);
  await p.waitForTimeout(2500);
  console.log('boss', JSON.stringify(await E(p, () => window.__walk.combat().list().filter((f) => f.kind === 'boss'))));
  let shotDone = false;
  const r = await fight(p, async (s) => {
    const alive = await E(p, () => window.__walk.combat().list().some((f) => f.kind === 'boss' && f.state !== 'dead'));
    if (!shotDone && s.foe && s.foe.kind === 'boss' && s.foe.state !== 'idle' && s.foe.d < 6) { shotDone = true; await shot('f_boss'); }
    return !alive;
  }, 300000, true);
  console.log('fight', JSON.stringify(r), JSON.stringify(await E(p, () => { const C = window.__walk.combat(), g = window.__walk.progress(); return { hp: Math.round(C.hp), ar: g.ar, stars: g.stars, boss: C.list().filter((f) => f.kind === 'boss') }; })));
};
