import React from 'react';
import { Castle, Scroll, Shield, Sword, Users, Zap } from 'lucide-react';

interface ForjaSessaoAoVivoTabProps {
  sessaoLog: { id: string; tipo: string; texto: string; hora: string }[];
  rolarRapidoNPC: () => void;
  rolarRapidoRumor: () => void;
  rolarRapidoItem: () => void;
  rolarRapidoEncontro: () => void;
  rolarRapidoArmadilha: () => void;
}

export const ForjaSessaoAoVivoTab: React.FC<ForjaSessaoAoVivoTabProps> = ({
  sessaoLog,
  rolarRapidoNPC,
  rolarRapidoRumor,
  rolarRapidoItem,
  rolarRapidoEncontro,
  rolarRapidoArmadilha,
}) => {
  return (
    <section className="flex flex-col gap-4">
      <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/40">
        <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4" />
          Modo "Sessão ao Vivo" (GM Fast Screen)
        </h3>
        <p className="text-xs text-slate-300">
          Gere elementos avulsos 100% determinísticos em um clique sem sair do fluxo da partida.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            onClick={rolarRapidoNPC}
            className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            NPC Relâmpago
          </button>

          <button
            onClick={rolarRapidoRumor}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-black text-xs font-bold hover:bg-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Scroll className="w-3.5 h-3.5" />
            Rumor de Taverna
          </button>

          <button
            onClick={rolarRapidoItem}
            className="px-3 py-1.5 rounded-lg bg-purple-500 text-black text-xs font-bold hover:bg-purple-400 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sword className="w-3.5 h-3.5" />
            Item / Tesouro
          </button>

          <button
            onClick={rolarRapidoEncontro}
            className="px-3 py-1.5 rounded-lg bg-rose-500 text-black text-xs font-bold hover:bg-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5" />
            Encontro nos Ermos
          </button>

          <button
            onClick={rolarRapidoArmadilha}
            className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold hover:bg-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Castle className="w-3.5 h-3.5" />
            Armadilha / Perigo
          </button>
        </div>
      </div>

      {/* Histórico da Sessão ao Vivo */}
      <div className="flex flex-col gap-2 font-mono text-xs">
        {sessaoLog.map((log) => (
          <div
            key={log.id}
            className="p-3 rounded-lg bg-[#0d0b1a] border border-white/5 flex flex-col sm:flex-row sm:items-start justify-between gap-2"
          >
            <div className="flex items-start gap-2">
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 text-[10px] font-bold">
                {log.tipo}
              </span>
              <span className="text-slate-200 font-sans">{log.texto}</span>
            </div>
            <span className="text-[10px] text-slate-500 self-end sm:self-auto">{log.hora}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
