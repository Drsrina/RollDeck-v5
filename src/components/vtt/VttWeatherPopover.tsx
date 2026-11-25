import {
  CloudFog,
  CloudLightning,
  CloudRain,
  Flame,
  Power,
  RotateCcw,
  Snowflake,
  Sparkles,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { normalizeWeatherConfig } from '../../lib/vttGrid';
import { useVttStore } from '../../store/useVttStore';
import {
  VTT_AMBIENT_TONE_META,
  VTT_WEATHER_LAYER_META,
  VTT_WEATHER_PRESETS,
  type VttAmbientTone,
  type VttScene,
  type VttWeatherLayerId,
} from '../../types/vtt';

interface VttWeatherPopoverProps {
  scene: VttScene;
}

const LAYER_ORDER: { id: VttWeatherLayerId; icon: React.ReactNode }[] = [
  { id: 'rain', icon: <CloudRain className="w-3.5 h-3.5" /> },
  { id: 'snow', icon: <Snowflake className="w-3.5 h-3.5" /> },
  { id: 'wind', icon: <Wind className="w-3.5 h-3.5" /> },
  { id: 'fog', icon: <CloudFog className="w-3.5 h-3.5" /> },
  { id: 'embers', icon: <Flame className="w-3.5 h-3.5" /> },
  { id: 'lightning', icon: <CloudLightning className="w-3.5 h-3.5" /> },
];

export const VttWeatherPopover: React.FC<VttWeatherPopoverProps> = ({ scene }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const {
    updateWeather,
    setWeatherLayer,
    applyWeatherPreset,
    clearWeather,
    triggerLightningPulse,
  } = useVttStore();

  const weather = normalizeWeatherConfig(scene.weather);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const activeLayerCount = Object.values(weather.layers).filter((v) => v > 0).length;
  const isEffectRunning =
    weather.enabled && (activeLayerCount > 0 || weather.ambientTone !== 'none');

  return (
    <div className="relative" ref={popoverRef} data-dice3d-ignore="true">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
          isOpen || isEffectRunning
            ? 'bg-sky-500/20 border-sky-400/50 text-sky-200'
            : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
        }`}
        title="Controlar efeitos climáticos, centelhas, iluminação e som ambiente"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Clima & FX</span>
        {isEffectRunning && (
          <span className="font-mono text-[10px] text-sky-300 tabular-nums">
            ({activeLayerCount || 1})
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-[340px] max-w-[92vw] max-h-[82vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#0e1222] shadow-2xl p-4 z-40 space-y-4">
          {/* Header: Master Enable + Clear */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">
                Clima & Atmosfera (Mestre)
              </h3>
              <p className="text-[10px] text-slate-400">
                Salvo nesta cena · Camadas combináveis
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateWeather({ enabled: !weather.enabled })}
                className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                  weather.enabled
                    ? 'bg-emerald-500/20 border-emerald-400/45 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
                title={weather.enabled ? 'Pausar todos os efeitos' : 'Ativar efeitos'}
              >
                <Power className="w-3 h-3" />
                <span>{weather.enabled ? 'Ativo' : 'Off'}</span>
              </button>
              <button
                type="button"
                onClick={() => clearWeather()}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 text-slate-400 hover:text-rose-200 transition cursor-pointer"
                title="Limpar todos os efeitos"
                aria-label="Limpar todos os efeitos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 1-Click Presets */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Presets Rápidos
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {VTT_WEATHER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyWeatherPreset(preset.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-black/35 hover:bg-white/10 border border-white/10 text-[11px] font-bold text-slate-200 flex items-center gap-2 transition cursor-pointer text-left"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: preset.accent }}
                  />
                  <span className="truncate">{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Combinable Effect Layers */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Camadas Combináveis
              </span>
              <button
                type="button"
                onClick={() => triggerLightningPulse()}
                className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 text-[10px] font-black flex items-center gap-1 transition cursor-pointer"
                title="Disparar clarão de relâmpago e trovão agora"
              >
                <Zap className="w-3 h-3" />
                <span>Relâmpago Agora</span>
              </button>
            </div>

            <div className="space-y-2">
              {LAYER_ORDER.map(({ id, icon }) => {
                const meta = VTT_WEATHER_LAYER_META[id];
                const val = weather.layers[id];
                const active = val > 0;
                return (
                  <div key={id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setWeatherLayer(id, active ? 0 : meta.defaultIntensity)
                      }
                      className={`w-28 shrink-0 px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                        active
                          ? 'bg-white/12 border-white/30 text-white'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span style={{ color: active ? meta.color : undefined }}>{icon}</span>
                      <span className="truncate">{meta.label}</span>
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={val}
                      onChange={(e) => setWeatherLayer(id, Number(e.target.value))}
                      aria-label={`Intensidade de ${meta.label}`}
                      className="flex-1 accent-cyan-400"
                    />

                    <span className="w-8 text-right font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                      {Math.round(val * 100)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Wind Controls */}
          <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
            <div>
              <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>Força do Vento</span>
                <span className="font-mono tabular-nums">
                  {Math.round(weather.windSpeed * 100)}%
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={weather.windSpeed}
                onChange={(e) => updateWeather({ windSpeed: Number(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>

            <div>
              <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>Direção</span>
                <span className="font-mono tabular-nums">
                  {weather.windAngle > 0 ? `+${weather.windAngle}°` : `${weather.windAngle}°`}
                </span>
              </label>
              <input
                type="range"
                min={-60}
                max={60}
                step={4}
                value={weather.windAngle}
                onChange={(e) => updateWeather({ windAngle: Number(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>
          </div>

          {/* Ambient Lighting Tone */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Iluminação Ambiente
              </span>
              {weather.ambientTone !== 'none' && (
                <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                  {Math.round(weather.ambientOpacity * 100)}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1">
              {(Object.keys(VTT_AMBIENT_TONE_META) as VttAmbientTone[]).map((toneId) => {
                const meta = VTT_AMBIENT_TONE_META[toneId];
                const active = weather.ambientTone === toneId;
                return (
                  <button
                    key={toneId}
                    type="button"
                    onClick={() =>
                      updateWeather({
                        enabled: toneId !== 'none' ? true : weather.enabled,
                        ambientTone: toneId,
                        ambientOpacity:
                          toneId === 'none'
                            ? 0
                            : weather.ambientOpacity > 0.05
                            ? weather.ambientOpacity
                            : 0.28,
                      })
                    }
                    className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                      active
                        ? 'bg-white/15 border-cyan-400/60 text-white'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-white/25"
                      style={{ backgroundColor: meta.swatch }}
                    />
                    <span className="truncate max-w-full">{meta.label}</span>
                  </button>
                );
              })}
            </div>

            {weather.ambientTone !== 'none' && (
              <input
                type="range"
                min={0.05}
                max={0.65}
                step={0.05}
                value={weather.ambientOpacity}
                onChange={(e) => updateWeather({ ambientOpacity: Number(e.target.value) })}
                aria-label="Intensidade da iluminação ambiente"
                className="w-full accent-purple-400"
              />
            )}
          </div>

          {/* Offline Procedural Ambient Audio */}
          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => updateWeather({ audioEnabled: !weather.audioEnabled })}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  weather.audioEnabled
                    ? 'bg-cyan-500/20 border-cyan-400/45 text-cyan-200'
                    : 'bg-black/35 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                {weather.audioEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>Som Ambiente Offline</span>
              </button>

              <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                {weather.audioEnabled ? `${Math.round(weather.audioVolume * 100)}%` : 'Mudo'}
              </span>
            </div>

            {weather.audioEnabled && (
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={weather.audioVolume}
                onChange={(e) => updateWeather({ audioVolume: Number(e.target.value) })}
                aria-label="Volume do som ambiente"
                className="w-full accent-cyan-400"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
