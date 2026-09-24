// 직접 걷는 사람: 몸(물리) + 세계(건물 충돌) + 모습(3D) + 카메라 + 손(입력) + 화면 안내를 묶는다.
import type { Map as MlMap } from 'maplibre-gl';
import type { LngLat } from '../graph';
import { Body } from './body';
import type { BodyEvent, Intent } from './body';
import { OrbitCam } from './camera';
import { Figure } from './figure';
import { Frame, dirOf } from './geo';
import { HeroHud } from './hud';
import { Input } from './input';
import type { Frame as InputFrame } from './input';
import { View } from '../view';
import { World } from './world';
import { Town } from '../town';
import { Crowd } from '../town/crowd';
import type { Theme } from '../town';

const SOURCE = 'openmaptiles';

export interface TickOptions {
  waypoint: LngLat | null; // 자동으로 걸어갈 다음 점(지도에서 찍었을 때)
  frozen: boolean; // 카드·메뉴가 열려 있다
  pace: number;
  maxStamina: number;
  beacon: LngLat | null;
  hold?: boolean; // 몸을 움직이지 않는다(시작 전 준비 — 화면·동네만 미리 그린다)
}

export class Hero {
  readonly body = new Body();
  readonly figure = new Figure();
  readonly cam = new OrbitCam();
  readonly town = new Town();
  readonly crowd = new Crowd();
  /** 이번 프레임에 여행자와 부딪힌 사람(세게) */
  bumped: import('../town/crowd').Npc | null = null;
  private graphNodes: LngLat[] = [];
  private graphAdj: number[][] = [];
  theme: Theme = 'marais';
  private ways: LngLat[][] = [];
  readonly input: Input;
  readonly hud: HeroHud;
  frame: Frame;
  world: World;
  visible = false;
  events: BodyEvent[] = [];
  private beaconLocal: [number, number] | null = null;
  /** 다른 화면(지도 보기)에서 돌아올 때: 위에서 내려오며 몸 뒤로 붙는다 */
  private blend: { from: { x: number; y: number; z: number; fx: number; fy: number; fz: number }; t0: number; secs: number } | null = null;
  /** 걷기 화면(three.js가 전부 그린다) */
  readonly view: View;
  private stuck = { t: 0, x: 0, y: 0 };

  private readonly map: MlMap;
  /** 지하철·버스 안처럼 지도 밖의 장면. 있으면 몸은 이 세계에서 움직이고, 거리·사람들은 멈춘다. */
  sceneWorld: World | null = null;

  constructor(map: MlMap, onMap: () => void) {
    this.map = map;
    this.frame = new Frame([map.getCenter().lng, map.getCenter().lat]);
    this.world = new World(this.frame, { hills: true });
    this.view = new View(document.getElementById('map')!);
    this.input = new Input(this.view.el);
    this.hud = new HeroHud(this.input, onMap);
  }

  /** 스타일이 다 읽힌 뒤에 부른다 */
  attach() {
    window.setInterval(() => this.absorb(), 1000);
  }

  /** 지도와 같은 타일 주소에서 주변 건물을 받아 둔다 */
  absorb() {
    const src = this.map.getSource(SOURCE) as { tiles?: string[] } | undefined;
    const template = src?.tiles?.[0];
    if (!template) {
      // 타일이 없다(오프라인·폴백 지도): 걷는 길을 따라 건물을 세운다
      if (this.ways.length) this.town.buildProcedural(this.ways.map((w) => w.map((p) => this.frame.toLocal(p))));
      return;
    }
    const [lng, lat] = this.lnglat;
    this.world.ensure(lng, lat, template);
  }

  get lnglat(): LngLat { return this.frame.toLngLat(this.body.x, this.body.y); }
  get heading() { return this.body.facing; }

  private lanes: LngLat[][] = [];
  /** 걸어 다니는 길(거리 그래프의 선분들). 건물 밑 통로를 뚫어 주는 데 쓴다. */
  setLanes(segs: LngLat[][]) {
    this.lanes = segs;
    const local = segs.map(([a, b]) => [...this.frame.toLocal(a), ...this.frame.toLocal(b)] as [number, number, number, number]);
    this.world.setLanes(local);
    this.town.setLanes(local);
  }
  /** 사람들이 걸어 다니는 길(거리 그래프) */
  setGraph(nodes: LngLat[], adj: number[][]) { this.graphNodes = nodes; this.graphAdj = adj; }
  /** 걷는 길 폴리라인(타일이 없을 때 건물을 세우는 데 쓴다) */
  setWays(ways: LngLat[][]) { this.ways = ways; }

