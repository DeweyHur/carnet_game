// 파리 모험(원신처럼): 에펠탑 아래 샹드마르스에서 시작해, 실제 파리 골목을 걷고 오르고 날며
// 순간이동 포인트·보물상자·요괴·비경·랜드마크의 부탁을 하나씩. 길잡이는 요정 리리.
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MlMap, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import './walk.css';
import { bearing, buildGraph, dist, nearestNode } from './graph';
import type { Graph, LngLat } from './graph';
import { parsePlaces } from './places';
import type { Place } from './places';
import { loadDistrict } from './data';
import { EIFFEL_ZONES } from './eiffel';
import { DISTRICTS, stopPos, LINES } from './districts';
import type { District } from './districts';
import { ALL_RICH } from './rich';
import * as sfx from './sound';
import { Hero } from './hero';
import { Sky as SkyLife } from './sky';
import { Pins } from './pins';
import type { Pin } from './pins';
import { Street } from './street';
import type { BodyEvent } from './hero';
import { angleDiff } from './hero/geo';
import * as THREE from 'three';
import { Wardrobe, modsOf } from './gear';
import { Closet } from './closet';
import { Growth, ARMOR_SLOTS, type GrowthMods } from './growth';
import { Party, type CharId } from './party';
import { Creator, PartyPanel } from './partyui';
import { SPEED } from './moves';
import { Arsenal } from './skills';
import { SkillPanel } from './skillui';
import { GrowthPanel } from './growthui';
import { Horde } from './horde';
import { Tales } from './tales';
import { Minimap } from './minimap';
import { Journal } from './journal';
import { Progress, arNeed, COMMISSION_TEXT, FEATURES } from './progress';
import { Feed } from './feed';
import { Banner } from './banner';
import { Explore, WAYPOINTS } from './explore';
import type { Waypoint } from './explore';
import { Wish } from './wish';
import { Combat } from './combat';
import { Companion } from './companion';
import { Ascend } from './ascend';
import { Domain } from './domain';
import { Prologue, PROLOGUE_START, TOWER, KING_AT } from './prologue';
import { GEAR } from './gear';
import type { Kind as FoeKind } from './combat';
import { CHAPTERS } from './street/story';

maplibregl.setWorkerUrl(workerUrl);

let district: District = DISTRICTS['champs-elysees'];
const START: LngLat = PROLOGUE_START;
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const VISION = 45; // m — 이 안에 들어오면 가게·명소를 "발견"한다(멈춰 있을 때)
// 시야: 달리는 동안은 카메라가 보는 쪽 ±FOV° 안, SIGHT m 이내만 보인다
const FOV = 70;
const SIGHT = 60;
const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const S = {
  pos: START as LngLat,
  node: 0,
  /** 게임 속 시각(분). 1초 = 1분 — 24분이면 하루가 돈다(앉아 있으면 10배) */
  clock: 7 * 60 + 40,
  money: 320,
  walked: 0,
  heading: 0,
  seen: new Map<string, number>(),
  trail: [START] as LngLat[],
  started: false,
  /** 예전 저장·도구와 맞추려고 남긴 것(끝나는 날은 없다) */
  finished: false,
};

let map: MlMap;
let graph: Graph;
let places: Place[] = [];
let avatar: Pin;
let pins: Pins;
let hero: Hero;
let street: Street;
let wardrobe: Wardrobe;
let closet: Closet;
let minimap: Minimap;
let journal: Journal;
let progress: Progress;
let explore: Explore;
let wish: Wish;
let combat: Combat;
let companion: Companion;
let ascend: Ascend;
let domain: Domain;
let prologue: Prologue;
let growth: Growth;
let growthUi: GrowthPanel;
let horde: Horde;
let tales: Tales;
let party: Party;
let arsenal: Arsenal;
let skillUi: SkillPanel;
let creator: Creator;
let partyUi: PartyPanel;
/** 🌙 밤 모드(밤 습격): 사람 대신 요괴가 물결마다 몰려온다 */
let nightMode = (() => { try { return localStorage.getItem('carnet-mode') === 'night'; } catch { return false; } })();
let entering = false;
let mapMode = false; // 🗺 지도 보기(위에서 내려다보며 순간이동 포인트를 누른다)
let night01 = 0;
const markers = new Map<string, Pin>();

const line = (coords: LngLat[]) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: coords } });

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
    if (graph.nodes.length < 50) throw new Error('거리 그래프가 비어 있습니다.');
    // 첫걸음: 에펠탑 앞 샹드마르스 잔디밭에서(헤맬 일 없이 할 거리가 가장 많은 곳)
    S.node = nearestNode(graph, PROLOGUE_START);
    S.pos = PROLOGUE_START;
    S.trail = [S.pos];

    map = new maplibregl.Map({ container: 'map', style: st.style, center: S.pos, zoom: 18.4, pitch: 25, bearing: -20, attributionControl: { compact: true }, maxPitch: 85, maxZoom: 24, clickTolerance: 10, pixelRatio: Q_DPR[quality] });
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
      { const [tx, ty] = hero.frame.toLocal(TOWER); hero.body.facing = ((Math.atan2(tx, ty) * 180) / Math.PI + 360) % 360; hero.cam.snap(hero.body); } // 탑을 바라보며
      hero.town.setFar(st.fallback ? 300 : 1e6);
      applyQuality();
      dressTown();
      hero.hud.onPrompt = () => hero.input.press('interact');
      hero.hud.onPrompt2 = () => hero.input.press('secondary');
      street = makeStreet();
      setupGear();
      setupAdventure();
      const last = WAYPOINTS.find((w) => w.id === progress.last);
      if (last) {
        const rb = $<HTMLButtonElement>('#resume');
        rb.textContent = `🔷 이어서 — ${last.name}에서`;
        rb.hidden = false;
        rb.onclick = () => { rb.disabled = true; void start(last); };
      }
      journal = new Journal(() => street?.story ?? null, () => progress);
      street.story.onChange = () => journal.refresh();
      setupMinimap();
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
  map.addSource('trail', { type: 'geojson', data: line(S.trail) });
  map.addLayer({ id: 'trail', type: 'line', source: 'trail', paint: { 'line-color': '#e4572e', 'line-width': 4, 'line-opacity': 0.55 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });

  const el = document.createElement('div');
  el.className = 'me';
  el.innerHTML = '<i></i>';
  avatar = pins.add(el, S.pos);
  el.classList.add('hidden');

  for (const p of places) if (p.known) showMarker(p);
}

/** 지도 보기의 장소 표시(걷는 동안엔 숨는다 — 원신처럼 화면엔 할 일만) */
function showMarker(p: Place) {
  if (markers.has(p.id)) return;
  const el = document.createElement('button');
  el.className = `pl ${p.curated ? 'curated' : ''} ${p.known ? 'known' : ''} ${p.minor ? 'minor' : ''}`;
  el.innerHTML = `<span class="em">${p.emoji}</span>${p.curated ? `<span class="nm"></span>` : ''}`;
  if (p.curated) el.querySelector('.nm')!.textContent = p.name;
  el.title = p.name;
  el.addEventListener('click', (ev) => { ev.stopPropagation(); toast(`${p.emoji} ${p.name}`); });
  markers.set(p.id, pins.add(el, p.pos, 'bottom'));
}

/** 가까이 오면(또는 달리며 앞쪽에 보이면) 발견한다 — 지도에 표시 · 모험 경험치 */
function look() {
  const moving = hero.body.speed > 0.6;
  for (const p of places) {
    if (S.seen.has(p.id)) continue;
    const d = dist(S.pos, p.pos);
    if (d > (moving ? SIGHT : VISION)) continue;
    if (moving && d > 12 && Math.abs(angleDiff(hero.cam.yaw, bearing(S.pos, p.pos))) > FOV) continue;
    S.seen.set(p.id, S.clock);
    showMarker(p);
    if (p.curated) {
      const [px, py] = hero.frame.toLocal(p.pos);
      const f = p.minor ? null : hero.town.front({ id: p.id, x: px, y: py });
      const ax = f ? f.x + f.nx * 0.8 : px, ay = f ? f.y + f.ny * 0.8 : py;
      const gz = hero.world.terrain(ax, ay);
      street.ui.say(() => ({ x: ax, y: ay, z: gz + (f ? 5.4 : 2.6) }), `✨ ${p.emoji} ${p.name}`, 3, 'found big');
      sfx.spot();
    }
  }
}

