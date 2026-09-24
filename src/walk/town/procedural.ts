// 지도 타일을 못 받을 때(오프라인·차단된 망): 걷는 길 양옆에 필지를 나눠 건물을 세운다.
// 길에서 몇 m 물러나 폭 7~16 m 필지를 빈틈없이 잇는다 — 파리 거리처럼 맞벽으로 붙은 줄집이 된다.
import { hash } from './geom';
import type { Theme } from './buildings';
import type { World } from '../hero/world';

const HEIGHTS: Record<Theme, [number, number]> = {
  marais: [13, 22], 'saint-germain': [16, 23], montmartre: [9, 17], belleville: [11, 25], 'champs-elysees': [19, 26],
};

/** ways: 로컬 m 좌표 폴리라인들 */
export function procedural(world: World, ways: [number, number][][], theme: Theme): { rings: Float64Array[]; top: number }[] {
  const out: { rings: Float64Array[]; top: number }[] = [];
  const occ = new Set<number>();
  const K = 1.0;
  const key = (x: number, y: number) => (Math.floor(x / K) + 50000) * 100000 + (Math.floor(y / K) + 50000);
  const [hMin, hMax] = HEIGHTS[theme];
  // 긴 길부터 — 큰길가가 먼저 채워진다
  const sorted = ways.map((w) => ({ w, len: w.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - w[i - 1][0], p[1] - w[i - 1][1]) : 0), 0) })).sort((a, b) => b.len - a.len);
  for (const { w, len } of sorted) {
    if (len < 6) continue;
    const cum = [0];
    for (let i = 1; i < w.length; i++) cum.push(cum[i - 1] + Math.hypot(w[i][0] - w[i - 1][0], w[i][1] - w[i - 1][1]));
    const at = (s: number) => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const a = w[i - 1], b = w[i];
      const L = cum[i] - cum[i - 1] || 1;
      const t = Math.max(0, Math.min(1, (s - cum[i - 1]) / L));
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / L, dy: (b[1] - a[1]) / L };
    };
    for (const side of [1, -1]) {
      let s = 2 + hash(w[0][0], w[0][1], side + 5) * 4;
      const setback = 4.6 + hash(w[0][0], w[0][1], 7) * 1.6;
      while (s < len - 4) {
        const lw = 7 + hash(s, side, Math.round(w[0][0])) * 9;
        const depth = 11 + hash(s, side * 3, Math.round(w[0][1])) * 7;
        const c = at(s + lw / 2);
        const nx = -c.dy * side, ny = c.dx * side;
        const ox = c.x + nx * (setback + depth / 2), oy = c.y + ny * (setback + depth / 2);
        // 필지 안쪽을 1.5 m 간격으로 짚어 본다: 길이 지나가거나 이미 누가 차지했으면 포기
        let ok = true;
        const cells: number[] = [];
        for (let u = -lw / 2 + 0.7; u <= lw / 2 - 0.7 && ok; u += 1.0) {
          for (let v = -depth / 2 + 0.7; v <= depth / 2 - 0.7; v += 1.0) {
            const px = ox + c.dx * u + nx * v, py = oy + c.dy * u + ny * v;
            const k = key(px, py);
            if (occ.has(k) || world.onLane(px, py, 3.4)) { ok = false; break; }
            cells.push(k);
          }
        }
        if (ok) {
          for (const k of cells) occ.add(k);
          const ring = new Float64Array(8);
          const pts = [[-lw / 2, -depth / 2], [lw / 2, -depth / 2], [lw / 2, depth / 2], [-lw / 2, depth / 2]];
          pts.forEach(([u, v], i) => { ring[i * 2] = ox + c.dx * u + nx * v; ring[i * 2 + 1] = oy + c.dy * u + ny * v; });
          const hr = hash(ox, oy, 11);
          let top = hMin + (hMax - hMin) * hr;
          if (theme === 'belleville' && hash(ox, oy, 12) < 0.06) top = 32 + hash(ox, oy, 13) * 18; // 가끔 60~70년대 고층
          out.push({ rings: [ring], top: Math.round(top * 2) / 2 });
          s += lw;
        } else s += 2.5;
      }
    }
  }
  return out;
}
