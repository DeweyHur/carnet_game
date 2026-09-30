import { E } from './common.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); const P = W.party(); for (const id of ['julie', 'gustave', 'marcel', 'amelie', 'quentin', 'elodie', 'lune']) P.unlock(id); });
  await p.waitForTimeout(800);
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 30 && B.showing; i++) B.next(); });
  await E(p, async () => { await window.__walk.arrive('champs-elysees'); });
  await p.waitForTimeout(1500);
  await E(p, () => window.__bot.place('eiffel', [-60, -200]));
  await p.waitForTimeout(1500);
  for (const id of ['julie', 'gustave', 'marcel', 'amelie', 'quentin', 'elodie', 'lune']) {
    await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 30 && B.showing; i++) B.next(); });
    await p.keyboard.press('KeyP'); await p.waitForTimeout(300);
    (await p.click(`#party .pt-av[data-char="${id}"]`), await p.click(`#party .pt-go .go`), await p.keyboard.press(`KeyP`));
    await E(p, () => { const h = window.__walk.hero(); h.cam.portrait = true; h.cam.portraitShift = [0, 0, 3.4]; h.body.facing = (h.cam.yaw + 180) % 360; h.body.drawn = 6; });
    await p.waitForTimeout(300);
    if (['julie', 'gustave', 'marcel', 'quentin', 'elodie', 'lune'].includes(id)) await shot(`g_${id}`);
  }
  await E(p, () => { window.__walk.hero().cam.portrait = false; });
};
