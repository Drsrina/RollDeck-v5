import React, { useEffect, useRef } from 'react';
import { normalizeWeatherConfig } from '../../lib/vttGrid';
import { syncWeatherAudio, triggerThunderAudio } from '../../lib/vttWeatherAudio';
import { useAppStore } from '../../store/useAppStore';
import { useVttStore } from '../../store/useVttStore';
import { VTT_AMBIENT_TONE_META, type VttWeatherConfig } from '../../types/vtt';

interface VttWeatherOverlayProps {
  weather?: VttWeatherConfig;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  width: number;
}

interface RainSplash {
  x: number;
  y: number;
  r: number;
  maxR: number;
  alpha: number;
}

interface SnowFlake {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
  sway: number;
  alpha: number;
}

interface WindStreak {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  wave: number;
  isLeaf: boolean;
  rot: number;
  rotSpeed: number;
}

interface FogPuff {
  x: number;
  y: number;
  r: number;
  speed: number;
  alpha: number;
}

interface EmberSpark {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  hue: number;
  phase: number;
}

interface LightningBolt {
  points: { x: number; y: number }[];
  alpha: number;
}

function generateBolt(width: number, height: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  let x = width * (0.15 + Math.random() * 0.7);
  let y = 0;
  pts.push({ x, y });
  const steps = 8 + Math.floor(Math.random() * 5);
  const stepY = (height * (0.45 + Math.random() * 0.4)) / steps;
  for (let i = 0; i < steps; i++) {
    x += (Math.random() - 0.5) * 95;
    y += stepY;
    pts.push({ x, y });
  }
  return pts;
}

