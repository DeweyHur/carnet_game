import { E } from './common.mjs';
export default async (p) => {
  await E(p, () => window.__bot.stopRender());
  console.log(JSON.stringify(await E(p, () => {
    const B = window.__bot, h = window.__walk.hero(), b = h.body, W = h.world; const [x, y] = B.at('eiffel', [0, 0]);
    const out = [];
    for (const vz of [-3, -6, -10, -20]) {
      b.place(x, y, 62.1); b.mode = 'air'; b.vz = vz; b.vx = b.vy = 0; b.fallTopZ = 62.5;
      const it = { mx: 0, my: 0, sprint: false, jump: false, drop: false, pace: 1, maxStamina: 1 };
      for (let i = 0; i < 3; i++) b.step(0.1, W, it);
      out.push({ vz, mode: b.mode, dx: +(b.x - x).toFixed(2), z: +b.z.toFixed(2) });
    }
    return out;
  })));
};
