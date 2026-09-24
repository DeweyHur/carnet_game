// Carnet 걷기 게임(메인 페이지) — "걷다가 눈에 들어온다"가 재미있는지 확인하기 위한 실험.
// 질문하지 않는다. 어디로 걸었고, 어디서 멈췄고, 무엇을 지나쳤는지만 기록한다.
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap, Marker, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import './walk.css';
import { bearing, buildGraph, dist, nearestNode, route } from './graph';
import type { Graph, LngLat } from './graph';
import { CAT_INFO, TASTE_OF, parsePlaces } from './places';
import type { Place, Taste } from './places';
import { loadDistrict } from './data';
import { EIFFEL_ZONES } from './eiffel';
import { DISTRICTS, otherDistricts, planJourney, planOptions, stopPos, LINES } from './districts';
import type { District, Gate, Journey } from './districts';
import { ALL_RICH } from './rich';
import { openDestination } from './destination';
import type { Stay } from './stays';
import { bodyLine, drain, eat, level, paceFactor, rest, sightFactor } from './trip';
import type { Pass } from './trip';
import type { Dest } from './destination';
import type { MetroMap } from './metro';
import * as sfx from './sound';
import { menuFor } from './content';
import { describe } from './generic';
import type { Dish } from './content';
import { openMenu, openVisit } from './inside';
import type { Shot } from './inside';
import { Hero } from './hero';
import { Pins } from './pins';
import type { Pin } from './pins';
import { Street } from './street';
import { Transit } from './under';
import type { BodyEvent } from './hero';
import { angleDiff } from './hero/geo';
import * as THREE from 'three';

maplibregl.setWorkerUrl(workerUrl);

let district: District = DISTRICTS['champs-elysees']; // 에펠탑에서 뛰어내려 여기서 시작한다
const START: LngLat = district.start; // 메트로 1호선 Saint-Paul 출구 부근
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const VISION = 45; // m — 이 안에 들어와야 가게가 "눈에 띈다"
const NEAR = 70; // m — 이 안에 있어야 들어갈 수 있다
const WALK_MPS = 1.35; // 실제 보행 속도
// 시야: 달리는 동안은 카메라가 보는 쪽 ±FOV° 안, SIGHT m 이내만 보인다. 자동으로 걸을 때는 지금 걷는 길에서 STREET m 이내만.
const FOV = 70;
const SIGHT = 60;
const STREET = 24;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

interface Visit { place: Place; at: number; mins: number; cost: number; dishes?: Dish[]; seen?: number; total?: number; note?: string }
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
  buys: [] as { what: string; cost: number; at: number }[],
  told: new Map<string, string>(), // 누가 알려 준 곳
  started: false,
  finished: false,
};

/** 지구를 옮겨도 남는 것: 본 곳·들른 곳을 나중에 다시 찾으려면 필요하다 */
const allPlaces = new Map<string, Place>();

