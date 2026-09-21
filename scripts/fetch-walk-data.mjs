// 걷기 프로토타입용 마레 지구 데이터(OSM)를 한 번 받아 public/walk/marais.json에 굽는다.
// 실행: node scripts/fetch-walk-data.mjs   — 구워 두면 게임이 Overpass를 매번 부르지 않는다.
// --if-missing: 이미 구운 파일이 있으면 건너뛰고, 받기에 실패해도 빌드를 깨지 않는다(게임이 실행 중에 직접 받는다).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const soft = process.argv.includes('--if-missing');
const out = new URL('../public/walk/marais.json', import.meta.url);
if (soft && existsSync(out)) { console.log('walk data: 이미 있음, 건너뜀'); process.exit(0); }
try {
  const query = readFileSync(new URL('../src/walk/overpass-query.txt', import.meta.url), 'utf8');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    signal: AbortSignal.timeout(90000),
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  if (!json.elements?.some((e) => e.tags?.highway)) throw new Error('도로 데이터가 비어 있음');
  mkdirSync(new URL('../public/walk/', import.meta.url), { recursive: true });
  writeFileSync(out, JSON.stringify({ elements: json.elements }));
  console.log(`elements: ${json.elements.length} → public/walk/marais.json`);
} catch (e) {
  console.warn('walk data: 받지 못함 —', e.message);
  process.exit(soft ? 0 : 1);
}
