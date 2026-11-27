import React from 'react';
import { Castle, RefreshCw } from 'lucide-react';
import type { AlgoritmoLayout, DificuldadeEncontro, DungeonResult } from '../../lib/forja/dungeonGenerator';

interface ForjaMasmorraTabProps {
  seedMasmorra: number;
  setSeedMasmorra: (seed: number) => void;
  sortearSeedMasmorra: () => void;
  layoutMasmorra: AlgoritmoLayout;
  setLayoutMasmorra: (layout: AlgoritmoLayout) => void;
  nivelGrupoMasmorra: number;
  setNivelGrupoMasmorra: (nivel: number) => void;
  dificuldadeMasmorra: DificuldadeEncontro;
  setDificuldadeMasmorra: (dif: DificuldadeEncontro) => void;
  temaMasmorraCustom: string;
  setTemaMasmorraCustom: (tema: string) => void;
  masmorraIsolada: DungeonResult;
  selectedRoomId: number | null;
  setSelectedRoomId: (id: number | null) => void;
}

export const ForjaMasmorraTab: React.FC<ForjaMasmorraTabProps> = ({
  seedMasmorra,
  setSeedMasmorra,
  sortearSeedMasmorra,
  layoutMasmorra,
  setLayoutMasmorra,
  nivelGrupoMasmorra,
  setNivelGrupoMasmorra,
  dificuldadeMasmorra,
  setDificuldadeMasmorra,
  temaMasmorraCustom,
  setTemaMasmorraCustom,
  masmorraIsolada,
  selectedRoomId,
  setSelectedRoomId,
}) => {
  return (
    <section className="flex flex-col gap-4">
      {/* Barra de Seed e Controles da Masmorra */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-300 font-bold font-mono">Seed Masmorra:</span>
          <input
            type="number"
            value={seedMasmorra}
            onChange={(e) => setSeedMasmorra(Number(e.target.value) || 0)}
            className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-purple-300 text-center focus:outline-none focus:border-purple-400"
          />
          <button
            onClick={sortearSeedMasmorra}
            className="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold border border-purple-500/30 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sortear</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Layout:</span>
          <select
            value={layoutMasmorra}
            onChange={(e) => setLayoutMasmorra(e.target.value as AlgoritmoLayout)}
            className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
          >
            <option value="donjon">Clássico Donjon</option>
            <option value="bsp">BSP (Particionamento Binário)</option>
            <option value="caverna">Autômatos Celulares</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Nível:</span>
          <input
            type="number"
            min={1}
            max={20}
            value={nivelGrupoMasmorra}
            onChange={(e) => setNivelGrupoMasmorra(Number(e.target.value) || 1)}
            className="w-14 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-center text-slate-200"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Dificuldade:</span>
          <select
            value={dificuldadeMasmorra}
            onChange={(e) => setDificuldadeMasmorra(e.target.value as DificuldadeEncontro)}
            className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
          >
            <option value="facil">Fácil</option>
            <option value="medio">Médio</option>
            <option value="dificil">Difícil</option>
            <option value="mortal">Mortal</option>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-bold">Tema Custom:</span>
          <input
            type="text"
            placeholder="Auto (Procedural)"
            value={temaMasmorraCustom}
            onChange={(e) => setTemaMasmorraCustom(e.target.value)}
            className="w-36 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Status do Grafo Dormans Lock & Key */}
      <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
        <div className="flex items-center gap-2">
          <Castle className="w-4 h-4 text-purple-400" />
          <span>{masmorraIsolada.nome}: <strong>{masmorraIsolada.isSolvable ? 'SOLÚVEL (Verificado por BFS)' : 'BLOQUEADO'}</strong></span>
        </div>
        <div>
          Orçamento XP: {masmorraIsolada.orcamentoXp.xpAlocado} / {masmorraIsolada.orcamentoXp.orcamentoAlvo} XP ({masmorraIsolada.orcamentoXp.variacaoPercentual > 0 ? '+' : ''}{masmorraIsolada.orcamentoXp.variacaoPercentual}%)
        </div>
      </div>

      {/* Grid Espacial */}
      <div className="rounded-xl bg-[#05040a] border border-white/10 p-3 overflow-x-auto flex flex-col items-center gap-2">
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `repeat(${masmorraIsolada.larguraGrade}, 14px)`,
          }}
        >
          {masmorraIsolada.grade.map((row, y) =>
            row.map((cell, x) => {
              let bg = 'bg-black/80';
              if (cell === 1) bg = 'bg-slate-700/80';
              if (cell === 2) bg = 'bg-amber-500';

              const roomHere = masmorraIsolada.rooms.find(
                (rm) => x >= rm.x && x < rm.x + rm.width && y >= rm.y && y < rm.y + rm.height
              );
              const isRoomSelected = roomHere && selectedRoomId === roomHere.numero;

              if (isRoomSelected) {
                bg = 'bg-cyan-500 shadow-[0_0_8px_#22d3ee]';
              }

              return (
                <div
                  key={`${x}-${y}`}
                  onClick={() => roomHere && setSelectedRoomId(selectedRoomId === roomHere.numero ? null : roomHere.numero)}
                  title={roomHere ? `Sala ${roomHere.numero}: ${roomHere.nome}` : undefined}
                  className={`w-[14px] h-[14px] rounded-[1px] transition-colors ${bg} ${
                    roomHere ? 'cursor-pointer hover:opacity-80' : ''
                  }`}
                />
              );
            })
          )}
        </div>
        <div className="text-[11px] font-mono text-slate-400">
          Clique em uma sala na grade ou na lista abaixo para inspecionar
        </div>
      </div>

      {/* Salas com Monstros, Armadilhas e Tesouros 100% Procedurais */}
      <div className="flex flex-col gap-2 font-mono text-xs">
        {masmorraIsolada.rooms.map((r) => {
          const isSelected = selectedRoomId === r.numero;
          return (
            <div
              key={r.id}
              onClick={() => setSelectedRoomId(isSelected ? null : r.numero)}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                  : 'bg-[#0d0b1a] border-white/10 hover:border-white/20'
              } flex flex-col gap-1.5`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-100 flex items-center gap-2">
                  <span className="text-cyan-400">Sala {r.numero}:</span> {r.nome} ({r.tipo})
                </h4>
                {r.xpTotal > 0 && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    {r.xpTotal} XP
                  </span>
                )}
              </div>
              <p className="text-slate-400 font-sans">{r.descricao}</p>

              {r.monstros && r.monstros.length > 0 && (
                <div className="text-rose-300 font-semibold font-sans">
                  ⚔️ Monstros: {r.monstros.map((m) => `${m.quantidade}x ${m.nome} (CR ${m.cr}, ${m.totalXp} XP)`).join(', ')}
                </div>
              )}
              {r.hasKey && (
                <div className="text-amber-300 font-semibold font-sans">
                  🗝️ Contém Chave: {r.hasKey}
                </div>
              )}
              {r.requiresKey && (
                <div className="text-red-400 font-semibold font-sans">
                  🔒 Porta Trancada: Requer {r.requiresKey}
                </div>
              )}
              {r.armadilha && (
                <div className="text-orange-300 font-semibold font-sans">
                  ⚠️ Armadilha: {r.armadilha}
                </div>
              )}
              {r.tesouro && (
                <div className="text-emerald-300 font-semibold font-sans">
                  💰 Tesouro: {r.tesouro}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