let lastT = 0;
let lookAcc = 0;
let wasCamOn = false;
let lastTrail: LngLat = START;
let splashed = false;
let climbT = 0;
const MODALS = ['closet', 'journal', 'wish', 'menu', 'growth', 'creator', 'party', 'skills'];
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
  // 히트스톱: 맞히는 순간 아주 잠깐 시간이 멎는다(타격감)
  const dt = Math.min(0.1, raw) * (combat?.timeScale(Math.min(0.1, raw)) ?? 1);
  lastT = t;
  govern(raw); // 느린 기기는 실제 흐른 시간으로 재야 빨리 품질을 낮춘다
  soundAcc += dt;
  if (soundAcc > 0.25 && S.started) { soundAcc = 0; soundscape(); }
  if (domain?.active) { domain.frame(dt); return; }
  if (hero) {
    heroFrame(dt);
    // 걷기 화면을 그린다(지도 보기 중엔 지도 엔진이 그린다)
    hero.view.visible = !mapMode;
    hero.render(dt);
    minimap.visible = S.started && !mapMode && !modalOpen();
    minimap.update(dt);
    if (!mapMode) pins.update((p) => hero.frame.toLocal(p), (x, y) => hero.world.terrain(x, y), [hero.body.x, hero.body.y], (x, y, z, o) => hero.view.project(x, y, z, o));
  }
  districtAcc += dt;
  if (districtAcc > 1.5) { districtAcc = 0; autoDistrict(); }
  lookAcc += dt;
  if (lookAcc > 0.25 && S.started && hero) { lookAcc = 0; look(); paintSky(); milestones(); photoBtn.classList.toggle('nudge', !!street?.wantsPhoto || prologue?.stepId === 'photo'); }
}

/** 거리(Town)에 이 동네의 장소(가게 간판)·지하철 입구·버스 정류장을 알려 준다(풍경) */
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
  const gates = district.stations.flatMap((st) => st.gates.map((g) => ({ st, g })));
  hero.town.setGates(gates.map(({ st, g }) => { const [x, y] = f.toLocal(g.pos); return { x, y, station: st.name, label: g.label }; }), bus);
}

// ───────── 품질 자동 조절: 느리면 해상도·짓는 반경·사람 수를 줄이고, 여유가 생기면 되돌린다 ─────────
const COARSE = matchMedia('(pointer: coarse)').matches;
const Q_DPR = [Math.min(2, window.devicePixelRatio || 1), Math.min(1.5, window.devicePixelRatio || 1), 1, 0.8];
const Q_RADIUS = [300, 240, 190, 150];
const Q_CROWD = [46, 34, 24, 14];
const Q_HORDE = [30, 24, 18, 12]; // 밤 습격: 한 번에 살아 있는 요괴 수
const Q_GRASS = [30, 24, 16, 0];
const Q_SHADOW = [2048, 2048, 1024, 0]; // 해 그림자 지도 크기(0 = 끔) // 풀이 나는 반경(m) — 가장 낮은 품질에선 풀 없이 결만
let quality = 1; // 처음엔 한 단계 낮게 시작해 여유가 있으면 올린다(시작이 버벅이지 않게)
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
  hero.shadow.setSize(Q_SHADOW[quality]);
  if (import.meta.env.DEV) console.debug(`[quality] ${quality} (${Math.round(frameEma)} ms)`);
}

// ───────── 소리: 음악 분위기·거리 공기·바람 ─────────
let soundAcc = 0;
function soundscape() {
  if (!hero) return;
  const b = hero.body;
  const hour = (S.clock / 60) % 24;
  sfx.musicMood(hour, !!domain?.active, !!street?.holding);
  const near = (kind: string, r: number) => { let k = 0; for (const sp of hero.town.spots) if (sp.kind === kind) { const d = Math.hypot(sp.x - b.x, sp.y - b.y); if (d < r) k = Math.max(k, 1 - d / r); } return k; };
  let flock = 0;
  for (const f of hero.crowd.flocks) { const d = Math.hypot(f.x - b.x, f.y - b.y); if (d < 20) flock = Math.max(flock, 1 - d / 20); }
  let park = 0;
  for (const p of places) if (p.cat === 'park') { const d = dist(S.pos, p.pos); if (d < 80) park = Math.max(park, 1 - d / 80); }
  sfx.ambient({ night: night01, hour, z: b.z, underground: !!domain?.active, terrace: near('terrace', 16), fountain: near('fountain', 12), flock, park, crowd: Math.min(1, hero.crowd.npcs.length / 40) });
  const g = b.mode === 'glide' ? 0.55 + (b.parachute ? 0.2 : 0) : 0;
  sfx.wind(domain?.active ? 0 : Math.max(g, Math.min(0.8, (b.z - 12) / 70), b.mode === 'air' && b.vz < -8 ? 0.6 : 0));
}

