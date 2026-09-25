// 에셋 없는 WebAudio: 효과음 · 프랑스풍 배경 음악(아코디언 왈츠 · 집시 스윙 · 아침 첼레스타) · 거리 환경음 · 프랑스어 목소리.
// 모든 소리는 master(음소거·전체 크기) → 목적지로 간다. 잡음은 한 번 만든 버퍼를 잘라 쓴다(매번 만들면 걸음마다 CPU가 튄다).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let ambBus: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let ambience: GainNode | null = null;
let muted = (() => { try { return localStorage.getItem('carnet-walk-muted') === '1'; } catch { return false; } })();

export function unlock() {
  if (ctx) { void ctx.resume(); return; }
  try { ctx = new AudioContext(); } catch { ctx = null; return; }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
  musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 18000;
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicFilter.connect(musicBus).connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
  noiseBuf = makeNoise(3);
}

export const isMuted = () => muted;
export function setMuted(on: boolean) {
  muted = on;
  try { localStorage.setItem('carnet-walk-muted', on ? '1' : '0'); } catch { /* 무시 */ }
  if (ctx && master) master.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.05);
  if (on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

const out = () => sfxBus!;

function makeNoise(seconds: number): AudioBuffer {
  const buf = ctx!.createBuffer(1, ctx!.sampleRate * seconds, ctx!.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return buf;
}
/** 잡음 조각(버퍼 재사용, 시작점만 무작위) */
function noiseSrc(loop = false): AudioBufferSourceNode {
  const src = ctx!.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = loop;
  return src;
}

/** 지하(먹먹함) → 지상(트임)으로 올라오는 소리 */
export function surface() {
  if (!ctx) return;
  const src = noiseSrc(true);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 180;
  lp.frequency.linearRampToValueAtTime(1400, ctx.currentTime + 3);
  if (ambience) { try { ambience.disconnect(); } catch { /* 무시 */ } }
  ambience = ctx.createGain();
  ambience.gain.value = 0.5;
  ambience.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 3.2);
  src.connect(lp).connect(ambience).connect(ambBus!);
  src.start(0, Math.random() * 2);
}

function tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', dest?: AudioNode) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + at;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? out());
  o.start(t);
  o.stop(t + dur + 0.05);
}
/** 음높이가 미끄러지는 소리(새·비둘기·경적) */
function sweep(f0: number, f1: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', dest?: AudioNode) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  const t = ctx.currentTime + at;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest ?? out());
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** 걸러 낸 잡음 한 줌(바람·물·옷자락) */
function hiss(dur: number, gain: number, from: number, to: number, type: BiquadFilterType = 'bandpass', at = 0, dest?: AudioNode) {
  if (!ctx) return;
  const src = noiseSrc();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = 0.9;
  const t = ctx.currentTime + at;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.04, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dest ?? out());
  src.start(t, Math.random() * 2.5);
  src.stop(t + dur + 0.05);
}

// ───────── 걷기·UI ─────────
/** 발소리: 포석(기본) · 지붕 함석(roof) · 지하(tile) */
export const step = (left: boolean, surfaceKind: 'stone' | 'roof' | 'tile' = 'stone') => {
  if (surfaceKind === 'roof') { tone(left ? 380 : 340, 0, 0.05, 0.04, 'square'); hiss(0.05, 0.12, 3000, 1500); return; }
  if (surfaceKind === 'tile') { tone(left ? 150 : 130, 0, 0.05, 0.08, 'triangle'); hiss(0.06, 0.15, 2600, 1800); return; }
  tone(left ? 92 : 78, 0, 0.07, 0.1, 'triangle');
  hiss(0.05, 0.1, 1800, 700);
};
export const stair = (i: number) => tone(70 + i * 4, i * 0.42, 0.12, 0.22, 'triangle');
export const spot = () => { tone(880, 0, 0.12, 0.05); tone(1175, 0.07, 0.16, 0.05); };
export const spotBig = () => { tone(659, 0, 0.25, 0.07); tone(831, 0.09, 0.25, 0.07); tone(988, 0.18, 0.4, 0.07); };
/** 랜드마크 발견: 짧은 팡파르 */
export const fanfare = () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.11, 0.5, 0.06, 'triangle')); tone(1318, 0.46, 0.8, 0.05); };
export const enter = () => { tone(523, 0, 0.18, 0.07); tone(784, 0.1, 0.3, 0.07); };
export const heart = () => tone(1318, 0, 0.2, 0.06);
/** 대화 상자가 열린다 · 고른다 */
export const pop = () => { sweep(500, 900, 0, 0.09, 0.05, 'triangle'); };
export const select = () => tone(1046, 0, 0.08, 0.05, 'triangle');
/** 부탁을 받았다 · 끝냈다 */
export const questStart = () => { tone(587, 0, 0.15, 0.05, 'triangle'); tone(880, 0.12, 0.25, 0.05, 'triangle'); };
export const questDone = () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.35, 0.055, 'triangle')); };

