// 오디오 매니저 — 외부 음원 파일 없이 Web Audio API로 모든 효과음·배경음을 실시간 합성한다.
// 라이선스 문제 없이, 인터넷 연결 없이도 동작한다(기획서 §4 "제작비 통제" 원칙을 오디오에도 적용).
// 브라우저 자동재생 정책 때문에 사용자 제스처 전에는 소리가 나지 않는다 — unlockAudio()가 그 신호다.

type Ctor = typeof AudioContext;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let muted = false;
let pendingAmbient = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
  if (!C) return null;
  ctx = new C();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.55;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') {
    c.resume().then(() => { if (pendingAmbient) { pendingAmbient = false; startAmbient(); } });
  }
}

export function setMuted(v: boolean) {
  muted = v;
  const c = getCtx();
  if (c && masterGain) masterGain.gain.setTargetAtTime(v ? 0 : 0.55, c.currentTime, 0.05);
  if (v) { stopAmbient(); stopDriveMusic(); } else if (engineOsc) startDriveMusic(); else requestAmbient();
}
export function isMuted() { return muted; }

// ─── 합성 원자 ──────────────────────────────────────────────────────────────
function tone(freq: number, opts: { type?: OscillatorType; dur?: number; attack?: number; peak?: number; detune?: number; delay?: number } = {}) {
  const c = getCtx();
  if (!c || !masterGain) return;
  const { type = 'sine', dur = 0.25, attack = 0.005, peak = 0.3, detune = 0, delay = 0 } = opts;
  const at = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g); g.connect(masterGain);
  osc.start(at); osc.stop(at + dur + 0.05);
  osc.onended = () => { osc.disconnect(); g.disconnect(); };
}

function noiseBurst(opts: { dur?: number; peak?: number; delay?: number; filterFreq?: number; type?: BiquadFilterType } = {}) {
  const c = getCtx();
  if (!c || !masterGain) return;
  const { dur = 0.15, peak = 0.25, delay = 0, filterFreq = 2000, type = 'highpass' } = opts;
  const at = c.currentTime + delay;
  const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, n, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource(); src.buffer = buffer;
  const filter = c.createBiquadFilter(); filter.type = type; filter.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(peak, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(filter); filter.connect(g); g.connect(masterGain);
  src.start(at);
  src.onended = () => { src.disconnect(); filter.disconnect(); g.disconnect(); };
}

// ─── 이름 붙은 효과음 ────────────────────────────────────────────────────────
export function sfxClick() { tone(720, { dur: 0.05, peak: 0.12 }); }
export function sfxCard() { tone(880, { dur: 0.12, peak: 0.22, type: 'triangle' }); tone(1318.5, { dur: 0.18, peak: 0.16, delay: 0.06, type: 'triangle' }); }
export function sfxCorrect() { [523.25, 659.25, 783.99].forEach((f, i) => tone(f, { dur: 0.16, peak: 0.2, delay: i * 0.07, type: 'triangle' })); }
export function sfxWrong() { tone(196, { type: 'sawtooth', dur: 0.28, peak: 0.16 }); tone(146.83, { type: 'sawtooth', dur: 0.3, peak: 0.12, delay: 0.06 }); }
export function sfxCash() { [1046.5, 1318.5].forEach((f, i) => tone(f, { type: 'square', dur: 0.08, peak: 0.1, delay: i * 0.05 })); noiseBurst({ dur: 0.05, peak: 0.06, delay: 0.1, filterFreq: 4000 }); }
export function sfxDoor() { tone(300, { type: 'triangle', dur: 0.2, peak: 0.14 }); noiseBurst({ dur: 0.1, peak: 0.05, filterFreq: 800, type: 'bandpass' }); }
export function sfxDepart() { tone(440, { dur: 0.6, peak: 0.18 }); tone(659.25, { dur: 0.5, peak: 0.13, delay: 0.15 }); }
export function sfxArrive() { [659.25, 987.77].forEach((f, i) => tone(f, { dur: 0.3, peak: 0.2, delay: i * 0.1, type: 'triangle' })); }
export function sfxStamp() { noiseBurst({ dur: 0.06, peak: 0.28, filterFreq: 250, type: 'lowpass' }); tone(196, { type: 'square', dur: 0.12, peak: 0.1, delay: 0.02 }); }
export function sfxPage() { noiseBurst({ dur: 0.12, peak: 0.08, filterFreq: 3000 }); }
export function sfxWin() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { dur: 0.2, peak: 0.22, delay: i * 0.09, type: 'triangle' })); }
export function sfxLose() { [392, 349.23, 293.66].forEach((f, i) => tone(f, { dur: 0.3, peak: 0.14, delay: i * 0.12, type: 'sawtooth' })); }

