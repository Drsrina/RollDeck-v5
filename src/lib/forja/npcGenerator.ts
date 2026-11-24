/**
 * FORJA DE MUNDOS — Gerador de NPCs (§7)
 *
 * Filosofia: Ficha mínima de 1 linha por padrão (estilo Donjon).
 * Ficha detalhada completa com atributos, encadeamento psicológico e estatísticas sob demanda.
 */

import { DeterministicRNG, deriveSubSeed } from './prng';

export interface NPCStats {
  for: number;
  des: number;
  con: number;
  int: number;
  sab: number;
  car: number;
  pv: number;
  ca: number;
  ataque: string;
}

export interface NPCEntry {
  id: string;
  nome: string;
  raca: string;
  genero: 'm' | 'f';
  ocupacao: string;
  resumoLinhaUnica: string;

  // Campos detalhados (opcionais / expansíveis)
  aparencia: string;
  personalidade: {
    arquetipo: string;
    traco: string;
    motivacao: string;
  };
  segredo: string;
  faccaoId?: string;
  faccaoNome?: string;
  equipamento: string[];
  stats: NPCStats;
}

export const NOMES_M = ['Torben', 'Baldur', 'Gareth', 'Eldon', 'Kael', 'Rodrik', 'Durnan', 'Jarek', 'Alden', 'Caelum', 'Theron', 'Varek', 'Darian', 'Boran', 'Gisli'];
export const NOMES_F = ['Lyra', 'Mara', 'Elysia', 'Selene', 'Kaelen', 'Branwen', 'Yvaine', 'Mira', 'Vespera', 'Thalia', 'Astrid', 'Morwen', 'Freya', 'Isolde', 'Bryn'];
export const SOBRENOMES = ['Machado-de-Ferro', 'Andarilho', 'Corvo-Negro', 'da Ponte', 'dos Campos', 'Cinza-Prata', 'Falcão', 'Brasa', 'Pedra-Fria', 'Lâmina-Veloz', 'do Moinho', 'Tronco-Firme'];

export const RACAS_NPC = ['Humano', 'Anão', 'Elfo', 'Meio-Elfo', 'Halfling', 'Meio-Orc', 'Gnomo', 'Draconato', 'Tiefling'];

export const OCUPACOES = [
  'ferreiro',
  'taverneiro',
  'mercador',
  'alquimista',
  'guarda da milícia',
  'curandeiro',
  'pescador',
  'escriba',
  'caçador de recompensas',
  'erudito arcano',
  'estaleiro',
  'mineiro',
  'mago',
  'ladrão',
  'bardo',
  'padre',
  'nobre',
];

const ARQUETIPOS = [
  'O Veterano Desiludido',
  'O Ambicioso Astuto',
  'O Guardião Protetor',
  'O Erudito Curioso',
  'O Negociador Pragmático',
  'O Idealista Fervoroso',
  'O Errante Desconfiado',
];

const TRACOS = [
  'voz serena e gestos medidos',
  'olhar inquisitivo que desconfia de promessas fáceis',
  'hábito de batucar os nós dos dedos na mesa quando nervoso',
  'sorriso afável que raramente atinge os olhos frios',
  'postura altiva de quem já serviu a nobres importantes',
  'fala pausada escolhendo cada palavra com extrema cautela',
];

const MOTIVACOES = [
  'Juntar ouro suficiente para comprar a liberdade de um irmão cativo',
  'Proteger a vila contra uma ameaça que os guardas se recusam a admitir',
  'Recuperar um anel de família penhorado com agiotas do cais',
  'Descobrir a verdade sobre o desaparecimento da caravana da guilda',
  'Manter seu passado de mercenário enterrado longe dos olhos da lei',
];

const APARENCIAS = [
  'homem de meia-idade com mãos calejadas, avental de couro e cicatriz na têmpora',
  'mulher esguia de cabelos trançados, olhos atentos e manto de lã verde-musgo',
  'figura robusta com barba espessa salpicada de cinzas e botas reforçadas com ferro',
  'rosto jovem com olhar cansado, dedos manchados de tinta azulada e anel de latão',
  'senhor idoso com bengala de freixo talhada, capa debruada de pele e voz rouca',
];

const SEGREDO_TEMPLATES = [
  'deve uma dívida de sangue para a guilda dos ladrões locais',
  'esconde um mapa com a entrada secreta das catacumbas sob sua forja',
  'presenciou o assassinato do antigo burgomestre e foi subornado para calar-se',
  'fornece suprimentos furtivamente para um renegado escondido nas colinas',
  'possui uma adaga cerimonial com lâmina envenenada guardada em fundo falso',
];

