import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import MiniSearch from 'minisearch';
import { create } from 'zustand';
import {
  deleteFrame as dbDeleteFrame,
  deleteLayer as dbDeleteLayer,
  deleteLink as dbDeleteLink,
  deleteNote as dbDeleteNote,
  getMapBackground,
  getMapDrawings,
  getMapImages,
  replaceAllLinks as dbReplaceAllLinks,
  replaceAllNotes as dbReplaceAllNotes,
  saveFrame as dbSaveFrame,
  saveLayer as dbSaveLayer,
  saveLayers as dbSaveLayers,
  saveLink as dbSaveLink,
  saveLinks as dbSaveLinks,
  saveMapBackground,
  saveMapDrawings,
  saveMapImages,
  saveMapViewState as dbSaveMapViewState,
  saveNote as dbSaveNote,
  saveNotes as dbSaveNotes,
} from '../db/indexedDB';
import { createDefaultCharacterSheet } from '../lib/characterSheet';
import { convertFmgJsonToRollDeckNotes, type FmgImportOptions, type FmgImportResult } from '../lib/fmgImporter';
import { createStyleFromPreset } from '../lib/mapDrawing';
import { renameWikiLinksInText, syncLinksFromNoteBody } from '../lib/wikiLinks';
import type {
  CanvasMapImage,
  CharacterSheetData,
  DrawingPreset,
  DrawingStyleConfig,
  FloatingWindowState,
  MapBackground,
  MapCanvasTool,
  MapDrawing,
  MapFrame,
  MapViewState,
  NoteCategory,
  NoteLayer,
  NoteLink,
  NoteNode,
  PlayerSheetKind,
} from '../types';

interface MapHistorySnapshot {
  notes: NoteNode[];
  links: NoteLink[];
  drawings: MapDrawing[];
}

interface MapStoreState {
  notes: NoteNode[];
  links: NoteLink[];
  layers: NoteLayer[];
  frames: MapFrame[];
  viewState: MapViewState;

  // Selection
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  isSelectMode: boolean;

  // Editor & Panels
  isEditorOpen: boolean;
  editingNoteId: string | null;
  isLayersPanelOpen: boolean;
  isListPanelOpen: boolean;
  isPlayerSheetsExplorerOpen: boolean;

  // Radial / Action Menu for node
  radialNodeId: string | null;
  radialPosition: { x: number; y: number } | null;

  // Search Engine
  searchQuery: string;
  matchedNodeIds: string[];

  // Undo / Redo
  undoStack: MapHistorySnapshot[];
  redoStack: MapHistorySnapshot[];

  // Viewport dimensions of actual canvas container (for accurate centering & minimap)
  canvasViewport: { width: number; height: number };
  setCanvasViewport: (width: number, height: number) => void;
  focusCameraOn: (worldX: number, worldY: number, zoom?: number) => void;

  // Actions
  setViewState: (updater: Partial<MapViewState> | ((prev: MapViewState) => MapViewState)) => void;
  selectNode: (id: string | null, multi?: boolean) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  toggleSelectMode: () => void;

  openEditor: (noteId: string | null) => void;
  closeEditor: () => void;
  setLayersPanelOpen: (open: boolean) => void;
  setListPanelOpen: (open: boolean) => void;
  setPlayerSheetsExplorerOpen: (open: boolean) => void;
  setRadialMenu: (nodeId: string | null, pos?: { x: number; y: number } | null) => void;

  // CRUD Notes
  createNoteAt: (
    x: number,
    y: number,
    layerId?: string,
    title?: string,
    body?: string,
    options?: {
      category?: NoteCategory;
      characterSheet?: CharacterSheetData;
      openAfterCreate?: boolean;
      tags?: string[];
      sourcePlayerSheetId?: string;
      sheetKind?: PlayerSheetKind;
      ownerUsername?: string;
      ownerDisplayName?: string;
    }
  ) => Promise<NoteNode>;
  saveNoteData: (note: NoteNode) => Promise<void>;
  updateNotePosition: (id: string, x: number, y: number) => void;
  commitNotePositions: () => Promise<void>;
  deleteNoteData: (id: string, removeLinks?: boolean) => Promise<void>;
  togglePinNode: (id: string) => Promise<void>;

  // Gravity on connected notes
  isGravityEnabled: boolean;
  toggleGravity: () => void;

  // Floating Windows
  floatingWindows: FloatingWindowState[];
  openFloatingNote: (noteId: string) => void;
  closeFloatingNote: (noteId: string) => void;
  minimizeFloatingNote: (noteId: string, minimize?: boolean) => void;
  updateFloatingWindowPosition: (noteId: string, pos: { x: number; y: number; width?: number; height?: number }) => void;
  bringFloatingWindowToFront: (noteId: string) => void;

  // Map Images & Tokens
  mapImages: CanvasMapImage[];
  addMapImage: (img: Omit<CanvasMapImage, 'id' | 'zIndex'>) => Promise<CanvasMapImage>;
  updateMapImage: (
    id: string,
    updates: Partial<CanvasMapImage>,
    options?: { commit?: boolean }
  ) => Promise<void>;
  commitMapImages: () => Promise<void>;
  deleteMapImage: (id: string) => Promise<void>;

