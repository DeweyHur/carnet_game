import { E } from './common.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await E(p, () => { const B = window.__bot, h = window.__walk.hero(), b = h.body; const [x, y] = B.at('eiffel', [0, 0]); b.place(x, y, h.world.terrain(x, y)); b.mode = 'ground'; h.cam.yaw = 20; h.cam.snap(b); });
  await p.waitForTimeout(1500);
  const cam = () => E(p, () => { const h = window.__walk.hero(), c = h.cam, b = h.body; return { mode: b.mode, bz: +b.z.toFixed(1), fz: +c.fz.toFixed(1), dist: +c.dist.toFixed(1), pitch: +c.pitch.toFixed(1), fxd: +Math.hypot(c.fx - b.x, c.fy - b.y).toFixed(1) }; });
  await E(p, () => window.__bot.press('KeyT'));
  await p.waitForTimeout(1300);
  await shot('asc2_rise');
  for (let i = 0; i < 30; i++) { const c = await cam(); if (c.mode === 'ground') break; await p.waitForTimeout(200); }
  await p.waitForTimeout(1500);
  console.log(JSON.stringify(await cam()));
  await shot('asc2_first');
};