/** 건물 안으로 들어가면 거리 소음이 멀어진다 */
export function inside(on: boolean) {
  if (!ctx || !ambBus) return;
  ambBus.gain.setTargetAtTime(on ? 0.2 : 1, ctx.currentTime, 0.3);
  if (musicFilter) musicFilter.frequency.setTargetAtTime(on ? 900 : 18000, ctx.currentTime, 0.3);
}
export const pageTurn = () => hiss(0.12, 0.25, 3000, 1500, 'highpass');
export const tick = () => tone(1500, 0, 0.04, 0.04, 'square');
export const shutter = () => { tone(2200, 0, 0.03, 0.09, 'square'); hiss(0.08, 0.3, 4000, 2000, 'highpass', 0.03); tone(900, 0.07, 0.05, 0.08, 'square'); };
export const served = () => { tone(1568, 0, 0.5, 0.05); tone(2093, 0.12, 0.7, 0.04); };

// ───────── 몸: 점프·착지·활공·벽타기·물 ─────────
export const jump = () => { hiss(0.18, 0.5, 700, 1800); tone(180, 0, 0.08, 0.05, 'triangle'); };
export const land = () => { tone(70, 0, 0.12, 0.16, 'triangle'); hiss(0.12, 0.35, 900, 300); };
export const hurt = () => { tone(55, 0, 0.3, 0.25, 'triangle'); tone(220, 0.05, 0.18, 0.06, 'sawtooth'); };
export const glide = () => { hiss(0.35, 0.8, 300, 2400); hiss(0.2, 0.4, 1200, 600, 'bandpass', 0.25); tone(392, 0.05, 0.15, 0.04); tone(587, 0.12, 0.2, 0.04); };
export const unglide = () => hiss(0.2, 0.5, 1800, 400);
export const grab = () => { tone(140, 0, 0.06, 0.1, 'square'); hiss(0.08, 0.3, 2000, 900); };
export const climbStep = () => hiss(0.07, 0.18, 1600, 700);
export const climbJump = () => { hiss(0.22, 0.5, 600, 2000); tone(260, 0, 0.1, 0.05, 'triangle'); };
export const mantle = () => { hiss(0.25, 0.3, 500, 1500); tone(120, 0.18, 0.08, 0.1, 'triangle'); };
export const splash = () => { hiss(0.6, 1.1, 2500, 300, 'lowpass'); for (let i = 0; i < 4; i++) sweep(900 + Math.random() * 900, 400, 0.1 + i * 0.07, 0.08, 0.03); };
export const stroke = () => hiss(0.3, 0.35, 1200, 400, 'lowpass');
export const exhausted = () => { for (let i = 0; i < 3; i++) hiss(0.28, 0.28, 900, 500, 'bandpass', i * 0.42); };
export const recovered = () => { tone(784, 0, 0.12, 0.04); tone(1046, 0.08, 0.2, 0.04); };
export const staminaTick = () => tone(1760, 0, 0.05, 0.025, 'square');

