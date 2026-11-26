import crypto from 'crypto';
import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { gerarMasmorra } from '../src/lib/forja/dungeonGenerator';
import { gerarLoteItens } from '../src/lib/forja/itemGenerator';
import { gerarLoteNPCs } from '../src/lib/forja/npcGenerator';
import { gerarMundoCompleto } from '../src/lib/forja/pipeline';
import { gerarAssentamento } from '../src/lib/forja/settlementGenerator';
import { consultarOraculo } from '../src/lib/oraculoEngine';
import { createMulberry32, stringToSeed } from '../src/lib/prng';
import { executeRoll, STANDARD_DICE } from '../src/lib/roll';
import type { DieDefinition, PackageDieGroup, PlayerSheet } from '../src/types';
import {
  createAuthMiddleware,
  createExternalApiKey,
  hashSecretScrypt,
  issueUserSessionToken,
} from './auth';
import {
  convertObsidianFilesToGraph,
  importNotionToGraph,
  isNotionConfigured,
  isValidNotionId,
  searchNotionWorkspace,
} from './integrations';
import { buildOpenApiSpec } from './openapi';
import {
  CategoryPatchSchema,
  CategorySchema,
  CreateApiKeySchema,
  CreateUserSchema,
  DiePatchSchema,
  DieSchema,
  DrawingPatchSchema,
  DrawingSchema,
  ForjaBatchRequestSchema,
  ForjaDungeonRequestSchema,
  ForjaSettlementRequestSchema,
  ForjaWorldRequestSchema,
  FramePatchSchema,
  FrameSchema,
  HistoryPatchSchema,
  HistoryRecordSchema,
  LayerPatchSchema,
  LayerSchema,
  LinkPatchSchema,
  LinkSchema,
  LootGeneratorPatchSchema,
  LootGeneratorSchema,
  LootGroupSchema,
  NotePatchSchema,
  NoteSchema,
  NotionImportRequestSchema,
  ObsidianImportRequestSchema,
  OracleRequestSchema,
  PackagePatchSchema,
  PackageSchema,
  PlayerSheetCreateSchema,
  PlayerSheetPatchSchema,
  RollRequestSchema,
  SettingsPatchSchema,
  SnapshotSyncSchema,
  UpdateUserSchema,
  ViewStatePatchSchema,
} from './schemas';
import type { CollectionName, LocalApiStore, StoredUser } from './store';

function sendValidationError(res: Response, error: z.ZodError) {
  return res.status(400).json({
    error: 'validation_error',
    message: 'Payload inválido.',
    issues: error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })),
  });
}

function parsePagination(req: Request): { limit: number; offset: number } {
  const rawLimit = Number(req.query.limit);
  const rawOffset = Number(req.query.offset);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(500, Math.floor(rawLimit)) : 100;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
  return { limit, offset };
}

function resolveNumericSeed(seed?: number | string): number {
  if (typeof seed === 'number' && Number.isFinite(seed)) return Math.abs(Math.trunc(seed));
  if (typeof seed === 'string' && seed.trim().length > 0) return stringToSeed(seed.trim());
  return crypto.randomInt(1, 2147483647);
}

/**
 * Parses standard RPG dice expressions such as:
 * "1d20+5", "2d20kh1+4", "2d20kl1-1", "4d6kh3", "8d6 + 1d4+2", "2d10r1+3"
 */
export function parseDiceExpression(expression: string): {
  groups: PackageDieGroup[];
  globalModifier: number;
} {
  const cleaned = expression.replace(/\s+/g, '');
  if (!cleaned) {
    throw new Error('Expressão de rolagem vazia.');
  }

  // Split into signed tokens while keeping signs
  const tokens = cleaned.match(/[+-]?[^+-]+/g);
  if (!tokens || tokens.length === 0) {
    throw new Error(`Expressão inválida: "${expression}"`);
  }

  const groups: PackageDieGroup[] = [];
  let globalModifier = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const diceMatch = token.match(/^([+-])?(\d*)d(\d+)(kh\d+|kl\d+)?(r1)?$/i);

    if (diceMatch) {
      const sign = diceMatch[1] === '-' ? -1 : 1;
      if (sign < 0) {
        throw new Error(`Grupo de dados negativo não suportado no termo "${token}".`);
      }

      const count = diceMatch[2] ? parseInt(diceMatch[2], 10) : 1;
      const sides = parseInt(diceMatch[3], 10);
      const keepToken = diceMatch[4]?.toLowerCase();
      const rerollOnes = Boolean(diceMatch[5]);

      if (count < 1 || count > 100) {
        throw new Error(`Quantidade de dados fora do limite (1..100): "${token}"`);
      }
      if (sides < 2 || sides > 1000) {
        throw new Error(`Número de faces fora do limite (2..1000): "${token}"`);
      }

      let keepRule: PackageDieGroup['keepRule'] = 'all';
      let keepCount: number | undefined;

      if (keepToken?.startsWith('kh')) {
        keepRule = 'keep-highest';
        keepCount = Math.max(1, Math.min(count, parseInt(keepToken.slice(2), 10) || 1));
      } else if (keepToken?.startsWith('kl')) {
        keepRule = 'keep-lowest';
        keepCount = Math.max(1, Math.min(count, parseInt(keepToken.slice(2), 10) || 1));
      }

      groups.push({
        id: `expr-${i + 1}`,
        count,
        dieId: `d${sides}`,
        modifier: 0,
        advantage: 'none',
        keepRule,
        keepCount,
        rerollOnes,
      });
      continue;
    }

    if (/^[+-]?\d+$/.test(token)) {
      const num = parseInt(token, 10);
      if (Math.abs(num) > 10000) {
        throw new Error(`Modificador fora do limite: "${token}"`);
      }
      globalModifier += num;
      continue;
    }

    throw new Error(`Termo não reconhecido na expressão: "${token}"`);
  }

  if (groups.length === 0) {
    throw new Error('A expressão precisa conter ao menos um dado (ex.: "1d20+5").');
  }

  return { groups, globalModifier };
}

