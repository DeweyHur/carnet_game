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
