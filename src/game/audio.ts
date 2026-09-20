// ─── 사운드 엔진 ────────────────────────────────────────────────────────────
// 에셋 파일 없이 WebAudio로 만드는 8비트풍 효과음.
// 대사 한 글자마다 짧은 스퀘어파 "블립"을 울려 목소리처럼 들리게 한다.

export type VoiceId = 'margot' | 'L' | 'theo' | 'echo' | 'narrator' | 'player' | 'guide' | 'system';

interface Voice {
  /** 기본 주파수(Hz) */
  freq: number;
  wave: OscillatorType;
  /** 글자마다 흔들리는 폭(반음 단위 근사) */
  jitter: number;
  gain: number;
  /** 한 블립 길이(초) */
  dur: number;
}

/** 캐릭터마다 다른 목소리. 낮을수록 굵고, jitter가 클수록 수다스럽게 들린다. */
export const VOICES: Record<VoiceId, Voice> = {
  margot:   { freq: 330, wave: 'square',   jitter: 28, gain: 0.05,  dur: 0.035 },
  guide:    { freq: 300, wave: 'square',   jitter: 22, gain: 0.045, dur: 0.035 },
  theo:     { freq: 415, wave: 'square',   jitter: 34, gain: 0.042, dur: 0.030 },
  L:        { freq: 200, wave: 'triangle', jitter: 14, gain: 0.07,  dur: 0.055 },
  echo:     { freq: 262, wave: 'sine',     jitter: 18, gain: 0.07,  dur: 0.050 },
  player:   { freq: 360, wave: 'square',   jitter: 20, gain: 0.04,  dur: 0.032 },
  narrator: { freq: 176, wave: 'triangle', jitter: 10, gain: 0.05,  dur: 0.045 },
  system:   { freq: 520, wave: 'square',   jitter: 0,  gain: 0.05,  dur: 0.040 },
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  // 브라우저 자동재생 정책: 사용자가 처음 클릭한 뒤에 깨어난다.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (on) ac();
}

/** 첫 사용자 제스처에서 호출해 오디오 컨텍스트를 깨운다. */
export function primeAudio() { if (enabled) ac(); }

function tone(freq: number, dur: number, wave: OscillatorType, gain: number, delay = 0) {
  if (!enabled) return;
  const c = ac();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(freq, t0);
  // 클릭 노이즈를 없애는 짧은 어택/릴리즈 엔벌로프
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** 대사 한 글자의 블립. i는 글자 인덱스(음높이를 조금씩 흔든다). */
export function blip(voice: VoiceId, i: number) {
  const v = VOICES[voice] ?? VOICES.narrator;
  // 결정적인 유사난수 — 같은 문장은 항상 같은 억양으로 읽힌다.
  const r = Math.sin(i * 12.9898) * 43758.5453;
  const wob = (r - Math.floor(r)) * 2 - 1;
  tone(v.freq + wob * v.jitter, v.dur, v.wave, v.gain);
}

/** UI 효과음 모음 */
export const sfx = {
  /** 대사 한 칸 넘기기 */
  advance: () => tone(660, 0.05, 'square', 0.04),
  /** 수첩 페이지 넘기기 */
  page: () => { tone(420, 0.05, 'triangle', 0.05); tone(560, 0.06, 'triangle', 0.04, 0.05); },
  /** 사실 카드 획득 */
  card: () => { tone(523, 0.07, 'square', 0.045); tone(784, 0.1, 'square', 0.04, 0.07); },
  /** 정답 */
  correct: () => { tone(659, 0.07, 'square', 0.05); tone(880, 0.12, 'square', 0.045, 0.07); },
  /** 오답 */
  wrong: () => { tone(200, 0.16, 'square', 0.05); },
  /** 여권 스탬프 */
  stamp: () => { tone(110, 0.12, 'square', 0.08); tone(70, 0.2, 'triangle', 0.07, 0.03); },
  /** 돈이 나갔다 */
  coin: () => { tone(988, 0.05, 'square', 0.04); tone(1319, 0.09, 'square', 0.035, 0.05); },
  /** 휴대폰 메시지 도착 */
  notify: () => { tone(1047, 0.06, 'square', 0.045); tone(1397, 0.07, 'square', 0.04, 0.06); tone(1047, 0.1, 'square', 0.035, 0.13); },
  /** 주머니에서 짧게 진동 */
  buzz: () => { tone(90, 0.09, 'square', 0.055); tone(90, 0.09, 'square', 0.05, 0.13); },
  /** 편지가 열렸다 */
  letter: () => { tone(392, 0.12, 'sine', 0.06); tone(523, 0.14, 'sine', 0.05, 0.1); tone(659, 0.2, 'sine', 0.045, 0.2); },
};
