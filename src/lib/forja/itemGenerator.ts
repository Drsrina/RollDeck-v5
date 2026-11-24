/**
 * FORJA DE MUNDOS — Gerador de Itens e Tesouros (§8)
 *
 * Tabelas hierárquicas aninhadas:
 * Categoria -> Item Base -> Propriedades Combinatórias (Encantamentos, Peculiaridades e Maldições).
 */

import { DeterministicRNG, deriveSubSeed } from './prng';

export type RaridadeItem = 'Comum' | 'Incomum' | 'Raro' | 'Muito Raro' | 'Lendário';
export type CategoriaItem =
  | 'Arma'
  | 'Armadura e Escudo'
  | 'Poção ou Elixir'
  | 'Pergaminho Arcano'
  | 'Item Maravilhoso'
  | 'Gema e Joia'
  | 'Tesouro de Moedas';

export interface ItemGerado {
  id: string;
  nome: string;
  categoria: CategoriaItem;
  raridade: RaridadeItem;
  valorPO: number;
  descricaoMecanica: string;
  propriedadeMagica?: string;
  peculiaridade?: string;
  isAmaldicoado: boolean;
  maldicaoTexto?: string;
}

const ARMAS_BASE = [
  { nome: 'Espada Longa', dano: '1d8 cortante (versátil 1d10)', valor: 15 },
  { nome: 'Adaga de Aço Nobre', dano: '1d4 perfurante (acuidade, arremesso)', valor: 2 },
  { nome: 'Machado de Batalha', dano: '1d8 cortante (versátil 1d10)', valor: 10 },
  { nome: 'Arco Longo de Teixo', dano: '1d8 perfurante (distância 45/180m)', valor: 50 },
  { nome: 'Martelo de Guerra', dano: '1d8 concussão (versátil 1d10)', valor: 15 },
  { nome: 'Rapieira Élfica', dano: '1d8 perfurante (acuidade)', valor: 25 },
  { nome: 'Lança de Infantaria', dano: '1d6 perfurante (alcance, versátil 1d8)', valor: 5 },
  { nome: 'Montante de Duas Mãos', dano: '2d6 cortante (duas mãos, pesado)', valor: 50 },
];

const ARMADURAS_BASE = [
  { nome: 'Cota de Malha Rebitada', ca: '16 (desvantagem em Furtividade)', valor: 75 },
  { nome: 'Gibão de Couro Batido', ca: '12 + mod Des', valor: 45 },
  { nome: 'Couraça de Bronze Polido', ca: '14 + mod Des (máx 2)', valor: 400 },
  { nome: 'Armadura de Placas Completa', ca: '18 (For 15 requerida)', valor: 1500 },
  { nome: 'Escudo de Freixo e Aço', ca: '+2 CA', valor: 10 },
];

const POCOES_BASE = [
  { nome: 'Poção de Cura', efeito: 'Recupera 2d4+2 pontos de vida instantaneamente', valor: 50, raridade: 'Comum' as const },
  { nome: 'Poção de Cura Maior', efeito: 'Recupera 4d4+4 pontos de vida instantaneamente', valor: 150, raridade: 'Incomum' as const },
  { nome: 'Elixir de Força do Gigante da Colina', efeito: 'Define sua Força em 21 por 1 hora', valor: 250, raridade: 'Incomum' as const },
  { nome: 'Poção de Invisibilidade', efeito: 'Concede invisibilidade por até 1 hora ou até atacar', valor: 400, raridade: 'Raro' as const },
  { nome: 'Óleo de Afiação Veloz', efeito: 'Reveste uma arma garantindo +1 no ataque e dano por 1 hora', valor: 100, raridade: 'Incomum' as const },
  { nome: 'Antídoto Universal Concentrado', efeito: 'Neutraliza venenos e concede vantagem em salvaguardas por 1 hora', valor: 75, raridade: 'Comum' as const },
];

