/**
 * FORJA DE MUNDOS — Gerador Fantasia Aleatório com Dropdownlist (§2 & §7)
 *
 * 5 Categorias Principais e 17 Subcategorias 100% Determinísticas (sem IA):
 * 1. Adventure Elements: Quests, Rumors, Random Locations, Random Encounters
 * 2. Characters: NPCs
 * 3. Items: Art Objects, Legendary Weapons, Ancient Tomes
 * 4. Loot: Pickpocket Loot, Giant's Bag
 * 5. Setting: Castles, Towns and Cities, Traction Cities, Ships, Worlds and Planes
 * 6. Embellishment: Coats of Arms, Dungeon Graffiti, Omens and Portents, Prophecies, Secret Doors
 */

import { DeterministicRNG } from './prng';

export type CategoriaFantasia =
  | 'adventure_elements'
  | 'characters'
  | 'items'
  | 'loot'
  | 'setting'
  | 'embellishment';

export type SubcategoriaFantasia =
  // Adventure Elements
  | 'quests'
  | 'rumors'
  | 'locations'
  | 'encounters'
  // Characters
  | 'npcs'
  // Items
  | 'art_objects'
  | 'legendary_weapons'
  | 'ancient_tomes'
  // Loot
  | 'pickpocket'
  | 'giants_bag'
  // Setting
  | 'castles'
  | 'towns_cities'
  | 'traction_cities'
  | 'ships'
  | 'worlds_planes'
  // Embellishment
  | 'coats_of_arms'
  | 'dungeon_graffiti'
  | 'omens_portents'
  | 'prophecies'
  | 'secret_doors';

export interface MetaSubcategoria {
  id: SubcategoriaFantasia;
  categoria: CategoriaFantasia;
  titulo: string;
  descricao: string;
  icone: string;
}

export const LISTA_SUBCATEGORIAS: MetaSubcategoria[] = [
  // Adventure Elements
  { id: 'quests', categoria: 'adventure_elements', titulo: 'Quests (Missões / Tarefas)', descricao: 'Contratante, objetivo, reviravolta e recompensa em ouro/glória', icone: 'Scroll' },
  { id: 'rumors', categoria: 'adventure_elements', titulo: 'Rumors (Boatos / Rumores)', descricao: 'Fofocas de taverna, conspirações e sussurros perigosos', icone: 'MessageSquare' },
  { id: 'locations', categoria: 'adventure_elements', titulo: 'Random Locations (Locais Aleatórios)', descricao: 'Marcos geográficos, ruínas, grutas e pontos de interesse nos ermos', icone: 'MapPin' },
  { id: 'encounters', categoria: 'adventure_elements', titulo: 'Random Encounters (Encontros Aleatórios)', descricao: 'Criaturas ou grupos, atividade em curso e reação inicial', icone: 'Swords' },

  // Characters
  { id: 'npcs', categoria: 'characters', titulo: 'NPCs (Personagens Rápidos)', descricao: 'Nome, arquétipo, trejeito marcante, desejo e gancho imediato', icone: 'Users' },

  // Items
  { id: 'art_objects', categoria: 'items', titulo: 'Art Objects (Objetos de Arte)', descricao: 'Estatuetas, cálices, joias preciosas, quadros e tapeçarias com valor em PO', icone: 'Sparkles' },
  { id: 'legendary_weapons', categoria: 'items', titulo: 'Legendary Weapons (Armas Lendárias)', descricao: 'Lâminas ancestrais, arcos élficos e martelos rúnicos com história e poderes', icone: 'Sword' },
  { id: 'ancient_tomes', categoria: 'items', titulo: 'Ancient Tomes (Tomos Antigos)', descricao: 'Grimórios encadernados em couro bizarro, magias esquecidas e tratados arcanos', icone: 'Book' },

  // Loot
  { id: 'pickpocket', categoria: 'loot', titulo: 'Pickpocket Loot (Batedor de Carteiras)', descricao: 'Itens furtados de pedestres: moedas, bugigangas, cartas e relíquias miúdas', icone: 'Hand' },
  { id: 'giants_bag', categoria: 'loot', titulo: 'Giant’s Bag (Bolsa de Gigante)', descricao: 'Pertences colossais: troncos esculpidos, carcaças defumadas, pedregulhos rúnicos', icone: 'Package' },

  // Setting
  { id: 'castles', categoria: 'setting', titulo: 'Castles (Castelos)', descricao: 'Fortalezas, baluartes acidentados, senhores regentes e passagens secretas', icone: 'Castle' },
  { id: 'towns_cities', categoria: 'setting', titulo: 'Towns and Cities (Vilas e Cidades)', descricao: 'Povoações urbanas, indústrias primárias e tensões sociais correntes', icone: 'Home' },
  { id: 'traction_cities', categoria: 'setting', titulo: 'Traction Cities (Cidades Tracionadas / Móveis)', descricao: 'Metrópoles sobre esteiras gigantescas, locomotivas colossais e frotas móveis', icone: 'Truck' },
  { id: 'ships', categoria: 'setting', titulo: 'Ships (Navios / Embarcações)', descricao: 'Caravelas, galeões piratas, naus fantasmas, capitães e segredos no convés', icone: 'Anchor' },
  { id: 'worlds_planes', categoria: 'setting', titulo: 'Worlds and Planes (Mundos e Planos)', descricao: 'Dimensões astrais, planos elementais, leis físicas alteradas e portais de acesso', icone: 'Globe' },

  // Embellishment
  { id: 'coats_of_arms', categoria: 'embellishment', titulo: 'Coats of Arms (Brasões de Armas)', descricao: 'Heráldica detalhada: esmaltes, partições, figuras heráldicas e lema de família', icone: 'Shield' },
  { id: 'dungeon_graffiti', categoria: 'embellishment', titulo: 'Dungeon Graffiti (Grafites de Masmorra)', descricao: 'Avisos talhados a adaga, fezes de monstros, runas de ladrões e mensagens de socorro', icone: 'Edit3' },
  { id: 'omens_portents', categoria: 'embellishment', titulo: 'Omens and Portents (Presságios e Augúrios)', descricao: 'Eclipses vermelhos, chuva de cinzas, comportamento animal bizarro e profecias do céu', icone: 'Eye' },
  { id: 'prophecies', categoria: 'embellishment', titulo: 'Prophecies (Profecias)', descricao: 'Versos crípticos de oráculos antigos prenunciando cataclismos ou salvadores', icone: 'Flame' },
  { id: 'secret_doors', categoria: 'embellishment', titulo: 'Secret Doors (Portas Secretas)', descricao: 'Mecanismos engenhosos de abertura, dicas visuais sutis e o perigo que as protege', icone: 'Key' },
];