let map: MlMap;
let graph: Graph;
let places: Place[] = [];
let avatar: Pin;
let pins: Pins;
let hero: Hero;
let street: Street;
let transit: Transit;
let guideTarget: Place | null = null; // 빛기둥으로 안내하는 곳(현지인이 알려 준 곳 등)
let entering = false;
let mapMode = false; // 🗺 지도 보기(위에서 내려다보며 목적지를 찍는다)
const markers = new Map<string, Pin>();
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
  return { style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#cdc6b8' } }] }, fallback: true };
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

    map = new maplibregl.Map({ container: 'map', style: st.style, center: S.pos, zoom: 18.4, pitch: 25, bearing: -20, attributionControl: { compact: true }, maxPitch: 85, maxZoom: 24, clickTolerance: 10, pixelRatio: Q_DPR[quality] }); // 살짝 끌린 손가락은 클릭으로 치지 않는다
    map.on('load', () => {
      hero = new Hero(map, () => setMapMode(!mapMode));
      pins = new Pins(map, hero.view.pins);
      dressMap(st.fallback, ways);
      hero.theme = district.id;
      hero.setWays(ways);
      hero.setGraph(graph.nodes, graph.adj.map((es) => es.map((e) => e.to)));
      hero.attach();
      hero.setLanes(laneSegments(graph));
      hero.reset(S.pos);
      hero.town.setFar(st.fallback ? 300 : 1e6);
      applyQuality();
      dressTown();
      hero.hud.onPrompt = () => hero.input.press('interact');
      hero.hud.onPrompt2 = () => hero.input.press('secondary');
      street = makeStreet();
      transit = new Transit({ hero, toast, hint: (s2) => hint(s2), fine: (eur, why) => toast(`🎫 검표원(contrôleur)! ${why} 벌금 €${eur}`) });
      status.textContent = '';
      void prepare(st.fallback);
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
  // 직접 걸을 때는 건물이 비쳐 보이면 벽인지 알 수 없다. 불투명하게, 파리의 크림색 석회암 톤으로.
  for (const l of layers) if (l.type === 'fill-extrusion') {
    map.setPaintProperty(l.id, 'fill-extrusion-opacity', 1);
    map.setPaintProperty(l.id, 'fill-extrusion-color', ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10], 4, '#e3d6bd', 14, '#ece2cc', 30, '#f3ecdc']);
  }
  // 밤에 땅을 어둡게 덮는 층(입체 건물 아래)
  map.addSource('night', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]] } } });
  map.addLayer({ id: 'night', type: 'fill', source: 'night', paint: { 'fill-color': '#0b1030', 'fill-opacity': 0 } });
  // 도로 선·글자가 건물 벽을 뚫고 보이지 않게, 입체 건물을 평면 층들 위로 올린다
  for (const l of layers) if (l.type === 'fill-extrusion') map.moveLayer(l.id);
  map.setVerticalFieldOfView(52); // 게임처럼 넓게
  if (!fallback && !layers.some((l) => l.type === 'fill-extrusion')) {
    const src = Object.entries(map.getStyle().sources).find(([, s]) => s.type === 'vector')?.[0];
    if (src) map.addLayer({ id: 'walk-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 14,
      paint: { 'fill-extrusion-color': '#e6dccb', 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12], 'fill-extrusion-opacity': 0.85 } });
  }
  if (fallback) {
    // 타일이 없으면 공원·강을 직접 칠한다(에펠탑 둘레 — 하늘에서 내려다볼 때 어디가 어딘지 보이게)
    map.addSource('zones', { type: 'geojson', data: { type: 'FeatureCollection', features: EIFFEL_ZONES.map((z) => ({ type: 'Feature', properties: { kind: z.kind }, geometry: { type: 'Polygon', coordinates: [z.ring] } })) } });
    map.addLayer({ id: 'zones', type: 'fill', source: 'zones', paint: { 'fill-color': ['match', ['get', 'kind'], 'water', '#7fa9c9', 'park', '#9fbf7a', '#dccfb4'] } });
    map.addSource('streets', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: ways } } });
    map.addLayer({ id: 'streets', type: 'line', source: 'streets', paint: { 'line-color': '#fff', 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
  }
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
  avatar = pins.add(el, S.pos);
  el.classList.add('hidden');

  for (const p of places) if (p.known) showMarker(p, false);
  showStationMarker();
  map.on('click', (e) => {
    if (!S.started || S.finished || metroOpen) return;
    if (openPlace) { closeCard('pass'); return; }
    // 땅을 찍어 걸어가는 건 지도 보기에서만. 평소에는 직접 걷는다.
    if (!mapMode) return;
    walkTo([e.lngLat.lng, e.lngLat.lat], null);
    setMapMode(false);
  });
}

function showMarker(p: Place, pop: boolean) {
  if (markers.has(p.id)) return;
  const el = document.createElement('button');
  el.className = `pl ${p.curated ? 'curated' : ''} ${p.known ? 'known' : ''} ${p.minor ? 'minor' : ''} ${pop ? 'pop' : ''}`;
  el.innerHTML = `<span class="em">${p.emoji}</span>${p.curated ? `<span class="nm"></span>` : ''}`;
  if (p.curated) el.querySelector('.nm')!.textContent = p.name;
  el.title = p.name;
  el.addEventListener('click', (ev) => { ev.stopPropagation(); openCard(p); });
  markers.set(p.id, pins.add(el, p.pos, 'bottom'));
}

function look() {
  for (const p of places) {
    const m = markers.get(p.id);
    // 걷는 동안 가까운 곳은 핀 대신 진짜 간판·차양이 보인다(핀은 멀리 있는 알던 곳·찜한 곳만)
    if (m) m.getElement().classList.toggle('near', dist(S.pos, p.pos) < 30);
    if (!inSight(p) || S.seen.has(p.id)) continue;
    S.seen.set(p.id, S.clock);
    if (!m) showMarker(p, true); else m.getElement().classList.add('found');
    // 발견: 간판 위에 반짝 이름이 뜬다
    if (hero && street) {
      const [px, py] = hero.frame.toLocal(p.pos);
      const f = p.minor ? null : hero.town.front({ id: p.id, x: px, y: py });
      const ax = f ? f.x + f.nx * 0.8 : px, ay = f ? f.y + f.ny * 0.8 : py;
      const gz = hero.world.terrain(ax, ay);
      street.ui.say(() => ({ x: ax, y: ay, z: gz + (f ? 5.4 : 2.6) }), `✨ ${p.emoji} ${p.name}`, p.curated ? 3.2 : 2.2, p.curated ? 'found big' : 'found');
    }
    if (p.curated) { sfx.spotBig(); toast(`${p.emoji} ${p.name}`); } else sfx.spot();
  }
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
  const moving = hero ? hero.body.speed > 0.6 || S.path.length > 1 : S.path.length > 1;
  if (d > (moving ? SIGHT : VISION) * f) return false;
  if (moving) {
    // 직접 걸을 때는 카메라가 보는 쪽(화면에 보이는 것), 자동으로 걸을 때는 걷는 방향
    const rel = angleDiff(S.path.length > 1 || !hero ? S.heading : hero.cam.yaw, bearing(S.pos, p.pos));
    if (Math.abs(rel) > FOV && d > 12) return false;
    // 지금 걷는 길가에 있는 것만 — 앞으로 갈 몇 구간을 기준으로 잰다
    if (S.path.length < 2) return true;
    let near = false;
    for (let i = Math.max(0, S.seg - 1); i + 1 < S.path.length && i < S.seg + 8; i++) if (distToSeg(p.pos, S.path[i], S.path[i + 1]) <= STREET) { near = true; break; }
    if (!near) return false;
  }
  return true;
}

let lastT = 0;
let lookAcc = 0;
let wasCamOn = false;
let lastTrail: LngLat = START;
let splashed = false;
let climbT = 0;
const MODALS = ['inside', 'dest', 'trip', 'metro', 'summary'];
const modalOpen = () => MODALS.some((id) => document.getElementById(id)?.classList.contains('on'));
const HANDLERS = ['dragPan', 'dragRotate', 'scrollZoom', 'boxZoom', 'doubleClickZoom', 'keyboard', 'touchZoomRotate', 'touchPitch'] as const;
/** 직접 걷는 동안에는 지도가 끌리거나 돌지 않게 한다(카메라는 사람이 잡는다) */
function mapHandlers(on: boolean) {
  for (const h of HANDLERS) { const x = map[h] as { enable(): void; disable(): void }; if (on) x.enable(); else x.disable(); }
}

const cpu: { frame: number; n: number; render?: number } = { frame: 0, n: 0 }; // 디버그: 한 프레임 JS 시간(ms, 평균)
function frame(t: number) {
  const c0 = performance.now();
  frameBody(t);
  cpu.frame += (performance.now() - c0 - cpu.frame) * 0.05;
  cpu.n++;
  requestAnimationFrame(frame);
}
function frameBody(t: number) {
  const raw = Math.min(1, (t - lastT) / 1000 || 0);
  const dt = Math.min(0.1, raw);
  lastT = t;
  govern(raw); // 느린 기기는 실제 흐른 시간으로 재야 빨리 품질을 낮춘다
  soundAcc += dt;
  if (soundAcc > 0.25 && S.started) { soundAcc = 0; soundscape(); }
  if (transit?.active) { transit.frame(dt); return; }
  if (hero) {
    heroFrame(dt);
    // 걷기 화면을 그린다(지도 보기 중엔 지도 엔진이 그린다)
    hero.view.visible = !mapMode && !document.body.classList.contains('metro-mode');
    hero.render(dt);
    if (!mapMode) pins.update((p) => hero.frame.toLocal(p), (x, y) => hero.world.terrain(x, y), [hero.body.x, hero.body.y], (x, y, z, o) => hero.view.project(x, y, z, o));
  }
  districtAcc += dt;
  if (districtAcc > 1.5) { districtAcc = 0; autoDistrict(); }
  lookAcc += dt;
  if (lookAcc > 0.12 && S.started && !metroOpen) { lookAcc = 0; look(); hud(); }
}

/** 거리(Town)에 이 동네의 장소·지하철 입구·버스 정류장을 알려 준다 */
function dressTown() {
  const f = hero.frame;
  hero.town.setPlaces(places.map((p) => { const [x, y] = f.toLocal(p.pos); return { id: p.id, x, y, cat: p.cat, name: p.name, emoji: p.emoji, tags: p.tags, minor: p.minor }; }));
  const [s0, w0, n0, e0] = district.bbox;
  const bus: { x: number; y: number; name: string }[] = [];
  for (const [lk, def] of Object.entries(LINES)) {
    if (def.mode !== 'bus') continue;
    for (const st of def.stations) {
      const p = stopPos(lk, st);
      if (!p || p[1] < s0 || p[1] > n0 || p[0] < w0 || p[0] > e0) continue;
      const [x, y] = f.toLocal(p);
      if (!bus.some((b) => Math.hypot(b.x - x, b.y - y) < 25)) bus.push({ x, y, name: st });
    }
  }
  hero.town.setGates(allGates(district).map(({ st, g }) => { const [x, y] = f.toLocal(g.pos); return { x, y, station: st.name, label: g.label }; }), bus);
}

// ───────── 품질 자동 조절: 느리면 해상도·짓는 반경·사람 수를 줄이고, 여유가 생기면 되돌린다 ─────────
const COARSE = matchMedia('(pointer: coarse)').matches;
const Q_DPR = [Math.min(2, window.devicePixelRatio || 1), Math.min(1.5, window.devicePixelRatio || 1), 1, 0.8];
const Q_RADIUS = [300, 240, 190, 150];
const Q_CROWD = [46, 34, 24, 14];
const Q_GRASS = [30, 24, 16, 0]; // 풀이 나는 반경(m) — 가장 낮은 품질에선 풀 없이 결만
let quality = COARSE ? 1 : 0;
let slowT = 0, fastT = 0, frameEma = 16;
function govern(dt: number) {
  if (!hero || !S.started || dt <= 0) return;
  frameEma += (Math.min(dt, 0.25) * 1000 - frameEma) * 0.05;
  if (frameEma > 24) { slowT += dt; fastT = 0; } else if (frameEma < 15) { fastT += dt; slowT = 0; } else { slowT = Math.max(0, slowT - dt); fastT = Math.max(0, fastT - dt); }
  if (slowT > 2.5 && quality < 3) { quality++; slowT = 0; applyQuality(); }
  else if (fastT > 12 && quality > (COARSE ? 1 : 0)) { quality--; fastT = 0; applyQuality(); }
}
function applyQuality() {
  hero.view.setPixelRatio(Q_DPR[quality]); // 걷기 화면 해상도(지도 엔진은 지도 보기에서만 쓴다)
  hero.town.radius = Q_RADIUS[quality];
  hero.crowd.target = Q_CROWD[quality];
  hero.crowd.outlines = quality < 2;
  hero.town.grass.setRadius(Q_GRASS[quality]);
  if (import.meta.env.DEV) console.debug(`[quality] ${quality} (${Math.round(frameEma)} ms)`);
}

// ───────── 소리: 음악 분위기·거리 공기·바람 ─────────
let soundAcc = 0;
function soundscape() {
  if (!hero) return;
  const b = hero.body;
  const hour = (S.clock / 60) % 24;
  const under = !!transit?.active;
  sfx.musicMood(hour, under, !!street?.holding);
  const near = (kind: string, r: number) => { let k = 0; for (const sp of hero.town.spots) if (sp.kind === kind) { const d = Math.hypot(sp.x - b.x, sp.y - b.y); if (d < r) k = Math.max(k, 1 - d / r); } return k; };
  let flock = 0;
  for (const f of hero.crowd.flocks) { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < 20) flock = Math.max(flock, 1 - d / 20); }
  let park = 0;
  for (const p of places) if (p.cat === 'park') { const d = dist(S.pos, p.pos); if (d < 80) park = Math.max(park, 1 - d / 80); }
  const night = S.clock >= 19.5 * 60 ? Math.min(1, (S.clock - 19.5 * 60) / 120) : 0;
  sfx.ambient({ night, hour, z: b.z, underground: under, terrace: near('terrace', 16), fountain: near('fountain', 12), flock, park, crowd: Math.min(1, hero.crowd.npcs.length / 40) });
  const g = b.mode === 'glide' ? 0.55 + (b.parachute ? 0.2 : 0) : 0;
  sfx.wind(under ? 0 : Math.max(g, Math.min(0.8, (b.z - 12) / 70), b.mode === 'air' && b.vz < -8 ? 0.6 : 0));
}