const ITENS_MARAVILHOSOS_BASE = [
  { nome: 'Anel de Proteção', efeito: '+1 na Classe de Armadura e em todas as salvaguardas', valor: 3500, raridade: 'Raro' as const },
  { nome: 'Manto Élfico', efeito: 'Vantagem em testes de Furtividade para se esconder nas sombras', valor: 500, raridade: 'Incomum' as const },
  { nome: 'Botas Aladas', efeito: 'Concede deslocamento de voo de 9m por até 4 horas diárias', valor: 4000, raridade: 'Raro' as const },
  { nome: 'Bolsa Sem Fundo', efeito: 'Comporta até 250 kg de peso sem alterar seu peso externo de 7 kg', valor: 400, raridade: 'Incomum' as const },
  { nome: 'Varinha de Mísseis Mágicos', efeito: 'Possui 7 cargas para conjurar Mísseis Mágicos sem gastar espaço de magia', valor: 1500, raridade: 'Incomum' as const },
  { nome: 'Amuleto da Saúde', efeito: 'Define sua Constituição em 19 enquanto sintonizado', valor: 8000, raridade: 'Raro' as const },
  { nome: 'Capa da Aranha', efeito: 'Permite andar por paredes e tetos e concede imunidade a teias de aranha', valor: 2500, raridade: 'Incomum' as const },
  { nome: 'Manoplas da Força do Ogro', efeito: 'Define sua Força em 19 enquanto usadas', valor: 4000, raridade: 'Incomum' as const },
  { nome: 'Anel de Queda Suave', efeito: 'Concede efeito permanente da magia Queda Suave ao cair de qualquer altura', valor: 1200, raridade: 'Incomum' as const },
  { nome: 'Braceletes de Defesa', efeito: '+2 na CA enquanto não estiver vestindo armadura nem empunhando escudo', valor: 6000, raridade: 'Raro' as const },
  { nome: 'Corda de Escalada Encantada', efeito: 'Corda de seda de 18m que se move, ancora e amarra sob comando vocal', valor: 300, raridade: 'Comum' as const },
  { nome: 'Manto da Invisibilidade', efeito: 'Concede invisibilidade total ao puxar o capuz por até 2 horas diárias', valor: 50000, raridade: 'Lendário' as const },
];

const PERGAMINHOS_BASE = [
  { nome: 'Pergaminho de Escudo Arcano', nivel: '1º Círculo', escola: 'Abjuração', efeito: '+5 na CA como reação contra um ataque iminente até o início do seu próximo turno', valor: 50, raridade: 'Comum' as const },
  { nome: 'Pergaminho de Mísseis Mágicos', nivel: '1º Círculo', escola: 'Evocação', efeito: '3 dardos arcanos que causam 1d4+1 de dano de força cada sem chance de erro', valor: 50, raridade: 'Comum' as const },
  { nome: 'Pergaminho de Invisibilidade', nivel: '2º Círculo', escola: 'Ilusão', efeito: 'Torna uma criatura tocada invisível por até 1 hora ou até atacar', valor: 150, raridade: 'Incomum' as const },
  { nome: 'Pergaminho de Raio Ardente', nivel: '2º Círculo', escola: 'Evocação', efeito: 'Dispara 3 raios de fogo que causam 2d6 de dano de fogo cada um ao acertar', valor: 150, raridade: 'Incomum' as const },
  { nome: 'Pergaminho de Bola de Fogo', nivel: '3º Círculo', escola: 'Evocação', efeito: 'Explosão de 6m de raio que inflige 8d6 de dano de fogo (salvaguarda de Destreza)', valor: 300, raridade: 'Incomum' as const },
  { nome: 'Pergaminho de Dissipar Magia', nivel: '3º Círculo', escola: 'Abjuração', efeito: 'Cancela magias de 3º círculo ou inferiores ativas em uma criatura ou objeto', valor: 300, raridade: 'Incomum' as const },
  { nome: 'Pergaminho de Porta Dimensional', nivel: '4º Círculo', escola: 'Conjuração', efeito: 'Teletransporta você e 1 aliado voluntário a até 150 metros em qualquer direção', valor: 1000, raridade: 'Raro' as const },
  { nome: 'Pergaminho de Teletransporte', nivel: '7º Círculo', escola: 'Conjuração', efeito: 'Teletransporta o grupo inteiro instantaneamente para qualquer local conhecido no plano', valor: 8000, raridade: 'Muito Raro' as const },
];

const ENCANTAMENTOS = [
  { prefixo: '+1', bonus: 1, danoExtra: '', raridade: 'Incomum' as const, multValor: 5 },
  { prefixo: 'Flamejante', bonus: 1, danoExtra: '+1d6 de dano de fogo adicional ao atingir', raridade: 'Raro' as const, multValor: 12 },
  { prefixo: 'Gélido da Geada', bonus: 1, danoExtra: '+1d6 de dano de frio e reduz deslocamento em 3m', raridade: 'Raro' as const, multValor: 12 },
  { prefixo: 'do Trovão Trovejante', bonus: 1, danoExtra: '+1d6 de dano trovejante com estalo audível a 90m', raridade: 'Raro' as const, multValor: 14 },
  { prefixo: 'Rúnico das Profundezas (+2)', bonus: 2, danoExtra: '+2 nas jogadas de ataque e dano', raridade: 'Raro' as const, multValor: 20 },
  { prefixo: 'Sagrado da Aurora', bonus: 2, danoExtra: '+2d6 de dano radiante contra mortos-vivos e ínferos', raridade: 'Muito Raro' as const, multValor: 35 },
  { prefixo: 'Vorpal Ancestral', bonus: 3, danoExtra: 'Em um 20 natural no d20 decapita criaturas humanoides', raridade: 'Lendário' as const, multValor: 80 },
];

