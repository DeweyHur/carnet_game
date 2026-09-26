import { E } from './common.mjs';
export default async (p) => {
  await E(p, () => window.__bot.stopRender());
  for (const d of ['champs-elysees', 'marais', 'montmartre']) {
    if (d !== 'champs-elysees') { await E(p, async (d) => { await window.__walk.arrive(d); }, d); }
    await p.waitForTimeout(3000);
    const ids = await E(p, () => { const W = window.__walk, b = W.hero().body; return W.explore().list().filter((e) => e.kind === 'waypoint' && Math.hypot(e.x - b.x, e.y - b.y) < 2600 && !W.progress().waypoints.has(e.key)).map((e) => e.key); });
    for (const id of ids) {
      const r = await E(p, async (id) => {
        const W = window.__walk, h = W.hero(), B = window.__bot;
        const wp = W.explore().list().find((e) => e.key === id);
        let best = null;
        for (let a = 0; a < 24; a++) { const x = wp.x + Math.cos(a / 24 * 6.283) * 20, y = wp.y + Math.sin(a / 24 * 6.283) * 20; const g = h.world.terrain(x, y); if (h.world.ground(x, y, g + 3, 0) <= g + 0.3 && !h.world.water(x, y)) { best = [x, y]; break; } }
        if (!best) return 'no free spot';
        h.body.place(best[0], best[1], h.world.terrain(best[0], best[1])); h.body.mode = 'ground';
        await B.sleep(1500);
        const ok = await B.go(wp.x, wp.y, () => W.progress().waypoints.has(id), 40000);
        return { ok, d: Math.hypot(wp.x - h.body.x, wp.y - h.body.y).toFixed(1), dz: (h.body.z - wp.z).toFixed(1) };
      }, id);
      console.log(d, id, JSON.stringify(r));
    }
  }
  console.log('active', await E(p, () => [...window.__walk.progress().waypoints].length));
};
