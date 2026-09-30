// 기술 아이콘: 이모지 대신 캔버스에 직접 그린다.
// 원소 색의 어두운 바탕(빛 번짐 · 결) 위에, 기술의 모양(화살 · 고리 · 부채꼴 · 돌진 · 도약 · 비 · 궤도 · 사슬 · 포탑 · 덫 · 불길 · 오라 · 강화)을
// 빛나는 붓질로. 익히는 기술은 능력치 모양(칼 · 과녁 · 별 · 심장 · 방패 · 깃털 · 물방울 · 송곳니).
// 같은 모양이라도 기술 id로 방향·개수·결을 조금씩 바꿔 96개가 서로 다르게 보인다.
import { CHAR_ELEM, ELEM, type Elem } from './elements';
import type { SkillDef } from './skills';

const TAU = Math.PI * 2;
const cache = new Map<string, string>();

function elemOf(d: SkillDef): Elem {
  if (d.status === 'burn') return 'fire';
  if (d.status === 'slow') return 'ice';
  if (d.status === 'poison') return 'toxic';
  if (d.eff?.k === 'chain' || (d.eff?.k === 'rain' && d.eff.tall)) return 'bolt';
  return CHAR_ELEM[d.char] ?? 'wind';
}
const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const css = (c: number[], a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** 기술 아이콘(data URL, 정사각) */
export function skillIcon(d: SkillDef, size = 128): string {
  const key = `${d.id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const S = size / 100; // 100 단위로 그린다
  g.scale(S, S);
  let seed = hash(d.id);
  const r = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const col = rgb(ELEM[elemOf(d)].color), deep = mix(col, [8, 6, 16], 0.82), mid = mix(col, [20, 16, 30], 0.45), hi = mix(col, [255, 255, 255], 0.55);

  // ── 바탕: 깊은 원소 색 · 가운데 빛 · 붓 결 · 가장자리 어둠
  const bg = g.createRadialGradient(50, 44, 4, 50, 50, 72);
  bg.addColorStop(0, css(mid)); bg.addColorStop(0.55, css(deep)); bg.addColorStop(1, 'rgb(6,5,10)');
  g.fillStyle = bg; g.fillRect(0, 0, 100, 100);
  g.globalAlpha = 0.12;
  for (let i = 0; i < 26; i++) { g.strokeStyle = css(i % 2 ? hi : [0, 0, 0]); g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); const y = r() * 100; g.moveTo(-5, y); g.bezierCurveTo(30, y + (r() - 0.5) * 30, 70, y + (r() - 0.5) * 30, 105, y + (r() - 0.5) * 20); g.stroke(); }
  g.globalAlpha = 1;
  // 반짝이 가루
  for (let i = 0; i < 14; i++) { g.fillStyle = css(hi, 0.2 + r() * 0.5); g.beginPath(); g.arc(r() * 100, r() * 100, 0.4 + r() * 1.1, 0, TAU); g.fill(); }

  // ── 빛나는 붓: 바깥 번짐(원소 색) → 안쪽 흰 심
  const glow = (draw: () => void, w: number, fill = false) => {
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = css(col); g.shadowBlur = 10;
    g.strokeStyle = css(col, 0.9); g.fillStyle = css(col, 0.9); g.lineWidth = w * 1.9; draw(); if (fill) g.fill(); else g.stroke();
    g.shadowBlur = 4; g.strokeStyle = css(hi); g.fillStyle = css(hi); g.lineWidth = w; draw(); if (fill) g.fill(); else g.stroke();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.fillStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = w * 0.4; draw(); if (fill) g.fill(); else g.stroke();
    g.restore();
  };
  const path = (pts: [number, number][], close = false) => () => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); };
  const circle = (x: number, y: number, rr: number) => () => { g.beginPath(); g.arc(x, y, rr, 0, TAU); };
  const arc = (x: number, y: number, rr: number, a0: number, a1: number) => () => { g.beginPath(); g.arc(x, y, rr, a0, a1); };
  const spin = (a: number) => { g.translate(50, 50); g.rotate(a); g.translate(-50, -50); };
  const orb = (x: number, y: number, rr: number) => {
    const o = g.createRadialGradient(x - rr * 0.3, y - rr * 0.3, 0, x, y, rr * 2.2);
    o.addColorStop(0, '#fff'); o.addColorStop(0.3, css(hi)); o.addColorStop(0.6, css(col, 0.6)); o.addColorStop(1, css(col, 0));
    g.fillStyle = o; g.beginPath(); g.arc(x, y, rr * 2.2, 0, TAU); g.fill();
  };
  const blade = (x: number, y: number, len: number, a: number, w = 5) => { // 칼날 하나(끝이 뾰족)
    g.save(); g.translate(x, y); g.rotate(a);
    glow(path([[0, -w / 2], [len * 0.8, -w / 2.4], [len, 0], [len * 0.8, w / 2.4], [0, w / 2]], true), 1.2, true);
    g.restore();
  };

  g.save();
  const e = d.eff;
  const v = r();
  if (!e) {
    // 익히는 기술: 능력치 모양
    const k = Object.keys(d.passive ?? d.buff ?? { atk: 1 })[0];
    if (k === 'atk') { spin(-0.8 + v * 0.3); blade(22, 50, 58, 0, 9); glow(path([[30, 38], [30, 62]]), 3); glow(path([[16, 50], [30, 50]]), 4); }
    else if (k === 'crit') { glow(circle(50, 50, 26), 2.5); glow(circle(50, 50, 13), 2.2); for (let i = 0; i < 4; i++) { const a = (i * TAU) / 4 + v; glow(path([[50 + Math.cos(a) * 30, 50 + Math.sin(a) * 30], [50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40]]), 3); } orb(50, 50, 4); }
    else if (k === 'critDmg') { const n = 8; const pts: [number, number][] = []; for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU - Math.PI / 2, rr = i % 2 ? 13 : 36; pts.push([50 + Math.cos(a) * rr, 50 + Math.sin(a) * rr]); } glow(path(pts, true), 2.4); orb(50, 50, 6); }
    else if (k === 'hp') { glow(() => { g.beginPath(); g.moveTo(50, 78); g.bezierCurveTo(12, 52, 22, 20, 50, 36); g.bezierCurveTo(78, 20, 88, 52, 50, 78); }, 3); glow(path([[34, 50], [42, 50], [47, 40], [53, 60], [58, 50], [66, 50]]), 2); }
    else if (k === 'def') { glow(() => { g.beginPath(); g.moveTo(50, 16); g.quadraticCurveTo(66, 24, 80, 22); g.quadraticCurveTo(80, 64, 50, 84); g.quadraticCurveTo(20, 64, 20, 22); g.quadraticCurveTo(34, 24, 50, 16); }, 3); glow(path([[50, 26], [50, 72]]), 2); glow(path([[30, 40], [70, 40]]), 2); }
    else if (k === 'aspd') { for (let i = 0; i < 3; i++) glow(path([[18 + i * 6, 30 + i * 18], [62 + i * 6, 30 + i * 18]]), 2.4 - i * 0.4); glow(() => { g.beginPath(); g.moveTo(84, 24); g.quadraticCurveTo(58, 34, 44, 76); g.quadraticCurveTo(78, 60, 84, 24); }, 2); }
    else if (k === 'regen' || k === 'heal') { glow(() => { g.beginPath(); g.moveTo(50, 16); g.bezierCurveTo(70, 42, 76, 54, 76, 62); g.arc(50, 62, 26, 0, Math.PI); g.bezierCurveTo(24, 54, 30, 42, 50, 16); }, 3); glow(path([[50, 50], [50, 74]]), 3); glow(path([[38, 62], [62, 62]]), 3); }
    else if (k === 'steal') { glow(() => { g.beginPath(); g.moveTo(26, 22); g.quadraticCurveTo(40, 50, 36, 78); g.quadraticCurveTo(30, 50, 26, 22); }, 2, true); glow(() => { g.beginPath(); g.moveTo(74, 22); g.quadraticCurveTo(60, 50, 64, 78); g.quadraticCurveTo(70, 50, 74, 22); }, 2, true); orb(50, 72, 5); }
    else { orb(50, 50, 12); }
  } else switch (e.k) {
    case 'bolt': { // 꼬리를 끄는 탄(여럿이면 부채꼴)
      const n = Math.min(3, e.n ?? 1), a0 = -0.7 + v * 0.3;
      for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * 0.35; const x = 50 + Math.cos(a) * 22, y = 50 + Math.sin(a) * 22; const tx = x - Math.cos(a) * 46, ty = y - Math.sin(a) * 46; g.save(); const lg = g.createLinearGradient(tx, ty, x, y); lg.addColorStop(0, css(col, 0)); lg.addColorStop(1, css(hi, 0.95)); g.strokeStyle = lg; g.lineCap = 'round'; g.lineWidth = n > 1 ? 7 : 12; g.beginPath(); g.moveTo(tx, ty); g.lineTo(x, y); g.stroke(); g.restore(); orb(x, y, n > 1 ? 6 : 10); }
      if (e.boom) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; glow(path([[72 + Math.cos(a) * 8, 28 + Math.sin(a) * 8], [72 + Math.cos(a) * 16, 28 + Math.sin(a) * 16]]), 1.2); }
      break;
    }
    case 'nova': { // 퍼지는 고리 + 빛살
      orb(50, 50, 9);
      glow(circle(50, 50, 22), 2.6); glow(arc(50, 50, 36, v * TAU, v * TAU + 4.4), 1.6);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + v; glow(path([[50 + Math.cos(a) * 26, 50 + Math.sin(a) * 26], [50 + Math.cos(a) * (32 + (i % 2) * 8), 50 + Math.sin(a) * (32 + (i % 2) * 8)]]), 1.4); }
      break;
    }
    case 'cone': { // 베는 초승달 궤적(여러 번)
      const n = Math.min(3, e.hits ?? 1);
      spin(-0.3 + v * 0.6);
      for (let i = 0; i < n; i++) { const rr = 34 - i * 9; glow(() => { g.beginPath(); g.arc(34, 62, rr, -1.45, 0.25); g.arc(30, 66, rr - 7, 0.25, -1.45, true); g.closePath(); }, 1.2, true); }
      blade(22, 78, 30, -0.9, 4);
      break;
    }
    case 'line': { // 속도선 + 앞으로 찌르는 화살촉
      spin(-0.6 + v * 0.3);
      for (let i = 0; i < 5; i++) { const y = 30 + i * 10, x0 = 10 + Math.abs(i - 2) * 9; glow(path([[x0, y], [x0 + 38 - Math.abs(i - 2) * 6, y]]), 1.2 + (i === 2 ? 1.2 : 0)); }
      glow(path([[56, 30], [86, 50], [56, 70], [64, 50]], true), 1.6, true);
      break;
    }
    case 'leap': { // 위에서 내리꽂는 화살표 + 땅의 금
      glow(path([[50, 12], [50, 56]]), 4); glow(path([[36, 42], [50, 60], [64, 42]]), 3.2);
      g.save(); g.globalAlpha = 0.9; glow(() => { g.beginPath(); g.ellipse(50, 74, 34, 9, 0, 0, TAU); }, 1.6); g.restore();
      for (const [x1, y1, x2, y2] of [[50, 74, 30, 88], [50, 74, 72, 90], [50, 74, 84, 72], [50, 74, 16, 70]]) glow(path([[x1, y1], [(x1 + x2) / 2 + (r() - 0.5) * 8, (y1 + y2) / 2], [x2, y2]]), 1);
      break;
    }
    case 'rain': { // 비스듬히 떨어지는 유성들
      const n = 5;
      for (let i = 0; i < n; i++) { const x = 18 + i * 16 + r() * 6, y = 34 + ((i * 37) % 40), L = 18 + r() * 16; g.save(); const lg = g.createLinearGradient(x - L * 0.6, y - L, x, y); lg.addColorStop(0, css(col, 0)); lg.addColorStop(1, css(hi)); g.strokeStyle = lg; g.lineWidth = 3.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x - L * 0.6, y - L); g.lineTo(x, y); g.stroke(); g.restore(); orb(x, y, 3.2); }
      if (e.tall) glow(path([[52, 8], [42, 34], [56, 38], [44, 66]]), 2.2);
      glow(() => { g.beginPath(); g.ellipse(50, 86, 38, 6, 0, 0, TAU); }, 1);
      break;
    }
    case 'orbit': { // 가운데 몸 둘레를 도는 칼날
      glow(() => { g.beginPath(); g.ellipse(50, 52, 32, 32, 0, 0, TAU); }, 0.8);
      const n = Math.min(6, e.n);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + v; blade(50 + Math.cos(a) * 32 - Math.cos(a + Math.PI / 2) * 8, 52 + Math.sin(a) * 32 - Math.sin(a + Math.PI / 2) * 8, 18, a + Math.PI / 2, 5); }
      orb(50, 52, 6);
      break;
    }
    case 'chain': { // 점에서 점으로 튀는 번개
      const pts: [number, number][] = [[16, 70], [40, 30], [62, 66], [86, 26]];
      for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; const zz: [number, number][] = [[x1, y1]]; for (let k = 1; k < 5; k++) zz.push([x1 + ((x2 - x1) * k) / 5 + (r() - 0.5) * 9, y1 + ((y2 - y1) * k) / 5 + (r() - 0.5) * 9]); zz.push([x2, y2]); glow(path(zz), 1.8); }
      for (const [x, y] of pts) orb(x, y, 4.2);
      break;
    }
    case 'turret': { // 받침 위의 포탑 + 쏘는 빛줄기
      glow(path([[28, 84], [72, 84], [64, 64], [36, 64]], true), 1.4);
      glow(circle(50, 52, 14), 2);
      glow(path([[56, 46], [80, 30]]), 3.6);
      orb(86, 24, 4);
      glow(path([[84, 16], [92, 10]]), 1); glow(path([[88, 28], [96, 30]]), 1);
      break;
    }
    case 'trap': { // 이빨 달린 덫 고리
      glow(() => { g.beginPath(); g.ellipse(50, 62, 34, 16, 0, 0, TAU); }, 2);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; const x = 50 + Math.cos(a) * 34, y = 62 + Math.sin(a) * 16; glow(path([[x - 3, y], [x, y - 12], [x + 3, y]], true), 0.8, true); }
      orb(50, 60, 6);
      glow(path([[50, 20], [50, 42]]), 1.6); glow(path([[44, 26], [50, 18], [56, 26]]), 1.6);
      break;
    }
    case 'zone': { // 땅에서 솟는 불길(웅덩이)
      glow(() => { g.beginPath(); g.ellipse(50, 78, 38, 10, 0, 0, TAU); }, 1.4);
      for (let i = 0; i < 5; i++) { const x = 22 + i * 14, h = 26 + ((i * 13 + v * 30) % 22); glow(() => { g.beginPath(); g.moveTo(x - 7, 78); g.quadraticCurveTo(x - 9, 78 - h * 0.5, x, 78 - h); g.quadraticCurveTo(x + 9, 78 - h * 0.5, x + 7, 78); g.closePath(); }, 1, true); }
      break;
    }
    case 'aura': { // 사람 모양 둘레의 빛 고리 + 불티
      glow(circle(50, 34, 7.5), 1, true); glow(() => { g.beginPath(); g.moveTo(40, 46); g.quadraticCurveTo(50, 42, 60, 46); g.lineTo(64, 64); g.lineTo(58, 64); g.lineTo(60, 84); g.lineTo(40, 84); g.lineTo(42, 64); g.lineTo(36, 64); g.closePath(); }, 1, true);
      glow(arc(50, 56, 36, 0, TAU), 1.2); glow(arc(50, 56, 28, 0.4 + v, 2.2 + v), 1);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + v; orb(50 + Math.cos(a) * 36, 56 + Math.sin(a) * 36, 2); }
      break;
    }
    case 'buff': { // 위로 솟는 화살표 · 방패 · 빛
      const k = Object.keys(d.buff ?? { atk: 1 })[0];
      if (k === 'def') glow(() => { g.beginPath(); g.moveTo(50, 14); g.quadraticCurveTo(68, 22, 82, 20); g.quadraticCurveTo(82, 64, 50, 86); g.quadraticCurveTo(18, 64, 18, 20); g.quadraticCurveTo(32, 22, 50, 14); }, 3);
      else { glow(path([[50, 84], [50, 26]]), 4.4); glow(path([[30, 44], [50, 20], [70, 44]]), 4); glow(path([[22, 70], [22, 50]]), 2); glow(path([[78, 72], [78, 54]]), 2); }
      orb(50, 50, 6);
      break;
    }
  }
  g.restore();
  // ── 테두리 안쪽 어둠 + 얇은 금빛 테
  const vg = g.createRadialGradient(50, 50, 36, 50, 50, 72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg; g.fillRect(0, 0, 100, 100);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** <i> 안에 넣는 그림 태그 */
export const iconImg = (d: SkillDef, size = 128, cls = 'skic') => `<img class="${cls}" src="${skillIcon(d, size)}" alt="" draggable="false">`;