// ───────── 거리에서: 인사·동전·물·개·부딪힘·문·앉기·구르기 ─────────
export const bonjour = () => { tone(587, 0, 0.14, 0.04, 'triangle'); tone(784, 0.12, 0.22, 0.04, 'triangle'); };
export const coin = () => { tone(1976, 0, 0.12, 0.05, 'square'); tone(2637, 0.06, 0.25, 0.04, 'triangle'); tone(3136, 0.14, 0.3, 0.02); };
export const drink = () => { for (let i = 0; i < 4; i++) hiss(0.16, 0.35, 600 + i * 120, 300, 'lowpass', i * 0.26); };
export const feed = () => { for (let i = 0; i < 3; i++) hiss(0.08, 0.2, 3000, 1500, 'bandpass', i * 0.09); };
export const bark = () => { sweep(520, 380, 0, 0.09, 0.08, 'sawtooth'); sweep(480, 330, 0.13, 0.1, 0.07, 'sawtooth'); };
export const bump = () => { tone(90, 0, 0.12, 0.14, 'triangle'); hiss(0.1, 0.25, 1200, 400); };
export const door = () => { sweep(260, 170, 0, 0.35, 0.04, 'sawtooth'); tone(1568, 0.25, 0.4, 0.03); tone(2093, 0.32, 0.5, 0.025); };
export const sit = () => { tone(110, 0, 0.12, 0.08, 'triangle'); hiss(0.12, 0.15, 800, 300); };
export const roll = () => { hiss(0.35, 0.45, 400, 1400); tone(95, 0.3, 0.1, 0.1, 'triangle'); };
export const slide = () => hiss(0.55, 0.5, 2400, 500);
export const crouch = () => hiss(0.1, 0.18, 1400, 700);
export const vault = () => { hiss(0.2, 0.35, 700, 1800); tone(150, 0.12, 0.08, 0.08, 'triangle'); };
/** 박수 소리(구경꾼) */
export const applause = (n = 12) => { for (let i = 0; i < n; i++) hiss(0.05, 0.25 + Math.random() * 0.2, 2500, 1500, 'bandpass', Math.random() * 1.2); };
/** 비둘기 날아오르는 소리 */
export const flutter = () => { for (let i = 0; i < 8; i++) hiss(0.06, 0.25, 1400, 700, 'bandpass', i * 0.05 + Math.random() * 0.03); };
/** 낙하산이 펼쳐지는 소리 */
export const chute = () => { hiss(0.5, 0.9, 200, 1800, 'bandpass'); hiss(0.25, 0.6, 900, 300, 'lowpass', 0.4); };