// ───────── 어디든: 다른 동네로 걸어·날아 들어가면 그 동네를 읽는다 ─────────
let districtAcc = 0;
let switching = false;
function autoDistrict() {
  if (switching || !S.started || mapMode || domain?.active) return;
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

function heroFrame(dt: number) {
  const live = S.started;
  const modal = modalOpen();
  hero.visible = S.started;
  hero.input.enabled = live && !modal && !mapMode;
  hero.input.allowMapKey = live && !modal;
  hero.hud.show(live && !mapMode);
  const camOn = live && !mapMode;
  if (camOn !== wasCamOn) {
    wasCamOn = camOn;
    if (camOn) { hero.resume(S.walked ? 1.3 : 2.6); mapHandlers(false); avatar.getElement().classList.add('hidden'); }
    else { map.setCenterClampedToGround(true); mapHandlers(true); if (mapMode) avatar.getElement().classList.remove('hidden'); }
  }
  if (sky?.riding) { const st = sky.seat(); if (st) seatAt(st); }
  if (preparing) {
    hero.visible = true;
    hero.tick(dt, { waypoint: null, frozen: true, hold: true, pace: 1, maxStamina: 1, beacon: null });
    hero.drive(dt);
    return;
  }
  if (!S.started) return;
  const talking = !!street?.holding;
  const frozen = !live || modal || mapMode || talking || entering;
  // 빛기둥: 첫걸음 > 거리의 일·부탁
  // 밤이거나 두 얼굴의 자리가 가까우면(400 m) 그쪽을 먼저
  const tb = tales?.target() ?? null;
  const tNear = !!tb && (nightMode || Math.hypot(tb[0] - hero.body.x, tb[1] - hero.body.y) < 400);
  const qb = prologue?.beacon() ?? (tNear ? tb : null) ?? street?.beacon ?? tb;
  const beacon = qb ? hero.frame.toLngLat(qb[0], qb[1]) : null;
  miniBeacon = qb;
  const r = hero.tick(dt, {
    waypoint: null,
    frozen,
    pace: 1,
    maxStamina: wardrobe.has('backpack') ? 1.12 : 1, // 배낭은 기력 바퀴가 12% 크다
    beacon,
    hold: !!sky?.riding, // 열기구에 타고 있는 동안은 몸을 움직이지 않는다
  });
  if (sky) {
    if (sky.riding && r.f.jump && live && !modal) { sky.leave(hero.body); hero.hud.jumpLabel = null; hint('점프! 공중에서 한 번 더 누르면 글라이더를 편다'); setTimeout(() => hint(''), 4000); }
    sky.update(dt, hero.body, hero.town.uniforms.uNight.value);
    if (sky.riding) hero.hud.jumpLabel = '뛰어내리기';
  }
  if (r.f.map && live && !modal && !talking) { setMapMode(!mapMode); return; } // 이번 프레임에 카메라를 잡으면 지도 보기 전환(easeTo)이 끊긴다
  const exploring = live && !modal && !mapMode && !entering && !talking && !sky?.riding;
  companion?.update(dt, live && !mapMode && !modal);
  ascend?.update(dt, r.f, exploring);
  prologue?.update(dt, live && !mapMode);
  combat?.update(dt, r.f, exploring); // 먼저: 원점이 바뀌면 싸움이 먼저 비우고, 탐험이 야영지를 다시 세운다
  horde?.update(dt);
  arsenal?.update(dt, exploring);
  arsenal?.show(S.started && !mapMode);
  if (horde) horde.pausedNow = !exploring || !!domain?.active;
  domain?.update(dt, r.f, exploring);
  explore?.update(dt, r.f, exploring);
  if (tales) tales.hidden = !!prologue?.running;
  tales?.update(dt, r.f, exploring && !domain?.active);
  hero.hud.override = exploring ? domain?.prompt2() ?? explore?.prompt() ?? tales?.prompt() ?? null : null;
  street?.update(dt, r.f, live && !modal && !mapMode && !entering);
  if (sky?.riding) { hero.hud.setPrompt(null); hero.hud.setPrompt2(null); }
  if (!live) { if (camOn) hero.drive(dt); return; }

  const b = hero.body;
  if (progress) {
    b.mods.stamina = progress.staminaCost;
    if (b.mode === 'glide') glideAcc += dt;
    if (b.mode === 'climb') climbAcc += b.lift;
  }
  // 시간: 1초 = 1분, 앉아 있으면 10배(밤을 기다릴 때)
  if (!modal && !mapMode && !nightMode) S.clock += dt * (b.mode === 'sit' ? 10 : 1); // 밤 모드는 밤에 머문다
  S.pos = hero.lnglat;
  S.heading = hero.heading;
  if (b.moved > 0) S.walked += b.moved;
  if (dist(lastTrail, S.pos) > 3) {
    lastTrail = S.pos;
    S.trail.push(S.pos);
    if (S.trail.length > 4000) S.trail.splice(0, 1000);
    if (mapMode) (map.getSource('trail') as GeoJSONSource).setData(line(S.trail)); // 걷는 동안엔 지도를 그리지 않는다(지도 보기로 갈 때 한 번에)
  }
  avatar.setLngLat(S.pos);
  for (const e of hero.events) onBodyEvent(e);
  const mus = hero.crowd.nearest(b.x, b.y, 0, 30, (n) => n.role === 'musician');
  sfx.music(mus ? Math.max(0, 1 - Math.hypot(mus.x - b.x, mus.y - b.y) / 30) : 0);
  if (b.mode === 'climb' && b.climbMove > 0.1) { climbT += dt; if (climbT > 0.38) { climbT = 0; sfx.climbStep(); } }
  document.body.classList.toggle('climbing', b.mode === 'climb');
  if (camOn) hero.drive(dt);
}

function onBodyEvent(e: BodyEvent) {
  switch (e) {
    case 'stepL': case 'stepR': sfx.step(e === 'stepL', hero.body.z - hero.world.terrain(hero.body.x, hero.body.y) > 2.5 ? 'roof' : 'stone'); break;
    case 'jump': sfx.jump(); break;
    case 'land': sfx.land(); break;
    case 'hurt':
      sfx.hurt();
      toast('쿵! 높은 데서 그냥 뛰어내렸다 — 공중에서 Space로 글라이더, 착지 직전 V로 낙법');
      combat?.fallDamage(12);
      break;
    case 'glide': if (hero.body.parachute) sfx.chute(); else sfx.glide(); break;
    case 'unglide': sfx.unglide(); break;
    case 'grab': sfx.grab(); break;
    case 'climbjump': sfx.climbJump(); break;
    case 'mantle': sfx.mantle(); break;
    case 'splash':
      sfx.splash();
      if (!splashed) { splashed = true; toast('풍덩! 물에 뛰어들었다'); wardrobe.unlock('marin'); }
      break;
    case 'stroke': sfx.stroke(); break;
    case 'drown': toast('힘이 빠져 물가로 끌려 나왔다'); break;
    case 'exhausted': sfx.exhausted(); break;
    case 'recovered': sfx.recovered(); break;
    case 'roll': sfx.roll(); break;
    case 'rollLand': sfx.roll(); toast('낙법! 굴러서 충격을 흘렸다'); break;
    case 'slide': sfx.slide(); break;
    case 'vault': sfx.vault(); break;
    case 'crouch': case 'uncrouch': sfx.crouch(); break;
    case 'shutter': sfx.shutter(); street?.onShutter(); progress?.bump('photo'); break;
    case 'stagger': break;
  }
}

/** 🗺 지도 보기: 위에서 내려다보고, 🔷를 누르면 순간이동. 여는 동안 시간은 멈춘다. */
function setMapMode(on: boolean) {
  if (on && (!S.started || domain?.active)) return;
  if (mapMode === on) return;
  mapMode = on;
  hero.town.mapView = on;
  document.body.classList.toggle('map-mode', on);
  pins.setWalk(!on);
  if (on) {
    menu(false);
    map.stop();
    map.setCenterClampedToGround(true);
    (map.getSource('trail') as GeoJSONSource).setData(line(S.trail));
    avatar.setLngLat(S.pos);
    map.jumpTo({ center: S.pos, zoom: 17.6, pitch: 30, bearing: hero.cam.yaw, elevation: 0, roll: 0 });
    map.easeTo({ zoom: 15.6, pitch: 0, bearing: 0, duration: 900 });
    hint('🔷 켠 순간이동 포인트를 누르면 그리로 간다 · M 또는 ✕로 닫기');
  } else hint('');
}

// ───────── 거리에서 주고받기(Street) ─────────
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function makeStreet(): Street {
  return new Street({
    hero,
    S,
    toast,
    hint: (s2) => hint(s2),
    shot: (label) => captureShot(label),
    frozen: () => modalOpen() || mapMode,
    charm: () => wardrobe.has('mariniere'),
    gear: (id) => wardrobe.unlock(id),
    fight: (key, x, y, z, foes, ring) => combat?.spawnCamp(key, x, y, z, 0.3, foes as FoeKind[], ring),
    fightDone: (key) => !!combat?.campDone(key),
  });
}

// ───────── 모험(원신처럼): 경험치·별조각·순간이동·상자·의뢰·기원 ─────────
let glideAcc = 0, climbAcc = 0;
const adv: Partial<Record<'bonjour' | 'seen' | 'walked' | 'helped', number>> = {};
const wpPins = new Map<string, HTMLElement>();
const xpMul = () => (wardrobe?.has('tophat') ? 1.15 : 1);
const feed = new Feed();
const banner = new Banner();
const addMoney = (eur: number) => {
  S.money = Math.round((S.money + eur) * 100) / 100;
  paintMenu();
  if (eur >= 1) feed.push('💶', `€ +${Math.round(eur)}`, 'gold');
};
/** 입은 옷(모자·윗옷·가방·신발)의 강화 레벨 합(레벨 1을 뺀 것) */
const armorSum = () => ARMOR_SLOTS.reduce((a, s) => a + wardrobe.lvOf(wardrobe.loadout[s]) - 1, 0);
/** 👥 캐릭터: 지금 캐릭터의 싸움 성격을 성장 mods에 곱한다 */
function applyKit(m: GrowthMods): GrowthMods {
  const c = party?.char, k = c?.kit ?? {};
  return {
    ...m,
    atk: m.atk * (k.atk ?? 1) * (nightMode && k.night ? k.night : 1),
    hp: m.hp * (k.hp ?? 1), def: Math.min(0.7, m.def + (k.def ?? 0)),
    crit: m.crit + (k.crit ?? 0), critDmg: m.critDmg + (k.critDmg ?? 0),
    skill: m.skill * (k.skill ?? 1), burst: m.burst * (k.burst ?? 1), energy: m.energy * (k.energy ?? 1),
    eCd: m.eCd + (k.eCd ?? 0), steal: m.steal + (k.steal ?? 0), chargeCost: m.chargeCost * (k.chargeCost ?? 1),
    eHeal: k.eHeal ?? 0, tint: c?.element.color ?? m.tint,
    ...skillBoost(m, k),
  };
}
/** 📜 기술: 익히는 기술 + 켜진 강화 */
function skillBoost(m: GrowthMods, k: { atk?: number; hp?: number; def?: number; crit?: number; critDmg?: number; steal?: number }) {
  if (!arsenal) return {};
  const s = arsenal.boost();
  return {
    atk: m.atk * (k.atk ?? 1) * (nightMode && party?.char.kit.night ? party.char.kit.night : 1) * (1 + s.atk),
    hp: m.hp * (k.hp ?? 1) * (1 + s.hp),
    def: Math.min(0.75, m.def + (k.def ?? 0) + s.def),
    crit: m.crit + (k.crit ?? 0) + s.crit,
    critDmg: m.critDmg + (k.critDmg ?? 0) + s.critDmg,
    steal: m.steal + (k.steal ?? 0) + s.steal,
  };
}
const who = document.createElement('div');
who.className = 'who';
document.body.appendChild(who);
/** 옷: 여행자는 옷장대로, 동료는 늘 입는 옷(무기 능력·옷 능력은 옷장을 따른다) */
function dress() {
  const c = party?.char, l = wardrobe.loadout;
  hero.figure.setGear(c?.wear ? { ...l, head: c.wear.head, top: c.wear.top } : l);
  hero.figure.setOutfit(c?.wear?.colors ?? null);
  hero.figure.setStyle(c?.id ?? 'traveler');
}
/** 지금 캐릭터의 생김새 · 이름표 */
function applyChar() {
  const c = party.char;
  hero.figure.setLook(party.lookOf(c));
  hero.figure.setStyle(c.id);
  dress();
  hero.body.actSpeed = SPEED[c.id] * (1 + (arsenal?.boost().aspd ?? 0));
  arsenal?.paintBar();
  skillUi?.refresh();
  who.innerHTML = `<em>${c.element.emoji}</em><b></b><small>${c.element.name}</small>`;
  who.querySelector('b')!.textContent = party.nameOf(c);
  who.style.setProperty('--el', `#${c.element.color.toString(16).padStart(6, '0')}`);
}
function setupParty() {
  party = new Party();
  creator = new Creator();
  partyUi = new PartyPanel(party);
  applyChar();
  const portrait = (on: boolean) => {
    hero.cam.portrait = on;
    hero.cam.portraitShift = innerWidth < 700 ? [0, -1.25, 4.8] : [-0.95, 0, 3.1]; // 판이 오른쪽이라 캐릭터는 왼쪽에
    document.body.classList.toggle('closet-on', on);
    if (on) { hint(''); menu(false); if (hero.body.mode === 'ground') hero.body.facing = (hero.cam.yaw + 180) % 360; }
  };
  creator.onToggle = (on) => { portrait(on); if (!on) applyChar(); };
  creator.onPreview = (l) => hero.figure.setLook(l);
  creator.onDone = (name, l) => {
    party.create(name, l);
    applyChar();
    sfx.questDone();
    toast(`👤 ${party.name} — 파리에 온 걸 환영해!`);
  };
  partyUi.onToggle = (on) => { if (on) { hint(''); menu(false); closet?.toggle(false); journal?.toggle(false); wish?.toggle(false); growthUi?.toggle(false); } };
  partyUi.onSelect = () => {
    applyChar();
    const c = party.char;
    sfx.enter();
    hero.body.drawn = 3;
    toast(`👥 ${party.nameOf(c)}(으)로 바꿨다 — ${c.element.emoji} ${c.element.name} · ${c.perk}`);
    partyUi.toggle(false);
  };
  partyUi.onEdit = () => creator.show(party.name, party.look, false);
  party.onUnlock = (c) => {
    sfx.fanfare();
    setTimeout(() => banner.unlock('👥', `새 동료 · ${c.element.emoji} ${c.name}`, `${c.role} — ${c.perk}. 👥 파티(P · 🧚 메뉴)에서 바꿔 다닐 수 있다`), 600);
    partyUi.refresh();
  };
}
/** 🧚 단추의 빨간 점: 찍을 스킬 포인트가 남았다 */
function paintDots() {
  const sp = (!!progress && !!growth && progress.has('growth') && growth.spFree(progress.ar) > 0) || (!!arsenal && !!party && arsenal.spFree(party.active) > 0);
  document.querySelector('[data-m="skills"]')?.classList.toggle('dot', !!arsenal && !!party && arsenal.spFree(party.active) > 0);
  $('#menu-go').classList.toggle('dot', sp);
  document.querySelector('[data-m="growth"]')?.classList.toggle('dot', sp);
}
/** ☀️ 낮 / 🌙 밤 모드: 밤이면 거리의 사람을 모두 보내고 밤에 머물며 요괴가 물결마다 몰려온다 */
function setMode(night: boolean) {
  const was = nightMode;
  nightMode = night;
  try { localStorage.setItem('carnet-mode', night ? 'night' : 'day'); } catch { /* 무시 */ }
  document.body.classList.toggle('night-mode', night);
  for (const b of document.querySelectorAll<HTMLElement>('#modes button')) b.classList.toggle('on', (b.dataset.mode === 'night') === night);
  if (!hero) return;
  const day0 = Math.floor(S.clock / 1440) * 1440;
  if (night) S.clock = day0 + 23 * 60;
  else if (was) S.clock = day0 + 1440 + 9 * 60; // 밤을 새웠다 — 다음 날 아침
  lastSkyMin = -99;
  paintSky();
  if (night) { hero.crowd.density = 0; hero.crowd.hush(); if (S.started) horde?.start(); }
  else horde?.stop();
  paintMenu();
}
/** 모험 등급에 따라 보이는 단추(원신처럼 하나씩 열린다) */
function paintGates() {
  if (!progress) return;
  $('#wish-go').hidden = !progress.has('wish');
  $<HTMLElement>('[data-m="growth"]').hidden = !progress.has('growth');
  paintDots();
}

function setupAdventure() {
  progress = new Progress();
  growth = new Growth();
  setupParty();
  progress.onXp = (n) => feed.push('✦', `모험 경험치 +${n}`, 'blue');
  progress.onRank = (ar, rw) => {
    addMoney(rw.eur);
    combat?.heal(1);
    const next = FEATURES.find((f) => f.ar > ar);
    const line = next ? `다음 · 모험 등급 ${next.ar}에 ${next.emoji} ${next.name}이(가) 열린다` : ar < 20 ? '다음 목표 · 🐀👑 쥐왕 — 모험 등급 20쯤, 무기를 강화해서' : '🐀👑 쥐왕에게 도전할 때다!';
    paintDots();
    setTimeout(() => banner.rank(ar, [`⭐ ${rw.stars}`, `€ ${rw.eur}`, `🔹 ${rw.ore}`, ...(progress.has('growth') || ar >= 2 ? ['🌟 스킬 포인트 +1'] : []), '❤️ 체력 가득'], `${line} · 무기는 Lv.${Math.min(20, 2 + ar * 2)}까지 강화할 수 있다`), 700);
  };
  progress.onFeature = (f) => { setTimeout(() => banner.unlock(f.emoji, f.name, f.what), 800); paintGates(); };
  progress.onCommission = (c, all) => {
    setTimeout(() => { sfx.questDone(); toast(`📜 오늘의 의뢰 완료 · ${COMMISSION_TEXT[c.kind](c.goal)} — ⭐10 · 경험치 250${all ? ' · 넷 모두! 추가 ⭐60' : ''}`); }, 1500);
  };
  progress.onChange = () => { journal?.refresh(); paintMenu(); for (const [id, el] of wpPins) el.classList.toggle('on', progress.waypoints.has(id)); };
  explore = new Explore({
    hero, progress, toast, hint: (s2) => hint(s2), money: (eur) => addMoney(wardrobe.has('satchel') ? Math.round(eur * 1.5) : eur), xpMul,
    got: (icon, text, tone) => feed.push(icon, text, tone),
    camp: (key, x, y, z, seed, only) => combat?.spawnCamp(key, x, y, z, seed, only ?? towerRats(x, y, seed)),
    calm: (x, y) => !!prologue && !prologue.done && (() => { const [tx, ty] = hero.frame.toLocal(TOWER); return Math.hypot(x - tx, y - ty) < 450; })(),
    revealNear: (pos, r) => { let n = 0; for (const p of places) if (!p.minor && !S.seen.has(p.id) && dist(p.pos, pos) < r) { S.seen.set(p.id, S.clock); showMarker(p); n++; } return n; },
  });
  hero.crowd.scene.add(explore.group);
  combat = new Combat({
    hero, progress, toast, hint: (s2) => hint(s2), money: addMoney, xpMul,
    atWaypoint: () => !domain?.active && explore.atWaypoint(),
    night: () => hero.town.uniforms.uNight.value,
    cleared: (key) => { if (key.startsWith('dom:')) domain?.cleared(key); else if (!key.startsWith('tale:')) explore.unlock(key); },
    bossSpot: () => explore.bossSpot(),
    kingSpot: () => { const [x, y] = hero.frame.toLocal(KING_AT); return [x, y, hero.world.terrain(x, y)]; },
    kingSlain: () => {
      // 잔 다르크의 검이 먼저, 이미 있으면 없는 5★ 장비 하나 — 다 있으면 별조각
      const g = !wardrobe.owned.has('jeanne') ? GEAR.find((q) => q.id === 'jeanne') : GEAR.filter((q) => q.star === 5 && !wardrobe.owned.has(q.id))[0];
      if (g) wardrobe.unlock(g.id); else progress.addStars(120);
    },
    weapon: () => { const id = wardrobe.loadout.weapon ?? 'umbrella'; return { id, emoji: GEAR.find((q) => q.id === id)?.emoji ?? '⚔️', lv: wardrobe.lvOf(id) }; },
    mods: () => applyKit(growth.mods(armorSum())),
    who: () => party?.active ?? 'traveler',
    killed: (_kind, info) => {
      const d = horde?.onKill(info);
      if (d?.books) { growth.addBooks(d.books); feed.push('📘', `파리의 가르침 ×${d.books}`, 'blue'); }
      if (d?.ore) { progress.addOre(d.ore); feed.push('🔹', `연마석 ×${d.ore}`, 'purple'); }
    },
    loot: (kind) => {
      // 🔹 연마석: 쥐·가고일은 늘, 슬라임은 가끔, 우두머리는 많이
      const n = kind === 'ratking' ? 25 : kind === 'boss' ? 10 : kind === 'gargoyle' ? 2 : kind === 'rat' ? 1 : Math.random() < 0.4 ? 1 : 0;
      if (n) { progress.addOre(n); feed.push('🔹', `연마석 ×${n}`, 'purple'); }
    },
    respawn: async () => {
      if (domain?.active) { await domain.fail('down'); return; } // 비경에서 쓰러지면 입구 앞으로
      // 가장 가까운 켠 순간이동 포인트(없으면 샹드마르스)
      const on = WAYPOINTS.filter((w) => progress.waypoints.has(w.id)).sort((a, b) => dist(a.pos, S.pos) - dist(b.pos, S.pos));
      if (on[0]) await teleport(on[0]);
      else { hero.moveTo(PROLOGUE_START); S.pos = hero.lnglat; }
    },
  });
  hero.crowd.scene.add(combat.group);
  arsenal = new Arsenal({
    api: combat.api,
    who: () => party.active,
    ar: () => progress.ar,
    live: () => !!S.started && !modalOpen() && !mapMode && !domain?.active && !street?.holding,
    act: (big) => hero.body.combat(big ? 'burst' : 'skill'),
    hint: (s2) => hint(s2),
    learned: (d, first) => {
      sfx.questDone();
      if (first && d.eff) setTimeout(() => banner.unlock(d.emoji, `새 기술 · ${d.name}`, `${d.desc} — ${arsenal.slotsOf(d.char).indexOf(d.id) >= 0 ? `${arsenal.slotsOf(d.char).indexOf(d.id) + 5}번 키(아래 칸)로 쓴다` : '📜 기술 창에서 5~8 칸에 올리자'} · 🔷 마나 ${arsenal.cost(d)}`), 200);
      else feed.push(d.emoji, `${d.name} Lv.${arsenal.lv(d.id)}`, 'gold');
      applyChar();
    },
  });
  arsenal.onCast = (i) => { if (S.started) arsenal.cast(i); };
  arsenal.onChange = () => { skillUi?.refresh(); paintDots(); };
  skillUi = new SkillPanel(arsenal);
  skillUi.ctx = { who: () => party.active, name: () => party.nameOf(party.char), ar: () => progress.ar, atk: () => combat.stats().atk, openGrowth: () => growthUi.toggle(true) };
  skillUi.onToggle = (on) => { if (on) { hint(''); menu(false); closet?.toggle(false); journal?.toggle(false); wish?.toggle(false); growthUi?.toggle(false); partyUi?.toggle(false); } };
  horde = new Horde({
    hero, combat, toast,
    ar: () => progress.ar,
    cap: () => Q_HORDE[quality],
    paused: () => horde.pausedNow,
    reward: (r) => {
      progress.addStars(r.stars);
      progress.addOre(r.ore);
      growth.addBooks(r.books);
      if (r.sp) growth.addSp(r.sp);
      progress.addXp(Math.round((60 + r.wave * 40) * xpMul()), `밤 습격 ${r.wave}물결`);
      combat.heal(0.35);
      toast(`✨ ${r.wave}물결을 넘겼다! ⭐${r.stars} · 🔹${r.ore} · 📘${r.books}${r.sp ? ' · 🌟 스킬 포인트 +1' : ''} · 체력 회복`);
      if (r.sp) setTimeout(() => banner.unlock('🌟', '스킬 포인트 +1', `밤 습격 ${r.wave}물결을 넘겼다 — 🧚 메뉴 → 🌟 성장(K)에서 스킬 트리를 찍자`), 900);
    },
  });
  tales = new Tales({
    hero, toast, hint: (s2) => hint(s2),
    night: () => nightMode,
    spawn: (key, x, y, z, foes, elites) => combat.spawnCamp(key, x, y, z, 0.4, foes, 1, elites),
    cleared: (key) => combat.campDone(key),
    reward: (rw, why) => {
      progress.addStars(rw.stars);
      if (rw.ore) progress.addOre(rw.ore);
      if (rw.books) { growth.addBooks(rw.books); feed.push('📘', `파리의 가르침 ×${rw.books}`, 'blue'); }
      if (rw.eur) addMoney(rw.eur);
      if (rw.sp) growth.addSp(rw.sp);
      if (rw.gear) { const g = GEAR.filter((q) => q.star === 5 && !wardrobe.owned.has(q.id))[0]; if (g) wardrobe.unlock(g.id); else progress.addStars(160); }
      progress.addXp(Math.round(rw.xp * xpMul()), why);
      feed.push('⭐', `별조각 +${rw.stars}`, 'gold');
    },
  });
  hero.crowd.scene.add(tales.group);
  growthUi = new GrowthPanel(growth);
  growthUi.ctx = {
    ar: () => progress.ar,
    money: () => S.money,
    pay: (eur) => { if (S.money < eur) return false; S.money = Math.round((S.money - eur) * 100) / 100; paintMenu(); return true; },
    learned: (what) => { sfx.questDone(); feed.push('🌟', what, 'gold'); },
  };
  growthUi.onToggle = (on) => { if (on) { hint(''); menu(false); closet?.toggle(false); journal?.toggle(false); wish?.toggle(false); } paintDots(); };
  growth.onChange = () => { growthUi.refresh(); paintDots(); paintMenu(); };
  domain = new Domain({ hero, progress, combat: () => combat ?? null, companion: () => companion ?? null, toast, hint: (s2) => hint(s2), money: addMoney, xpMul });
  hero.crowd.scene.add(domain.group);
  companion = new Companion({
    hero, progress,
    explore: () => explore ?? null, combat: () => combat ?? null, story: () => street?.story ?? null,
    say: (at, text, secs) => street?.ui.say(at, text, secs, 'lili'),
    night: () => hero.town.uniforms.uNight.value,
    beacon: () => (miniBeacon ? [miniBeacon[0], miniBeacon[1]] : null),
  });
  hero.crowd.scene.add(companion.group);
  ascend = new Ascend({
    hero,
    hint: (s2) => { hint(s2); setTimeout(() => hint(''), 3500); },
    tip: (s2) => companion?.line(s2, 6),
    used: (t) => { if (t.z1 - hero.body.z > 40) toast(`⤒ 상승! ${Math.round(t.z1)} m 위로`); },
  });
  hero.crowd.scene.add(ascend.group);
  prologue = new Prologue({
    hero, progress,
    explore: () => explore ?? null, story: () => street?.story ?? null, companion: () => companion ?? null,
    journalOpen: () => !!journal?.open, wishOpen: () => !!wish?.open,
    toast, hint: (s2) => hint(s2), money: addMoney,
    quiet: (on) => {
      if (street) { street.suppressLine = on; street.story.quiet = on; if (on) street.ui.questLine(''); }
      if (companion) companion.hush = on;
    },
    touch: () => document.body.classList.contains('touch-play'),
    mapOpen: () => mapMode,
    photos: () => street?.stats.photos ?? 0,
    king: () => combat?.kingInfo() ?? null,
    provoke: (on) => { if (combat) combat.kingProvoked = on; },
    downs: () => combat?.downs ?? 0,
    created: () => party.created,
    openCreator: () => creator.show(party.name, party.look, true),
    tally: () => combat.tally,
    drill: (key, [x, y], foes) => { combat.spawnCamp(key, x, y, hero.world.ground(x, y, hero.world.terrain(x, y) + 3, 6), 0.2, foes as FoeKind[]); },
    drillDone: (key) => combat.campDone(key),
    spUsed: () => arsenal.casts,
    giveSp: () => { progress.open('growth'); },
    night: () => nightMode,
    wavesCleared: () => horde?.clearedN ?? 0,
    unlockChar: (id) => party.unlock(id as CharId),
    activeChar: () => party.active,
    taleStep: () => tales?.step ?? 0,
  });
  hero.crowd.scene.add(prologue.group);
  wish = new Wish(progress, wardrobe, addMoney);
  wish.onToggle = () => paintMenu();
  // 지도 보기의 순간이동 포인트(누르면 순간이동)
  for (const wp of WAYPOINTS) {
    const el = document.createElement('button');
    el.className = `wp-pin${wp.statue ? ' statue' : ''}`;
    el.innerHTML = `<span>${wp.statue ? '🗽' : '🔷'}</span><small></small>`;
    el.querySelector('small')!.textContent = wp.name;
    el.title = wp.name;
    el.classList.toggle('on', progress.waypoints.has(wp.id));
    el.addEventListener('click', (ev) => { ev.stopPropagation(); void askTeleport(wp); });
    pins.add(el, wp.pos, 'center');
    wpPins.set(wp.id, el);
  }
  street.c.xp = (xp, stars, why) => { progress.stars += stars; progress.addXp(Math.round(xp * xpMul()), why); };
}

async function askTeleport(wp: Waypoint) {
  if (!progress.waypoints.has(wp.id)) { toast(`◇ ${wp.name} — 아직 켜지 않은 순간이동 포인트. 직접 가서 가까이 서면 켜진다`); return; }
  if (sky?.riding) { toast('하늘에서는 순간이동할 수 없다'); return; }
  const i = await street.ui.talk('순간이동', '', `🔷 ${wp.name}(으)로 순간이동할까요?`, ['순간이동', '그만두기']);
  if (i === 0) await teleport(wp);
}

/** 순간이동: 다른 동네면 그 동네를 읽고, 포인트 옆에 선다 */
async function teleport(wp: Waypoint) {
  if (entering || !S.started) return;
  entering = true;
  try {
    if (mapMode) setMapMode(false);
    sfx.chime();
    await street.ui.fade(true, '#dff4ff');
    const inside = (d: District, p: LngLat, pad: number) => p[1] > d.bbox[0] - pad && p[1] < d.bbox[2] + pad && p[0] > d.bbox[1] - pad && p[0] < d.bbox[3] + pad;
    const d = Object.values(DISTRICTS).find((x) => inside(x, wp.pos, 0.001));
    if (d && d.id !== district.id) await enterDistrict(d, wp.pos);
    const [x, y] = hero.frame.toLocal(wp.pos);
    const b = hero.body;
    b.place(x + 2.6, y, hero.world.ground(x + 2.6, y, hero.world.terrain(x + 2.6, y) + 20, 0));
    b.mode = 'ground'; b.vx = b.vy = b.vz = 0;
    hero.cam.snap(b);
    S.pos = hero.lnglat; S.trail.push(S.pos); lastTrail = S.pos;
    progress.bump('waypoint');
    progress.last = wp.id;
    progress.save();
    await wait(200);
    await street.ui.fade(false);
    toast(`🔷 ${wp.name}`);
  } finally {
    entering = false;
  }
}

// ───────── 장비(옷장) ─────────
function setupGear() {
  wardrobe = new Wardrobe();
  closet = new Closet(wardrobe);
  closet.ctx = {
    ar: () => progress?.ar ?? 1,
    ore: () => progress?.ore ?? 0,
    money: () => S.money,
    canEnhance: () => !!progress?.has('enhance'),
    pay: (ore, eur) => { if (!progress || progress.ore < ore || S.money < eur) return false; progress.ore -= ore; progress.save(); S.money = Math.round((S.money - eur) * 100) / 100; paintMenu(); return true; },
    stats: () => combat?.stats() ?? { atk: 0, hp: 0, crit: 0, critDmg: 0, def: 0 },
    enhanced: (name, lv) => { sfx.questDone(); feed.push('⬆', `${name} Lv.${lv}`, 'gold'); },
  };
  const apply = () => {
    const l = wardrobe.loadout;
    dress();
    hero.body.mods = modsOf(l);
    hero.body.golden = l.glider === 'golden';
  };
  apply();
  let lastWeapon = wardrobe.loadout.weapon;
  wardrobe.onChange = () => {
    apply();
    if (closet.open) sfx.questStart();
    // 무기를 바꾸면 잠깐 손에 들어 보여 준다
    if (wardrobe.loadout.weapon !== lastWeapon) { lastWeapon = wardrobe.loadout.weapon; hero.body.drawn = 6; }
  };
  wardrobe.onUnlock = (g) => {
    if (g.id === 'golden') { wardrobe.equip('golden'); return; } // 숨은 보상 — 알리지 않는다
    setTimeout(() => { sfx.questDone(); toast(g.slot === 'weapon' ? `🗡 새 무기: ${g.emoji} ${g.name} — 🎒 옷장(I)의 무기 칸에서 바꿔 들자` : `🎁 새 장비: ${g.emoji} ${g.name} — 🎒 옷장(I)에서 입어 보자`); }, 1800);
  };
  closet.onToggle = (on) => {
    hero.cam.portrait = on;
    hero.cam.portraitShift = innerWidth < 700 ? [0, -1.25, 4.8] : [0.95, 0, 3.1]; // 휴대폰: 아래 판 위로 온몸이 보이게
    document.body.classList.toggle('closet-on', on);
    if (on) { hint(''); menu(false); }
    if (on && hero.body.mode === 'ground') hero.body.facing = (hero.cam.yaw + 180) % 360; // 카메라 쪽으로 돌아선다
  };
}

/** 에펠탑 둘레(1.1 km)의 요괴 무리는 거의 쥐 — 탑 밑 하수도에서 올라온다 */
function towerRats(x: number, y: number, seed: number): FoeKind[] | undefined {
  const [tx, ty] = hero.frame.toLocal(TOWER);
  if (Math.hypot(x - tx, y - ty) > 1100) return undefined;
  return seed < 0.4 ? ['rat', 'rat', 'rat'] : seed < 0.75 ? ['rat', 'rat', 'slime', 'rat'] : ['rat', 'rat', 'gargoyle'];
}

/** 걷다 보면 생기는 것들 — 의뢰·경험치·장비 */
function milestones() {
  if (!wardrobe) return;
  // 동료: 메인 이벤트를 마치면 맡긴 사람이, 파리의 두 얼굴을 끝내면 륀이
  if (party && street) {
    const MAIN: [string, CharId][] = [['m-eiffel', 'gustave'], ['m-arc', 'marcel'], ['m-louvre', 'amelie'], ['m-notre-dame', 'quentin'], ['m-sacre-coeur', 'elodie']];
    for (const [q, id] of MAIN) if (street.story.done.has(q)) party.unlock(id);
    if (tales?.done) party.unlock('lune');
  }
  if (hero.body.golden && !wardrobe.owned.has('golden')) wardrobe.unlock('golden'); // 탑 꼭대기(숨은 것)
  if (S.walked >= 1000) wardrobe.unlock('hiking');
  if (S.seen.size >= 5) wardrobe.unlock('trench');
  if ((street?.stats.bonjour ?? 0) >= 10) wardrobe.unlock('leather');
  if (progress && progress.chests.size >= 5) wardrobe.unlock('satchel');
  if (progress && progress.chests.size >= 3) wardrobe.unlock('baguette');
  if (progress && progress.ar >= 5) wardrobe.unlock('oar');
  if (domain?.threeStarAny) wardrobe.unlock('rapier');
  if (domain?.clearedAny) wardrobe.unlock('flag');
  if (progress && street) {
    const now = { bonjour: street.stats.bonjour, seen: S.seen.size, walked: S.walked, helped: street.stats.helped };
    const d = (k: keyof typeof now) => now[k] - (adv[k] ?? now[k]);
    if (adv.seen !== undefined) {
      if (d('bonjour') > 0) progress.bump('bonjour', d('bonjour'));
      if (d('seen') > 0) { progress.bump('discover', d('seen')); progress.addXp(Math.round(5 * d('seen') * xpMul()), '새 장소'); }
      if (d('walked') >= 20) { progress.bump('walk', Math.round(d('walked'))); } else now.walked = adv.walked!;
      if (d('helped') > 0) progress.bump('quest', d('helped'));
    }
    Object.assign(adv, now);
    if (glideAcc >= 1) { progress.bump('glide', Math.floor(glideAcc)); glideAcc -= Math.floor(glideAcc); }
    if (climbAcc >= 1) { progress.bump('climb', Math.floor(climbAcc)); climbAcc -= Math.floor(climbAcc); }
  }
}

// ───────── 미니맵(왼쪽 위 — 누르면 지도) ─────────
let miniBeacon: [number, number] | null = null;
let miniLanes: { src: unknown; frame: unknown; arr: Float64Array } = { src: null, frame: null, arr: new Float64Array(0) };
function setupMinimap() {
  minimap = new Minimap({
    world: () => hero.world,
    body: () => hero.body,
    yaw: () => hero.cam.yaw,
    lanes: () => {
      const src = allLanes.length ? allLanes : graph;
      if (miniLanes.src !== src || miniLanes.frame !== hero.frame) {
        const segs = allLanes.length ? allLanes : laneSegments(graph);
        const arr = new Float64Array(segs.length * 4);
        segs.forEach(([a, b], i) => { const [ax, ay] = hero.frame.toLocal(a), [bx, by] = hero.frame.toLocal(b); arr.set([ax, ay, bx, by], i * 4); });
        miniLanes = { src, frame: hero.frame, arr };
      }
      return miniLanes.arr;
    },
    marks: () => {
      const out: { x: number; y: number; icon: string; dim?: boolean }[] = [];
      // 메인 이벤트가 남은 랜드마크
      const st = street?.story;
      if (st) for (const ch of CHAPTERS) {
        if (!ch.main || !ch.giver || st.done.has(ch.id)) continue;
        const l = hero.town.landmarks.find((q) => q.id === ch.landmark);
        if (l) out.push({ x: l.x, y: l.y, icon: '⭐' });
      }
      return out;
    },
    dots: () => hero.crowd.npcs,
    route: () => null,
    heli: () => null,
    sky: () => sky?.blips() ?? [],
    extra: () => [...(explore?.marks() ?? []), ...(combat?.marks() ?? []), ...(domain?.marks() ?? [])],
    beacon: () => miniBeacon,
  }, () => { if (S.started && !modalOpen()) setMapMode(true); });
}

/** 지금 화면을 한 장 찍어 둔다 */
function captureShot(label: string) {
  hero.view.capture((url) => {
    street.ui.shutter(url);
    if (wardrobe.has('camera')) { addMoney(2); sfx.coin(); toast(`📷 ${label} · 엽서로 팔렸다 +€2`); }
    else toast(`📷 ${label}`);
  });
}

/** 새 지구의 길·장소로 통째로 갈아 끼운다. keep: 몸은 그대로 두고(날거나 걸어서 들어왔다) 동네 데이터만 */
async function enterDistrict(d: District, at: LngLat, keep = false) {
  const data = await loadDistrict(d, (s) => (keep ? undefined : toast(s)));
  district = d;
  graph = buildGraph(data.ways);
  places = parsePlaces(data.places, d.curated, ALL_RICH);
  for (const m of markers.values()) m.remove();
  markers.clear();
  S.node = nearestNode(graph, at);
  if (!keep) S.pos = graph.nodes[S.node];
  if (!keep) { S.trail = [S.pos]; lastTrail = S.pos; }
  const next = graph.adj[S.node]?.[0];
  hero.theme = d.id;
  hero.setWays(allWays.length ? allWays : data.ways);
  hero.setGraph(graph.nodes, graph.adj.map((es) => es.map((e) => e.to)));
  hero.setLanes(allLanes.length ? allLanes : laneSegments(graph));
  const sdx = -hero.body.x, sdy = -hero.body.y; // 원점이 사람 자리로 옮겨 간다
  if (keep) { hero.rebase(); sky?.shift(sdx, sdy); }
  else { if (sky) sky.reset(0, 0); hero.reset(S.pos, next ? bearing(S.pos, graph.nodes[next.to]) : 0); }
  dressTown();
  street?.reset(d.id);
  for (const p of places) if (S.seen.has(p.id) || p.known) showMarker(p);
  if (keep) { toast(`📍 ${d.full}`); return; }
  wasCamOn = false; // 다음 프레임에 위에서 내려오며 사람 뒤로 붙는다
  avatar.setLngLat(S.pos);
  (map.getSource('trail') as GeoJSONSource).setData(line(S.trail));
  if (map.getSource('streets')) (map.getSource('streets') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: data.ways } });
  map.jumpTo({ center: S.pos, zoom: 17.4, pitch: 40, bearing: hero.heading - 30, elevation: 0 });
}

