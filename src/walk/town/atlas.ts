// 파리 거리의 겉모습을 그림 파일 없이 캔버스로 그린다. 한 칸(128px)이 창 한 칸(약 2.8 m) × 한 층이다.
// 알파 0.75 = 유리(밤에 불이 켜질 수 있는 창), 알파 0 = 뚫린 곳(난간 사이).
import * as THREE from 'three';

export const ATLAS_N = 8; // 8×8칸
const PX = 128;

/** 칸 번호. 셰이더는 번호로 칸을 찾는다. */
export const T = {
  // 윗층(길 쪽)
  haussmann: 0, haussmannB: 1, ochre: 2, plaster: 3, pink: 4, yellow: 5, brick: 6, modern: 7,
  // 윗층(안뜰·민벽)
  blankStone: 8, blankPlaster: 9, blankBrick: 10, yardStone: 11, yardPlaster: 12, graffiti: 13, grand: 14, grey: 15,
  // 1층 가게
  shopGreen: 16, shopRed: 17, shopNavy: 18, shopBlack: 19, cafe: 20, boulangerie: 21, porte: 22, rustic: 23,
  shutter: 24, shopCream: 25, pharmacie: 26, bistrot: 27, gallery: 28, librairie: 29, grandDoor: 30, lobby: 31,
  // 지붕·장식
  mansard: 32, mansardPlain: 33, zinc: 34, gravel: 35, terracotta: 36, railing: 37, cornice: 38, paves: 39,
  asphalt: 40, sidewalk: 41, ghostSign: 42, brickShop: 43, marche: 44, epicerie: 45, fleuriste: 46, fromagerie: 47,
  // 개성 있는 윗층
  vosges: 48, artNouveau: 49, plasterBlue: 50, ochreRed: 51, slate: 52, cream: 53, mint: 54, lilac: 55,
} as const;
const UPPER_EXTRA = new Set<number>([48, 49, 50, 51, 53, 54, 55]);

// 결정적인 난수(칸마다 같은 그림)
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

type Ctx = CanvasRenderingContext2D;