// ───────── 어디든: 다른 동네로 걸어·날아 들어가면 그 동네를 읽는다 ─────────
let districtAcc = 0;
let switching = false;
function autoDistrict() {
  if (switching || !S.started || S.finished || metroOpen || transit?.active || mapMode || openPlace) return;
  const [lng, lat] = S.pos;
  const inside = (d: District, pad: number) => lat > d.bbox[0] - pad && lat < d.bbox[2] + pad && lng > d.bbox[1] - pad && lng < d.bbox[3] + pad;
  if (inside(district, 0.004)) return;
  const d = Object.values(DISTRICTS).find((x) => x.id !== district.id && inside(x, 0.002));
  if (!d) return;
  switching = true;
  void enterDistrict(d, S.pos, true).catch(() => null).finally(() => { switching = false; });
}

/** 거리 그래프를 선분으로 — 건물을 가로지르는 길은 1층이 뚫린 통로다 */
const laneSegments = (g: Graph) => g.adj.flatMap((es, a) => es.filter((e) => e.to > a).map((e) => [g.nodes[a], g.nodes[e.to]]));

/** 자동으로 걷던 걸 멈춘다(사람이 직접 움직이면) */
function cancelAuto() {
  S.path = [];
  S.target = null;
  S.travelTo = null;
  S.travelGate = null;
  S.restAt = false;
  (map.getSource('route') as GeoJSONSource).setData(line([]));
  hint('');
}

