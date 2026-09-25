import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(process.env.PW_MODULES ?? import.meta.url); // 전역 playwright면 PW_MODULES=$(npm root -g)/
const { chromium } = require('playwright');
const which = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-frame-rate-limit'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
p.on('pageerror', (e) => console.log('pageerror', e.stack));
await p.goto(process.env.E2E_URL ?? 'http://localhost:5173/?debug');
while (await p.evaluate(() => document.querySelector('#go').disabled)) await p.waitForTimeout(500);
await p.click('#go', { timeout: 120000 });
await p.waitForTimeout(800);
await p.evaluate(async () => { await window.__walk.quick(); });
await p.waitForTimeout(1500);
await p.addScriptTag({ content: readFileSync(new URL('./bot.js', import.meta.url), 'utf8') });
const toasts = [];
await p.exposeFunction('logToast', (t) => toasts.push(`${(Date.now() / 1000 % 1000).toFixed(0)} ${t}`));
await p.evaluate(() => { const t = document.querySelector('#toast'); new MutationObserver(() => window.logToast(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); });
const shot = async (name) => { await p.evaluate(() => { const h = window.__walk.hero(); h.view.render = h.view.constructor.prototype.render.bind(h.view); h.shadow.render = h.shadow.constructor.prototype.render.bind(h.shadow); }); await p.waitForTimeout(3500); await p.screenshot({ path: `${name}.png`, timeout: 120000 }).catch((e) => console.log('shot failed', e.message.split('\n')[0])); await p.evaluate(() => window.__bot.stopRender()); };
const scen = (await import(`./${which}.mjs`)).default;
const t0 = Date.now();
try { await scen(p, shot); } catch (e) { console.log('SCENARIO ERROR', e.message); }
console.log(`--- ${which} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log((await p.evaluate(() => window.__bot.log)).join('\n'));
console.log('--- toasts'); console.log(toasts.filter((t, i) => t.split(' ').slice(1).join(' ') && t !== toasts[i - 1]).join('\n'));
await b.close();
