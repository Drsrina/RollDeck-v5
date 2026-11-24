import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Coins,
  Compass,
  Copy,
  Dices,
  Download,
  Droplets,
  Flag,
  Flame,
  Hash,
  Heart,
  RefreshCw,
  RotateCcw,
  Shield,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Zap,
} from 'lucide-react';
import {
  BIOMAS_ENCONTRO,
  BiomaEncontro,
  DificuldadeEncontroFlex,
  EncontroGerado,
  FocoEncontro,
  LootEncontro,
  ReacaoD20,
  ResultadoRolagemAtaque,
  ResultadoTesteMoral,
  SISTEMAS_ENCONTRO,
  SistemaEncontro,
  exportarEncontroMarkdown,
  gerarEncontroAleatorio,
  gerarLootEncontro,
  normalizarDificuldadeParaSistema,
  rolarAtaqueEDano,
  rolarReacaoD20,
  rolarTesteMoral,
} from '../../lib/forja/encounterGenerator';
import { deriveSubSeed } from '../../lib/forja/prng';
import { useAppStore } from '../../store/useAppStore';
import { useVttStore } from '../../store/useVttStore';

interface ForjaEncontrosPanelProps {
  rootSeed: number;
  initialBioma?: BiomaEncontro;
}

interface IniciativaRoll {
  criaturaNome: string;
  d20: number;
  mod: number;
  total: number;
  timestamp: string;
}

const DIFICULDADE_STYLES: Record<string, string> = {
  baixa: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  facil: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  moderada: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
  medio: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/30',
  alta: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
  dificil: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
  mortal: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
};

const REACAO_STYLES: Record<ReacaoD20['categoria'], string> = {
  Hostil: 'text-rose-300 bg-rose-500/15 border-rose-500/35',
  Desconfiado: 'text-amber-300 bg-amber-500/15 border-amber-500/35',
  Incerto: 'text-slate-200 bg-white/10 border-white/20',
  Curioso: 'text-cyan-300 bg-cyan-500/15 border-cyan-500/35',
  Amigável: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35',
};