// ───────── 지하철·버스 ─────────
export const doorBeep = () => { tone(1175, 0, 0.9, 0.045, 'square'); };
export const doorOpen = () => { hiss(0.5, 0.35, 2000, 600); tone(220, 0, 0.1, 0.05, 'triangle'); };
export const chime = () => { tone(659, 0, 0.35, 0.05); tone(831, 0.22, 0.35, 0.05); tone(988, 0.44, 0.6, 0.05); };
export const validate = () => { tone(1760, 0, 0.08, 0.05, 'square'); tone(2349, 0.09, 0.12, 0.045, 'square'); };
export const turnstile = () => { tone(140, 0, 0.1, 0.1, 'triangle'); hiss(0.2, 0.25, 900, 300); };
let rumbleGain: GainNode | null = null;
/** 달리는 소리(0..1) */
export function rumble(level: number) {
  if (!ctx) return;
  if (!rumbleGain) {
    const src = noiseSrc(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0;
    src.connect(lp).connect(rumbleGain).connect(ambBus!);
    src.start();
  }
  rumbleGain.gain.setTargetAtTime(level * 0.9, ctx.currentTime, 0.25);
}

// ───────── 바람(높이·활공) ─────────
let windGain: GainNode | null = null;
let windFilter: BiquadFilterNode | null = null;
/** 0..1 — 높을수록·빠를수록 크게 */
export function wind(level: number) {
  if (!ctx) return;
  if (!windGain) {
    const src = noiseSrc(true);
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.Q.value = 0.6;
    windFilter.frequency.value = 500;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    src.connect(windFilter).connect(windGain).connect(ambBus!);
    src.start();
  }
  const l = Math.max(0, Math.min(1, level));
  windGain.gain.setTargetAtTime(l * 0.55, ctx.currentTime, 0.4);
  windFilter!.frequency.setTargetAtTime(350 + l * 900 + Math.random() * 120, ctx.currentTime, 0.6);
}

// ───────── 열기구 버너(쉬익) · 여객기(낮게 우르릉) ─────────
export const burner = () => { if (!ctx) return; hiss(0.9, 0.12, 700, 900, 'bandpass'); };
let jetGain: GainNode | null = null;
export function jet(level: number) {
  if (!ctx) return;
  if (!jetGain) {
    const src = noiseSrc(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    const hp = ctx.createBiquadFilter();
    hp.type = 'bandpass'; hp.frequency.value = 2200; hp.Q.value = 0.8;
    const whine = ctx.createGain(); whine.gain.value = 0.12;
    jetGain = ctx.createGain(); jetGain.gain.value = 0;
    src.connect(lp).connect(jetGain);
    src.connect(hp).connect(whine).connect(jetGain);
    jetGain.connect(ambBus!);
    src.start();
  }
  jetGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.8, ctx.currentTime, 0.5);
}

// ───────── 헬기: 낮게 웅웅거리는 소리를 초당 11번 끊어 '두두두' ─────────
let heliGain: GainNode | null = null;
export function heli(level: number) {
  if (!ctx) return;
  if (!heliGain) {
    const src = noiseSrc(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const chop = ctx.createGain();
    chop.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 11;
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    lfo.connect(depth).connect(chop.gain);
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 62;
    const humG = ctx.createGain();
    humG.gain.value = 0.05;
    heliGain = ctx.createGain();
    heliGain.gain.value = 0;
    src.connect(lp).connect(chop).connect(heliGain);
    hum.connect(humG).connect(heliGain);
    heliGain.connect(sfxBus!);
    src.start(); lfo.start(); hum.start();
  }
  heliGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.9, ctx.currentTime, 0.3);
}

// ───────── 거리의 공기: 도시 웅성임 · 새 · 카페 수다 · 분수 · 비둘기 · 종소리 · 스쿠터 ─────────
export interface AmbState { night: number; hour: number; z: number; underground: boolean; terrace: number; fountain: number; flock: number; park: number; crowd: number }
let hum: GainNode | null = null;
let babble: GainNode | null = null;
let babbleF: BiquadFilterNode | null = null;
let water: GainNode | null = null;
let nextBird = 0, nextCoo = 0, nextTraffic = 0, lastBellHour = -1;
function loopNoise(filter: BiquadFilterType, freq: number, q = 0.7): [GainNode, BiquadFilterNode] {
  const src = noiseSrc(true);
  const f = ctx!.createBiquadFilter();
  f.type = filter; f.frequency.value = freq; f.Q.value = q;
  const g = ctx!.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(ambBus!);
  src.start(0, Math.random() * 2);
  return [g, f];
}
/** 0.25초마다 부른다 */
export function ambient(s: AmbState) {
  if (!ctx || !ambBus) return;
  const t = ctx.currentTime;
  if (!hum) { [hum] = loopNoise('lowpass', 380); [babble, babbleF] = loopNoise('bandpass', 900, 1.4); [water] = loopNoise('highpass', 2500); }
  const high = Math.min(1, Math.max(0, (s.z - 8) / 60));
  hum.gain.setTargetAtTime(s.underground ? 0.02 : (0.1 - s.night * 0.04) * (1 - high * 0.7) * (0.6 + s.crowd * 0.4), t, 0.5);
  // 카페 수다: 말소리처럼 들쭉날쭉
  babble!.gain.setTargetAtTime(s.terrace * (0.05 + Math.random() * 0.05), t, 0.08);
  babbleF!.frequency.setTargetAtTime(700 + Math.random() * 700, t, 0.1);
  water!.gain.setTargetAtTime(s.fountain * 0.07, t, 0.3);
  if (s.underground) return;
  const now = performance.now();
  // 새소리: 아침·공원에 많이
  const birdy = (s.hour < 12 ? 1 : 0.35) * (1 - s.night) * (0.4 + s.park) * (1 - high * 0.5);
  if (now > nextBird && birdy > 0.1) {
    nextBird = now + (1500 + Math.random() * 4000) / birdy;
    const f = 2600 + Math.random() * 1800;
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) sweep(f * (1 + Math.random() * 0.2), f * 0.75, i * 0.11, 0.08, 0.012 * birdy, 'sine', ambBus);
  }
  // 비둘기 구구
  if (s.flock > 0.1 && now > nextCoo) { nextCoo = now + 2500 + Math.random() * 4000; sweep(340, 280, 0, 0.35, 0.03 * s.flock, 'sine', ambBus); sweep(330, 270, 0.45, 0.4, 0.025 * s.flock, 'sine', ambBus); }
  // 멀리 지나가는 스쿠터·경적
  if (now > nextTraffic && high < 0.8) {
    nextTraffic = now + 9000 + Math.random() * 20000;
    if (Math.random() < 0.6) { sweep(95, 130, 0, 1.6, 0.025, 'sawtooth', ambBus); sweep(130, 85, 1.5, 1.4, 0.02, 'sawtooth', ambBus); }
    else { tone(440, 0, 0.25, 0.02, 'square', ambBus); tone(554, 0.28, 0.3, 0.02, 'square', ambBus); }
  }
  // 정각마다 성당 종
  const hr = Math.floor(s.hour);
  if (lastBellHour < 0) lastBellHour = hr;
  if (hr !== lastBellHour) { lastBellHour = hr; bells(Math.min(4, ((hr + 11) % 12) + 1)); }
}
function bells(n: number) {
  for (let i = 0; i < n; i++) for (const [m, g] of [[1, 0.05], [2.01, 0.025], [2.76, 0.02], [5.4, 0.008]] as const) tone(196 * m, i * 1.6, 3.2, g, 'sine', ambBus!);
}

