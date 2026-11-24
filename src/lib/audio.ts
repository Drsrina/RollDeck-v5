// Synthetic sound effects using Web Audio API (100% offline, zero audio file downloads)

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a realistic, tactile wooden/acrylic dice rattle & tumble sound
 */
export function playDiceRollSound(diceCount = 1) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const count = Math.min(Math.max(diceCount, 1), 12);
    const now = ctx.currentTime;

    // Multiple micro-clacks for dice rattling together
    for (let i = 0; i < count; i++) {
      const delay = i * 0.045 + (Math.random() * 0.04);
      const startTime = now + delay;

      // Noise buffer for the clack impact
      const bufferSize = ctx.sampleRate * 0.05; // 50ms
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufferSize * 0.25));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter to simulate dice material
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400 + Math.random() * 800, startTime);
      filter.Q.setValueAtTime(3.5, startTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(startTime);
    }
  } catch {
    // Graceful fallback if Web Audio is blocked
  }
}

let lastImpactAudioTime = 0;

/**
 * Plays a crisp, velocity-scaled single resin/acrylic clack on physical bounce or collision.
 */
export function playDiceImpactSound(
  intensity = 0.5,
  kind: 'floor' | 'wall' | 'die' = 'floor'
) {
  try {
    const nowMs = performance.now();
    if (nowMs - lastImpactAudioTime < 34) return;
    lastImpactAudioTime = nowMs;

    const ctx = getAudioContext();
    if (!ctx) return;

    const clamped = Math.min(Math.max(intensity, 0.08), 1);
    const now = ctx.currentTime;

    // Short filtered noise burst for physical surface impact
    const duration = kind === 'die' ? 0.028 : 0.04;
    const bufferSize = Math.max(64, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const decay = kind === 'die' ? 0.18 : 0.28;
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * decay));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const baseFreq = kind === 'die' ? 2350 : kind === 'wall' ? 1650 : 1250;
    filter.frequency.setValueAtTime(baseFreq + Math.random() * 420, now);
    filter.Q.setValueAtTime(kind === 'die' ? 5.2 : 3.4, now);

    const gain = ctx.createGain();
    const peakGain = (kind === 'die' ? 0.16 : 0.13) * clamped;
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Subtle resonant body ping for die-to-die acrylic click
    if (kind === 'die' && clamped > 0.25) {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1900 + Math.random() * 550, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.024);

      oscGain.gain.setValueAtTime(0.055 * clamped, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.026);
    }
  } catch {
    // Graceful fallback if Web Audio is blocked
  }
}

/**
 * Celebratory triumphant chime for natural 20 critical hits
 */
export function playCriticalSuccessSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * Dramatic thud / dissonant chime for natural 1 critical failure
 */
export function playCriticalFailSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    // Ignore
  }
}

/**
 * Subtle UI click sound for buttons and chips
 */
export function playClickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  } catch {
    // Ignore
  }
}
