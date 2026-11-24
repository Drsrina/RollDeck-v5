import { TABELAS_EVENTO_DUPLO } from '../data';
import { consultarTabela, isDouble1d100, roll1d100 } from './prng';

export type ProbabilidadeKey =
  | 'certeza'
  | 'quaseCerto'
  | 'provavel'
  | 'meio'
  | 'improvavel'
  | 'muitoImprovavel'
  | 'quaseImpossivel';

export interface ProbabilidadeDef {
  key: ProbabilidadeKey;
  label: string;
  chance: number; // Porcentagem base (ex.: 70)
}

export const PROBABILIDADES: ProbabilidadeDef[] = [
  { key: 'certeza', label: 'Certeza', chance: 95 },
  { key: 'quaseCerto', label: 'Quase Certo', chance: 85 },
  { key: 'provavel', label: 'Provável', chance: 70 },
  { key: 'meio', label: '50 / 50', chance: 50 },
  { key: 'improvavel', label: 'Improvável', chance: 30 },
  { key: 'muitoImprovavel', label: 'Muito Improvável', chance: 15 },
  { key: 'quaseImpossivel', label: 'Quase Impossível', chance: 5 },
];

export type GrauIntensidade =
  | 'Sim, e...'
  | 'Sim'
  | 'Sim, mas...'
  | 'Não, mas...'
  | 'Não'
  | 'Não, e...';

export interface EventoDuplo {
  focoValor: number;
  focoTexto: string;
  acaoValor: number;
  acaoTexto: string;
  assuntoValor: number;
  assuntoTexto: string;
  fraseCompleta: string;
}

export interface OraculoResultado {
  pergunta: string;
  probabilidade: ProbabilidadeKey;
  chanceBase: number;
  modificador: number;
  limiarFinal: number;
  dadoRolado: number;
  isSim: boolean;
  grau: GrauIntensidade;
  isDuplo: boolean;
  eventoDuplo?: EventoDuplo;
}

/**
 * Avalia o grau de intensidade do resultado com base na distância ao limiar.
 */
export function calcularGrauIntensidade(dado: number, limiar: number): { isSim: boolean; grau: GrauIntensidade } {
  const isSim = dado <= limiar;

  if (isSim) {
    // Margem extrema favorável (<= 20% do limiar ou <= 10)
    if (dado <= Math.max(5, Math.round(limiar * 0.2))) {
      return { isSim: true, grau: 'Sim, e...' };
    }
    // Margem apertada favorável (nos 15% finais antes do limiar)
    if (dado >= Math.max(1, Math.round(limiar * 0.85))) {
      return { isSim: true, grau: 'Sim, mas...' };
    }
    return { isSim: true, grau: 'Sim' };
  } else {
    // Margem apertada desfavorável (logo após o limiar)
    const distancia = dado - limiar;
    const margemSuperior = 100 - limiar;
    if (distancia <= Math.max(5, Math.round(margemSuperior * 0.15))) {
      return { isSim: false, grau: 'Não, mas...' };
    }
    // Margem extrema desfavorável (>= 90 ou no topo da margem)
    if (dado >= 92 || distancia >= Math.round(margemSuperior * 0.8)) {
      return { isSim: false, grau: 'Não, e...' };
    }
    return { isSim: false, grau: 'Não' };
  }
}

/**
 * Executa uma consulta ao Oráculo dos Terratenentes.
 */
export function consultarOraculo(
  pergunta: string,
  probKey: ProbabilidadeKey,
  modificador: number,
  prng: () => number
): OraculoResultado {
  const probDef = PROBABILIDADES.find((p) => p.key === probKey) || PROBABILIDADES[3];
  const chanceBase = probDef.chance;

  // Clampa o limiar entre 1% e 99% para sempre haver margem de incerteza
  const limiarFinal = Math.min(99, Math.max(1, chanceBase + modificador));
  const dadoRolado = roll1d100(prng);

  const { isSim, grau } = calcularGrauIntensidade(dadoRolado, limiarFinal);
  const duplo = isDouble1d100(dadoRolado);

  let eventoDuplo: EventoDuplo | undefined = undefined;

  if (duplo) {
    const focoValor = roll1d100(prng);
    const focoTexto = consultarTabela(TABELAS_EVENTO_DUPLO.foco, focoValor);

    const acaoValor = roll1d100(prng);
    const acaoTexto = consultarTabela(TABELAS_EVENTO_DUPLO.acao, acaoValor);

    const assuntoValor = roll1d100(prng);
    const assuntoTexto = consultarTabela(TABELAS_EVENTO_DUPLO.assunto, assuntoValor);

    eventoDuplo = {
      focoValor,
      focoTexto,
      acaoValor,
      acaoTexto,
      assuntoValor,
      assuntoTexto,
      fraseCompleta: `[${focoTexto}]: ${acaoTexto} ${assuntoTexto}`,
    };
  }

  return {
    pergunta,
    probabilidade: probKey,
    chanceBase,
    modificador,
    limiarFinal,
    dadoRolado,
    isSim,
    grau,
    isDuplo: duplo,
    eventoDuplo,
  };
}
