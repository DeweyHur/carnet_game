// 🌗 파리의 두 얼굴: 낮과 밤을 번갈아 풀어 가는 이야기. 낮에 찾은 실마리가 밤에만 보이는 것을 드러내고,
// 밤에 얻은 것이 다음 낮의 문을 연다. 모드(☀️ 낮 / 🌙 밤 습격)는 언제든 🧚 메뉴에서 바꾼다.
// 낮 단계: 그 자리에 가서 F(실마리 읽기·열쇠 쓰기). 밤 단계: 그 자리에 가면 정예가 지키고 있다 — 물리치면 얻는다.
// 맞지 않는 모드로 가면 흐린 표시와 함께 "밤(낮)에 다시 오자"라고 알려 준다.
import * as THREE from 'three';
import type { Hero } from './hero';
import type { Frame as InputFrame } from './hero/input';
import type { Kind } from './combat';
import { lmPoint } from './explore';
import type { LngLat } from './graph';
import * as sfx from './sound';

export interface TaleStep {
  id: string;
  mode: 'day' | 'night';
  at: LngLat;
  /** 할 일 한 줄 */
  line: string;
  /** 곁에서 F */
  verb?: string; what?: string;
  /** 밤: 지키는 적(앞의 elites마리는 정예) */
  foes?: Kind[]; elites?: number;
  /** 풀었을 때 */
  done: string;
  reward: { xp: number; stars: number; books?: number; ore?: number; eur?: number; sp?: number; gear?: boolean };
}

export const TALE: TaleStep[] = [
  {
    id: 'notebook', mode: 'day', at: lmPoint('eiffel', 34, -128),
    line: '☀️ 샹드마르스 벤치 곁 — 귀스타브의 낡은 수첩 조각을 읽자', verb: '읽기', what: '📓 낡은 수첩 조각',
    done: '📓 "…달이 뜨면 샹드마르스 잔디에 철의 유령이 선다. 녹슨 열쇠를 지키며." — 🌙 밤에 다시 오자',
    reward: { xp: 150, stars: 20 },
  },
  {
    id: 'ghost', mode: 'night', at: lmPoint('eiffel', 0, -236),
    line: '🌙 샹드마르스 잔디 — 철의 유령(정예 쥐 기사)을 물리치고 녹슨 열쇠를 찾자', foes: ['rat', 'rat', 'rat', 'rat', 'gargoyle'], elites: 2,
    done: '🗝 녹슨 열쇠를 얻었다 — 열쇠고리에 "루브르"라고 새겨져 있다. ☀️ 낮에 루브르로',
    reward: { xp: 400, stars: 40, books: 3, ore: 5 },
  },
  {
    id: 'keystone', mode: 'day', at: lmPoint('louvre', -104, 18),
    line: '☀️ 루브르 나폴레옹 안뜰 — 열쇠 구멍이 난 옛 표지석에 녹슨 열쇠를 꽂자', verb: '열쇠 꽂기', what: '🪨 옛 표지석',
    done: '🪨 표지석이 열리고 쪽지가 나왔다: "섬의 성당 앞, 푸앵 제로 곁 — 밤에만 열리는 문" — 🌙 밤에 노트르담으로',
    reward: { xp: 200, stars: 25, eur: 30 },
  },
  {
    id: 'door', mode: 'night', at: lmPoint('notre-dame', -132, 12),
    line: '🌙 노트르담 앞 광장 — 밤에만 열리는 문을 지키는 가고일들을 물리치자', foes: ['gargoyle', 'gargoyle', 'gargoyle', 'rat', 'rat'], elites: 2,
    done: '🚪 문 너머에서 별자리 그림 조각을 찾았다 — 몽마르트르의 화가라면 알아볼 것 같다. ☀️ 낮에 사크레쾨르로',
    reward: { xp: 600, stars: 50, books: 4, ore: 8 },
  },
  {
    id: 'canvas', mode: 'day', at: lmPoint('sacre-coeur', -44, -12),
    line: '☀️ 사크레쾨르 앞마당 — 화가의 빈 캔버스에 별자리 그림 조각을 맞춰 보자', verb: '맞춰 보기', what: '🎨 화가의 빈 캔버스',
    done: '🎨 그림이 완성되자 별 하나가 비어 있다 — "그 별은 언덕에 떨어졌지. 밤에만 빛나." 🌙 밤에 다시',
    reward: { xp: 250, stars: 30, books: 2 },
  },
  {
    id: 'star', mode: 'night', at: lmPoint('sacre-coeur', -30, -44),
    line: '🌙 몽마르트르 언덕 — 떨어진 별을 지키는 정예 무리를 물리치자', foes: ['gargoyle', 'gargoyle', 'gargoyle', 'rat', 'rat', 'slime'], elites: 3,
    done: '🌟 떨어진 별을 되찾았다! 파리의 두 얼굴을 모두 보았다',
    reward: { xp: 1200, stars: 200, books: 10, ore: 15, eur: 100, sp: 2, gear: true },
  },
];