  /** 새 자리에 선다(동네를 옮기면 세계도 새로 읽는다) */
  reset(at: LngLat, facing?: number) {
    this.frame = new Frame(at);
    this.world = new World(this.frame, { hills: true });
    this.town.reset(this.world, this.frame, this.theme);
    this.setLanes(this.lanes);
    this.crowd.reset(this.world, this.graphNodes.map((p) => this.frame.toLocal(p)), this.graphAdj, this.theme);
    this.crowd.seats = this.town.seats;
    this.crowd.spots = this.town.spots;
    this.body.place(0, 0, this.world.terrain(0, 0));
    if (facing !== undefined) this.body.facing = facing;
    this.cam.snap(this.body);
    if (import.meta.env.DEV) this.world.onLoad = (k, ms) => console.debug(`[hero] tile ${k} → ${this.world.count} solids (${Math.round(ms)} ms)`);
    this.absorb();
  }

  /** 몸은 그대로 두고 좌표의 원점만 지금 자리로 옮긴다(다른 동네로 걸어·날아 들어갈 때). 세계·거리·사람을 새로 읽는다. */
  rebase() {
    const at = this.lnglat;
    const b = this.body;
    this.frame = new Frame(at);
    this.world = new World(this.frame, { hills: true });
    this.town.reset(this.world, this.frame, this.theme);
    this.setLanes(this.lanes);
    this.crowd.reset(this.world, this.graphNodes.map((p) => this.frame.toLocal(p)), this.graphAdj, this.theme);
    this.crowd.seats = this.town.seats;
    this.crowd.spots = this.town.spots;
    const cx = this.cam;
    const dx = b.x, dy = b.y;
    b.x = 0; b.y = 0;
    b.safe = { x: 0, y: 0, z: b.z };
    cx.shift(-dx, -dy);
    this.absorb();
  }

  /** 가까운 곳으로 자리만 옮긴다(같은 동네) */
  moveTo(at: LngLat) {
    const [x, y] = this.frame.toLocal(at);
    this.body.place(x, y, this.world.ground(x, y, 200, 0) || 0);
    this.cam.snap(this.body);
  }

