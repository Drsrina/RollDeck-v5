import type { VttWeatherConfig } from '../types/vtt';

/**
 * 100% offline Web Audio API procedural soundscape synthesizer for the VTT.
 * Generates smooth looping rain, LFO-modulated wind gusts, campfire/ember crackles,
 * and on-demand synthesized thunder without any external audio assets.
 */
interface WeatherAudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  rainGain: GainNode;
  rainFilter: BiquadFilterNode;
  windGain: GainNode;
  windFilter: BiquadFilterNode;
  windLfoGain: GainNode;
  fireGain: GainNode;
  crackleTimer: number | null;
  activeEmberLevel: number;
  activeMasterVolume: number;
}

let engine: WeatherAudioEngine | null = null;

function createNoiseBuffer(ctx: AudioContext, type: 'pink' | 'brown', seconds = 3): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.022 * white) / 1.022;
      data[i] = Math.max(-1, Math.min(1, last * 3.2));
    }
  } else {
    // Paul Kellet's pink noise filter
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.095;
      b6 = white * 0.115926;
      data[i] = Math.max(-1, Math.min(1, pink));
    }
  }

  return buffer;
}

function ensureEngine(): WeatherAudioEngine | null {
  if (typeof window === 'undefined') return null;
  if (engine) {
    if (engine.ctx.state === 'suspended') {
      engine.ctx.resume().catch(() => {});
    }
    return engine;
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;

  try {
    const ctx = new AudioCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);

    const pinkBuf = createNoiseBuffer(ctx, 'pink', 3);
    const brownBuf = createNoiseBuffer(ctx, 'brown', 4);

    // 1. Rain channel (filtered pink noise)
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = pinkBuf;
    rainSrc.loop = true;

    const rainHighpass = ctx.createBiquadFilter();
    rainHighpass.type = 'highpass';
    rainHighpass.frequency.value = 650;

    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 3400;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;

    rainSrc.connect(rainHighpass);
    rainHighpass.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(masterGain);
    rainSrc.start();

    // 2. Wind channel (LFO-modulated bandpass brown noise for realistic gusts)
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = brownBuf;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 320;
    windFilter.Q.value = 1.6;

    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.value = 0.14;
    const windLfoGain = ctx.createGain();
    windLfoGain.gain.value = 140;
    windLfo.connect(windLfoGain);
    windLfoGain.connect(windFilter.frequency);
    windLfo.start();

    const windGain = ctx.createGain();
    windGain.gain.value = 0;

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windSrc.start();

    // 3. Fire / Embers base rumble
    const fireSrc = ctx.createBufferSource();
    fireSrc.buffer = brownBuf;
    fireSrc.loop = true;

    const fireFilter = ctx.createBiquadFilter();
    fireFilter.type = 'lowpass';
    fireFilter.frequency.value = 210;

    const fireGain = ctx.createGain();
    fireGain.gain.value = 0;

    fireSrc.connect(fireFilter);
    fireFilter.connect(fireGain);
    fireGain.connect(masterGain);
    fireSrc.start();

    engine = {
      ctx,
      masterGain,
      rainGain,
      rainFilter,
      windGain,
      windFilter,
      windLfoGain,
      fireGain,
      crackleTimer: null,
      activeEmberLevel: 0,
      activeMasterVolume: 0,
    };

    // Subtle stochastic ember crackle impulses when embers are active
    engine.crackleTimer = window.setInterval(() => {
      if (!engine || engine.ctx.state !== 'running') return;
      if (engine.activeEmberLevel <= 0.05 || engine.activeMasterVolume <= 0.01) return;
      if (Math.random() > 0.32 + engine.activeEmberLevel * 0.45) return;

      const now = engine.ctx.currentTime;
      const dur = 0.012 + Math.random() * 0.025;
      const buf = engine.ctx.createBuffer(1, Math.floor(engine.ctx.sampleRate * dur), engine.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ch.length * 0.35));
      }

      const src = engine.ctx.createBufferSource();
      src.buffer = buf;

      const bp = engine.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800 + Math.random() * 3400;
      bp.Q.value = 2.2;

      const g = engine.ctx.createGain();
      g.gain.value = (0.08 + Math.random() * 0.14) * engine.activeEmberLevel;

      src.connect(bp);
      bp.connect(g);
      g.connect(engine.masterGain);
      src.start(now);
    }, 180);

    return engine;
  } catch {
    return null;
  }
}