function heroFrame(dt: number) {
  const quiet = document.body.classList.contains('metro-mode');
  const live = S.started && !S.finished && !metroOpen && !quiet;
  const modal = modalOpen();
  hero.visible = S.started && !quiet && !metroOpen;
  hero.input.enabled = live && !modal && !mapMode;
  hero.input.allowMapKey = live && !modal;
  hero.hud.show(live && !mapMode);
  const camOn = live && !mapMode;
  if (camOn !== wasCamOn) {
    wasCamOn = camOn;
    if (camOn) { hero.resume(S.walked ? 1.3 : 2.6); mapHandlers(false); avatar.getElement().classList.add('hidden'); }
    else { map.setCenterClampedToGround(true); mapHandlers(true); if (mapMode) avatar.getElement().classList.remove('hidden'); }
    if (map.getLayer('vision')) map.setLayoutProperty('vision', 'visibility', camOn || quiet ? 'none' : 'visible');
  }
  if (preparing) {
    hero.visible = true;
    hero.tick(dt, { waypoint: null, frozen: true, hold: true, pace: 1, maxStamina: 1, beacon: null });
    hero.drive(dt);
    return;
  }
  if (!S.started) return;
  const auto = S.path.length > 1 && S.seg + 1 < S.path.length ? S.path[S.seg + 1] : null;
  const talking = !!street?.holding;
  const frozen = !live || !!openPlace || modal || mapMode || talking || entering;
  // 빛기둥: 자동으로 걷는 길의 끝 > 사건(풍선·강아지) > 현지인이 알려 준 곳
  const qb = street?.beacon;
  const beacon = S.path.length > 1 ? S.path[S.path.length - 1] : qb ? hero.frame.toLngLat(qb[0], qb[1]) : guideTarget ? guideTarget.pos : null;
  const r = hero.tick(dt, {
    waypoint: auto,
    frozen,
    pace: paceFactor(S),
    maxStamina: 1 - 0.45 * (S.tired / 100), // 지칠수록 기력 바퀴가 작아진다
    beacon,
  });
  if (r.f.map && live && !modal && !talking) { setMapMode(!mapMode); return; } // 이번 프레임에 카메라를 잡으면 지도 보기 전환(easeTo)이 끊긴다
  street?.update(dt, r.f, live && !modal && !mapMode && !openPlace && !entering);
  if (!live) { if (camOn) hero.drive(dt); return; }
  if (r.user && S.path.length > 1) cancelAuto();
  if (guideTarget && dist(S.pos, guideTarget.pos) < 18) { toast(`${guideTarget.emoji} ${guideTarget.name}에 왔다`); guideTarget = null; }

  const b = hero.body;
  S.pos = hero.lnglat;
  S.heading = hero.heading;
  if (b.moved > 0 || b.lift > 0) {
    const mins = (b.moved + b.lift * 2) / WALK_MPS / 60;
    S.walked += b.moved;
    S.clock += mins;
    drain(S, mins, b.moved + b.lift * 3); // 오르는 건 걷는 것보다 힘들다
  }
  if (dist(lastTrail, S.pos) > 3) {
    lastTrail = S.pos;
    S.trail.push(S.pos);
    if (mapMode) (map.getSource('trail') as GeoJSONSource).setData(line(S.trail)); // 걷는 동안엔 지도를 그리지 않는다(지도 보기로 갈 때 한 번에)
  }
  avatar.setLngLat(S.pos);
  if (mapMode) (map.getSource('vision') as GeoJSONSource).setData(circle(S.pos, VISION));
  if (S.path.length > 1) {
    if (r.arrivedWaypoint) S.seg++;
    if (mapMode) (map.getSource('route') as GeoJSONSource).setData(line([S.pos, ...S.path.slice(S.seg + 1)]));
    if (S.seg + 1 >= S.path.length) arrive();
  }
  for (const e of hero.events) onBodyEvent(e);
  if (b.mode === 'sit' || (b.mode === 'act' && b.act?.kind === 'lie')) {
    // 앉아 있으면 시간이 조금씩 흐르고 다리가 쉰다(실제 15초 ≈ 4분)
    const mins = dt * 0.25;
    S.clock += mins;
    rest(S, mins * 0.35);
    drain(S, mins, 0);
  }
  const mus = hero.crowd.nearest(b.x, b.y, 0, 30, (n) => n.role === 'musician');
  sfx.music(mus ? Math.max(0, 1 - Math.hypot(mus.x - b.x, mus.y - b.y) / 30) : 0);
  if (b.mode === 'climb' && b.climbMove > 0.1) { climbT += dt; if (climbT > 0.38) { climbT = 0; sfx.climbStep(); } }
  if (camOn) hero.drive(dt);
}

function onBodyEvent(e: BodyEvent) {
  switch (e) {
    case 'stepL': case 'stepR': sfx.step(e === 'stepL', hero.body.z - hero.world.terrain(hero.body.x, hero.body.y) > 2.5 ? 'roof' : 'stone'); break;
    case 'jump': sfx.jump(); break;
    case 'land': sfx.land(); break;
    case 'hurt':
      sfx.hurt();
      S.tired = Math.min(100, S.tired + 6);
      toast('쿵! 높은 데서 그냥 뛰어내렸다 (지침 +6) — 착지 직전에 V를 누르면 굴러서 안 다친다');
      break;
    case 'glide': if (hero.body.parachute) sfx.chute(); else sfx.glide(); break;
    case 'unglide': sfx.unglide(); break;
    case 'grab': sfx.grab(); break;
    case 'climbjump': sfx.climbJump(); break;
    case 'mantle': sfx.mantle(); break;
    case 'splash':
      sfx.splash();
      if (!splashed) { splashed = true; toast('풍덩! 물에 뛰어들었다'); }
      break;
    case 'stroke': sfx.stroke(); break;
    case 'drown':
      S.tired = Math.min(100, S.tired + 10);
      toast('힘이 빠져 물가로 끌려 나왔다 (지침 +10)');
      break;
    case 'exhausted': sfx.exhausted(); break;
    case 'recovered': sfx.recovered(); break;
    case 'roll': sfx.roll(); break;
    case 'rollLand': sfx.roll(); toast('낙법! 굴러서 충격을 흘렸다'); break;
    case 'slide': sfx.slide(); break;
    case 'vault': sfx.vault(); break;
    case 'crouch': case 'uncrouch': sfx.crouch(); break;
    case 'shutter': sfx.shutter(); street?.onShutter(); break;
    case 'stagger': break;
  }
}

/** 🗺 지도 보기: 위에서 내려다보고, 찍은 곳까지 알아서 걸어간다. 여는 동안 시간은 멈춘다. */
function setMapMode(on: boolean) {
  if (on && (!S.started || S.finished || metroOpen || openPlace || document.body.classList.contains('metro-mode'))) return;
  if (mapMode === on) return;
  mapMode = on;
  hero.town.mapView = on;
  document.body.classList.toggle('map-mode', on);
  paintEye();
  pins.setWalk(!on);
  if (on) {
    // 지도 엔진이 그리는 위에서 본 지도로 바꾼다(걷는 동안 멈춰 있던 자취·경로를 한 번에 채운다)
    map.stop();
    map.setCenterClampedToGround(true);
    (map.getSource('trail') as GeoJSONSource).setData(line(S.trail));
    (map.getSource('route') as GeoJSONSource).setData(line(S.path.length > 1 ? [S.pos, ...S.path.slice(S.seg + 1)] : []));
    (map.getSource('vision') as GeoJSONSource).setData(circle(S.pos, VISION));
    avatar.setLngLat(S.pos);
    map.jumpTo({ center: S.pos, zoom: 17.6, pitch: 30, bearing: hero.cam.yaw, elevation: 0, roll: 0 });
    map.easeTo({ zoom: 16.4, pitch: 0, bearing: 0, duration: 900 });
    hint('가고 싶은 곳을 누르면 거기까지 알아서 걸어갑니다. M 또는 🗺으로 돌아가기.');
  } else hint('');
}


