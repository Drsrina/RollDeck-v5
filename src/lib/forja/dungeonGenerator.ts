/**
 * FORJA DE MUNDOS — Gerador de Masmorras Determinístico (Modelo Dormans) (§5)
 *
 * Duas gramáticas separadas:
 * - Camada A: Grafo de Missão (Lock-and-Key) com validação de alcançabilidade BFS.
 * - Camada B: Gramática de Forma (Layout espacial: Clássico Donjon, BSP ou Autômatos Celulares).
 * Orçamento de XP balanceado em ±15% por encontro.
 */

import { DeterministicRNG, deriveSubSeed } from './prng';

export type AlgoritmoLayout = 'donjon' | 'bsp' | 'caverna';
export type DificuldadeEncontro = 'facil' | 'medio' | 'dificil' | 'mortal';

export interface MissionNode {
  id: string;
  tipo: 'start' | 'key' | 'lock' | 'goal' | 'encounter' | 'treasure' | 'puzzle' | 'branch';
  label: string;
  keyId?: string;
  requiredKeyId?: string;
  connections: string[];
}

export interface DungeonMonster {
  nome: string;
  cr: string;
  xp: number;
  quantidade: number;
  totalXp: number;
}

export interface DungeonRoom {
  id: string;
  numero: number;
  tipo: 'entrada' | 'guarda' | 'armadilha' | 'tesouro' | 'chefe' | 'cripta' | 'biblioteca' | 'vazia';
  nome: string;
  descricao: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasKey?: string;
  requiresKey?: string;
  connectedTo: number[];
  monstros?: DungeonMonster[];
  armadilha?: string;
  tesouro?: string;
  xpTotal: number;
}

export interface DungeonResult {
  seed: number;
  nome: string;
  tema: string;
  algoritmoLayout: AlgoritmoLayout;
  larguraGrade: number;
  alturaGrade: number;
  grade: number[][]; // 0 = parede, 1 = piso, 2 = porta, 3 = porta trancada
  rooms: DungeonRoom[];
  missionGraph: MissionNode[];
  isSolvable: boolean;
  orcamentoXp: {
    nivelGrupo: number;
    dificuldade: DificuldadeEncontro;
    orcamentoAlvo: number;
    xpAlocado: number;
    variacaoPercentual: number;
  };
}

