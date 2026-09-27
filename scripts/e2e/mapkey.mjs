import { E } from './common.mjs';
export default async (p) => {
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  const st = () => E(p, () => ({ map: document.body.classList.contains('map-mode'), en: window.__walk.hero().input.enabled, allow: window.__walk.hero().input.allowMapKey, step: window.__walk.prologue().stepId, focus: document.activeElement?.tagName }));
  console.log('before', JSON.stringify(await st()));
  await p.keyboard.press('KeyM'); await p.waitForTimeout(1500);
  console.log('after M', JSON.stringify(await st()));
  await E(p, () => window.__bot.press('KeyM')); await p.waitForTimeout(1500);
  console.log('after bot M', JSON.stringify(await st()));
  await E(p, () => window.__bot.press('KeyM')); await p.waitForTimeout(1500);
  console.log('after bot M2', JSON.stringify(await st()));
};
