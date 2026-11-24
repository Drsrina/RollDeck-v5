import React, { useState } from 'react';
import {
  Building2,
  Coins,
  Compass,
  Hammer,
  Minus,
  Pickaxe,
  Plus,
  Shield,
  Smile,
  Trees,
  Truck,
  Users,
  Wheat,
  Trash2,
  Play,
  CheckCircle2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { REGRAS_TURNOS } from '../../data';
import { useOraculoStore } from '../../store/useOraculoStore';
import type { RecursosCidade } from '../../types/oraculo';

export const FichaCidadePanel: React.FC = () => {
  const {
    cidade,
    atualizarNomeCidade,
    atualizarRecurso,
    atualizarAtributo,
    adicionarConstrucao,
    iniciarObra,
    concluirObra,
    removerConstrucao,
    adicionarRota,
    removerRota,
    alternarStatusRota,
    carregarCidadeModelo,
    zerarCidade,
  } = useOraculoStore();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nomeTemp, setNomeTemp] = useState(cidade.nome);

  // Modal / Form para nova construção
  const [showAddBuilding, setShowAddBuilding] = useState(false);
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(0);
  const [customBuildingName, setCustomBuildingName] = useState('');
  const [customEffect, setCustomEffect] = useState('');
  const [customDays, setCustomDays] = useState(14);

  // Modal / Form para nova rota comercial
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [routeDestino, setRouteDestino] = useState('');
  const [routeProduto, setRouteProduto] = useState('Madeira & Grãos');
  const [routeLucro, setRouteLucro] = useState(10);
  const [routeFreq, setRouteFreq] = useState<'semanal' | 'quinzenal' | 'mensal'>('semanal');

  const handleSaveName = () => {
    if (nomeTemp.trim()) {
      atualizarNomeCidade(nomeTemp.trim());
    }
    setIsEditingName(false);
  };

  const handleCreateBuildingFromPreset = () => {
    const preset = REGRAS_TURNOS.construcoesPredefinidas[selectedPresetIdx];
    if (preset) {
      adicionarConstrucao(
        preset.nome,
        preset.custo,
        preset.efeito,
        preset.diasParaConstruir,
        false
      );
      setShowAddBuilding(false);
    }
  };

  const handleCreateCustomBuilding = () => {
    if (!customBuildingName.trim()) return;
    adicionarConstrucao(
      customBuildingName.trim(),
      { madeira: 15, pedra: 10, ouro: 10 },
      customEffect.trim() || 'Benefício comunal',
      customDays,
      false
    );
    setCustomBuildingName('');
    setCustomEffect('');
    setShowAddBuilding(false);
  };

  const handleCreateRoute = () => {
    if (!routeDestino.trim()) return;
    adicionarRota(
      cidade.nome || 'Capital',
      routeDestino.trim(),
      routeProduto,
      routeFreq,
      routeLucro
    );
    setRouteDestino('');
    setShowAddRoute(false);
  };

  const recursosList: { key: keyof RecursosCidade; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'viveres', label: 'Víveres', icon: <Wheat className="w-3.5 h-3.5 text-emerald-400" />, color: 'emerald' },
    { key: 'ouro', label: 'Ouro', icon: <Coins className="w-3.5 h-3.5 text-amber-400" />, color: 'amber' },
    { key: 'madeira', label: 'Madeira', icon: <Trees className="w-3.5 h-3.5 text-amber-600" />, color: 'amber' },
    { key: 'pedra', label: 'Pedra', icon: <Building2 className="w-3.5 h-3.5 text-slate-400" />, color: 'slate' },
    { key: 'minerio', label: 'Minério', icon: <Pickaxe className="w-3.5 h-3.5 text-cyan-400" />, color: 'cyan' },
  ];

  return (
    <div className="space-y-4">
      {/* Nome da Cidade & Ações Rápidas */}
      <div className="rounded-2xl glass-panel-elevated p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1 mr-2">
              <input
                type="text"
                value={nomeTemp}
                onChange={(e) => setNomeTemp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="w-full px-2.5 py-1 text-sm font-bold rounded-lg bg-black/60 border border-amber-400 text-white focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Salvar
              </button>
            </div>
          ) : (
            <div
              onClick={() => {
                setNomeTemp(cidade.nome);
                setIsEditingName(true);
              }}
              className="cursor-pointer group flex items-center gap-2"
              title="Clique para renomear a cidade"
            >
              <h2 className="text-base font-black text-white tracking-wide group-hover:text-amber-400 transition-colors">
                {cidade.nome || 'Feudo Sem Nome'}
              </h2>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-300">✎</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {cidade.populacao === 0 && (
              <button
                type="button"
                onClick={carregarCidadeModelo}
                className="px-2 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-400/30 text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition"
                title="Carregar exemplo pré-configurado de Valesplendor"
              >
                <Sparkles className="w-3 h-3" />
                <span className="hidden sm:inline">Exemplo</span>
              </button>
            )}
            <button
              type="button"
              onClick={zerarCidade}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
              title="Zerar Ficha de Cidade"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* População */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-slate-300">
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                População
              </div>
              <div className="text-sm font-black text-white font-mono">
                {cidade.populacao} <span className="text-[10px] font-normal text-slate-400">hab.</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => atualizarAtributo('populacao', -10)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 active:scale-95"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => atualizarAtributo('populacao', 10)}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 active:scale-95"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Recursos Primários (Grid) */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Recursos da Cidade
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recursosList.map((rec) => {
              const valor = cidade.recursos[rec.key];
              return (
                <div
                  key={rec.key}
                  className="flex items-center justify-between p-2 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded-md bg-white/5 shrink-0">
                      {rec.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-[10px] text-slate-400 leading-none">
                        {rec.label}
                      </div>
                      <div className="text-xs font-black text-white font-mono mt-0.5 tabular-nums">
                        {valor}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => atualizarRecurso(rec.key, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-white/5 hover:bg-white/15 text-slate-300 text-xs active:scale-95"
                    >
                      -
                    </button>
                    <button
                      type="button"
                      onClick={() => atualizarRecurso(rec.key, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded bg-white/5 hover:bg-white/15 text-slate-300 text-xs active:scale-95"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => atualizarRecurso(rec.key, 5)}
                      className="px-1.5 h-6 flex items-center justify-center rounded bg-white/10 hover:bg-white/20 text-cyan-300 text-[10px] font-bold active:scale-95"
                      title="+5"
                    >
                      +5
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Indicadores Estratégicos (Estabilidade, Moral, Defesa, Indústria) */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Indicadores Estratégicos
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Estabilidade */}
            <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Estabilidade</span>
                <span className="font-mono font-bold text-cyan-400">{cidade.estabilidade}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all"
                  style={{ width: `${cidade.estabilidade}%` }}
                />
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => atualizarAtributo('estabilidade', -5)}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 text-slate-300"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => atualizarAtributo('estabilidade', 5)}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 text-slate-300"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Moral */}
            <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Smile className="w-3 h-3 text-amber-400" /> Moral
                </span>
                <span className="font-mono font-bold text-amber-400">{cidade.moral}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all"
                  style={{ width: `${cidade.moral}%` }}
                />
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => atualizarAtributo('moral', -5)}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 text-slate-300"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => atualizarAtributo('moral', 5)}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 text-slate-300"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Defesa */}
            <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-400" /> Defesa
                </span>
                <span className="font-mono font-bold text-purple-400">{cidade.defesa}%</span>
              </div>
              <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-purple-400 h-full rounded-full transition-all"
                  style={{ width: `${cidade.defesa}%` }}
                />
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => atualizarAtributo('defesa', -5)}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 text-slate-300"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => atualizarAtributo('defesa', 5)}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 text-slate-300"
                >
                  +5
                </button>
              </div>
            </div>

            {/* Indústria (0 a 5) */}
            <div className="p-2 rounded-xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 flex items-center gap-1">
                  <Hammer className="w-3 h-3 text-emerald-400" /> Indústria
                </span>
                <span className="font-mono font-bold text-emerald-400">Nv. {cidade.industria}/5</span>
              </div>
              <div className="flex gap-1 pt-0.5">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      level <= cidade.industria ? 'bg-emerald-400' : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <button
                  type="button"
                  onClick={() => atualizarAtributo('industria', -1)}
                  disabled={cidade.industria <= 0}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 disabled:opacity-30 text-slate-300"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => atualizarAtributo('industria', 1)}
                  disabled={cidade.industria >= 5}
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 hover:bg-white/15 disabled:opacity-30 text-slate-300"
                >
                  +1
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Construções da Cidade */}
      <div className="rounded-2xl glass-panel-elevated p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Construções ({cidade.construcoes.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddBuilding(!showAddBuilding)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold border border-amber-500/30 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Adicionar</span>
          </button>
        </div>

        {/* Formulário / Presets de Construção */}
        {showAddBuilding && (
          <div className="p-3 rounded-xl bg-black/60 border border-amber-500/30 space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">
                Escolher Construção Predefinida:
              </label>
              <select
                value={selectedPresetIdx}
                onChange={(e) => setSelectedPresetIdx(parseInt(e.target.value, 10))}
                className="w-full px-2 py-1.5 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
              >
                {REGRAS_TURNOS.construcoesPredefinidas.map((preset, idx) => (
                  <option key={idx} value={idx}>
                    {preset.nome} ({preset.diasParaConstruir}d)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateBuildingFromPreset}
                className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
              >
                Adicionar Selecionada
              </button>
            </div>

            {/* Alternativa personalizada */}
            <div className="pt-2 border-t border-white/10 space-y-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">
                Ou criar obra customizada:
              </div>
              <input
                type="text"
                placeholder="Nome da construção..."
                value={customBuildingName}
                onChange={(e) => setCustomBuildingName(e.target.value)}
                className="w-full px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
              />
              <input
                type="text"
                placeholder="Efeito ou benefício..."
                value={customEffect}
                onChange={(e) => setCustomEffect(e.target.value)}
                className="w-full px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">Dias:</span>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value, 10) || 7)}
                  className="w-16 px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateCustomBuilding}
                  className="flex-1 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                >
                  Criar Custom
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Construções */}
        <div className="space-y-2">
          {cidade.construcoes.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic p-2 text-center">
              Nenhuma construção registrada ainda.
            </p>
          ) : (
            cidade.construcoes.map((c) => (
              <div
                key={c.id}
                className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{c.nome}</span>
                  <div className="flex items-center gap-1.5">
                    {c.status === 'concluida' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Concluída
                      </span>
                    ) : c.status === 'em_obras' ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {c.diasRestantes}d restantes
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300">
                        Planejada
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => removerConstrucao(c.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-400"
                      title="Remover"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-tight">{c.efeito}</p>

                {c.status === 'planejada' && (
                  <button
                    type="button"
                    onClick={() => iniciarObra(c.id)}
                    className="w-full mt-1 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Play className="w-3 h-3" /> Iniciar Obras ({c.diasTotais} dias)
                  </button>
                )}

                {c.status === 'em_obras' && (
                  <button
                    type="button"
                    onClick={() => concluirObra(c.id)}
                    className="w-full mt-1 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-[10px] font-bold transition"
                  >
                    Finalizar Imediatamente
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rotas Comerciais */}
      <div className="rounded-2xl glass-panel-elevated p-4 border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Rotas Comerciais ({cidade.rotas.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddRoute(!showAddRoute)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[11px] font-bold border border-cyan-500/30 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Nova Rota</span>
          </button>
        </div>

        {/* Formulário de Rota */}
        {showAddRoute && (
          <div className="p-3 rounded-xl bg-black/60 border border-cyan-500/30 space-y-2 text-xs">
            <input
              type="text"
              placeholder="Destino (ex.: Porto Real, Vila Velha)..."
              value={routeDestino}
              onChange={(e) => setRouteDestino(e.target.value)}
              className="w-full px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
            />
            <input
              type="text"
              placeholder="Produto negociado (ex.: Lã, Vinho, Ferro)..."
              value={routeProduto}
              onChange={(e) => setRouteProduto(e.target.value)}
              className="w-full px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Lucro Est. (Ouro):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={routeLucro}
                  onChange={(e) => setRouteLucro(parseInt(e.target.value, 10) || 5)}
                  className="w-full px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Frequência:</label>
                <select
                  value={routeFreq}
                  onChange={(e) => setRouteFreq(e.target.value as any)}
                  className="w-full px-2 py-1 rounded-lg bg-black/70 border border-white/15 text-white text-xs"
                >
                  <option value="semanal">Semanal</option>
                  <option value="quinzenal">Quinzenal</option>
                  <option value="mensal">Mensal</option>
                </select>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreateRoute}
              className="w-full py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs"
            >
              Criar Rota Comercial
            </button>
          </div>
        )}

        {/* Lista de Rotas */}
        <div className="space-y-2">
          {cidade.rotas.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic p-2 text-center">
              Nenhuma rota comercial aberta.
            </p>
          ) : (
            cidade.rotas.map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{r.origem}</span>
                    <span className="text-cyan-400">➔</span>
                    <span>{r.destino}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {r.produto} · {r.frequencia} · <span className="text-amber-400 font-mono font-bold">+{r.lucroEstimadoOuro} Ouro</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => alternarStatusRota(r.id)}
                    className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                      r.ativa
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {r.ativa ? 'Ativa' : 'Pausada'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removerRota(r.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
