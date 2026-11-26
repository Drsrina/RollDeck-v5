export type AdvantageType = 'none' | 'advantage' | 'disadvantage';

export type KeepRule = 'all' | 'keep-highest' | 'keep-lowest';

export interface DieDefinition {
  id: string;
  name: string;
  sides: number;
  isCustomFaces?: boolean;
  customFaces?: string[]; // E.g., ["-1", "0", "+1"] for Fate or ["Cara", "Coroa"]
  color: string;
  symbol?: string;
  isStandard?: boolean;
}

export interface SelectedDieGroup {
  dieId: string;
  count: number;
}

export interface PackageDieGroup {
  id: string;
  count: number;
  dieId: string;
  modifier: number;
  label?: string;
  advantage?: AdvantageType;
  keepRule?: KeepRule;
  keepCount?: number;
  rerollOnes?: boolean;
}

export interface Package {
  id: string;
  name: string;
  color: string;
  icon: string;
  categoryId: string;
  groups: PackageDieGroup[];
  globalModifier: number;
  isFavorite: boolean;
  order: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface SingleDieResult {
  id: string;
  value: number;
  displayValue: string;
  rawValue: number;
  isCriticalSuccess: boolean;
  isCriticalFailure: boolean;
  isDropped?: boolean;
  wasRerolled?: boolean;
  dieName: string;
  sides: number;
  color: string;
}

export interface GroupRollResult {
  groupId: string;
  label?: string;
  dieId: string;
  dieName: string;
  sides: number;
  count: number;
  modifier: number;
  dice: SingleDieResult[];
  groupSubtotal: number;
  formula: string;
}

export interface RollResult {
  id: string;
  timestamp: number;
  title: string;
  formula: string;
  groups: GroupRollResult[];
  globalModifier: number;
  total: number;
  isCriticalSuccess: boolean;
  isCriticalFailure: boolean;
  isPinned?: boolean;
  packageId?: string;
}

export interface AppSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: boolean;
  historyLimit: number;
  schemaVersion: number;
  themeId?: string;
  dice3DEnabled?: boolean;
}

// ----------------- MAP & NOTES TYPES -----------------

export type NodeShape = 'circle' | 'hexagon' | 'card';

export type NoteCategory =
  | 'general'
  | 'location'
  | 'npc'
  | 'character'
  | 'dungeon'
  | 'clue'
  | 'faction'
  | 'item'
  | 'lore';

export type CharacterAttributeKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export interface CharacterSheetAttack {
  id: string;
  name: string;
  bonus: number;
  damage: string;
}

export interface CharacterSheetData {
  playerName?: string;
  race: string;
  characterClass: string;
  level: number;
  alignment?: string;
  background?: string;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  ac: number;
  initiative: number;
  speed: string;
  proficiencyBonus: number;
  passivePerception?: number;
  attributes: Record<CharacterAttributeKey, number>;
  savingThrowProficiencies: CharacterAttributeKey[];
  skills: string[];
  attacks: CharacterSheetAttack[];
  conditions: string[];
  inventory: string;
  spellsAndFeatures: string;
  avatarUrl?: string;
}

export type PlayerSheetKind = 'character' | 'sidekick';

export type SidekickRole = 'warrior' | 'expert' | 'spellcaster' | 'companion';

export interface PlayerSheet {
  id: string;
  kind: PlayerSheetKind;
  name: string;
  sidekickRole?: SidekickRole;
  masterCharacterId?: string;
  masterCharacterName?: string;
  notes: string;
  sheet: CharacterSheetData;
  ownerUserId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  createdAt: number;
  updatedAt: number;
}

export interface NoteNode {
  id: string;
  title: string;
  body: string;
  tags: string[];
  layerId: string;
  category?: NoteCategory;
  characterSheet?: CharacterSheetData;
  sourcePlayerSheetId?: string;
  sheetKind?: PlayerSheetKind;
  ownerUsername?: string;
  ownerDisplayName?: string;
  color?: string;
  x: number;
  y: number;
  pinned: boolean;
  shape?: NodeShape;
  createdAt: number;
  updatedAt: number;
  rollRefId?: string; // If this note represents a pinned roll or package
}

export type NoteLinkStyle = 'solid' | 'dashed' | 'dotted';

export interface NoteLink {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  type?: 'link' | 'ally' | 'enemy' | 'lore' | 'custom' | 'clue' | 'member' | 'location';
  color?: string;
  style?: NoteLinkStyle;
  directional?: boolean;
}

export interface NoteLayer {
  id: string;
  name: string;
  color: string;
  order: number;
  visible: boolean;
  locked: boolean;
  isRollLayer?: boolean;
}