// ───────── 하루의 빛: 아침 → 한낮 → 해질녘 → 밤 ─────────
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
    hero.crowd.density = nightMode ? 0 : 1 - night * 0.55;
    night01 = night;
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

// ───────── 알림 ─────────
let toastTimer = 0;
function toast(s: string) {
  const el = $('#toast');
  el.textContent = s;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 2600);
}
const hint = (s: string) => { $('#hint').textContent = s; $('#hint').classList.toggle('on', !!s); };

// ───────── 🧚 리리의 메뉴(원신의 파이몬 메뉴) ─────────
const fmtClock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
function paintMenu() {
  if (!progress || !$('#menu').classList.contains('on')) return;
  $('#m-ar').textContent = `모험 등급 ${progress.ar}`;
  const need = arNeed(progress.ar);
  $('#m-xp').style.width = `${Math.round((progress.xp / need) * 100)}%`;
  $('#m-xpt').textContent = `${progress.xp} / ${need}`;
  $('#m-stars').textContent = `⭐ ${progress.stars}`;
  $('#m-money').textContent = `€ ${Number.isInteger(S.money) ? S.money : S.money.toFixed(2)}`;
  $('#m-ore').textContent = `🔹 ${progress.ore}`;
  $('#m-time').textContent = `파리 · ${fmtClock(S.clock)}${night01 > 0.5 ? ' 🌙' : ''} · 발견 ${S.seen.size}곳 · 걸은 거리 ${(S.walked / 1000).toFixed(1)} km`;
  $('#m-sound').textContent = sfx.isMuted() ? '🔇' : '🔊';
  $('#m-mode').innerHTML = nightMode ? '<em>☀️</em>낮으로' : '<em>🌙</em>밤 습격';
}
function menu(on = !$('#menu').classList.contains('on')) {
  if (on && (!S.started || domain?.active)) return;
  if (on) { closet?.toggle(false); journal?.toggle(false); wish?.toggle(false); growthUi?.toggle(false); partyUi?.toggle(false); skillUi?.toggle(false); if (mapMode) setMapMode(false); }
  $('#menu').classList.toggle('on', on);
  if (on) { sfx.pageTurn(); paintMenu(); } else $<HTMLElement>('.mkeys').hidden = true;
}
$('#menu').addEventListener('pointerdown', (e) => { if (e.target === e.currentTarget) menu(false); });
$('#menu-x').addEventListener('click', () => menu(false));
for (const b of document.querySelectorAll<HTMLButtonElement>('#menu .mgrid button')) {
  b.addEventListener('click', () => {
    b.blur();
    switch (b.dataset.m) {
      case 'ask': menu(false); companion?.ask(); break;
      case 'map': menu(false); setMapMode(true); break;
      case 'journal': menu(false); journal.toggle(true); break;
      case 'gear': menu(false); closet.toggle(true); break;
      case 'wish': menu(false); wish.toggle(true); break;
      case 'photo': menu(false); setTimeout(() => hero.input.press('photo'), 250); break;
      case 'sit': menu(false); setTimeout(() => hero.input.press('sit'), 200); break;
      case 'wave': menu(false); setTimeout(() => hero.input.press('wave'), 200); break;
      case 'sound': sfx.unlock(); sfx.setMuted(!sfx.isMuted()); paintMenu(); break;
      case 'growth': menu(false); growthUi.toggle(true); break;
      case 'skills': menu(false); skillUi.toggle(true); break;
      case 'party': menu(false); partyUi.toggle(true); break;
      case 'mode': menu(false); setMode(!nightMode); break;
      case 'keys': { const k = $<HTMLElement>('.mkeys'); k.hidden = !k.hidden; break; }
    }
  });
}

