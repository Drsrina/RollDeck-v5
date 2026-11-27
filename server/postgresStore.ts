import fs from 'fs/promises';
import path from 'path';
import { Pool, type PoolClient } from 'pg';
import {
  createDefaultStoreDocument,
  ROLE_SCOPES,
  type ApiCollections,
  type ApiStore,
  type ApiStoreDocument,
  type PublicApiKey,
  type PublicUser,
  type StoredApiKey,
  type StoredUser,
  type UserRole,
} from './store';

const COLLECTION_KEYS: Array<Exclude<keyof ApiCollections, 'settings' | 'viewState'>> = [
  'notes',
  'links',
  'layers',
  'frames',
  'drawings',
  'mapImages',
  'vttScenes',
  'heraldry',
  'worldMaps',
  'dice',
  'packages',
  'categories',
  'history',
  'lootGenerators',
  'lootGroups',
  'playerSheets',
];

export class PostgresApiStore implements ApiStore {
  readonly storageKind = 'postgres' as const;
  private readonly pool: Pool;
  private readonly legacyJsonPath: string;
  private initialized = false;
  private cache: ApiStoreDocument | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(connectionString: string, legacyJsonPath?: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.legacyJsonPath =
      legacyJsonPath || path.resolve(process.cwd(), 'data', 'rolldeck-api-store.json');
  }

  async init(): Promise<ApiStoreDocument> {
    if (this.initialized && this.cache) {
      return this.cache;
    }

    await this.waitForConnection();
    await this.ensureSchema();

    const loaded = await this.loadFromDatabase();
    if (loaded) {
      this.cache = loaded;
      this.initialized = true;
      return this.cache;
    }

    // Banco recém-criado: tentar importar dados existentes do JSON legado se houver
    const migrated = await this.tryLoadLegacyJson();
    this.cache = migrated || createDefaultStoreDocument();
    await this.persistDocument(this.cache);
    this.initialized = true;
    return this.cache;
  }

  async getState(): Promise<ApiStoreDocument> {
    return this.init();
  }

  async mutate<T>(mutator: (doc: ApiStoreDocument) => T): Promise<T> {
    let result!: T;
    let caughtError: unknown;

    const task = this.writeChain.then(async () => {
      try {
        const doc = await this.init();
        // Trabalhar sobre cópia profunda para garantir atomicidade em caso de erro
        const draft = structuredClone(doc);
        result = mutator(draft);
        draft.updatedAt = Date.now();
        await this.persistDocument(draft);
        this.cache = draft;
      } catch (err) {
        caughtError = err;
      }
    });

    this.writeChain = task.catch(() => {});
    await task;

    if (caughtError !== undefined) {
      throw caughtError;
    }
    return result;
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async waitForConnection(retries = 10, delayMs = 1500): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.pool.query('SELECT 1');
        return;
      } catch (err) {
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  private async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rolldeck_meta (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rolldeck_users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_version INTEGER NOT NULL DEFAULT 1,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        last_login_at BIGINT
      );

      CREATE INDEX IF NOT EXISTS idx_rolldeck_users_username ON rolldeck_users (username);

      CREATE TABLE IF NOT EXISTS rolldeck_api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        scopes JSONB NOT NULL,
        created_at BIGINT NOT NULL,
        last_used_at BIGINT,
        revoked BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS rolldeck_collections (
        name TEXT PRIMARY KEY,
        items JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `);
  }

  private async loadFromDatabase(): Promise<ApiStoreDocument | null> {
    const metaRes = await this.pool.query<{ key: string; value: any; updated_at: string }>(
      'SELECT key, value, updated_at FROM rolldeck_meta'
    );

    if (metaRes.rowCount === 0) {
      return null;
    }

    const defaults = createDefaultStoreDocument();
    const metaMap = new Map<string, any>();
    for (const row of metaRes.rows) {
      metaMap.set(row.key, row.value);
    }

    const usersRes = await this.pool.query<{
      id: string;
      username: string;
      display_name: string;
      role: string;
      active: boolean;
      password_hash: string;
      password_salt: string;
      password_version: number;
      created_at: string;
      updated_at: string;
      last_login_at: string | null;
    }>('SELECT * FROM rolldeck_users ORDER BY created_at ASC');

    const users: StoredUser[] = usersRes.rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      role: r.role as UserRole,
      active: r.active,
      passwordHash: r.password_hash,
      passwordSalt: r.password_salt,
      passwordVersion: Number(r.password_version) || 1,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at),
      ...(r.last_login_at !== null ? { lastLoginAt: Number(r.last_login_at) } : {}),
    }));

    const keysRes = await this.pool.query<{
      id: string;
      name: string;
      prefix: string;
      hash: string;
      salt: string;
      scopes: any;
      created_at: string;
      last_used_at: string | null;
      revoked: boolean;
    }>('SELECT * FROM rolldeck_api_keys ORDER BY created_at ASC');

    const apiKeys: StoredApiKey[] = keysRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      prefix: r.prefix,
      hash: r.hash,
      salt: r.salt,
      scopes: Array.isArray(r.scopes) ? r.scopes : [],
      createdAt: Number(r.created_at),
      ...(r.last_used_at !== null ? { lastUsedAt: Number(r.last_used_at) } : {}),
      revoked: r.revoked,
    }));

    const colsRes = await this.pool.query<{ name: string; items: any }>(
      'SELECT name, items FROM rolldeck_collections'
    );
    const colMap = new Map<string, any>();
    for (const row of colsRes.rows) {
      colMap.set(row.name, row.items);
    }

    const collections: ApiCollections = {
      ...defaults.collections,
      settings: { ...defaults.collections.settings, ...(metaMap.get('settings') ?? {}) },
      viewState: { ...defaults.collections.viewState, ...(metaMap.get('viewState') ?? {}) },
    };

    for (const key of COLLECTION_KEYS) {
      const val = colMap.get(key);
      if (Array.isArray(val)) {
        (collections as any)[key] = val;
      }
    }

    return {
      schemaVersion: Number(metaMap.get('schemaVersion')) || defaults.schemaVersion,
      updatedAt: Number(metaMap.get('updatedAt')) || Date.now(),
      auth: metaMap.get('auth') ?? {},
      users,
      apiKeys,
      collections,
    };
  }

  private async tryLoadLegacyJson(): Promise<ApiStoreDocument | null> {
    try {
      const raw = await fs.readFile(this.legacyJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ApiStoreDocument>;
      const defaults = createDefaultStoreDocument();
      return {
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
    } catch {
      return null;
    }
  }

  private async persistDocument(doc: ApiStoreDocument): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const now = doc.updatedAt || Date.now();
      const metaEntries: Array<[string, any]> = [
        ['schemaVersion', doc.schemaVersion],
        ['updatedAt', now],
        ['auth', doc.auth],
        ['settings', doc.collections.settings],
        ['viewState', doc.collections.viewState],
      ];

      for (const [key, value] of metaEntries) {
        await client.query(
          `INSERT INTO rolldeck_meta (key, value, updated_at)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
          [key, JSON.stringify(value), now]
        );
      }

