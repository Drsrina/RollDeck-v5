import React, { useState, useMemo } from 'react';
import {
  Compass,
  Map as MapIcon,
  Castle,
  Home,
  Users,
  Shield,
  Zap,
  Download,
  Copy,
  Check,
  RefreshCw,
  Hash,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sword,
  Scroll,
  User,
  Sliders,
  Dices,
  RotateCcw,
  Swords,
} from 'lucide-react';
import { ForjaEncontrosPanel } from '../components/forja/ForjaEncontrosPanel';
import { BiomaEncontro, mapearBiomaTerrenoParaEncontro } from '../lib/forja/encounterGenerator';
import { gerarMundoCompleto, MundoCompletoResult } from '../lib/forja/pipeline';
import { gerarTerreno, TerrenoResult, TopologiaTerreno } from '../lib/forja/terrainGenerator';
import { gerarMasmorra, DungeonResult, AlgoritmoLayout, DificuldadeEncontro } from '../lib/forja/dungeonGenerator';
import { gerarAssentamento, SettlementResult, TamanhoAssentamento, AlgoritmoAssentamento } from '../lib/forja/settlementGenerator';
import { gerarLoteNPCs, gerarNPC, NPCEntry, RACAS_NPC, OCUPACOES } from '../lib/forja/npcGenerator';
import { gerarLoteItens, gerarItem, ItemGerado, CategoriaItem, RaridadeItem } from '../lib/forja/itemGenerator';
import {
  KITS_MARKOV_DISPONIVEIS,
  KitMarkovFonte,
  gerarLoteNomesMarkov,
} from '../lib/forja/markovNames';
import {
  LISTA_SUBCATEGORIAS,
  SubcategoriaFantasia,
  gerarLoteElementosFantasia,
  ItemGeradoFantasia,
} from '../lib/forja/fantasyGenerator';
import { exportarMarkdown, exportarJSON, exportarTSV } from '../lib/forja/export';
import { TableEngine } from '../lib/forja/tableEngine';
import { TABELAS_CANONICAS } from '../lib/forja/tablesData';
import { DeterministicRNG, deriveSubSeed } from '../lib/forja/prng';