// ───────── 거리에서 주고받기(Street) ─────────
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeStreet(): Street {
  return new Street({
    hero,
    S,
    places: () => places,
    visited: (p) => S.visits.some((v) => v.place.id === p.id),
    info: (p) => {
      const info = CAT_INFO[p.cat];
      const hasMenu = !!menuFor(p);
      const mins = p.mins ?? info.mins, cost = p.cost ?? info.cost;
      return {
        label: `${info.label}${p.tags.cuisine ? ' · ' + p.tags.cuisine.replace(/[;_]/g, ' ') : ''}${p.known ? ' · 알던 곳' : ''}`,
        blurb: p.blurb ?? describe(p),
        meta: `${hasMenu ? '들어가서 메뉴를 보고 고른다' : `약 ${mins}분 · ${cost ? `입장 €${cost} 안팎` : '무료'}`}${p.tags.opening_hours ? ' · ' + p.tags.opening_hours : ''}`,
      };
    },
    toast,
    hint: (s2) => hint(s2),
    enter: (p) => void enterPlace(p),
    metro: chooseDestination,
    bus: () => chooseDestination(),
    reveal: revealPlace,
    guide: (p) => { guideTarget = p; toast(`${p.emoji} ${p.name} 쪽에 빛기둥을 세웠다`); },
    toggleSave: (p) => {
      if (S.saved.has(p.id)) S.saved.delete(p.id); else { S.saved.add(p.id); sfx.heart(); showMarker(p, false); }
      markers.get(p.id)?.getElement().classList.toggle('saved', S.saved.has(p.id));
      return S.saved.has(p.id);
    },
    pay: (eur, what) => {
      if (S.money < eur) { toast(`돈이 모자라요 (${what} €${eur})`); return false; }
      S.money = Math.round((S.money - eur) * 100) / 100;
      S.buys.push({ what, cost: eur, at: S.clock });
      sfx.coin();
      hud();
      return true;
    },
    eat: (amount, sat = 0) => { eat(S, amount, sat); S.ate++; hud(); },
    rest: (amount) => { rest(S, amount); hud(); },
    passTime: (mins) => { S.clock += mins; drain(S, mins, 0); hud(); },
    shot: (label) => captureShot(label),
    terrace: (p, what, cost, mins) => {
      const at = S.clock;
      S.clock += mins;
      drain(S, mins, 0);
      rest(S, 12);
      eat(S, i2n(what));
      if (p) { S.visits.push({ place: p, at, mins, cost, note: `테라스 · ${what}` }); markers.get(p.id)?.getElement().classList.add('visited'); }
      hud();
    },
    frozen: () => modalOpen() || mapMode || metroOpen || !!openPlace,
  });
}
/** 테라스에서 시킨 것이 배를 얼마나 채우나 */
const i2n = (what: string) => (/와인/.test(what) ? 2 : /크렘/.test(what) ? 6 : 3);

/** 누가(포스터·지도·현지인) 알려 줘서 알게 된 곳 */
function revealPlace(p: Place, how: string) {
  p.known = true;
  if (!S.seen.has(p.id)) S.seen.set(p.id, S.clock);
  S.told.set(p.id, how);
  const m = markers.get(p.id);
  if (m) { m.getElement().classList.add('known', 'revealed'); m.getElement().classList.remove('off'); }
  else showMarker(p, true);
  markers.get(p.id)?.getElement().classList.add('revealed');
}

/** 문 앞까지 가서 문을 밀고 들어간다. 나오면 문 앞에 선다. */
async function enterPlace(p: Place) {
  if (entering || openPlace || !S.started || S.finished) return;
  const b = hero.body;
  const [px, py] = hero.frame.toLocal(p.pos);
  const f = p.minor ? null : hero.town.front({ id: p.id, x: px, y: py });
  const info = CAT_INFO[p.cat];
  const cost = p.cost ?? info.cost;
  if (!menuFor(p) && cost > S.money) { toast('돈이 모자라요'); return; }
  entering = true;
  try {
    const dx = (f?.x ?? px) - b.x, dy = (f?.y ?? py) - b.y;
    b.facing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    if (p.cat !== 'park') { b.doAct('push'); sfx.door(); }
    await wait(p.cat === 'park' ? 100 : 480);
    await street.ui.fade(true);
    S.opened.add(p.id);
    if (!S.seen.has(p.id)) S.seen.set(p.id, S.clock);
    openPlace = p;
    sfx.inside(true);
    await goInside(p, cost);
    sfx.inside(false);
    if (f) { b.place(f.x + f.nx * 1.2, f.y + f.ny * 1.2, 0); b.facing = ((Math.atan2(f.nx, f.ny) * 180) / Math.PI + 360) % 360; hero.cam.yaw = b.facing; }
    await street.ui.fade(false);
  } finally {
    entering = false;
  }
}

/** 지금 화면을 한 장 찍어 둔다(오늘의 사진) */
function captureShot(label: string) {
  // 걷기 화면(three.js)이 다음에 그린 그림을 그대로 뜬다
  hero.view.capture((url) => {
    if (url) S.shots.push({ src: url, x: 0.5, place: label, credit: '내가 찍은 사진' });
    street.ui.shutter(url);
    toast(`📷 ${label}`);
  });
}

function arrive() {
  S.path = [];
  (map.getSource('route') as GeoJSONSource).setData(line([]));
  const t = S.target;
  S.target = null;
  if (S.restAt) { S.restAt = false; goRest(); return; }
  if (S.travelTo) { const d = S.travelTo; const g = S.travelGate ?? nearestGate(); S.travelTo = null; S.travelGate = null; void ride(d, g); return; }
  if (t) street.inspectPlace(t);
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
const gateMarkers: Pin[] = [];
let trainMarker: Marker | null = null;
const stopMarkers: Marker[] = [];
const exitMarkers: Marker[] = [];
let trainAnim = 0;

/** 지금 지구의 지하철 출입구를 전부 지도에 찍는다. 눌러 둔 그 구멍으로 들어간다. */
let stayMarker: Pin | null = null;
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
  stayMarker = pins.add(el, st.pos, 'bottom');
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
  paintMetroBtn();
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
    gateMarkers.push(pins.add(el, g.pos, 'bottom'));
  }
}