      await this.syncUsersTable(client, doc.users);
      await this.syncApiKeysTable(client, doc.apiKeys);

      for (const key of COLLECTION_KEYS) {
        const items = doc.collections[key] ?? [];
        await client.query(
          `INSERT INTO rolldeck_collections (name, items, updated_at)
           VALUES ($1, $2::jsonb, $3)
           ON CONFLICT (name) DO UPDATE SET items = EXCLUDED.items, updated_at = EXCLUDED.updated_at`,
          [key, JSON.stringify(items), now]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  private async syncUsersTable(client: PoolClient, users: StoredUser[]): Promise<void> {
    const ids = users.map((u) => u.id);
    if (ids.length === 0) {
      await client.query('DELETE FROM rolldeck_users');
    } else {
      await client.query('DELETE FROM rolldeck_users WHERE NOT (id = ANY($1::text[]))', [ids]);
    }

    for (const u of users) {
      await client.query(
        `INSERT INTO rolldeck_users (
           id, username, display_name, role, active,
           password_hash, password_salt, password_version,
           created_at, updated_at, last_login_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           username = EXCLUDED.username,
           display_name = EXCLUDED.display_name,
           role = EXCLUDED.role,
           active = EXCLUDED.active,
           password_hash = EXCLUDED.password_hash,
           password_salt = EXCLUDED.password_salt,
           password_version = EXCLUDED.password_version,
           updated_at = EXCLUDED.updated_at,
           last_login_at = EXCLUDED.last_login_at`,
        [
          u.id,
          u.username,
          u.displayName,
          u.role,
          u.active,
          u.passwordHash,
          u.passwordSalt,
          u.passwordVersion,
          u.createdAt,
          u.updatedAt,
          u.lastLoginAt ?? null,
        ]
      );
    }
  }

  private async syncApiKeysTable(client: PoolClient, keys: StoredApiKey[]): Promise<void> {
    const ids = keys.map((k) => k.id);
    if (ids.length === 0) {
      await client.query('DELETE FROM rolldeck_api_keys');
    } else {
      await client.query('DELETE FROM rolldeck_api_keys WHERE NOT (id = ANY($1::text[]))', [ids]);
    }

    for (const k of keys) {
      await client.query(
        `INSERT INTO rolldeck_api_keys (
           id, name, prefix, hash, salt, scopes, created_at, last_used_at, revoked
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           prefix = EXCLUDED.prefix,
           hash = EXCLUDED.hash,
           salt = EXCLUDED.salt,
           scopes = EXCLUDED.scopes,
           last_used_at = EXCLUDED.last_used_at,
           revoked = EXCLUDED.revoked`,
        [
          k.id,
          k.name,
          k.prefix,
          k.hash,
          k.salt,
          JSON.stringify(k.scopes),
          k.createdAt,
          k.lastUsedAt ?? null,
          k.revoked,
        ]
      );
    }
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
