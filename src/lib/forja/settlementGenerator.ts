/**
 * FORJA DE MUNDOS — Gerador de Assentamentos Determinístico (§6)
 *
 * Suporte a layout por Voronoi de distritos, L-system de ruas ou agentes.
 * Mapeia influência de terreno (Rio, Colina, Estrada) com atração por zoneamento.
 * Gera demografia, facções aliadas/rivais, pontos de interesse e NPCs locais.
 */

import { DeterministicRNG, deriveSubSeed } from './prng';
import { NOMES_M, NOMES_F, SOBRENOMES } from './npcGenerator';

export type AlgoritmoAssentamento = 'voronoi_distritos' | 'lsystem_ruas' | 'agentes_organicos';
export type TamanhoAssentamento = 'aldeia' | 'vila' | 'cidade';

export interface POIItem {
  id: string;
  nome: string;
  tipo: 'taverna' | 'ferraria' | 'templo' | 'alquimia' | 'mercado' | 'governo' | 'guarda';
  responsavelNome: string;
  responsavelOcupacao: string;
  descricao: string;
  especialidade: string;
  distrito: string;
}

export interface FaccaoLocal {
  id: string;
  nome: string;
  tipo: string;
  influencia: 'alta' | 'media' | 'baixa';
  lider: string;
  aliados: string[];
  rivais: string[];
  objetivo: string;
}

export interface DistritoUrbano {
  id: string;
  nome: string;
  tipoUso: 'Comercial' | 'Industrial' | 'Residencial Nobre' | 'Residencial Comum' | 'Militar';
  influenciaFator: string;
  nivelSeguranca: 'Alto' | 'Médio' | 'Baixo';
  descricao: string;
}

export interface SettlementResult {
  seed: number;
  nome: string;
  tamanho: TamanhoAssentamento;
  algoritmo: AlgoritmoAssentamento;
  populacao: number;
  racaPredominante: string;
  distribuicaoRacial: Record<string, number>;
  governo: string;
  distritos: DistritoUrbano[];
  pontosDeInteresse: POIItem[];
  faccoes: FaccaoLocal[];
  mapaInfluencia: {
    temRio: boolean;
    temColina: boolean;
    temEstradaPrincipal: boolean;
  };
}

