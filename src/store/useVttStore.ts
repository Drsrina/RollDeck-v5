import { create } from 'zustand';
import { deleteVttScene as dbDeleteVttScene, saveVttScene as dbSaveVttScene } from '../db/indexedDB';
import { playClickSound, playDiceRollSound } from '../lib/audio';
import type { EncontroGerado } from '../lib/forja/encounterGenerator';
import { rollSingleDieRaw } from '../lib/roll';
import {
  createDefaultVttScene,
  createTokenFromCharacterNote,
  createTokensFromEncounter,
  findFreeGridSlot,
  mapBiomaToSurfacePreset,
  snapPointToGrid,
} from '../lib/vttGrid';
import type { NoteNode } from '../types';
import {
  VTT_SURFACE_PRESETS,
  type VttBackgroundImage,
  type VttGridConfig,
  type VttScene,
  type VttSurfacePreset,
  type VttToken,
  type VttToolMode,
} from '../types/vtt';
import { useAppStore } from './useAppStore';
import { useMapStore } from './useMapStore';

let cameraSaveTimer: number | null = null;

function persistSceneDebounced(scene: VttScene, immediate = true) {
  if (immediate) {
    if (cameraSaveTimer) {
      window.clearTimeout(cameraSaveTimer);
      cameraSaveTimer = null;
    }
    dbSaveVttScene(scene).catch(() => {});
    return;
  }

  if (cameraSaveTimer) window.clearTimeout(cameraSaveTimer);
  cameraSaveTimer = window.setTimeout(() => {
    cameraSaveTimer = null;
    dbSaveVttScene(scene).catch(() => {});
  }, 260);
}

function sortOrderByInitiative(tokens: VttToken[]): string[] {
  return [...tokens]
    .filter((t) => t.faction !== 'object')
    .sort((a, b) => {
      const ia = a.initiativeValue ?? -999;
      const ib = b.initiativeValue ?? -999;
      if (ib !== ia) return ib - ia;
      if (b.initiativeMod !== a.initiativeMod) return b.initiativeMod - a.initiativeMod;
      return a.name.localeCompare(b.name, 'pt-BR');
    })
    .map((t) => t.id);
}

interface VttState {
  scenes: VttScene[];
  activeSceneId: string;
  selectedTokenId: string | null;
  activeTool: VttToolMode;
  sidebarTab: 'combat' | 'inspector';
  isRightPanelOpen: boolean;
  cameraFocusRequest: { x: number; y: number; nonce: number } | null;

  // Cross-module cache of the most recent encounters generated in Forja de Mundos
  recentForjaEncounters: EncontroGerado[];
  setRecentForjaEncounters: (encounters: EncontroGerado[]) => void;

  // Hydration
  setInitialScenes: (scenes: VttScene[]) => void;

  // Tool & UI
  setActiveTool: (tool: VttToolMode) => void;
  selectToken: (tokenId: string | null, openInspector?: boolean) => void;
  setSidebarTab: (tab: 'combat' | 'inspector') => void;
  setRightPanelOpen: (open: boolean) => void;
  requestCameraFocus: (x: number, y: number) => void;

  // Scene CRUD
  selectScene: (sceneId: string) => void;
  createScene: (name?: string, surfacePreset?: VttSurfacePreset) => VttScene;
  renameScene: (sceneId: string, name: string) => void;
  duplicateScene: (sceneId: string) => void;
  deleteScene: (sceneId: string) => void;

  // Grid, Surface, Background & Camera
  updateGrid: (patch: Partial<VttGridConfig>) => void;
  setSurfacePreset: (preset: VttSurfacePreset) => void;
  setBackground: (bg: VttBackgroundImage | null) => void;
  updateBackground: (patch: Partial<VttBackgroundImage>) => void;
  setCamera: (camera: { x: number; y: number; zoom: number }) => void;

  // Token CRUD & Combat Actions
  addToken: (tokenInput: Omit<VttToken, 'id' | 'x' | 'y'> & { x?: number; y?: number }) => VttToken;
  updateToken: (tokenId: string, patch: Partial<VttToken>) => void;
  moveToken: (tokenId: string, x: number, y: number, applySnap?: boolean) => void;
  duplicateToken: (tokenId: string) => void;
  deleteToken: (tokenId: string) => void;
  clearAllTokens: () => void;
  adjustTokenHp: (tokenId: string, delta: number) => void;
  toggleTokenCondition: (tokenId: string, condition: string) => void;

