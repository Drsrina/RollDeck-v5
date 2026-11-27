import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthSession, setAuthSession, type AuthUser } from './authSession';
import { collectClientSnapshot, pullConsolidatedStateFromServer } from './serverSync';
import { useHeraldryStore } from '../store/useHeraldryStore';
import { useMapStore } from '../store/useMapStore';
import { useVttStore } from '../store/useVttStore';
import { useWorldMapStore } from '../store/useWorldMapStore';

function makeGmUser(): AuthUser {
  const now = Date.now();
  return {
    id: 'usr_gm_sync',
    username: 'mestre',
    displayName: 'Mestre',
    role: 'gm',
    scopes: ['read', 'write', 'roll', 'generate'],
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

describe('serverSync — Sincronização Consolidada com o Servidor', () => {
  beforeEach(() => {
    clearAuthSession();
    useMapStore.setState({ notes: [], links: [], mapImages: [], drawings: [] });
    useHeraldryStore.setState({ brasoes: [] });
    useWorldMapStore.setState({ mapas: [] });
    vi.restoreAllMocks();
  });

  it('coleta todas as coleções dos stores locais no snapshot consolidado', () => {
    useHeraldryStore.getState().salvarBrasao({
      nome: 'Brasão Real',
      categoria: 'reino',
      svgData: '<svg></svg>',
    });
    useWorldMapStore.getState().salvarMapa({
      nome: 'Mapa de Eldoria',
      imageDataUrl: 'data:image/png;base64,abc',
      tipo: 'continente',
    });

    const snapshot = collectClientSnapshot();
    expect(snapshot.heraldry).toHaveLength(1);
    expect(snapshot.heraldry[0].nome).toBe('Brasão Real');
    expect(snapshot.worldMaps).toHaveLength(1);
    expect(snapshot.worldMaps[0].nome).toBe('Mapa de Eldoria');
    expect(Array.isArray(snapshot.vttScenes)).toBe(true);
    expect(Array.isArray(snapshot.notes)).toBe(true);
  });

  it('hidrata todos os stores locais a partir de GET /api/v1/snapshot quando autenticado', async () => {
    setAuthSession('tok-gm', makeGmUser());

    const mockServerSnapshot = {
      notes: [
        {
          id: 'note-srv-1',
          title: 'Taverna do Dragão',
          body: 'Ponto de encontro',
          tags: [],
          layerId: 'layer-locations',
          x: 100,
          y: 200,
          pinned: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      links: [],
      layers: [],
      frames: [],
      drawings: [],
      mapImages: [],
      vttScenes: [
        {
          ...useVttStore.getState().scenes[0],
          id: 'scene-srv-1',
          name: 'Cena Consolidada do Servidor',
        },
      ],
      heraldry: [
        {
          id: 'brasao-srv-1',
          nome: 'Casa Valen',
          categoria: 'faccao',
          svgData: '<svg><circle cx="10" cy="10" r="5"/></svg>',
          tags: [],
          createdAt: 1000,
          updatedAt: 1000,
        },
      ],
      worldMaps: [
        {
          id: 'map-srv-1',
          nome: 'Continente Norte',
          imageDataUrl: 'data:image/png;base64,srv',
          tipo: 'continente',
          createdAt: 1000,
        },
      ],
      dice: [],
      packages: [],
      categories: [],
      history: [],
      lootGenerators: [],
      lootGroups: [],
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockServerSnapshot), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const ok = await pullConsolidatedStateFromServer();
    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [reqUrl, reqInit] = fetchSpy.mock.calls[0];
    expect(reqUrl).toBe('/api/v1/snapshot');
    expect(new Headers(reqInit?.headers).get('Authorization')).toBe('Bearer tok-gm');

    expect(useMapStore.getState().notes).toHaveLength(1);
    expect(useMapStore.getState().notes[0].title).toBe('Taverna do Dragão');
    expect(useVttStore.getState().scenes[0].name).toBe('Cena Consolidada do Servidor');
    expect(useHeraldryStore.getState().brasoes[0].nome).toBe('Casa Valen');
    expect(useWorldMapStore.getState().mapas[0].nome).toBe('Continente Norte');
  });
});
