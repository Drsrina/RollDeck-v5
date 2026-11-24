import { z } from 'zod';

const safeIdSchema = z.string().min(1).max(120);
const safeColorSchema = z.string().min(1).max(40);

export const UserRoleSchema = z.enum(['admin', 'gm', 'player', 'viewer']);

export const UsernameSchema = z
  .string()
  .trim()
  .min(3, 'Usuário deve ter pelo menos 3 caracteres.')
  .max(32, 'Usuário deve ter no máximo 32 caracteres.')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Use apenas letras, números, ponto, hífen ou underline (sem espaços ou e-mail).'
  )
  .transform((v) => v.toLowerCase());

export const PasswordSchema = z
  .string()
  .min(6, 'A senha deve ter pelo menos 6 caracteres.')
  .max(128, 'A senha deve ter no máximo 128 caracteres.');

export const AdminSetupSchema = z.object({
  username: UsernameSchema.default('admin'),
  displayName: z.string().trim().min(1).max(60).optional(),
  password: PasswordSchema,
});

export const LoginSchema = z.object({
  username: z.string().trim().min(1).max(64).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});

export const CreateUserSchema = z.object({
  username: UsernameSchema,
  displayName: z.string().trim().min(1).max(60).optional(),
  password: PasswordSchema,
  role: UserRoleSchema.default('player'),
  active: z.boolean().optional().default(true),
});

export const UpdateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  role: UserRoleSchema.optional(),
  active: z.boolean().optional(),
  password: PasswordSchema.optional(),
});

export const ApiKeyScopeSchema = z.enum(['read', 'write', 'roll', 'generate']);

export const CreateApiKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(ApiKeyScopeSchema).min(1).max(4).default(['read', 'roll', 'generate']),
});

export const NoteCategorySchema = z.enum([
  'general',
  'location',
  'npc',
  'character',
  'dungeon',
  'clue',
  'faction',
  'item',
  'lore',
]);

export const NoteSchema = z.object({
  id: safeIdSchema.optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50000).default(''),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  layerId: safeIdSchema.default('layer-locations'),
  category: NoteCategorySchema.optional().default('general'),
  characterSheet: z.any().optional(),
  color: safeColorSchema.optional(),
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  pinned: z.boolean().default(false),
  shape: z.enum(['circle', 'hexagon', 'card']).optional(),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
  rollRefId: safeIdSchema.optional(),
});

export const NotePatchSchema = NoteSchema.partial().omit({ id: true });

export const LinkSchema = z.object({
  id: safeIdSchema.optional(),
  fromId: safeIdSchema,
  toId: safeIdSchema,
  label: z.string().max(120).optional(),
  type: z
    .enum(['link', 'ally', 'enemy', 'lore', 'custom', 'clue', 'member', 'location'])
    .optional()
    .default('link'),
  color: safeColorSchema.optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
  directional: z.boolean().optional(),
});

export const LinkPatchSchema = LinkSchema.partial().omit({ id: true });

export const LayerSchema = z.object({
  id: safeIdSchema.optional(),
  name: z.string().trim().min(1).max(100),
  color: safeColorSchema.default('#38bdf8'),
  order: z.number().int().min(0).max(1000).default(0),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  isRollLayer: z.boolean().optional(),
});

export const LayerPatchSchema = LayerSchema.partial().omit({ id: true });

export const FrameSchema = z.object({
  id: safeIdSchema.optional(),
  title: z.string().trim().min(1).max(120),
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  width: z.number().finite().min(40).max(10000).default(360),
  height: z.number().finite().min(40).max(10000).default(280),
  color: safeColorSchema.default('#22d3ee'),
});

export const FramePatchSchema = FrameSchema.partial().omit({ id: true });

export const DrawingPointSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const DrawingSchema = z.object({
  id: safeIdSchema.optional(),
  layerId: safeIdSchema.default('layer-locations'),
  preset: z.enum(['free', 'river', 'trail', 'wall']).default('free'),
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  width: z.number().finite().min(4).max(20000).default(100),
  height: z.number().finite().min(4).max(20000).default(100),
  rotation: z.number().finite().min(-3600).max(3600).default(0),
  points: z.array(DrawingPointSchema).min(1).max(2000),
  color: safeColorSchema.default('#22d3ee'),
  strokeWidth: z.number().finite().min(1).max(80).default(4),
  opacity: z.number().finite().min(0.05).max(1).default(0.95),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).default('solid'),
  smooth: z.boolean().default(true),
  zIndex: z.number().int().optional(),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
});

export const DrawingPatchSchema = DrawingSchema.partial().omit({ id: true });

