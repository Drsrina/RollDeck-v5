import React from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Dices, RefreshCw, User, Users } from 'lucide-react';
import { type NPCEntry, OCUPACOES, RACAS_NPC } from '../../lib/forja/npcGenerator';

interface ForjaNpcTabProps {
  modoNPC: 'lote' | 'individual';
  setModoNPC: (modo: 'lote' | 'individual') => void;
  seedNPCs: number;
  setSeedNPCs: (seed: number) => void;
  sortearSeedNPCs: () => void;
  qtdNPCs: number;
  setQtdNPCs: (qtd: number) => void;
  seedNPCIndividual: number;
  setSeedNPCIndividual: (seed: number) => void;
  sortearSeedNPCIndividual: () => void;
  npcRacaFiltro: string;
  setNpcRacaFiltro: (raca: string) => void;
  npcOcupacaoFiltro: string;
  setNpcOcupacaoFiltro: (ocupacao: string) => void;
  loteNPCsIsolado: NPCEntry[];
  npcIndividual: NPCEntry;
  expandedNpcId: string | null;
  setExpandedNpcId: (id: string | null) => void;
  copiedFormat: string | null;
  setCopiedFormat: (fmt: string | null) => void;
}

export const ForjaNpcTab: React.FC<ForjaNpcTabProps> = ({
  modoNPC,
  setModoNPC,
  seedNPCs,
  setSeedNPCs,
  sortearSeedNPCs,
  qtdNPCs,
  setQtdNPCs,
  seedNPCIndividual,
  setSeedNPCIndividual,
  sortearSeedNPCIndividual,
  npcRacaFiltro,
  setNpcRacaFiltro,
  npcOcupacaoFiltro,
  setNpcOcupacaoFiltro,
  loteNPCsIsolado,
  npcIndividual,
  expandedNpcId,
  setExpandedNpcId,
  copiedFormat,
  setCopiedFormat,
}) => {
  return (
    <section className="flex flex-col gap-4">
      {/* Seletor de Modo: Lote vs Individual */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setModoNPC('lote')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              modoNPC === 'lote' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Lote de NPCs
          </button>
          <button
            onClick={() => setModoNPC('individual')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              modoNPC === 'individual' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            NPC Individual
          </button>
        </div>

        {modoNPC === 'lote' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300 font-bold font-mono">Seed Lote:</span>
              <input
                type="number"
                value={seedNPCs}
                onChange={(e) => setSeedNPCs(Number(e.target.value) || 0)}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
              />
              <button
                onClick={sortearSeedNPCs}
                className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sortear</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-bold">Qtd:</span>
              {[3, 6, 10, 15].map((q) => (
                <button
                  key={q}
                  onClick={() => setQtdNPCs(q)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                    qtdNPCs === q ? 'bg-cyan-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300 font-bold font-mono">Seed NPC:</span>
              <input
                type="number"
                value={seedNPCIndividual}
                onChange={(e) => setSeedNPCIndividual(Number(e.target.value) || 0)}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
              />
              <button
                onClick={sortearSeedNPCIndividual}
                className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3 h-3" />
                <span>Sortear NPC</span>
              </button>
            </div>

            {/* Filtros customizáveis de NPC Individual */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Raça:</span>
              <select
                value={npcRacaFiltro}
                onChange={(e) => setNpcRacaFiltro(e.target.value)}
                className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="Qualquer">Qualquer</option>
                {RACAS_NPC.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Ocupação:</span>
              <select
                value={npcOcupacaoFiltro}
                onChange={(e) => setNpcOcupacaoFiltro(e.target.value)}
                className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200 capitalize"
              >
                <option value="Qualquer">Qualquer</option>
                {OCUPACOES.map((oc) => (
                  <option key={oc} value={oc}>{oc}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* VISUALIZAÇÃO DE LOTE DE NPCS */}
      {modoNPC === 'lote' && (
        <div className="flex flex-col gap-3 font-mono text-xs">
          <div className="text-slate-400 text-[11px]">
            Filosofia Donjon: Ficha mínima de 1 linha por padrão. Clique em "Expandir" para inspecionar atributos 3d6 e inventário.
          </div>

          {loteNPCsIsolado.map((npc) => {
            const isExp = expandedNpcId === npc.id;
            return (
              <div
                key={npc.id}
                className="p-3.5 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col gap-2 transition-all"
              >
                <div className="flex items-start sm:items-center justify-between gap-2">
                  <div className="text-slate-200">
                    <strong className="text-cyan-400">{npc.id}</strong> — {npc.nome} ({npc.raca}, <span className="text-amber-300">{npc.ocupacao}</span>). Aparência: {npc.aparencia}. Segredo: <span className="text-rose-300">{npc.segredo}</span>.
                  </div>
                  <button
                    onClick={() => setExpandedNpcId(isExp ? null : npc.id)}
                    className="shrink-0 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 text-xs flex items-center gap-1 font-sans cursor-pointer"
                  >
                    {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isExp ? 'Ocultar' : 'Expandir'}
                  </button>
                </div>

                {isExp && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-3 font-sans">
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <div className="text-[10px] text-slate-400">FOR</div>
                        <div className="text-sm font-bold text-white">{npc.stats.for}</div>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <div className="text-[10px] text-slate-400">DES</div>
                        <div className="text-sm font-bold text-white">{npc.stats.des}</div>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <div className="text-[10px] text-slate-400">CON</div>
                        <div className="text-sm font-bold text-white">{npc.stats.con}</div>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <div className="text-[10px] text-slate-400">INT</div>
                        <div className="text-sm font-bold text-white">{npc.stats.int}</div>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <div className="text-[10px] text-slate-400">SAB</div>
                        <div className="text-sm font-bold text-white">{npc.stats.sab}</div>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <div className="text-[10px] text-slate-400">CAR</div>
                        <div className="text-sm font-bold text-white">{npc.stats.car}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="text-emerald-300">PV: {npc.stats.pv}</span>
                      <span className="text-blue-300">CA: {npc.stats.ca}</span>
                      <span className="text-slate-300">{npc.stats.ataque}</span>
                    </div>

                    <div className="text-xs text-slate-300">
                      <strong>Encadeamento Psicológico:</strong> {npc.personalidade.arquetipo} &rarr; {npc.personalidade.traco} &rarr; <em>{npc.personalidade.motivacao}</em>
                    </div>

                    <div className="text-xs text-slate-400">
                      <strong>Equipamento:</strong> {npc.equipamento.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* VISUALIZAÇÃO DE NPC INDIVIDUAL DETALHADO */}
      {modoNPC === 'individual' && (
        <div className="p-5 rounded-2xl bg-[#0d0b1a] border border-cyan-500/30 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                {npcIndividual.nome}
              </h3>
              <div className="text-xs text-slate-400 mt-0.5">
                {npcIndividual.raca} &bull; <span className="text-amber-300 capitalize">{npcIndividual.ocupacao}</span> &bull; Gênero: {npcIndividual.genero === 'm' ? 'Masculino' : 'Feminino'} &bull; Seed: {seedNPCIndividual}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${npcIndividual.nome} (${npcIndividual.raca}, ${npcIndividual.ocupacao})\n${npcIndividual.resumoLinhaUnica}\nPV: ${npcIndividual.stats.pv} | CA: ${npcIndividual.stats.ca} | ${npcIndividual.stats.ataque}\nAtributos: FOR ${npcIndividual.stats.for}, DES ${npcIndividual.stats.des}, CON ${npcIndividual.stats.con}, INT ${npcIndividual.stats.int}, SAB ${npcIndividual.stats.sab}, CAR ${npcIndividual.stats.car}\nEquipamento: ${npcIndividual.equipamento.join(', ')}`
                );
                setCopiedFormat('npc_ind');
                setTimeout(() => setCopiedFormat(null), 2000);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedFormat === 'npc_ind' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar Ficha Completa
            </button>
          </div>

          {/* Ficha Donjon 1-Linha */}
          <div className="p-3 rounded-xl bg-black/50 border border-white/5 font-mono text-xs text-slate-200 leading-relaxed">
            <span className="text-cyan-400 font-bold">Ficha Donjon: </span>
            {npcIndividual.resumoLinhaUnica}
          </div>

          {/* Grid de Atributos D&D (3d6) */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {[
              { lbl: 'FOR', val: npcIndividual.stats.for },
              { lbl: 'DES', val: npcIndividual.stats.des },
              { lbl: 'CON', val: npcIndividual.stats.con },
              { lbl: 'INT', val: npcIndividual.stats.int },
              { lbl: 'SAB', val: npcIndividual.stats.sab },
              { lbl: 'CAR', val: npcIndividual.stats.car },
            ].map((st) => {
              const mod = Math.floor((st.val - 10) / 2);
              return (
                <div key={st.lbl} className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <div className="text-[10px] text-slate-400 font-bold font-mono">{st.lbl}</div>
                  <div className="text-base font-black text-white">{st.val}</div>
                  <div className="text-[11px] font-mono text-cyan-300">
                    {mod >= 0 ? `+${mod}` : mod}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Estatísticas de Combate */}
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono p-3 rounded-xl bg-white/[0.02] border border-white/5">
            <span className="text-emerald-300 font-bold">Pontos de Vida (PV): {npcIndividual.stats.pv}</span>
            <span className="text-blue-300 font-bold">Classe de Armadura (CA): {npcIndividual.stats.ca}</span>
            <span className="text-slate-200">{npcIndividual.stats.ataque}</span>
          </div>

          {/* Perfil Psicológico e Segredo */}
          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-purple-200">
              <strong>Psicologia:</strong> {npcIndividual.personalidade.arquetipo} &bull; <em>{npcIndividual.personalidade.traco}</em> &bull; Motivação: {npcIndividual.personalidade.motivacao}.
            </div>
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-200">
              <strong>Segredo Inconfessável:</strong> {npcIndividual.segredo}.
            </div>
          </div>

          {/* Equipamento */}
          <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300">
            <span className="font-bold text-slate-200">Itens & Equipamento: </span>
            {npcIndividual.equipamento.join(' &bull; ')}
          </div>
        </div>
      )}
    </section>
  );
};
