import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Code2,
  Copy,
  Download,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { exportBackupJSON, importBackupJSON } from '../../db/indexedDB';
import { apiFetch, hasScope, isGmOrAdmin, useAuthSession } from '../../lib/authSession';
import { useAppStore } from '../../store/useAppStore';
import { ExternalNotesImportSection } from './ExternalNotesImportSection';

type ApiScope = 'read' | 'write' | 'roll' | 'generate';

interface PublicApiKey {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  createdAt: number;
  lastUsedAt?: number;
  revoked: boolean;
}

interface ApiInfo {
  version: string;
  mode: string;
  openapi: string;
  updatedAt: number;
  counts: {
    notes: number;
    links: number;
    layers: number;
    frames: number;
    drawings: number;
    dice: number;
    packages: number;
    categories: number;
    history: number;
    lootGenerators: number;
    lootGroups: number;
  };
}

const SCOPE_META: { id: ApiScope; label: string; desc: string }[] = [
  { id: 'read', label: 'Leitura', desc: 'GET notas, mapa, desenhos, pacotes e histórico' },
  { id: 'write', label: 'Escrita CRUD', desc: 'POST/PUT/PATCH/DELETE e sincronização' },
  { id: 'roll', label: 'Rolar Dados', desc: 'POST /api/v1/roll por fórmula ou pacote' },
  { id: 'generate', label: 'Geradores RPG', desc: 'Oráculo e Forja de Mundos via API' },
];