  // Cross-module Importers
  importCharacterNotes: (notes: NoteNode[]) => number;
  syncTokenToCharacterNote: (tokenId: string) => Promise<boolean>;
  importEncounter: (
    encounter: EncontroGerado,
    mode: 'current' | 'new-scene'
  ) => { count: number; sceneId: string };

  // Initiative & Turn Tracker
  rollTokenInitiative: (tokenId: string) => number | null;
  rollAllInitiatives: () => void;
  setTokenInitiative: (tokenId: string, value: number | null) => void;
  startCombat: () => void;
  nextTurn: () => void;
  prevTurn: () => void;
  endCombat: () => void;
}

const initialDefaultScene = createDefaultVttScene();

export const useVttStore = create<VttState>((set, get) => {
  const mutateActiveScene = (
    updater: (scene: VttScene) => VttScene,
    immediatePersist = true
  ): VttScene | null => {
    const state = get();
    const current = state.scenes.find((s) => s.id === state.activeSceneId) || state.scenes[0];
    if (!current) return null;
    const updated: VttScene = {
      ...updater(current),
      updatedAt: Date.now(),
    };
    const nextScenes = state.scenes.map((s) => (s.id === updated.id ? updated : s));
    set({ scenes: nextScenes, activeSceneId: updated.id });
    persistSceneDebounced(updated, immediatePersist);
    return updated;
  };

  return {
    scenes: [initialDefaultScene],
    activeSceneId: initialDefaultScene.id,
    selectedTokenId: null,
    activeTool: 'select',
    sidebarTab: 'combat',
    isRightPanelOpen: true,
    cameraFocusRequest: null,
    recentForjaEncounters: [],

    setRecentForjaEncounters: (encounters) => set({ recentForjaEncounters: encounters }),

    setInitialScenes: (scenes) => {
      if (!scenes || scenes.length === 0) {
        const fallback = createDefaultVttScene();
        set({ scenes: [fallback], activeSceneId: fallback.id, selectedTokenId: null });
        return;
      }
      const sorted = [...scenes].sort((a, b) => b.updatedAt - a.updatedAt);
      const existingActive = get().activeSceneId;
      const keepActive = sorted.some((s) => s.id === existingActive) ? existingActive : sorted[0].id;
      set({ scenes: sorted, activeSceneId: keepActive });
    },

    setActiveTool: (tool) => set({ activeTool: tool }),

    selectToken: (tokenId, openInspector = false) =>
      set((s) => ({
        selectedTokenId: tokenId,
        sidebarTab: tokenId && openInspector ? 'inspector' : s.sidebarTab,
        isRightPanelOpen: tokenId && openInspector ? true : s.isRightPanelOpen,
      })),

    setSidebarTab: (tab) => set({ sidebarTab: tab, isRightPanelOpen: true }),
    setRightPanelOpen: (open) => set({ isRightPanelOpen: open }),
    requestCameraFocus: (x, y) => set({ cameraFocusRequest: { x, y, nonce: Date.now() + Math.random() } }),

    selectScene: (sceneId) => {
      const exists = get().scenes.some((s) => s.id === sceneId);
      if (!exists) return;
      set({ activeSceneId: sceneId, selectedTokenId: null });
    },

    createScene: (name, surfacePreset = 'slate') => {
      const count = get().scenes.length + 1;
      const scene = createDefaultVttScene(name?.trim() || `Cena ${count}`, surfacePreset);
      scene.grid.color = VTT_SURFACE_PRESETS[surfacePreset].gridColor;
      set((s) => ({
        scenes: [scene, ...s.scenes],
        activeSceneId: scene.id,
        selectedTokenId: null,
      }));
      persistSceneDebounced(scene, true);
      return scene;
    },

    renameScene: (sceneId, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const state = get();
      const target = state.scenes.find((s) => s.id === sceneId);
      if (!target) return;
      const updated: VttScene = { ...target, name: trimmed, updatedAt: Date.now() };
      set({ scenes: state.scenes.map((s) => (s.id === sceneId ? updated : s)) });
      persistSceneDebounced(updated, true);
    },

    duplicateScene: (sceneId) => {
      const target = get().scenes.find((s) => s.id === sceneId);
      if (!target) return;
      const now = Date.now();
      const copy: VttScene = {
        ...target,
        id: `scene-${crypto.randomUUID()}`,
        name: `${target.name} (Cópia)`,
        createdAt: now,
        updatedAt: now,
        tokens: target.tokens.map((t) => ({ ...t, id: `tok-${crypto.randomUUID()}` })),
        combat: { active: false, round: 1, activeTokenId: null, order: [] },
      };
      set((s) => ({
        scenes: [copy, ...s.scenes],
        activeSceneId: copy.id,
        selectedTokenId: null,
      }));
      persistSceneDebounced(copy, true);
    },

    deleteScene: (sceneId) => {
      const state = get();
      const remaining = state.scenes.filter((s) => s.id !== sceneId);
      dbDeleteVttScene(sceneId).catch(() => {});

      if (remaining.length === 0) {
        const fresh = createDefaultVttScene();
        set({ scenes: [fresh], activeSceneId: fresh.id, selectedTokenId: null });
        persistSceneDebounced(fresh, true);
        return;
      }

      const nextActiveId = state.activeSceneId === sceneId ? remaining[0].id : state.activeSceneId;
      set({ scenes: remaining, activeSceneId: nextActiveId, selectedTokenId: null });
    },

    updateGrid: (patch) => {
      mutateActiveScene((scene) => ({
        ...scene,
        grid: { ...scene.grid, ...patch },
      }));
    },

    setSurfacePreset: (preset) => {
      mutateActiveScene((scene) => ({
        ...scene,
        surfacePreset: preset,
        grid: {
          ...scene.grid,
          color: VTT_SURFACE_PRESETS[preset].gridColor,
        },
      }));
    },

    setBackground: (bg) => {
      mutateActiveScene((scene) => ({
        ...scene,
        background: bg,
      }));
    },

    updateBackground: (patch) => {
      mutateActiveScene((scene) => {
        if (!scene.background) return scene;
        return {
          ...scene,
          background: { ...scene.background, ...patch },
        };
      });
    },

    setCamera: (camera) => {
      mutateActiveScene(
        (scene) => ({
          ...scene,
          camera,
        }),
        false
      );
    },

    addToken: (input) => {
      const state = get();
      const scene = state.scenes.find((s) => s.id === state.activeSceneId) || state.scenes[0];
      const baseOriginX = input.x ?? -scene.camera.x;
      const baseOriginY = input.y ?? -scene.camera.y;
      const slot = findFreeGridSlot(
        scene.tokens,
        baseOriginX,
        baseOriginY,
        scene.grid,
        input.sizeCells
      );

      const token: VttToken = {
        ...input,
        id: `tok-${crypto.randomUUID()}`,
        x: slot.x,
        y: slot.y,
        bloodiedThreshold: input.bloodiedThreshold ?? Math.floor(Math.max(1, input.hpMax) / 2),
      };

      mutateActiveScene((sc) => {
        const tokens = [...sc.tokens, token];
        return {
          ...sc,
          tokens,
          combat: {
            ...sc.combat,
            order: sortOrderByInitiative(tokens),
          },
        };
      });

      set({ selectedTokenId: token.id, sidebarTab: 'inspector', isRightPanelOpen: true });
      return token;
    },

    updateToken: (tokenId, patch) => {
      mutateActiveScene((scene) => {
        const tokens = scene.tokens.map((t) => {
          if (t.id !== tokenId) return t;
          const nextMax = patch.hpMax !== undefined ? Math.max(1, patch.hpMax) : t.hpMax;
          const nextCur =
            patch.hpCurrent !== undefined
              ? Math.max(0, Math.min(nextMax, patch.hpCurrent))
              : Math.min(nextMax, t.hpCurrent);
          return {
            ...t,
            ...patch,
            hpMax: nextMax,
            hpCurrent: nextCur,
            bloodiedThreshold:
              patch.hpMax !== undefined ? Math.floor(nextMax / 2) : t.bloodiedThreshold,
          };
        });
        return {
          ...scene,
          tokens,
          combat: {
            ...scene.combat,
            order:
              patch.initiativeValue !== undefined || patch.initiativeMod !== undefined
                ? sortOrderByInitiative(tokens)
                : scene.combat.order,
          },
        };
      });
    },

    moveToken: (tokenId, x, y, applySnap = true) => {
      mutateActiveScene((scene) => {
        const tokens = scene.tokens.map((t) => {
          if (t.id !== tokenId || t.locked) return t;
          const target = applySnap ? snapPointToGrid(x, y, scene.grid, t.sizeCells) : { x, y };
          return { ...t, x: target.x, y: target.y };
        });
        return { ...scene, tokens };
      });
    },

    duplicateToken: (tokenId) => {
      const state = get();
      const scene = state.scenes.find((s) => s.id === state.activeSceneId);
      if (!scene) return;
      const orig = scene.tokens.find((t) => t.id === tokenId);
      if (!orig) return;

      const slot = findFreeGridSlot(scene.tokens, orig.x, orig.y, scene.grid, orig.sizeCells);
      const copy: VttToken = {
        ...orig,
        id: `tok-${crypto.randomUUID()}`,
        name: `${orig.name} (2)`,
        x: slot.x,
        y: slot.y,
        sourceNoteId: undefined,
      };
      mutateActiveScene((sc) => {
        const tokens = [...sc.tokens, copy];
        return {
          ...sc,
          tokens,
          combat: { ...sc.combat, order: sortOrderByInitiative(tokens) },
        };
      });
      set({ selectedTokenId: copy.id });
    },

    deleteToken: (tokenId) => {
      mutateActiveScene((scene) => {
        const tokens = scene.tokens.filter((t) => t.id !== tokenId);
        const order = scene.combat.order.filter((id) => id !== tokenId);
        const nextActive =
          scene.combat.activeTokenId === tokenId ? order[0] || null : scene.combat.activeTokenId;
        return {
          ...scene,
          tokens,
          combat: {
            ...scene.combat,
            order,
            activeTokenId: nextActive,
            active: order.length > 0 ? scene.combat.active : false,
          },
        };
      });
      if (get().selectedTokenId === tokenId) {
        set({ selectedTokenId: null });
      }
    },

    clearAllTokens: () => {
      mutateActiveScene((scene) => ({
        ...scene,
        tokens: [],
        combat: { active: false, round: 1, activeTokenId: null, order: [] },
      }));
      set({ selectedTokenId: null });
    },

    adjustTokenHp: (tokenId, delta) => {
      if (delta === 0) return;
      const soundOn = useAppStore.getState().settings.soundEnabled;
      if (soundOn) playClickSound();

      mutateActiveScene((scene) => {
        const tokens = scene.tokens.map((t) => {
          if (t.id !== tokenId) return t;
          let hpCurrent = t.hpCurrent;
          let hpTemp = t.hpTemp;

          if (delta < 0) {
            let dmg = Math.abs(delta);
            if (hpTemp > 0) {
              const absorbed = Math.min(hpTemp, dmg);
              hpTemp -= absorbed;
              dmg -= absorbed;
            }
            hpCurrent = Math.max(0, hpCurrent - dmg);
          } else {
            hpCurrent = Math.min(t.hpMax, hpCurrent + delta);
          }

          return { ...t, hpCurrent, hpTemp };
        });
        return { ...scene, tokens };
      });
    },

    toggleTokenCondition: (tokenId, condition) => {
      mutateActiveScene((scene) => {
        const tokens = scene.tokens.map((t) => {
          if (t.id !== tokenId) return t;
          const exists = t.conditions.includes(condition);
          const conditions = exists
            ? t.conditions.filter((c) => c !== condition)
            : [...t.conditions, condition];
          return { ...t, conditions };
        });
        return { ...scene, tokens };
      });
    },

    importCharacterNotes: (notes) => {
      const state = get();
      const scene = state.scenes.find((s) => s.id === state.activeSceneId);
      if (!scene || notes.length === 0) return 0;

      const occupied = [...scene.tokens];
      const added: VttToken[] = [];
      const baseOriginX = -scene.camera.x - scene.grid.cellSize * 2;
      const baseOriginY = -scene.camera.y;

      for (const note of notes) {
        const slot = findFreeGridSlot(occupied, baseOriginX, baseOriginY, scene.grid, 1);
        const token = createTokenFromCharacterNote(note, slot);
        added.push(token);
        occupied.push(token);
      }

      if (added.length === 0) return 0;

      mutateActiveScene((sc) => {
        const tokens = [...sc.tokens, ...added];
        return {
          ...sc,
          tokens,
          combat: { ...sc.combat, order: sortOrderByInitiative(tokens) },
        };
      });

      const first = added[0];
      set({
        selectedTokenId: first.id,
        cameraFocusRequest: { x: first.x, y: first.y, nonce: Date.now() + Math.random() },
      });
      return added.length;
    },

    syncTokenToCharacterNote: async (tokenId) => {
      const state = get();
      const scene = state.scenes.find((s) => s.id === state.activeSceneId);
      const token = scene?.tokens.find((t) => t.id === tokenId);
      if (!token?.sourceNoteId) return false;

      const mapStore = useMapStore.getState();
      const note = mapStore.notes.find((n) => n.id === token.sourceNoteId);
      if (!note || !note.characterSheet) return false;

      await mapStore.saveNoteData({
        ...note,
        updatedAt: Date.now(),
        characterSheet: {
          ...note.characterSheet,
          hpCurrent: token.hpCurrent,
          hpMax: token.hpMax,
          hpTemp: token.hpTemp,
          ac: token.ac,
          conditions: [...token.conditions],
        },
      });
      return true;
    },

    importEncounter: (encounter, mode) => {
      let targetSceneId = get().activeSceneId;

      if (mode === 'new-scene') {
        const preset = mapBiomaToSurfacePreset(encounter.bioma);
        const created = get().createScene(encounter.titulo, preset);
        targetSceneId = created.id;
      }

      const scene = get().scenes.find((s) => s.id === targetSceneId) || get().scenes[0];
      const originX = mode === 'new-scene' ? scene.grid.cellSize * 2 : -scene.camera.x + scene.grid.cellSize * 2;
      const originY = mode === 'new-scene' ? 0 : -scene.camera.y;

      const newTokens = createTokensFromEncounter(
        encounter,
        scene.tokens,
        scene.grid,
        originX,
        originY
      );

      mutateActiveScene((sc) => {
        const tokens = [...sc.tokens, ...newTokens];
        return {
          ...sc,
          tokens,
          combat: {
            ...sc.combat,
            order: sortOrderByInitiative(tokens),
          },
        };
      });

      if (newTokens.length > 0) {
        const avgX = newTokens.reduce((acc, t) => acc + t.x, 0) / newTokens.length;
        const avgY = newTokens.reduce((acc, t) => acc + t.y, 0) / newTokens.length;
        set({
          selectedTokenId: newTokens[0].id,
          sidebarTab: 'combat',
          isRightPanelOpen: true,
          cameraFocusRequest: { x: avgX, y: avgY, nonce: Date.now() + Math.random() },
        });
      }

      return { count: newTokens.length, sceneId: targetSceneId };
    },

    rollTokenInitiative: (tokenId) => {
      const state = get();
      const scene = state.scenes.find((s) => s.id === state.activeSceneId);
      const token = scene?.tokens.find((t) => t.id === tokenId);
      if (!token) return null;

      const d20 = rollSingleDieRaw(20);
      const total = d20 + token.initiativeMod;
      const appState = useAppStore.getState();
      if (appState.settings.soundEnabled) playDiceRollSound(1);

      mutateActiveScene((sc) => {
        const tokens = sc.tokens.map((t) =>
          t.id === tokenId ? { ...t, initiativeValue: total } : t
        );
        return {
          ...sc,
          tokens,
          combat: {
            ...sc.combat,
            order: sortOrderByInitiative(tokens),
          },
        };
      });

      return total;
    },

    rollAllInitiatives: () => {
      const state = get();
      const scene = state.scenes.find((s) => s.id === state.activeSceneId);
      if (!scene) return;
      const combatants = scene.tokens.filter((t) => t.faction !== 'object');
      if (combatants.length === 0) return;

      const appState = useAppStore.getState();
      if (appState.settings.soundEnabled) {
        playDiceRollSound(Math.min(combatants.length, 8));
      }

      mutateActiveScene((sc) => {
        const tokens = sc.tokens.map((t) => {
          if (t.faction === 'object') return t;
          const d20 = rollSingleDieRaw(20);
          return { ...t, initiativeValue: d20 + t.initiativeMod };
        });
        const order = sortOrderByInitiative(tokens);
        return {
          ...sc,
          tokens,
          combat: {
            active: true,
            round: sc.combat.active ? sc.combat.round : 1,
            activeTokenId: sc.combat.activeTokenId && order.includes(sc.combat.activeTokenId)
              ? sc.combat.activeTokenId
              : order[0] || null,
            order,
          },
        };
      });
    },

    setTokenInitiative: (tokenId, value) => {
      mutateActiveScene((sc) => {
        const tokens = sc.tokens.map((t) =>
          t.id === tokenId ? { ...t, initiativeValue: value } : t
        );
        return {
          ...sc,
          tokens,
          combat: {
            ...sc.combat,
            order: sortOrderByInitiative(tokens),
          },
        };
      });
    },

    startCombat: () => {
      const updated = mutateActiveScene((sc) => {
        const order = sortOrderByInitiative(sc.tokens);
        if (order.length === 0) return sc;
        return {
          ...sc,
          combat: {
            active: true,
            round: 1,
            activeTokenId: order[0],
            order,
          },
        };
      });
      if (updated?.combat.activeTokenId) {
        const active = updated.tokens.find((t) => t.id === updated.combat.activeTokenId);
        if (active) {
          set({
            selectedTokenId: active.id,
            cameraFocusRequest: { x: active.x, y: active.y, nonce: Date.now() + Math.random() },
          });
        }
      }
    },

    nextTurn: () => {
      const soundOn = useAppStore.getState().settings.soundEnabled;
      if (soundOn) playClickSound();

      const updated = mutateActiveScene((sc) => {
        const order = sortOrderByInitiative(sc.tokens);
        if (order.length === 0) return sc;
        const currentIdx = sc.combat.activeTokenId ? order.indexOf(sc.combat.activeTokenId) : -1;
        const nextIdx = (currentIdx + 1) % order.length;
        const wrapped = currentIdx >= 0 && nextIdx === 0;
        return {
          ...sc,
          combat: {
            active: true,
            round: wrapped ? sc.combat.round + 1 : sc.combat.round,
            activeTokenId: order[nextIdx],
            order,
          },
        };
      });

      if (updated?.combat.activeTokenId) {
        const active = updated.tokens.find((t) => t.id === updated.combat.activeTokenId);
        if (active) {
          set({
            selectedTokenId: active.id,
            cameraFocusRequest: { x: active.x, y: active.y, nonce: Date.now() + Math.random() },
          });
        }
      }
    },

    prevTurn: () => {
      const soundOn = useAppStore.getState().settings.soundEnabled;
      if (soundOn) playClickSound();

      const updated = mutateActiveScene((sc) => {
        const order = sortOrderByInitiative(sc.tokens);
        if (order.length === 0) return sc;
        const currentIdx = sc.combat.activeTokenId ? order.indexOf(sc.combat.activeTokenId) : 0;
        const prevIdx = (currentIdx - 1 + order.length) % order.length;
        const wrappedBack = currentIdx === 0 && sc.combat.round > 1;
        return {
          ...sc,
          combat: {
            active: true,
            round: wrappedBack ? sc.combat.round - 1 : sc.combat.round,
            activeTokenId: order[prevIdx],
            order,
          },
        };
      });

      if (updated?.combat.activeTokenId) {
        const active = updated.tokens.find((t) => t.id === updated.combat.activeTokenId);
        if (active) {
          set({
            selectedTokenId: active.id,
            cameraFocusRequest: { x: active.x, y: active.y, nonce: Date.now() + Math.random() },
          });
        }
      }
    },

    endCombat: () => {
      mutateActiveScene((sc) => ({
        ...sc,
        combat: {
          active: false,
          round: 1,
          activeTokenId: null,
          order: sortOrderByInitiative(sc.tokens),
        },
      }));
    },
  };
});