export interface MapFrame {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface MapBackground {
  id: string;
  dataUrl: string;
  opacity: number; // 0.1 to 1.0
  scale: number; // 0.2 to 3.0
  x: number;
  y: number;
  locked: boolean;
}

export interface CanvasMapImage {
  id: string;
  name: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number; // 0.1 to 1.0
  locked: boolean;
  zIndex: number;
}

export interface FloatingWindowState {
  noteId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized: boolean;
  zIndex: number;
}

export interface MapAttachment {
  id: string;
  noteId: string;
  name: string;
  type: string;
  data: string; // base64 data url for easy transport & export
  createdAt: number;
}

export interface MapViewState {
  zoom: number;
  panX: number;
  panY: number;
  mode: 'free' | 'force';
  snapToGrid: boolean;
  showMinimap: boolean;
  focusNodeId?: string | null;
  focusHops: number; // 1, 2, 3
}

// ----------------- LOOT GENERATION & COLUMNS TYPES -----------------

export type LootColumnType =
  | 'text_short'
  | 'text_long'
  | 'number'
  | 'currency'
  | 'single_choice'
  | 'multi_choice'
  | 'boolean'
  | 'tags'
  | 'dice_formula';

export interface CurrencyConfig {
  unit: string; // e.g. "PO", "créditos", "GP"
  conversionRate: number; // base conversion multiplier
}

export interface LootColumn {
  id: string;
  key: string;
  label: string;
  type: LootColumnType;
  instruction: string;
  required: boolean;
  enabled: boolean;
  options?: string[];
  unit?: string;
  currencyConfig?: CurrencyConfig;
  min?: number;
  max?: number;
}

export interface LootItem {
  id: string;
  isLocked?: boolean;
  cells: Record<string, any>;
  rolledValues?: Record<string, { formula: string; result: number }>;
}

export interface LootGeneratorParams {
  count: number;
  rarity: 'comum' | 'incomum' | 'raro' | 'épico' | 'lendário' | 'misto';
  minValue?: number;
  maxValue?: number;
  language: string;
  creativity: 'conservative' | 'balanced' | 'wild';
  noRepeat: boolean;
}

export interface LootGenerator {
  id: string;
  name: string;
  icon: string;
  color: string;
  theme: string;
  instructions?: string;
  params: LootGeneratorParams;
  columns: LootColumn[];
  createdAt: number;
  updatedAt: number;
}

export interface LootGroupTotals {
  totalValueText: string;
  totalWeightText?: string;
  itemCount: number;
}

export interface LootGroup {
  id: string;
  generatorId: string;
  title: string;
  theme: string;
  columnsSnapshot: LootColumn[];
  items: LootItem[];
  totals: LootGroupTotals;
  createdAt: number;
  linkedNoteIds: string[];
  linkedTableObjectId?: string;
}

export interface AISettings {
  provider: 'offline-procedural' | 'openai-compatible' | 'anthropic' | 'custom-proxy';
  model: string;
  endpoint?: string;
  apiKey?: string;
}

export interface CanvasTableObject {
  id: string;
  title: string;
  theme: string;
  x: number;
  y: number;
  width: number;
  height: number;
  columns: LootColumn[];
  items: LootItem[];
  layerId: string;
  sourceGroupId: string;
  createdAt: number;
}

export type DrawingPreset = 'free' | 'river' | 'trail' | 'wall';

export type DrawingStrokeStyle = 'solid' | 'dashed' | 'dotted';

export type MapCanvasTool = 'pan' | 'draw' | 'select-drawing';

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface MapDrawing {
  id: string;
  layerId: string;
  preset: DrawingPreset;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  points: DrawingPoint[]; // normalized 0..1 coordinates within bounding box
  color: string;
  strokeWidth: number;
  opacity: number; // 0.1..1.0
  strokeStyle: DrawingStrokeStyle;
  smooth: boolean;
  zIndex: number;
  createdAt: number;
  updatedAt: number;
}

export interface DrawingStyleConfig {
  preset: DrawingPreset;
  color: string;
  strokeWidth: number;
  opacity: number;
  strokeStyle: DrawingStrokeStyle;
  smooth: boolean;
}

import type { VttScene } from './vtt';
export * from './vtt';

export interface BackupData {
  app: 'RollDeck';
  schemaVersion: number;
  exportedAt: string;
  dice: DieDefinition[];
  packages: Package[];
  categories: Category[];
  history: RollResult[];
  settings: AppSettings;
  notes?: NoteNode[];
  links?: NoteLink[];
  layers?: NoteLayer[];
  frames?: MapFrame[];
  drawings?: MapDrawing[];
  attachments?: MapAttachment[];
  viewState?: Partial<MapViewState>;
  generators?: LootGenerator[];
  lootGroups?: LootGroup[];
  tableObjects?: CanvasTableObject[];
  aiSettings?: Partial<AISettings>;
  vttScenes?: VttScene[];
}