export const ApiIntegrationsPanel: React.FC = () => {
  const { refreshFromDB } = useAppStore();
  const { user: currentUser } = useAuthSession();
  const isAdmin = currentUser?.role === 'admin';
  const canUseGmModules = isGmOrAdmin(currentUser);
  const canWrite = hasScope(currentUser, 'write');
  const canRoll = hasScope(currentUser, 'roll');
  const canGenerate = hasScope(currentUser, 'generate') && canUseGmModules;

  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);
  const [keys, setKeys] = useState<PublicApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncBusy, setSyncBusy] = useState(false);
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Create API Key form
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<ApiScope[]>(['read', 'roll', 'generate']);
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedSecret, setNewlyCreatedSecret] = useState<{
    name: string;
    apiKey: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Endpoint Tester
  const [testResult, setTestResult] = useState<{ endpoint: string; status: number; body: string } | null>(null);
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const notify = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => {
      setBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const loadApiState = useCallback(async () => {
    setLoading(true);
    try {
      const infoPromise = fetch('/api/v1');
      const keysPromise = isAdmin ? apiFetch('/api/v1/keys') : Promise.resolve(null);
      const [infoRes, keysRes] = await Promise.all([infoPromise, keysPromise]);

      if (infoRes.ok) {
        setApiInfo(await infoRes.json());
      }
      if (keysRes && keysRes.ok) {
        const data = await keysRes.json();
        setKeys(Array.isArray(data.items) ? data.items : []);
      } else if (!isAdmin) {
        setKeys([]);
      }
    } catch {
      notify('err', 'Não foi possível consultar o servidor da API local.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadApiState();
  }, [loadApiState]);

  const copyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch {
      notify('err', 'Falha ao copiar para a área de transferência.');
    }
  };

  const toggleScope = (scope: ApiScope) => {
    setSelectedScopes((prev) => {
      if (prev.includes(scope)) {
        return prev.length > 1 ? prev.filter((s) => s !== scope) : prev;
      }
      return [...prev, scope];
    });
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyName.trim().length < 2) {
      notify('err', 'Dê um nome com pelo menos 2 caracteres para a chave.');
      return;
    }

    setCreatingKey(true);
    try {
      const res = await apiFetch('/api/v1/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: selectedScopes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Erro ao gerar chave de API.');
        return;
      }
      setNewlyCreatedSecret({ name: data.key.name, apiKey: data.apiKey });
      setNewKeyName('');
      await loadApiState();
      notify('ok', `Chave "${data.key.name}" criada com sucesso!`);
    } catch {
      notify('err', 'Erro de rede ao criar chave de API.');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (key: PublicApiKey) => {
    try {
      const res = await apiFetch(`/api/v1/keys/${encodeURIComponent(key.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        notify('err', data.message || 'Não foi possível revogar a chave.');
        return;
      }
      await loadApiState();
      notify('ok', `Chave "${key.name}" revogada.`);
    } catch {
      notify('err', 'Erro de rede ao revogar chave.');
    }
  };

  // Push browser IndexedDB data -> Local Server API
  const handlePushToApi = async (mode: 'replace' | 'merge') => {
    setSyncBusy(true);
    try {
      const rawJson = await exportBackupJSON(false);
      const parsed = JSON.parse(rawJson);

      const res = await apiFetch('/api/v1/snapshot', {
        method: 'PUT',
        body: JSON.stringify({
          mode,
          data: {
            notes: parsed.notes || [],
            links: parsed.links || [],
            layers: parsed.layers || [],
            frames: parsed.frames || [],
            drawings: parsed.drawings || [],
            dice: parsed.dice || [],
            packages: parsed.packages || [],
            categories: parsed.categories || [],
            history: parsed.history || [],
            lootGenerators: parsed.generators || [],
            lootGroups: parsed.lootGroups || [],
            settings: parsed.settings,
            viewState: parsed.viewState,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Falha ao enviar dados para a API local.');
        return;
      }
      await loadApiState();
      notify(
        'ok',
        `Dados enviados para a API (${data.counts.notes} notas, ${data.counts.drawings} desenhos SVG, ${data.counts.packages} pacotes).`
      );
    } catch {
      notify('err', 'Erro ao exportar dados locais para o servidor API.');
    } finally {
      setSyncBusy(false);
    }
  };

  // Pull Local Server API snapshot -> Browser IndexedDB
  const handlePullFromApi = async (mode: 'merge' | 'replace') => {
    setSyncBusy(true);
    try {
      const res = await apiFetch('/api/v1/snapshot');
      const snapshot = await res.json();
      if (!res.ok) {
        notify('err', snapshot.message || 'Falha ao ler snapshot da API.');
        return;
      }

      const backupPayload = {
        app: 'RollDeck',
        schemaVersion: snapshot.schemaVersion || 3,
        exportedAt: snapshot.exportedAt || new Date().toISOString(),
        dice: snapshot.dice || [],
        packages: snapshot.packages || [],
        categories: snapshot.categories || [],
        history: snapshot.history || [],
        settings: snapshot.settings,
        notes: snapshot.notes || [],
        links: snapshot.links || [],
        layers: snapshot.layers || [],
        frames: snapshot.frames || [],
        drawings: snapshot.drawings || [],
        viewState: snapshot.viewState,
        generators: snapshot.lootGenerators || [],
        lootGroups: snapshot.lootGroups || [],
      };

      const imported = await importBackupJSON(JSON.stringify(backupPayload), mode);
      if (!imported.success) {
        notify('err', imported.error || 'Falha ao importar snapshot da API.');
        return;
      }

      await refreshFromDB();
      notify(
        'ok',
        mode === 'merge'
          ? 'Dados da API mesclados ao navegador com sucesso!'
          : 'Dados locais substituídos pelo estado da API!'
      );
    } catch {
      notify('err', 'Erro ao importar dados da API local.');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleDownloadOpenApi = async () => {
    try {
      const res = await fetch('/api/v1/openapi.json');
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rolldeck-openapi-v1.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify('ok', 'Especificação OpenAPI 3.1 baixada.');
    } catch {
      notify('err', 'Falha ao baixar OpenAPI JSON.');
    }
  };

  const runLiveTest = async (label: string, path: string, method: 'GET' | 'POST', body?: unknown) => {
    setTestingEndpoint(label);
    try {
      const res = await apiFetch(path, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const json = await res.json();
      setTestResult({
        endpoint: `${method} ${path}`,
        status: res.status,
        body: JSON.stringify(json, null, 2),
      });
      if (method === 'POST' && path === '/api/v1/roll') {
        loadApiState();
      }
    } catch (err: any) {
      setTestResult({
        endpoint: `${method} ${path}`,
        status: 0,
        body: err?.message || 'Erro de rede',
      });
    } finally {
      setTestingEndpoint(null);
    }
  };

  const exampleApiKey = newlyCreatedSecret?.apiKey || 'SUA_CHAVE_rdk_AQUI';

  const curlExamples = [
    {
      id: 'curl-roll',
      title: 'Rolar dados (notação RPG)',
      code: `curl -X POST "${origin}/api/v1/roll" \\\n  -H "X-API-Key: ${exampleApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Ataque","expression":"2d20kh1+5","saveToHistory":true}'`,
    },
    {
      id: 'curl-note',
      title: 'Criar nota no Mapa via CRUD',
      code: `curl -X POST "${origin}/api/v1/notes" \\\n  -H "X-API-Key: ${exampleApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"title":"Torre do Vigia","body":"Ruína ao norte do rio.","tags":["local","missão"],"layerId":"layer-locations","x":120,"y":-80}'`,
    },
    {
      id: 'curl-oracle',
      title: 'Consultar Oráculo determinístico',
      code: `curl -X POST "${origin}/api/v1/oracle" \\\n  -H "X-API-Key: ${exampleApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"pergunta":"Os guardas estão alertas?","probabilidade":"provavel","seed":42}'`,
    },
    {
      id: 'curl-forja',
      title: 'Gerar NPCs na Forja de Mundos',
      code: `curl -X POST "${origin}/api/v1/forja/npcs" \\\n  -H "X-API-Key: ${exampleApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"seed":42,"count":3}'`,
    },
    {
      id: 'curl-obsidian',
      title: 'Importar notas Markdown do Obsidian',
      code: `curl -X POST "${origin}/api/v1/integrations/obsidian/import" \\\n  -H "X-API-Key: ${exampleApiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"layerId":"layer-locations","mode":"merge","files":[{"filename":"Taverna.md","content":"---\\ntags: [local]\\n---\\nEncontro com [[Mestre Torben]]."}]}'`,
    },
  ];

  return (
    <div className="space-y-4">
      {banner && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
            banner.type === 'ok'
              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-400/40'
              : 'bg-rose-500/15 text-rose-200 border-rose-400/40'
          }`}
        >
          {banner.type === 'ok' ? (
            <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Server Status & Local Browser <-> Server Sync */}
      <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white">
                API REST Local v1 &amp; Sincronização com o Servidor
              </h2>
              <p className="text-[11px] text-slate-400">
                Persistência 100% local no servidor Express (sem nuvem). Sincronize o navegador com a API para que bots, VTTs e scripts leiam/gravem sua campanha.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadApiState}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
        </div>

        {/* Counts Grid */}
        {apiInfo && (
          <div className={`grid grid-cols-2 ${canUseGmModules ? 'sm:grid-cols-5' : 'sm:grid-cols-2'} gap-2 text-xs`}>
            {canUseGmModules && (
              <>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Notas na API</span>
                  <strong className="text-base font-black text-cyan-300">{apiInfo.counts.notes}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Desenhos SVG</span>
                  <strong className="text-base font-black text-purple-300">{apiInfo.counts.drawings}</strong>
                </div>
              </>
            )}
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 block">Pacotes</span>
              <strong className="text-base font-black text-emerald-300">{apiInfo.counts.packages}</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
              <span className="text-[10px] text-slate-400 block">Histórico</span>
              <strong className="text-base font-black text-amber-300">{apiInfo.counts.history}</strong>
            </div>
            {canUseGmModules && (
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Camadas</span>
                <strong className="text-base font-black text-slate-200">{apiInfo.counts.layers}</strong>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            disabled={syncBusy || !canWrite}
            onClick={() => handlePushToApi('replace')}
            title={!canWrite ? 'Seu nível de permissão não permite gravar dados na API' : undefined}
            className="py-2.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowUpFromLine className="w-4 h-4 shrink-0" />
            <span>Enviar App → API</span>
          </button>

          <button
            type="button"
            disabled={syncBusy}
            onClick={() => handlePullFromApi('merge')}
            className="py-2.5 px-3 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <ArrowDownToLine className="w-4 h-4 shrink-0" />
            <span>Puxar API → App (Mesclar)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadOpenApi}
            className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/15 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>OpenAPI 3.1 (.json)</span>
          </button>
        </div>
      </div>

      {/* External Knowledge Import (Obsidian & Notion - somente Mestre/Admin) */}
      {canUseGmModules && <ExternalNotesImportSection onImportSuccess={loadApiState} onNotify={notify} />}

      {/* External API Keys Management (Admin Only) */}
      <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-400" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Chaves de API para Integrações Externas
            </h3>
            <p className="text-[11px] text-slate-400">
              {isAdmin
                ? 'Gere chaves com permissões granulares para bots de Discord, Foundry/Roll20 ou scripts externos usando o cabeçalho X-API-Key.'
                : 'A criação e revogação de chaves de API externas é restrita ao Administrador.'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <>

        <form onSubmit={handleCreateKey} className="space-y-3 p-3 rounded-xl bg-black/35 border border-white/10">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Nome da integração (ex: Bot Discord, Obsidian Sync)..."
              maxLength={80}
              className="flex-1 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={creatingKey}
              className="px-4 py-2 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/50 text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gerar Chave</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {SCOPE_META.map((sc) => {
              const active = selectedScopes.includes(sc.id);
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => toggleScope(sc.id)}
                  className={`p-2 rounded-xl border text-left transition ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-100'
                      : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>{sc.label}</span>
                    {active && <Check className="w-3 h-3 text-cyan-300" />}
                  </div>
                  <p className="text-[10px] opacity-75 mt-0.5 leading-snug">{sc.desc}</p>
                </button>
              );
            })}
          </div>
        </form>

        {/* One-time plaintext reveal */}
        {newlyCreatedSecret && (
          <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-400/50 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-300">
                Nova chave gerada: {newlyCreatedSecret.name}
              </span>
              <button
                type="button"
                onClick={() => copyText(newlyCreatedSecret.apiKey, 'new-secret')}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-[11px] font-bold flex items-center gap-1"
              >
                {copiedId === 'new-secret' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'new-secret' ? 'Copiada!' : 'Copiar Chave'}</span>
              </button>
            </div>
            <code className="block p-2.5 rounded-lg bg-black/70 border border-white/10 text-xs font-mono text-emerald-200 break-all select-all">
              {newlyCreatedSecret.apiKey}
            </code>
            <p className="text-[10px] text-amber-300">
              Guarde esta chave agora. O servidor armazena apenas um hash scrypt e não exibe o valor novamente.
            </p>
          </div>
        )}

        {/* Active / Revoked Keys List */}
        {keys.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3">
            Nenhuma chave externa criada ainda.
          </p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  k.revoked
                    ? 'bg-black/25 border-white/5 opacity-55'
                    : 'bg-black/40 border-white/10'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">{k.name}</span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-cyan-300 font-mono">
                      {k.prefix}••••
                    </code>
                    {k.revoked && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                        Revogada
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
                    {k.scopes.map((s) => (
                      <span
                        key={s}
                        className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300"
                      >
                        {s}
                      </span>
                    ))}
                    <span>•</span>
                    <span>
                      {k.lastUsedAt
                        ? `Último uso: ${new Date(k.lastUsedAt).toLocaleString('pt-BR')}`
                        : 'Nunca utilizada'}
                    </span>
                  </div>
                </div>

                {!k.revoked && (
                  <button
                    type="button"
                    onClick={() => handleRevokeKey(k)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-300 hover:bg-rose-500/15 border border-rose-500/30 flex items-center gap-1 self-start sm:self-center shrink-0 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revogar</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
          </>
        )}
      </div>

      {/* Live Quick Endpoint Tester */}
      <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-purple-400" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Testador Ao Vivo da API REST v1
            </h3>
            <p className="text-[11px] text-slate-400">
              Execute chamadas reais no servidor respeitando o nível de permissão da sua conta atual.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={testingEndpoint !== null || !canRoll}
            title={!canRoll ? 'Requer permissão de rolagem (Jogador, Mestre ou Admin)' : undefined}
            onClick={() =>
              runLiveTest('roll', '/api/v1/roll', 'POST', {
                title: 'Teste API (Vantagem)',
                expression: '2d20kh1+5',
                saveToHistory: canWrite,
              })
            }
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-400/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            <span>POST /api/v1/roll</span>
          </button>

          <button
            type="button"
            disabled={testingEndpoint !== null || !canGenerate}
            title={!canGenerate ? 'Restrito a Mestre (GM) ou Administrador' : undefined}
            onClick={() =>
              runLiveTest('oracle', '/api/v1/oracle', 'POST', {
                pergunta: 'Há uma passagem secreta na biblioteca?',
                probabilidade: 'provavel',
                modificador: 5,
              })
            }
            className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-400/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            <span>POST /api/v1/oracle</span>
          </button>

          <button
            type="button"
            disabled={testingEndpoint !== null || !canUseGmModules}
            title={!canUseGmModules ? 'Restrito a Mestre (GM) ou Administrador' : undefined}
            onClick={() => runLiveTest('notes', '/api/v1/notes?limit=10', 'GET')}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            <span>GET /api/v1/notes</span>
          </button>

          <button
            type="button"
            disabled={testingEndpoint !== null || !canGenerate}
            title={!canGenerate ? 'Restrito a Mestre (GM) ou Administrador' : undefined}
            onClick={() => runLiveTest('npcs', '/api/v1/forja/npcs', 'POST', { seed: 42, count: 2 })}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            <span>POST /api/v1/forja/npcs</span>
          </button>
        </div>

        {testResult && (
          <div className="rounded-xl bg-black/70 border border-white/10 overflow-hidden">
            <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 flex items-center justify-between text-[11px] font-mono">
              <span className="text-cyan-300">{testResult.endpoint}</span>
              <span
                className={`font-bold ${
                  testResult.status >= 200 && testResult.status < 300
                    ? 'text-emerald-300'
                    : 'text-rose-400'
                }`}
              >
                HTTP {testResult.status}
              </span>
            </div>
            <pre className="p-3 text-[11px] font-mono text-slate-200 overflow-x-auto max-h-64">
              {testResult.body}
            </pre>
          </div>
        )}
      </div>

      {/* cURL Snippets */}
      <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Exemplos de Integração Externa (cURL)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-400">Base: {origin}/api/v1</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {curlExamples.map((ex) => (
            <div
              key={ex.id}
              className="rounded-xl bg-black/50 border border-white/10 p-3 space-y-2 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-200">{ex.title}</span>
                <button
                  type="button"
                  onClick={() => copyText(ex.code, ex.id)}
                  className="text-[10px] px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-300 flex items-center gap-1 transition"
                >
                  {copiedId === ex.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId === ex.id ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all bg-black/50 p-2 rounded-lg border border-white/5">
                {ex.code}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
