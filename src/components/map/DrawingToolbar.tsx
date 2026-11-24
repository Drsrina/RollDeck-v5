import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Lock,
  Mountain,
  PenTool,
  RotateCcw,
  Route,
  Trash2,
  Waves,
  X,
} from 'lucide-react';
import React, { useMemo, useRef } from 'react';
import {
  createStyleFromPreset,
  DRAWING_COLOR_PALETTE,
  DRAWING_PRESETS,
} from '../../lib/mapDrawing';
import { useMapStore } from '../../store/useMapStore';
import type { DrawingPreset, DrawingStrokeStyle, MapDrawing } from '../../types';

const PRESET_ICONS: Record<DrawingPreset, React.FC<{ className?: string }>> = {
  free: PenTool,
  river: Waves,
  trail: Route,
  wall: Mountain,
};

const STROKE_STYLE_OPTIONS: { id: DrawingStrokeStyle; label: string }[] = [
  { id: 'solid', label: 'Sólido' },
  { id: 'dashed', label: 'Tracejado' },
  { id: 'dotted', label: 'Pontilhado' },
];

export const DrawingToolbar: React.FC = () => {
  const {
    canvasTool,
    layers,
    drawings,
    activeDrawingLayerId,
    selectedDrawingId,
    drawingStyle,
    setActiveDrawingLayerId,
    setDrawingStyle,
    applyDrawingPreset,
    selectDrawing,
    updateDrawing,
    commitDrawings,
    pushHistorySnapshot,
    duplicateDrawing,
    bringDrawingToFront,
    sendDrawingToBack,
    deleteDrawing,
  } = useMapStore();

  const sliderHistoryRecordedRef = useRef(false);

  const selectedDrawing: MapDrawing | null = useMemo(
    () => drawings.find((d) => d.id === selectedDrawingId) || null,
    [drawings, selectedDrawingId]
  );

  const targetLayerId = selectedDrawing
    ? selectedDrawing.layerId
    : activeDrawingLayerId || layers[0]?.id || '';

  const targetLayer = layers.find((l) => l.id === targetLayerId) || layers[0];

  // Paleta inclui cor da camada ativa sem duplicar
  const paletteColors = useMemo(() => {
    const set = new Set<string>();
    if (targetLayer?.color) set.add(targetLayer.color.toLowerCase());
    DRAWING_COLOR_PALETTE.forEach((c) => set.add(c.toLowerCase()));
    return Array.from(set);
  }, [targetLayer?.color]);

  const isVisible = canvasTool === 'draw' || selectedDrawing !== null;
  if (!isVisible) return null;

  const isTargetLayerLocked = Boolean(targetLayer?.locked);

  const activePreset = selectedDrawing ? selectedDrawing.preset : drawingStyle.preset;
  const activeColor = selectedDrawing ? selectedDrawing.color : drawingStyle.color;
  const activeStrokeWidth = selectedDrawing
    ? selectedDrawing.strokeWidth
    : drawingStyle.strokeWidth;
  const activeOpacity = selectedDrawing ? selectedDrawing.opacity : drawingStyle.opacity;
  const activeStrokeStyle = selectedDrawing
    ? selectedDrawing.strokeStyle
    : drawingStyle.strokeStyle;
  const activeSmooth = selectedDrawing ? selectedDrawing.smooth : drawingStyle.smooth;

  const handlePresetClick = (preset: DrawingPreset) => {
    if (selectedDrawing) {
      if (isTargetLayerLocked) return;
      const style = createStyleFromPreset(preset, targetLayer?.color);
      updateDrawing(
        selectedDrawing.id,
        {
          preset: style.preset,
          color: style.color,
          strokeWidth: style.strokeWidth,
          opacity: style.opacity,
          strokeStyle: style.strokeStyle,
          smooth: style.smooth,
        },
        { recordHistory: true, commit: true }
      );
    } else {
      applyDrawingPreset(preset);
    }
  };

  const handleColorChange = (color: string) => {
    if (selectedDrawing) {
      if (isTargetLayerLocked) return;
      updateDrawing(selectedDrawing.id, { color }, { recordHistory: true, commit: true });
    } else {
      setDrawingStyle({ color });
    }
  };

  const handleStrokeStyleChange = (strokeStyle: DrawingStrokeStyle) => {
    if (selectedDrawing) {
      if (isTargetLayerLocked) return;
      updateDrawing(selectedDrawing.id, { strokeStyle }, { recordHistory: true, commit: true });
    } else {
      setDrawingStyle({ strokeStyle });
    }
  };

  const handleSmoothToggle = () => {
    const nextSmooth = !activeSmooth;
    if (selectedDrawing) {
      if (isTargetLayerLocked) return;
      updateDrawing(selectedDrawing.id, { smooth: nextSmooth }, { recordHistory: true, commit: true });
    } else {
      setDrawingStyle({ smooth: nextSmooth });
    }
  };

  const handleLayerChange = (layerId: string) => {
    if (selectedDrawing) {
      if (isTargetLayerLocked) return;
      updateDrawing(selectedDrawing.id, { layerId }, { recordHistory: true, commit: true });
    } else {
      setActiveDrawingLayerId(layerId);
    }
  };

  const handleSliderPointerDown = () => {
    if (selectedDrawing && !isTargetLayerLocked && !sliderHistoryRecordedRef.current) {
      pushHistorySnapshot();
      sliderHistoryRecordedRef.current = true;
    }
  };

  const handleSliderPointerUp = () => {
    if (selectedDrawing && sliderHistoryRecordedRef.current) {
      sliderHistoryRecordedRef.current = false;
      commitDrawings();
    }
  };

  return (
    <div
      data-canvas-ui="true"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="absolute top-14 left-3 right-3 sm:left-4 sm:right-auto z-30 pointer-events-auto max-w-4xl"
    >
      <div className="rounded-2xl glass-panel-elevated border border-white/15 shadow-2xl p-2 sm:p-2.5 space-y-2 backdrop-blur-md">
        {/* Linha 1: Presets Cartográficos + Camada + Ações do Traço Selecionado */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Presets: Livre, Rio, Trilha, Parede */}
          <div
            className="flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/10"
            role="group"
            aria-label="Tipo de traço cartográfico"
          >
            {(Object.keys(DRAWING_PRESETS) as DrawingPreset[]).map((presetKey) => {
              const meta = DRAWING_PRESETS[presetKey];
              const Icon = PRESET_ICONS[presetKey];
              const isActive = activePreset === presetKey;
              return (
                <button
                  key={presetKey}
                  type="button"
                  disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
                  onClick={() => handlePresetClick(presetKey)}
                  className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  } disabled:opacity-40`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {/* Seletor de Camada de Desenho */}
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Camada do desenho"
              value={targetLayerId}
              disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
              onChange={(e) => handleLayerChange(e.target.value)}
              className="min-h-[36px] px-2.5 py-1 rounded-xl bg-black/50 border border-white/15 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
            >
              {layers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.locked ? `🔒 ${layer.name}` : layer.name}
                </option>
              ))}
            </select>

            {isTargetLayerLocked && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300 whitespace-nowrap">
                <Lock className="w-3.5 h-3.5" />
                <span>Camada bloqueada</span>
              </span>
            )}
          </div>

          {/* Ações diretas quando um desenho está selecionado */}
          {selectedDrawing && (
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                disabled={isTargetLayerLocked}
                onClick={() => bringDrawingToFront(selectedDrawing.id)}
                title="Trazer para frente"
                aria-label="Trazer desenho para frente"
                className="min-w-[36px] min-h-[36px] px-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center transition disabled:opacity-40"
              >
                <ArrowUpToLine className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={isTargetLayerLocked}
                onClick={() => sendDrawingToBack(selectedDrawing.id)}
                title="Enviar para trás"
                aria-label="Enviar desenho para trás"
                className="min-w-[36px] min-h-[36px] px-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center transition disabled:opacity-40"
              >
                <ArrowDownToLine className="w-4 h-4" />
              </button>
              {selectedDrawing.rotation !== 0 && (
                <button
                  type="button"
                  disabled={isTargetLayerLocked}
                  onClick={() =>
                    updateDrawing(
                      selectedDrawing.id,
                      { rotation: 0 },
                      { recordHistory: true, commit: true }
                    )
                  }
                  title="Zerar rotação"
                  aria-label="Zerar rotação"
                  className="min-h-[36px] px-2.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 text-xs font-mono tabular-nums flex items-center gap-1 transition disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{Math.round(selectedDrawing.rotation)}°</span>
                </button>
              )}
              <button
                type="button"
                disabled={isTargetLayerLocked}
                onClick={() => duplicateDrawing(selectedDrawing.id)}
                title="Duplicar desenho"
                aria-label="Duplicar desenho"
                className="min-w-[36px] min-h-[36px] px-2 rounded-xl bg-white/5 hover:bg-white/15 text-slate-200 flex items-center justify-center transition disabled:opacity-40"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={isTargetLayerLocked}
                onClick={() => deleteDrawing(selectedDrawing.id)}
                title="Excluir desenho (Delete)"
                aria-label="Excluir desenho"
                className="min-w-[36px] min-h-[36px] px-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 flex items-center justify-center transition disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => selectDrawing(null)}
                title="Concluir edição"
                aria-label="Desselecionar desenho"
                className="min-w-[36px] min-h-[36px] px-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Linha 2: Cores, Espessura, Estilo do traço, Curva e Opacidade */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-white/10">
          {/* Paleta de Cores */}
          <div className="flex items-center gap-1.5" role="group" aria-label="Cores do traço">
            {paletteColors.map((c) => {
              const isSelected = activeColor.toLowerCase() === c.toLowerCase();
              return (
                <button
                  key={c}
                  type="button"
                  disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
                  onClick={() => handleColorChange(c)}
                  aria-label={`Selecionar cor ${c}`}
                  className={`w-6 h-6 rounded-full border transition-transform shrink-0 ${
                    isSelected
                      ? 'border-white scale-115 ring-2 ring-cyan-400/60'
                      : 'border-white/25 hover:scale-110'
                  } disabled:opacity-40`}
                  style={{ backgroundColor: c }}
                />
              );
            })}

            {/* Seletor livre de cor */}
            <label
              title="Cor personalizada"
              className="w-6 h-6 rounded-full border border-white/30 overflow-hidden cursor-pointer shrink-0 relative"
              style={{ backgroundColor: activeColor }}
            >
              <input
                type="color"
                aria-label="Cor personalizada do desenho"
                disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
                value={activeColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
              />
            </label>
          </div>

          {/* Espessura */}
          <label className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="whitespace-nowrap">Espessura</span>
            <input
              type="range"
              min={2}
              max={24}
              step={0.5}
              disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
              value={activeStrokeWidth}
              onPointerDown={handleSliderPointerDown}
              onPointerUp={handleSliderPointerUp}
              onChange={(e) => {
                const strokeWidth = Number(e.target.value);
                if (selectedDrawing) {
                  updateDrawing(selectedDrawing.id, { strokeWidth }, { commit: false });
                } else {
                  setDrawingStyle({ strokeWidth });
                }
              }}
              className="w-20 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono tabular-nums text-[11px] text-cyan-300 w-9 text-right">
              {activeStrokeWidth}px
            </span>
          </label>

          {/* Opacidade */}
          <label className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="whitespace-nowrap">Opacidade</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
              value={activeOpacity}
              onPointerDown={handleSliderPointerDown}
              onPointerUp={handleSliderPointerUp}
              onChange={(e) => {
                const opacity = Number(e.target.value);
                if (selectedDrawing) {
                  updateDrawing(selectedDrawing.id, { opacity }, { commit: false });
                } else {
                  setDrawingStyle({ opacity });
                }
              }}
              className="w-16 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono tabular-nums text-[11px] text-slate-200 w-9 text-right">
              {Math.round(activeOpacity * 100)}%
            </span>
          </label>

          {/* Estilo Sólido / Tracejado / Pontilhado */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-black/40 border border-white/10">
            {STROKE_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
                onClick={() => handleStrokeStyleChange(opt.id)}
                className={`min-h-[30px] px-2 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 transition ${
                  activeStrokeStyle === opt.id
                    ? 'bg-white/15 text-white'
                    : 'text-slate-400 hover:text-white'
                } disabled:opacity-40`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Toggle Curva Suave vs Reta Angular */}
          <button
            type="button"
            disabled={Boolean(selectedDrawing && isTargetLayerLocked)}
            onClick={handleSmoothToggle}
            className={`min-h-[32px] px-2.5 rounded-xl text-[11px] font-semibold border whitespace-nowrap shrink-0 transition ${
              activeSmooth
                ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                : 'bg-black/40 border-white/15 text-slate-300 hover:text-white'
            } disabled:opacity-40`}
          >
            {activeSmooth ? 'Curva suave' : 'Traço angular'}
          </button>
        </div>
      </div>
    </div>
  );
};
