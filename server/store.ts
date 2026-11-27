import fs from 'fs/promises';
import path from 'path';
import type {
  AppSettings,
  CanvasMapImage,
  Category,
  DieDefinition,
  LootGenerator,
  LootGroup,
  MapDrawing,
  MapFrame,
  MapViewState,
  NoteLayer,
  NoteLink,
  NoteNode,
  Package,
  PlayerSheet,
  RollResult,
} from '../src/types';
import type { VttScene } from '../src/types/vtt';
import { DEFAULT_CUSTOM_DICE } from '../src/lib/roll';
import { DEFAULT_LOOT_GENERATOR_TEMPLATES } from '../src/lib/lootTemplates';

export type ApiKeyScope = 'read' | 'write' | 'roll' | 'generate';

export type UserRole = 'admin' | 'gm' | 'player' | 'viewer';

export const ROLE_SCOPES: Record<UserRole, ApiKeyScope[]> = {
  admin: ['read', 'write', 'roll', 'generate'],
  gm: ['read', 'write', 'roll', 'generate'],
  player: ['read', 'roll'],
  viewer: ['read'],
};

export interface StoredUser {
  id: string;
  username: string; // normalized lowercase (no email)
  displayName: string;
  role: UserRole;
  active: boolean;
  passwordHash: string;
  passwordSalt: string;
  passwordVersion: number;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  scopes: ApiKeyScope[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

export interface StoredApiKey {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  salt: string;
  scopes: ApiKeyScope[];
  createdAt: number;
  lastUsedAt?: number;
  revoked: boolean;
}

export interface PublicApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdAt: number;
  lastUsedAt?: number;
  revoked: boolean;
}

export interface AuthStateRecord {
  claimedHash?: string;
  claimedSalt?: string;
  claimedAt?: number;
}

export interface StoredHeraldryItem {
  id: string;
  nome: string;
  categoria: string;
  svgData: string;
  targetId?: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface StoredWorldMapItem {
  id: string;
  nome: string;
  imageDataUrl: string;
  tipo: string;
  descricao?: string;
  createdAt: number;
}

export interface ApiCollections {
  notes: NoteNode[];
  links: NoteLink[];
  layers: NoteLayer[];
  frames: MapFrame[];
  drawings: MapDrawing[];
  mapImages: CanvasMapImage[];
  vttScenes: VttScene[];
  heraldry: StoredHeraldryItem[];
  worldMaps: StoredWorldMapItem[];
  dice: DieDefinition[];
  packages: Package[];
  categories: Category[];
  history: RollResult[];
  lootGenerators: LootGenerator[];
  lootGroups: LootGroup[];
  playerSheets: PlayerSheet[];
  settings: AppSettings;
  viewState: MapViewState;
}

export interface ApiStoreDocument {
  schemaVersion: number;
  updatedAt: number;
  auth: AuthStateRecord;
  users: StoredUser[];
  apiKeys: StoredApiKey[];
  collections: ApiCollections;
}

export type CollectionName =
  | 'notes'
  | 'links'
  | 'layers'
  | 'frames'
  | 'drawings'
  | 'mapImages'
  | 'vttScenes'
  | 'heraldry'
  | 'worldMaps'
  | 'dice'
  | 'packages'
  | 'categories'
  | 'history'
  | 'lootGenerators'
  | 'lootGroups'
  | 'playerSheets';

const DEFAULT_API_CATEGORIES: Category[] = [
  { id: 'combat', name: 'Combate', icon: '⚔️', color: '#f43f5e' },
  { id: 'spells', name: 'Magias', icon: '✨', color: '#e879f9' },
  { id: 'skills', name: 'Perícias', icon: '📜', color: '#22d3ee' },
  { id: 'general', name: 'Geral', icon: '🎲', color: '#a3e635' },
];

const DEFAULT_API_LAYERS: NoteLayer[] = [
  { id: 'layer-locations', name: 'Locais & Cidades', color: '#38bdf8', order: 0, visible: true, locked: false },
  { id: 'layer-npcs', name: 'NPCs & Aliados', color: '#a3e635', order: 1, visible: true, locked: false },
  { id: 'layer-quests', name: 'Missões & Lore', color: '#e879f9', order: 2, visible: true, locked: false },
  { id: 'layer-loot', name: 'Loot & Tesouros', color: '#f59e0b', order: 3, visible: true, locked: false },
  { id: 'layer-rolls', name: 'Rolagens Fixadas', color: '#f43f5e', order: 4, visible: true, locked: false, isRollLayer: true },
];

const DEFAULT_API_PACKAGES: Package[] = [
  {
    id: 'pkg-sword-attack',
    name: 'Ataque com Espada Longa',
    color: '#22d3ee',
    icon: '⚔️',
    categoryId: 'combat',
    globalModifier: 0,
    isFavorite: true,
    order: 0,
    groups: [
      { id: 'g-atk', dieId: 'd20', count: 1, modifier: 5, label: 'Ataque', advantage: 'none' },
      { id: 'g-dmg', dieId: 'd8', count: 1, modifier: 3, label: 'Dano Cortante', advantage: 'none' },
    ],
  },
  {
    id: 'pkg-fireball',
    name: 'Bola de Fogo (Nível 3)',
    color: '#f97316',
    icon: '🔥',
    categoryId: 'spells',
    globalModifier: 0,
    isFavorite: true,
    order: 1,
    groups: [
      { id: 'g-fire', dieId: 'd6', count: 8, modifier: 0, label: 'Dano Ígneo', advantage: 'none' },
    ],
  },
];

const DEFAULT_API_SETTINGS: AppSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  reduceMotion: false,
  historyLimit: 200,
  schemaVersion: 3,
  themeId: 'cyberpunk',
};

const DEFAULT_API_VIEW_STATE: MapViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  mode: 'free',
  snapToGrid: false,
  showMinimap: true,
  focusHops: 1,
};

