import React, { useMemo, useState } from 'react';
import {
  Castle,
  Compass,
  Dices,
  Hash,
  Home,
  Map as MapIcon,
  RefreshCw,
  RotateCcw,
  Scroll,
  Shield,
  Sparkles,
  Sword,
  Swords,
  Users,
  Zap,
} from 'lucide-react';
import { ForjaAssentamentoTab } from '../components/forja/ForjaAssentamentoTab';
import { ForjaEncontrosPanel } from '../components/forja/ForjaEncontrosPanel';
import { ForjaFantasiaTab } from '../components/forja/ForjaFantasiaTab';
import { ForjaItensTab } from '../components/forja/ForjaItensTab';
import { ForjaMarkovTab } from '../components/forja/ForjaMarkovTab';
import { ForjaMasmorraTab } from '../components/forja/ForjaMasmorraTab';
import { ForjaMundoTab } from '../components/forja/ForjaMundoTab';
import { ForjaNpcTab } from '../components/forja/ForjaNpcTab';
import { ForjaSessaoAoVivoTab } from '../components/forja/ForjaSessaoAoVivoTab';
import { ForjaTerrenoTab } from '../components/forja/ForjaTerrenoTab';
import type { AlgoritmoLayout, DificuldadeEncontro, DungeonResult } from '../lib/forja/dungeonGenerator';
import { gerarMasmorra } from '../lib/forja/dungeonGenerator';
import type { BiomaEncontro } from '../lib/forja/encounterGenerator';
import { exportarJSON, exportarMarkdown, exportarTSV } from '../lib/forja/export';
import type { SubcategoriaFantasia } from '../lib/forja/fantasyGenerator';
import { gerarLoteElementosFantasia } from '../lib/forja/fantasyGenerator';
import type { CategoriaItem, ItemGerado, RaridadeItem } from '../lib/forja/itemGenerator';
import { gerarItem, gerarLoteItens } from '../lib/forja/itemGenerator';
import { gerarLoteNomesMarkov, KITS_MARKOV_DISPONIVEIS } from '../lib/forja/markovNames';
import type { NPCEntry } from '../lib/forja/npcGenerator';
import { gerarLoteNPCs, gerarNPC } from '../lib/forja/npcGenerator';
import type { MundoCompletoResult } from '../lib/forja/pipeline';
import { gerarMundoCompleto } from '../lib/forja/pipeline';
import { DeterministicRNG, deriveSubSeed } from '../lib/forja/prng';
import type { AlgoritmoAssentamento, SettlementResult, TamanhoAssentamento } from '../lib/forja/settlementGenerator';
import { gerarAssentamento } from '../lib/forja/settlementGenerator';
import { TableEngine } from '../lib/forja/tableEngine';
import { TABELAS_CANONICAS } from '../lib/forja/tablesData';
import type { TerrenoResult, TopologiaTerreno } from '../lib/forja/terrainGenerator';
import { gerarTerreno } from '../lib/forja/terrainGenerator';

export type SubAbaForja =
  | 'mundo'
  | 'terreno'
  | 'masmorra'
  | 'encontros'
  | 'assentamento'
  | 'npcs'
  | 'itens'
  | 'markov_names'
  | 'gerador_fantasia'
  | 'sessao_ao_vivo';

