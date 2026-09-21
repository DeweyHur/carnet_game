// 데이터 적재: 구워 둔 파일 → 브라우저 캐시 → Overpass 순서로 시도한다.
import query from './overpass-query.txt?raw';
import type { OverpassElement } from './places';

const CACHE_KEY = 'carnet-walk-marais-v1';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export async function loadElements(onStatus: (s: string) => void): Promise<OverpassElement[]> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}walk/marais.json`);
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return (await r.json()).elements;
  } catch { /* 구운 파일 없음 */ }
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* 저장소 사용 불가 */ }
  for (const url of ENDPOINTS) {
    try {
      onStatus('마레 지구의 골목 지도를 받아오는 중… (처음 한 번, 10초쯤)');
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
      if (!r.ok) continue;
      const els: OverpassElement[] = (await r.json()).elements;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(els)); } catch { /* 용량 초과는 무시 */ }
      return els;
    } catch { /* 다음 서버 */ }
  }
  throw new Error('거리 데이터를 받지 못했습니다. 네트워크를 확인하거나 `node scripts/fetch-walk-data.mjs`로 미리 구워 주세요.');
}