export const DieSchema = z.object({
  id: safeIdSchema.optional(),
  name: z.string().trim().min(1).max(60),
  sides: z.number().int().min(2).max(1000),
  isCustomFaces: z.boolean().optional(),
  customFaces: z.array(z.string().max(40)).max(200).optional(),
  color: safeColorSchema.default('#22d3ee'),
  symbol: z.string().max(16).optional(),
  isStandard: z.boolean().optional(),
});

export const DiePatchSchema = DieSchema.partial().omit({ id: true });

export const PackageDieGroupSchema = z.object({
  id: safeIdSchema.optional(),
  count: z.number().int().min(1).max(100),
  dieId: safeIdSchema,
  modifier: z.number().int().min(-1000).max(1000).default(0),
  label: z.string().max(80).optional(),
  advantage: z.enum(['none', 'advantage', 'disadvantage']).optional().default('none'),
  keepRule: z.enum(['all', 'keep-highest', 'keep-lowest']).optional().default('all'),
  keepCount: z.number().int().min(1).max(100).optional(),
  rerollOnes: z.boolean().optional().default(false),
});

export const PackageSchema = z.object({
  id: safeIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  color: safeColorSchema.default('#22d3ee'),
  icon: z.string().max(16).default('🎲'),
  categoryId: safeIdSchema.default('general'),
  groups: z.array(PackageDieGroupSchema).min(1).max(30),
  globalModifier: z.number().int().min(-1000).max(1000).default(0),
  isFavorite: z.boolean().default(false),
  order: z.number().int().min(0).max(10000).default(0),
});

export const PackagePatchSchema = PackageSchema.partial().omit({ id: true });

export const CategorySchema = z.object({
  id: safeIdSchema.optional(),
  name: z.string().trim().min(1).max(80),
  icon: z.string().max(16).default('🎲'),
  color: safeColorSchema.default('#22d3ee'),
});

export const CategoryPatchSchema = CategorySchema.partial().omit({ id: true });

export const HistoryRecordSchema = z.object({
  id: safeIdSchema.optional(),
  timestamp: z.number().int().optional(),
  title: z.string().trim().min(1).max(160),
  formula: z.string().max(240),
  groups: z.array(z.any()).max(50).default([]),
  globalModifier: z.number().int().default(0),
  total: z.number().finite(),
  isCriticalSuccess: z.boolean().default(false),
  isCriticalFailure: z.boolean().default(false),
  isPinned: z.boolean().optional(),
  packageId: safeIdSchema.optional(),
});

export const HistoryPatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  isPinned: z.boolean().optional(),
});

export const LootGeneratorSchema = z.object({
  id: safeIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  icon: z.string().max(16).default('💎'),
  color: safeColorSchema.default('#f59e0b'),
  theme: z.string().max(240).default('Tesouro medieval'),
  instructions: z.string().max(2000).optional(),
  params: z.object({
    count: z.number().int().min(1).max(50).default(5),
    rarity: z.enum(['comum', 'incomum', 'raro', 'épico', 'lendário', 'misto']).default('misto'),
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    language: z.string().max(20).default('pt-BR'),
    creativity: z.enum(['conservative', 'balanced', 'wild']).default('balanced'),
    noRepeat: z.boolean().default(true),
  }),
  columns: z.array(z.any()).min(1).max(30),
  createdAt: z.number().int().optional(),
  updatedAt: z.number().int().optional(),
});

export const LootGeneratorPatchSchema = LootGeneratorSchema.partial().omit({ id: true });

export const LootGroupSchema = z.object({
  id: safeIdSchema.optional(),
  generatorId: safeIdSchema,
  title: z.string().trim().min(1).max(160),
  theme: z.string().max(240).default(''),
  columnsSnapshot: z.array(z.any()).max(30).default([]),
  items: z.array(z.any()).max(100).default([]),
  totals: z.object({
    totalValueText: z.string().max(80),
    totalWeightText: z.string().max(80).optional(),
    itemCount: z.number().int().min(0),
  }),
  createdAt: z.number().int().optional(),
  linkedNoteIds: z.array(safeIdSchema).max(50).default([]),
  linkedTableObjectId: safeIdSchema.optional(),
});

export const SettingsPatchSchema = z.object({
  soundEnabled: z.boolean().optional(),
  hapticsEnabled: z.boolean().optional(),
  reduceMotion: z.boolean().optional(),
  historyLimit: z.number().int().min(10).max(2000).optional(),
  themeId: z.string().max(40).optional(),
});

