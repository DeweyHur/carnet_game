// Carnet 걷기 게임(메인 페이지) — "걷다가 눈에 들어온다"가 재미있는지 확인하기 위한 실험.
// 질문하지 않는다. 어디로 걸었고, 어디서 멈췄고, 무엇을 지나쳤는지만 기록한다.
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap, Marker, StyleSpecification } from 'maplibre-gl';
import type { Feature } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import './walk.css';
import { bearing, buildGraph, dist, nearestNode, route } from './graph';
import type { Graph, LngLat } from './graph';
import { CAT_INFO, TASTE_OF, parsePlaces } from './places';
import type { Place, Taste } from './places';
import { loadDistrict } from './data';
import { DISTRICTS, otherDistricts, planJourney, planOptions, stopPos, LINES } from './districts';
import type { District, Gate, Journey } from './districts';
import { ALL_RICH } from './rich';
import { openMetro } from './metro';
import { openDestination } from './destination';
import { openArrival, openMorning } from './arrival';
import type { Stay } from './stays';
import { bodyLine, drain, eat, level, paceFactor, rest, sightFactor, LIBERTE_CARD } from './trip';
import type { Pass } from './trip';
import type { Dest } from './destination';
import type { MetroMap } from './metro';
import * as sfx from './sound';
import { menuFor } from './content';
import { describe } from './generic';
import type { Dish } from './content';
import { openMenu, openVisit } from './inside';
import type { Shot } from './inside';

maplibregl.setWorkerUrl(workerUrl);

let district: District = DISTRICTS.marais;
const START: LngLat = district.start; // 메트로 1호선 Saint-Paul 출구 부근
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const VISION = 45; // m — 이 안에 들어와야 가게가 "눈에 띈다"
const NEAR = 70; // m — 이 안에 있어야 들어갈 수 있다
const WALK_MPS = 1.35; // 실제 보행 속도
const TIME_SCALE = 9; // 화면에서는 9배속으로 걷는다
// 카메라: 걸을 때는 바짝 당겨 골목이 보이게, 멈추면 물러나 어디로 갈지 고르게
const CAM_WALK = { zoom: 18.6, pitch: 64 };
const CAM_LOOK = { zoom: 17.0, pitch: 48 };
// 시선 모드: 카메라를 눈높이(1.7m)에 두고 거의 수평으로 본다. 걷기 시작하면 위에서 내려와 눈높이로 붙는다.
// 3인칭 시점: 카메라를 내 뒤(back m)·위(alt m)에 두고 진행 방향을 내려다본다. 플레이어 모델은 없다.
// pitch는 84까지만 안정적(그 이상은 MapLibre가 지평선 너머로 중심을 잡아 깨진다)
const EYE = { alt: 5.5, back: 9, pitch: 76, blendSecs: 3.2 }; // 걷기 시작하면 지금 카메라에서 이 시점까지 blendSecs 동안 부드럽게
// 시야: 걷는 동안은 진행 방향 ±FOV° 안, SIGHT m 이내, 지금 걷는 길에서 STREET m 이내의 가게만 보인다.
const FOV = 70;
const SIGHT = 60;
const STREET = 24;
let eyeMode = (() => { try { return localStorage.getItem('carnet-walk-eye') !== '0'; } catch { return true; } })();
let walkStartedAt = 0;
let camFrom: { center: LngLat; zoom: number; pitch: number; bearing: number } | null = null; // 걷기 시작 순간의 카메라
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

interface Visit { place: Place; at: number; mins: number; cost: number; dishes?: Dish[]; seen?: number; total?: number }
const S = {
  pos: START as LngLat,
  node: 0,
  path: [] as LngLat[],
  seg: 0,
  target: null as Place | null,
  clock: 7 * 60 + 40, // 공항 도착
  money: 320, // 오늘 쓸 수 있는 돈
  hunger: 35, // 기내식 먹고 몇 시간 지난 상태
  tired: 20,
  stay: null as Stay | null,
  pass: 'single' as Pass,
  fares: 0, // 오늘 교통비
  ate: 0, // 오늘 먹은 횟수
  walked: 0,
  heading: 0,
  seen: new Map<string, number>(),
  opened: new Set<string>(),
  saved: new Set<string>(),
  visits: [] as Visit[],
  legs: [] as ('place' | 'wander')[],
  shots: [] as Shot[],
  trail: [START] as LngLat[],
  origin: START as LngLat,
  travelTo: null as Dest | null,
  travelGate: null as Gate | null,
  restAt: false,
  dest: null as Dest | null,
  started: false,
  finished: false,
};

/** 지구를 옮겨도 남는 것: 본 곳·들른 곳을 나중에 다시 찾으려면 필요하다 */
const allPlaces = new Map<string, Place>();

let map: MlMap;
let graph: Graph;
let places: Place[] = [];
let avatar: Marker;
const markers = new Map<string, Marker>();
let openPlace: Place | null = null;

const fmtClock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const line = (coords: LngLat[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } });

function circle(center: LngLat, r: number) {
  const pts: LngLat[] = [];
  const dLat = r / 111320;
  const dLng = r / (111320 * Math.cos((center[1] * Math.PI) / 180));
  for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; pts.push([center[0] + Math.cos(a) * dLng, center[1] + Math.sin(a) * dLat]); }
  return { type: 'Feature' as const, properties: {}, geometry: { type: 'Polygon' as const, coordinates: [pts] } };
}

async function resolveStyle(): Promise<{ style: StyleSpecification; fallback: boolean }> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(STYLE_URL, { signal: ctl.signal });
    clearTimeout(timer);
    if (r.ok) return { style: await r.json(), fallback: false };
  } catch { /* 폴백 */ }
  return { style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#efe9dc' } }] }, fallback: true };
}

async function boot() {
  const status = $('#status');
  try {
    const [data, st] = await Promise.all([loadDistrict(district, (s) => (status.textContent = s)), resolveStyle()]);
    const ways = data.ways;
    graph = buildGraph(ways);
    places = parsePlaces(data.places, district.curated, ALL_RICH);
    for (const p of places) allPlaces.set(p.id, p);
    if (graph.nodes.length < 50) throw new Error('거리 그래프가 비어 있습니다.');
    S.node = nearestNode(graph, district.start);
    S.pos = graph.nodes[S.node];
    S.trail = [S.pos];
    S.origin = S.pos;

    map = new maplibregl.Map({ container: 'map', style: st.style, center: S.pos, zoom: 18.4, pitch: 25, bearing: -20, attributionControl: { compact: true }, maxPitch: 85, maxZoom: 24, clickTolerance: 10 }); // 살짝 끌린 손가락은 클릭으로 치지 않는다
    map.on('load', () => {
      dressMap(st.fallback, ways);
      status.textContent = '';
      $('#go').removeAttribute('disabled');
      $('#go').textContent = '파리에 도착했다';
    });
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : String(e);
  }
}

