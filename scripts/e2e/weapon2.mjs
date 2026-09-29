import { E } from './common.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await E(p, () => { const W = window.__walk, wr = W.wardrobe(); for (const id of ['baguette', 'cane', 'oar', 'rapier', 'flagpole', 'jeanne']) wr.unlock(id, true); W.prologue().finish(true); window.__bot.place('eiffel', [0, -200]); const h = W.hero(); h.cam.wantDist = 3.2; });
  await p.waitForTimeout(1500);
  for (const id of ['umbrella', 'baguette', 'cane', 'oar', 'rapier', 'flagpole', 'jeanne']) {
    await E(p, (id) => { const W = window.__walk, h = W.hero(), b = h.body; W.wardrobe().equip(id); b.drawn = 8; h.cam.yaw = (b.facing + 115) % 360; h.cam.pitch = 8; }, id);
    await p.waitForTimeout(700);
    await shot(`wp_${id}`);
  }
};
