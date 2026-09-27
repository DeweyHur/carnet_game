import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  const ar = +(process.env.AR ?? 16);
  await E(p, async (ar) => { const W = window.__walk; W.prologue().finish(true); const P = W.progress(); P.ar = ar; P.save(); const C = W.combat(); C.recalc(true); for (let i = 0; i < 100 && !C.kingInfo(); i++) await window.__bot.sleep(100); const K = C.kingInfo(); const h = W.hero(), b = h.body; const x = K.x, y = K.y - 12; b.place(x, y, h.world.terrain(x, y)); b.mode = 'ground'; h.cam.snap(b); }, ar);
  await p.waitForTimeout(1000);
  const r = await fight(p, async () => { const s = await E(p, () => { const C = window.__walk.combat(); return { k: C.kingInfo(), downs: C.downs }; }); return !s.k || s.downs > 0; }, 400000, true);
  const end = await E(p, () => { const C = window.__walk.combat(); return { king: C.kingInfo(), downs: C.downs, hp: Math.round(C.hp), max: C.maxHp, atk: C.atk }; });
  console.log('fight', JSON.stringify(r), JSON.stringify(end));
  await shot('king_2_fight');
};