function dressMap(fallback: boolean, ways: LngLat[][]) {
  const layers = map.getStyle().layers ?? [];
  // 눈높이에서 지평선 위가 비지 않게 하늘을 칠한다
  map.setSky({ 'sky-color': '#a9c9ec', 'horizon-color': '#efe3d2', 'fog-color': '#efe3d2', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.9 });
  // 기본 지도의 가게·명소 라벨을 끈다. 걸어가서 봐야 보인다.
  for (const l of layers) if ('source-layer' in l && l['source-layer'] === 'poi') map.setLayoutProperty(l.id, 'visibility', 'none');
  if (!fallback && !layers.some((l) => l.type === 'fill-extrusion')) {
    const src = Object.entries(map.getStyle().sources).find(([, s]) => s.type === 'vector')?.[0];
    if (src) map.addLayer({ id: 'walk-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 14,
      paint: { 'fill-extrusion-color': '#e6dccb', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12], 'fill-extrusion-opacity': 0.85 } });
  }
  if (fallback) {
    map.addSource('streets', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: ways } } });
    map.addLayer({ id: 'streets', type: 'line', source: 'streets', paint: { 'line-color': '#fff', 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  }
  // 눈에 들어온 가게의 건물을 색칠하는 층(아이콘 대신). 건물 폴리곤은 타일에서 찾아 온다.
  map.addSource('hl', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'hl', type: 'fill-extrusion', source: 'hl', paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.92 } });
  map.addSource('vision', { type: 'geojson', data: circle(S.pos, VISION) });
  map.addLayer({ id: 'vision', type: 'fill', source: 'vision', paint: { 'fill-color': '#ffd166', 'fill-opacity': 0.16 } });
  map.addSource('trail', { type: 'geojson', data: line(S.trail) });
  map.addLayer({ id: 'trail', type: 'line', source: 'trail', paint: { 'line-color': '#e4572e', 'line-width': 4, 'line-opacity': 0.55 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  map.addSource('route', { type: 'geojson', data: line([]) });
  map.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#2d6cdf', 'line-width': 5, 'line-dasharray': [0.2, 1.6] }, layout: { 'line-cap': 'round' } });
  // 지하철 구간(탈 때만 보인다)
  map.addSource('metro', { type: 'geojson', data: line([]) });
  map.addLayer({ id: 'metro', type: 'line', source: 'metro', paint: { 'line-color': '#bf3283', 'line-width': 7, 'line-opacity': 0.95 }, layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' } });

  const el = document.createElement('div');
  el.className = 'me';
  el.innerHTML = '<i></i>';
  avatar = new maplibregl.Marker({ element: el }).setLngLat(S.pos).addTo(map);

  for (const p of places) if (p.known) showMarker(p, false);
  showStationMarker();
  map.on('click', (e) => {
    if (!S.started || S.finished || metroOpen) return;
    if (openPlace) { closeCard('pass'); return; }
    // 색칠된 건물을 눌렀나? 걷는 중이면 멈춰서 바라본다.
    const hit = map.queryRenderedFeatures(e.point, { layers: ['hl'] })[0];
    const pl = hit && places.find((p) => p.id === hit.properties?.pid);
    if (pl && dist(S.pos, pl.pos) <= NEAR) { openCard(pl); return; }
    walkTo([e.lngLat.lng, e.lngLat.lat], null);
  });
}

const CAT_COLOR: Record<string, string> = { eat: '#e4572e', bakery: '#e08a2e', sweet: '#e0669c', gourmet: '#c9822c', cafe: '#b5651d', bar: '#8e3b8e', museum: '#5b4bd6', sight: '#3f7fc4', park: '#3a9d5d', shop: '#2f9e9e' };
const buildingOf = new Map<string, Feature | null>(); // place id → 건물 폴리곤(없으면 null)
const litIds = new Set<string>();

/** 그 자리의 건물 폴리곤을 타일에서 찾는다(화면에 그려진 것만 찾을 수 있다). */
function findBuilding(p: Place): Feature | null {
  if (buildingOf.has(p.id)) return buildingOf.get(p.id)!;
  const layers = (map.getStyle().layers ?? []).filter((l) => l.type === 'fill-extrusion' && l.id !== 'hl').map((l) => l.id);
  if (!layers.length) { buildingOf.set(p.id, null); return null; }
  const pt = map.project(p.pos);
  if (pt.x < 0 || pt.y < 0 || pt.x > map.getCanvas().clientWidth || pt.y > map.getCanvas().clientHeight) return null; // 아직 화면 밖 — 다음에 다시
  let f = map.queryRenderedFeatures(pt, { layers })[0];
  if (!f) {
    // 문 앞 점이 길 위에 찍힌 경우: 주변 몇 m 안의 건물을 찾는다
    const r = 10;
    f = map.queryRenderedFeatures([[pt.x - r, pt.y - r], [pt.x + r, pt.y + r]], { layers })[0];
  }
  if (!f || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) { buildingOf.set(p.id, null); return null; }
  const h = Number(f.properties?.render_height ?? f.properties?.height ?? 12) || 12;
  const feat: Feature = { type: 'Feature', geometry: f.geometry, properties: { pid: p.id, color: CAT_COLOR[p.cat] ?? '#e4572e', h: h + 0.6 } };
  buildingOf.set(p.id, feat);
  return feat;
}

function paintBuildings() {
  const feats: Feature[] = [];
  for (const id of litIds) { const f = buildingOf.get(id); if (f) feats.push(f); }
  (map.getSource('hl') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: feats });
}

function showMarker(p: Place, pop: boolean) {
  if (markers.has(p.id)) return;
  const el = document.createElement('button');
  el.className = `pl ${p.curated ? 'curated' : ''} ${p.known ? 'known' : ''} ${p.minor ? 'minor' : ''} ${pop ? 'pop' : ''}`;
  el.innerHTML = `<span class="em">${p.emoji}</span>${p.curated ? `<span class="nm"></span>` : ''}`;
  if (p.curated) el.querySelector('.nm')!.textContent = p.name;
  el.title = p.name;
  el.addEventListener('click', (ev) => { ev.stopPropagation(); openCard(p); });
  markers.set(p.id, new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(p.pos).addTo(map));
}

function look() {
  let changed = false;
  for (const p of places) {
    const vis = inSight(p);
    const m = markers.get(p.id);
    if (!vis) {
      // 시야에서 벗어나면 지도에서도 사라진다(알던 곳의 핀과 이미 들어간 곳은 남는다)
      if (m && !p.known && !S.visits.some((v) => v.place.id === p.id)) m.getElement().classList.add('off');
      if (litIds.delete(p.id)) changed = true;
      continue;
    }
    // 보이는 곳: 건물이 있으면 건물을 색칠하고, 없으면(광장·길가 노점 등) 아이콘으로
    const b = p.minor ? null : findBuilding(p);
    if (b) { if (!litIds.has(p.id)) { litIds.add(p.id); changed = true; } if (m && !p.known) m.getElement().classList.add('off'); }
    else if (m) m.getElement().classList.remove('off');
    if (S.seen.has(p.id)) continue;
    S.seen.set(p.id, S.clock);
    if (!b) { if (m) m.getElement().classList.add('pop', 'found'); else showMarker(p, true); }
    else if (p.known && m) m.getElement().classList.add('found');
    if (p.curated) { sfx.spotBig(); toast(`${p.emoji} ${p.name}`); } else sfx.spot();
  }
  if (changed) paintBuildings();
}

function walkTo(dest: LngLat, target: Place | null) {
  const to = nearestNode(graph, dest);
  if (!target && dist(graph.nodes[to], dest) > 80) { toast('거기는 길이 없어요'); return; }
  // 걷는 도중이면 지금 서 있는 곳에서 가장 가까운 노드부터 다시 잡는다.
  const from = nearestNode(graph, S.pos);
  const r = route(graph, from, to);
  if (!r || r.length < 2) { if (target) openCard(target); return; }
  S.path = [S.pos, ...r.map((i) => graph.nodes[i])];
  S.seg = 0;
  S.target = target;
  S.legs.push(target ? 'place' : 'wander');
  (map.getSource('route') as GeoJSONSource).setData(line(S.path));
  hint('');
  camera('walk');
}

let camMode: 'walk' | 'look' | '' = '';
function camera(mode: 'walk' | 'look') {
  if (camMode === mode) return;
  camMode = mode;
  const c = mode === 'walk' ? CAM_WALK : CAM_LOOK;
  // 걷는 동안은 frame()이 매 프레임 카메라를 잡고 있으므로 거기서 서서히 당긴다. 멈춰 있을 때만 easeTo.
  if (mode === 'walk') {
    walkStartedAt = performance.now();
    const c0 = map.getCenter();
    camFrom = { center: [c0.lng, c0.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
    if (eyeMode) { map.stop(); map.setCenterClampedToGround(false); avatar.getElement().classList.add('hidden'); }
  }
  if (mode === 'look') {
    map.setCenterClampedToGround(true);
    avatar.getElement().classList.remove('hidden');
    map.easeTo({ center: S.pos, zoom: c.zoom, pitch: c.pitch, elevation: 0, duration: 1300, easing: (t) => 1 - Math.pow(1 - t, 3) });
  }
}

const lerpAngle = (a: number, b: number, t: number) => a + (((b - a + 540) % 360) - 180) * t;

/** 3인칭 시점의 한 프레임: 카메라를 내 뒤·위에 놓고 진행 방향을 본다. 걷기 시작 후 blendSecs 동안은 원래 카메라에서 서서히 넘어온다. */
function eyeFrame(bearing: number) {
  if (!Number.isFinite(bearing)) bearing = S.heading || 0;
  const target = map.calculateCameraOptionsFromCameraLngLatAltRotation(offset(S.pos, bearing + 180, EYE.back), EYE.alt, bearing, EYE.pitch, 0); // roll을 빼면 NaN이 들어가 행렬이 깨진다
  const t = Math.min(1, (performance.now() - walkStartedAt) / 1000 / EYE.blendSecs);
  if (t >= 1 || !camFrom) { map.jumpTo(target); return; }
  const w = t * t * (3 - 2 * t); // smoothstep
  const tc = target.center as maplibregl.LngLat;
  map.jumpTo({
    center: [camFrom.center[0] + (tc.lng - camFrom.center[0]) * w, camFrom.center[1] + (tc.lat - camFrom.center[1]) * w],
    zoom: camFrom.zoom + ((target.zoom ?? camFrom.zoom) - camFrom.zoom) * w,
    pitch: camFrom.pitch + ((target.pitch ?? camFrom.pitch) - camFrom.pitch) * w,
    bearing: lerpAngle(camFrom.bearing, target.bearing ?? camFrom.bearing, w),
    elevation: (target.elevation ?? 0) * w,
    roll: 0,
  });
}

/** p에서 방위 brg 쪽으로 m미터 이동한 점 */
function offset(p: LngLat, brg: number, m: number): LngLat {
  const r = (brg * Math.PI) / 180;
  return [p[0] + (Math.sin(r) * m) / (111320 * Math.cos((p[1] * Math.PI) / 180)), p[1] + (Math.cos(r) * m) / 111320];
}

/** 점 q가 선분 a–b에서 얼마나 떨어져 있나(m) */
function distToSeg(q: LngLat, a: LngLat, b: LngLat): number {
  const cos = Math.cos((q[1] * Math.PI) / 180);
  const ax = (a[0] - q[0]) * cos * 111320, ay = (a[1] - q[1]) * 111320;
  const bx = (b[0] - q[0]) * cos * 111320, by = (b[1] - q[1]) * 111320;
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L)) : 0;
  const x = ax + dx * t, y = ay + dy * t;
  return Math.sqrt(x * x + y * y);
}

/** 지금 이 순간 눈에 들어오는 곳인가 */
function inSight(p: Place): boolean {
  const d = dist(S.pos, p.pos);
  const f = sightFactor(S); // 배고프면 주변이 덜 눈에 들어온다
  if (d > (S.path.length > 1 ? SIGHT : VISION) * f) return false;
  if (S.path.length > 1) {
    const rel = ((bearing(S.pos, p.pos) - S.heading + 540) % 360) - 180;
    if (Math.abs(rel) > FOV && d > 12) return false;
    // 지금 걷는 길가에 있는 것만 — 앞으로 갈 몇 구간을 기준으로 잰다
    let near = false;
    for (let i = Math.max(0, S.seg - 1); i + 1 < S.path.length && i < S.seg + 8; i++) if (distToSeg(p.pos, S.path[i], S.path[i + 1]) <= STREET) { near = true; break; }
    if (!near) return false;
  }
  return true;
}

let lastT = 0;
let stepAcc = 0;
let lookAcc = 0;
let leftFoot = false;
function frame(t: number) {
  const dt = Math.min(0.1, (t - lastT) / 1000 || 0);
  lastT = t;
  if (S.path.length > 1 && !openPlace && !S.finished) {
    let move = WALK_MPS * TIME_SCALE * dt * paceFactor(S);
    let guard = 0;
    while (move > 0 && S.seg + 1 < S.path.length && guard++ < 200) {
      const next = S.path[S.seg + 1];
      const d = dist(S.pos, next);
      if (d > 0.3) S.heading = bearing(S.pos, next);
      if (d <= move) { S.pos = next; S.seg++; move -= d; S.walked += d; S.clock += d / WALK_MPS / 60; drain(S, d / WALK_MPS / 60, d); }
      else { const k = move / d; S.pos = [S.pos[0] + (next[0] - S.pos[0]) * k, S.pos[1] + (next[1] - S.pos[1]) * k]; S.walked += move; S.clock += move / WALK_MPS / 60; drain(S, move / WALK_MPS / 60, move); move = 0; }
    }
    if (!Number.isFinite(S.pos[0]) || !Number.isFinite(S.pos[1])) { // 좌표가 깨지면 마지막 멀쩡한 노드로 되돌린다
      S.pos = S.path[Math.min(S.seg, S.path.length - 1)] ?? graph.nodes[nearestNode(graph, district.start)];
      S.path = []; toast('길을 잃었어요. 다시 골라 주세요.'); camera('look');
    }
    S.trail.push(S.pos);
    avatar.setLngLat(S.pos);
    (map.getSource('trail') as GeoJSONSource).setData(line(S.trail));
    (map.getSource('vision') as GeoJSONSource).setData(circle(S.pos, VISION));
    (map.getSource('route') as GeoJSONSource).setData(line([S.pos, ...S.path.slice(S.seg + 1)]));
    const cur = map.getBearing();
    const diff = ((S.heading - cur + 540) % 360) - 180;
    const k = Math.min(1, dt * 1.6);
    const nb = cur + diff * Math.min(1, dt * (eyeMode ? 1.5 : 1.2));
    if (eyeMode) eyeFrame(nb);
    else map.jumpTo({ center: S.pos, bearing: nb, zoom: map.getZoom() + (CAM_WALK.zoom - map.getZoom()) * k, pitch: map.getPitch() + (CAM_WALK.pitch - map.getPitch()) * k });
    stepAcc += dt;
    if (stepAcc > 0.34) { stepAcc = 0; leftFoot = !leftFoot; sfx.step(leftFoot); }
    if (S.seg + 1 >= S.path.length) arrive();
  }
  else if (S.path.length > 1 && openPlace && eyeMode && !S.finished) {
    // 걷다가 건물을 눌러 멈춘 상태: 그 건물 쪽으로 천천히 고개를 돌린다
    const want = bearing(S.pos, openPlace.pos);
    const cur = map.getBearing();
    const diff = ((want - cur + 540) % 360) - 180;
    eyeFrame(cur + diff * Math.min(1, dt * 2));
  }
  lookAcc += dt;
  if (lookAcc > 0.12 && S.started && !metroOpen) { lookAcc = 0; look(); hud(); }
  requestAnimationFrame(frame);
}

function arrive() {
  S.path = [];
  (map.getSource('route') as GeoJSONSource).setData(line([]));
  const t = S.target;
  S.target = null;
  camera('look');
  if (S.restAt) { S.restAt = false; goRest(); return; }
  if (S.travelTo) { const d = S.travelTo; const g = S.travelGate ?? nearestGate(); S.travelTo = null; S.travelGate = null; void ride(d, g); return; }
  if (t) openCard(t);
}

// ───────── 지구 사이 이동 ─────────

/** 이 지구의 모든 출입구(역이 여러 개일 수 있다) */
const allGates = (d: District) => d.stations.flatMap((st) => st.gates.map((g) => ({ st, g })));
const stationOfGate = (g: Gate) => allGates(district).find((x) => x.g === g)?.st ?? district.stations[0];

/** 지금 자리에서 가장 가까운 출입구 */
function nearestGate(onlyStation?: string): Gate {
  const list = allGates(district).filter((x) => !onlyStation || x.st.name === onlyStation);
  return (list.length ? list : allGates(district)).reduce((a, b) => (dist(S.pos, b.g.pos) < dist(S.pos, a.g.pos) ? b : a)).g;
}

/** 이 여정을 타는 곳. 지하철이면 그 역의 가까운 출입구, 버스면 정류장 자체. */
function boardingGate(j: Journey): Gate {
  const first = j.legs.find((l) => l.kind === 'ride') as Extract<Journey['legs'][number], { kind: 'ride' }> | undefined;
  if (first && LINES[first.line].mode === 'bus') {
    const pos = stopPos(first.line, j.from) ?? S.pos;
    return { ref: LINES[first.line].label, label: `${j.from} 정류장`, note: '길가 정류장. 버스가 오면 앞문으로 탄다.', pos, mins: 0 };
  }
  return nearestGate(j.from);
}

/** 목적지(동네 또는 그 동네의 한 장소)로 간다. */
function travel(dest: Dest, gate?: Gate) {
  if (!S.started || S.finished || openPlace || metroOpen) return;
  const j = dest.journey;
  const g = gate ?? boardingGate(j);
  S.dest = dest;
  // 버튼 한 번으로 순간이동하지 않는다. 지도에 찍힌 그 출입구까지 걸어가서 내려간다.
  const byBus = dest.mode === 'bus' || j.legs.some((l) => l.kind === 'ride' && LINES[l.line].mode === 'bus' && l.from === j.from);
  if (dist(S.pos, g.pos) > 12) {
    S.travelTo = dest;
    S.travelGate = g;
    walkTo(g.pos, null);
    toast(byBus ? `🚏 ${g.label}으로 걸어갑니다` : `Ⓜ ${g.label} 입구로 걸어갑니다`);
    hint(byBus ? `${g.label}까지 걸어가서 버스를 기다립니다.` : `${stationOfGate(g).name} · ${g.label} 입구까지 걸어갑니다.`);
    return;
  }
  void ride(dest, g);
}

/** 목적지 고르는 화면을 연다 */
function chooseDestination() {
  if (!S.started || S.finished || openPlace || metroOpen) return;
  void openDestination(district, otherDistricts(district.id), (from, to, goal) => planOptions(from, to, S.pos, goal, S.pass)).then((d) => {
    if (d) travel(d);
  });
}

// ───────── 지하철을 탈 때의 지도 ─────────
let metroOpen = false;
const gateMarkers: Marker[] = [];
let trainMarker: Marker | null = null;
const stopMarkers: Marker[] = [];
const exitMarkers: Marker[] = [];
let trainAnim = 0;

/** 지금 지구의 지하철 출입구를 전부 지도에 찍는다. 눌러 둔 그 구멍으로 들어간다. */
let stayMarker: Marker | null = null;
/** 숙소를 지도에 찍는다. 눌러서 돌아가 쉴 수 있다. */
function showStayMarker() {
  stayMarker?.remove();
  stayMarker = null;
  const st = S.stay;
  if (!st || st.district !== district.id) return;
  const el = document.createElement('div');
  el.className = 'mstay';
  el.innerHTML = `<span class="m">🛏</span><span class="nm"></span>`;
  el.querySelector('.nm')!.textContent = st.name;
  el.title = '숙소 — 눌러서 돌아가 쉬기';
  el.addEventListener('click', (ev) => { ev.stopPropagation(); goRest(); });
  stayMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(st.pos).addTo(map);
}

/** 숙소로 돌아가 쉰다. 멀면 먼저 걸어간다. */
function goRest() {
  const st = S.stay;
  if (!st || !S.started || S.finished || openPlace || metroOpen) return;
  if (st.district !== district.id) { toast(`${st.name}은 ${DISTRICTS[st.district].name}에 있어요`); return; }
  if (dist(S.pos, st.pos) > 20) { S.restAt = true; walkTo(st.pos, null); toast(`🛏 ${st.name}으로 돌아갑니다`); return; }
  S.clock += 45;
  rest(S, 45);
  drain(S, 45, 0);
  sfx.enter();
  toast(`${st.name}에서 45분 쉬었어요`);
  hud();
}

function showStationMarker() {
  for (const m of gateMarkers) m.remove();
  gateMarkers.length = 0;
  for (const { st, g } of allGates(district)) {
    const el = document.createElement('div');
    el.className = 'mstation';
    el.innerHTML = `<span class="m">Ⓜ</span><span class="nm"></span>`;
    el.querySelector('.nm')!.textContent = `${st.name} · ${g.label.split('—')[0].trim()}`;
    el.title = `${st.name} ${st.lines.map((l) => l + '호선').join('·')} · sortie ${g.ref}`;
    el.addEventListener('click', (ev) => { ev.stopPropagation(); chooseDestination(); });
    gateMarkers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(g.pos).addTo(map));
  }
}

const bottomPad = () => Math.round(Math.min(window.innerHeight * 0.52, 460));

/** 지하철을 보여 주는 동안은 걷기용 표시(가게 핀·자취·시야·HUD 버튼)를 치운다 */
function quietMap(on: boolean) {
  document.body.classList.toggle('metro-mode', on);
  for (const id of ['vision', 'trail', 'route']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
}

const metroMap: MetroMap = {
  ride(color, stops) {
    quietMap(true);
    (map.getSource('metro') as GeoJSONSource).setData(line(stops.map((s) => s.pos)));
    map.setPaintProperty('metro', 'line-color', color);
    map.setLayoutProperty('metro', 'visibility', 'visible');
    for (const m of stopMarkers) m.remove();
    stopMarkers.length = 0;
    stops.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = `stpin ${i === 0 ? 'from' : ''} ${i === stops.length - 1 ? 'to' : ''}`;
      el.style.setProperty('--c', color);
      el.innerHTML = `<i></i><span class="nm"></span>`;
      el.querySelector('.nm')!.textContent = s.name;
      stopMarkers.push(new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat(s.pos).addTo(map));
    });
    if (!trainMarker) {
      const el = document.createElement('div');
      el.className = 'train';
      el.textContent = '🚇';
      trainMarker = new maplibregl.Marker({ element: el }).setLngLat(stops[0].pos);
    }
    trainMarker.setLngLat(stops[0].pos).addTo(map);
    avatar.getElement().classList.add('hidden');
    map.setCenterClampedToGround(true);
    const b = stops.reduce((bb, s) => bb.extend(s.pos), new maplibregl.LngLatBounds(stops[0].pos, stops[0].pos));
    map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    setTimeout(() => map.fitBounds(b, { padding: { top: 90, bottom: bottomPad(), left: 50, right: 50 }, maxZoom: 15.8, duration: 1100 }), 520);
  },
  train(from, to, ms) {
    cancelAnimationFrame(trainAnim);
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      trainMarker?.setLngLat([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
      if (k < 1) trainAnim = requestAnimationFrame(tick);
    };
    trainAnim = requestAnimationFrame(tick);
  },
  exits(list, at, pick) {
    for (const m of exitMarkers) m.remove();
    exitMarkers.length = 0;
    list.forEach((x, i) => {
      const el = document.createElement('div');
      el.className = 'exitpin';
      el.innerHTML = `<b></b><span class="nm"></span>`;
      el.querySelector('b')!.textContent = String(i + 1);
      el.querySelector('.nm')!.textContent = x.label.split('—')[0].trim();
      el.addEventListener('click', (ev) => { ev.stopPropagation(); pick(i); });
      exitMarkers.push(new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(x.pos).addTo(map));
    });
    const b = list.reduce((bb, x) => bb.extend(x.pos), new maplibregl.LngLatBounds(at, at));
    map.fitBounds(b, { padding: { top: 90, bottom: bottomPad(), left: 60, right: 60 }, maxZoom: 17.4, duration: 1100 });
  },
  markExit(i) {
    exitMarkers.forEach((m, k) => m.getElement().classList.toggle('picked', k === i));
  },
  clear() {
    quietMap(false);
    cancelAnimationFrame(trainAnim);
    map.setLayoutProperty('metro', 'visibility', 'none');
    (map.getSource('metro') as GeoJSONSource).setData(line([]));
    trainMarker?.remove();
    for (const m of stopMarkers) m.remove();
    stopMarkers.length = 0;
    for (const m of exitMarkers) m.remove();
    exitMarkers.length = 0;
    avatar.getElement().classList.remove('hidden');
  },
};

async function ride(target: Dest, gate: Gate) {
  const dest = target.district;
  // 걸어오는 동안 자리가 바뀌었으니 고른 수단·목적지를 그대로 두고 다시 계산한다
  const j = planJourney(dest.id, district, dest, { at: S.pos, goal: target.place?.pos, only: target.mode, pass: S.pass }) ?? target.journey;
  let pre: Promise<unknown> | null = null;
  metroOpen = true;
  hint('');
  const r = await openMetro(district, dest, j, gate, target.place ?? null, () => { pre = loadDistrict(dest, () => {}).catch(() => null); }, metroMap);
  metroMap.clear();
  metroOpen = false;
  if (!r) { camera('look'); map.easeTo({ center: S.pos, zoom: CAM_LOOK.zoom, pitch: CAM_LOOK.pitch, duration: 900 }); return; }
  S.clock += r.mins;
  S.money = Math.round((S.money - r.cost) * 100) / 100;
  S.fares = Math.round((S.fares + r.cost) * 100) / 100;
  await pre;
  try {
    await enterDistrict(dest, r.exit.pos);
  } catch (e) {
    toast(e instanceof Error ? e.message : '그 동네 지도를 펴지 못했어요');
    return;
  }
  toast(`${dest.name} · ${r.mins}분 · €${r.cost.toFixed(2)}${r.wrong ? ` · 방향을 ${r.wrong}번 잘못 골랐어요` : ''}`);
  // 가고 싶다고 고른 곳이 있으면 지상에 올라와 그리로 계속 걷는다
  const want = target.place;
  const p = want && places.find((x) => x.name === want.name);
  if (p) {
    hint(`${r.exit.label}. ${p.name}까지 계속 걷습니다.`);
    setTimeout(() => { if (!S.finished && !metroOpen) walkTo(p.pos, p); }, 1200);
  } else {
    hint(`${r.exit.label} — ${r.exit.note}`);
  }
  S.dest = null;
  setTimeout(() => hint(''), 7000);
}

/** 새 지구의 길·장소로 통째로 갈아 끼운다. */
async function enterDistrict(d: District, at: LngLat) {
  const data = await loadDistrict(d, (s) => toast(s));
  district = d;
  graph = buildGraph(data.ways);
  places = parsePlaces(data.places, d.curated, ALL_RICH);
  for (const p of places) allPlaces.set(p.id, p);
  for (const m of markers.values()) m.remove();
  markers.clear();
  buildingOf.clear();
  litIds.clear();
  paintBuildings();
  S.node = nearestNode(graph, at);
  S.pos = graph.nodes[S.node];
  S.path = [];
  S.seg = 0;
  S.target = null;
  S.trail = [S.pos];
  camMode = '';
  camera('look');
  avatar.setLngLat(S.pos);
  (map.getSource('trail') as GeoJSONSource).setData(line(S.trail));
  (map.getSource('route') as GeoJSONSource).setData(line([]));
  (map.getSource('vision') as GeoJSONSource).setData(circle(S.pos, VISION));
  if (map.getSource('streets')) (map.getSource('streets') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: data.ways } });
  map.jumpTo({ center: S.pos, zoom: 18.6, pitch: 30, bearing: 20 });
  map.easeTo({ center: S.pos, zoom: CAM_LOOK.zoom, pitch: CAM_LOOK.pitch, duration: 2400 });
  for (const p of places) if (p.known) showMarker(p, false);
  showStationMarker();
  showStayMarker();
  paintMetroBtn();
  look();
  hud();
}

