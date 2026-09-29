import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
// 초반 성장: 처음엔 기원 단추·의뢰가 숨어 있다 → 요괴·상자에서 🔹 → 등급 2: 큰 알림 + 열림 카드 → 옷장에서 무기 강화 → 등급 5: 비경
export default async (p, shot) => {
  for (let i = 0; i < 40; i++) { if (await E(p, () => window.__walk.prologue().running)) break; await p.waitForTimeout(500); }
  await E(p, () => window.__bot.stopRender());
  const st = () => E(p, () => { const W = window.__walk, P = W.progress(); return { ar: P.ar, xp: P.xp, ore: P.ore, feats: [...P.features], wishBtn: !document.querySelector('#wish-go').hidden, banner: W.banner().showing, bannerText: document.querySelector('.banner.on .card')?.textContent?.slice(0, 80) ?? null, feed: [...document.querySelectorAll('.feed .it')].map((x) => x.textContent) }; });
  console.log('start', JSON.stringify(await st()));
  // 쥐 셋과 싸운다(진짜 공격)
  await E(p, () => { const W = window.__walk, b = W.hero().body; W.combat().spawnCamp('prog-rats', b.x + 5, b.y + 5, b.z, 0.2, ['rat', 'rat', 'rat']); });
  const f = await fight(p, async (s) => s.n === 0, 60000, true);
  console.log('fight', JSON.stringify(f));
  console.log('after fight', JSON.stringify(await st()));
  await shot('prog_0_feed');
  // 등급 2까지 경험치
  await E(p, () => { const P = window.__walk.progress(); P.addXp(400, '테스트'); });
  await p.waitForTimeout(1500);
  console.log('AR2', JSON.stringify(await st()));
  await shot('prog_1_rank');
  await p.mouse.click(450, 280); await p.waitForTimeout(800);
  console.log('card2', JSON.stringify(await st()));
  await shot('prog_2_unlock');
  for (let i = 0; i < 4; i++) { if (!(await E(p, () => window.__walk.banner().showing))) break; await p.mouse.click(450, 280); await p.waitForTimeout(600); }
  // 옷장: 강화
  await E(p, () => { window.__walk.progress().addOre(20); window.__walk.closet().toggle(true); });
  await p.waitForTimeout(500);
  const before = await E(p, () => ({ atk: window.__walk.combat().stats().atk, txt: document.querySelector('#closet .enhance')?.textContent, stats: document.querySelector('#closet .stats')?.textContent }));
  console.log('closet', JSON.stringify(before));
  await p.click('#closet .enhance button', { force: true }); await p.waitForTimeout(400);
  await p.click('#closet .enhance button', { force: true }); await p.waitForTimeout(400);
  const after = await E(p, () => ({ atk: window.__walk.combat().stats().atk, lv: window.__walk.wardrobe().lvOf('umbrella'), txt: document.querySelector('#closet .enhance')?.textContent, ore: window.__walk.progress().ore }));
  console.log('enhanced', JSON.stringify(after));
  await shot('prog_3_closet');
  await E(p, () => window.__walk.closet().toggle(false));
  // 등급 5: 비경
  await E(p, () => { const P = window.__walk.progress(); P.addXp(2200, '테스트'); });
  await p.waitForTimeout(1200);
  const seen = [];
  for (let i = 0; i < 8; i++) { const s2 = await st(); if (s2.bannerText && !seen.includes(s2.bannerText)) seen.push(s2.bannerText); if (!s2.banner) break; await p.mouse.click(450, 280); await p.waitForTimeout(700); }
  console.log('AR5 cards', JSON.stringify(seen));
  console.log('end', JSON.stringify(await st()));
};