// ───────── 배경 음악: 미리 짜 둔 곡을 박자에 맞춰 예약 재생 ─────────
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
type Chord = [number, 'm' | 'M' | '7' | 'm6'];
interface Tune { name: string; bpm: number; beats: number; steps: number; swing: number; lead: 'accordion' | 'clarinet' | 'celesta'; melody: number[]; chords: Chord[] }
// -1 = 앞 음을 잇는다, 0 = 쉼
const VALSE: Tune = {
  name: 'Valse de la rue', bpm: 168, beats: 3, steps: 2, swing: 0, lead: 'accordion',
  chords: [[57, 'm'], [57, 'm'], [52, '7'], [52, '7'], [52, '7'], [52, '7'], [57, 'm'], [57, 'm'], [50, 'm'], [50, 'm'], [57, 'm'], [57, 'm'], [52, '7'], [52, '7'], [57, 'm'], [57, 'm'],
    [48, 'M'], [48, 'M'], [55, '7'], [55, '7'], [55, '7'], [55, '7'], [48, 'M'], [48, 'M'], [53, 'M'], [53, 'M'], [48, 'M'], [57, '7'], [50, 'm'], [55, '7'], [48, 'M'], [52, '7']],
  melody: [
    76, -1, -1, -1, 72, 74, 76, -1, 79, -1, 76, -1, 75, -1, -1, -1, 71, 72, 74, -1, 76, -1, 74, -1,
    71, -1, -1, -1, 68, 69, 71, -1, 74, -1, 71, -1, 72, -1, -1, -1, 69, 71, 72, -1, 76, -1, 81, -1,
    81, -1, -1, -1, 77, 79, 81, -1, 77, -1, 74, -1, 76, -1, -1, -1, 72, 74, 76, -1, 72, -1, 69, -1,
    71, -1, -1, -1, 74, 76, 80, -1, 76, -1, 74, -1, 72, -1, 71, -1, 69, -1, 69, -1, -1, -1, 0, 0,
    79, -1, -1, -1, 76, 77, 79, -1, 84, -1, 79, -1, 77, -1, -1, -1, 74, 76, 77, -1, 83, -1, 77, -1,
    74, -1, -1, -1, 71, 72, 74, -1, 77, -1, 74, -1, 76, -1, -1, -1, 72, 74, 76, -1, 79, -1, 84, -1,
    84, -1, -1, -1, 81, 77, 81, -1, 77, -1, 72, -1, 76, -1, -1, -1, 79, 76, 73, -1, 76, -1, 79, -1,
    77, -1, -1, -1, 74, 77, 79, -1, 77, -1, 74, 71, 72, -1, -1, -1, -1, -1, 71, -1, 68, -1, 64, -1,
  ],
};
const SWING: Tune = {
  name: 'Swing de nuit', bpm: 132, beats: 4, steps: 2, swing: 0.62, lead: 'clarinet',
  chords: [[50, 'm6'], [50, 'm6'], [57, '7'], [57, '7'], [57, '7'], [57, '7'], [50, 'm6'], [50, 'm6'], [55, 'm6'], [55, 'm6'], [50, 'm6'], [50, 'm6'], [52, '7'], [57, '7'], [50, 'm6'], [57, '7']],
  melody: [
    74, -1, 77, -1, 81, -1, -1, -1, 80, 81, -1, 77, 74, -1, -1, -1, 76, -1, 79, -1, -1, -1, 73, -1, 76, -1, -1, -1, 0, 0, 0, 0,
    73, 76, 79, -1, 81, -1, 79, -1, 77, -1, 76, -1, 73, -1, -1, -1, 74, -1, -1, -1, 69, -1, 74, -1, 77, -1, -1, -1, 0, 0, 0, 0,
    79, -1, 82, -1, 86, -1, -1, -1, 84, -1, 82, -1, 79, -1, -1, -1, 81, -1, 77, -1, 74, -1, 77, -1, 81, -1, -1, -1, 0, 0, 0, 0,
    80, -1, 76, -1, 74, -1, 71, -1, 73, -1, 76, -1, 79, -1, 76, -1, 74, -1, -1, -1, -1, -1, 0, 0, 0, 0, 73, 74, 76, 77, 79, 80,
  ],
};
const MATIN: Tune = { ...VALSE, name: 'Matin', bpm: 132, lead: 'celesta' };