function hud() {
  $('#clock').textContent = fmtClock(S.clock);
  paintBody();
  $('#money').textContent = `€${Number.isInteger(S.money) ? S.money : S.money.toFixed(2)}`;
  $('#walked').textContent = S.walked < 1000 ? `${Math.round(S.walked)} m` : `${(S.walked / 1000).toFixed(1)} km`;
  $('#found').textContent = `${S.seen.size}곳 발견`;
  bodyHint();
  if (S.clock >= 19 * 60 && !S.finished) hint('해가 기울어요. 슬슬 하루를 마쳐도 좋아요.');
}

/** 허기·지침 막대 */
function paintBody() {
  for (const [id, v] of [['hunger', S.hunger], ['tired', S.tired]] as const) {
    const bar = document.querySelector(`#${id} i`) as HTMLElement | null;
    if (!bar) continue;
    bar.style.width = `${Math.round(v)}%`;
    (bar.parentElement as HTMLElement).dataset.level = level(v);
  }
}

let lastBodyLine = '';
function bodyHint() {
  const line = bodyLine(S);
  if (line === lastBodyLine) return;
  lastBodyLine = line;
  if (line) toast(line);
}

let toastTimer = 0;
function toast(s: string) {
  const el = $('#toast');
  el.textContent = s;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 2200);
}
const hint = (s: string) => { $('#hint').textContent = s; $('#hint').classList.toggle('on', !!s); };

