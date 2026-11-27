import {
  replaceAllLinks as dbReplaceAllLinks,
  replaceAllNotes as dbReplaceAllNotes,
  saveMapDrawings,
  saveMapImages,
  saveMapViewState,
  saveSettings as dbSaveSettings,
} from '../db/indexedDB';
import { apiFetch, getAuthUser, isGmOrAdmin } from './authSession';
import { useAppStore } from '../store/useAppStore';
import { useHeraldryStore } from '../store/useHeraldryStore';
import { useLootStore } from '../store/useLootStore';
import { useMapStore } from '../store/useMapStore';
import { useVttStore } from '../store/useVttStore';
import { useWorldMapStore } from '../store/useWorldMapStore';

let isApplyingServerSync = false;
let syncPushTimer: number | null = null;
let listenersAttached = false;

export interface ServerSnapshotPayload {
  notes: any[];
  links: any[];
  layers: any[];
  frames: any[];
  drawings: any[];
  mapImages: any[];
  vttScenes: any[];
  heraldry: any[];
  worldMaps: any[];
  dice: any[];
  packages: any[];
  categories: any[];
  history: any[];
  lootGenerators: any[];
  lootGroups: any[];
  settings: any;
  viewState: any;
}

export function collectClientSnapshot(): ServerSnapshotPayload {
  const app = useAppStore.getState();
  const map = useMapStore.getState();
  const vtt = useVttStore.getState();
  const loot = useLootStore.getState();
  const heraldry = useHeraldryStore.getState();
  const worldMap = useWorldMapStore.getState();

  return {
    notes: map.notes,
    links: map.links,
    layers: map.layers,
    frames: map.frames,
    drawings: map.drawings,
    mapImages: map.mapImages,
    vttScenes: vtt.scenes,
    heraldry: heraldry.brasoes,
    worldMaps: worldMap.mapas,
    dice: app.customDice,
    packages: app.packages,
    categories: app.categories,
    history: app.history,
    lootGenerators: loot.generators,
    lootGroups: loot.lootGroupsHistory,
    settings: app.settings,
    viewState: map.viewState,
  };
}

/**
 * Envia o estado consolidado atual dos stores do navegador para o servidor PostgreSQL.
 * Executado apenas para usuários autenticados com permissão de escrita (Admin / GM).
 */
