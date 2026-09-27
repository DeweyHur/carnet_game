import { E } from './common.mjs';
import { fight } from './fightlib.mjs';
// 비경: 입구 F → 받침 F → 광장 → 물결 셋 → 고리 F로 나가기
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  const st = () => E(p, () => { const D = window.__walk.domain(), b = window.__walk.hero().body; return { active: D.active, phase: D.phase, wave: D.wave, left: Math.round(D.left), b: { x: +b.x.toFixed(1), y: +b.y.toFixed(1), z: +b.z.toFixed(1), mode: b.mode }, hud: document.querySelector('.dom-hud')?.textContent, prompt: document.querySelector('.hprompt.on')?.textContent ?? null }; });
  const g = await E(p, async () => { const D = window.__walk.domain(), h = window.__walk.hero(), b = h.body; for (let i = 0; i < 40 && !D.gates.length; i++) await window.__bot.sleep(100); const G = D.gates[0]; b.place(G.x, G.y - 20, h.world.terrain(G.x, G.y)); await window.__bot.sleep(300); for (let i = 0; i < 100 && !G.settled; i++) await window.__bot.sleep(100); const x = G.x + 1.6, y = G.y; b.place(x, y, h.world.terrain(x, y)); b.mode = 'ground'; h.cam.snap(b); await window.__bot.sleep(1500); return { id: G.def.id, settled: G.settled, prompt: D.prompt2(), near: !!D.nearGate }; });
  console.log('gate', JSON.stringify(g));
  await shot('dom_0_gate');
  await E(p, () => window.__bot.press('KeyF'));
  await p.waitForTimeout(2500);
  console.log('in', JSON.stringify(await st()));
  await shot('dom_1_room');
  await E(p, async () => { await window.__bot.walkTo(0, 1.8, 1.2, 15000); await window.__bot.press('KeyF'); await window.__bot.sleep(500); });
  console.log('started', JSON.stringify(await st()));
  await E(p, async () => { await window.__bot.walkTo(0, 50, 2, 40000); });
  await p.waitForTimeout(800);
  console.log('arena', JSON.stringify(await st()));
  await shot('dom_2_arena');
  const f = await fight(p, async () => { const s = await E(p, () => window.__walk.domain().phase); return s !== 'run'; }, 170000, true);
  console.log('fight', JSON.stringify(f));
  console.log('after', JSON.stringify(await st()));
  await shot('dom_3_clear');
  await E(p, async () => { await window.__bot.walkTo(0, 55, 1.2, 20000); await window.__bot.press('KeyF'); await window.__bot.sleep(2000); });
  console.log('out', JSON.stringify(await st()), JSON.stringify(await E(p, () => ({ zone: window.__walk.combat().zone, foes: window.__walk.combat().list().length, sw: !!window.__walk.hero().sceneWorld }))));
  await shot('dom_4_out');
};