function openCard(p: Place) {
  openPlace = p;
  S.opened.add(p.id);
  if (!S.seen.has(p.id)) S.seen.set(p.id, S.clock);
  const info = CAT_INFO[p.cat];
  const mins = p.mins ?? info.mins;
  const cost = p.cost ?? info.cost;
  const d = dist(S.pos, p.pos);
  const near = d <= NEAR;
  const visited = S.visits.some((v) => v.place.id === p.id);
  $('#card-emoji').textContent = p.emoji;
  $('#card-name').textContent = p.name;
  $('#card-cat').textContent = `${info.label}${p.tags.cuisine ? ' · ' + p.tags.cuisine.replace(/[;_]/g, ' ') : ''}${p.known ? ' · 오기 전부터 알던 곳' : ''}`;
  $('#card-blurb').textContent = p.blurb ?? describe(p);
  const hasMenu = !!menuFor(p);
  $('#card-meta').textContent = `${hasMenu ? '들어가서 메뉴를 보고 고른다' : `약 ${mins}분 · ${cost ? `입장 €${cost} 안팎` : '무료'}`}${p.tags.opening_hours ? ' · ' + p.tags.opening_hours : ''}`;
  const go = $<HTMLButtonElement>('#card-go');
  if (visited) { go.textContent = '이미 다녀왔어요'; go.disabled = true; }
  else if (near) { go.textContent = hasMenu ? '들어가서 메뉴를 본다' : info.verb; go.disabled = !hasMenu && cost > S.money; if (go.disabled) go.textContent = '돈이 모자라요'; }
  else { go.textContent = `여기로 걸어간다 (도보 ${Math.max(1, Math.round((d * 1.3) / WALK_MPS / 60))}분쯤)`; go.disabled = false; }
  go.onclick = () => {
    if (!near) { openPlace = null; go.blur(); $('#card').classList.remove('on'); walkTo(p.pos, p); return; }
    void goInside(p, cost);
  };
  const save = $<HTMLButtonElement>('#card-save');
  save.textContent = S.saved.has(p.id) ? '♥ 찜함' : '♡ 찜';
  save.onclick = () => {
    if (S.saved.has(p.id)) S.saved.delete(p.id); else { S.saved.add(p.id); sfx.heart(); }
    markers.get(p.id)?.getElement().classList.toggle('saved', S.saved.has(p.id));
    save.textContent = S.saved.has(p.id) ? '♥ 찜함' : '♡ 찜';
  };
  $('#card-pass').textContent = S.path.length > 1 ? '지나치고 계속 걷는다' : '지나친다';
  $('#card-pass').onclick = () => closeCard('pass');
  $('#card').classList.add('on');
}

