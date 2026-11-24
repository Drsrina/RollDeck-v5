import { describe, expect, it } from 'vitest';
import { TODAS_TABELAS, TABELAS_EVENTO_DUPLO, REGRAS_TURNOS } from '../data';
import {
  consultarOraculo,
  calcularGrauIntensidade,
  PROBABILIDADES,
} from './oraculoEngine';
import {
  createMulberry32,
  isDouble1d100,
  roll1d100,
  stringToSeed,
  consultarTabela,
} from './prng';
import { avancarDiasTurno, calcularEstacao } from './turnosEngine';
import type { CidadeEstado } from '../types/oraculo';

describe('Oráculo dos Terratenentes — Motor de RPG Solo', () => {
  it('garante que todas as tabelas em /src/data possuem pelo menos 8 entradas válidas', () => {
    expect(TODAS_TABELAS.length).toBeGreaterThanOrEqual(9);

    for (const tabela of TODAS_TABELAS) {
      expect(tabela.id).toBeDefined();
      expect(tabela.nome).toBeDefined();
      expect(tabela.entradas.length).toBeGreaterThanOrEqual(8);

      for (const e of tabela.entradas) {
        expect(e.min).toBeLessThanOrEqual(e.max);
        expect(e.texto.length).toBeGreaterThan(0);
      }
    }

    // Tabelas de evento em dados duplos
    expect(TABELAS_EVENTO_DUPLO.foco.entradas.length).toBeGreaterThanOrEqual(8);
    expect(TABELAS_EVENTO_DUPLO.acao.entradas.length).toBeGreaterThanOrEqual(8);
    expect(TABELAS_EVENTO_DUPLO.assunto.entradas.length).toBeGreaterThanOrEqual(8);
  });

  it('valida reprodutibilidade determinística idêntica do PRNG Mulberry32', () => {
    const seed1 = stringToSeed('campanha_terratenentes_42');
    const prng1 = createMulberry32(seed1);
    const rolagens1 = [roll1d100(prng1), roll1d100(prng1), roll1d100(prng1), roll1d100(prng1)];

    const seed2 = stringToSeed('campanha_terratenentes_42');
    const prng2 = createMulberry32(seed2);
    const rolagens2 = [roll1d100(prng2), roll1d100(prng2), roll1d100(prng2), roll1d100(prng2)];

    expect(rolagens1).toEqual(rolagens2);
  });

  it('detecta dados duplos corretamente em 1d100', () => {
    expect(isDouble1d100(11)).toBe(true);
    expect(isDouble1d100(22)).toBe(true);
    expect(isDouble1d100(33)).toBe(true);
    expect(isDouble1d100(44)).toBe(true);
    expect(isDouble1d100(55)).toBe(true);
    expect(isDouble1d100(66)).toBe(true);
    expect(isDouble1d100(77)).toBe(true);
    expect(isDouble1d100(88)).toBe(true);
    expect(isDouble1d100(99)).toBe(true);
    expect(isDouble1d100(100)).toBe(true);

    expect(isDouble1d100(12)).toBe(false);
    expect(isDouble1d100(45)).toBe(false);
    expect(isDouble1d100(7)).toBe(false);
  });

  it('calcula graus de intensidade do Oráculo Sim / Não', () => {
    // Limiar 50%
    const resExtremoSim = calcularGrauIntensidade(5, 50);
    expect(resExtremoSim.isSim).toBe(true);
    expect(resExtremoSim.grau).toBe('Sim, e...');

    const resApertadoSim = calcularGrauIntensidade(48, 50);
    expect(resApertadoSim.isSim).toBe(true);
    expect(resApertadoSim.grau).toBe('Sim, mas...');

    const resSimNormal = calcularGrauIntensidade(25, 50);
    expect(resSimNormal.isSim).toBe(true);
    expect(resSimNormal.grau).toBe('Sim');

    const resApertadoNao = calcularGrauIntensidade(53, 50);
    expect(resApertadoNao.isSim).toBe(false);
    expect(resApertadoNao.grau).toBe('Não, mas...');

    const resExtremoNao = calcularGrauIntensidade(95, 50);
    expect(resExtremoNao.isSim).toBe(false);
    expect(resExtremoNao.grau).toBe('Não, e...');
  });

  it('dispara evento composto ao rolar dados duplos no oráculo', () => {
    // Semente forçada para gerar duplo
    let encontrado = false;
    let tentativas = 0;
    while (!encontrado && tentativas < 200) {
      tentativas++;
      const prng = createMulberry32(tentativas * 1337);
      const res = consultarOraculo('Há um ataque iminente?', 'meio', 0, prng);
      if (res.isDuplo) {
        encontrado = true;
        expect(res.eventoDuplo).toBeDefined();
        expect(res.eventoDuplo?.focoTexto).toBeDefined();
        expect(res.eventoDuplo?.acaoTexto).toBeDefined();
        expect(res.eventoDuplo?.assuntoTexto).toBeDefined();
        expect(res.eventoDuplo?.fraseCompleta.length).toBeGreaterThan(10);
      }
    }
    expect(encontrado).toBe(true);
  });

  it('processa ciclo de avanço de turnos (semanal 7d e mensal 30d)', () => {
    const cidadeTeste: CidadeEstado = {
      nome: 'Fortaleza da Alvorada',
      populacao: 100,
      recursos: {
        viveres: 50,
        ouro: 40,
        madeira: 20,
        pedra: 20,
        minerio: 10,
      },
      estabilidade: 70,
      moral: 70,
      defesa: 30,
      industria: 1,
      estacao: 'Primavera',
      dia: 1,
      construcoes: [
        {
          id: 'const-1',
          nome: 'Torre de Vigia',
          custo: { madeira: 10, pedra: 10 },
          efeito: '+5 Defesa',
          status: 'em_obras',
          diasTotais: 6,
          diasRestantes: 6,
        },
      ],
      rotas: [
        {
          id: 'rota-1',
          origem: 'Fortaleza',
          destino: 'Vila',
          produto: 'Grãos',
          frequencia: 'semanal',
          lucroEstimadoOuro: 10,
          ativa: true,
        },
      ],
    };

    const prng = createMulberry32(12345);

    // Avança 6 dias (dia 7 alcançado -> fase semanal)
    const { novaCidade: aposSemana, relatorio: relSemana } = avancarDiasTurno(
      cidadeTeste,
      6,
      prng,
      'test_seed'
    );

    expect(aposSemana.dia).toBe(7);
    expect(relSemana.fasesDisparadas).toContain('semanal');
    // Construção de 7 dias concluiu
    expect(aposSemana.construcoes[0].status).toBe('concluida');
    // Víveres foram consumidos (100 * 0.05 = 5 víveres)
    expect(aposSemana.recursos.viveres).toBe(45);
    // Lucro de rota semanal somado
    expect(aposSemana.recursos.ouro).toBeGreaterThan(40);

    // Avança mais 23 dias (dia 30 alcançado -> fase mensal)
    const { novaCidade: aposMes, relatorio: relMes } = avancarDiasTurno(
      aposSemana,
      23,
      prng,
      'test_seed_2'
    );

    expect(aposMes.dia).toBe(30);
    expect(relMes.fasesDisparadas).toContain('mensal');
    // Colheita de primavera adicionada (+25 víveres)
    expect(aposMes.recursos.viveres).toBeGreaterThan(45);
  });

  it('calcula estações do ano corretamente a cada 90 dias', () => {
    expect(calcularEstacao(1)).toBe('Primavera');
    expect(calcularEstacao(90)).toBe('Primavera');
    expect(calcularEstacao(91)).toBe('Verão');
    expect(calcularEstacao(180)).toBe('Verão');
    expect(calcularEstacao(181)).toBe('Outono');
    expect(calcularEstacao(270)).toBe('Outono');
    expect(calcularEstacao(271)).toBe('Inverno');
    expect(calcularEstacao(360)).toBe('Inverno');
    expect(calcularEstacao(361)).toBe('Primavera');
  });
});
