export type VttGridType = 'square' | 'hex' | 'none';

export type VttSurfacePreset = 'slate' | 'dungeon' | 'forest' | 'cavern' | 'parchment';

export type VttTokenFaction = 'ally' | 'enemy' | 'neutral' | 'object';

export type VttTokenSize = 1 | 2 | 3 | 4;

export type VttToolMode = 'select' | 'ruler' | 'pan';

export interface VttTokenAttack {
  id: string;
  name: string;
  bonus: number;
  damage: string;
  damageType?: string;
  effect?: string;
}

export interface VttToken {
  id: string;
  name: string;
  faction: VttTokenFaction;
  color: string;
  avatarUrl?: string;
  sizeCells: VttTokenSize;
  x: number;
  y: number;
  rotation: number;
  locked: boolean;
  hidden: boolean;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  ac: number;
  speed: string;
  initiativeMod: number;
  initiativeValue: number | null;
  conditions: string[];
  notes?: string;
  sourceNoteId?: string;
  sourceRole?: string;
  sourceCr?: string;
  bloodiedThreshold?: number;
  attacks?: VttTokenAttack[];
}

export interface VttBackgroundImage {
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

export interface VttGridConfig {
  type: VttGridType;
  cellSize: number; // px in world coordinates (default 64)
  unitPerCellMeters: number; // default 1.5m (= 5 ft)
  unitDisplay: 'm' | 'ft' | 'both';
  snapToGrid: boolean;
  opacity: number; // 0.05..0.85
  color: string;
}

export interface VttCombatState {
  active: boolean;
  round: number;
  activeTokenId: string | null;
  order: string[];
}

export interface VttScene {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  surfacePreset: VttSurfacePreset;
  background?: VttBackgroundImage | null;
  grid: VttGridConfig;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  tokens: VttToken[];
  combat: VttCombatState;
}

export const VTT_CONDITIONS: { id: string; label: string; short: string; color: string }[] = [
  { id: 'Concentrando', label: 'Concentrando', short: 'CON', color: '#38bdf8' },
  { id: 'Envenenado', label: 'Envenenado', short: 'ENV', color: '#84cc16' },
  { id: 'Caído', label: 'Caído', short: 'CAÍ', color: '#f59e0b' },
  { id: 'Atordoado', label: 'Atordoado', short: 'ATO', color: '#eab308' },
  { id: 'Amedrontado', label: 'Amedrontado', short: 'AME', color: '#a855f7' },
  { id: 'Agarrado', label: 'Agarrado', short: 'AGA', color: '#fb923c' },
  { id: 'Restrito', label: 'Restrito', short: 'RES', color: '#f97316' },
  { id: 'Cego', label: 'Cego', short: 'CEG', color: '#94a3b8' },
  { id: 'Paralisado', label: 'Paralisado', short: 'PAR', color: '#f43f5e' },
  { id: 'Incapacitado', label: 'Incapacitado', short: 'INC', color: '#ef4444' },
  { id: 'Invisível', label: 'Invisível', short: 'INV', color: '#22d3ee' },
  { id: 'Enfeitiçado', label: 'Enfeitiçado', short: 'ENF', color: '#e879f9' },
  { id: 'Em Chamas', label: 'Em Chamas', short: 'FGO', color: '#ea580c' },
  { id: 'Protegido', label: 'Protegido', short: 'PRT', color: '#10b981' },
];

export const VTT_FACTION_META: Record<
  VttTokenFaction,
  { label: string; color: string; ringClass: string }
> = {
  ally: { label: 'Aliado', color: '#10b981', ringClass: 'border-emerald-400' },
  enemy: { label: 'Inimigo', color: '#f43f5e', ringClass: 'border-rose-500' },
  neutral: { label: 'Neutro', color: '#f59e0b', ringClass: 'border-amber-400' },
  object: { label: 'Objeto', color: '#94a3b8', ringClass: 'border-slate-400' },
};

export const VTT_SURFACE_PRESETS: Record<
  VttSurfacePreset,
  { label: string; bg: string; accent: string; gridColor: string }
> = {
  slate: {
    label: 'Ardósia Tática',
    bg: '#0b0f1a',
    accent: '#131b2e',
    gridColor: '#94a3b8',
  },
  dungeon: {
    label: 'Pedra de Masmorra',
    bg: '#111218',
    accent: '#1b1d26',
    gridColor: '#9ca3af',
  },
  forest: {
    label: 'Clareira Noturna',
    bg: '#0a1612',
    accent: '#11241c',
    gridColor: '#6ee7b7',
  },
  cavern: {
    label: 'Caverna Profunda',
    bg: '#130e14',
    accent: '#201623',
    gridColor: '#c4b5fd',
  },
  parchment: {
    label: 'Mapa Antigo',
    bg: '#1c1812',
    accent: '#292218',
    gridColor: '#d6c19c',
  },
};

export const VTT_SIZE_LABELS: Record<VttTokenSize, string> = {
  1: 'Médio / Pequeno (1×1)',
  2: 'Grande (2×2)',
  3: 'Enorme (3×3)',
  4: 'Imenso (4×4)',
};