export interface ItemGeradoFantasia {
  id: string;
  subcategoria: SubcategoriaFantasia;
  titulo: string;
  conteudoPrincipal: string;
  detalhes: Record<string, string>;
  tags: string[];
}

// -------------------------------------------------------------
// MOTORES DE GERAÇÃO DETERMINÍSTICA POR SUBCATEGORIA
// -------------------------------------------------------------

export function gerarElementoFantasia(
  sub: SubcategoriaFantasia,
  rng: DeterministicRNG
): ItemGeradoFantasia {
  switch (sub) {
    case 'quests': {
      const contratantes = [
        'Mercador idoso à beira da falência',
        'Capitão da guarda com as mãos atadas pela lei',
        'Mago recluso que teme deixar sua torre',
        'Criança órfã que herdou um amuleto que sussurra',
        'Sacerdotisa desesperada com visões de ruína',
        'Líder de guilda de ladrões traído por seu braço direito',
        'Caçador experiente que encontrou pegadas impossíveis',
        'Espírito inquieto preso a uma lápide quebrada',
      ];
      const objetivos = [
        'Recuperar um colar de rubis roubado de um sarcófago selado',
        'Eliminar um ninho de carniçais que bloqueia o poço de água doce',
        'Escoltar um diplomata até o passo da montanha sob nevasca',
        'Encontrar o ingrediente raro que cresce apenas no coração de um pântano ácido',
        'Descobrir quem está envenenando a cerveja das três tavernas centrais',
        'Interromper o ritual de convocação antes da terceira badalada da meia-noite',
        'Mapear as galerias inferiores de um fosso que se abriu após o terremoto',
      ];
      const complicacoes = [
        'O verdadeiro culpado é parente direto do contratante',
        'O item está amaldiçoado e atrai feras carnívoras a cada pôr do sol',
        'Um grupo rival de mercenários está caçando o mesmo objetivo',
        'O local está prestes a desabar devido a explosivos plantados',
        'A vítima na verdade não deseja ser resgatada',
        'A milícia municipal foi subornada para prender qualquer um que investigue',
      ];
      const recompensas = [
        `${rng.nextInt(150, 600)} PO e uma carta de salvo-conduto nos ducados do sul`,
        `${rng.nextInt(80, 300)} PO, além de 2 poções de cura maior e um anel de sinete antigo`,
        'Um mapa do tesouro desenhado em pergaminho de pele de serpente',
        'A posse de uma cabana fortificada nas colinas com oficina de ferreiro',
        'O favor incondicional de uma casa nobre influente na capital',
      ];

      const c = rng.pick(contratantes);
      const o = rng.pick(objetivos);
      const comp = rng.pick(complicacoes);
      const r = rng.pick(recompensas);

      return {
        id: `quest_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: `Missão: ${o.slice(0, 40)}...`,
        conteudoPrincipal: `${c} precisa que aventureiros realizem: ${o}. Porém, ${comp.toLowerCase()}.`,
        detalhes: {
          'Contratante': c,
          'Objetivo': o,
          'Complicação': comp,
          'Recompensa': r,
        },
        tags: ['aventura', 'missão', 'contrato'],
      };
    }

    case 'rumors': {
      const topicos = [
        'Dizem que o prefeito foi substituído por um doppelgänger há duas semanas.',
        'Um sino de prata toca sozinho no campanário em noites de lua nova.',
        'As ratazanas do porto estão marchando em formação militar sob a liderança de um rato albino gigante.',
        'O ferreiro local comprou três carroças de carvão preto que emite fumaça verde e fria.',
        'Uma carruagem sem condutor foi vista cruzando o cemitério a galope na última quinta-feira.',
        'Dizem que no fundo da Taverna do Javali existe um túnel que leva direto ao tesouro municipal.',
        'O bispo proibiu qualquer um de pronunciar o nome da antiga vila que afundou no lago.',
      ];
      const veracidades = [
        '100% Verdadeiro (com detalhes adicionais chocantes a descobrir)',
        'Parcialmente Verdadeiro (exagerado pelo medo popular)',
        'Falso (plantado por agentes de uma facção rival para desviar atenção)',
        'Verdadeiro, mas o perigo já se espalhou para as redondezas',
      ];
      const texto = rng.pick(topicos);
      const ver = rng.pick(veracidades);

      return {
        id: `rumor_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Rumor de Taverna',
        conteudoPrincipal: `"${texto}"`,
        detalhes: {
          'Boato': texto,
          'Veracidade / Segredo do Mestre': ver,
          'Fonte provável': rng.pick(['Garganta de um marinheiro bêbado', 'Mendigo cego na sarjeta', 'Pajem de armadura polida', 'Mercadora de tecidos assustada']),
        },
        tags: ['rumor', 'mistério', 'informação'],
      };
    }

    case 'locations': {
      const tipos = [
        'Menir de Obsidiana Partido',
        'Ponte Levadiça Caída sobre Desfiladeiro',
        'Bosque dos Choupos Enforcados',
        'Círculo de Ossos de Dragão Petrificado',
        'Ruína de Torre de Observação Imperial',
        'Fonte Termal Borbulhante com Enxofre',
        'Mina de Sal Subterrânea Abandonada',
        'Túmulo ao Ar Livre com Estátua Decapitada',
      ];
      const perigos = [
        'Névoa sulfurosa que corrói metais em contato prolongado',
        'Espíritos vingativos que sussurram pensamentos autodestrutivos',
        'Solo instável que cede sobre uma galeria cheia de espinhos',
        'Ronda noturna de harpias famintas',
        'Flores carnívoras que exalam pólen alucinógeno',
      ];
      const segredos = [
        'Um compartimento sob a laje oculta uma caixa de ferro trancada',
        'Marcas secretas nas pedras apontam para um veio de ouro nativo',
        'À meia-noite, a sombra da estátua aponta exatamente para a entrada de uma cripta',
        'Um cadáver recente de um mensageiro carrega cartas lacradas em cera vermelha',
      ];
      const t = rng.pick(tipos);
      const p = rng.pick(perigos);
      const s = rng.pick(segredos);

      return {
        id: `loc_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: t,
        conteudoPrincipal: `Local marcante nos ermos cercado por terreno agreste. ${p}.`,
        detalhes: {
          'Tipo de Local': t,
          'Perigo Imediato': p,
          'Segredo Oculto': s,
        },
        tags: ['local', 'ermos', 'exploração'],
      };
    }

    case 'encounters': {
      const criaturas = [
        '3x Salteadores da Estrada liderados por um desertor de infantaria',
        '1x Ogro Cinzento faminto carregando um porco assado no ombro',
        '2x Lobos Gigantes farejando trilha fresca de sangue',
        '1x Bardo Errante acompanhado por um cão pastor caolho',
        '4x Cultistas Encapuzados transportando um caixão de chumbo',
        '1x Patrulha de Guardas da Estrada montados em cavalos de guerra',
        '2x Goblins armando um fio de tropeço com sinos de latão',
      ];
      const atividades = [
        'Dividindo os despojos de uma carruagem que assaltaram há uma hora',
        'Enterrando apressadamente algo enrolado em lona grossa',
        'Cozinhando em volta de uma fogueira improvisada enquanto discutem aos berros',
        'Montando uma emboscada em curva cega com arco armado',
        'Perdidos e pedindo direções com modos rudes e nervosos',
      ];
      const reacoes = [
        'Hostilidade imediata (sacam armas ao primeiro ruído)',
        'Cautela tensa (exigem que os aventureiros se identifiquem a distância)',
        'Fingem desespero para atrair o grupo para mais perto',
        'Amigáveis e dispostos a negociar comida por informações valiosas',
      ];
      const c = rng.pick(criaturas);
      const a = rng.pick(atividades);
      const r = rng.pick(reacoes);

      return {
        id: `enc_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: `Encontro: ${c.split(' ')[1] || 'Criaturas'}`,
        conteudoPrincipal: `O grupo se depara com: ${c}. Eles estão ${a.toLowerCase()}.`,
        detalhes: {
          'Criatura / Grupo': c,
          'Atividade no Momento': a,
          'Disposição Inicial': r,
        },
        tags: ['encontro', 'combate', 'interação'],
      };
    }

    case 'npcs': {
      const nomes = ['Kaelen Barba-de-Ferro', 'Morgana das Brumas', 'Vesper Thorne', 'Bram Cobre-Velho', 'Elowen Vale-Azul', 'Drako Valas', 'Talia Passo-Leve'];
      const profissoes = ['Ferreiro aposentado', 'Boticária clandestina', 'Guia das terras altas', 'Ladrão de túmulos arrependido', 'Mercador de antiguidades suspeitas', 'Veterano de guerra mutilado'];
      const trejeitos = [
        'Limpa constantemente uma moeda de prata entre os nós dos dedos',
        'Olha por cima do ombro antes de falar qualquer frase com mais de três palavras',
        'Fala com a voz tão baixa que quase obriga o interlocutor a se inclinar',
        'Cuspe no chão toda vez que alguém menciona magia ou divindades',
        'Possui um tique nervoso de estalar o pescoço quando mente',
      ];
      const desejos = [
        'Comprar o perdão imperial para retornar à sua terra natal',
        'Descobrir quem assassinou seu irmão mais novo na mina velha',
        'Juntar 500 PO para pagar o dote da filha e tirá-la da servidão',
        'Construir um monumento de pedra em honra ao seu antigo regimento',
      ];
      const n = rng.pick(nomes);
      const pr = rng.pick(profissoes);
      const tr = rng.pick(trejeitos);
      const d = rng.pick(desejos);

      return {
        id: `npc_fast_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: `${n} (${pr})`,
        conteudoPrincipal: `${n} é ${pr.toLowerCase()}. ${tr}. Seu maior anseio: ${d.toLowerCase()}.`,
        detalhes: {
          'Nome': n,
          'Ocupação': pr,
          'Trejeito Marcante': tr,
          'Motivação / Desejo': d,
        },
        tags: ['npc', 'personagem', 'social'],
      };
    }

    case 'art_objects': {
      const objetos = [
        'Cálice cerimonial de prata martelada com incrustações de lápis-lazúli',
        'Estatueta de dragão esculpida em jade verde-escuro com dentes de marfim',
        'Tapeçaria antiga tecida em fios de ouro representando a Batalha dos Sete Vales',
        'Pente de osso de baleia gravado com runas marítimas e pérolas negras',
        'Espelho de mão de bronze polido com moldura em formato de serpentes entrelaçadas',
        'Caixa de rapé de mogno entalhada com relevos de caça élfica e fecho de platina',
        'Busto de mármore branco de um imperador esquecido com olhos de granada',
      ];
      const idades = ['Era dos Reis Antigos (cerca de 400 anos)', 'Primeira Dinastia Imperial', 'Feitura recente por mestre artífice anão', 'Origem pré-cataclismo'];
      const valores = [75, 120, 250, 400, 750, 1200, 2500];
      const obj = rng.pick(objetos);
      const val = rng.pick(valores);

      return {
        id: `art_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: obj.split(' ')[0] + ' ' + (obj.split(' ')[1] || ''),
        conteudoPrincipal: `${obj}. Proveniente de: ${rng.pick(idades)}.`,
        detalhes: {
          'Descrição': obj,
          'Origem / Idade': rng.pick(idades),
          'Valor Estimado': `${val} PO`,
          'Peso': `${rng.nextInt(1, 5)} kg`,
        },
        tags: ['arte', 'tesouro', 'item'],
      };
    }

    case 'legendary_weapons': {
      const nomesArmas = [
        'Rugido do Trovão Negro',
        'Lamento da Donzela Pálida',
        'Golpeador de Colossos',
        'Estrela do Ocaso',
        'Cinzas de Vanaheim',
        'Espinho da Serpente Mundial',
      ];
      const tipos = ['Espada Larga de Aço Estelar', 'Machado de Guerra Rúnico', 'Arco Longo de Teixo Ancestral', 'Lança de Ponta Solar', 'Martelo de Guerra Sagrado'];
      const poderes = [
        'Causa 2d6 de dano elétrico adicional e troveja com som ensurdecedor a cada golpe crítico',
        'Ignora resistências a corte e emite luz prateada na presença de mortos-vivos',
        'Permite ao portador saltar o triplo da distância habitual e aterrissar como uma onda de choque',
        'Cobre a lâmina em chamas negras que consomem a regeneração de trolls e abominações',
        'Retorna girando à mão do arremessador através de fendas dimensionais',
      ];
      const hist = [
        'Forjada nos fornos subterrâneos de Karak-Vrak antes do cerco orc.',
        'Pertenceu ao Primeiro Cavaleiro da Ordem da Alvorada e foi perdida em um túmulo lacrado.',
        'Cravada no crânio petrificado de um wyrm ancião durante três séculos.',
      ];
      const n = rng.pick(nomesArmas);
      const t = rng.pick(tipos);
      const p = rng.pick(poderes);

      return {
        id: `leg_weap_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: `${n} (${t})`,
        conteudoPrincipal: `${n} é uma lendária ${t.toLowerCase()}. ${p}.`,
        detalhes: {
          'Nome Mítico': n,
          'Tipo de Arma': t,
          'Histórico': rng.pick(hist),
          'Poder Único': p,
        },
        tags: ['arma', 'lendário', 'mágico'],
      };
    }

    case 'ancient_tomes': {
      const titulos = [
        'Tratado das Sete Chamas de Zalthor',
        'Compêndio das Sombras Insepultas',
        'Cartas do Navegador Celeste de Aethel',
        'O Evangelho dos Vermes de Ferro',
        'Chaves Herméticas dos Círculos Astrais',
        'Diário da Bruxa da Floresta dos Penedos',
      ];
      const capas = [
        'Encadernado em couro de basilisco escurecido com cantoneiras de latão corroído',
        'Páginas de pergaminho de vitela costuradas com tendões de wyvern',
        'Tábua de chumbo fina com caracteres cuneiformes gravados a ácido',
        'Couro negro desbotado com fechadura em formato de boca humana',
      ];
      const conteudos = [
        'Instruções detalhadas para fabricar óleo de resistência ao fogo e transmutar chumbo em bronze',
        'A fórmula do ritual proibido para erguer carniçais a partir de cadáveres frescos',
        'Rotas celestes para navegar o Mar Noturno sem bússola e evitar tempestades astrais',
        'Três magias de 2º e 3º círculos grafadas em dialeto rúnico que exige teste de Arcanismo CD 15',
      ];
      const tit = rng.pick(titulos);

      return {
        id: `tome_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: tit,
        conteudoPrincipal: `${tit}. ${rng.pick(capas)}.`,
        detalhes: {
          'Título': tit,
          'Encadernação': rng.pick(capas),
          'Idioma / Escrita': rng.pick(['Dracônico Antigo', 'Abissal Arcaico', 'Dialeto Imperial Primário', 'Élfico Primitivo']),
          'Conhecimento Contido': rng.pick(conteudos),
          'Valor para Colecionador': `${rng.nextInt(200, 900)} PO`,
        },
        tags: ['livro', 'tomo', 'arcano', 'lore'],
      };
    }

    case 'pickpocket': {
      const itensMiudos = [
        'Bolsa de couro rota com 4 PC, 7 PP e uma lasca de osso de galinha gravada com o número 13',
        'Chave de latão amassada presa a um pedaço de barbante ensebado',
        'Carta de amor amarrotada e manchada de vinho endereçada à esposa de um nobre',
        'Frasco minúsculo com pó aromático de canela e 3 dentes humanos perfurados',
        'Dado de seis faces viciado (cai em 6 em quase todos os arremessos)',
        'Anel de cobre barato com um camafeu de vidro rachado',
        'Nota de penhor vencida para resgatar uma adaga prateada na casa de penhores',
        'Bolsa gorda com 14 PO, 8 PP e o selo de cera de um cobrador de impostos',
      ];
      const vitimas = [
        'Mercador distraído olhando barracas de tecidos',
        'Guarda sonolento encostado no pilar de entrada',
        'Peregrino fervoroso entoando ladainhas',
        'Apostador suarento saindo da casa de jogos',
        'Jovem aprendiz de alquimista correndo apressado',
      ];
      const it = rng.pick(itensMiudos);

      return {
        id: `pick_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Espólio de Batedor de Carteiras',
        conteudoPrincipal: it,
        detalhes: {
          'Item / Conteúdo': it,
          'Vítima Típica': rng.pick(vitimas),
          'Dificuldade Furto (CD)': `Destreza (Prestidigitação) CD ${rng.nextInt(11, 16)}`,
        },
        tags: ['furto', 'loot', 'urbano'],
      };
    }

    case 'giants_bag': {
      const sacos = [
        'Três pedregulhos redondos do tamanho de barris prontos para arremesso',
        'Metade de uma vaca assada e defumada envolta em pele de urso cheia de moscas',
        'Um baú de carruagem arrebentado usado como porta-joias (contém 80 PO e 200 PP)',
        'Um sino de igreja de bronze de 300 kg usado como caneca gigante de cerveja',
        'Árvore arrancada pela raiz com a ponta apontada a machadadas (usada como palito de dente)',
        'Coleção de 12 elmos de ferro amassados amarrados por arame como troféus',
        'Um barril de 100 litros de hidromel azedo e rançoso',
      ];
      const gigante = rng.pick(['Gigante da Colina', 'Gigante de Pedra', 'Gigante do Gelo', 'Gigante do Fogo']);
      const it = rng.pick(sacos);

      return {
        id: `giant_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: `Conteúdo da Bolsa (${gigante})`,
        conteudoPrincipal: `Dentro da enorme bolsa de couro de mamute encontra-se: ${it}.`,
        detalhes: {
          'Pertence Principal': it,
          'Dono Original': gigante,
          'Peso Total': `${rng.nextInt(80, 250)} kg`,
        },
        tags: ['gigante', 'loot', 'combate'],
      };
    }

    case 'castles': {
      const castelos = [
        'Bastião da Garra de Falcão',
        'Cidadela dos Penhascos Negros',
        'Fortaleza de Pedra-Rubra',
        'Castelo da Vigília Noturna',
        'Baluarte das Sete Torres',
      ];
      const arquiteturas = [
        'Muralhas duplas de granito cinzento com fosso seco pontilhado de estacas afiadas',
        'Erguido no topo de um rochedo escarpado acessível apenas por uma ponte estreita de 60m',
        'Arquitetura gótica imponente com gárgulas de pedra calcária e janelas gradeadas',
        'Fortificação anã escavada no interior da montanha com seteiras ocultas nas encostas',
      ];
      const ocupantes = [
        'Um lorde idoso atormentado pela paranoia e cercado de mercenários estrangeiros',
        'Uma guarnição militar fiel ao trono sob comando de uma capitã implacável',
        'Bandos de orcs invasores que transformaram o salão nobre em um curral de javalis',
        'Um clã nobre empobrecido que tenta aparentar luxo enquanto as muralhas racham',
      ];
      const vulnerabilidades = [
        'Um aqueduto de esgoto abandonado deságua sob as cozinhas',
        'A torre oeste está com as fundações minadas por cupins subterrâneos',
        'O mestre dos suprimentos aceita suborno para deixar um dos portões destrancado',
      ];
      const nomeC = rng.pick(castelos);

      return {
        id: `castle_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: nomeC,
        conteudoPrincipal: `${nomeC}: ${rng.pick(arquiteturas)}. Ocupado por: ${rng.pick(ocupantes)}.`,
        detalhes: {
          'Nome': nomeC,
          'Arquitetura': rng.pick(arquiteturas),
          'Ocupante / Regente': rng.pick(ocupantes),
          'Fraqueza / Segredo': rng.pick(vulnerabilidades),
        },
        tags: ['cenário', 'castelo', 'fortaleza'],
      };
    }

    case 'towns_cities': {
      const nomes = ['Val-Falcão', 'Ponte-Branca', 'Oakhaven', 'Porto-Real', 'Cruzamento do Sol', 'Cidadela de Ferro'];
      const portes = ['Pequena Vila (~350 hab.)', 'Vila Murada (~1.200 hab.)', 'Cidade Comercial (~6.500 hab.)', 'Grande Metrópole (~22.000 hab.)'];
      const economias = ['Mineração de prata e ferro', 'Comércio fluvial de grãos e lã', 'Construção naval e salga de peixes', 'Vinho nobre e produção de azeite'];
      const crises = [
        'O dízimo municipal foi triplicado e os camponeses ameaçam queimar os celeiros',
        'Um culto apocalíptico está recrutando aprendizes nas forjas e tecelagens',
        'A água dos poços do setor leste começou a brotar com cheiro de carniça',
        'A peste das pulgas vermelhas está dizimando os servos nas docas',
      ];
      const nomeV = rng.pick(nomes);

      return {
        id: `town_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: nomeV,
        conteudoPrincipal: `${nomeV} — ${rng.pick(portes)}. Economia: ${rng.pick(economias)}. Crise atual: ${rng.pick(crises)}.`,
        detalhes: {
          'Nome': nomeV,
          'Porte / População': rng.pick(portes),
          'Economia Principal': rng.pick(economias),
          'Problema Corrente': rng.pick(crises),
        },
        tags: ['cidade', 'vila', 'cenário'],
      };
    }

    case 'traction_cities': {
      const cidades = [
        'Imperator Terrae',
        'Vanguard-Titan',
        'Vulcânia Móvel',
        'Fortaleza Rodante de Zhul',
        'Cidadela Mecânica de Karr',
      ];
      const locomocoes = [
        'Oito conjuntos de esteiras gigantescas de aço temperado com dentes de 5 metros',
        'Dezesseis rodas de ferro maciço movidas por caldeiras a vapor de alta pressão',
        'Seis pernas pneumáticas hidráulicas que dão passos lentos e estrondosos de 40 metros',
      ];
      const classes = [
        'Aristocracia dos Pilotos no convés superior e mineradores escravizados na barriga das forjas',
        'Conselho de Engenheiros-Magos que mantém o reator rúnico em funcionamento constante',
        'Milícia de corsários terrestres que caça povoações menores para canibalizar ferro',
      ];
      const ameacas = [
        'O combustível fóssil/mineral está a menos de 4 dias de se esgotar completamente',
        'Uma megacidade rival mais rápida foi detectada no horizonte em rota de interceptação',
        'A esteira esquerda trincou após passar sobre uma falha tectônica',
      ];
      const nomeT = rng.pick(cidades);

      return {
        id: `trac_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: `${nomeT} (Cidade Móvel)`,
        conteudoPrincipal: `${nomeT} avança pelas estepes devastadas. Tração: ${rng.pick(locomocoes)}. Sociedade: ${rng.pick(classes)}.`,
        detalhes: {
          'Nome': nomeT,
          'Método de Tração': rng.pick(locomocoes),
          'Estrutura Social': rng.pick(classes),
          'Perigo Iminente': rng.pick(ameacas),
          'População Embarcada': `${rng.nextInt(1500, 18000)} habitantes`,
        },
        tags: ['cidade-móvel', 'dieselpunk', 'fantasia', 'cenário'],
      };
    }

    case 'ships': {
      const nomesNavais = [
        'O Serpente Dourada',
        'Vingador das Ondas',
        'A Dama do Ocaso',
        'Estrela da Manhã',
        'Cão do Mar',
        'O Fantasma da Tempestade',
      ];
      const tiposNavios = ['Galeão de três mastros com 24 canhões', 'Caravela veloz com velas latinas', 'Drakkar viking reforçado com chifre de narval', 'Escuna mercante de calado fundo'];
      const capitaes = [
        'Capitão "Caolho" Vance, veterano que nunca perdeu uma presa em mar aberto',
        'Senhora Maeve, contrabandista com contratos arcanos com tritões',
        'Comandante Aldous, corsário imperial metódico e impiedoso',
      ];
      const cargas = [
        'Porão lotado de especiarias raras, pimenta-do-reino e seda do oriente',
        'Seis caixões de madeira de lei lacrados com prata e correntes pesadas',
        'Barris de pólvora negra e canhões novos contrabandeados para rebeldes',
      ];
      const nNavio = rng.pick(nomesNavais);

      return {
        id: `ship_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: nNavio,
        conteudoPrincipal: `${nNavio} (${rng.pick(tiposNavios)}). Capitaneado por ${rng.pick(capitaes)}.`,
        detalhes: {
          'Nome do Navio': nNavio,
          'Tipo de Embarcação': rng.pick(tiposNavios),
          'Capitão': rng.pick(capitaes),
          'Carga no Porão': rng.pick(cargas),
        },
        tags: ['navio', 'mar', 'embarcação'],
      };
    }

    case 'worlds_planes': {
      const planos = [
        'Plano das Cinzas Eternas',
        'Mar de Espelhos de Thalor',
        'Cume dos Ventos Uivantes',
        'O Vazio Prateado de Aethel',
        'Submundo de Ferro Frio',
      ];
      const leis = [
        'A gravidade se inverte a cada seis horas conforme a maré astral',
        'Nenhum fogo pode ser aceso por faísca; apenas chamas mágicas alimentam a luz',
        'Palavras ditas em voz alta se transformam em pequenas criaturas de cristal que caem no chão',
        'O tempo corre três vezes mais rápido: um dia no plano equivale a um mês no plano material',
      ];
      const habitantes = ['Espíritos elementais de fumaça', 'Autômatos de latão inteligentes', 'Sombras sencientes sem corpo físico', 'Gigantes astrais pacíficos'];
      const acessos = [
        'Um espelho de bronze no sótão de uma torre antiga que reflete uma paisagem diferente',
        'O olho de um furacão que não se move há cem anos no deserto',
        'Uma caverna submarina onde a água para de molhar e dá lugar ao ar seco',
      ];
      const nomeP = rng.pick(planos);

      return {
        id: `plane_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: nomeP,
        conteudoPrincipal: `${nomeP}. Lei Cósmica: ${rng.pick(leis)}. Habitado por ${rng.pick(habitantes)}.`,
        detalhes: {
          'Nome do Plano': nomeP,
          'Lei Física / Mágica Especial': rng.pick(leis),
          'Habitantes': rng.pick(habitantes),
          'Portal de Acesso': rng.pick(acessos),
        },
        tags: ['plano', 'multiverso', 'cosmologia'],
      };
    }

    case 'coats_of_arms': {
      const metais = ['Ouro (Or)', 'Prata (Argent)'];
      const cores = ['Goles (Vermelho)', 'Azur (Azul)', 'Sinople (Verde)', 'Sable (Preto)', 'Púrpura'];
      const figuras = [
        'Um leão rampante empunhando uma espada quebrada',
        'Uma cabeça de javali coroada por três espigas de trigo',
        'Uma torre de fortaleza sobre três montes rochosos',
        'Uma águia bicéfala com asas abertas sobre uma chave antiga',
        'Uma serpente engolindo a própria cauda em volta de uma rosa',
      ];
      const lemas = [
        '"Fortis et Fidelis" (Forte e Fiel)',
        '"Ferro et Igne" (Por Ferro e Fogo)',
        '"Vigilantia Aeterna" (Vigilância Eterna)',
        '"Soli Deo Gloria" (Glória Somente ao Criador)',
        '"Nec Aspera Terrent" (Nem as Dificuldades Amedrontam)',
      ];
      const m = rng.pick(metais);
      const c = rng.pick(cores);
      const f = rng.pick(figuras);
      const l = rng.pick(lemas);

      return {
        id: `coat_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Brasão de Armas Heráldico',
        conteudoPrincipal: `Escudo partido em ${m} e ${c}. Ao centro, ${f.toLowerCase()}. Lema familiar: ${l}.`,
        detalhes: {
          'Esmaltes Heráldicos': `${m} e ${c}`,
          'Figura Principal': f,
          'Lema da Casa': l,
          'Origem Típica': 'Nobreza Feudal / Cavalaria',
        },
        tags: ['heráldica', 'brasão', 'nobreza'],
      };
    }

    case 'dungeon_graffiti': {
      const graffitis = [
        '"NÃO ABRAM O SARCOFAGO VERMELHO. ELE NÃO ESTÁ MORTO." (gravado com punhal no calcário)',
        '"A água do terceiro nível cura feridas, mas cobra o preço nos dentes." (em carvão vegetal)',
        '"Três passos para a direita onde a tocha piscar ou o teto esmaga tudo." (em tinta azulada seca)',
        '"Eles enxergam apenas pelo calor do seu peito. Apague o fogo e congele." (escrito com sangue seco)',
        '"Aqui jaz a guilda dos Corvos de Ferro. Ninguém sobrou para enterrar."',
        'Um desenho tosco de um troll comendo um anão pela cabeça e a palavra "BOM" ao lado.',
      ];
      const g = rng.pick(graffitis);

      return {
        id: `graf_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Inscrição em Parede de Masmorra',
        conteudoPrincipal: g,
        detalhes: {
          'Inscrição Encontrada': g,
          'Material Usado': rng.pick(['Ponta de adaga enferrujada', 'Carvão de fogueira apagada', 'Sangue envelhecido e ressecado', 'Giz de batedor de masmorra']),
          'Utilidade para os Jogadores': 'Pode salvar vidas ou ser uma armadilha deixada por salteadores',
        },
        tags: ['masmorra', 'aviso', 'pista'],
      };
    }

    case 'omens_portents': {
      const pressagios = [
        'A lua cheia nasceu tingida de carmesim e todos os cães da cidade uivaram em uníssono por três horas.',
        'Ao degolar o boi no sacrifício, o sacerdote encontrou o coração do animal completamente petrificado em carvão.',
        'Uma chuva de pequenos pássaros mortos caiu sobre o pátio do castelo ao meio-dia sob céu sem nuvens.',
        'As chamas de todas as lareiras e tochas da aldeia arderam em tom esmeralda sem emitir calor durante a noite.',
        'Um cometa com cauda bifurcada cruzou o céu na direção das montanhas esquecidas ao norte.',
      ];
      const interpretacoes = [
        'Prenúncio de guerra civil e queda da linhagem reinante',
        'Despertar de uma criatura abissal selada nas profundezas',
        'Ano de fome extrema, secas e colheitas estragadas',
        'Retorno de um mago tirano que jurou vingança há cem anos',
      ];
      const p = rng.pick(pressagios);

      return {
        id: `omen_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Presságio / Augúrio Sobrenatural',
        conteudoPrincipal: p,
        detalhes: {
          'Sinal Ocorrido': p,
          'Interpretação dos Oráculos': rng.pick(interpretacoes),
          'Reação Popular': 'Pânico contido, orações nas esquinas e estocagem de suprimentos',
        },
        tags: ['presságio', 'sobrenatural', 'augúrio'],
      };
    }

    case 'prophecies': {
      const versos = [
        '"Quando o sétimo sino da torre partida soar sem corda,\nO herdeiro sem trono erguerá a lâmina sem lâmina,\nE o dragão de ferro beberá o rio das cinzas."',
        '"Do ventre da montanha de sal virá o sono sem sonhos,\nOs reis dobrarão os joelhos diante daquele que não respira,\nE as estrelas cairão como fagulhas de forja apagada."',
        '"Três luas sangrarão antes do solstício do inverno cinzento,\nUm irmão venderá o outro por uma taça de vinho azedo,\nE os mortos encontrarão as chaves dos portões da capital."',
      ];
      const prof = rng.pick(versos);

      return {
        id: `proph_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Profecia Antiga',
        conteudoPrincipal: prof,
        detalhes: {
          'Estrofe Profética': prof,
          'Fonte': rng.pick(['Livro das Sibilas das Cavernas de Granito', 'Fragmento de pergaminho encontrado no peito de uma múmia', 'Tabuleta de argila gravada por um vidente cego']),
          'Status Atual': 'Duas das três condições parecem já ter se cumprido recentemente',
        },
        tags: ['profecia', 'destino', 'lore'],
      };
    }

    case 'secret_doors': {
      const mecanismos = [
        'Uma pedra saliente que precisa ser empurrada para cima enquanto se puxa uma arandela de tocha',
        'Um livro específico na estante que, ao ser inclinado, aciona contrapesos de chumbo na parede',
        'Um tijolo oco que revela uma fechadura de quatro pinos oculta por gesso falso',
        'A língua de uma escultura de gárgula que precisa ser pressionada com a ponta de uma lâmina',
        'Uma laje no chão que só afunda sob peso superior a 70 kg, destravando a porta giratória',
      ];
      const pistas = [
        'Marcas semicirculares tênues de arranhão no piso de pedra calcária',
        'Uma leve corrente de ar frio com cheiro de terra molhada que sopra pela fresta',
        'A ausência total de teias de aranha naquele trecho específico da parede',
        'A poeira acumulada em todo o chão, exceto em um arco de 90 graus',
      ];
      const oQueOculta = [
        'Um pequeno cofre com 120 PO, um frasco de veneno de aranha e notas de chantagem',
        'Uma escada em espiral descendente que leva diretamente às catacumbas secretas',
        'Uma câmara de fuga com saída camuflada para os arbustos fora das muralhas',
        'O cubículo do espião com seteiras disfarçadas para ouvir a sala de audiências',
      ];
      const m = rng.pick(mecanismos);
      const pi = rng.pick(pistas);
      const o = rng.pick(oQueOculta);

      return {
        id: `sec_door_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Passagem / Porta Secreta',
        conteudoPrincipal: `Mecanismo de abertura: ${m}. Pista para percepção: ${pi}. Oculta: ${o}.`,
        detalhes: {
          'Mecanismo de Abertura': m,
          'Pista para Encontrar': pi,
          'Dificuldade (CD)': `Percepção Passiva ou Investigação CD ${rng.nextInt(13, 18)}`,
          'O Que Está Atrás': o,
        },
        tags: ['porta-secreta', 'masmorra', 'mecanismo'],
      };
    }

    default:
      return {
        id: `default_${rng.nextInt(1000, 9999)}`,
        subcategoria: sub,
        titulo: 'Elemento de Fantasia',
        conteudoPrincipal: 'Detalhe descritivo gerado por tabelas determinísticas.',
        detalhes: {},
        tags: ['fantasia'],
      };
  }
}

/**
 * Gera um lote de elementos para a subcategoria selecionada
 */
export function gerarLoteElementosFantasia(
  seed: number,
  subcategoria: SubcategoriaFantasia,
  quantidade = 4
): {
  itens: ItemGeradoFantasia[];
  subcategoria: SubcategoriaFantasia;
  seedUsada: number;
} {
  const rng = new DeterministicRNG(seed);
  const itens: ItemGeradoFantasia[] = [];

  for (let i = 0; i < quantidade; i++) {
    itens.push(gerarElementoFantasia(subcategoria, rng));
  }

  return {
    itens,
    subcategoria,
    seedUsada: seed,
  };
}
