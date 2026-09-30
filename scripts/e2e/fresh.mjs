import { E } from './common.mjs';
// ↺ 새로 시작: 메뉴에서 두 번 누르면 저장이 지워지고 다시 연다 → 시작 화면에서 첫걸음이 처음부터
export default async (p) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); W.progress().addXp(3000, 'test'); W.progress().save(); });
  await p.waitForTimeout(500);
  const before = await E(p, () => ({ keys: Object.keys(localStorage).filter((k) => k.startsWith('carnet-')).length, ar: window.__walk.progress().ar }));
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); });
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.click('[data-m="fresh"]');
  const armed = await E(p, () => document.querySelector('[data-m="fresh"]')?.textContent);
  await Promise.all([p.waitForNavigation({ timeout: 60000 }).catch(() => null), p.click('[data-m="fresh"]')]);
  await p.waitForTimeout(3000);
  while (await p.evaluate(() => document.querySelector('#go')?.disabled)) await p.waitForTimeout(500);
  const after = await E(p, () => ({ keys: Object.keys(localStorage).filter((k) => k.startsWith('carnet-')), go: document.querySelector('#go')?.textContent, fresh: !document.querySelector('#fresh')?.hidden }));
  console.log('FRESH', JSON.stringify({ before, armed, after }));
};
