type Coord = [number, number];
const segmentLength = (a: Coord, b: Coord) => Math.hypot((b[0] - a[0]) * Math.cos((a[1] + b[1]) * Math.PI / 360), b[1] - a[1]) * 111195;
export function routeLength(coords: Coord[]) { return coords.slice(1).reduce((sum, b, i) => sum + segmentLength(coords[i], b), 0); }
/** Distance-weighted interpolation keeps the map car in sync with arcade progress. */
export function routePoint(coords: Coord[], progress: number): Coord {
  if (!coords.length) return [0, 0];
  let remaining = routeLength(coords) * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < coords.length; i++) {
    const length = segmentLength(coords[i - 1], coords[i]);
    if (remaining <= length && length > 0) {
      const p = remaining / length;
      return [coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * p, coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * p];
    }
    remaining -= length;
  }
  return coords[coords.length - 1];
}
