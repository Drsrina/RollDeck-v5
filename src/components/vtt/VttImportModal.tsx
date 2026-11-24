import {
  Check,
  Compass,
  ExternalLink,
  Heart,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Swords,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  BIOMAS_ENCONTRO,
  SISTEMAS_ENCONTRO,
  gerarEncontroAleatorio,
  normalizarDificuldadeParaSistema,
  type BiomaEncontro,
  type DificuldadeEncontroFlex,
  type EncontroGerado,
  type SistemaEncontro,
} from '../../lib/forja/encounterGenerator';
import { useAppStore } from '../../store/useAppStore';
import { useMapStore } from '../../store/useMapStore';
import { useVttStore } from '../../store/useVttStore';

interface VttImportModalProps {
  isOpen: boolean;
  initialTab: 'characters' | 'encounter';
  onClose: () => void;
}

export const VttImportModal: React.FC<VttImportModalProps> = ({
  isOpen,
  initialTab,
  onClose,
}) => {
  const [tab, setTab] = useState<'characters' | 'encounter'>(initialTab);
  const [search, setSearch] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);

  // Instant encounter generator controls inside the modal
  const [sistema, setSistema] = useState<SistemaEncontro>('dnd55');
  const [nivelGrupo, setNivelGrupo] = useState<number>(3);
  const [dificuldade, setDificuldade] = useState<DificuldadeEncontroFlex>('moderada');
  const [bioma, setBioma] = useState<BiomaEncontro>('masmorra');
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 900000) + 1000);
  const [deployMode, setDeployMode] = useState<'current' | 'new-scene'>('current');

  const notes = useMapStore((s) => s.notes);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const importCharacterNotes = useVttStore((s) => s.importCharacterNotes);
  const importEncounter = useVttStore((s) => s.importEncounter);
  const recentForjaEncounters = useVttStore((s) => s.recentForjaEncounters);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setSearch('');
      setSelectedNoteIds([]);
    }
  }, [isOpen, initialTab]);

  const characterNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes
      .filter((n) => n.category === 'character')
      .filter((n) => {
        if (!q) return true;
        const sheet = n.characterSheet;
        const haystack = [
          n.title,
          sheet?.characterClass,
          sheet?.race,
          sheet?.playerName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, search]);

  const generatedEncounter = useMemo<EncontroGerado>(() => {
    return gerarEncontroAleatorio(seed, {
      nivelGrupo,
      tamanhoGrupo: 4,
      dificuldade,
      bioma,
      sistema,
      foco: 'combate',
    });
  }, [seed, nivelGrupo, dificuldade, bioma, sistema]);

  if (!isOpen) return null;

  const toggleNote = (id: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllCharacters = () => {
    if (selectedNoteIds.length === characterNotes.length) {
      setSelectedNoteIds([]);
    } else {
      setSelectedNoteIds(characterNotes.map((n) => n.id));
    }
  };

  const handleImportCharacters = () => {
    const picked = characterNotes.filter((n) => selectedNoteIds.includes(n.id));
    if (picked.length === 0) return;
    importCharacterNotes(picked);
    onClose();
  };

  const handleDeployEncounter = (enc: EncontroGerado, mode: 'current' | 'new-scene') => {
    importEncounter(enc, mode);
    onClose();
  };

  const difficultyOptions: { id: DificuldadeEncontroFlex; label: string }[] =
    sistema === 'dnd55'
      ? [
          { id: 'baixa', label: 'Baixa' },
          { id: 'moderada', label: 'Moderada' },
          { id: 'alta', label: 'Alta' },
        ]
      : [
          { id: 'facil', label: 'Fácil' },
          { id: 'medio', label: 'Médio' },
          { id: 'dificil', label: 'Difícil' },
          { id: 'mortal', label: 'Mortal' },
        ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vtt-import-modal-title"
      data-dice3d-ignore="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0e1120] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/25">
          <div>
            <h2 id="vtt-import-modal-title" className="text-sm font-black text-white tracking-wide">
              Importar para o Tabuleiro VTT
            </h2>
            <p className="text-[11px] text-slate-400">
              Traga fichas do Mapa de Notas ou encontros da Forja de Mundos em segundos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-white/10 flex items-center gap-2 bg-black/15">
          <button
            type="button"
            onClick={() => setTab('characters')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'characters'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Fichas do Mapa ({notes.filter((n) => n.category === 'character').length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('encounter')}
            className={`px-3.5 py-2 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              tab === 'encounter'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Encontros da Forja</span>
          </button>
        </div>

        {/* Body */}
        {tab === 'characters' ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar fichas por nome, classe ou raça..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/60"
                />
              </div>
              {characterNotes.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllCharacters}
                  className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 whitespace-nowrap transition cursor-pointer"
                >
                  {selectedNoteIds.length === characterNotes.length ? 'Desmarcar' : 'Selecionar todas'}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {characterNotes.length === 0 ? (
                <div className="py-10 px-4 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-200">
                    Nenhuma ficha de personagem encontrada no Mapa de Notas
                  </p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Crie uma nota da categoria <strong>Ficha de Personagem</strong> no Mapa de Notas para importá-la com PV, CA, ataques e foto sincronizados.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      setActiveTab('map');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-bold text-emerald-200 transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir Mapa de Notas</span>
                  </button>
                </div>
              ) : (
                characterNotes.map((note) => {
                  const sheet = note.characterSheet;
                  const checked = selectedNoteIds.includes(note.id);
                  const subtitle = [
                    sheet?.race,
                    sheet?.characterClass,
                    sheet?.level ? `Nv. ${sheet.level}` : undefined,
                  ]
                    .filter(Boolean)
                    .join(' · ');

                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => toggleNote(note.id)}
                      className={`w-full p-3 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer ${
                        checked
                          ? 'bg-emerald-500/15 border-emerald-400/50'
                          : 'bg-black/30 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                          checked
                            ? 'bg-emerald-400 border-emerald-300 text-slate-950'
                            : 'border-white/25 bg-black/40'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="w-10 h-10 rounded-full border-2 border-emerald-400/70 bg-slate-900 overflow-hidden shrink-0 flex items-center justify-center">
                        {sheet?.avatarUrl ? (
                          <img
                            src={sheet.avatarUrl}
                            alt={note.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs font-black text-emerald-200">
                            {note.title.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-white truncate">{note.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {subtitle || 'Ficha de Personagem'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-200 shrink-0">
                        <span className="flex items-center gap-1 text-emerald-300">
                          <Heart className="w-3 h-3" />
                          {sheet?.hpCurrent ?? 10}/{sheet?.hpMax ?? 10}
                        </span>
                        <span className="flex items-center gap-1 text-cyan-300">
                          <Shield className="w-3 h-3" />
                          {sheet?.ac ?? 10}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-white/10 bg-black/25 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-400 tabular-nums">
                {selectedNoteIds.length} {selectedNoteIds.length === 1 ? 'ficha selecionada' : 'fichas selecionadas'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedNoteIds.length === 0}
                  onClick={handleImportCharacters}
                  className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Importar como Tokens</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Mode Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-black/30 border border-white/10">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-300" />
                Destino dos tokens do encontro:
              </span>
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => setDeployMode('current')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    deployMode === 'current'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cena Atual
                </button>
                <button
                  type="button"
                  onClick={() => setDeployMode('new-scene')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    deployMode === 'new-scene'
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Nova Cena (Bioma)
                </button>
              </div>
            </div>

            {/* Recent Forja Encounters (if available) */}
            {recentForjaEncounters.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Gerados Recentemente na Forja de Mundos
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    {recentForjaEncounters.length} disponível(is)
                  </span>
                </div>

                <div className="space-y-2">
                  {recentForjaEncounters.map((enc) => {
                    const totalMonsters = enc.monstros.reduce((acc, m) => acc + m.quantidade, 0);
                    return (
                      <div
                        key={enc.id}
                        className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-black text-white truncate">{enc.titulo}</p>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            {enc.sistemaLabel} · {enc.dificuldadeLabel} · {totalMonsters} criaturas
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {enc.monstros.map((m) => `${m.quantidade}× ${m.nome}`).join(' · ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeployEncounter(enc, deployMode)}
                          className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shrink-0 self-start sm:self-center transition cursor-pointer whitespace-nowrap"
                        >
                          <Swords className="w-3.5 h-3.5" />
                          <span>Importar Encontro</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Instant Forja Generator right inside VTT */}
            <div className="space-y-3 p-4 rounded-xl bg-black/35 border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    Gerador Rápido da Forja
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Gere um encontro balanceado agora e posicione os inimigos no grid
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSeed(Math.floor(Math.random() * 999999) + 1)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Sortear</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Sistema
                  </label>
                  <select
                    value={sistema}
                    onChange={(e) => {
                      const next = e.target.value as SistemaEncontro;
                      setSistema(next);
                      setDificuldade((prev) => normalizarDificuldadeParaSistema(prev, next));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                  >
                    {SISTEMAS_ENCONTRO.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#0e1120]">
                        {s.curto}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Nível Grupo
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={nivelGrupo}
                    onChange={(e) => setNivelGrupo(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs font-bold text-white tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Dificuldade
                  </label>
                  <select
                    value={dificuldade}
                    onChange={(e) => setDificuldade(e.target.value as DificuldadeEncontroFlex)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                  >
                    {difficultyOptions.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0e1120]">
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Bioma
                  </label>
                  <select
                    value={bioma}
                    onChange={(e) => setBioma(e.target.value as BiomaEncontro)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white"
                  >
                    {BIOMAS_ENCONTRO.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#0e1120]">
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview Card */}
              <div className="p-3.5 rounded-xl bg-[#090c18] border border-white/10 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-white">{generatedEncounter.titulo}</p>
                    <p className="text-[11px] text-slate-400">
                      {generatedEncounter.sistemaLabel} · {generatedEncounter.dificuldadeLabel} ·{' '}
                      {generatedEncounter.xpBaseTotal} XP
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeployEncounter(generatedEncounter, deployMode)}
                    className="px-3.5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black flex items-center gap-1.5 shrink-0 transition cursor-pointer whitespace-nowrap"
                  >
                    <Swords className="w-3.5 h-3.5" />
                    <span>Colocar no Tabuleiro</span>
                  </button>
                </div>

                <div className="divide-y divide-white/5 border-t border-white/10 pt-1">
                  {generatedEncounter.monstros.map((m) => (
                    <div
                      key={m.id}
                      className="py-1.5 flex items-center justify-between text-xs gap-2"
                    >
                      <span className="font-bold text-slate-200 truncate">
                        {m.quantidade}× {m.nome}{' '}
                        <span className="font-normal text-slate-400">({m.papelTatico})</span>
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                        PV {m.pvMedio} · CA {m.ca} · ND {m.cr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
