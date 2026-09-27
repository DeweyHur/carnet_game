import { E } from './common.mjs';
export default async (p) => {
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  await E(p, () => window.__bot.stopRender());
  console.log(JSON.stringify(await E(p, async () => {
    const W = window.__walk, ex = W.explore(), h = W.hero(), b = h.body;
    const e = ex.ents.find((q) => q.key === 'pro:camp');
    const c = ex.ents.find((q) => q.key === 'pro:chest');
    const out = { camp: e && { x: e.x, y: e.y, z: e.z, locked: e.locked }, chest: c && { x: c.x, y: c.y, z: c.z }, terr: e && h.world.terrain(e.x, e.y), gr: e && h.world.ground(e.x, e.y, 400, 0) };
    ex.unlock('pro:camp');
    b.place(e.x + 1.2, e.y, h.world.ground(e.x + 1.2, e.y, e.z + 1, 1)); b.mode = 'ground';
    await window.__bot.sleep(800);
    out.body = window.__bot.body(); out.near = ex.near && ex.near.key; out.prompt = ex.prompt();
    await window.__bot.press('KeyF'); await window.__bot.sleep(800);
    out.opened = W.progress().chests.has('pro:camp');
    return out;
  })));
};
