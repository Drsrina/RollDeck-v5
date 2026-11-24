import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  ROLE_SCOPES,
  type ApiKeyScope,
  type LocalApiStore,
  type PublicApiKey,
  type PublicUser,
  type StoredUser,
  type UserRole,
} from './store';

// In-memory signing secret fallback when SESSION_SECRET is not set in env
const SESSION_SIGNING_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Pre-computed dummy scrypt record for timing-safe rejection when username doesn't exist
const DUMMY_SALT = crypto.randomBytes(16).toString('hex');
const DUMMY_HASH = crypto.scryptSync('rolldeck-dummy-timing-guard', DUMMY_SALT, 32).toString('hex');

export interface AuthContext {
  kind: 'user' | 'api-key';
  role?: UserRole;
  userId?: string;
  username?: string;
  displayName?: string;
  scopes: ApiKeyScope[];
  keyId?: string;
  keyName?: string;
}

interface SessionPayload {
  sub: string;
  username: string;
  role: UserRole;
  pwdVer: number;
  envAdmin?: boolean;
  iat: number;
  exp: number;
  jti: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export function hashSecretScrypt(secret: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, actualSalt, 32).toString('hex');
  return { hash: derived, salt: actualSalt };
}

export function verifySecretScrypt(secret: string, expectedHash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(secret, salt, 32);
    const expected = Buffer.from(expectedHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function getEnvAccessToken(): string | null {
  const val = process.env.ACCESS_TOKEN?.trim();
  return val && val.length > 0 ? val : null;
}

export function issueUserSessionToken(user: {
  id: string;
  username: string;
  role: UserRole;
  passwordVersion: number;
  envAdmin?: boolean;
}): string {
  const payloadObj: SessionPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    pwdVer: user.passwordVersion,
    ...(user.envAdmin ? { envAdmin: true } : {}),
    iat: Date.now(),
    exp: Date.now() + SESSION_TTL_MS,
    jti: crypto.randomBytes(8).toString('hex'),
  };

  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');

  return `rds_${payload}.${sig}`;
}

function decodeSignedSession(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string' || !token.startsWith('rds_')) return null;
  const raw = token.slice(4);
  const dotIdx = raw.indexOf('.');
  if (dotIdx <= 0) return null;

  const payload = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  if (!payload || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_SECRET)
    .update(payload)
    .digest('base64url');

  if (!timingSafeStringEqual(sig, expectedSig)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as SessionPayload;
    if (!parsed.sub || !parsed.username || !parsed.role) return null;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function verifyUserSession(
  store: LocalApiStore,
  token: string
): Promise<PublicUser | null> {
  const payload = decodeSignedSession(token);
  if (!payload) return null;

  // Env-configured admin override session
  if (payload.envAdmin) {
    if (!getEnvAccessToken()) return null;
    return {
      id: 'env-admin',
      username: 'admin',
      displayName: 'Administrador',
      role: 'admin',
      scopes: ROLE_SCOPES.admin,
      active: true,
      createdAt: payload.iat,
      updatedAt: payload.iat,
    };
  }

  const state = await store.getState();
  const user = state.users.find((u) => u.id === payload.sub);
  if (!user || !user.active) return null;
  if (user.passwordVersion !== payload.pwdVer) return null;

  return store.toPublicUser(user);
}

export async function getAuthMode(
  store: LocalApiStore
): Promise<'users' | 'env' | 'unclaimed'> {
  const state = await store.getState();
  if (state.users.length > 0) return 'users';
  if (getEnvAccessToken()) return 'env';
  return 'unclaimed';
}

export async function setupInitialAdmin(
  store: LocalApiStore,
  input: { username: string; displayName?: string; password: string }
): Promise<{ ok: true; user: PublicUser; sessionToken: string } | { ok: false; error: string }> {
  const state = await store.getState();
  if (state.users.length > 0) {
    return { ok: false, error: 'O administrador inicial já foi configurado neste servidor.' };
  }

  const now = Date.now();
  const { hash, salt } = hashSecretScrypt(input.password);
  const newUser: StoredUser = {
    id: `usr_${crypto.randomUUID()}`,
    username: input.username.trim().toLowerCase(),
    displayName: (input.displayName || input.username).trim(),
    role: 'admin',
    active: true,
    passwordHash: hash,
    passwordSalt: salt,
    passwordVersion: 1,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  await store.mutate((doc) => {
    doc.users.push(newUser);
  });

  const sessionToken = issueUserSessionToken(newUser);
  return {
    ok: true,
    user: store.toPublicUser(newUser),
    sessionToken,
  };
}

export async function authenticateUser(
  store: LocalApiStore,
  username: string,
  password: string
): Promise<
  | { ok: true; user: PublicUser; sessionToken: string }
  | { ok: false; status: number; message: string; needsSetup?: boolean }
> {
  const normalized = username.trim().toLowerCase();
  const state = await store.getState();

  // Check optional env ACCESS_TOKEN emergency admin login
  const envToken = getEnvAccessToken();
  if (envToken && normalized === 'admin' && timingSafeStringEqual(password.trim(), envToken)) {
    const existingAdmin = state.users.find((u) => u.username === 'admin' && u.role === 'admin' && u.active);
    if (existingAdmin) {
      await store.mutate((doc) => {
        const target = doc.users.find((u) => u.id === existingAdmin.id);
        if (target) target.lastLoginAt = Date.now();
      });
      return {
        ok: true,
        user: store.toPublicUser({ ...existingAdmin, lastLoginAt: Date.now() }),
        sessionToken: issueUserSessionToken(existingAdmin),
      };
    }

    const now = Date.now();
    const envUser: PublicUser = {
      id: 'env-admin',
      username: 'admin',
      displayName: 'Administrador',
      role: 'admin',
      scopes: ROLE_SCOPES.admin,
      active: true,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    return {
      ok: true,
      user: envUser,
      sessionToken: issueUserSessionToken({
        id: 'env-admin',
        username: 'admin',
        role: 'admin',
        passwordVersion: 1,
        envAdmin: true,
      }),
    };
  }

  if (state.users.length === 0) {
    return {
      ok: false,
      status: 409,
      needsSetup: true,
      message: 'Nenhum administrador configurado ainda. Crie o primeiro usuário admin.',
    };
  }

  const user = state.users.find((u) => u.username === normalized);
  if (!user) {
    // Timing-safe dummy check to prevent username enumeration
    verifySecretScrypt(password, DUMMY_HASH, DUMMY_SALT);
    return {
      ok: false,
      status: 401,
      message: 'Usuário ou senha incorretos.',
    };
  }

  const passwordValid = verifySecretScrypt(password, user.passwordHash, user.passwordSalt);
  if (!passwordValid) {
    return {
      ok: false,
      status: 401,
      message: 'Usuário ou senha incorretos.',
    };
  }

  if (!user.active) {
    return {
      ok: false,
      status: 403,
      message: 'Esta conta foi desativada pelo administrador.',
    };
  }

  const now = Date.now();
  await store.mutate((doc) => {
    const target = doc.users.find((u) => u.id === user.id);
    if (target) target.lastLoginAt = now;
  });

  const sessionToken = issueUserSessionToken(user);
  return {
    ok: true,
    user: store.toPublicUser({ ...user, lastLoginAt: now }),
    sessionToken,
  };
}

export async function createExternalApiKey(
  store: LocalApiStore,
  name: string,
  scopes: ApiKeyScope[]
): Promise<{ key: PublicApiKey; plaintextKey: string }> {
  const rawSecret = crypto.randomBytes(24).toString('hex');
  const plaintextKey = `rdk_${rawSecret}`;
  const prefix = plaintextKey.slice(0, 12);
  const { hash, salt } = hashSecretScrypt(plaintextKey);
  const id = `key_${crypto.randomUUID()}`;

  const stored = await store.mutate((doc) => {
    const entry = {
      id,
      name: name.trim(),
      prefix,
      hash,
      salt,
      scopes,
      createdAt: Date.now(),
      revoked: false,
    };
    doc.apiKeys.unshift(entry);
    return entry;
  });

  return {
    key: store.toPublicKey(stored),
    plaintextKey,
  };
}

export function extractCredentials(req: Request): {
  sessionToken?: string;
  apiKey?: string;
} {
  const xApiKey = req.header('x-api-key')?.trim();
  const authHeader = req.header('authorization')?.trim();

  if (xApiKey) {
    return { apiKey: xApiKey };
  }

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.startsWith('rdk_')) {
      return { apiKey: token };
    }
    if (token.startsWith('rds_')) {
      return { sessionToken: token };
    }
  }

  return {};
}

export function createAuthMiddleware(store: LocalApiStore) {
  const requireAuthenticatedUser = async (req: Request, res: Response, next: NextFunction) => {
    const { sessionToken } = extractCredentials(req);
    if (!sessionToken) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Sessão ausente. Faça login no aplicativo.',
      });
    }

    const user = await verifyUserSession(store, sessionToken);
    if (!user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Sessão expirada ou revogada. Faça login novamente.',
      });
    }

    req.auth = {
      kind: 'user',
      role: user.role,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      scopes: user.scopes,
    };
    return next();
  };

  const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    const { sessionToken } = extractCredentials(req);
    if (!sessionToken) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Sessão de administrador necessária.',
      });
    }

    const user = await verifyUserSession(store, sessionToken);
    if (!user) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Sessão expirada ou revogada. Faça login novamente.',
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        error: 'forbidden',
        message: 'Acesso restrito a administradores.',
      });
    }

    req.auth = {
      kind: 'user',
      role: user.role,
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      scopes: user.scopes,
    };
    return next();
  };

  const requireApiAuth = (requiredScope: ApiKeyScope) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const { sessionToken, apiKey } = extractCredentials(req);

      if (sessionToken) {
        const user = await verifyUserSession(store, sessionToken);
        if (user) {
          if (!user.scopes.includes(requiredScope)) {
            return res.status(403).json({
              error: 'forbidden',
              message: `Seu nível de permissão (${user.role}) não permite "${requiredScope}".`,
            });
          }

          req.auth = {
            kind: 'user',
            role: user.role,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            scopes: user.scopes,
          };
          return next();
        }
      }

      if (apiKey && apiKey.startsWith('rdk_')) {
        const prefix = apiKey.slice(0, 12);
        const state = await store.getState();
        const candidate = state.apiKeys.find((k) => !k.revoked && k.prefix === prefix);

        if (candidate && verifySecretScrypt(apiKey, candidate.hash, candidate.salt)) {
          if (!candidate.scopes.includes(requiredScope)) {
            return res.status(403).json({
              error: 'forbidden',
              message: `Esta chave de API não possui permissão "${requiredScope}".`,
            });
          }

          store
            .mutate((doc) => {
              const target = doc.apiKeys.find((k) => k.id === candidate.id);
              if (target) target.lastUsedAt = Date.now();
            })
            .catch(() => {});

          req.auth = {
            kind: 'api-key',
            scopes: candidate.scopes,
            keyId: candidate.id,
            keyName: candidate.name,
          };
          return next();
        }
      }

      return res.status(401).json({
        error: 'unauthorized',
        message:
          'Credencial inválida ou ausente. Faça login ou envie "X-API-Key: rdk_...".',
      });
    };
  };

  return { requireAuthenticatedUser, requireAdmin, requireApiAuth };
}

export function createSimpleRateLimiter(windowMs: number, maxRequests: number) {
  const hits = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'local';
    const now = Date.now();
    const cutoff = now - windowMs;
    const recent = (hits.get(ip) || []).filter((ts) => ts > cutoff);

    if (recent.length >= maxRequests) {
      return res.status(429).json({
        error: 'rate_limited',
        message: 'Muitas tentativas em sequência. Aguarde alguns segundos e tente novamente.',
      });
    }

    recent.push(now);
    hits.set(ip, recent);
    return next();
  };
}
