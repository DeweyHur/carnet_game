import { translateDisplay as display } from '../i18n';
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MLMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import { cityById } from '../data/cities';
import { PARIS_ARRONDISSEMENTS } from '../data/parisArrondissements';
import type { Poi } from '../game/types';
import { useGame } from '../game/store';

const STYLE_PRIMARY = 'https://tiles.openfreemap.org/styles/positron';

interface Props {
  cityId: string;
  /** 강조할 장소(현재 미션의 목적지 등). 펄스로 표시된다. */
  highlightId?: string;
  /** 미션 도보 동선의 출발지(직전에 들른 장소). highlightId와 함께 주면 두 지점을 잇는 점선을 그린다. */
  routeFromId?: string;
  /** 지도를 접어 보기 전용으로만 쓸 때(핀 클릭 무시) */
  readOnly?: boolean;
  onSelectPoi?: (poiId: string) => void;
  /** 확대/축소 버튼 표시 여부 (미션 무대에서는 숨긴다) */
  controls?: boolean;
}

function poiBounds(pois: Poi[], fallback: [number, number]): [[number, number], [number, number]] {
  const coords = pois.map((p) => p.coord).filter((c): c is [number, number] => !!c);
  if (!coords.length) return [fallback, fallback];
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]];
}

export default function CityMap({ cityId, highlightId, routeFromId, readOnly, onSelectPoi, controls = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const visitedPois = useGame((s) => s.visitedPois);
  const lang = useGame((s) => s.lang);
  const city = cityById(cityId);
  const isParis = cityId === 'paris';

  useEffect(() => {
    if (!ref.current) return;
    const bounds = poiBounds(city.pois, city.coord);
    const map = new maplibregl.Map({
      container: ref.current, style: STYLE_PRIMARY, center: city.coord, zoom: 12, attributionControl: { compact: true },
    });
    mapRef.current = map;
    if (controls) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.scrollZoom.disable();
    map.dragRotate.disable();
    const target = highlightId ? city.pois.find((p) => p.id === highlightId) : undefined;
    const origin = routeFromId ? city.pois.find((p) => p.id === routeFromId) : undefined;
    map.once('load', () => {
      if (target?.coord && origin?.coord) {
        const lons = [target.coord[0], origin.coord[0]];
        const lats = [target.coord[1], origin.coord[1]];
        map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 70, maxZoom: 16, duration: 0 });
      } else if (target?.coord) {
        map.jumpTo({ center: target.coord, zoom: 15.5 });
      } else {
        map.fitBounds(bounds, { padding: 46, maxZoom: 15, duration: 0 });
      }
      if (target?.coord && origin?.coord) {
        map.addSource('walk-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [origin.coord, target.coord] } } });
        map.addLayer({ id: 'walk-route', type: 'line', source: 'walk-route', paint: { 'line-color': '#b5482f', 'line-width': 2.5, 'line-dasharray': [1, 1.6] } });
      }
    });

    if (isParis) {
      map.on('load', () => {
        for (const a of PARIS_ARRONDISSEMENTS) {
          const el = document.createElement('div');
          el.className = 'arr-label';
          el.textContent = `${a.num}e`;
          new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(a.coord).addTo(map);
        }
      });
    }

    for (const p of city.pois) {
      const coord = p.coord ?? city.coord;
      const el = document.createElement('div');
      const visited = visitedPois.includes(`${cityId}:${p.id}`);
      el.className = `poi-pin${p.id === highlightId ? ' target' : ''}${p.id === routeFromId ? ' origin' : ''}${visited ? ' visited' : ''}`;
      el.innerHTML = '<div class="dot"></div><div class="lbl"></div>';
      el.querySelector('.lbl')!.textContent = display(p.name).replace(/\s*\([^)]*\)/g, '');
      if (!readOnly && onSelectPoi) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (ev) => { ev.stopPropagation(); onSelectPoi(p.id); });
      }
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(coord).addTo(map);
      markers.current[p.id] = m;
    }

    return () => { Object.values(markers.current).forEach((m) => m.remove()); markers.current = {}; map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, highlightId, routeFromId, controls]);

  useEffect(() => {
    for (const p of city.pois) {
      const el = markers.current[p.id]?.getElement();
      if (!el) continue;
      el.classList.toggle('visited', visitedPois.includes(`${cityId}:${p.id}`));
      el.querySelector('.lbl')!.textContent = display(p.name).replace(/\s*\([^)]*\)/g, '');
    }
  }, [visitedPois, cityId, city.pois, lang]);

  return <div className="city-map" ref={ref} />;
}
