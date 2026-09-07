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
  if (v) stopAmbient(); else requestAmbient();
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
  if (!c || !masterGain || ambientTimer) return;
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