const bottomPad = () => Math.round(Math.min(window.innerHeight * 0.52, 460));

/** 지하철을 보여 주는 동안은 걷기용 표시(가게 핀·자취·시야·HUD 버튼)를 치운다 */
function quietMap(on: boolean) {
  document.body.classList.toggle('metro-mode', on);
  for (const id of ['vision', 'trail', 'route']) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
}

const metroMap: MetroMap = {
  ride(color, stops, mode = 'metro') {
    quietMap(true);
    document.body.classList.toggle('bus-mode', mode === 'bus');
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
      trainMarker = new maplibregl.Marker({ element: el }).setLngLat(stops[0].pos);
    }
    trainMarker.getElement().textContent = mode === 'bus' ? '🚌' : '🚇';
    trainMarker.setLngLat(stops[0].pos).addTo(map);
    avatar.getElement().classList.add('hidden');
    map.setCenterClampedToGround(true);
    const b = stops.reduce((bb, s) => bb.extend(s.pos), new maplibregl.LngLatBounds(stops[0].pos, stops[0].pos));
    map.easeTo({ pitch: 0, bearing: 0, duration: 500 });
    setTimeout(() => map.fitBounds(b, { padding: { top: 90, bottom: bottomPad(), left: 50, right: 50 }, maxZoom: mode === 'bus' ? 16.2 : 15.8, duration: 1100 }), 520);
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
    document.body.classList.remove('bus-mode');
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
  // 지하철·버스도 직접 걷는다(역·전동차·버스 안 장면)
  const r = await transit.run(district, dest, j, gate, target.place ?? null, () => { pre = loadDistrict(dest, () => {}).catch(() => null); });
  metroOpen = false;
  if (!r) return; // 타지 않고 돌아섰다 — 카메라는 사람 뒤로 돌아온다
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
/** keep: 몸은 그대로 두고(날거나 걸어서 들어왔다) 동네 데이터만 갈아 끼운다 */
async function enterDistrict(d: District, at: LngLat, keep = false) {
  const data = await loadDistrict(d, (s) => (keep ? undefined : toast(s)));
  district = d;
  graph = buildGraph(data.ways);
  places = parsePlaces(data.places, d.curated, ALL_RICH);
  for (const p of places) allPlaces.set(p.id, p);
  for (const m of markers.values()) m.remove();
  markers.clear();
  S.node = nearestNode(graph, at);
  if (!keep) S.pos = graph.nodes[S.node];
  S.path = [];
  S.seg = 0;
  S.target = null;
  if (!keep) { S.trail = [S.pos]; lastTrail = S.pos; }
  const next = graph.adj[S.node]?.[0];
  hero.theme = d.id;
  hero.setWays(data.ways);
  hero.setGraph(graph.nodes, graph.adj.map((es) => es.map((e) => e.to)));
  hero.setLanes(laneSegments(graph));
  if (keep) hero.rebase();
  else hero.reset(S.pos, next ? bearing(S.pos, graph.nodes[next.to]) : 0);
  dressTown();
  street?.reset(d.id);
  guideTarget = null;
  if (keep) { toast(`📍 ${d.full}`); showStationMarker(); showStayMarker(); paintMetroBtn(); for (const p of places) if (p.known) showMarker(p, false); hud(); return; }
  wasCamOn = false; // 다음 프레임에 위에서 내려오며 사람 뒤로 붙는다
  avatar.setLngLat(S.pos);
  (map.getSource('trail') as GeoJSONSource).setData(line(S.trail));
  (map.getSource('route') as GeoJSONSource).setData(line([]));
  (map.getSource('vision') as GeoJSONSource).setData(circle(S.pos, VISION));
  if (map.getSource('streets')) (map.getSource('streets') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: data.ways } });
  map.jumpTo({ center: S.pos, zoom: 17.4, pitch: 40, bearing: hero.heading - 30, elevation: 0 });
  for (const p of places) if (p.known) showMarker(p, false);
  showStationMarker();
  showStayMarker();
  paintMetroBtn();
  look();
  hud();
}

