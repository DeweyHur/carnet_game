import { E } from './common.mjs';
// 이펙트 얼려 찍기: 베기 궤적 · 강공격 · 충격파 · 불티 · 반응 · 기술(부채꼴 · 탄 · 바닥)
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { const W = window.__walk; W.prologue().finish(true); W.progress().addXp(40000, 'test'); W.party().unlock('marcel'); });
  const close = () => E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 60 && B.showing; i++) B.next(); });
  await p.waitForTimeout(1000); await close();
  await E(p, async () => { await window.__walk.arrive('champs-elysees'); });
  await p.waitForTimeout(1500);
  await E(p, () => window.__bot.place('eiffel', [-260, -420]));
  await p.waitForTimeout(1500); await close();
  await E(p, () => {
    const W = window.__walk, h = W.hero(), b = h.body, C = W.combat();
    const c = h.cam; c.dist = c.wantDist = 7; c.pitch = 16; b.facing = (c.yaw + 60) % 360;
    const f = [Math.sin(b.facing * Math.PI / 180), Math.cos(b.facing * Math.PI / 180)];
    C.spawnCamp('vfx', b.x + f[0] * 2.5, b.y + f[1] * 2.5, b.z, 0.3, ['rat', 'slime']);
    for (const q of C.foes) { q.state = 'recover'; q.t = -999; }
    C.swing(b.x, b.y, b.z + 1.1, b.facing, false);
    C.swing(b.x, b.y, b.z + 1.3, b.facing, true, true);
    C.ring(b.x + f[0] * 2.5, b.y + f[1] * 2.5, b.z + 0.2, 0xff8a4a, 1);
    C.spark(b.x + f[0] * 2.2, b.y + f[1] * 2.2, b.z + 1.1, 0xffe7a0, true);
    C.burstWind(b.x + f[0] * 2.5, b.y + f[1] * 2.5, b.z + 1, 0x9ff3e0);
    for (const e of C.fx) { e.life = 999; const st = e.step; st(e.obj, 0.06, 0.06); e.step = () => {}; }
    // 파편·불티는 조금 퍼진 채로
  });
  await shot('vfx_melee');
  // 기술: 마르셀 첫 기술(부채꼴) · 탄 기술
  await E(p, () => { document.querySelectorAll('.cbt-num').forEach((n) => n.remove()); });
};
