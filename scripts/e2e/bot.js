// 페이지 안에서 도는 플레이 봇: 진짜 키 이벤트(W·E·숫자·Space)를 보내고, 카메라 방위만 직접 돌린다(마우스 대신).
(() => {
  const W = window.__walk, h = W.hero(), st = W.street().story;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  const press = async (code, ms = 90) => { key(code, true); await sleep(ms); key(code, false); await sleep(60); };
  const bearing = (x, y) => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
  const log = [];
  // 헤드리스 크롬은 화면이 안 바뀌면 프레임을 거의 안 만든다(그리기를 꺼 두면 rAF가 멈춘다) — 작은 점 하나를 계속 움직여 프레임을 받는다
  const tick = document.createElement('div');
  tick.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;background:#f00;z-index:99;animation:__tk 1s linear infinite';
  const stl = document.createElement('style'); stl.textContent = '@keyframes __tk { from { left: 0 } to { left: 50px } }';
  document.head.appendChild(stl); document.body.appendChild(tick);
  let lastMode = '';
  let steer = null;
  let faceYaw = null; // 벽을 정면으로(오를 때)
  const loop = () => {
    const b = h.body;
    if (faceYaw !== null) h.cam.yaw = faceYaw;
    else if (steer) h.cam.yaw = bearing(steer.x - b.x, steer.y - b.y);
    if (b.mode !== lastMode) { log.push(`${(performance.now() / 1000).toFixed(1)} ${lastMode}→${b.mode} z=${b.z.toFixed(1)} st=${b.stamina.toFixed(2)}`); lastMode = b.mode; }
    for (const e of h.events) if (['hurt', 'exhausted', 'drown', 'splash', 'shutter', 'actDone'].includes(e)) log.push(`${(performance.now() / 1000).toFixed(1)} !${e} z=${b.z.toFixed(1)}`);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const bot = {
    log, sleep, press, key,
    stopRender() { h.view.render = () => {}; h.shadow.render = () => {}; },
    at: (lm, uv) => st.at(lm, uv), lm: (id) => st.lm(id),
    body: () => { const b = h.body; return { x: b.x, y: b.y, z: b.z, mode: b.mode, st: +b.stamina.toFixed(2) }; },
    place(lm, uv) { const [x, y] = st.at(lm, uv); const b = h.body; b.place(x, y, h.world.ground(x, y, 400, 0)); b.mode = 'ground'; h.cam.snap(b); },
    /** 목표 쪽으로 W를 누르고 간다(벽이면 오른다). until()이 참이 되거나 시간이 지나면 멈춘다 */
    async go(x, y, until, ms = 60000, run = false, rest = false) {
      steer = { x, y };
      key('KeyW', true); if (run) key('ShiftLeft', true);
      const t0 = performance.now();
      let ok = false, held = true, stuckT = 0, faceT = 0;
      while (performance.now() - t0 < ms) {
        if (until()) { ok = true; break; }
        // 오르는 중: 턱에 서 있으면 기력이 찰 때까지 멈춰 쉰다(사람도 그렇게 한다)
        if (rest) { const b = h.body, want = !(b.mode === 'ground' && b.stamina < b.maxStamina - 0.03); if (want !== held) { held = want; key('KeyW', want); } }
        if (rest) {
          // 사람처럼 벽을 정면으로 본다: 오르는 중엔 벽 쪽, 땅에서 높은 벽에 막혀 서 있으면 가장 가까운 면 쪽
          const b = h.body;
          if (b.mode === 'climb' && b.wall) { faceYaw = bearing(-b.wall.nx, -b.wall.ny); stuckT = 0; }
          else if (b.mode === 'ground') {
            stuckT = b.speed < 0.5 ? stuckT + 0.05 : 0;
            if (stuckT > 0.4 && faceT <= 0) {
              let best = null;
              for (const s of h.world.near(b.x, b.y, 1.2)) { if (s.top < b.z + 1.5 || s.base > b.z + 1) continue; const c = h.world.constructor.closest(s, b.x, b.y); if (c.d < 0.9 && (!best || c.d < best.d)) best = c; }
              if (best) { faceYaw = bearing(-best.nx, -best.ny); faceT = 2; }
            }
            if (faceT > 0) { faceT -= 0.05; if (faceT <= 0) faceYaw = null; } else faceYaw = null;
          } else faceYaw = null;
        }
        await sleep(50);
      }
      key('KeyW', false); key('ShiftLeft', false);
      steer = null; faceYaw = null;
      return ok;
    },
    async walkTo(x, y, r = 1.6, ms = 60000) { const b = h.body; return bot.go(x, y, () => Math.hypot(x - b.x, y - b.y) < r, ms); },
    /** 사람에게 걸어가 E, 대화가 뜨면 n번 고르기 */
    async talkTo(npc, choice = 1) {
      const b = h.body;
      let opened = false;
      for (let k = 0; k < 3 && !opened; k++) {
        await bot.walkTo(npc.x, npc.y, 2.2 - k * 0.4, 30000);
        h.cam.yaw = bearing(npc.x - b.x, npc.y - b.y); b.facing = h.cam.yaw;
        await sleep(400);
        await press('KeyE');
        for (let i = 0; i < 30 && !document.querySelector('.talk.on'); i++) await sleep(100);
        opened = !!document.querySelector('.talk.on');
        if (!opened) log.push(`talk try ${k} failed: d=${Math.hypot(npc.x - b.x, npc.y - b.y).toFixed(1)} mode=${b.mode} prompt=${document.querySelector('.hprompt.on')?.textContent ?? '-'}`);
      }
      if (!opened) return false;
      await sleep(300);
      await press('Digit' + choice);
      await sleep(400);
      return true;
    },
    async photo(yaw) { if (yaw !== undefined) h.cam.yaw = yaw; await sleep(200); await press('Digit3'); await sleep(2200); },
    state: (id) => { const r = st.run(id); return { beat: r.beat, got: r.got, done: st.done.has(id), line: st.lineOf(r.ch) }; },
  };
  const s0 = W.street(), so = s0.onShutter.bind(s0), sto = st.onShutter.bind(st);
  s0.onShutter = () => { log.push(`street.onShutter z=${h.body.z.toFixed(1)}`); return so(); };
  st.onShutter = (yaw) => { const r = sto(yaw); log.push(`story.onShutter yaw=${yaw.toFixed(0)} → ${r}`); return r; };
  window.__bot = bot;
})();