export const ViewStatePatchSchema = z.object({
  zoom: z.number().finite().min(0.1).max(10).optional(),
  panX: z.number().finite().optional(),
  panY: z.number().finite().optional(),
  mode: z.enum(['free', 'force']).optional(),
  snapToGrid: z.boolean().optional(),
  showMinimap: z.boolean().optional(),
  focusNodeId: z.string().max(120).nullable().optional(),
  focusHops: z.number().int().min(1).max(5).optional(),
});

export const RollRequestSchema = z
  .object({
    title: z.string().trim().max(160).optional(),
    expression: z.string().trim().min(2).max(120).optional(),
    packageId: safeIdSchema.optional(),
    groups: z.array(PackageDieGroupSchema).min(1).max(25).optional(),
    globalModifier: z.number().int().min(-1000).max(1000).optional().default(0),
    saveToHistory: z.boolean().optional().default(true),
  })
  .refine((v) => Boolean(v.expression || v.packageId || (v.groups && v.groups.length > 0)), {
    message: 'Informe "expression" (ex: "2d20kh1+5"), "packageId" ou "groups".',
  });

export const OracleRequestSchema = z.object({
  pergunta: z.string().trim().min(1).max(300).default('Consulta externa ao Oráculo'),
  probabilidade: z
    .enum([
      'certeza',
      'quaseCerto',
      'provavel',
      'meio',
      'improvavel',
      'muitoImprovavel',
      'quaseImpossivel',
    ])
    .default('meio'),
  modificador: z.number().int().min(-50).max(50).default(0),
  seed: z.union([z.number().int(), z.string().max(80)]).optional(),
});

export const ForjaWorldRequestSchema = z.object({
  seed: z.union([z.number().int(), z.string().max(80)]).optional(),
});

export const ForjaBatchRequestSchema = z.object({
  seed: z.union([z.number().int(), z.string().max(80)]).optional(),
  count: z.number().int().min(1).max(30).default(5),
});

export const ForjaDungeonRequestSchema = z.object({
  seed: z.union([z.number().int(), z.string().max(80)]).optional(),
  algoritmo: z.enum(['donjon', 'bsp', 'caverna']).optional(),
  dificuldade: z.enum(['facil', 'medio', 'dificil', 'mortal']).optional(),
  nivelGrupo: z.number().int().min(1).max(20).optional(),
  largura: z.number().int().min(15).max(80).optional(),
  altura: z.number().int().min(15).max(80).optional(),
});

export const ForjaSettlementRequestSchema = z.object({
  seed: z.union([z.number().int(), z.string().max(80)]).optional(),
  nome: z.string().trim().max(100).optional(),
  tamanho: z.enum(['aldeia', 'vila', 'cidade']).optional(),
  algoritmo: z.enum(['voronoi_distritos', 'lsystem_ruas', 'agentes_organicos']).optional(),
  temRio: z.boolean().optional(),
  temColina: z.boolean().optional(),
  temEstradaPrincipal: z.boolean().optional(),
});

export const SnapshotSyncSchema = z.object({
  mode: z.enum(['replace', 'merge']).default('replace'),
  data: z.object({
    notes: z.array(z.any()).max(5000).optional(),
    links: z.array(z.any()).max(10000).optional(),
    layers: z.array(z.any()).max(200).optional(),
    frames: z.array(z.any()).max(500).optional(),
    drawings: z.array(z.any()).max(5000).optional(),
    dice: z.array(z.any()).max(500).optional(),
    packages: z.array(z.any()).max(1000).optional(),
    categories: z.array(z.any()).max(200).optional(),
    history: z.array(z.any()).max(2000).optional(),
    lootGenerators: z.array(z.any()).max(500).optional(),
    lootGroups: z.array(z.any()).max(1000).optional(),
    settings: z.any().optional(),
    viewState: z.any().optional(),
  }),
});

export const ObsidianImportRequestSchema = z.object({
  layerId: safeIdSchema.default('layer-locations'),
  mode: z.enum(['merge', 'create']).default('merge'),
  files: z
    .array(
      z.object({
        filename: z.string().trim().min(1).max(260),
        content: z.string().max(100_000),
      })
    )
    .min(1, 'Envie pelo menos um arquivo Markdown (.md) para importar.')
    .max(250, 'Limite máximo de 250 arquivos por importação.'),
});

export const NotionImportRequestSchema = z
  .object({
    layerId: safeIdSchema.default('layer-locations'),
    mode: z.enum(['merge', 'create']).default('merge'),
    databaseId: z.string().trim().min(32).max(40).optional(),
    pageIds: z.array(z.string().trim().min(32).max(40)).max(40).optional(),
  })
  .refine((v) => Boolean(v.databaseId || (v.pageIds && v.pageIds.length > 0)), {
    message: 'Informe ao menos um "databaseId" ou lista de "pageIds" do Notion.',
  });