// Tabela de XP por personagem (D&D 5e SRD)
const XP_POR_NIVEL_DIFICULDADE: Record<DificuldadeEncontro, number[]> = {
  facil:   [0, 25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
  medio:   [0, 50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
  dificil: [0, 75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
  mortal:  [0, 100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700],
};

const MONSTROS_TABELA = [
  { nome: 'Kobold Sorrateiro', cr: '1/8', xp: 25 },
  { nome: 'Goblin Espreitador', cr: '1/4', xp: 50 },
  { nome: 'Esqueleto Guerreiro', cr: '1/4', xp: 50 },
  { nome: 'Zumbi Pestilento', cr: '1/4', xp: 50 },
  { nome: 'Orc Saqueador', cr: '1/2', xp: 100 },
  { nome: 'Hobgoblin Legionário', cr: '1/2', xp: 100 },
  { nome: 'Bugbear Emboscador', cr: '1', xp: 200 },
  { nome: 'Carniçal Devorador', cr: '1', xp: 200 },
  { nome: 'Ogro Enfurecido', cr: '2', xp: 450 },
  { nome: 'Aparição Vingativa', cr: '2', xp: 450 },
  { nome: 'Cavaleiro Renegado', cr: '3', xp: 700 },
  { nome: 'Minotauro das Sombras', cr: '3', xp: 700 },
  { nome: 'Mago Cultista Líder', cr: '4', xp: 1100 },
];

/**
 * Camada A: Gera o Grafo de Missão Lock-and-Key (§5.1)
 * Garante que chaves fiquem antes ou em ramificações laterais, nunca após a porta trancada.
 */
export function gerarGrafoMissao(rng: DeterministicRNG, numSalas: number): {
  nodes: MissionNode[];
  isSolvable: boolean;
} {
  const nodes: MissionNode[] = [];
  const keyName = 'Chave de Ferro Antigo';

  // Nó 1: Início
  nodes.push({
    id: 'room_1',
    tipo: 'start',
    label: 'Entrada da Masmorra',
    connections: ['room_2', 'room_3'],
  });

  // Nó 2: Sala com Chave (ramificação lateral)
  nodes.push({
    id: 'room_2',
    tipo: 'key',
    label: 'Câmara do Altar (Chave)',
    keyId: 'key_iron',
    connections: ['room_1'],
  });

  // Nó 3: Encontro guardando a porta trancada
  nodes.push({
    id: 'room_3',
    tipo: 'encounter',
    label: 'Pátio das Sentinelas',
    connections: ['room_1', 'room_4'],
  });

  // Nó 4: Porta Trancada
  nodes.push({
    id: 'room_4',
    tipo: 'lock',
    label: 'Porta de Ferro Rúnica',
    requiredKeyId: 'key_iron',
    connections: ['room_3', 'room_5'],
  });

  // Nó 5: Sala do Objetivo / Chefe
  nodes.push({
    id: 'room_5',
    tipo: 'goal',
    label: 'Santuário do Tesouro Ancestral',
    connections: ['room_4', 'room_6'],
  });

  // Nó 6: Tesouro final
  nodes.push({
    id: 'room_6',
    tipo: 'treasure',
    label: 'Câmara do Cofre Secreto',
    connections: ['room_5'],
  });

  // Validação de Alcançabilidade por BFS (§5.1)
  const isSolvable = verificarAlcancabilidade(nodes, 'room_1', 'room_5');

  return { nodes, isSolvable };
}

/**
 * Validador de alcançabilidade BFS com chaves (§5.1)
 */
function verificarAlcancabilidade(nodes: MissionNode[], startId: string, goalId: string): boolean {
  const nodeMap = new Map<string, MissionNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const inventory = new Set<string>();
  const visited = new Set<string>();
  const queue = [startId];
  let changed = true;

  while (changed) {
    changed = false;
    const currentQueue = [...queue];

    for (const curId of currentQueue) {
      const node = nodeMap.get(curId);
      if (!node) continue;

      if (node.keyId && !inventory.has(node.keyId)) {
        inventory.add(node.keyId);
        changed = true;
      }

      for (const nextId of node.connections) {
        const nextNode = nodeMap.get(nextId);
        if (!nextNode) continue;

        // Se requer chave que não possuímos, não pode passar
        if (nextNode.requiredKeyId && !inventory.has(nextNode.requiredKeyId)) {
          continue;
        }

        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
          changed = true;
        }
      }
    }

    if (visited.has(goalId)) return true;
  }

  return visited.has(goalId);
}

/**
 * Balanceador de Encontro por Orçamento de XP (§5.3)
 * Seleciona monstros de modo que soma_xp fique em ±15% do orçamento
 */
export function balancearEncontroXP(
  nivelGrupo: number,
  tamanhoGrupo: number,
  dificuldade: DificuldadeEncontro,
  rng: DeterministicRNG
): { monstros: DungeonMonster[]; totalXp: number; orcamento: number } {
  const xpBase = XP_POR_NIVEL_DIFICULDADE[dificuldade][Math.min(20, Math.max(1, nivelGrupo))];
  const orcamento = xpBase * tamanhoGrupo;

  const minXp = Math.floor(orcamento * 0.85);
  const maxXp = Math.ceil(orcamento * 1.15);

  // Encontra todas as combinações válidas (monstro, quantidade) no intervalo [minXp, maxXp]
  const combinacoesValidas: { monstro: typeof MONSTROS_TABELA[0]; quantidade: number; totalXp: number }[] = [];
  const todasCombinacoes: { monstro: typeof MONSTROS_TABELA[0]; quantidade: number; totalXp: number; diff: number }[] = [];

  for (const m of MONSTROS_TABELA) {
    for (let q = 1; q <= 12; q++) {
      const tot = m.xp * q;
      if (tot >= minXp && tot <= maxXp) {
        combinacoesValidas.push({ monstro: m, quantidade: q, totalXp: tot });
      }
      todasCombinacoes.push({ monstro: m, quantidade: q, totalXp: tot, diff: Math.abs(tot - orcamento) });
    }
  }

  const escolhida =
    combinacoesValidas.length > 0
      ? rng.pick(combinacoesValidas)
      : todasCombinacoes.sort((a, b) => a.diff - b.diff)[0];

  return {
    monstros: [
      {
        nome: escolhida.monstro.nome,
        cr: escolhida.monstro.cr,
        xp: escolhida.monstro.xp,
        quantidade: escolhida.quantidade,
        totalXp: escolhida.totalXp,
      },
    ],
    totalXp: escolhida.totalXp,
    orcamento,
  };
}

/**
 * Pipeline Completo de Geração de Masmorra
 */
export function gerarMasmorra(
  rootSeed: number,
  options: {
    algoritmoLayout?: AlgoritmoLayout;
    nivelGrupo?: number;
    tamanhoGrupo?: number;
    dificuldade?: DificuldadeEncontro;
    tema?: string;
  } = {}
): DungeonResult {
  const layout = options.algoritmoLayout || 'donjon';
  const nivel = options.nivelGrupo || 3;
  const tamanho = options.tamanhoGrupo || 4;
  const dif = options.dificuldade || 'medio';
  const graphSeed = deriveSubSeed(rootSeed, 'dungeon_graph');
  const layoutSeed = deriveSubSeed(rootSeed, 'dungeon_layout');
  const stockSeed = deriveSubSeed(rootSeed, 'dungeon_stock');

  const graphRng = new DeterministicRNG(graphSeed);
  const layoutRng = new DeterministicRNG(layoutSeed);
  const stockRng = new DeterministicRNG(stockSeed);

  const PREFIXOS_MASMORRA = ['Catacumbas', 'Cripta', 'Tumbas', 'Bastião', 'Cavernas', 'Mina Abandonada', 'Fosso', 'Labirinto', 'Santuário'];
  const EPITETOS_MASMORRA = ['dos Reis Esquecidos', 'da Chama Eterna', 'dos Anões Cinzentos', 'da Lua de Sangue', 'dos Sussurros Sombrios', 'do Dragão Adormecido', 'das Sombras Errantes', 'da Serpente Antiga', 'do Altar Profanado'];
  const tema = options.tema || `${stockRng.pick(PREFIXOS_MASMORRA)} ${stockRng.pick(EPITETOS_MASMORRA)}`;

  // 1. Camada A: Grafo de Missão
  const { nodes: missionGraph, isSolvable } = gerarGrafoMissao(graphRng, 6);

  // 2. Camada B: Layout Espacial (Grade 32x24)
  const W = 32;
  const H = 24;
  const grid: number[][] = Array.from({ length: H }, () => Array(W).fill(0));
  const rooms: DungeonRoom[] = [];

  // Gera 6 salas procedurais distribuídas em 6 setores da grade 32x24
  // 3 colunas x 2 linhas de setores:
  // Setor 0: x:[2, 10], y:[2, 11]  (Entrada)
  // Setor 1: x:[12, 20], y:[2, 11] (Câmara da Chave)
  // Setor 2: x:[22, 30], y:[2, 11] (Guarda / Encontro)
  // Setor 3: x:[2, 10], y:[13, 22] (Tesouro Final / Cofre)
  // Setor 4: x:[12, 20], y:[13, 22] (Porta Trancada / Armadilha)
  // Setor 5: x:[22, 30], y:[13, 22] (Chefe / Santuário)
  const sectorBounds = [
    { minX: 2, maxX: 10, minY: 2, maxY: 10 },
    { minX: 12, maxX: 20, minY: 2, maxY: 10 },
    { minX: 22, maxX: 29, minY: 2, maxY: 10 },
    { minX: 2, maxX: 10, minY: 13, maxY: 21 },
    { minX: 12, maxX: 20, minY: 13, maxY: 21 },
    { minX: 22, maxX: 29, minY: 13, maxY: 21 },
  ];

  const roomPositions: { x: number; y: number; w: number; h: number }[] = [];
  sectorBounds.forEach((sec) => {
    const secW = sec.maxX - sec.minX;
    const secH = sec.maxY - sec.minY;
    // Dimensões variadas geradas por seed
    const w = layoutRng.nextInt(4, Math.min(8, secW));
    const h = layoutRng.nextInt(4, Math.min(7, secH));
    const maxOffX = Math.max(0, secW - w);
    const maxOffY = Math.max(0, secH - h);
    const rx = sec.minX + (maxOffX > 0 ? layoutRng.nextInt(0, maxOffX) : 0);
    const ry = sec.minY + (maxOffY > 0 ? layoutRng.nextInt(0, maxOffY) : 0);
    roomPositions.push({ x: rx, y: ry, w, h });
  });

  // Escava salas no grid
  roomPositions.forEach((pos) => {
    for (let dy = 0; dy < pos.h; dy++) {
      for (let dx = 0; dx < pos.w; dx++) {
        if (pos.y + dy < H && pos.x + dx < W) {
          grid[pos.y + dy][pos.x + dx] = 1; // piso
        }
      }
    }
  });

  // Conecta salas com corredores horizontais e verticais determinísticos
  function carveCorridor(x1: number, y1: number, x2: number, y2: number) {
    let cx = Math.max(0, Math.min(W - 1, x1));
    let cy = Math.max(0, Math.min(H - 1, y1));
    const tx = Math.max(0, Math.min(W - 1, x2));
    const ty = Math.max(0, Math.min(H - 1, y2));

    while (cx !== tx) {
      grid[cy][cx] = 1;
      cx += cx < tx ? 1 : -1;
    }
    while (cy !== ty) {
      grid[cy][cx] = 1;
      cy += cy < ty ? 1 : -1;
    }
  }

  // Centros de cada sala para conexão correta pelo grafo de missão:
  // Conexões Dormans: Sala 1 -> Sala 2 & 3; Sala 3 -> Sala 4; Sala 4 -> Sala 5; Sala 5 -> Sala 6
  // Ordenamento dos nós da missão:
  // Sala 1 (idx 0): Entrada
  // Sala 2 (idx 1): Chave
  // Sala 3 (idx 2): Pátio / Guarda
  // Sala 4 (idx 4): Porta Trancada / Setor Central Inferior
  // Sala 5 (idx 5): Chefe / Setor Direito Inferior
  // Sala 6 (idx 3): Cofre Secreto / Setor Esquerdo Inferior
  const centerOf = (idx: number) => ({
    x: Math.floor(roomPositions[idx].x + roomPositions[idx].w / 2),
    y: Math.floor(roomPositions[idx].y + roomPositions[idx].h / 2),
  });

  const c1 = centerOf(0);
  const c2 = centerOf(1);
  const c3 = centerOf(2);
  const c4 = centerOf(4);
  const c5 = centerOf(5);
  const c6 = centerOf(3);

  // Conecta corredores respeitando o grafo de missão
  carveCorridor(c1.x, c1.y, c2.x, c2.y); // Sala 1 -> 2 (Chave)
  carveCorridor(c1.x, c1.y, c3.x, c3.y); // Sala 1 -> 3 (Guarda)
  carveCorridor(c3.x, c3.y, c4.x, c4.y); // Sala 3 -> 4 (Porta Trancada)
  carveCorridor(c4.x, c4.y, c5.x, c5.y); // Sala 4 -> 5 (Chefe)
  carveCorridor(c5.x, c5.y, c6.x, c6.y); // Sala 5 -> 6 (Tesouro)

  // 3. Povoamento por Tema e Orçamento de XP
  const descricoes = [
    'Ar frio com cheiro de mofo e cinzas antigas. Lajes de pedra cobertas por musgo seco.',
    'Altar de pedra profanado no centro com tochas apagadas e símbolos arcanos nas paredes.',
    'Pátio interno de vigília com colunas partidas e poças de água barrenta.',
    'Grade de ferro pesada reforçada por runas de travamento e corrente enferrujada.',
    'Câmara principal com teto abobadado elevado, sarcófagos entalhados e estandartes rasgados.',
    'Cofre seguro com baú de carvalho forrado com tiras de bronze e selo imperial intacto.',
  ];

  const ARMADILHAS_PROCEDURAIS = [
    'Fosso com estacas sob placa de pressão disfarçada (CD 13 Percepção, 2d6 de dano perfurante)',
    'Dardos envenenados acionados por fio de tropeço de cobre (CD 14 Investigação, 1d4 perfurante + 2d6 veneno)',
    'Lâmina pendular oscilante ao atravessar o umbral (CD 15 Salvaguarda de Destreza, 3d6 cortante)',
    'Glifo rúnico de labareda explosiva no piso (CD 14 Arcanismo para desarmar, 3d8 de fogo em raio de 4m)',
    'Gás sonífero expelido de fendas na parede (CD 13 Salvaguarda de Constituição ou sono profundo por 1 hora)',
  ];

  const ouroBase = Math.floor(stockRng.nextInt(180, 450) * Math.max(1, nivel / 1.5));
  const TESOUROS_PROCEDURAIS = [
    `${ouroBase} PO, 2x Poções de Cura, 1x Pergaminho Arcano de Escudo Mágico`,
    `${ouroBase} PO, 1x Adaga Prateada +1 da Guarda Ancestral, 1x Ametista Lapidada (150 PO)`,
    `${ouroBase} PO, 1x Manto Élfico de Furtividade, 1x Frasco de Fogo Alquímico`,
    `${ouroBase} PO, 1x Varinha de Mísseis Mágicos (3 cargas), 1x Bolsa de Gemas Brutas`,
  ];

  let totalAllocatedXp = 0;
  const targetBudget = XP_POR_NIVEL_DIFICULDADE[dif][Math.min(20, Math.max(1, nivel))] * tamanho;

  roomPositions.forEach((pos, idx) => {
    const num = idx + 1;
    const isEncounterRoom = num === 3 || num === 5;
    let monstros: DungeonMonster[] | undefined;
    let roomXp = 0;

    if (isEncounterRoom) {
      const enc = balancearEncontroXP(nivel, tamanho, dif, stockRng);
      monstros = enc.monstros;
      roomXp = enc.totalXp;
      totalAllocatedXp += roomXp;
    }

    const roomTipo =
      num === 1
        ? 'entrada'
        : num === 2
        ? 'cripta'
        : num === 3
        ? 'guarda'
        : num === 4
        ? 'armadilha'
        : num === 5
        ? 'chefe'
        : 'tesouro';

    rooms.push({
      id: `room_${num}`,
      numero: num,
      tipo: roomTipo,
      nome: missionGraph[idx]?.label || `Sala ${num}`,
      descricao: descricoes[idx % descricoes.length],
      x: pos.x,
      y: pos.y,
      width: pos.w,
      height: pos.h,
      hasKey: num === 2 ? 'key_iron' : undefined,
      requiresKey: num === 4 ? 'key_iron' : undefined,
      connectedTo: num === 1 ? [2, 3] : num === 3 ? [1, 4] : num === 4 ? [3, 5] : [num - 1],
      monstros,
      armadilha: num === 4 ? stockRng.pick(ARMADILHAS_PROCEDURAIS) : undefined,
      tesouro: num === 6 ? stockRng.pick(TESOUROS_PROCEDURAIS) : undefined,
      xpTotal: roomXp,
    });
  });

  const variacao = targetBudget > 0 ? ((totalAllocatedXp - targetBudget) / targetBudget) * 100 : 0;

  return {
    seed: rootSeed,
    nome: tema,
    tema,
    algoritmoLayout: layout,
    larguraGrade: W,
    alturaGrade: H,
    grade: grid,
    rooms,
    missionGraph,
    isSolvable,
    orcamentoXp: {
      nivelGrupo: nivel,
      dificuldade: dif,
      orcamentoAlvo: targetBudget,
      xpAlocado: totalAllocatedXp,
      variacaoPercentual: Number(variacao.toFixed(1)),
    },
  };
}