export const VttWeatherOverlay: React.FC<VttWeatherOverlayProps> = ({ weather: rawWeather }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const weather = normalizeWeatherConfig(rawWeather);

  const reduceMotion = useAppStore((s) => s.settings.reduceMotion);
  const soundEnabled = useAppStore((s) => s.settings.soundEnabled);
  const lightningPulseNonce = useVttStore((s) => s.lightningPulseNonce);

  const weatherRef = useRef(weather);
  weatherRef.current = weather;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Shared flash intensity + bolt state so manual GM lightning trigger fires immediately
  const flashRef = useRef(0);
  const boltRef = useRef<LightningBolt | null>(null);
  const lastPulseRef = useRef(lightningPulseNonce);

  // Sync procedural Web Audio API soundscapes whenever weather or global sound setting changes
  useEffect(() => {
    syncWeatherAudio(weather, soundEnabled);
  }, [weather, soundEnabled]);

  // Respond to manual GM "Disparar Relâmpago" button
  useEffect(() => {
    if (lightningPulseNonce === lastPulseRef.current) return;
    lastPulseRef.current = lightningPulseNonce;
    const canvas = canvasRef.current;
    const w = canvas ? canvas.clientWidth || 1000 : 1000;
    const h = canvas ? canvas.clientHeight || 680 : 680;
    flashRef.current = reduceMotionRef.current ? 0.25 : 0.72;
    boltRef.current = { points: generateBolt(w, h), alpha: 0.92 };
    const cfg = weatherRef.current;
    const vol = cfg.audioEnabled ? cfg.audioVolume : 0.5;
    triggerThunderAudio(vol, soundEnabledRef.current);
  }, [lightningPulseNonce]);

  const hasAnyParticles =
    weather.enabled &&
    (weather.layers.rain > 0 ||
      weather.layers.snow > 0 ||
      weather.layers.wind > 0 ||
      weather.layers.fog > 0 ||
      weather.layers.embers > 0 ||
      weather.layers.lightning > 0);

  // Main 60fps Canvas 2D simulation loop (only runs while particles or flash are active)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = Math.max(300, canvas.clientWidth);
    let height = Math.max(300, canvas.clientHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = Math.max(300, canvas.clientWidth);
      height = Math.max(300, canvas.clientHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    if (!hasAnyParticles && flashRef.current <= 0.005 && !boltRef.current) {
      ctx.clearRect(0, 0, width, height);
      return;
    }

    let rafId = 0;
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Particle pools
    const rainDrops: RainDrop[] = [];
    const rainSplashes: RainSplash[] = [];
    const snowFlakes: SnowFlake[] = [];
    const windStreaks: WindStreak[] = [];
    const fogPuffs: FogPuff[] = [];
    const embers: EmberSpark[] = [];

    let nextLightningCountdown = 3.5 + Math.random() * 5;
    let lastTime = performance.now();
    let elapsed = 0;

    const ensureCounts = (cfg: VttWeatherConfig, motionScale: number) => {
      const areaFactor = Math.max(0.55, Math.min(1.6, (width * height) / (1100 * 700)));
      const targetRain = cfg.enabled ? Math.round(cfg.layers.rain * 190 * areaFactor * motionScale) : 0;
      const targetSnow = cfg.enabled ? Math.round(cfg.layers.snow * 125 * areaFactor * motionScale) : 0;
      const targetWind = cfg.enabled ? Math.round(cfg.layers.wind * 34 * areaFactor * motionScale) : 0;
      const targetFog = cfg.enabled ? Math.round(cfg.layers.fog * 15 * areaFactor) : 0;
      const targetEmbers = cfg.enabled ? Math.round(cfg.layers.embers * 85 * areaFactor * motionScale) : 0;

      while (rainDrops.length < targetRain) {
        rainDrops.push({
          x: Math.random() * width,
          y: Math.random() * height,
          len: 14 + Math.random() * 18,
          speed: 520 + Math.random() * 340,
          alpha: 0.22 + Math.random() * 0.34,
          width: 0.9 + Math.random() * 0.7,
        });
      }
      if (rainDrops.length > targetRain) rainDrops.length = targetRain;

      while (snowFlakes.length < targetSnow) {
        snowFlakes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 1.4 + Math.random() * 3.1,
          speed: 28 + Math.random() * 52,
          phase: Math.random() * Math.PI * 2,
          sway: 14 + Math.random() * 28,
          alpha: 0.35 + Math.random() * 0.55,
        });
      }
      if (snowFlakes.length > targetSnow) snowFlakes.length = targetSnow;

      while (windStreaks.length < targetWind) {
        windStreaks.push({
          x: Math.random() * width,
          y: Math.random() * height,
          len: 48 + Math.random() * 110,
          speed: 240 + Math.random() * 280,
          alpha: 0.08 + Math.random() * 0.18,
          wave: Math.random() * Math.PI * 2,
          isLeaf: Math.random() < 0.28,
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 5,
        });
      }
      if (windStreaks.length > targetWind) windStreaks.length = targetWind;

      while (fogPuffs.length < targetFog) {
        fogPuffs.push({
          x: Math.random() * (width + 400) - 200,
          y: Math.random() * height,
          r: 160 + Math.random() * 220,
          speed: 10 + Math.random() * 22,
          alpha: 0.06 + Math.random() * 0.09,
        });
      }
      if (fogPuffs.length > targetFog) fogPuffs.length = targetFog;

      while (embers.length < targetEmbers) {
        const maxLife = 2 + Math.random() * 3.2;
        embers.push({
          x: Math.random() * width,
          y: height * (0.2 + Math.random() * 0.85),
          r: 1.2 + Math.random() * 2.5,
          vy: -(36 + Math.random() * 68),
          vx: (Math.random() - 0.5) * 28,
          life: Math.random() * maxLife,
          maxLife,
          hue: 16 + Math.random() * 32,
          phase: Math.random() * Math.PI * 2,
        });
      }
      if (embers.length > targetEmbers) embers.length = targetEmbers;
    };

    const step = (now: number) => {
      rafId = window.requestAnimationFrame(step);
      if (document.hidden) {
        lastTime = now;
        return;
      }

      const rawDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const cfg = weatherRef.current;
      const reduced = reduceMotionRef.current;
      const dt = reduced ? rawDt * 0.25 : rawDt;
      elapsed += dt;

      ctx.clearRect(0, 0, width, height);

      const angleRad = (cfg.windAngle * Math.PI) / 180;
      const windPushX = Math.sin(angleRad) * (120 + cfg.windSpeed * 320);

      ensureCounts(cfg, reduced ? 0.45 : 1);

      // 1. Fog Clouds (back-most atmospheric depth)
      if (fogPuffs.length > 0 && cfg.layers.fog > 0) {
        const fogStrength = cfg.layers.fog;
        const driftDir = cfg.windAngle >= 0 ? 1 : -1;
        for (const puff of fogPuffs) {
          puff.x += driftDir * (puff.speed * (0.5 + cfg.windSpeed * 1.4)) * dt;
          if (driftDir > 0 && puff.x - puff.r > width + 80) {
            puff.x = -puff.r - 40;
            puff.y = Math.random() * height;
          } else if (driftDir < 0 && puff.x + puff.r < -80) {
            puff.x = width + puff.r + 40;
            puff.y = Math.random() * height;
          }

          const grad = ctx.createRadialGradient(puff.x, puff.y, puff.r * 0.08, puff.x, puff.y, puff.r);
          const a = Math.min(0.28, puff.alpha * fogStrength * 1.6);
          grad.addColorStop(0, `rgba(215, 228, 240, ${a})`);
          grad.addColorStop(0.55, `rgba(180, 198, 218, ${a * 0.45})`);
          grad.addColorStop(1, 'rgba(180, 198, 218, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(puff.x, puff.y, puff.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Wind Ribbons & Drifting Leaves/Dust
      if (windStreaks.length > 0 && cfg.layers.wind > 0) {
        const dir = cfg.windAngle >= 0 ? 1 : -1;
        const speedMult = 0.65 + cfg.windSpeed * 1.4;
        const slantY = Math.sin(angleRad * 0.35) * 45;
        ctx.lineCap = 'round';

        for (const s of windStreaks) {
          s.x += dir * s.speed * speedMult * dt;
          s.y += (slantY + Math.sin(elapsed * 2.4 + s.wave) * 28) * dt;
          s.rot += s.rotSpeed * dt;

          if (dir > 0 && s.x - s.len > width + 40) {
            s.x = -s.len - Math.random() * 80;
            s.y = Math.random() * height;
          } else if (dir < 0 && s.x + s.len < -40) {
            s.x = width + s.len + Math.random() * 80;
            s.y = Math.random() * height;
          }
          if (s.y < -30) s.y = height + 20;
          if (s.y > height + 30) s.y = -20;

          if (s.isLeaf) {
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot);
            ctx.fillStyle = `rgba(110, 215, 165, ${Math.min(0.65, (s.alpha + 0.25) * cfg.layers.wind)})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, 5.5, 2.6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          } else {
            ctx.strokeStyle = `rgba(216, 234, 248, ${s.alpha * cfg.layers.wind})`;
            ctx.lineWidth = 1.15;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.quadraticCurveTo(
              s.x - dir * s.len * 0.5,
              s.y - 6 * Math.sin(elapsed * 3 + s.wave),
              s.x - dir * s.len,
              s.y + 3
            );
            ctx.stroke();
          }
        }
      }

      // 3. Rain Streaks + Surface Splash Rings
      if (rainDrops.length > 0 && cfg.layers.rain > 0) {
        const rainMult = 0.75 + cfg.layers.rain * 0.6;
        ctx.lineCap = 'round';

        for (const d of rainDrops) {
          const vx = windPushX * 0.72;
          const vy = d.speed * rainMult;
          d.x += vx * dt;
          d.y += vy * dt;

          if (d.y > height + 20 || d.x < -60 || d.x > width + 60) {
            // Spawn subtle top-down splash ripple occasionally
            if (!reduced && rainSplashes.length < 28 && Math.random() < 0.08 * cfg.layers.rain) {
              rainSplashes.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: 1.5,
                maxR: 6 + Math.random() * 6,
                alpha: 0.35 * cfg.layers.rain,
              });
            }
            d.x = Math.random() * (width + 180) - 90;
            d.y = -20 - Math.random() * 60;
          }

          const norm = Math.hypot(vx, vy) || 1;
          const dx = (vx / norm) * d.len;
          const dy = (vy / norm) * d.len;

          ctx.strokeStyle = `rgba(176, 224, 255, ${d.alpha * (0.55 + cfg.layers.rain * 0.45)})`;
          ctx.lineWidth = d.width;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.lineTo(d.x - dx, d.y - dy);
          ctx.stroke();
        }

        for (let i = rainSplashes.length - 1; i >= 0; i--) {
          const sp = rainSplashes[i];
          sp.r += 22 * dt;
          sp.alpha -= 0.9 * dt;
          if (sp.alpha <= 0.01 || sp.r >= sp.maxR) {
            rainSplashes.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(186, 230, 253, ${sp.alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 4. Snowflakes
      if (snowFlakes.length > 0 && cfg.layers.snow > 0) {
        for (const f of snowFlakes) {
          const swayX = Math.sin(elapsed * 1.4 + f.phase) * f.sway;
          f.x += (windPushX * 0.28 + swayX) * dt;
          f.y += f.speed * (0.7 + cfg.layers.snow * 0.5) * dt;

          if (f.y > height + 12) {
            f.y = -12;
            f.x = Math.random() * width;
          }
          if (f.x < -20) f.x = width + 18;
          if (f.x > width + 20) f.x = -18;

          ctx.fillStyle = `rgba(241, 245, 249, ${f.alpha * (0.5 + cfg.layers.snow * 0.5)})`;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Fire Embers & Glowing Sparks
      if (embers.length > 0 && cfg.layers.embers > 0) {
        const prevComposite = ctx.globalCompositeOperation;
        ctx.globalCompositeOperation = 'lighter';

        for (const em of embers) {
          em.life += dt;
          const swirl = Math.sin(elapsed * 3.2 + em.phase) * 32;
          em.x += (em.vx + swirl + windPushX * 0.24) * dt;
          em.y += em.vy * (0.75 + cfg.layers.embers * 0.5) * dt;

          if (em.life >= em.maxLife || em.y < -20 || em.x < -40 || em.x > width + 40) {
            em.x = Math.random() * width;
            em.y = height + 10 + Math.random() * 40;
            em.life = 0;
            em.maxLife = 2 + Math.random() * 3.4;
          }

          const progress = em.life / em.maxLife;
          const fade = Math.sin(progress * Math.PI);
          const flicker = 0.72 + 0.28 * Math.sin(elapsed * 14 + em.phase);
          const alpha = Math.max(0, Math.min(1, fade * flicker * (0.55 + cfg.layers.embers * 0.45)));

          // Soft warm glow halo
          const haloR = em.r * 3.6;
          const grad = ctx.createRadialGradient(em.x, em.y, 0.2, em.x, em.y, haloR);
          grad.addColorStop(0, `hsla(${em.hue + 14}, 100%, 78%, ${alpha})`);
          grad.addColorStop(0.45, `hsla(${em.hue}, 100%, 54%, ${alpha * 0.55})`);
          grad.addColorStop(1, `hsla(${em.hue}, 100%, 45%, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(em.x, em.y, haloR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalCompositeOperation = prevComposite;
      }

      // 6. Automatic & Manual Storm Lightning
      if (cfg.enabled && cfg.layers.lightning > 0 && !reduced) {
        nextLightningCountdown -= dt;
        if (nextLightningCountdown <= 0) {
          flashRef.current = 0.45 + cfg.layers.lightning * 0.35;
          boltRef.current = { points: generateBolt(width, height), alpha: 0.85 };
          if (cfg.audioEnabled) {
            triggerThunderAudio(cfg.audioVolume, soundEnabledRef.current);
          }
          const minWait = Math.max(2.2, 11 - cfg.layers.lightning * 8);
          nextLightningCountdown = minWait + Math.random() * 6.5;
        }
      }

      if (flashRef.current > 0.005) {
        ctx.fillStyle = `rgba(224, 244, 255, ${Math.min(0.65, flashRef.current)})`;
        ctx.fillRect(0, 0, width, height);
        flashRef.current *= Math.pow(0.04, rawDt);
      } else {
        flashRef.current = 0;
      }

      if (boltRef.current && boltRef.current.alpha > 0.02) {
        const pts = boltRef.current.points;
        ctx.save();
        ctx.strokeStyle = `rgba(224, 248, 255, ${boltRef.current.alpha})`;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 16;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.restore();
        boltRef.current.alpha *= Math.pow(0.015, rawDt);
      } else {
        boltRef.current = null;
      }
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [hasAnyParticles, lightningPulseNonce]);

  const toneMeta = VTT_AMBIENT_TONE_META[weather.ambientTone] || VTT_AMBIENT_TONE_META.none;
  const showAmbientTone = weather.enabled && weather.ambientTone !== 'none' && weather.ambientOpacity > 0;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-15 pointer-events-none overflow-hidden"
    >
      {/* Ambient Lighting & Vignette Layer (calibrated to preserve token/HP legibility) */}
      {showAmbientTone && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: Math.min(1, weather.ambientOpacity * 1.55),
            background: `radial-gradient(circle at 50% 48%, ${toneMeta.tint} 0%, ${toneMeta.vignette} 100%)`,
          }}
        />
      )}

      {/* 60fps Atmospheric Particle & Lightning Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};
