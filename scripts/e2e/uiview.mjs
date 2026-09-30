import { E } from './common.mjs';
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); const P = W.party(); for (const id of ['julie', 'gustave', 'marcel', 'amelie', 'quentin', 'elodie', 'lune']) P.unlock(id); W.progress().addXp(9000, 'test'); });
  await p.waitForTimeout(600);
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); document.querySelectorAll('.bigcard').forEach((e) => e.remove()); });
  await E(p, () => { const W = window.__walk, A = W.arsenal(), P = W.party(); P.select('marcel'); for (const [k, v] of [['marcel.00', 3], ['marcel.01', 2], ['marcel.02', 1], ['marcel.10', 4], ['marcel.11', 1], ['marcel.20', 1]]) A.ranks[k] = v; A.bind('marcel', 0, 'marcel.10'); A.bind('marcel', 1, 'marcel.00'); A.bind('marcel', 2, 'marcel.02'); });
  await p.keyboard.press('KeyK'); await p.waitForTimeout(500);
  console.log(JSON.stringify(await E(p, () => ({ on: document.querySelector('#skills')?.classList.contains('on'), nodes: document.querySelectorAll('#skills .node').length, modal: ['closet','journal','wish','menu','growth','creator','party'].filter((i) => document.getElementById(i)?.classList.contains('on')), bc: !!document.querySelector('.bigcard.on') }))));
  await p.hover('#skills .node[data-skill="marcel.10"]', { timeout: 5000 }).catch(() => null);
  await shot(`${process.env.TAG ?? 'ui'}_skills`);
  await p.keyboard.press('KeyK'); await p.waitForTimeout(300);
  if (process.env.PARTY) { await p.keyboard.press('KeyP'); await p.waitForTimeout(700); await shot(`${process.env.TAG ?? 'ui'}_party`); }
};
