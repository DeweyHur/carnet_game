import { E, st } from './common.mjs';
export default async (p, shot) => {
  // 다섯 메인은 각 시나리오에서 끝까지 확인했다 — 여기선 그 뒤를 본다
  await E(p, () => { window.__bot.stopRender(); const s = window.__walk.street().story; for (const id of ['m-eiffel', 'm-arc', 'm-louvre', 'm-notre-dame', 'm-sacre-coeur']) s.done.add(id); });
  await p.waitForTimeout(4000);
  console.log('opened', await st(p, 'm-finale'), await E(p, () => ({ tracked: window.__walk.street().story.tracked, clock: window.__walk.S.clock })));
  await E(p, () => { window.__walk.S.clock = 20 * 60 + 58; });
  await p.waitForTimeout(3000);
  console.log('20:58', await st(p, 'm-finale'));
  await E(p, () => { window.__walk.S.clock = 21 * 60 + 1; });
  await p.waitForTimeout(3000);
  console.log('21:01', await st(p, 'm-finale'), await E(p, () => window.__walk.street().eiffel.sparkling));
  await shot('finale');
};