const PECULIARIDADES = [
  'Emite uma aura azulada tênue na presença de orcs ou goblins a até 30 metros.',
  'Nunca acumula ferrugem, manchas de sangue ou pó, permanecendo impecavelmente reluzente.',
  'Pesa metade do peso normal devido a forja em metal estelar.',
  'Sussurra murmúrios inaudíveis em idioma antigo quando seu portador está em perigo.',
  'Aquece suavemente a mão do usuário em temperaturas abaixo de zero.',
  'Ostenta um símbolo heráldico gravado no pomo pertencente a um herói lendário esquecido.',
];

const MALDICOES = [
  'Amaldiçoado: O portador se recusa a se desfazer deste item e tem desvantagem ao atacar com qualquer outra arma.',
  'Sede de Sangue: Cada vez que o portador desembainha o item, deve infligir dano ou sofre 1d6 de dano psíquico.',
  'Vulnerabilidade: O portador recebe 3 pontos de dano adicionais sempre que sofrer dano por fogo.',
];

export function gerarItem(
  rootSeed: number,
  options: {
    categoria?: CategoriaItem;
    raridadeDesejada?: RaridadeItem;
    permitirMaldicao?: boolean;
  } = {}
): ItemGerado {
  const rng = new DeterministicRNG(deriveSubSeed(rootSeed, 'item_seed'));

  const categorias: CategoriaItem[] = [
    'Arma',
    'Armadura e Escudo',
    'Poção ou Elixir',
    'Item Maravilhoso',
    'Pergaminho Arcano',
    'Gema e Joia',
    'Tesouro de Moedas',
  ];
  const categoria = options.categoria || rng.pick(categorias);

  const id = `item_${rng.nextInt(100, 999)}`;

  if (categoria === 'Poção ou Elixir') {
    let pool = POCOES_BASE;
    if (options.raridadeDesejada) {
      const filtradas = POCOES_BASE.filter((p) => p.raridade === options.raridadeDesejada);
      if (filtradas.length > 0) pool = filtradas;
    }
    const pocao = rng.pick(pool);
    return {
      id,
      nome: pocao.nome,
      categoria,
      raridade: pocao.raridade,
      valorPO: pocao.valor,
      descricaoMecanica: pocao.efeito,
      peculiaridade: 'Líquido iridescente com pequenas partículas brilhantes suspensas.',
      isAmaldicoado: false,
    };
  }

  if (categoria === 'Item Maravilhoso') {
    let pool = ITENS_MARAVILHOSOS_BASE;
    if (options.raridadeDesejada) {
      const filtradas = ITENS_MARAVILHOSOS_BASE.filter((im) => im.raridade === options.raridadeDesejada);
      if (filtradas.length > 0) pool = filtradas;
    }
    const im = rng.pick(pool);
    const isAmaldicoado = options.permitirMaldicao && rng.nextBool(0.12);

    return {
      id,
      nome: im.nome,
      categoria,
      raridade: im.raridade,
      valorPO: im.valor,
      descricaoMecanica: im.efeito,
      propriedadeMagica: `Sintonia requerida. ${im.efeito}.`,
      peculiaridade: rng.pick(PECULIARIDADES),
      isAmaldicoado: Boolean(isAmaldicoado),
      maldicaoTexto: isAmaldicoado ? rng.pick(MALDICOES) : undefined,
    };
  }

  if (categoria === 'Pergaminho Arcano') {
    let pool = PERGAMINHOS_BASE;
    if (options.raridadeDesejada) {
      const filtradas = PERGAMINHOS_BASE.filter((sc) => sc.raridade === options.raridadeDesejada);
      if (filtradas.length > 0) pool = filtradas;
    }
    const perg = rng.pick(pool);

    return {
      id,
      nome: perg.nome,
      categoria,
      raridade: perg.raridade,
      valorPO: perg.valor,
      descricaoMecanica: `Magia de ${perg.nivel} (${perg.escola}). Uso único. ${perg.efeito}.`,
      peculiaridade: 'Pergaminho de velino selado com cera roxa carimbada por glifo arcano.',
      isAmaldicoado: false,
    };
  }

  if (categoria === 'Gema e Joia') {
    const gemas = [
      { nome: 'Ametista Lapidada em Gota', valor: 100 },
      { nome: 'Rubi Estrela Coração-de-Fogo', valor: 500 },
      { nome: 'Diamante Bruto do Pico Prateado', valor: 1000 },
      { nome: 'Safira Azul dos Mares Profundos', valor: 750 },
      { nome: 'Esmeralda Perfeita da Floresta Velha', valor: 850 },
    ];
    const gema = rng.pick(gemas);
    return {
      id,
      nome: gema.nome,
      categoria,
      raridade: gema.valor > 600 ? 'Raro' : 'Incomum',
      valorPO: gema.valor,
      descricaoMecanica: `Joia preciosa para comércio de alto valor ou componente material de conjuração.`,
      peculiaridade: 'Reflete a luz em múltiplos feixes prismáticos límpidos.',
      isAmaldicoado: false,
    };
  }

  if (categoria === 'Tesouro de Moedas') {
    const po = rng.nextInt(50, 400);
    const pp = rng.nextInt(100, 800);
    const pc = rng.nextInt(200, 1500);
    return {
      id,
      nome: 'Bolsa de Moedas Antigas',
      categoria,
      raridade: 'Comum',
      valorPO: Math.round(po + pp / 10 + pc / 100),
      descricaoMecanica: `${po} Peças de Ouro (PO), ${pp} Peças de Prata (PP) e ${pc} Peças de Cobre (PC) com cunhagem antiga.`,
      isAmaldicoado: false,
    };
  }

  if (categoria === 'Armadura e Escudo') {
    const armadura = rng.pick(ARMADURAS_BASE);
    const ehMagica = options.raridadeDesejada && options.raridadeDesejada !== 'Comum' ? true : rng.nextBool(0.6);
    let encPool = ENCANTAMENTOS.slice(0, 3);
    if (options.raridadeDesejada) {
      const match = ENCANTAMENTOS.filter((e) => e.raridade === options.raridadeDesejada);
      if (match.length > 0) encPool = match;
    }
    const enc = rng.pick(encPool);
    const nomeFinal = ehMagica ? `${armadura.nome} ${enc.prefixo}` : armadura.nome;
    const valor = ehMagica ? armadura.valor * enc.multValor : armadura.valor;

    return {
      id,
      nome: nomeFinal,
      categoria,
      raridade: ehMagica ? enc.raridade : 'Comum',
      valorPO: valor,
      descricaoMecanica: `Proteção: ${armadura.ca}.`,
      propriedadeMagica: ehMagica ? `Garante bônus de proteção adicional e resistência leve.` : undefined,
      peculiaridade: ehMagica ? rng.pick(PECULIARIDADES) : undefined,
      isAmaldicoado: false,
    };
  }

  // Categoria: Arma (Padrão)
  const base = rng.pick(ARMAS_BASE);
  const ehMagica = options.raridadeDesejada && options.raridadeDesejada !== 'Comum' ? true : rng.nextBool(0.75);
  let encPool = ENCANTAMENTOS;
  if (options.raridadeDesejada) {
    const match = ENCANTAMENTOS.filter((e) => e.raridade === options.raridadeDesejada);
    if (match.length > 0) encPool = match;
  }
  const enc = rng.pick(encPool);
  const nomeFinal = ehMagica ? `${base.nome} ${enc.prefixo}` : base.nome;
  const valor = ehMagica ? base.valor * enc.multValor : base.valor;

  const isAmaldicoado = options.permitirMaldicao && rng.nextBool(0.12);

  return {
    id,
    nome: nomeFinal,
    categoria,
    raridade: ehMagica ? enc.raridade : 'Comum',
    valorPO: valor,
    descricaoMecanica: `Dano: ${base.dano}.`,
    propriedadeMagica: ehMagica
      ? `Ataque e Dano +${enc.bonus}. ${enc.danoExtra}`.trim()
      : undefined,
    peculiaridade: ehMagica ? rng.pick(PECULIARIDADES) : undefined,
    isAmaldicoado: Boolean(isAmaldicoado),
    maldicaoTexto: isAmaldicoado ? rng.pick(MALDICOES) : undefined,
  };
}

export function gerarLoteItens(
  rootSeed: number,
  quantidade = 6,
  options?: {
    categoria?: CategoriaItem;
    raridadeDesejada?: RaridadeItem;
    permitirMaldicao?: boolean;
  }
): ItemGerado[] {
  const itens: ItemGerado[] = [];
  for (let i = 0; i < quantidade; i++) {
    const sub = deriveSubSeed(rootSeed, `item_batch_${i}`);
    itens.push(gerarItem(sub, options));
  }
  return itens;
}
