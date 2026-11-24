import React, { useState } from 'react';
import {
  BookOpen,
  Calendar,
  Download,
  Filter,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { downloadArquivo, exportarDiarioMarkdown } from '../../lib/exportMarkdown';
import { useOraculoStore } from '../../store/useOraculoStore';
import type { TipoLogEntry } from '../../types/oraculo';

export const DiarioCampanha: React.FC = () => {
  const {
    cidade,
    logs,
    seed,
    filtroTipo,
    setFiltroTipo,
    filtroBusca,
    setFiltroBusca,
    adicionarEntradaManualDiario,
    resetarApenasLog,
  } = useOraculoStore();

  const [showAddModal, setShowAddModal] = useState(false);
  const [manualTitulo, setManualTitulo] = useState('');
  const [manualTexto, setManualTexto] = useState('');

  const handleExportMarkdown = () => {
    const md = exportarDiarioMarkdown(cidade, logs, seed);
    const nomeLimpo = (cidade.nome || 'Campanha').toLowerCase().replace(/\s+/g, '_');
    downloadArquivo(md, `diario_${nomeLimpo}_dia_${cidade.dia}.md`);
  };

  const handleAddManual = () => {
    if (!manualTexto.trim()) return;
    adicionarEntradaManualDiario(
      manualTitulo.trim() || 'Anotação de Campanha',
      manualTexto.trim()
    );
    setManualTitulo('');
    setManualTexto('');
    setShowAddModal(false);
  };

  // Filtragem dos logs
  const logsFiltrados = logs.filter((log) => {
    // Filtro por tipo
    if (filtroTipo !== 'todos') {
      if (filtroTipo === 'oraculo' && log.tipo !== 'oraculo') return false;
      if (filtroTipo === 'tabela' && log.tipo !== 'tabela') return false;
      if (filtroTipo === 'turno' && !log.tipo.startsWith('turno_')) return false;
      if (filtroTipo === 'manual' && log.tipo !== 'manual') return false;
    }

    // Filtro por busca
    if (filtroBusca.trim()) {
      const q = filtroBusca.toLowerCase();
      const matchTitulo = log.titulo.toLowerCase().includes(q);
      const matchTexto = log.texto.toLowerCase().includes(q);
      const matchDia = `dia ${log.dia}`.includes(q);
      return matchTitulo || matchTexto || matchDia;
    }

    return true;
  });

  return (
    <div className="rounded-2xl glass-panel-elevated p-4 sm:p-5 border border-white/10 space-y-3.5 flex flex-col h-full max-h-[850px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Diário de Campanha ({logs.length})
            </h3>
            <p className="text-[10px] text-slate-400">
              Histórico cronológico de rolagens, eventos e decisões
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
            title="Exportar diário em formato Markdown (.md) para Notion/Obsidian"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Exportar MD</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition active:scale-95 cursor-pointer"
            title="Adicionar anotação narrativa manual"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline">Nota</span>
          </button>
        </div>
      </div>

      {/* Barra de Busca e Filtros */}
      <div className="space-y-2 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            placeholder="Buscar por termo ou 'dia 7'..."
            className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-amber-400"
          />
          {filtroBusca && (
            <button
              onClick={() => setFiltroBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Chips de Filtro */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'oraculo', label: '🔮 Oráculo' },
            { id: 'tabela', label: '🎲 Tabelas' },
            { id: 'turno', label: '📅 Turnos' },
            { id: 'manual', label: '📝 Notas' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroTipo(f.id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${
                filtroTipo === f.id
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'bg-black/40 text-slate-400 hover:text-white border border-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modal / Form para Adicionar Nota Manual */}
      {showAddModal && (
        <div className="p-3 rounded-xl bg-black/80 border border-amber-500/40 space-y-2 shrink-0 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-300">Nova Nota Narrativa</span>
            <button
              onClick={() => setShowAddModal(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            type="text"
            placeholder="Título (ex.: O Conselho dos Anciãos)..."
            value={manualTitulo}
            onChange={(e) => setManualTitulo(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white text-xs"
          />
          <textarea
            placeholder="Escreva a narrativa do que ocorreu na cidade..."
            rows={3}
            value={manualTexto}
            onChange={(e) => setManualTexto(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-white text-xs resize-none"
          />
          <button
            type="button"
            onClick={handleAddManual}
            className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
          >
            Registrar no Diário
          </button>
        </div>
      )}

      {/* Lista Cronológica de Logs */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
        {logsFiltrados.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center mx-auto text-slate-500">
              <BookOpen className="w-5 h-5" />
            </div>
            <p className="text-slate-400 font-bold text-xs">
              Nenhuma entrada no diário
            </p>
            <p className="text-slate-500 text-[11px] max-w-xs mx-auto">
              Consulte o oráculo, role tabelas ou avance dias para preencher a crônica da cidade.
            </p>
          </div>
        ) : (
          logsFiltrados.map((log) => {
            const isOraculo = log.tipo === 'oraculo';
            const isTabela = log.tipo === 'tabela';
            const isTurno = log.tipo.startsWith('turno_');

            const borderColor = isOraculo
              ? 'border-purple-500/30'
              : isTabela
              ? 'border-cyan-500/30'
              : isTurno
              ? 'border-amber-500/30'
              : 'border-white/10';

            return (
              <div
                key={log.id}
                className={`p-3 rounded-xl bg-black/40 border ${borderColor} hover:bg-black/60 transition space-y-1.5`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    Dia {log.dia} · {log.estacao}
                  </span>
                  <span className="text-slate-500 font-mono text-[9px]">
                    {log.seedUsada}
                  </span>
                </div>

                <h4 className="font-bold text-xs text-white leading-snug">
                  {log.titulo}
                </h4>

                <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {log.texto}
                </p>

                {log.deltaRecursos && (
                  <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-mono">
                    {Object.entries(log.deltaRecursos).map(([k, v]) => {
                      if (v === 0 || v === undefined) return null;
                      const num = v as number;
                      return (
                        <span
                          key={k}
                          className={`px-1.5 py-0.5 rounded font-bold ${
                            num > 0
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {num > 0 ? `+${num}` : num} {k}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer com Limpeza de Log */}
      {logs.length > 0 && (
        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
          <span>{logs.length} registro(s)</span>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Deseja realmente limpar apenas o histórico de log do diário?')) {
                resetarApenasLog();
              }
            }}
            className="flex items-center gap-1 hover:text-red-400 transition"
          >
            <Trash2 className="w-3 h-3" />
            <span>Limpar logs</span>
          </button>
        </div>
      )}
    </div>
  );
};
