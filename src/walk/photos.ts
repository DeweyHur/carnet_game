// 사진 찾기: 저장소에 구워 둔 사진(photoManifest) → 위키백과 대표 사진(위키미디어 공용) 순서.
// 공용 사진은 재사용 가능한 라이선스만 쓰고, 작가·라이선스를 항상 같이 돌려준다.
import manifest from '../data/photoManifest.json';

export interface Photo {
  src: string;
  width: number;
  height: number;
  credit: string; // "작가 · CC BY-SA 4.0"
  sourceUrl: string;
}

interface ManifestEntry { src: string; width: number; height: number; author: string; license: string; sourceUrl: string }
const LOCAL = manifest as unknown as Record<string, ManifestEntry>;
const CACHE_KEY = 'carnet-walk-photos-v1';
const memo = new Map<string, Promise<Photo | null>>();

let cache: Record<string, Photo | null> = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}'); } catch { cache = {}; }
const persist = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* 저장소 사용 불가 */ } };

const strip = (html: string) => { const d = document.createElement('div'); d.innerHTML = html; return (d.textContent ?? '').trim(); };

async function json(url: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(timer); }
}

/** ref: 'local:paris:carnavalet' | 'Place des Vosges'(영어 위키백과) | 'fr:Village Saint-Paul' */
async function resolve(ref: string): Promise<Photo | null> {
  if (ref.startsWith('local:')) {
    const m = LOCAL[ref.slice(6)];
    return m ? { src: m.src, width: m.width, height: m.height, credit: `${m.author} · ${m.license}`, sourceUrl: m.sourceUrl } : null;
  }
  const mt = /^([a-z]{2}):(.+)$/.exec(ref);
  const lang = mt ? mt[1] : 'en';
  const page = mt ? mt[2] : ref;
  const summary = await json(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.replace(/ /g, '_'))}`);
  const original: string | undefined = summary?.originalimage?.source;
  if (!original) return null;
  const path = new URL(original).pathname;
  const parts = path.split('/');
  const filename = decodeURIComponent(path.includes('/thumb/') ? parts[parts.length - 2] : parts[parts.length - 1]).replace(/_/g, ' ');
  const q = new URLSearchParams({ action: 'query', format: 'json', origin: '*', redirects: '1', prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1600', titles: `File:${filename}` });
  const data = await json(`https://commons.wikimedia.org/w/api.php?${q}`);
  const pages = data?.query?.pages ?? {};
  const info = (Object.values(pages)[0] as any)?.imageinfo?.[0]; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!info) return null;
  const meta = info.extmetadata ?? {};
  const license = strip(meta.LicenseShortName?.value ?? '');
  if (!/cc by|cc0|public domain|^pd/i.test(license)) return null; // 재사용이 분명한 것만
  const author = strip(meta.Artist?.value ?? '') || 'Wikimedia Commons';
  return {
    src: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    credit: `${author.slice(0, 60)} · ${license}`,
    sourceUrl: info.descriptionurl,
  };
}

/** 후보를 순서대로 시도해 처음 찾은 사진을 돌려준다. 못 찾으면 null(호출부는 그림으로 대체). */
export function findPhoto(refs: string[]): Promise<Photo | null> {
  const key = refs.join('|');
  if (!key) return Promise.resolve(null);
  if (key in cache) return Promise.resolve(cache[key]);
  let p = memo.get(key);
  if (!p) {
    p = (async () => {
      let failed = false;
      for (const ref of refs) {
        try { const ph = await resolve(ref); if (ph) { cache[key] = ph; persist(); return ph; } } catch { failed = true; }
      }
      if (!failed) { cache[key] = null; persist(); } // 네트워크 오류였다면 다음에 다시 시도
      return null;
    })();
    memo.set(key, p);
  }
  return p;
}

export function preload(photo: Photo): Promise<boolean> {
  return new Promise((res) => { const im = new Image(); im.onload = () => res(true); im.onerror = () => res(false); im.src = photo.src; });
}
