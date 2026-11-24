/**
 * FORJA DE MUNDOS — Gerador de Nomes por Cadeia de Markov (§2 & §3)
 *
 * Treina uma cadeia de Markov de caracteres (ordem 2 ou 3) a partir de listas de nomes-fonte.
 * Produz nomes foneticamente autênticos sem nenhuma IA e com determinismo estrito via PRNG.
 */

import { DeterministicRNG } from './prng';

export type KitMarkovId = 'usuario_fantasia' | 'elfico' | 'anao' | 'nordico' | 'customizado';

export interface KitMarkovFonte {
  id: KitMarkovId;
  nome: string;
  descricao: string;
  nomes: string[];
}

// Lista fornecida no prompt pelo usuário (70 nomes)
export const NOMES_KIT_USUARIO = [
  'Alden', 'Alec', 'Anton', 'Arden', 'Arlen', 'Armand', 'Arron', 'Augustus', 'Avery', 'Benedict',
  'Bennett', 'Branden', 'Brendon', 'Britt', 'Broderick', 'Carter', 'Chadwick', 'Chas', 'Chet', 'Colby',
  'Cole', 'Cordell', 'Dalton', 'Damien', 'Dante', 'Darell', 'Darius', 'Darron', 'Darwin', 'Dewitt',
  'Diego', 'Dillon', 'Dirk', 'Domenic', 'Donovan', 'Dorian', 'Dorsey', 'Edison', 'Elden', 'Elvin',
  'Erich', 'Galen', 'Garret', 'Gaston', 'Gavin', 'German', 'Graham', 'Hal', 'Hank', 'Harlan',
  'Hayden', 'Herschel', 'Hoyt', 'Hunter', 'Isaias', 'Issac', 'Jacinto', 'Jarred', 'Jonas', 'Kendrick',
  'Keneth', 'Kennith', 'Keven', 'Leif', 'Lenard', 'Lincoln', 'Linwood', 'Lucius', 'Lynwood', 'Malcolm',
  'Malik', 'Maxwell', 'McKinley', 'Merlin', 'Merrill', 'Michal', 'Monty', 'Newton', 'Nolan', 'Porter',
  'Quinton', 'Raphael', 'Reid', 'Rory', 'Scotty', 'Shad', 'Stanton', 'Stefan', 'Thaddeus', 'Tobias',
  'Trenton', 'Vance', 'Walker', 'Walton', 'Weldon', 'Wes', 'Weston', 'Willian', 'Winford', 'Wyatt',
];

export const NOMES_KIT_ELFICO = [
  'Aerandir', 'Alassë', 'Amras', 'Amrod', 'Anárion', 'Angrod', 'Aredhel', 'Beleg', 'Celebrían', 'Celeborn',
  'Celegorm', 'Círdan', 'Curufin', 'Daeron', 'Eärendil', 'Ecthelion', 'Edrahil', 'Elendil', 'Elladan', 'Elrohir',
  'Elrond', 'Ennorath', 'Erestor', 'Fëanor', 'Fingolfin', 'Finarfin', 'Fingon', 'Finrod', 'Galadriel', 'Galdor',
  'Gil-galad', 'Glorfindel', 'Guilin', 'Haldir', 'Idril', 'Legolas', 'Lindir', 'Lúthien', 'Mablung', 'Maedhros',
  'Maeglin', 'Maglor', 'Nimrodel', 'Olwë', 'Oropher', 'Saeros', 'Targon', 'Thingol', 'Thranduil', 'Turgon',
  'Voronwë', 'Silivren', 'Tinúviel', 'Laurelin', 'Elenna', 'Calenardhon', 'Nimbrethil', 'Erendis', 'Ancalimë',
];

export const NOMES_KIT_ANAO = [
  'Balin', 'Bifur', 'Bofur', 'Bombur', 'Dain', 'Dis', 'Dori', 'Dwalin', 'Farin', 'Fili',
  'Flói', 'Frar', 'Frerin', 'Frór', 'Fundin', 'Gimli', 'Gloin', 'Gróin', 'Grór', 'Ibún',
  'Kazador', 'Kíli', 'Korgan', 'Lóni', 'Mîm', 'Moradin', 'Náin', 'Nali', 'Narvi', 'Nori',
  'Norgrim', 'Oin', 'Ori', 'Rúmil', 'Telchar', 'Thrain', 'Thorin', 'Thror', 'Ulfar', 'Varin',
  'Baruk', 'Khazad', 'Durin', 'Gror', 'Skorgrím', 'Brokkr', 'Eitri', 'Sindri', 'Dvalinn', 'Alvis',
];

export const NOMES_KIT_NORDICO = [
  'Aslak', 'Bjorn', 'Dagmar', 'Einar', 'Eirik', 'Freyja', 'Grim', 'Gunnar', 'Hakon', 'Halvar',
  'Harald', 'Ingvar', 'Ivar', 'Jarl', 'Knut', 'Leif', 'Magnus', 'Olaf', 'Ragnar', 'Roar',
  'Sigrid', 'Sigurd', 'Snorri', 'Stian', 'Sven', 'Thorstein', 'Torvald', 'Trygve', 'Ulf', 'Valdemar',
  'Vidar', 'Astrid', 'Birger', 'Bodil', 'Geir', 'Hilda', 'Inga', 'Kari', 'Runa', 'Solveig',
  'Torbjorn', 'Yngve', 'Alfhild', 'Brand', 'Erling', 'Frode', 'Gudrun', 'Halldor', 'Orm', 'Ketil',
];

