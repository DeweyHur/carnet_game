import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
// 긴 첫걸음(22단계) 전부를 사람처럼: 캐릭터 만들기 → … → 싸움 연습 → … → 🌗 낮·밤 장 → 쥘리가 동료 → 파티에서 바꾸기 → 파리의 두 얼굴
export default async (p, shot) => {
  const t0 = Date.now();
  const info = () => E(p, () => { const W = window.__walk, pr = W.prologue(), h = W.hero(), b = h.body; return { step: pr.stepId, done: pr.done, beacon: pr.beacon(), b: { x: +b.x.toFixed(1), y: +b.y.toFixed(1), z: +b.z.toFixed(1), mode: b.mode }, line: document.querySelector('.pro .t')?.textContent, stars: W.progress().stars, ar: W.progress().ar }; });
  const wait = async (want, ms = 20000) => { const t = Date.now(); let s; while (Date.now() - t < ms) { s = await info(); if (s.step !== want) return s; await p.waitForTimeout(300); } return s; };
  const clearBanner = async () => { for (let i = 0; i < 8; i++) { if (!(await E(p, () => window.__walk.banner().showing))) return; await p.waitForTimeout(500); await p.mouse.click(450, 280); await p.waitForTimeout(300); } };
  const lap = (s) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, JSON.stringify(s));
  let s = await info();
  for (let i = 0; i < 40 && !s.step; i++) { await p.waitForTimeout(500); s = await info(); }
  lap(s);
  await E(p, () => window.__bot.stopRender());
  await shot('pro_0_start');
  // 0) 나를 만들기: 이름을 치고 생김새를 고르고 ✔
  await p.waitForSelector('#creator.on', { timeout: 20000 });
  await p.fill('#creator input', '봉주르');
  await p.click('#creator [data-k="skin"]:nth-of-type(4)');
  await p.click('#creator [data-k="hair"]:nth-of-type(6)');
  await p.click('#creator [data-k="style"][data-v="ponytail"]');
  await p.click('#creator [data-k="extra"][data-v="glasses"]');
  await p.click('#creator [data-k="accent"]:nth-of-type(2)');
  await shot('pro_0_create');
  await p.click('#creator .ok');
  s = await wait('create'); lap(s);
  console.log('created', JSON.stringify(await E(p, () => { const P = window.__walk.party(); return { name: P.name, look: P.look, who: document.querySelector('.who')?.textContent }; })));
  // 1) 지도: M으로 열고 닫기(켜 둔 🔷 확인)
  await clearBanner();
  await p.keyboard.press('KeyM');
  await p.waitForTimeout(2000);
  console.log('map open?', await E(p, () => ({ map: document.body.classList.contains('map-mode'), active: document.activeElement?.tagName, banner: window.__walk.banner().showing })));
  await shot('pro_1_map');
  await p.keyboard.press('KeyM');
  s = await wait('map'); lap(s);
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
  // 5~7) 싸움 연습: 4단 콤보 · 강공격 · 구르기 반격(입력 edge는 마우스·V와 같은 길)
  const drill = async (id, drive) => {
    await clearBanner();
    const b = (await info()).beacon;
    await E(p, async ([x, y]) => window.__bot.walkTo(x, y, 3, 40000), b);
    for (let k = 0; k < 6 && (await info()).step === id; k++) { await E(p, drive); await p.waitForTimeout(400); }
    s = await wait(id, 15000); lap(s);
  };
  const aimNearest = `const W = window.__walk, b = W.hero().body; const f = W.combat().list().filter((q) => q.state !== 'dead').sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0]; if (f) { window.__bot.steerAt(f.x, f.y); b.facing = Math.atan2(f.x - b.x, f.y - b.y) * 180 / Math.PI; }`;
  await drill('combo', new Function(`${aimNearest}; return new Promise((res) => { const h = window.__walk.hero(), b = h.body; const acts = []; let n = 0, last = null; const t0 = performance.now(); const tick = () => { const a = b.act, k = a?.kind ?? null; if (k !== last) { if (k) acts.push(k); last = k; } if (n < 4 && (n === 0 || (a && a.t >= 0.25 && acts.length === n))) { h.input.edges.add('attack'); n++; } if ((n === 4 && !a) || performance.now() - t0 > 12000) { window.__bot.unsteer(); return res(acts); } requestAnimationFrame(tick); }; tick(); });`));
  await drill('charge', new Function(`${aimNearest}; const h = window.__walk.hero(); h.body.stamina = Math.max(h.body.stamina, 0.6); h.input.edges.add('charge'); return new Promise((r) => setTimeout(() => { window.__bot.unsteer(); r(); }, 1500));`));
  await drill('counter', new Function(`${aimNearest}; return new Promise((res) => { const h = window.__walk.hero(), b = h.body; b.stamina = Math.max(b.stamina, 0.5); let st = 0; const t0 = performance.now(); h.input.edges.add('roll'); const tick = () => { if (st === 0 && b.mode === 'roll') { st = 1; h.input.edges.add('attack'); } if ((st === 1 && b.act?.kind === 'atk1' && b.act.t > 0.3) || performance.now() - t0 > 8000) { window.__bot.unsteer(); return res(); } requestAnimationFrame(tick); }; tick(); });`));
  // 5) 사진: 탑을 보고 📷 단추
  await E(p, () => { const h = window.__walk.hero(), b = h.body; const [tx, ty] = window.__bot.at('eiffel', [0, 0]); h.cam.yaw = Math.atan2(tx - b.x, ty - b.y) * 180 / Math.PI; b.facing = h.cam.yaw; });
  await p.waitForTimeout(500);
  console.log('photo nudge', await E(p, () => document.querySelector('#photo-go').classList.contains('nudge')));
  await clearBanner();
  await p.click('#photo-go', { force: true });
  s = await wait('photo', 15000); lap(s);
  // 6) 쥐왕: 걸어가서 가만히(쓰러질 때까지)
  await E(p, async ([x, y]) => window.__bot.walkTo(x, y, 8, 90000), s.beacon);
  s = await wait('king', 90000); lap(s);
  await shot('pro_6_king');
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
  await clearBanner();
  await p.click('#wish-go', { force: true });
  await p.waitForTimeout(700);
  await p.click('#wish .one', { force: true });
  await p.waitForTimeout(1200);
  await shot('pro_7_wish');
  await p.click('#wish .x', { force: true });
  s = await wait('wish'); lap(s);
  // 🌟 성장: K → 스킬 트리 한 칸
  await clearBanner();
  await p.keyboard.press('KeyK');
  await p.waitForTimeout(600);
  await p.click('#growth .node.can');
  await p.waitForTimeout(400);
  await shot('pro_growth');
  await p.keyboard.press('KeyK');
  s = await wait('growth'); lap(s);
  // 8) 수첩
  await clearBanner();
  await p.keyboard.press('KeyJ');
  await p.waitForTimeout(800);
  s = await wait('journal'); lap(s);
  await shot('pro_8_journal');
  await p.keyboard.press('KeyJ');
  await p.waitForTimeout(500);
  // 🌗 2장: 밤으로 — 🧚 메뉴의 진짜 단추
  const flip = async () => { await clearBanner(); await p.click('#menu-go', { force: true }); await p.waitForTimeout(500); await p.click('#m-mode'); await p.waitForTimeout(800); };
  await flip();
  s = await wait('night'); lap(s);
  // 첫 밤 습격: 1물결을 싸워 넘긴다
  const w = await fight(p, async () => (await info()).step !== 'wave', 400000, true);
  console.log('wave fight', JSON.stringify(w));
  s = await wait('wave', 5000); lap(s);
  await shot('pro_night');
  // 달빛 나비: 빛기둥 쪽으로 가서 나비를 쫓는다
  for (let k = 0; k < 40 && (await info()).step === 'moth'; k++) {
    await E(p, async () => { const W = window.__walk, m = W.prologue().group.children[0]; const [x, y] = m ? [m.position.x, m.position.y] : W.prologue().beacon(); await window.__bot.walkTo(x, y, 1.2, 4000); });
  }
  s = await wait('moth', 5000); lap(s);
  // 낮으로
  await flip();
  s = await wait('day'); lap(s);
  // 쥘리에게
  await E(p, async ([x, y]) => window.__bot.walkTo(x, y, 2.5, 60000), s.beacon);
  s = await wait('julie', 15000); lap(s);
  await clearBanner();
  // 👥 파티(P) → 쥘리
  await p.keyboard.press('KeyP');
  await p.waitForTimeout(600);
  await shot('pro_party');
  await p.click('#party .pc[data-char="julie"] button.primary');
  s = await wait('party'); lap(s);
  console.log('now', JSON.stringify(await E(p, () => ({ active: window.__walk.party().active, who: document.querySelector('.who')?.textContent }))));
  // 🌗 파리의 두 얼굴 첫 실마리(F)
  await clearBanner();
  await E(p, async ([x, y]) => { await window.__bot.walkTo(x, y, 1.6, 60000); await window.__bot.sleep(300); }, s.beacon);
  for (let k = 0; k < 5 && !(await info()).done; k++) { await E(p, () => window.__bot.press('KeyF')); await p.waitForTimeout(800); }
  lap(await info());
  console.log('final', JSON.stringify(await E(p, () => { const W = window.__walk; return { done: W.prologue().done, tale: W.tales().step, unlocked: [...W.party().unlocked], active: W.party().active, ar: W.progress().ar, tracked: W.street().story.tracked }; })));
  await p.waitForTimeout(3000);
  await shot('pro_9_after');
};
