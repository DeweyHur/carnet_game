import { E } from './common.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForTimeout(2000);
  // 활성화된 것으로 두고(각 포인트 활성화는 wpall에서 확인) 동네를 넘나들며 순간이동
  await E(p, () => { const g = window.__walk.progress(); for (const id of ['wp-sacre-coeur', 'wp-jeanne', 'wp-notre-dame']) g.waypoints.add(id); });
  for (const id of ['wp-sacre-coeur', 'wp-notre-dame', 'wp-jeanne']) {
    await E(p, async (id) => { await window.__walk.teleport(id); }, id);
    await p.waitForTimeout(2500);
    console.log(id, JSON.stringify(await E(p, (id) => { const W = window.__walk, b = W.hero().body, e = W.explore().list().find((q) => q.key === id); return { district: W.S ? document.querySelector('#toast')?.textContent : '', d: e ? Math.hypot(e.x - b.x, e.y - b.y).toFixed(1) : 'no ent', dz: e ? (b.z - e.z).toFixed(1) : '', mode: b.mode }; }, id)));
  }
  // 성상에 깃털 바치기
  const r = await E(p, async () => {
    const W = window.__walk, B = window.__bot, g = W.progress(), h = W.hero();
    g.plumes = 5;
    const st = W.explore().list().find((q) => q.key === 'wp-jeanne');
    await B.walkTo(st.x, st.y, 3.5, 20000);
    await B.sleep(300);
    const prompt = document.querySelector('.hprompt')?.textContent;
    await B.press('KeyE'); await B.sleep(800);
    return { prompt, level: g.staminaLevel, cost: g.staminaCost.toFixed(2), offered: g.offered, plumes: g.plumes, bodyMod: h.body.mods.stamina };
  });
  console.log('statue', JSON.stringify(r));
  await shot('g_statue');
};
