/**
 * FORJA DE MUNDOS — Pipeline Integrado em Camadas (§1.1 & §14)
 *
 * Conecta:
 * Terreno (§4.5) → Assentamento (§6) → Masmorra (§5)
 *       ↓                   ↓                  ↓
 *  (bioma, rio,        (facções, NPCs,    (missão, encontros,
 *   elevação, rotas)    layout urbano)      tesouro, XP)
 *       └───────────────────┴──────────────────┘
 *                           ↓
 *                  Weaver de Entidades (§4)
 *                           ↓
 *                   Exportação (§10)
 */

import { DeterministicRNG, deriveSubSeed, createReproducibilityManifest, ReproducibilityManifest } from './prng';
import { EntityWeaver, ForjaEntity } from './weaver';
import { TableEngine } from './tableEngine';
import { TABELAS_CANONICAS } from './tablesData';
import { gerarTerreno, TerrenoResult } from './terrainGenerator';
import { gerarAssentamento, SettlementResult } from './settlementGenerator';
import { gerarMasmorra, DungeonResult } from './dungeonGenerator';
import { gerarLoteNPCs, NPCEntry } from './npcGenerator';
import { gerarLoteItens, ItemGerado } from './itemGenerator';

export interface MundoCompletoResult {
  manifesto: ReproducibilityManifest;
  terreno: TerrenoResult;
  assentamento: SettlementResult;
  masmorra: DungeonResult;
  npcs: NPCEntry[];
  itens: ItemGerado[];
  rumores: string[];
  weaver: EntityWeaver;
}