function speckle(g: Ctx, x: number, y: number, w: number, h: number, seed: number, amt = 0.07) {
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 14; i++) {
    const v = r() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${r() * amt})`;
    g.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2);
  }
}

/** 돌 줄눈(가로줄 + 엇갈린 세로줄) */
function stone(g: Ctx, x: number, y: number, w: number, h: number, base: string, joint: string, rowH: number, seed: number) {
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  const r = rng(seed);
  // 돌마다 살짝 다른 밝기
  for (let yy = 0, row = 0; yy < h; yy += rowH, row++) {
    const bw = rowH * 2.6;
    for (let xx = (row % 2) * -bw / 2; xx < w; xx += bw) {
      g.fillStyle = `rgba(${r() < 0.5 ? '255,250,240' : '60,50,40'},${r() * 0.06})`;
      g.fillRect(x + xx, y + yy, bw, rowH);
    }
  }
  g.strokeStyle = joint;
  g.lineWidth = 1;
  for (let yy = 0, row = 0; yy <= h; yy += rowH, row++) {
    g.beginPath(); g.moveTo(x, y + yy + 0.5); g.lineTo(x + w, y + yy + 0.5); g.stroke();
    const bw = rowH * 2.6;
    for (let xx = (row % 2) * bw / 2; xx < w; xx += bw) { g.beginPath(); g.moveTo(x + xx + 0.5, y + yy); g.lineTo(x + xx + 0.5, y + Math.min(h, yy + rowH)); g.stroke(); }
  }
  speckle(g, x, y, w, h, seed + 7);
}

function plaster(g: Ctx, x: number, y: number, w: number, h: number, base: string, seed: number) {
  g.fillStyle = base;
  g.fillRect(x, y, w, h);
  const r = rng(seed);
  for (let i = 0; i < 26; i++) {
    const cx = x + r() * w, cy = y + r() * h, rr = 8 + r() * 30;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    const d = r() < 0.5;
    gr.addColorStop(0, d ? 'rgba(80,60,40,0.07)' : 'rgba(255,255,245,0.08)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  speckle(g, x, y, w, h, seed + 3, 0.05);
}

function brick(g: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  g.fillStyle = '#9c5a43';
  g.fillRect(x, y, w, h);
  const r = rng(seed);
  const bh = 5, bw = 13;
  for (let yy = 0, row = 0; yy < h; yy += bh, row++) {
    for (let xx = row % 2 ? -bw / 2 : 0; xx < w; xx += bw) {
      const k = 0.8 + r() * 0.35;
      g.fillStyle = `rgb(${Math.round(160 * k)},${Math.round(88 * k)},${Math.round(64 * k)})`;
      g.fillRect(x + xx + 0.5, y + yy + 0.5, bw - 1, bh - 1);
    }
  }
}

/** 유리(알파 0.75 — 밤에 불이 켜지는 자리) */
function glass(g: Ctx, x: number, y: number, w: number, h: number, tint = '#5d7288') {
  g.save();
  g.globalCompositeOperation = 'copy';
  const gr = g.createLinearGradient(x, y, x + w, y + h);
  gr.addColorStop(0, tint);
  gr.addColorStop(0.55, '#2e3b49');
  gr.addColorStop(1, '#46586b');
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = gr;
  g.globalAlpha = 0.75;
  g.fillRect(x, y, w, h);
  g.restore();
  // 비친 하늘 한 줄기
  g.fillStyle = 'rgba(255,255,255,0.13)';
  g.beginPath(); g.moveTo(x, y + h * 0.35); g.lineTo(x + w * 0.45, y); g.lineTo(x + w * 0.7, y); g.lineTo(x, y + h * 0.7); g.fill();
}

/** 프랑스식 창: 유리 + 창살 + 둘레 */
function frenchWindow(g: Ctx, x: number, y: number, w: number, h: number, frame: string, surround?: string) {
  if (surround) { g.fillStyle = surround; g.fillRect(x - 5, y - 7, w + 10, h + 9); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x - 5, y + h, w + 10, 2); }
  glass(g, x, y, w, h);
  g.fillStyle = frame;
  g.fillRect(x, y, w, 3); g.fillRect(x, y + h - 3, w, 3); g.fillRect(x, y, 3, h); g.fillRect(x + w - 3, y, 3, h);
  g.fillRect(x + w / 2 - 1.5, y, 3, h);
  for (let k = 1; k < 3; k++) g.fillRect(x, y + (h * k) / 3 - 1, w, 2);
}

function shutters(g: Ctx, x: number, y: number, w: number, h: number, color: string) {
  const sw = w * 0.5;
  for (const sx of [x - sw - 2, x + w + 2]) {
    g.fillStyle = color;
    g.fillRect(sx, y, sw, h);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let yy = y + 3; yy < y + h - 2; yy += 4) g.fillRect(sx + 2, yy, sw - 4, 1.5);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(sx, y, 2, h);
  }
}

/** 창 아래 작은 쇠 난간 */
function guard(g: Ctx, x: number, y: number, w: number) {
  g.strokeStyle = '#1f2224';
  g.lineWidth = 1.5;
  g.strokeRect(x, y, w, 12);
  for (let xx = x + 3; xx < x + w; xx += 5) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + 12); g.stroke(); }
  g.beginPath(); g.arc(x + w / 2, y + 6, 4, 0, Math.PI * 2); g.stroke();
}

function upper(g: Ctx, x: number, y: number, kind: number) {
  const W = PX, H = PX;
  const win = (fr: string, sur?: string, ww = 52, wh = 84) => { frenchWindow(g, x + (W - ww) / 2, y + 22, ww, wh, fr, sur); };
  switch (kind) {
    case T.haussmann: stone(g, x, y, W, H, '#e6dac1', 'rgba(120,100,70,0.35)', 16, 11); win('#f3eee2', '#efe6d2'); guard(g, x + 36, y + 90, 56); break;
    case T.haussmannB: stone(g, x, y, W, H, '#ddcfb3', 'rgba(120,100,70,0.35)', 16, 12); win('#f3eee2', '#e8dcc3'); g.fillStyle = '#d2c3a4'; g.fillRect(x + 30, y + 10, 68, 6); guard(g, x + 36, y + 90, 56); break;
    case T.grand: stone(g, x, y, W, H, '#ece3cf', 'rgba(120,100,70,0.3)', 16, 13); win('#faf6ec', '#f3ead8', 54, 86);
      g.fillStyle = '#e3d6bc'; g.fillRect(x + 4, y, 12, H); g.fillRect(x + W - 16, y, 12, H); // 벽기둥
      g.fillStyle = '#d6c7a8'; g.beginPath(); g.moveTo(x + 32, y + 14); g.quadraticCurveTo(x + 64, y + 2, x + 96, y + 14); g.fill(); guard(g, x + 36, y + 92, 56); break;
    case T.grey: stone(g, x, y, W, H, '#cfc9bd', 'rgba(90,85,75,0.35)', 16, 14); win('#efece6', '#ddd6c9'); guard(g, x + 36, y + 90, 56); break;
    case T.ochre: plaster(g, x, y, W, H, '#dcb982', 15); win('#f4efe3', undefined, 44, 74); shutters(g, x + 42, y + 22, 44, 74, '#8fa3ad'); break;
    case T.plaster: plaster(g, x, y, W, H, '#e9dfcb', 16); win('#f4efe3', undefined, 44, 74); shutters(g, x + 42, y + 22, 44, 74, '#6f8b6a'); break;
    case T.pink: plaster(g, x, y, W, H, '#e9b8a6', 17); win('#fbf7f0', '#f5e9dc', 44, 70); shutters(g, x + 42, y + 24, 44, 70, '#f3efe6'); break;
    case T.yellow: plaster(g, x, y, W, H, '#ecd28c', 18); win('#fbf7f0', '#f5ead0', 44, 70); shutters(g, x + 42, y + 24, 44, 70, '#5f86a8'); break;
    case T.brick: brick(g, x, y, W, H, 19); g.fillStyle = '#efe8da'; g.fillRect(x + 34, y + 16, 60, 8); frenchWindow(g, x + 38, y + 24, 52, 78, '#f5f1e8'); break;
    case T.modern: g.fillStyle = '#d9d6cf'; g.fillRect(x, y, W, H); speckle(g, x, y, W, H, 20); glass(g, x + 10, y + 16, W - 20, 92, '#7d93a8'); g.fillStyle = '#9aa0a4'; g.fillRect(x + 10, y + 60, W - 20, 3); g.fillRect(x + W / 2 - 1, y + 16, 3, 92); g.fillStyle = '#b7b3aa'; g.fillRect(x, y + 108, W, 6); break;
    case T.blankStone: stone(g, x, y, W, H, '#ddd0b6', 'rgba(120,100,70,0.3)', 16, 21); break;
    case T.blankPlaster: plaster(g, x, y, W, H, '#dcd2bd', 22); break;
    case T.blankBrick: brick(g, x, y, W, H, 23); break;
    case T.yardStone: stone(g, x, y, W, H, '#d9ccb0', 'rgba(120,100,70,0.3)', 16, 24); frenchWindow(g, x + 42, y + 30, 44, 70, '#ece6d8'); break;
    case T.yardPlaster: plaster(g, x, y, W, H, '#e2d7c2', 25); frenchWindow(g, x + 42, y + 30, 44, 70, '#ece6d8'); break;
    case T.graffiti: {
      plaster(g, x, y, W, H, '#cfc6b6', 26);
      const r = rng(27);
      const cols = ['#e4572e', '#2d6cdf', '#f2c14e', '#3a9d5d', '#b04ad6', '#16a3a3'];
      for (let i = 0; i < 7; i++) { g.fillStyle = cols[i % cols.length]; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(x + r() * W, y + r() * H, 12 + r() * 28, 8 + r() * 20, r() * 3, 0, Math.PI * 2); g.fill(); }
      g.globalAlpha = 1; g.strokeStyle = '#1d1a17'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 10, y + 70); g.bezierCurveTo(x + 40, y + 20, x + 80, y + 110, x + 118, y + 50); g.stroke();
      g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText('PARIS', x + 22, y + 104);
      break;
    }
    case T.vosges: {
      // 보주 광장: 붉은 벽돌에 흰 돌 창틀과 모서리
      brick(g, x, y, W, H, 60);
      g.fillStyle = '#efe6d3'; g.fillRect(x + 34, y + 12, 60, 96); g.fillRect(x, y, 10, H); g.fillRect(x + W - 10, y, 10, H);
      for (let k = 0; k < H; k += 16) { g.fillStyle = '#e2d7c2'; g.fillRect(x, y + k, 16, 8); g.fillRect(x + W - 16, y + k + 8, 16, 8); }
      frenchWindow(g, x + 40, y + 18, 48, 84, '#f5f1e8');
      break;
    }
    case T.artNouveau: {
      plaster(g, x, y, W, H, '#ece2cc', 61);
      // 둥근 창 + 초록 곡선 쇠장식
      g.fillStyle = '#e0d2b4'; g.beginPath(); g.moveTo(x + 30, y + 110); g.lineTo(x + 30, y + 40); g.quadraticCurveTo(x + 64, y + 2, x + 98, y + 40); g.lineTo(x + 98, y + 110); g.fill();
      glass(g, x + 38, y + 30, 52, 76);
      g.fillStyle = '#f5efe2'; g.fillRect(x + 62, y + 30, 3, 76);
      g.strokeStyle = '#2f6b4f'; g.lineWidth = 3;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 34, y + 104); g.bezierCurveTo(x + 44 + k * 14, y + 86, x + 50 + k * 14, y + 120, x + 64 + k * 10, y + 100); g.stroke(); }
      g.beginPath(); g.moveTo(x + 34, y + 96); g.lineTo(x + 94, y + 96); g.stroke();
      break;
    }
    case T.plasterBlue: plaster(g, x, y, W, H, '#efe7d6', 62); frenchWindow(g, x + 42, y + 22, 44, 74, '#f4efe3'); shutters(g, x + 42, y + 22, 44, 74, '#4f79a8'); break;
    case T.ochreRed: plaster(g, x, y, W, H, '#e2b477', 63); frenchWindow(g, x + 42, y + 22, 44, 74, '#f4efe3'); shutters(g, x + 42, y + 22, 44, 74, '#a6342b'); break;
    case T.cream: stone(g, x, y, W, H, '#f1e6cc', 'rgba(130,110,80,0.28)', 16, 64); frenchWindow(g, x + 38, y + 22, 52, 84, '#fbf8f1', '#f7eedc'); guard(g, x + 36, y + 90, 56); break;
    case T.mint: plaster(g, x, y, W, H, '#cfe0cf', 65); frenchWindow(g, x + 42, y + 24, 44, 70, '#fbf7f0', '#e8f0e4'); shutters(g, x + 42, y + 24, 44, 70, '#f3efe6'); break;
    case T.lilac: plaster(g, x, y, W, H, '#dcd0e2', 66); frenchWindow(g, x + 42, y + 24, 44, 70, '#fbf7f0', '#ece4f0'); shutters(g, x + 42, y + 24, 44, 70, '#5f6f86'); break;
    case T.ghostSign: {
      brick(g, x, y, W, H, 28);
      g.fillStyle = 'rgba(240,226,190,0.55)'; g.fillRect(x + 6, y + 30, W - 12, 56);
      g.fillStyle = 'rgba(140,40,30,0.6)'; g.font = 'bold 20px serif'; g.fillText('DUBONNET', x + 12, y + 66);
      break;
    }
  }
}

/** 1층(가게 칸). 칸 하나가 2.8 m × 4 m라서 세로로 늘어나 보인다 — 그만큼 눌러서 그린다. */
function shop(g: Ctx, x: number, y: number, kind: number) {
  const W = PX, H = PX;
  const shopFront = (frame: string, sign: string | null, signColor = '#f2d57e', glassTint = '#6f879a') => {
    g.fillStyle = frame; g.fillRect(x, y, W, H);
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, y, W, 3);
    if (sign) { g.fillStyle = signColor; g.font = 'bold 15px Georgia, serif'; g.textAlign = 'center'; g.fillText(sign, x + W / 2, y + 22); g.textAlign = 'left'; }
    glass(g, x + 8, y + 32, 70, 82, glassTint);
    g.fillStyle = frame; g.fillRect(x + 8 + 34, y + 32, 3, 82);
    // 문
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 86, y + 30, 36, 98);
    glass(g, x + 90, y + 36, 28, 60, glassTint);
    g.fillStyle = '#c9a14a'; g.fillRect(x + 113, y + 78, 3, 10);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 8, y + 114, 70, 14); // 창 아래 벽
  };
  switch (kind) {
    case T.shopGreen: shopFront('#1f4a3a', null); break;
    case T.shopRed: shopFront('#6e1f24', null); break;
    case T.shopNavy: shopFront('#1d2f52', null); break;
    case T.shopBlack: shopFront('#1d1c1b', null); break;
    case T.shopCream: shopFront('#e4d9bf', null); break;
    case T.cafe: shopFront('#8e1b1b', 'CAFÉ', '#f6e7b9', '#8a6d52'); break;
    case T.boulangerie: shopFront('#223a6b', 'BOULANGERIE', '#e7c35a', '#9c7a52'); break;
    case T.bistrot: shopFront('#4a2e1b', 'BISTROT', '#e8c46a', '#8a6d52'); break;
    case T.pharmacie: shopFront('#f1f0ea', 'PHARMACIE', '#1d8a4e'); g.fillStyle = '#20b35c'; g.fillRect(x + 50, y + 44, 12, 34); g.fillRect(x + 39, y + 55, 34, 12); break;
    case T.gallery: shopFront('#f4f2ee', 'GALERIE', '#333'); break;
    case T.librairie: shopFront('#5a3b22', 'LIBRAIRIE', '#f0dca0', '#8d7658'); break;
    case T.fromagerie: shopFront('#e6d9a8', 'FROMAGERIE', '#5a3b22', '#b09560'); break;
    case T.epicerie: shopFront('#2d5a2a', 'ÉPICERIE', '#f3e2a4', '#8e8a52'); break;
    case T.fleuriste: shopFront('#3f6d4a', 'FLEURS', '#f6d8e2', '#76906a');
      for (let i = 0; i < 14; i++) { g.fillStyle = ['#e0436c', '#f2c14e', '#b04ad6', '#f07f3c', '#fff'][i % 5]; g.beginPath(); g.arc(x + 12 + (i % 7) * 10, y + 104 + Math.floor(i / 7) * 10, 5, 0, 7); g.fill(); }
      break;
    case T.marche: shopFront('#355c7d', 'PRIMEUR', '#f5e6c4', '#7a8a6a');
      for (let i = 0; i < 12; i++) { g.fillStyle = ['#e63a3a', '#f29a2e', '#8cc152', '#f2d24e'][i % 4]; g.beginPath(); g.arc(x + 14 + (i % 6) * 11, y + 110 + Math.floor(i / 6) * 9, 5, 0, 7); g.fill(); }
      break;
    case T.brickShop: brick(g, x, y, W, H, 31); glass(g, x + 12, y + 30, 104, 84); g.fillStyle = '#2b2b2b'; g.fillRect(x + 62, y + 30, 3, 84); break;
    case T.lobby: g.fillStyle = '#c8c4bc'; g.fillRect(x, y, W, H); glass(g, x + 4, y + 10, W - 8, H - 12, '#89a0b4'); g.fillStyle = '#8f949a'; for (let k = 1; k < 4; k++) g.fillRect(x + (W * k) / 4, y + 10, 2, H - 12); break;
    case T.porte: {
      stone(g, x, y, W, H, '#dccfb4', 'rgba(110,90,60,0.4)', 14, 32);
      g.fillStyle = '#26473c'; g.beginPath(); g.moveTo(x + 22, y + H); g.lineTo(x + 22, y + 40); g.quadraticCurveTo(x + 64, y + 4, x + 106, y + 40); g.lineTo(x + 106, y + H); g.fill();
      g.strokeStyle = '#183229'; g.lineWidth = 2; g.strokeRect(x + 30, y + 50, 30, 70); g.strokeRect(x + 68, y + 50, 30, 70);
      g.fillStyle = '#c9a14a'; g.beginPath(); g.arc(x + 64, y + 86, 4, 0, 7); g.fill();
      break;
    }
    case T.grandDoor: {
      stone(g, x, y, W, H, '#e8ddc6', 'rgba(110,90,60,0.35)', 14, 33);
      g.fillStyle = '#2d2a26'; g.beginPath(); g.moveTo(x + 16, y + H); g.lineTo(x + 16, y + 34); g.quadraticCurveTo(x + 64, y - 6, x + 112, y + 34); g.lineTo(x + 112, y + H); g.fill();
      glass(g, x + 26, y + 30, 76, 40, '#8b8f86'); g.fillStyle = '#b8903c'; g.fillRect(x + 62, y + 76, 4, 52);
      break;
    }
    case T.rustic: {
      g.fillStyle = '#d7c9ad'; g.fillRect(x, y, W, H);
      g.fillStyle = 'rgba(90,70,45,0.45)'; for (let yy = 12; yy < H; yy += 16) g.fillRect(x, y + yy, W, 3); // 가로 홈(석재 1층)
      speckle(g, x, y, W, H, 34);
      frenchWindow(g, x + 42, y + 36, 44, 56, '#ece6d8');
      g.strokeStyle = '#222'; g.lineWidth = 2; for (let xx = x + 46; xx < x + 86; xx += 7) { g.beginPath(); g.moveTo(xx, y + 36); g.lineTo(xx, y + 92); g.stroke(); }
      break;
    }
    case T.shutter: {
      g.fillStyle = '#8d9398'; g.fillRect(x, y, W, H);
      g.fillStyle = 'rgba(0,0,0,0.2)'; for (let yy = 4; yy < H; yy += 5) g.fillRect(x, y + yy, W, 1.5);
      const r = rng(35);
      const cols = ['#e4572e', '#f2c14e', '#2d6cdf', '#3a9d5d', '#e0669c', '#111'];
      g.lineWidth = 7; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) { g.strokeStyle = cols[i]; g.beginPath(); g.moveTo(x + 10 + r() * 30, y + 40 + r() * 60); g.bezierCurveTo(x + r() * W, y + r() * H, x + r() * W, y + r() * H, x + 80 + r() * 40, y + 30 + r() * 80); g.stroke(); }
      g.fillStyle = '#1d1a17'; g.fillRect(x, y, W, 12);
      break;
    }
  }
}

function roofs(g: Ctx, x: number, y: number, kind: number) {
  const W = PX, H = PX;
  switch (kind) {
    case T.mansard: case T.mansardPlain: {
      g.fillStyle = '#7d8b96'; g.fillRect(x, y, W, H);
      g.fillStyle = 'rgba(40,55,70,0.35)'; for (let xx = 0; xx < W; xx += 9) g.fillRect(x + xx, y, 2, H); // 함석 이음매
      g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x, y, W, H / 3);
      if (kind === T.mansard) {
        // 지붕창(뤼카른): 돌 테두리 + 작은 박공
        g.fillStyle = '#e6dac1'; g.fillRect(x + 36, y + 30, 56, 86);
        g.beginPath(); g.moveTo(x + 30, y + 34); g.lineTo(x + 64, y + 8); g.lineTo(x + 98, y + 34); g.fill();
        frenchWindow(g, x + 44, y + 40, 40, 64, '#f3eee2');
      }
      break;
    }
    case T.slate: {
      g.fillStyle = '#4c5763'; g.fillRect(x, y, W, H);
      for (let yy = 0; yy < H; yy += 8) for (let xx = (yy / 8) % 2 ? -6 : 0; xx < W; xx += 12) { g.fillStyle = `rgba(${yy % 16 ? '255,255,255' : '0,0,0'},0.06)`; g.fillRect(x + xx, y + yy, 11, 7); }
      break;
    }
    case T.zinc: g.fillStyle = '#8e99a3'; g.fillRect(x, y, W, H); g.fillStyle = 'rgba(40,55,70,0.3)'; for (let xx = 0; xx < W; xx += 10) g.fillRect(x + xx, y, 2, H); speckle(g, x, y, W, H, 40); break;
    case T.gravel: g.fillStyle = '#9c968c'; g.fillRect(x, y, W, H); speckle(g, x, y, W, H, 41, 0.25); break;
    case T.terracotta: {
      g.fillStyle = '#b5583a'; g.fillRect(x, y, W, H);
      for (let yy = 0; yy < H; yy += 10) for (let xx = (yy / 10) % 2 ? -8 : 0; xx < W; xx += 16) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + xx, y + yy + 8, 16, 2); g.fillStyle = 'rgba(255,220,180,0.12)'; g.beginPath(); g.arc(x + xx + 8, y + yy + 4, 6, Math.PI, 0); g.fill(); }
      break;
    }
    case T.railing: {
      // 쇠 난간(발코니 필랑). 뚫린 곳은 알파 0.
      g.clearRect(x, y, W, H);
      g.strokeStyle = '#1b1d1f'; g.fillStyle = '#1b1d1f';
      g.fillRect(x, y + 6, W, 6); g.fillRect(x, y + H - 10, W, 8);
      g.lineWidth = 3;
      for (let xx = 4; xx < W; xx += 10) { g.beginPath(); g.moveTo(x + xx, y + 10); g.lineTo(x + xx, y + H - 8); g.stroke(); }
      g.lineWidth = 2.5;
      for (let xx = 0; xx < W; xx += 32) { g.beginPath(); g.ellipse(x + xx + 16, y + H / 2, 11, 22, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(x + xx + 16, y + H / 2, 5, 0, 7); g.stroke(); }
      break;
    }
    case T.cornice: {
      g.fillStyle = '#e9dfc9'; g.fillRect(x, y, W, H);
      g.fillStyle = 'rgba(80,60,40,0.3)'; g.fillRect(x, y + H * 0.7, W, 5); g.fillRect(x, y + H * 0.3, W, 3);
      g.fillStyle = 'rgba(80,60,40,0.18)'; for (let xx = 4; xx < W; xx += 16) g.fillRect(x + xx, y + H * 0.72, 8, H * 0.28); // 까치발
      speckle(g, x, y, W, H, 42);
      break;
    }
    case T.paves: {
      g.fillStyle = '#75716b'; g.fillRect(x, y, W, H);
      const r = rng(43);
      for (let yy = 0; yy < H; yy += 12) for (let xx = (yy / 12) % 2 ? -7 : 0; xx < W; xx += 14) {
        const k = 0.85 + r() * 0.3;
        g.fillStyle = `rgb(${Math.round(138 * k)},${Math.round(132 * k)},${Math.round(124 * k)})`;
        g.beginPath(); g.roundRect(x + xx + 1, y + yy + 1, 12, 10, 3); g.fill();
      }
      break;
    }
    case T.asphalt: g.fillStyle = '#5d5d5f'; g.fillRect(x, y, W, H); speckle(g, x, y, W, H, 44, 0.18); break;
    case T.sidewalk: g.fillStyle = '#b9b2a6'; g.fillRect(x, y, W, H); g.strokeStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k <= W; k += 32) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k, y + H); g.stroke(); g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + W, y + k); g.stroke(); } speckle(g, x, y, W, H, 45, 0.12); break;
  }
}

let cached: THREE.CanvasTexture | null = null;

export function facadeAtlas(): THREE.CanvasTexture {
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = PX * ATLAS_N;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  for (let i = 0; i < ATLAS_N * ATLAS_N; i++) {
    const x = (i % ATLAS_N) * PX, y = Math.floor(i / ATLAS_N) * PX;
    g.save();
    g.beginPath(); g.rect(x, y, PX, PX); g.clip();
    if (i < 16 || i === T.ghostSign || UPPER_EXTRA.has(i)) upper(g, x, y, i);
    else if (i === T.slate) roofs(g, x, y, i);
    else if (i < 32 || (i >= 43 && i < 48)) shop(g, x, y, i);
    else roofs(g, x, y, i);
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  cached = t;
  return t;
}