// ───────── 하루의 빛: 아침 → 한낮 → 해질녘 → 밤 ─────────
type Sky = { t: number; sky: string; horizon: string; fog: string; sun: string; sunI: number; amb: string; ambI: number; tint: string };
const SKIES: Sky[] = [
  { t: 6 * 60, sky: '#8fa9d6', horizon: '#f2cfb0', fog: '#efd9c4', sun: '#ffd9b0', sunI: 1.6, amb: '#c9d6f0', ambI: 1.1, tint: '#f3d8c4' },
  { t: 9 * 60, sky: '#a9c9ec', horizon: '#efe3d2', fog: '#efe3d2', sun: '#fff4e0', sunI: 2.3, amb: '#cfe3ff', ambI: 1.35, tint: '#ffffff' },
  { t: 16 * 60, sky: '#9cc3ef', horizon: '#f1e6d4', fog: '#efe3d2', sun: '#fff0d8', sunI: 2.3, amb: '#d3e2fb', ambI: 1.3, tint: '#ffffff' },
  { t: 19 * 60, sky: '#e7a77a', horizon: '#f6c98f', fog: '#f0c49a', sun: '#ffb070', sunI: 2.0, amb: '#e8c3a8', ambI: 1.05, tint: '#f6c49a' },
  { t: 20.5 * 60, sky: '#4c4f86', horizon: '#d98a6a', fog: '#8b7189', sun: '#ff9a6a', sunI: 1.1, amb: '#8c8fc0', ambI: 0.8, tint: '#a8849c' },
  { t: 22 * 60, sky: '#141b38', horizon: '#2e3560', fog: '#2a2f4d', sun: '#9fb4ff', sunI: 0.45, amb: '#5a6aa8', ambI: 0.7, tint: '#4a5286' },
];
const mixHex = (a: string, b: string, k: number) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) + ((((pb >> sh) & 255) - ((pa >> sh) & 255)) * k));
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
};
let lastSkyMin = -99;
function paintSky() {
  if (!map || Math.abs(S.clock - lastSkyMin) < 3) return;
  lastSkyMin = S.clock;
  const m = S.clock % (24 * 60);
  const i = SKIES.findIndex((x) => x.t > m); // 처음보다 이르면 0, 마지막보다 늦으면 -1
  const a = i === -1 ? SKIES[SKIES.length - 1] : SKIES[Math.max(0, i - 1)];
  const b = i === -1 ? a : SKIES[i];
  const k = b.t > a.t ? Math.max(0, (m - a.t) / (b.t - a.t)) : 0;
  map.setSky({ 'sky-color': mixHex(a.sky, b.sky, k), 'horizon-color': mixHex(a.horizon, b.horizon, k), 'fog-color': mixHex(a.fog, b.fog, k), 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.9 });
  hero?.figure.light(mixHex(a.sun, b.sun, k), Math.max(1.7, a.sunI + (b.sunI - a.sunI) * k), mixHex(a.amb, b.amb, k), Math.max(1.2, a.ambI + (b.ambI - a.ambI) * k)); // 어둡게 하는 건 위의 색 곱하기가 맡는다
  // 밤이 깊을수록(0..1): 창에 불이 켜지고 가로등이 빛난다
  const night = m >= 19.5 * 60 ? Math.min(1, (m - 19.5 * 60) / 120) : m < 6.5 * 60 ? 1 - Math.max(0, (m - 5.5 * 60) / 60) : 0;
  // 지도 전체(땅·건물·사람)에 같은 빛깔을 곱해 한 장면으로 보이게 한다. 밤에는 덜 곱하고 대신 거리(Town)가 스스로 어두워진다 — 불 켜진 창이 살아 있게.
  const tint = mixHex(mixHex(a.tint, b.tint, k), '#ffffff', night * 0.5);
  document.documentElement.style.setProperty('--daylight', tint);
  map.setLight({ anchor: 'map', color: mixHex('#ffffff', tint, 0.6), intensity: 0.45, position: [1.15, 210, 30] });
  if (map.getLayer('night')) map.setPaintProperty('night', 'fill-opacity', night * 0.5);
  if (hero) {
    // 해: 아침엔 동쪽, 한낮엔 남쪽 높이, 저녁엔 서쪽
    const ang = Math.max(0, Math.min(Math.PI, ((m - 6 * 60) / (15 * 60)) * Math.PI));
    const sun = new THREE.Vector3(Math.cos(ang), -0.75 * Math.sin(ang), 0.18 + 0.62 * Math.sin(ang));
    const sunI = (a.sunI + (b.sunI - a.sunI) * k) * 0.42, ambI = (a.ambI + (b.ambI - a.ambI) * k) * 0.5;
    const scale = (hex: string, f: number) => { const c = new THREE.Color(hex); c.multiplyScalar(f); return `#${c.getHexString()}`; };
    hero.town.daylight(sun, scale(mixHex(a.sun, b.sun, k), Math.min(1, sunI)), scale(mixHex(a.amb, b.amb, k), Math.min(1, ambI)), night, mixHex(a.fog, b.fog, k));
    hero.crowd.light(mixHex(a.sun, b.sun, k), Math.max(1.2, sunI * 2.2), mixHex(a.amb, b.amb, k), Math.max(0.9, ambI * 2.4));
    hero.crowd.density = 1 - night * 0.55;
    // 걷기 화면의 하늘(구름·해·별)
    const u = hero.view.skyU;
    u.uTop.value.set(mixHex(a.sky, b.sky, k));
    u.uHorizon.value.set(mixHex(a.horizon, b.horizon, k));
    u.uFog.value.set(mixHex(a.fog, b.fog, k));
    u.uSun.value.copy(sun).normalize();
    u.uSunCol.value.set(mixHex(a.sun, b.sun, k));
    u.uNight.value = night;
  }
}

