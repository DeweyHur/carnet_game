import { E } from './common.mjs';
export default async (p) => {
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  await E(p, () => window.__bot.stopRender());
  await E(p, () => { const P = window.__walk.progress(); window.__log = []; const B = window.__walk.banner(); const u = B.unlock.bind(B), r = B.rank.bind(B); B.unlock = (...a) => { window.__log.push('unlock ' + a[1]); u(...a); }; B.rank = (...a) => { window.__log.push('rank ' + a[0]); r(...a); }; const of = P.onFeature; P.onFeature = (f) => { window.__log.push('onFeature ' + f.id); of?.(f); }; P.addXp(400, 't'); });
  for (let i = 0; i < 6; i++) { await p.waitForTimeout(700); console.log(JSON.stringify(await E(p, () => ({ log: window.__log, q: window.__walk.banner().queue.length, showing: window.__walk.banner().showing, txt: document.querySelector('.bigcard.on .card')?.textContent?.slice(0, 40) })))); }
};
