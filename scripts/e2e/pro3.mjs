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
  await p.waitForSelector('#creator.on', { timeout: 20000 });
  await p.click('#creator .rnd');
  await p.click('#creator .ok');
  await p.waitForTimeout(1000);
  // 앞 단계는 pro2.mjs에서 봤다 — 기원 단계로 건너뛴다
  await E(p, () => { const pr = window.__walk.prologue(); pr.step = 12; pr.enter(0.1); });
  await p.waitForTimeout(800);
  s = await info(); lap(s);
  // 7) 기원: ✨ 단추 → 1번 → 닫기
  await clearBanner();
  await p.click('#wish-go', { force: true });
  await p.waitForTimeout(700);
  await p.click('#wish .one', { force: true });
  await p.waitForTimeout(1200);
  await shot('pro_7_wish');
  await p.click('#wish .x', { force: true });
  s = await wait('wish'); lap(s);
  // 📜 첫 기술: K → 배울 수 있는 칸 → ✨ 배우기 → 닫고 5번 키
  await clearBanner();
  await p.keyboard.press('KeyK');
  await p.waitForTimeout(600);
  await p.click('#skills .sk.can');
  await p.click('#skills .detail .learn.primary');
  await p.waitForTimeout(400);
  await shot('pro_skill');
  await clearBanner();
  if (await E(p, () => document.querySelector('#skills')?.classList.contains('on'))) await p.keyboard.press('KeyK');
  await E(p, () => { const W = window.__walk, b = W.hero().body, C = W.combat(); const [fx, fy] = [Math.sin(b.facing * Math.PI / 180), Math.cos(b.facing * Math.PI / 180)]; C.spawnCamp('pro:sk', b.x + fx * 4, b.y + fy * 4, b.z, 0.2, ['slime', 'slime']); });
  await p.waitForTimeout(600);
  for (let k = 0; k < 4 && (await info()).step === 'growth'; k++) { await p.keyboard.press('Digit5'); await p.waitForTimeout(1500); }
  console.log('slots', JSON.stringify(await E(p, () => ({ slots: window.__walk.arsenal().slotsOf('traveler'), casts: window.__walk.arsenal().casts }))));
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
