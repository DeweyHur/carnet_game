// 손. 키보드(WASD) · 마우스 끌기 · 게임패드 · 터치 조이스틱을 한 가지 의도로 모은다.
// 게임패드는 스위치 배치: 아래=달리기(B) · 오른쪽=상호작용(A) · 위=점프(X) · 왼쪽=놓기(Y) · -=지도 · ZL=시점 정렬.
// L=구르기 · R=두 번째 행동(살펴보기) · 오른쪽 스틱 누르기=웅크리기 · 십자 ←=인사 · 십자 →=춤 · ZR=사진 · +=앉기.

export interface Frame {
  mx: number; my: number; // 카메라 기준: x 오른쪽, y 앞(크기 0..1)
  camYaw: number; camPitch: number; zoom: number; // 이번 프레임의 카메라 돌림(도)과 거리 배율
  sprint: boolean;
  jump: boolean; drop: boolean; interact: boolean; recenter: boolean; map: boolean;
  crouch: boolean; roll: boolean; secondary: boolean;
  emote: Emote | null; // 이번 프레임에 누른 몸짓
  pad: boolean; // 게임패드를 쓰는 중
}

export type Emote = 'wave' | 'dance' | 'photo' | 'sit';
type Edge = 'jump' | 'drop' | 'interact' | 'recenter' | 'map' | 'crouch' | 'roll' | 'secondary' | Emote;
const EMOTE_KEYS: Record<string, Emote> = { Digit1: 'wave', Digit2: 'dance', Digit3: 'photo', Digit4: 'sit' };

