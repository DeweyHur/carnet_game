// 화면 위의 것들: 머리 옆 기력 바퀴, "E 들어가기" 같은 행동 안내, 터치 버튼, 조작 안내.
import type { Body } from './body';
import type { Input } from './input';

const RING = 2 * Math.PI * 17;

export class HeroHud {
  /** 점프 단추 글자를 바꿔 둔다(헬기에서 '뛰어내리기') */
  jumpLabel: string | null = null;
  private readonly wheel: HTMLElement;
  private readonly fill: SVGCircleElement;
  private readonly cap: SVGCircleElement;
  private readonly prompt: HTMLButtonElement;
  private readonly pad: HTMLElement;
  private readonly dropBtn: HTMLButtonElement;
  private readonly prompt2: HTMLButtonElement;
  onPrompt2?: () => void;
  private fullT = 0;
  private lastPrompt = '';
  private sx = 0; private sy = 0; private sOk = false;
  onPrompt?: () => void;

  private readonly input: Input;

  constructor(input: Input, onMap: () => void) {
    this.input = input;
    this.wheel = document.createElement('div');
    this.wheel.className = 'hwheel';
    this.wheel.innerHTML = `<svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="17"/><circle class="cap" cx="22" cy="22" r="17"/><circle class="fg" cx="22" cy="22" r="17"/></svg>`;
    this.fill = this.wheel.querySelector('.fg')!;
    this.cap = this.wheel.querySelector('.cap')!;
    this.fill.style.strokeDasharray = `${RING}`;
    this.cap.style.strokeDasharray = `${RING}`;
    document.body.appendChild(this.wheel);

    this.prompt = document.createElement('button');
    this.prompt.className = 'hprompt';
    this.prompt.addEventListener('click', (e) => { e.stopPropagation(); this.onPrompt?.(); });
    document.body.appendChild(this.prompt);
    this.prompt2 = document.createElement('button');
    this.prompt2.className = 'hprompt second';
    this.prompt2.addEventListener('click', (e) => { e.stopPropagation(); this.onPrompt2?.(); });
    document.body.appendChild(this.prompt2);

    this.pad = document.createElement('div');
    this.pad.className = 'hpad';
    // 원신(모바일)처럼 오른쪽 아래: 점프(맨 오른쪽 아래) · 달리기(그 위, 톡 = 구르기) · 놓기(벽에 붙었을 때만, 공격 자리).
    // 공격·스킬·폭발은 싸움(Combat)이, 상승은 Ascend가 같은 무리에 붙인다. 몸짓·사진은 🧚 메뉴에.
    this.pad.innerHTML = `<button class="drop" type="button">놓기</button><button class="run" type="button"><b>달리기</b></button><button class="jump" type="button">점프</button>`;
    const btn = (c: string) => this.pad.querySelector(`.${c}`) as HTMLButtonElement;
    const tap = (b: HTMLButtonElement, f: () => void) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); f(); });
    tap(btn('jump'), () => input.press('jump'));
    void onMap;
    this.dropBtn = btn('drop');
    tap(this.dropBtn, () => input.press('drop'));
    const run = btn('run');
    let downAt = 0;
    run.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); run.setPointerCapture(e.pointerId); downAt = performance.now(); input.hold(true); run.classList.add('held'); });
    const release = () => {
      input.hold(false); run.classList.remove('held');
      if (performance.now() - downAt < 230) input.press('roll'); // 톡 치면 구르기(피하기)
    };
    run.addEventListener('pointerup', release);
    run.addEventListener('pointercancel', () => { input.hold(false); run.classList.remove('held'); });
    document.body.appendChild(this.pad);
    input.onTouchMode = () => document.body.classList.add('touch-play');
  }

  /** 레이어가 그린 머리 위치(화면 좌표) */
  anchor(x: number, y: number, ok: boolean) { this.sx = x; this.sy = y; this.sOk = ok; }

  show(on: boolean) { document.body.classList.toggle('hero-on', on); }

  update(b: Body, dt: number) {
    const frac = b.stamina;
    const tired = b.maxStamina < 0.999;
    const full = frac >= b.maxStamina - 1e-3 && !b.exhausted;
    this.fullT = full ? this.fullT + dt : 0;
    const visible = this.sOk && this.fullT < 1.1;
    this.wheel.classList.toggle('on', visible);
    this.wheel.classList.toggle('ex', b.exhausted);
    this.wheel.classList.toggle('low', !b.exhausted && frac < 0.3);
    if (this.sOk) this.wheel.style.transform = `translate(${Math.round(this.sx + 34)}px, ${Math.round(this.sy - 22)}px)`;
    this.fill.style.strokeDashoffset = `${RING * (1 - frac)}`;
    this.cap.style.strokeDashoffset = `${RING * (1 - b.maxStamina)}`;
    this.cap.style.opacity = tired ? '1' : '0';
    this.dropBtn.hidden = b.mode !== 'climb';
    this.pad.querySelector('.jump')!.textContent = this.jumpLabel ?? (b.freefall ? '낙하산' : b.mode === 'air' ? '글라이더' : b.mode === 'glide' ? '접기' : b.mode === 'climb' ? '도약' : b.mode === 'sit' ? '일어서기' : '점프');
  }

  private lastPrompt2 = '';
  /** 두 번째 행동(R) 안내 */
  setPrompt2(p: { verb: string } | null) {
    if (!p) { this.prompt2.classList.remove('on'); this.lastPrompt2 = ''; return; }
    const key = this.input.touched ? '👆' : this.input.usingPad ? 'R' : 'R';
    const sig = `${key}|${p.verb}`;
    if (sig === this.lastPrompt2) return;
    this.lastPrompt2 = sig;
    this.prompt2.innerHTML = `<kbd></kbd><span class="v"></span>`;
    this.prompt2.querySelector('kbd')!.textContent = key;
    this.prompt2.querySelector('.v')!.textContent = p.verb;
    this.prompt2.classList.add('on');
  }

  /** 행동 안내. null이면 숨긴다. */
  /** 이것이 있으면 거리의 안내 대신 보인다(보물상자·성상 등) */
  override: { verb: string; what: string } | null = null;
  setPrompt(p: { verb: string; what: string } | null) {
    if (this.override) p = this.override;
    if (!p) { this.prompt.classList.remove('on'); this.lastPrompt = ''; return; }
    const key = this.input.touched ? '👆' : this.input.usingPad ? 'A' : 'F';
    const sig = `${key}|${p.verb}|${p.what}`;
    if (sig === this.lastPrompt) return;
    this.lastPrompt = sig;
    this.prompt.innerHTML = `<kbd></kbd><span class="v"></span><span class="w"></span>`;
    this.prompt.querySelector('kbd')!.textContent = key;
    this.prompt.querySelector('.v')!.textContent = p.verb;
    this.prompt.querySelector('.w')!.textContent = p.what;
    this.prompt.classList.add('on');
  }

  /** 움직이기 시작했다(예전엔 조작 안내를 거뒀다 — 이제 안내는 🧚 메뉴에) */
  moved() { /* 없음 */ }
}
