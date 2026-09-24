// 거리의 사람들. 보도를 오가는 행인, 카메라를 든 관광객, 조깅하는 사람, 개를 산책시키는 사람, 테라스의 손님과 웨이터,
// 벤치에서 신문 읽는 사람, 광장의 아코디언 악사, 크레프 장수, 몽마르트르의 화가, 자전거 탄 사람, 그리고 비둘기.
// 한 사람은 도형 열몇 개인데, 같은 부위끼리 InstancedMesh 하나로 묶어 그리기 몇십 번으로 수백 명을 그린다.
import * as THREE from 'three';
import type { World } from '../hero/world';
import { hash } from './geom';
import type { SeatSpot, Spot } from './index';

export type Role = 'passer' | 'tourist' | 'jogger' | 'dogwalker' | 'kid' | 'waiter' | 'sitter' | 'reader' | 'musician' | 'vendor' | 'painter' | 'mime' | 'cyclist' | 'quest';
type State = 'walk' | 'stand' | 'sit' | 'chat' | 'photo' | 'play' | 'clap' | 'wave' | 'dance' | 'serve' | 'paint' | 'ride' | 'follow' | 'flee' | 'point' | 'think';

export interface Npc {
  id: number;
  role: Role;
  state: State;
  x: number; y: number; z: number;
  facing: number; // 방위(도)
  speed: number;
  want: number; // 원래 걷는 속도
  scale: number;
  phase: number;
  timer: number;
  // 길 따라 걷기
  from: number; to: number; side: number;
  // 제자리 역할(테라스·벤치·광장)
  anchor: { x: number; y: number; z: number; facing: number } | null;
  home: string | null; // 어느 자리에서 생겼나(같은 자리에 둘이 생기지 않게)
  look: Look;
  greeted: boolean; // 먼저 봉주르를 건넸나
  talked: number;
  mood: number; // -1..1 — 부딪히면 내려가고 인사하면 올라간다
  headY: number;
  react: number; // 반응 몸짓 남은 시간
  reactKind: State | null;
  bubble: string; bubbleT: number;
  /** 퀘스트·사건에서 붙인 표시 */
  tag?: string;
  followTarget?: { x: number; y: number } | null;
  hidden?: boolean;
  dog?: Dog;
  bike?: boolean;
}

interface Dog { x: number; y: number; facing: number; phase: number; color: number; scale: number }

interface Look { coat: number; pants: number; skin: number; hair: number; hat: 0 | 1 | 2 | 3; bag: 0 | 1 | 2; skirt: boolean; prop: 0 | 1 | 2 | 3 | 4 | 5 | 6 }
// prop: 0 없음 · 1 카메라 · 2 쟁반 · 3 신문 · 4 커피잔 · 5 아코디언 · 6 붓

interface Pigeon { x: number; y: number; z: number; vx: number; vy: number; vz: number; facing: number; phase: number; state: 'peck' | 'fly' | 'gone'; t: number; home: number }
interface Flock { x: number; y: number; birds: Pigeon[]; scared: number; key: string }

const COATS = [0xc8b08a, 0x1f2f4f, 0x26262a, 0xb07a45, 0x5b6a3a, 0xa3322a, 0x6b6f75, 0xf2f0ea, 0x3b5b8a, 0xe0b43a, 0x7a2e4a, 0x2f5d5a, 0xd8d0c0, 0x8a5a9a];
const PANTS = [0x2a2d33, 0x3d5a80, 0xcbbd9c, 0x1d1d1f, 0x5a4a3a, 0x6f7680, 0x2b3a55];
const SKINS = [0xf2c9a0, 0xe8b48a, 0xc98e64, 0x9a6440, 0x6e4428, 0xf5d5b8];
const HAIRS = [0x1d1612, 0x3b2a1e, 0x6b4a2a, 0xc9a45a, 0x9a9a9a, 0x8a3b1e, 0xe6d3a0];

const TAU = Math.PI * 2;
const rad = (d: number) => (d * Math.PI) / 180;
const dirOf = (deg: number): [number, number] => [Math.sin(rad(deg)), Math.cos(rad(deg))];
const bearingOf = (x: number, y: number) => ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
const angleDiff = (a: number, b: number) => ((b - a + 540) % 360) - 180;

