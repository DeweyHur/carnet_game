// Overpass 응답을 걷기 게임이 읽는 압축형으로 바꾼다(src/walk/data.ts와 짝).
const KEEP = ['name', 'amenity', 'shop', 'tourism', 'historic', 'leisure', 'cuisine', 'opening_hours', 'description', 'wikipedia'];

/** Overpass 응답 → 게임이 읽는 압축형 */
export function pack(elements) {
  const ways = [];
  const places = [];
  for (const e of elements) {
    if (e.type === 'way' && e.tags?.highway && e.geometry?.length > 1) {
      const a = [];
      let px = 0, py = 0;
      for (const p of e.geometry) {
        const x = Math.round(p.lon * 1e6), y = Math.round(p.lat * 1e6);
        a.push(x - px, y - py);
        px = x; py = y;
      }
      ways.push(a);
      continue;
    }
    if (!e.tags?.name || e.tags.highway) continue;
    const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const t = {};
    for (const k of KEEP) if (e.tags[k] !== undefined) t[k] = e.tags[k];
    places.push({ i: e.type[0] + e.id, p: [Math.round(lon * 1e6), Math.round(lat * 1e6)], t });
  }
  return { v: 1, ways, places };
}

