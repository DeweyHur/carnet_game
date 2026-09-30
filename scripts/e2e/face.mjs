import { E } from './common.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); const B = W.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); });
  await E(p, async () => { await window.__walk.arrive('champs-elysees'); });
  await p.waitForTimeout(1200);
  await E(p, () => window.__bot.place('eiffel', [-60, -200]));
  await p.waitForTimeout(1200);
  const tag = process.env.TAG ?? 'now';
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); document.querySelector('.bigcard')?.remove(); });
  for (const [dist, name] of [[2.2, 'close'], [4.2, 'full']]) {
    await E(p, (d) => { const h = window.__walk.hero(); h.cam.portrait = true; h.cam.portraitShift = [0, d < 3 ? 0.55 : 0, d]; h.body.facing = (h.cam.yaw + 200) % 360; }, dist);
    await p.waitForTimeout(300);
    await shot(`fig_${tag}_${name}`);
  }
  // 달리기 자세
  await E(p, () => { const h = window.__walk.hero(); h.cam.portrait = false; });
  await E(p, () => window.__bot.hold('KeyW', true));
  await p.waitForTimeout(1200);
  await shot(`fig_${tag}_run`);
  await E(p, () => window.__bot.hold('KeyW', false));
};
