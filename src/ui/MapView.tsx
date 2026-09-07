import { translateDisplay as display } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker, GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre v6는 워커를 별도 모듈로 로드한다. Vite가 번들에 포함하도록 명시.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import { CITIES, cityById, edgesFrom, REGIONS } from '../data/cities';
import { useGame } from '../game/store';
import { FALLBACK_STYLE } from '../data/fallbackMap';
import type { RegionId } from '../game/types';
import { useT } from '../i18n';

// 기획서 §3.1: MapLibre GL JS + 벡터 타일. 프로토타입은 무료 공개 스타일을 쓰고,
// 실서비스에서는 PMTiles(OpenMapTiles/Protomaps) 자체 호스팅으로 교체한다.
const STYLE_PRIMARY = 'https://tiles.openfreemap.org/styles/positron';

/** 잠긴 도시 주변에 원형 "안개"를 그린다 (기획서 §3.1: 해금 지역은 빛나고 잠긴 지역은 안개). */
function fogCircle([lon, lat]: [number, number], radiusKm: number, steps = 48): number[][] {
  const latRad = (lat * Math.PI) / 180;
  const kmPerDegLon = 111.32 * Math.cos(latRad);
  const kmPerDegLat = 110.574;
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([lon + (radiusKm * Math.cos(a)) / kmPerDegLon, lat + (radiusKm * Math.sin(a)) / kmPerDegLat]);
  }
  return ring;
}

const TIER_LABEL: Record<string, string> = { S: '메인 무대(S)', A: '거점 도시(A)', H: '유산 노드(H)' };

interface Props { onSelect: (cityId: string) => void; selected: string | null }

type ZoomTier = 'world' | 'country' | 'city';