export const ForjaEncontrosPanel: React.FC<ForjaEncontrosPanelProps> = ({
  rootSeed,
  initialBioma,
}) => {
  const [sistema, setSistema] = useState<SistemaEncontro>('dnd55');
  const [seedEncontros, setSeedEncontros] = useState<number>(() =>
    deriveSubSeed(rootSeed, 'encontros', '2.0.0')
  );
  const [nivelGrupo, setNivelGrupo] = useState<number>(3);
  const [tamanhoGrupo, setTamanhoGrupo] = useState<number>(4);
  const [dificuldade, setDificuldade] = useState<DificuldadeEncontroFlex>('moderada');
  const [bioma, setBioma] = useState<BiomaEncontro>(initialBioma || 'floresta');
  const [foco, setFoco] = useState<FocoEncontro>('combate');
  const [quantidadeEncontros, setQuantidadeEncontros] = useState<number>(1);

  useEffect(() => {
    if (initialBioma) {
      setBioma(initialBioma);
    }
  }, [initialBioma]);

  // Override de loot e reação por encontro
  const [lootOverrides, setLootOverrides] = useState<Record<string, { counter: number; loot: LootEncontro }>>({});
  const [reacaoOverrides, setReacaoOverrides] = useState<Record<string, ReacaoD20>>({});

  // Histórico instantâneo de rolagens de combate (Ataque + Dano, Iniciativa e Moral)
  const [combatRolls, setCombatRolls] = useState<ResultadoRolagemAtaque[]>([]);
  const [initiativeRolls, setInitiativeRolls] = useState<IniciativaRoll[]>([]);
  const [moralRolls, setMoralRolls] = useState<ResultadoTesteMoral[]>([]);

  // Feedback de cópia
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleTrocarSistema = (novoSistema: SistemaEncontro) => {
    setSistema(novoSistema);
    setDificuldade((prev) => normalizarDificuldadeParaSistema(prev, novoSistema));
    setLootOverrides({});
    setReacaoOverrides({});
  };

  const encontros: EncontroGerado[] = useMemo(() => {
    const list: EncontroGerado[] = [];
    for (let i = 0; i < quantidadeEncontros; i++) {
      const subSeed = i === 0 ? seedEncontros : deriveSubSeed(seedEncontros, `enc_batch_${i}`);
      list.push(
        gerarEncontroAleatorio(subSeed, {
          nivelGrupo,
          tamanhoGrupo,
          dificuldade,
          bioma,
          sistema,
          foco,
        })
      );
    }
    return list;
  }, [seedEncontros, nivelGrupo, tamanhoGrupo, dificuldade, bioma, sistema, foco, quantidadeEncontros]);

  const setRecentForjaEncounters = useVttStore((s) => s.setRecentForjaEncounters);
  const importEncounterToVtt = useVttStore((s) => s.importEncounter);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  useEffect(() => {
    setRecentForjaEncounters(encontros);
  }, [encontros, setRecentForjaEncounters]);

  const handleEnviarParaVtt = (enc: EncontroGerado) => {
    importEncounterToVtt(enc, 'new-scene');
    setActiveTab('vtt');
  };

  const sistemaInfo = useMemo(
    () => SISTEMAS_ENCONTRO.find((s) => s.id === sistema) || SISTEMAS_ENCONTRO[0],
    [sistema]
  );

  const handleSortearSeed = () => {
    setSeedEncontros(Math.floor(Math.random() * 999999) + 1);
    setLootOverrides({});
    setReacaoOverrides({});
  };

  const handleSincronizarRaiz = () => {
    setSeedEncontros(deriveSubSeed(rootSeed, 'encontros', '2.0.0'));
    setLootOverrides({});
    setReacaoOverrides({});
  };

  const handleRolarAtaque = (criaturaNome: string, ataque: EncontroGerado['monstros'][0]['ataques'][0]) => {
    const res = rolarAtaqueEDano(criaturaNome, ataque);
    setCombatRolls((prev) => [res, ...prev.slice(0, 9)]);
  };

  const handleRolarIniciativa = (criaturaNome: string, mod: number) => {
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + mod;
    const timestamp = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setInitiativeRolls((prev) => [{ criaturaNome, d20, mod, total, timestamp }, ...prev.slice(0, 7)]);
  };

  const handleRolarMoral = (criaturaNome: string, moralAlvo: number) => {
    const res = rolarTesteMoral(criaturaNome, moralAlvo);
    setMoralRolls((prev) => [res, ...prev.slice(0, 7)]);
  };

  const handleRolarReacao = (encId: string) => {
    const nova = rolarReacaoD20();
    setReacaoOverrides((prev) => ({ ...prev, [encId]: nova }));
  };

  const handleRegerarLoot = (enc: EncontroGerado) => {
    const atual = lootOverrides[enc.id];
    const nextCounter = (atual?.counter || 0) + 1;
    const novaSeedLoot = deriveSubSeed(enc.seed, `loot_reroll_${nextCounter}_${Date.now() % 10000}`);
    const novoLoot = gerarLootEncontro(novaSeedLoot, enc.nivelGrupo, enc.dificuldadeAlvo);
    setLootOverrides((prev) => ({
      ...prev,
      [enc.id]: { counter: nextCounter, loot: novoLoot },
    }));
  };

  const handleCopiarMarkdown = (enc: EncontroGerado, lootAtual: LootEncontro, reacaoAtual: ReacaoD20) => {
    const md = exportarEncontroMarkdown({
      ...enc,
      loot: lootAtual,
      detalhesD20: { ...enc.detalhesD20, reacaoInicial: reacaoAtual },
    });
    navigator.clipboard.writeText(md);
    setCopiedId(`md_${enc.id}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleBaixarJSON = (enc: EncontroGerado, lootAtual: LootEncontro, reacaoAtual: ReacaoD20) => {
    const data = JSON.stringify(
      { ...enc, loot: lootAtual, detalhesD20: { ...enc.detalhesD20, reacaoInicial: reacaoAtual } },
      null,
      2
    );
    const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encontro_${enc.sistema}_${enc.bioma}_${enc.seed}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const opcoesDificuldade = useMemo(() => {
    if (sistema === 'dnd55') {
      return [
        { value: 'baixa', label: 'Baixa (Low · 2024)' },
        { value: 'moderada', label: 'Moderada (Moderate · 2024)' },
        { value: 'alta', label: 'Alta (High · 2024)' },
      ];
    }
    if (sistema === 'd20_fantasia') {
      return [
        { value: 'facil', label: 'Leve (DV Baixo)' },
        { value: 'medio', label: 'Padrão (Equilibrado)' },
        { value: 'dificil', label: 'Perigoso (Alto Risco)' },
        { value: 'mortal', label: 'Letal (Chefe / Horda)' },
      ];
    }
    return [
      { value: 'facil', label: 'Fácil (5e 2014)' },
      { value: 'medio', label: 'Médio (5e 2014)' },
      { value: 'dificil', label: 'Difícil (5e 2014)' },
      { value: 'mortal', label: 'Mortal (5e 2014)' },
    ];
  }, [sistema]);

  const temRolagensAtivas =
    combatRolls.length > 0 || initiativeRolls.length > 0 || moralRolls.length > 0;

  return (
    <section className="flex flex-col gap-5">
      {/* BARRA DE CONTROLE DE SISTEMA, SEMENTE E PARÂMETROS */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <Swords className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white">
                Gerador de Encontros de Fantasia (D&D 5.5 · 5e · d20)
              </h2>
              <p className="text-xs text-slate-400">{sistemaInfo.descricao}</p>
            </div>
          </div>

          {/* Controle de Seed Isolada */}
          <div className="flex flex-wrap items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-1.5 px-1.5">
              <Hash className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] font-mono text-slate-400">Seed:</span>
              <input
                type="number"
                value={seedEncontros}
                onChange={(e) => {
                  setSeedEncontros(Number(e.target.value) || 0);
                  setLootOverrides({});
                  setReacaoOverrides({});
                }}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-rose-300 text-center focus:outline-none focus:border-rose-400"
              />
            </div>

            <button
              type="button"
              onClick={handleSortearSeed}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-black font-black text-xs transition cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Novo Encontro</span>
            </button>

            <button
              type="button"
              onClick={handleSincronizarRaiz}
              title="Sincronizar com a Seed Raiz da Forja"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Raiz</span>
            </button>
          </div>
        </div>

        {/* Seletor de Sistema / Regras */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/50 border border-white/10">
            {SISTEMAS_ENCONTRO.map((sys) => {
              const ativo = sistema === sys.id;
              return (
                <button
                  key={sys.id}
                  type="button"
                  onClick={() => handleTrocarSistema(sys.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    ativo
                      ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.45)] font-black'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {sys.label}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Bestiário ND 1/8–20 ·{' '}
            {sistema === 'dnd55'
              ? 'Regra DMG 2024 (XP direto 1×)'
              : sistema === 'd20_fantasia'
              ? 'Reação 2d6 · Moral · DV/ND'
              : 'Regra 2014 (XP com multiplicador)'}
          </div>
        </div>

        {/* Grade de Parametrização */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Nível Médio do Grupo */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Nível Médio (1–20)
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={nivelGrupo}
              onChange={(e) => setNivelGrupo(Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Tamanho do Grupo */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Jogadores (1–8)
            </label>
            <input
              type="number"
              min={1}
              max={8}
              value={tamanhoGrupo}
              onChange={(e) => setTamanhoGrupo(Math.min(8, Math.max(1, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono font-bold text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Dificuldade */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Dificuldade
            </label>
            <select
              value={normalizarDificuldadeParaSistema(dificuldade, sistema)}
              onChange={(e) => setDificuldade(e.target.value as DificuldadeEncontroFlex)}
              className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {opcoesDificuldade.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bioma / Ambiente */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Bioma / Ambiente
            </label>
            <select
              value={bioma}
              onChange={(e) => setBioma(e.target.value as BiomaEncontro)}
              className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {BIOMAS_ENCONTRO.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900">
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* Foco do Encontro */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Estilo / Foco
            </label>
            <select
              value={foco}
              onChange={(e) => setFoco(e.target.value as FocoEncontro)}
              className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="combate" className="bg-slate-900">Combate Tático</option>
              <option value="misto" className="bg-slate-900">Misto (Combate + Cena)</option>
              <option value="exploracao" className="bg-slate-900">Social & Exploração</option>
            </select>
          </div>

          {/* Quantidade de Encontros */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Qtd. Encontros
            </label>
            <select
              value={quantidadeEncontros}
              onChange={(e) => setQuantidadeEncontros(Number(e.target.value))}
              className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value={1} className="bg-slate-900">1 Encontro Detalhado</option>
              <option value={2} className="bg-slate-900">2 Encontros (Rota)</option>
              <option value={3} className="bg-slate-900">3 Encontros (Viagem)</option>
              <option value={4} className="bg-slate-900">4 Encontros (Tabela)</option>
            </select>
          </div>
        </div>
      </div>

      {/* PAINEL DE ROLAGENS INSTANTÂNEAS DE COMBATE (Ataques, Dano, Iniciativa e Moral) */}
      {temRolagensAtivas && (
        <div className="p-4 rounded-2xl bg-[#0d0b1a] border border-cyan-500/30 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
              <Dices className="w-4 h-4" />
              <span>Mesa Rápida de Combate (Últimas Rolagens)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCombatRolls([]);
                setInitiativeRolls([]);
                setMoralRolls([]);
              }}
              className="text-[11px] text-slate-400 hover:text-white cursor-pointer"
            >
              Limpar Rolagens
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {combatRolls.map((roll, idx) => (
              <div
                key={`atk-${idx}-${roll.timestamp}`}
                className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 ${
                  roll.isCritico
                    ? 'bg-amber-950/40 border-amber-400/60'
                    : roll.isFalhaCritica
                    ? 'bg-rose-950/40 border-rose-500/50'
                    : 'bg-black/50 border-white/10'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white truncate">
                    {roll.criaturaNome} · <span className="text-cyan-300">{roll.ataqueNome}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{roll.timestamp}</span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Acerto:</span>
                    <span
                      className={`text-sm font-black tabular-nums ${
                        roll.isCritico
                          ? 'text-amber-300'
                          : roll.isFalhaCritica
                          ? 'text-rose-400'
                          : 'text-white'
                      }`}
                    >
                      {roll.totalAcerto}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      (d20={roll.d20Raw} {roll.bonusAcerto >= 0 ? `+${roll.bonusAcerto}` : roll.bonusAcerto})
                    </span>
                    {roll.isCritico && (
                      <span className="text-[10px] font-black text-amber-300 uppercase">CRÍTICO!</span>
                    )}
                    {roll.isFalhaCritica && (
                      <span className="text-[10px] font-black text-rose-400 uppercase">FALHA 1!</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">Dano:</span>
                    <span className="text-sm font-black text-rose-300 tabular-nums">
                      {roll.totalDano}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({roll.tipoDano} · [{roll.dadosRolados.join('+')}]{roll.bonusDano ? (roll.bonusDano > 0 ? `+${roll.bonusDano}` : roll.bonusDano) : ''})
                    </span>
                  </div>
                </div>

                {sistema === 'dnd55' && roll.efeitoExtra && (
                  <p className="text-[11px] text-amber-200/90 leading-snug pt-0.5 border-t border-white/5">
                    ✦ Efeito 5.5 ao acertar: {roll.efeitoExtra}
                  </p>
                )}
              </div>
            ))}

            {initiativeRolls.map((ini, idx) => (
              <div
                key={`ini-${idx}-${ini.timestamp}`}
                className="p-2.5 rounded-xl bg-black/50 border border-purple-500/30 text-xs flex items-center justify-between font-mono"
              >
                <span className="text-purple-200 font-sans font-bold">
                  Iniciativa · {ini.criaturaNome}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-purple-300 tabular-nums">{ini.total}</span>
                  <span className="text-[10px] text-slate-400">
                    (d20={ini.d20} {ini.mod >= 0 ? `+${ini.mod}` : ini.mod})
                  </span>
                </div>
              </div>
            ))}

            {moralRolls.map((mor, idx) => (
              <div
                key={`mor-${idx}-${mor.timestamp}`}
                className={`p-2.5 rounded-xl border text-xs flex flex-col gap-1 ${
                  mor.passou
                    ? 'bg-emerald-950/30 border-emerald-500/35'
                    : 'bg-rose-950/35 border-rose-500/45'
                }`}
              >
                <div className="flex items-center justify-between font-mono">
                  <span className="font-sans font-bold text-white">
                    Moral · {mor.criaturaNome}
                  </span>
                  <span className={mor.passou ? 'text-emerald-300 font-black' : 'text-rose-300 font-black'}>
                    2d6={mor.total} ({mor.dados[0]}+{mor.dados[1]}) vs {mor.moralAlvo}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{mor.desfecho}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTA DE ENCONTROS GERADOS */}
      <div className="space-y-6">
        {encontros.map((enc, encIndex) => {
          const difStyle = DIFICULDADE_STYLES[enc.dificuldadeReal] || DIFICULDADE_STYLES.medio;
          const lootAtual = lootOverrides[enc.id]?.loot || enc.loot;
          const reacaoAtual = reacaoOverrides[enc.id] || enc.detalhesD20.reacaoInicial;
          const reacaoStyle = REACAO_STYLES[reacaoAtual.categoria];

          return (
            <article
              key={enc.id}
              className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 sm:p-5 space-y-5"
            >
              {/* Cabeçalho do Encontro */}
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 pb-3 border-b border-white/10">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-rose-300 font-bold">#{encIndex + 1}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-cyan-300 font-semibold">{enc.sistemaLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{enc.biomaLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Grupo Nv. {enc.nivelGrupo} ({enc.tamanhoGrupo} PJ)
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${difStyle}`}>
                      {enc.dificuldadeLabel}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-white tracking-tight">
                    {enc.titulo}
                  </h3>
                </div>

                {/* Bloco de Métricas do Sistema + Exportação */}
                <div className="flex flex-wrap items-center gap-2">
                  {enc.sistema === 'dnd55' && (
                    <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-cyan-500/25 text-xs font-mono tabular-nums flex items-center gap-3">
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">XP Total (2024)</span>
                        <span className="font-black text-emerald-300">{enc.xpBaseTotal} XP</span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">Orçamento Alvo</span>
                        <span className="font-black text-amber-300">{enc.orcamentoXpAlvo} XP</span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">Por Jogador</span>
                        <span className="font-black text-cyan-300">{enc.xpPorJogador} XP</span>
                      </div>
                    </div>
                  )}

                  {enc.sistema === 'dnd5e' && (
                    <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/10 text-xs font-mono tabular-nums flex items-center gap-3">
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">XP Base</span>
                        <span className="font-black text-emerald-300">{enc.xpBaseTotal} XP</span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">
                          Ajustado (x{enc.multiplicadorGrupo})
                        </span>
                        <span className="font-black text-amber-300">{enc.xpAjustadoTotal} XP</span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">Por Jogador</span>
                        <span className="font-black text-cyan-300">{enc.xpPorJogador} XP</span>
                      </div>
                    </div>
                  )}

                  {enc.sistema === 'd20_fantasia' && (
                    <div className="px-3 py-1.5 rounded-xl bg-black/50 border border-amber-500/25 text-xs font-mono tabular-nums flex items-center gap-3">
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">DV Totais</span>
                        <span className="font-black text-amber-300">{enc.detalhesD20.dvTotalInimigos} DV</span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">Distância</span>
                        <span className="font-black text-cyan-300">{enc.detalhesD20.distanciaMetros}m</span>
                      </div>
                      <div className="h-6 w-px bg-white/10" />
                      <div>
                        <span className="text-slate-400 text-[10px] block leading-none">XP Total</span>
                        <span className="font-black text-emerald-300">{enc.xpBaseTotal} XP</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleEnviarParaVtt(enc)}
                    className="px-3 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/45 text-cyan-200 text-xs font-black flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                    title="Criar cena no Tabuleiro VTT com todos os monstros deste encontro"
                  >
                    <Swords className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Enviar ao VTT</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopiarMarkdown(enc, lootAtual, reacaoAtual)}
                    className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="Copiar Encontro em Markdown"
                  >
                    {copiedId === `md_${enc.id}` ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span className="hidden sm:inline">
                      {copiedId === `md_${enc.id}` ? 'Copiado!' : 'Markdown'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBaixarJSON(enc, lootAtual, reacaoAtual)}
                    className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    title="Exportar Encontro em JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span className="hidden sm:inline">JSON</span>
                  </button>
                </div>
              </div>

              {/* Bloco Especial Fantasia d20: Reação (2d6), Distância e Surpresa */}
              {enc.sistema === 'd20_fantasia' && (
                <div className="p-3.5 rounded-xl bg-amber-950/15 border border-amber-500/25 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">
                        Procedimento d20 / OSR
                      </span>
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${reacaoStyle}`}>
                        Reação 2d6 = {reacaoAtual.total} ({reacaoAtual.dados[0]}+{reacaoAtual.dados[1]}) · {reacaoAtual.categoria}
                      </span>
                    </div>
                    <p className="text-slate-200">{reacaoAtual.descricao}</p>
                    <p className="text-[11px] text-slate-400">
                      <strong className="text-slate-300">Surpresa:</strong> {enc.detalhesD20.surpresa}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRolarReacao(enc.id)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/40 text-amber-200 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 self-start md:self-center"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Re-rolar Reação (2d6)</span>
                  </button>
                </div>
              )}

              {/* Ambientação Tática, Motivação e Resolução Alternativa */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    Terreno & Cobertura Tática
                  </span>
                  <p className="text-slate-300 leading-relaxed">{enc.ambientacaoTatica}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                    Comportamento & Motivação
                  </span>
                  <p className="text-slate-300 leading-relaxed">{enc.motivacaoInimigos}</p>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Resolução Sem Combate
                  </span>
                  <p className="text-slate-300 leading-relaxed">{enc.resolucaoAlternativa}</p>
                </div>
              </div>

              {/* Cena Social / Exploração / Perigo Ambiental */}
              {enc.cenaNaoCombate && (
                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/25 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/15 pb-2">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-black text-cyan-200 uppercase tracking-wider">
                        Cena de {enc.cenaNaoCombate.tipo}: {enc.cenaNaoCombate.protagonistaOuFoco}
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-200 leading-relaxed">{enc.cenaNaoCombate.situacao}</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {enc.cenaNaoCombate.testesSugeridos.map((t, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-black/45 border border-white/10 space-y-1">
                        <div className="flex items-center justify-between font-mono">
                          <span className="font-bold text-cyan-300">{t.pericia}</span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-200 font-black">
                            CD {t.cd}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">{t.sucesso}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-rose-950/25 border border-rose-500/25 text-rose-200">
                      <strong>Se falharem:</strong> {enc.cenaNaoCombate.consequenciaFalha}
                    </div>
                    <div className="p-2.5 rounded-lg bg-emerald-950/25 border border-emerald-500/25 text-emerald-200">
                      <strong>Recompensa:</strong> {enc.cenaNaoCombate.recompensaNarrativa}
                    </div>
                  </div>
                </div>
              )}

              {/* Fichas dos Monstros / Inimigos (ocultas apenas no foco puramente exploração) */}
              {enc.foco !== 'exploracao' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Skull className="w-4 h-4 text-rose-400" />
                    <span>Inimigos & Estatísticas de Combate</span>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {enc.monstros.map((monstro) => (
                      <div
                        key={monstro.id}
                        className="p-4 rounded-xl bg-black/50 border border-white/10 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          {/* Nome, Quantidade, Papel Tático, ND e Botões de Iniciativa / Moral */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono font-black text-xs">
                                  {monstro.quantidade}x
                                </span>
                                <h4 className="text-sm font-black text-white">{monstro.nome}</h4>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 bg-white/10 px-1.5 py-0.5 rounded">
                                  {monstro.papelTatico}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">
                                {monstro.tipoExibicao} · ND <strong className="text-slate-200">{monstro.cr}</strong>
                                {enc.sistema === 'd20_fantasia' ? (
                                  <>
                                    {' '}· <strong className="text-amber-300">{monstro.dv} DV</strong> · Moral{' '}
                                    <strong className="text-cyan-300">{monstro.moralD20}</strong>
                                  </>
                                ) : (
                                  <>
                                    {' '}· <span className="font-mono text-emerald-300">{monstro.xp} XP cada</span>{' '}
                                    ({monstro.xpTotal} XP total)
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {enc.sistema === 'd20_fantasia' && (
                                <button
                                  type="button"
                                  onClick={() => handleRolarMoral(monstro.nome, monstro.moralD20)}
                                  className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1"
                                  title="Testar Moral (2d6 <= Moral)"
                                >
                                  <Flag className="w-3 h-3" />
                                  <span>Moral {monstro.moralD20}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleRolarIniciativa(monstro.nome, monstro.iniciativaAtiva)}
                                className="px-2 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-[11px] font-mono font-bold transition cursor-pointer"
                                title={
                                  enc.sistema === 'dnd55'
                                    ? `Iniciativa 5.5: 1d20 ${monstro.iniciativaAtiva >= 0 ? '+' : ''}${monstro.iniciativaAtiva} (Valor fixo: ${monstro.iniciativaFixa55})`
                                    : 'Rolar Iniciativa (1d20 + Mod)'
                                }
                              >
                                Init {monstro.iniciativaAtiva >= 0 ? `+${monstro.iniciativaAtiva}` : monstro.iniciativaAtiva}
                                {enc.sistema === 'dnd55' && ` (${monstro.iniciativaFixa55})`}
                              </button>
                            </div>
                          </div>

                          {/* Linha de CA, PV (+ Sangrando 5.5) e Deslocamento */}
                          <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/5 flex items-center gap-2">
                              <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
                              <div>
                                <span className="text-[9px] text-slate-400 block uppercase">CA</span>
                                <span className="font-black text-white text-sm">{monstro.ca}</span>
                              </div>
                            </div>

                            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/5 flex items-center gap-2">
                              <Heart className="w-4 h-4 text-rose-400 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[9px] text-slate-400 block uppercase">
                                  {enc.sistema === 'dnd55' ? `PV (Sangr. ≤${monstro.pvSangrando})` : 'PV'}
                                </span>
                                <span className="font-black text-white text-sm">
                                  {monstro.pvMedio}{' '}
                                  <span className="text-[10px] font-normal text-slate-400">
                                    ({monstro.formulaPv})
                                  </span>
                                </span>
                              </div>
                            </div>

                            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/5 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-[9px] text-slate-400 block uppercase">Desl.</span>
                                <span className="font-bold text-white text-[11px] truncate block">
                                  {monstro.deslocamento}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Gatilho especial Sangrando (D&D 5.5) */}
                          {enc.sistema === 'dnd55' && monstro.efeitoSangrando && (
                            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-[11px] text-rose-200 flex items-start gap-2">
                              <Droplets className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                              <span>
                                <strong>Sangrando (≤{monstro.pvSangrando} PV):</strong> {monstro.efeitoSangrando}
                              </span>
                            </div>
                          )}

                          {/* Ataques, Bônus de Acerto, Dados e Dano Médio + Rolagem 1 Clique */}
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Ataques & Ações (1 clique para rolar)
                            </div>
                            <div className="space-y-1.5">
                              {monstro.ataques.map((atk, aIdx) => (
                                <div
                                  key={aIdx}
                                  className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <div className="text-xs space-y-0.5">
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      <Sword className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                      <span>{atk.nome}</span>
                                      {atk.alcance && (
                                        <span className="text-[10px] text-slate-400 font-normal">
                                          ({atk.alcance})
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-300 tabular-nums">
                                      Acerto:{' '}
                                      <strong className="text-cyan-300">
                                        {atk.acerto >= 0 ? `+${atk.acerto}` : atk.acerto}
                                      </strong>{' '}
                                      · Dano:{' '}
                                      <strong className="text-rose-300">{atk.dadosDano}</strong>{' '}
                                      <span className="text-slate-400">
                                        (méd. {atk.danoMedio} {atk.tipoDano})
                                      </span>
                                    </div>
                                    {enc.sistema === 'dnd55' && atk.efeito55 && (
                                      <div className="text-[11px] text-amber-200/90 leading-snug">
                                        ✦ {atk.efeito55}
                                      </div>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRolarAtaque(monstro.nome, atk)}
                                    className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/40 text-cyan-200 font-bold text-[11px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
                                  >
                                    <Dices className="w-3.5 h-3.5" />
                                    <span>Rolar Ataque + Dano</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Magias e Habilidades Especiais */}
                          {monstro.habilidadesEMagias.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                <Flame className="w-3 h-3 text-purple-400" />
                                <span>Magias & Habilidades Especiais</span>
                              </div>
                              <div className="space-y-1.5">
                                {monstro.habilidadesEMagias.map((hab, hIdx) => (
                                  <div
                                    key={hIdx}
                                    className="p-2 rounded-lg bg-purple-950/20 border border-purple-500/20 text-[11px]"
                                  >
                                    <div className="font-bold text-purple-200 flex items-center gap-1.5">
                                      <span>{hab.nome}</span>
                                      {hab.circulo && (
                                        <span className="text-[10px] font-mono text-purple-400">
                                          · {hab.circulo}
                                        </span>
                                      )}
                                      {hab.cd && (
                                        <span className="text-[10px] font-mono text-amber-300">
                                          · CD {hab.cd}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-slate-300 mt-0.5 leading-snug">{hab.descricao}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção de Loot & Tesouro com Botão de 1 Clique */}
              <div className="p-4 rounded-xl bg-amber-950/15 border border-amber-500/25 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Coins className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Tesouro & Loot do Encontro
                    </span>
                    <span className="text-[11px] font-mono text-amber-200/80">
                      · {lootAtual.moedas.po} PO, {lootAtual.moedas.pp} PP, {lootAtual.moedas.pc} PC
                      (~{lootAtual.moedas.valorTotalPO} PO)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRegerarLoot(enc)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer self-start sm:self-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Gerar Novo Loot (1 Clique)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {lootAtual.itens.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-black/50 border border-white/10 space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-white leading-tight">{item.nome}</span>
                        <span className="font-mono text-amber-300 font-bold shrink-0">
                          {item.valorPO} PO
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.categoria} · <span className="text-cyan-300">{item.raridade}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {item.descricaoMecanica}
                      </p>
                      {item.propriedadeMagica && (
                        <p className="text-[11px] text-purple-300 font-medium leading-snug">
                          ✦ {item.propriedadeMagica}
                        </p>
                      )}
                      {item.isAmaldicoado && item.maldicaoTexto && (
                        <p className="text-[11px] text-rose-400 font-semibold leading-snug">
                          ☠ Maldição: {item.maldicaoTexto}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
