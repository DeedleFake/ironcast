/** Lightweight WebAudio SFX — unlock on first user gesture. */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c?.state === "suspended") void c.resume();
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType = "square",
  gain = 0.08,
  slide = 0,
) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(dur: number, gain = 0.06) {
  const c = getCtx();
  if (!c) return;
  const n = (c.sampleRate * dur) | 0;
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1200;
  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start();
}

export const sfx = {
  shoot: () => {
    noiseBurst(0.08, 0.1);
    beep(180, 0.06, "sawtooth", 0.05, -80);
  },
  empty: () => beep(90, 0.05, "square", 0.04),
  hit: () => {
    beep(320, 0.04, "square", 0.06, -100);
    noiseBurst(0.05, 0.04);
  },
  hurt: () => beep(120, 0.15, "sawtooth", 0.08, -60),
  pickup: () => {
    beep(440, 0.06, "square", 0.05);
    beep(660, 0.08, "square", 0.04);
  },
  enemyDie: () => {
    beep(200, 0.12, "sawtooth", 0.07, -150);
    noiseBurst(0.15, 0.08);
  },
  win: () => {
    beep(440, 0.1, "square", 0.05);
    setTimeout(() => beep(554, 0.1, "square", 0.05), 100);
    setTimeout(() => beep(659, 0.18, "square", 0.06), 200);
  },
  click: () => beep(600, 0.03, "square", 0.03),
};
