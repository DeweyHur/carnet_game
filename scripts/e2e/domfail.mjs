import { E } from './common.mjs';
// 비경에서 쓰러지면 입구 앞으로 밀려나고, 바깥 적이 돌아오고, HP가 절반 이상
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  const r = await E(p, async () => {
    const W = window.__walk, D = W.domain(), C = W.combat(), h = W.hero(), b = h.body;
    for (let i = 0; i < 40 && !D.gates.length; i++) await window.__bot.sleep(100);
    const G = D.gates[2]; b.place(G.x, G.y - 20, h.world.terrain(G.x, G.y)); for (let i = 0; i < 100 && !G.settled; i++) await window.__bot.sleep(100);
    b.place(G.x + 1.6, G.y, h.world.terrain(G.x, G.y)); b.mode = 'ground'; await window.__bot.sleep(800);
    const foes0 = C.list().length;
    await window.__bot.press('KeyF'); await window.__bot.sleep(2500);
    const inside = D.active;
    await window.__bot.walkTo(0, 1.8, 1.2, 15000); await window.__bot.press('KeyF'); await window.__bot.sleep(400);
    await window.__bot.walkTo(0, 50, 2, 40000);
    C.hp = 1;
    const t0 = performance.now();
    while (D.active && performance.now() - t0 < 60000) await window.__bot.sleep(200);
    await window.__bot.sleep(1500);
    return { gate: G.def.id, inside, outAfter: Math.round((performance.now() - t0) / 1000), active: D.active, zone: C.zone, hp: Math.round(C.hp), max: C.maxHp, foes0, foes: C.list().length, sw: !!h.sceneWorld, dGate: +Math.hypot(b.x - G.x, b.y - G.y).toFixed(1), mode: b.mode };
  });
  console.log('fail', JSON.stringify(r));
  await shot('domfail');
};
