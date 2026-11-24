import type { TabelaRolavel } from '../data';

/**
 * Converte qualquer string ou número em um hash inteiro de 32 bits não assinado.
 */
export function stringToSeed(str: string): number {
  let hash = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(hash ^ str.charCodeAt(i), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }
  return hash >>> 0;
}

/**
 * Gerador de números pseudo-aleatórios determinístico Mulberry32.
 * Rápido, leve e com excelente distribuição estatística de 32 bits.
 */
export function createMulberry32(seedNumber: number) {
  let state = seedNumber >>> 0;
  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Rola um dado de N lados (1 a N) com o PRNG fornecido.
 */
export function rollDie(sides: number, prng: () => number): number {
  return Math.floor(prng() * sides) + 1;
}

/**
 * Rola 1d100 (1 a 100).
 */
export function roll1d100(prng: () => number): number {
  return rollDie(100, prng);
}

/**
 * Detecta se a rolagem de 1d100 formou dados duplos.
 * Ex.: 11, 22, 33, 44, 55, 66, 77, 88, 99 ou 100 (duplo 00).
 */
export function isDouble1d100(val: number): boolean {
  if (val === 100) return true;
  if (val < 11 || val > 99) return false;
  return val % 11 === 0;
}

/**
 * Busca uma entrada na tabela de acordo com o resultado numérico.
 */
export function consultarTabela(tabela: TabelaRolavel, valor: number): string {
  const achado = tabela.entradas.find((e) => valor >= e.min && valor <= e.max);
  if (achado) return achado.texto;
  // Fallback caso saia das bordas
  if (tabela.entradas.length > 0) {
    return tabela.entradas[tabela.entradas.length - 1].texto;
  }
  return 'Resultado indefinido';
}
