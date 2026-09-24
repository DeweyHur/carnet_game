// 에셋 없는 WebAudio: 거리 소음, 발소리, 발견음.
let ctx: AudioContext | null = null;
let ambience: GainNode | null = null;

export function unlock() {
  if (ctx) return;
  try { ctx = new AudioContext(); } catch { ctx = null; }
}

function noise(seconds: number): AudioBuffer {
  const buf = ctx!.createBuffer(1, ctx!.sampleRate * seconds, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return buf;
}

/** 지하(먹먹함) → 지상(트임)으로 올라오는 소리 */
export function surface() {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noise(4);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 180;
  lp.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 3);
  ambience = ctx.createGain();
  ambience.gain.value = 0.5;
  ambience.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 3.2);
  src.connect(lp).connect(ambience).connect(ctx.destination);
  src.start();
}

function tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine') {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + at);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + at);
  o.stop(ctx.currentTime + at + dur + 0.05);
}

export const step = (left: boolean) => tone(left ? 92 : 78, 0, 0.07, 0.10, 'triangle');
export const stair = (i: number) => tone(70 + i * 4, i * 0.42, 0.12, 0.22, 'triangle');
export const spot = () => { tone(880, 0, 0.12, 0.05); tone(1175, 0.07, 0.16, 0.05); };
export const spotBig = () => { tone(659, 0, 0.25, 0.07); tone(831, 0.09, 0.25, 0.07); tone(988, 0.18, 0.4, 0.07); };
export const enter = () => { tone(523, 0, 0.18, 0.07); tone(784, 0.1, 0.3, 0.07); };
export const heart = () => tone(1318, 0, 0.2, 0.06);

/** 건물 안으로 들어가면 거리 소음이 멀어진다 */
export function inside(on: boolean) {
  if (!ctx || !ambience) return;
  ambience.gain.cancelScheduledValues(ctx.currentTime);
  ambience.gain.linearRampToValueAtTime(on ? 0.035 : 0.16, ctx.currentTime + 0.8);
}
export const pageTurn = () => tone(240, 0, 0.09, 0.05, 'triangle');
export const tick = () => tone(1500, 0, 0.04, 0.04, 'square');
export const shutter = () => { tone(2200, 0, 0.03, 0.09, 'square'); tone(900, 0.05, 0.05, 0.08, 'square'); };
export const served = () => { tone(1568, 0, 0.5, 0.05); tone(2093, 0.12, 0.7, 0.04); };

// ───────── 직접 걸을 때: 점프·착지·활공·벽타기·물 ─────────
/** 걸러 낸 잡음 한 줌(바람·물·옷자락) */
function hiss(dur: number, gain: number, from: number, to: number, type: BiquadFilterType = 'bandpass') {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noise(Math.max(0.1, dur));
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = 0.9;
  f.frequency.setValueAtTime(from, ctx.currentTime);
  f.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + Math.min(0.04, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + dur + 0.05);
}
export const jump = () => { hiss(0.18, 0.5, 700, 1800); tone(180, 0, 0.08, 0.05, 'triangle'); };
export const land = () => { tone(70, 0, 0.12, 0.16, 'triangle'); hiss(0.12, 0.35, 900, 300); };
export const hurt = () => { tone(55, 0, 0.3, 0.25, 'triangle'); tone(220, 0.05, 0.18, 0.06, 'sawtooth'); };
export const glide = () => { hiss(0.35, 0.8, 300, 2400); tone(392, 0.05, 0.15, 0.04); tone(587, 0.12, 0.2, 0.04); };
export const unglide = () => hiss(0.2, 0.5, 1800, 400);
export const grab = () => { tone(140, 0, 0.06, 0.1, 'square'); hiss(0.08, 0.3, 2000, 900); };
export const climbStep = () => hiss(0.07, 0.18, 1600, 700);
export const climbJump = () => { hiss(0.22, 0.5, 600, 2000); tone(260, 0, 0.1, 0.05, 'triangle'); };
export const mantle = () => { hiss(0.25, 0.3, 500, 1500); tone(120, 0.18, 0.08, 0.1, 'triangle'); };
export const splash = () => hiss(0.6, 1.1, 2500, 300, 'lowpass');
export const stroke = () => hiss(0.3, 0.35, 1200, 400, 'lowpass');
export const exhausted = () => { for (let i = 0; i < 3; i++) setTimeout(() => hiss(0.28, 0.28, 900, 500), i * 420); };
export const recovered = () => { tone(784, 0, 0.12, 0.04); tone(1046, 0.08, 0.2, 0.04); };
export const staminaTick = () => tone(1760, 0, 0.05, 0.025, 'square');
