import { E } from './common.mjs';
// 적 모습 사진: 쥐 · 슬라임 · 가고일(+정예) 을 가까이서, 그다음 우두머리 · 쥐왕
export default async (p, shot) => {
  await E(p, () => window.__bot.stopRender());
  await p.waitForSelector('#creator.on', { timeout: 20000 }).catch(() => null);
  if (await E(p, () => document.querySelector('#creator')?.classList.contains('on'))) await p.click('#creator .ok');
  await E(p, () => { window.__walk.prologue().finish(true); });
  await p.waitForTimeout(800);
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 30 && B.showing; i++) B.next(); });
  await E(p, async () => { await window.__walk.arrive('champs-elysees'); });
  await p.waitForTimeout(1500);
  await E(p, () => window.__bot.place('eiffel', [-260, -420]));
  await p.waitForTimeout(1500);
  await E(p, () => { const B = window.__walk.banner(); for (let i = 0; i < 30 && B.showing; i++) B.next(); document.querySelector('#hud').style.opacity = '0'; });
  const pose = async (kinds, dist, side, shift) => { await E(p, (cd) => { const c = window.__walk.hero().cam; c.dist = c.wantDist = cd; c.pitch = 6; }, shift || 14); await p.waitForTimeout(500); return E(p, ({ kinds, dist, side, shift }) => {
    const W = window.__walk, h = W.hero(), b = h.body, C = W.combat();
    C.clearAll(); h.figure.scene.visible = false; const lili = document.querySelector('.companion, #lili'); if (lili) lili.style.display = 'none';
    h.cam.portrait = false; b.facing = (h.cam.yaw + 180) % 360;
    const cp = h.view.camera.position, L = Math.hypot(cp.x - b.x, cp.y - b.y) || 1, fx = (b.x - cp.x) / L, fy = (b.y - cp.y) / L, rx = fy, ry = -fx;
    C.spawnCamp('pose' + Math.random(), b.x, b.y, b.z, 0.1, kinds);
    const live = C.foes.filter((f) => f.hp > 0);
    live.forEach((f, i) => { const o = (i - (live.length - 1) / 2) * side; f.x = cp.x + fx * dist + rx * o; f.y = cp.y + fy * dist + ry * o; f.z = b.z; f.home = [f.x, f.y, f.z]; f.state = 'recover'; f.t = -1000; f.facing = (Math.atan2(-fx, -fy) * 180 / Math.PI + 360) % 360; if (i === live.length - 1 && kinds.length > 2) { f.elite = true; f.affixes = ['armored']; } });
  }, { kinds, dist, side, shift }); };
  await pose(['rat', 'slime', 'gargoyle'], 5, 1.5, 9);
  await p.waitForTimeout(600); await shot('foes_close');
  await pose(['rat', 'rat', 'slime', 'gargoyle', 'rat'], 9, 1.8, 16);
  await p.waitForTimeout(600); await shot('foes_group');
  await pose(['boss'], 14, 0, 26);
  await p.waitForTimeout(600); await shot('foes_boss');
  await pose(['ratking'], 14, 0, 26);
  await p.waitForTimeout(600); await shot('foes_king');
};
