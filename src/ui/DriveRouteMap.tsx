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
  const lastCamera = useRef(0);
  const city = cityById(cityId);
  const origin = city.pois.find((p) => p.coord?.[0] === from[0] && p.coord?.[1] === from[1]);
  useEffect(() => {
    if (!container.current) return;
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
    const timer = window.setTimeout(() => controller.abort(), 7000);
    let disposed = false;
    const fit = (coords: Coord[]) => {
      const bounds = new maplibregl.LngLatBounds(); coords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: { top: 100, bottom: 60, left: 60, right: 60 }, maxZoom: 15, duration: 0 });
    };
    map.once('load', async () => {
      if (disposed) return;
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
        route.current = coords; carRef.current?.setLngLat(routePoint(coords, progress)); setLength(routeLength(coords)); setStatus('실제 도로 경로');
        (map.getSource('drive-route') as maplibregl.GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } });
        map.setPaintProperty('drive-route-line', 'line-dasharray', [1, 0]); fit(coords);
      } catch { if (!disposed) setStatus('도로 연결 불가 · 점선은 직선 안내'); }
      finally { window.clearTimeout(timer); }
    });
    const resize = new ResizeObserver(() => map.resize()); resize.observe(container.current);
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); resize.disconnect(); markers.forEach((m) => m.remove()); map.remove(); mapRef.current = null; carRef.current = null; };
  }, [cityId, from[0], from[1], to[0], to[1], destination]);
  useEffect(() => {
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
    <div className="drive-navigation-heading"><small>{city.names.ko} · {status}</small><strong>{origin?.name.split('(')[0] ?? `${city.names.ko} 중심`} → {destination}</strong><span>남은 거리 {(length * (1 - progress) / 1000).toFixed(1)} km · {Math.round(progress * 100)}%</span></div>
    <div className="drive-map-actions"><button onClick={overview} aria-pressed={!follow}>전체 경로</button><button onClick={() => setFollow(true)} aria-pressed={follow}>내 차 따라가기</button></div>
  </section>;
}
