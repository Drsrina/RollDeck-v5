import React from 'react';
import { Home, PanelsTopLeft, RefreshCw, Shield, Sparkles } from 'lucide-react';
import type { SettlementResult, TamanhoAssentamento } from '../../lib/forja/settlementGenerator';
import { useAppStore } from '../../store/useAppStore';
import { useHeraldryStore } from '../../store/useHeraldryStore';

interface ForjaAssentamentoTabProps {
  seedAssentamento: number;
  setSeedAssentamento: (seed: number) => void;
  sortearSeedAssentamento: () => void;
  tamanhoAssentamento: TamanhoAssentamento;
  setTamanhoAssentamento: (t: TamanhoAssentamento) => void;
  temRioAssentamento: boolean;
  setTemRioAssentamento: (tem: boolean) => void;
  temColinaAssentamento: boolean;
  setTemColinaAssentamento: (tem: boolean) => void;
  temEstradaAssentamento: boolean;
  setTemEstradaAssentamento: (tem: boolean) => void;
  nomeAssentamentoCustom: string;
  setNomeAssentamentoCustom: (nome: string) => void;
  assentamentoIsolado: SettlementResult;
}

export const ForjaAssentamentoTab: React.FC<ForjaAssentamentoTabProps> = ({
  seedAssentamento,
  setSeedAssentamento,
  sortearSeedAssentamento,
  tamanhoAssentamento,
  setTamanhoAssentamento,
  temRioAssentamento,
  setTemRioAssentamento,
  temColinaAssentamento,
  setTemColinaAssentamento,
  temEstradaAssentamento,
  setTemEstradaAssentamento,
  nomeAssentamentoCustom,
  setNomeAssentamentoCustom,
  assentamentoIsolado,
}) => {
  const openStudioTool = useAppStore((s) => s.openStudioTool);
  const obterBrasaoPorNomeOuTarget = useHeraldryStore((s) => s.obterBrasaoPorNomeOuTarget);
  return (
    <section className="flex flex-col gap-5">
      {/* Barra de Seed e Opções do Assentamento */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-300 font-bold font-mono">Seed Assentamento:</span>
          <input
            type="number"
            value={seedAssentamento}
            onChange={(e) => setSeedAssentamento(Number(e.target.value) || 0)}
            className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-emerald-300 text-center focus:outline-none focus:border-emerald-400"
          />
          <button
            onClick={sortearSeedAssentamento}
            className="px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Sortear</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-bold">Porte:</span>
          {(['aldeia', 'vila', 'cidade'] as TamanhoAssentamento[]).map((t) => (
            <button
              key={t}
              onClick={() => setTamanhoAssentamento(t)}
              className={`px-2.5 py-1 rounded text-xs font-bold capitalize transition cursor-pointer ${
                tamanhoAssentamento === t ? 'bg-emerald-500 text-black' : 'bg-white/5 text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Toggles Interativos de Influência Geográfica */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={temRioAssentamento}
              onChange={(e) => setTemRioAssentamento(e.target.checked)}
              className="rounded border-white/20 text-emerald-500 focus:ring-0"
            />
            <span>Rio</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={temColinaAssentamento}
              onChange={(e) => setTemColinaAssentamento(e.target.checked)}
              className="rounded border-white/20 text-emerald-500 focus:ring-0"
            />
            <span>Colina</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={temEstradaAssentamento}
              onChange={(e) => setTemEstradaAssentamento(e.target.checked)}
              className="rounded border-white/20 text-emerald-500 focus:ring-0"
            />
            <span>Estrada</span>
          </label>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-bold">Nome:</span>
          <input
            type="text"
            placeholder="Auto (Procedural)"
            value={nomeAssentamentoCustom}
            onChange={(e) => setNomeAssentamentoCustom(e.target.value)}
            className="w-36 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Dados do Assentamento */}
      <div className="p-4 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Home className="w-5 h-5 text-emerald-400" />
            {assentamentoIsolado.nome} ({assentamentoIsolado.tamanho.toUpperCase()})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            População: ~{assentamentoIsolado.populacao} habitantes | Predominância: {assentamentoIsolado.racaPredominante} | Governo: {assentamentoIsolado.governo}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
            {assentamentoIsolado.mapaInfluencia.temRio && (
              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300">Rio Ativo</span>
            )}
            {assentamentoIsolado.mapaInfluencia.temEstradaPrincipal && (
              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-300">Estrada Real</span>
            )}
            {assentamentoIsolado.mapaInfluencia.temColina && (
              <span className="px-2 py-1 rounded bg-stone-500/20 text-stone-300">Colina Estratégica</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => useAppStore.getState().setActiveTab('studio')}
            className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="Abrir o Gerador Medieval de Cidades no Estúdio"
          >
            <PanelsTopLeft className="w-3.5 h-3.5" />
            <span>Gerar Planta Baixa no Estúdio &rarr;</span>
          </button>
        </div>
      </div>

      {/* Distritos e Zoneamento */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {assentamentoIsolado.distritos.map((dist) => (
          <div key={dist.id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-sm font-bold text-cyan-300">{dist.nome}</h4>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">
                {dist.tipoUso}
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-2">{dist.descricao}</p>
            <div className="text-[11px] text-slate-500 font-mono">
              Influência: {dist.influenciaFator} | Segurança: {dist.nivelSeguranca}
            </div>
          </div>
        ))}
      </div>

      {/* Facções 100% Procedurais */}
      <div className="rounded-xl bg-[#0d0b1a] border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            Facções e Relações de Poder (§6.3)
          </h4>
          <button
            onClick={() => openStudioTool('heraldry')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 text-xs font-semibold transition cursor-pointer"
            title="Abrir o Armoria no Estúdio para criar brasões heráldicos para suas facções"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Estúdio Armoria</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {assentamentoIsolado.faccoes.map((f) => {
            const brasao = obterBrasaoPorNomeOuTarget(f.nome) || obterBrasaoPorNomeOuTarget(f.id);

            return (
              <div
                key={f.id}
                className="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h5 className="text-xs font-bold text-purple-300">{f.nome}</h5>
                    {brasao ? (
                      <div
                        className="w-7 h-7 rounded border border-purple-500/40 p-0.5 bg-black/60 shrink-0"
                        title={`Brasão da facção: ${brasao.nome}`}
                        dangerouslySetInnerHTML={{ __html: brasao.svgData }}
                      />
                    ) : (
                      <button
                        onClick={() => openStudioTool('heraldry')}
                        title="Criar brasão no Armoria"
                        className="p-1 rounded bg-white/5 hover:bg-purple-600/30 text-slate-400 hover:text-purple-300 transition shrink-0 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Líder: <strong>{f.lider}</strong>
                  </p>
                  <p className="text-[11px] text-slate-300 mt-1">{f.objetivo}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <div>
                    Rivais: <span className="text-rose-400">{f.rivais.join(', ')}</span>
                  </div>
                  {!brasao && (
                    <button
                      onClick={() => openStudioTool('heraldry')}
                      className="text-[10px] text-purple-400 hover:text-purple-300 underline font-sans cursor-pointer"
                    >
                      + Brasão
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pontos de Interesse (POIs) 100% Procedurais */}
      <div className="rounded-xl bg-[#0d0b1a] border border-white/10 p-4">
        <h4 className="text-sm font-bold text-slate-200 mb-3">
          Pontos de Interesse Notáveis ({assentamentoIsolado.pontosDeInteresse.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {assentamentoIsolado.pontosDeInteresse.map((poi) => (
            <div key={poi.id} className="p-3 rounded-lg bg-black/40 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <h5 className="text-xs font-bold text-amber-300">{poi.nome}</h5>
                <span className="text-[10px] font-mono text-slate-500 uppercase">{poi.tipo}</span>
              </div>
              <p className="text-xs text-slate-300">{poi.descricao}</p>
              <div className="mt-2 text-[11px] text-slate-400">
                Responsável: <strong className="text-slate-200">{poi.responsavelNome}</strong> ({poi.responsavelOcupacao}) &bull; Especialidade: {poi.especialidade}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
