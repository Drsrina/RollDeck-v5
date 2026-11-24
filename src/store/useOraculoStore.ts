import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TabelaRolavel } from '../data';
import { REGRAS_TURNOS } from '../data';
import {
  consultarOraculo,
  type OraculoResultado,
  type ProbabilidadeKey,
} from '../lib/oraculoEngine';
import {
  createMulberry32,
  consultarTabela,
  roll1d100,
  stringToSeed,
} from '../lib/prng';
import { avancarDiasTurno } from '../lib/turnosEngine';
import type {
  CidadeEstado,
  ConstrucaoCidade,
  LogEntry,
  RecursosCidade,
  RelatorioTurno,
  RotaComercial,
} from '../types/oraculo';

interface ResultadoTabelaRecente {
  tabelaId: string;
  tabelaNome: string;
  dado: string;
  roll: number;
  resultadoTexto: string;
  timestamp: number;
}

interface OraculoState {
  seed: string;
  rngCounter: number;
  cidade: CidadeEstado;
  logs: LogEntry[];
  filtroTipo: string;
  filtroBusca: string;
  ultimoResultadoOraculo: OraculoResultado | null;
  ultimoResultadoTabela: ResultadoTabelaRecente | null;
  ultimoRelatorioTurno: RelatorioTurno | null;
  microEventoDisponivel: boolean;

  // Ações de Configuração e RNG
  setSeed: (seed: string) => void;
  setFiltroTipo: (tipo: string) => void;
  setFiltroBusca: (busca: string) => void;
  limparUltimoRelatorio: () => void;

  // Ações da Cidade
  atualizarNomeCidade: (nome: string) => void;
  atualizarRecurso: (recurso: keyof RecursosCidade, delta: number, motivo?: string) => void;
  atualizarAtributo: (
    atributo: 'populacao' | 'estabilidade' | 'moral' | 'defesa' | 'industria',
    delta: number,
    motivo?: string
  ) => void;
  adicionarConstrucao: (
    nome: string,
    custo: Partial<RecursosCidade>,
    efeito: string,
    diasTotais: number,
    iniciarImediato?: boolean
  ) => void;
  iniciarObra: (id: string) => void;
  concluirObra: (id: string) => void;
  removerConstrucao: (id: string) => void;
  adicionarRota: (
    origem: string,
    destino: string,
    produto: string,
    frequencia: 'semanal' | 'quinzenal' | 'mensal',
    lucro: number
  ) => void;
  removerRota: (id: string) => void;
  alternarStatusRota: (id: string) => void;
  carregarCidadeModelo: () => void;
  zerarCidade: () => void;

  // Ações de Rolagem
  rolarOraculo: (pergunta: string, probabilidade: ProbabilidadeKey, modificador: number) => OraculoResultado;
  rolarTabela: (tabela: TabelaRolavel, fixarNoDiario?: boolean) => { roll: number; texto: string };
  fixarResultadoTabelaNoLog: (resultado: ResultadoTabelaRecente) => void;
  adicionarEntradaManualDiario: (titulo: string, texto: string) => void;

  // Ações de Turno
  avancarDias: (dias: number) => RelatorioTurno;
  avancarAteProximoMarco: () => RelatorioTurno;

  // Persistência e Backup
  exportarEstadoJSON: () => string;
  importarEstadoJSON: (jsonStr: string) => boolean;
  resetarCampanha: (novaSeed?: string) => void;
  resetarApenasLog: () => void;
}

const CIDADE_INICIAL_ZERADA: CidadeEstado = {
  nome: 'Minha Cidade',
  populacao: 0,
  recursos: {
    viveres: 0,
    ouro: 0,
    madeira: 0,
    pedra: 0,
    minerio: 0,
  },
  estabilidade: 50,
  moral: 50,
  defesa: 10,
  industria: 0,
  estacao: 'Primavera',
  dia: 1,
  construcoes: [],
  rotas: [],
};

