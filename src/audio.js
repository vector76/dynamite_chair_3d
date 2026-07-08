// Synthesized WebAudio SFX, ported from the 2D game — no audio assets.
// initAudio() must run inside a user gesture (browser autoplay policy);
// resumeAudio() revives a suspended context (tab refocus, keyboard fire).
const MUTE_KEY = 'dc3d.muted';

const audio = {
  ctx: null,
  master: null,
  muted: localStorage.getItem(MUTE_KEY) === '1',
};

export function initAudio() {
  if (audio.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new AC();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.35;
    audio.master.connect(audio.ctx.destination);
    // Created inside the unlock gesture — resume immediately so the context is
    // already running (and warmed) well before the first real sound, and warm
    // up again once resume settles.
    audio.ctx.resume().then(warmUpAudio).catch(() => {});
    warmUpAudio();
  } catch (e) { /* no audio available */ }
}

export function resumeAudio() {
  if (audio.ctx && audio.ctx.state === 'suspended') {
    audio.ctx.resume().then(warmUpAudio).catch(() => {});
  }
}

// Prime the output. Browsers commonly swallow the FIRST audible sound on a
// freshly-resumed AudioContext, so run a real (but inaudible) oscillator through
// the master bus: it forces the graph to render, so that dropped first quantum
// is spent here instead of on the first blast.
function warmUpAudio() {
  if (!audio.ctx || !audio.master) return;
  try {
    const ac = audio.ctx, t = ac.currentTime;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    g.gain.value = 0.0001;              // effectively silent
    osc.connect(g); g.connect(audio.master);
    osc.start(t); osc.stop(t + 0.05);
  } catch (e) { /* ignore */ }
}

export function toggleMute() {
  audio.muted = !audio.muted;
  localStorage.setItem(MUTE_KEY, audio.muted ? '1' : '0');
  return audio.muted;
}

export function isMuted() {
  return audio.muted;
}

function noiseBuffer(dur) {
  const ac = audio.ctx;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function sfxBoom(power = 0.8) {
  if (!audio.ctx || audio.muted) return;
  const ac = audio.ctx, t = ac.currentTime + 0.02;   // small lookahead so the attack registers
  // noise body
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(0.35);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t);
  lp.frequency.exponentialRampToValueAtTime(200, t + 0.3);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.9 * power, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  src.connect(lp); lp.connect(g); g.connect(audio.master);
  src.start(t); src.stop(t + 0.35);
  // low sine thump
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.8 * power, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  osc.connect(og); og.connect(audio.master);
  osc.start(t); osc.stop(t + 0.3);
}

export function sfxCrash() {
  if (!audio.ctx || audio.muted) return;
  const ac = audio.ctx, t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(0.7);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(2500, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 0.6);
  const g = ac.createGain();
  g.gain.setValueAtTime(1.0, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  src.connect(lp); lp.connect(g); g.connect(audio.master);
  src.start(t); src.stop(t + 0.7);
  const osc = ac.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.5);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.7, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  osc.connect(og); og.connect(audio.master);
  osc.start(t); osc.stop(t + 0.6);
}

export function sfxWin() {
  if (!audio.ctx || audio.muted) return;
  const ac = audio.ctx, t0 = ac.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const t = t0 + i * 0.12;
    const osc = ac.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(g); g.connect(audio.master);
    osc.start(t); osc.stop(t + 0.3);
  });
}

// coin-pickup chime (no coins in the 2D game — same synth style; for M3)
export function sfxChime() {
  if (!audio.ctx || audio.muted) return;
  const ac = audio.ctx, t0 = ac.currentTime;
  for (const [f, d] of [[1318.5, 0], [1760, 0.06]]) {   // E6 -> A6, quick sparkle
    const t = t0 + d;
    const osc = ac.createOscillator();
    osc.type = 'sine'; osc.frequency.value = f;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g); g.connect(audio.master);
    osc.start(t); osc.stop(t + 0.25);
  }
}
