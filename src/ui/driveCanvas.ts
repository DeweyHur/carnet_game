import type { DriveState } from '../game/driving';

/** A self-contained arcade road; no remote map or routing request is needed to play. */
export function drawRoad(ctx: CanvasRenderingContext2D, s: DriveState, width: number, height: number) {
  const w = width, h = height, horizon = h * .18, carY = Math.min(h * .78, h - (h < 250 ? 65 : 100));
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#bddbcf'); sky.addColorStop(.3, '#e5e7bc'); sky.addColorStop(1, '#728c69');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fcf1be'; ctx.beginPath(); ctx.arc(w * .74, h * .08, 28, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 14; i++) {
    const x = i * w / 13, bh = (24 + (i * 17 % 48)) * h / 600;
    ctx.fillStyle = i % 2 ? '#9caf9a' : '#879e90'; ctx.fillRect(x, horizon - bh, w / 18, bh);
    ctx.fillStyle = '#667f76'; ctx.beginPath(); ctx.moveTo(x - 3, horizon - bh); ctx.lineTo(x + w / 36, horizon - bh - 12); ctx.lineTo(x + w / 18 + 3, horizon - bh); ctx.fill();
  }
  const roadWidth = (y: number) => w * (.10 + .80 * (y - horizon) / (h - horizon));
  const roadX = (lane: number, y: number) => w / 2 + (lane - 1) * roadWidth(y) / 3;
  ctx.fillStyle = '#587e87'; ctx.beginPath(); ctx.moveTo(w * .45, horizon); ctx.lineTo(w * .55, horizon); ctx.lineTo(w * .95, h); ctx.lineTo(w * .05, h); ctx.fill();
  ctx.strokeStyle = '#f3e6a3'; ctx.lineWidth = 3;
  for (const sign of [-1, 1]) { ctx.beginPath(); ctx.moveTo(w / 2 + sign * w * .05, horizon); ctx.lineTo(w / 2 + sign * w * .45, h); ctx.stroke(); }
  for (let i = 0; i < 16; i++) {
    const p = ((i * 42 + s.distance * 1.9) % 670) / 670;
    const y = horizon + p * p * (h - horizon);
    ctx.strokeStyle = '#d7ddc5'; ctx.lineWidth = 1 + p * 3;
    for (const side of [-.5, .5]) { ctx.beginPath(); ctx.moveTo(roadX(1 + side, y), y); ctx.lineTo(roadX(1 + side, y + 8 + p * 25), y + 8 + p * 25); ctx.stroke(); }
    if (i % 2 === 0) {
      for (const side of [-1, 1]) {
        const x = w / 2 + side * (roadWidth(y) / 2 + 24 * p);
        ctx.fillStyle = '#385e48'; ctx.beginPath(); ctx.arc(x, y - 18 * p, 8 + p * 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#706a46'; ctx.fillRect(x - 2, y, 4, 14 * p);
      }
    }
  }
  const objects = s.objects.filter((o) => !o.resolved && o.distance - s.distance < 420).sort((a, b) => b.distance - a.distance);
  for (const o of objects) {
    const p = 1 - Math.max(0, (o.distance - s.distance) / 420), y = horizon + p * p * (carY - horizon), scale = .3 + p * .9;
    const x = roadX(o.lane, y);
    if (o.kind === 'zone') {
      ctx.fillStyle = '#efd87e'; ctx.fillRect(w / 2 - roadWidth(y) / 2, y - 3, roadWidth(y), 5 * scale);
      ctx.fillStyle = '#fff5dd'; ctx.strokeStyle = '#bd5c47'; ctx.lineWidth = 5 * scale;
      ctx.beginPath(); ctx.arc(w / 2 + roadWidth(y) / 2 + 20 * scale, y - 25 * scale, 20 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#283e38'; ctx.font = `bold ${18 * scale}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('50', w / 2 + roadWidth(y) / 2 + 20 * scale, y - 19 * scale);
    } else if (o.kind === 'film') {
      ctx.fillStyle = '#f3d16c'; ctx.beginPath(); ctx.arc(x, y - 8 * scale, 19 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#644c29'; ctx.fillRect(x - 11 * scale, y - 17 * scale, 22 * scale, 17 * scale);
      ctx.fillStyle = '#ffeebe'; ctx.beginPath(); ctx.arc(x, y - 8 * scale, 5 * scale, 0, Math.PI * 2); ctx.fill();
    } else if (o.kind === 'works') {
      ctx.fillStyle = '#e7a556'; ctx.fillRect(x - 30 * scale, y - 18 * scale, 60 * scale, 24 * scale);
      ctx.fillStyle = '#fff2bd'; for (let j = -1; j < 2; j++) ctx.fillRect(x + j * 18 * scale - 5 * scale, y - 18 * scale, 8 * scale, 24 * scale);
    } else car(ctx, x, y, 43 * scale, o.id % 2 ? '#b6c8c0' : '#d9b27e');
  }
  if (s.speed > 85) { ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const x = w * (.11 + i * .15); ctx.beginPath(); ctx.moveTo(x, h * .7); ctx.lineTo(x + (x - w / 2) * .1, h); ctx.stroke(); } }
  ctx.globalAlpha = s.invulnerable > 0 && Math.floor(s.elapsed * 12) % 2 ? .35 : 1;
  const playerX = roadX(s.x, carY), size = Math.min(70, w * .11);
  if (s.speed > 85) {
    for (let i = 0; i < 7; i++) {
      const p = (s.elapsed * 3 + i / 7) % 1;
      ctx.globalAlpha = (1 - p) * .8;
      star(ctx, playerX + Math.sin(i * 5) * size * p, carY + size * .5 + p * 60, 3 + p * 5, i % 2 ? '#ffe297' : '#ffa5ad');
    }
    ctx.globalAlpha = 1;
  }
  car(ctx, playerX, carY + Math.sin(s.elapsed * 12) * Math.min(1.5, s.speed / 40), size, '#ffbf69'); ctx.globalAlpha = 1;
  if (s.combo >= 4 && s.noticeUntil > s.elapsed) {
    const age = 1.6 - (s.noticeUntil - s.elapsed);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + age;
      ctx.globalAlpha = Math.max(0, 1 - age / 1.6);
      star(ctx, playerX + Math.cos(angle) * (size + age * 20), carY - 15 + Math.sin(angle) * (size * .65 + age * 20), 5, '#ffe38c');
    }
    ctx.globalAlpha = 1;
  }
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? size * .45 : size; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
}

function car(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = '#0e292777'; ctx.beginPath(); ctx.ellipse(x, y + size * .55, size * .65, size * .25, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f302e'; ctx.fillRect(x - size * .52, y - size * .35, size * 1.04, size * .88);
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - size * .45, y - size * .72, size * .9, size * 1.3, size * .13); ctx.fill();
  ctx.fillStyle = '#35585a'; ctx.fillRect(x - size * .33, y - size * .49, size * .66, size * .33);
  ctx.fillStyle = '#fffdf2';
  for (const side of [-1, 1]) {
    ctx.beginPath(); ctx.ellipse(x + side * size * .16, y - size * .32, size * .095, size * .12, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#294f61';
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(x + side * size * .16, y - size * .29, size * .043, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#8d633f'; ctx.lineWidth = Math.max(1, size * .025); ctx.beginPath(); ctx.arc(x, y + size * .03, size * .11, .1, Math.PI - .1); ctx.stroke();
  ctx.fillStyle = '#f7edc2'; ctx.fillRect(x - size * .34, y + size * .37, size * .16, size * .10); ctx.fillRect(x + size * .18, y + size * .37, size * .16, size * .10);
}