const CIDADE_MODELO_EXEMPLO: CidadeEstado = {
  nome: 'Valesplendor',
  populacao: 120,
  recursos: {
    viveres: 60,
    ouro: 80,
    madeira: 40,
    pedra: 30,
    minerio: 15,
  },
  estabilidade: 65,
  moral: 70,
  defesa: 25,
  industria: 1,
  estacao: 'Primavera',
  dia: 1,
  construcoes: [
    {
      id: 'const-moinho-inicial',
      nome: 'Moinho de Vento Comunal',
      custo: { madeira: 15, pedra: 10, ouro: 20 },
      efeito: '+15 Víveres em cada fase semanal',
      status: 'concluida',
      diasTotais: 14,
      diasRestantes: 0,
    },
    {
      id: 'const-palicada-inicial',
      nome: 'Paliçada de Madeira',
      custo: { madeira: 25, pedra: 5, ouro: 15 },
      efeito: '+1 Defesa e +5 Estabilidade contra invasões',
      status: 'em_obras',
      diasTotais: 7,
      diasRestantes: 3,
    },
  ],
  rotas: [
    {
      id: 'rota-capital',
      origem: 'Valesplendor',
      destino: 'Porto Real',
      produto: 'Lã & Grãos',
      frequencia: 'semanal',
      lucroEstimadoOuro: 12,
      ativa: true,
    },
  ],
};

