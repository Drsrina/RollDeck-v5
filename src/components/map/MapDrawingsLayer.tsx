import { Lock, RotateCw } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import {
  buildSvgPathD,
  computeRotatedResize,
  denormalizePoints,
  getStrokeDashArray,
  type ResizeHandle,
} from '../../lib/mapDrawing';
import { useMapStore } from '../../store/useMapStore';
import type { DrawingPoint, MapDrawing } from '../../types';

interface MapDrawingsLayerProps {
  zoom: number;
  draftPoints: DrawingPoint[] | null;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
}

type GizmoAction =
  | {
      type: 'move';
      drawingId: string;
      startWorld: DrawingPoint;
      initialX: number;
      initialY: number;
    }
  | {
      type: 'resize';
      drawingId: string;
      handle: ResizeHandle;
      startWorld: DrawingPoint;
      initialBox: { x: number; y: number; width: number; height: number; rotation: number };
    }
  | {
      type: 'rotate';
      drawingId: string;
      centerWorld: DrawingPoint;
    };

const RESIZE_HANDLES: {
  id: ResizeHandle;
  leftPct: number;
  topPct: number;
  cursor: string;
}[] = [
  { id: 'nw', leftPct: 0, topPct: 0, cursor: 'nwse-resize' },
  { id: 'n', leftPct: 50, topPct: 0, cursor: 'ns-resize' },
  { id: 'ne', leftPct: 100, topPct: 0, cursor: 'nesw-resize' },
  { id: 'e', leftPct: 100, topPct: 50, cursor: 'ew-resize' },
  { id: 'se', leftPct: 100, topPct: 100, cursor: 'nwse-resize' },
  { id: 's', leftPct: 50, topPct: 100, cursor: 'ns-resize' },
  { id: 'sw', leftPct: 0, topPct: 100, cursor: 'nesw-resize' },
  { id: 'w', leftPct: 0, topPct: 50, cursor: 'ew-resize' },
];

