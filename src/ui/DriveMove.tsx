import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import { setEngineIntensity, sfxArrive, startEngine, stopEngine } from '../audio';
import { useT } from '../i18n';

const STYLE_PRIMARY = 'https://tiles.openfreemap.org/styles/positron';
// 공개 데모 라우팅 서버 — 실제 도로망을 따르는 경로를 계산해준다. 실서비스에서는
// 자체 호스팅 OSRM/Valhalla로 교체해야 한다(속도 제한·가용성이 데모용이라 낮다).
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
// 실제 거리와 무관하게 한 구간의 운전이 대략 이 시간(초) 안에 끝나도록 "게임 속도"를 역산한다 —
// 실제 축척의 이동 시뮬레이션이 아니라 미션 템포에 맞춘 짧은 아케이드 구간이기 때문.
// 계기판에는 이 값을 그대로 보여주지 않고 20~80km/h 사이 그럴듯한 숫자로 따로 환산한다.
const TARGET_SECONDS = 10;
const MIN_GAME_SPEED = 8; // m/s
const DISPLAY_MIN_KMH = 18;
const DISPLAY_MAX_KMH = 82;

function haversine([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface RouteMeta { coords: [number, number][]; cum: number[]; total: number }

function buildMeta(coords: [number, number][]): RouteMeta {
  const cum: number[] = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  return { coords, cum, total: cum[cum.length - 1] || 1 };
}

function pointAt(meta: RouteMeta, dist: number): { pos: [number, number]; bearing: number } {
  const d = Math.max(0, Math.min(dist, meta.total));
  let i = 1;
  while (i < meta.cum.length - 1 && meta.cum[i] < d) i++;
  const segStart = meta.cum[i - 1];
  const segEnd = meta.cum[i];
  const t = segEnd > segStart ? (d - segStart) / (segEnd - segStart) : 0;
  const [lon1, lat1] = meta.coords[i - 1];
  const [lon2, lat2] = meta.coords[i];
  const pos: [number, number] = [lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t];
  const bearing = (Math.atan2(lon2 - lon1, lat2 - lat1) * 180) / Math.PI;
  return { pos, bearing };
}

interface Props {
  fromCoord: [number, number];
  toCoord: [number, number];
  toLabel?: string;
  onArrive: () => void;
}

export default function DriveMove({ fromCoord, toCoord, toLabel, onArrive }: Props) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const carRef = useRef<Marker | null>(null);
  const metaRef = useRef<RouteMeta | null>(null);
  const distRef = useRef(0);
  const speedRef = useRef(0);
  const maxSpeedRef = useRef(MIN_GAME_SPEED);
  const accelRef = useRef(false);
  const arrivedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [progressPct, setProgressPct] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);

  // 경로 계산 (실패하면 직선 도로로 대체)
  useEffect(() => {
    let cancelled = false;
    arrivedRef.current = false;
    distRef.current = 0; speedRef.current = 0;
    (async () => {
      try {
        const url = `${OSRM}/${fromCoord[0]},${fromCoord[1]};${toCoord[0]},${toCoord[1]}?overview=full&geometries=geojson`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
        if (!res.ok) throw new Error('osrm-http');
        const data = await res.json();
        const coords: [number, number][] | undefined = data.routes?.[0]?.geometry?.coordinates;
        if (!coords || coords.length < 2) throw new Error('no-route');
        if (cancelled) return;
        metaRef.current = buildMeta(coords);
        maxSpeedRef.current = Math.max(MIN_GAME_SPEED, metaRef.current.total / TARGET_SECONDS);
        setStatus('ready');
      } catch {
        if (cancelled) return;
        metaRef.current = buildMeta([fromCoord, toCoord]);
        maxSpeedRef.current = Math.max(MIN_GAME_SPEED, metaRef.current.total / TARGET_SECONDS);
        setStatus('fallback');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCoord[0], fromCoord[1], toCoord[0], toCoord[1]]);

  // 지도 초기화 (경로가 준비된 뒤 1회)
  useEffect(() => {
    if (!ref.current || status === 'loading' || mapRef.current) return;
    const meta = metaRef.current!;
    const map = new maplibregl.Map({ container: ref.current, style: STYLE_PRIMARY, center: fromCoord, zoom: 16, attributionControl: { compact: true } });
    mapRef.current = map;
    map.scrollZoom.disable();
    map.dragRotate.disable();
    map.dragPan.disable();
    map.doubleClickZoom.disable();
    map.once('load', () => {
      map.addSource('drive-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: meta.coords } } });
      map.addLayer({ id: 'drive-route-casing', type: 'line', source: 'drive-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2b241c', 'line-width': 7 } });
      map.addLayer({ id: 'drive-route-fill', type: 'line', source: 'drive-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f2c14e', 'line-width': 3, 'line-dasharray': [2, 2] } });
      const destEl = document.createElement('div');
      destEl.className = 'poi-pin target';
      destEl.innerHTML = `<div class="dot"></div><div class="lbl">${toLabel ?? ''}</div>`;
      new maplibregl.Marker({ element: destEl, anchor: 'bottom' }).setLngLat(toCoord).addTo(map);
      const carEl = document.createElement('div');
      carEl.className = 'drive-car';
      carEl.textContent = '🚗';
      carRef.current = new maplibregl.Marker({ element: carEl, anchor: 'center' }).setLngLat(fromCoord).addTo(map);
      const bounds = meta.coords.reduce(
        (b, c) => [[Math.min(b[0][0], c[0]), Math.min(b[0][1], c[1])], [Math.max(b[1][0], c[0]), Math.max(b[1][1], c[1])]] as [[number, number], [number, number]],
        [fromCoord, fromCoord] as [[number, number], [number, number]],
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 0 });
    });
    startEngine();
    return () => { map.remove(); mapRef.current = null; stopEngine(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // 물리 루프
  useEffect(() => {
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const meta = metaRef.current;
      if (meta && !arrivedRef.current && mapRef.current) {
        const maxSpeed = maxSpeedRef.current;
        const accel = maxSpeed / 1.3;
        const decel = maxSpeed / 0.9;
        speedRef.current = accelRef.current
          ? Math.min(maxSpeed, speedRef.current + accel * dt)
          : Math.max(0, speedRef.current - decel * dt);
        distRef.current = Math.min(meta.total, distRef.current + speedRef.current * dt);
        const { pos, bearing } = pointAt(meta, distRef.current);
        carRef.current?.setLngLat(pos);
        const el = carRef.current?.getElement();
        if (el) el.style.setProperty('--heading', `${bearing}deg`);
        mapRef.current.setCenter(pos);
        const speedFrac = speedRef.current / maxSpeed;
        setEngineIntensity(speedFrac);
        setProgressPct(Math.min(100, Math.round((distRef.current / meta.total) * 100)));
        setSpeedKmh(speedFrac < 0.02 ? 0 : Math.round(DISPLAY_MIN_KMH + speedFrac * (DISPLAY_MAX_KMH - DISPLAY_MIN_KMH)));
        if (distRef.current >= meta.total) {
          arrivedRef.current = true;
          stopEngine();
          sfxArrive();
          setTimeout(onArrive, 500);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // 키보드 조작(데스크톱)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') accelRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') accelRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  return (
    <div className="drive-wrap">
      <div className="drive-map" ref={ref} />
      {status === 'loading' && <div className="drive-note">{t('경로를 찾는 중…')}</div>}
      {status === 'fallback' && <div className="drive-note">{t('실시간 경로를 불러오지 못해 직선 도로로 대신합니다.')}</div>}
      <div className="drive-hud">
        <div className="drive-progress"><i style={{ width: `${progressPct}%` }} /></div>
        <div className="drive-speed">{speedKmh} km/h</div>
      </div>
      <button
        className="drive-pedal"
        onPointerDown={(e) => { e.preventDefault(); accelRef.current = true; }}
        onPointerUp={() => { accelRef.current = false; }}
        onPointerLeave={() => { accelRef.current = false; }}
        onPointerCancel={() => { accelRef.current = false; }}
      >{t('가속 ▲')}</button>
    </div>
  );
}