export async function pushConsolidatedStateToServer(
  mode: 'replace' | 'merge' = 'replace'
): Promise<boolean> {
  const user = getAuthUser();
  if (!user || !isGmOrAdmin(user)) return false;

  try {
    const data = collectClientSnapshot();
    const res = await apiFetch('/api/v1/snapshot', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Busca o estado consolidado do servidor PostgreSQL e hidrata todos os stores do navegador.
 * Se o servidor estiver recém-criado (vazio) e o navegador do Mestre já tiver dados locais,
 * faz um merge inicial para não perder trabalho local.
 */
export async function pullConsolidatedStateFromServer(): Promise<boolean> {
  const user = getAuthUser();
  if (!user) return false;

  try {
    const res = await apiFetch('/api/v1/snapshot');
    if (!res.ok) return false;
    const server = (await res.json()) as Partial<ServerSnapshotPayload>;

    const isMaster = isGmOrAdmin(user);
    const localSnapshot = collectClientSnapshot();

    const serverHasAnyCampaignData =
      (Array.isArray(server.notes) && server.notes.length > 0) ||
      (Array.isArray(server.vttScenes) && server.vttScenes.length > 0) ||
      (Array.isArray(server.heraldry) && server.heraldry.length > 0) ||
      (Array.isArray(server.worldMaps) && server.worldMaps.length > 0) ||
      (Array.isArray(server.history) && server.history.length > 0);

    const localHasAnyCampaignData =
      localSnapshot.notes.length > 0 ||
      localSnapshot.vttScenes.length > 1 ||
      localSnapshot.heraldry.length > 1 ||
      localSnapshot.worldMaps.length > 0 ||
      localSnapshot.history.length > 0;

    // Migração inicial segura: servidor zerado + cliente Mestre com dados prévios
    if (isMaster && !serverHasAnyCampaignData && localHasAnyCampaignData) {
      await pushConsolidatedStateToServer('merge');
      return true;
    }

    isApplyingServerSync = true;
    try {
      // 1. AppStore (dados customizados, pacotes, categorias, histórico, ajustes)
      const currentApp = useAppStore.getState();
      const nextDice = Array.isArray(server.dice) ? server.dice : currentApp.customDice;
      const nextPackages =
        Array.isArray(server.packages) && server.packages.length > 0
          ? server.packages
          : currentApp.packages;
      const nextCategories =
        Array.isArray(server.categories) && server.categories.length > 0
          ? server.categories
          : currentApp.categories;
      const nextHistory = Array.isArray(server.history) ? server.history : currentApp.history;
      const nextSettings = server.settings
        ? { ...currentApp.settings, ...server.settings }
        : currentApp.settings;

      useAppStore.setState({
        customDice: nextDice,
        packages: nextPackages,
        categories: nextCategories,
        history: nextHistory,
        settings: nextSettings,
      });

      if (typeof indexedDB !== 'undefined') {
        dbSaveSettings(nextSettings).catch(() => {});
      }

      // 2. MapStore (notas, links, camadas, molduras, desenhos, imagens) — somente GM/Admin
      if (isMaster) {
        const currentMap = useMapStore.getState();
        const nextNotes = Array.isArray(server.notes) ? server.notes : currentMap.notes;
        const nextLinks = Array.isArray(server.links) ? server.links : currentMap.links;
        const nextLayers =
          Array.isArray(server.layers) && server.layers.length > 0
            ? server.layers
            : currentMap.layers;
        const nextFrames = Array.isArray(server.frames) ? server.frames : currentMap.frames;
        const nextDrawings = Array.isArray(server.drawings) ? server.drawings : currentMap.drawings;
        const nextMapImages = Array.isArray(server.mapImages)
          ? server.mapImages
          : currentMap.mapImages;
        const nextViewState = server.viewState
          ? { ...currentMap.viewState, ...server.viewState }
          : currentMap.viewState;

        currentMap.setInitialData({
          notes: nextNotes,
          links: nextLinks,
          layers: nextLayers,
          frames: nextFrames,
          viewState: nextViewState,
        });
        useMapStore.setState({
          drawings: nextDrawings,
          mapImages: nextMapImages,
        });

        if (typeof indexedDB !== 'undefined') {
          dbReplaceAllNotes(nextNotes).catch(() => {});
          dbReplaceAllLinks(nextLinks).catch(() => {});
          saveMapDrawings(nextDrawings).catch(() => {});
          saveMapImages(nextMapImages).catch(() => {});
          saveMapViewState(nextViewState).catch(() => {});
        }
      }

      // 3. VTT Scenes (compartilhado para todos os participantes da mesa)
      if (Array.isArray(server.vttScenes) && server.vttScenes.length > 0) {
        useVttStore.getState().setInitialScenes(server.vttScenes);
      }

      // 4. Loot Store (GM/Admin)
      if (isMaster) {
        const currentLoot = useLootStore.getState();
        useLootStore.setState({
          generators:
            Array.isArray(server.lootGenerators) && server.lootGenerators.length > 0
              ? server.lootGenerators
              : currentLoot.generators,
          lootGroupsHistory: Array.isArray(server.lootGroups)
            ? server.lootGroups
            : currentLoot.lootGroupsHistory,
        });
      }

      // 5. Cofres do Estúdio (Heráldica e Mapas Continentais)
      if (Array.isArray(server.heraldry) && server.heraldry.length > 0) {
        useHeraldryStore.setState({ brasoes: server.heraldry });
      }
      if (Array.isArray(server.worldMaps) && server.worldMaps.length > 0) {
        useWorldMapStore.setState({ mapas: server.worldMaps });
      }
    } finally {
      isApplyingServerSync = false;
    }

    return true;
  } catch {
    return false;
  }
}

function scheduleServerPush() {
  if (isApplyingServerSync) return;
  const user = getAuthUser();
  if (!user || !isGmOrAdmin(user)) return;

  if (syncPushTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(syncPushTimer);
  }

  if (typeof window !== 'undefined') {
    syncPushTimer = window.setTimeout(() => {
      syncPushTimer = null;
      pushConsolidatedStateToServer('replace').catch(() => {});
    }, 800);
  }
}

/**
 * Conecta os listeners nos stores Zustand para sincronizar alterações automaticamente
 * com o banco consolidado do servidor (PostgreSQL).
 */
export function startConsolidatedServerSync(): void {
  if (listenersAttached) return;
  listenersAttached = true;

  useAppStore.subscribe((state, prev) => {
    if (
      state.customDice !== prev.customDice ||
      state.packages !== prev.packages ||
      state.categories !== prev.categories ||
      state.history !== prev.history ||
      state.settings !== prev.settings
    ) {
      scheduleServerPush();
    }
  });

  useMapStore.subscribe((state, prev) => {
    if (
      state.notes !== prev.notes ||
      state.links !== prev.links ||
      state.layers !== prev.layers ||
      state.frames !== prev.frames ||
      state.drawings !== prev.drawings ||
      state.mapImages !== prev.mapImages
    ) {
      scheduleServerPush();
    }
  });

  useVttStore.subscribe((state, prev) => {
    if (state.scenes !== prev.scenes) {
      scheduleServerPush();
    }
  });

  useLootStore.subscribe((state, prev) => {
    if (
      state.generators !== prev.generators ||
      state.lootGroupsHistory !== prev.lootGroupsHistory
    ) {
      scheduleServerPush();
    }
  });

  useHeraldryStore.subscribe((state, prev) => {
    if (state.brasoes !== prev.brasoes) {
      scheduleServerPush();
    }
  });

  useWorldMapStore.subscribe((state, prev) => {
    if (state.mapas !== prev.mapas) {
      scheduleServerPush();
    }
  });
}
