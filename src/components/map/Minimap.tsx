import { MapPin } from 'lucide-react';
import React, { useMemo } from 'react';
import { useMapStore } from '../../store/useMapStore';

export const Minimap: React.FC = () => {
  const { notes, layers, drawings, viewState, canvasViewport, focusCameraOn } = useMapStore();
  const [collapsed, setCollapsed] = React.useState(false);

  const visibleLayerIds = useMemo(
    () => new Set(layers.filter((l) => l.visible).map((l) => l.id)),
    [layers]
  );

  const visibleNotes = useMemo(
    () => notes.filter((n) => visibleLayerIds.has(n.layerId)),
    [notes, visibleLayerIds]
  );

  const visibleDrawings = useMemo(
    () => drawings.filter((d) => visibleLayerIds.has(d.layerId)),
    [drawings, visibleLayerIds]
  );

  // Compute bounding box of visible notes & drawings with margin
  const bounds = useMemo(() => {
    if (visibleNotes.length === 0 && visibleDrawings.length === 0) {
      return { minX: -500, maxX: 500, minY: -500, maxY: 500, w: 1000, h: 1000 };
    }
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    visibleNotes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });
    visibleDrawings.forEach((d) => {
      if (d.x < minX) minX = d.x;
      if (d.x + d.width > maxX) maxX = d.x + d.width;
      if (d.y < minY) minY = d.y;
      if (d.y + d.height > maxY) maxY = d.y + d.height;
    });

    const pad = 400;
    minX -= pad;
    maxX += pad;
    minY -= pad;
    maxY += pad;
    return {
      minX,
      maxX,
      minY,
      maxY,
      w: Math.max(800, maxX - minX),
      h: Math.max(600, maxY - minY),
    };
  }, [visibleNotes, visibleDrawings]);

  if (!viewState.showMinimap) return null;

  const mapW = 128;
  const mapH = 92;

  const toMapX = (x: number) => ((x - bounds.minX) / bounds.w) * mapW;
  const toMapY = (y: number) => ((y - bounds.minY) / bounds.h) * mapH;

  // Viewport box in canvas world coordinates using true container dimensions
  const vpW = canvasViewport.width / viewState.zoom;
  const vpH = canvasViewport.height / viewState.zoom;
  const vpX1 = -viewState.panX / viewState.zoom;
  const vpY1 = -viewState.panY / viewState.zoom;

  const vpBoxX = Math.max(0, Math.min(mapW - 6, toMapX(vpX1)));
  const vpBoxY = Math.max(0, Math.min(mapH - 6, toMapY(vpY1)));
  const vpBoxW = Math.max(6, Math.min(mapW - vpBoxX, (vpW / bounds.w) * mapW));
  const vpBoxH = Math.max(6, Math.min(mapH - vpBoxY, (vpH / bounds.h) * mapH));

  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const worldX = bounds.minX + (clickX / mapW) * bounds.w;
    const worldY = bounds.minY + (clickY / mapH) * bounds.h;

    focusCameraOn(worldX, worldY);
  };

  return (
    <div
      data-canvas-ui="true"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute top-16 right-3 z-30 pointer-events-auto flex flex-col items-end"
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="p-1 rounded-t-lg bg-black/60 border border-white/10 text-slate-400 hover:text-white text-[10px] flex items-center gap-1 px-1.5"
      >
        <MapPin className="w-3 h-3 text-cyan-400" />
        <span>Minimapa</span>
      </button>

      {!collapsed && (
        <div
          onClick={handleMinimapClick}
          className="relative rounded-b-xl rounded-tl-xl overflow-hidden glass-panel-elevated border border-white/15 cursor-crosshair shadow-lg"
          style={{ width: mapW, height: mapH, backgroundColor: '#07060dcc' }}
        >
          {/* Visible drawings representation */}
          {visibleDrawings.map((d) => (
            <div
              key={d.id}
              className="absolute rounded-xs pointer-events-none opacity-65"
              style={{
                left: toMapX(d.x),
                top: toMapY(d.y),
                width: Math.max(2, (d.width / bounds.w) * mapW),
                height: Math.max(2, (d.height / bounds.h) * mapH),
                backgroundColor: d.color,
              }}
            />
          ))}

          {/* Visible nodes representation */}
          {visibleNotes.map((n) => (
            <div
              key={n.id}
              className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
              style={{
                left: toMapX(n.x),
                top: toMapY(n.y),
                backgroundColor: n.color || '#22d3ee',
                boxShadow: `0 0 4px ${n.color || '#22d3ee'}`,
              }}
            />
          ))}

          {/* Viewport Box */}
          <div
            className="absolute border border-cyan-400 bg-cyan-400/15 pointer-events-none rounded-xs"
            style={{
              left: vpBoxX,
              top: vpBoxY,
              width: vpBoxW,
              height: vpBoxH,
            }}
          />
        </div>
      )}
    </div>
  );
};