export interface TalesCtx {
  hero: Hero;
  night(): boolean;
  toast(s: string): void;
  hint(s: string): void;
  /** 밤 단계: 정예 무리를 세운다 */
  spawn(key: string, x: number, y: number, z: number, foes: Kind[], elites: number): void;
  /** 그 무리를 다 물리쳤나 */
  cleared(key: string): boolean;
  reward(r: TaleStep['reward'], why: string): void;
}

const KEY = 'carnet-tales-v1';

export class Tales {
  private readonly c: TalesCtx;
  readonly group = new THREE.Group();
  /** 지금 단계(= 푼 수) */
  step = 0;
  private marker: THREE.Group | null = null;
  private markerStep = -1;
  private near = false;
  private t = 0;
  private hintT = 0;
  private readonly el: HTMLElement;
  onChange?: () => void;

  constructor(c: TalesCtx) {
    this.c = c;
    this.group.name = 'tales';
    try { this.step = Math.min(TALE.length, (JSON.parse(localStorage.getItem(KEY) ?? 'null') as { step?: number } | null)?.step ?? 0); } catch { /* 처음부터 */ }
    this.el = document.createElement('div');
    this.el.className = 'tale';
    document.body.appendChild(this.el);
  }
  get done() { return this.step >= TALE.length; }
  get current(): TaleStep | null { return TALE[this.step] ?? null; }
  private save() { try { localStorage.setItem(KEY, JSON.stringify({ step: this.step })); } catch { /* 무시 */ } this.onChange?.(); }

  /** 지금 목표(로컬) — 빛기둥에 쓴다 */
  target(): [number, number] | null {
    const s = this.current;
    if (!s) return null;
    return this.c.hero.frame.toLocal(s.at) as [number, number];
  }
  /** 맞는 모드인가 */
  private ready(s: TaleStep) { return (s.mode === 'night') === this.c.night(); }