  // SVG Drawings & Manipulation
  drawings: MapDrawing[];
  canvasTool: MapCanvasTool;
  activeDrawingLayerId: string | null;
  selectedDrawingId: string | null;
  drawingStyle: DrawingStyleConfig;
  setCanvasTool: (tool: MapCanvasTool) => void;
  setActiveDrawingLayerId: (layerId: string | null) => void;
  setDrawingStyle: (updater: Partial<DrawingStyleConfig>) => void;
  applyDrawingPreset: (preset: DrawingPreset) => void;
  selectDrawing: (id: string | null) => void;
  addDrawing: (drawing: Omit<MapDrawing, 'id' | 'zIndex' | 'createdAt' | 'updatedAt'>) => Promise<MapDrawing>;
  updateDrawing: (
    id: string,
    updates: Partial<MapDrawing>,
    options?: { commit?: boolean; recordHistory?: boolean }
  ) => Promise<void>;
  commitDrawings: () => Promise<void>;
  duplicateDrawing: (id: string) => Promise<MapDrawing | null>;
  bringDrawingToFront: (id: string) => Promise<void>;
  sendDrawingToBack: (id: string) => Promise<void>;
  deleteDrawing: (id: string) => Promise<void>;

  // Background Map (legacy compat)
  backgroundMap: MapBackground | null;
  setBackgroundMap: (bg: MapBackground | null) => Promise<void>;
  updateBackgroundMap: (updater: Partial<MapBackground>) => Promise<void>;

  // Frames CRUD
  addFrame: (frame: Omit<MapFrame, 'id'>) => Promise<MapFrame>;
  updateFrame: (frame: MapFrame, options?: { commit?: boolean }) => Promise<void>;
  commitFrames: () => Promise<void>;
  deleteFrameData: (frameId: string) => Promise<void>;

  // Links
  addLink: (fromId: string, toId: string, label?: string, type?: NoteLink['type']) => Promise<void>;
  updateLink: (link: NoteLink) => Promise<void>;
  removeLink: (linkId: string) => Promise<void>;

  // Layers
  createLayer: (name: string, color: string) => Promise<NoteLayer>;
  updateLayer: (layer: NoteLayer) => Promise<void>;
  toggleLayerVisibility: (layerId: string) => Promise<void>;
  toggleLayerLock: (layerId: string) => Promise<void>;
  deleteLayerData: (layerId: string) => Promise<void>;

  // Search
  setSearchQuery: (query: string) => void;

  // Layout & History
  runForceLayout: (alpha?: number) => void;
  pushHistorySnapshot: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // FMG / Obsidian Import
  importFmgWorldToCanvas: (fmgData: any, options?: FmgImportOptions) => Promise<FmgImportResult>;

  // Initialization
  setInitialData: (data: {
    notes: NoteNode[];
    links: NoteLink[];
    layers: NoteLayer[];
    frames: MapFrame[];
    viewState: MapViewState;
  }) => void;
}

// Global in-memory MiniSearch instance
let miniSearch = new MiniSearch<NoteNode>({
  fields: ['title', 'body', 'tags'],
  storeFields: ['id', 'title'],
  searchOptions: {
    fuzzy: 0.25,
    prefix: true,
    boost: { title: 2 },
  },
});

function rebuildSearchIndex(notes: NoteNode[]) {
  miniSearch.removeAll();
  if (notes.length > 0) {
    miniSearch.addAll(notes);
  }
}

