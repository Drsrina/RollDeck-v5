import React from 'react';
import { Download, RefreshCw, Swords } from 'lucide-react';
import type { TerrenoResult } from '../../lib/forja/terrainGenerator';
import { type BiomaEncontro, mapearBiomaTerrenoParaEncontro } from '../../lib/forja/encounterGenerator';

interface ForjaTerrenoTabProps {
  seedTerreno: number;
  setSeedTerreno: (seed: number) => void;
  sortearSeedTerreno: () => void;
  terrenoIsolado: TerrenoResult;
  showBiomes: boolean;
  setShowBiomes: (show: boolean) => void;
  showRivers: boolean;
  setShowRivers: (show: boolean) => void;
  showRoutes: boolean;
  setShowRoutes: (show: boolean) => void;
  showSettlements: boolean;
  setShowSettlements: (show: boolean) => void;
  selectedCellId: number | null;
  setSelectedCellId: (id: number | null) => void;
  onDownloadSVG: () => void;
  onNavigateEncontros: (bioma?: BiomaEncontro) => void;
}

export const ForjaTerrenoTab: React.FC<ForjaTerrenoTabProps> = ({
  seedTerreno,
  setSeedTerreno,
  sortearSeedTerreno,
  terrenoIsolado,
  showBiomes,
  setShowBiomes,
  showRivers,
  setShowRivers,
  showRoutes,
  setShowRoutes,
  showSettlements,
  setShowSettlements,
  selectedCellId,
  setSelectedCellId,
  onDownloadSVG,
  onNavigateEncontros,
}) => {
  return (
    <section className="flex flex-col gap-4">
      {/* Barra de Seed e Opções do Terreno */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-cyan-300 font-bold font-mono">Seed Terreno:</span>
          <input
            type="number"
            value={seedTerreno}
            onChange={(e) => setSeedTerreno(Number(e.target.value) || 0)}
            className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={sortearSeedTerreno}
            className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
            title="Sortear nova semente de terreno"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sortear</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Malha:</span>
          <span className="px-2.5 py-1 rounded text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Grade Hexagonal Padrão
          </span>
        </div>

        {/* Controles de Camadas */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showBiomes}
              onChange={(e) => setShowBiomes(e.target.checked)}
              className="rounded border-white/20 text-cyan-500 focus:ring-0"
            />
            <span>Biomas</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showRivers}
              onChange={(e) => setShowRivers(e.target.checked)}
              className="rounded border-white/20 text-cyan-500 focus:ring-0"
            />
            <span>Rios</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showRoutes}
              onChange={(e) => setShowRoutes(e.target.checked)}
              className="rounded border-white/20 text-cyan-500 focus:ring-0"
            />
            <span>Estradas</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showSettlements}
              onChange={(e) => setShowSettlements(e.target.checked)}
              className="rounded border-white/20 text-cyan-500 focus:ring-0"
            />
            <span>Cidades</span>
          </label>
        </div>

        <button
          onClick={onDownloadSVG}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-xs font-semibold text-cyan-200 border border-cyan-500/30 transition-colors cursor-pointer"
          title="Baixar Mapa em formato Vetorial SVG"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar SVG
        </button>
      </div>

      {/* VISUALIZADOR DE MAPA SVG DETERMINÍSTICO */}
      <div className="rounded-2xl bg-[#05040a] border border-white/15 p-2 overflow-hidden shadow-2xl relative">
        <svg
          id="forja-terrain-svg"
          viewBox={`0 0 ${terrenoIsolado.largura} ${terrenoIsolado.altura}`}
          className="w-full h-auto max-h-[550px] object-contain rounded-xl select-none"
        >
          {/* Células de Terreno */}
          {terrenoIsolado.cells.map((cell) => {
            const isSelected = selectedCellId === cell.id;
            let fillColor = '#1e293b';

            if (!showBiomes) {
              const val = Math.floor(cell.elevation * 255);
              fillColor = cell.isOceano ? '#0f172a' : `rgb(${val}, ${val}, ${val})`;
            } else if (cell.isOceano) fillColor = '#0f172a';
            else if (cell.isLago) fillColor = '#1e3a5f';
            else if (cell.bioma === 'Picos Nevados') fillColor = '#f8fafc';
            else if (cell.bioma === 'Montanha') fillColor = '#64748b';
            else if (cell.bioma === 'Colinas') fillColor = '#854d0e';
            else if (cell.bioma === 'Floresta Temperada') fillColor = '#166534';
            else if (cell.bioma === 'Taiga') fillColor = '#065f46';
            else if (cell.bioma === 'Selva Tropical') fillColor = '#14532d';
            else if (cell.bioma === 'Deserto') fillColor = '#d97706';
            else if (cell.bioma === 'Pântano') fillColor = '#3f6212';
            else if (cell.bioma === 'Costa') fillColor = '#ca8a04';
            else fillColor = '#4d7c0f'; // Planície

            const pts = cell.polygon.map((p) => p.join(',')).join(' ');

            return (
              <polygon
                key={cell.id}
                points={pts}
                fill={fillColor}
                stroke={isSelected ? '#22d3ee' : '#00000033'}
                strokeWidth={isSelected ? 2.5 : 0.8}
                className="cursor-pointer transition-opacity hover:opacity-85"
                onClick={() => setSelectedCellId(cell.id)}
              />
            );
          })}

          {/* Rios */}
          {showRivers &&
            terrenoIsolado.rivers.map((rio, rIdx) => {
              const pts = rio.path
                .map((cid) => {
                  const c = terrenoIsolado.cells[cid];
                  return `${c.x},${c.y}`;
                })
                .join(' ');

              return (
                <polyline
                  key={rIdx}
                  points={pts}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={Math.min(4, Math.max(1.5, rio.flow / 2))}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              );
            })}

          {/* Estradas */}
          {showRoutes &&
            terrenoIsolado.routes.map((rt) => {
              const pts = rt.path
                .map((cid) => {
                  const c = terrenoIsolado.cells[cid];
                  return `${c.x},${c.y}`;
                })
                .join(' ');

              return (
                <polyline
                  key={rt.id}
                  points={pts}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="4,3"
                  opacity={0.7}
                />
              );
            })}

          {/* Assentamentos e Marcos */}
          {showSettlements &&
            terrenoIsolado.settlements.map((s) => {
              const c = terrenoIsolado.cells[s.cellId];
              return (
                <g key={s.cellId} className="cursor-pointer" onClick={() => setSelectedCellId(s.cellId)}>
                  <circle cx={c.x} cy={c.y} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth={1.5} />
                  <text
                    x={c.x}
                    y={c.y - 10}
                    fill="#ffffff"
                    fontSize={11}
                    fontWeight="bold"
                    textAnchor="middle"
                    className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  >
                    {s.name}
                  </text>
                </g>
              );
            })}
        </svg>
      </div>

      {/* Inspetor de Célula */}
      {selectedCellId !== null && (
        <div className="p-4 rounded-xl bg-[#0d0b1a] border border-cyan-500/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-cyan-300">
              Célula #{selectedCellId} — {terrenoIsolado.cells[selectedCellId]?.bioma}
            </h4>
            <button
              onClick={() => setSelectedCellId(null)}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Fechar
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-300">
            <div>Elevação: {(terrenoIsolado.cells[selectedCellId]?.elevation * 100).toFixed(0)}%</div>
            <div>Clima: {terrenoIsolado.cells[selectedCellId]?.zonaClima}</div>
            <div>Fluxo Hídrico: {terrenoIsolado.cells[selectedCellId]?.fluxoHidrico}</div>
            <div>Burg Score: {terrenoIsolado.cells[selectedCellId]?.burgScore}</div>
          </div>
          <div className="pt-1 flex justify-end">
            <button
              type="button"
              onClick={() => {
                const biomaMapeado = mapearBiomaTerrenoParaEncontro(
                  terrenoIsolado.cells[selectedCellId]?.bioma
                );
                onNavigateEncontros(biomaMapeado);
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Swords className="w-3.5 h-3.5" />
              <span>Gerar Encontro neste Bioma &rarr;</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
