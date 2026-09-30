import { E } from './common.mjs';
// 👥 여덟 명이 정말 다르게 싸우는지: 파티 창에서 진짜로 골라, 쥐 무리 앞에서 4타 · E · Q를 쓰고 무엇이 맞았는지 잰다
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); const P = W.party(); for (const id of ['julie', 'gustave', 'marcel', 'amelie', 'quentin', 'elodie', 'lune']) P.unlock(id); W.progress().addXp(8000, 'test'); });
  const close = () => E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 30 && B.showing; i++) B.next(); });
  await p.waitForTimeout(1500); await close();
  for (const id of ['traveler', 'julie', 'gustave', 'marcel', 'amelie', 'quentin', 'elodie', 'lune']) {
    await close();
    await p.keyboard.press('KeyP'); await p.waitForTimeout(500);
    (await p.click(`#party .pt-av[data-char="${id}"]`), await p.click(`#party .pt-go .go`), await p.keyboard.press(`KeyP`)).catch(() => p.keyboard.press('KeyP'));
    await p.waitForTimeout(400);
    const who = await E(p, () => ({ active: window.__walk.party().active, speed: window.__walk.hero().body.actSpeed, style: window.__walk.hero().figure.style, tag: document.querySelector('.who')?.textContent }));
    // 쥐 다섯(튼튼하게) — 앞 3~6 m
    await E(p, (id) => { const W = window.__walk, b = W.hero().body, C = W.combat(); const [fx, fy] = [Math.sin(b.facing * Math.PI / 180), Math.cos(b.facing * Math.PI / 180)]; C.spawnCamp('chr:' + id, b.x + fx * 4, b.y + fy * 4, b.z, 0.5, ['rat', 'rat', 'rat', 'rat', 'rat']); for (const f of C.list()) f.maxHp = f.hp = 99999; }, id);
    await p.waitForTimeout(600);
    const r = await E(p, () => new Promise((res) => {
      const W = window.__walk, h = W.hero(), b = h.body, C = W.combat();
      window.__dmg = window.__dmg ?? (() => { const o = { sum: 0, n: 0, texts: new Set() }; new MutationObserver((ms) => { for (const m of ms) for (const nd of m.addedNodes) { const t = nd.textContent ?? ''; if (nd.classList?.contains('cbt-num') && /^\d+!?$/.test(t)) { o.sum += parseInt(t); o.n++; } else if (nd.classList?.contains('cbt-num')) o.texts.add(t); } }).observe(document.querySelector('.cbt-layer'), { childList: true }); return o; })(); window.__dmg.sum = 0; window.__dmg.n = 0; window.__dmg.texts.clear(); const hp0 = () => window.__dmg.sum; const nHits = () => window.__dmg.n;
      const hit = { atk: 0, skill: 0, burst: 0 }, acts = []; let n = 0, last = null, phase = 'atk', t0 = performance.now(), mark = 0;
      const tick = () => {
        const a = b.act, k = a?.kind ?? null;
        if (k !== last) { if (k) acts.push(k); last = k; }
        if (phase === 'atk') {
          if (n < 4 && (n === 0 || (a && a.t >= 0.25 && acts.length === n))) { h.input.edges.add('attack'); n++; }
          if (n === 4 && !a && acts.length >= 4) { hit.atk = hp0(); phase = 'skill'; mark = performance.now(); C.skillCd = 0; h.input.edges.add('skill'); }
        } else if (phase === 'skill') {
          if (performance.now() - mark > 3500) { hit.skill = hp0() - hit.atk; phase = 'burst'; mark = performance.now(); C.energy = C.energyMax; h.input.edges.add('burst'); }
        } else if (phase === 'burst') {
          if (performance.now() - mark > 6000) { hit.burst = hp0() - hit.atk - hit.skill; hit.hits = nHits(); hit.notes = [...window.__dmg.texts].filter((t) => !t.startsWith('-')).slice(0, 5); return res({ acts, hit, moved: +Math.hypot(b.x - window.__x0[0], b.y - window.__x0[1]).toFixed(1), hp: C.hp, stunned: C.list().filter((f) => (f.stunT ?? 0) > 0).length }); }
        }
        if (performance.now() - t0 > 60000) return res({ timeout: true, acts, hit, phase });
        requestAnimationFrame(tick);
      };
      window.__x0 = [b.x, b.y];
      tick();
    }));
    console.log(id, JSON.stringify(who), JSON.stringify(r));
    if (['julie', 'gustave', 'lune'].includes(id)) {
      await E(p, () => window.__walk.hero().input.edges.add('attack'));
      await p.waitForTimeout(60);
      await shot(`char_${id}`);
    }
    await E(p, (id) => { const C = window.__walk.combat(); for (const f of C.list()) f.hp = 0; }, id);
    await p.waitForTimeout(800);
  }
};
