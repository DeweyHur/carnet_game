// 걷는 사람의 세계는 미터 단위 평면이다. 동네 하나(2 km 안팎)에서는 등장방형 근사로 충분하다.
// x = 동쪽, y = 북쪽, z = 위 (m).
import type { LngLat } from '../graph';

const M_PER_DEG = 111320;

export class Frame {
  readonly lng0: number;
  readonly lat0: number;
  private readonly kx: number;
  constructor(origin: LngLat) {
    this.lng0 = origin[0];
    this.lat0 = origin[1];
    this.kx = M_PER_DEG * Math.cos((origin[1] * Math.PI) / 180);
  }
  toLocal(p: LngLat): [number, number] {
    return [(p[0] - this.lng0) * this.kx, (p[1] - this.lat0) * M_PER_DEG];
  }
  toLngLat(x: number, y: number): LngLat {
    return [this.lng0 + x / this.kx, this.lat0 + y / M_PER_DEG];
  }
}

/** 방위(도, 북쪽 0 · 시계 방향) → 단위 벡터 */
export const dirOf = (deg: number): [number, number] => {
  const r = (deg * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
};
/** 벡터 → 방위(도) */
export const bearingOf = (x: number, y: number) => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
/** a에서 b로 가장 짧게 도는 각도 차(-180..180) */
export const angleDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;
