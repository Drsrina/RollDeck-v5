import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export const DiceRollAnimation: React.FC = () => {
  const { isRolling, tray, allDice, settings } = useAppStore();

  if (!isRolling) return null;

  // When 3D dice are enabled, let the real 3D polyhedral dice animate unobstructed across the viewport
  if (settings.dice3DEnabled !== false && !settings.reduceMotion) {
    return null;
  }

  // If user requested reduceMotion, show a subtle glowing pulse instead of full 3D tumble
  if (settings.reduceMotion) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
        <div className="glass-panel-elevated p-6 rounded-2xl flex items-center gap-3 border border-cyan-500/40">
          <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <span className="text-sm font-bold text-white tracking-wide">Rolando dados...</span>
        </div>
      </div>
    );
  }

  const diceMap = new Map(allDice.map((d) => [d.id, d]));

  // Flatten active tray dice (up to 40 visual spinning dice to prevent any GPU memory overload)
  const visualDice: { id: string; name: string; color: string; delay: number }[] = [];
  let index = 0;

  for (const item of tray) {
    const dieDef = diceMap.get(item.dieId) || { name: item.dieId, color: '#22d3ee' };
    const countToRender = Math.min(item.count, 12);
    for (let c = 0; c < countToRender; c++) {
      visualDice.push({
        id: `${item.dieId}-${c}`,
        name: dieDef.name,
        color: dieDef.color,
        delay: (index % 8) * 0.04,
      });
      index++;
    }
  }

  // Fallback if rolling package directly with empty tray
  if (visualDice.length === 0) {
    for (let i = 0; i < 8; i++) {
      visualDice.push({
        id: `die-${i}`,
        name: 'd20',
        color: '#22d3ee',
        delay: i * 0.04,
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md pointer-events-auto p-4 select-none">
      {/* 3D Dice Field */}
      <div className="w-full max-w-sm flex flex-wrap items-center justify-center gap-3 p-4 dice-container-3d">
        {visualDice.slice(0, 36).map((die) => (
          <div
            key={die.id}
            className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm font-mono border-2 shadow-lg animate-dice-spin"
            style={{
              animationDelay: `${die.delay}s`,
              borderColor: die.color,
              color: die.color,
              backgroundColor: `${die.color}22`,
              boxShadow: `0 0 16px ${die.color}66`,
            }}
          >
            {die.name}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center gap-2">
        <span className="text-sm font-bold tracking-widest text-cyan-300 uppercase animate-pulse">
          Lançando os Dados...
        </span>
        <span className="text-[11px] text-slate-400 font-mono">
          crypto.getRandomValues • Sem Viés
        </span>
      </div>
    </div>
  );
};
