import { E } from './common.mjs';
// 첫걸음 뒷부분만: 기원 → 수첩 → 끝(앞부분은 pro.mjs)
export default async (p, shot) => {
  const t0 = Date.now();
  const info = () => E(p, () => { const W = window.__walk, pr = W.prologue(); return { step: pr.stepId, done: pr.done, line: document.querySelector('.pro .t')?.textContent, stars: W.progress().stars, wishes: W.progress().wishes, nudge: document.querySelector('.nudge')?.id ?? null }; });
  const lap = (s) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, JSON.stringify(s));
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  await E(p, () => { const pr = window.__walk.prologue(); window.__walk.progress().stars = 20; pr.step = 8; pr.enter(0.1); });
  await p.waitForTimeout(800);
  lap(await info());
  await shot('tail_0_wishstep');
  console.log('pre', JSON.stringify(await E(p, () => ({ banner: window.__walk.banner().showing, btnHidden: document.querySelector('#wish-go').hidden, disp: getComputedStyle(document.querySelector('#wish-go')).display, feats: [...window.__walk.progress().features] }))));
  await p.click('#wish-go', { force: true });
  await p.waitForTimeout(500);
  console.log('open', JSON.stringify(await E(p, () => ({ wishOpen: window.__walk.wish().open, banner: window.__walk.banner().showing }))));
  await p.waitForTimeout(700);
  await p.click('#wish .one', { force: true });
  await p.waitForTimeout(1200);
  lap(await info());
  await shot('tail_1_wish');
  await p.click('#wish .x', { force: true });
  await p.waitForTimeout(800);
  lap(await info());
  await p.keyboard.press('KeyJ');
  await p.waitForTimeout(1200);
  lap(await info());
  await shot('tail_2_journal');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(4000);
  lap(await info());
  console.log('tracked', await E(p, () => window.__walk.street().story.tracked), '| questline:', await E(p, () => document.querySelector('.questline')?.textContent), '| hush', await E(p, () => window.__walk.companion().hush));
  await shot('tail_3_after');
};
