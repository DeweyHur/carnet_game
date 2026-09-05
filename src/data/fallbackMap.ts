import type { StyleSpecification } from 'maplibre-gl';

// 오프라인/네트워크 차단 시 쓰는 대체 스타일: 프랑스 본토의 아주 거친 윤곽선.
// (실서비스는 PMTiles 자체 호스팅으로 항상 실제 벡터 타일을 제공한다 — 기획서 §3.1)
const FRANCE: [number, number][] = [
  [2.38, 51.03], [1.85, 50.95], [1.6, 50.72], [1.37, 50.06], [1.08, 49.92], [0.1, 49.49], [-0.3, 49.33], [-1.62, 49.65],
  [-1.6, 48.83], [-1.5, 48.63], [-2.0, 48.65], [-4.5, 48.4], [-4.75, 48.03], [-4.1, 47.9], [-3.4, 47.7], [-2.75, 47.6],
  [-2.2, 47.27], [-2.0, 47.1], [-1.15, 46.16], [-1.25, 45.0], [-1.55, 43.48], [-1.78, 43.36], [-0.3, 42.8], [0.7, 42.8],
  [1.8, 42.5], [3.05, 42.45], [3.0, 43.1], [3.9, 43.5], [5.4, 43.3], [5.9, 43.1], [7.27, 43.7], [7.5, 43.78], [7.0, 44.2],
  [6.9, 45.0], [7.1, 45.8], [6.1, 46.2], [6.0, 46.4], [6.5, 46.9], [7.05, 47.5], [7.6, 47.58], [7.6, 48.0], [8.2, 48.9],
  [8.2, 49.0], [6.6, 49.2], [6.0, 49.45], [5.8, 49.55], [4.9, 49.8], [4.2, 50.0], [4.1, 50.1], [3.7, 50.35], [3.1, 50.78],
  [2.55, 51.09], [2.38, 51.03],
];
const SEINE: [number, number][] = [[0.1, 49.49], [0.6, 49.45], [1.1, 49.44], [1.5, 49.2], [2.0, 49.0], [2.25, 48.95], [2.35, 48.86], [2.5, 48.82], [3.0, 48.6], [3.7, 48.4]];
const LOIRE: [number, number][] = [[-2.2, 47.27], [-1.55, 47.2], [-0.6, 47.4], [0.7, 47.4], [1.9, 47.9], [2.4, 47.9], [2.9, 47.5]];

export const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    land: { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [FRANCE] } } },
    rivers: { type: 'geojson', data: { type: 'FeatureCollection', features: [SEINE, LOIRE].map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })) } },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#c9d6d3' } },
    { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': '#efe6cf', 'fill-outline-color': '#a89b7a' } },
    { id: 'rivers', type: 'line', source: 'rivers', paint: { 'line-color': '#9fb8c4', 'line-width': 1.5 } },
  ],
};
