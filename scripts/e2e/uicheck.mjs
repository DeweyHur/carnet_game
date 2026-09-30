// 화면 위 단추·표시가 서로 겹치거나 화면 밖으로 나가는지(데스크톱·휴대폰) — 몇 가지 상태에서
import { createRequire } from 'module';
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const mobile = process.env.MOBILE === '1';
const W = mobile ? 844 : 1280, H = mobile ? 390 : 720;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-frame-rate-limit'] });
const ctx = await b.newContext(mobile ? { viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: W, height: H } });
const p = await ctx.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:5173/?debug');
while (await p.evaluate(() => document.querySelector('#go').disabled)) await p.waitForTimeout(500);
if (mobile) await p.tap('#go'); else await p.click('#go');
await p.waitForTimeout(8000);
if (mobile) await p.evaluate(() => document.body.classList.add('touch-play'));
const scan = (tag) => p.evaluate((tag) => {
  const vis = (el) => { for (let e = el; e; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false; } return true; };
  const sel = ['.hud-right button', '.minimap', '.pro.on', '.questline.on', '.hprompt.on', '.hpad button', '.cbt button', '.cbt .hp', '.asc-btn', '#toast.on', '#hint.on', '.dom-hud.on', '.xpgain.on', '.horde.on', '.skbar.on button', '.mpbar', '.who'];
  const out = [];
  for (const s of sel) for (const el of document.querySelectorAll(s)) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    out.push({ s, t: (el.textContent || '').trim().slice(0, 12), x: r.left, y: r.top, r: r.right, b: r.bottom });
  }
  const issues = [];
  for (const a of out) if (a.x < 0 || a.y < 0 || a.r > innerWidth + 0.5 || a.b > innerHeight + 0.5) issues.push(`OFFSCREEN ${a.s} "${a.t}" [${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.r)},${Math.round(a.b)}] vs ${innerWidth}x${innerHeight}`);
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], c = out[j];
    if (a.s === '.hud-right button' && c.s === '.hud-right button') continue;
    const ox = Math.min(a.r, c.r) - Math.max(a.x, c.x), oy = Math.min(a.b, c.b) - Math.max(a.y, c.y);
    if (ox > 2 && oy > 2) issues.push(`OVERLAP ${a.s} "${a.t}" × ${c.s} "${c.t}" (${Math.round(ox)}×${Math.round(oy)})`);
  }
  return { tag, n: out.length, list: out.map((o) => `${o.s}"${o.t}"@${Math.round(o.x)},${Math.round(o.y)}-${Math.round(o.r)},${Math.round(o.b)}`), issues, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight };
}, tag);
const show = async (tag) => { if (await p.evaluate(() => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  const r = await scan(tag); console.log(`== ${tag}: ${r.n} els, doc ${r.docW}x${r.docH}`); for (const l of r.list) console.log('   ', l); for (const i of r.issues) console.log('  !!', i); };
await show('walk');
await p.screenshot({ path: `ui2_${mobile ? 'm' : 'd'}_walk.png`, timeout: 120000 }).catch(() => {});
// 싸움 중 · 상승 가능 · 행동 안내 · 할 일 한 줄
await p.evaluate(() => { const W = window.__walk; const C = W.combat(); const b = W.hero().body; C.spawnCamp('ui-test', b.x + 6, b.y + 6, b.z, 0.2, ['slime']); W.hero().hud.setPrompt({ verb: '열기', what: '🎁 정교한 보물상자' }); document.querySelector('.asc-btn').classList.add('on', 'ready'); document.querySelector('#hint').textContent = '🧚 리리: 테스트 한 줄입니다'; document.querySelector('#hint').classList.add('on'); document.querySelector('#toast').textContent = '🔷 샹드마르스(에펠탑)'; document.querySelector('#toast').classList.add('on'); document.querySelector('.cbt').classList.add('fight'); W.horde().start(); const A = W.arsenal(); A.ranks['traveler.00'] = 1; A.ranks['traveler.10'] = 1; A.bind('traveler', 0, 'traveler.00'); A.bind('traveler', 1, 'traveler.10'); A.paintBar(); });
await p.waitForTimeout(400);
await show('busy');
await p.screenshot({ path: `ui2_${mobile ? 'm' : 'd'}_busy.png`, timeout: 120000 }).catch(() => {});
await p.evaluate(() => window.__walk.menu(true));
await p.waitForTimeout(400);
await p.screenshot({ path: `ui2_${mobile ? 'm' : 'd'}_menu.png`, timeout: 120000 }).catch(() => {});
await b.close();
