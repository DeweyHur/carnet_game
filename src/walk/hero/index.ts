// 직접 걷는 사람: 몸(물리) + 세계(건물 충돌) + 모습(3D) + 카메라 + 손(입력) + 화면 안내를 묶는다.
import type { CameraOptions, Map as MlMap } from 'maplibre-gl';
import type { LngLat } from '../graph';
import { Body } from './body';
import type { BodyEvent, Intent } from './body';
import { OrbitCam } from './camera';
import { Figure } from './figure';
import { Frame, angleDiff, dirOf } from './geo';
import { HeroHud } from './hud';
import { Input } from './input';
import type { Frame as InputFrame } from './input';
import { figureLayer } from './layer';
import { World } from './world';
import { Town } from '../town';
import type { Theme } from '../town';

const SOURCE = 'openmaptiles';

export interface TickOptions {
  waypoint: LngLat | null; // 자동으로 걸어갈 다음 점(지도에서 찍었을 때)
  frozen: boolean; // 카드·메뉴가 열려 있다
  pace: number;
  maxStamina: number;
  beacon: LngLat | null;
}

export class Hero {
  readonly body = new Body();
  readonly figure = new Figure();
  readonly cam = new OrbitCam();
  readonly town = new Town();
  theme: Theme = 'marais';
  private ways: LngLat[][] = [];
  readonly input: Input;
  readonly hud: HeroHud;
  frame: Frame;
  world: World;
  visible = false;
  events: BodyEvent[] = [];
  private beaconLocal: [number, number] | null = null;
  private blend: { from: { lng: number; lat: number; zoom: number; pitch: number; bearing: number; elevation: number }; t0: number; secs: number } | null = null;
  private stuck = { t: 0, x: 0, y: 0 };

  private readonly map: MlMap;

  constructor(map: MlMap, onMap: () => void) {
    this.map = map;
    this.frame = new Frame([map.getCenter().lng, map.getCenter().lat]);
    this.world = new World(this.frame);
    this.input = new Input(map.getCanvasContainer());
    this.hud = new HeroHud(this.input, onMap);
  }

  /** 스타일이 다 읽힌 뒤에 부른다 */
  attach() {
    this.map.addLayer(this.town.layer(() => [this.frame.lng0, this.frame.lat0]));
    this.map.addLayer(figureLayer(this.figure, () => ({ at: this.lnglat, z: this.body.z, visible: this.visible }), (x, y, ok) => this.hud.anchor(x, y, ok)));
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
  /** 걷는 길 폴리라인(타일이 없을 때 건물을 세우는 데 쓴다) */
  setWays(ways: LngLat[][]) { this.ways = ways; }

  /** 새 자리에 선다(동네를 옮기면 세계도 새로 읽는다) */
  reset(at: LngLat, facing?: number) {
    this.frame = new Frame(at);
    this.world = new World(this.frame);
    this.town.reset(this.world, this.frame, this.theme);
    this.setLanes(this.lanes);
    this.body.place(0, 0, 0);
    if (facing !== undefined) this.body.facing = facing;
    this.cam.snap(this.body);
    if (import.meta.env.DEV) this.world.onLoad = (k, ms) => console.debug(`[hero] tile ${k} → ${this.world.count} solids (${Math.round(ms)} ms)`);
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
    b.step(dt, this.world, intent);
    this.events = b.events.slice();
    if (user) this.hud.moved();
    if (f.recenter) this.cam.recenter();
    if (o.beacon) { const [x, y] = this.frame.toLocal(o.beacon); this.beaconLocal = [x - b.x, y - b.y]; } else this.beaconLocal = null;
    const g = this.world.ground(b.x, b.y, b.z + 0.05, 0.05);
    this.figure.update(b, dt, g, this.beaconLocal);
    this.town.update(b.x, b.y);
    this.hud.update(b, dt);
    this.lastF = f;
    return { user, f, arrivedWaypoint };
  }
  private lastF: InputFrame | null = null;

  /** 카메라를 몸 뒤에 둔다. resume() 직후에는 지금 지도 카메라에서 서서히 넘어온다. */
  drive(dt: number) {
    const f = this.lastF;
    const s = this.cam.update(dt, this.body, this.world, f?.camYaw ?? 0, f?.camPitch ?? 0, f?.zoom ?? 0);
    const target = this.map.calculateCameraOptionsFromCameraLngLatAltRotation(this.frame.toLngLat(s.x, s.y), s.z, s.bearing, s.pitch, 0);
    if (!this.blend) { this.map.jumpTo({ ...target, roll: 0 }); return; }
    const bl = this.blend;
    const t = Math.min(1, (performance.now() - bl.t0) / 1000 / bl.secs);
    const w = t * t * (3 - 2 * t);
    const tc = target.center as { lng: number; lat: number };
    const opts: CameraOptions = {
      center: [bl.from.lng + (tc.lng - bl.from.lng) * w, bl.from.lat + (tc.lat - bl.from.lat) * w],
      zoom: bl.from.zoom + ((target.zoom ?? bl.from.zoom) - bl.from.zoom) * w,
      pitch: bl.from.pitch + ((target.pitch ?? bl.from.pitch) - bl.from.pitch) * w,
      bearing: bl.from.bearing + angleDiff(bl.from.bearing, target.bearing ?? bl.from.bearing) * w,
      elevation: bl.from.elevation + ((target.elevation ?? 0) - bl.from.elevation) * w,
      roll: 0,
    };
    this.map.jumpTo(opts);
    if (t >= 1) this.blend = null;
  }

  /** 다른 카메라(지하철·지도 보기)에서 돌아올 때 */
  resume(secs = 1.4) {
    const c = this.map.getCenter();
    this.map.stop();
    this.map.setCenterClampedToGround(false);
    this.blend = { from: { lng: c.lng, lat: c.lat, zoom: this.map.getZoom(), pitch: this.map.getPitch(), bearing: this.map.getBearing(), elevation: this.map.getCenterElevation?.() ?? 0 }, t0: performance.now(), secs };
  }
}

export type { BodyEvent };
export type { Act, Carry, Seat } from './body';
export type { Emote } from './input';
