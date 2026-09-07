import { DRIVE_LENGTH, roadCurve, roadDistrict, type DriveState } from '../game/driving';

const art: Record<string, HTMLImageElement> = {};
let loading: Promise<void> | undefined;
export function loadDriveArt() {
  return loading ??= Promise.all(['vehicles', 'buildings', 'skyline'].map((name) => new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => { art[name] = img; resolve(); };
    img.onerror = () => reject(new Error(`Unable to load driving art: ${name}`));
    img.src = `${import.meta.env.BASE_URL}art/driving/${name}.png`;
  }))).then(() => {}).catch((error) => { loading = undefined; throw error; });
}

type Point = { x: number; y: number; half: number; p: number };
// Tight atlas frames exclude neighbouring rows and keep every tire on the road.
const VEHICLE_FRAMES = [[55, 55, 450, 386], [558, 52, 438, 395], [1060, 75, 462, 380],
  [65, 478, 420, 478], [560, 544, 442, 410], [1054, 558, 470, 399]];
function polygon(ctx: CanvasRenderingContext2D, color: string | CanvasGradient, points: number[]) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath(); ctx.fill();
}
function strip(ctx: CanvasRenderingContext2D, a: Point, b: Point, left: number, right: number, color: string) {
  polygon(ctx, color, [a.x + a.half * left, a.y, a.x + a.half * right, a.y, b.x + b.half * right, b.y + 1, b.x + b.half * left, b.y + 1]);
}