const MOVE_KEYS: Record<string, [number, number]> = { KeyW: [0, 1], KeyS: [0, -1], KeyA: [-1, 0], KeyD: [1, 0] };
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'KeyR', 'KeyX', 'KeyC', 'KeyV', 'KeyQ', 'KeyM', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export class Input {
  enabled = false;
  allowMapKey = false; // 지도 보기 중에도 M으로 닫을 수 있게
  private keys = new Set<string>();
  private edges = new Set<Edge>();
  private held = new Set<'sprint'>();
  private dragYaw = 0; private dragPitch = 0; private zoomAcc = 0;
  private drag: { id: number; x: number; y: number } | null = null;
  private stick: { id: number; x0: number; y0: number; x: number; y: number } | null = null;
  private padPrev: boolean[] = [];
  usingPad = false;
  touched = false;
  onTouchMode?: () => void;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;

  constructor(surface: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'hstick';
    this.knob = document.createElement('i');
    this.base.appendChild(this.knob);
    document.body.appendChild(this.base);

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey) return;
      if (!this.enabled && !(this.allowMapKey && e.code === 'KeyM')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault(); // 스페이스가 포커스된 버튼을 누르지 않게
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') this.edges.add('jump');
      if (e.code === 'KeyE' || e.code === 'KeyF') this.edges.add('interact');
      if (e.code === 'KeyX') this.edges.add('drop');
      if (e.code === 'KeyC') this.edges.add('crouch');
      if (e.code === 'KeyV') this.edges.add('roll');
      if (e.code === 'KeyR') this.edges.add('secondary');
      if (EMOTE_KEYS[e.code]) this.edges.add(EMOTE_KEYS[e.code]);
      if (e.code === 'KeyQ') this.edges.add('recenter');
      if (e.code === 'KeyM') this.edges.add('map');
      this.usingPad = false;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.held.clear(); this.drag = null; this.endStick(); });

    surface.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'touch') {
        if (!this.touched) { this.touched = true; this.onTouchMode?.(); }
        const r = surface.getBoundingClientRect();
        if (!this.stick && e.clientX - r.left < r.width * 0.45 && e.clientY - r.top > r.height * 0.3) {
          this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
          this.base.style.left = `${e.clientX}px`;
          this.base.style.top = `${e.clientY}px`;
          this.base.classList.add('on');
          this.knob.style.transform = '';
          return;
        }
      }
      if (!this.drag) this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointermove', (e) => {
      if (this.stick && e.pointerId === this.stick.id) {
        this.stick.x = e.clientX; this.stick.y = e.clientY;
        const [dx, dy] = this.stickVec();
        this.knob.style.transform = `translate(${dx * 46}px, ${-dy * 46}px)`;
        return;
      }
      if (!this.drag || e.pointerId !== this.drag.id) return;
      const k = e.pointerType === 'touch' ? 0.32 : 0.24;
      this.dragYaw += (e.clientX - this.drag.x) * k;
      this.dragPitch += (e.clientY - this.drag.y) * k * 0.8;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
    });
    const up = (e: PointerEvent) => {
      if (this.stick && e.pointerId === this.stick.id) this.endStick();
      if (this.drag && e.pointerId === this.drag.id) this.drag = null;
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    surface.addEventListener('wheel', (e) => { if (this.enabled) { e.preventDefault(); this.zoomAcc += e.deltaY; } }, { passive: false });
    surface.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
  }

  private endStick() {
    this.stick = null;
    this.base.classList.remove('on');
  }

  private stickVec(): [number, number] {
    if (!this.stick) return [0, 0];
    let dx = (this.stick.x - this.stick.x0) / 46, dy = -(this.stick.y - this.stick.y0) / 46;
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }
    return [dx, dy];
  }

  /** 화면 버튼(터치)에서 */
  press(e: Edge) { this.edges.add(e); }
  hold(on: boolean) { if (on) this.held.add('sprint'); else this.held.delete('sprint'); }
  get dragging() { return !!this.drag; }

  read(dt: number): Frame {
    let mx = 0, my = 0;
    for (const [k, [x, y]] of Object.entries(MOVE_KEYS)) if (this.keys.has(k)) { mx += x; my += y; }
    const km = Math.hypot(mx, my);
    if (km > 0) { mx /= km; my /= km; }
    if (this.stick) { const [sx, sy] = this.stickVec(); mx = sx; my = sy; }
    let camYaw = this.dragYaw, camPitch = this.dragPitch;
    if (this.keys.has('ArrowLeft')) camYaw -= 110 * dt;
    if (this.keys.has('ArrowRight')) camYaw += 110 * dt;
    if (this.keys.has('ArrowUp')) camPitch -= 70 * dt;
    if (this.keys.has('ArrowDown')) camPitch += 70 * dt;
    let zoom = this.zoomAcc;
    this.dragYaw = this.dragPitch = this.zoomAcc = 0;
    let sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.held.has('sprint');

    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p && p.connected);
    if (gp) {
      const dz = (v: number) => (Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84);
      const lx = dz(gp.axes[0] ?? 0), ly = -dz(gp.axes[1] ?? 0);
      const rx = dz(gp.axes[2] ?? 0), ry = dz(gp.axes[3] ?? 0);
      if (lx || ly) { mx = lx; my = ly; this.usingPad = true; }
      if (rx || ry) { camYaw += rx * 170 * dt; camPitch += ry * 110 * dt; this.usingPad = true; }
      const b = gp.buttons.map((x) => x.pressed);
      const edge = (i: number) => b[i] && !this.padPrev[i];
      if (b[0]) sprint = true;
      if (edge(1)) this.edges.add('interact');
      if (edge(3)) this.edges.add('jump');
      if (edge(2)) this.edges.add('drop');
      if (edge(6) || edge(10)) this.edges.add('recenter');
      if (edge(8)) this.edges.add('map');
      if (edge(4)) this.edges.add('roll');
      if (edge(5)) this.edges.add('secondary');
      if (edge(11)) this.edges.add('crouch');
      if (edge(14)) this.edges.add('wave');
      if (edge(15)) this.edges.add('dance');
      if (edge(7)) this.edges.add('photo');
      if (edge(9)) this.edges.add('sit');
      if (b[12]) zoom -= 400 * dt;
      if (b[13]) zoom += 400 * dt;
      if (b.some(Boolean)) this.usingPad = true;
      this.padPrev = b;
    }
    const f: Frame = {
      mx, my, camYaw, camPitch, zoom, sprint,
      jump: this.edges.has('jump'), drop: this.edges.has('drop'), interact: this.edges.has('interact'), recenter: this.edges.has('recenter'), map: this.edges.has('map'),
      crouch: this.edges.has('crouch'), roll: this.edges.has('roll'), secondary: this.edges.has('secondary'),
      emote: (['wave', 'dance', 'photo', 'sit'] as Emote[]).find((k) => this.edges.has(k)) ?? null,
      pad: this.usingPad,
    };
    this.edges.clear();
    if (!this.enabled) { f.mx = f.my = 0; f.jump = f.drop = f.interact = f.recenter = f.crouch = f.roll = f.secondary = false; f.emote = null; f.sprint = false; f.camYaw = f.camPitch = f.zoom = 0; }
    return f;
  }

  /** 모달이 열려 있는 동안 눌린 키가 풀리지 않은 채 남지 않게 */
  reset() { this.keys.clear(); this.held.clear(); this.edges.clear(); this.drag = null; this.endStick(); }
}
