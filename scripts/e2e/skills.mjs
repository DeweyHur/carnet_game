import { E } from './common.mjs';
// 📜 기술: 여덟 명마다 기술 창(K)에서 열두 기술을 진짜로 눌러 배우고, 쓰는 기술은 5번 키로 하나씩 써서 피해·마나·재사용을 잰다
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); const P = W.party(); for (const id of ['julie', 'gustave', 'marcel', 'amelie', 'quentin', 'elodie', 'lune']) P.unlock(id); W.progress().addXp(40000, 'test'); });
  const close = () => E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); });
  await p.waitForTimeout(1200); await close();
  await E(p, () => { window.__dmg = { sum: 0, n: 0, names: [] }; new MutationObserver((ms) => { for (const m of ms) for (const nd of m.addedNodes) { if (!nd.classList?.contains('cbt-num')) continue; const t = nd.textContent ?? ''; if (/^\d+!?$/.test(t)) { window.__dmg.sum += parseInt(t); window.__dmg.n++; } else if (nd.classList.contains('skname')) window.__dmg.names.push(t); } }).observe(document.querySelector('.cbt-layer'), { childList: true }); });
  const summary = [];
  for (const id of ['traveler', 'julie', 'gustave', 'marcel', 'amelie', 'quentin', 'elodie', 'lune']) {
    await close();
    if (id !== 'traveler') { await p.keyboard.press('KeyP'); await p.waitForTimeout(300); (await p.click(`#party .pt-av[data-char="${id}"]`), await p.click(`#party .pt-go .go`), await p.keyboard.press(`KeyP`)); await p.waitForTimeout(300); }
    await close();
    // K → 칸마다 눌러 배우기(위에서부터)
    await p.keyboard.press('KeyK'); await p.waitForTimeout(400);
    const ids = await E(p, () => [...document.querySelectorAll('#skills .sk')].map((b) => b.dataset.skill).sort((a, b) => a.slice(-1).localeCompare(b.slice(-1)) || a.localeCompare(b)));
    for (const sid of ids) { await p.click(`#skills .sk[data-skill="${sid}"]`); await p.click('#skills .detail .learn.primary').catch(() => null); }
    const learned = await E(p, (id) => { const A = window.__walk.arsenal(); return { lv: Object.fromEntries(Object.entries(A.ranks).filter(([k]) => k.startsWith(id + '.'))), free: A.spFree(id), slots: A.slotsOf(id) }; }, id);
    if (id === 'marcel') await shot('skills_tree');
    await p.keyboard.press('KeyK'); await p.waitForTimeout(200);
    // 쓰는 기술 하나씩: 5번 칸에 올려 5번 키
    const actives = await E(p, (id) => window.__walk.arsenal().constructor.name && [...document.querySelectorAll('#skills .sk')].length === 0 ? null : null, id);
    void actives;
    const list = await E(p, (id) => { const out = []; for (const k of Object.keys(window.__walk.arsenal().ranks)) if (k.startsWith(id + '.')) out.push(k); return out; }, id);
    const res = [];
    for (const sid of list) {
      const isActive = await E(p, (sid) => { const A = window.__walk.arsenal(); const s = A.slotsOf(window.__walk.party().active); A.bind(window.__walk.party().active, 0, sid); return A.slotsOf(window.__walk.party().active)[0] === sid && !!document.querySelector('.skbar button em'); }, sid);
      const d = await E(p, (sid) => { const S = window.__walk.arsenal(); return { eff: !!S.boost && !!(window.__skdef = null) }; }, sid);
      void d;
      // 적(튼튼한 쥐 다섯) 앞에 세운다
      await E(p, (sid) => { const W = window.__walk, b = W.hero().body, C = W.combat(); for (const f of C.list()) f.hp = 0; const [fx, fy] = [Math.sin(b.facing * Math.PI / 180), Math.cos(b.facing * Math.PI / 180)]; C.spawnCamp('sk:' + sid + Math.random(), b.x + fx * 5, b.y + fy * 5, b.z, 0.5, ['rat', 'rat', 'rat', 'rat', 'rat']); for (const f of C.list()) if (f.state !== 'dead') f.maxHp = f.hp = 99999; const A = W.arsenal(); A.mp = A.maxMp; window.__dmg.sum = 0; window.__dmg.n = 0; window.__dmg.names = []; window.__mp0 = A.mp; }, sid);
      await p.waitForTimeout(700);
      await p.keyboard.press('Digit5');
      await p.waitForTimeout(3000);
      const r = await E(p, (sid) => { const W = window.__walk, A = W.arsenal(); return { sid, name: window.__dmg.names[0] ?? null, dmg: window.__dmg.sum, hits: window.__dmg.n, mp: Math.round(window.__mp0 - A.mp), casts: A.casts }; }, sid);
      if (isActive && r.casts !== undefined) res.push(r);
    }
    const stat = await E(p, () => window.__walk.combat().stats());
    console.log(id, JSON.stringify({ learnedN: Object.keys(learned.lv).length, free: learned.free, stats: stat }));
    for (const r of res) console.log('   ', JSON.stringify(r));
    summary.push({ id, casts: res.filter((r) => r.name).length, dmg: res.filter((r) => r.dmg > 0).length, n: res.length });
  }
  console.log('SUMMARY', JSON.stringify(summary));
};