/** 시작 전 준비: 몸을 세워 두고(멈춤), 보이는 칸을 다 짓고 지도 타일을 다 받고, 화면을 몇 번 그려 둔다. */
let preparing = false;
/** 모든 동네의 길(어디에 내려앉든 거리·건물이 있게) */
let allWays: LngLat[][] = [];
let allLanes: LngLat[][] = [];

/** 파리 하늘(열기구·새·낙하산 사람·여객기) */
let sky: SkyLife | null = null;

/** 탈것(열기구)의 자리에 몸을 둔다 */
function seatAt(st: { x: number; y: number; z: number; facing: number }) {
  const b = hero.body;
  b.x = st.x; b.y = st.y; b.z = st.z;
  b.vx = b.vy = b.vz = 0;
  b.speed = 0;
  b.facing = st.facing;
  b.mode = 'sit';
  b.seatZ = st.z;
  b.freefall = false;
  b.parachute = false;
}

/** 모든 동네의 길을 한데 모은다(어디에 내려앉아도 길·가구·건물이 있게) */
async function unifyStreets() {
  const all = await Promise.all(Object.values(DISTRICTS).map((d) => loadDistrict(d, () => undefined).then((x) => ({ d, x })).catch(() => null)));
  const ok = all.filter((a): a is { d: District; x: Awaited<ReturnType<typeof loadDistrict>> } => !!a);
  allWays = ok.flatMap((a) => a.x.ways);
  allLanes = ok.flatMap((a) => laneSegments(buildGraph(a.x.ways)));
  const others = ok.filter((a) => a.d.id !== district.id).flatMap((a) => a.x.ways);
  hero.setWays(allWays);
  hero.setLanes(allLanes);
  hero.town.addProcedural(others.map((w) => w.map((p) => hero.frame.toLocal(p))));
}
async function prepare(fallback: boolean) {
  const go = $<HTMLButtonElement>('#go');
  const status = $('#status');
  preparing = true;
  hero.cam.pitch = 10;
  hero.cam.wantDist = 7.5;
  sky = new SkyLife({ say: (at, text, secs, voice) => street?.ui.say(at, text, secs, '', voice), toast, terrain: (x, y) => hero.world.terrain(x, y) });
  hero.crowd.scene.add(sky.group);
  sky.reset(hero.body.x, hero.body.y);
  // 다른 동네 거리 데이터는 뒤에서 받는다(시작을 기다리게 하지 않는다)
  void unifyStreets().catch(() => undefined);
  const town = hero.town;
  town.budget = 40; // 인트로가 가리고 있으니 한 프레임에 많이 지어도 된다
  const t0 = performance.now();
  let calm = 0, shown = 0, lastBacklog = -1, lastMove = t0;
  await new Promise<void>((done) => {
    const check = () => {
      const tiles = fallback || hero.world.tilesReady();
      const built = town.inView ? 1 - town.backlog / town.inView : 0;
      const [tl, tt] = hero.world.tileProgress();
      const tileDone = fallback ? 1 : tt ? tl / tt : 0;
      // 발밑 지도 45% · 거리 45% · 마무리 10%
      const pct = Math.round(Math.min(0.98, tileDone * 0.45 + built * 0.45 + Math.min(calm, 20) * 0.005) * 100);
      shown = Math.max(shown, pct);
      go.textContent = `준비 중… ${shown}%`;
      status.textContent = !tiles ? `샹드마르스 지도를 받는 중 (${tl}/${tt})` : town.backlog ? `거리를 세우는 중 (${town.inView - town.backlog}/${town.inView})` : '사람들을 불러 모으는 중';
      // 다 지은 뒤에도 20프레임 더 그려 둔다(셰이더 준비·사람 채우기·첫 그림)
      if (tiles && town.inView > 0 && town.backlog === 0) calm++; else calm = 0;
      const now = performance.now();
      if (town.backlog !== lastBacklog) { lastBacklog = town.backlog; lastMove = now; }
      const stuck = tiles && now - lastMove > 5000; // 지도 밖이라 영영 준비되지 않는 칸
      if (calm > 20 || stuck || now - t0 > 40000) done();
      else requestAnimationFrame(check);
    };
    check();
  });
  town.budget = 5;
  if (S.started) return; // 이어서 하기로 이미 시작했다
  S.pos = hero.lnglat;
  S.trail = [S.pos];
  lastTrail = S.pos;
  status.textContent = '';
  go.removeAttribute('disabled');
  go.textContent = prologue && !prologue.done ? '▶ 에펠탑 앞에서 시작' : '▶ 샹드마르스에서 걷기';
}

