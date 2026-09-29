import { E, walk, body } from './common.mjs';
import { fight } from './fightlib.mjs';
// 🌗 파리의 두 얼굴: 낮 실마리 → 밤 정예 → 낮 열쇠 → 밤 문 → 낮 캔버스 → 밤 별. 모드는 🧚 메뉴의 진짜 단추로 바꾼다.
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); const P = W.progress(); for (const id of ['wp-eiffel', 'wp-louvre', 'wp-notre-dame', 'wp-sacre-coeur']) P.waypoints.add(id); P.addXp(60000, 'test'); });
  const closeCards = () => E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 20 && B.showing; i++) B.next(); });
  await p.waitForTimeout(800); await closeCards();
  const st = () => E(p, () => { const T = window.__walk.tales(); return { step: T.step, night: window.__walk.night(), line: document.querySelector('.tale')?.textContent }; });
  const mode = async (night) => {
    if ((await E(p, () => window.__walk.night())) === night) return;
    await closeCards();
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    await p.click('#m-mode'); await p.waitForTimeout(800);
    console.log('mode →', night ? 'night' : 'day', JSON.stringify(await st()));
  };
  const tp = async (id) => { await E(p, (id) => window.__walk.teleport(id), id); await p.waitForTimeout(1500); };
  const press = async (lm, uv) => {
    await walk(p, lm, uv, 1.6);
    const s0 = (await st()).step;
    for (let i = 0; i < 6 && (await st()).step === s0; i++) { await E(p, () => window.__bot.press('KeyF')); await p.waitForTimeout(700); }
    console.log('F', lm, JSON.stringify(await st()));
  };
  const battle = async (lm, uv) => {
    await walk(p, lm, uv, 8);
    const s0 = (await st()).step;
    const r = await fight(p, async () => (await E(p, () => window.__walk.tales().step)) !== s0, 400000, true);
    await closeCards();
    console.log('fight', lm, JSON.stringify(r), JSON.stringify(await st()), JSON.stringify(await body(p)));
  };
  // 1) 낮: 수첩 — 그 전에 밤 자리에 낮으로 가 보면 흐린 표시와 안내
  await tp('wp-eiffel');
  await press('eiffel', [34, -128]);
  await walk(p, 'eiffel', [0, -236], 4);
  await p.waitForTimeout(1500);
  console.log('wrong-mode hint', JSON.stringify(await E(p, () => document.querySelector('#hint')?.textContent)));
  // 2) 밤: 철의 유령
  await mode(true);
  await battle('eiffel', [0, -236]);
  await shot('tale_ghost');
  // 3) 낮: 표지석
  await mode(false);
  await tp('wp-louvre');
  await press('louvre', [-104, 18]);
  // 4) 밤: 문
  await mode(true);
  await tp('wp-notre-dame');
  await battle('notre-dame', [-132, 12]);
  // 5) 낮: 캔버스
  await mode(false);
  await tp('wp-sacre-coeur');
  await press('sacre-coeur', [-44, -12]);
  // 6) 밤: 떨어진 별
  await mode(true);
  await battle('sacre-coeur', [-30, -44]);
  console.log('final', JSON.stringify(await E(p, () => { const W = window.__walk, G = W.growth(), P = W.progress(); return { step: W.tales().step, done: W.tales().done, sp: G.spFree(P.ar), bonusSp: G.bonusSp, books: G.books, downs: W.combat().downs }; })));
};
