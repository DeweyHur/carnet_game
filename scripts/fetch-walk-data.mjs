// 걷기 게임의 지구 데이터(OSM)를 받아 public/walk/<id>.json으로 굽는다.
// 실행: node scripts/fetch-walk-data.mjs [id]   (id 없으면 전부)
//   --if-missing: 이미 있으면 건너뛰고, 못 받아도 빌드를 깨지 않는다.
// 포맷은 src/walk/data.ts가 읽는 압축형: 길은 1e6 정수 델타, 장소는 필요한 태그만.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { pack } from './walk-pack.mjs';

const DISTRICTS = {
  marais: { bbox: '48.8520,2.3530,48.8625,2.3700', extra: ['nwr["name"="Place des Vosges"];'] },
  'saint-germain': { bbox: '48.8440,2.3300,48.8580,2.3490', extra: [] },
};
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

const query = (bbox, extra) => `[out:json][timeout:90][bbox:${bbox}];
way["highway"~"^(pedestrian|footway|living_street|residential|tertiary|secondary|primary|unclassified|steps|path)$"];
out geom;
(
  nwr["name"]["tourism"~"^(museum|gallery|attraction|artwork|viewpoint)$"];
  nwr["name"]["historic"];
  nwr["name"]["leisure"~"^(park|garden)$"];
  nwr["name"]["amenity"~"^(restaurant|fast_food|cafe|bar|pub|ice_cream|place_of_worship|library|theatre|arts_centre)$"];
  nwr["name"]["shop"~"^(bakery|pastry|confectionery|chocolate|cheese|deli|wine|tea|coffee|spices|books|antiques|art|second_hand|music|stationery)$"];
  ${extra.join('\n  ')}
);
out center tags;`;

const soft = process.argv.includes('--if-missing');
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const ids = only ? [only] : Object.keys(DISTRICTS);
let failed = false;

for (const id of ids) {
  const cfg = DISTRICTS[id];
  if (!cfg) { console.error(`walk data: 모르는 지구 ${id}`); process.exit(1); }
  const out = new URL(`../public/walk/${id}.json`, import.meta.url);
  if (soft && existsSync(out)) { console.log(`walk data: ${id} 이미 있음, 건너뜀`); continue; }
  try {
    let els = null;
    for (const url of ENDPOINTS) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(120000),
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query(cfg.bbox, cfg.extra)),
      });
      if (!res.ok) continue;
      els = (await res.json()).elements;
      break;
    }
    if (!els?.some((e) => e.tags?.highway)) throw new Error('도로 데이터가 비어 있음');
    const packed = pack(els);
    mkdirSync(new URL('../public/walk/', import.meta.url), { recursive: true });
    writeFileSync(out, JSON.stringify(packed));
    console.log(`${id}: 길 ${packed.ways.length} · 장소 ${packed.places.length} → public/walk/${id}.json`);
  } catch (e) {
    console.warn(`walk data: ${id} 받지 못함 —`, e.message);
    failed = true;
  }
}
if (failed && !soft) process.exit(1);
