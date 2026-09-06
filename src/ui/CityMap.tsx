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

export default function CityMap({ cityId, highlightId, readOnly, onSelectPoi, controls = true }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const visitedPois = useGame((s) => s.visitedPois);
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
    map.once('load', () => {
      if (highlightId) {
        const target = city.pois.find((p) => p.id === highlightId);
        if (target?.coord) map.jumpTo({ center: target.coord, zoom: 15.5 });
      } else {
        map.fitBounds(bounds, { padding: 46, maxZoom: 15, duration: 0 });
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
      el.className = `poi-pin${p.id === highlightId ? ' target' : ''}${visited ? ' visited' : ''}`;
      el.innerHTML = `<div class="dot"></div><div class="lbl">${p.name.replace(/\s*\([^)]*\)/g, '')}</div>`;
      if (!readOnly && onSelectPoi) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (ev) => { ev.stopPropagation(); onSelectPoi(p.id); });
      }
      const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(coord).addTo(map);
      markers.current[p.id] = m;
    }

    return () => { Object.values(markers.current).forEach((m) => m.remove()); markers.current = {}; map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, highlightId, controls]);

  useEffect(() => {
    for (const p of city.pois) {
      const el = markers.current[p.id]?.getElement();
      if (!el) continue;
      el.classList.toggle('visited', visitedPois.includes(`${cityId}:${p.id}`));
    }
  }, [visitedPois, cityId, city.pois]);

  return <div className="city-map" ref={ref} />;
}
