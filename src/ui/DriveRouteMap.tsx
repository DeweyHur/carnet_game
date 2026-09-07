import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { cityById } from '../data/cities';
import { routePoint, routeLength } from '../game/driveRoute';
maplibregl.setWorkerUrl(workerUrl);

type Coord = [number, number];
interface Props { cityId: string; from: Coord; to: Coord; destination: string; progress: number }

export default function DriveRouteMap({ cityId, from, to, destination, progress }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const carRef = useRef<Marker | null>(null);
  const route = useRef<Coord[]>([from, to]);
  const [length, setLength] = useState(routeLength([from, to]));
  const [status, setStatus] = useState('도로 경로 확인 중');
  const [follow, setFollow] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const progressRef = useRef(progress);
  const lastCamera = useRef(0);
  const city = cityById(cityId);
  const origin = city.pois.find((p) => p.coord?.[0] === from[0] && p.coord?.[1] === from[1]);
  const [fromLng, fromLat] = from, [toLng, toLat] = to;
  useEffect(() => {
    if (!container.current) return;
    const from: Coord = [fromLng, fromLat], to: Coord = [toLng, toLat], city = cityById(cityId);
    const map = new maplibregl.Map({ container: container.current, style: 'https://tiles.openfreemap.org/styles/positron', center: from, zoom: 13, attributionControl: { compact: true } });
    mapRef.current = map;
    map.dragRotate.disable(); map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
    const markers: Marker[] = [];
    const pin = (coord: Coord, text: string, className: string) => {
      const el = document.createElement('div'); el.className = className; el.textContent = text;
      const marker = new maplibregl.Marker({ element: el }).setLngLat(coord).addTo(map); markers.push(marker); return marker;
    };
    for (const poi of city.pois) if (poi.coord) pin(poi.coord, poi.name.split('(')[0], 'drive-place-pin');
    pin(from, '출발', 'drive-endpoint origin'); pin(to, `도착 · ${destination}`, 'drive-endpoint');
    carRef.current = pin(from, '🚗', 'drive-map-car');
    const controller = new AbortController();
    const timer = window.setTimeout(() => { controller.abort(); if (!map.isStyleLoaded()) setStatus('지도 연결 불가 · 직선 안내'); }, 7000);
    let disposed = false;
    map.on('error', () => { if (!disposed && !map.isStyleLoaded()) setStatus('지도 연결 불가 · 직선 안내'); });
    const fit = (coords: Coord[]) => {
      const bounds = new maplibregl.LngLatBounds(); coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: { top: 100, bottom: 60, left: 60, right: 60 }, maxZoom: 15, duration: 0 });
    };
    map.once('load', async () => {
      if (disposed) return;
      setMapReady(true);
      fit([from, to]);
      map.addSource('drive-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [from, to] } } });
      map.addLayer({ id: 'drive-route-shadow', source: 'drive-route', type: 'line', paint: { 'line-color': '#ffffff', 'line-width': 10 } });
      map.addLayer({ id: 'drive-route-line', source: 'drive-route', type: 'line', paint: { 'line-color': '#268674', 'line-width': 5, 'line-dasharray': [2, 1] } });
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.join(',')};${to.join(',')}?overview=full&geometries=geojson`, { signal: controller.signal });
        if (!response.ok) throw new Error('route');
        const body = await response.json();
        const coords = body.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2 || !coords.every((c: unknown) => Array.isArray(c) && c.length >= 2 && c.every(Number.isFinite))) throw new Error('route');
        if (disposed) return;
        route.current = coords; carRef.current?.setLngLat(routePoint(coords, progressRef.current)); setLength(routeLength(coords)); setStatus('실제 도로 경로');
        (map.getSource('drive-route') as maplibregl.GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
        map.setPaintProperty('drive-route-line', 'line-dasharray', [1, 0]); fit(coords);
      } catch { if (!disposed) setStatus('도로 연결 불가 · 점선은 직선 안내'); }
      finally { window.clearTimeout(timer); }
    });
    const resize = new ResizeObserver(() => map.resize()); resize.observe(container.current);
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); resize.disconnect(); markers.forEach((m) => m.remove()); map.remove(); mapRef.current = null; carRef.current = null; };
  }, [cityId, fromLng, fromLat, toLng, toLat, destination]);
  useEffect(() => {
    progressRef.current = progress;
    const position = routePoint(route.current, progress);
    carRef.current?.setLngLat(position);
    if (follow && performance.now() - lastCamera.current > 600) {
      mapRef.current?.easeTo({ center: position, zoom: 15.5, duration: 600 }); lastCamera.current = performance.now();
    }
  }, [progress, follow]);
  const overview = () => {
    setFollow(false); const bounds = new maplibregl.LngLatBounds(); route.current.forEach((c) => bounds.extend(c));
    mapRef.current?.fitBounds(bounds, { padding: { top: 100, bottom: 60, left: 60, right: 60 }, maxZoom: 15, duration: 400 });
  };
  return <section className="drive-navigation" aria-label="실제 도시 위 운전 경로">
    <div className="drive-route-map" ref={container} />
    {!mapReady && <RouteOverview from={from} to={to} progress={progress} cityId={cityId} />}
    <div className="drive-navigation-heading"><small>{city.names.ko} · {status}</small><strong>{origin?.name.split('(')[0] ?? `${city.names.ko} 중심`} → {destination}</strong><span>남은 거리 {(length * (1 - progress) / 1000).toFixed(1)} km · {Math.round(progress * 100)}%</span></div>
    <div className="drive-map-actions"><button onClick={overview} aria-pressed={!follow}>전체 경로</button><button onClick={() => setFollow(true)} aria-pressed={follow}>내 차 따라가기</button></div>
  </section>;
}

/** Local coordinate overview remains useful when map tiles are unavailable. */
function RouteOverview({ from, to, progress, cityId }: { from: Coord; to: Coord; progress: number; cityId: string }) {
  const pois = cityById(cityId).pois.filter((p) => p.coord);
  const points = [from, to, ...pois.map((p) => p.coord!)];
  const minX = Math.min(...points.map((p) => p[0])), maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1])), maxY = Math.max(...points.map((p) => p[1]));
  const xy = (p: Coord) => [35 + (p[0] - minX) / Math.max(.001, maxX - minX) * 290, 240 - (p[1] - minY) / Math.max(.001, maxY - minY) * 150];
  const a = xy(from), b = xy(to), car = xy(routePoint([from, to], progress));
  return <svg className="drive-route-fallback" viewBox="0 0 360 310" role="img" aria-label="출발지와 목적지의 실제 좌표를 잇는 직선 안내. 도로 경로가 아닙니다.">
    <defs><pattern id="drive-coordinate-grid" width="30" height="30" patternUnits="userSpaceOnUse"><path d="M 30 0 L 0 0 0 30" fill="none" stroke="#b9cabe" strokeWidth=".5" /></pattern></defs>
    <rect width="360" height="310" fill="#e5ecdf" /><rect width="360" height="310" fill="url(#drive-coordinate-grid)" />
    {pois.map((poi) => { const p = xy(poi.coord!); return <g key={poi.id}><circle cx={p[0]} cy={p[1]} r="3" fill="#84a392" /><text x={p[0]} y={p[1] - 7} textAnchor="middle" fill="#526e63" fontSize="6">{poi.name.split('(')[0]}</text></g>; })}
    <path d={`M${a.join(',')} L${b.join(',')}`} fill="none" stroke="#278672" strokeWidth="3" strokeDasharray="6 5" />
    <circle cx={a[0]} cy={a[1]} r="5" fill="#ab7844" /><circle cx={b[0]} cy={b[1]} r="7" fill="#278672" />
    <circle cx={car[0]} cy={car[1]} r="7" fill="#f5bd63" stroke="#fffdf0" strokeWidth="3" />
    <text x="180" y="278" textAnchor="middle" fill="#4d6a5c" fontSize="9">좌표 기반 직선 안내 · 실제 도로 경로와 다릅니다</text>
  </svg>;
}
