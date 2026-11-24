import React, { useState } from 'react';
import {
  BookOpen,
  Castle,
  Key,
  Layers,
  Scroll,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { ConfigCampanhaModal } from '../components/oraculo/ConfigCampanhaModal';
import { DiarioCampanha } from '../components/oraculo/DiarioCampanha';
import { FichaCidadePanel } from '../components/oraculo/FichaCidadePanel';
import { OraculoSimNao } from '../components/oraculo/OraculoSimNao';
import { TableRoller } from '../components/oraculo/TableRoller';
import { TurnosController } from '../components/oraculo/TurnosController';
import { useOraculoStore } from '../store/useOraculoStore';

type MobileTab = 'cidade' | 'oraculo' | 'diario';

export const OraculoScreen: React.FC = () => {
  const { cidade, seed } = useOraculoStore();
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('oraculo');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  return (
    <div className="min-h-full pb-20 md:pb-12 text-slate-100 flex flex-col">
      {/* Top Banner / Header do Oráculo */}
      <div className="p-4 sm:p-6 border-b border-white/10 glass-panel shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 via-purple-500/20 to-cyan-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.25)]">
            <Castle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">
                Oráculo dos Terratenentes
              </h1>
              <span className="hidden sm:inline text-xs text-amber-400 font-serif italic">
                · RPG Solo de Cidade
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Gestão feudal, oráculo Sim/Não, tabelas temáticas e turnos aninhados
            </p>
          </div>
        </div>

        {/* Informações de Semente e Configurações */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 hover:border-amber-400/40 text-slate-300 text-xs font-mono transition"
            title="Semente determinística Mulberry32"
          >
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span className="max-w-[120px] truncate">{seed}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="p-2 rounded-xl glass-panel-elevated hover:bg-white/10 text-slate-300 hover:text-white transition"
            title="Configurações da Campanha"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navegação Mobile em Abas (Visível apenas em telas pequenas) */}
      <div className="lg:hidden flex items-center justify-around border-b border-white/10 bg-black/40 px-2 py-2 shrink-0">
        <button
          type="button"
          onClick={() => setActiveMobileTab('cidade')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            activeMobileTab === 'cidade'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Castle className="w-3.5 h-3.5" />
          <span>Cidade & Turnos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMobileTab('oraculo')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            activeMobileTab === 'oraculo'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Oráculo & Tabelas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMobileTab('diario')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            activeMobileTab === 'diario'
              ? 'bg-purple-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Diário</span>
        </button>
      </div>

      {/* Grid Principal: 3 Colunas no Desktop / Abas no Mobile */}
      <div className="flex-1 p-3 sm:p-5 max-w-[1600px] w-full mx-auto">
        {/* Desktop 3 Columns */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-5 items-start">
          {/* Coluna 1: Turnos & Ficha da Cidade (4 colunas) */}
          <div className="lg:col-span-4 space-y-4">
            <TurnosController />
            <FichaCidadePanel />
          </div>

          {/* Coluna 2: Oráculo Sim/Não & Tabelas Roláveis (4 colunas) */}
          <div className="lg:col-span-4 space-y-4">
            <OraculoSimNao />
            <TableRoller tabelaInicialId="clima" />
          </div>

          {/* Coluna 3: Diário de Campanha (4 colunas) */}
          <div className="lg:col-span-4 h-full">
            <DiarioCampanha />
          </div>
        </div>

        {/* Mobile Single Tab View */}
        <div className="lg:hidden space-y-4">
          {activeMobileTab === 'cidade' && (
            <div className="space-y-4">
              <TurnosController />
              <FichaCidadePanel />
            </div>
          )}

          {activeMobileTab === 'oraculo' && (
            <div className="space-y-4">
              <OraculoSimNao />
              <TableRoller tabelaInicialId="clima" />
            </div>
          )}

          {activeMobileTab === 'diario' && (
            <div>
              <DiarioCampanha />
            </div>
          )}
        </div>
      </div>

      {/* Modal de Configurações */}
      <ConfigCampanhaModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />
    </div>
  );
};
