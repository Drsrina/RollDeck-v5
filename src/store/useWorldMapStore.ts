import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useMapStore } from './useMapStore';
import { useVttStore } from './useVttStore';

export type FMGSourceMode = 'cloud' | 'docker' | 'custom';

export const FMG_URLS = {
  cloud: 'https://azgaar.github.io/Fantasy-Map-Generator/',
  docker: 'http://localhost:8080',
} as const;

export interface WorldMapSnapshot {
  id: string;
  nome: string;
  imageDataUrl: string; // PNG base64 data URL ou SVG
  tipo: 'continente' | 'regional' | 'tatico' | 'outro';
  descricao?: string;
  createdAt: number;
}

interface WorldMapState {
  fmgSourceMode: FMGSourceMode;
  customFMGUrl: string;
  mapas: WorldMapSnapshot[];
  selectedMapId: string | null;

  // Ações de configuração e URL
  setFMGSourceMode: (mode: FMGSourceMode) => void;
  setCustomFMGUrl: (url: string) => void;
  getEffectiveFMGUrl: () => string;
  setSelectedMapId: (id: string | null) => void;

  // Ações de CRUD de Mapas
  salvarMapa: (params: {
    nome: string;
    imageDataUrl: string;
    tipo?: 'continente' | 'regional' | 'tatico' | 'outro';
    descricao?: string;
  }) => WorldMapSnapshot;
  removerMapa: (id: string) => void;

  // Ações de Envio Cross-Module (Canvas & VTT)
  enviarMapaParaVtt: (mapaId: string, nomeCena?: string) => string | null;
  enviarMapaParaCanvas: (mapaId: string) => Promise<boolean>;
}

export const useWorldMapStore = create<WorldMapState>()(
  persist(
    (set, get) => ({
      fmgSourceMode: 'cloud',
      customFMGUrl: 'http://localhost:8080',
      mapas: [],
      selectedMapId: null,

      setFMGSourceMode: (mode) => set({ fmgSourceMode: mode }),
      setCustomFMGUrl: (url) => set({ customFMGUrl: url }),

      getEffectiveFMGUrl: () => {
        const state = get();
        if (state.fmgSourceMode === 'cloud') return FMG_URLS.cloud;
        if (state.fmgSourceMode === 'docker') {
          const host =
            typeof window !== 'undefined' && window.location?.hostname
              ? window.location.hostname
              : 'localhost';
          return `http://${host}:8080`;
        }
        return state.customFMGUrl || FMG_URLS.cloud;
      },

      setSelectedMapId: (id) => set({ selectedMapId: id }),

      salvarMapa: ({ nome, imageDataUrl, tipo = 'continente', descricao }) => {
        const novo: WorldMapSnapshot = {
          id: `world-map-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          nome: nome.trim() || 'Mapa Continental Sem Nome',
          imageDataUrl,
          tipo,
          descricao,
          createdAt: Date.now(),
        };

        set((state) => ({
          mapas: [novo, ...state.mapas],
          selectedMapId: novo.id,
        }));

        return novo;
      },

      removerMapa: (id) => {
        set((state) => ({
          mapas: state.mapas.filter((m) => m.id !== id),
          selectedMapId: state.selectedMapId === id ? null : state.selectedMapId,
        }));
      },

      enviarMapaParaVtt: (mapaId, nomeCena) => {
        const mapa = get().mapas.find((m) => m.id === mapaId);
        if (!mapa) return null;

        const vttStore = useVttStore.getState();
        const finalSceneName = nomeCena || `Mapa: ${mapa.nome}`;

        // Cria nova cena no VTT
        const newScene = vttStore.createScene(finalSceneName, 'parchment');

        // Configura imagem de fundo
        vttStore.setBackground({
          dataUrl: mapa.imageDataUrl,
          name: mapa.nome,
          width: 2048,
          height: 1536,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 0.95,
        });

        return newScene.id;
      },

      enviarMapaParaCanvas: async (mapaId) => {
        const mapa = get().mapas.find((m) => m.id === mapaId);
        if (!mapa) return false;

        const mapStore = useMapStore.getState();

        try {
          await mapStore.addMapImage({
            dataUrl: mapa.imageDataUrl,
            name: mapa.nome,
            x: 0,
            y: 0,
            width: 1200,
            height: 900,
            opacity: 1,
            locked: false,
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'rolldeck-worldmap-vault',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            }
      ),
    }
  )
);
