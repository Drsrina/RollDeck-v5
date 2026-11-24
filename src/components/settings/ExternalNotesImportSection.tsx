import JSZip from 'jszip';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Database,
  FileArchive,
  FileText,
  FolderUp,
  Layers,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { saveLinks, saveNotes } from '../../db/indexedDB';
import { apiFetch, hasScope, useAuthSession } from '../../lib/authSession';
import { useAppStore } from '../../store/useAppStore';
import { useMapStore } from '../../store/useMapStore';
import type { NoteLink, NoteNode } from '../../types';

interface ExternalNotesImportSectionProps {
  onImportSuccess?: () => void;
  onNotify?: (type: 'ok' | 'err', text: string) => void;
}

interface QueuedObsidianFile {
  filename: string;
  content: string;
}

interface NotionSearchItem {
  id: string;
  object: 'page' | 'database';
  title: string;
  icon?: string;
  lastEditedTime?: string;
}

const MAX_OBSIDIAN_FILES = 250;
const MAX_FILE_BYTES = 100_000;

export const ExternalNotesImportSection: React.FC<ExternalNotesImportSectionProps> = ({
  onImportSuccess,
  onNotify,
}) => {
  const { user: currentUser } = useAuthSession();
  const canWrite = hasScope(currentUser, 'write');
  const { refreshFromDB, setActiveTab } = useAppStore();
  const layers = useMapStore((s) => s.layers);

  const defaultLayerId = layers[0]?.id || 'layer-locations';
  const [targetLayerId, setTargetLayerId] = useState<string>(defaultLayerId);
  const [importMode, setImportMode] = useState<'merge' | 'create'>('merge');

  useEffect(() => {
    if (layers.length > 0 && !layers.some((l) => l.id === targetLayerId)) {
      setTargetLayerId(layers[0].id);
    }
  }, [layers, targetLayerId]);

  // ---------------- Obsidian State ----------------
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [queuedFiles, setQueuedFiles] = useState<QueuedObsidianFile[]>([]);
  const [parsingFiles, setParsingFiles] = useState(false);
  const [importingObsidian, setImportingObsidian] = useState(false);
  const [obsidianSummary, setObsidianSummary] = useState<{
    created: number;
    updated: number;
    links: number;
  } | null>(null);

  // ---------------- Notion State ----------------
  const [notionStatus, setNotionStatus] = useState<{ checked: boolean; configured: boolean }>({
    checked: false,
    configured: false,
  });
  const [notionQuery, setNotionQuery] = useState('');
  const [notionTypeFilter, setNotionTypeFilter] = useState<'all' | 'page' | 'database'>('all');
  const [notionItems, setNotionItems] = useState<NotionSearchItem[]>([]);
  const [selectedNotionPageIds, setSelectedNotionPageIds] = useState<string[]>([]);
  const [selectedNotionDbId, setSelectedNotionDbId] = useState<string | null>(null);
  const [searchingNotion, setSearchingNotion] = useState(false);
  const [importingNotion, setImportingNotion] = useState(false);
  const [notionSummary, setNotionSummary] = useState<{
    created: number;
    updated: number;
    links: number;
  } | null>(null);

  const notify = (type: 'ok' | 'err', text: string) => {
    if (onNotify) onNotify(type, text);
  };

  const syncImportedToLocalMap = async (notes: NoteNode[], links: NoteLink[]) => {
    if (notes.length > 0) {
      await saveNotes(notes);
    }
    if (links.length > 0) {
      await saveLinks(links);
    }
    await refreshFromDB();
    if (onImportSuccess) onImportSuccess();
  };

  // Check Notion server status on mount
  const loadNotionStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/integrations/notion/status');
      if (res.ok) {
        const data = await res.json();
        setNotionStatus({ checked: true, configured: Boolean(data.configured) });
      } else {
        setNotionStatus({ checked: true, configured: false });
      }
    } catch {
      setNotionStatus({ checked: true, configured: false });
    }
  }, []);

  useEffect(() => {
    loadNotionStatus();
  }, [loadNotionStatus]);

  // Handle selecting .md or .zip files from Obsidian vault
  const handleObsidianFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setParsingFiles(true);
    setObsidianSummary(null);
    const collected: QueuedObsidianFile[] = [];
    let skipped = 0;

    try {
      for (const file of Array.from(fileList)) {
        if (collected.length >= MAX_OBSIDIAN_FILES) break;
        const lower = file.name.toLowerCase();

        if (lower.endsWith('.zip')) {
          const zip = await JSZip.loadAsync(file);
          const entries = Object.values(zip.files);
          for (const entry of entries) {
            if (collected.length >= MAX_OBSIDIAN_FILES) break;
            if (entry.dir) continue;
            const entryName = entry.name.replace(/\\/g, '/');
            if (
              entryName.includes('__MACOSX/') ||
              entryName.startsWith('.') ||
              entryName.includes('/.')
            ) {
              continue;
            }
            if (!/\.(md|markdown)$/i.test(entryName)) continue;

            const text = await entry.async('string');
            if (text.length > MAX_FILE_BYTES) {
              skipped += 1;
              continue;
            }
            collected.push({ filename: entryName, content: text });
          }
        } else if (/\.(md|markdown|txt)$/i.test(lower)) {
          const text = await file.text();
          if (text.length > MAX_FILE_BYTES) {
            skipped += 1;
            continue;
          }
          collected.push({ filename: file.name, content: text });
        }
      }

      setQueuedFiles(collected);
      if (collected.length === 0) {
        notify('err', 'Nenhum arquivo Markdown (.md) válido foi encontrado na seleção.');
      } else if (skipped > 0) {
        notify(
          'ok',
          `${collected.length} notas prontas para importar (${skipped} ignoradas por excederem 100 KB).`
        );
      }
    } catch {
      notify('err', 'Falha ao ler os arquivos selecionados. Verifique se o .zip ou .md está íntegro.');
    } finally {
      setParsingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportObsidian = async () => {
    if (queuedFiles.length === 0 || !canWrite) return;
    setImportingObsidian(true);
    try {
      const res = await apiFetch('/api/v1/integrations/obsidian/import', {
        method: 'POST',
        body: JSON.stringify({
          layerId: targetLayerId,
          mode: importMode,
          files: queuedFiles,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Erro ao importar notas do Obsidian.');
        return;
      }

      await syncImportedToLocalMap(data.notes || [], data.links || []);
      setObsidianSummary({
        created: data.createdCount || 0,
        updated: data.updatedCount || 0,
        links: data.linksCreatedCount || 0,
      });
      setQueuedFiles([]);
      notify(
        'ok',
        `Obsidian importado: ${data.createdCount} criadas, ${data.updatedCount} atualizadas e ${data.linksCreatedCount} conexões [[wiki-links]].`
      );
    } catch {
      notify('err', 'Erro de rede ao enviar notas do Obsidian para a API.');
    } finally {
      setImportingObsidian(false);
    }
  };

  const handleSearchNotion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchingNotion(true);
    setNotionSummary(null);
    try {
      const params = new URLSearchParams();
      if (notionQuery.trim()) params.set('q', notionQuery.trim());
      if (notionTypeFilter !== 'all') params.set('type', notionTypeFilter);
      const qs = params.toString();

      const res = await apiFetch(`/api/v1/integrations/notion/search${qs ? `?${qs}` : ''}`);
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Não foi possível buscar páginas no Notion.');
        return;
      }
      setNotionItems(Array.isArray(data.items) ? data.items : []);
      if (!data.items || data.items.length === 0) {
        notify('err', 'Nenhuma página ou database compartilhado encontrado para essa busca.');
      }
    } catch {
      notify('err', 'Erro de rede ao consultar o Notion pelo servidor.');
    } finally {
      setSearchingNotion(false);
    }
  };

  const toggleNotionItem = (item: NotionSearchItem) => {
    if (item.object === 'database') {
      setSelectedNotionDbId((prev) => (prev === item.id ? null : item.id));
    } else {
      setSelectedNotionPageIds((prev) =>
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
      );
    }
  };

  const handleImportNotion = async () => {
    if (!canWrite || (!selectedNotionDbId && selectedNotionPageIds.length === 0)) return;
    setImportingNotion(true);
    try {
      const res = await apiFetch('/api/v1/integrations/notion/import', {
        method: 'POST',
        body: JSON.stringify({
          layerId: targetLayerId,
          mode: importMode,
          ...(selectedNotionDbId ? { databaseId: selectedNotionDbId } : {}),
          ...(selectedNotionPageIds.length > 0 ? { pageIds: selectedNotionPageIds } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify('err', data.message || 'Erro ao importar páginas do Notion.');
        return;
      }

      await syncImportedToLocalMap(data.notes || [], data.links || []);
      setNotionSummary({
        created: data.createdCount || 0,
        updated: data.updatedCount || 0,
        links: data.linksCreatedCount || 0,
      });
      setSelectedNotionDbId(null);
      setSelectedNotionPageIds([]);
      notify(
        'ok',
        `Notion importado: ${data.createdCount} criadas, ${data.updatedCount} atualizadas e ${data.linksCreatedCount} conexões.`
      );
    } catch {
      notify('err', 'Erro de rede ao importar do Notion.');
    } finally {
      setImportingNotion(false);
    }
  };

  const detectedWikiLinksCount = queuedFiles.reduce((acc, f) => {
    const matches = f.content.match(/\[\[[^\]]+\]\]/g);
    return acc + (matches ? matches.length : 0);
  }, 0);

  return (
    <div className="rounded-2xl glass-panel p-4 border border-white/10 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-purple-400 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Importar Notas do Obsidian &amp; Notion
            </h3>
            <p className="text-[11px] text-slate-400">
              Traga seu cofre do Obsidian (.md / .zip) ou páginas do Notion diretamente para o Mapa de Notas com conexões automáticas.
            </p>
          </div>
        </div>

        {/* Destino comum: Camada e Modo */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-black/45 px-2.5 py-1.5 rounded-xl border border-white/10">
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={targetLayerId}
              onChange={(e) => setTargetLayerId(e.target.value)}
              className="bg-transparent text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
              title="Camada de destino no Mapa"
            >
              {layers.length > 0 ? (
                layers.map((layer) => (
                  <option key={layer.id} value={layer.id} className="bg-slate-900">
                    {layer.name}
                  </option>
                ))
              ) : (
                <option value="layer-locations" className="bg-slate-900">
                  Locais (Padrão)
                </option>
              )}
            </select>
          </div>

          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as 'merge' | 'create')}
            className="bg-black/45 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer"
            title="Modo de importação"
          >
            <option value="merge" className="bg-slate-900">Mesclar por título</option>
            <option value="create" className="bg-slate-900">Sempre criar novas</option>
          </select>
        </div>
      </div>

      {!canWrite && (
        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
          <span>Apenas usuários com permissão de escrita (Mestre ou Admin) podem importar notas externas.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ==================== OBSIDIAN ==================== */}
        <div className="p-4 rounded-xl bg-black/40 border border-purple-500/25 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  <FileArchive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Obsidian (Cofre .zip ou .md)</h4>
                  <p className="text-[11px] text-slate-400">
                    Lê frontmatter YAML, #tags, categorias RPG e conecta [[wiki-links]] automaticamente.
                  </p>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".md,.markdown,.zip"
              onChange={handleObsidianFilesSelected}
              className="hidden"
            />

            <button
              type="button"
              disabled={!canWrite || parsingFiles}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-xl border border-dashed border-purple-400/45 bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {parsingFiles ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderUp className="w-4 h-4" />
              )}
              <span>
                {parsingFiles
                  ? 'Lendo arquivos do cofre...'
                  : 'Selecionar arquivos .md ou cofre .zip'}
              </span>
            </button>

            {queuedFiles.length > 0 && (
              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    {queuedFiles.length} {queuedFiles.length === 1 ? 'nota pronta' : 'notas prontas'}
                  </span>
                  <span className="text-[11px] font-mono text-cyan-300 flex items-center gap-1">
                    <Link2 className="w-3 h-3" />
                    {detectedWikiLinksCount} wiki-links
                  </span>
                </div>

                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 text-[11px] font-mono text-slate-300">
                  {queuedFiles.slice(0, 8).map((f, i) => (
                    <div key={`${f.filename}-${i}`} className="truncate">
                      • {f.filename}
                    </div>
                  ))}
                  {queuedFiles.length > 8 && (
                    <div className="text-slate-500">+{queuedFiles.length - 8} outros arquivos...</div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={importingObsidian || !canWrite}
                    onClick={handleImportObsidian}
                    className="flex-1 py-2 px-3 rounded-lg bg-purple-500 hover:bg-purple-400 text-black font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {importingObsidian ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{importingObsidian ? 'Importando...' : 'Importar para o Mapa'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQueuedFiles([])}
                    className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}

            {obsidianSummary && (
              <div className="p-2.5 rounded-xl bg-emerald-950/35 border border-emerald-500/35 text-[11px] text-emerald-200 flex items-center justify-between gap-2">
                <span>
                  <Check className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                  {obsidianSummary.created} criadas · {obsidianSummary.updated} atualizadas · {obsidianSummary.links} links
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('map')}
                  className="text-cyan-300 font-bold hover:underline shrink-0 cursor-pointer"
                >
                  Abrir Mapa &rarr;
                </button>
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-white/5">
            Dica: você também pode enviar notas direto do Obsidian (via script/plugin) para{' '}
            <code className="text-purple-300">POST /api/v1/integrations/obsidian/import</code> usando sua{' '}
            <code className="text-cyan-300">X-API-Key</code>.
          </p>
        </div>

        {/* ==================== NOTION ==================== */}
        <div className="p-4 rounded-xl bg-black/40 border border-cyan-500/25 space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Notion (Conector de Servidor)</h4>
                  <p className="text-[11px] text-slate-400">
                    Busca páginas e databases compartilhados via API oficial e converte blocos e menções em notas.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadNotionStatus}
                title="Verificar status da conexão Notion no servidor"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {!notionStatus.checked ? (
              <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>Verificando conector Notion no servidor...</span>
              </div>
            ) : !notionStatus.configured ? (
              <div className="p-3 rounded-xl bg-slate-900/70 border border-white/10 space-y-2 text-[11px] text-slate-300">
                <div className="font-bold text-amber-300">
                  Variável NOTION_API_KEY ainda não configurada no servidor
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Por segurança, a chave do Notion fica apenas no servidor. Para ativar:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>Crie uma integração interna em Notion Integrations e copie o token.</li>
                  <li>Adicione <code className="text-cyan-300">NOTION_API_KEY</code> nos segredos/ambiente do servidor.</li>
                  <li>No Notion, use <em>Conexões &rarr; Adicionar conexão</em> nas páginas ou databases da campanha.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5">
                <form onSubmit={handleSearchNotion} className="flex gap-2">
                  <input
                    type="text"
                    value={notionQuery}
                    onChange={(e) => setNotionQuery(e.target.value)}
                    placeholder="Buscar página ou database no Notion..."
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                  <select
                    value={notionTypeFilter}
                    onChange={(e) => setNotionTypeFilter(e.target.value as 'all' | 'page' | 'database')}
                    className="px-2 py-1.5 rounded-xl bg-black/60 border border-white/15 text-xs text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900">Tudo</option>
                    <option value="page" className="bg-slate-900">Páginas</option>
                    <option value="database" className="bg-slate-900">Databases</option>
                  </select>
                  <button
                    type="submit"
                    disabled={searchingNotion}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {searchingNotion ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Buscar</span>
                  </button>
                </form>

                {notionItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {notionItems.map((item) => {
                        const isSelected =
                          item.object === 'database'
                            ? selectedNotionDbId === item.id
                            : selectedNotionPageIds.includes(item.id);

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleNotionItem(item)}
                            className={`w-full p-2 rounded-lg border text-left text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400/50 text-white'
                                : 'bg-black/40 border-white/10 text-slate-300 hover:bg-white/5'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0">
                                {item.icon || (item.object === 'database' ? '🗂️' : '📄')}
                              </span>
                              <span className="truncate font-semibold">{item.title}</span>
                            </div>
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-300 shrink-0">
                              {item.object === 'database' ? 'DB' : 'Página'}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={
                        importingNotion ||
                        !canWrite ||
                        (!selectedNotionDbId && selectedNotionPageIds.length === 0)
                      }
                      onClick={handleImportNotion}
                      className="w-full py-2 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {importingNotion ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {importingNotion
                          ? 'Importando do Notion...'
                          : `Importar Selecionados (${
                              selectedNotionPageIds.length + (selectedNotionDbId ? 1 : 0)
                            })`}
                      </span>
                    </button>
                  </div>
                )}

                {notionSummary && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/35 border border-emerald-500/35 text-[11px] text-emerald-200 flex items-center justify-between gap-2">
                    <span>
                      <Check className="w-3.5 h-3.5 inline mr-1 text-emerald-400" />
                      {notionSummary.created} criadas · {notionSummary.updated} atualizadas · {notionSummary.links} links
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('map')}
                      className="text-cyan-300 font-bold hover:underline shrink-0 cursor-pointer"
                    >
                      Abrir Mapa &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-[10px] text-slate-500 leading-relaxed pt-2 border-t border-white/5">
            Endpoints REST: <code className="text-cyan-300">GET /api/v1/integrations/notion/search</code> e{' '}
            <code className="text-cyan-300">POST /api/v1/integrations/notion/import</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
