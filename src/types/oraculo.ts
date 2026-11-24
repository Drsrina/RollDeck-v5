export type EstacaoAno = 'Primavera' | 'Verão' | 'Outono' | 'Inverno';

export type StatusConstrucao = 'planejada' | 'em_obras' | 'concluida';

export interface RecursosCidade {
  viveres: number;
  ouro: number;
  madeira: number;
  pedra: number;
  minerio: number;
}

export interface ConstrucaoCidade {
  id: string;
  nome: string;
  custo: Partial<RecursosCidade>;
  efeito: string;
  status: StatusConstrucao;
  diasTotais: number;
  diasRestantes: number;
}

export interface RotaComercial {
  id: string;
  origem: string;
  destino: string;
  produto: string;
  frequencia: 'semanal' | 'quinzenal' | 'mensal';
  lucroEstimadoOuro: number;
  ativa: boolean;
}

export interface CidadeEstado {
  nome: string;
  populacao: number;
  recursos: RecursosCidade;
  estabilidade: number; // 0 - 100
  moral: number;        // 0 - 100
  defesa: number;       // 0 - 100
  industria: number;    // Nível 0 - 5
  estacao: EstacaoAno;
  dia: number;
  construcoes: ConstrucaoCidade[];
  rotas: RotaComercial[];
}

export type TipoLogEntry =
  | 'oraculo'
  | 'tabela'
  | 'turno_micro'
  | 'turno_semanal'
  | 'turno_mensal'
  | 'producao'
  | 'manual';

export interface LogEntry {
  id: string;
  dia: number;
  estacao: EstacaoAno;
  fase: 'micro' | 'semanal' | 'mensal' | 'avulso';
  tipo: TipoLogEntry;
  titulo: string;
  texto: string;
  detalhes?: Record<string, any>;
  deltaRecursos?: Partial<RecursosCidade> & { populacao?: number; moral?: number; estabilidade?: number };
  seedUsada: string;
  timestamp: number;
}

export interface RelatorioTurno {
  diasAvancados: number;
  diaAtual: number;
  estacaoAtual: EstacaoAno;
  fasesDisparadas: ('micro' | 'semanal' | 'mensal')[];
  resumoTexto: string;
  deltaRecursos: Partial<RecursosCidade> & { populacao?: number; moral?: number; estabilidade?: number };
  obrasConcluidas: string[];
  eventosOcorridos: string[];
}
