import { E } from './common.mjs';
// 상승: 에펠탑 아래 한가운데 → 1층 → 꼭대기, 그리고 건물 벽 → 지붕
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  const put = (uv) => E(p, (uv) => { const B = window.__bot, h = window.__walk.hero(), b = h.body; const [x, y] = B.at('eiffel', uv); b.place(x, y, h.world.terrain(x, y)); b.mode = 'ground'; h.cam.snap(b); return B.body(); }, uv);
  const scan = () => E(p, () => { const t = window.__walk.ascend().scan(); return t && { kind: t.kind, z1: +t.z1.toFixed(1), ceil: +t.ceil.toFixed(1) }; });
  const up = async (tag) => {
    const r = await E(p, async () => {
      const B = window.__bot, h = window.__walk.hero(), b = h.body; const z0 = b.z; const t0 = performance.now();
      await B.press('KeyT');
      const modes = [];
      while (performance.now() - t0 < 20000) { if (modes.at(-1) !== b.mode) modes.push(b.mode); if (performance.now() - t0 > 800 && b.mode === 'ground') break; await B.sleep(50); }
      return { z0: +z0.toFixed(1), z: +b.z.toFixed(1), secs: +((performance.now() - t0) / 1000).toFixed(1), modes: modes.join('>') };
    });
    console.log(tag, JSON.stringify(r));
    return r;
  };
  if (!process.env.WALLONLY) {
  console.log('place', JSON.stringify(await put([0, 0])));
  await p.waitForTimeout(1500);
  await E(p, () => { window.__walk.hero().cam.yaw = 20; });
  console.log('scan ground', JSON.stringify(await scan()));
  await shot('asc_0_marker');
  // 가운데 한 장면: 오르는 중
  await E(p, () => {
    const h = window.__walk.hero(), b = h.body; window.__trace = []; let n = -1, last = null, t0 = performance.now();
    const loop = () => { if (n < 0 && h.events.includes('ascendEnd')) n = 0; if (n >= 0 && n < 3000) { n++; const W = h.sceneWorld ?? h.world; const r = [b.mode, +b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +b.vx.toFixed(2), +b.vz.toFixed(2), +W.ground(b.x, b.y, b.z + 1, 2).toFixed(2), h.events.join(','), +((performance.now() - t0) / 1000).toFixed(2)]; if (!last || last[0] !== r[0] || Math.abs(last[1] - r[1]) > 0.3 || r[7]) window.__trace.push(r); last = r; } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__bot.press('KeyT');
  });
  await p.waitForTimeout(900);
  await shot('asc_1_rise');
  await E(p, async () => { const b = window.__walk.hero().body; for (let i = 0; i < 1200 && b.mode !== 'ground'; i++) await window.__bot.sleep(50); });
  for (const t of (await E(p, () => window.__trace)).slice(0, 40)) console.log('tr', JSON.stringify(t));
  console.log('after 1st', JSON.stringify(await E(p, () => window.__bot.body())));
  await shot('asc_2_first');
  console.log('scan 1st', JSON.stringify(await scan()));
  await up('to top');
  for (let i = 0; i < 8; i++) { console.log('top', JSON.stringify(await E(p, () => window.__bot.body()))); await p.waitForTimeout(400); }
  await shot('asc_3_top');
  }
  if (process.env.EIFFELONLY) return;
  // 건물 벽: 샹드마르스 옆 건물 쪽으로 걸어가 벽 앞에서 T
  const w = await E(p, async () => {
    const B = window.__bot, h = window.__walk.hero(), b = h.body, W = h.world;
    // 가까운 건물 하나 찾기
    const [cx, cy] = B.at('eiffel', [0, -300]);
    let best = null;
    for (let r = 20; r < 400 && !best; r += 20) for (let a = 0; a < 360 && !best; a += 15) { const x = cx + Math.sin(a * Math.PI / 180) * r, y = cy + Math.cos(a * Math.PI / 180) * r; for (const s of W.near(x, y, 0.1)) if (s.kind === 'building' && s.top > W.terrain(x, y) + 12 && s.base < W.terrain(x, y) + 1 && W.constructor.contains(s, x, y)) { best = { x, y, top: s.top }; break; } }
    if (!best) return 'no building';
    return best;
  });
  console.log('building', JSON.stringify(w));
  if (typeof w === 'object') {
    const r = await E(p, async (w) => {
      const B = window.__bot, h = window.__walk.hero(), b = h.body;
      // 건물 밖 15 m 쯤에서 건물 쪽으로 걸어간다(벽에 닿으면 멈춘다)
      const W = h.world;
      let sx = w.x, sy = w.y;
      for (let d = 1; d < 60; d++) { const x = w.x + d, y = w.y; if (!W.near(x, y, 0.1).some((s) => s.kind === 'building' && !s.water && W.constructor.contains(s, x, y))) { sx = x + 6; sy = y; break; } }
      b.place(sx, sy, W.terrain(sx, sy)); b.mode = 'ground';
      b.facing = 270; h.cam.yaw = 270; h.cam.snap(b);
      await B.sleep(500);
      B.steerAt(w.x, w.y); B.key('KeyW', true);
      const t0 = performance.now();
      while (performance.now() - t0 < 8000 && !window.__walk.ascend().available) await B.sleep(50);
      B.key('KeyW', false); B.unsteer();
      const t = window.__walk.ascend().scan();
      return { mode: b.mode, z: +b.z.toFixed(1), avail: window.__walk.ascend().available, t: t && { kind: t.kind, z1: +t.z1.toFixed(1) } };
    }, w);
    console.log('at wall', JSON.stringify(r));
    await shot('asc_4_wall');
    await up('wall up');
    for (let i = 0; i < 6; i++) { console.log('roof', JSON.stringify(await E(p, () => window.__bot.body()))); await p.waitForTimeout(300); }
    await shot('asc_5_roof');
  }
  // 아무것도 없는 곳
  await put([0, -250]);
  await p.waitForTimeout(500);
  console.log('open scan', JSON.stringify(await scan()));
};
