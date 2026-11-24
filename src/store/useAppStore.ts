import { create } from 'zustand';
import {
  clearHistory as dbClearHistory,
  deleteDie as dbDeleteDie,
  deleteHistoryItem as dbDeleteHistoryItem,
  deletePackage as dbDeletePackage,
  initStorage,
  saveDie as dbSaveDie,
  saveHistoryItem as dbSaveHistoryItem,
  savePackage as dbSavePackage,
  savePackages as dbSavePackages,
  saveSettings as dbSaveSettings,
  updateHistoryItem as dbUpdateHistoryItem,
  DEFAULT_CATEGORIES,
  DEFAULT_PACKAGES,
  DEFAULT_SETTINGS,
} from '../db/indexedDB';
import { playCriticalFailSound, playCriticalSuccessSound, playDiceRollSound } from '../lib/audio';
import { isSupported3DSides, type PolyhedralDieSides } from '../lib/dice3DGeometry';
import { triggerHaptic } from '../lib/haptics';
import { executeRoll, STANDARD_DICE } from '../lib/roll';
import { applyTheme } from '../lib/theme';
import { useLootStore } from './useLootStore';
import { useMapStore } from './useMapStore';
import { useVttStore } from './useVttStore';
import type {
  AdvantageType,
  AppSettings,
  Category,
  DieDefinition,
  Package,
  PackageDieGroup,
  RollResult,
  SelectedDieGroup,
} from '../types';

export type ActiveTab =
  | 'roll'
  | 'packages'
  | 'map'
  | 'vtt'
  | 'loot'
  | 'forja'
  | 'oraculo'
  | 'history'
  | 'settings';

export interface Dice3DRollItem {
  dieId: string;
  sides: PolyhedralDieSides;
  value: number;
  color: string;
}

export interface Dice3DRollEvent {
  id: number;
  title: string;
  dice: Dice3DRollItem[];
}

export interface Dice3DCommand {
  id: number;
  type: 'toss-all' | 'gather';
}

function extract3DRollDice(result: RollResult): Dice3DRollItem[] {
  const items: Dice3DRollItem[] = [];
  for (const group of result.groups) {
    for (const die of group.dice) {
      if (items.length >= 16) return items;
      if (isSupported3DSides(die.sides)) {
        items.push({
          dieId: group.dieId,
          sides: die.sides,
          value: die.rawValue,
          color: die.color,
        });
      }
    }
  }
  return items;
}

interface AppState {
  isInitialized: boolean;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  // Sidebar & Navigation layout state
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  isMobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;

  // Dice definitions
  customDice: DieDefinition[];
  allDice: DieDefinition[]; // standard + custom

  // Packages & Categories
  packages: Package[];
  categories: Category[];

  // History & Settings
  history: RollResult[];
  settings: AppSettings;

  // Active Tray State
  tray: SelectedDieGroup[];
  globalModifier: number;
  trayAdvantage: AdvantageType;

  // Tray Actions
  addDieToTray: (dieId: string) => void;
  removeDieFromTray: (dieId: string) => void;
  setDieCountInTray: (dieId: string, count: number) => void;
  clearTray: () => void;
  setGlobalModifier: (mod: number | ((prev: number) => number)) => void;
  setTrayAdvantage: (adv: AdvantageType) => void;

  // Rolling State
  isRolling: boolean;
  currentResult: RollResult | null;
  showResultModal: boolean;
  setShowResultModal: (show: boolean) => void;

  // Interactive 3D Dice Overlay Sync
  dice3DRollEvent: Dice3DRollEvent | null;
  dice3DCommand: Dice3DCommand | null;
  dispatchDice3DCommand: (type: 'toss-all' | 'gather') => void;
  recordInteractive3DRoll: (
    dieId: string,
    sides: PolyhedralDieSides,
    value: number,
    color: string
  ) => Promise<void>;

