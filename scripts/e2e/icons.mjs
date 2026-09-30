import { E } from './common.mjs';
// 기술 아이콘: 96개 한 장(콘택트 시트) + K 창 + 아래 기술 칸
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); W.progress().addXp(40000, 'test'); for (const id of ['marcel']) W.party().unlock(id); });
  const close = () => E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); });
  await p.waitForTimeout(1000); await close();
  await E(p, async () => {
    const { SKILLS } = await import('/src/walk/skills.ts'); const { iconImg } = await import('/src/walk/icons.ts');
    const d = document.createElement('div'); d.id = 'sheet'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#111;display:grid;grid-template-columns:repeat(16,1fr);gap:4px;padding:6px;overflow:hidden';
    d.innerHTML = SKILLS.map((s) => `<div style="aspect-ratio:1">${iconImg(s, 96).replace('class="skic"', 'style="width:100%;height:100%"')}</div>`).join('');
    document.body.append(d);
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'icons_sheet.png' });
  await E(p, () => document.getElementById('sheet').remove());
  await p.keyboard.press('KeyK'); await p.waitForTimeout(500);
  const ids = await E(p, () => [...document.querySelectorAll('#skills .node:not(.locked)')].map((b) => b.dataset.skill));
  for (const sid of ids.slice(0, 5)) { await p.click(`#skills .node[data-skill="${sid}"]`); await p.click('#skills .cd-learn').catch(() => null); }
  await p.waitForTimeout(400);
  await shot('icons_tree');
  await p.keyboard.press('KeyK'); await p.waitForTimeout(300); await close();
  await shot('icons_hud');
};