export const ForjaScreen: React.FC = () => {
  const [subAba, setSubAba] = useState<SubAbaForja>('mundo');
  const [rootSeed, setRootSeed] = useState<number>(42);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // SEEDS INDEPENDENTES POR MÓDULO (§1.2: sub-seeds isoladas)
  const [seedTerreno, setSeedTerreno] = useState<number>(() => deriveSubSeed(42, 'terreno', '1.0.0'));
  const [seedMasmorra, setSeedMasmorra] = useState<number>(() => deriveSubSeed(42, 'masmorra', '1.1.0'));
  const [seedAssentamento, setSeedAssentamento] = useState<number>(() => deriveSubSeed(42, 'assentamento', '1.0.3'));
  const [seedNPCs, setSeedNPCs] = useState<number>(() => deriveSubSeed(42, 'npc', '1.0.0'));
  const [seedNPCIndividual, setSeedNPCIndividual] = useState<number>(1042);
  const [seedItens, setSeedItens] = useState<number>(() => deriveSubSeed(42, 'itens', '1.0.0'));
  const [seedItemIndividual, setSeedItemIndividual] = useState<number>(2042);

  // Parâmetros de Terreno
  const [topologiaTerreno] = useState<TopologiaTerreno>('hex');

  // Parâmetros de Masmorra
  const [layoutMasmorra, setLayoutMasmorra] = useState<AlgoritmoLayout>('donjon');
  const [nivelGrupoMasmorra, setNivelGrupoMasmorra] = useState<number>(3);
  const [dificuldadeMasmorra, setDificuldadeMasmorra] = useState<DificuldadeEncontro>('medio');
  const [temaMasmorraCustom, setTemaMasmorraCustom] = useState<string>('');

  // Parâmetros de Assentamento
  const [tamanhoAssentamento, setTamanhoAssentamento] = useState<TamanhoAssentamento>('vila');
  const [algoritmoAssentamento] = useState<AlgoritmoAssentamento>('voronoi_distritos');
  const [temRioAssentamento, setTemRioAssentamento] = useState<boolean>(true);
  const [temColinaAssentamento, setTemColinaAssentamento] = useState<boolean>(true);
  const [temEstradaAssentamento, setTemEstradaAssentamento] = useState<boolean>(true);
  const [nomeAssentamentoCustom, setNomeAssentamentoCustom] = useState<string>('');

  // Parâmetros de NPCs
  const [modoNPC, setModoNPC] = useState<'lote' | 'individual'>('lote');
  const [qtdNPCs, setQtdNPCs] = useState<number>(6);
  const [npcRacaFiltro, setNpcRacaFiltro] = useState<string>('Qualquer');
  const [npcGeneroFiltro] = useState<'todos' | 'm' | 'f'>('todos');
  const [npcOcupacaoFiltro, setNpcOcupacaoFiltro] = useState<string>('Qualquer');

  // Parâmetros de Itens & Tesouros
  const [modoItem, setModoItem] = useState<'lote' | 'individual'>('lote');
  const [qtdItens, setQtdItens] = useState<number>(6);
  const [itemCategoriaFiltro, setItemCategoriaFiltro] = useState<CategoriaItem | 'Qualquer'>('Qualquer');
  const [itemRaridadeFiltro, setItemRaridadeFiltro] = useState<RaridadeItem | 'Qualquer'>('Qualquer');
  const [itemPermitirMaldicao, setItemPermitirMaldicao] = useState<boolean>(true);

  // Estados de seleção interativa
  const [selectedCellId, setSelectedCellId] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [expandedNpcId, setExpandedNpcId] = useState<string | null>(null);
  const [biomaEncontroSelecionado, setBiomaEncontroSelecionado] = useState<BiomaEncontro | undefined>(undefined);

  // Controle de camadas do visualizador de terreno (§4.5)
  const [showBiomes, setShowBiomes] = useState(true);
  const [showRivers, setShowRivers] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [showSettlements, setShowSettlements] = useState(true);

  // Estado para Sessão ao Vivo (GM instant rolls)
  const [sessaoLog, setSessaoLog] = useState<{ id: string; tipo: string; texto: string; hora: string }[]>([
    {
      id: 'init_1',
      tipo: 'Boas-vindas',
      texto: 'Forja de Mundos pronta. 100% determinístico, zero IA. Cada módulo e item possui controle de semente individual.',
      hora: 'Agora',
    },
  ]);

  const tableEngine = useMemo(() => new TableEngine(TABELAS_CANONICAS), []);

  // 1. Geração do Mundo Completo integrado (Pipeline determinístico via rootSeed)
  const mundo: MundoCompletoResult = useMemo(() => {
    return gerarMundoCompleto(rootSeed);
  }, [rootSeed]);

  // 2. Geração isolada de Terreno com seed próprio
  const terrenoIsolado: TerrenoResult = useMemo(() => {
    return gerarTerreno(seedTerreno, { topologia: topologiaTerreno });
  }, [seedTerreno, topologiaTerreno]);

  // 3. Geração isolada de Masmorra com seed próprio
  const masmorraIsolada: DungeonResult = useMemo(() => {
    return gerarMasmorra(seedMasmorra, {
      algoritmoLayout: layoutMasmorra,
      nivelGrupo: nivelGrupoMasmorra,
      dificuldade: dificuldadeMasmorra,
      tema: temaMasmorraCustom.trim() || undefined,
    });
  }, [seedMasmorra, layoutMasmorra, nivelGrupoMasmorra, dificuldadeMasmorra, temaMasmorraCustom]);

  // 4. Geração isolada de Assentamento com seed próprio
  const assentamentoIsolado: SettlementResult = useMemo(() => {
    return gerarAssentamento(seedAssentamento, {
      nome: nomeAssentamentoCustom.trim() || undefined,
      tamanho: tamanhoAssentamento,
      algoritmo: algoritmoAssentamento,
      temRio: temRioAssentamento,
      temColina: temColinaAssentamento,
      temEstradaPrincipal: temEstradaAssentamento,
    });
  }, [
    seedAssentamento,
    nomeAssentamentoCustom,
    tamanhoAssentamento,
    algoritmoAssentamento,
    temRioAssentamento,
    temColinaAssentamento,
    temEstradaAssentamento,
  ]);

  // 5. Geração isolada de Lote de NPCs com seed próprio
  const loteNPCsIsolado: NPCEntry[] = useMemo(() => {
    return gerarLoteNPCs(seedNPCs, qtdNPCs);
  }, [seedNPCs, qtdNPCs]);

  // 6. Geração de NPC Individual isolado com seed próprio
  const npcIndividual: NPCEntry = useMemo(() => {
    return gerarNPC(seedNPCIndividual, {
      id: `npc_ind_${seedNPCIndividual}`,
      raca: npcRacaFiltro !== 'Qualquer' ? npcRacaFiltro : undefined,
      genero: npcGeneroFiltro !== 'todos' ? npcGeneroFiltro : undefined,
      ocupacao: npcOcupacaoFiltro !== 'Qualquer' ? npcOcupacaoFiltro : undefined,
    });
  }, [seedNPCIndividual, npcRacaFiltro, npcGeneroFiltro, npcOcupacaoFiltro]);

  // 7. Geração isolada de Lote de Itens com seed próprio
  const loteItensIsolado: ItemGerado[] = useMemo(() => {
    return gerarLoteItens(seedItens, qtdItens, {
      categoria: itemCategoriaFiltro !== 'Qualquer' ? itemCategoriaFiltro : undefined,
      raridadeDesejada: itemRaridadeFiltro !== 'Qualquer' ? itemRaridadeFiltro : undefined,
      permitirMaldicao: itemPermitirMaldicao,
    });
  }, [seedItens, qtdItens, itemCategoriaFiltro, itemRaridadeFiltro, itemPermitirMaldicao]);

  // 8. Geração de Item Individual isolado com seed próprio
  const itemIndividual: ItemGerado = useMemo(() => {
    return gerarItem(seedItemIndividual, {
      categoria: itemCategoriaFiltro !== 'Qualquer' ? itemCategoriaFiltro : undefined,
      raridadeDesejada: itemRaridadeFiltro !== 'Qualquer' ? itemRaridadeFiltro : undefined,
      permitirMaldicao: itemPermitirMaldicao,
    });
  }, [seedItemIndividual, itemCategoriaFiltro, itemRaridadeFiltro, itemPermitirMaldicao]);

  // Parâmetros de Nomes Markov
  const [seedMarkov, setSeedMarkov] = useState<number>(() => deriveSubSeed(42, 'markov_names'));
  const [kitMarkovSelecionado, setKitMarkovSelecionado] = useState<string>('usuario_fantasia');
  const [qtdNomesMarkov, setQtdNomesMarkov] = useState<number>(10);
  const [ordemMarkov, setOrdemMarkov] = useState<number>(2);
  const [nomesCustomizadosTexto, setNomesCustomizadosTexto] = useState<string>(
    'Alden Alec Anton Arden Arlen Armand Arron Augustus Avery Benedict Bennett Branden Brendon Britt Broderick Carter Chadwick Chas Chet Colby Cole Cordell Dalton Damien Dante Darell Darius Darron Darwin Dewitt Diego Dillon Dirk Domenic Donovan Dorian Dorsey Edison Elden Elvin Erich Galen Garret Gaston Gavin German Graham Hal Hank Harlan Hayden Herschel Hoyt Hunter Isaias Issac Jacinto Jarred Jonas Kendrick Keneth Kennith Keven Leif Lenard Lincoln Linwood Lucius Lynwood Malcolm Malik Maxwell McKinley Merlin Merrill Michal Monty Newton Nolan Porter Quinton Raphael Reid Rory Scotty Shad Stanton Stefan Thaddeus Tobias Trenton Vance Walker Walton Weldon Wes Weston Willian Winford Wyatt'
  );

  // Parâmetros do Gerador Fantasia Aleatório
  const [seedFantasia, setSeedFantasia] = useState<number>(() => deriveSubSeed(42, 'fantasy_gen'));
  const [subcategoriaFantasia, setSubcategoriaFantasia] = useState<SubcategoriaFantasia>('quests');
  const [qtdElementosFantasia, setQtdElementosFantasia] = useState<number>(4);

  // Sincronizar todos os módulos com a seed raiz do mundo
  const handleSincronizarComRaiz = (s = rootSeed) => {
    setSeedTerreno(deriveSubSeed(s, 'terreno', '1.0.0'));
    setSeedMasmorra(deriveSubSeed(s, 'masmorra', '1.1.0'));
    setSeedAssentamento(deriveSubSeed(s, 'assentamento', '1.0.3'));
    setSeedNPCs(deriveSubSeed(s, 'npc', '1.0.0'));
    setSeedNPCIndividual(deriveSubSeed(s, 'npc_ind'));
    setSeedItens(deriveSubSeed(s, 'itens', '1.0.0'));
    setSeedItemIndividual(deriveSubSeed(s, 'item_ind'));
    setSeedMarkov(deriveSubSeed(s, 'markov_names'));
    setSeedFantasia(deriveSubSeed(s, 'fantasy_gen'));
  };

  const handleNovaRootSeed = () => {
    const nova = Math.floor(Math.random() * 900000) + 10000;
    setRootSeed(nova);
    handleSincronizarComRaiz(nova);
  };

  // Funções de sorteio rápido por módulo
  const sortearSeedTerreno = () => setSeedTerreno(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedMasmorra = () => setSeedMasmorra(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedAssentamento = () => setSeedAssentamento(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedNPCs = () => setSeedNPCs(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedNPCIndividual = () => setSeedNPCIndividual(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedItens = () => setSeedItens(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedItemIndividual = () => setSeedItemIndividual(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedMarkov = () => setSeedMarkov(Math.floor(Math.random() * 900000) + 10000);
  const sortearSeedFantasia = () => setSeedFantasia(Math.floor(Math.random() * 900000) + 10000);

  // 9. Geração de Nomes por Cadeia de Markov
  const kitMarkovAtivo = useMemo(() => {
    return (
      KITS_MARKOV_DISPONIVEIS.find((k) => k.id === kitMarkovSelecionado) ||
      KITS_MARKOV_DISPONIVEIS[0]
    );
  }, [kitMarkovSelecionado]);

  const listaNomesCustomParsed = useMemo(() => {
    return nomesCustomizadosTexto
      .split(/[\s,;\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }, [nomesCustomizadosTexto]);

  const loteNomesMarkov = useMemo(() => {
    return gerarLoteNomesMarkov(
      seedMarkov,
      kitMarkovAtivo,
      listaNomesCustomParsed,
      qtdNomesMarkov,
      {
        order: ordemMarkov,
        minLen: 4,
        maxLen: 10,
      }
    );
  }, [
    seedMarkov,
    kitMarkovAtivo,
    listaNomesCustomParsed,
    qtdNomesMarkov,
    ordemMarkov,
  ]);

  // 10. Geração de Elementos Fantasia com Dropdownlist
  const loteElementosFantasia = useMemo(() => {
    return gerarLoteElementosFantasia(
      seedFantasia,
      subcategoriaFantasia,
      qtdElementosFantasia
    );
  }, [seedFantasia, subcategoriaFantasia, qtdElementosFantasia]);

  // Exportação e cópia rápida
  const handleCopy = (formato: 'md' | 'json' | 'tsv') => {
    let texto = '';
    if (formato === 'md') texto = exportarMarkdown(mundo);
    else if (formato === 'json') texto = exportarJSON(mundo);
    else if (formato === 'tsv') texto = exportarTSV(mundo);

    navigator.clipboard.writeText(texto).then(() => {
      setCopiedFormat(formato);
      setTimeout(() => setCopiedFormat(null), 2500);
    });
  };

  const handleDownload = (formato: 'md' | 'json' | 'tsv') => {
    let texto = '';
    let mime = 'text/plain;charset=utf-8';
    const filename = `forja_mundo_seed_${rootSeed}.${formato}`;

    if (formato === 'md') {
      texto = exportarMarkdown(mundo);
      mime = 'text/markdown;charset=utf-8';
    } else if (formato === 'json') {
      texto = exportarJSON(mundo);
      mime = 'application/json;charset=utf-8';
    } else if (formato === 'tsv') {
      texto = exportarTSV(mundo);
      mime = 'text/tab-separated-values;charset=utf-8';
    }

    const blob = new Blob([texto], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSVG = () => {
    const svgElem = document.getElementById('forja-terrain-svg');
    if (!svgElem) return;
    const svgData = new XMLSerializer().serializeToString(svgElem);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forja_terreno_seed_${seedTerreno}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const adicionarItemSessao = (tipo: string, texto: string) => {
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setSessaoLog((prev) => [{ id: `log_${Date.now()}_${Math.random()}`, tipo, texto, hora }, ...prev]);
  };

  const rolarRapidoNPC = () => {
    const sub = Math.floor(Math.random() * 100000);
    const npc = gerarNPC(sub);
    adicionarItemSessao('NPC Relâmpago', npc.resumoLinhaUnica);
  };

  const rolarRapidoRumor = () => {
    const rng = new DeterministicRNG(Math.floor(Math.random() * 100000));
    const npcTemp = gerarNPC(rng.nextInt(100, 9999));
    const facTemp = assentamentoIsolado.faccoes[0]?.nome || 'Irmandade Noturna';
    const regTemp = masmorraIsolada.nome || 'Ruínas Antigas';

    const r = tableEngine.selectWeighted('rumores_taverna', rng, {
      ferreiro: npcTemp.nome,
      faccao: facTemp,
      regiao: regTemp,
    });
    adicionarItemSessao('Rumor de Taverna', r.texto);
  };

  const rolarRapidoItem = () => {
    const sub = Math.floor(Math.random() * 100000);
    const it = gerarItem(sub);
    adicionarItemSessao(
      'Item / Tesouro',
      `${it.nome} (${it.categoria}, ${it.raridade}) — ${it.descricaoMecanica} [${it.valorPO} PO]`
    );
  };

  const rolarRapidoEncontro = () => {
    const rng = new DeterministicRNG(Math.floor(Math.random() * 100000));
    const enc = tableEngine.selectWeighted('monstros_encontros', rng);
    adicionarItemSessao(
      'Encontro nos Ermos',
      `${enc.texto} [CR: ${enc.entrada.data?.cr || '1/2'}, XP: ${enc.entrada.data?.xp || 100}]`
    );
  };

  const rolarRapidoArmadilha = () => {
    const rng = new DeterministicRNG(Math.floor(Math.random() * 100000));
    const a = tableEngine.selectWeighted('armadilhas_masmorra', rng);
    adicionarItemSessao('Armadilha / Perigo', a.texto);
  };

  return (
    <div className="flex flex-col gap-5 pb-20 max-w-7xl mx-auto">
      {/* CABEÇALHO FILOSÓFICO ESTILO DONJON COM MANIFESTO VISÍVEL (§1.3 & §11) */}
      <header className="rounded-2xl bg-[#090812] border border-white/10 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)]">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black tracking-wide text-white">
                  FORJA DE MUNDOS
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  100% DETERMINÍSTICO (SEM IA)
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  v{mundo.manifesto.versao_pacote_dados}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Suíte Donjon-like de geração procedural para RPG de Mesa: terreno em 9 estágios, masmorras Dormans, assentamentos, NPCs e tesouros com seeds independentes.
              </p>
            </div>
          </div>

          {/* Controle de Semente Raiz do Mundo */}
          <div className="flex flex-wrap items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-1.5 px-2">
              <Hash className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-slate-400 font-mono">Seed Raiz:</span>
              <input
                type="number"
                value={rootSeed}
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setRootSeed(val);
                }}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-sm font-mono text-cyan-300 text-center focus:outline-none focus:border-cyan-400"
              />
            </div>
            <button
              onClick={handleNovaRootSeed}
              title="Sortear Nova Semente do Mundo Inteiro"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Novo Mundo</span>
            </button>
            <button
              onClick={() => handleSincronizarComRaiz()}
              title="Sincronizar Todas as Sub-Seeds com a Seed Raiz"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Sincronizar Módulos</span>
            </button>
          </div>
        </div>

        {/* REPRODUCIBILITY MANIFEST BAR (§1.3) */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-2">
          <div className="flex items-center gap-2 truncate max-w-full">
            <span className="text-slate-500">Hash de Build:</span>
            <span className="text-slate-300 bg-white/5 px-2 py-0.5 rounded truncate max-w-[280px]">
              {mundo.manifesto.hash_pacote_dados}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-500">Módulos:</span>
            <span className="text-cyan-400">terreno:1.0.0</span>
            <span className="text-purple-400">masmorra:1.1.0</span>
            <span className="text-emerald-400">assentamento:1.0.3</span>
            <span className="text-amber-400">npcs:1.0.0</span>
            <span className="text-pink-400">itens:1.0.0</span>
          </div>
        </div>
      </header>

      {/* BARRA DE NAVEGAÇÃO DOS GERADORES + SESSÃO AO VIVO */}
      <nav className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin border-b border-white/10">
        <button
          onClick={() => setSubAba('mundo')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'mundo'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Mundo Integrado</span>
        </button>

        <button
          onClick={() => setSubAba('terreno')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'terreno'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>Terreno</span>
        </button>

        <button
          onClick={() => setSubAba('masmorra')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'masmorra'
              ? 'bg-purple-500 text-black shadow-[0_0_12px_rgba(168,85,247,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Castle className="w-3.5 h-3.5" />
          <span>Masmorras</span>
        </button>

        <button
          onClick={() => setSubAba('encontros')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'encontros'
              ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Swords className="w-3.5 h-3.5" />
          <span>Encontros d20</span>
        </button>

        <button
          onClick={() => setSubAba('assentamento')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'assentamento'
              ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Assentamentos</span>
        </button>

        <button
          onClick={() => setSubAba('npcs')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'npcs'
              ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>NPCs & Fichas</span>
        </button>

        <button
          onClick={() => setSubAba('itens')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'itens'
              ? 'bg-pink-500 text-black shadow-[0_0_12px_rgba(236,72,153,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Sword className="w-3.5 h-3.5" />
          <span>Itens & Tesouros</span>
        </button>

        <button
          onClick={() => setSubAba('markov_names')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'markov_names'
              ? 'bg-teal-400 text-black shadow-[0_0_12px_rgba(45,212,191,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Scroll className="w-3.5 h-3.5" />
          <span>Nomes Markov</span>
        </button>

        <button
          onClick={() => setSubAba('gerador_fantasia')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'gerador_fantasia'
              ? 'bg-purple-400 text-black shadow-[0_0_12px_rgba(192,132,252,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gerador Fantasia</span>
        </button>

        <button
          onClick={() => setSubAba('sessao_ao_vivo')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            subAba === 'sessao_ao_vivo'
              ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.4)]'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Sessão ao Vivo (GM)</span>
        </button>
      </nav>

      {/* SUB-ABA 1: MUNDO COMPLETO */}
      {subAba === 'mundo' && (
        <ForjaMundoTab
          mundo={mundo}
          onNavigateSubAba={(aba) => setSubAba(aba)}
          onSelectNpc={(npcId) => setExpandedNpcId(npcId)}
          copiedFormat={copiedFormat}
          onCopy={handleCopy}
          onDownload={handleDownload}
        />
      )}

      {/* SUB-ABA 2: TERRENO */}
      {subAba === 'terreno' && (
        <ForjaTerrenoTab
          seedTerreno={seedTerreno}
          setSeedTerreno={setSeedTerreno}
          sortearSeedTerreno={sortearSeedTerreno}
          terrenoIsolado={terrenoIsolado}
          showBiomes={showBiomes}
          setShowBiomes={setShowBiomes}
          showRivers={showRivers}
          setShowRivers={setShowRivers}
          showRoutes={showRoutes}
          setShowRoutes={setShowRoutes}
          showSettlements={showSettlements}
          setShowSettlements={setShowSettlements}
          selectedCellId={selectedCellId}
          setSelectedCellId={setSelectedCellId}
          onDownloadSVG={handleDownloadSVG}
          onNavigateEncontros={(bioma) => {
            setBiomaEncontroSelecionado(bioma);
            setSubAba('encontros');
          }}
        />
      )}

      {/* SUB-ABA 3: MASMORRA */}
      {subAba === 'masmorra' && (
        <ForjaMasmorraTab
          seedMasmorra={seedMasmorra}
          setSeedMasmorra={setSeedMasmorra}
          sortearSeedMasmorra={sortearSeedMasmorra}
          layoutMasmorra={layoutMasmorra}
          setLayoutMasmorra={setLayoutMasmorra}
          nivelGrupoMasmorra={nivelGrupoMasmorra}
          setNivelGrupoMasmorra={setNivelGrupoMasmorra}
          dificuldadeMasmorra={dificuldadeMasmorra}
          setDificuldadeMasmorra={setDificuldadeMasmorra}
          temaMasmorraCustom={temaMasmorraCustom}
          setTemaMasmorraCustom={setTemaMasmorraCustom}
          masmorraIsolada={masmorraIsolada}
          selectedRoomId={selectedRoomId}
          setSelectedRoomId={setSelectedRoomId}
        />
      )}

      {/* SUB-ABA 4: ASSENTAMENTO */}
      {subAba === 'assentamento' && (
        <ForjaAssentamentoTab
          seedAssentamento={seedAssentamento}
          setSeedAssentamento={setSeedAssentamento}
          sortearSeedAssentamento={sortearSeedAssentamento}
          tamanhoAssentamento={tamanhoAssentamento}
          setTamanhoAssentamento={setTamanhoAssentamento}
          temRioAssentamento={temRioAssentamento}
          setTemRioAssentamento={setTemRioAssentamento}
          temColinaAssentamento={temColinaAssentamento}
          setTemColinaAssentamento={setTemColinaAssentamento}
          temEstradaAssentamento={temEstradaAssentamento}
          setTemEstradaAssentamento={setTemEstradaAssentamento}
          nomeAssentamentoCustom={nomeAssentamentoCustom}
          setNomeAssentamentoCustom={setNomeAssentamentoCustom}
          assentamentoIsolado={assentamentoIsolado}
        />
      )}

      {/* SUB-ABA 5: NPCS */}
      {subAba === 'npcs' && (
        <ForjaNpcTab
          modoNPC={modoNPC}
          setModoNPC={setModoNPC}
          seedNPCs={seedNPCs}
          setSeedNPCs={setSeedNPCs}
          sortearSeedNPCs={sortearSeedNPCs}
          qtdNPCs={qtdNPCs}
          setQtdNPCs={setQtdNPCs}
          seedNPCIndividual={seedNPCIndividual}
          setSeedNPCIndividual={setSeedNPCIndividual}
          sortearSeedNPCIndividual={sortearSeedNPCIndividual}
          npcRacaFiltro={npcRacaFiltro}
          setNpcRacaFiltro={setNpcRacaFiltro}
          npcOcupacaoFiltro={npcOcupacaoFiltro}
          setNpcOcupacaoFiltro={setNpcOcupacaoFiltro}
          loteNPCsIsolado={loteNPCsIsolado}
          npcIndividual={npcIndividual}
          expandedNpcId={expandedNpcId}
          setExpandedNpcId={setExpandedNpcId}
          copiedFormat={copiedFormat}
          setCopiedFormat={setCopiedFormat}
        />
      )}

      {/* SUB-ABA 6: ITENS & TESOUROS */}
      {subAba === 'itens' && (
        <ForjaItensTab
          modoItem={modoItem}
          setModoItem={setModoItem}
          seedItens={seedItens}
          setSeedItens={setSeedItens}
          sortearSeedItens={sortearSeedItens}
          qtdItens={qtdItens}
          setQtdItens={setQtdItens}
          seedItemIndividual={seedItemIndividual}
          setSeedItemIndividual={setSeedItemIndividual}
          sortearSeedItemIndividual={sortearSeedItemIndividual}
          itemCategoriaFiltro={itemCategoriaFiltro}
          setItemCategoriaFiltro={setItemCategoriaFiltro}
          itemRaridadeFiltro={itemRaridadeFiltro}
          setItemRaridadeFiltro={setItemRaridadeFiltro}
          itemPermitirMaldicao={itemPermitirMaldicao}
          setItemPermitirMaldicao={setItemPermitirMaldicao}
          loteItensIsolado={loteItensIsolado}
          itemIndividual={itemIndividual}
          copiedFormat={copiedFormat}
          setCopiedFormat={setCopiedFormat}
        />
      )}

      {/* SUB-ABA 7: NOMES MARKOV */}
      {subAba === 'markov_names' && (
        <ForjaMarkovTab
          seedMarkov={seedMarkov}
          setSeedMarkov={setSeedMarkov}
          sortearSeedMarkov={sortearSeedMarkov}
          kitMarkovSelecionado={kitMarkovSelecionado}
          setKitMarkovSelecionado={setKitMarkovSelecionado}
          qtdNomesMarkov={qtdNomesMarkov}
          setQtdNomesMarkov={setQtdNomesMarkov}
          ordemMarkov={ordemMarkov}
          setOrdemMarkov={setOrdemMarkov}
          kitMarkovAtivo={kitMarkovAtivo}
          listaNomesCustomParsed={listaNomesCustomParsed}
          nomesCustomizadosTexto={nomesCustomizadosTexto}
          setNomesCustomizadosTexto={setNomesCustomizadosTexto}
          loteNomesMarkov={loteNomesMarkov}
          copiedFormat={copiedFormat}
          setCopiedFormat={setCopiedFormat}
        />
      )}

      {/* SUB-ABA 8: GERADOR FANTASIA */}
      {subAba === 'gerador_fantasia' && (
        <ForjaFantasiaTab
          seedFantasia={seedFantasia}
          setSeedFantasia={setSeedFantasia}
          sortearSeedFantasia={sortearSeedFantasia}
          subcategoriaFantasia={subcategoriaFantasia}
          setSubcategoriaFantasia={setSubcategoriaFantasia}
          qtdElementosFantasia={qtdElementosFantasia}
          setQtdElementosFantasia={setQtdElementosFantasia}
          loteElementosFantasia={loteElementosFantasia}
          copiedFormat={copiedFormat}
          setCopiedFormat={setCopiedFormat}
        />
      )}

      {/* SUB-ABA 9: SESSÃO AO VIVO */}
      {subAba === 'sessao_ao_vivo' && (
        <ForjaSessaoAoVivoTab
          sessaoLog={sessaoLog}
          rolarRapidoNPC={rolarRapidoNPC}
          rolarRapidoRumor={rolarRapidoRumor}
          rolarRapidoItem={rolarRapidoItem}
          rolarRapidoEncontro={rolarRapidoEncontro}
          rolarRapidoArmadilha={rolarRapidoArmadilha}
        />
      )}

      {/* SUB-ABA 10: ENCONTROS ALEATÓRIOS (D&D 5.5 / 5e / D20) */}
      {subAba === 'encontros' && (
        <ForjaEncontrosPanel
          rootSeed={rootSeed}
          initialBioma={biomaEncontroSelecionado}
        />
      )}
    </div>
  );
};
