import { E } from './common.mjs';
// 깊이: 원소 반응(쥘리 물 → 마르셀 불 = 증발) · 정예 접두어(분열 · 폭발 · 단단함) · 기술 각성(K 창에서 골라 5번 키)
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); const P = W.party(); for (const id of ['julie', 'marcel']) P.unlock(id); W.progress().addXp(40000, 'test'); });
  const close = () => E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); });
  await p.waitForTimeout(1200); await close();
  await E(p, () => { window.__fl = []; new MutationObserver((ms) => { for (const m of ms) for (const nd of m.addedNodes) if (nd.classList?.contains('cbt-num')) window.__fl.push(nd.className.replace('cbt-num', '').trim() + ':' + nd.textContent); }).observe(document.querySelector('.cbt-layer'), { childList: true }); });
  const pick = async (id) => { await close(); await p.keyboard.press('KeyP'); await p.waitForTimeout(300); await p.click(`#party .pt-av[data-char="${id}"]`); await p.click('#party .pt-go .go'); await p.keyboard.press('KeyP'); await p.waitForTimeout(400); await close(); };
  const spawn = (kinds, hp = 99999) => E(p, ({ kinds, hp }) => { const W = window.__walk, b = W.hero().body, C = W.combat(); for (const f of C.foes) f.hp = 0; const [fx, fy] = [Math.sin(b.facing * Math.PI / 180), Math.cos(b.facing * Math.PI / 180)]; C.spawnCamp('dp' + Math.random(), b.x + fx * 2.2, b.y + fy * 2.2, b.z, 0.3, kinds); for (const f of C.foes) if (f.state !== 'dead') { f.maxHp = f.hp = hp; f.affixes = []; f.elite = false; } }, { kinds, hp });
  const swing = (n) => E(p, (n) => new Promise((res) => { const h = window.__walk.hero(); let k = 0; const t0 = performance.now(); const tick = () => { if (!h.body.act && k < n) { h.input.edges.add('attack'); k++; } if ((k >= n && !h.body.act) || performance.now() - t0 > 12000) return res(k); requestAnimationFrame(tick); }; tick(); }), n);
  // 1) 반응: 쥘리로 때려 물 오라 → 마르셀로 때려 증발
  await pick('julie'); await spawn(['rat']); await p.waitForTimeout(400); await swing(2);
  const aura1 = await E(p, () => window.__walk.combat().foes.filter((f) => f.state !== 'dead').map((f) => f.aura));
  await pick('marcel'); await E(p, () => { const W = window.__walk, b = W.hero().body; for (const f of W.combat().foes) if (f.state !== 'dead') { f.aura = 'water'; f.auraT = 8; f.x = b.x + Math.sin(b.facing * Math.PI / 180) * 2; f.y = b.y + Math.cos(b.facing * Math.PI / 180) * 2; } window.__fl = []; }); await swing(2);
  const r1 = await E(p, () => ({ tally: window.__walk.combat().tally.reactions, rx: window.__fl.filter((s) => s.startsWith('rxn')) }));
  console.log('REACT julie aura', JSON.stringify(aura1), 'then marcel', JSON.stringify(r1));
  // 1b) 반응표: 직접 damage로 몇 쌍
  const table = await E(p, () => { const C = window.__walk.combat(); const out = {}; for (const [a, b] of [['water', 'fire'], ['ice', 'fire'], ['water', 'bolt'], ['fire', 'bolt'], ['toxic', 'fire'], ['moon', 'light'], ['water', 'wind'], ['fire', 'earth'], ['toxic', 'sound']]) { const f = C.foes.find((x) => x.state !== 'dead'); f.hp = f.maxHp = 99999; f.aura = a; f.auraT = 5; f.affixes = []; f.vulnT = 0; C.crystalT = 0; const h0 = f.hp; C.damage(f, 100, 'test', b); out[a + '+' + b] = Math.round(h0 - f.hp) + (f.aura ? '/' + f.aura : ''); } return out; });
  console.log('TABLE', JSON.stringify(table));
  // 2) 접두어: 정예 20마리의 접두어 · 단단함(−50%, 반응으로 깨짐) · 분열 · 폭발
  const aff = await E(p, () => { const W = window.__walk, b = W.hero().body, C = W.combat(); const seen = {}; for (let i = 0; i < 20; i++) { const f = C.spawnHunter('rat', b.x + 30, b.y + 30, 9, true); for (const a of f.affixes ?? []) seen[a] = (seen[a] ?? 0) + 1; f.hp = 0; f.state = 'dead'; } return seen; });
  console.log('AFFIX spread', JSON.stringify(aff));
  const arm = await E(p, () => { const C = window.__walk.combat(); const f = C.foes.find((x) => x.state !== 'dead'); f.affixes = ['armored']; f.aura = null; f.hp = f.maxHp = 99999; let h = f.hp; C.damage(f, 100, 'test', 'earth'); const a = h - f.hp; f.aura = 'water'; f.auraT = 5; h = f.hp; C.damage(f, 100, 'test', 'fire'); const b2 = h - f.hp; h = f.hp; f.aura = null; C.damage(f, 100, 'test', 'earth'); return { armored: Math.round(a), reaction: Math.round(b2), after: Math.round(h - f.hp), left: f.affixes }; });
  console.log('ARMORED', JSON.stringify(arm));
  await spawn(['rat']);
  await E(p, () => { window.__fl = []; }); const n0 = await E(p, () => { const C = window.__walk.combat(); const f = C.foes[C.foes.length - 1]; const b = window.__walk.hero().body; f.x = b.x + 1; f.y = b.y; const d = Math.hypot(f.x - b.x, f.y - b.y); C.iframes = 0; f.affixes = ['splitting', 'volatile']; f.elite = true; f.hp = 1; C.damage(f, 50, 'test', null); return [C.foes.filter((x) => x.state !== 'dead').length, d.toFixed(1), C.later.length]; });
  await E(p, () => new Promise((r) => { const C = window.__walk.combat(), t0 = performance.now(); const f = () => (C.later.length === 0 || performance.now() - t0 > 15000 ? r() : requestAnimationFrame(f)); f(); }));
  const n1 = await E(p, () => { const C = window.__walk.combat(); return { alive: C.foes.filter((x) => x.state !== 'dead').length, minis: C.foes.filter((x) => x.mini && x.state !== 'dead').length, hp: Math.round(C.hp), max: C.maxHp, fl: window.__fl, later: C.later.length, iframes: C.iframes, mode: window.__walk.hero().body.mode }; });
  console.log('SPLIT/VOLATILE alive right after', n0, 'after 1.6s', JSON.stringify(n1));
  await shot('depth_elite');
  // 3) 각성: 마르셀 첫 쓰는 기술을 Lv5 → K 창에서 첫 각성 선택 → 5번 키
  const sid = await E(p, () => { const A = window.__walk.arsenal(); const btn = [...document.querySelectorAll('#skills .sk')]; void btn; return Object.keys(A.ranks).length; });
  void sid;
  await close(); await p.keyboard.press('KeyK'); await p.waitForTimeout(600);
  console.log('KPANEL', JSON.stringify(await E(p, () => [document.querySelector('#skills')?.className, document.querySelector('#skills')?.innerHTML.slice(0, 300), document.activeElement?.tagName, window.__walk.banner().showing])));
  const ids = await E(p, () => [...document.querySelectorAll('#skills .node:not(.pas):not(.locked)')].map((b) => b.dataset.skill));
  const first = ids[0];
  for (let i = 0; i < 6; i++) { await p.click(`#skills .node[data-skill="${first}"]`); await p.click('#skills .cd-learn').catch(() => null); }
  const lv = await E(p, (id) => window.__walk.arsenal().lv(id), first);
  await p.click(`#skills .node[data-skill="${first}"]`); await p.waitForTimeout(200);
  const btns = await E(p, () => [...document.querySelectorAll('#skills .cd-aw button')].map((b) => (b.disabled ? '-' : '+') + b.querySelector('b').textContent));
  await p.click('#skills .cd-aw button:not([disabled])').catch((e) => console.log('no aw btn', e.message.split('\n')[0]));
  const aw = await E(p, (id) => window.__walk.arsenal().awake[id], first);
  await shot('depth_awake');
  await p.keyboard.press('KeyK'); await p.waitForTimeout(200);
  await E(p, (id) => { const W = window.__walk, A = W.arsenal(); A.bind(W.party().active, 0, id); A.mp = A.maxMp; }, first);
  await spawn(['rat', 'rat', 'rat']); await E(p, () => { window.__fl = []; }); await p.waitForTimeout(500);
  await p.keyboard.press('Digit5'); await p.waitForTimeout(3000);
  const cast = await E(p, () => ({ casts: window.__walk.arsenal().casts, nums: window.__fl.length, sample: window.__fl.slice(0, 8) }));
  console.log('AWAKE', first, 'lv', lv, 'buttons', JSON.stringify(btns), 'chosen', JSON.stringify(aw), 'cast', JSON.stringify(cast));
  const saved = await E(p, () => Object.keys(localStorage).filter((k) => /skill|arsenal/.test(k)).map((k) => k + '=' + localStorage.getItem(k).slice(0, 200)));
  console.log('SAVE', saved.join('\n'));
};