// ─── 자동차 엔진(운전 미니게임 전용, 속도에 따라 연속 재생) ───────────────────
let engineOsc: OscillatorNode | null = null;
let engineFilter: BiquadFilterNode | null = null;
let engineGain: GainNode | null = null;
let driveMusicTimer: ReturnType<typeof setInterval> | null = null;
let driveMusicEnabled = true;
export function isDriveMusicEnabled() { return driveMusicEnabled; }
export function setDriveMusicEnabled(value: boolean) {
  driveMusicEnabled = value;
  if (!value) stopDriveMusic(); else if (engineOsc) startDriveMusic();
}

/** Soft toy-car glides, deliberately separate from the quiz error buzzer. */
function glide(from: number, to: number, duration: number, peak = .10) {
  const c = getCtx(); if (!c || !masterGain || muted) return;
  const osc = c.createOscillator(), gain = c.createGain(), at = c.currentTime;
  osc.type = 'sine'; osc.frequency.setValueAtTime(from, at); osc.frequency.exponentialRampToValueAtTime(to, at + duration);
  gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(peak, at + .015); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  osc.connect(gain); gain.connect(masterGain); osc.start(); osc.stop(at + duration + .02);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

export function sfxDrive(event: 'lane' | 'film' | 'combo' | 'boost' | 'bump' | 'zone' | 'warning' | 'start' | 'finish' | 'drift' | 'near' | 'perfect' | 'countdown', combo = 0) {
  if (muted) return;
  const bell = (notes: number[], peak = .12, gap = .075) => notes.forEach((f, i) => {
    tone(f, { type: 'sine', dur: .22, attack: .008, peak, delay: i * gap });
    tone(f * 2, { type: 'sine', dur: .09, peak: peak * .13, delay: i * gap });
  });
  switch (event) {
    case 'countdown': tone(523.25, { type: 'sine', dur: .1, peak: .08 }); break;
    case 'drift': noiseBurst({ dur: .32, peak: .024, filterFreq: 2200, type: 'bandpass' }); glide(650, 490, .24, .025); break;
    case 'near': noiseBurst({ dur: .14, peak: .04, filterFreq: 1300, type: 'bandpass' }); bell([880, 1174.66], .07, .04); break;
    case 'perfect': glide(180, 1100, .4, .085); bell([1046.5, 1567.98], .08, .09); noiseBurst({ dur: .35, peak: .035, filterFreq: 1800, type: 'bandpass' }); break;
    case 'lane': glide(420, 650, .07, .035); break;
    case 'film': { const root = [659.25, 783.99, 880, 1046.5][Math.min(3, Math.floor(combo / 4))]; bell([root, root * 1.5], .13, .055); break; }
    case 'combo': bell([783.99, 1046.5, 1318.5], .12, .065); break;
    case 'boost': glide(220, 880, .32, .08); noiseBurst({ dur: .28, peak: .035, filterFreq: 1400, type: 'bandpass' }); break;
    case 'bump': glide(240, 95, .18, .13); tone(330, { type: 'sine', dur: .15, peak: .06, delay: .12 }); break;
    case 'zone': bell([523.25, 783.99], .09); break;
    case 'warning': bell([440, 349.23], .07, .12); break;
    case 'start': bell([523.25, 659.25, 783.99, 1046.5], .12); break;
    case 'finish': bell([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], .14, .09); break;
  }
}

// Original, quiet C–Am–F–G toy-piano loop. Look-ahead scheduling avoids timer jitter.
function startDriveMusic() {
  const c = getCtx(); if (!c || !driveMusicEnabled || muted || driveMusicTimer) return;
  let step = 0, next = c.currentTime + .04;
  const chords = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
  const melody = [0, 2, 1, -1, 2, 1, 0, -1, 1, 2, 0, 1, 2, -1, 1, -1];
  const schedule = () => {
    if (c.state !== 'running' || muted) { next = c.currentTime + .04; return; }
    if (next < c.currentTime) next = c.currentTime + .02;
    while (next < c.currentTime + .1) {
      const chord = chords[Math.floor(step / 16) % 4], note = melody[step % 16], delay = next - c.currentTime;
      if (note >= 0) tone(chord[note] * 2, { type: 'sine', dur: .16, peak: .038, delay });
      if (step % 4 === 0) tone(chord[0] / 2, { type: 'triangle', dur: .23, peak: .04, delay });
      if (step % 4 === 2) noiseBurst({ dur: .045, peak: .012, delay, type: 'bandpass', filterFreq: 1800 });
      step++; next += 60 / 108 / 4;
    }
  };
  schedule(); driveMusicTimer = setInterval(schedule, 50);
}
function stopDriveMusic() { if (driveMusicTimer) clearInterval(driveMusicTimer); driveMusicTimer = null; }

export function startEngine() {
  const c = getCtx();
  if (!c || !masterGain || engineOsc) return;
  stopAmbient(); pendingAmbient = false;
  engineOsc = c.createOscillator(); engineOsc.type = 'triangle'; engineOsc.frequency.value = 65;
  engineFilter = c.createBiquadFilter(); engineFilter.type = 'lowpass'; engineFilter.frequency.value = 300;
  engineGain = c.createGain(); engineGain.gain.value = 0.0001;
  engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(masterGain);
  engineOsc.start();
  startDriveMusic();
}
/** v: 0(정지)~1(최고 속도) */
export function setEngineIntensity(v: number) {
  const c = getCtx();
  if (!c || !engineOsc || !engineFilter || !engineGain) return;
  const x = Math.max(0, Math.min(1, v));
  engineOsc.frequency.setTargetAtTime(65 + x * 75, c.currentTime, 0.16);
  engineFilter.frequency.setTargetAtTime(180 + x * 260, c.currentTime, 0.16);
  engineGain.gain.setTargetAtTime(0.018 + x * 0.027, c.currentTime, 0.16);
}
export function stopEngine() {
  stopDriveMusic();
  const c = getCtx();
  if (!c || !engineGain || !engineOsc) { engineOsc = null; engineFilter = null; engineGain = null; return; }
  engineGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
  const osc = engineOsc, gain = engineGain, filter = engineFilter;
  engineOsc = null; engineFilter = null; engineGain = null;
  requestAmbient();
  setTimeout(() => { try { osc.stop(); osc.disconnect(); gain.disconnect(); filter?.disconnect(); } catch { /* already stopped */ } }, 300);
}

// ─── 배경음(지도·여행 화면에서 흐르는 은은한 앰비언트) ────────────────────────
// 실제 작곡·녹음 트랙이 아니라 절제된 화음 패드 + 느린 아르페지오를 실시간 합성한 것.
// 정식 서비스에서는 라이선스가 확인된 실제 음원으로 교체하는 편이 낫다(ROADMAP 참고).
const AMBIENT_SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25]; // C 메이저 펜타토닉 계열
let ambientPads: { osc: OscillatorNode; gain: GainNode }[] = [];
let ambientTimer: ReturnType<typeof setInterval> | null = null;