/** 들어간다: 먹는 곳이면 메뉴판, 아니면 관람 장면. 결과만큼 시간과 돈이 흐른다. */
async function goInside(p: Place, entry: number) {
  (document.activeElement as HTMLElement | null)?.blur();
  $('#card').classList.remove('on'); // openPlace는 그대로 둬서 걷기를 멈춰 둔다
  const at = S.clock;
  const menu = menuFor(p);
  if (menu) {
    const meal = await openMenu(p, menu, S.money);
    if (!meal) { closeCard('pass'); toast('메뉴만 보고 나왔어요'); return; }
    S.visits.push({ place: p, at, mins: meal.mins, cost: meal.cost, dishes: meal.dishes });
    S.clock += meal.mins;
    drain(S, meal.mins, 0);
    // 앉아서 먹으면 다리도 좀 쉰다. 창구에서 사 먹으면 덜.
    eat(S, Math.min(70, 18 + meal.cost * 1.6), meal.mins >= 25 ? 12 : 4);
    S.ate++;
    S.money = Math.round((S.money - meal.cost) * 100) / 100;
    toast(`${p.emoji} ${meal.mins}분 · €${meal.cost}`);
  } else {
    sfx.enter();
    const v = await openVisit(p);
    S.visits.push({ place: p, at, mins: v.mins, cost: entry, seen: v.seen, total: v.total });
    S.shots.push(...v.shots);
    S.clock += v.mins;
    drain(S, v.mins, 0);
    if (p.cat === 'park') rest(S, 12); // 벤치
    else if (p.cat === 'cafe' || p.cat === 'bar') { rest(S, 15); eat(S, 12); }
    S.money -= entry;
    toast(`${p.emoji} ${v.mins}분 머물렀어요`);
  }
  markers.get(p.id)?.getElement().classList.add('visited');
  closeCard('enter');
}

