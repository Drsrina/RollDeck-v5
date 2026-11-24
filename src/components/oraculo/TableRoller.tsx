import React, { useState } from 'react';
import { Bookmark, Dices, RefreshCw, Scroll, Layers } from 'lucide-react';
import { TODAS_TABELAS, type TabelaRolavel } from '../../data';
import { useOraculoStore } from '../../store/useOraculoStore';

interface TableRollerProps {
  tabelaInicialId?: string;
}

export const TableRoller: React.FC<TableRollerProps> = ({ tabelaInicialId = 'clima' }) => {
  const { rolarTabela, fixarResultadoTabelaNoLog, ultimoResultadoTabela } = useOraculoStore();

  const [tabelaSelecionadaId, setTabelaSelecionadaId] = useState<string>(tabelaInicialId);
  const [isRolling, setIsRolling] = useState(false);
  const [fixado, setFixado] = useState(false);

  const tabelaAtual = TODAS_TABELAS.find((t) => t.id === tabelaSelecionadaId) || TODAS_TABELAS[0];

  const handleRoll = () => {
    setIsRolling(true);
    setFixado(false);
    setTimeout(() => {
      rolarTabela(tabelaAtual, false);
      setIsRolling(false);
    }, 150);
  };

  const handleFixar = () => {
    if (ultimoResultadoTabela && !fixado) {
      fixarResultadoTabelaNoLog(ultimoResultadoTabela);
      setFixado(true);
    }
  };

  return (
    <div className="rounded-2xl glass-panel-elevated p-4 sm:p-5 border border-white/10 space-y-4">
      {/* Header com Seletor de Tabela */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <Scroll className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Tabelas Roláveis de Significado
            </h3>
            <p className="text-[10px] text-slate-400">
              Eventos temáticos, ganchos e desastres alimentados por JSON
            </p>
          </div>
        </div>

        {/* Dropdown de Tabelas */}
        <div className="flex items-center gap-2">
          <select
            value={tabelaSelecionadaId}
            onChange={(e) => {
              setTabelaSelecionadaId(e.target.value);
              setFixado(false);
            }}
            className="w-full sm:w-auto px-2.5 py-1.5 rounded-xl bg-black/60 border border-white/15 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
          >
            {TODAS_TABELAS.map((tab) => (
              <option key={tab.id} value={tab.id} className="bg-slate-900 text-white">
                {tab.nome} ({tab.dado})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Descrição da Tabela Atual */}
      {tabelaAtual.descricao && (
        <p className="text-slate-400 text-[11px] leading-relaxed">
          {tabelaAtual.descricao}
        </p>
      )}

      {/* Botões de Ação */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRoll}
          disabled={isRolling}
          className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-98 transition cursor-pointer"
        >
          <Dices className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
          <span>ROLAR NA TABELA ({tabelaAtual.dado})</span>
        </button>
      </div>

      {/* Resultado Destacado */}
      {ultimoResultadoTabela && ultimoResultadoTabela.tabelaId === tabelaAtual.id && (
        <div className="p-4 rounded-xl bg-black/60 border border-cyan-500/30 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>
              Resultado: {ultimoResultadoTabela.dado} ={' '}
              <strong className="text-white text-xs">{ultimoResultadoTabela.roll}</strong>
            </span>
            <span className="text-cyan-400">{ultimoResultadoTabela.tabelaNome}</span>
          </div>

          <div className="p-3 rounded-lg bg-black/40 border border-white/10 text-white text-xs font-semibold leading-relaxed">
            {ultimoResultadoTabela.resultadoTexto}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
            <button
              type="button"
              onClick={handleRoll}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Rolar Novamente</span>
            </button>

            <button
              type="button"
              onClick={handleFixar}
              disabled={fixado}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                fixado
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                  : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 cursor-pointer active:scale-95'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              <span>{fixado ? 'Fixado no Diário ✓' : 'Fixar no Diário'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
