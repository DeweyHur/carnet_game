import { E } from './common.mjs';
// 콤보: 4연타(마지막 회오리 베기) · 길게 눌러 강공격(앞으로 내달림) · 구르기 직후 반격 · HIT 수
// swiftshader는 느려서 벽시계 대신 게임 상태(동작 진행 t)를 보고 누른다
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => {
    const W = window.__walk; W.prologue().finish(true);
    window.__floats = []; const lay = document.querySelector('.cbt-layer'); new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('cbt-num')) window.__floats.push(n.textContent); }).observe(lay, { childList: true });
  });
  await p.waitForTimeout(300);
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 9 && B.showing; i++) B.next(); });
  const fps = await E(p, () => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { if (++n === 20) r(+(20000 / (performance.now() - t0)).toFixed(1)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  console.log('fps', fps);
  const spawn = (n) => E(p, (n) => { const W = window.__walk, b = W.hero().body, C = W.combat(); const [fx, fy] = [Math.sin(b.facing * Math.PI / 180), Math.cos(b.facing * Math.PI / 180)]; C.spawnCamp('cmb' + Math.random(), b.x + fx * 2.2, b.y + fy * 2.2, b.z, 0.3, Array(n).fill('rat')); for (const f of C.foes) { f.maxHp = f.hp = 5000; } }, n);
  await spawn(3);
  await E(p, () => { const b = window.__walk.hero().body; window.__trace = []; let last = ''; const t0 = performance.now(); const f = () => { const s = b.mode + ':' + (b.act?.kind ?? ''); if (s !== last) { window.__trace.push(((performance.now() - t0) | 0) + ' ' + s); last = s; } requestAnimationFrame(f); }; f(); });
  await p.waitForTimeout(300);
  const act = () => E(p, () => { const a = window.__walk.hero().body.act; return a ? [a.kind, a.t] : [null, 0]; });
  const until = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn(await act())) return true; await p.waitForTimeout(30); } return false; };
  // 1) 4연타: 페이지 안에서 앞 동작이 0.25초 지나면 다음을 누른다(입력 경로는 마우스와 같은 edge)
  const r1 = await E(p, () => new Promise((res) => {
    const h = window.__walk.hero(), b = h.body; const acts = []; let n = 0, last = null, f0 = window.__floats.length; const t0 = performance.now();
    const tick = () => {
      const a = b.act; const k = a?.kind ?? null;
      if (k !== last) { if (k) acts.push(k); last = k; }
      if (n < 4 && (n === 0 || (a && a.t >= 0.25 && acts.length === n))) { h.input.edges.add('attack'); n++; }
      if ((n === 4 && !a && acts.length >= 4) || performance.now() - t0 > 15000) return res({ acts, hits: window.__floats.length - f0, combo: document.querySelector('.cbt-combo')?.textContent });
      requestAnimationFrame(tick);
    }; tick();
  }));
  console.log('chain', JSON.stringify(r1));
  await shot('combo_chain');
  // 2) 강공격(마우스를 길게 눌렀다 떼면 나오는 'charge' edge): 앞으로 내달린다
  const r2 = await E(p, () => new Promise((res) => {
    const h = window.__walk.hero(), b = h.body; b.stamina = 1; const x0 = [b.x, b.y]; let saw = false; const t0 = performance.now();
    h.input.edges.add('charge');
    const tick = () => { if (b.act?.kind === 'charge') saw = true; if ((saw && !b.act) || performance.now() - t0 > 30000) return res({ combo: document.querySelector('.cbt-combo')?.textContent, saw, moved: +Math.hypot(b.x - x0[0], b.y - x0[1]).toFixed(1), stamina: +(1 - b.stamina).toFixed(2) }); requestAnimationFrame(tick); }; tick();
  }));
  console.log('charge', JSON.stringify(r2));
  // 3) 반격: 구르는 중에 공격을 누르면(버퍼) 구르기 끝나자마자 반격
  await spawn(2);
  const r3 = await E(p, () => new Promise((res) => {
    const h = window.__walk.hero(), b = h.body; b.stamina = 1; window.__floats.length = 0; let st = 0; const t0 = performance.now();
    h.input.edges.add('roll');
    const tick = () => {
      if (st === 0 && b.mode === 'roll') { st = 1; h.input.edges.add('attack'); }
      if (st === 1 && b.act?.kind === 'atk1') st = 2;
      if (st === 2 && !b.act) return res({ ok: true, floats: window.__floats.slice(0, 8), combo: document.querySelector('.cbt-combo')?.textContent });
      if (performance.now() - t0 > 30000) return res({ ok: false, st, mode: b.mode, floats: window.__floats.slice(0, 8) });
      requestAnimationFrame(tick);
    }; tick();
  }));
  console.log('counter', JSON.stringify(r3));
  await shot('combo_counter');
  console.log(await E(p, () => window.__trace.join(' | ')));
  // 4) 콤보 끊김: 쉬면 사라진다
  await p.waitForTimeout(6000);
  console.log('reset', JSON.stringify(await E(p, () => ({ on: document.querySelector('.cbt-combo')?.classList.contains('on') }))));
};