function closeCard(_why: 'enter' | 'pass') {
  openPlace = null;
  (document.activeElement as HTMLElement | null)?.blur(); // 화면 밖으로 밀려난 버튼에 포커스가 남아 문서가 스크롤되는 것 방지
  $('#card').classList.remove('on');
  hud();
}

async function start() {
  sfx.unlock();
  const intro = $('#intro');
  $('#go').setAttribute('disabled', '');
  intro.classList.add('gone');

  // ① 숙소 ② 공항에서 오는 법 ③ 표
  const a = await openArrival();
  S.stay = a.stay;
  S.pass = a.pass;
  S.money = Math.round((S.money - a.ride.cost - (a.pass === 'liberte' ? LIBERTE_CARD : 0)) * 100) / 100;
  S.fares = a.ride.cost;
  S.clock += a.ride.mins;
  S.tired = Math.min(100, S.tired + a.ride.tired);
  S.hunger = Math.min(100, S.hunger + a.ride.mins * 0.11);

  for (let i = 0; i < 6; i++) sfx.stair(i);
  sfx.surface();
  S.started = true;
  $('#hud').classList.add('on');
  try {
    await enterDistrict(DISTRICTS[a.stay.district], a.stay.pos);
  } catch (e) {
    toast(e instanceof Error ? e.message : '지도를 펴지 못했어요');
    return;
  }
  S.origin = S.pos;
  S.trail = [S.pos];

  // ④ 체크인·아침
  const m = await openMorning(a.stay, S.clock);
  S.clock += m.mins;
  S.money = Math.round((S.money - m.cost) * 100) / 100;
  if (m.fed) eat(S, m.fed, 10); else rest(S, 6);
  hud();
  toast(`${a.stay.name} · ${fmtClock(S.clock)}`);
  hint(`${m.line} 지도에서 아무 데나 누르면 그쪽으로 걸어갑니다.`);
  setTimeout(() => hint(''), 8000);
}