  // Roll Execution
  rollTray: () => Promise<RollResult | null>;
  rollPackage: (pkg: Package) => Promise<RollResult | null>;
  rollAgain: () => Promise<RollResult | null>;

  // Management CRUD
  saveCustomDie: (die: DieDefinition) => Promise<void>;
  deleteCustomDie: (dieId: string) => Promise<void>;

  savePackage: (pkg: Package) => Promise<void>;
  duplicatePackage: (pkg: Package) => Promise<void>;
  deletePackage: (pkgId: string) => Promise<void>;
  togglePackageFavorite: (pkgId: string) => Promise<void>;
  reorderPackages: (packages: Package[]) => Promise<void>;

  // History Actions
  togglePinHistory: (id: string) => Promise<void>;
  deleteHistoryItem: (id: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;

  // Settings
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;

  // DB Sync / Refresh
  refreshFromDB: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  isInitialized: false,
  activeTab: 'roll',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
  isMobileDrawerOpen: false,
  setMobileDrawerOpen: (open) => set({ isMobileDrawerOpen: open }),

  customDice: [],
  allDice: STANDARD_DICE,

  packages: DEFAULT_PACKAGES,
  categories: DEFAULT_CATEGORIES,
  history: [],
  settings: DEFAULT_SETTINGS,

  // Tray state
  tray: [],
  globalModifier: 0,
  trayAdvantage: 'none',

  isRolling: false,
  currentResult: null,
  showResultModal: false,
  setShowResultModal: (show) => set({ showResultModal: show }),

  dice3DRollEvent: null,
  dice3DCommand: null,
  dispatchDice3DCommand: (type) =>
    set({
      dice3DCommand: {
        id: Date.now() + Math.random(),
        type,
      },
    }),

  recordInteractive3DRoll: async (dieId, sides, value, color) => {
    const state = get();
    const isD20 = sides === 20 || dieId === 'd20';
    const isCritSuccess = isD20 ? value === 20 : value === sides;
    const isCritFail = isD20 ? value === 1 : value === 1 && sides > 2;

    if (isCritSuccess) {
      if (state.settings.soundEnabled) playCriticalSuccessSound();
      triggerHaptic('crit-success', state.settings.hapticsEnabled);
    } else if (isCritFail) {
      if (state.settings.soundEnabled) playCriticalFailSound();
      triggerHaptic('crit-fail', state.settings.hapticsEnabled);
    }

    const result: RollResult = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      title: `Dado 3D (${dieId})`,
      formula: `1×${dieId}`,
      groups: [
        {
          groupId: crypto.randomUUID(),
          dieId,
          dieName: dieId,
          sides,
          count: 1,
          modifier: 0,
          groupSubtotal: value,
          formula: `1×${dieId}`,
          dice: [
            {
              id: crypto.randomUUID(),
              value,
              displayValue: String(value),
              rawValue: value,
              isCriticalSuccess: isCritSuccess,
              isCriticalFailure: isCritFail,
              dieName: dieId,
              sides,
              color,
            },
          ],
        },
      ],
      globalModifier: 0,
      total: value,
      isCriticalSuccess: isD20 && isCritSuccess,
      isCriticalFailure: isD20 && isCritFail,
    };

    await dbSaveHistoryItem(result, state.settings.historyLimit);
    set((s) => ({
      currentResult: result,
      history: [result, ...s.history.slice(0, s.settings.historyLimit - 1)],
    }));
  },

  // Add one die to tray
  addDieToTray: (dieId: string) => {
    const { settings } = get();
    triggerHaptic('tap', settings.hapticsEnabled);

    set((state) => {
      const existingIndex = state.tray.findIndex((item) => item.dieId === dieId);
      if (existingIndex >= 0) {
        const updated = [...state.tray];
        updated[existingIndex] = {
          ...updated[existingIndex],
          count: updated[existingIndex].count + 1,
        };
        return { tray: updated };
      } else {
        return { tray: [...state.tray, { dieId, count: 1 }] };
      }
    });
  },

