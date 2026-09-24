// 지구 데이터 적재. 구워 둔 압축 파일(scripts/fetch-walk-data.mjs)만 읽는다.
// 포맷: { v:1, ways:[[lng0,lat0,dlng,dlat,…](1e6 정수, 앞 점과의 차), …], places:[{i,p:[lng,lat],t:{…}}] }
import type { LngLat } from './graph';
import type { RawPlace } from './places';
import type { District } from './districts';
import { mergeEiffel } from './eiffel';

export interface WalkData { ways: LngLat[][]; places: RawPlace[] }

interface Packed { v: number; ways: number[][]; places: { i: string; p: [number, number]; t: Record<string, string> }[] }

const cache = new Map<string, WalkData>();

function unpack(d: Packed): WalkData {
  const ways: LngLat[][] = [];
  for (const a of d.ways) {
    const pts: LngLat[] = [];
    let x = 0, y = 0;
    for (let i = 0; i + 1 < a.length; i += 2) { x += a[i]; y += a[i + 1]; pts.push([x / 1e6, y / 1e6]); }
    if (pts.length > 1) ways.push(pts);
  }
  return { ways, places: d.places.map((p) => ({ id: p.i, pos: [p.p[0] / 1e6, p.p[1] / 1e6] as LngLat, tags: p.t })) };
}

export async function loadDistrict(d: District, onStatus: (s: string) => void): Promise<WalkData> {
  const hit = cache.get(d.id);
  if (hit) return hit;
  onStatus(`${d.name}의 골목 지도를 펴는 중…`);
  const r = await fetch(`${import.meta.env.BASE_URL}${d.data}`);
  if (!r.ok) throw new Error(`${d.name} 거리 데이터를 찾을 수 없습니다 (${d.data}).`);
  const json = (await r.json()) as Packed;
  if (!json?.ways?.length) throw new Error(`${d.name} 거리 데이터가 비어 있습니다.`);
  let out = unpack(json);
  if (d.id === 'champs-elysees') out = mergeEiffel(out); // 에펠탑 둘레(손으로 그린 길·장소)를 붙인다
  cache.set(d.id, out);
  return out;
}