function toonRamp(): THREE.DataTexture {
  const d = new Uint8Array([95, 95, 95, 255, 180, 180, 180, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
function outlineMat(width: number) {
  const m = new THREE.MeshBasicMaterial({ color: 0x1d1a17, side: THREE.BackSide });
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed += normalize(normal) * ${width.toFixed(4)};`); };
  return m;
}

/** 관절에서 아래(-z)로 뻗은 캡슐 */
const limb = (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -len / 2 - r * 0.3);

/** 정강이: 발 부분은 꼭짓점 색을 어둡게(신발) */
function shinGeo() {
  const g = limb(0.06, 0.34);
  const foot = new THREE.BoxGeometry(0.11, 0.2, 0.09).translate(0, 0.045, -0.44);
  const merged = mergeColored([[g, 1], [foot, 0.18]]);
  return merged;
}
function mergeColored(parts: [THREE.BufferGeometry, number][]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = [];
  for (const [g0, shade] of parts) {
    const g = g0.index ? g0 : g0;
    const base = pos.length / 3;
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(shade, shade, shade); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) idx.push(base + i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  return out;
}

type PartName = 'pelvis' | 'skirt' | 'torso' | 'head' | 'hair' | 'beret' | 'cap' | 'sunhat' | 'armL' | 'armR' | 'handL' | 'handR' | 'thighL' | 'thighR' | 'shinL' | 'shinR' | 'bag' | 'pack' | 'prop' | 'accordion';

const MAX = 150;

export class Crowd {
  readonly scene = new THREE.Scene();
  readonly npcs: Npc[] = [];
  private parts = new Map<PartName, THREE.InstancedMesh>();
  private lines: THREE.InstancedMesh[] = [];
  private dogParts: THREE.InstancedMesh[] = [];
  private birdParts: THREE.InstancedMesh[] = [];
  private bikes: THREE.InstancedMesh;
  private readonly ramp = toonRamp();
  private readonly sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  private readonly sky = new THREE.HemisphereLight(0xcfe3ff, 0x8a7a66, 1.3);
  private nodes: [number, number][] = [];
  private adj: number[][] = [];
  private seq = 1;
  world: World | null = null;
  seats: SeatSpot[] = [];
  spots: Spot[] = [];
  flocks: Flock[] = [];
  private anchorsUsed = new Set<string>();
  private laneOff = new Map<string, number>();
  private t = 0;
  theme = 'marais';
  /** 사람 수(보행자). 밤이 되면 준다. */
  density = 1;
  /** 걷는 사람들의 몫(역할, 무게) */
  walkerRoles: [Role, number][] = [['passer', 50], ['tourist', 18], ['jogger', 8], ['dogwalker', 8], ['cyclist', 8], ['kid', 8]];
  /** 새로 나타나는 거리(가까운 끝, 먼 끝)와 사라지는 거리 */
  spawnRange: [number, number] = [35, 105];
  despawn = 125;
  target = 46;
  /** 길 가운데에서 보도로 비켜 걷는 최대 거리 */
  maxOffset = 3.4;
  private easels: THREE.Group;
  private carts: THREE.Group;

  constructor() {
    this.scene.matrixAutoUpdate = false;
    this.sun.position.set(-0.5, -0.6, 1.2);
    this.scene.add(this.sun, this.sun.target, this.sky);
    this.sky.position.set(0, 0, 1);
    const mk = (name: PartName, geo: THREE.BufferGeometry, outline = true, vertexColors = false) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ gradientMap: this.ramp, vertexColors }), MAX);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3);
      m.count = 0;
      m.frustumCulled = false;
      this.scene.add(m);
      this.parts.set(name, m);
      if (outline) {
        const o = new THREE.InstancedMesh(geo, outlineMat(0.011), MAX);
        o.instanceMatrix = m.instanceMatrix;
        o.count = 0;
        o.frustumCulled = false;
        this.scene.add(o);
        this.lines.push(o);
        (m.userData as { outline?: THREE.InstancedMesh }).outline = o;
      }
    };
    mk('pelvis', new THREE.CylinderGeometry(0.17, 0.19, 0.24, 10).rotateX(Math.PI / 2));
    mk('skirt', new THREE.CylinderGeometry(0.17, 0.29, 0.55, 12).rotateX(Math.PI / 2).translate(0, 0, -0.2));
    mk('torso', new THREE.CapsuleGeometry(0.16, 0.26, 3, 10).rotateX(Math.PI / 2).scale(1.08, 0.8, 1));
    mk('head', new THREE.SphereGeometry(0.135, 12, 10).scale(1, 0.95, 1.06));
    mk('hair', new THREE.SphereGeometry(0.145, 12, 8, 0, TAU, 0, Math.PI * 0.62).rotateX(Math.PI / 2).rotateX(0.5));
    mk('beret', new THREE.CylinderGeometry(0.145, 0.16, 0.05, 14).rotateX(Math.PI / 2));
    mk('cap', mergeColored([[new THREE.SphereGeometry(0.15, 12, 6, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2), 1], [new THREE.BoxGeometry(0.2, 0.14, 0.02).translate(0, 0.15, 0.0), 0.9]]), true, true);
    mk('sunhat', mergeColored([[new THREE.CylinderGeometry(0.28, 0.28, 0.015, 16).rotateX(Math.PI / 2), 1], [new THREE.CylinderGeometry(0.13, 0.15, 0.12, 12).rotateX(Math.PI / 2).translate(0, 0, 0.06), 0.85]]), true, true);
    mk('armL', limb(0.052, 0.44));
    mk('armR', limb(0.052, 0.44));
    mk('handL', new THREE.SphereGeometry(0.05, 8, 6), false);
    mk('handR', new THREE.SphereGeometry(0.05, 8, 6), false);
    mk('thighL', limb(0.07, 0.3));
    mk('thighR', limb(0.07, 0.3));
    mk('shinL', shinGeo(), true, true);
    mk('shinR', shinGeo(), true, true);
    mk('bag', new THREE.BoxGeometry(0.28, 0.11, 0.3));
    mk('pack', new THREE.BoxGeometry(0.3, 0.16, 0.38));
    mk('prop', new THREE.BoxGeometry(1, 1, 1), false);
    mk('accordion', mergeColored([[new THREE.BoxGeometry(0.1, 0.24, 0.3).translate(-0.17, 0, 0), 0.25], [new THREE.BoxGeometry(0.24, 0.22, 0.28), 1], [new THREE.BoxGeometry(0.1, 0.24, 0.3).translate(0.17, 0, 0), 0.25]]), true, true);
    // 개: 몸통·머리·다리·꼬리
    const dogMat = () => new THREE.MeshToonMaterial({ gradientMap: this.ramp });
    const dogGeos = [
      new THREE.CapsuleGeometry(0.12, 0.34, 3, 8).rotateX(0).translate(0, 0, 0), // 몸(y축)
      new THREE.SphereGeometry(0.1, 8, 6).scale(1, 1.3, 1),
      new THREE.BoxGeometry(0.05, 0.05, 0.24).translate(0, 0, -0.12),
    ];
    for (let i = 0; i < 7; i++) {
      const geo = i === 0 ? dogGeos[0] : i === 1 ? dogGeos[1] : dogGeos[2];
      const m = new THREE.InstancedMesh(geo, dogMat(), 24);
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(24 * 3).fill(1), 3);
      m.count = 0; m.frustumCulled = false;
      this.scene.add(m);
      this.dogParts.push(m);
    }
    // 비둘기: 몸·머리·날개 둘
    const birdGeos = [
      new THREE.SphereGeometry(0.09, 8, 6).scale(0.85, 1.4, 0.9),
      new THREE.SphereGeometry(0.05, 6, 5),
      new THREE.BoxGeometry(0.2, 0.12, 0.012).translate(0.1, 0, 0),
      new THREE.BoxGeometry(0.2, 0.12, 0.012).translate(-0.1, 0, 0),
    ];
    for (let i = 0; i < 4; i++) {
      const m = new THREE.InstancedMesh(birdGeos[i], new THREE.MeshToonMaterial({ gradientMap: this.ramp, color: i === 1 ? 0x6a7385 : 0x8a92a3 }), 160);
      m.count = 0; m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(m);
      this.birdParts.push(m);
    }
    // 벨리브 자전거(탄 사람 아래)
    const bike = new THREE.Group();
    void bike;
    const wheel = new THREE.TorusGeometry(0.33, 0.03, 5, 14).rotateY(Math.PI / 2);
    const bikeGeo = mergeColored([
      [wheel.clone().translate(0, 0.52, 0.34), 0.15], [wheel.clone().translate(0, -0.52, 0.34), 0.15],
      [new THREE.BoxGeometry(0.05, 0.95, 0.05).rotateX(0.25).translate(0, 0, 0.62), 1],
      [new THREE.BoxGeometry(0.05, 0.05, 0.55).rotateX(-0.3).translate(0, -0.2, 0.6), 1],
      [new THREE.BoxGeometry(0.34, 0.26, 0.2).translate(0, 0.62, 0.9), 1],
      [new THREE.BoxGeometry(0.5, 0.04, 0.04).translate(0, 0.45, 1.05), 0.15],
      [new THREE.BoxGeometry(0.12, 0.25, 0.06).translate(0, -0.28, 0.88), 0.2],
    ]);
    this.bikes = new THREE.InstancedMesh(bikeGeo, new THREE.MeshToonMaterial({ gradientMap: this.ramp, vertexColors: true, color: 0x7fa08a }), 30);
    this.bikes.count = 0; this.bikes.frustumCulled = false;
    this.scene.add(this.bikes);
    // 화가의 이젤, 크레프 수레(몇 개 안 되니 그냥 메시)
    this.easels = new THREE.Group();
    this.carts = new THREE.Group();
    this.scene.add(this.easels, this.carts);
  }

  light(sun: string, sunI: number, sky: string, skyI: number) {
    this.sun.color.set(sun); this.sun.intensity = sunI;
    this.sky.color.set(sky); this.sky.intensity = skyI;
  }

  /** 사람들이 걷는 길의 노드(로컬 m) */
  get graphNodes() { return this.nodes; }

  /** 동네가 바뀌면 사람도 새로 */
  reset(world: World, nodes: [number, number][], adj: number[][], theme: string) {
    this.world = world;
    this.nodes = nodes;
    this.adj = adj;
    this.theme = theme;
    this.npcs.length = 0;
    this.flocks.length = 0;
    this.anchorsUsed.clear();
    this.laneOff.clear();
    for (const g of [this.easels, this.carts]) for (const c of [...g.children]) { g.remove(c); }
  }

  // ───────── 태어나기 ─────────
  private lookFor(role: Role, seed: number): Look {
    const r = (k: number) => hash(seed, k, 7);
    const pickC = (a: number[], k: number) => a[Math.floor(r(k) * a.length)];
    const look: Look = {
      coat: pickC(COATS, 1), pants: pickC(PANTS, 2), skin: pickC(SKINS, 3), hair: pickC(HAIRS, 4),
      hat: r(5) < 0.12 ? 1 : r(5) < 0.2 ? 2 : 0, bag: r(6) < 0.3 ? 1 : r(6) < 0.45 ? 2 : 0, skirt: r(8) < 0.3, prop: 0,
    };
    switch (role) {
      case 'tourist': look.hat = r(9) < 0.5 ? 3 : 2; look.bag = 2; look.prop = 1; look.coat = pickC([0xe0b43a, 0xd9483b, 0x3a9d5d, 0x2d6cdf, 0xf2f0ea, 0x8ac6d0], 10); break;
      case 'jogger': look.coat = pickC([0xff5a3c, 0x2d6cdf, 0x3ad08a, 0xf2f0ea, 0x1d1d1f], 11); look.pants = 0x1d1d1f; look.hat = 0; look.bag = 0; look.skirt = false; break;
      case 'waiter': look.coat = 0xf4f2ec; look.pants = 0x151515; look.skirt = true; look.hat = 0; look.bag = 0; look.prop = 2; break;
      case 'musician': look.hat = 1; look.coat = pickC([0x7a2e2e, 0x26262a, 0x3b3b5a], 12); look.prop = 5; look.bag = 0; look.skirt = false; break;
      case 'painter': look.hat = 1; look.coat = 0xe9e3d2; look.prop = 6; look.bag = 0; break;
      case 'mime': look.coat = 0xf5f5f5; look.pants = 0x151515; look.skin = 0xf7f7f7; look.hat = 1; look.bag = 0; look.skirt = false; break;
      case 'reader': look.prop = 3; break;
      case 'sitter': look.prop = r(13) < 0.6 ? 4 : 3; break;
      case 'vendor': look.coat = 0xf4f2ec; look.hat = 2; look.bag = 0; look.skirt = false; break;
      case 'kid': look.coat = pickC([0xe0b43a, 0xd9483b, 0x3a9d5d, 0x2d6cdf, 0xe0669c], 14); look.hat = 0; look.bag = r(15) < 0.5 ? 2 : 0; break;
      case 'cyclist': look.hat = 0; look.bag = r(16) < 0.3 ? 2 : 0; look.skirt = false; break;
    }
    return look;
  }

  spawn(role: Role, x: number, y: number, facing: number, extra: Partial<Npc> = {}): Npc {
    const id = this.seq++;
    const seed = id * 7919 + Math.round(x * 3 + y * 5);
    const want = role === 'jogger' ? 3.2 + hash(seed, 1) * 0.8 : role === 'cyclist' ? 4.4 : role === 'kid' ? 1.25 : role === 'tourist' ? 0.95 + hash(seed, 2) * 0.3 : 1.15 + hash(seed, 3) * 0.45;
    const n: Npc = {
      id, role, state: 'walk', x, y, z: 0, facing, speed: want, want,
      scale: role === 'kid' ? 0.62 + hash(seed, 4) * 0.1 : 0.93 + hash(seed, 5) * 0.14,
      phase: hash(seed, 6) * TAU, timer: 4 + hash(seed, 7) * 20,
      from: -1, to: -1, side: hash(seed, 8) < 0.5 ? 1 : -1,
      anchor: null, home: null, look: this.lookFor(role, seed), greeted: false, talked: 0, mood: 0.2, headY: 0, react: 0, reactKind: null, bubble: '', bubbleT: 0,
      ...extra,
    };
    if (role === 'dogwalker') n.dog = { x: x - 1, y, facing, phase: 0, color: [0x2a1d14, 0xc9a45a, 0xf2f0ea, 0x6b4a2a, 0x1d1d1f][Math.floor(hash(seed, 9) * 5)], scale: 0.7 + hash(seed, 10) * 0.6 };
    if (role === 'cyclist') { n.bike = true; n.state = 'ride'; }
    this.npcs.push(n);
    return n;
  }

  /** 길 위의 한 노드에서 걷기 시작 */
  private spawnWalker(hx: number, hy: number, near = false) {
    const N = this.nodes.length;
    if (!N) return;
    for (let tries = 0; tries < 20; tries++) {
      const i = Math.floor(Math.random() * N);
      const [x, y] = this.nodes[i];
      const d = Math.hypot(x - hx, y - hy);
      if (d < (near ? Math.min(8, this.spawnRange[0]) : this.spawnRange[0]) || d > (near ? this.spawnRange[1] * 0.7 : this.spawnRange[1])) continue;
      if (!this.adj[i]?.length) continue;
      const total = this.walkerRoles.reduce((a, [, w]) => a + w, 0);
      let r = Math.random() * total;
      let role: Role = 'passer';
      for (const [rr, w] of this.walkerRoles) { r -= w; if (r <= 0) { role = rr; break; } }
      const to = this.adj[i][Math.floor(Math.random() * this.adj[i].length)];
      const n = this.spawn(role, x, y, bearingOf(this.nodes[to][0] - x, this.nodes[to][1] - y));
      n.from = i; n.to = to;
      if (role === 'cyclist') n.side = 0.4;
      // 아이는 어른 한 명과 함께
      if (role === 'kid') {
        const parent = this.spawn('passer', x + 0.8, y, n.facing);
        parent.from = i; parent.to = to; parent.side = n.side; parent.want = parent.speed = 1.2; n.want = n.speed = 1.2;
        n.followTarget = null;
        n.tag = `kid:${parent.id}`;
      }
      return;
    }
  }

  /** 보도 쪽으로 비켜 걷는 거리(길 가운데에서) — 벽에 박히지 않게 */
  private offsetFor(a: number, b: number, side: number): number {
    const key = `${a}:${b}:${side}`;
    const hit = this.laneOff.get(key);
    if (hit !== undefined) return hit;
    const [ax, ay] = this.nodes[a], [bx, by] = this.nodes[b];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (by - ay) / L * side, ny = -(bx - ax) / L * side;
    let face = 99;
    if (this.world) for (let d = 0.8; d < 9; d += 0.6) if (this.world.buildingTopAt((ax + bx) / 2 + nx * d, (ay + by) / 2 + ny * d) > 0) { face = d; break; }
    const want = 2.4 + Math.abs(hash(a, b, side) - 0.5) * 2.2;
    const off = Math.min(this.maxOffset, face < 2.4 ? Math.max(0, face - 1.0) : Math.min(want, face - 0.9));
    this.laneOff.set(key, off);
    return off;
  }

  /** 제자리 역할들(테라스 손님·웨이터·벤치·악사·장수·화가·마임)과 비둘기를 가까워지면 채운다 */
  private fillAnchors(hx: number, hy: number) {
    for (const s of this.seats) {
      const d = Math.hypot(s.x - hx, s.y - hy);
      if (d > 85) continue;
      const key = `seat:${s.x.toFixed(1)}:${s.y.toFixed(1)}`;
      if (this.anchorsUsed.has(key)) continue;
      this.anchorsUsed.add(key);
      if (hash(s.x, s.y, 200) > (s.kind === 'chair' ? 0.55 : 0.35)) continue; // 비어 있는 자리도 있어야 앉는다
      const role: Role = s.kind === 'chair' ? 'sitter' : hash(s.x, s.y, 201) < 0.5 ? 'reader' : 'sitter';
      const n = this.spawn(role, s.x, s.y, s.facing, { state: 'sit', anchor: { x: s.x, y: s.y, z: s.z, facing: s.facing }, home: key, speed: 0 });
      n.z = s.z;
    }
    for (const sp of this.spots) {
      const d = Math.hypot(sp.x - hx, sp.y - hy);
      if (d > 90) continue;
      const key = `spot:${sp.kind}:${sp.x.toFixed(1)}:${sp.y.toFixed(1)}`;
      if (this.anchorsUsed.has(key)) continue;
      this.anchorsUsed.add(key);
      const h = hash(sp.x, sp.y, 210);
      if (sp.kind === 'terrace') {
        // 웨이터 한 명
        const w = this.spawn('waiter', sp.x + 0.6, sp.y, sp.facing, { state: 'stand', anchor: { x: sp.x, y: sp.y, z: 0, facing: sp.facing }, home: key, speed: 0 });
        w.tag = `waiter:${sp.ref}`;
      } else if ((sp.kind === 'fountain' || sp.kind === 'morris') && h < 0.55) {
        // 광장의 거리 공연(아코디언) — 몽마르트르·샹젤리제는 마임도
        const role: Role = (this.theme === 'montmartre' || this.theme === 'champs-elysees') && h < 0.2 ? 'mime' : 'musician';
        const [fx, fy] = dirOf(h * 360);
        const m = this.spawn(role, sp.x + fx * 2.4, sp.y + fy * 2.4, bearingOf(fx, fy), { state: role === 'mime' ? 'stand' : 'play', anchor: { x: sp.x + fx * 2.4, y: sp.y + fy * 2.4, z: 0, facing: bearingOf(fx, fy) }, home: key, speed: 0 });
        m.tag = role;
        // 구경꾼 몇
        for (let k = 0; k < 2 + Math.floor(h * 6); k++) {
          const a = rad(bearingOf(fx, fy)) + (k - 2) * 0.35;
          const r = 3.2 + hash(sp.x, k, 3) * 1.4;
          const px = m.x + Math.sin(a) * r, py = m.y + Math.cos(a) * r;
          this.spawn(hash(px, py, 4) < 0.5 ? 'tourist' : 'passer', px, py, bearingOf(m.x - px, m.y - py), { state: 'stand', anchor: { x: px, y: py, z: 0, facing: bearingOf(m.x - px, m.y - py) }, home: key, speed: 0, tag: 'audience' });
        }
      } else if (sp.kind === 'kiosk' && h < 0.8) {
        // 크레프 수레와 장수
        const [fx, fy] = dirOf(h * 360);
        const cx = sp.x + fx * 4, cy = sp.y + fy * 4;
        if (this.world && this.world.buildingTopAt(cx, cy) === 0) {
          this.cart(cx, cy, h * 360);
          const v = this.spawn('vendor', cx - fx * 0.9, cy - fy * 0.9, bearingOf(fx, fy), { state: 'stand', anchor: { x: cx - fx * 0.9, y: cy - fy * 0.9, z: 0, facing: bearingOf(fx, fy) }, home: key, speed: 0 });
          v.tag = 'crepe';
        }
      }
    }
    // 비둘기 떼: 벤치·분수 근처
    for (const sp of this.spots) {
      if (sp.kind !== 'bench' && sp.kind !== 'fountain' && sp.kind !== 'terrace') continue;
      const d = Math.hypot(sp.x - hx, sp.y - hy);
      if (d > 70) continue;
      const key = `flock:${sp.x.toFixed(0)}:${sp.y.toFixed(0)}`;
      if (this.flocks.some((f) => f.key === key) || hash(sp.x, sp.y, 220) > 0.45) continue;
      const birds: Pigeon[] = [];
      const n = 4 + Math.floor(hash(sp.x, sp.y, 221) * 8);
      const [fx, fy] = dirOf(sp.facing);
      const cx = sp.x + fx * 2.5, cy = sp.y + fy * 2.5;
      for (let i = 0; i < n; i++) {
        const a = hash(sp.x, i, 222) * TAU, r = hash(sp.y, i, 223) * 2.2;
        birds.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, z: 0, vx: 0, vy: 0, vz: 0, facing: hash(i, sp.x, 224) * 360, phase: hash(i, sp.y, 225) * TAU, state: 'peck', t: hash(i, i, 226) * 3, home: i });
      }
      this.flocks.push({ x: cx, y: cy, birds, scared: 0, key });
    }
    // 몽마르트르: 화가들
    if (this.theme === 'montmartre') for (const sp of this.spots) {
      if (sp.kind !== 'bench') continue;
      const key = `painter:${sp.x.toFixed(0)}:${sp.y.toFixed(0)}`;
      if (this.anchorsUsed.has(key) || Math.hypot(sp.x - hx, sp.y - hy) > 80) continue;
      this.anchorsUsed.add(key);
      if (hash(sp.x, sp.y, 230) > 0.4) continue;
      const [fx, fy] = dirOf(sp.facing + 90);
      const px = sp.x + fx * 2.2, py = sp.y + fy * 2.2;
      this.easel(px + Math.sin(rad(sp.facing)) * 0.7, py + Math.cos(rad(sp.facing)) * 0.7, sp.facing);
      const p = this.spawn('painter', px, py, sp.facing, { state: 'paint', anchor: { x: px, y: py, z: 0, facing: sp.facing }, home: key, speed: 0, tag: 'painter' });
      void p;
    }
  }

  private cart(x: number, y: number, facing: number) {
    const g = new THREE.Group();
    const mat = (c: number) => new THREE.MeshToonMaterial({ color: c, gradientMap: this.ramp });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9).translate(0, 0, 0.55), mat(0x2b4c8c));
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.06).translate(0, 0, 1.02), mat(0xd9c9a0));
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 14).rotateX(Math.PI / 2).translate(0.3, 0, 1.07), mat(0x2a2a2a));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6).rotateX(Math.PI / 2).translate(0, 0, 1.8), mat(0xdddddd));
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.4, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 2.55), mat(0xd9483b));
    (umb.material as THREE.MeshToonMaterial).side = THREE.DoubleSide;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.02, 0.3).translate(0, -0.42, 0.7), mat(0xf2d57e));
    g.add(body, top, plate, pole, umb, sign);
    for (const [wx, wy] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]]) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 10).rotateZ(Math.PI / 2).translate(wx, wy, 0.14), mat(0x1d1d1d)));
    g.position.set(x, y, 0);
    g.rotation.z = -rad(facing);
    g.updateMatrixWorld(true);
    this.carts.add(g);
    this.world?.addSolid([ringRect(x, y, 1.5, 0.95, -rad(facing))], 0, 1.05, 'prop');
  }

  private easel(x: number, y: number, facing: number) {
    const g = new THREE.Group();
    const mat = (c: number) => new THREE.MeshToonMaterial({ color: c, gradientMap: this.ramp });
    for (const [lx, rx] of [[-0.25, -0.12], [0.25, 0.12]]) g.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1.6).rotateY(lx > 0 ? -0.12 : 0.12).translate(lx + rx * 0, 0, 0.8), mat(0x8a5a33)));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 1.5).rotateX(0.3).translate(0, 0.25, 0.75), mat(0x8a5a33)));
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 80;
    const c2 = cv.getContext('2d')!;
    c2.fillStyle = '#f6f0e0'; c2.fillRect(0, 0, 64, 80);
    const pal = ['#2d6cdf', '#e4572e', '#f2c14e', '#3a9d5d', '#e0669c', '#7fb2e0'];
    for (let i = 0; i < 22; i++) { c2.fillStyle = pal[Math.floor(hash(x, i, 1) * pal.length)]; c2.fillRect(hash(y, i, 2) * 56, hash(x, i, 3) * 70, 6 + hash(i, x, 4) * 16, 4 + hash(i, y, 5) * 10); }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.62), new THREE.MeshBasicMaterial({ map: tex }));
    canvasM.rotation.x = Math.PI / 2 - 0.12;
    canvasM.position.set(0, 0.04, 1.2);
    canvasM.rotation.y = Math.PI; // 화가 쪽을 보게
    g.add(canvasM);
    g.position.set(x, y, 0);
    g.rotation.z = -rad(facing) + Math.PI;
    g.updateMatrixWorld(true);
    this.easels.add(g);
  }

  // ───────── 매 프레임 ─────────
  update(dt: number, hero: { x: number; y: number; z: number; speed: number; mode: string; crouch: boolean; facing: number }, camYaw: number) {
    this.t += dt;
    const hx = hero.x, hy = hero.y;
    // 멀어진 사람은 사라지고, 모자라면 새로 온다
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      const d = Math.hypot(n.x - hx, n.y - hy);
      const far = this.despawn;
      if (d > far && n.role !== 'quest' && !n.tag?.startsWith('quest')) {
        if (n.home) this.anchorsUsed.delete(n.home);
        this.npcs.splice(i, 1);
      }
    }
    for (const f of [...this.flocks]) if (Math.hypot(f.x - hx, f.y - hy) > 100) this.flocks.splice(this.flocks.indexOf(f), 1);
    this.fillAnchors(hx, hy);
    const walkers = this.npcs.filter((n) => !n.anchor && n.role !== 'quest').length;
    const target = Math.round(this.target * this.density);
    // 처음(또는 동네에 막 도착했을 때)은 가까이에도 채운다 — 텅 빈 거리로 시작하지 않게
    const sparse = walkers < target * 0.5;
    for (let k = 0; k < (sparse ? 12 : 3) && walkers + k < target; k++) this.spawnWalker(hx, hy, sparse);

    // 서로 비켜 가기용 격자
    const grid = new Map<number, Npc[]>();
    const gk = (x: number, y: number) => (Math.floor(x / 3) + 5000) * 10000 + Math.floor(y / 3) + 5000;
    for (const n of this.npcs) { const k = gk(n.x, n.y); (grid.get(k) ?? grid.set(k, []).get(k)!).push(n); }

    for (const n of this.npcs) this.step(n, dt, hero, grid, gk);
    this.stepBirds(dt, hero);
    this.render(camYaw);
  }

  private step(n: Npc, dt: number, hero: { x: number; y: number; z: number; speed: number; mode: string; facing: number }, grid: Map<number, Npc[]>, gk: (x: number, y: number) => number) {
    n.timer -= dt;
    if (n.bubbleT > 0) n.bubbleT -= dt;
    if (n.react > 0) { n.react -= dt; if (n.react <= 0) n.reactKind = null; }
    const dh = Math.hypot(hero.x - n.x, hero.y - n.y);
    // 가까이 온 여행자를 쳐다본다
    const lookAt = dh < 6 && (n.state !== 'walk' || dh < 3) ? angleDiff(n.facing, bearingOf(hero.x - n.x, hero.y - n.y)) : 0;
    n.headY += ((Math.abs(lookAt) < 100 ? Math.max(-70, Math.min(70, lookAt)) : 0) * Math.PI / 180 * -1 - n.headY) * Math.min(1, dt * 4);

    if (n.state === 'follow' && n.followTarget) {
      const tx = n.followTarget.x, ty = n.followTarget.y;
      const d = Math.hypot(tx - n.x, ty - n.y);
      const want = d > 2.2 ? Math.min(5.5, 1.2 + d * 0.8) : 0;
      n.speed += (want - n.speed) * Math.min(1, dt * 4);
      if (d > 0.1) n.facing = turnTo(n.facing, bearingOf(tx - n.x, ty - n.y), 360 * dt);
      const [fx, fy] = dirOf(n.facing);
      this.moveNpc(n, fx * n.speed * dt, fy * n.speed * dt);
      n.phase += n.speed * dt * Math.PI / 0.75;
      this.stepDog(n, dt);
      return;
    }
    if (n.anchor) {
      // 제자리: 앉거나 서서 자기 일을 한다
      const a = n.anchor;
      n.x += (a.x - n.x) * Math.min(1, dt * 3);
      n.y += (a.y - n.y) * Math.min(1, dt * 3);
      n.z = n.state === 'sit' ? a.z : 0;
      n.facing = turnTo(n.facing, a.facing, 120 * dt);
      n.speed = 0;
      n.phase += dt * (n.state === 'play' ? 6 : n.state === 'dance' ? 7 : 2);
      if (n.role === 'waiter' && n.timer < 0) {
        // 웨이터는 테이블 사이를 오간다
        n.timer = 3 + Math.random() * 5;
        const [fx, fy] = dirOf(a.facing + 90);
        const s = (Math.random() - 0.5) * 5;
        n.anchor = { ...a, x: a.x + fx * s * 0.3, y: a.y + fy * s * 0.3 };
        n.speed = 1;
      }
      if (n.role === 'waiter') { n.phase += dt * 3; n.speed = Math.hypot(a.x - n.x, a.y - n.y) > 0.2 ? 1.2 : 0; }
      if (n.tag === 'audience') {
        // 공연이 신나면 박수
        if (n.timer < 0) { n.timer = 3 + Math.random() * 6; n.react = Math.random() < 0.35 ? 1.6 : 0; n.reactKind = n.react ? 'clap' : null; }
      }
      return;
    }
    if (n.state === 'stand' || n.state === 'photo' || n.state === 'chat' || n.state === 'think' || n.state === 'point') {
      n.speed = 0;
      n.phase += dt * 2;
      if (n.timer < 0) { n.state = n.bike ? 'ride' : 'walk'; n.timer = 10 + Math.random() * 25; }
      return;
    }
    // 걷기(자전거 포함)
    if (n.to < 0 || n.from < 0 || !this.nodes[n.to]) { n.timer = -1; return; }
    const [ax, ay] = this.nodes[n.from], [bx, by] = this.nodes[n.to];
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const dx = (bx - ax) / L, dy = (by - ay) / L;
    const off = n.bike ? 1.2 * n.side : this.offsetFor(n.from, n.to, n.side);
    const tx = bx + dy * off, ty = by - dx * off;
    let vx = tx - n.x, vy = ty - n.y;
    const d = Math.hypot(vx, vy);
    if (d < 0.7) {
      // 갈림길: 왔던 길이 아닌 쪽으로
      const next = this.adj[n.to].filter((k) => k !== n.from);
      const pick = next.length ? next[Math.floor(Math.random() * next.length)] : n.from;
      n.from = n.to; n.to = pick;
      return;
    }
    vx /= d; vy /= d;
    // 사람끼리·여행자와 비켜 가기
    let sx = 0, sy = 0;
    const k0 = gk(n.x, n.y);
    for (const ddx of [-1, 0, 1]) for (const ddy of [-1, 0, 1]) {
      const arr = grid.get(k0 + ddx * 10000 + ddy);
      if (!arr) continue;
      for (const o of arr) {
        if (o === n) continue;
        const ex = n.x - o.x, ey = n.y - o.y;
        const e = Math.hypot(ex, ey);
        if (e > 0.01 && e < 1.1) { sx += (ex / e) * (1.1 - e); sy += (ey / e) * (1.1 - e); }
      }
    }
    if (dh < 2.2 && hero.z < 1) {
      const ex = n.x - hero.x, ey = n.y - hero.y;
      const e = Math.max(0.05, dh);
      sx += (ex / e) * (2.2 - e) * 1.6; sy += (ey / e) * (2.2 - e) * 1.6;
      // 사람 쪽으로 곧장 오는 여행자라면 옆으로 비킨다
      sx += -vy * 0.6 * n.side; sy += vx * 0.6 * n.side;
    }
    let mx = vx + sx * 1.3, my = vy + sy * 1.3;
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml; my /= ml;
    n.facing = turnTo(n.facing, bearingOf(mx, my), (n.bike ? 140 : 300) * dt);
    const slow = dh < 1.2 ? 0.4 : 1;
    n.speed += (n.want * slow - n.speed) * Math.min(1, dt * 3);
    const [fx, fy] = dirOf(n.facing);
    this.moveNpc(n, fx * n.speed * dt, fy * n.speed * dt);
    n.phase += n.speed * dt * Math.PI / (n.role === 'jogger' ? 1.1 : n.bike ? 1.6 : 0.75);
    this.stepDog(n, dt);
    // 가끔 멈춰 선다: 관광객은 사진, 행인은 가게 앞 구경·전화
    if (n.timer < 0 && !n.bike && n.role !== 'jogger' && n.role !== 'kid') {
      n.timer = 2.5 + Math.random() * 4;
      n.state = n.role === 'tourist' ? (Math.random() < 0.6 ? 'photo' : 'think') : 'stand';
      if (n.state === 'photo') n.facing = (n.facing + (Math.random() < 0.5 ? 90 : -90) + 360) % 360;
    }
    // 아이는 부모 곁에
    if (n.tag?.startsWith('kid:')) {
      const pid = Number(n.tag.slice(4));
      const p = this.npcs.find((q) => q.id === pid);
      if (p) {
        const [pfx, pfy] = dirOf(p.facing + 90);
        const kx = p.x + pfx * 0.7, ky = p.y + pfy * 0.7;
        const kd = Math.hypot(kx - n.x, ky - n.y);
        if (kd > 0.3) { n.x += (kx - n.x) * Math.min(1, dt * 2); n.y += (ky - n.y) * Math.min(1, dt * 2); }
        n.facing = turnTo(n.facing, p.facing, 200 * dt);
        n.speed = p.speed;
        n.state = p.state === 'walk' ? 'walk' : 'stand';
      }
    }
  }

  private moveNpc(n: Npc, dx: number, dy: number) {
    const nx = n.x + dx, ny = n.y + dy;
    // 사람은 건물 속으로 들어가지 않는다(길이 건물을 지나면 그 1층은 통로다)
    if (this.world && this.world.buildingTopAt(nx, ny) > 3 && !this.world.onLane(nx, ny, 1.4)) { n.facing = (n.facing + 25) % 360; return; }
    n.x = nx; n.y = ny;
  }

  private stepDog(n: Npc, dt: number) {
    const dg = n.dog;
    if (!dg) return;
    // 목줄 길이만큼 뒤·옆에서 따라온다(가끔 냄새를 맡으러 멈춘다)
    const [fx, fy] = dirOf(n.facing + 35);
    const tx = n.x + fx * 1.3, ty = n.y + fy * 1.3;
    const d = Math.hypot(tx - dg.x, ty - dg.y);
    const sp = Math.min(4, d * 2.2);
    if (d > 0.05) { dg.facing = turnTo(dg.facing, bearingOf(tx - dg.x, ty - dg.y), 400 * dt); const [ux, uy] = dirOf(dg.facing); dg.x += ux * sp * dt; dg.y += uy * sp * dt; }
    dg.phase += sp * dt * 9;
  }

  // ───────── 비둘기 ─────────
  private stepBirds(dt: number, hero: { x: number; y: number; z: number; speed: number; mode: string; crouch: boolean }) {
    for (const f of this.flocks) {
      const dh = Math.hypot(hero.x - f.x, hero.y - f.y);
      // 웅크리고 살금살금 오면 1 m까지 다가갈 수 있다. 뛰거나 그냥 걸어오면 날아간다.
      const scareR = hero.crouch ? 0.9 : hero.speed > 3 ? 4.5 : 2.3;
      for (const b of f.birds) {
        const db = Math.hypot(hero.x - b.x, hero.y - b.y);
        if (b.state === 'peck' && db < scareR && hero.z < 2) {
          b.state = 'fly'; b.t = 0;
          const a = Math.atan2(b.y - hero.y, b.x - hero.x) + (Math.random() - 0.5);
          b.vx = Math.cos(a) * 4; b.vy = Math.sin(a) * 4; b.vz = 4 + Math.random() * 2;
          f.scared = 1;
        }
        if (b.state === 'peck') {
          b.t -= dt;
          b.phase += dt * 3;
          if (b.t < 0) {
            b.t = 0.6 + Math.random() * 2;
            b.facing = (b.facing + (Math.random() - 0.5) * 120 + 360) % 360;
          }
          // 조금씩 종종걸음
          const [ux, uy] = dirOf(b.facing);
          const step = (Math.sin(b.phase * 4) > 0.7 ? 0.25 : 0) * dt;
          b.x += ux * step; b.y += uy * step;
          if (Math.hypot(b.x - f.x, b.y - f.y) > 3) b.facing = bearingOf(f.x - b.x, f.y - b.y);
          b.z = 0;
        } else if (b.state === 'fly') {
          b.t += dt;
          b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
          b.vz = Math.max(0.5, b.vz - dt * 1.2);
          b.facing = bearingOf(b.vx, b.vy);
          b.phase += dt * 30;
          if (b.t > 5) { b.state = 'gone'; b.t = 8 + Math.random() * 10; }
        } else {
          b.t -= dt;
          if (b.t < 0 && dh > 12) { b.state = 'peck'; const a = Math.random() * TAU, r = Math.random() * 2; b.x = f.x + Math.cos(a) * r; b.y = f.y + Math.sin(a) * r; b.z = 0; }
        }
      }
      f.scared = Math.max(0, f.scared - dt);
    }
  }

  /** 모이를 뿌리면 가까운 비둘기가 모여든다 */
  feed(x: number, y: number) {
    for (const f of this.flocks) {
      if (Math.hypot(f.x - x, f.y - y) > 14) continue;
      f.x += (x - f.x) * 0.6; f.y += (y - f.y) * 0.6;
      for (const b of f.birds) if (b.state !== 'fly') { b.state = 'peck'; b.x = x + (Math.random() - 0.5) * 2.4; b.y = y + (Math.random() - 0.5) * 2.4; b.z = 0; }
      return true;
    }
    return false;
  }

  /** 가까이에서 쪼고 있는 비둘기 수(사진 퀘스트용) */
  pigeonsNear(x: number, y: number, r: number) {
    let k = 0;
    for (const f of this.flocks) for (const b of f.birds) if (b.state === 'peck' && Math.hypot(b.x - x, b.y - y) < r) k++;
    return k;
  }

  // ───────── 그리기 ─────────
  private m0 = new THREE.Matrix4();
  private mA = new THREE.Matrix4();
  private mB = new THREE.Matrix4();
  private mC = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'ZXY');
  private v = new THREE.Vector3();
  private s1 = new THREE.Vector3(1, 1, 1);
  private col = new THREE.Color();
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);
  private pool: THREE.Matrix4[] = [];
  private pi = 0;
  /** 한 프레임 동안 빌려 쓰는 행렬 */
  private M() { if (this.pi >= this.pool.length) this.pool.push(new THREE.Matrix4()); return this.pool[this.pi++]; }

  private local(out: THREE.Matrix4, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    this.e.set(rx, ry, rz, 'ZXY');
    this.q.setFromEuler(this.e);
    return out.compose(this.v.set(x, y, z), this.q, this.s1.set(sx, sy, sz));
  }

  private set(name: PartName, i: number, m: THREE.Matrix4, color: number) {
    const mesh = this.parts.get(name)!;
    mesh.setMatrixAt(i, m);
    this.col.setHex(color);
    mesh.setColorAt(i, this.col);
  }

  private render(camYaw: number) {
    void camYaw;
    this.pi = 0;
    let i = 0;
    let dogI = 0, bikeI = 0;
    for (const n of this.npcs) {
      if (n.hidden || i >= MAX) continue;
      const L = n.look;
      // 자세
      const s = Math.sin(n.phase), c = Math.cos(n.phase);
      const moving = n.speed > 0.15 && (n.state === 'walk' || n.state === 'follow' || n.role === 'waiter');
      const run = n.role === 'jogger' ? 1 : Math.min(1, n.speed / 3);
      let bob = 0, lean = 0, tL = 0, tR = 0, kL = 0, kR = 0, aLx = 0, aRx = 0, aLy = 0.08, aRy = -0.08, twist = 0, headX = 0;
      const act: State | null = n.reactKind ?? n.state;
      if (n.bike) {
        // 페달
        bob = -0.1; lean = 0.35; tL = 1.2 + 0.4 * s; tR = 1.2 - 0.4 * s; kL = -1.4 - 0.4 * c; kR = -1.4 + 0.4 * c; aLx = 1.2; aRx = 1.2;
      } else if (act === 'sit') {
        bob = -0.8 + n.z * 0; tL = 1.5; tR = 1.45; kL = -1.5; kR = -1.45; aLx = 0.6; aRx = 0.6;
        if (L.prop === 3) { aLx = 1.1; aRx = 1.1; aLy = -0.3; aRy = 0.3; }
        if (L.prop === 4) aRx = 0.8 + 0.5 * Math.max(0, Math.sin(this.t * 0.7 + n.id));
      } else if (moving) {
        const A = 0.32 + 0.45 * run;
        tL = A * s; tR = -A * s; kL = -(0.1 + (0.5 + run) * Math.max(0, c)); kR = -(0.1 + (0.5 + run) * Math.max(0, -c));
        aLx = -A * 0.8 * s; aRx = A * 0.8 * s; lean = 0.04 + 0.15 * run; bob = Math.abs(s) * 0.04 * (0.5 + run); twist = 0.1 * s;
        if (n.role === 'jogger') { aLx *= 1.3; aRx *= 1.3; }
      } else {
        bob = Math.sin(this.t * 2 + n.id) * 0.006;
      }
      switch (act) {
        case 'photo': aLx = 1.2; aRx = 1.2; aLy = -0.4; aRy = 0.4; break;
        case 'think': aRx = 0.5; aLx = 0.6; aLy = -0.5; headX = -0.2; break;
        case 'play': aLx = 0.9 + 0.3 * Math.sin(n.phase); aRx = 0.9 + 0.3 * Math.sin(n.phase); aLy = -0.2 - 0.25 * Math.sin(n.phase); aRy = 0.2 + 0.25 * Math.sin(n.phase); bob = 0.02 * Math.abs(Math.sin(n.phase * 0.5)); twist = 0.1 * Math.sin(n.phase * 0.5); break;
        case 'clap': aLx = 1.1; aRx = 1.1; aLy = -0.25 + 0.2 * Math.sin(this.t * 16); aRy = 0.25 - 0.2 * Math.sin(this.t * 16); break;
        case 'wave': aRx = 0.2; aRy = -2.4 + 0.35 * Math.sin(this.t * 10); break;
        case 'point': aRx = 1.55; aRy = -0.05; break;
        case 'dance': { const ds = Math.sin(this.t * 7 + n.id); tL = Math.max(0, ds) * 1.1; tR = Math.max(0, -ds) * 1.1; aLx = 1.2 + ds; aRx = 1.2 - ds; aLy = 0.6; aRy = -0.6; bob = Math.abs(ds) * 0.07; twist = 0.3 * ds; break; }
        case 'paint': aRx = 1.3 + 0.15 * Math.sin(this.t * 3 + n.id); aRy = 0.1; aLx = 0.5; aLy = -0.4; headX = -0.05; break;
        case 'chat': aRx = 0.6 + 0.4 * Math.max(0, Math.sin(this.t * 3 + n.id)); aLx = 0.3 + 0.3 * Math.max(0, Math.sin(this.t * 2.3 + n.id)); aRy = -0.3; break;
        case 'flee': break;
      }
      if (n.role === 'waiter' && L.prop === 2 && act !== 'wave') { aRx = 1.5; aRy = -0.2; }
      if (n.role === 'mime' && (act === 'stand' || act === 'dance')) { // 보이지 않는 벽
        const p = Math.sin(this.t * 1.3 + n.id);
        aLx = 1.5 + 0.1 * p; aRx = 1.5 - 0.1 * p; aLy = -0.15 + 0.4 * p; aRy = 0.15 + 0.4 * p;
      }
      if (n.role === 'vendor') { aRx = 0.9 + 0.3 * Math.sin(this.t * 4); aLx = 0.7; }
      const sc = n.scale;
      // 뿌리: 자리·방향·크기
      this.local(this.m0, n.x, n.y, n.z + bob * sc, 0, 0, -rad(n.facing), sc, sc, sc);
      // 골반(엉덩이 높이 0.92)
      const pelvisM = this.mA.multiplyMatrices(this.m0, this.local(this.mB, 0, 0, 0.92, 0, 0, 0));
      if (L.skirt) { this.set('skirt', i, pelvisM, n.role === 'waiter' ? 0x151515 : L.coat); this.set('pelvis', i, this.zero, 0); }
      else { this.set('pelvis', i, pelvisM, L.pants); this.set('skirt', i, this.zero, 0); }
      // 몸통
      const spine = this.mC.multiplyMatrices(pelvisM, this.local(this.mB, 0, 0, 0.0, -lean, 0, twist));
      const torso = this.M().multiplyMatrices(spine, this.local(this.mB, 0, 0, 0.26, 0, 0, 0));
      this.set('torso', i, torso, L.coat);
      // 머리
      const head = this.M().multiplyMatrices(spine, this.local(this.mB, 0, 0.005, 0.7, headX + lean * 0.6, 0, n.headY));
      this.set('head', i, head, L.skin);
      const hatNone = L.hat === 0 || L.hat === 3 && false;
      this.set('hair', i, n.role === 'mime' ? this.zero : this.M().multiplyMatrices(head, this.local(this.mB, 0, -0.015, 0.02, 0, 0, 0)), L.hair);
      this.set('beret', i, L.hat === 1 ? this.M().multiplyMatrices(head, this.local(this.mB, 0.02, -0.01, 0.13, 0, 0.25, 0)) : this.zero, n.role === 'mime' ? 0x151515 : n.role === 'painter' ? 0x2a2a2a : 0x8a1f24);
      this.set('cap', i, L.hat === 2 ? this.M().multiplyMatrices(head, this.local(this.mB, 0, 0, 0.06, 0, 0, 0)) : this.zero, n.role === 'vendor' ? 0xf4f2ec : 0x2d6cdf);
      this.set('sunhat', i, L.hat === 3 ? this.M().multiplyMatrices(head, this.local(this.mB, 0, 0, 0.1, 0, 0, 0)) : this.zero, 0xe9dcae);
      void hatNone;
      // 팔
      for (const [side, ax, ay, name, hand] of [[-1, aLx, aLy, 'armL', 'handL'], [1, aRx, aRy, 'armR', 'handR']] as const) {
        const arm = this.M().multiplyMatrices(spine, this.local(this.mB, side * 0.215, 0, 0.42, ax, ay, 0));
        this.set(name, i, arm, L.coat);
        const handM = this.M().multiplyMatrices(arm, this.local(this.mB, 0, 0, -0.52, 0, 0, 0));
        this.set(hand, i, handM, n.role === 'mime' ? 0xf7f7f7 : L.skin);
        if (side === 1) {
          // 손에 든 것
          let pm: THREE.Matrix4 | null = null, pc = 0x222222;
          switch (L.prop) {
            case 1: if (act === 'photo') { pm = this.M().multiplyMatrices(handM, this.local(this.mB, -0.1, 0.05, 0.05, 0, 0, 0, 0.14, 0.08, 0.09)); pc = 0x222222; } break;
            case 2: pm = this.M().multiplyMatrices(handM, this.local(this.mB, 0, 0.05, 0.03, -1.5, 0, 0, 0.42, 0.42, 0.02)); pc = 0xc9c9c9; break;
            case 3: if (act === 'sit') { pm = this.M().multiplyMatrices(handM, this.local(this.mB, -0.18, 0.02, 0.1, 0, 0, 0, 0.42, 0.02, 0.3)); pc = 0xece6d6; } break;
            case 4: if (act === 'sit') { pm = this.M().multiplyMatrices(handM, this.local(this.mB, 0, 0.03, 0.03, 0, 0, 0, 0.07, 0.07, 0.08)); pc = 0xf6f1e7; } break;
            case 6: pm = this.M().multiplyMatrices(handM, this.local(this.mB, 0, 0.1, 0, 1.2, 0, 0, 0.02, 0.25, 0.02)); pc = 0x8a5a33; break;
          }
          this.set('prop', i, pm ?? this.zero, pc);
        }
      }
      this.set('accordion', i, L.prop === 5 && act === 'play' ? this.M().multiplyMatrices(spine, this.local(this.mB, 0, 0.3, 0.2, 0, 0, 0, 1 + 0.25 * Math.sin(n.phase), 1, 1)) : this.zero, 0x9a2a2a);
      // 가방
      this.set('pack', i, L.bag === 2 ? this.M().multiplyMatrices(spine, this.local(this.mB, 0, -0.2, 0.28, 0, 0, 0)) : this.zero, 0x4a5a3a);
      this.set('bag', i, L.bag === 1 ? this.M().multiplyMatrices(spine, this.local(this.mB, 0.24, 0.02, 0.0, 0, 0, 0.2)) : this.zero, 0x6b4423);
      // 다리
      for (const [side, t, k, thigh, shin] of [[-1, tL, kL, 'thighL', 'shinL'], [1, tR, kR, 'thighR', 'shinR']] as const) {
        const th = this.M().multiplyMatrices(pelvisM, this.local(this.mB, side * 0.09, 0, -0.04, t, 0, 0));
        this.set(thigh, i, L.skirt && n.role !== 'waiter' ? th : th, L.pants);
        const sh = this.M().multiplyMatrices(th, this.local(this.mB, 0, 0, -0.42, k, 0, 0));
        this.set(shin, i, sh, L.skirt ? L.skin : L.pants);
      }
      if (n.bike && bikeI < 30) {
        this.local(this.mA, n.x, n.y, n.z, 0, 0, -rad(n.facing), 1, 1, 1);
        this.bikes.setMatrixAt(bikeI++, this.mA);
      }
      if (n.dog && dogI < 24) this.drawDog(n.dog, dogI++);
      i++;
    }
    for (const [name, mesh] of this.parts) {
      void name;
      mesh.count = i;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const o = (mesh.userData as { outline?: THREE.InstancedMesh }).outline;
      if (o) o.count = i;
    }
    for (const m of this.dogParts) { m.count = dogI; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    this.bikes.count = bikeI;
    this.bikes.instanceMatrix.needsUpdate = true;
    // 비둘기
    let b = 0;
    for (const f of this.flocks) for (const p of f.birds) {
      if (p.state === 'gone' || b >= 160) continue;
      const peck = p.state === 'peck' ? Math.max(0, Math.sin(p.phase * 3)) * 0.5 : 0;
      this.local(this.m0, p.x, p.y, p.z + 0.1, p.state === 'fly' ? -0.2 : 0, 0, -rad(p.facing));
      this.birdParts[0].setMatrixAt(b, this.m0);
      this.birdParts[1].setMatrixAt(b, this.M().multiplyMatrices(this.m0, this.local(this.mB, 0, 0.12, 0.07 - peck * 0.12, 0, 0, 0)));
      const flap = p.state === 'fly' ? Math.sin(p.phase) * 1.1 : 0;
      const folded = p.state === 'fly' ? 1 : 0.001;
      this.birdParts[2].setMatrixAt(b, this.M().multiplyMatrices(this.m0, this.local(this.mB, 0.05, 0, 0.03, 0, flap, 0, folded, 1, 1)));
      this.birdParts[3].setMatrixAt(b, this.M().multiplyMatrices(this.m0, this.local(this.mB, -0.05, 0, 0.03, 0, -flap, 0, folded, 1, 1)));
      b++;
    }
    for (const m of this.birdParts) { m.count = b; m.instanceMatrix.needsUpdate = true; }
  }

  private drawDog(d: Dog, i: number) {
    const s = d.scale;
    this.local(this.m0, d.x, d.y, 0, 0, 0, -rad(d.facing), s, s, s);
    const set = (k: number, m: THREE.Matrix4, c: number) => { this.dogParts[k].setMatrixAt(i, m); this.col.setHex(c); this.dogParts[k].setColorAt(i, this.col); };
    set(0, this.M().multiplyMatrices(this.m0, this.local(this.mB, 0, 0, 0.36, 0, 0, 0)), d.color);
    set(1, this.M().multiplyMatrices(this.m0, this.local(this.mB, 0, 0.33, 0.48, 0, 0, 0)), d.color);
    const sw = Math.sin(d.phase) * 0.5;
    const legs: [number, number, number][] = [[-0.08, 0.17, sw], [0.08, 0.17, -sw], [-0.08, -0.17, -sw], [0.08, -0.17, sw]];
    legs.forEach(([lx, ly, a], k) => set(2 + k, this.M().multiplyMatrices(this.m0, this.local(this.mB, lx, ly, 0.3, a, 0, 0)), d.color));
    set(6, this.M().multiplyMatrices(this.m0, this.local(this.mB, 0, -0.28, 0.42, -2.2 + Math.sin(d.phase * 2) * 0.3, 0, Math.sin(d.phase * 3) * 0.5)), d.color);
  }

  // ───────── 여행자와 주고받기 ─────────
  /** 가까운 사람(앞쪽 우선) */
  nearest(x: number, y: number, facing: number, r: number, filter?: (n: Npc) => boolean): Npc | null {
    let best: Npc | null = null, bd = Infinity;
    for (const n of this.npcs) {
      if (n.hidden || n.bike || (filter && !filter(n))) continue;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d > r) continue;
      const behind = Math.abs(angleDiff(facing, bearingOf(n.x - x, n.y - y))) > 80 && d > 1.5;
      const score = d + (behind ? 5 : 0);
      if (score < bd) { bd = score; best = n; }
    }
    return best;
  }

  /** 말풍선을 띄운다 */
  say(n: Npc, text: string, secs = 3) { n.bubble = text; n.bubbleT = secs; }

  /** 몸짓 반응(손 흔들기·박수 등) */
  gesture(n: Npc, kind: State, secs: number) { n.reactKind = kind; n.react = secs; }

  /** 멈춰 세워 여행자를 보게 한다(말 걸 때) */
  hold(n: Npc, x: number, y: number, secs: number) {
    if (!n.anchor) { n.state = n.bike ? 'ride' : 'chat'; n.timer = secs; n.speed = 0; }
    n.facing = bearingOf(x - n.x, y - n.y);
  }

  /** 여행자와 부딪혔다: 서로 밀려나고 기분이 상한다 */
  bump(n: Npc, fromX: number, fromY: number) {
    const ex = n.x - fromX, ey = n.y - fromY;
    const e = Math.hypot(ex, ey) || 1;
    if (!n.anchor) { n.x += (ex / e) * 0.35; n.y += (ey / e) * 0.35; }
    n.mood = Math.max(-1, n.mood - 0.5);
  }
}

function turnTo(from: number, to: number, maxDeg: number) {
  const d = angleDiff(from, to);
  return (from + Math.sign(d) * Math.min(Math.abs(d), maxDeg) + 360) % 360;
}

function ringRect(x: number, y: number, sx: number, sy: number, rot: number) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const pts = [[-sx / 2, -sy / 2], [sx / 2, -sy / 2], [sx / 2, sy / 2], [-sx / 2, sy / 2]];
  const a = new Float64Array(8);
  pts.forEach(([lx, ly], i) => { a[i * 2] = x + lx * c - ly * s; a[i * 2 + 1] = y + lx * s + ly * c; });
  return a;
}
