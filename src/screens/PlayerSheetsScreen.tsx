import {
  Check,
  Copy,
  IdCard,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  User,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CharacterSheetPanel } from '../components/map/CharacterSheetPanel';
import { apiFetch, useAuthSession } from '../lib/authSession';
import {
  createDefaultCharacterSheet,
  createDefaultSidekickSheet,
  SIDEKICK_ROLE_META,
} from '../lib/characterSheet';
import { useAppStore } from '../store/useAppStore';
import { useVttStore } from '../store/useVttStore';
import type { CharacterSheetData, PlayerSheet, PlayerSheetKind, SidekickRole } from '../types';

type KindFilter = 'all' | PlayerSheetKind;

const SIDEKICK_ROLES: SidekickRole[] = ['warrior', 'expert', 'spellcaster', 'companion'];

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return 'agora';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} d`;
}

export const PlayerSheetsScreen: React.FC = () => {
  const { user: currentUser } = useAuthSession();
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const addVttToken = useVttStore((s) => s.addToken);

  const [sheets, setSheets] = useState<PlayerSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Draft state for selected sheet
  const [draftName, setDraftName] = useState('');
  const [draftKind, setDraftKind] = useState<PlayerSheetKind>('character');
  const [draftSidekickRole, setDraftSidekickRole] = useState<SidekickRole>('warrior');
  const [draftMasterId, setDraftMasterId] = useState<string>('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftSheet, setDraftSheet] = useState<CharacterSheetData>(() =>
    createDefaultCharacterSheet()
  );

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Sidekick creator inline popover
  const [showSidekickCreator, setShowSidekickCreator] = useState(false);
  const [newSidekickRole, setNewSidekickRole] = useState<SidekickRole>('warrior');
  const [newSidekickMasterId, setNewSidekickMasterId] = useState<string>('');
  const [creating, setCreating] = useState(false);

  // Inline two-step delete confirmation & feedback
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [vttSentFeedback, setVttSentFeedback] = useState(false);

  const autoSaveTimerRef = useRef<number | null>(null);
  const hydratedIdRef = useRef<string | null>(null);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/player-sheets');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Não foi possível carregar suas fichas.');
      }
      const list: PlayerSheet[] = Array.isArray(data.items) ? data.items : [];
      setSheets(list);
      setSelectedId((prev) => {
        if (prev && list.some((item) => item.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err?.message || 'Erro de conexão ao carregar fichas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  const selectedSheet = useMemo(
    () => sheets.find((s) => s.id === selectedId) ?? null,
    [sheets, selectedId]
  );

  const ownCharacters = useMemo(
    () => sheets.filter((s) => s.kind === 'character'),
    [sheets]
  );

  // Hydrate draft whenever selected sheet changes
  useEffect(() => {
    if (!selectedSheet) {
      hydratedIdRef.current = null;
      setIsDirty(false);
      setConfirmDeleteId(null);
      return;
    }
    if (hydratedIdRef.current === selectedSheet.id) return;

    hydratedIdRef.current = selectedSheet.id;
    setDraftName(selectedSheet.name);
    setDraftKind(selectedSheet.kind);
    setDraftSidekickRole(selectedSheet.sidekickRole || 'warrior');
    setDraftMasterId(selectedSheet.masterCharacterId || '');
    setDraftNotes(selectedSheet.notes || '');
    setDraftSheet(selectedSheet.sheet);
    setIsDirty(false);
    setSaveStatus('idle');
    setSaveError(null);
    setConfirmDeleteId(null);
  }, [selectedSheet]);

  const persistDraft = useCallback(
    async (targetId: string) => {
      const trimmedName = draftName.trim();
      if (!trimmedName) {
        setSaveStatus('error');
        setSaveError('Informe um nome para a ficha antes de salvar.');
        return false;
      }
      setSaving(true);
      setSaveError(null);
      try {
        const res = await apiFetch(`/api/v1/player-sheets/${encodeURIComponent(targetId)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: trimmedName,
            kind: draftKind,
            sidekickRole: draftKind === 'sidekick' ? draftSidekickRole : null,
            masterCharacterId: draftKind === 'sidekick' ? draftMasterId || null : null,
            notes: draftNotes,
            sheet: draftSheet,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || 'Falha ao salvar a ficha.');
        }
        setSheets((prev) =>
          prev
            .map((item) => (item.id === targetId ? (data as PlayerSheet) : item))
            .sort((a, b) => b.updatedAt - a.updatedAt)
        );
        setIsDirty(false);
        setSaveStatus('saved');
        return true;
      } catch (err: any) {
        setSaveStatus('error');
        setSaveError(err?.message || 'Erro ao salvar alterações.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [draftName, draftKind, draftSidekickRole, draftMasterId, draftNotes, draftSheet]
  );

  // Debounced autosave when editing
  useEffect(() => {
    if (!isDirty || !selectedId) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      persistDraft(selectedId);
    }, 900);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirty, selectedId, persistDraft]);

  const handleSelectSheet = async (nextId: string) => {
    if (nextId === selectedId) return;
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (isDirty && selectedId) {
      await persistDraft(selectedId);
    }
    hydratedIdRef.current = null;
    setSelectedId(nextId);
  };

  const handleCreateCharacter = async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const charNumber = ownCharacters.length + 1;
      const baseSheet = createDefaultCharacterSheet();
      baseSheet.playerName = currentUser?.displayName || '';
      const res = await apiFetch('/api/v1/player-sheets', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'character',
          name: `Novo Personagem ${charNumber}`,
          notes: '',
          sheet: baseSheet,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao criar ficha de personagem.');
      }
      const created = data as PlayerSheet;
      setSheets((prev) => [created, ...prev]);
      hydratedIdRef.current = null;
      setSelectedId(created.id);
      setKindFilter('all');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o personagem.');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSidekick = async (role: SidekickRole, masterId: string) => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const meta = SIDEKICK_ROLE_META[role];
      const sidekickSheet = createDefaultSidekickSheet(role, currentUser?.displayName || '');
      const res = await apiFetch('/api/v1/player-sheets', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'sidekick',
          name: `${meta.label} Aliado`,
          sidekickRole: role,
          masterCharacterId: masterId || null,
          notes: '',
          sheet: sidekickSheet,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao criar sidekick.');
      }
      const created = data as PlayerSheet;
      setSheets((prev) => [created, ...prev]);
      hydratedIdRef.current = null;
      setSelectedId(created.id);
      setShowSidekickCreator(false);
      setKindFilter('all');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar o sidekick.');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicateSelected = async () => {
    if (!selectedSheet || creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/player-sheets', {
        method: 'POST',
        body: JSON.stringify({
          kind: draftKind,
          name: `${draftName.trim() || selectedSheet.name} (Cópia)`,
          sidekickRole: draftKind === 'sidekick' ? draftSidekickRole : undefined,
          masterCharacterId: draftKind === 'sidekick' ? draftMasterId || null : null,
          notes: draftNotes,
          sheet: draftSheet,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao duplicar ficha.');
      }
      const created = data as PlayerSheet;
      setSheets((prev) => [created, ...prev]);
      hydratedIdRef.current = null;
      setSelectedId(created.id);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível duplicar a ficha.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedSheet || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const targetId = selectedSheet.id;
      const res = await apiFetch(`/api/v1/player-sheets/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Erro ao excluir ficha.');
      }
      const remaining = sheets
        .filter((s) => s.id !== targetId)
        .map((s) =>
          s.masterCharacterId === targetId
            ? { ...s, masterCharacterId: undefined, masterCharacterName: undefined }
            : s
        );
      setSheets(remaining);
      hydratedIdRef.current = null;
      setSelectedId(remaining[0]?.id ?? null);
      setConfirmDeleteId(null);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir a ficha.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSendToVtt = () => {
    if (!selectedSheet) return;
    addVttToken({
      name: draftName.trim() || selectedSheet.name,
      faction: 'ally',
      color: draftKind === 'sidekick' ? '#a855f7' : '#22d3ee',
      avatarUrl: draftSheet.avatarUrl,
      sizeCells: 1,
      rotation: 0,
      locked: false,
      hidden: false,
      hpCurrent: draftSheet.hpCurrent,
      hpMax: draftSheet.hpMax,
      hpTemp: draftSheet.hpTemp || 0,
      ac: draftSheet.ac,
      speed: draftSheet.speed || '9m',
      initiativeMod: draftSheet.initiative || 0,
      initiativeValue: null,
      conditions: draftSheet.conditions || [],
      notes: draftNotes,
      sourceRole:
        draftKind === 'sidekick'
          ? `Sidekick · ${SIDEKICK_ROLE_META[draftSidekickRole].label}`
          : draftSheet.characterClass || 'Personagem',
      attacks: (draftSheet.attacks || []).map((atk) => ({
        id: atk.id,
        name: atk.name,
        bonus: atk.bonus,
        damage: atk.damage,
      })),
    });
    setVttSentFeedback(true);
    window.setTimeout(() => setVttSentFeedback(false), 2400);
  };

  const filteredSheets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sheets.filter((item) => {
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sheet.race.toLowerCase().includes(q) ||
        item.sheet.characterClass.toLowerCase().includes(q) ||
        (item.masterCharacterName || '').toLowerCase().includes(q)
      );
    });
  }, [sheets, kindFilter, searchQuery]);

  const characterCount = useMemo(
    () => sheets.filter((s) => s.kind === 'character').length,
    [sheets]
  );
  const sidekickCount = useMemo(
    () => sheets.filter((s) => s.kind === 'sidekick').length,
    [sheets]
  );

  return (
    <div className="space-y-4 pb-20 md:pb-8">
      {/* Header Bar */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <IdCard className="w-6 h-6 text-cyan-400 shrink-0" />
            <span>Minhas Fichas</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 tabular-nums">
            {characterCount} {characterCount === 1 ? 'personagem' : 'personagens'} · {sidekickCount}{' '}
            {sidekickCount === 1 ? 'sidekick' : 'sidekicks'}
            {currentUser?.displayName ? ` · Jogador: ${currentUser.displayName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateCharacter}
            disabled={creating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>Novo Personagem</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewSidekickMasterId(ownCharacters[0]?.id || '');
              setShowSidekickCreator((v) => !v);
            }}
            disabled={creating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-100 border border-white/15 font-medium text-xs sm:text-sm transition cursor-pointer disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4 text-purple-300" />
            <span>Novo Sidekick</span>
          </button>

          <button
            type="button"
            onClick={fetchSheets}
            disabled={loading}
            title="Atualizar lista de fichas"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Inline Sidekick Archetype Creator */}
      {showSidekickCreator && (
        <section className="rounded-xl bg-slate-950/80 border border-purple-400/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-white">Criar Sidekick com Modelo Pronto</h2>
              <p className="text-xs text-slate-400">
                Escolha o papel tático do companheiro e opcionalmente vincule-o a um dos seus personagens.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSidekickCreator(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Fechar criador de sidekick"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {SIDEKICK_ROLES.map((role) => {
              const meta = SIDEKICK_ROLE_META[role];
              const isSelected = newSidekickRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setNewSidekickRole(role)}
                  className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-purple-500/15 border-purple-400/60 text-white'
                      : 'bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{meta.label}</div>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">{meta.subtitle}</p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {ownCharacters.length > 0 ? (
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <span className="shrink-0 text-slate-400">Acompanha:</span>
                <select
                  value={newSidekickMasterId}
                  onChange={(e) => setNewSidekickMasterId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-xs text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="">Sem vínculo específico</option>
                  {ownCharacters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span className="text-xs text-slate-500">
                Você poderá vincular este sidekick a um personagem quando criar um.
              </span>
            )}

            <button
              type="button"
              onClick={() => handleCreateSidekick(newSidekickRole, newSidekickMasterId)}
              disabled={creating}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Criar {SIDEKICK_ROLE_META[newSidekickRole].label}</span>
            </button>
          </div>
        </section>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3.5 py-2.5 text-xs text-rose-200 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Split Workspace */}
      {loading && sheets.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-2">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-20 rounded-xl bg-white/[0.03] border border-white/10 animate-pulse"
              />
            ))}
          </div>
          <div className="lg:col-span-8 h-96 rounded-xl bg-white/[0.03] border border-white/10 animate-pulse" />
        </div>
      ) : sheets.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl bg-slate-950/60 border border-white/10 p-8 sm:p-12 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center mx-auto mb-4">
            <IdCard className="w-6 h-6 text-cyan-300" />
          </div>
          <h2 className="text-lg font-semibold text-white">Crie sua primeira ficha para jogar</h2>
          <p className="text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
            Monte fichas completas de Personagens e Sidekicks com atributos, ataques roláveis em 1
            clique, perícias, inventário e notas. Suas fichas ficam salvas na sua conta e disponíveis
            para o Mestre consultar na mesa.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-6">
            <button
              type="button"
              onClick={handleCreateCharacter}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Personagem</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSidekickCreator(true)}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-100 border border-white/15 font-medium text-sm transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-purple-300" />
              <span>Criar Sidekick</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Left Roster Column */}
          <aside className="lg:col-span-4 rounded-xl bg-slate-950/65 border border-white/10 overflow-hidden">
            {/* Filter & Search Header */}
            <div className="p-3 border-b border-white/10 space-y-2.5">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-black/40 border border-white/10">
                {(
                  [
                    { id: 'all', label: `Todos (${sheets.length})` },
                    { id: 'character', label: `Heróis (${characterCount})` },
                    { id: 'sidekick', label: `Sidekicks (${sidekickCount})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setKindFilter(tab.id)}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-medium transition cursor-pointer truncate ${
                      kindFilter === tab.id
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, classe ou raça..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60"
                />
              </div>
            </div>

            {/* Roster List */}
            <div className="divide-y divide-white/[0.06] max-h-[320px] lg:max-h-[calc(100vh-260px)] overflow-y-auto">
              {filteredSheets.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Nenhuma ficha encontrada com os filtros atuais.
                </div>
              ) : (
                filteredSheets.map((item) => {
                  const isActive = item.id === selectedId;
                  const hpPct =
                    item.sheet.hpMax > 0
                      ? Math.max(0, Math.min(100, Math.round((item.sheet.hpCurrent / item.sheet.hpMax) * 100)))
                      : 0;
                  const hpColor =
                    hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-rose-500';
                  const kindLabel =
                    item.kind === 'sidekick'
                      ? `Sidekick · ${SIDEKICK_ROLE_META[item.sidekickRole || 'warrior'].label}`
                      : 'Personagem';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectSheet(item.id)}
                      className={`w-full p-3 text-left transition flex items-start gap-3 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                          : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                        {item.sheet.avatarUrl ? (
                          <img
                            src={item.sheet.avatarUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : item.kind === 'sidekick' ? (
                          <Users className="w-4 h-4 text-purple-300" />
                        ) : (
                          <User className="w-4 h-4 text-cyan-300" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white truncate">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                            CA {item.sheet.ac}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          <span className={item.kind === 'sidekick' ? 'text-purple-300' : 'text-cyan-300'}>
                            {kindLabel}
                          </span>
                          {item.sheet.characterClass ? ` · ${item.sheet.characterClass}` : ''}
                          {` · Nv ${item.sheet.level}`}
                        </p>

                        {item.kind === 'sidekick' && item.masterCharacterName && (
                          <p className="text-[10px] text-slate-500 truncate mt-0.5">
                            Acompanha {item.masterCharacterName}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className={`h-full transition-all ${hpColor}`}
                              style={{ width: `${hpPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                            {item.sheet.hpCurrent}/{item.sheet.hpMax} PV
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Active Sheet Workspace */}
          <section className="lg:col-span-8 space-y-4">
            {selectedSheet ? (
              <div className="rounded-xl bg-slate-950/65 border border-white/10 p-4 space-y-4">
                {/* Sheet Top Identity & Action Bar */}
                <div className="flex flex-col gap-3 border-b border-white/10 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <input
                      type="text"
                      value={draftName}
                      onChange={(e) => {
                        setDraftName(e.target.value);
                        setIsDirty(true);
                        setSaveStatus('idle');
                      }}
                      placeholder="Nome do personagem ou sidekick"
                      aria-label="Nome da ficha"
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-black/45 border border-white/15 text-base sm:text-lg font-bold text-white focus:outline-none focus:border-cyan-400"
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => persistDraft(selectedSheet.id)}
                        disabled={saving || !isDirty}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isDirty
                            ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                            : 'bg-white/5 text-slate-400 border border-white/10'
                        } disabled:opacity-60`}
                      >
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : saveStatus === 'saved' && !isDirty ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {saving
                            ? 'Salvando...'
                            : isDirty
                            ? 'Salvar'
                            : saveStatus === 'saved'
                            ? 'Salvo'
                            : 'Sincronizado'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSendToVtt}
                        title="Enviar esta ficha como token aliado no Tabuleiro VTT"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-medium transition cursor-pointer"
                      >
                        <Swords className="w-3.5 h-3.5 text-cyan-300" />
                        <span className="hidden sm:inline">
                          {vttSentFeedback ? 'No VTT!' : 'Enviar ao VTT'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDuplicateSelected}
                        disabled={creating}
                        title="Duplicar ficha"
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {confirmDeleteId === selectedSheet.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handleDeleteSelected}
                            disabled={deleting}
                            className="px-2.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
                          >
                            {deleting ? '...' : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs cursor-pointer"
                            aria-label="Cancelar exclusão"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(selectedSheet.id)}
                          title="Excluir ficha"
                          className="p-2 rounded-lg bg-white/5 hover:bg-rose-500/15 text-slate-400 hover:text-rose-300 border border-white/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Sheet Kind, Sidekick Role & Master Character Link */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="inline-flex rounded-lg bg-black/40 border border-white/10 p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (draftKind !== 'character') {
                            setDraftKind('character');
                            setIsDirty(true);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                          draftKind === 'character'
                            ? 'bg-cyan-500/20 text-cyan-200'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Personagem
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (draftKind !== 'sidekick') {
                            setDraftKind('sidekick');
                            setIsDirty(true);
                          }
                        }}
                        className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                          draftKind === 'sidekick'
                            ? 'bg-purple-500/25 text-purple-200'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Sidekick
                      </button>
                    </div>

                    {draftKind === 'sidekick' && (
                      <>
                        <label className="inline-flex items-center gap-1.5 text-slate-400">
                          <span>Papel:</span>
                          <select
                            value={draftSidekickRole}
                            onChange={(e) => {
                              setDraftSidekickRole(e.target.value as SidekickRole);
                              setIsDirty(true);
                            }}
                            className="px-2 py-1 rounded-md bg-black/45 border border-white/15 text-xs text-white focus:outline-none focus:border-purple-400"
                          >
                            {SIDEKICK_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {SIDEKICK_ROLE_META[role].label}
                              </option>
                            ))}
                          </select>
                        </label>

                        {ownCharacters.filter((c) => c.id !== selectedSheet.id).length > 0 && (
                          <label className="inline-flex items-center gap-1.5 text-slate-400">
                            <span>Acompanha:</span>
                            <select
                              value={draftMasterId}
                              onChange={(e) => {
                                setDraftMasterId(e.target.value);
                                setIsDirty(true);
                              }}
                              className="px-2 py-1 rounded-md bg-black/45 border border-white/15 text-xs text-white focus:outline-none focus:border-purple-400"
                            >
                              <option value="">Sem vínculo</option>
                              {ownCharacters
                                .filter((c) => c.id !== selectedSheet.id)
                                .map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                        )}
                      </>
                    )}

                    <span className="ml-auto text-[11px] text-slate-500 tabular-nums">
                      Atualizado há {formatRelativeTime(selectedSheet.updatedAt)}
                    </span>
                  </div>

                  {vttSentFeedback && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-cyan-500/10 border border-cyan-400/30 px-3 py-2 text-xs text-cyan-200">
                      <span>Token adicionado à cena ativa do Tabuleiro VTT.</span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('vtt')}
                        className="font-semibold underline hover:text-white cursor-pointer"
                      >
                        Abrir Tabuleiro VTT
                      </button>
                    </div>
                  )}

                  {saveError && (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-200">
                      {saveError}
                    </div>
                  )}
                </div>

                {/* Full Interactive Character Sheet Panel (with 1-click dice rolls) */}
                <CharacterSheetPanel
                  value={draftSheet}
                  characterName={draftName || selectedSheet.name}
                  onChange={(nextSheet) => {
                    setDraftSheet(nextSheet);
                    setIsDirty(true);
                    setSaveStatus('idle');
                  }}
                />

                {/* Biography & Session Notes */}
                <div className="space-y-1.5 pt-1">
                  <label
                    htmlFor="player-sheet-notes"
                    className="flex items-center justify-between text-xs font-medium text-slate-300"
                  >
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-cyan-400" />
                      História, Personalidade & Anotações de Sessão
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Visível para o Mestre explorar no Mapa de Notas
                    </span>
                  </label>
                  <textarea
                    id="player-sheet-notes"
                    value={draftNotes}
                    onChange={(e) => {
                      setDraftNotes(e.target.value);
                      setIsDirty(true);
                      setSaveStatus('idle');
                    }}
                    rows={5}
                    placeholder="Escreva a história do personagem, vínculos, objetivos, aparência ou notas da sessão..."
                    className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60 resize-y"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-950/65 border border-white/10 p-10 text-center text-sm text-slate-400">
                Selecione uma ficha na lista à esquerda para visualizar e jogar.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
