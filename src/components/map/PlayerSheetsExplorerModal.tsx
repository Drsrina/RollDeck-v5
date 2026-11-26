import {
  Check,
  Crosshair,
  Heart,
  IdCard,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Shield,
  Swords,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/authSession';
import {
  ATTRIBUTE_META,
  calcAttributeModifier,
  formatModifier,
  SIDEKICK_ROLE_META,
} from '../../lib/characterSheet';
import { useMapStore } from '../../store/useMapStore';
import { useVttStore } from '../../store/useVttStore';
import type { PlayerSheet, PlayerSheetKind } from '../../types';

type ExplorerKindFilter = 'all' | PlayerSheetKind;

function buildMapBodyFromPlayerSheet(sheet: PlayerSheet): string {
  const headerLines = [
    `> **Criado por:** ${sheet.ownerDisplayName} (@${sheet.ownerUsername})`,
    sheet.kind === 'sidekick'
      ? `> **Tipo:** Sidekick (${SIDEKICK_ROLE_META[sheet.sidekickRole || 'warrior'].label})${
          sheet.masterCharacterName ? ` · Acompanha **${sheet.masterCharacterName}**` : ''
        }`
      : '> **Tipo:** Personagem de Jogador',
  ];

  const notesBlock = sheet.notes?.trim() ? `\n\n${sheet.notes.trim()}` : '';
  return `${headerLines.join('\n')}${notesBlock}`;
}

export const PlayerSheetsExplorerModal: React.FC = () => {
  const isOpen = useMapStore((s) => s.isPlayerSheetsExplorerOpen);
  const setOpen = useMapStore((s) => s.setPlayerSheetsExplorerOpen);
  const notes = useMapStore((s) => s.notes);
  const viewState = useMapStore((s) => s.viewState);
  const canvasViewport = useMapStore((s) => s.canvasViewport);
  const createNoteAt = useMapStore((s) => s.createNoteAt);
  const saveNoteData = useMapStore((s) => s.saveNoteData);
  const selectNode = useMapStore((s) => s.selectNode);
  const focusCameraOn = useMapStore((s) => s.focusCameraOn);

  const addVttToken = useVttStore((s) => s.addToken);

  const [sheets, setSheets] = useState<PlayerSheet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<ExplorerKindFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadSheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/player-sheets');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Não foi possível carregar as fichas dos usuários.');
      }
      const list: PlayerSheet[] = Array.isArray(data.items) ? data.items : [];
      setSheets(list);
      setSelectedId((prev) => {
        if (prev && list.some((item) => item.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err?.message || 'Erro ao consultar fichas criadas pelos jogadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setActionMessage(null);
    loadSheets();
  }, [isOpen, loadSheets]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, setOpen]);

  const distinctOwners = useMemo(() => {
    const map = new Map<string, { id: string; username: string; displayName: string; count: number }>();
    for (const s of sheets) {
      const prev = map.get(s.ownerUserId);
      if (prev) {
        prev.count += 1;
      } else {
        map.set(s.ownerUserId, {
          id: s.ownerUserId,
          username: s.ownerUsername,
          displayName: s.ownerDisplayName,
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
  }, [sheets]);

  const filteredSheets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sheets.filter((s) => {
      if (kindFilter !== 'all' && s.kind !== kindFilter) return false;
      if (ownerFilter !== 'all' && s.ownerUserId !== ownerFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.ownerDisplayName.toLowerCase().includes(q) ||
        s.ownerUsername.toLowerCase().includes(q) ||
        s.sheet.race.toLowerCase().includes(q) ||
        s.sheet.characterClass.toLowerCase().includes(q)
      );
    });
  }, [sheets, kindFilter, ownerFilter, searchQuery]);

  const selectedSheet = useMemo(
    () =>
      filteredSheets.find((s) => s.id === selectedId) ??
      sheets.find((s) => s.id === selectedId) ??
      filteredSheets[0] ??
      null,
    [filteredSheets, sheets, selectedId]
  );

  const mapNodeByPlayerSheetId = useMemo(() => {
    const map = new Map<string, (typeof notes)[number]>();
    for (const note of notes) {
      if (note.sourcePlayerSheetId) {
        map.set(note.sourcePlayerSheetId, note);
      }
    }
    return map;
  }, [notes]);

  if (!isOpen) return null;

  const existingMapNode = selectedSheet ? mapNodeByPlayerSheetId.get(selectedSheet.id) : undefined;

  const handleAddOrSyncToMap = async (sheet: PlayerSheet) => {
    setActionBusy(true);
    setActionMessage(null);
    try {
      const existing = mapNodeByPlayerSheetId.get(sheet.id);
      const body = buildMapBodyFromPlayerSheet(sheet);

      if (existing) {
        await saveNoteData({
          ...existing,
          title: sheet.name,
          body,
          category: 'character',
          characterSheet: structuredClone(sheet.sheet),
          sheetKind: sheet.kind,
          ownerUsername: sheet.ownerUsername,
          ownerDisplayName: sheet.ownerDisplayName,
        });
        selectNode(existing.id);
        setActionMessage(`Ficha "${sheet.name}" atualizada no Mapa de Notas.`);
      } else {
        // Compute current canvas viewport center in world coordinates
        const centerWorldX = (canvasViewport.width / 2 - viewState.panX) / (viewState.zoom || 1);
        const centerWorldY = (canvasViewport.height / 2 - viewState.panY) / (viewState.zoom || 1);
        // Slight offset if multiple nodes already exist nearby
        const jitterX = ((notes.length % 5) - 2) * 32;
        const jitterY = ((Math.floor(notes.length / 5) % 3) - 1) * 32;

        const tags = [
          'ficha',
          sheet.kind === 'sidekick' ? 'sidekick' : 'personagem',
          sheet.ownerUsername,
        ];

        const created = await createNoteAt(
          centerWorldX + jitterX,
          centerWorldY + jitterY,
          'layer-npcs',
          sheet.name,
          body,
          {
            category: 'character',
            characterSheet: structuredClone(sheet.sheet),
            tags,
            sourcePlayerSheetId: sheet.id,
            sheetKind: sheet.kind,
            ownerUsername: sheet.ownerUsername,
            ownerDisplayName: sheet.ownerDisplayName,
            openAfterCreate: false,
          }
        );
        focusCameraOn(created.x, created.y);
        setActionMessage(`Ficha "${sheet.name}" adicionada ao Mapa de Notas.`);
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleFocusOnMap = (sheet: PlayerSheet) => {
    const existing = mapNodeByPlayerSheetId.get(sheet.id);
    if (!existing) return;
    selectNode(existing.id);
    focusCameraOn(existing.x, existing.y, Math.max(viewState.zoom, 1));
    setOpen(false);
  };

  const handleSendToVtt = (sheet: PlayerSheet) => {
    addVttToken({
      name: sheet.name,
      faction: 'ally',
      color: sheet.kind === 'sidekick' ? '#a855f7' : '#22d3ee',
      avatarUrl: sheet.sheet.avatarUrl,
      sizeCells: 1,
      rotation: 0,
      locked: false,
      hidden: false,
      hpCurrent: sheet.sheet.hpCurrent,
      hpMax: sheet.sheet.hpMax,
      hpTemp: sheet.sheet.hpTemp || 0,
      ac: sheet.sheet.ac,
      speed: sheet.sheet.speed || '9m',
      initiativeMod: sheet.sheet.initiative || 0,
      initiativeValue: null,
      conditions: sheet.sheet.conditions || [],
      notes: sheet.notes,
      sourceRole:
        sheet.kind === 'sidekick'
          ? `Sidekick · ${SIDEKICK_ROLE_META[sheet.sidekickRole || 'warrior'].label} (@${sheet.ownerUsername})`
          : `${sheet.sheet.characterClass || 'Personagem'} (@${sheet.ownerUsername})`,
      attacks: (sheet.sheet.attacks || []).map((atk) => ({
        id: atk.id,
        name: atk.name,
        bonus: atk.bonus,
        damage: atk.damage,
      })),
    });
    setActionMessage(`Token de "${sheet.name}" enviado para a cena ativa do Tabuleiro VTT.`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Explorar fichas criadas pelos jogadores"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl h-[88vh] max-h-[780px] rounded-2xl bg-[#0d0c18] border border-white/15 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <header className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="truncate">Fichas dos Jogadores</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {sheets.length} {sheets.length === 1 ? 'ficha registrada' : 'fichas registradas'} por{' '}
              {distinctOwners.length} {distinctOwners.length === 1 ? 'usuário' : 'usuários'} ·
              Explore, inspecione ou traga para o Mapa de Notas
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={loadSheets}
              disabled={loading}
              title="Recarregar fichas dos jogadores"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar explorador de fichas"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Body Split Pane */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left Filter & List Pane */}
          <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-white/10 flex flex-col min-h-0 max-h-[38vh] md:max-h-none">
            <div className="p-3 border-b border-white/10 space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, classe ou jogador..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/45 border border-white/10 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-black/45 border border-white/10 flex-1">
                  {(
                    [
                      { id: 'all', label: 'Todos' },
                      { id: 'character', label: 'Heróis' },
                      { id: 'sidekick', label: 'Sidekicks' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setKindFilter(item.id)}
                      className={`py-1 px-1.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                        kindFilter === item.id
                          ? 'bg-cyan-500/20 text-cyan-200'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {distinctOwners.length > 0 && (
                  <select
                    value={ownerFilter}
                    onChange={(e) => setOwnerFilter(e.target.value)}
                    aria-label="Filtrar por jogador"
                    className="max-w-[140px] px-2 py-1.5 rounded-lg bg-black/45 border border-white/10 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-400"
                  >
                    <option value="all">Todos usuários</option>
                    {distinctOwners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.displayName} ({owner.count})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/[0.06]">
              {loading && sheets.length === 0 ? (
                <div className="p-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Carregando fichas dos jogadores...</span>
                </div>
              ) : error ? (
                <div className="p-4 text-xs text-rose-300">{error}</div>
              ) : filteredSheets.length === 0 ? (
                <div className="p-6 text-center space-y-1.5">
                  <IdCard className="w-7 h-7 text-slate-600 mx-auto" />
                  <p className="text-xs font-medium text-slate-300">
                    {sheets.length === 0
                      ? 'Nenhuma ficha de jogador criada ainda'
                      : 'Nenhuma ficha corresponde aos filtros'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {sheets.length === 0
                      ? 'Quando usuários com papel Jogador criarem personagens ou sidekicks no menu Minhas Fichas, eles aparecerão aqui.'
                      : 'Tente limpar a busca ou trocar o filtro de tipo/usuário.'}
                  </p>
                </div>
              ) : (
                filteredSheets.map((item) => {
                  const isActive = selectedSheet?.id === item.id;
                  const onMap = mapNodeByPlayerSheetId.has(item.id);
                  const kindText =
                    item.kind === 'sidekick'
                      ? `Sidekick · ${SIDEKICK_ROLE_META[item.sidekickRole || 'warrior'].label}`
                      : 'Personagem';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(item.id);
                        setActionMessage(null);
                      }}
                      className={`w-full p-3 text-left transition flex items-start gap-3 cursor-pointer ${
                        isActive
                          ? 'bg-cyan-500/10 border-l-2 border-l-cyan-400'
                          : 'hover:bg-white/[0.04] border-l-2 border-l-transparent'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
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
                          {onMap && (
                            <span className="text-[10px] font-medium text-emerald-300 shrink-0">
                              No Mapa
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          <span className={item.kind === 'sidekick' ? 'text-purple-300' : 'text-cyan-300'}>
                            {kindText}
                          </span>
                          {item.sheet.characterClass ? ` · ${item.sheet.characterClass}` : ''}
                          {` · Nv ${item.sheet.level}`}
                        </p>

                        <div className="flex items-center justify-between gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="truncate">
                            {item.ownerDisplayName} (@{item.ownerUsername})
                          </span>
                          <span className="font-mono tabular-nums shrink-0 text-slate-400">
                            PV {item.sheet.hpCurrent}/{item.sheet.hpMax} · CA {item.sheet.ac}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Inspection & Map Import Pane */}
          <div className="md:col-span-7 flex flex-col min-h-0">
            {selectedSheet ? (
              <>
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {/* Identity Summary */}
                  <div className="flex items-start gap-3.5 pb-4 border-b border-white/10">
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/15 overflow-hidden flex items-center justify-center shrink-0">
                      {selectedSheet.sheet.avatarUrl ? (
                        <img
                          src={selectedSheet.sheet.avatarUrl}
                          alt={selectedSheet.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : selectedSheet.kind === 'sidekick' ? (
                        <Users className="w-6 h-6 text-purple-300" />
                      ) : (
                        <User className="w-6 h-6 text-cyan-300" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-white truncate">{selectedSheet.name}</h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {selectedSheet.kind === 'sidekick'
                          ? `Sidekick ${SIDEKICK_ROLE_META[selectedSheet.sidekickRole || 'warrior'].label}`
                          : 'Personagem'}
                        {selectedSheet.sheet.race ? ` · ${selectedSheet.sheet.race}` : ''}
                        {selectedSheet.sheet.characterClass ? ` · ${selectedSheet.sheet.characterClass}` : ''}
                        {` · Nível ${selectedSheet.sheet.level}`}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Criado por <span className="text-slate-200 font-medium">{selectedSheet.ownerDisplayName}</span>{' '}
                        <span className="font-mono text-slate-500">@{selectedSheet.ownerUsername}</span>
                        {selectedSheet.kind === 'sidekick' && selectedSheet.masterCharacterName && (
                          <span> · Acompanha {selectedSheet.masterCharacterName}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Vital Stats Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-400" /> Pontos de Vida
                      </div>
                      <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                        {selectedSheet.sheet.hpCurrent}/{selectedSheet.sheet.hpMax}
                        {selectedSheet.sheet.hpTemp > 0 && (
                          <span className="text-xs text-cyan-300 ml-1">
                            +{selectedSheet.sheet.hpTemp}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-cyan-400" /> Classe Armadura
                      </div>
                      <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                        {selectedSheet.sheet.ac}
                      </div>
                    </div>

                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Zap className="w-3 h-3 text-amber-400" /> Iniciativa
                      </div>
                      <div className="text-base font-bold text-white font-mono tabular-nums mt-0.5">
                        {formatModifier(selectedSheet.sheet.initiative)}
                      </div>
                    </div>

                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">
                        Desloc. · Prof.
                      </div>
                      <div className="text-sm font-bold text-white font-mono tabular-nums mt-1">
                        {selectedSheet.sheet.speed || '9m'} · {formatModifier(selectedSheet.sheet.proficiencyBonus)}
                      </div>
                    </div>
                  </div>

                  {/* Attributes Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {ATTRIBUTE_META.map((attr) => {
                      const score = selectedSheet.sheet.attributes[attr.key];
                      const mod = calcAttributeModifier(score);
                      const isSaveProf = selectedSheet.sheet.savingThrowProficiencies.includes(attr.key);
                      return (
                        <div
                          key={attr.key}
                          className="rounded-lg bg-black/35 border border-white/10 p-2 text-center"
                        >
                          <div className="text-[10px] font-semibold text-slate-400">
                            {attr.short}
                            {isSaveProf ? ' •' : ''}
                          </div>
                          <div className="text-base font-bold text-white font-mono tabular-nums">
                            {formatModifier(mod)}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                            {score}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Attacks */}
                  {selectedSheet.sheet.attacks.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Ataques & Ações
                      </h4>
                      <div className="divide-y divide-white/[0.06] rounded-lg border border-white/10 bg-black/30">
                        {selectedSheet.sheet.attacks.map((atk) => (
                          <div
                            key={atk.id}
                            className="px-3 py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-medium text-white truncate">{atk.name}</span>
                            <span className="font-mono text-slate-300 tabular-nums shrink-0">
                              {formatModifier(atk.bonus)} · {atk.damage}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills & Conditions */}
                  {(selectedSheet.sheet.skills.length > 0 ||
                    selectedSheet.sheet.conditions.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {selectedSheet.sheet.skills.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Perícias Treinadas
                          </h4>
                          <p className="text-slate-300 leading-relaxed">
                            {selectedSheet.sheet.skills.join(' · ')}
                          </p>
                        </div>
                      )}
                      {selectedSheet.sheet.conditions.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                            Condições Ativas
                          </h4>
                          <p className="text-amber-300 leading-relaxed">
                            {selectedSheet.sheet.conditions.join(' · ')}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spells & Features */}
                  {selectedSheet.sheet.spellsAndFeatures?.trim() && (
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Habilidades & Magias
                      </h4>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap rounded-lg bg-black/30 border border-white/10 p-3 leading-relaxed">
                        {selectedSheet.sheet.spellsAndFeatures}
                      </p>
                    </div>
                  )}

                  {/* Inventory */}
                  {selectedSheet.sheet.inventory?.trim() && (
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Inventário & Equipamentos
                      </h4>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap rounded-lg bg-black/30 border border-white/10 p-3 leading-relaxed">
                        {selectedSheet.sheet.inventory}
                      </p>
                    </div>
                  )}

                  {/* Biography / Player Notes */}
                  {selectedSheet.notes?.trim() && (
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        História & Anotações do Jogador
                      </h4>
                      <p className="text-xs text-slate-300 whitespace-pre-wrap rounded-lg bg-black/30 border border-white/10 p-3 leading-relaxed">
                        {selectedSheet.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Footer */}
                <footer className="p-3.5 sm:px-5 border-t border-white/10 bg-black/35 space-y-2 shrink-0">
                  {actionMessage && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-300">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>{actionMessage}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddOrSyncToMap(selectedSheet)}
                        disabled={actionBusy}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {actionBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {existingMapNode ? 'Atualizar Ficha no Mapa' : 'Adicionar ao Mapa de Notas'}
                        </span>
                      </button>

                      {existingMapNode && (
                        <button
                          type="button"
                          onClick={() => handleFocusOnMap(selectedSheet)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-100 border border-white/15 font-medium text-xs transition cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5 text-cyan-300" />
                          <span>Focar no Mapa</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSendToVtt(selectedSheet)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 font-medium text-xs transition cursor-pointer"
                    >
                      <Swords className="w-3.5 h-3.5 text-purple-300" />
                      <span>Enviar ao VTT</span>
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-xs text-slate-400">
                Selecione uma ficha na lista ao lado para inspecionar os detalhes e adicioná-la ao Mapa de Notas.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
