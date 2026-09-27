import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
// 첫걸음 전부를 사람처럼(빛기둥을 따라 걷고, F·마우스·T·Space·단추로) 해 본다
export default async (p, shot) => {
  const t0 = Date.now();
  const info = () => E(p, () => { const W = window.__walk, pr = W.prologue(), h = W.hero(), b = h.body; return { step: pr.stepId, done: pr.done, beacon: pr.beacon(), b: { x: +b.x.toFixed(1), y: +b.y.toFixed(1), z: +b.z.toFixed(1), mode: b.mode }, line: document.querySelector('.pro .t')?.textContent, stars: W.progress().stars, ar: W.progress().ar }; });
  const wait = async (want, ms = 20000) => { const t = Date.now(); let s; while (Date.now() - t < ms) { s = await info(); if (s.step !== want) return s; await p.waitForTimeout(300); } return s; };
  const lap = (s) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, JSON.stringify(s));
  let s = await info();
  for (let i = 0; i < 40 && !s.step; i++) { await p.waitForTimeout(500); s = await info(); }
  lap(s);
  await E(p, () => window.__bot.stopRender());
  await shot('pro_0_start');
  // 1) 포인트
  await E(p, async ([x, y]) => window.__bot.walkTo(x, y, 2, 60000), s.beacon);
  s = await wait('waypoint'); lap(s);
  await shot('pro_1_wp');
  // 2) 상자
  await E(p, async ([x, y]) => { await window.__bot.walkTo(x, y, 1.6, 30000); await window.__bot.sleep(300); await window.__bot.press('KeyF'); }, s.beacon);
  s = await wait('chest'); lap(s);
  // 3) 퀴즈
  const q = await E(p, async () => { const st = window.__walk.street().story; for (let i = 0; i < 60 && !st.run('s-eiffel-quiz').npc; i++) await window.__bot.sleep(100); const n = st.run('s-eiffel-quiz').npc; return n ? window.__bot.talkTo(n, 1) : 'no npc'; });
  console.log('quiz talk', q);
  s = await wait('quiz'); lap(s);
  await shot('pro_3_quiz');
  // 4) 야영지
  await E(p, async ([x, y]) => window.__bot.walkTo(x, y, 6, 40000), s.beacon);
  const f = await fight(p, async (st) => st.n === 0 && (await E(p, () => window.__walk.explore().isLocked('pro:camp'))) === false, 90000, true);
  console.log('fight', JSON.stringify(f));
  await shot('pro_4_camp');
  for (let k = 0; k < 3; k++) {
    const r = await E(p, async ([x, y]) => { const W = window.__walk, ex = W.explore(); await window.__bot.walkTo(x, y, 1.4, 30000); await window.__bot.sleep(300); const before = { near: ex.near?.key, prompt: ex.prompt(), holding: !!W.street().holding, mode: W.hero().body.mode, talk: !!document.querySelector('.talk.on') }; await window.__bot.press('KeyF'); await window.__bot.sleep(700); return { ...before, opened: W.progress().chests.has('pro:camp') }; }, (await info()).beacon);
    console.log('camp chest F', JSON.stringify(r));
    if (r.opened) break;
  }
  s = await wait('camp'); lap(s);
  // 5) 상승
  await E(p, async ([x, y]) => window.__bot.walkTo(x, y, 2.5, 60000), s.beacon);
  const av = await E(p, () => window.__walk.ascend().available);
  console.log('ascend available at centre', av);
  await shot('pro_5_under');
  await E(p, () => window.__bot.press('KeyT'));
  s = await wait('ascend', 60000); lap(s);
  await shot('pro_5_deck');
  // 6) 글라이더: 빛기둥(잔디밭) 쪽으로 걸어 떨어지고 Space
  const [gx, gy] = s.beacon;
  const g = await E(p, async ([x, y]) => {
    const B = window.__bot, h = window.__walk.hero(), b = h.body; let opened = false;
    const ok = await B.go(x, y, () => { if (!opened && b.mode === 'air' && b.vz < -3) { opened = true; void B.press('Space'); } return b.mode === 'ground' && b.z - h.world.terrain(b.x, b.y) < 3; }, 90000);
    return { ok, opened, ...B.body() };
  }, [gx, gy]);
  console.log('glide', JSON.stringify(g));
  s = await wait('glide', 10000); lap(s);
  await shot('pro_6_landed');
  // 7) 기원: ✨ 단추 → 1번 → 닫기
  await p.click('#wish-go');
  await p.waitForTimeout(700);
  await p.click('#wish .one');
  await p.waitForTimeout(1200);
  await shot('pro_7_wish');
  await p.click('#wish .x');
  s = await wait('wish'); lap(s);
  // 8) 수첩
  await p.keyboard.press('KeyJ');
  await p.waitForTimeout(800);
  s = await wait('journal'); lap(s);
  await shot('pro_8_journal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(3500);
  lap(await info());
  console.log('tracked', await E(p, () => window.__walk.street().story.tracked), 'questline', await E(p, () => document.querySelector('.questline')?.textContent));
  await shot('pro_9_after');
};
