/**
 * FORJA DE MUNDOS — Motor de Tabelas Mini-DSL e Métrica de Entropia (§2 & §9.3)
 *
 * Suporte a tabelas ponderadas não-uniformes, tags de contexto, binds de variáveis,
 * proteção contra recursão infinita (max_depth), exclusão programável e cálculo
 * de entropia de Shannon normalizada.
 */

import { DeterministicRNG } from './prng';
import { comporTextoPT } from './grammar';

export type ModoSelecao = 'unico' | 'repetivel' | 'amostra_sem_reposicao';

export interface EntradaTabela {
  peso: number;
  texto: string;
  tags?: string[];
  bind?: string;
  peso_bonus?: Record<string, number>;
  data?: Record<string, any>;
}

export interface TabelaDSL {
  tabela: string;
  modo?: ModoSelecao;
  max_depth?: number;
  exclusion_filter?: string;
  entradas: EntradaTabela[];
}

export interface ContextoGeracao {
  [key: string]: any;
}

export interface ResultadoSorteio {
  texto: string;
  entrada: EntradaTabela;
  binds: Record<string, any>;
}

/**
 * Calcula a Entropia de Shannon normalizada de uma tabela ponderada (§9.3)
 * Retorna valor entre 0 e 1: H / log2(n_entradas)
 * Tabelas com score < 0.7 são sinalizadas para revisão.
 */
export function calcularEntropiaTabela(tabela: TabelaDSL): {
  entropia: number;
  entropiaNormalizada: number;
  isAdequada: boolean;
} {
  const entradas = tabela.entradas.filter((e) => e.peso > 0);
  const n = entradas.length;
  if (n <= 1) {
    return { entropia: 0, entropiaNormalizada: 0, isAdequada: false };
  }

  const somaPesos = entradas.reduce((acc, e) => acc + e.peso, 0);
  let H = 0;
  for (const entrada of entradas) {
    const p = entrada.peso / somaPesos;
    if (p > 0) {
      H -= p * Math.log2(p);
    }
  }

  const maxH = Math.log2(n);
  const entropiaNormalizada = maxH > 0 ? H / maxH : 0;
  const isAdequada = entropiaNormalizada >= 0.7;

  return {
    entropia: Number(H.toFixed(4)),
    entropiaNormalizada: Number(entropiaNormalizada.toFixed(4)),
    isAdequada,
  };
}

/**
 * Motor de Avaliação da Mini-DSL de Tabelas
 */
export class TableEngine {
  private tabelas: Map<string, TabelaDSL> = new Map();

  constructor(tabelasIniciais?: TabelaDSL[]) {
    if (tabelasIniciais) {
      for (const t of tabelasIniciais) {
        this.registrarTabela(t);
      }
    }
  }

  public registrarTabela(tabela: TabelaDSL): void {
    this.tabelas.set(tabela.tabela, tabela);
  }

  public getTabela(nome: string): TabelaDSL | undefined {
    return this.tabelas.get(nome);
  }

