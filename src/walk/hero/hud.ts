// 화면 위의 것들: 머리 옆 기력 바퀴, "E 들어가기" 같은 행동 안내, 터치 버튼, 조작 안내.
import type { Body } from './body';
import type { Emote, Input } from './input';

const RING = 2 * Math.PI * 17;

export class HeroHud {
  /** 점프 단추 글자를 바꿔 둔다(헬기에서 '뛰어내리기') */
  jumpLabel: string | null = null;
  private readonly wheel: HTMLElement;
  private readonly fill: SVGCircleElement;
  private readonly cap: SVGCircleElement;
  private readonly prompt: HTMLButtonElement;
  private readonly pad: HTMLElement;
  private readonly help: HTMLElement;
  private readonly dropBtn: HTMLButtonElement;
  private crouchBtn!: HTMLButtonElement;
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
    // 원신처럼: 오른쪽 아래 큰 점프 하나 + 달리기(누르고 있기)/구르기(톡) 하나. 놓기는 벽에 붙었을 때만.
    // 몸짓·웅크리기는 😊 안에. 지도는 위쪽 HUD에.
    this.pad.innerHTML = `<div class="emotes"><button class="emo" data-e="wave" type="button">👋<small>인사</small></button><button class="emo" data-e="photo" type="button">📷<small>사진</small></button><button class="emo" data-e="sit" type="button">🪑<small>앉기</small></button><button class="emo" data-e="dance" type="button">💃<small>춤</small></button><button class="emo" data-e="crouch" type="button">🐾<small>살금</small></button></div>`
      + `<button class="face" type="button">😊</button><button class="drop" type="button">놓기</button><button class="run" type="button"><b>달리기</b><small>톡 = 구르기</small></button><button class="jump" type="button">점프</button>`;
    const btn = (c: string) => this.pad.querySelector(`.${c}`) as HTMLButtonElement;
    const tap = (b: HTMLButtonElement, f: () => void) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); f(); });
    tap(btn('jump'), () => input.press('jump'));
    const emotes = this.pad.querySelector('.emotes') as HTMLElement;
    tap(btn('face'), () => emotes.classList.toggle('on'));
    for (const b of this.pad.querySelectorAll<HTMLButtonElement>('.emo')) tap(b, () => { const e = b.dataset.e!; if (e === 'crouch') input.press('crouch'); else input.press(e as Emote); emotes.classList.remove('on'); });
    this.crouchBtn = this.pad.querySelector('.emo[data-e="crouch"]') as HTMLButtonElement;
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

    this.help = document.createElement('div');
    this.help.className = 'hhelp';
    this.help.innerHTML = `<b>걷기</b> WASD · <b>시점</b> 마우스 끌기/←→ · <b>달리기</b> Shift · <b>점프·글라이더</b> Space · <b>벽</b> 밀고 가면 오른다(X 놓기) · <b>웅크리기</b> C (달리다 누르면 슬라이딩) · <b>구르기</b> V (착지 직전 = 낙법) · <b>행동</b> E · <b>살펴보기</b> R · <b>몸짓</b> 1 인사 2 춤 3 사진 4 앉기 · <b>시점 정렬</b> Q · <b>지도</b> M`;
    document.body.appendChild(this.help);
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
    this.crouchBtn.classList.toggle('held', b.crouch);
    this.pad.classList.toggle('crouched', b.crouch);
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
  setPrompt(p: { verb: string; what: string } | null) {
    if (!p) { this.prompt.classList.remove('on'); this.lastPrompt = ''; return; }
    const key = this.input.touched ? '👆' : this.input.usingPad ? 'A' : 'E';
    const sig = `${key}|${p.verb}|${p.what}`;
    if (sig === this.lastPrompt) return;
    this.lastPrompt = sig;
    this.prompt.innerHTML = `<kbd></kbd><span class="v"></span><span class="w"></span>`;
    this.prompt.querySelector('kbd')!.textContent = key;
    this.prompt.querySelector('.v')!.textContent = p.verb;
    this.prompt.querySelector('.w')!.textContent = p.what;
    this.prompt.classList.add('on');
  }

  /** 처음 몇 걸음 동안만 조작 안내를 띄운다 */
  moved() { if (!this.help.classList.contains('seen')) setTimeout(() => this.help.classList.add('seen'), 9000); this.help.dataset.moved = '1'; }
}
