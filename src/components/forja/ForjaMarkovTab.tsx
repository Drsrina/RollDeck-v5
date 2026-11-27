import React from 'react';
import { Check, Copy, Dices, Scroll } from 'lucide-react';
import { KITS_MARKOV_DISPONIVEIS, type KitMarkovFonte } from '../../lib/forja/markovNames';

interface ForjaMarkovTabProps {
  seedMarkov: number;
  setSeedMarkov: (seed: number) => void;
  sortearSeedMarkov: () => void;
  kitMarkovSelecionado: string;
  setKitMarkovSelecionado: (kit: string) => void;
  qtdNomesMarkov: number;
  setQtdNomesMarkov: (qtd: number) => void;
  ordemMarkov: number;
  setOrdemMarkov: (ordem: number) => void;
  kitMarkovAtivo: KitMarkovFonte;
  listaNomesCustomParsed: string[];
  nomesCustomizadosTexto: string;
  setNomesCustomizadosTexto: (txt: string) => void;
  loteNomesMarkov: { nomes: string[] };
  copiedFormat: string | null;
  setCopiedFormat: (fmt: string | null) => void;
}

export const ForjaMarkovTab: React.FC<ForjaMarkovTabProps> = ({
  seedMarkov,
  setSeedMarkov,
  sortearSeedMarkov,
  kitMarkovSelecionado,
  setKitMarkovSelecionado,
  qtdNomesMarkov,
  setQtdNomesMarkov,
  ordemMarkov,
  setOrdemMarkov,
  kitMarkovAtivo,
  listaNomesCustomParsed,
  nomesCustomizadosTexto,
  setNomesCustomizadosTexto,
  loteNomesMarkov,
  copiedFormat,
  setCopiedFormat,
}) => {
  return (
    <section className="flex flex-col gap-4">
      {/* Controles de Semente e Configurações */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyan-300 font-bold font-mono">Seed Markov:</span>
          <input
            type="number"
            value={seedMarkov}
            onChange={(e) => setSeedMarkov(Number(e.target.value) || 0)}
            className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={sortearSeedMarkov}
            className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
          >
            <Dices className="w-3 h-3" />
            <span>Sortear Nomes</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Kit de Fonte:</span>
          <select
            value={kitMarkovSelecionado}
            onChange={(e) => setKitMarkovSelecionado(e.target.value)}
            className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200 font-medium"
          >
            {KITS_MARKOV_DISPONIVEIS.map((kit) => (
              <option key={kit.id} value={kit.id}>
                {kit.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-bold">Qtd:</span>
          {[5, 10, 15, 25, 40].map((q) => (
            <button
              key={q}
              onClick={() => setQtdNomesMarkov(q)}
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                qtdNomesMarkov === q ? 'bg-cyan-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Ordem (N-Gram):</span>
          <select
            value={ordemMarkov}
            onChange={(e) => setOrdemMarkov(Number(e.target.value) || 2)}
            className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
          >
            <option value={2}>Ordem 2 (Mais Criativo / Variações)</option>
            <option value={3}>Ordem 3 (Mais Próximo das Fontes)</option>
          </select>
        </div>
      </div>

      {/* Banner do Kit Ativo */}
      <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-cyan-200">
        <div>
          <strong>{kitMarkovAtivo.nome}</strong>: {kitMarkovAtivo.descricao}
        </div>
        <div className="font-mono text-[11px] text-cyan-400">
          {kitMarkovAtivo.id === 'customizado'
            ? `${listaNomesCustomParsed.length} palavras na lista personalizada`
            : `${kitMarkovAtivo.nomes.length} palavras-fonte pré-carregadas`}
        </div>
      </div>

      {/* Caixa de Texto Personalizada caso Kit Customizado esteja selecionado */}
      {kitMarkovSelecionado === 'customizado' && (
        <div className="p-3.5 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">
              Palavras-Fonte para Treinamento (separadas por espaço, vírgula ou linha):
            </label>
            <span className="text-[11px] font-mono text-slate-500">
              {listaNomesCustomParsed.length} nomes detectados
            </span>
          </div>
          <textarea
            rows={3}
            value={nomesCustomizadosTexto}
            onChange={(e) => setNomesCustomizadosTexto(e.target.value)}
            placeholder="Cole aqui uma lista de nomes para treinar o gerador de Markov..."
            className="w-full bg-black/60 border border-white/15 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
          />
        </div>
      )}

      {/* Grid de Nomes Gerados por Markov */}
      <div className="p-4 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
            <Scroll className="w-4 h-4 text-cyan-400" />
            <span>Nomes Sintetizados ({loteNomesMarkov.nomes.length})</span>
            <span className="text-[10px] text-slate-500 font-mono font-normal">
              (Ordem {ordemMarkov} &bull; Semente #{seedMarkov})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(loteNomesMarkov.nomes.join(', '));
                setCopiedFormat('markov_csv');
                setTimeout(() => setCopiedFormat(null), 2000);
              }}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              {copiedFormat === 'markov_csv' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              Copiar com Vírgula
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(loteNomesMarkov.nomes.join('\n'));
                setCopiedFormat('markov_lines');
                setTimeout(() => setCopiedFormat(null), 2000);
              }}
              className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-medium border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
            >
              {copiedFormat === 'markov_lines' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              Copiar em Linhas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
          {loteNomesMarkov.nomes.map((nome, idx) => (
            <div
              key={`${nome}-${idx}`}
              onClick={() => {
                navigator.clipboard.writeText(nome);
                setCopiedFormat(`nome_${idx}`);
                setTimeout(() => setCopiedFormat(null), 1500);
              }}
              className="p-3 rounded-lg bg-black/40 hover:bg-cyan-950/40 border border-white/5 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between group"
              title="Clique para copiar este nome individualmente"
            >
              <span className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 font-mono tracking-wide">
                {nome}
              </span>
              <span className="text-[10px] text-slate-600 group-hover:text-cyan-400 font-mono">
                {copiedFormat === `nome_${idx}` ? 'Copiado!' : `#${idx + 1}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