export function gerarNPC(
  rootSeed: number,
  options: {
    id?: string;
    genero?: 'm' | 'f';
    ocupacao?: string;
    raca?: string;
  } = {}
): NPCEntry {
  const rng = new DeterministicRNG(deriveSubSeed(rootSeed, 'npc_seed'));

  const id = options.id || `npc_${rng.nextInt(100, 999)}`;
  const genero = options.genero || (rng.nextBool() ? 'm' : 'f');
  const nomeBase = genero === 'm' ? rng.pick(NOMES_M) : rng.pick(NOMES_F);
  const sobrenome = rng.pick(SOBRENOMES);
  const nome = `${nomeBase} ${sobrenome}`;
  const raca = options.raca || (rng.next() < 0.7 ? 'Humano' : rng.next() < 0.5 ? 'Anão' : 'Meio-Elfo');
  const ocupacao = options.ocupacao || rng.pick(OCUPACOES);

  const aparencia = rng.pick(APARENCIAS);
  const arquetipo = rng.pick(ARQUETIPOS);
  const traco = rng.pick(TRACOS);
  const motivacao = rng.pick(MOTIVACOES);
  const segredo = rng.pick(SEGREDO_TEMPLATES);

  // Ficha mínima de 1 linha (§7)
  const resumoLinhaUnica = `${id} — Ocupação: ${ocupacao}. Aparência: ${aparencia}. Segredo: ${segredo}.`;

  // Atributos D&D padrão calculados deterministicamente (3d6)
  function rolar3d6(): number {
    return rng.nextInt(1, 6) + rng.nextInt(1, 6) + rng.nextInt(1, 6);
  }

  const forca = rolar3d6();
  const destreza = rolar3d6();
  const constituicao = rolar3d6();
  const inteligencia = rolar3d6();
  const sabedoria = rolar3d6();
  const carisma = rolar3d6();

  const modCon = Math.floor((constituicao - 10) / 2);
  const modDes = Math.floor((destreza - 10) / 2);
  const pv = Math.max(6, 10 + modCon * 2);
  const ca = 10 + modDes;

  return {
    id,
    nome,
    raca,
    genero,
    ocupacao,
    resumoLinhaUnica,
    aparencia,
    personalidade: {
      arquetipo,
      traco,
      motivacao,
    },
    segredo,
    equipamento: (() => {
      const prata = rng.nextInt(5, 30);
      const cobre = rng.nextInt(4, 20);
      const bolsaMoedas = `Bolsa com ${prata} moedas de prata e ${cobre} de cobre`;

      if (ocupacao === 'ferreiro') {
        return [
          'Martelo pesado de forja (1d8 concussão)',
          'Avental de couro reforçado com rebites (+1 CA)',
          'Pinças de ferro e pederneira',
          bolsaMoedas,
        ];
      }
      if (ocupacao === 'taverneiro') {
        return [
          'Porrete de carvalho maciço (1d6 concussão)',
          'Caneca de estanho e avental de linho grosso',
          'Molho com as chaves mestras da adega e despensa',
          bolsaMoedas,
        ];
      }
      if (ocupacao === 'alquimista') {
        return [
          'Adaga fina de prata (1d4 perfurante)',
          '1x Frasco de fogo alquímico instável',
          'Almofariz e pilão de ágata com ervas desidratadas',
          bolsaMoedas,
        ];
      }
      if (ocupacao === 'guarda da milícia' || ocupacao === 'caçador de recompensas') {
        return [
          'Lança de infantaria (1d6/1d8 versátil) ou Espada Curta (1d6)',
          'Escudo de carvalho reforçado com ferro (+2 CA)',
          'Apito de alerta de latão e algemas de ferro',
          bolsaMoedas,
        ];
      }
      if (ocupacao === 'mago' || ocupacao === 'erudito arcano') {
        return [
          'Adaga de osso gravada com runas arcanas (1d4)',
          'Diário encapado em couro com anotações de magias',
          'Foco arcano de cristal translúcido',
          bolsaMoedas,
        ];
      }
      if (ocupacao === 'ladrão') {
        return [
          'Duas adagas equilibradas para arremesso (1d4 cada)',
          'Kit de ferramentas de ladrão (gazuas finas de aço)',
          'Corda de seda preta de 10 metros com gancho de ferro',
          bolsaMoedas,
        ];
      }
      return [
        'Adaga simples de aço (1d4 perfurante)',
        'Manto de lã rústica com broche de latão',
        'Pederneira, tocha e cantil com água fresca',
        bolsaMoedas,
      ];
    })(),
    stats: {
      for: forca,
      des: destreza,
      con: constituicao,
      int: inteligencia,
      sab: sabedoria,
      car: carisma,
      pv,
      ca,
      ataque: `Ataque corpo-a-corpo +${Math.max(1, Math.floor((forca - 10) / 2))} (1d4+${Math.max(0, Math.floor((forca - 10) / 2))})`,
    },
  };
}

/**
 * Gera um lote de N NPCs determinísticos
 */
export function gerarLoteNPCs(
  rootSeed: number,
  quantidade = 6,
  options?: { raca?: string; ocupacao?: string; genero?: 'm' | 'f' }
): NPCEntry[] {
  const npcs: NPCEntry[] = [];
  for (let i = 0; i < quantidade; i++) {
    const subSeed = deriveSubSeed(rootSeed, `npc_batch_${i}`);
    npcs.push(gerarNPC(subSeed, { ...options, id: `npc_${(i + 1).toString().padStart(3, '0')}` }));
  }
  return npcs;
}
