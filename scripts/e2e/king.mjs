import { E } from './common.mjs';
// 쥐왕: 굴이 탁 트인 곳인가 · 낮은 등급에서 몇 방에 쓰러지나 · 등급을 올리면 잡히나(시간)
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  const r = await E(p, async () => {
    const W = window.__walk, h = W.hero(), b = h.body, C = W.combat();
    await window.__bot.sleep(500);
    // 굴 가까이로
    const info0 = C.kingInfo();
    return { king: info0, body: window.__bot.body() };
  });
  console.log('start', JSON.stringify(r));
  // 굴 앞 60 m까지 걸어가기
  const k = await E(p, async () => {
    const W = window.__walk, h = W.hero(), b = h.body, C = W.combat();
    for (let i = 0; i < 100 && !C.kingInfo(); i++) await window.__bot.sleep(100);
    const K = C.kingInfo();
    if (!K) return 'no king';
    const d = Math.hypot(K.x - b.x, K.y - b.y);
    const W2 = h.world; const solids = W2.near(K.x, K.y, 3).filter((s) => !s.water && W2.constructor.contains(s, K.x, K.y)).length;
    return { d: Math.round(d), solids, terr: +W2.terrain(K.x, K.y).toFixed(1), ground: +W2.ground(K.x, K.y, 50, 0).toFixed(1) };
  });
  console.log('lair', JSON.stringify(k));
  await E(p, async () => { const C = window.__walk.combat(); const K = C.kingInfo(); const h = window.__walk.hero(); const b = h.body; const L = Math.hypot(K.x - b.x, K.y - b.y); const x = K.x - (K.x - b.x) / L * 25, y = K.y - (K.y - b.y) / L * 25; b.place(x, y, h.world.terrain(x, y)); b.mode = 'ground'; h.cam.yaw = Math.atan2(K.x - x, K.y - y) * 180 / Math.PI; h.cam.snap(b); b.facing = h.cam.yaw; });
  await p.waitForTimeout(1500);
  await shot('king_0_see');
  // 낮은 등급: 가만히 서서 맞아 본다
  const t = await E(p, async () => {
    const W = window.__walk, C = W.combat(); C.kingProvoked = true;
    const t0 = performance.now(), downs0 = C.downs, hp0 = C.hp, log = [];
    let last = C.hp;
    while (performance.now() - t0 < 60000 && C.downs === downs0) { if (C.hp !== last) { log.push(Math.round(C.hp)); last = C.hp; } await window.__bot.sleep(50); }
    return { secs: Math.round((performance.now() - t0) / 1000), downed: C.downs > downs0, hp0: Math.round(hp0), hits: log, ar: W.progress().ar };
  });
  console.log('low AR', JSON.stringify(t));
  await p.waitForTimeout(6000);
  console.log('respawn', JSON.stringify(await E(p, () => { const W = window.__walk, h = W.hero(), b = h.body; const [wx, wy] = h.frame.toLocal(W.S ? [0,0] : [0,0]); const K = W.combat().kingInfo(); return { body: window.__bot.body(), dKing: K ? Math.round(Math.hypot(K.x - b.x, K.y - b.y)) : null, hp: Math.round(W.combat().hp), last: W.progress().last }; })));
  await shot('king_1_after');
};
export const after = 1;
