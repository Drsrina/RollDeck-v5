import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiV1Router } from './server/apiRouter';
import {
  authenticateUser,
  createAuthMiddleware,
  createSimpleRateLimiter,
  getAuthMode,
  hashSecretScrypt,
  issueUserSessionToken,
  setupInitialAdmin,
  verifySecretScrypt,
  verifyUserSession,
} from './server/auth';
import { AdminSetupSchema, ChangePasswordSchema, LoginSchema } from './server/schemas';
import { LocalApiStore, ROLE_SCOPES } from './server/store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServerApp(customStore?: LocalApiStore) {
  const app = express();
  const store = customStore || new LocalApiStore();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  // Explicit allowlisted CORS (never wildcard '*' on authenticated APIs)
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use('/api', (req, res, next) => {
    const origin = req.header('origin');
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    }
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  const authLimiter = createSimpleRateLimiter(60_000, 30);
  const { requireAuthenticatedUser } = createAuthMiddleware(store);

  // Health check endpoint
  app.get('/api/health', async (_req, res) => {
    const state = await store.getState();
    const authMode = await getAuthMode(store);
    res.json({
      status: 'ok',
      mode: 'local-api-v1',
      apiVersion: '1.0.0',
      authConfigured: authMode !== 'unclaimed',
      userCount: state.users.length,
      updatedAt: state.updatedAt,
      timestamp: Date.now(),
    });
  });

  // Auth status (checks whether initial admin user has been created)
  app.get('/api/auth/status', async (_req, res) => {
    const state = await store.getState();
    const mode = await getAuthMode(store);
    res.json({
      configured: mode !== 'unclaimed',
      mode,
      userCount: state.users.length,
    });
  });

  // One-time first-run admin setup (username + password, no email)
  app.post('/api/auth/setup', authLimiter, async (req, res) => {
    try {
      const parsed = AdminSetupSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || 'Dados inválidos para criação do administrador.',
        });
      }

      const created = await setupInitialAdmin(store, {
        username: parsed.data.username,
        displayName: parsed.data.displayName,
        password: parsed.data.password,
      });

      if (!created.ok) {
        return res.status(409).json({ success: false, message: created.error });
      }

      return res.status(201).json({
        success: true,
        sessionToken: created.sessionToken,
        user: created.user,
        message: 'Administrador criado e acesso liberado.',
      });
    } catch (err) {
      console.error('Erro ao configurar administrador inicial:', err);
      return res.status(500).json({ success: false, message: 'Erro interno ao criar administrador.' });
    }
  });

  // Simple login (username + password, no email)
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const parsed = LoginSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Informe usuário e senha para entrar.',
        });
      }

      const authResult = await authenticateUser(store, parsed.data.username, parsed.data.password);
      if (!authResult.ok) {
        return res.status(authResult.status).json({
          success: false,
          needsSetup: authResult.needsSetup,
          message: authResult.message,
        });
      }

      return res.json({
        success: true,
        sessionToken: authResult.sessionToken,
        user: authResult.user,
        message: 'Acesso liberado com sucesso.',
      });
    } catch (err) {
      console.error('Erro no login:', err);
      return res.status(500).json({ success: false, message: 'Erro interno ao autenticar.' });
    }
  });

  // Current authenticated user profile
  app.get('/api/auth/me', requireAuthenticatedUser, async (req, res) => {
    const auth = req.auth!;
    if (auth.userId === 'env-admin') {
      const now = Date.now();
      return res.json({
        user: {
          id: 'env-admin',
          username: 'admin',
          displayName: 'Administrador',
          role: 'admin',
          scopes: ROLE_SCOPES.admin,
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    const state = await store.getState();
    const user = state.users.find((u) => u.id === auth.userId);
    if (!user) {
      return res.status(401).json({ error: 'unauthorized', message: 'Usuário não encontrado.' });
    }

    return res.json({ user: store.toPublicUser(user) });
  });

  // Change own password (rotates passwordVersion and issues a fresh token)
  app.post('/api/auth/change-password', authLimiter, requireAuthenticatedUser, async (req, res) => {
    try {
      const parsed = ChangePasswordSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message || 'Dados inválidos.',
        });
      }

      const userId = req.auth?.userId;
      if (!userId || userId === 'env-admin') {
        return res.status(400).json({
          success: false,
          message: 'A conta de emergência configurada por variável de ambiente não pode ser alterada aqui.',
        });
      }

      const state = await store.getState();
      const target = state.users.find((u) => u.id === userId && u.active);
      if (!target) {
        return res.status(401).json({ success: false, message: 'Sessão inválida.' });
      }

      if (!verifySecretScrypt(parsed.data.currentPassword, target.passwordHash, target.passwordSalt)) {
        return res.status(401).json({ success: false, message: 'Senha atual incorreta.' });
      }

      const { hash, salt } = hashSecretScrypt(parsed.data.newPassword);
      const updated = await store.mutate((doc) => {
        const entry = doc.users.find((u) => u.id === userId);
        if (!entry) return null;
        entry.passwordHash = hash;
        entry.passwordSalt = salt;
        entry.passwordVersion += 1;
        entry.updatedAt = Date.now();
        return entry;
      });

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
      }

      const sessionToken = issueUserSessionToken(updated);
      return res.json({
        success: true,
        sessionToken,
        user: store.toPublicUser(updated),
        message: 'Senha atualizada com sucesso.',
      });
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      return res.status(500).json({ success: false, message: 'Erro interno ao alterar senha.' });
    }
  });

  // Validate existing session token (returns live user profile & role)
  app.post('/api/auth/validate-session', async (req, res) => {
    try {
      const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '').trim();
      const bodyToken = typeof req.body?.sessionToken === 'string' ? req.body.sessionToken : undefined;
      const sessionToken = bearer || bodyToken;

      if (!sessionToken) {
        return res.status(401).json({ valid: false });
      }

      const user = await verifyUserSession(store, sessionToken);
      if (!user) {
        return res.status(401).json({ valid: false });
      }

      return res.json({ valid: true, user });
    } catch {
      return res.status(500).json({ valid: false });
    }
  });

  // Mount complete REST API v1
  app.use('/api/v1', createApiV1Router(store));

  return { app, store };
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';
  const { app, store } = createServerApp();
  await store.init();

  const httpServer = http.createServer(app);

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`RollDeck server & REST API v1 running on http://0.0.0.0:${PORT}`);
  });
}

// Only start listening when executed directly (not imported by Vitest)
const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectExecution) {
  startServer();
}
