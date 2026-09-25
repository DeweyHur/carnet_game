// 시나리오 공용: 맡긴 사람에게 가서 시작 · 목표로 오르기 · 뛰어내려 글라이더로 돌아가 보고
export const E = (p, f, a) => p.evaluate(f, a);
export async function start(p, id, lm, near, district) {
  await E(p, () => window.__bot.stopRender());
  if (district) { await E(p, async (d) => { await window.__walk.arrive(d); }, district); await p.waitForTimeout(1500); }
  await E(p, ([lm, near]) => { window.__bot.place(lm, near); }, [lm, near]);
  await p.waitForTimeout(1200);
  const ok = await E(p, async (id) => { const st = window.__walk.street().story; for (let i = 0; i < 60 && !st.run(id).npc; i++) await window.__bot.sleep(100); const n = st.run(id).npc; return n ? window.__bot.talkTo(n, 1) : 'no npc'; }, id);
  console.log('talk', ok, await st(p, id));
}
export const st = (p, id) => E(p, (id) => window.__bot.state(id), id);
export const body = (p) => E(p, () => window.__bot.body());
/** 랜드마크 좌표 uv 쪽으로 W를 누르고 dz(랜드마크 땅에서)까지 */
export async function climb(p, lm, uv, dz, ms) {
  const r = await E(p, async ([lm, uv, dz, ms]) => { const B = window.__bot, L = B.lm(lm), [x, y] = B.at(lm, uv), h = window.__walk.hero(); const t0 = performance.now(); const ok = await B.go(x, y, () => h.body.z - L.z >= dz && h.body.mode === 'ground', ms, false, true); return { ok, secs: Math.round((performance.now() - t0) / 1000), dz: +(h.body.z - L.z).toFixed(1), mode: h.body.mode }; }, [lm, uv, dz, ms]);
  console.log('climb', lm, uv, 'to', dz, r);
  return r;
}
export async function walk(p, lm, uv, r = 1.4, ms = 60000) {
  const res = await E(p, async ([lm, uv, r, ms]) => { const B = window.__bot, [x, y] = B.at(lm, uv); const t0 = performance.now(); const ok = await B.walkTo(x, y, r, ms); return { ok, secs: Math.round((performance.now() - t0) / 1000), ...B.body() }; }, [lm, uv, r, ms]);
  console.log('walk', lm, uv, res);
  return res;
}
/** 높은 데서 target 쪽으로 걸어 떨어지고, 떨어지기 시작하면 Space로 글라이더, 내려앉을 때까지 그쪽으로 */
export async function glideTo(p, x, y) {
  const r = await E(p, async ([x, y]) => {
    const B = window.__bot, h = window.__walk.hero(), b = h.body;
    let opened = false;
    const ok = await B.go(x, y, () => {
      // 떨어지다 땅 가까이(35 m)에서 편다 — 높은 데서 바로 펴면 기력이 모자란다
      if (!opened && b.mode === 'air' && b.vz < -3 && b.z - h.world.terrain(b.x, b.y) < 35) { opened = true; void B.press('Space'); }
      return b.mode === 'ground' && b.z - h.world.terrain(b.x, b.y) < 1.5 && Math.hypot(x - b.x, y - b.y) < 40;
    }, 150000);
    return { ok, opened, ...B.body(), d: Math.round(Math.hypot(x - b.x, y - b.y)) };
  }, [x, y]);
  console.log('glide', r);
  return r;
}
export async function report(p, id) {
  const ok = await E(p, async (id) => { const st = window.__walk.street().story, n = st.run(id).npc; if (!n) return 'giver gone'; return window.__bot.talkTo(n, 1); }, id);
  console.log('report', ok, await st(p, id));
}
export async function photo(p, id, yaw) {
  await E(p, (yaw) => window.__bot.photo(yaw ?? undefined), yaw ?? null);
  await p.waitForTimeout(500);
  console.log('photo', await st(p, id));
}