  private buildMarker(s: TaleStep) {
    if (this.marker) { this.group.remove(this.marker); this.marker = null; }
    const g = new THREE.Group();
    const night = s.mode === 'night';
    const col = night ? 0xb79bff : 0xffd166;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 30), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: col }));
    orb.position.z = 1.4;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.45, 36), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    ring.position.z = 0.08;
    g.add(beam, orb, ring);
    g.userData = { beam, orb, ring };
    this.group.add(g);
    this.marker = g;
    this.markerStep = this.step;
  }

  /** 누른 F를 여기서 썼으면 true */
  update(dt: number, f: InputFrame | null, live: boolean): boolean {
    this.t += dt;
    const s = this.current;
    if (!s) { if (this.marker) { this.group.remove(this.marker); this.marker = null; } this.near = false; this.paint(); return false; }
    if (this.markerStep !== this.step || !this.marker) this.buildMarker(s);
    const h = this.c.hero, b = h.body, w = h.world;
    const [x, y] = h.frame.toLocal(s.at);
    const z = w.ground(x, y, w.terrain(x, y) + 30, 40);
    const m = this.marker!, u = m.userData as { beam: THREE.Mesh; orb: THREE.Mesh; ring: THREE.Mesh };
    const ok = this.ready(s);
    m.position.set(x, y, z);
    m.visible = Math.hypot(x - b.x, y - b.y) < 900;
    (u.beam.material as THREE.MeshBasicMaterial).opacity = ok ? 0.26 + 0.08 * Math.sin(this.t * 2) : 0.07; // 맞지 않는 모드면 흐리게
    u.orb.visible = ok; u.orb.rotation.z = this.t * 1.5; u.orb.position.z = 1.4 + Math.sin(this.t * 2.4) * 0.15;
    u.ring.scale.setScalar(1 + 0.08 * Math.sin(this.t * 3));
    const d = Math.hypot(x - b.x, y - b.y), dz = b.z - z;
    this.near = false;
    this.paint();
    if (!live) return false;
    // 맞지 않는 모드로 왔다
    if (!ok && d < 14 && Math.abs(dz) < 6) {
      this.hintT -= dt;
      if (this.hintT <= 0) { this.hintT = 6; this.c.hint(s.mode === 'night' ? '🌙 여긴 밤에만 드러난다 — 🧚 메뉴에서 "밤 습격"으로 바꾸고 다시 오자' : '☀️ 밤엔 어두워 보이지 않는다 — 🧚 메뉴에서 "낮으로" 바꾸고 다시 오자'); setTimeout(() => this.c.hint(''), 4000); }
      return false;
    }
    if (!ok) return false;
    if (s.mode === 'day') {
      if (d < 2.6 && Math.abs(dz) < 2) {
        this.near = true;
        if (f?.interact) { f.interact = false; this.solve(s); return true; }
      }
      return false;
    }
    // 밤: 다가가면 정예가 깨어난다, 다 물리치면 풀린다
    const key = `tale:${s.id}`;
    if (d < 45 && Math.abs(dz) < 12) this.c.spawn(key, x, y, z, s.foes ?? [], s.elites ?? 0);
    if (this.c.cleared(key)) this.solve(s);
    return false;
  }

  prompt(): { verb: string; what: string } | null {
    const s = this.current;
    return this.near && s?.verb ? { verb: s.verb, what: s.what ?? '' } : null;
  }

  private solve(s: TaleStep) {
    this.step++;
    this.save();
    sfx.questDone();
    this.c.toast(s.done);
    this.c.reward(s.reward, `파리의 두 얼굴 · ${this.step}/${TALE.length}`);
    this.markerStep = -1;
  }

  /** 할 일(왼쪽, 거리의 할 일 아래) */
  private paintAcc = 0;
  private paint() {
    this.paintAcc -= 1;
    if (this.paintAcc > 0) return;
    this.paintAcc = 20;
    const s = this.current;
    if (!s) { this.el.classList.remove('on'); return; }
    const ok = this.ready(s);
    this.el.classList.add('on');
    this.el.classList.toggle('wait', !ok);
    this.el.innerHTML = `<small>🌗 파리의 두 얼굴 · ${this.step + 1}/${TALE.length}</small><span></span>${ok ? '' : `<em>${s.mode === 'night' ? '🌙 밤 습격에서' : '☀️ 낮에'} 풀 수 있다 · 🧚 메뉴에서 바꾸기</em>`}`;
    this.el.querySelector('span')!.textContent = s.line;
    // 거리의 할 일 한 줄 바로 아래에 붙는다
    const q = document.querySelector('.questline.on') as HTMLElement | null;
    const top = q ? q.getBoundingClientRect().bottom + 8 : null;
    this.el.style.top = top ? `${Math.round(top)}px` : '';
  }
}