type SubAbaForja =
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
  const [topologiaTerreno, setTopologiaTerreno] = useState<TopologiaTerreno>('hex');

  // Parâmetros de Masmorra
  const [layoutMasmorra, setLayoutMasmorra] = useState<AlgoritmoLayout>('donjon');
  const [nivelGrupoMasmorra, setNivelGrupoMasmorra] = useState<number>(3);
  const [dificuldadeMasmorra, setDificuldadeMasmorra] = useState<DificuldadeEncontro>('medio');
  const [temaMasmorraCustom, setTemaMasmorraCustom] = useState<string>('');

  // Parâmetros de Assentamento
  const [tamanhoAssentamento, setTamanhoAssentamento] = useState<TamanhoAssentamento>('vila');
  const [algoritmoAssentamento, setAlgoritmoAssentamento] = useState<AlgoritmoAssentamento>('voronoi_distritos');
  const [temRioAssentamento, setTemRioAssentamento] = useState<boolean>(true);
  const [temColinaAssentamento, setTemColinaAssentamento] = useState<boolean>(true);
  const [temEstradaAssentamento, setTemEstradaAssentamento] = useState<boolean>(true);
  const [nomeAssentamentoCustom, setNomeAssentamentoCustom] = useState<string>('');

  // Parâmetros de NPCs
  const [modoNPC, setModoNPC] = useState<'lote' | 'individual'>('lote');
  const [qtdNPCs, setQtdNPCs] = useState<number>(6);
  const [npcRacaFiltro, setNpcRacaFiltro] = useState<string>('Qualquer');
  const [npcGeneroFiltro, setNpcGeneroFiltro] = useState<'todos' | 'm' | 'f'>('todos');
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
  const [minLenMarkov, setMinLenMarkov] = useState<number>(4);
  const [maxLenMarkov, setMaxLenMarkov] = useState<number>(10);
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
        minLen: minLenMarkov,
        maxLen: maxLenMarkov,
      }
    );
  }, [
    seedMarkov,
    kitMarkovAtivo,
    listaNomesCustomParsed,
    qtdNomesMarkov,
    ordemMarkov,
    minLenMarkov,
    maxLenMarkov,
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
      <nav className="flex items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10 overflow-x-auto select-none">
        <button
          onClick={() => setSubAba('mundo')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'mundo'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Mundo Completo
        </button>

        <button
          onClick={() => setSubAba('terreno')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'terreno'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          Terreno
        </button>

        <button
          onClick={() => setSubAba('masmorra')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'masmorra'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Castle className="w-4 h-4" />
          Masmorra
        </button>

        <button
          onClick={() => setSubAba('encontros')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'encontros'
              ? 'bg-rose-500 text-black shadow-[0_0_12px_rgba(244,63,94,0.5)] font-black'
              : 'text-rose-300 hover:bg-rose-500/10'
          }`}
        >
          <Swords className="w-4 h-4" />
          Encontros Aleatórios
        </button>

        <button
          onClick={() => setSubAba('assentamento')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'assentamento'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Home className="w-4 h-4" />
          Assentamento
        </button>

        <button
          onClick={() => setSubAba('npcs')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'npcs'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          NPCs
        </button>

        <button
          onClick={() => setSubAba('itens')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'itens'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Sword className="w-4 h-4" />
          Itens & Tesouros
        </button>

        <button
          onClick={() => setSubAba('markov_names')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'markov_names'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Scroll className="w-4 h-4" />
          Nomes (Markov)
        </button>

        <button
          onClick={() => setSubAba('gerador_fantasia')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'gerador_fantasia'
              ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.5)] font-black'
              : 'text-slate-300 hover:bg-white/5'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Gerador Fantasia
        </button>

        <button
          onClick={() => setSubAba('sessao_ao_vivo')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            subAba === 'sessao_ao_vivo'
              ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.6)] font-black'
              : 'text-amber-300 hover:bg-amber-500/10'
          }`}
        >
          <Zap className="w-4 h-4" />
          Sessão ao Vivo
        </button>
      </nav>

      {/* ======================================================== */}
      {/* SUB-ABA 1: MUNDO COMPLETO                                */}
      {/* ======================================================== */}
      {subAba === 'mundo' && (
        <section className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  Terreno & Malha Base
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  Continente em {mundo.terreno.topologia.toUpperCase()}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {mundo.terreno.metricas.totalCells} células ({mundo.terreno.metricas.areaTerra} terra / {mundo.terreno.metricas.areaAgua} água), {mundo.terreno.rivers.length} rios descendo aos oceanos.
                </p>
              </div>
              <button
                onClick={() => setSubAba('terreno')}
                className="mt-3 text-xs text-cyan-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Inspecionar Terreno Isolado &rarr;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Assentamento Central
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {mundo.assentamento.nome}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {mundo.assentamento.tamanho} com ~{mundo.assentamento.populacao} habitantes ({mundo.assentamento.racaPredominante}). {mundo.assentamento.distritos.length} distritos e {mundo.assentamento.faccoes.length} facções com rivalidades ativas.
                </p>
              </div>
              <button
                onClick={() => setSubAba('assentamento')}
                className="mt-3 text-xs text-emerald-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Inspecionar Assentamento Isolado &rarr;
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Masmorra Ancorada
                </span>
                <h3 className="text-base font-bold text-white mt-1">
                  {mundo.masmorra.nome}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Grafo Dormans Lock & Key ({mundo.masmorra.isSolvable ? 'Solúvel' : 'Inacessível'}), 6 salas interligadas, orçamento de XP: {mundo.masmorra.orcamentoXp.xpAlocado} XP (±{Math.abs(mundo.masmorra.orcamentoXp.variacaoPercentual)}%).
                </p>
              </div>
              <button
                onClick={() => setSubAba('masmorra')}
                className="mt-3 text-xs text-purple-300 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Inspecionar Masmorra Isolada &rarr;
              </button>
            </div>
          </div>

          {/* Rumores da Taverna interconectados */}
          <div className="rounded-xl bg-[#0d0b1a] border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Scroll className="w-4 h-4 text-cyan-400" />
                Rumores Interconectados da Taverna (Weaver de Entidades)
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">
                Concordância Gramatical PT-BR
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {mundo.rumores.map((rumor, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-slate-300 italic flex items-start gap-2"
                >
                  <span className="text-cyan-400 font-bold font-mono">#{i + 1}</span>
                  <span>"{rumor}"</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fichas Donjon de 1 Linha dos NPCs do Mundo */}
          <div className="rounded-xl bg-[#0d0b1a] border border-white/10 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                NPCs do Mundo Conectado ({mundo.npcs.length})
              </h3>
              <button
                onClick={() => setSubAba('npcs')}
                className="text-xs text-cyan-300 hover:underline"
              >
                Gerar NPCs ou Ficha Individual &rarr;
              </button>
            </div>
            <div className="flex flex-col gap-2 font-mono text-xs">
              {mundo.npcs.map((npc) => (
                <div
                  key={npc.id}
                  className="p-2.5 rounded bg-black/40 border border-white/5 text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <span className="text-slate-200">
                    <strong className="text-cyan-400">{npc.id}</strong> — Ocupação: <span className="text-amber-300">{npc.ocupacao}</span>. Aparência: {npc.aparencia}. Segredo: <span className="text-rose-300">{npc.segredo}</span>.
                  </span>
                  <button
                    onClick={() => {
                      setSubAba('npcs');
                      setExpandedNpcId(npc.id);
                    }}
                    className="self-end sm:self-auto px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[11px] text-slate-200 cursor-pointer"
                  >
                    Ver Ficha
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Exportação Completa */}
          <div className="rounded-xl bg-black/40 border border-white/10 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Exportação de Dados Agnóstica (§10)
              </h4>
              <p className="text-[11px] text-slate-400">
                Copie ou baixe o estado completo em formatos abertos sem dependência de banco de dados.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleCopy('md')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
                title="Copiar Markdown para Área de Transferência"
              >
                {copiedFormat === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar MD
              </button>
              <button
                onClick={() => handleDownload('md')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-xs font-semibold text-cyan-200 border border-cyan-500/30 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar .MD
              </button>
              <button
                onClick={() => handleCopy('json')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                {copiedFormat === 'json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                Copiar JSON
              </button>
              <button
                onClick={() => handleDownload('json')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-xs font-semibold text-purple-200 border border-purple-500/30 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar .JSON
              </button>
              <button
                onClick={() => handleDownload('tsv')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar .TSV
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 2: TERRENO COM SEED PRÓPRIA                     */}
      {/* ======================================================== */}
      {subAba === 'terreno' && (
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
              onClick={handleDownloadSVG}
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
                  const pts = rio.path.map((cid) => {
                    const c = terrenoIsolado.cells[cid];
                    return `${c.x},${c.y}`;
                  }).join(' ');

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
                  const pts = rt.path.map((cid) => {
                    const c = terrenoIsolado.cells[cid];
                    return `${c.x},${c.y}`;
                  }).join(' ');

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
                    setBiomaEncontroSelecionado(biomaMapeado);
                    setSubAba('encontros');
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
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 3: MASMORRA COM SEED PRÓPRIA                    */}
      {/* ======================================================== */}
      {subAba === 'masmorra' && (
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
                    <div className="text-rose-300 font-semibold">
                      ⚔️ Monstros: {r.monstros.map((m) => `${m.quantidade}x ${m.nome} (CR ${m.cr}, ${m.totalXp} XP)`).join(', ')}
                    </div>
                  )}
                  {r.hasKey && (
                    <div className="text-amber-300 font-semibold">
                      🗝️ Contém Chave: {r.hasKey}
                    </div>
                  )}
                  {r.requiresKey && (
                    <div className="text-red-400 font-semibold">
                      🔒 Porta Trancada: Requer {r.requiresKey}
                    </div>
                  )}
                  {r.armadilha && (
                    <div className="text-orange-300 font-semibold">
                      ⚠️ Armadilha: {r.armadilha}
                    </div>
                  )}
                  {r.tesouro && (
                    <div className="text-emerald-300 font-semibold">
                      💰 Tesouro: {r.tesouro}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 4: ASSENTAMENTO COM SEED PRÓPRIA                */}
      {/* ======================================================== */}
      {subAba === 'assentamento' && (
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
            <h4 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              Facções e Relações de Poder (§6.3)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {assentamentoIsolado.faccoes.map((f) => (
                <div key={f.id} className="p-3 rounded-lg bg-black/40 border border-white/5 flex flex-col justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-purple-300">{f.nome}</h5>
                    <p className="text-[11px] text-slate-400 mt-1">Líder: <strong>{f.lider}</strong></p>
                    <p className="text-[11px] text-slate-300 mt-1">{f.objetivo}</p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-white/5 text-[10px] font-mono text-slate-400">
                    <div>Rivais: <span className="text-rose-400">{f.rivais.join(', ')}</span></div>
                  </div>
                </div>
              ))}
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
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 5: NPCS (LOTE OU INDIVIDUAL COM SEED PRÓPRIA)     */}
      {/* ======================================================== */}
      {subAba === 'npcs' && (
        <section className="flex flex-col gap-4">
          {/* Seletor de Modo: Lote vs Individual */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10">
              <button
                onClick={() => setModoNPC('lote')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  modoNPC === 'lote' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Lote de NPCs
              </button>
              <button
                onClick={() => setModoNPC('individual')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  modoNPC === 'individual' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                NPC Individual
              </button>
            </div>

            {modoNPC === 'lote' ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-300 font-bold font-mono">Seed Lote:</span>
                  <input
                    type="number"
                    value={seedNPCs}
                    onChange={(e) => setSeedNPCs(Number(e.target.value) || 0)}
                    className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
                  />
                  <button
                    onClick={sortearSeedNPCs}
                    className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sortear</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-bold">Qtd:</span>
                  {[3, 6, 10, 15].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQtdNPCs(q)}
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        qtdNPCs === q ? 'bg-cyan-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-300 font-bold font-mono">Seed NPC:</span>
                  <input
                    type="number"
                    value={seedNPCIndividual}
                    onChange={(e) => setSeedNPCIndividual(Number(e.target.value) || 0)}
                    className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
                  />
                  <button
                    onClick={sortearSeedNPCIndividual}
                    className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    <Dices className="w-3 h-3" />
                    <span>Sortear NPC</span>
                  </button>
                </div>

                {/* Filtros customizáveis de NPC Individual */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Raça:</span>
                  <select
                    value={npcRacaFiltro}
                    onChange={(e) => setNpcRacaFiltro(e.target.value)}
                    className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="Qualquer">Qualquer</option>
                    {RACAS_NPC.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Ocupação:</span>
                  <select
                    value={npcOcupacaoFiltro}
                    onChange={(e) => setNpcOcupacaoFiltro(e.target.value)}
                    className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200 capitalize"
                  >
                    <option value="Qualquer">Qualquer</option>
                    {OCUPACOES.map((oc) => (
                      <option key={oc} value={oc}>{oc}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* VISUALIZAÇÃO DE LOTE DE NPCS */}
          {modoNPC === 'lote' && (
            <div className="flex flex-col gap-3 font-mono text-xs">
              <div className="text-slate-400 text-[11px]">
                Filosofia Donjon: Ficha mínima de 1 linha por padrão. Clique em "Expandir" para inspecionar atributos 3d6 e inventário.
              </div>

              {loteNPCsIsolado.map((npc) => {
                const isExp = expandedNpcId === npc.id;
                return (
                  <div
                    key={npc.id}
                    className="p-3.5 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col gap-2 transition-all"
                  >
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="text-slate-200">
                        <strong className="text-cyan-400">{npc.id}</strong> — {npc.nome} ({npc.raca}, <span className="text-amber-300">{npc.ocupacao}</span>). Aparência: {npc.aparencia}. Segredo: <span className="text-rose-300">{npc.segredo}</span>.
                      </div>
                      <button
                        onClick={() => setExpandedNpcId(isExp ? null : npc.id)}
                        className="shrink-0 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-slate-200 text-xs flex items-center gap-1 font-sans cursor-pointer"
                      >
                        {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {isExp ? 'Ocultar' : 'Expandir'}
                      </button>
                    </div>

                    {isExp && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex flex-col gap-3 font-sans">
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center">
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <div className="text-[10px] text-slate-400">FOR</div>
                            <div className="text-sm font-bold text-white">{npc.stats.for}</div>
                          </div>
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <div className="text-[10px] text-slate-400">DES</div>
                            <div className="text-sm font-bold text-white">{npc.stats.des}</div>
                          </div>
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <div className="text-[10px] text-slate-400">CON</div>
                            <div className="text-sm font-bold text-white">{npc.stats.con}</div>
                          </div>
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <div className="text-[10px] text-slate-400">INT</div>
                            <div className="text-sm font-bold text-white">{npc.stats.int}</div>
                          </div>
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <div className="text-[10px] text-slate-400">SAB</div>
                            <div className="text-sm font-bold text-white">{npc.stats.sab}</div>
                          </div>
                          <div className="p-2 rounded bg-black/40 border border-white/5">
                            <div className="text-[10px] text-slate-400">CAR</div>
                            <div className="text-sm font-bold text-white">{npc.stats.car}</div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                          <span className="text-emerald-300">PV: {npc.stats.pv}</span>
                          <span className="text-blue-300">CA: {npc.stats.ca}</span>
                          <span className="text-slate-300">{npc.stats.ataque}</span>
                        </div>

                        <div className="text-xs text-slate-300">
                          <strong>Encadeamento Psicológico:</strong> {npc.personalidade.arquetipo} &rarr; {npc.personalidade.traco} &rarr; <em>{npc.personalidade.motivacao}</em>
                        </div>

                        <div className="text-xs text-slate-400">
                          <strong>Equipamento:</strong> {npc.equipamento.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* VISUALIZAÇÃO DE NPC INDIVIDUAL DETALHADO */}
          {modoNPC === 'individual' && (
            <div className="p-5 rounded-2xl bg-[#0d0b1a] border border-cyan-500/30 flex flex-col gap-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-400" />
                    {npcIndividual.nome}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {npcIndividual.raca} &bull; <span className="text-amber-300 capitalize">{npcIndividual.ocupacao}</span> &bull; Gênero: {npcIndividual.genero === 'm' ? 'Masculino' : 'Feminino'} &bull; Seed: {seedNPCIndividual}
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${npcIndividual.nome} (${npcIndividual.raca}, ${npcIndividual.ocupacao})\n${npcIndividual.resumoLinhaUnica}\nPV: ${npcIndividual.stats.pv} | CA: ${npcIndividual.stats.ca} | ${npcIndividual.stats.ataque}\nAtributos: FOR ${npcIndividual.stats.for}, DES ${npcIndividual.stats.des}, CON ${npcIndividual.stats.con}, INT ${npcIndividual.stats.int}, SAB ${npcIndividual.stats.sab}, CAR ${npcIndividual.stats.car}\nEquipamento: ${npcIndividual.equipamento.join(', ')}`
                    );
                    setCopiedFormat('npc_ind');
                    setTimeout(() => setCopiedFormat(null), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedFormat === 'npc_ind' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Ficha Completa
                </button>
              </div>

              {/* Ficha Donjon 1-Linha */}
              <div className="p-3 rounded-xl bg-black/50 border border-white/5 font-mono text-xs text-slate-200 leading-relaxed">
                <span className="text-cyan-400 font-bold">Ficha Donjon: </span>
                {npcIndividual.resumoLinhaUnica}
              </div>

              {/* Grid de Atributos D&D (3d6) */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
                {[
                  { lbl: 'FOR', val: npcIndividual.stats.for },
                  { lbl: 'DES', val: npcIndividual.stats.des },
                  { lbl: 'CON', val: npcIndividual.stats.con },
                  { lbl: 'INT', val: npcIndividual.stats.int },
                  { lbl: 'SAB', val: npcIndividual.stats.sab },
                  { lbl: 'CAR', val: npcIndividual.stats.car },
                ].map((st) => {
                  const mod = Math.floor((st.val - 10) / 2);
                  return (
                    <div key={st.lbl} className="p-2.5 rounded-xl bg-black/40 border border-white/10">
                      <div className="text-[10px] text-slate-400 font-bold font-mono">{st.lbl}</div>
                      <div className="text-base font-black text-white">{st.val}</div>
                      <div className="text-[11px] font-mono text-cyan-300">
                        {mod >= 0 ? `+${mod}` : mod}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Estatísticas de Combate */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono p-3 rounded-xl bg-white/[0.02] border border-white/5">
                <span className="text-emerald-300 font-bold">Pontos de Vida (PV): {npcIndividual.stats.pv}</span>
                <span className="text-blue-300 font-bold">Classe de Armadura (CA): {npcIndividual.stats.ca}</span>
                <span className="text-slate-200">{npcIndividual.stats.ataque}</span>
              </div>

              {/* Perfil Psicológico e Segredo */}
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-purple-200">
                  <strong>Psicologia:</strong> {npcIndividual.personalidade.arquetipo} &bull; <em>{npcIndividual.personalidade.traco}</em> &bull; Motivação: {npcIndividual.personalidade.motivacao}.
                </div>
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20 text-rose-200">
                  <strong>Segredo Inconfessável:</strong> {npcIndividual.segredo}.
                </div>
              </div>

              {/* Equipamento */}
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300">
                <span className="font-bold text-slate-200">Itens & Equipamento: </span>
                {npcIndividual.equipamento.join(' &bull; ')}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 6: ITENS & TESOUROS (LOTE OU INDIVIDUAL)         */}
      {/* ======================================================== */}
      {subAba === 'itens' && (
        <section className="flex flex-col gap-4">
          {/* Seletor de Modo: Lote vs Individual */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10">
              <button
                onClick={() => setModoItem('lote')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  modoItem === 'lote' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sword className="w-3.5 h-3.5" />
                Lote de Tesouro
              </button>
              <button
                onClick={() => setModoItem('individual')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  modoItem === 'individual' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Item Individual
              </button>
            </div>

            {modoItem === 'lote' ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-300 font-bold font-mono">Seed Lote:</span>
                  <input
                    type="number"
                    value={seedItens}
                    onChange={(e) => setSeedItens(Number(e.target.value) || 0)}
                    className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
                  />
                  <button
                    onClick={sortearSeedItens}
                    className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Sortear</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-bold">Qtd:</span>
                  {[4, 6, 8, 12].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQtdItens(q)}
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        qtdItens === q ? 'bg-cyan-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-300 font-bold font-mono">Seed Item:</span>
                  <input
                    type="number"
                    value={seedItemIndividual}
                    onChange={(e) => setSeedItemIndividual(Number(e.target.value) || 0)}
                    className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
                  />
                  <button
                    onClick={sortearSeedItemIndividual}
                    className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                  >
                    <Dices className="w-3 h-3" />
                    <span>Sortear Item</span>
                  </button>
                </div>

                {/* Filtros de Categoria e Raridade */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Categoria:</span>
                  <select
                    value={itemCategoriaFiltro}
                    onChange={(e) => setItemCategoriaFiltro(e.target.value as any)}
                    className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="Qualquer">Qualquer</option>
                    <option value="Arma">Arma</option>
                    <option value="Armadura e Escudo">Armadura e Escudo</option>
                    <option value="Poção ou Elixir">Poção ou Elixir</option>
                    <option value="Item Maravilhoso">Item Maravilhoso</option>
                    <option value="Pergaminho Arcano">Pergaminho Arcano</option>
                    <option value="Gema e Joia">Gema e Joia</option>
                    <option value="Tesouro de Moedas">Tesouro de Moedas</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Raridade:</span>
                  <select
                    value={itemRaridadeFiltro}
                    onChange={(e) => setItemRaridadeFiltro(e.target.value as any)}
                    className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
                  >
                    <option value="Qualquer">Qualquer</option>
                    <option value="Comum">Comum</option>
                    <option value="Incomum">Incomum</option>
                    <option value="Raro">Raro</option>
                    <option value="Muito Raro">Muito Raro</option>
                    <option value="Lendário">Lendário</option>
                  </select>
                </div>

                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={itemPermitirMaldicao}
                    onChange={(e) => setItemPermitirMaldicao(e.target.checked)}
                    className="rounded border-white/20 text-rose-500 focus:ring-0"
                  />
                  <span>Maldições</span>
                </label>
              </div>
            )}
          </div>

          {/* VISUALIZAÇÃO DE LOTE DE ITENS */}
          {modoItem === 'lote' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {loteItensIsolado.map((it) => (
                <div
                  key={it.id}
                  className="p-3.5 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm text-cyan-300 font-sans">{it.nome}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {it.valorPO} PO
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mb-2">
                      {it.categoria} &bull; <span className="text-purple-300">{it.raridade}</span>
                    </div>
                    <p className="text-xs text-slate-200 mb-2 font-sans">{it.descricaoMecanica}</p>
                    {it.propriedadeMagica && (
                      <div className="text-xs text-cyan-300 mb-1 font-sans">
                        ✨ {it.propriedadeMagica}
                      </div>
                    )}
                    {it.peculiaridade && (
                      <div className="text-[11px] text-slate-400 italic font-sans">
                        &bull; {it.peculiaridade}
                      </div>
                    )}
                    {it.isAmaldicoado && (
                      <div className="text-xs text-rose-300 font-semibold mt-1">
                        💀 {it.maldicaoTexto}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* VISUALIZAÇÃO DE ITEM INDIVIDUAL DETALHADO */}
          {modoItem === 'individual' && (
            <div className="p-5 rounded-2xl bg-[#0d0b1a] border border-cyan-500/30 flex flex-col gap-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-white">{itemIndividual.nome}</h3>
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {itemIndividual.valorPO} PO
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {itemIndividual.categoria} &bull; <span className="text-purple-300 font-semibold">{itemIndividual.raridade}</span> &bull; Seed: {seedItemIndividual}
                  </div>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${itemIndividual.nome} (${itemIndividual.categoria}, ${itemIndividual.raridade}) — ${itemIndividual.valorPO} PO\n${itemIndividual.descricaoMecanica}\n${itemIndividual.propriedadeMagica ? `Propriedade Mágica: ${itemIndividual.propriedadeMagica}\n` : ''}${itemIndividual.peculiaridade ? `Peculiaridade: ${itemIndividual.peculiaridade}\n` : ''}${itemIndividual.isAmaldicoado ? `Maldição: ${itemIndividual.maldicaoTexto}` : ''}`
                    );
                    setCopiedFormat('item_ind');
                    setTimeout(() => setCopiedFormat(null), 2000);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedFormat === 'item_ind' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Ficha do Item
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Mecânica de Jogo (SRD / TTRPG):
                </div>
                <p className="text-sm text-slate-100 font-medium leading-relaxed">
                  {itemIndividual.descricaoMecanica}
                </p>
              </div>

              {itemIndividual.propriedadeMagica && (
                <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    Propriedade Mágica & Efeitos
                  </div>
                  <p>{itemIndividual.propriedadeMagica}</p>
                </div>
              )}

              {itemIndividual.peculiaridade && (
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 italic">
                  <strong>Peculiaridade Histórica:</strong> {itemIndividual.peculiaridade}
                </div>
              )}

              {itemIndividual.isAmaldicoado && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 space-y-1">
                  <div className="font-bold text-rose-300">💀 Maldição Antiga Ativa</div>
                  <p>{itemIndividual.maldicaoTexto}</p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 7: NOMES POR CADEIA DE MARKOV (§2 & §3)          */}
      {/* ======================================================== */}
      {subAba === 'markov_names' && (
        <section className="flex flex-col gap-4">
          {/* Controles de Semente e Configurações */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300 font-bold font-mono">Seed Markov:</span>
              <input
                type="number"
                value={seedMarkov}
                onChange={(e) => setSeedMarkov(Number(e.target.value) || 0)}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center focus:outline-none focus:border-cyan-400"
              />
              <button
                onClick={sortearSeedMarkov}
                className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3 h-3" />
                <span>Sortear Nomes</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Kit de Fonte:</span>
              <select
                value={kitMarkovSelecionado}
                onChange={(e) => setKitMarkovSelecionado(e.target.value)}
                className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200 font-medium"
              >
                {KITS_MARKOV_DISPONIVEIS.map((kit) => (
                  <option key={kit.id} value={kit.id}>
                    {kit.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-bold">Qtd:</span>
              {[5, 10, 15, 25, 40].map((q) => (
                <button
                  key={q}
                  onClick={() => setQtdNomesMarkov(q)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                    qtdNomesMarkov === q ? 'bg-cyan-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Ordem (N-Gram):</span>
              <select
                value={ordemMarkov}
                onChange={(e) => setOrdemMarkov(Number(e.target.value) || 2)}
                className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value={2}>Ordem 2 (Mais Criativo / Variações)</option>
                <option value={3}>Ordem 3 (Mais Próximo das Fontes)</option>
              </select>
            </div>
          </div>

          {/* Banner do Kit Ativo */}
          <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-cyan-200">
            <div>
              <strong>{kitMarkovAtivo.nome}</strong>: {kitMarkovAtivo.descricao}
            </div>
            <div className="font-mono text-[11px] text-cyan-400">
              {kitMarkovAtivo.id === 'customizado'
                ? `${listaNomesCustomParsed.length} palavras na lista personalizada`
                : `${kitMarkovAtivo.nomes.length} palavras-fonte pré-carregadas`}
            </div>
          </div>

          {/* Caixa de Texto Personalizada caso Kit Customizado esteja selecionado */}
          {kitMarkovSelecionado === 'customizado' && (
            <div className="p-3.5 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Palavras-Fonte para Treinamento (separadas por espaço, vírgula ou linha):
                </label>
                <span className="text-[11px] font-mono text-slate-500">
                  {listaNomesCustomParsed.length} nomes detectados
                </span>
              </div>
              <textarea
                rows={3}
                value={nomesCustomizadosTexto}
                onChange={(e) => setNomesCustomizadosTexto(e.target.value)}
                placeholder="Cole aqui uma lista de nomes para treinar o gerador de Markov..."
                className="w-full bg-black/60 border border-white/15 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          {/* Grid de Nomes Gerados por Markov */}
          <div className="p-4 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                <Scroll className="w-4 h-4 text-cyan-400" />
                <span>Nomes Sintetizados ({loteNomesMarkov.nomes.length})</span>
                <span className="text-[10px] text-slate-500 font-mono font-normal">
                  (Ordem {ordemMarkov} &bull; Semente #{seedMarkov})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(loteNomesMarkov.nomes.join(', '));
                    setCopiedFormat('markov_csv');
                    setTimeout(() => setCopiedFormat(null), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {copiedFormat === 'markov_csv' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copiar com Vírgula
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(loteNomesMarkov.nomes.join('\n'));
                    setCopiedFormat('markov_lines');
                    setTimeout(() => setCopiedFormat(null), 2000);
                  }}
                  className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-medium border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                >
                  {copiedFormat === 'markov_lines' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  Copiar em Linhas
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
              {loteNomesMarkov.nomes.map((nome, idx) => (
                <div
                  key={`${nome}-${idx}`}
                  onClick={() => {
                    navigator.clipboard.writeText(nome);
                    setCopiedFormat(`nome_${idx}`);
                    setTimeout(() => setCopiedFormat(null), 1500);
                  }}
                  className="p-3 rounded-lg bg-black/40 hover:bg-cyan-950/40 border border-white/5 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between group"
                  title="Clique para copiar este nome individualmente"
                >
                  <span className="text-sm font-bold text-slate-100 group-hover:text-cyan-300 font-mono tracking-wide">
                    {nome}
                  </span>
                  <span className="text-[10px] text-slate-600 group-hover:text-cyan-400 font-mono">
                    {copiedFormat === `nome_${idx}` ? 'Copiado!' : `#${idx + 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 8: GERADOR FANTASIA COM DROPDOWNLIST (§2 & §7)    */}
      {/* ======================================================== */}
      {subAba === 'gerador_fantasia' && (
        <section className="flex flex-col gap-4">
          {/* Barra de Seleção com Dropdownlist Hierárquico */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-300 font-bold font-mono">Seed Fantasia:</span>
              <input
                type="number"
                value={seedFantasia}
                onChange={(e) => setSeedFantasia(Number(e.target.value) || 0)}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-purple-300 text-center focus:outline-none focus:border-purple-400"
              />
              <button
                onClick={sortearSeedFantasia}
                className="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold border border-purple-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3 h-3" />
                <span>Sortear</span>
              </button>
            </div>

            {/* Dropdownlist Completo de 17 Subcategorias */}
            <div className="flex items-center gap-2 flex-grow max-w-md">
              <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Tabela / Tipo:</span>
              <select
                value={subcategoriaFantasia}
                onChange={(e) => setSubcategoriaFantasia(e.target.value as SubcategoriaFantasia)}
                className="w-full bg-black/70 border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs text-purple-200 font-semibold focus:outline-none focus:border-purple-400"
              >
                <optgroup label="Adventure Elements (Elementos de Aventura)">
                  <option value="quests">Quests: Missões / Tarefas</option>
                  <option value="rumors">Rumors: Boatos / Rumores</option>
                  <option value="locations">Random Locations: Locais Aleatórios</option>
                  <option value="encounters">Random Encounters: Encontros Aleatórios</option>
                </optgroup>
                <optgroup label="Characters (Personagens)">
                  <option value="npcs">NPCs: Personagens Não Jogáveis</option>
                </optgroup>
                <optgroup label="Items (Itens)">
                  <option value="art_objects">Art Objects: Objetos de Arte</option>
                  <option value="legendary_weapons">Legendary Weapons: Armas Lendárias</option>
                  <option value="ancient_tomes">Ancient Tomes: Tomos Antigos</option>
                </optgroup>
                <optgroup label="Loot (Saque / Espólio)">
                  <option value="pickpocket">Pickpocket Loot: Batedor de Carteiras (Furtar)</option>
                  <option value="giants_bag">Giant’s Bag: Bolsa de Gigante</option>
                </optgroup>
                <optgroup label="Setting (Cenário / Ambientação)">
                  <option value="castles">Castles: Castelos</option>
                  <option value="towns_cities">Towns and Cities: Vilas e Cidades</option>
                  <option value="traction_cities">Traction Cities: Cidades Tracionadas (Móveis)</option>
                  <option value="ships">Ships: Navios / Embarcações</option>
                  <option value="worlds_planes">Worlds and Planes: Mundos e Planos</option>
                </optgroup>
                <optgroup label="Embellishment (Adornos / Detalhes Visuais)">
                  <option value="coats_of_arms">Coats of Arms: Brasões de Armas</option>
                  <option value="dungeon_graffiti">Dungeon Graffiti: Grafites de Masmorra</option>
                  <option value="omens_portents">Omens and Portents: Presságios e Augúrios</option>
                  <option value="prophecies">Prophecies: Profecias</option>
                  <option value="secret_doors">Secret Doors: Portas Secretas</option>
                </optgroup>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-bold">Qtd:</span>
              {[2, 4, 6, 10].map((q) => (
                <button
                  key={q}
                  onClick={() => setQtdElementosFantasia(q)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                    qtdElementosFantasia === q ? 'bg-purple-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Lista de Resultados Gerados */}
          <div className="flex flex-col gap-3">
            {loteElementosFantasia.itens.map((item, idx) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#0d0b1a] border border-white/10 hover:border-purple-500/30 transition-all flex flex-col gap-2.5 shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold">
                      #{idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      {item.titulo}
                    </h4>
                  </div>
                  <button
                    onClick={() => {
                      const textLines = [
                        item.titulo,
                        item.conteudoPrincipal,
                        ...Object.entries(item.detalhes).map(([k, v]) => `${k}: ${v}`),
                      ].join('\n');
                      navigator.clipboard.writeText(textLines);
                      setCopiedFormat(`elem_${item.id}`);
                      setTimeout(() => setCopiedFormat(null), 2000);
                    }}
                    className="self-end sm:self-auto px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedFormat === `elem_${item.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    Copiar
                  </button>
                </div>

                <p className="text-xs text-slate-200 leading-relaxed font-sans">
                  {item.conteudoPrincipal}
                </p>

                {Object.keys(item.detalhes).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {Object.entries(item.detalhes).map(([chave, valor]) => (
                      <div
                        key={chave}
                        className="p-2 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-0.5"
                      >
                        <span className="text-[10px] font-bold text-purple-300 font-mono uppercase tracking-wider">
                          {chave}
                        </span>
                        <span className="text-slate-300 font-sans">{valor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SUB-ABA 9: SESSÃO AO VIVO (§11 FAST GM SCREEN)           */}
      {/* ======================================================== */}
      {subAba === 'sessao_ao_vivo' && (
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
                  <span className="text-slate-200">{log.texto}</span>
                </div>
                <span className="text-[10px] text-slate-500 self-end sm:self-auto">{log.hora}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ======================================================== */}
      {/* SUB-ABA: ENCONTROS ALEATÓRIOS (D&D 5.5 / 5e / D20)       */}
      {/* ======================================================== */}
      {subAba === 'encontros' && (
        <ForjaEncontrosPanel
          rootSeed={rootSeed}
          initialBioma={biomaEncontroSelecionado}
        />
      )}
    </div>
  );
};