export const useMapStore = create<MapStoreState>((set, get) => ({
  notes: [],
  links: [],
  layers: [],
  frames: [],
  floatingWindows: [],
  backgroundMap: null,
  mapImages: [],
  drawings: [],
  canvasTool: 'pan',
  activeDrawingLayerId: null,
  selectedDrawingId: null,
  drawingStyle: createStyleFromPreset('free'),
  isGravityEnabled: true,
  viewState: {
    zoom: 1,
    panX: 0,
    panY: 0,
    mode: 'free',
    snapToGrid: false,
    showMinimap: true,
    focusHops: 1,
  },

  selectedNodeId: null,
  selectedNodeIds: [],
  isSelectMode: false,

  isEditorOpen: false,
  editingNoteId: null,
  isLayersPanelOpen: false,
  isListPanelOpen: false,
  isPlayerSheetsExplorerOpen: false,

  radialNodeId: null,
  radialPosition: null,

  searchQuery: '',
  matchedNodeIds: [],

  undoStack: [],
  redoStack: [],

  canvasViewport: {
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  },

  setCanvasViewport: (width, height) => {
    if (width <= 0 || height <= 0) return;
    set((state) => {
      if (state.canvasViewport.width === width && state.canvasViewport.height === height) {
        return state;
      }
      return { canvasViewport: { width, height } };
    });
  },

  focusCameraOn: (worldX, worldY, targetZoom) => {
    const { viewState, canvasViewport } = get();
    const zoom = targetZoom ?? viewState.zoom;
    const next: MapViewState = {
      ...viewState,
      zoom,
      panX: -worldX * zoom + canvasViewport.width / 2,
      panY: -worldY * zoom + canvasViewport.height / 2,
    };
    dbSaveMapViewState(next).catch(() => {});
    set({ viewState: next });
  },

  setViewState: (updater) => {
    set((state) => {
      const next = typeof updater === 'function' ? updater(state.viewState) : { ...state.viewState, ...updater };
      dbSaveMapViewState(next).catch(() => {});
      return { viewState: next };
    });
  },

  selectNode: (id, multi = false) => {
    set((state) => {
      if (!id) {
        return { selectedNodeId: null, selectedNodeIds: [] };
      }
      if (multi) {
        const next = state.selectedNodeIds.includes(id)
          ? state.selectedNodeIds.filter((item) => item !== id)
          : [...state.selectedNodeIds, id];
        return { selectedNodeIds: next, selectedNodeId: id };
      }
      return { selectedNodeId: id, selectedNodeIds: [id] };
    });
  },

  setSelectedNodeIds: (ids) => set({ selectedNodeIds: ids, selectedNodeId: ids[0] || null }),

  toggleSelectMode: () => set((state) => ({ isSelectMode: !state.isSelectMode, selectedNodeIds: [] })),

  openEditor: (noteId) => set({ isEditorOpen: true, editingNoteId: noteId, radialNodeId: null }),

  closeEditor: () => set({ isEditorOpen: false, editingNoteId: null }),

  setLayersPanelOpen: (open) => set({ isLayersPanelOpen: open }),

  setListPanelOpen: (open) => set({ isListPanelOpen: open }),

  setPlayerSheetsExplorerOpen: (open) => set({ isPlayerSheetsExplorerOpen: open }),

  setRadialMenu: (nodeId, pos = null) => set({ radialNodeId: nodeId, radialPosition: pos }),

  // Push history snapshot for undo/redo (max 50)
  pushHistorySnapshot: () => {
    const { notes, links, drawings, undoStack } = get();
    const snapshot: MapHistorySnapshot = {
      notes: JSON.parse(JSON.stringify(notes)),
      links: JSON.parse(JSON.stringify(links)),
      drawings: JSON.parse(JSON.stringify(drawings)),
    };
    const nextUndo = [snapshot, ...undoStack.slice(0, 49)];
    set({ undoStack: nextUndo, redoStack: [] });
  },

  undo: async () => {
    const { undoStack, redoStack, notes, links, drawings, selectedDrawingId } = get();
    if (undoStack.length === 0) return;

    const currentSnapshot: MapHistorySnapshot = {
      notes: JSON.parse(JSON.stringify(notes)),
      links: JSON.parse(JSON.stringify(links)),
      drawings: JSON.parse(JSON.stringify(drawings)),
    };

    const [prev, ...restUndo] = undoStack;
    const restoredDrawings = prev.drawings ?? drawings;
    await dbReplaceAllNotes(prev.notes);
    await dbReplaceAllLinks(prev.links);
    await saveMapDrawings(restoredDrawings);
    rebuildSearchIndex(prev.notes);

    const stillHasDrawing = selectedDrawingId
      ? restoredDrawings.some((d) => d.id === selectedDrawingId)
      : false;

    set({
      notes: prev.notes,
      links: prev.links,
      drawings: restoredDrawings,
      selectedDrawingId: stillHasDrawing ? selectedDrawingId : null,
      undoStack: restUndo,
      redoStack: [currentSnapshot, ...redoStack],
    });
  },

  redo: async () => {
    const { undoStack, redoStack, notes, links, drawings, selectedDrawingId } = get();
    if (redoStack.length === 0) return;

    const currentSnapshot: MapHistorySnapshot = {
      notes: JSON.parse(JSON.stringify(notes)),
      links: JSON.parse(JSON.stringify(links)),
      drawings: JSON.parse(JSON.stringify(drawings)),
    };

    const [next, ...restRedo] = redoStack;
    const restoredDrawings = next.drawings ?? drawings;
    await dbReplaceAllNotes(next.notes);
    await dbReplaceAllLinks(next.links);
    await saveMapDrawings(restoredDrawings);
    rebuildSearchIndex(next.notes);

    const stillHasDrawing = selectedDrawingId
      ? restoredDrawings.some((d) => d.id === selectedDrawingId)
      : false;

    set({
      notes: next.notes,
      links: next.links,
      drawings: restoredDrawings,
      selectedDrawingId: stillHasDrawing ? selectedDrawingId : null,
      undoStack: [currentSnapshot, ...undoStack],
      redoStack: restRedo,
    });
  },

  createNoteAt: async (x, y, layerId, title = 'Nova Nota', body = '', options) => {
    get().pushHistorySnapshot();
    const { layers, notes } = get();
    const category: NoteCategory = options?.category || 'general';
    const preferredLayer =
      layerId ||
      (category === 'character'
        ? layers.find((l) => l.id === 'layer-npcs')?.id
        : undefined) ||
      layers[0]?.id ||
      'layer-default';
    const matchedLayer = layers.find((l) => l.id === preferredLayer);

    const newNote: NoteNode = {
      id: `note-${crypto.randomUUID()}`,
      title: category === 'character' && title === 'Nova Nota' ? 'Novo Personagem' : title,
      body,
      tags: options?.tags ?? (category === 'character' ? ['ficha', 'personagem'] : []),
      category,
      ...(category === 'character'
        ? { characterSheet: options?.characterSheet || createDefaultCharacterSheet() }
        : {}),
      ...(options?.sourcePlayerSheetId ? { sourcePlayerSheetId: options.sourcePlayerSheetId } : {}),
      ...(options?.sheetKind ? { sheetKind: options.sheetKind } : {}),
      ...(options?.ownerUsername ? { ownerUsername: options.ownerUsername } : {}),
      ...(options?.ownerDisplayName ? { ownerDisplayName: options.ownerDisplayName } : {}),
      layerId: preferredLayer,
      color: matchedLayer ? matchedLayer.color : '#22d3ee',
      x: Math.round(x),
      y: Math.round(y),
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await dbSaveNote(newNote);
    const updatedNotes = [...notes, newNote];
    rebuildSearchIndex(updatedNotes);

    set({
      notes: updatedNotes,
      selectedNodeId: newNote.id,
      selectedNodeIds: [newNote.id],
      ...(options?.openAfterCreate
        ? { isEditorOpen: true, editingNoteId: newNote.id, radialNodeId: null }
        : {}),
    });

    return newNote;
  },

  saveNoteData: async (note) => {
    get().pushHistorySnapshot();
    const { notes, links, layers } = get();
    const prevNote = notes.find((n) => n.id === note.id);
    const selectedLayer = layers.find((l) => l.id === note.layerId);
    const updatedNote: NoteNode = {
      ...note,
      title: note.title.trim() || 'Sem Título',
      color: selectedLayer ? selectedLayer.color : (note.color || '#22d3ee'),
      updatedAt: Date.now(),
    };

    const titleChanged =
      Boolean(prevNote) && prevNote!.title.trim() !== updatedNote.title.trim();

    // Update note and auto-refactor [[Old Title]] references in other notes on rename
    const changedOtherNotes: NoteNode[] = [];
    const updatedNotesList = notes.map((n) => {
      if (n.id === note.id) return updatedNote;
      if (titleChanged && n.body) {
        const nextBody = renameWikiLinksInText(n.body, prevNote!.title, updatedNote.title);
        if (nextBody !== n.body) {
          const refactored = { ...n, body: nextBody, updatedAt: Date.now() };
          changedOtherNotes.push(refactored);
          return refactored;
        }
      }
      return n;
    });

    // Persist edited note (+ any notes whose [[wiki-links]] were refactored)
    if (changedOtherNotes.length > 0) {
      await dbSaveNotes([updatedNote, ...changedOtherNotes]);
    } else {
      await dbSaveNote(updatedNote);
    }

    // Auto-sync [[wiki-links]] from markdown body and cleanly prune removed links in IndexedDB
    const updatedLinksList = syncLinksFromNoteBody(
      updatedNote.id,
      updatedNote.body,
      updatedNotesList,
      links
    );

    await dbReplaceAllLinks(updatedLinksList);
    rebuildSearchIndex(updatedNotesList);

    set({
      notes: updatedNotesList,
      links: updatedLinksList,
    });
  },

  updateNotePosition: (id, x, y) => {
    const { viewState, isGravityEnabled, notes, links, layers } = get();
    let finalX = x;
    let finalY = y;

    // Optional snap to grid (20px)
    if (viewState.snapToGrid) {
      finalX = Math.round(x / 20) * 20;
      finalY = Math.round(y / 20) * 20;
    }

    const lockedLayerIds = new Set(layers.filter((l) => l.locked).map((l) => l.id));
    const currentTarget = notes.find((n) => n.id === id);
    if (!currentTarget || currentTarget.pinned || lockedLayerIds.has(currentTarget.layerId)) return;

    if (!isGravityEnabled) {
      set((state) => ({
        notes: state.notes.map((n) => (n.id === id ? { ...n, x: finalX, y: finalY } : n)),
      }));
      return;
    }

    // Connected spring gravity: pulls neighbor notes while maintaining a minimum distance
    const connectedIds = new Set<string>();
    for (const l of links) {
      if (l.fromId === id) connectedIds.add(l.toId);
      if (l.toId === id) connectedIds.add(l.fromId);
    }

    const deltaX = finalX - currentTarget.x;
    const deltaY = finalY - currentTarget.y;

    const MIN_DISTANCE = 160; // Minimum distance threshold to keep nodes legible and prevent overlapping
    const PULL_FACTOR = 0.42; // Organic elastic spring pull factor

    set((state) => ({
      notes: state.notes.map((n) => {
        if (n.id === id) {
          return { ...n, x: finalX, y: finalY };
        }
        if (connectedIds.has(n.id) && !n.pinned && !lockedLayerIds.has(n.layerId)) {
          // Desired position pulled by delta
          let targetX = n.x + deltaX * PULL_FACTOR;
          let targetY = n.y + deltaY * PULL_FACTOR;

          const newDistX = targetX - finalX;
          const newDistY = targetY - finalY;
          const newDist = Math.hypot(newDistX, newDistY) || 1;

          // Preserve minimum distance: push out along radial vector if too close
          if (newDist < MIN_DISTANCE) {
            const angle = Math.atan2(newDistY, newDistX);
            targetX = finalX + Math.cos(angle) * MIN_DISTANCE;
            targetY = finalY + Math.sin(angle) * MIN_DISTANCE;
          }

          return {
            ...n,
            x: Math.round(targetX),
            y: Math.round(targetY),
          };
        }
        return n;
      }),
    }));
  },

  commitNotePositions: async () => {
    const { notes } = get();
    await dbSaveNotes(notes);
  },

  deleteNoteData: async (id, removeLinks = true) => {
    get().pushHistorySnapshot();
    await dbDeleteNote(id, removeLinks);

    set((state) => {
      const remainingNotes = state.notes.filter((n) => n.id !== id);
      const remainingLinks = removeLinks
        ? state.links.filter((l) => l.fromId !== id && l.toId !== id)
        : state.links;
      rebuildSearchIndex(remainingNotes);

      const nextViewState =
        state.viewState.focusNodeId === id
          ? { ...state.viewState, focusNodeId: null }
          : state.viewState;
      if (nextViewState !== state.viewState) {
        dbSaveMapViewState(nextViewState).catch(() => {});
      }

      return {
        notes: remainingNotes,
        links: remainingLinks,
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        selectedNodeIds: state.selectedNodeIds.filter((item) => item !== id),
        isEditorOpen: state.editingNoteId === id ? false : state.isEditorOpen,
        editingNoteId: state.editingNoteId === id ? null : state.editingNoteId,
        radialNodeId: state.radialNodeId === id ? null : state.radialNodeId,
        floatingWindows: state.floatingWindows.filter((w) => w.noteId !== id),
        viewState: nextViewState,
      };
    });
  },

  togglePinNode: async (id) => {
    const note = get().notes.find((n) => n.id === id);
    if (!note) return;
    const updated = { ...note, pinned: !note.pinned };
    await dbSaveNote(updated);
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? updated : n)),
    }));
  },

  addLink: async (fromId, toId, label, type = 'custom') => {
    if (fromId === toId) return;
    const { links } = get();
    // Avoid duplicate directed link between the same pair
    if (links.some((l) => l.fromId === fromId && l.toId === toId)) {
      return;
    }
    get().pushHistorySnapshot();

    const newLink: NoteLink = {
      id: `link-${fromId}-${toId}-${Date.now()}`,
      fromId,
      toId,
      label,
      type,
      directional: true,
    };

    await dbSaveLink(newLink);
    set((state) => ({
      links: [...state.links, newLink],
    }));
  },

  removeLink: async (linkId) => {
    get().pushHistorySnapshot();
    await dbDeleteLink(linkId);
    set((state) => ({
      links: state.links.filter((l) => l.id !== linkId),
    }));
  },

  createLayer: async (name, color) => {
    const { layers } = get();
    const newLayer: NoteLayer = {
      id: `layer-${crypto.randomUUID()}`,
      name,
      color,
      order: layers.length,
      visible: true,
      locked: false,
    };
    await dbSaveLayer(newLayer);
    set({ layers: [...layers, newLayer] });
    return newLayer;
  },

  updateLayer: async (layer) => {
    await dbSaveLayer(layer);
    set((state) => ({
      layers: state.layers.map((l) => (l.id === layer.id ? layer : l)),
    }));
  },

  toggleLayerVisibility: async (layerId) => {
    const layer = get().layers.find((l) => l.id === layerId);
    if (!layer) return;
    const updated = { ...layer, visible: !layer.visible };
    await dbSaveLayer(updated);
    set((state) => {
      const selectedDrawingHidden =
        !updated.visible &&
        state.selectedDrawingId &&
        state.drawings.some((d) => d.id === state.selectedDrawingId && d.layerId === layerId);
      return {
        layers: state.layers.map((l) => (l.id === layerId ? updated : l)),
        selectedDrawingId: selectedDrawingHidden ? null : state.selectedDrawingId,
      };
    });
  },

  toggleLayerLock: async (layerId) => {
    const layer = get().layers.find((l) => l.id === layerId);
    if (!layer) return;
    const updated = { ...layer, locked: !layer.locked };
    await dbSaveLayer(updated);
    set((state) => ({
      layers: state.layers.map((l) => (l.id === layerId ? updated : l)),
    }));
  },

  deleteLayerData: async (layerId) => {
    const { layers, notes, drawings } = get();
    const remaining = layers.filter((l) => l.id !== layerId);
    if (remaining.length === 0) return;

    const fallbackLayer = remaining[0];
    await dbDeleteLayer(layerId);

    // Migrate notes & drawings belonging to deleted layer so they never become orphaned/invisible
    const affectedNotes: NoteNode[] = [];
    const nextNotes = notes.map((n) => {
      if (n.layerId === layerId) {
        const migrated = { ...n, layerId: fallbackLayer.id, color: fallbackLayer.color };
        affectedNotes.push(migrated);
        return migrated;
      }
      return n;
    });
    if (affectedNotes.length > 0) {
      await dbSaveNotes(affectedNotes);
      rebuildSearchIndex(nextNotes);
    }

    let drawingsChanged = false;
    const nextDrawings = drawings.map((d) => {
      if (d.layerId === layerId) {
        drawingsChanged = true;
        return { ...d, layerId: fallbackLayer.id };
      }
      return d;
    });
    if (drawingsChanged) {
      await saveMapDrawings(nextDrawings);
    }

    set((state) => {
      const nextActiveDrawingLayerId =
        state.activeDrawingLayerId === layerId ? fallbackLayer.id : state.activeDrawingLayerId;
      return {
        layers: remaining,
        notes: nextNotes,
        drawings: nextDrawings,
        activeDrawingLayerId: nextActiveDrawingLayerId,
      };
    });
  },

  setSearchQuery: (query) => {
    const trimmed = query.trim();
    if (!trimmed) {
      set({ searchQuery: '', matchedNodeIds: [] });
      return;
    }

    try {
      const results = miniSearch.search(trimmed);
      const matched = results.map((r) => String(r.id));
      set({ searchQuery: query, matchedNodeIds: matched });
    } catch {
      set({ searchQuery: query, matchedNodeIds: [] });
    }
  },

  // Obsidian-style Force-directed graph layout
  runForceLayout: (alpha = 0.8) => {
    get().pushHistorySnapshot();
    const { notes, links } = get();
    if (notes.length === 0) return;

    // Build node simulation objects
    const simNodes = notes.map((n) => ({
      id: n.id,
      x: n.x,
      y: n.y,
      fx: n.pinned ? n.x : undefined,
      fy: n.pinned ? n.y : undefined,
    }));

    const simLinks = links
      .filter((l) => notes.some((n) => n.id === l.fromId) && notes.some((n) => n.id === l.toId))
      .map((l) => ({ source: l.fromId, target: l.toId }));

    const sim = forceSimulation(simNodes as any)
      .force(
        'link',
        forceLink(simLinks as any)
          .id((d: any) => d.id)
          .distance(160)
      )
      .force('charge', forceManyBody().strength(-350))
      .force('collide', forceCollide().radius(70))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.04))
      .alpha(alpha)
      .stop();

    // Run 120 iterations synchronously for instant settling
    for (let i = 0; i < 120; i++) {
      sim.tick();
    }

    // Apply new computed positions
    const posMap = new Map<string, { x: number; y: number }>();
    simNodes.forEach((sn) => {
      posMap.set(sn.id, { x: Math.round(sn.x || 0), y: Math.round(sn.y || 0) });
    });

    const updatedNotes = notes.map((n) => {
      if (n.pinned) return n;
      const pos = posMap.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    });

    dbSaveNotes(updatedNotes).catch(() => {});
    set({ notes: updatedNotes });
  },

  openFloatingNote: (noteId: string) => {
    const { floatingWindows } = get();
    const existing = floatingWindows.find((w) => w.noteId === noteId);
    const maxZ = floatingWindows.reduce((max, w) => Math.max(max, w.zIndex), 100);

    if (existing) {
      set({
        floatingWindows: floatingWindows.map((w) =>
          w.noteId === noteId ? { ...w, isMinimized: false, zIndex: maxZ + 1 } : w
        ),
      });
      return;
    }

    const count = floatingWindows.length;
    const initialX = Math.min(Math.max(16, window.innerWidth - 440), 24 + (count % 4) * 28);
    const initialY = Math.min(Math.max(60, window.innerHeight - 500), 72 + (count % 4) * 28);

    const newWindow: FloatingWindowState = {
      noteId,
      x: initialX,
      y: initialY,
      width: Math.min(440, Math.max(320, window.innerWidth - 32)),
      height: Math.min(480, Math.max(260, window.innerHeight - 120)),
      isMinimized: false,
      zIndex: maxZ + 1,
    };

    set({
      floatingWindows: [...floatingWindows, newWindow],
      isEditorOpen: false,
    });
  },

  closeFloatingNote: (noteId: string) => {
    set((state) => ({
      floatingWindows: state.floatingWindows.filter((w) => w.noteId !== noteId),
    }));
  },

  minimizeFloatingNote: (noteId: string, minimize?: boolean) => {
    set((state) => ({
      floatingWindows: state.floatingWindows.map((w) =>
        w.noteId === noteId
          ? { ...w, isMinimized: minimize !== undefined ? minimize : !w.isMinimized }
          : w
      ),
    }));
  },

  updateFloatingWindowPosition: (noteId, pos) => {
    set((state) => ({
      floatingWindows: state.floatingWindows.map((w) =>
        w.noteId === noteId
          ? {
              ...w,
              x: Math.max(0, Math.min(window.innerWidth - 80, pos.x)),
              y: Math.max(0, Math.min(window.innerHeight - 48, pos.y)),
              ...(pos.width ? { width: Math.max(280, pos.width) } : {}),
              ...(pos.height ? { height: Math.max(180, pos.height) } : {}),
            }
          : w
      ),
    }));
  },

  bringFloatingWindowToFront: (noteId: string) => {
    const { floatingWindows } = get();
    const maxZ = floatingWindows.reduce((max, w) => Math.max(max, w.zIndex), 100);
    set({
      floatingWindows: floatingWindows.map((w) =>
        w.noteId === noteId ? { ...w, zIndex: maxZ + 1 } : w
      ),
    });
  },

  setBackgroundMap: async (bg: MapBackground | null) => {
    await saveMapBackground(bg);
    set({ backgroundMap: bg });
  },

  updateBackgroundMap: async (updater: Partial<MapBackground>) => {
    const current = get().backgroundMap;
    if (!current) return;
    const updated = { ...current, ...updater };
    await saveMapBackground(updated);
    set({ backgroundMap: updated });
  },

  toggleGravity: () => {
    set((state) => ({ isGravityEnabled: !state.isGravityEnabled }));
  },

  addMapImage: async (imgData) => {
    const { mapImages } = get();
    const maxZ = mapImages.reduce((max, img) => Math.max(max, img.zIndex), 0);
    const newImage: CanvasMapImage = {
      id: `map-img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...imgData,
      zIndex: maxZ + 1,
    };
    const updated = [...mapImages, newImage];
    await saveMapImages(updated);
    set({ mapImages: updated });
    return newImage;
  },

  updateMapImage: async (id, updates, options) => {
    const { mapImages } = get();
    const updated = mapImages.map((img) => (img.id === id ? { ...img, ...updates } : img));
    set({ mapImages: updated });
    if (options?.commit !== false) {
      await saveMapImages(updated);
    }
  },

  commitMapImages: async () => {
    const { mapImages } = get();
    await saveMapImages(mapImages);
  },

  deleteMapImage: async (id) => {
    const { mapImages } = get();
    const updated = mapImages.filter((img) => img.id !== id);
    await saveMapImages(updated);
    set({ mapImages: updated });
  },

  // SVG Drawings & Manipulation
  setCanvasTool: (tool) => {
    set((state) => ({
      canvasTool: tool,
      selectedDrawingId: tool === 'draw' ? null : state.selectedDrawingId,
      radialNodeId: null,
    }));
  },

  setActiveDrawingLayerId: (layerId) => {
    set({ activeDrawingLayerId: layerId });
  },

  setDrawingStyle: (updater) => {
    set((state) => ({
      drawingStyle: { ...state.drawingStyle, ...updater },
    }));
  },

  applyDrawingPreset: (preset) => {
    const { layers, activeDrawingLayerId } = get();
    const activeLayer = layers.find((l) => l.id === activeDrawingLayerId) || layers[0];
    set({
      drawingStyle: createStyleFromPreset(preset, activeLayer?.color),
    });
  },

  selectDrawing: (id) => {
    set({
      selectedDrawingId: id,
      ...(id ? { selectedNodeId: null, selectedNodeIds: [] } : {}),
    });
  },

  addDrawing: async (drawingData) => {
    get().pushHistorySnapshot();
    const { drawings } = get();
    const maxZ = drawings.reduce((max, d) => Math.max(max, d.zIndex), 0);
    const now = Date.now();
    const newDrawing: MapDrawing = {
      id: `draw-${now}-${Math.random().toString(36).substring(2, 7)}`,
      ...drawingData,
      zIndex: maxZ + 1,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...drawings, newDrawing];
    await saveMapDrawings(updated);
    set({ drawings: updated });
    return newDrawing;
  },

  updateDrawing: async (id, updates, options) => {
    if (options?.recordHistory) {
      get().pushHistorySnapshot();
    }
    const { drawings } = get();
    const updated = drawings.map((d) =>
      d.id === id ? { ...d, ...updates, updatedAt: Date.now() } : d
    );
    set({ drawings: updated });
    if (options?.commit !== false) {
      await saveMapDrawings(updated);
    }
  },

  commitDrawings: async () => {
    const { drawings } = get();
    await saveMapDrawings(drawings);
  },

  duplicateDrawing: async (id) => {
    const { drawings } = get();
    const source = drawings.find((d) => d.id === id);
    if (!source) return null;
    get().pushHistorySnapshot();
    const maxZ = drawings.reduce((max, d) => Math.max(max, d.zIndex), 0);
    const now = Date.now();
    const clone: MapDrawing = {
      ...JSON.parse(JSON.stringify(source)),
      id: `draw-${now}-${Math.random().toString(36).substring(2, 7)}`,
      x: source.x + 28,
      y: source.y + 28,
      zIndex: maxZ + 1,
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...drawings, clone];
    await saveMapDrawings(updated);
    set({ drawings: updated, selectedDrawingId: clone.id });
    return clone;
  },

  bringDrawingToFront: async (id) => {
    const { drawings } = get();
    if (!drawings.some((d) => d.id === id)) return;
    get().pushHistorySnapshot();
    const maxZ = drawings.reduce((max, d) => Math.max(max, d.zIndex), 0);
    const updated = drawings.map((d) =>
      d.id === id ? { ...d, zIndex: maxZ + 1, updatedAt: Date.now() } : d
    );
    await saveMapDrawings(updated);
    set({ drawings: updated });
  },

  sendDrawingToBack: async (id) => {
    const { drawings } = get();
    if (!drawings.some((d) => d.id === id)) return;
    get().pushHistorySnapshot();
    const minZ = drawings.reduce((min, d) => Math.min(min, d.zIndex), 0);
    const updated = drawings.map((d) =>
      d.id === id ? { ...d, zIndex: minZ - 1, updatedAt: Date.now() } : d
    );
    await saveMapDrawings(updated);
    set({ drawings: updated });
  },

  deleteDrawing: async (id) => {
    const { drawings, selectedDrawingId } = get();
    if (!drawings.some((d) => d.id === id)) return;
    get().pushHistorySnapshot();
    const updated = drawings.filter((d) => d.id !== id);
    await saveMapDrawings(updated);
    set({
      drawings: updated,
      selectedDrawingId: selectedDrawingId === id ? null : selectedDrawingId,
    });
  },

  addFrame: async (frameData) => {
    const newFrame: MapFrame = {
      id: `frame-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...frameData,
    };
    await dbSaveFrame(newFrame);
    set((state) => ({
      frames: [...state.frames, newFrame],
    }));
    return newFrame;
  },

  updateFrame: async (frame: MapFrame, options?: { commit?: boolean }) => {
    set((state) => ({
      frames: state.frames.map((f) => (f.id === frame.id ? frame : f)),
    }));
    if (options?.commit !== false) {
      await dbSaveFrame(frame);
    }
  },

  commitFrames: async () => {
    const { frames } = get();
    for (const f of frames) {
      await dbSaveFrame(f);
    }
  },

  deleteFrameData: async (frameId: string) => {
    await dbDeleteFrame(frameId);
    set((state) => ({
      frames: state.frames.filter((f) => f.id !== frameId),
    }));
  },

  updateLink: async (link: NoteLink) => {
    get().pushHistorySnapshot();
    await dbSaveLink(link);
    set((state) => ({
      links: state.links.map((l) => (l.id === link.id ? link : l)),
    }));
  },

  setInitialData: (data) => {
    rebuildSearchIndex(data.notes);
    getMapBackground()
      .then((bg) => {
        set({ backgroundMap: bg ?? null });
      })
      .catch(() => {});

    getMapImages()
      .then((images) => {
        set({ mapImages: Array.isArray(images) ? images : [] });
      })
      .catch(() => {});

    getMapDrawings()
      .then((loadedDrawings) => {
        set({ drawings: Array.isArray(loadedDrawings) ? loadedDrawings : [] });
      })
      .catch(() => {});

    const defaultLayer =
      data.layers.find((l) => l.visible && !l.locked && !l.isRollLayer) ||
      data.layers.find((l) => !l.locked) ||
      data.layers[0];

    set((state) => ({
      notes: data.notes,
      links: data.links,
      layers: data.layers,
      frames: data.frames,
      viewState: data.viewState,
      activeDrawingLayerId: state.activeDrawingLayerId || defaultLayer?.id || null,
      drawingStyle: state.activeDrawingLayerId
        ? state.drawingStyle
        : createStyleFromPreset(state.drawingStyle.preset, defaultLayer?.color),
    }));
  },

  importFmgWorldToCanvas: async (fmgData, options) => {
    get().pushHistorySnapshot();
    const result = convertFmgJsonToRollDeckNotes(fmgData, options);
    const { notes: existingNotes, links: existingLinks } = get();

    // Mesclar notas evitando títulos duplicados
    const existingTitles = new Set(existingNotes.map((n) => n.title.toLowerCase().trim()));
    const newNotesOnly = result.notes.filter(
      (n) => !existingTitles.has(n.title.toLowerCase().trim())
    );

    const mergedNotes = [...existingNotes, ...newNotesOnly];

    // Sincronizar todos os links de wiki gerados
    let allLinks = [...existingLinks];
    for (const note of mergedNotes) {
      allLinks = syncLinksFromNoteBody(note.id, note.body, mergedNotes, allLinks);
    }

    if (typeof indexedDB !== 'undefined') {
      if (newNotesOnly.length > 0) {
        await dbSaveNotes(newNotesOnly).catch(() => {});
      }
      await dbReplaceAllLinks(allLinks).catch(() => {});
    }
    rebuildSearchIndex(mergedNotes);

    set({
      notes: mergedNotes,
      links: allLinks,
    });

    if (newNotesOnly.length > 0) {
      get().focusCameraOn(newNotesOnly[0].x, newNotesOnly[0].y, 0.85);
    }

    return result;
  },
}));
