import { describe, expect, it } from 'vitest';
import { DeterministicRNG, deriveSubSeed } from './prng';
import {
  artigoDefinido,
  artigoIndefinido,
  contracaoDe,
  concordarAdjetivo,
  concordarGrupoMisto,
  comporTextoPT,
} from './grammar';
import { calcularEntropiaTabela, TableEngine } from './tableEngine';
import { TABELAS_CANONICAS } from './tablesData';
import { gerarTerreno } from './terrainGenerator';
import { gerarMasmorra, balancearEncontroXP } from './dungeonGenerator';
import { gerarMundoCompleto } from './pipeline';

describe('Forja de Mundos — Camada de Qualidade e Determinismo (§9)', () => {
  // 9.1: Snapshot por Seed (Determinismo estrito)
  it('garante reprodutibilidade idêntica bit-a-bit para seed: 42 (§9.1)', () => {
    const mundoA = gerarMundoCompleto(42);
    const mundoB = gerarMundoCompleto(42);

    expect(mundoA.manifesto.seed_raiz).toBe(42);
    expect(mundoB.manifesto.seed_raiz).toBe(42);

    // Mesmos assentamentos e nomes
    expect(mundoA.assentamento.nome).toBe(mundoB.assentamento.nome);
    expect(mundoA.assentamento.populacao).toBe(mundoB.assentamento.populacao);

    // Mesma masmorra
    expect(mundoA.masmorra.nome).toBe(mundoB.masmorra.nome);
    expect(mundoA.masmorra.rooms.length).toBe(mundoB.masmorra.rooms.length);
    expect(mundoA.masmorra.orcamentoXp.xpAlocado).toBe(mundoB.masmorra.orcamentoXp.xpAlocado);

    // Mesmos NPCs
    expect(mundoA.npcs[0].nome).toBe(mundoB.npcs[0].nome);
    expect(mundoA.npcs[0].stats.pv).toBe(mundoB.npcs[0].stats.pv);

    // Mesmos itens
    expect(mundoA.itens[0].nome).toBe(mundoB.itens[0].nome);
    expect(mundoA.itens[0].valorPO).toBe(mundoB.itens[0].valorPO);
  });

  // 9.3: Entropia de Shannon das Tabelas
  it('valida que as tabelas canônicas possuem entropia normalizada H/log(n) >= 0.7 (§9.3)', () => {
    for (const tabela of TABELAS_CANONICAS) {
      const metricas = calcularEntropiaTabela(tabela);
      expect(
        metricas.entropiaNormalizada,
        `Tabela "${tabela.tabela}" abaixo do limiar de variedade (score: ${metricas.entropiaNormalizada})`
      ).toBeGreaterThanOrEqual(0.7);
    }
  });

  // 9.4: Concordância Gramatical em Português (PT-BR)
  describe('Compositor Gramatical PT-BR (§3 & §9.4)', () => {
    it('aplica artigos definidos e contrações de gênero e número', () => {
      expect(artigoDefinido('m', 's')).toBe('o');
      expect(artigoDefinido('f', 's')).toBe('a');
      expect(artigoDefinido('m', 'p')).toBe('os');
      expect(artigoDefinido('f', 'p')).toBe('as');

      expect(contracaoDe('m', 's')).toBe('do');
      expect(contracaoDe('f', 's')).toBe('da');
      expect(contracaoDe('m', 'p')).toBe('dos');
      expect(contracaoDe('f', 'p')).toBe('das');
    });

    it('flexiona adjetivos conforme gênero e número do regente', () => {
      expect(concordarAdjetivo('antigo', 'm', 's')).toBe('antigo');
      expect(concordarAdjetivo('antigo', 'f', 's')).toBe('antiga');
      expect(concordarAdjetivo('antigo', 'm', 'p')).toBe('antigos');
      expect(concordarAdjetivo('antigo', 'f', 'p')).toBe('antigas');

      expect(concordarAdjetivo('sombrio', 'f', 's')).toBe('sombria');
      expect(concordarAdjetivo('sagrado', 'f', 'p')).toBe('sagradas');
    });

    it('aplica precedência do masculino plural para grupos mistos', () => {
      const grupo = concordarGrupoMisto([
        { genero: 'f', numero: 's' },
        { genero: 'm', numero: 's' },
      ]);
      expect(grupo.genero).toBe('m');
      expect(grupo.numero).toBe('p');
    });

    it('processa template morfológico com binds contextuais', () => {
      const template = 'Dizem que [art:def:ferreiro] {{ferreiro}} está em uma mina [adj:antigo:mina].';
      const ctx = {
        ferreiro: { texto: 'Torben', genero: 'm' as const, numero: 's' as const },
        mina: { texto: 'mina de ferro', genero: 'f' as const, numero: 's' as const },
      };
      const resultado = comporTextoPT(template, ctx);
      expect(resultado).toBe('Dizem que o Torben está em uma mina antiga.');
    });
  });

  // 9.5: Testes de Terreno e Hidrologia
  describe('Gerador de Terreno (§4.5 & §9.5)', () => {
    it('gera terreno com células, biomas e rios sem loops infinitos', () => {
      const terreno = gerarTerreno(1337, { topologia: 'hex', cols: 16, rows: 12 });
      expect(terreno.cells.length).toBe(16 * 12);
      expect(terreno.metricas.areaTerra).toBeGreaterThan(10);
      expect(terreno.metricas.areaAgua).toBeGreaterThan(10);
      expect(terreno.settlements.length).toBeGreaterThan(0);
    });

    it('assegura que rios fluem para jusante com descida de gradiente', () => {
      const terreno = gerarTerreno(999, { topologia: 'hex', cols: 20, rows: 15 });
      for (const rio of terreno.rivers) {
        expect(rio.path.length).toBeGreaterThanOrEqual(2);
        const startElev = terreno.cells[rio.path[0]].elevation;
        const endElev = terreno.cells[rio.path[rio.path.length - 1]].elevation;
        expect(startElev).toBeGreaterThanOrEqual(endElev);
      }
    });
  });

  // 5.1 & 5.3: Masmorras e Orçamento de XP
  describe('Gerador de Masmorras (§5)', () => {
    it('garante que o grafo de missão Lock-and-Key é solúvel por BFS', () => {
      const masmorra = gerarMasmorra(42, { nivelGrupo: 4, tamanhoGrupo: 4, dificuldade: 'medio' });
      expect(masmorra.isSolvable).toBe(true);
      expect(masmorra.rooms.length).toBe(6);
    });

    it('balanceia o orçamento de XP dentro de ±15%', () => {
      const rng = new DeterministicRNG(12345);
      const enc = balancearEncontroXP(3, 4, 'medio', rng);
      expect(enc.totalXp).toBeGreaterThanOrEqual(enc.orcamento * 0.85);
      expect(enc.totalXp).toBeLessThanOrEqual(enc.orcamento * 1.15);
    });
  });

  // Novos Geradores: Markov Names e Fantasy Generator
  describe('Gerador Markov de Nomes & Gerador Fantasia', () => {
    it('gera nomes procedurais por Markov com determinismo e kit do usuário', async () => {
      const { KITS_MARKOV_DISPONIVEIS, gerarLoteNomesMarkov } = await import('./markovNames');
      const kitUsuario = KITS_MARKOV_DISPONIVEIS[0];
      const loteA = gerarLoteNomesMarkov(42, kitUsuario, [], 10);
      const loteB = gerarLoteNomesMarkov(42, kitUsuario, [], 10);

      expect(loteA.nomes.length).toBe(10);
      expect(loteA.nomes).toEqual(loteB.nomes);
      expect(typeof loteA.nomes[0]).toBe('string');
      expect(loteA.nomes[0].length).toBeGreaterThanOrEqual(3);
    });

    it('gera elementos em todas as 17 subcategorias de fantasia sem falhas', async () => {
      const { LISTA_SUBCATEGORIAS, gerarElementoFantasia } = await import('./fantasyGenerator');
      const rng = new DeterministicRNG(777);

      for (const sub of LISTA_SUBCATEGORIAS) {
        const item = gerarElementoFantasia(sub.id, rng);
        expect(item.subcategoria).toBe(sub.id);
        expect(item.titulo.length).toBeGreaterThan(0);
        expect(item.conteudoPrincipal.length).toBeGreaterThan(0);
        expect(Object.keys(item.detalhes).length).toBeGreaterThan(0);
      }
    });

    it('gera encontros aleatórios determinísticos com PV, CA, acerto, dano médio, XP, habilidades/magias e loot', async () => {
      const {
        gerarEncontroAleatorio,
        gerarLootEncontro,
        rolarAtaqueEDano,
        BIOMAS_ENCONTRO,
      } = await import('./encounterGenerator');

      for (const bioma of BIOMAS_ENCONTRO) {
        const encA = gerarEncontroAleatorio(99, {
          nivelGrupo: 5,
          tamanhoGrupo: 4,
          dificuldade: 'medio',
          bioma: bioma.id,
        });
        const encB = gerarEncontroAleatorio(99, {
          nivelGrupo: 5,
          tamanhoGrupo: 4,
          dificuldade: 'medio',
          bioma: bioma.id,
        });

        // Determinismo absoluto
        expect(encA).toEqual(encB);
        expect(encA.monstros.length).toBeGreaterThanOrEqual(1);
        expect(encA.xpBaseTotal).toBeGreaterThan(0);
        expect(encA.xpAjustadoTotal).toBeGreaterThanOrEqual(encA.xpBaseTotal);
        expect(encA.loot.itens.length).toBeGreaterThanOrEqual(1);

        const primeiroMonstro = encA.monstros[0];
        expect(primeiroMonstro.ca).toBeGreaterThanOrEqual(10);
        expect(primeiroMonstro.pvMedio).toBeGreaterThan(0);
        expect(primeiroMonstro.ataques.length).toBeGreaterThanOrEqual(1);
        expect(primeiroMonstro.ataques[0].danoMedio).toBeGreaterThan(0);
        expect(primeiroMonstro.habilidadesEMagias.length).toBeGreaterThanOrEqual(1);

        // Testa rolagem de ataque + dano
        const roll = rolarAtaqueEDano(primeiroMonstro.nome, primeiroMonstro.ataques[0]);
        expect(roll.d20Raw).toBeGreaterThanOrEqual(1);
        expect(roll.d20Raw).toBeLessThanOrEqual(20);
        expect(roll.totalAcerto).toBe(roll.d20Raw + primeiroMonstro.ataques[0].acerto);
        expect(roll.totalDano).toBeGreaterThanOrEqual(0);
      }

      // Testa geração independente de loot
      const loot1 = gerarLootEncontro(123, 5, 'dificil');
      const loot2 = gerarLootEncontro(456, 5, 'dificil');
      expect(loot1).not.toEqual(loot2);
      expect(loot1.moedas.valorTotalPO).toBeGreaterThan(0);
    });

    it('gera encontros no padrão D&D 5.5 (2024) sem multiplicador de horda, com Sangrando e níveis épicos', async () => {
      const {
        gerarEncontroAleatorio,
        XP_POR_NIVEL_55,
        mapearBiomaTerrenoParaEncontro,
      } = await import('./encounterGenerator');

      const enc55 = gerarEncontroAleatorio(2024, {
        sistema: 'dnd55',
        nivelGrupo: 17,
        tamanhoGrupo: 4,
        dificuldade: 'alta',
        bioma: 'montanha',
      });

      expect(enc55.sistema).toBe('dnd55');
      expect(enc55.usaMultiplicadorXp).toBe(false);
      expect(enc55.multiplicadorGrupo).toBe(1);
      expect(enc55.xpAjustadoTotal).toBe(enc55.xpBaseTotal);
      expect(enc55.orcamentoXpAlvo).toBe(XP_POR_NIVEL_55.alta[17] * 4);
      expect(enc55.monstros.length).toBeGreaterThanOrEqual(1);
      expect(enc55.monstros[0].pvSangrando).toBe(Math.floor(enc55.monstros[0].pvMedio / 2));
      expect(enc55.monstros[0].iniciativaFixa55).toBe(10 + enc55.monstros[0].iniciativaAtiva);

      // Mapeamento de bioma do terreno
      expect(mapearBiomaTerrenoParaEncontro('Floresta Temperada')).toBe('floresta');
      expect(mapearBiomaTerrenoParaEncontro('Picos Nevados')).toBe('montanha');
      expect(mapearBiomaTerrenoParaEncontro('Pântano')).toBe('pantano');
      expect(mapearBiomaTerrenoParaEncontro('Costa')).toBe('costa');
    });

    it('gera encontros Fantasia d20 com Reação 2d6, Moral, Distância e cenas de Exploração', async () => {
      const {
        gerarEncontroAleatorio,
        rolarTesteMoral,
        avaliarReacao2d6,
      } = await import('./encounterGenerator');

      const encD20 = gerarEncontroAleatorio(777, {
        sistema: 'd20_fantasia',
        foco: 'misto',
        nivelGrupo: 4,
        tamanhoGrupo: 4,
        dificuldade: 'medio',
        bioma: 'pantano',
      });

      expect(encD20.sistema).toBe('d20_fantasia');
      expect(encD20.detalhesD20.dvTotalInimigos).toBeGreaterThan(0);
      expect(encD20.detalhesD20.distanciaMetros).toBeGreaterThanOrEqual(6);
      expect(encD20.detalhesD20.reacaoInicial.total).toBeGreaterThanOrEqual(2);
      expect(encD20.detalhesD20.reacaoInicial.total).toBeLessThanOrEqual(12);
      expect(encD20.cenaNaoCombate).toBeDefined();
      expect(encD20.cenaNaoCombate?.testesSugeridos.length).toBeGreaterThanOrEqual(3);

      expect(avaliarReacao2d6(1, 1).categoria).toBe('Hostil');
      expect(avaliarReacao2d6(6, 6).categoria).toBe('Amigável');

      const moral = rolarTesteMoral('Goblin Espreitador', 7);
      expect(moral.total).toBe(moral.dados[0] + moral.dados[1]);
      expect(moral.passou).toBe(moral.total <= 7);
    });
  });
});