function getRequestBaseUrl(req: Request): string {
  const proto = req.header('x-forwarded-proto') || req.protocol || 'http';
  const host = req.header('x-forwarded-host') || req.get('host') || 'localhost:3000';
  return `${proto}://${host}`;
}

export function createApiV1Router(store: LocalApiStore) {
  const router = express.Router();
  const { requireAuthenticatedUser, requireAdmin, requireApiAuth } = createAuthMiddleware(store);

  // ---------------- Discovery & OpenAPI ----------------

  router.get('/', async (req, res) => {
    const state = await store.getState();
    const baseUrl = getRequestBaseUrl(req);
    res.json({
      name: 'RollDeck REST API',
      version: '1.0.0',
      mode: 'local-persistent',
      openapi: `${baseUrl}/api/v1/openapi.json`,
      updatedAt: state.updatedAt,
      counts: {
        users: state.users.length,
        notes: state.collections.notes.length,
        links: state.collections.links.length,
        layers: state.collections.layers.length,
        frames: state.collections.frames.length,
        drawings: state.collections.drawings.length,
        dice: state.collections.dice.length,
        packages: state.collections.packages.length,
        categories: state.collections.categories.length,
        history: state.collections.history.length,
        lootGenerators: state.collections.lootGenerators.length,
        lootGroups: state.collections.lootGroups.length,
        playerSheets: state.collections.playerSheets.length,
      },
      endpoints: {
        users: '/api/v1/users',
        keys: '/api/v1/keys',
        playerSheets: '/api/v1/player-sheets',
        snapshot: '/api/v1/snapshot',
        roll: '/api/v1/roll',
        oracle: '/api/v1/oracle',
        forja: [
          '/api/v1/forja/world',
          '/api/v1/forja/npcs',
          '/api/v1/forja/items',
          '/api/v1/forja/dungeon',
          '/api/v1/forja/settlement',
        ],
        integrations: [
          '/api/v1/integrations/obsidian/import',
          '/api/v1/integrations/notion/status',
          '/api/v1/integrations/notion/search',
          '/api/v1/integrations/notion/import',
        ],
        crud: [
          '/api/v1/notes',
          '/api/v1/links',
          '/api/v1/layers',
          '/api/v1/frames',
          '/api/v1/drawings',
          '/api/v1/dice',
          '/api/v1/packages',
          '/api/v1/categories',
          '/api/v1/history',
          '/api/v1/loot-generators',
          '/api/v1/loot-groups',
          '/api/v1/settings',
          '/api/v1/view-state',
        ],
      },
    });
  });

  router.get('/openapi.json', (req, res) => {
    res.json(buildOpenApiSpec(getRequestBaseUrl(req)));
  });

  // ---------------- User Management (Admin Only, No Email) ----------------

  router.get('/users', requireAdmin, async (_req, res) => {
    const state = await store.getState();
    res.json({
      items: state.users.map((u) => store.toPublicUser(u)),
      total: state.users.length,
    });
  });

  router.post('/users', requireAdmin, async (req, res) => {
    const parsed = CreateUserSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const state = await store.getState();
    const exists = state.users.some((u) => u.username === parsed.data.username);
    if (exists) {
      return res.status(409).json({
        error: 'username_taken',
        message: `O usuário "${parsed.data.username}" já existe.`,
      });
    }

    const now = Date.now();
    const { hash, salt } = hashSecretScrypt(parsed.data.password);
    const newUser: StoredUser = {
      id: `usr_${crypto.randomUUID()}`,
      username: parsed.data.username,
      displayName: (parsed.data.displayName || parsed.data.username).trim(),
      role: parsed.data.role,
      active: parsed.data.active,
      passwordHash: hash,
      passwordSalt: salt,
      passwordVersion: 1,
      createdAt: now,
      updatedAt: now,
    };

    await store.mutate((doc) => {
      doc.users.push(newUser);
    });

    return res.status(201).json(store.toPublicUser(newUser));
  });

  router.patch('/users/:id', requireAdmin, async (req, res) => {
    const parsed = UpdateUserSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const { id } = req.params;
    const result = await store.mutate((doc) => {
      const target = doc.users.find((u) => u.id === id);
      if (!target) {
        return {
          ok: false as const,
          error: 'not_found' as const,
          status: 404,
          message: 'Usuário não encontrado.',
        };
      }

      const activeAdmins = doc.users.filter((u) => u.role === 'admin' && u.active);
      const isLastActiveAdmin = target.role === 'admin' && target.active && activeAdmins.length <= 1;

      if (parsed.data.active === false && target.id === req.auth?.userId) {
        return {
          ok: false as const,
          error: 'self_deactivate_blocked' as const,
          status: 400,
          message: 'Você não pode desativar sua própria conta enquanto está conectado.',
        };
      }

      if (isLastActiveAdmin && (parsed.data.active === false || (parsed.data.role && parsed.data.role !== 'admin'))) {
        return {
          ok: false as const,
          error: 'last_admin_protected' as const,
          status: 400,
          message: 'Não é possível rebaixar ou desativar o último administrador ativo.',
        };
      }

      let rotateSession = false;

      if (parsed.data.displayName !== undefined) {
        target.displayName = parsed.data.displayName.trim();
      }
      if (parsed.data.role !== undefined && parsed.data.role !== target.role) {
        target.role = parsed.data.role;
        rotateSession = true;
      }
      if (parsed.data.active !== undefined && parsed.data.active !== target.active) {
        target.active = parsed.data.active;
        rotateSession = true;
      }
      if (parsed.data.password !== undefined) {
        const { hash, salt } = hashSecretScrypt(parsed.data.password);
        target.passwordHash = hash;
        target.passwordSalt = salt;
        rotateSession = true;
      }

      if (rotateSession) {
        target.passwordVersion += 1;
      }
      target.updatedAt = Date.now();

      return {
        ok: true as const,
        user: store.toPublicUser(target),
        refreshedSessionToken:
          rotateSession && target.active && target.id === req.auth?.userId
            ? issueUserSessionToken(target)
            : undefined,
      };
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, message: result.message });
    }

    return res.json({
      ...result.user,
      ...(result.refreshedSessionToken ? { sessionToken: result.refreshedSessionToken } : {}),
    });
  });

  router.delete('/users/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (id === req.auth?.userId) {
      return res.status(400).json({
        error: 'self_delete_blocked',
        message: 'Você não pode excluir sua própria conta de administrador.',
      });
    }

    const result = await store.mutate((doc) => {
      const idx = doc.users.findIndex((u) => u.id === id);
      if (idx < 0) {
        return {
          ok: false as const,
          error: 'not_found' as const,
          status: 404,
          message: 'Usuário não encontrado.',
        };
      }

      const target = doc.users[idx];
      const activeAdmins = doc.users.filter((u) => u.role === 'admin' && u.active);
      if (target.role === 'admin' && target.active && activeAdmins.length <= 1) {
        return {
          ok: false as const,
          error: 'last_admin_protected' as const,
          status: 400,
          message: 'Não é possível excluir o último administrador ativo.',
        };
      }

      doc.users.splice(idx, 1);
      return { ok: true as const };
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, message: result.message });
    }

    return res.json({ deleted: true, id });
  });

  // ---------------- External API Keys (Admin Only) ----------------

  router.get('/keys', requireAdmin, async (_req, res) => {
    const state = await store.getState();
    res.json({
      items: state.apiKeys.map((k) => store.toPublicKey(k)),
      total: state.apiKeys.length,
    });
  });

  router.post('/keys', requireAdmin, async (req, res) => {
    const parsed = CreateApiKeySchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const uniqueScopes = Array.from(new Set(parsed.data.scopes));
    const created = await createExternalApiKey(store, parsed.data.name, uniqueScopes);

    return res.status(201).json({
      key: created.key,
      apiKey: created.plaintextKey,
      warning: 'Guarde esta chave agora. Por segurança, ela não poderá ser visualizada novamente.',
    });
  });

  router.delete('/keys/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const found = await store.mutate((doc) => {
      const target = doc.apiKeys.find((k) => k.id === id);
      if (!target) return false;
      target.revoked = true;
      return true;
    });

    if (!found) {
      return res.status(404).json({ error: 'not_found', message: 'Chave de API não encontrada.' });
    }
    return res.json({ revoked: true, id });
  });

  // ---------------- Local Snapshot Sync (Browser <-> Server API) ----------------

  router.get('/snapshot', requireApiAuth('read'), async (req, res) => {
    const state = await store.getState();
    const isRestrictedUser =
      req.auth?.kind === 'user' && req.auth.role !== 'admin' && req.auth.role !== 'gm';

    const collections = isRestrictedUser
      ? {
          ...state.collections,
          notes: [],
          links: [],
          layers: [],
          frames: [],
          drawings: [],
          lootGenerators: [],
          lootGroups: [],
          playerSheets:
            req.auth?.role === 'player' && req.auth.userId
              ? state.collections.playerSheets.filter((s) => s.ownerUserId === req.auth?.userId)
              : [],
        }
      : state.collections;

    res.json({
      app: 'RollDeck',
      schemaVersion: state.schemaVersion,
      exportedAt: new Date().toISOString(),
      updatedAt: state.updatedAt,
      ...collections,
    });
  });

  router.put('/snapshot', requireApiAuth('write'), async (req, res) => {
    const parsed = SnapshotSyncSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const { mode, data } = parsed.data;
    const summary = await store.mutate((doc) => {
      const mergeById = <T extends { id: string }>(existing: T[], incoming?: T[]): T[] => {
        if (!incoming) return existing;
        if (mode === 'replace') return incoming;
        const map = new Map<string, T>();
        for (const item of existing) map.set(item.id, item);
        for (const item of incoming) {
          if (item && typeof item.id === 'string') map.set(item.id, item);
        }
        return Array.from(map.values());
      };

      const cols = doc.collections;
      cols.notes = mergeById(cols.notes, data.notes);
      cols.links = mergeById(cols.links, data.links);
      cols.layers = mergeById(cols.layers, data.layers);
      cols.frames = mergeById(cols.frames, data.frames);
      cols.drawings = mergeById(cols.drawings, data.drawings);
      cols.dice = mergeById(cols.dice, data.dice);
      cols.packages = mergeById(cols.packages, data.packages);
      cols.categories = mergeById(cols.categories, data.categories);
      cols.history = mergeById(cols.history, data.history).sort((a, b) => b.timestamp - a.timestamp);
      cols.lootGenerators = mergeById(cols.lootGenerators, data.lootGenerators);
      cols.lootGroups = mergeById(cols.lootGroups, data.lootGroups);

      if (data.settings && typeof data.settings === 'object') {
        cols.settings = { ...cols.settings, ...data.settings };
      }
      if (data.viewState && typeof data.viewState === 'object') {
        cols.viewState = { ...cols.viewState, ...data.viewState };
      }

      return {
        notes: cols.notes.length,
        links: cols.links.length,
        layers: cols.layers.length,
        frames: cols.frames.length,
        drawings: cols.drawings.length,
        dice: cols.dice.length,
        packages: cols.packages.length,
        categories: cols.categories.length,
        history: cols.history.length,
        lootGenerators: cols.lootGenerators.length,
        lootGroups: cols.lootGroups.length,
      };
    });

    const latest = await store.getState();
    return res.json({
      synced: true,
      mode,
      updatedAt: latest.updatedAt,
      counts: summary,
    });
  });

  // ---------------- RPG Action Endpoints (Roll, Oracle, Forja) ----------------

  router.post('/roll', requireApiAuth('roll'), async (req, res) => {
    const parsed = RollRequestSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const state = await store.getState();
    const { expression, packageId, groups: rawGroups, globalModifier, saveToHistory } = parsed.data;

    const diceLookup = new Map<string, DieDefinition>();
    for (const d of STANDARD_DICE) diceLookup.set(d.id, d);
    for (const d of state.collections.dice) diceLookup.set(d.id, d);

    let title = parsed.data.title || 'Rolagem via API';
    let groupsToRoll: PackageDieGroup[] = [];
    let finalGlobalModifier = globalModifier;
    let resolvedPackageId: string | undefined;

    if (packageId) {
      const pkg = state.collections.packages.find((p) => p.id === packageId);
      if (!pkg) {
        return res.status(404).json({ error: 'not_found', message: 'Pacote de dados não encontrado.' });
      }
      title = parsed.data.title || pkg.name;
      groupsToRoll = pkg.groups;
      finalGlobalModifier = pkg.globalModifier + globalModifier;
      resolvedPackageId = pkg.id;
    } else if (expression) {
      try {
        const parsedExpr = parseDiceExpression(expression);
        groupsToRoll = parsedExpr.groups;
        finalGlobalModifier = parsedExpr.globalModifier + globalModifier;
        if (!parsed.data.title) title = expression;
      } catch (err: any) {
        return res.status(400).json({ error: 'invalid_expression', message: err.message });
      }
    } else if (rawGroups) {
      groupsToRoll = rawGroups.map((g, idx) => ({
        ...g,
        id: g.id || `group-${idx + 1}`,
      }));
    }

    const result = executeRoll({
      title,
      groups: groupsToRoll,
      globalModifier: finalGlobalModifier,
      diceLookup,
      packageId: resolvedPackageId,
    });

    if (saveToHistory) {
      await store.mutate((doc) => {
        const limit = doc.collections.settings.historyLimit || 200;
        doc.collections.history = [result, ...doc.collections.history].slice(0, limit);
      });
    }

    return res.json(result);
  });

  router.post('/oracle', requireApiAuth('generate', { gmOnly: true }), (req, res) => {
    const parsed = OracleRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const seedNumber = resolveNumericSeed(parsed.data.seed);
    const prng = createMulberry32(seedNumber);
    const result = consultarOraculo(
      parsed.data.pergunta,
      parsed.data.probabilidade,
      parsed.data.modificador,
      prng
    );

    return res.json({
      seed: seedNumber,
      ...result,
    });
  });

  router.post('/forja/world', requireApiAuth('generate', { gmOnly: true }), (req, res) => {
    const parsed = ForjaWorldRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const seedNumber = resolveNumericSeed(parsed.data.seed);
    const mundo = gerarMundoCompleto(seedNumber);
    const graph = mundo.weaver.exportJSON();
    return res.json({
      seed: seedNumber,
      manifesto: mundo.manifesto,
      terreno: mundo.terreno,
      assentamento: mundo.assentamento,
      masmorra: mundo.masmorra,
      npcs: mundo.npcs,
      itens: mundo.itens,
      rumores: mundo.rumores,
      entidades: graph.entities,
      relacoes: graph.relations,
    });
  });

  router.post('/forja/npcs', requireApiAuth('generate', { gmOnly: true }), (req, res) => {
    const parsed = ForjaBatchRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const seedNumber = resolveNumericSeed(parsed.data.seed);
    const items = gerarLoteNPCs(seedNumber, parsed.data.count);
    return res.json({ seed: seedNumber, count: items.length, items });
  });

  router.post('/forja/items', requireApiAuth('generate', { gmOnly: true }), (req, res) => {
    const parsed = ForjaBatchRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const seedNumber = resolveNumericSeed(parsed.data.seed);
    const items = gerarLoteItens(seedNumber, parsed.data.count);
    return res.json({ seed: seedNumber, count: items.length, items });
  });

  router.post('/forja/dungeon', requireApiAuth('generate', { gmOnly: true }), (req, res) => {
    const parsed = ForjaDungeonRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const seedNumber = resolveNumericSeed(parsed.data.seed);
    const dungeon = gerarMasmorra(seedNumber, {
      algoritmoLayout: parsed.data.algoritmo,
      dificuldade: parsed.data.dificuldade,
      nivelGrupo: parsed.data.nivelGrupo,
    });
    return res.json({ seed: seedNumber, dungeon });
  });

  router.post('/forja/settlement', requireApiAuth('generate', { gmOnly: true }), (req, res) => {
    const parsed = ForjaSettlementRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const seedNumber = resolveNumericSeed(parsed.data.seed);
    const settlement = gerarAssentamento(seedNumber, {
      nome: parsed.data.nome,
      tamanho: parsed.data.tamanho,
      algoritmo: parsed.data.algoritmo,
      temRio: parsed.data.temRio,
      temColina: parsed.data.temColina,
      temEstradaPrincipal: parsed.data.temEstradaPrincipal,
    });
    return res.json({ seed: seedNumber, settlement });
  });

  // ---------------- External Knowledge Integrations (Obsidian & Notion) ----------------

  router.post('/integrations/obsidian/import', requireApiAuth('write', { gmOnly: true }), async (req, res) => {
    const parsed = ObsidianImportRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const { files, layerId, mode } = parsed.data;
    const result = await store.mutate((doc) => {
      const graph = convertObsidianFilesToGraph({
        files,
        layerId,
        mode,
        existingNotes: doc.collections.notes,
        existingLinks: doc.collections.links,
      });

      // Upsert notes by id
      const noteMap = new Map(doc.collections.notes.map((n) => [n.id, n]));
      for (const note of graph.notes) {
        noteMap.set(note.id, note);
      }
      doc.collections.notes = Array.from(noteMap.values());

      // Upsert links by id
      const linkMap = new Map(doc.collections.links.map((l) => [l.id, l]));
      for (const link of graph.links) {
        linkMap.set(link.id, link);
      }
      doc.collections.links = Array.from(linkMap.values());

      return graph;
    });

    return res.status(201).json({
      source: 'obsidian',
      createdCount: result.createdCount,
      updatedCount: result.updatedCount,
      linksCreatedCount: result.linksCreatedCount,
      notes: result.notes,
      links: result.links,
    });
  });

  router.get('/integrations/notion/status', requireApiAuth('read', { gmOnly: true }), (_req, res) => {
    res.json({
      configured: isNotionConfigured(),
      envVar: 'NOTION_API_KEY',
    });
  });

  router.get('/integrations/notion/search', requireApiAuth('read', { gmOnly: true }), async (req, res) => {
    if (!isNotionConfigured()) {
      return res.status(503).json({
        error: 'notion_not_configured',
        message: 'Integração Notion não configurada. Defina a variável de ambiente NOTION_API_KEY no servidor.',
      });
    }

    const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : undefined;
    const rawType = typeof req.query.type === 'string' ? req.query.type : undefined;
    const filterType = rawType === 'page' || rawType === 'database' ? rawType : undefined;

    try {
      const items = await searchNotionWorkspace({ query, filterType, pageSize: 30 });
      return res.json({ items, total: items.length });
    } catch (err: any) {
      return res.status(502).json({
        error: 'notion_upstream_error',
        message: err?.message || 'Falha ao consultar a API do Notion.',
      });
    }
  });

  router.post('/integrations/notion/import', requireApiAuth('write', { gmOnly: true }), async (req, res) => {
    if (!isNotionConfigured()) {
      return res.status(503).json({
        error: 'notion_not_configured',
        message: 'Integração Notion não configurada. Defina a variável de ambiente NOTION_API_KEY no servidor.',
      });
    }

    const parsed = NotionImportRequestSchema.safeParse(req.body || {});
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const { databaseId, pageIds, layerId, mode } = parsed.data;
    if (databaseId && !isValidNotionId(databaseId)) {
      return res.status(400).json({ error: 'invalid_notion_id', message: 'databaseId do Notion inválido.' });
    }
    if (pageIds && pageIds.some((id) => !isValidNotionId(id))) {
      return res.status(400).json({ error: 'invalid_notion_id', message: 'Um ou mais pageIds do Notion são inválidos.' });
    }

    try {
      const currentState = await store.getState();
      const graph = await importNotionToGraph({
        databaseId,
        pageIds,
        layerId,
        mode,
        existingNotes: currentState.collections.notes,
        existingLinks: currentState.collections.links,
      });

      await store.mutate((doc) => {
        const noteMap = new Map(doc.collections.notes.map((n) => [n.id, n]));
        for (const note of graph.notes) {
          noteMap.set(note.id, note);
        }
        doc.collections.notes = Array.from(noteMap.values());

        const linkMap = new Map(doc.collections.links.map((l) => [l.id, l]));
        for (const link of graph.links) {
          linkMap.set(link.id, link);
        }
        doc.collections.links = Array.from(linkMap.values());
      });

      return res.status(201).json({
        source: 'notion',
        createdCount: graph.createdCount,
        updatedCount: graph.updatedCount,
        linksCreatedCount: graph.linksCreatedCount,
        notes: graph.notes,
        links: graph.links,
      });
    } catch (err: any) {
      return res.status(502).json({
        error: 'notion_upstream_error',
        message: err?.message || 'Falha ao importar páginas do Notion.',
      });
    }
  });

  // ---------------- Singletons: Settings & ViewState ----------------

  router.get('/settings', requireApiAuth('read'), async (_req, res) => {
    const state = await store.getState();
    res.json(state.collections.settings);
  });

  router.patch('/settings', requireApiAuth('write'), async (req, res) => {
    const parsed = SettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const updated = await store.mutate((doc) => {
      doc.collections.settings = { ...doc.collections.settings, ...parsed.data };
      return doc.collections.settings;
    });
    res.json(updated);
  });

  router.get('/view-state', requireApiAuth('read', { gmOnly: true }), async (_req, res) => {
    const state = await store.getState();
    res.json(state.collections.viewState);
  });

  router.patch('/view-state', requireApiAuth('write', { gmOnly: true }), async (req, res) => {
    const parsed = ViewStatePatchSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const updated = await store.mutate((doc) => {
      doc.collections.viewState = { ...doc.collections.viewState, ...parsed.data };
      return doc.collections.viewState;
    });
    res.json(updated);
  });

  // ---------------- Generic CRUD Factory for All 11 Collections ----------------

  function registerCrudResource<T extends { id: string }>(config: {
    path: string;
    collection: CollectionName;
    idPrefix: string;
    createSchema: z.ZodTypeAny;
    patchSchema?: z.ZodTypeAny;
    filter?: (items: T[], req: Request) => T[];
    prepareCreate?: (parsed: any, existing: T[]) => T;
    prepareUpdate?: (existing: T, patch: any) => T;
    onDelete?: (id: string, doc: any) => void;
    allowClearAll?: boolean;
    gmOnly?: boolean;
  }) {
    const authOpts = config.gmOnly ? { gmOnly: true } : undefined;

    // LIST
    router.get(`/${config.path}`, requireApiAuth('read', authOpts), async (req, res) => {
      const state = await store.getState();
      const raw = state.collections[config.collection] as unknown as T[];
      const filtered = config.filter ? config.filter(raw, req) : raw;
      const { limit, offset } = parsePagination(req);
      const items = filtered.slice(offset, offset + limit);

      res.json({
        items,
        total: filtered.length,
        limit,
        offset,
      });
    });

    // GET BY ID
    router.get(`/${config.path}/:id`, requireApiAuth('read', authOpts), async (req, res) => {
      const state = await store.getState();
      const list = state.collections[config.collection] as unknown as T[];
      const item = list.find((entry) => entry.id === req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'not_found', message: 'Registro não encontrado.' });
      }
      return res.json(item);
    });

    // CREATE
    router.post(`/${config.path}`, requireApiAuth('write', authOpts), async (req, res) => {
      const parsed = config.createSchema.safeParse(req.body);
      if (!parsed.success) return sendValidationError(res, parsed.error);
      const dataObj = parsed.data as Record<string, any>;

      const created = await store.mutate((doc) => {
        const list = doc.collections[config.collection] as unknown as T[];
        const prepared = config.prepareCreate
          ? config.prepareCreate(dataObj, list)
          : ({
              ...dataObj,
              id: dataObj.id || `${config.idPrefix}-${crypto.randomUUID()}`,
            } as T);

        const existingIndex = list.findIndex((i) => i.id === prepared.id);
        if (existingIndex >= 0) {
          list[existingIndex] = prepared;
        } else {
          list.push(prepared);
        }
        return prepared;
      });

      return res.status(201).json(created);
    });

    // REPLACE (PUT)
    router.put(`/${config.path}/:id`, requireApiAuth('write', authOpts), async (req, res) => {
      const parsed = config.createSchema.safeParse({ ...req.body, id: req.params.id });
      if (!parsed.success) return sendValidationError(res, parsed.error);
      const dataObj = parsed.data as Record<string, any>;

      const updated = await store.mutate((doc) => {
        const list = doc.collections[config.collection] as unknown as T[];
        const idx = list.findIndex((entry) => entry.id === req.params.id);
        const prepared = config.prepareCreate
          ? config.prepareCreate({ ...dataObj, id: req.params.id }, list)
          : ({ ...dataObj, id: req.params.id } as T);

        if (idx >= 0) {
          list[idx] = prepared;
        } else {
          list.push(prepared);
        }
        return prepared;
      });

      return res.json(updated);
    });

    // PARTIAL UPDATE (PATCH)
    if (config.patchSchema) {
      router.patch(`/${config.path}/:id`, requireApiAuth('write', authOpts), async (req, res) => {
        const parsed = config.patchSchema!.safeParse(req.body);
        if (!parsed.success) return sendValidationError(res, parsed.error);
        const patchObj = parsed.data as Record<string, any>;

        const updated = await store.mutate((doc) => {
          const list = doc.collections[config.collection] as unknown as T[];
          const idx = list.findIndex((entry) => entry.id === req.params.id);
          if (idx < 0) return null;

          const next = config.prepareUpdate
            ? config.prepareUpdate(list[idx], patchObj)
            : ({ ...list[idx], ...patchObj, id: req.params.id } as T);
          list[idx] = next;
          return next;
        });

        if (!updated) {
          return res.status(404).json({ error: 'not_found', message: 'Registro não encontrado.' });
        }
        return res.json(updated);
      });
    }

    // DELETE BY ID
    router.delete(`/${config.path}/:id`, requireApiAuth('write', authOpts), async (req, res) => {
      const deleted = await store.mutate((doc) => {
        const list = doc.collections[config.collection] as unknown as T[];
        const idx = list.findIndex((entry) => entry.id === req.params.id);
        if (idx < 0) return false;
        list.splice(idx, 1);
        if (config.onDelete) config.onDelete(req.params.id, doc);
        return true;
      });

      if (!deleted) {
        return res.status(404).json({ error: 'not_found', message: 'Registro não encontrado.' });
      }
      return res.json({ deleted: true, id: req.params.id });
    });

    // OPTIONAL CLEAR COLLECTION (e.g. history)
    if (config.allowClearAll) {
      router.delete(`/${config.path}`, requireApiAuth('write', authOpts), async (_req, res) => {
        await store.mutate((doc) => {
          (doc.collections[config.collection] as unknown as T[]).length = 0;
        });
        return res.json({ cleared: true });
      });
    }
  }

  // Register all 11 RollDeck CRUD resources
  registerCrudResource({
    path: 'notes',
    collection: 'notes',
    idPrefix: 'note',
    createSchema: NoteSchema,
    patchSchema: NotePatchSchema,
    gmOnly: true,
    filter: (items, req) => {
      let out = items;
      const layerId = typeof req.query.layerId === 'string' ? req.query.layerId : undefined;
      const tag = typeof req.query.tag === 'string' ? req.query.tag.toLowerCase() : undefined;
      const search = typeof req.query.search === 'string' ? req.query.search.toLowerCase().trim() : undefined;

      if (layerId) out = out.filter((n: any) => n.layerId === layerId);
      if (tag) out = out.filter((n: any) => Array.isArray(n.tags) && n.tags.some((t: string) => t.toLowerCase() === tag));
      if (search) {
        out = out.filter(
          (n: any) =>
            String(n.title || '').toLowerCase().includes(search) ||
            String(n.body || '').toLowerCase().includes(search)
        );
      }
      return out;
    },
    prepareCreate: (data) => {
      const now = Date.now();
      return {
        ...data,
        id: data.id || `note-${crypto.randomUUID()}`,
        createdAt: data.createdAt ?? now,
        updatedAt: now,
      };
    },
    prepareUpdate: (existing: any, patch) => ({
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    }),
    onDelete: (id, doc) => {
      doc.collections.links = doc.collections.links.filter(
        (l: any) => l.fromId !== id && l.toId !== id
      );
    },
  });

  registerCrudResource({
    path: 'links',
    collection: 'links',
    idPrefix: 'link',
    createSchema: LinkSchema,
    patchSchema: LinkPatchSchema,
    gmOnly: true,
    filter: (items, req) => {
      let out = items;
      if (typeof req.query.fromId === 'string') {
        out = out.filter((l: any) => l.fromId === req.query.fromId);
      }
      if (typeof req.query.toId === 'string') {
        out = out.filter((l: any) => l.toId === req.query.toId);
      }
      return out;
    },
  });

  registerCrudResource({
    path: 'layers',
    collection: 'layers',
    idPrefix: 'layer',
    createSchema: LayerSchema,
    patchSchema: LayerPatchSchema,
    gmOnly: true,
  });

  registerCrudResource({
    path: 'frames',
    collection: 'frames',
    idPrefix: 'frame',
    createSchema: FrameSchema,
    patchSchema: FramePatchSchema,
    gmOnly: true,
  });

  registerCrudResource({
    path: 'drawings',
    collection: 'drawings',
    idPrefix: 'draw',
    createSchema: DrawingSchema,
    patchSchema: DrawingPatchSchema,
    gmOnly: true,
    filter: (items, req) => {
      let out = items;
      if (typeof req.query.layerId === 'string') {
        out = out.filter((d: any) => d.layerId === req.query.layerId);
      }
      if (typeof req.query.preset === 'string') {
        out = out.filter((d: any) => d.preset === req.query.preset);
      }
      return out;
    },
    prepareCreate: (data, existing: any[]) => {
      const now = Date.now();
      const maxZ = existing.reduce((max, d) => Math.max(max, d.zIndex || 0), 0);
      return {
        ...data,
        id: data.id || `draw-${crypto.randomUUID()}`,
        zIndex: data.zIndex ?? maxZ + 1,
        createdAt: data.createdAt ?? now,
        updatedAt: now,
      };
    },
    prepareUpdate: (existing: any, patch) => ({
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    }),
  });

  registerCrudResource({
    path: 'dice',
    collection: 'dice',
    idPrefix: 'custom',
    createSchema: DieSchema,
    patchSchema: DiePatchSchema,
  });

  registerCrudResource({
    path: 'packages',
    collection: 'packages',
    idPrefix: 'pkg',
    createSchema: PackageSchema,
    patchSchema: PackagePatchSchema,
    filter: (items, req) => {
      let out = items;
      if (typeof req.query.categoryId === 'string') {
        out = out.filter((p: any) => p.categoryId === req.query.categoryId);
      }
      if (req.query.favorite === 'true') {
        out = out.filter((p: any) => Boolean(p.isFavorite));
      }
      return out;
    },
    prepareCreate: (data) => ({
      ...data,
      id: data.id || `pkg-${crypto.randomUUID()}`,
      groups: data.groups.map((g: any, idx: number) => ({
        ...g,
        id: g.id || `g-${idx + 1}`,
      })),
    }),
  });

  registerCrudResource({
    path: 'categories',
    collection: 'categories',
    idPrefix: 'cat',
    createSchema: CategorySchema,
    patchSchema: CategoryPatchSchema,
  });

  registerCrudResource({
    path: 'history',
    collection: 'history',
    idPrefix: 'roll',
    createSchema: HistoryRecordSchema,
    patchSchema: HistoryPatchSchema,
    allowClearAll: true,
    filter: (items, req) => {
      let out = [...items].sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      if (req.query.pinned === 'true') {
        out = out.filter((h: any) => Boolean(h.isPinned));
      }
      return out;
    },
    prepareCreate: (data) => ({
      ...data,
      id: data.id || `roll-${crypto.randomUUID()}`,
      timestamp: data.timestamp ?? Date.now(),
    }),
  });

  registerCrudResource({
    path: 'loot-generators',
    collection: 'lootGenerators',
    idPrefix: 'gen',
    createSchema: LootGeneratorSchema,
    patchSchema: LootGeneratorPatchSchema,
    gmOnly: true,
    prepareCreate: (data) => {
      const now = Date.now();
      return {
        ...data,
        id: data.id || `gen-${crypto.randomUUID()}`,
        createdAt: data.createdAt ?? now,
        updatedAt: now,
      };
    },
    prepareUpdate: (existing: any, patch) => ({
      ...existing,
      ...patch,
      updatedAt: Date.now(),
    }),
  });

  registerCrudResource({
    path: 'loot-groups',
    collection: 'lootGroups',
    idPrefix: 'lootgrp',
    createSchema: LootGroupSchema,
    gmOnly: true,
    filter: (items, req) => {
      if (typeof req.query.generatorId === 'string') {
        return items.filter((g: any) => g.generatorId === req.query.generatorId);
      }
      return items;
    },
    prepareCreate: (data) => ({
      ...data,
      id: data.id || `lootgrp-${crypto.randomUUID()}`,
      createdAt: data.createdAt ?? Date.now(),
    }),
  });

  // ---------------- Player Character & Sidekick Sheets ----------------
  // Players manage their own characters & sidekicks; GM and Admin explore all users' sheets.

  router.get('/player-sheets', requireAuthenticatedUser, async (req, res) => {
    const auth = req.auth;
    if (!auth || auth.kind !== 'user' || !auth.role || !auth.userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Sessão inválida.' });
    }
    if (auth.role === 'viewer') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Observadores não têm acesso à gestão de fichas de jogadores.',
      });
    }

    const state = await store.getState();
    const isGmOrAdminRole = auth.role === 'admin' || auth.role === 'gm';

    let items = [...state.collections.playerSheets];

    // Strict ownership scoping: players can only ever see their own sheets
    if (!isGmOrAdminRole) {
      items = items.filter((s) => s.ownerUserId === auth.userId);
    } else if (typeof req.query.ownerUserId === 'string' && req.query.ownerUserId.trim()) {
      const targetOwner = req.query.ownerUserId.trim();
      items = items.filter((s) => s.ownerUserId === targetOwner);
    }

    if (req.query.kind === 'character' || req.query.kind === 'sidekick') {
      items = items.filter((s) => s.kind === req.query.kind);
    }

    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      const q = req.query.search.trim().toLowerCase();
      items = items.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.ownerDisplayName.toLowerCase().includes(q) ||
          s.ownerUsername.toLowerCase().includes(q) ||
          s.sheet.race.toLowerCase().includes(q) ||
          s.sheet.characterClass.toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => b.updatedAt - a.updatedAt);

    return res.json({
      items,
      total: items.length,
    });
  });

  router.get('/player-sheets/:id', requireAuthenticatedUser, async (req, res) => {
    const auth = req.auth;
    if (!auth || auth.kind !== 'user' || !auth.role || !auth.userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Sessão inválida.' });
    }
    if (auth.role === 'viewer') {
      return res.status(403).json({ error: 'forbidden', message: 'Acesso negado.' });
    }

    const state = await store.getState();
    const sheet = state.collections.playerSheets.find((s) => s.id === req.params.id);
    if (!sheet) {
      return res.status(404).json({ error: 'not_found', message: 'Ficha não encontrada.' });
    }

    const isGmOrAdminRole = auth.role === 'admin' || auth.role === 'gm';
    if (!isGmOrAdminRole && sheet.ownerUserId !== auth.userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Você não tem permissão para acessar esta ficha.',
      });
    }

    return res.json(sheet);
  });

  router.post('/player-sheets', requireAuthenticatedUser, async (req, res) => {
    const auth = req.auth;
    if (!auth || auth.kind !== 'user' || !auth.role || !auth.userId || !auth.username) {
      return res.status(401).json({ error: 'unauthorized', message: 'Sessão inválida.' });
    }
    if (auth.role === 'viewer') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Observadores não podem criar fichas.',
      });
    }

    const parsed = PlayerSheetCreateSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const state = await store.getState();
    const ownCount = state.collections.playerSheets.filter(
      (s) => s.ownerUserId === auth.userId
    ).length;
    if (ownCount >= 100) {
      return res.status(400).json({
        error: 'limit_reached',
        message: 'Limite máximo de 100 fichas por usuário atingido.',
      });
    }

    const data = parsed.data;
    const ownerDisplayName = auth.displayName || auth.username;

    const created = await store.mutate((doc) => {
      let masterCharacterId: string | undefined;
      let masterCharacterName: string | undefined;

      if (data.kind === 'sidekick' && data.masterCharacterId) {
        const master = doc.collections.playerSheets.find(
          (s) =>
            s.id === data.masterCharacterId &&
            s.kind === 'character' &&
            s.ownerUserId === auth.userId
        );
        if (master) {
          masterCharacterId = master.id;
          masterCharacterName = master.name;
        }
      }

      const now = Date.now();
      const record: PlayerSheet = {
        id: `psheet-${crypto.randomUUID()}`,
        kind: data.kind,
        name: data.name,
        ...(data.kind === 'sidekick'
          ? { sidekickRole: data.sidekickRole || 'warrior' }
          : {}),
        ...(masterCharacterId ? { masterCharacterId, masterCharacterName } : {}),
        notes: data.notes,
        sheet: {
          ...data.sheet,
          playerName: data.sheet.playerName?.trim() || ownerDisplayName,
        },
        ownerUserId: auth.userId!,
        ownerUsername: auth.username!,
        ownerDisplayName,
        createdAt: now,
        updatedAt: now,
      };

      doc.collections.playerSheets.push(record);
      return record;
    });

    return res.status(201).json(created);
  });

  router.patch('/player-sheets/:id', requireAuthenticatedUser, async (req, res) => {
    const auth = req.auth;
    if (!auth || auth.kind !== 'user' || !auth.role || !auth.userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Sessão inválida.' });
    }
    if (auth.role === 'viewer') {
      return res.status(403).json({ error: 'forbidden', message: 'Acesso negado.' });
    }

    const parsed = PlayerSheetPatchSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(res, parsed.error);

    const state = await store.getState();
    const existing = state.collections.playerSheets.find((s) => s.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Ficha não encontrada.' });
    }

    const isGmOrAdminRole = auth.role === 'admin' || auth.role === 'gm';
    if (!isGmOrAdminRole && existing.ownerUserId !== auth.userId) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Você só pode editar suas próprias fichas.',
      });
    }

    const patch = parsed.data;
    const updated = await store.mutate((doc) => {
      const idx = doc.collections.playerSheets.findIndex((s) => s.id === req.params.id);
      if (idx < 0) return null;
      const current = doc.collections.playerSheets[idx];
      const nextKind = patch.kind ?? current.kind;

      let nextMasterId = current.masterCharacterId;
      let nextMasterName = current.masterCharacterName;

      if (nextKind !== 'sidekick') {
        nextMasterId = undefined;
        nextMasterName = undefined;
      } else if (patch.masterCharacterId !== undefined) {
        if (patch.masterCharacterId === null || patch.masterCharacterId === '') {
          nextMasterId = undefined;
          nextMasterName = undefined;
        } else {
          const master = doc.collections.playerSheets.find(
            (s) =>
              s.id === patch.masterCharacterId &&
              s.kind === 'character' &&
              s.ownerUserId === current.ownerUserId
          );
          if (master) {
            nextMasterId = master.id;
            nextMasterName = master.name;
          }
        }
      }

      const nextRecord: PlayerSheet = {
        ...current,
        kind: nextKind,
        name: patch.name ?? current.name,
        sidekickRole:
          nextKind === 'sidekick'
            ? patch.sidekickRole === null
              ? undefined
              : patch.sidekickRole ?? current.sidekickRole ?? 'warrior'
            : undefined,
        masterCharacterId: nextMasterId,
        masterCharacterName: nextMasterName,
        notes: patch.notes ?? current.notes,
        sheet: patch.sheet ? { ...patch.sheet } : current.sheet,
        // Preserve immutable owner identity
        ownerUserId: current.ownerUserId,
        ownerUsername: current.ownerUsername,
        ownerDisplayName: current.ownerDisplayName,
        updatedAt: Date.now(),
      };

      doc.collections.playerSheets[idx] = nextRecord;

      // Keep linked sidekicks' masterCharacterName in sync when a character is renamed
      if (nextRecord.kind === 'character' && nextRecord.name !== current.name) {
        for (const candidate of doc.collections.playerSheets) {
          if (candidate.masterCharacterId === nextRecord.id) {
            candidate.masterCharacterName = nextRecord.name;
          }
        }
      }

      return nextRecord;
    });

    if (!updated) {
      return res.status(404).json({ error: 'not_found', message: 'Ficha não encontrada.' });
    }
    return res.json(updated);
  });

  router.delete('/player-sheets/:id', requireAuthenticatedUser, async (req, res) => {
    const auth = req.auth;
    if (!auth || auth.kind !== 'user' || !auth.role || !auth.userId) {
      return res.status(401).json({ error: 'unauthorized', message: 'Sessão inválida.' });
    }
    if (auth.role === 'viewer') {
      return res.status(403).json({ error: 'forbidden', message: 'Acesso negado.' });
    }

    const state = await store.getState();
    const existing = state.collections.playerSheets.find((s) => s.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Ficha não encontrada.' });
    }

    if (existing.ownerUserId !== auth.userId && auth.role !== 'admin') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Você só pode excluir suas próprias fichas.',
      });
    }

    await store.mutate((doc) => {
      doc.collections.playerSheets = doc.collections.playerSheets.filter(
        (s) => s.id !== req.params.id
      );
      // Clear orphaned master references on sidekicks
      for (const candidate of doc.collections.playerSheets) {
        if (candidate.masterCharacterId === req.params.id) {
          candidate.masterCharacterId = undefined;
          candidate.masterCharacterName = undefined;
        }
      }
    });

    return res.json({ deleted: true, id: req.params.id });
  });

  // Clean JSON 404 for unknown /api/v1/* routes
  router.use((_req, res) => {
    res.status(404).json({
      error: 'route_not_found',
      message: 'Endpoint não encontrado. Consulte GET /api/v1 ou GET /api/v1/openapi.json.',
    });
  });

  return router;
}