  // Remove one die from tray (or delete chip if 1)
  removeDieFromTray: (dieId: string) => {
    const { settings } = get();
    triggerHaptic('remove', settings.hapticsEnabled);

    set((state) => {
      const existing = state.tray.find((item) => item.dieId === dieId);
      if (!existing) return state;

      if (existing.count <= 1) {
        return { tray: state.tray.filter((item) => item.dieId !== dieId) };
      } else {
        return {
          tray: state.tray.map((item) =>
            item.dieId === dieId ? { ...item, count: item.count - 1 } : item
          ),
        };
      }
    });
  },

  setDieCountInTray: (dieId: string, count: number) => {
    set((state) => {
      if (count <= 0) {
        return { tray: state.tray.filter((item) => item.dieId !== dieId) };
      }
      const existing = state.tray.find((item) => item.dieId === dieId);
      if (existing) {
        return {
          tray: state.tray.map((item) =>
            item.dieId === dieId ? { ...item, count } : item
          ),
        };
      }
      return { tray: [...state.tray, { dieId, count }] };
    });
  },

  clearTray: () => {
    const { settings } = get();
    triggerHaptic('tap', settings.hapticsEnabled);
    set({ tray: [], globalModifier: 0, trayAdvantage: 'none' });
  },

  setGlobalModifier: (modifierOrUpdater) => {
    set((state) => ({
      globalModifier:
        typeof modifierOrUpdater === 'function'
          ? modifierOrUpdater(state.globalModifier)
          : modifierOrUpdater,
    }));
  },

  setTrayAdvantage: (adv) => {
    const { settings } = get();
    triggerHaptic('tap', settings.hapticsEnabled);
    set({ trayAdvantage: adv });
  },

  // Roll tray
  rollTray: async () => {
    const state = get();
    if (state.tray.length === 0 || state.isRolling) return null;

    set({ isRolling: true });

    // Haptics & Audio
    const totalDiceCount = state.tray.reduce((acc, t) => acc + t.count, 0);
    if (state.settings.soundEnabled) {
      playDiceRollSound(totalDiceCount);
    }
    triggerHaptic('roll', state.settings.hapticsEnabled);

    // Build lookup
    const diceLookup = new Map<string, DieDefinition>();
    state.allDice.forEach((d) => diceLookup.set(d.id, d));

    const groups: PackageDieGroup[] = state.tray.map((item) => ({
      id: crypto.randomUUID(),
      count: item.count,
      dieId: item.dieId,
      modifier: 0,
      advantage: item.dieId === 'd20' ? state.trayAdvantage : 'none',
    }));

    const result = executeRoll({
      title: 'Rolagem Rápida',
      groups,
      globalModifier: state.globalModifier,
      diceLookup,
    });

    const dice3D = state.settings.dice3DEnabled !== false ? extract3DRollDice(result) : [];
    if (dice3D.length > 0) {
      set({
        dice3DRollEvent: {
          id: Date.now() + Math.random(),
          title: result.title,
          dice: dice3D,
        },
      });
    }

    // Animation delay
    const delay = state.settings.reduceMotion ? 100 : dice3D.length > 0 ? 920 : 750;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Handle Crits sounds and haptics
    if (result.isCriticalSuccess) {
      if (state.settings.soundEnabled) playCriticalSuccessSound();
      triggerHaptic('crit-success', state.settings.hapticsEnabled);
    } else if (result.isCriticalFailure) {
      if (state.settings.soundEnabled) playCriticalFailSound();
      triggerHaptic('crit-fail', state.settings.hapticsEnabled);
    }

    // Persist to history
    await dbSaveHistoryItem(result, state.settings.historyLimit);

    set((s) => ({
      isRolling: false,
      currentResult: result,
      showResultModal: true,
      history: [result, ...s.history.slice(0, s.settings.historyLimit - 1)],
    }));

    return result;
  },

