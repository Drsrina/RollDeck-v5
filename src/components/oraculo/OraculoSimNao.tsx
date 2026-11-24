import React, { useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Dices,
  HelpCircle,
  Sparkles,
  Zap,
} from 'lucide-react';
import { PROBABILIDADES, type ProbabilidadeKey } from '../../lib/oraculoEngine';
import { useOraculoStore } from '../../store/useOraculoStore';

export const OraculoSimNao: React.FC = () => {
  const { rolarOraculo, ultimoResultadoOraculo } = useOraculoStore();

  const [pergunta, setPergunta] = useState('');
  const [probabilidade, setProbabilidade] = useState<ProbabilidadeKey>('meio');
  const [modificador, setModificador] = useState<number>(0);
  const [isRollingAnim, setIsRollingAnim] = useState(false);

  const probDef = PROBABILIDADES.find((p) => p.key === probabilidade) || PROBABILIDADES[3];
  const limiarPrevisto = Math.min(99, Math.max(1, probDef.chance + modificador));

  const handleRoll = () => {
    const p = pergunta.trim() || 'O destino favorece nossa decisão?';
    setIsRollingAnim(true);
    setTimeout(() => {
      rolarOraculo(p, probabilidade, modificador);
      setIsRollingAnim(false);
    }, 180);
  };

  return (
    <div className="rounded-2xl glass-panel-elevated p-4 sm:p-5 border border-white/10 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Oráculo de Perguntas (Sim / Não)
            </h3>
            <p className="text-[10px] text-slate-400">
              Probabilidade, graus de intensidade e reviravoltas em dados duplos
            </p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-400/30 px-2.5 py-1 rounded-xl">
          Limiar: <span className="font-bold">{limiarPrevisto}%</span>
        </div>
      </div>

      {/* Campo de Pergunta */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Pergunta ao Oráculo
        </label>
        <div className="relative">
          <input
            type="text"
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRoll()}
            placeholder="Ex.: A caravana mercante chegou em segurança? Há espiões nos muros?"
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/15 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 transition"
          />
        </div>
      </div>

      {/* Seleção de Probabilidade */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Nível de Probabilidade
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {PROBABILIDADES.map((p) => {
            const isSelected = probabilidade === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setProbabilidade(p.key)}
                className={`px-2 py-1.5 rounded-xl text-left border text-xs transition active:scale-95 cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                    : 'bg-black/40 border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                <div className="font-bold text-[11px] truncate">{p.label}</div>
                <div className="text-[10px] font-mono opacity-80">{p.chance}%</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modificador Circunstancial */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
          <span>Modificador de Situação:</span>
          <span className="font-mono text-cyan-400 text-xs">
            {modificador > 0 ? `+${modificador}%` : `${modificador}%`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[-20, -10, 0, 10, 20].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModificador(m)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition ${
                modificador === m
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              {m > 0 ? `+${m}` : m}
            </button>
          ))}
        </div>
      </div>

      {/* Botão de Rolagem */}
      <button
        type="button"
        onClick={handleRoll}
        disabled={isRollingAnim}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-purple-600 to-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.35)] hover:brightness-110 active:scale-98 transition cursor-pointer"
      >
        <Dices className={`w-5 h-5 ${isRollingAnim ? 'animate-spin' : ''}`} />
        <span>CONSULTAR ORÁCULO (1d100)</span>
      </button>

      {/* Exibição do Resultado */}
      {ultimoResultadoOraculo && (
        <div className="p-4 rounded-2xl bg-black/60 border border-white/15 space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center space-y-1">
            <div className="text-[10px] text-slate-400 italic truncate">
              "{ultimoResultadoOraculo.pergunta}"
            </div>

            {/* Grande Resultado Sim / Não */}
            <div className="flex items-center justify-center gap-3">
              <span
                className={`text-2xl sm:text-3xl font-black tracking-tight ${
                  ultimoResultadoOraculo.isSim
                    ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]'
                    : 'text-rose-400 drop-shadow-[0_0_15px_rgba(251,113,133,0.5)]'
                }`}
              >
                {ultimoResultadoOraculo.grau}
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              1d100 = <span className="font-bold text-white">{ultimoResultadoOraculo.dadoRolado}</span>{' '}
              vs Limiar de{' '}
              <span className="text-cyan-400 font-bold">{ultimoResultadoOraculo.limiarFinal}%</span>
            </div>
          </div>

          {/* Destaque de Dados Duplos (11, 22... 99, 100) */}
          {ultimoResultadoOraculo.isDuplo && ultimoResultadoOraculo.eventoDuplo && (
            <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-400/50 space-y-2">
              <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                <Zap className="w-4 h-4 text-purple-400 animate-bounce" />
                <span>DADOS DUPLOS ({ultimoResultadoOraculo.dadoRolado})! EVENTO DISPARADO</span>
              </div>

              <div className="p-2 rounded-lg bg-black/50 border border-purple-500/30 text-white text-xs font-semibold leading-relaxed">
                {ultimoResultadoOraculo.eventoDuplo.fraseCompleta}
              </div>

              <div className="text-[10px] text-purple-300/80 font-mono flex items-center justify-between">
                <span>Foco: {ultimoResultadoOraculo.eventoDuplo.focoValor}</span>
                <span>Ação: {ultimoResultadoOraculo.eventoDuplo.acaoValor}</span>
                <span>Assunto: {ultimoResultadoOraculo.eventoDuplo.assuntoValor}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
