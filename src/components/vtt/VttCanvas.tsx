import { Compass, EyeOff, Lock, Plus, Shield, Swords, Users } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isGmOrAdmin, useAuthSession } from '../../lib/authSession';
import {
  getHexPolygonPoints,
  getVisibleHexCenters,
  measureGridDistance,
  snapPointToGrid,
  type Point2D,
} from '../../lib/vttGrid';
import { useVttStore } from '../../store/useVttStore';
import {
  VTT_CONDITIONS,
  VTT_SURFACE_PRESETS,
  type VttScene,
  type VttToken,
} from '../../types/vtt';
import { VttWeatherOverlay } from './VttWeatherOverlay';

interface VttCanvasProps {
  scene: VttScene;
  canImportFromGmModules?: boolean;
  onOpenNewToken: () => void;
  onOpenImportCharacters: () => void;
  onOpenImportEncounter: () => void;
}

interface DragTokenState {
  tokenId: string;
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  curX: number;
  curY: number;
  snappedX: number;
  snappedY: number;
  moved: boolean;
}

interface RulerState {
  pointerId: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface PanState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  origCamX: number;
  origCamY: number;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const VttCanvas: React.FC<VttCanvasProps> = ({
  scene,
  canImportFromGmModules = true,
  onOpenNewToken,
  onOpenImportCharacters,
  onOpenImportEncounter,
}) => {
  const { user: currentUser } = useAuthSession();
  const canSeeHidden = isGmOrAdmin(currentUser);
  const isViewer = currentUser?.role === 'viewer';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 1000, height: 680 });

  const {
    activeTool,
    selectedTokenId,
    selectToken,
    moveToken,
    setCamera,
    cameraFocusRequest,
  } = useVttStore();

  const [dragToken, setDragToken] = useState<DragTokenState | null>(null);
  const [ruler, setRuler] = useState<RulerState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [bgLoadError, setBgLoadError] = useState(false);

  const cameraRef = useRef(scene.camera);
  cameraRef.current = scene.camera;

  const activePointersRef = useRef<Map<number, Point2D>>(new Map());
  const pinchStartRef = useRef<{
    dist: number;
    zoom: number;
    camX: number;
    camY: number;
    midClientX: number;
    midClientY: number;
  } | null>(null);

  // Reset transient interaction state if the user switches scenes mid-drag
  useEffect(() => {
    setDragToken(null);
    setRuler(null);
    setPanState(null);
    activePointersRef.current.clear();
    pinchStartRef.current = null;
  }, [scene.id]);

  // Reset image error state whenever background changes
  useEffect(() => {
    setBgLoadError(false);
  }, [scene.background?.dataUrl]);

  // Measure container dynamically
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setViewport({
        width: Math.max(300, el.clientWidth),
        height: Math.max(300, el.clientHeight),
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Spacebar temporary pan mode (with window blur safeguard)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    const onBlur = () => setSpacePressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Native non-passive wheel listener for smooth cursor-centered zoom without console warnings
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cam = cameraRef.current;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      const nextZoom = Math.min(2.5, Math.max(0.35, cam.zoom * factor));
      const sx = e.clientX - rect.left - rect.width / 2;
      const sy = e.clientY - rect.top - rect.height / 2;

      const worldBeforeX = sx / cam.zoom - cam.x;
      const worldBeforeY = sy / cam.zoom - cam.y;
      const nextCamX = sx / nextZoom - worldBeforeX;
      const nextCamY = sy / nextZoom - worldBeforeY;

      setCamera({ x: nextCamX, y: nextCamY, zoom: nextZoom });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setCamera]);

  // Smooth camera center request (e.g., when clicking combatant or importing tokens)
  useEffect(() => {
    if (!cameraFocusRequest) return;
    setCamera({
      x: -cameraFocusRequest.x,
      y: -cameraFocusRequest.y,
      zoom: cameraRef.current.zoom,
    });
  }, [cameraFocusRequest, setCamera]);

  const { camera, grid } = scene;
  const surface = VTT_SURFACE_PRESETS[scene.surfacePreset] || VTT_SURFACE_PRESETS.slate;

  // Screen client coords -> World coords
  const clientToWorld = (clientX: number, clientY: number): Point2D => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const sx = clientX - rect.left - rect.width / 2;
    const sy = clientY - rect.top - rect.height / 2;
    return {
      x: sx / camera.zoom - camera.x,
      y: sy / camera.zoom - camera.y,
    };
  };

  // Compute visible world bounding box for SVG grid rendering
  const visibleBounds = useMemo(() => {
    const halfW = viewport.width / (2 * camera.zoom) + grid.cellSize * 2;
    const halfH = viewport.height / (2 * camera.zoom) + grid.cellSize * 2;
    return {
      minX: -camera.x - halfW,
      maxX: -camera.x + halfW,
      minY: -camera.y - halfH,
      maxY: -camera.y + halfH,
    };
  }, [viewport.width, viewport.height, camera.x, camera.y, camera.zoom, grid.cellSize]);

  // Visible hex centers (culled to viewport for crisp 60fps performance)
  const visibleHexes = useMemo(() => {
    if (grid.type !== 'hex') return [];
    return getVisibleHexCenters(
      visibleBounds.minX,
      visibleBounds.maxX,
      visibleBounds.minY,
      visibleBounds.maxY,
      grid.cellSize,
      900
    );
  }, [grid.type, grid.cellSize, visibleBounds]);

  // Start pan, pinch, or ruler on arena background
  const handleArenaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Never steal pointer capture from UI overlays or buttons rendered above the arena
    const targetEl = e.target as HTMLElement | null;
    if (targetEl?.closest('button, input, select, textarea, a, [data-vtt-ui="true"]')) {
      return;
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Two-finger pinch-to-zoom on touch devices
    if (activePointersRef.current.size === 2) {
      const [p1, p2] = Array.from(activePointersRef.current.values());
      const dist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      pinchStartRef.current = {
        dist,
        zoom: camera.zoom,
        camX: camera.x,
        camY: camera.y,
        midClientX: (p1.x + p2.x) / 2,
        midClientY: (p1.y + p2.y) / 2,
      };
      setPanState(null);
      setDragToken(null);
      setRuler(null);
      return;
    }

    if (e.button === 1 || activeTool === 'pan' || spacePressed) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setPanState({
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origCamX: camera.x,
        origCamY: camera.y,
      });
      return;
    }

    if (e.button !== 0) return;

    const world = clientToWorld(e.clientX, e.clientY);

    if (activeTool === 'ruler' || e.shiftKey) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const start = grid.snapToGrid ? snapPointToGrid(world.x, world.y, grid, 1) : world;
      setRuler({
        pointerId: e.pointerId,
        startX: start.x,
        startY: start.y,
        endX: start.x,
        endY: start.y,
      });
      return;
    }

    // Empty arena drag pans smoothly and deselects active token
    selectToken(null);
    e.currentTarget.setPointerCapture(e.pointerId);
    setPanState({
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origCamX: camera.x,
      origCamY: camera.y,
    });
  };

  // Start dragging or selecting a token
  const handleTokenPointerDown = (e: React.PointerEvent<HTMLDivElement>, token: VttToken) => {
    if (e.button === 1 || activeTool === 'pan' || spacePressed) {
      return; // Bubble to arena pan
    }

    if (activeTool === 'ruler' || e.shiftKey) {
      e.stopPropagation();
      e.preventDefault();
      containerRef.current?.setPointerCapture(e.pointerId);
      setRuler({
        pointerId: e.pointerId,
        startX: token.x,
        startY: token.y,
        endX: token.x,
        endY: token.y,
      });
      return;
    }

    if (e.button !== 0) return;
    e.stopPropagation();

    if (token.locked || isViewer) {
      // Immediately open Inspector for locked tokens so users can inspect or unlock in one click
      selectToken(token.id, !isViewer);
      return;
    }

    selectToken(token.id);

    const world = clientToWorld(e.clientX, e.clientY);
    containerRef.current?.setPointerCapture(e.pointerId);
    setDragToken({
      tokenId: token.id,
      pointerId: e.pointerId,
      startX: world.x,
      startY: world.y,
      origX: token.x,
      origY: token.y,
      curX: token.x,
      curY: token.y,
      snappedX: token.x,
      snappedY: token.y,
      moved: false,
    });
  };

  const handleArenaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinchStartRef.current && activePointersRef.current.size === 2) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const [p1, p2] = Array.from(activePointersRef.current.values());
      const curDist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const scaleRatio = curDist / pinchStartRef.current.dist;
      const nextZoom = Math.min(2.5, Math.max(0.35, pinchStartRef.current.zoom * scaleRatio));

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const startSx = pinchStartRef.current.midClientX - rect.left - rect.width / 2;
      const startSy = pinchStartRef.current.midClientY - rect.top - rect.height / 2;
      const curSx = midX - rect.left - rect.width / 2;
      const curSy = midY - rect.top - rect.height / 2;

      const worldAnchorX = startSx / pinchStartRef.current.zoom - pinchStartRef.current.camX;
      const worldAnchorY = startSy / pinchStartRef.current.zoom - pinchStartRef.current.camY;

      setCamera({
        x: curSx / nextZoom - worldAnchorX,
        y: curSy / nextZoom - worldAnchorY,
        zoom: nextZoom,
      });
      return;
    }

    if (panState && e.pointerId === panState.pointerId) {
      const dx = (e.clientX - panState.startClientX) / camera.zoom;
      const dy = (e.clientY - panState.startClientY) / camera.zoom;
      setCamera({
        x: panState.origCamX + dx,
        y: panState.origCamY + dy,
        zoom: camera.zoom,
      });
      return;
    }

    if (ruler && e.pointerId === ruler.pointerId) {
      const world = clientToWorld(e.clientX, e.clientY);
      const end = grid.snapToGrid ? snapPointToGrid(world.x, world.y, grid, 1) : world;
      setRuler((prev) => (prev ? { ...prev, endX: end.x, endY: end.y } : null));
      return;
    }

    if (dragToken && e.pointerId === dragToken.pointerId) {
      const token = scene.tokens.find((t) => t.id === dragToken.tokenId);
      if (!token) return;
      const world = clientToWorld(e.clientX, e.clientY);
      const rawX = dragToken.origX + (world.x - dragToken.startX);
      const rawY = dragToken.origY + (world.y - dragToken.startY);
      const snapped = snapPointToGrid(rawX, rawY, grid, token.sizeCells);
      const moved = Math.hypot(rawX - dragToken.origX, rawY - dragToken.origY) > 4;
      setDragToken((prev) =>
        prev
          ? {
              ...prev,
              curX: rawX,
              curY: rawY,
              snappedX: snapped.x,
              snappedY: snapped.y,
              moved: prev.moved || moved,
            }
          : null
      );
    }
  };

  const handleArenaPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if pointer capture already ended
    }

    if (panState && e.pointerId === panState.pointerId) {
      setPanState(null);
      return;
    }

    if (ruler && e.pointerId === ruler.pointerId) {
      setRuler(null);
      return;
    }

    if (dragToken && e.pointerId === dragToken.pointerId) {
      if (dragToken.moved) {
        moveToken(dragToken.tokenId, dragToken.snappedX, dragToken.snappedY, false);
      } else {
        selectToken(dragToken.tokenId, true);
      }
      setDragToken(null);
    }
  };

  // Live ruler / drag distance readout
  const activeRulerMeasure = useMemo(() => {
    if (ruler) {
      return {
        ax: ruler.startX,
        ay: ruler.startY,
        bx: ruler.endX,
        by: ruler.endY,
        distance: measureGridDistance(ruler.startX, ruler.startY, ruler.endX, ruler.endY, grid),
      };
    }
    if (dragToken && dragToken.moved) {
      return {
        ax: dragToken.origX,
        ay: dragToken.origY,
        bx: dragToken.snappedX,
        by: dragToken.snappedY,
        distance: measureGridDistance(
          dragToken.origX,
          dragToken.origY,
          dragToken.snappedX,
          dragToken.snappedY,
          grid
        ),
      };
    }
    return null;
  }, [ruler, dragToken, grid]);

  const cursorClass =
    panState || activeTool === 'pan' || spacePressed
      ? panState
        ? 'cursor-grabbing'
        : 'cursor-grab'
      : activeTool === 'ruler'
      ? 'cursor-crosshair'
      : 'cursor-default';

  const draggedTokenObj = dragToken ? scene.tokens.find((t) => t.id === dragToken.tokenId) : null;
  const conditionMap = useMemo(() => new Map(VTT_CONDITIONS.map((c) => [c.id, c])), []);

  return (
    <div
      ref={containerRef}
      onPointerDown={handleArenaPointerDown}
      onPointerMove={handleArenaPointerMove}
      onPointerUp={handleArenaPointerUp}
      onPointerCancel={handleArenaPointerUp}
      className={`relative flex-1 h-full overflow-hidden select-none touch-none ${cursorClass}`}
      style={{
        backgroundColor: surface.bg,
        backgroundImage: `radial-gradient(circle at 50% 45%, ${surface.accent} 0%, ${surface.bg} 78%)`,
      }}
    >
      {/* World Space Transform Layer (GPU-composited) */}
      <div
        className="absolute left-1/2 top-1/2 will-change-transform"
        style={{
          transform: `translate3d(${camera.x * camera.zoom}px, ${camera.y * camera.zoom}px, 0) scale(${camera.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* 1. Optional Uploaded Battlemap Background Image */}
        {scene.background && !bgLoadError && (
          <img
            src={scene.background.dataUrl}
            alt={scene.background.name || 'Mapa de batalha'}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={() => setBgLoadError(true)}
            className="pointer-events-none select-none max-w-none absolute"
            style={{
              left: `${scene.background.x}px`,
              top: `${scene.background.y}px`,
              width: `${scene.background.width * scene.background.scale}px`,
              height: `${scene.background.height * scene.background.scale}px`,
              transform: 'translate(-50%, -50%)',
              opacity: scene.background.opacity,
            }}
          />
        )}

        {/* 2. Vector Tactical Grid (Square Pattern or Culled Pointy-Top Hexagons) */}
        {grid.type !== 'none' && (
          <svg
            className="pointer-events-none overflow-visible absolute left-0 top-0"
            width="1"
            height="1"
          >
            {grid.type === 'square' && (
              <>
                <defs>
                  <pattern
                    id={`vtt-sq-grid-${scene.id}`}
                    width={grid.cellSize}
                    height={grid.cellSize}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d={`M ${grid.cellSize} 0 L 0 0 0 ${grid.cellSize}`}
                      fill="none"
                      stroke={grid.color}
                      strokeOpacity={grid.opacity}
                      strokeWidth={Math.max(0.75, 1 / camera.zoom)}
                    />
                  </pattern>
                </defs>
                <rect
                  x={visibleBounds.minX}
                  y={visibleBounds.minY}
                  width={visibleBounds.maxX - visibleBounds.minX}
                  height={visibleBounds.maxY - visibleBounds.minY}
                  fill={`url(#vtt-sq-grid-${scene.id})`}
                />
              </>
            )}

            {grid.type === 'hex' && (
              <g
                fill="none"
                stroke={grid.color}
                strokeOpacity={grid.opacity}
                strokeWidth={Math.max(0.75, 1 / camera.zoom)}
              >
                {visibleHexes.map((h) => (
                  <polygon
                    key={`${h.q}:${h.r}`}
                    points={getHexPolygonPoints(h.x, h.y, grid.cellSize)}
                  />
                ))}
              </g>
            )}

            {/* Subtle origin crosshair */}
            <g stroke={grid.color} strokeOpacity={Math.min(0.45, grid.opacity * 1.4)} strokeWidth={1.2}>
              <line x1={-10} y1={0} x2={10} y2={0} />
              <line x1={0} y1={-10} x2={0} y2={10} />
            </g>

            {/* Snap Target Ghost Preview while dragging a token */}
            {dragToken && dragToken.moved && draggedTokenObj && grid.snapToGrid && (
              <g pointerEvents="none">
                {grid.type === 'hex' ? (
                  <polygon
                    points={getHexPolygonPoints(
                      dragToken.snappedX,
                      dragToken.snappedY,
                      grid.cellSize * draggedTokenObj.sizeCells
                    )}
                    fill={draggedTokenObj.color}
                    fillOpacity={0.14}
                    stroke={draggedTokenObj.color}
                    strokeOpacity={0.75}
                    strokeWidth={2 / camera.zoom}
                    strokeDasharray={`${5 / camera.zoom} ${4 / camera.zoom}`}
                  />
                ) : (
                  <rect
                    x={dragToken.snappedX - (grid.cellSize * draggedTokenObj.sizeCells) / 2}
                    y={dragToken.snappedY - (grid.cellSize * draggedTokenObj.sizeCells) / 2}
                    width={grid.cellSize * draggedTokenObj.sizeCells}
                    height={grid.cellSize * draggedTokenObj.sizeCells}
                    rx={6}
                    fill={draggedTokenObj.color}
                    fillOpacity={0.14}
                    stroke={draggedTokenObj.color}
                    strokeOpacity={0.75}
                    strokeWidth={2 / camera.zoom}
                    strokeDasharray={`${5 / camera.zoom} ${4 / camera.zoom}`}
                  />
                )}
              </g>
            )}
          </svg>
        )}

        {/* 3. Tactical Tokens Layer */}
        {scene.tokens.map((token) => {
          if (!canSeeHidden && token.hidden) return null;
          const isBeingDragged = dragToken?.tokenId === token.id;
          const posX = isBeingDragged ? dragToken.curX : token.x;
          const posY = isBeingDragged ? dragToken.curY : token.y;
          const footprint = Math.max(40, grid.cellSize * token.sizeCells * 0.88);
          const isSelected = selectedTokenId === token.id;
          const isActiveTurn = scene.combat.active && scene.combat.activeTokenId === token.id;
          const hpRatio = token.hpMax > 0 ? Math.max(0, Math.min(1, token.hpCurrent / token.hpMax)) : 0;
          const isDowned = token.hpCurrent <= 0;
          const isBloodied =
            !isDowned && token.hpCurrent <= (token.bloodiedThreshold ?? Math.floor(token.hpMax / 2));

          return (
            <div
              key={token.id}
              onPointerDown={(e) => handleTokenPointerDown(e, token)}
              onDoubleClick={(e) => {
                e.stopPropagation();
                selectToken(token.id, true);
              }}
              className={`absolute flex flex-col items-center justify-center transition-shadow ${
                token.locked ? 'cursor-pointer' : isBeingDragged ? 'cursor-grabbing z-30' : 'cursor-grab'
              } ${isSelected ? 'z-20' : isActiveTurn ? 'z-15' : 'z-10'}`}
              style={{
                left: `${posX}px`,
                top: `${posY}px`,
                width: `${footprint}px`,
                height: `${footprint}px`,
                transform: 'translate(-50%, -50%)',
                opacity: token.hidden ? 0.48 : 1,
              }}
            >
              {/* Active Combat Turn Halo */}
              {isActiveTurn && (
                <div
                  className="absolute -inset-2 rounded-full border-2 border-cyan-400 pointer-events-none"
                  style={{
                    boxShadow: '0 0 22px rgba(34, 211, 238, 0.55)',
                  }}
                />
              )}

              {/* Selection Ring */}
              {isSelected && (
                <div
                  className="absolute -inset-1.5 rounded-full border-2 border-white pointer-events-none"
                  style={{
                    boxShadow: `0 0 14px ${token.color}99`,
                  }}
                />
              )}

              {/* Active Turn Label */}
              {isActiveTurn && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 font-mono text-[9px] font-black tracking-wider whitespace-nowrap pointer-events-none shadow">
                  TURNO
                </div>
              )}

              {/* Main Circular Token Medallion */}
              <div
                className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center border-[3px] shadow-xl bg-slate-900"
                style={{
                  borderColor: isDowned ? '#475569' : token.color,
                  filter: isDowned ? 'grayscale(0.85) brightness(0.75)' : undefined,
                }}
              >
                {token.avatarUrl ? (
                  <img
                    src={token.avatarUrl}
                    alt={token.name}
                    referrerPolicy="no-referrer"
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-black tracking-tight text-white select-none"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, ${token.color}55, #0f172a 85%)`,
                      fontSize: `${Math.max(13, Math.round(footprint * 0.34))}px`,
                    }}
                  >
                    {getInitials(token.name)}
                  </div>
                )}

                {/* Downed Overlay */}
                {isDowned && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center pointer-events-none">
                    <span className="font-mono text-[10px] font-black text-rose-300 tracking-wider">
                      CAÍDO
                    </span>
                  </div>
                )}
              </div>

              {/* Top-Right AC Shield Badge */}
              {token.faction !== 'object' && (
                <div
                  className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 border border-slate-600/80 text-[10px] font-mono font-bold tabular-nums text-slate-100 flex items-center gap-0.5 shadow pointer-events-none"
                  title={`Classe de Armadura: ${token.ac}`}
                >
                  <Shield className="w-2.5 h-2.5 text-cyan-300" />
                  <span>{token.ac}</span>
                </div>
              )}

              {/* Lock & Hidden Indicators (top-left) */}
              {(token.locked || token.hidden) && (
                <div className="absolute -top-1 -left-1 flex items-center gap-0.5 pointer-events-none">
                  {token.locked && (
                    <div
                      className="p-0.5 rounded bg-slate-950/90 border border-white/20 text-amber-300"
                      title="Token travado"
                    >
                      <Lock className="w-2.5 h-2.5" />
                    </div>
                  )}
                  {token.hidden && (
                    <div
                      className="p-0.5 rounded bg-slate-950/90 border border-purple-400/40 text-purple-300"
                      title="Token oculto"
                    >
                      <EyeOff className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>
              )}

              {/* Bottom HP Bar + Nameplate */}
              <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none">
                {token.faction !== 'object' && (
                  <div
                    className="bg-slate-950/95 border border-white/15 rounded px-1 py-0.5 shadow-lg"
                    style={{ width: `${Math.min(124, Math.max(66, Math.round(footprint * 1.15)))}px` }}
                  >
                    <div className="h-1.5 w-full rounded-sm bg-slate-800 overflow-hidden">
                      <div
                        className="h-full transition-all duration-150"
                        style={{
                          width: `${hpRatio * 100}%`,
                          backgroundColor: isDowned
                            ? '#64748b'
                            : isBloodied
                            ? '#f59e0b'
                            : token.faction === 'ally'
                            ? '#10b981'
                            : '#f43f5e',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-mono tabular-nums leading-none mt-0.5 text-slate-200">
                      <span>
                        {token.hpCurrent}/{token.hpMax}
                        {token.hpTemp > 0 ? `+${token.hpTemp}` : ''}
                      </span>
                      {isBloodied && <span className="text-amber-300 font-bold">SNG</span>}
                    </div>
                  </div>
                )}

                <div className="max-w-[116px] px-1.5 py-0.5 rounded bg-slate-950/90 border border-white/10 text-[10px] font-semibold text-white truncate shadow">
                  {token.name}
                </div>

                {/* Active Conditions */}
                {token.conditions.length > 0 && (
                  <div className="flex items-center justify-center gap-0.5 flex-wrap max-w-[120px]">
                    {token.conditions.slice(0, 3).map((condId) => {
                      const meta = conditionMap.get(condId);
                      return (
                        <span
                          key={condId}
                          className="px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-slate-950/95 border"
                          style={{
                            borderColor: meta?.color || '#94a3b8',
                            color: meta?.color || '#e2e8f0',
                          }}
                        >
                          {meta?.short || condId.slice(0, 3).toUpperCase()}
                        </span>
                      );
                    })}
                    {token.conditions.length > 3 && (
                      <span className="px-1 rounded text-[8px] font-mono bg-slate-950 text-slate-300 border border-white/15">
                        +{token.conditions.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* 4. Distance Ruler & Live Drag Movement Trail */}
        {activeRulerMeasure && (ruler || activeRulerMeasure.distance.cells > 0) && (
          <>
            <svg
              className="pointer-events-none overflow-visible absolute left-0 top-0 z-40"
              width="1"
              height="1"
            >
              {activeRulerMeasure.distance.cells > 0 && (
                <line
                  x1={activeRulerMeasure.ax}
                  y1={activeRulerMeasure.ay}
                  x2={activeRulerMeasure.bx}
                  y2={activeRulerMeasure.by}
                  stroke="#22d3ee"
                  strokeWidth={2.5 / camera.zoom}
                  strokeDasharray={`${8 / camera.zoom} ${5 / camera.zoom}`}
                  strokeLinecap="round"
                />
              )}
              <circle
                cx={activeRulerMeasure.ax}
                cy={activeRulerMeasure.ay}
                r={4.5 / camera.zoom}
                fill="#22d3ee"
              />
              {activeRulerMeasure.distance.cells > 0 && (
                <circle
                  cx={activeRulerMeasure.bx}
                  cy={activeRulerMeasure.by}
                  r={5.5 / camera.zoom}
                  fill="#0b0f1a"
                  stroke="#22d3ee"
                  strokeWidth={2.2 / camera.zoom}
                />
              )}
            </svg>
            {activeRulerMeasure.distance.cells > 0 && (
              <div
                className="absolute z-40 pointer-events-none px-2.5 py-1 rounded-lg bg-slate-950/95 border border-cyan-400/70 text-cyan-200 font-mono text-xs font-bold tabular-nums whitespace-nowrap shadow-xl"
                style={{
                  left: `${(activeRulerMeasure.ax + activeRulerMeasure.bx) / 2}px`,
                  top: `${(activeRulerMeasure.ay + activeRulerMeasure.by) / 2 - 18 / camera.zoom}px`,
                  transform: `translate(-50%, -50%) scale(${1 / camera.zoom})`,
                }}
              >
                {activeRulerMeasure.distance.label}
              </div>
            )}
          </>
        )}
      </div>

      {/* Atmospheric & Weather Canvas 2D Layer (pointer-events-none, never blocks clicks) */}
      <VttWeatherOverlay weather={scene.weather} />

      {/* Helpful Zero-State Onboarding Card when Scene has No Tokens */}
      {scene.tokens.length === 0 && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none p-4"
          data-dice3d-ignore="true"
        >
          <div
            data-vtt-ui="true"
            onPointerDown={(e) => e.stopPropagation()}
            className="pointer-events-auto max-w-md w-full rounded-2xl bg-slate-950/92 border border-white/12 p-5 text-center space-y-4 shadow-2xl"
          >
            <div className="w-11 h-11 rounded-xl bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 flex items-center justify-center mx-auto">
              <Swords className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Arena pronta para combate</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {canImportFromGmModules
                  ? 'Importe fichas do Mapa de Notas, traga monstros de um encontro da Forja de Mundos ou crie tokens manuais sobre o grid.'
                  : 'Adicione tokens manuais sobre o grid para acompanhar posições, PV, CA e iniciativa.'}
              </p>
            </div>
            <div
              className={`grid grid-cols-1 ${
                canImportFromGmModules ? 'sm:grid-cols-3' : 'max-w-[200px] mx-auto'
              } gap-2`}
            >
              {canImportFromGmModules && (
                <>
                  <button
                    type="button"
                    onClick={onOpenImportCharacters}
                    className="px-3 py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>Fichas</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenImportEncounter}
                    className="px-3 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>Encontro</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onOpenNewToken}
                className="px-3 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-100 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Novo Token</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quiet Bottom-Left Arena Telemetry Readout */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400 bg-slate-950/85 border border-white/10 px-2.5 py-1 rounded-lg">
        <span>{Math.round(camera.zoom * 100)}%</span>
        <span aria-hidden="true">·</span>
        <span>
          {grid.type === 'square' ? 'Quadrado' : grid.type === 'hex' ? 'Hexagonal' : 'Sem Grid'}
        </span>
        <span aria-hidden="true" className="hidden sm:inline">·</span>
        <span className="hidden sm:inline text-slate-500">[G] Rolar</span>
        <span aria-hidden="true">·</span>
        <span>{scene.tokens.length} {scene.tokens.length === 1 ? 'token' : 'tokens'}</span>
      </div>
    </div>
  );
};
