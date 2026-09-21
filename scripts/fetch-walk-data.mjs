// 걷기 프로토타입용 마레 지구 데이터(OSM)를 한 번 받아 public/walk/marais.json에 굽는다.
// 실행: node scripts/fetch-walk-data.mjs   — 구워 두면 게임이 Overpass를 매번 부르지 않는다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const query = readFileSync(new URL('../src/walk/overpass-query.txt', import.meta.url), 'utf8');
const res = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(query),
});
if (!res.ok) throw new Error(`Overpass ${res.status}`);
const json = await res.json();
mkdirSync(new URL('../public/walk/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/walk/marais.json', import.meta.url), JSON.stringify({ elements: json.elements }));
console.log(`elements: ${json.elements.length} → public/walk/marais.json`);
