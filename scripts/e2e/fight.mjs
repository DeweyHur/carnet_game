import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForTimeout(3000);
  // 야영지를 찾아다닌다
  let camp = null;
  for (let k = 0; k < 16 && !camp; k++) {
    camp = await E(p, () => { const W = window.__walk, b = W.hero().body; return W.explore().list().filter((e) => e.locked).map((e) => ({ ...e, d: Math.hypot(e.x - b.x, e.y - b.y) })).sort((a, b) => a.d - b.d)[0] ?? null; });
    if (!camp) { await E(p, (k) => { const h = window.__walk.hero(), b = h.body; const a = k * 2.4, r = 120 + k * 45; const x = Math.cos(a) * r, y = Math.sin(a) * r; b.place(x, y, h.world.ground(x, y, 400, 0)); b.mode = 'ground'; }, k); await p.waitForTimeout(2500); }
  }
  console.log('camp', JSON.stringify(camp), JSON.stringify(await E(p, () => window.__walk.combat().list())));
  if (!camp) return;
  // 가까이(20 m) 가서 싸운다
  await E(p, async (c) => { const B = window.__bot, h = window.__walk.hero(); await B.go(c.x, c.y, () => Math.hypot(c.x - h.body.x, c.y - h.body.y) < 16, 60000); }, camp);
  let shotN = 0;
  const r = await fight(p, async (s) => { if (s.foe && s.foe.d < 3 && shotN < 2) { shotN++; await E(p, () => { const h = window.__walk.hero(); h.cam.yaw = (h.body.facing + 60) % 360; h.cam.pitch = 18; h.cam.wantDist = 6; }); await shot(`f_mid${shotN}`); } return E(p, (k) => window.__walk.combat().campDone(k), camp.key); }, 180000);
  console.log('fight', JSON.stringify(r), JSON.stringify(await E(p, () => { const C = window.__walk.combat(); return { hp: Math.round(C.hp), max: C.maxHp, energy: C.energy }; })));
  await shot('f_after');
  await p.waitForTimeout(1500);
  const opened = await E(p, async (c) => { const W = window.__walk, B = window.__bot; const e = W.explore().list().find((q) => q.key === c.key); if (!e) return 'gone'; await B.walkTo(e.x, e.y, 1.4, 30000); await B.sleep(300); const prompt = document.querySelector('.hprompt')?.textContent; await B.press('KeyF'); await B.sleep(1200); return { locked: e.locked, prompt, opened: W.progress().chests.has(c.key) }; }, camp);
  console.log('chest', JSON.stringify(opened), JSON.stringify(await E(p, () => { const g = window.__walk.progress(); return { ar: g.ar, xp: g.xp, stars: g.stars, com: g.commissions.map((c) => `${c.kind} ${c.got}/${c.goal}`) }; })));
};