/** Perspective road and depth-sorted billboard sprites. Assets stay local and are loaded once. */
export function drawRoad(ctx: CanvasRenderingContext2D, s: DriveState, width: number, height: number, reducedMotion = false) {
  const w = width, h = height;
  if (!w || !h) return;
  const horizon = h * .29, carY = h * .81;
  const curve = roadCurve(s.distance), district = roadDistrict(s.distance);
  const boost = s.nitro !== 'off';
  const shake = !reducedMotion && s.invulnerable > .65 ? Math.sin(s.elapsed * 97) * 4 * s.invulnerable : 0;
  ctx.save(); ctx.translate(shake, 0);
  const project = (z: number): Point => {
    const p = 1 / (1 + Math.max(-38, z) / 115);
    const bend = roadCurve(s.distance + Math.max(0, z) * .65);
    return { x: w / 2 + bend * w * .30 * (1 - p) ** 2 - (s.x - 1) * w * .025 * p,
      y: horizon + p * (carY - horizon), half: w * .43 * p, p };
  };
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#648aa7'); sky.addColorStop(.3, '#f7c5a3'); sky.addColorStop(1, '#89736d');
  ctx.fillStyle = sky; ctx.fillRect(-8, 0, w + 16, h);
  if (art.skyline) {
    const imageW = w * 1.12;
    ctx.drawImage(art.skyline, 0, 0, art.skyline.width, art.skyline.height * .85, (w - imageW) / 2 - curve * w * .045, 0, imageW, horizon + h * .13);
  }
  ctx.fillStyle = district.index === 0 ? '#527f80' : '#8c8885'; ctx.fillRect(-8, horizon + h * .08, w + 16, h);
  if (district.index === 0) {
    for (let i = 0; i < 32; i++) {
      const y = horizon + h * .1 + i * h * .024;
      ctx.strokeStyle = i % 3 ? '#a6c7b730' : '#ffdc9d50'; ctx.lineWidth = 1 + i * .05;
      const x = ((i * 53 + s.distance * .04) % (w * .4)) - w * .15;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * (.035 + i % 4 * .017), y); ctx.stroke();
    }
  }
  // Fixed world distance makes every marking accelerate with the car.
  const step = 9, offset = s.distance % step;
  const segments: { a: Point; b: Point; band: number }[] = [];
  for (let z = 1600 - offset; z > -36; z -= step) {
    const a = project(z), b = project(z - step), band = Math.floor((s.distance + z) / 18);
    segments.push({ a, b, band });
    strip(ctx, a, b, -1.75, 1.75, band % 2 ? '#b4a797' : '#bbae9f');
    strip(ctx, a, b, -1.10, 1.10, '#e4d3b5');
    strip(ctx, a, b, -1.045, 1.045, band % 2 ? '#efc38e' : '#ead9b6');
    strip(ctx, a, b, -1.17, -1.14, '#8e8a82'); strip(ctx, a, b, 1.14, 1.17, '#8e8a82');
  }
  // A continuous asphalt silhouette prevents antialiasing seams between strips.
  const roadPoints = [...segments.map((segment) => segment.a), segments[segments.length - 1].b];
  polygon(ctx, '#47515d', [...roadPoints.flatMap((p) => [p.x - p.half, p.y]), ...roadPoints.slice().reverse().flatMap((p) => [p.x + p.half, p.y])]);
  for (const { a, b, band } of segments) {
    if (band % 2) strip(ctx, a, b, -1, 1, '#49535f');
    strip(ctx, a, b, -.97, -.955, '#f4d5a2'); strip(ctx, a, b, .955, .97, '#f4d5a2');
    if (band % 3 !== 0) for (const lane of [-1 / 3, 1 / 3]) strip(ctx, a, b, lane - .006, lane + .006, '#d1d4cd');
  }
  const reflection = ctx.createLinearGradient(0, horizon, 0, h);
  reflection.addColorStop(0, '#ffc58726'); reflection.addColorStop(1, '#ffc58700');
  ctx.fillStyle = reflection; ctx.fillRect(0, horizon, w, h - horizon);

  type Drawable = { z: number; draw: () => void };
  const items: Drawable[] = [];
  for (let i = Math.floor(s.distance / 72) - 1; i < Math.floor(s.distance / 72) + 20; i++) {
    const z = i * 72 - s.distance;
    if (z < -35) continue;
    const p = project(z);
    for (const side of [-1, 1]) {
      // The river opens up the left bank; denser facades take over in the old town.
      if (!(district.index === 0 && side === -1 && i % 3 !== 0)) items.push({ z, draw: () => {
        const bw = w * .29 * p.p, bh = bw * 2;
        const x = p.x + side * p.half * 1.35;
        if (art.buildings) {
          const cell = ((i + (side === 1 ? 1 : 0)) % 3 + 3) % 3;
          ctx.save(); ctx.translate(x, p.y);
          if (side === 1) ctx.scale(-1, 1);
          ctx.drawImage(art.buildings, cell * art.buildings.width / 3, 0, art.buildings.width / 3, art.buildings.height, -bw * .76, -bh * .92, bw, bh);
          ctx.restore();
        }
      } });
      if (i % 2 === 0) items.push({ z: z - 15, draw: () => {
        const pos = project(z - 15), x = pos.x + side * pos.half * 1.14, size = Math.max(w * .045, 25) * pos.p;
        ctx.strokeStyle = '#283d48'; ctx.lineWidth = Math.max(1, size * .075);
        ctx.beginPath(); ctx.moveTo(x, pos.y); ctx.lineTo(x, pos.y - size * 3); ctx.quadraticCurveTo(x, pos.y - size * 3.4, x - side * size * .5, pos.y - size * 3.4); ctx.stroke();
        ctx.fillStyle = '#ffdf9c'; ctx.beginPath(); ctx.ellipse(x - side * size * .5, pos.y - size * 3.35, size * .16, size * .08, 0, 0, Math.PI * 2); ctx.fill();
        if (district.index === 0) {
          ctx.fillStyle = '#665e4c'; ctx.fillRect(x + side * size - size * .08, pos.y - size * 1.7, size * .16, size * 1.7);
          for (let j = 0; j < 3; j++) { ctx.fillStyle = ['#386e60', '#4c8670', '#79a07a'][j]; ctx.beginPath(); ctx.arc(x + side * size + (j - 1) * size * .35, pos.y - size * (1.7 + j * .2), size * .68, 0, Math.PI * 2); ctx.fill(); }
        }
      } });
    }
  }
  for (const o of s.objects) {
    const z = o.distance - s.distance;
    if (o.resolved || z > 1300 || z < -15) continue;
    items.push({ z, draw: () => {
      const pos = project(z), x = pos.x + (o.lane - 1) * pos.half * 2 / 3;
      const size = w * .14 * pos.p;
      if (o.kind === 'traffic') vehicle(ctx, 1 + o.id % 5, x, pos.y, size, 0, false);
      else if (o.kind === 'film') {
        const radius = Math.max(3, size * .23), bob = reducedMotion ? 0 : Math.sin(s.elapsed * 4 + o.id) * radius * .2;
        ctx.save(); ctx.translate(x, pos.y - radius * 1.8 + bob);
        const glow = ctx.createRadialGradient(0, 0, radius * .2, 0, 0, radius * 2.2);
        glow.addColorStop(0, '#ffe59bbb'); glow.addColorStop(1, '#ffb84400');
        ctx.fillStyle = glow; ctx.fillRect(-radius * 2.2, -radius * 2.2, radius * 4.4, radius * 4.4);
        ctx.fillStyle = '#ffcb63'; ctx.strokeStyle = '#fff1b2'; ctx.lineWidth = radius * .1;
        ctx.beginPath(); ctx.roundRect(-radius, -radius, radius * 2, radius * 2, radius * .3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#735231'; ctx.fillRect(-radius * .55, -radius * .5, radius * 1.1, radius);
        ctx.fillStyle = '#fff5ca'; ctx.beginPath(); ctx.arc(0, 0, radius * .28, 0, Math.PI * 2); ctx.fill();
        for (const side of [-1, 1]) for (let j = -1; j <= 1; j++) ctx.fillRect(side * radius * .79 - radius * .07, j * radius * .5 - radius * .08, radius * .14, radius * .16);
        ctx.restore();
      } else if (o.kind === 'works') {
        ctx.fillStyle = '#212e37'; ctx.fillRect(x - size * .44, pos.y - size * .38, size * .1, size * .38); ctx.fillRect(x + size * .34, pos.y - size * .38, size * .1, size * .38);
        ctx.fillStyle = '#f5a658'; ctx.fillRect(x - size * .5, pos.y - size * .48, size, size * .3);
        for (let j = 0; j < 4; j++) polygon(ctx, '#fff1ce', [x - size * .5 + j * size * .25, pos.y - size * .48, x - size * .38 + j * size * .25, pos.y - size * .48, x - size * .23 + j * size * .25, pos.y - size * .18, x - size * .35 + j * size * .25, pos.y - size * .18]);
      } else {
        ctx.strokeStyle = '#ffe2a4'; ctx.lineWidth = Math.max(1, pos.p * 5); ctx.beginPath(); ctx.moveTo(pos.x - pos.half, pos.y); ctx.lineTo(pos.x + pos.half, pos.y); ctx.stroke();
        const r = size * .22, sx = pos.x + pos.half * 1.12;
        ctx.strokeStyle = '#384855'; ctx.lineWidth = Math.max(1, r * .1); ctx.beginPath(); ctx.moveTo(sx, pos.y); ctx.lineTo(sx, pos.y - r * 3); ctx.stroke();
        ctx.fillStyle = '#fff5df'; ctx.strokeStyle = '#dd644f'; ctx.lineWidth = r * .18; ctx.beginPath(); ctx.arc(sx, pos.y - r * 3, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#38424b'; ctx.font = `900 ${r}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('50', sx, pos.y - r * 2.65);
      }
    } });
  }
  const finishZ = DRIVE_LENGTH - s.distance;
  if (finishZ < 800) items.push({ z: finishZ, draw: () => {
    const pos = project(finishZ), top = pos.y - w * .28 * pos.p;
    ctx.fillStyle = '#284c50'; ctx.fillRect(pos.x - pos.half * 1.08, top, pos.half * .06, pos.y - top); ctx.fillRect(pos.x + pos.half * 1.02, top, pos.half * .06, pos.y - top);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 18; col++) { ctx.fillStyle = (col + row) % 2 ? '#2b3942' : '#fff2d4'; ctx.fillRect(pos.x - pos.half * 1.08 + col * pos.half * .12, top + row * pos.half * .09, pos.half * .12 + 1, pos.half * .09 + 1); }
  } });
  items.sort((a, b) => b.z - a.z).forEach((item) => item.draw());

  const playerPos = project(0), playerX = playerPos.x + (s.x - 1) * playerPos.half * 2 / 3;
  const playerSize = Math.min(w * .20, h * .29, 190);
  const driftAngle = s.drifting ? -curve * .24 : 0;
  if (s.drifting && !reducedMotion) {
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#212a37aa'; ctx.lineWidth = playerSize * .075; ctx.beginPath(); ctx.moveTo(playerX + side * playerSize * .31, carY); ctx.quadraticCurveTo(playerX + side * playerSize * .35 + curve * 28, carY + 35, playerX + side * playerSize * .34 + curve * 65, h); ctx.stroke();
      for (let i = 0; i < 9; i++) { const t = (s.elapsed * 1.6 + i / 9) % 1; ctx.globalAlpha = (1 - t) * .25; ctx.fillStyle = '#e1e3d9'; ctx.beginPath(); ctx.arc(playerX + side * playerSize * (.3 + t * .4) + curve * t * 35, carY + t * 65, playerSize * (.04 + t * .16), 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
  }
  if (boost) {
    const color = s.nitro === 'shockwave' ? '#d592ff' : '#71eafa';
    for (const side of [-1, 1]) {
      const ex = playerX + side * playerSize * .22, len = playerSize * (s.nitro === 'normal' ? .55 : .85);
      const flame = ctx.createLinearGradient(ex, carY - 8, ex, carY + len);
      flame.addColorStop(0, '#fffcef'); flame.addColorStop(.2, color); flame.addColorStop(1, `${color}00`);
      polygon(ctx, flame, [ex - playerSize * .075, carY - 9, ex + playerSize * .075, carY - 9, ex + playerSize * .025, carY + len, ex - playerSize * .025, carY + len * .8]);
    }
  }
  ctx.globalAlpha = s.invulnerable > 0 && Math.floor(s.elapsed * 12) % 2 ? .5 : 1;
  vehicle(ctx, 0, playerX, carY + (reducedMotion ? 0 : Math.sin(s.elapsed * 16) * s.speed / 100), playerSize, driftAngle + (s.lane - s.x) * .07, s.drifting);
  ctx.globalAlpha = 1;
  if (boost && !reducedMotion) {
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 20; i++) {
      const t = (s.elapsed * (1.1 + i % 3 * .1) + i * .17) % 1;
      const angle = i * 2.4, dx = Math.cos(angle), dy = Math.sin(angle);
      const x = w / 2 + dx * w * (.38 + t * .38), y = h * .48 + dy * h * (.25 + t * .5);
      ctx.strokeStyle = s.nitro === 'shockwave' ? '#dfb3ff80' : '#d0f7ff70'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 45 * t, y + dy * 80 * t); ctx.stroke();
    }
  }
  const vignette = ctx.createRadialGradient(w / 2, h * .45, w * .15, w / 2, h * .5, Math.max(w, h) * .8);
  vignette.addColorStop(0, '#10243900'); vignette.addColorStop(1, '#10243980'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
  if (s.invulnerable > .8) { ctx.fillStyle = `rgba(255,110,85,${(s.invulnerable - .8) * .8})`; ctx.fillRect(0, 0, w, h); }
  ctx.restore();
}

function vehicle(ctx: CanvasRenderingContext2D, cell: number, x: number, y: number, size: number, angle: number, drifting: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#17233166'; ctx.beginPath(); ctx.ellipse(0, size * .01, size * .49, size * .11, 0, 0, Math.PI * 2); ctx.fill();
  if (art.vehicles) {
    const [sx, sy, sw, sh] = VEHICLE_FRAMES[cell], height = size * sh / sw;
    ctx.drawImage(art.vehicles, sx, sy, sw, sh, -size / 2, -height, size, height);
  }
  if (drifting) { ctx.fillStyle = '#fff0c0'; ctx.globalAlpha = .75; ctx.beginPath(); ctx.arc(-size * .38, 0, size * .025, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
