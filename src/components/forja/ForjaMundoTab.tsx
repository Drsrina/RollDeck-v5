import React from 'react';
import { Check, Compass, Copy, Download, Scroll, Sparkles, Users } from 'lucide-react';
import type { MundoCompletoResult } from '../../lib/forja/pipeline';
import { useAppStore } from '../../store/useAppStore';

interface ForjaMundoTabProps {
  mundo: MundoCompletoResult;
  onNavigateSubAba: (aba: any) => void;
  onSelectNpc: (npcId: string) => void;
  copiedFormat: string | null;
  onCopy: (formato: 'md' | 'json' | 'tsv') => void;
  onDownload: (formato: 'md' | 'json' | 'tsv') => void;
}

export const ForjaMundoTab: React.FC<ForjaMundoTabProps> = ({
  mundo,
  onNavigateSubAba,
  onSelectNpc,
  copiedFormat,
  onCopy,
  onDownload,
}) => {
  const openStudioTool = useAppStore((s) => s.openStudioTool);

  return (
    <section className="flex flex-col gap-6">
      {/* Banner de Acesso Rápido ao Estúdio FMG */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-cyan-950/40 via-[#0e1224] to-purple-950/30 p-3.5 rounded-2xl border border-cyan-500/20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 shrink-0">
            <Compass className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              Estúdio de Cartografia Continental (Azgaar FMG)
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h4>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Simule placas tectônicas, relevo 3D, biomas e exporte mapas para o VTT e Canvas do RollDeck.
            </p>
          </div>
        </div>

        <button
          onClick={() => openStudioTool('world')}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition shadow-[0_0_12px_rgba(6,182,212,0.3)] shrink-0 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Abrir no Estúdio</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
              Terreno & Malha Base
            </span>
            <h3 className="text-base font-bold text-white mt-1">
              Continente em {mundo.terreno.topologia.toUpperCase()}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {mundo.terreno.metricas.totalCells} células ({mundo.terreno.metricas.areaTerra} terra / {mundo.terreno.metricas.areaAgua} água), {mundo.terreno.rivers.length} rios descendo aos oceanos.
            </p>
          </div>
          <button
            onClick={() => onNavigateSubAba('terreno')}
            className="mt-3 text-xs text-cyan-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Inspecionar Terreno Isolado &rarr;
          </button>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Assentamento Central
            </span>
            <h3 className="text-base font-bold text-white mt-1">
              {mundo.assentamento.nome}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {mundo.assentamento.tamanho} com ~{mundo.assentamento.populacao} habitantes ({mundo.assentamento.racaPredominante}). {mundo.assentamento.distritos.length} distritos e {mundo.assentamento.faccoes.length} facções com rivalidades ativas.
            </p>
          </div>
          <button
            onClick={() => onNavigateSubAba('assentamento')}
            className="mt-3 text-xs text-emerald-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Inspecionar Assentamento Isolado &rarr;
          </button>
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
              Masmorra Ancorada
            </span>
            <h3 className="text-base font-bold text-white mt-1">
              {mundo.masmorra.nome}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Grafo Dormans Lock & Key ({mundo.masmorra.isSolvable ? 'Solúvel' : 'Inacessível'}), 6 salas interligadas, orçamento de XP: {mundo.masmorra.orcamentoXp.xpAlocado} XP (±{Math.abs(mundo.masmorra.orcamentoXp.variacaoPercentual)}%).
            </p>
          </div>
          <button
            onClick={() => onNavigateSubAba('masmorra')}
            className="mt-3 text-xs text-purple-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
          >
            Inspecionar Masmorra Isolada &rarr;
          </button>
        </div>
      </div>

      {/* Rumores da Taverna interconectados */}
      <div className="rounded-xl bg-[#0d0b1a] border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Scroll className="w-4 h-4 text-cyan-400" />
            Rumores Interconectados da Taverna (Weaver de Entidades)
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">
            Concordância Gramatical PT-BR
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {mundo.rumores.map((rumor, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-slate-300 italic flex items-start gap-2"
            >
              <span className="text-cyan-400 font-bold font-mono">#{i + 1}</span>
              <span>"{rumor}"</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fichas Donjon de 1 Linha dos NPCs do Mundo */}
      <div className="rounded-xl bg-[#0d0b1a] border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" />
            NPCs do Mundo Conectado ({mundo.npcs.length})
          </h3>
          <button
            onClick={() => onNavigateSubAba('npcs')}
            className="text-xs text-cyan-300 hover:underline cursor-pointer"
          >
            Gerar NPCs ou Ficha Individual &rarr;
          </button>
        </div>
        <div className="flex flex-col gap-2 font-mono text-xs">
          {mundo.npcs.map((npc) => (
            <div
              key={npc.id}
              className="p-2.5 rounded bg-black/40 border border-white/5 text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <span className="text-slate-200">
                <strong className="text-cyan-400">{npc.id}</strong> — Ocupação: <span className="text-amber-300">{npc.ocupacao}</span>. Aparência: {npc.aparencia}. Segredo: <span className="text-rose-300">{npc.segredo}</span>.
              </span>
              <button
                onClick={() => {
                  onNavigateSubAba('npcs');
                  onSelectNpc(npc.id);
                }}
                className="self-end sm:self-auto px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] text-slate-200 cursor-pointer"
              >
                Ver Ficha
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Exportação Completa */}
      <div className="rounded-xl bg-black/40 border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Exportação de Dados Agnóstica (§10)
          </h4>
          <p className="text-[11px] text-slate-400">
            Copie ou baixe o estado completo em formatos abertos sem dependência de banco de dados.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onCopy('md')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
            title="Copiar Markdown para Área de Transferência"
          >
            {copiedFormat === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Copiar MD
          </button>
          <button
            onClick={() => onDownload('md')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-xs font-semibold text-cyan-200 border border-cyan-500/30 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar .MD
          </button>
          <button
            onClick={() => onCopy('json')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            {copiedFormat === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            Copiar JSON
          </button>
          <button
            onClick={() => onDownload('json')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-xs font-semibold text-purple-200 border border-purple-500/30 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar .JSON
          </button>
          <button
            onClick={() => onDownload('tsv')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar .TSV
          </button>
        </div>
      </div>
    </section>
  );
};