async function start(resumeAt?: Waypoint) {
  const go = $<HTMLButtonElement>('#go');
  if (go.disabled && !resumeAt) return;
  go.disabled = true;
  $<HTMLButtonElement>('#resume').hidden = true;
  sfx.unlock();
  sfx.startMusic();
  preparing = false;
  S.started = true;
  wasCamOn = true; // 카메라는 이미 몸 뒤에 있다 — 지도에서 내려오는 전환 없이 바로
  hero.visible = true;
  $('#intro').classList.add('rise');
  setTimeout(() => $('#intro').classList.add('gone'), 2600);
  $('#hud').classList.add('on');
  mapHandlers(false);
  avatar.getElement().classList.add('hidden');
  paintSky();
  paintGates();
  if (resumeAt) await teleport(resumeAt); // 원신처럼: 지난번 순간이동 포인트에서 바로
  const touch = hero.input.touched || matchMedia('(pointer: coarse)').matches;
  if (touch) document.body.classList.add('touch-play');
  // 첫걸음(아직이면) — 리리가 한 단계씩 안내한다. 끝냈으면 리리의 인사만.
  let first = true;
  try { first = !localStorage.getItem('carnet-lili'); localStorage.setItem('carnet-lili', '1'); } catch { /* 무시 */ }
  if (!prologue.done) { if (nightMode) { setMode(false); toast('☀️ 첫걸음은 낮에 시작한다 — 도중에 🌙 밤도 배운다'); } setTimeout(() => prologue.begin(), resumeAt ? 1200 : 2400); }
  else if (nightMode) { setMode(true); setTimeout(() => companion?.line('🌙 밤 습격이야! 요괴들이 물결마다 몰려와. 쓰러뜨리면 📘 파리의 가르침이 떨어져 — 특성을 올리자. 낮으로 돌아가려면 🧚 메뉴', 8), 2500); }
  else setTimeout(() => companion?.greet(first), resumeAt ? 1500 : 3000);
}

