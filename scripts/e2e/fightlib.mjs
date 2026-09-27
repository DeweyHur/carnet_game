import { E } from './common.mjs';
/** 가장 가까운 적과 싸운다(진짜 마우스 톡·E·Q). done()이 참이거나 시간이 다하면 끝 */
export async function fight(p, done, ms = 120000, dodge = false) {
  const t0 = Date.now();
  let dodges = 0, clicks = 0, skills = 0, bursts = 0, lastHp = null, deaths = 0;
  while (Date.now() - t0 < ms) {
    const s = await E(p, () => {
      const W = window.__walk, C = W.combat(), b = W.hero().body;
      const foes = C.list().filter((f) => f.state !== 'dead').map((f) => ({ ...f, d: Math.hypot(f.x - b.x, f.y - b.y) })).sort((a, b) => a.d - b.d);
      // 빨간 원·날갯짓(기합)을 보고 피해야 할 적
      const threat = foes.find((f) => f.state === 'windup' && f.d < (f.kind === 'boss' || f.kind === 'ratking' ? 7 : f.kind === 'gargoyle' ? 9 : 2.6)) ?? null;
      return { foe: foes[0] ?? null, threat, n: foes.length, hp: Math.round(C.hp), max: C.maxHp, energy: C.energy, skillReady: C.skillCd === 0, mode: b.mode };
    });
    if (lastHp !== null && s.hp > lastHp + 50) deaths++;
    lastHp = s.hp;
    if (await done(s)) break;
    if (!s.foe) { await p.waitForTimeout(300); continue; }
    if (dodge && s.threat && s.mode !== 'roll') {
      // 적 반대쪽으로 구른다(무적)
      await E(p, (f) => { const b = window.__walk.hero().body; window.__bot.steerAt(b.x * 2 - f.x, b.y * 2 - f.y); window.__bot.hold('KeyW', true); }, s.threat);
      await p.waitForTimeout(60);
      await E(p, () => window.__bot.press('KeyV'));
      await p.waitForTimeout(450);
      await E(p, () => window.__bot.hold('KeyW', false));
      dodges++;
      continue;
    }
    const reach = s.foe.kind === 'boss' || s.foe.kind === 'ratking' ? 3.4 : 2.1;
    if (s.foe.d > reach) {
      await E(p, (f) => { window.__bot.steerAt(f.x, f.y); window.__bot.hold('KeyW', true); }, s.foe);
      await p.waitForTimeout(150);
    } else {
      await E(p, (f) => { window.__bot.hold('KeyW', false); window.__bot.steerAt(f.x, f.y); }, s.foe);
      if (s.energy >= 60) { await E(p, () => window.__bot.press('KeyQ')); bursts++; await p.waitForTimeout(900); }
      else if (s.skillReady) { await E(p, () => window.__bot.press('KeyE')); skills++; await p.waitForTimeout(650); }
      else { await p.mouse.click(450, 280); clicks++; await p.waitForTimeout(170); }
    }
  }
  await E(p, () => { window.__bot.hold('KeyW', false); window.__bot.unsteer(); });
  return { secs: Math.round((Date.now() - t0) / 1000), clicks, skills, bursts, deaths, dodges };
}