export const useOraculoStore = create<OraculoState>()(
  persist(
    (set, get) => ({
      seed: 'terratenentes_seed_42',
      rngCounter: 0,
      cidade: CIDADE_INICIAL_ZERADA,
      logs: [],
      filtroTipo: 'todos',
      filtroBusca: '',
      ultimoResultadoOraculo: null,
      ultimoResultadoTabela: null,
      ultimoRelatorioTurno: null,
      microEventoDisponivel: false,

      setSeed: (seed: string) => {
        set({ seed, rngCounter: 0 });
      },

      setFiltroTipo: (tipo: string) => set({ filtroTipo: tipo }),
      setFiltroBusca: (busca: string) => set({ filtroBusca: busca }),
      limparUltimoRelatorio: () => set({ ultimoRelatorioTurno: null }),

      atualizarNomeCidade: (nome: string) => {
        set((state) => ({ cidade: { ...state.cidade, nome } }));
      },

      atualizarRecurso: (recurso, delta, motivo) => {
        const { cidade, seed, rngCounter } = get();
        const valorAtual = cidade.recursos[recurso];
        const novoValor = Math.max(0, valorAtual + delta);
        const novoEstado: CidadeEstado = {
          ...cidade,
          recursos: {
            ...cidade.recursos,
            [recurso]: novoValor,
          },
        };

        const sinal = delta > 0 ? `+${delta}` : `${delta}`;
        const logEntry: LogEntry = {
          id: `recurso-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dia: cidade.dia,
          estacao: cidade.estacao,
          fase: 'avulso',
          tipo: 'manual',
          titulo: `Ajuste de Recurso: ${recurso.toUpperCase()} (${sinal})`,
          texto: motivo
            ? `${motivo} (${valorAtual} ➔ ${novoValor})`
            : `Alteração manual: ${sinal} ${recurso} (${valorAtual} ➔ ${novoValor})`,
          deltaRecursos: { [recurso]: delta },
          seedUsada: `${seed}#${rngCounter}`,
          timestamp: Date.now(),
        };

        set((state) => ({
          cidade: novoEstado,
          logs: [logEntry, ...state.logs],
        }));
      },

      atualizarAtributo: (atributo, delta, motivo) => {
        const { cidade, seed, rngCounter } = get();
        const valorAtual = cidade[atributo];
        const maxVal = atributo === 'industria' ? 5 : 100;
        const novoValor = Math.min(maxVal, Math.max(0, valorAtual + delta));

        const novoEstado: CidadeEstado = {
          ...cidade,
          [atributo]: novoValor,
        };

        const sinal = delta > 0 ? `+${delta}` : `${delta}`;
        const logEntry: LogEntry = {
          id: `attr-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dia: cidade.dia,
          estacao: cidade.estacao,
          fase: 'avulso',
          tipo: 'manual',
          titulo: `Ajuste de ${atributo.toUpperCase()} (${sinal})`,
          texto: motivo
            ? `${motivo} (${valorAtual} ➔ ${novoValor})`
            : `Alteração manual em ${atributo}: ${sinal} (${valorAtual} ➔ ${novoValor})`,
          deltaRecursos: { [atributo]: delta },
          seedUsada: `${seed}#${rngCounter}`,
          timestamp: Date.now(),
        };

        set((state) => ({
          cidade: novoEstado,
          logs: [logEntry, ...state.logs],
        }));
      },

      adicionarConstrucao: (nome, custo, efeito, diasTotais, iniciarImediato = false) => {
        const novaConstrucao: ConstrucaoCidade = {
          id: `const-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          nome,
          custo,
          efeito,
          status: iniciarImediato ? 'em_obras' : 'planejada',
          diasTotais,
          diasRestantes: diasTotais,
        };

        set((state) => ({
          cidade: {
            ...state.cidade,
            construcoes: [...state.cidade.construcoes, novaConstrucao],
          },
        }));
      },

      iniciarObra: (id) => {
        set((state) => ({
          cidade: {
            ...state.cidade,
            construcoes: state.cidade.construcoes.map((c) =>
              c.id === id ? { ...c, status: 'em_obras' } : c
            ),
          },
        }));
      },

      concluirObra: (id) => {
        set((state) => ({
          cidade: {
            ...state.cidade,
            construcoes: state.cidade.construcoes.map((c) =>
              c.id === id ? { ...c, status: 'concluida', diasRestantes: 0 } : c
            ),
          },
        }));
      },

      removerConstrucao: (id) => {
        set((state) => ({
          cidade: {
            ...state.cidade,
            construcoes: state.cidade.construcoes.filter((c) => c.id !== id),
          },
        }));
      },

      adicionarRota: (origem, destino, produto, frequencia, lucro) => {
        const novaRota: RotaComercial = {
          id: `rota-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          origem,
          destino,
          produto,
          frequencia,
          lucroEstimadoOuro: lucro,
          ativa: true,
        };

        set((state) => ({
          cidade: {
            ...state.cidade,
            rotas: [...state.cidade.rotas, novaRota],
          },
        }));
      },

      removerRota: (id) => {
        set((state) => ({
          cidade: {
            ...state.cidade,
            rotas: state.cidade.rotas.filter((r) => r.id !== id),
          },
        }));
      },

      alternarStatusRota: (id) => {
        set((state) => ({
          cidade: {
            ...state.cidade,
            rotas: state.cidade.rotas.map((r) =>
              r.id === id ? { ...r, ativa: !r.ativa } : r
            ),
          },
        }));
      },

      carregarCidadeModelo: () => {
        set({
          cidade: JSON.parse(JSON.stringify(CIDADE_MODELO_EXEMPLO)),
        });
      },

      zerarCidade: () => {
        set({
          cidade: JSON.parse(JSON.stringify(CIDADE_INICIAL_ZERADA)),
        });
      },

      rolarOraculo: (pergunta, probabilidade, modificador) => {
        const { seed, rngCounter, cidade } = get();
        const seedValue = stringToSeed(`${seed}_oraculo_${rngCounter}`);
        const prng = createMulberry32(seedValue);

        const resultado = consultarOraculo(pergunta, probabilidade, modificador, prng);

        const modTexto = modificador !== 0 ? ` (Mod: ${modificador > 0 ? '+' : ''}${modificador}%)` : '';
        const duploTexto = resultado.isDuplo
          ? ` 💥 DADOS DUPLOS (${resultado.dadoRolado})! EVENTO DISPARADO: ${resultado.eventoDuplo?.fraseCompleta}`
          : '';

        const logEntry: LogEntry = {
          id: `oraculo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dia: cidade.dia,
          estacao: cidade.estacao,
          fase: 'avulso',
          tipo: 'oraculo',
          titulo: `Oráculo: "${pergunta}"`,
          texto: `Probabilidade: ${resultado.probabilidade} (Limiar ${resultado.limiarFinal}%${modTexto}) · Rolagem: 1d100 = ${resultado.dadoRolado} ➔ [${resultado.grau}]${duploTexto}`,
          detalhes: resultado as any,
          seedUsada: `${seed}#${rngCounter}`,
          timestamp: Date.now(),
        };

        set((state) => ({
          rngCounter: state.rngCounter + 4,
          ultimoResultadoOraculo: resultado,
          logs: [logEntry, ...state.logs],
        }));

        return resultado;
      },

      rolarTabela: (tabela, fixarNoDiario = false) => {
        const { seed, rngCounter, cidade } = get();
        const seedValue = stringToSeed(`${seed}_tabela_${tabela.id}_${rngCounter}`);
        const prng = createMulberry32(seedValue);

        const roll = roll1d100(prng);
        const texto = consultarTabela(tabela, roll);

        const resultadoRecente: ResultadoTabelaRecente = {
          tabelaId: tabela.id,
          tabelaNome: tabela.nome,
          dado: tabela.dado,
          roll,
          resultadoTexto: texto,
          timestamp: Date.now(),
        };

        let novosLogs = get().logs;
        if (fixarNoDiario) {
          const logEntry: LogEntry = {
            id: `tabela-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            dia: cidade.dia,
            estacao: cidade.estacao,
            fase: 'avulso',
            tipo: 'tabela',
            titulo: `${tabela.nome} (${tabela.dado} = ${roll})`,
            texto,
            seedUsada: `${seed}#${rngCounter}`,
            timestamp: Date.now(),
          };
          novosLogs = [logEntry, ...novosLogs];
        }

        set((state) => ({
          rngCounter: state.rngCounter + 1,
          ultimoResultadoTabela: resultadoRecente,
          logs: novosLogs,
        }));

        return { roll, texto };
      },

      fixarResultadoTabelaNoLog: (resultado) => {
        const { cidade, seed, rngCounter } = get();
        const logEntry: LogEntry = {
          id: `tabela-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dia: cidade.dia,
          estacao: cidade.estacao,
          fase: 'avulso',
          tipo: 'tabela',
          titulo: `${resultado.tabelaNome} (${resultado.dado} = ${resultado.roll})`,
          texto: resultado.resultadoTexto,
          seedUsada: `${seed}#${rngCounter}`,
          timestamp: Date.now(),
        };

        set((state) => ({
          logs: [logEntry, ...state.logs],
        }));
      },

      adicionarEntradaManualDiario: (titulo, texto) => {
        const { cidade, seed, rngCounter } = get();
        const logEntry: LogEntry = {
          id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dia: cidade.dia,
          estacao: cidade.estacao,
          fase: 'avulso',
          tipo: 'manual',
          titulo,
          texto,
          seedUsada: `${seed}#${rngCounter}`,
          timestamp: Date.now(),
        };

        set((state) => ({
          logs: [logEntry, ...state.logs],
        }));
      },

      avancarDias: (dias) => {
        const { cidade, seed, rngCounter, logs } = get();
        const seedValue = stringToSeed(`${seed}_turnos_${cidade.dia}_${rngCounter}`);
        const prng = createMulberry32(seedValue);

        const { novaCidade, relatorio, novosLogs } = avancarDiasTurno(
          cidade,
          dias,
          prng,
          `${seed}#${rngCounter}`
        );

        set({
          cidade: novaCidade,
          rngCounter: rngCounter + dias + 2,
          logs: [...novosLogs, ...logs],
          ultimoRelatorioTurno: relatorio,
          microEventoDisponivel: relatorio.fasesDisparadas.includes('micro'),
        });

        return relatorio;
      },

      avancarAteProximoMarco: () => {
        const { cidade } = get();
        // Próximo marco é o mais próximo entre dia % 7 === 0 ou dia % 30 === 0
        const diasAteSemanal = 7 - (cidade.dia % 7);
        const diasAteMensal = 30 - (cidade.dia % 30);
        const dias = Math.min(diasAteSemanal, diasAteMensal);
        return get().avancarDias(dias);
      },

      exportarEstadoJSON: () => {
        const state = get();
        const backup = {
          app: 'OraculoDosTerratenentes',
          versao: '1.0.0',
          dataExportacao: new Date().toISOString(),
          seed: state.seed,
          cidade: state.cidade,
          logs: state.logs,
        };
        return JSON.stringify(backup, null, 2);
      },

      importarEstadoJSON: (jsonStr) => {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed && parsed.cidade) {
            set({
              seed: parsed.seed || 'terratenentes_imported',
              cidade: parsed.cidade,
              logs: Array.isArray(parsed.logs) ? parsed.logs : [],
              rngCounter: 0,
              ultimoRelatorioTurno: null,
            });
            return true;
          }
          return false;
        } catch (e) {
          console.error('Erro ao importar JSON:', e);
          return false;
        }
      },

      resetarCampanha: (novaSeed) => {
        const nextSeed = novaSeed || `seed_${Date.now()}`;
        set({
          seed: nextSeed,
          rngCounter: 0,
          cidade: JSON.parse(JSON.stringify(CIDADE_INICIAL_ZERADA)),
          logs: [],
          ultimoResultadoOraculo: null,
          ultimoResultadoTabela: null,
          ultimoRelatorioTurno: null,
        });
      },

      resetarApenasLog: () => {
        set({ logs: [] });
      },
    }),
    {
      name: 'oraculo_terratenentes_state',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
