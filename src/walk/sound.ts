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

// ───────── 거리에서: 인사·동전·물·개·부딪힘·문·앉기·구르기 ─────────
export const bonjour = () => { tone(587, 0, 0.14, 0.05, 'triangle'); tone(784, 0.12, 0.22, 0.05, 'triangle'); };
export const coin = () => { tone(1976, 0, 0.12, 0.05, 'square'); tone(2637, 0.06, 0.25, 0.04, 'triangle'); };
export const drink = () => { for (let i = 0; i < 4; i++) setTimeout(() => hiss(0.16, 0.35, 600 + i * 120, 300, 'lowpass'), i * 260); };
export const feed = () => { for (let i = 0; i < 3; i++) setTimeout(() => hiss(0.08, 0.2, 3000, 1500), i * 90); };
export const bark = () => { tone(420, 0, 0.08, 0.08, 'sawtooth'); tone(330, 0.09, 0.1, 0.07, 'sawtooth'); };
export const bump = () => { tone(90, 0, 0.12, 0.14, 'triangle'); hiss(0.1, 0.25, 1200, 400); };
export const door = () => { tone(180, 0, 0.3, 0.05, 'sawtooth'); tone(1568, 0.25, 0.4, 0.03); tone(2093, 0.32, 0.5, 0.025); };
export const sit = () => { tone(110, 0, 0.12, 0.08, 'triangle'); hiss(0.12, 0.15, 800, 300); };
export const roll = () => { hiss(0.35, 0.45, 400, 1400); tone(95, 0.3, 0.1, 0.1, 'triangle'); };
export const slide = () => hiss(0.55, 0.5, 2400, 500);
export const crouch = () => hiss(0.1, 0.18, 1400, 700);
export const vault = () => { hiss(0.2, 0.35, 700, 1800); tone(150, 0.12, 0.08, 0.08, 'triangle'); };

// ───────── 아코디언 왈츠(거리 악사 근처에서만) ─────────
// 오른손 선율 + 왼손 쿵짝짝. 가까울수록 크게.
const MELODY = [76, 79, 84, 83, 81, 79, 77, 76, 74, 76, 77, 79, 76, 74, 72, 0, 76, 79, 84, 86, 84, 83, 81, 79, 77, 79, 81, 83, 84, 0, 84, 0];
const BASS = [48, 43, 45, 41];
let musicGain: GainNode | null = null;
let musicTimer = 0;
let musicStep = 0;
let musicLevel = 0;
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
function reed(freq: number, at: number, dur: number, gain: number) {
  if (!ctx || !musicGain) return;
  const t = ctx.currentTime + at;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.03);
  g.gain.setValueAtTime(gain, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  for (const det of [-6, 7]) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = det;
    o.connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  lp.connect(g).connect(musicGain);
}
/** level 0..1 — 0이면 멈춘다 */
export function music(level: number) {
  musicLevel = level;
  if (!ctx) return;
  if (!musicGain) { musicGain = ctx.createGain(); musicGain.gain.value = 0; musicGain.connect(ctx.destination); }
  musicGain.gain.setTargetAtTime(level * 0.09, ctx.currentTime, 0.4);
  if (level > 0 && !musicTimer) {
    const beat = 0.24;
    musicTimer = window.setInterval(() => {
      if (musicLevel <= 0.01) { clearInterval(musicTimer); musicTimer = 0; return; }
      const i = musicStep++;
      const m = MELODY[i % MELODY.length];
      if (m) reed(midi(m), 0, beat * 0.95, 0.5);
      if (i % 3 === 0) reed(midi(BASS[Math.floor(i / 6) % BASS.length]), 0, beat * 0.9, 0.45);
      else { const r = BASS[Math.floor(i / 6) % BASS.length] + 12; reed(midi(r + 4), 0, beat * 0.6, 0.18); reed(midi(r + 7), 0, beat * 0.6, 0.18); }
    }, beat * 1000);
  }
}

// ───────── 지하철·버스 ─────────
/** 문 닫힘 경고음(삐-) */
export const doorBeep = () => { tone(1175, 0, 0.9, 0.045, 'square'); };
/** 문 열림 */
export const doorOpen = () => { hiss(0.5, 0.35, 2000, 600); tone(220, 0, 0.1, 0.05, 'triangle'); };
/** 안내 방송 앞 차임 */
export const chime = () => { tone(659, 0, 0.35, 0.05); tone(831, 0.22, 0.35, 0.05); tone(988, 0.44, 0.6, 0.05); };
/** 개찰구 */
export const validate = () => { tone(1760, 0, 0.08, 0.05, 'square'); tone(2349, 0.09, 0.12, 0.045, 'square'); };
export const turnstile = () => { tone(140, 0, 0.1, 0.1, 'triangle'); hiss(0.2, 0.25, 900, 300); };
let rumbleGain: GainNode | null = null;
/** 달리는 소리(0..1) */
export function rumble(level: number) {
  if (!ctx) return;
  if (!rumbleGain) {
    const src = ctx.createBufferSource();
    src.buffer = noise(3);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    src.connect(lp).connect(rumbleGain).connect(ctx.destination);
    src.start();
  }
  rumbleGain.gain.setTargetAtTime(level * 0.9, ctx.currentTime, 0.25);
}