export function requestAmbient() {
  const c = getCtx();
  if (!c || muted) return;
  if (c.state === 'running') startAmbient(); else pendingAmbient = true;
}

function startAmbient() {
  const c = getCtx();
  if (!c || !masterGain || ambientTimer || engineOsc) return;
  const padFreqs = [130.81, 164.81, 196.0]; // C3-E3-G3 느슨한 3화음
  ambientPads = padFreqs.map((f, i) => {
    const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = f; osc.detune.value = (i - 1) * 4;
    const g = c.createGain(); g.gain.value = 0.0001;
    g.gain.setTargetAtTime(0.03, c.currentTime, 2.5);
    osc.connect(g); g.connect(masterGain!);
    osc.start();
    return { osc, gain: g };
  });
  let step = 0;
  ambientTimer = setInterval(() => {
    if (muted) return;
    tone(AMBIENT_SCALE[step % AMBIENT_SCALE.length], { dur: 1.6, attack: 0.3, peak: 0.045 });
    step++;
  }, 1900);
}

export function stopAmbient() {
  if (ambientTimer) { clearInterval(ambientTimer); ambientTimer = null; }
  const c = getCtx();
  ambientPads.forEach(({ osc, gain }) => {
    if (c) gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.4);
    setTimeout(() => { try { osc.stop(); osc.disconnect(); gain.disconnect(); } catch { /* already stopped */ } }, 700);
  });
  ambientPads = [];
}
