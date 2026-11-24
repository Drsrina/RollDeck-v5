import React from 'react';
import { Calendar, FastForward, Play, ShieldAlert, Sparkles, Sun, CheckCircle2 } from 'lucide-react';
import { useOraculoStore } from '../../store/useOraculoStore';

export const TurnosController: React.FC = () => {
  const {
    cidade,
    avancarDias,
    avancarAteProximoMarco,
    ultimoRelatorioTurno,
    limparUltimoRelatorio,
    microEventoDisponivel,
  } = useOraculoStore();

  const diasAteSemanal = 7 - (cidade.dia % 7 === 0 ? 0 : cidade.dia % 7);
  const diasAteMensal = 30 - (cidade.dia % 30 === 0 ? 0 : cidade.dia % 30);

  return (
    <div className="rounded-2xl glass-panel-elevated p-4 border border-white/10 space-y-3.5">
      {/* Header com Dia e Estação */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-white font-mono">
                DIA {cidade.dia}
              </span>
              <span className="text-xs text-amber-300 font-medium">
                · {cidade.estacao}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Próx. Semanal: em {diasAteSemanal === 7 ? 7 : diasAteSemanal}d · Próx. Mensal: em {diasAteMensal === 30 ? 30 : diasAteMensal}d
            </p>
          </div>
        </div>

        {microEventoDisponivel && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-semibold animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Micro-evento sugerido!</span>
          </div>
        )}
      </div>

      {/* Botões de Avanço de Turno */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => avancarDias(1)}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
          title="Avança exatamente 1 dia"
        >
          <Play className="w-4 h-4 text-cyan-400 mb-1" />
          <span>+1 Dia</span>
        </button>

        <button
          type="button"
          onClick={() => avancarDias(3)}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition active:scale-95 cursor-pointer"
          title="Avança 3 dias e verifica micro-eventos"
        >
          <Sun className="w-4 h-4 text-amber-400 mb-1" />
          <span>+3 Dias</span>
        </button>

        <button
          type="button"
          onClick={() => avancarAteProximoMarco()}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs transition active:scale-95 cursor-pointer"
          title="Avança automaticamente até a próxima fase semanal ou mensal"
        >
          <FastForward className="w-4 h-4 text-amber-400 mb-1" />
          <span>Até o Marco</span>
        </button>
      </div>

      {/* Relatório de Turno Recente */}
      {ultimoRelatorioTurno && (
        <div className="p-3 rounded-xl bg-black/60 border border-amber-500/30 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Relatório de Turno: Dia {ultimoRelatorioTurno.diaAtual}
            </span>
            <button
              onClick={limparUltimoRelatorio}
              className="text-[10px] text-slate-400 hover:text-white"
            >
              Fechar
            </button>
          </div>

          <p className="text-slate-300 text-[11px] leading-relaxed">
            {ultimoRelatorioTurno.resumoTexto}
          </p>

          {ultimoRelatorioTurno.eventosOcorridos.length > 0 && (
            <div className="space-y-1 pt-1">
              {ultimoRelatorioTurno.eventosOcorridos.map((ev, i) => (
                <div key={i} className="text-purple-300 text-[11px] flex items-start gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{ev}</span>
                </div>
              ))}
            </div>
          )}

          {ultimoRelatorioTurno.obrasConcluidas.length > 0 && (
            <div className="text-emerald-300 text-[11px] font-semibold">
              🎉 Obras Concluídas: {ultimoRelatorioTurno.obrasConcluidas.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
