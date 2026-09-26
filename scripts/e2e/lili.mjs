import { E } from './common.mjs';
const bubbles = (p) => E(p, () => [...document.querySelectorAll('.bubble.lili')].map((b) => b.textContent));
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForTimeout(3000);
  console.log('near', JSON.stringify(await E(p, () => { const c = window.__walk.companion(), b = window.__walk.hero().body; return { visible: c.group.visible, d: Math.hypot(c.group.position.x - b.x, c.group.position.y - b.y).toFixed(2), dz: (c.group.position.z - b.z).toFixed(2) }; })));
  await E(p, () => window.__walk.companion().greet(true));
  await p.waitForTimeout(500);
  console.log('greet', await bubbles(p));
  await E(p, () => window.__bot.press('KeyG'));
  await p.waitForTimeout(600);
  console.log('ask', await bubbles(p), JSON.stringify(await E(p, () => { const c = window.__walk.companion(); return c.point; })));
  // 상자 가까이
  const chest = await E(p, () => { const W = window.__walk, b = W.hero().body; return W.explore().list().filter((e) => e.kind === 'chest' && !e.locked).map((e) => ({ ...e, d: Math.hypot(e.x - b.x, e.y - b.y) })).sort((a, c) => a.d - c.d)[0]; });
  await E(p, async (c) => { const B = window.__bot, h = window.__walk.hero(); await B.go(c.x, c.y, () => Math.hypot(c.x - h.body.x, c.y - h.body.y) < 20, 60000); }, chest);
  await p.waitForTimeout(2500);
  console.log('chest talk', await bubbles(p));
  await E(p, () => { const h = window.__walk.hero(); h.cam.yaw = (h.body.facing + 200) % 360; h.cam.pitch = 6; h.cam.wantDist = 3.2; });
  await shot('lili');
};