export const MapDrawingsLayer: React.FC<MapDrawingsLayerProps> = ({
  zoom,
  draftPoints,
  screenToWorld,
}) => {
  const {
    drawings,
    layers,
    canvasTool,
    selectedDrawingId,
    drawingStyle,
    viewState,
    selectDrawing,
    updateDrawing,
    commitDrawings,
    pushHistorySnapshot,
  } = useMapStore();

  const gizmoActionRef = useRef<GizmoAction | null>(null);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);

  const layersMap = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);

  const visibleDrawings = useMemo(() => {
    return drawings
      .filter((d) => {
        const layer = layersMap.get(d.layerId);
        return layer ? layer.visible : true;
      })
      .sort((a, b) => a.zIndex - b.zIndex);
  }, [drawings, layersMap]);

  const selectedDrawing = useMemo(
    () => visibleDrawings.find((d) => d.id === selectedDrawingId) || null,
    [visibleDrawings, selectedDrawingId]
  );

  const selectedLayerLocked = selectedDrawing
    ? Boolean(layersMap.get(selectedDrawing.layerId)?.locked)
    : false;

  const draftPathD = useMemo(() => {
    if (!draftPoints || draftPoints.length === 0) return '';
    return buildSvgPathD(draftPoints, drawingStyle.smooth);
  }, [draftPoints, drawingStyle.smooth]);

  // Escala inversa suave para manter alças visíveis e clicáveis em qualquer zoom
  const safeZoom = Math.max(0.25, Math.min(3, zoom));
  const invScale = 1 / safeZoom;
  const handleVisualPx = 11 * invScale;
  const handleHitboxPx = 28 * invScale;
  const rotateStemPx = 28 * invScale;

  const startMove = (e: React.PointerEvent, drawing: MapDrawing) => {
    e.stopPropagation();
    const layer = layersMap.get(drawing.layerId);
    if (layer?.locked) {
      selectDrawing(drawing.id);
      return;
    }

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    pushHistorySnapshot();
    const startWorld = screenToWorld(e.clientX, e.clientY);
    gizmoActionRef.current = {
      type: 'move',
      drawingId: drawing.id,
      startWorld,
      initialX: drawing.x,
      initialY: drawing.y,
    };
  };

  const startResize = (
    e: React.PointerEvent,
    drawing: MapDrawing,
    handle: ResizeHandle
  ) => {
    e.stopPropagation();
    if (selectedLayerLocked) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    pushHistorySnapshot();
    const startWorld = screenToWorld(e.clientX, e.clientY);
    gizmoActionRef.current = {
      type: 'resize',
      drawingId: drawing.id,
      handle,
      startWorld,
      initialBox: {
        x: drawing.x,
        y: drawing.y,
        width: drawing.width,
        height: drawing.height,
        rotation: drawing.rotation,
      },
    };
  };

  const startRotate = (e: React.PointerEvent, drawing: MapDrawing) => {
    e.stopPropagation();
    if (selectedLayerLocked) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    pushHistorySnapshot();
    gizmoActionRef.current = {
      type: 'rotate',
      drawingId: drawing.id,
      centerWorld: {
        x: drawing.x + drawing.width / 2,
        y: drawing.y + drawing.height / 2,
      },
    };
    setLiveAngle(Math.round(drawing.rotation));
  };

  const handleGizmoPointerMove = (e: React.PointerEvent) => {
    const action = gizmoActionRef.current;
    if (!action) return;
    e.stopPropagation();

    const currentWorld = screenToWorld(e.clientX, e.clientY);

    if (action.type === 'move') {
      const dx = currentWorld.x - action.startWorld.x;
      const dy = currentWorld.y - action.startWorld.y;
      let nextX = action.initialX + dx;
      let nextY = action.initialY + dy;

      if (viewState.snapToGrid) {
        nextX = Math.round(nextX / 20) * 20;
        nextY = Math.round(nextY / 20) * 20;
      }

      updateDrawing(
        action.drawingId,
        { x: Math.round(nextX * 100) / 100, y: Math.round(nextY * 100) / 100 },
        { commit: false }
      );
      return;
    }

    if (action.type === 'resize') {
      const dxWorld = currentWorld.x - action.startWorld.x;
      const dyWorld = currentWorld.y - action.startWorld.y;
      const resized = computeRotatedResize(
        action.initialBox,
        action.handle,
        dxWorld,
        dyWorld,
        { minSize: 16, keepAspect: e.shiftKey }
      );
      updateDrawing(action.drawingId, resized, { commit: false });
      return;
    }

    if (action.type === 'rotate') {
      const rad = Math.atan2(
        currentWorld.y - action.centerWorld.y,
        currentWorld.x - action.centerWorld.x
      );
      let deg = (rad * 180) / Math.PI + 90;
      if (e.shiftKey) {
        deg = Math.round(deg / 15) * 15;
      } else {
        deg = Math.round(deg);
      }
      // Normaliza para -180..180 ou 0..359
      deg = ((deg % 360) + 360) % 360;
      setLiveAngle(deg);
      updateDrawing(action.drawingId, { rotation: deg }, { commit: false });
    }
  };

  const handleGizmoPointerUp = (e: React.PointerEvent) => {
    const action = gizmoActionRef.current;
    if (!action) return;
    e.stopPropagation();
    gizmoActionRef.current = null;
    setLiveAngle(null);
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}
    commitDrawings();
  };

  const handleGizmoPointerCancel = (e: React.PointerEvent) => {
    if (!gizmoActionRef.current) return;
    e.stopPropagation();
    gizmoActionRef.current = null;
    setLiveAngle(null);
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}
    commitDrawings();
  };

  const canSelectDrawings = canvasTool === 'select-drawing';

  return (
    <>
      {/* Camada de traços SVG renderizados (abaixo dos links e nós das notas) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 5 }}
      >
        {visibleDrawings.map((drawing) => {
          const localPoints = denormalizePoints(drawing.points, drawing.width, drawing.height);
          const pathD = buildSvgPathD(localPoints, drawing.smooth);
          const dashArray = getStrokeDashArray(drawing.strokeStyle, drawing.strokeWidth);
          const isSelected = drawing.id === selectedDrawingId;
          const layerLocked = Boolean(layersMap.get(drawing.layerId)?.locked);

          return (
            <svg
              key={drawing.id}
              width={drawing.width}
              height={drawing.height}
              viewBox={`0 0 ${drawing.width} ${drawing.height}`}
              style={{
                position: 'absolute',
                left: `${drawing.x}px`,
                top: `${drawing.y}px`,
                width: `${drawing.width}px`,
                height: `${drawing.height}px`,
                overflow: 'visible',
                transform: `rotate(${drawing.rotation}deg)`,
                transformOrigin: 'center center',
                pointerEvents: canSelectDrawings ? 'auto' : 'none',
              }}
            >
              {/* Halo sutil ao selecionar */}
              {isSelected && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth={drawing.strokeWidth + 6 * invScale}
                  strokeOpacity={0.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none"
                />
              )}

              {/* Traço vetorial principal */}
              <path
                d={pathD}
                fill="none"
                stroke={drawing.color}
                strokeWidth={drawing.strokeWidth}
                strokeOpacity={drawing.opacity}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                strokeLinejoin={drawing.smooth ? 'round' : 'miter'}
                className="pointer-events-none"
              />

              {/* Hitbox invisível para seleção/arraste confortável */}
              {canSelectDrawings && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(22 * invScale, drawing.strokeWidth + 16 * invScale)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    cursor: layerLocked ? 'not-allowed' : 'move',
                    pointerEvents: 'stroke',
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    selectDrawing(drawing.id);
                    if (!layerLocked) {
                      startMove(e, drawing);
                    }
                  }}
                  onPointerMove={handleGizmoPointerMove}
                  onPointerUp={handleGizmoPointerUp}
                  onPointerCancel={handleGizmoPointerCancel}
                />
              )}
            </svg>
          );
        })}

        {/* Preview ao vivo durante desenho com caneta livre */}
        {draftPoints && draftPoints.length > 0 && (
          <svg
            className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          >
            <path
              d={draftPathD}
              fill="none"
              stroke={drawingStyle.color}
              strokeWidth={drawingStyle.strokeWidth}
              strokeOpacity={drawingStyle.opacity}
              strokeDasharray={getStrokeDashArray(
                drawingStyle.strokeStyle,
                drawingStyle.strokeWidth
              )}
              strokeLinecap="round"
              strokeLinejoin={drawingStyle.smooth ? 'round' : 'miter'}
            />
          </svg>
        )}
      </div>

      {/* Gizmo de Transformação (Seleção, Movimento, Redimensionamento e Rotação) */}
      {selectedDrawing && (
        <div
          style={{
            position: 'absolute',
            left: `${selectedDrawing.x}px`,
            top: `${selectedDrawing.y}px`,
            width: `${selectedDrawing.width}px`,
            height: `${selectedDrawing.height}px`,
            transform: `rotate(${selectedDrawing.rotation}deg)`,
            transformOrigin: 'center center',
            zIndex: 40,
            borderWidth: `${1.5 * invScale}px`,
            borderStyle: 'dashed',
            borderColor: selectedLayerLocked ? '#f59e0b' : '#22d3ee',
          }}
          className="pointer-events-auto"
          onPointerDown={(e) => {
            if (!selectedLayerLocked) {
              startMove(e, selectedDrawing);
            } else {
              e.stopPropagation();
            }
          }}
          onPointerMove={handleGizmoPointerMove}
          onPointerUp={handleGizmoPointerUp}
          onPointerCancel={handleGizmoPointerCancel}
        >
          {/* Indicador de camada travada */}
          {selectedLayerLocked && (
            <div
              style={{
                transform: `scale(${invScale})`,
                transformOrigin: 'top left',
              }}
              className="absolute -top-7 left-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/90 text-black text-[10px] font-bold whitespace-nowrap pointer-events-none"
            >
              <Lock className="w-3 h-3" />
              <span>Camada travada</span>
            </div>
          )}

          {/* Alça de Rotação (topo central) */}
          {!selectedLayerLocked && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: `-${rotateStemPx}px`,
                width: `${1.5 * invScale}px`,
                height: `${rotateStemPx}px`,
                backgroundColor: '#22d3ee',
                transform: 'translateX(-50%)',
              }}
              className="pointer-events-none"
            />
          )}

          {!selectedLayerLocked && (
            <button
              type="button"
              aria-label="Girar desenho"
              title="Girar desenho (Shift para passos de 15°)"
              onPointerDown={(e) => startRotate(e, selectedDrawing)}
              onPointerMove={handleGizmoPointerMove}
              onPointerUp={handleGizmoPointerUp}
              onPointerCancel={handleGizmoPointerCancel}
              style={{
                position: 'absolute',
                left: '50%',
                top: `-${rotateStemPx + handleHitboxPx / 2}px`,
                width: `${handleHitboxPx}px`,
                height: `${handleHitboxPx}px`,
                transform: 'translateX(-50%)',
                cursor: 'grab',
              }}
              className="flex items-center justify-center bg-transparent"
            >
              <span
                style={{
                  width: `${18 * invScale}px`,
                  height: `${18 * invScale}px`,
                  borderWidth: `${1.5 * invScale}px`,
                }}
                className="rounded-full bg-slate-950 border-cyan-400 text-cyan-300 flex items-center justify-center shadow-md"
              >
                <RotateCw
                  style={{
                    width: `${10 * invScale}px`,
                    height: `${10 * invScale}px`,
                  }}
                />
              </span>

              {liveAngle !== null && (
                <span
                  style={{
                    transform: `translateY(-${22 * invScale}px) scale(${invScale})`,
                  }}
                  className="absolute px-1.5 py-0.5 rounded bg-slate-950/95 border border-cyan-400/50 text-cyan-200 text-[11px] font-mono tabular-nums whitespace-nowrap pointer-events-none"
                >
                  {liveAngle}°
                </span>
              )}
            </button>
          )}

          {/* 8 Alças de Redimensionamento (cantos e bordas) */}
          {!selectedLayerLocked &&
            RESIZE_HANDLES.map((h) => (
              <button
                key={h.id}
                type="button"
                aria-label={`Redimensionar ${h.id}`}
                onPointerDown={(e) => startResize(e, selectedDrawing, h.id)}
                onPointerMove={handleGizmoPointerMove}
                onPointerUp={handleGizmoPointerUp}
                onPointerCancel={handleGizmoPointerCancel}
                style={{
                  position: 'absolute',
                  left: `${h.leftPct}%`,
                  top: `${h.topPct}%`,
                  width: `${handleHitboxPx}px`,
                  height: `${handleHitboxPx}px`,
                  transform: 'translate(-50%, -50%)',
                  cursor: h.cursor,
                }}
                className="flex items-center justify-center bg-transparent"
              >
                <span
                  style={{
                    width: `${handleVisualPx}px`,
                    height: `${handleVisualPx}px`,
                    borderWidth: `${1.5 * invScale}px`,
                    borderRadius: `${2.5 * invScale}px`,
                  }}
                  className="bg-white border-cyan-500 shadow-sm pointer-events-none"
                />
              </button>
            ))}
        </div>
      )}
    </>
  );
};
