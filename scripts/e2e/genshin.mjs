import { E } from './common.mjs';
const P = (p) => E(p, () => { const g = window.__walk.progress(); return { ar: g.ar, xp: g.xp, stars: g.stars, wp: [...g.waypoints], chests: g.chests.size, plumes: g.plumes, com: g.commissions.map((c) => `${c.kind} ${Math.round(c.got)}/${c.goal}`) }; });
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForTimeout(4000);
  console.log('start', await P(p));
  // 1) 가까운 보물상자
  const list = await E(p, () => { const b = window.__walk.hero().body; return window.__walk.explore().list().map((e) => ({ ...e, d: Math.round(Math.hypot(e.x - b.x, e.y - b.y)) })).sort((a, b) => a.d - b.d).slice(0, 12); });
  console.log('near', list);
  const chest = list.find((e) => e.kind === 'chest' && e.tier !== 'luxurious' && e.d < 300 && e.tier === 'common');
  if (chest) {
    const r = await E(p, async (c) => { const B = window.__bot; const ok = await B.walkTo(c.x, c.y, 1.4, 90000); await B.sleep(300); await B.press('KeyE'); await B.sleep(1500); return { ok, prompt: document.querySelector('.hprompt')?.textContent }; }, chest);
    console.log('chest', r, await P(p));
    await shot('g_chest');
  }
  // 2) 개선문 순간이동 포인트까지 걸어가 켜고, 지도에서 샹젤리제로 순간이동
  const arc = await E(p, () => { const W = window.__walk; const h = W.hero(); const wp = W.explore().list().find((e) => e.key === 'wp-arc'); return wp; });
  const r2 = await E(p, async (wp) => { const B = window.__bot; return B.walkTo(wp.x, wp.y, 3, 200000); }, arc);
  await p.waitForTimeout(1500);
  console.log('arc wp', r2, await P(p));
  await E(p, () => { document.querySelector('#eye').click(); });
  await p.waitForTimeout(2500);
  await shot('g_map');
  const before = await E(p, () => window.__bot.body());
  await E(p, () => [...document.querySelectorAll('.wp-pin')].find((el) => el.textContent.includes('샹젤리제') && !el.textContent.includes('샹드'))?.click());
  await p.waitForTimeout(1500);
  await E(p, () => document.querySelector('.choices button.primary')?.click());
  await p.waitForTimeout(6000);
  const after = await E(p, () => window.__bot.body());
  console.log('teleport', { before: [before.x, before.y].map(Math.round), after: [after.x, after.y].map(Math.round), mode: after.mode }, await P(p));
  // 3) 고양이·도전을 찾아 다닌다(몸을 옮겨 칸을 세운다)
  let found = null;
  for (let k = 0; k < 14 && !found; k++) {
    await E(p, (k) => { const h = window.__walk.hero(), b = h.body; const a = k * 2.4, r = 150 + k * 40; const x = Math.cos(a) * r, y = Math.sin(a) * r; b.place(x, y, h.world.ground(x, y, 400, 0)); b.mode = 'ground'; }, k);
    await p.waitForTimeout(2500);
    found = await E(p, () => { const b = window.__walk.hero().body; return window.__walk.explore().list().filter((e) => e.kind === 'cat' || e.kind === 'challenge').map((e) => ({ ...e, d: Math.hypot(e.x - b.x, e.y - b.y) })).sort((a, b) => a.d - b.d)[0] ?? null; });
  }
  console.log('special', found);
  if (found?.kind === 'cat') {
    const r = await E(p, async (c) => {
      const B = window.__bot, X = window.__walk.explore();
      await B.walkTo(c.x, c.y, 3, 60000);
      for (let i = 0; i < 6; i++) { const cat = X.list().find((e) => e.key === c.key && e.kind === 'cat'); if (!cat) break; await B.walkTo(cat.x, cat.y, 3, 30000); await B.sleep(1500); }
      const ch = X.list().find((e) => e.key === c.key);
      return ch;
    }, found);
    console.log('cat →', r);
  } else if (found?.kind === 'challenge') {
    const r = await E(p, async (c) => {
      const B = window.__bot, X = window.__walk.explore(), h = window.__walk.hero();
      await B.walkTo(c.x, c.y, 1.6, 60000); await B.sleep(300); await B.press('KeyE'); await B.sleep(500);
      for (let i = 0; i < 12; i++) { const o = X.list().filter((e) => e.kind === 'orb').sort((a, b) => Math.hypot(a.x - h.body.x, a.y - h.body.y) - Math.hypot(b.x - h.body.x, b.y - h.body.y))[0]; if (!o) break; await B.go(o.x, o.y, () => Math.hypot(o.x - h.body.x, o.y - h.body.y) < 1.0, 15000, true); }
      await B.sleep(500);
      return X.list().find((e) => e.key === c.key);
    }, found);
    console.log('challenge →', r);
  }
  // 4) 기원(버튼으로)
  await E(p, () => document.querySelector('#wish-go').click());
  await p.waitForTimeout(800);
  await E(p, () => document.querySelector('#wish .one').click());
  await p.waitForTimeout(1200);
  console.log('wish', await E(p, () => [...document.querySelectorAll('#wish .card')].map((c) => c.textContent)), await P(p));
  await E(p, () => { window.__walk.progress().stars += 1600; document.querySelector('#wish .ten').click(); });
  await p.waitForTimeout(1500);
  console.log('wish10', await E(p, () => [...document.querySelectorAll('#wish .card')].map((c) => c.textContent)));
  await p.screenshot({ path: 'g_wish.png', timeout: 120000 });
  await E(p, () => document.querySelector('#wish .x').click());
  await E(p, () => document.querySelector('#journal-go').click());
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'g_journal.png', timeout: 120000 });
  console.log('end', await P(p));
};