const CHORD: Record<Chord[1], number[]> = { m: [0, 3, 7], M: [0, 4, 7], '7': [0, 4, 7, 10], m6: [0, 3, 7, 9] };

function voice(kind: 'accordion' | 'clarinet' | 'celesta' | 'bass' | 'chord' | 'guitar', note: number, t: number, dur: number, gain: number) {
  if (!ctx || !musicFilter) return;
  const f = midi(note);
  const g = ctx.createGain();
  g.connect(musicFilter);
  const env = (a: number, rel: number) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + a); g.gain.setValueAtTime(gain, t + Math.max(a, dur - rel)); g.gain.linearRampToValueAtTime(0, t + dur); };
  const osc = (type: OscillatorType, freq: number, detune = 0, dest: AudioNode = g) => { const o = ctx!.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune; o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o; };
  switch (kind) {
    case 'accordion': {
      // 뮈제트: 세 리드를 살짝 어긋나게(떨리는 소리) + 부드럽게 거른다
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g);
      for (const d of [-9, 0, 11]) osc('sawtooth', f, d, lp);
      env(0.025, 0.05);
      break;
    }
    case 'clarinet': {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.connect(g);
      const o = osc('square', f, 0, lp);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = 9; lfo.connect(lg).connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.05);
      env(0.04, 0.08);
      break;
    }
    case 'celesta': {
      osc('sine', f); osc('sine', f * 4, 0).frequency.value = f * 4.01;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.4, dur * 2));
      break;
    }
    case 'bass': osc('triangle', f); env(0.01, 0.1); break;
    case 'chord': {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; lp.connect(g);
      for (const d of [-7, 8]) osc('sawtooth', f, d, lp);
      env(0.015, 0.04);
      break;
    }
    case 'guitar': {
      // 집시 기타 "퐁프": 짧게 뜯고 바로 막는다
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(g);
      osc('sawtooth', f, 0, lp);
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      break;
    }
  }
}

let tune: Tune | null = null;
let seqTimer = 0;
let nextT = 0;
let stepI = 0;
let musicLevel = 0.5;
let live = 0; // 거리 악사가 가까우면 1