export default function MapView({ onSelect, selected }: Props) {
  const t = useT();
  const [zoomTier, setZoomTier] = useState<ZoomTier>('city');
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const traveller = useRef<Marker | null>(null);
  const cityId = useGame((s) => s.cityId);
  const unlocked = useGame((s) => s.unlocked);
  const stamps = useGame((s) => s.stamps);
  const travelling = useGame((s) => s.travelling);
  const lang = useGame((s) => s.lang);

  // 지도 생성
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current, style: STYLE_PRIMARY, center: [2.35, 48.9], zoom: 9.2, attributionControl: { compact: true },
    });
    // 온라인 스타일을 못 받으면(오프라인·차단) 내장 대체 스타일로
    let fellBack = false;
    const fallback = () => { if (fellBack) return; fellBack = true; map.setStyle(FALLBACK_STYLE); };
    map.on('error', (e: { error?: { message?: string } }) => {
      const msg = String(e.error?.message ?? '');
      if (!map.isStyleLoaded() && !map.getStyle()?.layers?.length) fallback();
      else if (/style|fetch|load/i.test(msg) && !map.getStyle()?.layers?.length) fallback();
    });
    const t = setTimeout(() => { if (!map.isStyleLoaded()) fallback(); }, 7000);
    map.once('load', () => clearTimeout(t));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    // 기획서 §3.1: Z0~3 세계(핵심 도시만) → Z4~6 국가(전체 핀) → Z7+ 도시(전체 상세)
    const updateZoomTier = () => {
      const z = map.getZoom();
      const tier: ZoomTier = z < 6 ? 'world' : z < 8.5 ? 'country' : 'city';
      ref.current?.setAttribute('data-zoom-tier', tier);
      setZoomTier((prev) => (prev === tier ? prev : tier));
    };
    map.on('zoom', updateZoomTier);
    updateZoomTier();
    // 스타일 로드(또는 폴백으로 교체)마다 게임 레이어를 다시 얹는다
    map.on('style.load', () => {
      if (!map.getSource('fog')) {
        map.addSource('fog', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'fog', type: 'fill', source: 'fog', paint: { 'fill-color': '#2b241c', 'fill-opacity': 0.4 } });
        map.addLayer({ id: 'fog-line', type: 'line', source: 'fog', paint: { 'line-color': '#2b241c', 'line-opacity': 0.25, 'line-width': 1, 'line-dasharray': [1, 2] } });
      }
      if (!map.getSource('edges')) {
        map.addSource('edges', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'edges', type: 'line', source: 'edges', paint: { 'line-color': '#b5482f', 'line-width': 2, 'line-dasharray': [2, 2] } });
        map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#2b241c', 'line-width': 3 } });
      }
    });
    mapRef.current = map;
    (window as unknown as { __map?: MLMap }).__map = map; // 디버그용
    // 도시 핀
    for (const c of CITIES) {
      const el = document.createElement('div');
      el.className = `pin tier-${c.tier}`;
      el.innerHTML = '<div class="dot"></div><div class="lbl"></div>';
      el.querySelector('.lbl')!.textContent = display(c.names.ko);
      el.addEventListener('click', (ev) => { ev.stopPropagation(); onSelect(c.id); });
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(c.coord).addTo(map);
      markers.current[c.id] = m;
    }
    return () => { clearTimeout(t); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀 상태 갱신
  useEffect(() => {
    for (const c of CITIES) {
      const el = markers.current[c.id]?.getElement();
      if (!el) continue;
      const done = stamps.some((s) => s.cityId === c.id);
      el.querySelector('.lbl')!.textContent = display(c.names.ko);
      // maplibregl-marker 클래스는 유지해야 위치가 잡힌다
      const flags: Record<string, boolean> = { pin: true, [`tier-${c.tier}`]: true, locked: !unlocked.includes(c.region), here: c.id === cityId, done, sel: selected === c.id };
      for (const [k, v] of Object.entries(flags)) el.classList.toggle(k, v);
      const stamp = el.querySelector('.stamp');
      if (done && !stamp) { const s = document.createElement('div'); s.className = 'stamp'; s.textContent = 'VISÉ'; el.appendChild(s); }
    }
    // 현재 도시에서 갈 수 있는 노선
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      const src = map.getSource('edges') as GeoJSONSource | undefined;
      if (!src) return;
      const here = cityById(cityId);
      src.setData({ type: 'FeatureCollection', features: edgesFrom(cityId).filter((e) => unlocked.includes(cityById(e.to).region)).map((e) => ({
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [here.coord, cityById(e.to).coord] },
      })) });
      const fogSrc = map.getSource('fog') as GeoJSONSource | undefined;
      if (fogSrc) {
        fogSrc.setData({
          type: 'FeatureCollection',
          features: CITIES.filter((c) => !unlocked.includes(c.region)).map((c) => ({
            type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [fogCircle(c.coord, c.tier === 'S' ? 55 : 35)] },
          })),
        });
      }
    };
    if (map.isStyleLoaded()) draw(); else map.once('idle', draw);
  }, [cityId, unlocked, stamps, selected, lang]);

  // 이동 애니메이션
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !travelling) return;
    const from = cityById(travelling.edge.from).coord;
    const to = cityById(travelling.edge.to).coord;
    const el = document.createElement('div');
    el.className = 'traveller';
    el.textContent = travelling.edge.mode === 'tgv' || travelling.edge.mode === 'eurostar' ? '🚄' : travelling.edge.mode === 'bus' ? '🚌' : travelling.edge.mode === 'metro' ? '🚇' : '🚆';
    const mk = new maplibregl.Marker({ element: el }).setLngLat(from).addTo(map);
    traveller.current = mk;
    const route = map.getSource('route') as GeoJSONSource | undefined;
    route?.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [from, to] } }] });
    map.fitBounds([[Math.min(from[0], to[0]), Math.min(from[1], to[1])], [Math.max(from[0], to[0]), Math.max(from[1], to[1])]], { padding: 120, duration: 800, maxZoom: 10 });
    const dur = Math.min(4000, 1500 + travelling.edge.minutes * 20);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      mk.setLngLat([from[0] + (to[0] - from[0]) * ease, from[1] + (to[1] - from[1]) * ease]);
      if (p < 1) raf = requestAnimationFrame(tick);
      else mk.remove();
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); mk.remove(); };
  }, [travelling]);

  // 해금 지역이 늘거나 도착하면 열린 도시 전체가 보이도록
  const unlockedKey = unlocked.join(',');
  useEffect(() => {
    const map = mapRef.current;
    if (!map || travelling) return;
    const pts = CITIES.filter((c) => unlocked.includes(c.region)).map((c) => c.coord);
    const lons = pts.map((p) => p[0]); const lats = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 45, duration: 1200, maxZoom: 10 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedKey, cityId, travelling]);

  const flyToRegion = (id: RegionId) => {
    const map = mapRef.current;
    const pts = CITIES.filter((c) => c.region === id).map((c) => c.coord);
    if (!map || !pts.length) return;
    const lons = pts.map((p) => p[0]); const lats = pts.map((p) => p[1]);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 70, duration: 1000, maxZoom: 11 });
  };
  const stampedCount = new Set(stamps.map((s) => s.cityId)).size;

  return (
    <div className="map-wrap">
      <div className="map" ref={ref} />
      <div className="map-legend">
        <div className="map-legend-head"><span className="eyebrow">{display("CARNET · 세계지도")}</span><b>{display(stampedCount)} / {display(CITIES.length)} {t('도시 취재 완료')}</b></div>
        <div className="map-legend-tiers">
          <span><i className="dot tier-S" />{t(TIER_LABEL.S)}</span>
          <span><i className="dot tier-A" />{t(TIER_LABEL.A)}</span>
          <span><i className="dot tier-H" />{t(TIER_LABEL.H)}</span>
          <span><i className="dot locked" />{t('안개 · 잠긴 지역')}</span>
        </div>
        {display(zoomTier === 'world' && <div className="map-legend-hint">{t('확대하면 거점·유산 도시 이름도 보여요.')}</div>)}
        <div className="map-legend-regions">
          {display((Object.keys(REGIONS) as RegionId[]).map((id) => {
            const open = unlocked.includes(id);
            const count = CITIES.filter((c) => c.region === id).length;
            return (
              <button key={id} className={`map-region${open ? '' : ' locked'}`} disabled={!open} onClick={() => flyToRegion(id)}>
                <span>{display(open ? '' : '🔒 ')}{t(REGIONS[id].name)}</span><small>{display(count)}{t('개 도시')}</small>
              </button>
            );
          }))}
        </div>
      </div>
    </div>
  );
}