export const KITS_MARKOV_DISPONIVEIS: KitMarkovFonte[] = [
  {
    id: 'usuario_fantasia',
    nome: 'Fantasia Clássica (Exemplo do Usuário)',
    descricao: '70 nomes heroicos clássicos ocidentais (Alden, Alec, Broderick, Dalton, Leif, Vance, Wyatt...)',
    nomes: NOMES_KIT_USUARIO,
  },
  {
    id: 'elfico',
    nome: 'Élfico Nobre (Sindarin & Quenya)',
    descricao: 'Línguas fluidas, sonoras e ancestrais dos Primeiros Nascidos',
    nomes: NOMES_KIT_ELFICO,
  },
  {
    id: 'anao',
    nome: 'Anão das Montanhas (Khuzdul)',
    descricao: 'Fonética gutural, consoantes fortes e nomes de clãs mineiros',
    nomes: NOMES_KIT_ANAO,
  },
  {
    id: 'nordico',
    nome: 'Nórdico & Clãs Bárbaros',
    descricao: 'Nomes rúnicos de guerreiros escandinavos e exploradores dos fiordes',
    nomes: NOMES_KIT_NORDICO,
  },
  {
    id: 'customizado',
    nome: 'Lista Personalizada (Custom)',
    descricao: 'Cole ou digite sua própria lista de nomes para treinar a cadeia de Markov',
    nomes: [],
  },
];

export interface MarkovModel {
  order: number;
  transitions: Map<string, string[]>;
  starts: string[];
}

/**
 * Constrói o modelo de Cadeia de Markov de caracteres a partir de uma lista de palavras.
 */
export function construirModeloMarkov(nomes: string[], order = 2): MarkovModel {
  const transitions = new Map<string, string[]>();
  const starts: string[] = [];
  const startToken = '^';
  const endToken = '$';

  for (const rawNome of nomes) {
    const nome = rawNome.trim();
    if (!nome || nome.length < order) continue;

    // Prefixa com o token de início repetido
    const padded = startToken.repeat(order) + nome.toLowerCase() + endToken;

    // Registra início
    const startKey = padded.slice(0, order);
    if (!starts.includes(startKey)) {
      starts.push(startKey);
    }

    for (let i = 0; i < padded.length - order; i++) {
      const state = padded.slice(i, i + order);
      const nextChar = padded[i + order];

      let nextList = transitions.get(state);
      if (!nextList) {
        nextList = [];
        transitions.set(state, nextList);
      }
      nextList.push(nextChar);
    }
  }

  return { order, transitions, starts };
}

/**
 * Gera um nome procedural a partir do modelo de Markov treinado.
 */
export function gerarNomeMarkov(
  model: MarkovModel,
  rng: DeterministicRNG,
  options: {
    minLen?: number;
    maxLen?: number;
    maxTentativas?: number;
    evitarOriginais?: boolean;
    originaisLower?: Set<string>;
  } = {}
): string {
  const minLen = options.minLen || 4;
  const maxLen = options.maxLen || 10;
  const maxTentativas = options.maxTentativas || 30;
  const startToken = '^';
  const endToken = '$';

  if (model.starts.length === 0) {
    return 'Desconhecido';
  }

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    let currentState = startToken.repeat(model.order);
    let output = '';
    let steps = 0;

    while (steps++ < 30) {
      const possibilities = model.transitions.get(currentState);
      if (!possibilities || possibilities.length === 0) break;

      const nextChar = rng.pick(possibilities);
      if (nextChar === endToken) break;

      output += nextChar;
      currentState = currentState.slice(1) + nextChar;
    }

    if (output.length >= minLen && output.length <= maxLen) {
      // Se solicitado, evita duplicata exata da lista de treino
      if (options.evitarOriginais && options.originaisLower?.has(output.toLowerCase())) {
        continue;
      }
      // Capitaliza a primeira letra de cada palavra ou hífen
      return output
        .split(/(\s|-)/)
        .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
        .join('');
    }
  }

  // Fallback caso não atinja exatamente a restrição após várias tentativas
  const fallback = model.starts.length > 0 ? rng.pick(model.starts).replace(/\^/g, '') : 'Elden';
  return fallback.charAt(0).toUpperCase() + fallback.slice(1);
}

/**
 * Gera um lote determinístico de nomes através do modelo Markov.
 */
export function gerarLoteNomesMarkov(
  seed: number,
  kit: KitMarkovFonte,
  nomesCustomizados: string[],
  quantidade = 10,
  options: {
    order?: number;
    minLen?: number;
    maxLen?: number;
  } = {}
): {
  nomes: string[];
  totalGerados: number;
  seedUsada: number;
  kitNome: string;
} {
  const rng = new DeterministicRNG(seed);
  const order = options.order || 2;
  const nomesTreino = kit.id === 'customizado' ? nomesCustomizados : kit.nomes;

  if (nomesTreino.length === 0) {
    return {
      nomes: ['(Nenhum nome na fonte selecionada)'],
      totalGerados: 0,
      seedUsada: seed,
      kitNome: kit.nome,
    };
  }

  const model = construirModeloMarkov(nomesTreino, order);
  const originaisLower = new Set(nomesTreino.map((n) => n.trim().toLowerCase()));

  const resultado: string[] = [];
  const jaGerados = new Set<string>();

  let tentativas = 0;
  while (resultado.length < quantidade && tentativas++ < quantidade * 6) {
    const nome = gerarNomeMarkov(model, rng, {
      minLen: options.minLen || 4,
      maxLen: options.maxLen || 11,
      evitarOriginais: false,
      originaisLower,
    });

    if (!jaGerados.has(nome)) {
      jaGerados.add(nome);
      resultado.push(nome);
    }
  }

  return {
    nomes: resultado,
    totalGerados: resultado.length,
    seedUsada: seed,
    kitNome: kit.nome,
  };
}
