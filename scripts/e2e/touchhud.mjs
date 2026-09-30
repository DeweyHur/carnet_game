import { E } from './common.mjs';
// 휴대폰(터치): 기술 네 칸을 다 채운 채 공격 단추 둘레가 겹치지 않는지 · 공격 단추가 진짜로 눌리는지
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); W.progress().addXp(40000, 't'); const B = W.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); document.querySelectorAll('.bigcard').forEach((e) => e.remove()); document.body.classList.add('touch-play'); const A = W.arsenal(); for (const k of ['traveler.00', 'traveler.10', 'traveler.11', 'traveler.02']) A.ranks[k] = 1; ['traveler.00', 'traveler.10', 'traveler.11', 'traveler.02'].forEach((k, i) => A.bind('traveler', i, k)); document.querySelector('.cbt')?.classList.add('fight'); A.paintBar(); });
  await p.waitForTimeout(600);
  const rects = await E(p, () => [...document.querySelectorAll('.skbar button, .cbt button, .hpad button, .hprompt')].filter((e) => e.offsetParent !== null || getComputedStyle(e).position === 'fixed').map((e) => { const r = e.getBoundingClientRect(); return [e.className || e.textContent.slice(0, 4), Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; }).filter((r) => r[3] > 0));
  console.log('RECTS', JSON.stringify(rects));
  const atk = await E(p, () => { const b = document.querySelector('.cbt .atk'); if (!b) return null; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: el?.className, tag: el?.tagName, inAtk: b.contains(el) }; });
  console.log('ATK', JSON.stringify(atk));
  await shot(`touch_${process.env.TAG ?? 'a'}`);
};
