import { E } from './common.mjs';
export default async (p) => {
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  await E(p, () => { window.__walk.progress().stars = 400; window.__walk.wish().toggle(true); });
  await p.waitForTimeout(500);
  console.log(JSON.stringify(await E(p, () => { const b = document.querySelector('#wish .one'); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r: [r.left, r.top, r.width, r.height], top: top?.tagName + '.' + top?.className + '#' + top?.id, topParent: top?.parentElement?.className, z: getComputedStyle(document.querySelector('#wish')).zIndex }; })));
  await p.click('#wish .one', { force: true });
  await p.waitForTimeout(600);
  console.log(JSON.stringify(await E(p, () => ({ wishes: window.__walk.progress().wishes, msg: document.querySelector('#wish .msg')?.textContent, stars: window.__walk.progress().stars }))));
};