  /** 한 프레임. 사용자가 직접 움직였는지(자동 걷기를 끊어야 하는지)를 돌려준다. */
  tick(dt: number, o: TickOptions): { user: boolean; f: InputFrame; arrivedWaypoint: boolean } {
    const f = this.input.read(dt);
    const b = this.body;
    const user = Math.hypot(f.mx, f.my) > 0.15 || f.jump || f.roll || f.crouch;
    let mx = 0, my = 0;
    let arrivedWaypoint = false;
    if (!o.frozen) {
      if (user || !o.waypoint) {
        const [fx, fy] = dirOf(this.cam.yaw);
        const [rx, ry] = dirOf(this.cam.yaw + 90);
        mx = rx * f.mx + fx * f.my;
        my = ry * f.mx + fy * f.my;
        this.stuck.t = 0;
      } else {
        const [tx, ty] = this.frame.toLocal(o.waypoint);
        const dx = tx - b.x, dy = ty - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 1.3) arrivedWaypoint = true;
        else { mx = dx / d; my = dy / d; }
        // 막혀서 못 가면 그 점은 건너뛴다
        this.stuck.t += dt;
        if (this.stuck.t > 1.2) {
          if (Math.hypot(b.x - this.stuck.x, b.y - this.stuck.y) < 0.6) arrivedWaypoint = true;
          this.stuck = { t: 0, x: b.x, y: b.y };
        }
      }
    }
    const intent: Intent = {
      mx, my,
      sprint: !o.frozen && f.sprint,
      jump: !o.frozen && f.jump,
      drop: !o.frozen && f.drop,
      crouch: !o.frozen && f.crouch,
      roll: !o.frozen && f.roll,
      pace: o.pace,
      maxStamina: o.maxStamina,
    };
    const W = this.sceneWorld ?? this.world;
    if (o.hold) b.events.length = 0;
    else b.step(dt, W, intent);
    this.events = b.events.slice();
    if (user) this.hud.moved();
    if (f.recenter) this.cam.recenter();
    if (o.beacon) { const [x, y] = this.frame.toLocal(o.beacon); this.beaconLocal = [x - b.x, y - b.y]; } else this.beaconLocal = null;
    const g = W.ground(b.x, b.y, b.z + 0.05, 0.05);
    this.figure.update(b, dt, g, this.beaconLocal);
    this.hud.update(b, dt);
    this.lastF = f;
    if (this.sceneWorld) { this.bumped = null; return { user, f, arrivedWaypoint }; }
    this.town.heroZ = b.z;
    this.town.update(b.x, b.y);
    this.crowd.seats = this.town.seats;
    this.crowd.spots = this.town.spots;
    this.crowd.update(dt, { x: b.x, y: b.y, z: b.z, speed: b.speed, mode: b.mode, crouch: b.crouch, facing: b.facing }, this.cam.yaw);
    this.pushAgainst(this.crowd, this.world);
    return { user, f, arrivedWaypoint };
  }
  private lastF: InputFrame | null = null;

  /** 사람과 부딪힘: 여행자는 밀려나고, 세게(달리다·구르다) 부딪히면 그 사람이 휘청이며 한마디 한다 */
  pushAgainst(crowd: Crowd, W: World) {
    const b = this.body;
    this.bumped = null;
    if (b.mode === 'climb' || b.mode === 'swim') return;
    for (const n of crowd.npcs) {
      if (n.hidden || n.bike || Math.abs(n.z - b.z) > 1.2) continue;
      const dx = b.x - n.x, dy = b.y - n.y;
      const d = Math.hypot(dx, dy);
      const R0 = 0.3 + 0.24 * n.scale;
      if (d >= R0 || d < 1e-4) continue;
      const push = R0 - d;
      b.shove((dx / d) * push, (dy / d) * push, W);
      if ((b.speed > 4.9 || b.mode === 'roll' || b.mode === 'slide') && !this.bumped) {
        this.bumped = n;
        crowd.bump(n, b.x, b.y);
        if (b.mode !== 'roll') b.stagger(dx / d, dy / d, 1.8);
      }
    }
  }

  /** 장면(지하철 등) 안에서의 카메라: 지도는 건드리지 않고 자리·방위·내려다보는 각만 준다 */
  sceneShot(dt: number) {
    const f = this.lastF;
    return this.cam.update(dt, this.body, this.sceneWorld ?? this.world, f?.camYaw ?? 0, f?.camPitch ?? 0, f?.zoom ?? 0);
  }

  /** 카메라를 몸 뒤에 둔다. resume() 직후에는 위에서 서서히 내려와 붙는다. */
  drive(dt: number) {
    const f = this.lastF;
    const s = this.cam.update(dt, this.body, this.world, f?.camYaw ?? 0, f?.camPitch ?? 0, f?.zoom ?? 0);
    const bl = this.blend;
    if (!bl) { this.view.look(s.x, s.y, s.z, s.fx, s.fy, s.fz); return; }
    const t = Math.min(1, (performance.now() - bl.t0) / 1000 / bl.secs);
    const w = t * t * (3 - 2 * t);
    const m = (a: number, b: number) => a + (b - a) * w;
    const F = bl.from;
    this.view.look(m(F.x, s.x), m(F.y, s.y), m(F.z, s.z), m(F.fx, s.fx), m(F.fy, s.fy), m(F.fz, s.fz));
    if (t >= 1) this.blend = null;
  }

  /** 다른 화면(지도 보기)에서 돌아올 때: 머리 위 높은 곳에서 내려온다 */
  resume(secs = 1.4) {
    const b = this.body;
    this.blend = { from: { x: b.x - 20, y: b.y - 30, z: b.z + 140, fx: b.x, fy: b.y, fz: b.z }, t0: performance.now(), secs };
  }

  /** 한 장 그린다(지하철 장면 중엔 그 장면이 따로 그린다) */
  render(dt: number) {
    const b = this.body;
    this.view.render({ scenes: [this.town.scene, this.crowd.scene], figure: { scene: this.figure.scene, x: b.x, y: b.y, z: b.z, visible: this.visible } }, dt);
    this.town.setView(this.view.viewProj, this.view.el.clientWidth, this.view.el.clientHeight);
    // 기력 바퀴를 머리 옆에
    const o = { x: 0, y: 0 };
    const ok = this.visible && this.view.project(b.x, b.y, b.z + 1.5, o);
    this.hud.anchor(o.x, o.y, ok);
  }
}

export type { BodyEvent };
export type { Act, Carry, Seat } from './body';
export type { Emote } from './input';
