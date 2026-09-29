import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
// 🌙 밤 습격: 시작 화면에서 밤을 골라 시작 → 사람이 없고 밤에 머문다 → 물결을 싸워 넘긴다(진짜 입력) →
// 📘로 특성 레벨 · 스킬 트리 찍기 · 옷 강화(진짜 클릭) → 메뉴에서 낮으로 돌아가면 사람이 돌아온다
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  const st = () => E(p, () => { const W = window.__walk, H = W.horde(), P = W.progress(), G = W.growth(); return { night: W.night(), clock: +((W.S.clock / 60) % 24).toFixed(1), people: W.hero().crowd.npcs.filter((n) => n.role !== 'quest').length, active: H.active, wave: H.wave, kills: H.kills, alive: W.combat().huntersAlive(), ar: P.ar, books: G.books, ore: P.ore, eur: Math.floor(W.S.money), sp: G.spFree(P.ar), downs: W.combat().downs, hud: document.querySelector('.horde')?.textContent }; });
  await p.waitForTimeout(4000);
  console.log('start', JSON.stringify(await st()));
  // 물결 둘을 넘길 때까지 싸운다
  const r = await fight(p, async () => { const s = await E(p, () => { const H = window.__walk.horde(); return H.wave >= 3 || (H.wave === 2 && window.__walk.combat().huntersAlive() === 0 && H.kills >= 32); }); return s; }, 900000, true);
  console.log('fight', JSON.stringify(r));
  console.log('after', JSON.stringify(await st()));
  await shot('night_fight');
  // 배너(등급 UP 등) 닫기
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 12 && B.showing; i++) B.next(); });
  // 🌟 성장(K): 특성 · 스킬 트리
  await E(p, () => { const W = window.__walk; if (W.growth().books < 2) W.growth().addBooks(2 - W.growth().books); if (W.S.money < 40) W.S.money = 40; }); // 모자라면 채워서라도 버튼 흐름을 본다
  await p.keyboard.press('KeyK');
  await p.waitForTimeout(500);
  const open = await E(p, () => document.querySelector('#growth')?.classList.contains('on'));
  const t0 = await E(p, () => window.__walk.growth().talents.normal);
  await p.click('#growth .talent:nth-child(1) button.primary').catch((e) => console.log('talent click fail', e.message.split('\n')[0]));
  await p.waitForTimeout(300);
  await p.click('#growth .node.can[data-node="edge"]').catch((e) => console.log('node click fail', e.message.split('\n')[0]));
  await p.waitForTimeout(300);
  console.log('growth', JSON.stringify({ open, before: t0, ...(await E(p, () => { const G = window.__walk.growth(); return { normal: G.talents.normal, edge: G.rank('edge'), books: G.books, stats: window.__walk.combat().stats() }; })) }));
  await shot('growth');
  await p.keyboard.press('KeyK');
  // 🎒 옷 강화(윗옷)
  await E(p, () => { const P = window.__walk.progress(); if (P.ore < 5) P.addOre(5); });
  await p.keyboard.press('KeyI');
  await p.waitForTimeout(500);
  const btns = await E(p, () => [...document.querySelectorAll('#closet .enhance button')].map((b) => b.textContent));
  const before = await E(p, () => { const W = window.__walk.wardrobe(); return W.lvOf(W.loadout.top); });
  await p.click('#closet .slot:has(h3:has-text("윗옷")) .enhance button.primary').catch((e) => console.log('armor click fail', e.message.split('\n')[0]));
  await p.waitForTimeout(300);
  console.log('armor', JSON.stringify({ btns, before, after: await E(p, () => { const W = window.__walk.wardrobe(); return W.lvOf(W.loadout.top); }), stats: await E(p, () => window.__walk.combat().stats()) }));
  await p.keyboard.press('KeyI');
  // ☀️ 낮으로(메뉴)
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  await p.click('#m-mode');
  await p.waitForTimeout(6000);
  console.log('day', JSON.stringify(await st()));
};
