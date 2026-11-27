import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { sanitizeSvg } from '../lib/svgSanitizer';

export type HeraldryCategory = 'faccao' | 'personagem' | 'reino' | 'ordem' | 'outro';

export interface BrasaoItem {
  id: string;
  nome: string;
  categoria: HeraldryCategory;
  svgData: string; // Conteúdo SVG ou data:image/svg+xml
  targetId?: string; // ID da facção, personagem ou assentamento associado
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type ArmoriaSourceMode = 'cloud' | 'docker' | 'custom';

export const ARMORIA_URLS = {
  cloud: 'https://armoria.vercel.app/',
  docker: 'http://localhost:8081',
} as const;

interface HeraldryState {
  brasoes: BrasaoItem[];
  selectedBrasaoId: string | null;
  armoriaSourceMode: ArmoriaSourceMode;
  customArmoriaUrl: string;

  // Actions
  setArmoriaSourceMode: (mode: ArmoriaSourceMode) => void;
  setCustomArmoriaUrl: (url: string) => void;
  getEffectiveArmoriaUrl: () => string;
  setSelectedBrasaoId: (id: string | null) => void;
  salvarBrasao: (params: {
    nome: string;
    categoria: HeraldryCategory;
    svgData: string;
    targetId?: string;
    tags?: string[];
  }) => BrasaoItem;
  atualizarBrasao: (id: string, updates: Partial<Omit<BrasaoItem, 'id' | 'createdAt'>>) => void;
  removerBrasao: (id: string) => void;
  obterBrasaoPorNomeOuTarget: (nomeOuTarget: string) => BrasaoItem | undefined;
}

export const useHeraldryStore = create<HeraldryState>()(
  persist(
    (set, get) => ({
      brasoes: [
        {
          id: 'brasao-exemplo-lobo',
          nome: 'Guarda dos Lobos Cinzentos',
          categoria: 'ordem',
          tags: ['militar', 'norte', 'lobo'],
          svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="100%" height="100%">
            <defs>
              <linearGradient id="bgShield" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e293b"/>
                <stop offset="100%" stop-color="#0f172a"/>
              </linearGradient>
            </defs>
            <path d="M 10 10 L 190 10 C 190 130 140 210 100 235 C 60 210 10 130 10 10 Z" fill="url(#bgShield)" stroke="#94a3b8" stroke-width="6"/>
            <path d="M 25 25 L 175 25 C 175 125 135 195 100 218 C 65 195 25 125 25 25 Z" fill="#334155" opacity="0.4"/>
            <circle cx="100" cy="110" r="45" fill="#38bdf8" opacity="0.2"/>
            <polygon points="100,55 125,100 155,75 135,125 165,145 115,140 100,180 85,140 35,145 65,125 45,75 75,100" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
          </svg>`,
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 86400000,
        },
      ],
      selectedBrasaoId: null,
      armoriaSourceMode: 'cloud',
      customArmoriaUrl: 'http://localhost:8081',

      setArmoriaSourceMode: (mode) => set({ armoriaSourceMode: mode }),
      setCustomArmoriaUrl: (url) => set({ customArmoriaUrl: url }),

      getEffectiveArmoriaUrl: () => {
        const state = get();
        if (state.armoriaSourceMode === 'cloud') return ARMORIA_URLS.cloud;
        if (state.armoriaSourceMode === 'docker') {
          const host =
            typeof window !== 'undefined' && window.location?.hostname
              ? window.location.hostname
              : 'localhost';
          return `http://${host}:8081`;
        }
        return state.customArmoriaUrl || ARMORIA_URLS.cloud;
      },

      setSelectedBrasaoId: (id) => set({ selectedBrasaoId: id }),

      salvarBrasao: ({ nome, categoria, svgData, targetId, tags = [] }) => {
        const cleanSvg = sanitizeSvg(svgData);
        const novo: BrasaoItem = {
          id: `brasao-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          nome: nome.trim() || 'Novo Brasão',
          categoria,
          svgData: cleanSvg,
          targetId: targetId?.trim(),
          tags: tags.map((t) => t.trim()).filter(Boolean),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          brasoes: [novo, ...state.brasoes],
          selectedBrasaoId: novo.id,
        }));

        return novo;
      },

      atualizarBrasao: (id, updates) => {
        const cleanUpdates = { ...updates };
        if (cleanUpdates.svgData) {
          cleanUpdates.svgData = sanitizeSvg(cleanUpdates.svgData);
        }
        set((state) => ({
          brasoes: state.brasoes.map((b) =>
            b.id === id ? { ...b, ...cleanUpdates, updatedAt: Date.now() } : b
          ),
        }));
      },

      removerBrasao: (id) => {
        set((state) => ({
          brasoes: state.brasoes.filter((b) => b.id !== id),
          selectedBrasaoId: state.selectedBrasaoId === id ? null : state.selectedBrasaoId,
        }));
      },

      obterBrasaoPorNomeOuTarget: (nomeOuTarget) => {
        const term = nomeOuTarget.toLowerCase().trim();
        return get().brasoes.find(
          (b) =>
            b.targetId === nomeOuTarget ||
            b.nome.toLowerCase() === term ||
            b.tags.some((t) => t.toLowerCase() === term)
        );
      },
    }),
    {
      name: 'rolldeck-heraldry-vault',
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