  // 1-Tap Package Roll
  rollPackage: async (pkg: Package) => {
    const state = get();
    if (state.isRolling) return null;

    set({ isRolling: true });

    const totalDiceCount = pkg.groups.reduce((acc, g) => acc + g.count, 0);
    if (state.settings.soundEnabled) {
      playDiceRollSound(totalDiceCount);
    }
    triggerHaptic('roll', state.settings.hapticsEnabled);

    const diceLookup = new Map<string, DieDefinition>();
    state.allDice.forEach((d) => diceLookup.set(d.id, d));

    const result = executeRoll({
      title: pkg.name,
      groups: pkg.groups,
      globalModifier: pkg.globalModifier,
      diceLookup,
      packageId: pkg.id,
    });

    const dice3D = state.settings.dice3DEnabled !== false ? extract3DRollDice(result) : [];
    if (dice3D.length > 0) {
      set({
        dice3DRollEvent: {
          id: Date.now() + Math.random(),
          title: result.title,
          dice: dice3D,
        },
      });
    }

    const delay = state.settings.reduceMotion ? 100 : dice3D.length > 0 ? 920 : 750;
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (result.isCriticalSuccess) {
      if (state.settings.soundEnabled) playCriticalSuccessSound();
      triggerHaptic('crit-success', state.settings.hapticsEnabled);
    } else if (result.isCriticalFailure) {
      if (state.settings.soundEnabled) playCriticalFailSound();
      triggerHaptic('crit-fail', state.settings.hapticsEnabled);
    }

    await dbSaveHistoryItem(result, state.settings.historyLimit);

    set((s) => ({
      isRolling: false,
      currentResult: result,
      showResultModal: true,
      history: [result, ...s.history.slice(0, s.settings.historyLimit - 1)],
    }));

    return result;
  },

  // Roll again with same formula
  rollAgain: async () => {
    const state = get();
    if (!state.currentResult || state.isRolling) return null;

    set({ isRolling: true });

    const totalDiceCount = state.currentResult.groups.reduce((acc, g) => acc + g.count, 0);
    if (state.settings.soundEnabled) {
      playDiceRollSound(totalDiceCount);
    }
    triggerHaptic('roll', state.settings.hapticsEnabled);

    const diceLookup = new Map<string, DieDefinition>();
    state.allDice.forEach((d) => diceLookup.set(d.id, d));

    // Reconstruct groups from previous result
    const groups: PackageDieGroup[] = state.currentResult.groups.map((g) => ({
      id: crypto.randomUUID(),
      count: g.count,
      dieId: g.dieId,
      modifier: g.modifier,
      label: g.label,
    }));

    const result = executeRoll({
      title: state.currentResult.title,
      groups,
      globalModifier: state.currentResult.globalModifier,
      diceLookup,
      packageId: state.currentResult.packageId,
    });

    const dice3D = state.settings.dice3DEnabled !== false ? extract3DRollDice(result) : [];
    if (dice3D.length > 0) {
      set({
        dice3DRollEvent: {
          id: Date.now() + Math.random(),
          title: result.title,
          dice: dice3D,
        },
      });
    }

    const delay = state.settings.reduceMotion ? 100 : dice3D.length > 0 ? 920 : 750;
    await new Promise((resolve) => setTimeout(resolve, delay));

    if (result.isCriticalSuccess) {
      if (state.settings.soundEnabled) playCriticalSuccessSound();
      triggerHaptic('crit-success', state.settings.hapticsEnabled);
    } else if (result.isCriticalFailure) {
      if (state.settings.soundEnabled) playCriticalFailSound();
      triggerHaptic('crit-fail', state.settings.hapticsEnabled);
    }

    await dbSaveHistoryItem(result, state.settings.historyLimit);

    set((s) => ({
      isRolling: false,
      currentResult: result,
      showResultModal: true,
      history: [result, ...s.history.slice(0, s.settings.historyLimit - 1)],
    }));

    return result;
  },