export function createDefaultStoreDocument(): ApiStoreDocument {
  return {
    schemaVersion: 4,
    updatedAt: Date.now(),
    auth: {},
    users: [],
    apiKeys: [],
    collections: {
      notes: [],
      links: [],
      layers: structuredClone(DEFAULT_API_LAYERS),
      frames: [],
      drawings: [],
      mapImages: [],
      vttScenes: [],
      heraldry: [],
      worldMaps: [],
      dice: structuredClone(DEFAULT_CUSTOM_DICE),
      packages: structuredClone(DEFAULT_API_PACKAGES),
      categories: structuredClone(DEFAULT_API_CATEGORIES),
      history: [],
      lootGenerators: structuredClone(DEFAULT_LOOT_GENERATOR_TEMPLATES),
      lootGroups: [],
      playerSheets: [],
      settings: { ...DEFAULT_API_SETTINGS },
      viewState: { ...DEFAULT_API_VIEW_STATE },
    },
  };
}

export interface ApiStore {
  readonly storageKind: 'file' | 'postgres';
  init(): Promise<ApiStoreDocument>;
  getState(): Promise<ApiStoreDocument>;
  mutate<T>(mutator: (doc: ApiStoreDocument) => T): Promise<T>;
  toPublicKey(key: StoredApiKey): PublicApiKey;
  toPublicUser(user: StoredUser): PublicUser;
}

export class LocalApiStore implements ApiStore {
  readonly storageKind = 'file' as const;
  private readonly filePath: string;
  private cache: ApiStoreDocument | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(customFilePath?: string) {
    this.filePath =
      customFilePath || path.resolve(process.cwd(), 'data', 'rolldeck-api-store.json');
  }

  async init(): Promise<ApiStoreDocument> {
    if (this.cache) return this.cache;

    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ApiStoreDocument>;
      const defaults = createDefaultStoreDocument();
      this.cache = {
        schemaVersion: parsed.schemaVersion ?? defaults.schemaVersion,
        updatedAt: parsed.updatedAt ?? Date.now(),
        auth: parsed.auth ?? {},
        users: Array.isArray(parsed.users) ? parsed.users : [],
        apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : [],
        collections: {
          ...defaults.collections,
          ...(parsed.collections ?? {}),
          playerSheets: Array.isArray(parsed.collections?.playerSheets)
            ? parsed.collections.playerSheets
            : [],
          settings: { ...defaults.collections.settings, ...(parsed.collections?.settings ?? {}) },
          viewState: { ...defaults.collections.viewState, ...(parsed.collections?.viewState ?? {}) },
        },
      };
      return this.cache;
    } catch {
      this.cache = createDefaultStoreDocument();
      await this.persist();
      return this.cache;
    }
  }

  async getState(): Promise<ApiStoreDocument> {
    return this.init();
  }

  async mutate<T>(mutator: (doc: ApiStoreDocument) => T): Promise<T> {
    const doc = await this.init();
    const result = mutator(doc);
    doc.updatedAt = Date.now();
    await this.persist();
    return result;
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.cache, null, 2);
    const dir = path.dirname(this.filePath);
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;

    this.writeChain = this.writeChain
      .then(async () => {
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(tempPath, snapshot, { encoding: 'utf-8', mode: 0o600 });
        await fs.rename(tempPath, this.filePath);
      })
      .catch(async (err) => {
        try {
          await fs.unlink(tempPath);
        } catch {}
        console.error('Erro ao persistir banco local da API:', err);
      });

    return this.writeChain;
  }

  toPublicKey(key: StoredApiKey): PublicApiKey {
    return {
      id: key.id,
      name: key.name,
      prefix: key.prefix,
      scopes: key.scopes,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
      revoked: key.revoked,
    };
  }

  toPublicUser(user: StoredUser): PublicUser {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      scopes: ROLE_SCOPES[user.role],
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
