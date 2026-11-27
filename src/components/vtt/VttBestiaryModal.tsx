import {
  Check,
  Eye,
  EyeOff,
  Heart,
  Plus,
  Search,
  Shield,
  Skull,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import {
  BESTIARIO_ENCONTROS,
  BIOMAS_ENCONTRO,
  type BiomaEncontro,
  type CriaturaTemplate,
  type PapelTatico,
} from '../../lib/forja/encounterGenerator';
import { useVttStore } from '../../store/useVttStore';
import {
  VTT_FACTION_META,
  type VttTokenFaction,
  type VttTokenSize,
} from '../../types/vtt';

interface VttBestiaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAPEIS: PapelTatico[] = [
  'Bruto',
  'Escaramuçador',
  'Atirador',
  'Conjurador',
  'Controlador',
  'Chefe',
];

function inferSizeCells(tipoTexto: string): VttTokenSize {
  const lower = tipoTexto.toLowerCase();
  if (lower.includes('imenso') || lower.includes('colossal')) return 4;
  if (lower.includes('enorme')) return 3;
  if (lower.includes('grande')) return 2;
  return 1;
}

export const VttBestiaryModal: React.FC<VttBestiaryModalProps> = ({ isOpen, onClose }) => {
  const addToken = useVttStore((s) => s.addToken);

  const [search, setSearch] = useState('');
  const [biomeFilter, setBiomeFilter] = useState<'all' | BiomaEncontro>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | PapelTatico>('all');
  const [quantity, setQuantity] = useState<number>(1);
  const [faction, setFaction] = useState<VttTokenFaction>('enemy');
  const [startHidden, setStartHidden] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredCreatures = useMemo(() => {
    const q = search.trim().toLowerCase();
    return BESTIARIO_ENCONTROS.filter((c) => {
      if (biomeFilter !== 'all' && !c.biomas.includes(biomeFilter)) return false;
      if (roleFilter !== 'all' && c.papelTatico !== roleFilter) return false;
      if (!q) return true;
      const tipo = (c.tipo55 || c.tipoTamanho).toLowerCase();
      return (
        c.nome.toLowerCase().includes(q) ||
        tipo.includes(q) ||
        `nd ${c.cr}`.toLowerCase().includes(q) ||
        `cr ${c.cr}`.toLowerCase().includes(q) ||
        c.papelTatico.toLowerCase().includes(q)
      );
    }).sort((a, b) => a.crNum - b.crNum);
  }, [search, biomeFilter, roleFilter]);

  if (!isOpen) return null;

  const handleAddCreature = (creature: CriaturaTemplate) => {
    const tipoEfetivo = creature.tipo55 || creature.tipoTamanho;
    const sizeCells = inferSizeCells(tipoEfetivo);
    const factionMeta = VTT_FACTION_META[faction];
    const skillsText = creature.habilidadesEMagias
      .map((h) => `${h.nome}: ${h.descricao}`)
      .join('\n');

    for (let i = 0; i < quantity; i++) {
      const displayName = quantity > 1 ? `${creature.nome} ${i + 1}` : creature.nome;
      addToken({
        name: displayName,
        faction,
        color: factionMeta.color,
        sizeCells,
        rotation: 0,
        locked: false,
        hidden: startHidden,
        hpCurrent: creature.pvMedio,
        hpMax: creature.pvMedio,
        hpTemp: 0,
        ac: creature.ca,
        speed: creature.deslocamento,
        initiativeMod: creature.iniciativaMod,
        initiativeValue: null,
        conditions: [],
        sourceRole: creature.papelTatico,
        sourceCr: creature.cr,
        bloodiedThreshold: Math.floor(creature.pvMedio / 2),
        notes: `[D&D 5.5] ${tipoEfetivo} · ND ${creature.cr} (${creature.xp} XP)\n${skillsText}`,
        attacks: creature.ataques.map((atk) => ({
          id: `atk-${crypto.randomUUID()}`,
          name: atk.nome,
          bonus: atk.acerto,
          damage: atk.dadosDano,
          damageType: atk.tipoDano,
          effect: atk.efeito55,
        })),
      });
    }

    const hiddenLabel = startHidden ? ' (oculto dos jogadores)' : '';
    setFeedback(`+${quantity}× ${creature.nome}${hiddenLabel} adicionado(s) à mesa!`);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0e1222] border border-white/15 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3 bg-black/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-400/35 text-rose-300">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                Bestiário Rápido D&D 5.5 (2024)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold">
                  {filteredCreatures.length} criaturas
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Adicione monstros com 1 clique já com PV, CA, ataques 5.5, limiar de Sangrando e visibilidade.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar bestiário"
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls & Emboscada (Hidden) Toggle */}
        <div className="p-3 border-b border-white/10 bg-[#0a0d18] space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, tipo (Fada, Dragão...) ou ND (ex: 1/4, 5)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <select
              value={biomeFilter}
              onChange={(e) => setBiomeFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">Todos os Biomas</option>
              {BIOMAS_ENCONTRO.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="all">Todos os Papéis</option>
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Placement Options Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStartHidden((v) => !v)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  startHidden
                    ? 'bg-purple-500/25 border-purple-400/50 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
                title="Quando ativo, jogadores e observadores não enxergam o token no mapa nem na iniciativa até você revelar no Inspetor."
              >
                {startHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{startHidden ? 'Oculto dos jogadores (Emboscada)' : 'Visível para todos'}</span>
              </button>

              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-[11px]">
                <span className="px-1.5 text-slate-400 font-semibold">Qtd:</span>
                {[1, 2, 3, 4, 6].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantity(n)}
                    className={`px-2 py-0.5 rounded-lg font-mono font-bold transition cursor-pointer ${
                      quantity === n
                        ? 'bg-cyan-400 text-slate-950'
                        : 'text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {n}×
                  </button>
                ))}
              </div>

              <select
                value={faction}
                onChange={(e) => setFaction(e.target.value as VttTokenFaction)}
                className="px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-[11px] font-semibold text-slate-200 focus:outline-none"
              >
                <option value="enemy">Facção: Inimigo</option>
                <option value="neutral">Facção: Neutro</option>
                <option value="ally">Facção: Aliado</option>
              </select>
            </div>

            {feedback && (
              <div className="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>{feedback}</span>
              </div>
            )}
          </div>
        </div>

        {/* Monster Grid */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCreatures.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 text-sm">
              Nenhuma criatura encontrada para os filtros selecionados.
            </div>
          ) : (
            filteredCreatures.map((c) => {
              const tipoEfetivo = c.tipo55 || c.tipoTamanho;
              const sizeCells = inferSizeCells(tipoEfetivo);
              return (
                <div
                  key={c.id}
                  className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 flex flex-col justify-between gap-2.5 transition"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <span>{c.nome}</span>
                          {c.tipo55 && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 font-mono">
                              5.5
                            </span>
                          )}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {tipoEfetivo} · {c.papelTatico}
                          {sizeCells > 1 ? ` · ${sizeCells}×${sizeCells} céls` : ''}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-400/30 text-rose-200 font-mono text-[11px] font-bold shrink-0">
                        ND {c.cr}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-300">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-cyan-400" />
                        CA {c.ca}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-400" />
                        PV {c.pvMedio} ({c.formulaPv})
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                        Inic {c.iniciativaMod >= 0 ? `+${c.iniciativaMod}` : c.iniciativaMod}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                        {c.deslocamento}
                      </span>
                    </div>

                    <div className="space-y-1 pt-1">
                      {c.ataques.slice(0, 2).map((atk, idx) => (
                        <div
                          key={idx}
                          className="text-[11px] text-slate-300 flex items-center gap-1.5 truncate"
                        >
                          <Swords className="w-3 h-3 text-amber-400 shrink-0" />
                          <span className="font-semibold text-white">{atk.nome}</span>
                          <span className="text-slate-400 font-mono">
                            (+{atk.acerto}, {atk.dadosDano})
                          </span>
                          {atk.efeito55 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-200 border border-purple-400/30 truncate">
                              <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />
                              {atk.efeito55}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddCreature(c)}
                    className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      startHidden
                        ? 'bg-purple-500/25 hover:bg-purple-500/40 border border-purple-400/40 text-purple-100'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                    }`}
                  >
                    {startHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>
                      Adicionar {quantity > 1 ? `${quantity}× ` : ''}
                      {startHidden ? '(Oculto)' : 'à Mesa'}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