export function syncWeatherAudio(weather: VttWeatherConfig, globalSoundEnabled: boolean): void {
  const shouldPlay =
    globalSoundEnabled &&
    weather.enabled &&
    weather.audioEnabled &&
    weather.audioVolume > 0.01 &&
    (weather.layers.rain > 0 ||
      weather.layers.wind > 0 ||
      weather.layers.snow > 0 ||
      weather.layers.embers > 0 ||
      weather.layers.lightning > 0);

  if (!shouldPlay) {
    if (engine) {
      const now = engine.ctx.currentTime;
      engine.activeEmberLevel = 0;
      engine.activeMasterVolume = 0;
      engine.masterGain.gain.setTargetAtTime(0, now, 0.2);
    }
    return;
  }

  const eng = ensureEngine();
  if (!eng) return;

  const now = eng.ctx.currentTime;
  const vol = Math.max(0, Math.min(1, weather.audioVolume));
  eng.activeMasterVolume = vol;
  eng.activeEmberLevel = weather.layers.embers;

  eng.masterGain.gain.setTargetAtTime(vol * 0.55, now, 0.25);

  // Rain gain & brightness scale smoothly with rain intensity
  const rainLevel = weather.layers.rain;
  eng.rainGain.gain.setTargetAtTime(rainLevel * 0.42, now, 0.25);
  eng.rainFilter.frequency.setTargetAtTime(2200 + rainLevel * 2800, now, 0.25);

  // Wind combines explicit wind layer + blizzard/storm snow breeze
  const effectiveWind = Math.max(
    weather.layers.wind,
    weather.layers.snow * 0.45,
    weather.layers.rain * weather.windSpeed * 0.55
  );
  eng.windGain.gain.setTargetAtTime(effectiveWind * (0.28 + weather.windSpeed * 0.38), now, 0.3);
  eng.windFilter.frequency.setTargetAtTime(240 + weather.windSpeed * 280, now, 0.3);
  eng.windLfoGain.gain.setTargetAtTime(90 + weather.windSpeed * 180, now, 0.3);

  // Fire/Embers warm low base
  eng.fireGain.gain.setTargetAtTime(weather.layers.embers * 0.32, now, 0.25);
}

/**
 * Triggers a procedural distant-to-close rolling thunder rumble synchronized with lightning flashes.
 */
export function triggerThunderAudio(volume = 0.5, globalSoundEnabled = true): void {
  if (!globalSoundEnabled || volume <= 0.01) return;
  const eng = ensureEngine();
  if (!eng) return;

  try {
    const ctx = eng.ctx;
    const now = ctx.currentTime;
    const duration = 2.6 + Math.random() * 1.4;
    const buf = createNoiseBuffer(ctx, 'brown', duration);

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(85, now + duration * 0.85);

    const env = ctx.createGain();
    const peak = Math.min(0.85, Math.max(0.15, volume * 0.72));
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(peak, now + 0.07);
    env.gain.exponentialRampToValueAtTime(peak * 0.42, now + 0.55);
    env.gain.linearRampToValueAtTime(peak * 0.58, now + 0.85);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.05);
  } catch {
    // Ignore audio context autoplay errors until user gesture
  }
}

export function stopWeatherAudio(): void {
  if (!engine) return;
  try {
    if (engine.crackleTimer !== null) {
      window.clearInterval(engine.crackleTimer);
    }
    const now = engine.ctx.currentTime;
    engine.masterGain.gain.setTargetAtTime(0, now, 0.08);
    const ctxToClose = engine.ctx;
    window.setTimeout(() => {
      ctxToClose.close().catch(() => {});
    }, 250);
  } catch {
    // Ignore close errors
  } finally {
    engine = null;
  }
}
