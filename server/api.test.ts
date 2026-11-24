import fs from 'fs/promises';
import http from 'http';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServerApp } from '../server';
import { parseDiceExpression } from './apiRouter';
import { LocalApiStore } from './store';

describe('RollDeck REST API v1 — Usuários, RBAC, Chaves Externas, CRUD & Motores RPG', () => {
  let server: http.Server;
  let baseUrl: string;
  let tempDir: string;
  let adminSessionToken = '';
  let adminUserId = '';
  let gmUserId = '';
  let playerUserId = '';
  let viewerUserId = '';
  let readOnlyApiKey = '';
  let fullApiKey = '';
  let fullApiKeyId = '';
  const prevAccessToken = process.env.ACCESS_TOKEN;

  beforeAll(async () => {
    delete process.env.ACCESS_TOKEN;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rolldeck-api-test-'));
    const storeFile = path.join(tempDir, 'store.json');
    const store = new LocalApiStore(storeFile);
    await store.init();
    const { app } = createServerApp(store);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (prevAccessToken !== undefined) {
      process.env.ACCESS_TOKEN = prevAccessToken;
    } else {
      delete process.env.ACCESS_TOKEN;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('parses RPG dice expressions accurately', () => {
    const parsed = parseDiceExpression('2d20kh1 + 1d8r1 + 5');
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0]).toMatchObject({
      count: 2,
      dieId: 'd20',
      keepRule: 'keep-highest',
      keepCount: 1,
    });
    expect(parsed.groups[1]).toMatchObject({
      count: 1,
      dieId: 'd8',
      rerollOnes: true,
    });
    expect(parsed.globalModifier).toBe(5);
  });

  it('supports one-time admin setup (no email), simple username+password login, and blocks duplicate setup', async () => {
    const statusBefore = await fetch(`${baseUrl}/api/auth/status`).then((r) => r.json());
    expect(statusBefore.configured).toBe(false);
    expect(statusBefore.mode).toBe('unclaimed');

    // Rejects email-like usernames
    const badUsername = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin@exemplo.com', password: 'senha-forte-123' }),
    });
    expect(badUsername.status).toBe(400);

    // Valid first-run admin setup
    const setupRes = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        displayName: 'Admin Principal',
        password: 'admin-password-2026',
      }),
    });
    expect(setupRes.status).toBe(201);
    const setupBody = await setupRes.json();
    expect(setupBody.success).toBe(true);
    expect(setupBody.sessionToken).toMatch(/^rds_/);
    expect(setupBody.user.username).toBe('admin');
    expect(setupBody.user.role).toBe('admin');
    adminSessionToken = setupBody.sessionToken;
    adminUserId = setupBody.user.id;

    // Second setup attempt must be rejected
    const secondSetup = await fetch(`${baseUrl}/api/auth/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'outro', password: 'outra-senha-123' }),
    });
    expect(secondSetup.status).toBe(409);

    // Wrong password rejected
    const badLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'errada' }),
    });
    expect(badLogin.status).toBe(401);

    // Valid username + password login
    const okLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin-password-2026' }),
    });
    expect(okLogin.status).toBe(200);
    const okBody = await okLogin.json();
    expect(okBody.sessionToken).toMatch(/^rds_/);
    expect(okBody.user.username).toBe('admin');

    // /api/auth/me returns active user profile
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.user.id).toBe(adminUserId);
  });

  it('creates users as admin, enforces RBAC across admin/gm/player/viewer, and protects last admin', async () => {
    const createUser = async (username: string, role: string, password: string) => {
      const res = await fetch(`${baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminSessionToken}`,
        },
        body: JSON.stringify({ username, displayName: username.toUpperCase(), role, password }),
      });
      return res;
    };

    const gmRes = await createUser('mestre1', 'gm', 'senha-mestre-1');
    expect(gmRes.status).toBe(201);
    gmUserId = (await gmRes.json()).id;

    const playerRes = await createUser('jogador1', 'player', 'senha-jogador-1');
    expect(playerRes.status).toBe(201);
    playerUserId = (await playerRes.json()).id;

    const viewerRes = await createUser('obs1', 'viewer', 'senha-obs-1');
    expect(viewerRes.status).toBe(201);
    viewerUserId = (await viewerRes.json()).id;

    // Duplicate username rejected with 409
    const dupRes = await createUser('jogador1', 'player', 'outra-senha-1');
    expect(dupRes.status).toBe(409);

    // Login each role
    const loginAs = async (username: string, password: string) => {
      const r = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      expect(r.status).toBe(200);
      return (await r.json()).sessionToken as string;
    };

    const gmToken = await loginAs('mestre1', 'senha-mestre-1');
    const playerToken = await loginAs('jogador1', 'senha-jogador-1');
    const viewerToken = await loginAs('obs1', 'senha-obs-1');

    // VIEWER: can read, blocked on roll, oracle, write, users, keys
    expect(
      (await fetch(`${baseUrl}/api/v1/notes`, { headers: { Authorization: `Bearer ${viewerToken}` } })).status
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/roll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
          body: JSON.stringify({ expression: '1d20' }),
        })
      ).status
    ).toBe(403);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${viewerToken}` },
          body: JSON.stringify({ title: 'Bloqueado', body: 'x' }),
        })
      ).status
    ).toBe(403);
    expect(
      (await fetch(`${baseUrl}/api/v1/users`, { headers: { Authorization: `Bearer ${viewerToken}` } })).status
    ).toBe(403);

    // PLAYER: can read, roll, oracle, but blocked on write, users, keys
    expect(
      (
        await fetch(`${baseUrl}/api/v1/roll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerToken}` },
          body: JSON.stringify({ expression: '1d20+3' }),
        })
      ).status
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/oracle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerToken}` },
          body: JSON.stringify({ pergunta: 'A porta abre?', seed: 10 }),
        })
      ).status
    ).toBe(200);
    expect(
      (
        await fetch(`${baseUrl}/api/v1/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${playerToken}` },
          body: JSON.stringify({ title: 'Bloqueado Jogador', body: 'x' }),
        })
      ).status
    ).toBe(403);
    expect(
      (await fetch(`${baseUrl}/api/v1/users`, { headers: { Authorization: `Bearer ${playerToken}` } })).status
    ).toBe(403);

    // GM: can write notes, blocked on users and API keys
    const gmCreateNote = await fetch(`${baseUrl}/api/v1/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gmToken}` },
      body: JSON.stringify({ title: 'Taverna do Corvo', body: 'Ponto inicial.' }),
    });
    expect(gmCreateNote.status).toBe(201);
    expect(
      (await fetch(`${baseUrl}/api/v1/users`, { headers: { Authorization: `Bearer ${gmToken}` } })).status
    ).toBe(403);
    expect(
      (await fetch(`${baseUrl}/api/v1/keys`, { headers: { Authorization: `Bearer ${gmToken}` } })).status
    ).toBe(403);

    // Deactivating a user revokes active session immediately and blocks login
    const deactivateRes = await fetch(`${baseUrl}/api/v1/users/${viewerUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`,
      },
      body: JSON.stringify({ active: false }),
    });
    expect(deactivateRes.status).toBe(200);
    expect(
      (await fetch(`${baseUrl}/api/v1/notes`, { headers: { Authorization: `Bearer ${viewerToken}` } })).status
    ).toBe(401);
    const deactivatedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'obs1', password: 'senha-obs-1' }),
    });
    expect(deactivatedLogin.status).toBe(403);

    // Self-password change rotates token and invalidates old token
    const changePwdRes = await fetch(`${baseUrl}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${playerToken}`,
      },
      body: JSON.stringify({
        currentPassword: 'senha-jogador-1',
        newPassword: 'nova-senha-jogador-2',
      }),
    });
    expect(changePwdRes.status).toBe(200);
    const changedBody = await changePwdRes.json();
    expect(changedBody.sessionToken).toMatch(/^rds_/);

    // Old player token must be rejected now
    expect(
      (await fetch(`${baseUrl}/api/v1/notes`, { headers: { Authorization: `Bearer ${playerToken}` } })).status
    ).toBe(401);
    // New player token works
    expect(
      (
        await fetch(`${baseUrl}/api/v1/notes`, {
          headers: { Authorization: `Bearer ${changedBody.sessionToken}` },
        })
      ).status
    ).toBe(200);

    // Last-admin and self-deletion protections
    const selfDelete = await fetch(`${baseUrl}/api/v1/users/${adminUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    expect(selfDelete.status).toBe(400);

    const demoteLastAdmin = await fetch(`${baseUrl}/api/v1/users/${adminUserId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`,
      },
      body: JSON.stringify({ role: 'gm' }),
    });
    expect(demoteLastAdmin.status).toBe(400);

    // Admin can delete non-admin user
    const deleteViewer = await fetch(`${baseUrl}/api/v1/users/${viewerUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    expect(deleteViewer.status).toBe(200);
    expect(gmUserId).toMatch(/^usr_/);
    expect(playerUserId).toMatch(/^usr_/);
  });

  it('blocks unauthenticated access to protected endpoints and serves OpenAPI spec publicly', async () => {
    const unauthNotes = await fetch(`${baseUrl}/api/v1/notes`);
    expect(unauthNotes.status).toBe(401);

    const openApiRes = await fetch(`${baseUrl}/api/v1/openapi.json`);
    expect(openApiRes.status).toBe(200);
    const spec = await openApiRes.json();
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.paths['/api/auth/login']).toBeDefined();
    expect(spec.paths['/api/v1/users']).toBeDefined();
    expect(spec.paths['/api/v1/notes']).toBeDefined();
    expect(spec.paths['/api/v1/roll']).toBeDefined();
  });

  it('creates scoped external API keys (admin only) and enforces scope permissions', async () => {
    const createReadRes = await fetch(`${baseUrl}/api/v1/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`,
      },
      body: JSON.stringify({ name: 'Bot Leitura', scopes: ['read', 'roll'] }),
    });
    expect(createReadRes.status).toBe(201);
    const readData = await createReadRes.json();
    expect(readData.apiKey).toMatch(/^rdk_/);
    readOnlyApiKey = readData.apiKey;

    // Read-only key cannot create notes (403 forbidden)
    const forbiddenWrite = await fetch(`${baseUrl}/api/v1/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': readOnlyApiKey,
      },
      body: JSON.stringify({ title: 'Nota Negada', body: 'Sem permissão' }),
    });
    expect(forbiddenWrite.status).toBe(403);

    // Read-only key CAN list notes
    const okRead = await fetch(`${baseUrl}/api/v1/notes`, {
      headers: { 'X-API-Key': readOnlyApiKey },
    });
    expect(okRead.status).toBe(200);

    // Create full-access key
    const createFullRes = await fetch(`${baseUrl}/api/v1/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`,
      },
      body: JSON.stringify({
        name: 'Integração Completa',
        scopes: ['read', 'write', 'roll', 'generate'],
      }),
    });
    expect(createFullRes.status).toBe(201);
    const fullData = await createFullRes.json();
    fullApiKey = fullData.apiKey;
    fullApiKeyId = fullData.key.id;

    // External API keys cannot manage keys or users (admin session only)
    const keyManageBlocked = await fetch(`${baseUrl}/api/v1/keys`, {
      headers: { 'X-API-Key': fullApiKey },
    });
    expect(keyManageBlocked.status).toBe(401);

    const userManageBlocked = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { 'X-API-Key': fullApiKey },
    });
    expect(userManageBlocked.status).toBe(401);
  });

  it('executes complete CRUD on notes and SVG drawings via X-API-Key', async () => {
    const createNoteRes = await fetch(`${baseUrl}/api/v1/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': fullApiKey },
      body: JSON.stringify({
        title: 'Fortaleza Cinzenta',
        body: 'Base antiga nas montanhas.',
        tags: ['fortaleza', 'norte'],
        layerId: 'layer-locations',
        x: 140,
        y: -60,
      }),
    });
    expect(createNoteRes.status).toBe(201);
    const note = await createNoteRes.json();
    expect(note.id).toMatch(/^note-/);

    const searchRes = await fetch(`${baseUrl}/api/v1/notes?search=cinzenta&tag=norte`, {
      headers: { 'X-API-Key': fullApiKey },
    });
    const searchData = await searchRes.json();
    expect(searchData.total).toBe(1);
    expect(searchData.items[0].id).toBe(note.id);

    const patchRes = await fetch(`${baseUrl}/api/v1/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': fullApiKey },
      body: JSON.stringify({ pinned: true }),
    });
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.pinned).toBe(true);

    const drawRes = await fetch(`${baseUrl}/api/v1/drawings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': fullApiKey },
      body: JSON.stringify({
        layerId: 'layer-locations',
        preset: 'river',
        x: 0,
        y: 0,
        width: 220,
        height: 80,
        points: [
          { x: 0, y: 0.5 },
          { x: 0.5, y: 0.2 },
          { x: 1, y: 0.8 },
        ],
      }),
    });
    expect(drawRes.status).toBe(201);
    const drawing = await drawRes.json();
    expect(drawing.preset).toBe('river');

    const delRes = await fetch(`${baseUrl}/api/v1/notes/${note.id}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': fullApiKey },
    });
    expect(delRes.status).toBe(200);

    const missingRes = await fetch(`${baseUrl}/api/v1/notes/${note.id}`, {
      headers: { 'X-API-Key': fullApiKey },
    });
    expect(missingRes.status).toBe(404);
  });

  it('executes RPG engines (roll, deterministic oracle, deterministic Forja) and revokes API keys', async () => {
    const rollRes = await fetch(`${baseUrl}/api/v1/roll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': fullApiKey },
      body: JSON.stringify({ title: 'Teste Crítico', expression: '2d20kh1+5', saveToHistory: true }),
    });
    expect(rollRes.status).toBe(200);
    const rollData = await rollRes.json();
    expect(rollData.total).toBeGreaterThanOrEqual(6);
    expect(rollData.total).toBeLessThanOrEqual(25);

    const oracle1 = await fetch(`${baseUrl}/api/v1/oracle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': fullApiKey },
      body: JSON.stringify({ pergunta: 'Há armadilha?', probabilidade: 'provavel', seed: 42 }),
    }).then((r) => r.json());
    const oracle2 = await fetch(`${baseUrl}/api/v1/oracle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': fullApiKey },
      body: JSON.stringify({ pergunta: 'Há armadilha?', probabilidade: 'provavel', seed: 42 }),
    }).then((r) => r.json());
    expect(oracle1.dadoRolado).toBe(oracle2.dadoRolado);
    expect(oracle1.grau).toBe(oracle2.grau);

    const npcsRes = await fetch(`${baseUrl}/api/v1/forja/npcs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': fullApiKey },
      body: JSON.stringify({ seed: 42, count: 3 }),
    });
    expect(npcsRes.status).toBe(200);
    const npcsData = await npcsRes.json();
    expect(npcsData.items).toHaveLength(3);

    // Revoke key and verify rejection
    const revokeRes = await fetch(`${baseUrl}/api/v1/keys/${fullApiKeyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    expect(revokeRes.status).toBe(200);

    const afterRevoke = await fetch(`${baseUrl}/api/v1/notes`, {
      headers: { 'X-API-Key': fullApiKey },
    });
    expect(afterRevoke.status).toBe(401);
  });

  it('imports Obsidian Markdown files with YAML frontmatter, tags, and auto-linked [[wiki-links]]', async () => {
    const res = await fetch(`${baseUrl}/api/v1/integrations/obsidian/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`,
      },
      body: JSON.stringify({
        layerId: 'layer-locations',
        mode: 'merge',
        files: [
          {
            filename: 'Campanha/Cidadela de Ferro.md',
            content:
              '---\ntags: [local, fortaleza]\ncategory: location\naliases: [Cidadela]\n---\nFortaleza governada por [[Lorde Kaelen|O Regente]] #norte.',
          },
          {
            filename: 'NPCs/Lorde Kaelen.md',
            content:
              '---\ntype: npc\ntags:\n  - nobre\n  - aliado\n---\nDefensor da [[Campanha/Cidadela|Cidadela de Ferro]].',
          },
        ],
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source).toBe('obsidian');
    expect(body.createdCount).toBe(2);
    expect(body.updatedCount).toBe(0);
    expect(body.linksCreatedCount).toBe(2);

    const cidadela = body.notes.find((n: any) => n.title === 'Cidadela de Ferro');
    const kaelen = body.notes.find((n: any) => n.title === 'Lorde Kaelen');
    expect(cidadela.category).toBe('location');
    expect(cidadela.tags).toEqual(expect.arrayContaining(['obsidian', 'local', 'fortaleza', 'norte']));
    expect(kaelen.category).toBe('npc');

    // Re-importing in merge mode updates existing notes instead of duplicating
    const mergeRes = await fetch(`${baseUrl}/api/v1/integrations/obsidian/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminSessionToken}`,
      },
      body: JSON.stringify({
        layerId: 'layer-locations',
        mode: 'merge',
        files: [
          {
            filename: 'Lorde Kaelen.md',
            content: 'Conteúdo atualizado sobre [[Cidadela de Ferro]].',
          },
        ],
      }),
    });
    expect(mergeRes.status).toBe(201);
    const mergeBody = await mergeRes.json();
    expect(mergeBody.createdCount).toBe(0);
    expect(mergeBody.updatedCount).toBe(1);
  });

  it('reports Notion unconfigured cleanly and converts Notion pages/blocks/mentions via server helper', async () => {
    const prevNotionKey = process.env.NOTION_API_KEY;
    delete process.env.NOTION_API_KEY;

    try {
      const statusRes = await fetch(`${baseUrl}/api/v1/integrations/notion/status`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      expect(statusRes.status).toBe(200);
      const statusBody = await statusRes.json();
      expect(statusBody.configured).toBe(false);

      const searchRes = await fetch(`${baseUrl}/api/v1/integrations/notion/search`, {
        headers: { Authorization: `Bearer ${adminSessionToken}` },
      });
      expect(searchRes.status).toBe(503);

      // Test Notion block + mention -> Markdown + NoteLink conversion with mocked fetcher
      const { importNotionToGraph } = await import('./integrations');
      const pageAId = '11111111-1111-1111-1111-111111111111';
      const pageBId = '22222222-2222-2222-2222-222222222222';

      const mockFetch = (async (url: string) => {
        if (url.endsWith(`/pages/${pageAId}`)) {
          return new Response(
            JSON.stringify({
              id: pageAId,
              object: 'page',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'Guilda das Sombras' }] },
                Tipo: { type: 'select', select: { name: 'Facção' } },
              },
            }),
            { status: 200 }
          );
        }
        if (url.endsWith(`/pages/${pageBId}`)) {
          return new Response(
            JSON.stringify({
              id: pageBId,
              object: 'page',
              properties: {
                Name: { type: 'title', title: [{ plain_text: 'Porto Nebuloso' }] },
                Tags: { type: 'multi_select', multi_select: [{ name: 'local' }] },
              },
            }),
            { status: 200 }
          );
        }
        if (url.includes(`/blocks/${pageAId}/children`)) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  type: 'heading_2',
                  heading_2: { rich_text: [{ plain_text: 'Base Secreta' }] },
                },
                {
                  type: 'paragraph',
                  paragraph: {
                    rich_text: [
                      { plain_text: 'Opera a partir de ' },
                      {
                        type: 'mention',
                        mention: { type: 'page', page: { id: pageBId } },
                        plain_text: 'Porto Nebuloso',
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200 }
          );
        }
        if (url.includes(`/blocks/${pageBId}/children`)) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  type: 'bulleted_list_item',
                  bulleted_list_item: { rich_text: [{ plain_text: 'Docas controladas por contrabandistas.' }] },
                },
              ],
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
      }) as unknown as typeof fetch;

      const imported = await importNotionToGraph({
        pageIds: [pageAId, pageBId],
        layerId: 'layer-locations',
        mode: 'merge',
        existingNotes: [],
        existingLinks: [],
        apiKey: 'secret_test_token',
        fetcher: mockFetch,
      });

      expect(imported.createdCount).toBe(2);
      expect(imported.linksCreatedCount).toBe(1);
      const guildNote = imported.notes.find((n) => n.title === 'Guilda das Sombras');
      expect(guildNote?.category).toBe('faction');
      expect(guildNote?.body).toContain('## Base Secreta');
      expect(guildNote?.body).toContain('[[Porto Nebuloso]]');
    } finally {
      if (prevNotionKey !== undefined) {
        process.env.NOTION_API_KEY = prevNotionKey;
      }
    }
  });
});

