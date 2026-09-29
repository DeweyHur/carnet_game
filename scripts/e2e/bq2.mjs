import { E } from './common.mjs';
export default async (p, shot) => {
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  await E(p, () => window.__bot.stopRender());
  await E(p, () => { window.__n = 0; const B = window.__walk.banner(); const nx = B.next.bind(B); B.next = () => { window.__n++; nx(); }; window.__walk.progress().addXp(400, 't'); });
  await p.waitForTimeout(1500);
  const s = () => E(p, () => ({ n: window.__n, q: window.__walk.banner().queue.length, showing: window.__walk.banner().showing, txt: document.querySelector('.bigcard.on .card')?.textContent?.slice(0, 30) }));
  console.log('before', JSON.stringify(await s()));
  await p.mouse.click(450, 280);
  await p.waitForTimeout(600);
  console.log('after click', JSON.stringify(await s()));
  await shot('bq_unlock');
  await p.mouse.click(450, 280);
  await p.waitForTimeout(600);
  console.log('after click2', JSON.stringify(await s()));
};