function hud() {
  paintSky();
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

const EIFFEL: LngLat = [2.29448, 48.85826];
/** 시작 전 준비: 몸을 하늘에 세워 두고(멈춤), 보이는 칸을 다 짓고 지도 타일을 다 받고, 화면을 몇 번 그려 둔다.
 *  첫 화면(에펠탑 위)에서 읽고 짓느라 끊기지 않게 — 인트로 뒤에서 미리 한다. */
let preparing = false;
async function prepare(fallback: boolean) {
  const go = $<HTMLButtonElement>('#go');
  const status = $('#status');
  preparing = true;
  // 탑에서 150 m 뒤, 430 m 높이(탑 꼭대기보다 100 m 위) — 내려다보면 탑 전체와 그 너머 시내가 보인다
  const [x, y] = hero.frame.toLocal(EIFFEL);
  const B = (44 * Math.PI) / 180; // 바라보는 방향(58°)과 조금 어긋나게 — 탑이 주인공 몸에 가리지 않게
  hero.body.skydive(x - Math.sin(B) * 150, y - Math.cos(B) * 150, 430, 58);
  hero.cam.snap(hero.body);
  hero.cam.yaw = 58;
  hero.cam.pitch = 36;
  hero.cam.wantDist = 13;
  map.setCenterClampedToGround(false);
  if (map.getLayer('vision')) map.setLayoutProperty('vision', 'visibility', 'none');
  // 다른 동네 거리 데이터도 미리 받아 둔다 — 낙하산으로 경계를 넘을 때 기다리지 않게
  let fetched = false;
  void Promise.all(Object.values(DISTRICTS).map((d) => loadDistrict(d, () => undefined).catch(() => null))).then(() => { fetched = true; });
  const town = hero.town;
  town.budget = 40; // 인트로가 가리고 있으니 한 프레임에 많이 지어도 된다
  const t0 = performance.now();
  let calm = 0, shown = 0, lastBacklog = -1, lastMove = t0;
  await new Promise<void>((done) => {
    const check = () => {
      const tiles = fallback || hero.world.tilesReady();
      const built = town.inView ? 1 - town.backlog / town.inView : 0;
      const pct = Math.round(Math.min(0.98, built * 0.85 + (tiles ? 0.1 : 0) + Math.min(calm, 20) * 0.0025) * 100);
      shown = Math.max(shown, pct);
      go.textContent = `준비 중… ${shown}%`;
      status.textContent = !tiles ? '지도를 받는 중' : !fetched ? '파리 거리 지도를 받는 중' : town.far.backlog ? `먼 도시를 세우는 중 (${town.far.backlog})` : town.backlog ? `거리를 세우는 중 (${town.inView - town.backlog}/${town.inView})` : '사람들을 불러 모으는 중';
      // 다 지은 뒤에도 20프레임 더 그려 둔다(셰이더 준비·사람 채우기·첫 그림)
      if (tiles && town.inView > 0 && town.backlog === 0 && town.far.backlog === 0) calm++; else calm = 0;
      // 지도 밖이라 영영 준비되지 않는 칸이 있을 수 있다 — 5초 동안 줄지 않으면 그만 기다린다
      const now = performance.now();
      if (town.backlog !== lastBacklog) { lastBacklog = town.backlog; lastMove = now; }
      const stuck = tiles && now - lastMove > 5000;
      if ((calm > 20 || stuck) && fetched) done();
      else if (now - t0 > 30000) done();
      else requestAnimationFrame(check);
    };
    check();
  });
  town.budget = 5;
  S.pos = hero.lnglat;
  S.origin = S.pos;
  S.trail = [S.pos];
  lastTrail = S.pos;
  status.textContent = '';
  go.removeAttribute('disabled');
  go.textContent = '🪂 뛰어내리기';
}

async function start() {
  const go = $<HTMLButtonElement>('#go');
  if (go.disabled) return;
  go.disabled = true;
  sfx.unlock();
  sfx.startMusic();
  preparing = false;
  S.started = true;
  wasCamOn = true; // 카메라는 이미 몸 뒤에 있다 — 지도에서 내려오는 전환 없이 바로
  hero.visible = true;
  // 이미 그려진 하늘 위 장면 위로 인트로가 걷힌다
  $('#intro').classList.add('rise');
  setTimeout(() => $('#intro').classList.add('gone'), 2600);
  $('#hud').classList.add('on');
  mapHandlers(false);
  avatar.getElement().classList.add('hidden');
  sfx.wind(1);
  hud();
  const touch = hero.input.touched || matchMedia('(pointer: coarse)').matches;
  if (touch) document.body.classList.add('touch-play');
  hint(touch ? '🪂 파리 위로 떨어지는 중! 왼쪽을 끌어 방향, 점프 버튼으로 낙하산을 편다(낮아지면 저절로). 어디든 내려앉아 걸어 보자.' : '🪂 파리 위로 떨어지는 중! WASD로 방향, Space로 낙하산 펴기(낮아지면 저절로). 펴고 나면 Shift 급강하, Space 접기.');
  setTimeout(() => hint(''), 9000);
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
  if (street) lines.push(...street.summary());
  if (S.buys.length) lines.push(`길에서 산 것: ${S.buys.slice(0, 4).map((x) => `${x.what} €${x.cost}`).join(', ')}.`);
  if (!lines.length) lines.push('아직 기록이 적어요. 조금 더 걸어 보면 당신이 어디서 멈추는 사람인지 보이기 시작해요.');

  $('#sum-stats').textContent = `${fmtClock(7 * 60 + 40)} → ${fmtClock(S.clock)} · ${(S.walked / 1000).toFixed(1)} km · ${S.seen.size}곳 발견 · ${S.visits.length}곳 들어감 · €${(320 - S.money).toFixed(2)} 씀${S.stay ? ` · ${S.stay.name}` : ''}`;
  $('#sum-lines').replaceChildren(...lines.map((s) => { const li = document.createElement('li'); li.textContent = s; return li; }));
  const stops = [...S.visits.map((v) => ({ p: v.place, note: `${fmtClock(v.at)} · ${v.mins}분${v.cost ? ` · €${v.cost}` : ''}${v.dishes ? ` · ${v.dishes.map((d) => d.name).join(', ')}` : ''}${v.note ? ` · ${v.note}` : ''}` })),
    ...[...S.told.keys()].map((id) => byId.get(id)).filter((p): p is Place => !!p && !S.visits.some((v) => v.place.id === p.id) && !S.saved.has(p.id)).map((p) => ({ p, note: `${S.told.get(p.id)} — 다음에` })),
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
const stayBtn = $<HTMLButtonElement>('#stay-go');
function paintMetroBtn() {
  metroBtn.innerHTML = '🚇<span class="lbl"> 어디 갈까</span>';
  metroBtn.title = '다른 동네, 또는 가고 싶은 곳을 고른다';
  metroBtn.onclick = chooseDestination;
  const st = S.stay;
  stayBtn.hidden = !st;
  if (st) {
    const here = st.district === district.id;
    stayBtn.textContent = here ? '🛏 숙소' : `🛏 ${DISTRICTS[st.district].name}`;
    stayBtn.title = here ? `${st.name}으로 돌아가 쉰다` : `숙소는 ${DISTRICTS[st.district].name}에 있다`;
    stayBtn.onclick = () => (here ? goRest() : chooseDestination());
  }
}
$('#go').addEventListener('click', start);
const eyeBtn = $<HTMLButtonElement>('#eye');
function paintEye() { eyeBtn.innerHTML = mapMode ? '🚶<span class="lbl"> 걷기</span>' : '🗺<span class="lbl"> 지도</span>'; eyeBtn.title = mapMode ? '다시 직접 걷는다 (M)' : '위에서 내려다보고 갈 곳을 찍는다 (M)'; }
paintEye();
eyeBtn.addEventListener('click', () => { eyeBtn.blur(); setMapMode(!mapMode); });
$('#end').addEventListener('click', finish);
const muteBtn = $<HTMLButtonElement>('#mute');
const paintMute = () => { muteBtn.textContent = sfx.isMuted() ? '🔇' : '🔊'; };
paintMute();
muteBtn.addEventListener('click', () => { muteBtn.blur(); sfx.unlock(); sfx.setMuted(!sfx.isMuted()); paintMute(); });
$('#again').addEventListener('click', () => location.reload());
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if (openPlace) closeCard('pass'); else if (mapMode) setMapMode(false); } });
// 이 화면은 스크롤되지 않는다. 그런데도 포커스 이동·scrollIntoView가 문서를 밀어 올려
// 아래에 대기 중인 요약 패널이 딸려 올라오는 일이 반복돼서, 밀리면 바로 되돌린다.
window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); }, { passive: true });
if (import.meta.env.DEV || location.search.includes('debug')) (window as unknown as { __walk: unknown }).__walk = { S, hero: () => hero, arrive: async (id: keyof typeof DISTRICTS) => { metroMap.ride('#bf3283', [{ name: 'a', pos: S.pos }, { name: 'b', pos: DISTRICTS[id].start }]); await new Promise((r) => setTimeout(r, 1500)); metroMap.clear(); await enterDistrict(DISTRICTS[id], DISTRICTS[id].start); }, quick: async () => { preparing = false; $('#intro').classList.add('gone'); sfx.unlock(); S.started = true; $('#hud').classList.add('on'); await enterDistrict(district, district.start); }, walkTo, openCard, finish, cpu, street: () => street, transit: () => transit, travel, ride, planJourney, DISTRICTS, places: () => places, graph: () => graph, map: () => map };
window.addEventListener('error', (e) => { try { localStorage.setItem('carnet-walk-lasterror', `${new Date().toISOString()} ${e.message} @${e.filename}:${e.lineno}`); } catch { /* 무시 */ } });
requestAnimationFrame(frame);
void boot();