const mode = (xs: string[]) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])[0][0];

function finish() {
  S.finished = true;
  if (openPlace) closeCard('pass');
  const tastes = new Map<Taste, { seen: number; opened: number; entered: number }>();
  const bump = (p: Place, k: 'seen' | 'opened' | 'entered') => {
    const t = TASTE_OF[p.cat];
    const row = tastes.get(t) ?? { seen: 0, opened: 0, entered: 0 };
    row[k]++;
    tastes.set(t, row);
  };
  const byId = allPlaces;
  for (const id of S.seen.keys()) { const p = byId.get(id); if (p) bump(p, 'seen'); }
  for (const id of S.opened) { const p = byId.get(id); if (p) bump(p, 'opened'); }
  for (const v of S.visits) bump(v.place, 'entered');

  const lines: string[] = [];
  const placeLegs = S.legs.filter((l) => l === 'place').length;
  if (S.legs.length >= 3) {
    lines.push(placeLegs / S.legs.length >= 0.6
      ? `걸음 ${S.legs.length}번 중 ${placeLegs}번이 정해 둔 곳을 향했어요. 목적지를 찍고 움직이는 편이네요.`
      : `걸음 ${S.legs.length}번 중 ${S.legs.length - placeLegs}번은 그냥 지도를 눌러 걸었어요. 발길 닿는 대로 걷는 편이네요.`);
  }
  const rows = [...tastes.entries()].filter(([, r]) => r.seen >= 3);
  const ranked = rows.map(([t, r]) => ({ t, r, rate: r.opened / r.seen })).sort((a, b) => b.rate - a.rate);
  if (ranked.length && ranked[0].r.opened > 0) lines.push(`「${ranked[0].t}」 ${ranked[0].r.seen}곳이 눈에 들어왔고, 그중 ${ranked[0].r.opened}곳 앞에서 발을 멈췄어요. 오늘 가장 자주 멈춘 종류예요.`);
  const ignored = ranked.filter((x) => x.r.opened === 0).sort((a, b) => b.r.seen - a.r.seen)[0];
  if (ignored) lines.push(`「${ignored.t}」는 ${ignored.r.seen}곳을 지나쳤지만 한 번도 들여다보지 않았어요.`);
  const surprise = S.visits.filter((v) => !v.place.known);
  if (surprise.length) lines.push(`들어간 ${S.visits.length}곳 중 ${surprise.length}곳은 오기 전엔 몰랐던 곳이에요: ${surprise.map((v) => v.place.name).slice(0, 3).join(', ')}.`);
  const dishes = S.visits.flatMap((v) => v.dishes ?? []);
  if (dishes.length >= 2) {
    const n = (t: string) => dishes.filter((d) => (d.tags as string[]).includes(t)).length;
    const sweet = n('sweet'); const classic = n('classic'); const trendy = n('trendy'); const street = n('street');
    if (sweet * 2 >= dishes.length) lines.push(`주문한 ${dishes.length}가지 중 ${sweet}가지가 단것이었어요.`);
    if (classic >= 2 && classic > trendy * 2) lines.push(`메뉴판에서는 오래된 이름 쪽으로 손이 갔어요: ${dishes.filter((d) => d.tags.includes('classic')).slice(0, 3).map((d) => d.name).join(', ')}.`);
    else if (trendy >= 2 && trendy >= classic) lines.push('메뉴판에서는 요즘 것, 낯선 조합 쪽을 골랐어요.');
    if (street * 2 > dishes.length) lines.push('앉아서 먹기보다 들고 걸으며 먹는 쪽이었어요.');
  }
  const looked = S.visits.filter((v) => v.total && v.total > 1);
  if (looked.length >= 2) {
    const full = looked.filter((v) => v.seen === v.total).length;
    lines.push(full * 2 >= looked.length ? `둘러본 ${looked.length}곳 중 ${full}곳을 끝까지 봤어요. 한 곳을 깊게 보는 편이네요.` : `둘러본 ${looked.length}곳 중 ${looked.length - full}곳은 중간에 나왔어요. 여러 곳을 가볍게 훑는 편이네요.`);
  }
  if (S.shots.length) lines.push(`사진을 ${S.shots.length}장 찍었어요. 가장 많이 찍은 곳은 ${mode(S.shots.map((x) => x.place))}.`);
  if (S.fares) {
    const single = S.pass === 'single';
    lines.push(`교통비로 €${S.fares.toFixed(2)}을 썼어요. ${single ? '낱장으로만 다녔는데, Navigo Liberté+였다면 회당 값이 싸고 버스↔지하철 환승도 됐을 거예요.' : 'Navigo Liberté+로 다녔어요 — 버스와 지하철을 섞어도 한 번만 계산됐습니다.'}`);
  }
  if (S.tired >= 70) lines.push(`하루 끝에 꽤 지쳤어요(지침 ${Math.round(S.tired)}). 중간에 앉는 자리를 더 넣으면 같은 동선도 덜 힘들어요.`);
  else if (S.tired <= 35) lines.push('여유 있게 다녔어요. 하루에 한 곳쯤 더 넣어도 괜찮았겠어요.');
  if (S.ate === 0) lines.push('오늘 아무것도 먹지 않았어요. 실제로 이렇게 다니면 오후에 무너집니다.');
  else if (S.ate >= 3) lines.push(`${S.ate}번 먹었어요. 먹으러 다니는 여행이네요.`);
  if (!lines.length) lines.push('아직 기록이 적어요. 조금 더 걸어 보면 당신이 어디서 멈추는 사람인지 보이기 시작해요.');

  $('#sum-stats').textContent = `${fmtClock(7 * 60 + 40)} → ${fmtClock(S.clock)} · ${(S.walked / 1000).toFixed(1)} km · ${S.seen.size}곳 발견 · ${S.visits.length}곳 들어감 · €${(320 - S.money).toFixed(2)} 씀${S.stay ? ` · ${S.stay.name}` : ''}`;
  $('#sum-lines').replaceChildren(...lines.map((s) => { const li = document.createElement('li'); li.textContent = s; return li; }));
  const stops = [...S.visits.map((v) => ({ p: v.place, note: `${fmtClock(v.at)} · ${v.mins}분${v.cost ? ` · €${v.cost}` : ''}${v.dishes ? ` · ${v.dishes.map((d) => d.name).join(', ')}` : ''}` })),
    ...[...S.saved].map((id) => byId.get(id)).filter((p): p is Place => !!p && !S.visits.some((v) => v.place.id === p.id)).map((p) => ({ p, note: '찜 — 다음에' }))];
  $('#sum-stops').replaceChildren(...stops.map(({ p, note }) => { const li = document.createElement('li'); li.textContent = `${p.emoji} ${p.name} — ${note}`; return li; }));
  const link = $<HTMLAnchorElement>('#sum-maps');
  if (stops.length) {
    const pts = stops.slice(0, 9).map(({ p }) => `${p.pos[1].toFixed(6)},${p.pos[0].toFixed(6)}`);
    const q = new URLSearchParams({ api: '1', origin: `${S.origin[1]},${S.origin[0]}`, destination: pts[pts.length - 1], travelmode: 'walking' });
    if (pts.length > 1) q.set('waypoints', pts.slice(0, -1).join('|'));
    link.href = `https://www.google.com/maps/dir/?${q}`;
    link.hidden = false;
  } else link.hidden = true;
  $('#sum-shots-wrap').hidden = !S.shots.length;
  $('#sum-shots').replaceChildren(...S.shots.map((sh) => {
    const d = document.createElement('div');
    d.className = 'shot';
    d.style.backgroundImage = `url("${sh.src}")`;
    d.style.backgroundPosition = `${Math.round(sh.x * 100)}% 50%`;
    d.title = `${sh.place} — ${sh.credit}`;
    return d;
  }));
  $('#summary').classList.add('on');
  if (S.trail.length > 1) {
    const b = S.trail.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(S.trail[0], S.trail[0]));
    map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    setTimeout(() => map.fitBounds(b, { padding: { top: 60, bottom: 60, left: 40, right: Math.min(460, window.innerWidth * 0.5) }, maxZoom: 17 }), 850);
  }
}