  // Save custom die
  saveCustomDie: async (die: DieDefinition) => {
    await dbSaveDie(die);
    set((state) => {
      const existing = state.customDice.find((d) => d.id === die.id);
      const updatedCustom = existing
        ? state.customDice.map((d) => (d.id === die.id ? die : d))
        : [...state.customDice, die];
      return {
        customDice: updatedCustom,
        allDice: [...STANDARD_DICE, ...updatedCustom],
      };
    });
  },

  deleteCustomDie: async (dieId: string) => {
    await dbDeleteDie(dieId);
    set((state) => {
      const updatedCustom = state.customDice.filter((d) => d.id !== dieId);
      return {
        customDice: updatedCustom,
        allDice: [...STANDARD_DICE, ...updatedCustom],
        tray: state.tray.filter((t) => t.dieId !== dieId),
      };
    });
  },

  // Packages CRUD
  savePackage: async (pkg: Package) => {
    await dbSavePackage(pkg);
    set((state) => {
      const existing = state.packages.find((p) => p.id === pkg.id);
      const updated = existing
        ? state.packages.map((p) => (p.id === pkg.id ? pkg : p))
        : [...state.packages, pkg];
      updated.sort((a, b) => a.order - b.order);
      return { packages: updated };
    });
  },

  duplicatePackage: async (pkg: Package) => {
    const newPkg: Package = {
      ...pkg,
      id: `pkg-${crypto.randomUUID()}`,
      name: `${pkg.name} (Cópia)`,
      order: get().packages.length,
      groups: pkg.groups.map((g) => ({ ...g, id: crypto.randomUUID() })),
    };
    await get().savePackage(newPkg);
  },

  deletePackage: async (pkgId: string) => {
    await dbDeletePackage(pkgId);
    set((state) => ({
      packages: state.packages.filter((p) => p.id !== pkgId),
    }));
  },

  togglePackageFavorite: async (pkgId: string) => {
    const pkg = get().packages.find((p) => p.id === pkgId);
    if (!pkg) return;
    const updated = { ...pkg, isFavorite: !pkg.isFavorite };
    await get().savePackage(updated);
  },

  reorderPackages: async (packages: Package[]) => {
    const indexed = packages.map((p, idx) => ({ ...p, order: idx }));
    await dbSavePackages(indexed);
    set({ packages: indexed });
  },

  // History CRUD
  togglePinHistory: async (id: string) => {
    const item = get().history.find((h) => h.id === id);
    if (!item) return;
    const updated = { ...item, isPinned: !item.isPinned };
    await dbUpdateHistoryItem(updated);
    set((state) => ({
      history: state.history.map((h) => (h.id === id ? updated : h)),
    }));
  },

  deleteHistoryItem: async (id: string) => {
    await dbDeleteHistoryItem(id);
    set((state) => ({
      history: state.history.filter((h) => h.id !== id),
    }));
  },

  clearAllHistory: async () => {
    await dbClearHistory();
    set({ history: [] });
  },

  updateSettings: async (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    if (newSettings.themeId) {
      applyTheme(newSettings.themeId);
    }
    await dbSaveSettings(updated);
    set({ settings: updated });
  },

  refreshFromDB: async () => {
    const data = await initStorage();
    // Apply theme immediately
    applyTheme(data.settings.themeId || 'cyberpunk');

    // Also initialize Map store
    useMapStore.getState().setInitialData({
      notes: data.notes,
      links: data.links,
      layers: data.layers,
      frames: data.frames,
      viewState: data.viewState,
    });

    // Also initialize Loot store
    useLootStore.getState().setInitialData({
      generators: data.generators,
      lootGroups: data.lootGroups,
      aiSettings: data.aiSettings,
    });

    // Also initialize VTT store
    useVttStore.getState().setInitialScenes(data.vttScenes);

    set({
      isInitialized: true,
      customDice: data.dice,
      allDice: [...STANDARD_DICE, ...data.dice],
      packages: data.packages,
      categories: data.categories,
      history: data.history,
      settings: data.settings,
    });
  },
}));
