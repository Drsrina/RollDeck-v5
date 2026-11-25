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

export type VttWeatherLayerId = 'rain' | 'snow' | 'wind' | 'fog' | 'embers' | 'lightning';

export type VttAmbientTone = 'none' | 'dusk' | 'night' | 'dungeon' | 'inferno';

export interface VttWeatherConfig {
  enabled: boolean;
  layers: Record<VttWeatherLayerId, number>; // 0 = off, 0.1..1 = intensity
  windSpeed: number; // 0..1
  windAngle: number; // -60..60 degrees (0 = straight down / calm, positive = blowing right)
  ambientTone: VttAmbientTone;
  ambientOpacity: number; // 0..0.65
  audioEnabled: boolean;
  audioVolume: number; // 0..1
}

export interface VttWeatherPreset {
  id: string;
  label: string;
  accent: string;
  weather: Omit<VttWeatherConfig, 'audioEnabled' | 'audioVolume'>;
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
  weather?: VttWeatherConfig;
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

export const DEFAULT_VTT_WEATHER: VttWeatherConfig = {
  enabled: false,
  layers: {
    rain: 0,
    snow: 0,
    wind: 0,
    fog: 0,
    embers: 0,
    lightning: 0,
  },
  windSpeed: 0.35,
  windAngle: 18,
  ambientTone: 'none',
  ambientOpacity: 0.25,
  audioEnabled: false,
  audioVolume: 0.45,
};

export const VTT_WEATHER_LAYER_META: Record<
  VttWeatherLayerId,
  { label: string; color: string; defaultIntensity: number }
> = {
  rain: { label: 'Chuva', color: '#38bdf8', defaultIntensity: 0.65 },
  snow: { label: 'Neve', color: '#e2e8f0', defaultIntensity: 0.6 },
  wind: { label: 'Vento', color: '#94a3b8', defaultIntensity: 0.55 },
  fog: { label: 'Neblina', color: '#cbd5e1', defaultIntensity: 0.55 },
  embers: { label: 'Centelhas', color: '#fb923c', defaultIntensity: 0.65 },
  lightning: { label: 'Relâmpagos', color: '#a5f3fc', defaultIntensity: 0.5 },
};

export const VTT_AMBIENT_TONE_META: Record<
  VttAmbientTone,
  { label: string; swatch: string; tint: string; vignette: string }
> = {
  none: {
    label: 'Normal',
    swatch: '#475569',
    tint: 'rgba(0,0,0,0)',
    vignette: 'rgba(0,0,0,0)',
  },
  dusk: {
    label: 'Entardecer',
    swatch: '#f97316',
    tint: 'rgba(180, 83, 9, 0.22)',
    vignette: 'rgba(45, 16, 44, 0.45)',
  },
  night: {
    label: 'Noite',
    swatch: '#1d4ed8',
    tint: 'rgba(12, 24, 68, 0.38)',
    vignette: 'rgba(2, 6, 23, 0.68)',
  },
  dungeon: {
    label: 'Masmorra',
    swatch: '#4c1d95',
    tint: 'rgba(15, 10, 30, 0.32)',
    vignette: 'rgba(2, 4, 12, 0.72)',
  },
  inferno: {
    label: 'Brasas',
    swatch: '#dc2626',
    tint: 'rgba(153, 27, 27, 0.24)',
    vignette: 'rgba(30, 6, 6, 0.55)',
  },
};

export const VTT_WEATHER_PRESETS: VttWeatherPreset[] = [
  {
    id: 'clear',
    label: 'Limpo',
    accent: '#94a3b8',
    weather: {
      enabled: false,
      layers: { rain: 0, snow: 0, wind: 0, fog: 0, embers: 0, lightning: 0 },
      windSpeed: 0.25,
      windAngle: 15,
      ambientTone: 'none',
      ambientOpacity: 0,
    },
  },
  {
    id: 'rain',
    label: 'Chuva',
    accent: '#38bdf8',
    weather: {
      enabled: true,
      layers: { rain: 0.65, snow: 0, wind: 0.25, fog: 0.15, embers: 0, lightning: 0 },
      windSpeed: 0.4,
      windAngle: 18,
      ambientTone: 'night',
      ambientOpacity: 0.18,
    },
  },
  {
    id: 'storm',
    label: 'Tempestade',
    accent: '#22d3ee',
    weather: {
      enabled: true,
      layers: { rain: 0.92, snow: 0, wind: 0.72, fog: 0.25, embers: 0, lightning: 0.65 },
      windSpeed: 0.78,
      windAngle: 30,
      ambientTone: 'night',
      ambientOpacity: 0.38,
    },
  },
  {
    id: 'blizzard',
    label: 'Nevasca',
    accent: '#e2e8f0',
    weather: {
      enabled: true,
      layers: { rain: 0, snow: 0.85, wind: 0.6, fog: 0.35, embers: 0, lightning: 0 },
      windSpeed: 0.68,
      windAngle: 26,
      ambientTone: 'night',
      ambientOpacity: 0.2,
    },
  },
  {
    id: 'breeze',
    label: 'Vento & Folhas',
    accent: '#34d399',
    weather: {
      enabled: true,
      layers: { rain: 0, snow: 0, wind: 0.65, fog: 0, embers: 0, lightning: 0 },
      windSpeed: 0.55,
      windAngle: 32,
      ambientTone: 'dusk',
      ambientOpacity: 0.16,
    },
  },
  {
    id: 'fog',
    label: 'Névoa Densa',
    accent: '#cbd5e1',
    weather: {
      enabled: true,
      layers: { rain: 0, snow: 0, wind: 0.15, fog: 0.82, embers: 0, lightning: 0 },
      windSpeed: 0.2,
      windAngle: 12,
      ambientTone: 'dungeon',
      ambientOpacity: 0.28,
    },
  },
  {
    id: 'embers',
    label: 'Fogo & Centelhas',
    accent: '#fb923c',
    weather: {
      enabled: true,
      layers: { rain: 0, snow: 0, wind: 0.25, fog: 0.2, embers: 0.85, lightning: 0 },
      windSpeed: 0.38,
      windAngle: 14,
      ambientTone: 'inferno',
      ambientOpacity: 0.3,
    },
  },
  {
    id: 'dungeon',
    label: 'Masmorra',
    accent: '#a855f7',
    weather: {
      enabled: true,
      layers: { rain: 0, snow: 0, wind: 0, fog: 0.35, embers: 0.28, lightning: 0 },
      windSpeed: 0.15,
      windAngle: 8,
      ambientTone: 'dungeon',
      ambientOpacity: 0.42,
    },
  },
];
