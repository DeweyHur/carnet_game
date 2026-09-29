import { E } from './common.mjs';
// 무기: 옷장 무기 칸 · 바꿔 들면 손에 든 모양이 바뀐다 · 무기마다 피해가 다르다
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  const info = await E(p, () => {
    const W = window.__walk, wr = W.wardrobe();
    for (const id of ['baguette', 'cane', 'oar', 'rapier', 'flagpole', 'jeanne']) wr.unlock(id, true);
    W.closet().toggle(true);
    const rows = [...document.querySelectorAll('#closet .slot')].map((r) => r.querySelector('h3').textContent + ':' + r.querySelectorAll('.gear').length);
    return { rows, loadout: wr.loadout };
  });
  console.log('closet', JSON.stringify(info));
  for (const id of ['umbrella', 'baguette', 'oar', 'rapier', 'flagpole', 'jeanne']) {
    const r = await E(p, async (id) => {
      const W = window.__walk;
      // 옷장 카드를 눌러 바꾼다(진짜 클릭 흐름)
      const card = [...document.querySelectorAll('#closet .slot')][0].querySelectorAll('.gear');
      const names = { umbrella: '접은 파리 우산', baguette: '바게트 검', oar: '센 강 뱃사공의 노', rapier: '삼총사의 레이피어', flagpole: '혁명의 깃발', jeanne: '잔 다르크의 검' };
      const b = [...card].find((x) => x.querySelector('b').textContent === names[id]);
      b.click();
      await window.__bot.sleep(300);
      return { id, equipped: W.wardrobe().loadout.weapon, atk: Math.round(W.combat().atk), on: !!document.querySelector('#closet .slot .gear.on b')?.textContent };
    }, id);
    console.log('equip', JSON.stringify(r));
    if (id === 'jeanne' || id === 'oar' || id === 'flagpole') await shot(`weapon_${id}`);
  }
  await E(p, () => window.__walk.closet().toggle(false));
  // 같은 적을 무기별로 몇 번 때려야 하나(평균 피해)
  const dmg = await E(p, async () => {
    const W = window.__walk, C = W.combat(), wr = W.wardrobe(), b = W.hero().body;
    const out = {};
    for (const id of ['umbrella', 'jeanne', 'baguette']) {
      wr.equip(id);
      C.spawnCamp('wtest-' + id, b.x + 1.2, b.y + 0.01, b.z, 0.2, ['rat']);
      await window.__bot.sleep(200);
      const f0 = C.list().find((f) => f.camp === 'wtest-' + id);
      b.facing = Math.atan2(f0.x - b.x, f0.y - b.y) * 180 / Math.PI;
      let hits = 0; const hp0 = f0.hp;
      for (let i = 0; i < 12; i++) { C.damage(C.foes.find((f) => f.id === f0.id) ?? f0, C.atk, 'hit'); hits++; }
      out[id] = { atk: Math.round(C.atk), avgHit: Math.round((hp0 - Math.max(0, (C.foes.find((f) => f.id === f0.id)?.hp ?? 0))) / hits), hpAfter: Math.round(C.hp) };
    }
    return out;
  });
  console.log('damage', JSON.stringify(dmg));
  await E(p, () => { const W = window.__walk; W.hero().body.drawn = 6; W.wardrobe().equip('jeanne'); });
  await p.waitForTimeout(600);
  await shot('weapon_hand');
};
