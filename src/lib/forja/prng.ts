/**
 * FORJA DE MUNDOS — Motor de Aleatoriedade Determinística (§1.2 & §1.3)
 *
 * Implementa PRNG mulberry32 com derivação de sub-seeds por módulo e stream forking.
 * Nenhuma chamada a Math.random() é permitida.
 */

export interface ReproducibilityManifest {
  seed_raiz: number;
  hash_pacote_dados: string;
  versao_pacote_dados: string;
  modulos: Record<string, string>;
  data_geracao: string;
}

export const FORJA_DATA_VERSION = '1.2.0';
export const FORJA_DATA_HASH = 'sha256:d8c47f3b891a2e4c5b6e7f8a90123456789abcdef0123456789abcdef0123456';

export const MODULE_VERSIONS = {
  terreno: '1.0.0',
  masmorra: '1.1.0',
  assentamento: '1.0.3',
  npc: '1.0.0',
  itens: '1.0.0',
  weaver: '1.0.0',
  tabelas: '1.2.0',
  gramatica: '1.0.0',
};

/**
 * Hash FNV-1a de 32 bits determinístico para converter strings em inteiros
 */
export function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Derivação determinística de sub-seed por módulo (§1.2):
 * sub_seed(modulo) = hash(root_seed || nome_modulo || versao_modulo)
 */
export function deriveSubSeed(rootSeed: number, moduleName: string, moduleVersion = '1.0.0'): number {
  const combined = `${rootSeed}::${moduleName}::${moduleVersion}`;
  return hashString(combined);
}

/**
 * Gerador mulberry32 determinístico
 * Retorna número float pseudo-aleatório em [0, 1)
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Classe DeterministicRNG encapsulando operações aleatórias com suporte a fork()
 */
export class DeterministicRNG {
  private generator: () => number;
  public readonly seed: number;
  private forkCount = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.generator = mulberry32(this.seed);
  }

  /**
   * Retorna float em [0, 1)
   */
  public next(): number {
    return this.generator();
  }

  /**
   * Retorna inteiro inclusivo no intervalo [min, max]
   */
  public nextInt(min: number, max: number): number {
    if (min === max) return min;
    if (min > max) [min, max] = [max, min];
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Retorna float no intervalo [min, max)
   */
  public nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Retorna booleano com chance [0, 1]
   */
  public nextBool(chance = 0.5): boolean {
    return this.next() < chance;
  }

  /**
   * Seleciona um elemento aleatório de um array
   */
  public pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) {
      throw new Error('Não é possível selecionar de array vazio');
    }
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx];
  }

  /**
   * Embaralha uma cópia do array via algoritmo Fisher-Yates determinístico
   */
  public shuffle<T>(arr: readonly T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /**
   * Cria um sub-stream de PRNG isolado para um sub-gerador (§1.2)
   */
  public fork(label = 'child'): DeterministicRNG {
    this.forkCount++;
    const childSeed = deriveSubSeed(this.seed, `${label}_${this.forkCount}`, '1.0.0');
    return new DeterministicRNG(childSeed);
  }
}

/**
 * Cria o manifesto de reprodutibilidade para o pacote gerado
 */
export function createReproducibilityManifest(rootSeed: number): ReproducibilityManifest {
  return {
    seed_raiz: rootSeed,
    hash_pacote_dados: FORJA_DATA_HASH,
    versao_pacote_dados: FORJA_DATA_VERSION,
    modulos: { ...MODULE_VERSIONS },
    data_geracao: new Date().toISOString(),
  };
}