  /**
   * Executa a seleção ponderada com tags, binds e avaliação recursiva (§2.2)
   */
  public selectWeighted(
    nomeTabela: string,
    rng: DeterministicRNG,
    contexto: ContextoGeracao = {},
    depth = 0
  ): ResultadoSorteio {
    const tabela = this.tabelas.get(nomeTabela);
    if (!tabela) {
      throw new Error(`Tabela não encontrada: ${nomeTabela}`);
    }

    const maxDepth = tabela.max_depth ?? 3;
    if (depth > maxDepth) {
      throw new Error(
        `Recursão máxima excedida (${maxDepth}) na tabela "${nomeTabela}". Loop circular detectado!`
      );
    }

    // 1. Filtragem por tags e exclusão
    let candidatas = tabela.entradas.filter((e) => {
      if (!e.tags || e.tags.length === 0) return true;

      // Se contexto tiver restrições de tags
      for (const tag of e.tags) {
        // Tag de nível mínimo: ex: 'nível>=5'
        if (tag.startsWith('nível>=')) {
          const minNivel = parseInt(tag.split('>=')[1], 10);
          if (contexto.nivel_party !== undefined && contexto.nivel_party < minNivel) {
            return false;
          }
        }
        // Tag negativa: ex: '!rural'
        if (tag.startsWith('!')) {
          const neg = tag.slice(1);
          if (contexto[neg] || contexto.tags?.includes(neg)) {
            return false;
          }
        }
      }
      return true;
    });

    if (candidatas.length === 0) {
      // Fallback para todas se filtro for muito estrito
      candidatas = tabela.entradas;
    }

    // 2. Modificação dinâmica de pesos por contexto
    const pesosModificados = candidatas.map((e) => {
      let peso = e.peso;
      if (e.peso_bonus) {
        for (const [cond, bonus] of Object.entries(e.peso_bonus)) {
          if (contexto[cond] || (contexto.tags && contexto.tags.includes(cond))) {
            peso += bonus;
          }
        }
      }
      return Math.max(1, peso);
    });

    // 3. Sorteio ponderado
    const somaPesos = pesosModificados.reduce((a, b) => a + b, 0);
    const alvo = rng.next() * somaPesos;
    let acumulado = 0;
    let escolhidaIdx = 0;

    for (let i = 0; i < candidatas.length; i++) {
      acumulado += pesosModificados[i];
      if (alvo <= acumulado) {
        escolhidaIdx = i;
        break;
      }
    }

    const escolhida = candidatas[escolhidaIdx];
    const bindsLocais: Record<string, any> = { ...contexto };

    // Registra bind se configurado
    if (escolhida.bind) {
      bindsLocais[escolhida.bind] = escolhida.texto;
      contexto[escolhida.bind] = escolhida.texto;
    }

    // 4. Resolve sub-tabelas recursivas indicadas por {{tabela:nome}}
    let textoProcessado = escolhida.texto;
    const subMatch = textoProcessado.match(/\{\{tabela:([a-zA-Z0-9_]+)\}\}/g);
    if (subMatch) {
      for (const match of subMatch) {
        const subNome = match.replace('{{tabela:', '').replace('}}', '');
        const subResult = this.selectWeighted(subNome, rng, bindsLocais, depth + 1);
        textoProcessado = textoProcessado.replace(match, subResult.texto);
      }
    }

    // 5. Aplica compositor gramatical PT-BR
    const textoFinal = comporTextoPT(textoProcessado, bindsLocais);

    return {
      texto: textoFinal,
      entrada: escolhida,
      binds: bindsLocais,
    };
  }

  /**
   * Seleciona N itens distintos sem reposição (SelectUnique / amostra_sem_reposicao)
   */
  public selectUnique(
    nomeTabela: string,
    quantidade: number,
    rng: DeterministicRNG,
    contexto: ContextoGeracao = {}
  ): ResultadoSorteio[] {
    const tabela = this.tabelas.get(nomeTabela);
    if (!tabela) {
      throw new Error(`Tabela não encontrada: ${nomeTabela}`);
    }

    const pool = [...tabela.entradas];
    const resultados: ResultadoSorteio[] = [];
    const binds = { ...contexto };

    const qtd = Math.min(quantidade, pool.length);
    for (let k = 0; k < qtd; k++) {
      if (pool.length === 0) break;
      const idx = rng.nextInt(0, pool.length - 1);
      const escolhida = pool.splice(idx, 1)[0];

      if (escolhida.bind) {
        binds[escolhida.bind] = escolhida.texto;
      }

      const textoFinal = comporTextoPT(escolhida.texto, binds);
      resultados.push({
        texto: textoFinal,
        entrada: escolhida,
        binds: { ...binds },
      });
    }

    return resultados;
  }
}