const metroBtn = $<HTMLButtonElement>('#metro-go');
function paintMetroBtn() {
  metroBtn.textContent = '🚇 어디 갈까';
  metroBtn.title = '다른 동네, 또는 가고 싶은 곳을 고른다';
  metroBtn.onclick = chooseDestination;
}
$('#go').addEventListener('click', start);
const eyeBtn = $<HTMLButtonElement>('#eye');
const paintEye = () => { eyeBtn.textContent = eyeMode ? '👁 시선' : '🚁 위에서'; eyeBtn.title = eyeMode ? '걸을 때 눈높이에서 본다 (누르면 위에서 보기)' : '걸을 때 위에서 본다 (누르면 눈높이)'; };
paintEye();
eyeBtn.addEventListener('click', () => {
  eyeMode = !eyeMode;
  try { localStorage.setItem('carnet-walk-eye', eyeMode ? '1' : '0'); } catch { /* 무시 */ }
  paintEye();
  if (camMode === 'walk') {
    const c0 = map.getCenter();
    camFrom = { center: [c0.lng, c0.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() };
    walkStartedAt = performance.now();
    map.setCenterClampedToGround(!eyeMode);
    avatar.getElement().classList.toggle('hidden', eyeMode);
    if (!eyeMode) map.easeTo({ center: S.pos, elevation: 0, zoom: CAM_WALK.zoom, pitch: CAM_WALK.pitch, roll: 0, duration: 1500 });
  }
});
$('#end').addEventListener('click', finish);
$('#again').addEventListener('click', () => location.reload());
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openPlace) closeCard('pass'); });
// 이 화면은 스크롤되지 않는다. 그런데도 포커스 이동·scrollIntoView가 문서를 밀어 올려
// 아래에 대기 중인 요약 패널이 딸려 올라오는 일이 반복돼서, 밀리면 바로 되돌린다.
window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); }, { passive: true });
if (import.meta.env.DEV || location.search.includes('debug')) (window as unknown as { __walk: unknown }).__walk = { S, walkTo, openCard, finish, places: () => places, graph: () => graph, map: () => map };
window.addEventListener('error', (e) => { try { localStorage.setItem('carnet-walk-lasterror', `${new Date().toISOString()} ${e.message} @${e.filename}:${e.lineno}`); } catch { /* 무시 */ } });
requestAnimationFrame(frame);
void boot();
