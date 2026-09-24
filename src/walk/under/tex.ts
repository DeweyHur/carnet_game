// 지하철역의 겉모습: 흰 비스듬한 타일(카로 비조), 승강장 바닥, 파란 법랑 역명판, 방향·출구·환승 표지판, 광고 포스터.
import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}
function tex(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}

let tilesT: THREE.CanvasTexture | null = null;
/** 흰 타일: 가로로 긴 벽돌 모양, 가장자리가 비스듬해 빛을 받는다. 1칸 = 0.3 m × 0.15 m, 그림 한 장 = 8×16칸 */
export function tiles() {
  if (tilesT) return tilesT;
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, 256, 256);
  const w = 32, h = 16;
  for (let y = 0; y < 256; y += h) for (let x = (y / h) % 2 ? -w / 2 : 0; x < 256; x += w) {
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, '#f7f5f0'); gr.addColorStop(0.8, '#eceae3'); gr.addColorStop(1, '#cfcac0');
    g.fillStyle = gr;
    g.fillRect(x + 1.5, y + 1.5, w - 3, h - 3);
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 3, y + 3, w - 8, 2);
  }
  tilesT = tex(c, true);
  return tilesT;
}

let floorT: THREE.CanvasTexture | null = null;
export function platformFloor() {
  if (floorT) return floorT;
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#8a857c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  for (let k = 0; k <= 256; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, 256); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(256, k); g.stroke(); }
  floorT = tex(c, true);
  return floorT;
}

let ballastT: THREE.CanvasTexture | null = null;
export function ballast() {
  if (ballastT) return ballastT;
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#3a3632'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) { const k = 40 + Math.random() * 50; g.fillStyle = `rgb(${k},${k - 4},${k - 8})`; g.beginPath(); g.arc(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2.5, 0, 7); g.fill(); }
  ballastT = tex(c, true);
  return ballastT;
}

/** 파란 법랑 역명판 */
export function namePlate(name: string) {
  const [c, g] = canvas(1024, 160);
  g.fillStyle = '#1b3f8b'; g.fillRect(0, 0, 1024, 160);
  g.strokeStyle = '#f4f1e8'; g.lineWidth = 10; g.strokeRect(12, 12, 1000, 136);
  g.fillStyle = '#f4f1e8';
  let size = 88;
  g.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
  while (g.measureText(name).width > 930 && size > 40) { size -= 4; g.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(name, 512, 86);
  return tex(c);
}

/** 짙은 파랑 안내판: 노선 동그라미 + 글자 */
export function sign(lines: { badge?: { text: string; color: string; ink: string }; text: string; sub?: string; arrow?: string }) {
  const [c, g] = canvas(1024, 200);
  g.fillStyle = '#152a52'; g.fillRect(0, 0, 1024, 200);
  g.fillStyle = '#ffffff22'; g.fillRect(0, 0, 1024, 6);
  let x = 30;
  if (lines.badge) {
    g.fillStyle = lines.badge.color; g.beginPath(); g.arc(x + 70, 100, 68, 0, 7); g.fill();
    g.fillStyle = lines.badge.ink; g.font = 'bold 84px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(lines.badge.text, x + 70, 104);
    x += 170;
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffffff';
  const sub = lines.sub ?? '';
  let size = 66;
  g.font = `bold ${size}px Arial, sans-serif`;
  const maxW = 1024 - x - (lines.arrow ? 140 : 40);
  while (g.measureText(lines.text).width > maxW && size > 30) { size -= 3; g.font = `bold ${size}px Arial, sans-serif`; }
  g.fillText(lines.text, x, sub ? 100 : 124);
  if (sub) { g.fillStyle = '#c9d6ee'; g.font = '38px Arial, sans-serif'; let s2 = sub; while (g.measureText(s2).width > maxW && s2.length > 4) s2 = s2.slice(0, -2) + '…'; g.fillText(s2, x, 162); }
  if (lines.arrow) { g.fillStyle = '#ffd166'; g.font = 'bold 110px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(lines.arrow, 1024 - 80, 138); }
  return tex(c);
}

/** 광고 포스터(창작) */
export function poster(seed: number) {
  const [c, g] = canvas(300, 400);
  const pal = [['#e4572e', '#f4efe6', '#1d1a17'], ['#1d3557', '#f1faee', '#e63946'], ['#2a9d8f', '#e9c46a', '#264653'], ['#6a4c93', '#f2cc8f', '#ffffff'], ['#f4a261', '#264653', '#ffffff'], ['#101010', '#f2d57e', '#ffffff']][seed % 6];
  g.fillStyle = pal[0]; g.fillRect(0, 0, 300, 400);
  const r = (k: number) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? pal[1] : pal[2]; g.globalAlpha = 0.85; g.beginPath(); g.arc(r(i) * 300, r(i + 9) * 260, 20 + r(i + 3) * 90, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  const words = ['EXPOSITION', 'OPÉRA', 'CONCERT', 'MUSÉE', 'FESTIVAL', 'THÉÂTRE', 'CINÉMA', 'SALON'];
  g.fillStyle = pal[1]; g.fillRect(0, 290, 300, 110);
  g.fillStyle = pal[2]; g.font = 'bold 40px Georgia, serif'; g.textAlign = 'center';
  g.fillText(words[seed % words.length], 150, 342);
  g.font = '22px Arial, sans-serif'; g.fillText(`${1 + (seed % 28)} — ${3 + (seed % 25)} ${['OCT', 'NOV', 'DÉC', 'SEPT'][seed % 4]}`, 150, 378);
  return tex(c);
}

let tunnelT: THREE.CanvasTexture | null = null;
export function tunnelWall() {
  if (tunnelT) return tunnelT;
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#2b2926'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 900; i++) { const k = 30 + Math.random() * 30; g.fillStyle = `rgb(${k},${k - 2},${k - 4})`; g.fillRect(Math.random() * 256, Math.random() * 128, 3, 2); }
  g.fillStyle = '#151412'; for (const y of [30, 38, 44]) g.fillRect(0, y, 256, 3); // 전선 다발
  tunnelT = tex(c, true);
  return tunnelT;
}

let seatT: THREE.CanvasTexture | null = null;
/** 지하철 좌석 천(파랑 바탕에 작은 무늬) */
export function seatFabric() {
  if (seatT) return seatT;
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#2a4d8f'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 64; x += 8) { g.fillStyle = ['#e4b23a', '#3fb6a8', '#f4efe6'][(x + y) % 3]; g.fillRect(x, y, 3, 3); }
  seatT = tex(c, true);
  return seatT;
}