// ───────── 단추·키 ─────────
$('#go').addEventListener('click', () => void start());
for (const b of document.querySelectorAll<HTMLButtonElement>('#modes button')) b.addEventListener('click', () => { sfx.unlock(); setMode(b.dataset.mode === 'night'); });
setMode(nightMode);
const tap = (id: string, f: () => void) => $(id).addEventListener('click', (e) => { (e.currentTarget as HTMLElement).blur(); if (S.started) f(); });
tap('#gear-go', () => { menu(false); journal.toggle(false); closet.toggle(); });
tap('#wish-go', () => { menu(false); closet.toggle(false); journal.toggle(false); wish.toggle(); });
tap('#journal-go', () => { menu(false); closet.toggle(false); journal.toggle(); });
tap('#menu-go', () => menu());
const photoBtn = $<HTMLButtonElement>('#photo-go');
tap('#photo-go', () => { menu(false); hero.input.press('photo'); });
window.addEventListener('keydown', (e) => {
  if (!S.started || e.repeat || domain?.active) return;
  const free = !modalOpen() && !mapMode;
  if (e.code === 'KeyI') { if (closet.open) closet.toggle(false); else if (free) closet.toggle(true); }
  else if (e.code === 'KeyJ') { if (journal.open) journal.toggle(false); else if (free) journal.toggle(true); }
  else if (e.code === 'KeyP') { if (partyUi.open) partyUi.toggle(false); else if (free) partyUi.toggle(true); }
  else if (e.code === 'KeyK') { if (growthUi.open) growthUi.toggle(false); else if (skillUi.open) skillUi.toggle(false); else if (free) skillUi.toggle(true); }
  else if (['Digit5', 'Digit6', 'Digit7', 'Digit8'].includes(e.code) && free) arsenal.cast(Number(e.code.slice(5)) - 5);
  else if (e.code === 'KeyG' && free && companion) companion.ask();
  else if (e.key === 'Escape') {
    if (creator?.open) { /* 만들기는 단추로 닫는다 */ }
    else if (wish?.open) wish.toggle(false);
    else if (growthUi?.open) growthUi.toggle(false);
    else if (skillUi?.open) skillUi.toggle(false);
    else if (partyUi?.open) partyUi.toggle(false);
    else if (closet?.open) closet.toggle(false);
    else if (journal?.open) journal.toggle(false);
    else if (mapMode) setMapMode(false);
    else if (!street?.holding) menu();
  }
});
// 이 화면은 스크롤되지 않는다. 포커스 이동·scrollIntoView가 문서를 밀면 바로 되돌린다.
window.addEventListener('scroll', () => { if (window.scrollY || window.scrollX) window.scrollTo(0, 0); }, { passive: true });
if (import.meta.env.DEV || location.search.includes('debug')) (window as unknown as { __walk: unknown }).__walk = {
  S, hero: () => hero, cpu,
  arrive: async (id: keyof typeof DISTRICTS) => { await enterDistrict(DISTRICTS[id], DISTRICTS[id].start); },
  quick: async () => { preparing = false; $('#intro').classList.add('gone'); sfx.unlock(); S.started = true; $('#hud').classList.add('on'); await enterDistrict(district, district.start); },
  street: () => street, DISTRICTS, places: () => places, graph: () => graph, map: () => map, sky: () => sky,
  wardrobe: () => wardrobe, closet: () => closet, minimap: () => minimap, journal: () => journal, progress: () => progress,
  explore: () => explore, wish: () => wish, combat: () => combat, companion: () => companion, ascend: () => ascend, domain: () => domain, prologue: () => prologue,
  menu: (on?: boolean) => menu(on), banner: () => banner, growth: () => growth, growthUi: () => growthUi, tales: () => tales, arsenal: () => arsenal, skillUi: () => skillUi, party: () => party, creator: () => creator, partyUi: () => partyUi, horde: () => horde, setMode: (n: boolean) => setMode(n), night: () => nightMode, feed: () => feed, mapMode: (on: boolean) => setMapMode(on),
  teleport: (id: string) => { const wp = WAYPOINTS.find((w) => w.id === id); return wp ? teleport(wp) : null; },
};
window.addEventListener('error', (e) => { try { localStorage.setItem('carnet-walk-lasterror', `${new Date().toISOString()} ${e.message} @${e.filename}:${e.lineno}`); } catch { /* 무시 */ } });
requestAnimationFrame(frame);
void boot();
