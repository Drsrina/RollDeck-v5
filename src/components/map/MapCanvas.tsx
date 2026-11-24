import {
  Focus,
  Grid3X3,
  IdCard,
  Image as ImageIcon,
  Layers,
  List,
  Magnet,
  Maximize2,
  MousePointer2,
  Move,
  Network,
  PenTool,
  Pin,
  Plus,
  Redo2,
  Search,
  Square,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeStrokePoints, simplifyPoints } from '../../lib/mapDrawing';
import { detectOrphanNoteIds } from '../../lib/wikiLinks';
import { useMapStore } from '../../store/useMapStore';
import type { DrawingPoint, MapFrame, NoteLink, NoteNode } from '../../types';
import { DrawingToolbar } from './DrawingToolbar';
import { Minimap } from './Minimap';
import { RadialMenu } from './RadialMenu';
import { CATEGORY_ICONS } from './FloatingNoteWindow';
import { LinkEditorModal } from './LinkEditorModal';
import { MapBackgroundModal } from './MapBackgroundModal';
import { MapDrawingsLayer } from './MapDrawingsLayer';
import { MapImagesLayer } from './MapImagesLayer';

export const MapCanvas: React.FC = () => {
  const {
    notes,
    links,
    layers,
    frames,
    isGravityEnabled,
    toggleGravity,
    addFrame,
    updateFrame,
    commitFrames,
    deleteFrameData,
    viewState,
    setViewState,
    setCanvasViewport,
    selectedNodeId,
    selectedNodeIds,
    selectNode,
    openEditor,
    updateNotePosition,
    commitNotePositions,
    createNoteAt,
    setRadialMenu,
    setLayersPanelOpen,
    setListPanelOpen,
    runForceLayout,
    addLink,
    pushHistorySnapshot,
    undo,
    redo,
    undoStack,
    redoStack,
    searchQuery,
    setSearchQuery,
    matchedNodeIds,
    isEditorOpen,
    isLayersPanelOpen,
    isListPanelOpen,
    radialNodeId,
    canvasTool,
    setCanvasTool,
    activeDrawingLayerId,
    drawingStyle,
    selectedDrawingId,
    selectDrawing,
    addDrawing,
    deleteDrawing,
    drawings,
  } = useMapStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const transformLayerRef = useRef<HTMLDivElement>(null);

  // Link creation dragging state + live cursor preview
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [linkPointerWorld, setLinkPointerWorld] = useState<{ x: number; y: number } | null>(null);

  // Link edit modal state
  const [editingLink, setEditingLink] = useState<NoteLink | null>(null);

  // Background map config modal state
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);

  // Region Frame inline rename & drag/resize state
  const [editingFrameId, setEditingFrameId] = useState<string | null>(null);
  const [editingFrameTitle, setEditingFrameTitle] = useState('');
  const frameInteractionRef = useRef<
    | { type: 'move'; frame: MapFrame; startClientX: number; startClientY: number }
    | { type: 'resize'; frame: MapFrame; startClientX: number; startClientY: number }
    | null
  >(null);

  // Freehand SVG drawing state & refs
  const [draftPoints, setDraftPoints] = useState<DrawingPoint[] | null>(null);
  const draftPointsRef = useRef<DrawingPoint[] | null>(null);
  const isDrawingRef = useRef(false);
  const [lockedLayerWarning, setLockedLayerWarning] = useState<string | null>(null);

  // Pan / Zoom / Drag refs (avoids React re-rendering during 60fps pan/zoom)
  const isPanningRef = useRef(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const startViewStateRef = useRef({ panX: 0, panY: 0 });

  // Node drag ref
  const draggingNodeIdRef = useRef<string | null>(null);
  const startNodePosRef = useRef({ x: 0, y: 0 });
  const dragStartPointerRef = useRef({ x: 0, y: 0 });
  const nodeDragMovedRef = useRef(false);
  const pointerDownScreenRef = useRef({ x: 0, y: 0 });

  // Touch pinch zoom refs
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1);

  // Long press detection for empty canvas vs node
  const longPressTimerRef = useRef<number | null>(null);

  // Keep actual canvas viewport dimensions synced for Minimap & accurate camera centering
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasViewport(rect.width, rect.height);
      }
    };
    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [setCanvasViewport]);

  // Layers map & visibility filter
  const layersMap = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);

  const visibleLayersSet = useMemo(() => {
    return new Set(layers.filter((l) => l.visible).map((l) => l.id));
  }, [layers]);

  const visibleNotes = useMemo(() => {
    return notes.filter((n) => visibleLayersSet.has(n.layerId));
  }, [notes, visibleLayersSet]);

  const visibleNoteIds = useMemo(() => new Set(visibleNotes.map((n) => n.id)), [visibleNotes]);

  const visibleLinks = useMemo(() => {
    return links.filter((l) => visibleNoteIds.has(l.fromId) && visibleNoteIds.has(l.toId));
  }, [links, visibleNoteIds]);

  const orphanIds = useMemo(() => detectOrphanNoteIds(visibleNotes, visibleLinks), [visibleNotes, visibleLinks]);

  // Focus mode calculation: find neighbors within focusHops
  const focusedNodeIds = useMemo(() => {
    if (!viewState.focusNodeId) return null;
    const focusSet = new Set<string>([viewState.focusNodeId]);
    let currentHops = new Set<string>([viewState.focusNodeId]);

    for (let h = 0; h < viewState.focusHops; h++) {
      const nextHops = new Set<string>();
      for (const id of currentHops) {
        for (const l of visibleLinks) {
          if (l.fromId === id && !focusSet.has(l.toId)) {
            focusSet.add(l.toId);
            nextHops.add(l.toId);
          } else if (l.toId === id && !focusSet.has(l.fromId)) {
            focusSet.add(l.fromId);
            nextHops.add(l.fromId);
          }
        }
      }
      currentHops = nextHops;
    }
    return focusSet;
  }, [viewState.focusNodeId, viewState.focusHops, visibleLinks]);

  // Update transform on transform layer
  useEffect(() => {
    if (transformLayerRef.current) {
      transformLayerRef.current.style.transform = `translate3d(${viewState.panX}px, ${viewState.panY}px, 0) scale(${viewState.zoom})`;
    }
  }, [viewState.panX, viewState.panY, viewState.zoom]);

  // Screen to Canvas World Coordinates conversion (accounts for sidebar/topbar offset)
  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const localX = rect ? screenX - rect.left : screenX;
      const localY = rect ? screenY - rect.top : screenY;
      return {
        x: (localX - viewState.panX) / viewState.zoom,
        y: (localY - viewState.panY) / viewState.zoom,
      };
    },
    [viewState.panX, viewState.panY, viewState.zoom]
  );

  // Keyboard shortcuts for canvas tools, undo/redo, and drawing deletion
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        isEditorOpen ||
        isLayersPanelOpen ||
        isListPanelOpen ||
        isBackgroundModalOpen ||
        editingLink ||
        radialNodeId
      ) {
        return;
      }

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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        setCanvasTool('pan');
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        setCanvasTool('draw');
        return;
      }

      if (e.key === 'e' || e.key === 'E') {
        setCanvasTool('select-drawing');
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedDrawingId) {
        e.preventDefault();
        deleteDrawing(selectedDrawingId);
        return;
      }

      if (e.key === 'Escape') {
        if (connectingFromId) {
          setConnectingFromId(null);
          setLinkPointerWorld(null);
        } else if (selectedDrawingId) {
          selectDrawing(null);
        } else if (canvasTool !== 'pan') {
          setCanvasTool('pan');
        } else if (viewState.focusNodeId) {
          setViewState({ focusNodeId: null });
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    canvasTool,
    connectingFromId,
    deleteDrawing,
    editingLink,
    isBackgroundModalOpen,
    isEditorOpen,
    isLayersPanelOpen,
    isListPanelOpen,
    radialNodeId,
    redo,
    selectDrawing,
    selectedDrawingId,
    setCanvasTool,
    setViewState,
    undo,
    viewState.focusNodeId,
  ]);

  const triggerLockedWarning = (msg: string) => {
    setLockedLayerWarning(msg);
    window.setTimeout(() => setLockedLayerWarning(null), 2200);
  };

  // ------------------- Pointer & Touch Events -------------------

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const targetElement = e.target as HTMLElement | null;
    if (
      targetElement?.closest(
        'button, a, input, select, textarea, label, [role="dialog"], [data-canvas-ui]'
      )
    ) {
      return;
    }

    pointerDownScreenRef.current = { x: e.clientX, y: e.clientY };

    // Modo Caneta Livre SVG
    if (canvasTool === 'draw') {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const targetLayer =
        layers.find((l) => l.id === activeDrawingLayerId) || layers[0];
      if (targetLayer?.locked) {
        triggerLockedWarning('Camada de desenho bloqueada — destrave ou escolha outra camada');
        return;
      }

      const worldPos = screenToWorld(e.clientX, e.clientY);
      isDrawingRef.current = true;
      draftPointsRef.current = [worldPos];
      setDraftPoints([worldPos]);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // Modo Selecionar/Editar Desenhos -> fundo apenas desseleciona e permite pan
    if (canvasTool === 'select-drawing') {
      selectDrawing(null);
      isPanningRef.current = true;
      startPanRef.current = { x: e.clientX, y: e.clientY };
      startViewStateRef.current = { panX: viewState.panX, panY: viewState.panY };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    // If target is inside a node, handle link completion / drag / radial menu
    const nodeEl = targetElement?.closest('[data-node-id]');

    if (nodeEl) {
      const nodeId = nodeEl.getAttribute('data-node-id');
      if (nodeId) {
        // If we are in link creation mode, clicking another node finishes the link!
        if (connectingFromId && connectingFromId !== nodeId) {
          addLink(connectingFromId, nodeId);
          setConnectingFromId(null);
          setLinkPointerWorld(null);
          return;
        }

        // Start dragging this node (only if not pinned and layer is unlocked)
        const note = notes.find((n) => n.id === nodeId);
        const noteLayer = note ? layersMap.get(note.layerId) : undefined;
        if (note && noteLayer?.locked) {
          triggerLockedWarning(`Camada "${noteLayer.name}" bloqueada — destrave para mover esta nota`);
        } else if (note && !note.pinned) {
          draggingNodeIdRef.current = nodeId;
          nodeDragMovedRef.current = false;
          startNodePosRef.current = { x: note.x, y: note.y };
          dragStartPointerRef.current = { x: e.clientX, y: e.clientY };
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {}
        }

        // Long press for radial menu
        longPressTimerRef.current = window.setTimeout(() => {
          setRadialMenu(nodeId, { x: e.clientX, y: e.clientY });
          draggingNodeIdRef.current = null;
          nodeDragMovedRef.current = false;
        }, 500);

        return;
      }
    }

    // Desselecionar desenho ativo ao tocar no fundo em modo navegação
    if (selectedDrawingId) {
      selectDrawing(null);
    }

    // Canvas background click/drag -> pan
    isPanningRef.current = true;
    startPanRef.current = { x: e.clientX, y: e.clientY };
    startViewStateRef.current = { panX: viewState.panX, panY: viewState.panY };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    // Long press on empty canvas area -> create note there
    longPressTimerRef.current = window.setTimeout(() => {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      createNoteAt(worldPos.x, worldPos.y);
      isPanningRef.current = false;
    }, 550);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    // Live link guide line preview when connecting nodes
    if (connectingFromId) {
      setLinkPointerWorld(screenToWorld(e.clientX, e.clientY));
    }

    // Cancel long press only after genuine movement (> 8px) to handle touch jitter gracefully
    if (longPressTimerRef.current) {
      const movedDist = Math.hypot(
        e.clientX - pointerDownScreenRef.current.x,
        e.clientY - pointerDownScreenRef.current.y
      );
      if (movedDist > 8) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Capturando traço SVG livre
    if (isDrawingRef.current) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const current = draftPointsRef.current || [];
      const last = current[current.length - 1];
      const minStep = 2.5 / Math.max(0.25, viewState.zoom);

      if (!last || Math.hypot(worldPos.x - last.x, worldPos.y - last.y) >= minStep) {
        const next = [...current, worldPos];
        draftPointsRef.current = next;
        setDraftPoints(next);
      }
      return;
    }

    // Dragging a node
    if (draggingNodeIdRef.current) {
      const screenMove = Math.hypot(
        e.clientX - dragStartPointerRef.current.x,
        e.clientY - dragStartPointerRef.current.y
      );
      if (!nodeDragMovedRef.current && screenMove < 4) {
        return;
      }
      if (!nodeDragMovedRef.current) {
        pushHistorySnapshot();
        nodeDragMovedRef.current = true;
      }
      const dx = (e.clientX - dragStartPointerRef.current.x) / viewState.zoom;
      const dy = (e.clientY - dragStartPointerRef.current.y) / viewState.zoom;
      const nextX = startNodePosRef.current.x + dx;
      const nextY = startNodePosRef.current.y + dy;
      updateNotePosition(draggingNodeIdRef.current, nextX, nextY);
      return;
    }

    // Panning canvas
    if (isPanningRef.current) {
      const dx = e.clientX - startPanRef.current.x;
      const dy = e.clientY - startPanRef.current.y;
      const nextPanX = startViewStateRef.current.panX + dx;
      const nextPanY = startViewStateRef.current.panY + dy;

      if (transformLayerRef.current) {
        transformLayerRef.current.style.transform = `translate3d(${nextPanX}px, ${nextPanY}px, 0) scale(${viewState.zoom})`;
      }
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}

    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      const rawPoints = draftPointsRef.current || [];
      draftPointsRef.current = null;
      setDraftPoints(null);

      if (rawPoints.length >= 1) {
        const tolerance = Math.max(1.2, 2.2 / Math.max(0.25, viewState.zoom));
        const simplified = simplifyPoints(rawPoints, tolerance);
        const normalized = normalizeStrokePoints(simplified, 16);
        const targetLayerId =
          activeDrawingLayerId || layers[0]?.id || 'layer-locations';

        await addDrawing({
          layerId: targetLayerId,
          preset: drawingStyle.preset,
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
          rotation: 0,
          points: normalized.points,
          color: drawingStyle.color,
          strokeWidth: drawingStyle.strokeWidth,
          opacity: drawingStyle.opacity,
          strokeStyle: drawingStyle.strokeStyle,
          smooth: drawingStyle.smooth,
        });
      }
      return;
    }

    if (draggingNodeIdRef.current) {
      const didMove = nodeDragMovedRef.current;
      draggingNodeIdRef.current = null;
      nodeDragMovedRef.current = false;
      if (didMove) {
        commitNotePositions();
      }
      return;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
      const dx = e.clientX - startPanRef.current.x;
      const dy = e.clientY - startPanRef.current.y;
      if (dx !== 0 || dy !== 0) {
        setViewState({
          panX: startViewStateRef.current.panX + dx,
          panY: startViewStateRef.current.panY + dy,
        });
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      draftPointsRef.current = null;
      setDraftPoints(null);
    }
    draggingNodeIdRef.current = null;
    nodeDragMovedRef.current = false;
    isPanningRef.current = false;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}
  };

  // Double click on empty canvas creates a note at cursor in pan mode
  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    if (canvasTool !== 'pan') return;
    const targetElement = e.target as HTMLElement | null;
    if (
      targetElement?.closest(
        '[data-node-id], [data-frame-id], [data-map-image-id], [data-canvas-ui], button, input, select, textarea, svg path'
      )
    ) {
      return;
    }
    const worldPos = screenToWorld(e.clientX, e.clientY);
    createNoteAt(worldPos.x, worldPos.y);
  };

  // Zoom centered around the viewport center (for toolbar +/- buttons)
  const zoomAroundCenter = (factor: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : window.innerWidth / 2;
    const cy = rect ? rect.height / 2 : window.innerHeight / 2;
    setViewState((prev) => {
      const newZoom = Math.min(4, Math.max(0.15, prev.zoom * factor));
      const newPanX = cx - (cx - prev.panX) * (newZoom / prev.zoom);
      const newPanY = cy - (cy - prev.panY) * (newZoom / prev.zoom);
      return { ...prev, zoom: newZoom, panX: newPanX, panY: newPanY };
    });
  };

  // Region Frame drag & resize handlers
  const handleFramePointerDown = (
    e: React.PointerEvent,
    frame: MapFrame,
    type: 'move' | 'resize'
  ) => {
    if (canvasTool !== 'pan') return;
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    frameInteractionRef.current = {
      type,
      frame,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
  };

  const handleFramePointerMove = (e: React.PointerEvent) => {
    const action = frameInteractionRef.current;
    if (!action) return;
    e.stopPropagation();
    const dx = (e.clientX - action.startClientX) / viewState.zoom;
    const dy = (e.clientY - action.startClientY) / viewState.zoom;

    if (action.type === 'move') {
      let nextX = action.frame.x + dx;
      let nextY = action.frame.y + dy;
      if (viewState.snapToGrid) {
        nextX = Math.round(nextX / 20) * 20;
        nextY = Math.round(nextY / 20) * 20;
      }
      updateFrame(
        { ...action.frame, x: Math.round(nextX), y: Math.round(nextY) },
        { commit: false }
      );
    } else {
      updateFrame(
        {
          ...action.frame,
          width: Math.max(180, Math.round(action.frame.width + dx)),
          height: Math.max(120, Math.round(action.frame.height + dy)),
        },
        { commit: false }
      );
    }
  };

  const handleFramePointerUp = (e: React.PointerEvent) => {
    if (!frameInteractionRef.current) return;
    e.stopPropagation();
    frameInteractionRef.current = null;
    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {}
    commitFrames();
  };

  const handleSaveFrameTitle = async (frame: MapFrame) => {
    const nextTitle = editingFrameTitle.trim();
    setEditingFrameId(null);
    if (nextTitle && nextTitle !== frame.title) {
      await updateFrame({ ...frame, title: nextTitle });
    }
  };

  // Touch pinch to zoom handler
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = viewState.zoom;
      isPanningRef.current = false;
      isDrawingRef.current = false;
      draftPointsRef.current = null;
      setDraftPoints(null);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const scale = dist / initialPinchDistRef.current;
      const newZoom = Math.min(4, Math.max(0.15, initialPinchZoomRef.current * scale));

      setViewState({ zoom: newZoom });
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistRef.current = null;
  };

  // Mouse Wheel Zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(4, Math.max(0.15, viewState.zoom * zoomFactor));

    const rect = containerRef.current?.getBoundingClientRect();
    const mouseX = rect ? e.clientX - rect.left : e.clientX;
    const mouseY = rect ? e.clientY - rect.top : e.clientY;

    const newPanX = mouseX - (mouseX - viewState.panX) * (newZoom / viewState.zoom);
    const newPanY = mouseY - (mouseY - viewState.panY) * (newZoom / viewState.zoom);

    setViewState({ zoom: newZoom, panX: newPanX, panY: newPanY });
  };

  // Fit All notes & SVG drawings on screen
  const handleFitAll = () => {
    const visibleDrawings = drawings.filter((d) => visibleLayersSet.has(d.layerId));
    const rect = containerRef.current?.getBoundingClientRect();
    const viewW = rect?.width || window.innerWidth;
    const viewH = rect?.height || window.innerHeight;

    if (visibleNotes.length === 0 && visibleDrawings.length === 0) {
      setViewState({ zoom: 1, panX: viewW / 2, panY: viewH / 2 });
      return;
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

    const w = Math.max(200, maxX - minX + 200);
    const h = Math.max(200, maxY - minY + 200);

    const scaleX = (viewW - 80) / w;
    const scaleY = (viewH - 140) / h;
    const newZoom = Math.min(2.5, Math.max(0.2, Math.min(scaleX, scaleY)));

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    setViewState({
      zoom: newZoom,
      panX: -midX * newZoom + viewW / 2,
      panY: -midY * newZoom + viewH / 2,
    });
  };

  // Double tap node detection
  const lastTapRef = useRef<{ id: string; time: number } | null>(null);
  const handleNodeClick = (e: React.MouseEvent, note: NoteNode) => {
    e.stopPropagation();
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.id === note.id && now - lastTapRef.current.time < 320) {
      // Double tap -> Open editor
      openEditor(note.id);
      lastTapRef.current = null;
      return;
    }
    lastTapRef.current = { id: note.id, time: now };
    selectNode(note.id);
  };

  const handleStartLink = (fromId: string) => {
    setConnectingFromId(fromId);
  };

  // Map notes lookup
  const noteLookup = useMemo(() => new Map(visibleNotes.map((n) => [n.id, n])), [visibleNotes]);

  // Current LOD:
  // Low: zoom < 0.55
  // Medium: 0.55 <= zoom <= 1.2
  // High: zoom > 1.2
  const lod = viewState.zoom < 0.55 ? 'low' : viewState.zoom <= 1.2 ? 'medium' : 'high';

  const handleAddFrame = async () => {
    const rect = containerRef.current?.getBoundingClientRect();
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
    const centerWorld = screenToWorld(centerX, centerY);
    const colors = ['#22d3ee', '#c084fc', '#f43f5e', '#10b981', '#f59e0b'];
    const randomColor = colors[frames.length % colors.length];
    await addFrame({
      title: `Região ${frames.length + 1}`,
      x: Math.round(centerWorld.x - 180),
      y: Math.round(centerWorld.y - 140),
      width: 360,
      height: 280,
      color: randomColor,
    });
  };

  const focusedRootNote = viewState.focusNodeId
    ? notes.find((n) => n.id === viewState.focusNodeId)
    : null;
  const connectingSourceNote = connectingFromId
    ? noteLookup.get(connectingFromId) || null
    : null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleCanvasDoubleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      className={`relative w-full h-full min-h-[calc(100vh-4rem)] overflow-hidden bg-[#07060d] select-none touch-none ${
        canvasTool === 'draw'
          ? 'cursor-crosshair'
          : canvasTool === 'select-drawing'
          ? 'cursor-default'
          : 'cursor-grab active:cursor-grabbing'
      }`}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
        backgroundSize: `${32 * viewState.zoom}px ${32 * viewState.zoom}px`,
        backgroundPosition: `${viewState.panX}px ${viewState.panY}px`,
      }}
    >
      {/* Transformable Canvas Layer (Single DOM container for 60fps performance) */}
      <div
        ref={transformLayerRef}
        className="absolute top-0 left-0 w-full h-full origin-top-left pointer-events-none"
      >
        {/* Multi-Image & Tokens Layer */}
        <MapImagesLayer zoom={viewState.zoom} />

        {/* Region Frames Layer (interactive only in pan mode so SVG pen draws smoothly over regions) */}
        {frames.map((frame) => {
          const isEditingTitle = editingFrameId === frame.id;
          return (
            <div
              key={frame.id}
              data-frame-id={frame.id}
              style={{
                position: 'absolute',
                left: `${frame.x}px`,
                top: `${frame.y}px`,
                width: `${frame.width}px`,
                height: `${frame.height}px`,
                backgroundColor: `${frame.color || '#22d3ee'}12`,
                borderColor: `${frame.color || '#22d3ee'}50`,
              }}
              className={`rounded-3xl border-2 border-dashed backdrop-blur-[2px] flex flex-col justify-between p-2.5 group hover:border-solid hover:border-white/50 transition-colors shadow-lg ${
                canvasTool === 'pan' ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              <div
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button, input')) return;
                  handleFramePointerDown(e, frame, 'move');
                }}
                onPointerMove={handleFramePointerMove}
                onPointerUp={handleFramePointerUp}
                onPointerCancel={handleFramePointerUp}
                className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-black/70 border border-white/10 shadow-sm cursor-grab active:cursor-grabbing"
              >
                {isEditingTitle ? (
                  <input
                    type="text"
                    autoFocus
                    value={editingFrameTitle}
                    onChange={(e) => setEditingFrameTitle(e.target.value)}
                    onBlur={() => handleSaveFrameTitle(frame)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveFrameTitle(frame);
                      if (e.key === 'Escape') setEditingFrameId(null);
                    }}
                    className="flex-1 min-w-0 bg-black/60 border border-cyan-400/60 rounded px-1.5 py-0.5 text-[11px] font-black text-white uppercase tracking-wider focus:outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingFrameId(frame.id);
                      setEditingFrameTitle(frame.title);
                    }}
                    title="Arraste para mover · Duplo clique para renomear"
                    className="text-[11px] font-black text-white tracking-wider uppercase truncate"
                  >
                    {frame.title}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFrameData(frame.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-400 transition shrink-0"
                  title="Excluir Região"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Bottom-right resize handle for Region Frame */}
              {canvasTool === 'pan' && (
                <div
                  onPointerDown={(e) => handleFramePointerDown(e, frame, 'resize')}
                  onPointerMove={handleFramePointerMove}
                  onPointerUp={handleFramePointerUp}
                  onPointerCancel={handleFramePointerUp}
                  title="Arraste para redimensionar região"
                  className="self-end w-4 h-4 rounded-md bg-white/15 hover:bg-cyan-400/80 border border-white/30 cursor-se-resize opacity-0 group-hover:opacity-100 transition"
                />
              )}
            </div>
          );
        })}

        {/* SVG Freehand Drawings & Manipulation Gizmo Layer */}
        <MapDrawingsLayer
          zoom={viewState.zoom}
          draftPoints={draftPoints}
          screenToWorld={screenToWorld}
        />

        {/* SVG Edges Layer */}
        <svg
          className="absolute overflow-visible w-full h-full pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <linearGradient id="edgeGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#e879f9" stopOpacity="0.8" />
            </linearGradient>

            <marker
              id="edgeArrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
            </marker>
          </defs>

          {/* Live dashed guide line while connecting two nodes */}
          {connectingSourceNote && linkPointerWorld && (
            <line
              x1={connectingSourceNote.x}
              y1={connectingSourceNote.y}
              x2={linkPointerWorld.x}
              y2={linkPointerWorld.y}
              stroke="#c084fc"
              strokeWidth={2.5}
              strokeDasharray="6 6"
              strokeLinecap="round"
              className="pointer-events-none"
            />
          )}

          {/* Render links */}
          {visibleLinks.map((link) => {
            const source = noteLookup.get(link.fromId);
            const target = noteLookup.get(link.toId);
            if (!source || !target) return null;

            const isSelected = selectedNodeId === link.fromId || selectedNodeId === link.toId;

            // Curved Bézier path
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const cx1 = source.x + dx * 0.4;
            const cy1 = source.y + dy * 0.1;
            const cx2 = source.x + dx * 0.6;
            const cy2 = source.y + dy * 0.9;
            const pathData = `M ${source.x} ${source.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${target.x} ${target.y}`;

            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            const strokeDash =
              link.style === 'dashed' ? '8 4' : link.style === 'dotted' ? '3 4' : undefined;
            const strokeColor = link.color || (isSelected ? '#22d3ee' : 'rgba(255, 255, 255, 0.28)');

            return (
              <g
                key={link.id}
                className={canvasTool === 'pan' ? 'pointer-events-auto' : 'pointer-events-none'}
              >
                {/* Hitbox path */}
                {canvasTool === 'pan' && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLink(link);
                    }}
                    className="cursor-pointer"
                  />
                )}

                {/* Visible link */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 3.5 : 2}
                  strokeOpacity={isSelected ? 0.95 : 0.6}
                  strokeDasharray={strokeDash}
                  strokeLinecap="round"
                  markerEnd={link.directional ? 'url(#edgeArrow)' : undefined}
                  onClick={(e) => {
                    if (canvasTool !== 'pan') return;
                    e.stopPropagation();
                    setEditingLink(link);
                  }}
                  className={canvasTool === 'pan' ? 'cursor-pointer hover:stroke-cyan-300 transition-colors' : ''}
                />

                {/* Edge Label if present */}
                {link.label && lod !== 'low' && (
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    onClick={(e) => {
                      if (canvasTool !== 'pan') return;
                      e.stopPropagation();
                      setEditingLink(link);
                    }}
                    className={canvasTool === 'pan' ? 'cursor-pointer' : ''}
                  >
                    <rect
                      x={-(link.label.length * 3.5 + 8)}
                      y={-10}
                      width={link.label.length * 7 + 16}
                      height={20}
                      rx={10}
                      fill="#0b0f19"
                      stroke="rgba(255, 255, 255, 0.25)"
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={3.5}
                      fill="#e2e8f0"
                      fontSize="10"
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-sans select-none"
                    >
                      {link.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes Layer */}
        {visibleNotes.map((note) => {
          const isSelected = selectedNodeId === note.id || selectedNodeIds.includes(note.id);
          const isOrphan = orphanIds.has(note.id);
          const isSearchMatch = searchQuery.trim() ? matchedNodeIds.includes(note.id) : true;
          const isFocused = focusedNodeIds ? focusedNodeIds.has(note.id) : true;

          // Opacity based on focus and search
          let nodeOpacity = 1;
          if (!isFocused || !isSearchMatch) {
            nodeOpacity = 0.22;
          }

          const layer = layersMap.get(note.layerId);
          const nodeColor = layer?.color || note.color || '#22d3ee';
          const CategoryIcon = CATEGORY_ICONS[note.category || 'general'] || CATEGORY_ICONS.general;

          return (
            <div
              key={note.id}
              data-node-id={note.id}
              onClick={(e) => handleNodeClick(e, note)}
              onContextMenu={(e) => {
                e.preventDefault();
                setRadialMenu(note.id, { x: e.clientX, y: e.clientY });
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 transition-opacity ${
                canvasTool === 'pan' ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
              style={{
                left: `${note.x}px`,
                top: `${note.y}px`,
                opacity: canvasTool === 'pan' ? nodeOpacity : nodeOpacity * 0.78,
                zIndex: isSelected ? 20 : 10,
              }}
            >
              {/* LOW ZOOM: Orb with category icon */}
              {lod === 'low' && (
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                    isSelected ? 'scale-150 ring-2 ring-white' : 'hover:scale-125'
                  }`}
                  style={{
                    backgroundColor: nodeColor,
                    boxShadow: `0 0 16px ${nodeColor}`,
                  }}
                  title={note.title}
                >
                  <CategoryIcon className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                </div>
              )}

              {/* MEDIUM ZOOM: Orb + Category Icon + Title badge */}
              {lod === 'medium' && (
                <div
                  className={`flex items-center gap-2 p-1.5 pr-3 rounded-full glass-panel border transition-all ${
                    isSelected
                      ? 'border-cyan-400 bg-white/15 scale-105 shadow-[0_0_20px_rgba(34,211,238,0.5)]'
                      : 'hover:border-white/40'
                  }`}
                  style={{ borderColor: isSelected ? '#22d3ee' : `${nodeColor}66` }}
                >
                  <div
                    className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: nodeColor, boxShadow: `0 0 10px ${nodeColor}` }}
                  >
                    <CategoryIcon className="w-3 h-3 text-black stroke-[2.5]" />
                  </div>
                  <span className="text-xs font-bold text-white whitespace-nowrap tracking-tight">
                    {note.title}
                  </span>
                  {note.category === 'character' && note.characterSheet && (
                    <span className="text-[10px] font-mono font-bold text-pink-300 whitespace-nowrap tabular-nums">
                      PV {note.characterSheet.hpCurrent}/{note.characterSheet.hpMax}
                    </span>
                  )}
                  {note.pinned && <Pin className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
                </div>
              )}

              {/* HIGH ZOOM: Detailed Glass Card with RPG category header, preview and tags */}
              {lod === 'high' && (
                <div
                  className={`w-56 p-3 rounded-2xl glass-panel-elevated border transition-all ${
                    isSelected
                      ? 'border-cyan-400 scale-105 shadow-[0_0_25px_rgba(34,211,238,0.45)]'
                      : 'hover:border-white/30'
                  }`}
                  style={{
                    borderTopColor: nodeColor,
                    borderRightColor: isSelected ? '#22d3ee' : `${nodeColor}70`,
                    borderBottomColor: isSelected ? '#22d3ee' : `${nodeColor}70`,
                    borderLeftColor: isSelected ? '#22d3ee' : `${nodeColor}70`,
                    borderTopWidth: '3px',
                  }}
                >
                  <div className="flex items-start justify-between gap-1 pb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {note.category === 'character' && note.characterSheet?.avatarUrl ? (
                        <img
                          src={note.characterSheet.avatarUrl}
                          alt={note.title}
                          className="w-5 h-5 rounded-md object-cover shrink-0 border border-pink-400/50"
                        />
                      ) : (
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${nodeColor}25`, color: nodeColor }}
                        >
                          <CategoryIcon className="w-3 h-3" />
                        </div>
                      )}
                      <h3 className="font-bold text-xs text-white truncate">{note.title}</h3>
                    </div>
                    {note.pinned && (
                      <Pin className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                  </div>

                  {note.category === 'character' && note.characterSheet ? (
                    <div className="mt-1 space-y-1.5">
                      <p className="text-[10px] text-pink-200/90 font-semibold truncate">
                        {note.characterSheet.race || 'Personagem'} · {note.characterSheet.characterClass || 'Aventureiro'} Nv.{note.characterSheet.level}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums">
                        <span className="text-emerald-300 font-bold">
                          PV {note.characterSheet.hpCurrent}/{note.characterSheet.hpMax}
                        </span>
                        <span className="text-sky-300 font-bold">
                          CA {note.characterSheet.ac}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${
                            note.characterSheet.hpCurrent / Math.max(1, note.characterSheet.hpMax) > 0.5
                              ? 'bg-emerald-500'
                              : note.characterSheet.hpCurrent / Math.max(1, note.characterSheet.hpMax) > 0.25
                              ? 'bg-amber-400'
                              : 'bg-rose-500'
                          }`}
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round(
                                  (note.characterSheet.hpCurrent / Math.max(1, note.characterSheet.hpMax)) * 100
                                )
                              )
                            )}%`,
                          }}
                        />
                      </div>
                      {note.characterSheet.conditions && note.characterSheet.conditions.length > 0 && (
                        <div className="text-[9px] text-amber-300 truncate">
                          ⚠ {note.characterSheet.conditions.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-300 line-clamp-2 mt-1 leading-snug">
                      {note.body.slice(0, 90) || <span className="italic text-slate-500">Sem texto...</span>}
                    </p>
                  )}

                  {note.tags && note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.tags.slice(0, 3).map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 text-cyan-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Filter / Focus Mode / Linking Banners */}
      <div
        data-canvas-ui="true"
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2 pointer-events-none max-w-[90vw]"
      >
        {connectingFromId && (
          <div className="pointer-events-auto px-3 py-1.5 rounded-full bg-purple-600/90 text-white text-xs font-bold border border-purple-400 shadow-xl flex items-center gap-2">
            <span>Toque no nó de destino para conectar</span>
            <button
              type="button"
              onClick={() => {
                setConnectingFromId(null);
                setLinkPointerWorld(null);
              }}
              className="text-white hover:text-rose-200 p-0.5"
              aria-label="Cancelar conexão"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {focusedRootNote && (
          <div className="pointer-events-auto px-3 py-1.5 rounded-full bg-purple-950/90 text-purple-200 text-xs font-semibold border border-purple-400/50 shadow-lg flex items-center gap-2">
            <Focus className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="truncate max-w-[200px]">
              Foco: {focusedRootNote.title} ({viewState.focusHops}{' '}
              {viewState.focusHops === 1 ? 'salto' : 'saltos'})
            </span>
            <button
              type="button"
              onClick={() => setViewState({ focusNodeId: null })}
              className="text-purple-300 hover:text-white p-0.5"
              title="Desativar Modo Foco"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {searchQuery.trim() && (
          <div className="pointer-events-auto px-3 py-1.5 rounded-full bg-cyan-950/90 text-cyan-200 text-xs font-semibold border border-cyan-400/50 shadow-lg flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate max-w-[180px]">
              Busca: "{searchQuery}" ({matchedNodeIds.length})
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-cyan-300 hover:text-white p-0.5"
              title="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {lockedLayerWarning && (
          <div className="px-3 py-1.5 rounded-xl bg-amber-500/95 text-black text-xs font-bold shadow-lg whitespace-nowrap">
            {lockedLayerWarning}
          </div>
        )}
      </div>

      {/* Minimap */}
      <Minimap />

      {/* Contextual SVG Drawing & Selection Toolbar */}
      <DrawingToolbar />

      {/* Bottom Floating Toolbar & Controls */}
      <div className="absolute bottom-20 md:bottom-4 left-3 right-3 z-30 flex items-end justify-between gap-2 pointer-events-none">
        {/* Left: Mode Switcher + Zoom & Utility Controls */}
        <div
          data-canvas-ui="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex flex-wrap items-center gap-1.5 max-w-[calc(100vw-11.5rem)] md:max-w-none"
        >
          {/* Mode Switcher: Mover / Caneta SVG / Editar Traços */}
          <div
            className="flex items-center gap-1 p-1 rounded-2xl glass-panel-elevated border border-white/15 shadow-xl"
            role="group"
            aria-label="Modo de interação no mapa"
          >
            <button
              type="button"
              onClick={() => setCanvasTool('pan')}
              aria-label="Modo Mover e Notas (V)"
              title="Mover mapa e notas (V)"
              className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                canvasTool === 'pan'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <MousePointer2 className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Mover</span>
            </button>
            <button
              type="button"
              onClick={() => setCanvasTool('draw')}
              aria-label="Caneta SVG Livre (P)"
              title="Caneta SVG: Rios, Trilhas e Paredes (P)"
              className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                canvasTool === 'draw'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <PenTool className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Caneta</span>
            </button>
            <button
              type="button"
              onClick={() => setCanvasTool('select-drawing')}
              aria-label="Selecionar e Editar Desenhos (E)"
              title="Selecionar, mover, redimensionar e girar desenhos (E)"
              className={`h-9 px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                canvasTool === 'select-drawing'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Move className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Editar</span>
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-2xl glass-panel-elevated border border-white/15 shadow-xl overflow-x-auto">
            <button
              type="button"
              onClick={() => zoomAroundCenter(1.25)}
              aria-label="Aumentar Zoom"
              title="Aumentar Zoom"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => zoomAroundCenter(1 / 1.25)}
              aria-label="Diminuir Zoom"
              title="Diminuir Zoom"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleFitAll}
              aria-label="Ajustar tudo na tela"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition"
              title="Ajustar tudo na tela"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => runForceLayout()}
              aria-label="Reorganizar grafo (Obsidian style)"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10 active:scale-90 transition"
              title="Reorganizar Grafo com Força"
            >
              <Network className="w-4 h-4" />
            </button>

            {/* Undo / Redo */}
            <button
              type="button"
              onClick={undo}
              disabled={undoStack.length === 0}
              aria-label="Desfazer"
              title="Desfazer (Ctrl+Z)"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 active:scale-90 transition"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={redoStack.length === 0}
              aria-label="Refazer"
              title="Refazer (Ctrl+Y)"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-30 active:scale-90 transition"
            >
              <Redo2 className="w-4 h-4" />
            </button>

            {/* Nova Moldura de Região */}
            <button
              type="button"
              onClick={handleAddFrame}
              aria-label="Adicionar Moldura de Região"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 active:scale-90 transition"
              title="Adicionar Moldura de Região (arraste e dê duplo clique no título)"
            >
              <Square className="w-4 h-4" />
            </button>

            {/* Imagem de Fundo de Mapa e Tokens */}
            <button
              type="button"
              onClick={() => setIsBackgroundModalOpen(true)}
              aria-label="Imagens e Tokens de Mapa"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 active:scale-90 transition"
              title="Imagens e Tokens de Mapa"
            >
              <ImageIcon className="w-4 h-4" />
            </button>

            {/* Alinhar à Grade (Snap to Grid) */}
            <button
              type="button"
              onClick={() => setViewState((prev) => ({ ...prev, snapToGrid: !prev.snapToGrid }))}
              aria-label="Alinhar à Grade (20px)"
              className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-xl transition active:scale-90 ${
                viewState.snapToGrid
                  ? 'bg-purple-500/25 text-purple-300 border border-purple-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={
                viewState.snapToGrid
                  ? 'Alinhar à Grade (20px): Ativado'
                  : 'Alinhar à Grade (20px): Desativado'
              }
            >
              <Grid3X3 className="w-4 h-4" />
            </button>

            {/* Gravidade de Nós Vinculados */}
            <button
              type="button"
              onClick={toggleGravity}
              aria-label="Gravidade de Notas Vinculadas"
              className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-xl transition active:scale-90 ${
                isGravityEnabled
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={
                isGravityEnabled
                  ? 'Gravidade Ativada: Arrastar uma nota puxa as vinculadas suavemente mantendo distância mínima'
                  : 'Gravidade Desativada: Arrastar move apenas a nota selecionada'
              }
            >
              <Magnet className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Panels & FAB "+" */}
        <div
          data-canvas-ui="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex items-center gap-2 shrink-0"
        >
          {/* Layers Button */}
          <button
            onClick={() => setLayersPanelOpen(true)}
            aria-label="Abrir Camadas"
            className="w-11 h-11 rounded-2xl glass-panel-elevated text-purple-300 border border-purple-400/40 flex items-center justify-center shadow-lg active:scale-95 transition hover:bg-white/10"
            title="Camadas"
          >
            <Layers className="w-5 h-5" />
          </button>

          {/* List / Search Button */}
          <button
            onClick={() => setListPanelOpen(true)}
            aria-label="Abrir Lista e Busca"
            className="w-11 h-11 rounded-2xl glass-panel-elevated text-cyan-300 border border-cyan-400/40 flex items-center justify-center shadow-lg active:scale-95 transition hover:bg-white/10"
            title="Lista e Busca"
          >
            <List className="w-5 h-5" />
          </button>

          {/* Quick Create Character Sheet Button */}
          <button
            type="button"
            onClick={() => {
              const rect = containerRef.current?.getBoundingClientRect();
              const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
              const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
              const centerWorld = screenToWorld(centerX, centerY);
              createNoteAt(centerWorld.x, centerWorld.y, undefined, 'Novo Personagem', '', {
                category: 'character',
                openAfterCreate: true,
              });
            }}
            aria-label="Criar nova ficha de personagem"
            title="Nova Ficha de Personagem"
            className="w-11 h-11 rounded-2xl glass-panel-elevated text-pink-300 border border-pink-400/45 flex items-center justify-center shadow-lg active:scale-95 transition hover:bg-pink-500/15"
          >
            <IdCard className="w-5 h-5" />
          </button>

          {/* Large Floating Action Button "+" */}
          <button
            type="button"
            onClick={() => {
              const rect = containerRef.current?.getBoundingClientRect();
              const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
              const centerY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
              const centerWorld = screenToWorld(centerX, centerY);
              createNoteAt(centerWorld.x, centerWorld.y);
            }}
            aria-label="Criar nova nota no centro"
            title="Nova Nota"
            className="w-12 h-12 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.5)] active:scale-95 transition hover:brightness-110"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Radial Menu */}
      <RadialMenu onStartLink={handleStartLink} />

      {/* Link Editor Modal */}
      <LinkEditorModal
        link={editingLink}
        onClose={() => setEditingLink(null)}
      />

      {/* Map Background Config Modal */}
      <MapBackgroundModal
        isOpen={isBackgroundModalOpen}
        onClose={() => setIsBackgroundModalOpen(false)}
      />
    </div>
  );
};