function playStep(tu: Tune, i: number, t: number, dur: number) {
  const perBar = tu.beats * tu.steps;
  const bar = Math.floor(i / perBar) % tu.chords.length;
  const inBar = i % perBar;
  const [root, q] = tu.chords[bar];
  const tones = CHORD[q];
  const lead = 0.09 + live * 0.05;
  // 선율
  const idx = i % tu.melody.length;
  const m = tu.melody[idx];
  if (m > 0) {
    let len = 1;
    while (tu.melody[(idx + len) % tu.melody.length] === -1 && len < 8) len++;
    voice(live > 0.3 && tu.lead !== 'accordion' ? 'accordion' : tu.lead, m + (tu.lead === 'celesta' ? 12 : 0), t, dur * len * 0.95, tu.lead === 'celesta' ? lead * 0.8 : lead);
  }
  // 반주
  if (inBar % tu.steps !== 0) return;
  const beat = inBar / tu.steps;
  if (tu.beats === 3) {
    if (beat === 0) voice('bass', root - 12, t, dur * 1.6, 0.16);
    else for (const k of tones) voice('chord', root + k + 12, t, dur * 0.8, 0.028);
  } else {
    if (beat === 0 || beat === 2) voice('bass', root - 12 + (beat === 2 ? 7 : 0), t, dur * 1.7, 0.15);
    for (const k of tones) voice('guitar', root + k + 12, t, dur, beat % 2 ? 0.05 : 0.03);
  }
}

function schedule() {
  if (!ctx || !tune) return;
  const tu = tune;
  const stepDur = 60 / tu.bpm / tu.steps;
  while (nextT < ctx.currentTime + 0.3) {
    // 스윙: 뒤 8분음표를 늦게
    const off = tu.swing && stepI % 2 === 1 ? stepDur * (tu.swing - 0.5) * 2 : 0;
    playStep(tu, stepI, nextT + off, stepDur);
    nextT += stepDur;
    stepI++;
  }
}

/** 게임을 시작하면 음악을 튼다 */
export function startMusic() {
  if (!ctx || seqTimer) return;
  tune = VALSE;
  nextT = ctx.currentTime + 0.2;
  stepI = 0;
  seqTimer = window.setInterval(schedule, 90);
  musicBus!.gain.setTargetAtTime(musicLevel, ctx.currentTime, 1.5);
}

/** 시간대에 맞는 곡(아침 첼레스타 → 낮 아코디언 왈츠 → 밤 스윙), 지하에서는 먹먹하게 */
export function musicMood(hour: number, underground: boolean, talking: boolean) {
  if (!ctx || !tune) return;
  const want = hour < 10.5 ? MATIN : hour < 19.5 ? VALSE : SWING;
  if (want !== tune && stepI % (tune.beats * tune.steps * 4) === 0) { tune = want; stepI = 0; }
  musicFilter!.frequency.setTargetAtTime(underground ? 700 : 18000, ctx.currentTime, 0.5);
  musicBus!.gain.setTargetAtTime((talking ? 0.35 : 1) * musicLevel * (0.8 + live * 0.6), ctx.currentTime, 0.4);
}

/** 거리 악사 가까이(0..1): 아코디언이 커지고 앞에서 연주하는 것처럼 */
export function music(level: number) { live = level; }

// ───────── 목소리: 브라우저의 프랑스어 음성으로 짧은 말 ─────────
let frVoices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  frVoices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }
let lastSpeak = 0;
/** 짧은 프랑스어 한마디. who: 사람마다 목소리가 다르게(높낮이·빠르기). */
export function say(text: string, who = 0, interrupt = true) {
  if (muted || !('speechSynthesis' in window)) return;
  const clean = text.replace(/[^\p{L}\p{N}\s'’,.!?…-]/gu, '').trim();
  if (!clean) return;
  const now = performance.now();
  if (!interrupt && now - lastSpeak < 1500) return;
  lastSpeak = now;
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = 'fr-FR';
  if (frVoices.length) u.voice = frVoices[Math.abs(who) % frVoices.length];
  const h = Math.abs(Math.sin(who * 12.9898) * 43758.5453) % 1;
  u.pitch = 0.75 + h * 0.7;
  u.rate = 0.95 + (h * 7 % 1) * 0.25;
  u.volume = 0.9;
  if (interrupt) window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