export function gerarMundoCompleto(rootSeed: number): MundoCompletoResult {
  const manifesto = createReproducibilityManifest(rootSeed);
  const tableEngine = new TableEngine(TABELAS_CANONICAS);
  const weaver = new EntityWeaver();

  // 1. Gera Terreno
  const terrenoSeed = deriveSubSeed(rootSeed, 'terreno', '1.0.0');
  const terreno = gerarTerreno(terrenoSeed, { topologia: 'hex', cols: 24, rows: 18 });

  // Registra células notáveis e assentamentos do terreno no Weaver
  for (const s of terreno.settlements) {
    weaver.addEntity({
      id: `settle_${s.cellId}`,
      type: 'settlement',
      name: s.name,
      description: `Papel: ${s.role}. Pontuação de burg: ${s.score}. Célula #${s.cellId}`,
      tags: ['assentamento', s.role],
      data: { cellId: s.cellId, score: s.score },
      createdAtSeed: rootSeed,
    });
  }

  // 2. Gera Assentamento Principal vinculado ao terreno
  const settleSeed = deriveSubSeed(rootSeed, 'assentamento', '1.0.3');
  const capitalBurg = terreno.settlements[0];
  const capitalCell = capitalBurg ? terreno.cells[capitalBurg.cellId] : undefined;

  const assentamento = gerarAssentamento(settleSeed, {
    nome: capitalBurg?.name || 'Vila da Aliança',
    tamanho: 'vila',
    temRio: capitalCell?.isRio ?? true,
    temColina: capitalCell?.bioma === 'Colinas' || capitalCell?.bioma === 'Montanha',
    temEstradaPrincipal: true,
  });

  // Registra facções e distritos no Weaver
  for (const f of assentamento.faccoes) {
    weaver.addEntity({
      id: f.id,
      type: 'faction',
      name: f.nome,
      description: `Líder: ${f.lider}. Objetivo: ${f.objetivo}`,
      tags: ['facção', f.tipo],
      data: f,
      createdAtSeed: rootSeed,
    });

    for (const rival of f.rivais) {
      const rivalEntity = assentamento.faccoes.find((o) => o.nome === rival);
      if (rivalEntity) {
        weaver.addRelation(f.id, rivalEntity.id, 'rival_of', true);
      }
    }
  }

  // 3. Gera NPCs e vincula às facções
  const npcSeed = deriveSubSeed(rootSeed, 'npc', '1.0.0');
  const npcs = gerarLoteNPCs(npcSeed, 6);

  npcs.forEach((npc, idx) => {
    weaver.addEntity({
      id: npc.id,
      type: 'npc',
      name: npc.nome,
      description: npc.resumoLinhaUnica,
      tags: ['npc', npc.ocupacao, npc.raca],
      data: npc,
      createdAtSeed: rootSeed,
    });

    // Vincula NPC ao assentamento
    if (capitalBurg) {
      weaver.addRelation(npc.id, `settle_${capitalBurg.cellId}`, 'located_at');
    }

    // Vincula a uma facção local
    if (assentamento.faccoes.length > 0) {
      const fac = assentamento.faccoes[idx % assentamento.faccoes.length];
      npc.faccaoId = fac.id;
      npc.faccaoNome = fac.nome;
      weaver.addRelation(npc.id, fac.id, 'member_of', true);
    }
  });

  // 4. Gera Masmorra Ancorada em Célula de Terreno Próxima
  const dungeonSeed = deriveSubSeed(rootSeed, 'masmorra', '1.1.0');
  // Procura célula de montanha, floresta ou ruína no terreno
  const dungeonCell =
    terreno.cells.find((c) => c.landmark?.tipo === 'fortaleza' || c.bioma === 'Montanha' || c.bioma === 'Colinas') ||
    terreno.cells.find((c) => !c.isOceano && !c.isLago) ||
    terreno.cells[0];

  const dungeonThemeRng = new DeterministicRNG(deriveSubSeed(dungeonSeed, 'theme_name'));
  const PREFIXOS_DUNGEON_BIOMA: Record<string, string[]> = {
    Montanha: ['Mina Abandonada', 'Cidadela Subterrânea', 'Fosso de Mineração', 'Cavernas Escuras', 'Bastião de Granito'],
    Colinas: ['Tumbas Escavadas', 'Túmulo do Rei das Colinas', 'Cripta dos Antigos', 'Covil dos Salteadores'],
    'Floresta Temperada': ['Catacumbas do Carvalho Sagrado', 'Labirinto de Raízes', 'Templo Silvestre Oculto', 'Santuário da Druida'],
    Pântano: ['Fosso Pestilento', 'Ruínas Afundadas', 'Covil das Serpentes Negras', 'Necrópole Alagada'],
    Costa: ['Gruta dos Contrabandistas', 'Caverna das Marés', 'Farol Assombrado', 'Catacumbas dos Náufragos'],
  };
  const EPITETOS_DUNGEON = [
    'dos Anões Cinzentos', 'da Chama Eterna', 'dos Reis Esquecidos', 'da Lua de Sangue',
    'dos Sussurros Sombrios', 'do Dragão Adormecido', 'das Sombras Errantes', 'do Altar Profanado',
    'da Serpente Antiga', 'das Profundezas Esquecidas', 'do Vigia Cego', 'da Coroa Partida',
  ];

  const poolBioma = PREFIXOS_DUNGEON_BIOMA[dungeonCell.bioma] || ['Santuário Proibido', 'Catacumbas Ancestrais', 'Labirinto Subterrâneo', 'Cripta Esquecida'];
  const temaMasmorra = `${dungeonThemeRng.pick(poolBioma)} ${dungeonThemeRng.pick(EPITETOS_DUNGEON)}`;

  const masmorra = gerarMasmorra(dungeonSeed, {
    tema: temaMasmorra,
    nivelGrupo: 3,
    tamanhoGrupo: 4,
    dificuldade: 'medio',
  });

  weaver.addEntity({
    id: `dungeon_${dungeonCell.id}`,
    type: 'dungeon',
    name: masmorra.nome,
    description: `Ancorada na célula #${dungeonCell.id} (${dungeonCell.bioma}). Salas: ${masmorra.rooms.length}. XP Alocado: ${masmorra.orcamentoXp.xpAlocado}.`,
    tags: ['masmorra', dungeonCell.bioma],
    data: { cellId: dungeonCell.id, isSolvable: masmorra.isSolvable },
    createdAtSeed: rootSeed,
  });

  if (capitalBurg) {
    // Liga a masmorra como ameaça / oportunidade para o assentamento
    weaver.addRelation(`dungeon_${dungeonCell.id}`, `settle_${capitalBurg.cellId}`, 'threatens');
  }

  // 5. Gera Itens e Tesouros
  const itemSeed = deriveSubSeed(rootSeed, 'itens', '1.0.0');
  const itens = gerarLoteItens(itemSeed, 6);

  itens.forEach((it, idx) => {
    weaver.addEntity({
      id: it.id,
      type: 'item',
      name: it.nome,
      description: `${it.categoria} (${it.raridade}) — ${it.descricaoMecanica} [Valor: ${it.valorPO} PO]`,
      tags: ['item', it.categoria, it.raridade],
      data: it,
      createdAtSeed: rootSeed,
    });

    // Coloca item na sala de tesouro da masmorra
    if (idx === 0) {
      weaver.addRelation(it.id, `dungeon_${dungeonCell.id}`, 'located_at');
    }
  });

  // 6. Gera Rumores Interconectados (§4.3)
  const rumorRng = new DeterministicRNG(deriveSubSeed(rootSeed, 'rumores'));
  const rumores: string[] = [];

  const ferreiroNpc = npcs.find((n) => n.ocupacao === 'ferreiro') || npcs[0];
  const faccaoLadroes = assentamento.faccoes.find((f) => f.id === 'fac_ladroes') || assentamento.faccoes[0];

  const rumorContext = {
    ferreiro: ferreiroNpc?.nome || 'Torben',
    faccao: faccaoLadroes?.nome || 'Irmandade dos Olhos de Corvo',
    regiao: temaMasmorra,
    nivel_party: 3,
  };

  for (let r = 0; r < 4; r++) {
    const sorteio = tableEngine.selectWeighted('rumores_taverna', rumorRng, rumorContext);
    rumores.push(sorteio.texto);

    // Registra rumor no Weaver com referência cruzada
    const rId = `rumor_${r + 1}`;
    weaver.addEntity({
      id: rId,
      type: 'rumor',
      name: `Rumor da Taverna #${r + 1}`,
      description: sorteio.texto,
      tags: ['rumor'],
      data: { texto: sorteio.texto },
      createdAtSeed: rootSeed,
    });

    if (ferreiroNpc) weaver.addRelation(rId, ferreiroNpc.id, 'references');
    if (faccaoLadroes) weaver.addRelation(rId, faccaoLadroes.id, 'references');
    weaver.addRelation(rId, `dungeon_${dungeonCell.id}`, 'references');
  }

  return {
    manifesto,
    terreno,
    assentamento,
    masmorra,
    npcs,
    itens,
    rumores,
    weaver,
  };
}