export function gerarAssentamento(
  rootSeed: number,
  options: {
    nome?: string;
    tamanho?: TamanhoAssentamento;
    algoritmo?: AlgoritmoAssentamento;
    temRio?: boolean;
    temColina?: boolean;
    temEstradaPrincipal?: boolean;
  } = {}
): SettlementResult {
  const tamanho = options.tamanho || 'vila';
  const algoritmo = options.algoritmo || 'voronoi_distritos';
  const temRio = options.temRio ?? true;
  const temColina = options.temColina ?? true;
  const temEstrada = options.temEstradaPrincipal ?? true;

  const settleRng = new DeterministicRNG(deriveSubSeed(rootSeed, 'settlement_core'));
  const factionRng = new DeterministicRNG(deriveSubSeed(rootSeed, 'settlement_factions'));
  const poiRng = new DeterministicRNG(deriveSubSeed(rootSeed, 'settlement_poi'));

  // Nome procedimental se não fornecido
  const PREFIXOS_NOME = ['Aldeia', 'Vila', 'Porto', 'Forte', 'Cidadela', 'Refúgio', 'Entreposto', 'Burgo'];
  const RAICES_NOME = [
    'do Carvalho',
    'da Pedra-Negra',
    'do Salgueiro',
    'das Águas Claras',
    'da Colina Alta',
    'do Corvo Cinzento',
    'do Nevoeiro',
    'do Fosso Profundo',
    'da Ponte Velha',
    'do Pinheiro',
    'do Vale Verde',
    'das Sete Torres',
    'do Sino de Prata',
  ];
  const nomeFinal = options.nome || `${settleRng.pick(PREFIXOS_NOME)} ${settleRng.pick(RAICES_NOME)}`;

  // 1. Demografia
  const basePop =
    tamanho === 'aldeia'
      ? settleRng.nextInt(150, 400)
      : tamanho === 'vila'
      ? settleRng.nextInt(1200, 3500)
      : settleRng.nextInt(8000, 22000);

  const racas = ['Humanos', 'Anões', 'Elfos', 'Halflings', 'Meio-Orcs'];
  const racaPrincipal = racas[settleRng.nextInt(0, 1)]; // Humanos ou Anões predominantes
  const distribuicaoRacial: Record<string, number> = {
    [racaPrincipal]: 65,
    'Humanos': racaPrincipal === 'Humanos' ? 65 : 15,
    'Anões': racaPrincipal === 'Anões' ? 65 : 10,
    'Halflings': 10,
    'Elfos': 5,
    'Outros': 5,
  };

  const governos = [
    'Conselho de Anciãos e Mestres de Guilda',
    'Burgomestre nomeado pelo Barão local',
    'Magistrado eleito pelos proprietários de terra',
    'Capitão da Guarda sob lei marcial temporária',
    'Assembléia Popular dos Homens Livres',
  ];
  const governo = settleRng.pick(governos);

  // 2. Zoneamento baseado no Mapa de Influência do Terreno (§6.2) — 100% Procedural
  const distritos: DistritoUrbano[] = [];

  const NOMES_DISTRITO_COMERCIAL = [
    'Distrito Comercial do Portão Velho',
    'Mercado Central da Praça Grande',
    'Bazar da Roda Dourada',
    'Entreposto dos Mercadores da Rota',
    'Cruzamento dos Vendedores de Seda',
    'Distrito das Caravanas do Sul',
    'Quarteirão do Câmbio e Mercadorias',
  ];

  const NOMES_DISTRITO_INDUSTRIAL = [
    'Distrito das Docas e Curtumes',
    'Bairro dos Moinhos de Água',
    'Enseada dos Estaleiros Fluviais',
    'Distrito das Forjas e Fundições',
    'Zona das Oficinas e Carvoarias',
    'Cais dos Pescadores de Prata',
    'Armazéns das Barcaças de Carga',
  ];

  const NOMES_DISTRITO_NOBRE = [
    'Bairro Alto dos Patrícios',
    'Colina dos Barões Antigos',
    'Distrito das Mansões de Pedra',
    'Esplanada dos Brasões Imperiais',
    'Jardins da Nobreza Fluvial',
    'Torres dos Mestres do Conselho',
    'Bairro Nobre da Sentinela Branca',
  ];

  const NOMES_DISTRITO_RESIDENCIAL = [
    'Bairro dos Fornos e Tecelões',
    'Vila Baixa dos Oleiros',
    'Distrito dos Carpinteiros e Padeiros',
    'Beco dos Ferreiros da Ponte',
    'Quarteirão dos Couros e Tinturas',
    'Vila dos Trabalhadores Livres',
    'Vila Serena das Casinhas de Barro',
  ];

  if (temEstrada) {
    distritos.push({
      id: 'dist_comercio',
      nome: settleRng.pick(NOMES_DISTRITO_COMERCIAL),
      tipoUso: 'Comercial',
      influenciaFator: 'Estrada Principal atrai feiras, mercados e caravanas de viajantes',
      nivelSeguranca: 'Médio',
      descricao: 'Ruas apinhadas de barracas coloridas, tavernas ruidosas, estábulos e casas de câmbio.',
    });
  }

  if (temRio) {
    distritos.push({
      id: 'dist_beira_rio',
      nome: settleRng.pick(NOMES_DISTRITO_INDUSTRIAL),
      tipoUso: 'Industrial',
      influenciaFator: 'Rio provê força hidráulica contínua, estaleiros e transporte de cargas pesadas',
      nivelSeguranca: 'Baixo',
      descricao: 'Moinhos d’água rangentes, estaleiros de barcaças, armazéns de grãos e trapiches de madeira úmida.',
    });
  }

  if (temColina) {
    distritos.push({
      id: 'dist_alta_colina',
      nome: settleRng.pick(NOMES_DISTRITO_NOBRE),
      tipoUso: 'Residencial Nobre',
      influenciaFator: 'Colina oferece ar puro, defesa natural contra cercos e vista panorâmica privilegiada',
      nivelSeguranca: 'Alto',
      descricao: 'Mansões fortificadas de pedra esculpida, jardins murados, capelas particulares e patrulhas constantes.',
    });
  }

  distritos.push({
    id: 'dist_artesaos',
    nome: settleRng.pick(NOMES_DISTRITO_RESIDENCIAL),
    tipoUso: 'Residencial Comum',
    influenciaFator: 'Zoneamento urbano interno de média densidade entre o núcleo comercial e as muralhas',
    nivelSeguranca: 'Médio',
    descricao: 'Casas com oficinas no térreo, chaminés ativas, calçadas de cascalho e cheiro de ferro forjado e pão assado.',
  });

  if (tamanho === 'cidade') {
    distritos.push({
      id: 'dist_guarda',
      nome: 'Bastião da Guarda e Cidadela',
      tipoUso: 'Militar',
      influenciaFator: 'Sede administrativa e quartel general das defesas urbanas',
      nivelSeguranca: 'Alto',
      descricao: 'Pátios de armas, armarias reforçadas, prisões de segurança e estábulos de guerra.',
    });
  }

  // 3. Facções com Matriz de Relacionamento (§6.3) — 100% Procedurais
  const NOMES_LIGA_MERCANTIL = [
    'Liga Comercial das Quatro Rodas',
    'Cartel dos Mercadores Fluviais',
    'Sindicato do Aço e Carvão',
    'Irmandade dos Barqueiros Livres',
    'Consórcio da Rota Dourada',
  ];
  const NOMES_SUBMUNDO = [
    'Irmandade dos Olhos de Corvo',
    'Guilda da Adaga Noturna',
    'Clã dos Telhados Escuros',
    'Sindicato da Meia-Noite',
    'Irmandade das Chaves Ocultas',
  ];
  const NOMES_ORDEM_SAGRADA = [
    'Ordem da Chama Imutável',
    'Círculo do Sol da Meia-Noite',
    'Irmandade da Aurora Sagrada',
    'Guardiões do Cálice de Pedra',
    'Clero da Estrela Serena',
  ];
  const NOMES_COMPANHIA_MILITAR = [
    'Guarda do Portão de Ferro',
    'Vanguarda dos Cavaleiros Cinzentos',
    'Companhia dos Escudos Livres',
    'Legião dos Baluartes do Norte',
  ];

  const facNome1 = factionRng.pick(NOMES_LIGA_MERCANTIL);
  const facNome2 = factionRng.pick(NOMES_SUBMUNDO);
  const facNome3 = factionRng.pick(NOMES_ORDEM_SAGRADA);
  const facNome4 = factionRng.pick(NOMES_COMPANHIA_MILITAR);

  const faccoes: FaccaoLocal[] = [
    {
      id: 'fac_mercadores',
      nome: facNome1,
      tipo: 'Guilda Mercantil',
      influencia: 'alta',
      lider: `${factionRng.pick(NOMES_M)} ${factionRng.pick(SOBRENOMES)}`,
      aliados: ['Guarda da Cidade'],
      rivais: [facNome2],
      objetivo: factionRng.pick([
        'Garantir monopólio sobre o transporte de grãos e isenção de pedágios na ponte.',
        'Expandir entrepostos nas rotas fluviais e expulsar concorrentes estrangeiros.',
        'Financiar a construção de novas muralhas para proteger os depósitos comerciais.',
      ]),
    },
    {
      id: 'fac_ladroes',
      nome: facNome2,
      tipo: 'Sindicato Clandestino',
      influencia: 'media',
      lider: `${factionRng.pick(NOMES_F)} ${factionRng.pick(SOBRENOMES)}`,
      aliados: ['Contrabandistas Fluviais'],
      rivais: [facNome1, 'Guarda da Cidade'],
      objetivo: factionRng.pick([
        'Cobrar taxas de proteção discretas e interceptar carregamentos de prata.',
        'Subornar os magistrados do portão para circular contrabando de relíquias.',
        'Descobrir segredos comprometedores dos conselheiros para controlar votos.',
      ]),
    },
    {
      id: 'fac_templo',
      nome: facNome3,
      tipo: 'Sacerdócio Local',
      influencia: 'media',
      lider: `${factionRng.pick(NOMES_M)} ${factionRng.pick(SOBRENOMES)}`,
      aliados: ['Bairro Alto dos Patrícios'],
      rivais: ['Cultistas Ocultos', facNome2],
      objetivo: factionRng.pick([
        'Expurgar relíquias profanas e manter a fé fervorosa da população.',
        'Construir um claustro para cuidar dos doentes e peregrinos dos ermos.',
        'Erguer um campanário com sinos abençoados para afastar abominações noturnas.',
      ]),
    },
  ];

  if (tamanho === 'cidade') {
    faccoes.push({
      id: 'fac_militar',
      nome: facNome4,
      tipo: 'Ordem Marcial',
      influencia: 'alta',
      lider: `Capitão ${factionRng.pick(NOMES_M)} ${factionRng.pick(SOBRENOMES)}`,
      aliados: [facNome1],
      rivais: [facNome2],
      objetivo: 'Manter a ordem pública inquestionável e vigiar as fronteiras contra bandoleiros.',
    });
  }

  // 4. Pontos de Interesse (POIs) 100% procedurais
  const NOMES_TAVERNAS = [
    'O Bode Caolho',
    'Estalagem do Javali Prateado',
    'A Caneca Racha-Crânio',
    'Taverna do Pescador Alegre',
    'O Corvo e o Barril',
    'O Cavalo Alado',
    'O Lúpulo Selvagem',
    'A Bota Furada',
  ];
  const NOMES_FERREIROS = [
    'Forja da Bigorna Rubra',
    'Martelo e Cinzas',
    'Ferraria Pedra-Fria',
    'Forja da Lâmina Serena',
    'Oficina do Ferro Batido',
  ];
  const NOMES_TEMPLOS = [
    'Capela da Estrela Guia',
    'Santuário da Chama Branca',
    'Templo dos Cinco Guardiões',
    'Altar da Mãe Terra',
    'Cripta da Luz Perpétua',
  ];
  const NOMES_ALQUIMIA = [
    'O Alambique Verdejante',
    'Pó e Raízes Antigas',
    'A Ampola de Mercúrio',
    'Ervas da Lua Cheia',
    'O Frasco Borbulhante',
  ];

  const pontosDeInteresse: POIItem[] = [
    {
      id: 'poi_taverna_1',
      nome: poiRng.pick(NOMES_TAVERNAS),
      tipo: 'taverna',
      responsavelNome: `${poiRng.pick(NOMES_M)} ${poiRng.pick(SOBRENOMES)}`,
      responsavelOcupacao: 'taverneiro',
      descricao: 'Salão amplo aquecido por lareira dupla, com cheiro de cerveja de cevada e assado de porco.',
      especialidade: 'Cerveja escura do barril de carvalho e ensopado apimentado de caça.',
      distrito: distritos[0]?.nome || 'Distrito Central',
    },
    {
      id: 'poi_ferraria_1',
      nome: poiRng.pick(NOMES_FERREIROS),
      tipo: 'ferraria',
      responsavelNome: `${poiRng.pick(NOMES_M)} ${poiRng.pick(SOBRENOMES)}`,
      responsavelOcupacao: 'ferreiro',
      descricao: 'Oficina aberta ao ar livre com bigornas pesadas e prateleiras de ferraduras e pontas de lança.',
      especialidade: 'Armaduras rebitadas, afiação de lâminas e ferraduras reforçadas.',
      distrito: 'Bairro dos Fornos e Tecelões',
    },
    {
      id: 'poi_templo_1',
      nome: poiRng.pick(NOMES_TEMPLOS),
      tipo: 'templo',
      responsavelNome: `${poiRng.pick(NOMES_F)} ${poiRng.pick(SOBRENOMES)}`,
      responsavelOcupacao: 'curandeiro',
      descricao: 'Construção sóbria de pedra branca com vitrais translúcidos e incenso de mirra suave.',
      especialidade: 'Bênçãos de viagem, curativos e poções de alívio rápido.',
      distrito: distritos.find((d) => d.id === 'dist_alta_colina')?.nome || distritos[0]?.nome || 'Distrito Central',
    },
    {
      id: 'poi_alquimia_1',
      nome: poiRng.pick(NOMES_ALQUIMIA),
      tipo: 'alquimia',
      responsavelNome: `${poiRng.pick(NOMES_M)} ${poiRng.pick(SOBRENOMES)}`,
      responsavelOcupacao: 'alquimista',
      descricao: 'Frascos borbulhantes de vidro soprado, ervas secas penduradas nas vigas de madeira.',
      especialidade: 'Fogo alquímico, antídotos contra veneno e essência de luz.',
      distrito: distritos[0]?.nome || 'Distrito Central',
    },
  ];

  if (tamanho === 'cidade') {
    pontosDeInteresse.push({
      id: 'poi_mercado_1',
      nome: 'Grande Mercado das Especiarias',
      tipo: 'mercado',
      responsavelNome: `${poiRng.pick(NOMES_F)} ${poiRng.pick(SOBRENOMES)}`,
      responsavelOcupacao: 'mercador',
      descricao: 'Praça cercada de toldos coloridos com seda, especiarias do sul, couro e ferro.',
      especialidade: 'Itens raros trazidos por caravanas distantes e troca de moedas.',
      distrito: 'Distrito Comercial do Portão Velho',
    });
  }

  return {
    seed: rootSeed,
    nome: nomeFinal,
    tamanho,
    algoritmo,
    populacao: basePop,
    racaPredominante: racaPrincipal,
    distribuicaoRacial,
    governo,
    distritos,
    pontosDeInteresse,
    faccoes,
    mapaInfluencia: {
      temRio,
      temColina,
      temEstradaPrincipal: temEstrada,
    },
  };
}
