/**
 * FORJA DE MUNDOS — Gerador Determinístico de Encontros de Fantasia (D&D 5.5 / D&D 5e / Fantasia d20)
 *
 * Suporta três conjuntos de regras oficiais/clássicos:
 * 1. D&D 5.5 (2024): Orçamento de XP revisado (DMG 2024) sem multiplicador de horda,
 *    3 faixas de dificuldade (Baixa, Moderada, Alta), limiar de Sangrando (50% PV),
 *    iniciativa fixa + modificador, papéis táticos e tipos revisados (ex.: goblinoides Fada).
 * 2. D&D 5e (2014): Orçamento clássico (Fácil, Médio, Difícil, Mortal) com multiplicador
 *    por quantidade de criaturas e tamanho do grupo.
 * 3. Fantasia d20 (Clássico / OSR): Escala por Dados de Vida (DV) e ND, rolagem de Reação (2d6),
 *    teste de Moral (2d6), distância inicial por visibilidade do bioma e verificação de surpresa.
 */

import { DeterministicRNG, deriveSubSeed } from './prng';
import { DificuldadeEncontro } from './dungeonGenerator';
import { gerarItem, ItemGerado, RaridadeItem, CategoriaItem } from './itemGenerator';

export type SistemaEncontro = 'dnd55' | 'dnd5e' | 'd20_fantasia';

export type Dificuldade55 = 'baixa' | 'moderada' | 'alta';
export type DificuldadeEncontroFlex = DificuldadeEncontro | Dificuldade55;

export type FocoEncontro = 'combate' | 'misto' | 'exploracao';

export type PapelTatico =
  | 'Bruto'
  | 'Escaramuçador'
  | 'Atirador'
  | 'Conjurador'
  | 'Controlador'
  | 'Chefe';

export type BiomaEncontro =
  | 'floresta'
  | 'masmorra'
  | 'montanha'
  | 'pantano'
  | 'planicie'
  | 'deserto'
  | 'costa'
  | 'urbano';

export const SISTEMAS_ENCONTRO: {
  id: SistemaEncontro;
  label: string;
  curto: string;
  descricao: string;
}[] = [
  {
    id: 'dnd55',
    label: 'D&D 5.5 (2024)',
    curto: 'D&D 5.5',
    descricao: 'Orçamento de XP 2024 sem multiplicador de horda, dificuldades Baixa/Moderada/Alta, Sangrando (50% PV) e iniciativa fixa.',
  },
  {
    id: 'dnd5e',
    label: 'D&D 5e (2014)',
    curto: 'D&D 5e',
    descricao: 'Regras clássicas de 2014 com 4 dificuldades (Fácil a Mortal) e multiplicador por quantidade de monstros.',
  },
  {
    id: 'd20_fantasia',
    label: 'Fantasia d20 (Clássico / OSR)',
    curto: 'Fantasia d20',
    descricao: 'Equilíbrio por Dados de Vida (DV) e ND com teste de Reação (2d6), Moral (2d6), surpresa e distância de encontro.',
  },
];

export const BIOMAS_ENCONTRO: { id: BiomaEncontro; label: string }[] = [
  { id: 'floresta', label: 'Floresta & Bosques' },
  { id: 'masmorra', label: 'Masmorras & Subterrâneo' },
  { id: 'montanha', label: 'Montanhas & Picos' },
  { id: 'pantano', label: 'Pântanos & Ruínas' },
  { id: 'planicie', label: 'Estradas & Planícies' },
  { id: 'deserto', label: 'Deserto & Terras Áridas' },
  { id: 'costa', label: 'Costa & Marinho' },
  { id: 'urbano', label: 'Urbano & Submundo' },
];

/**
 * Mapeia o nome de bioma retornado pelo gerador de Terreno para um BiomaEncontro compatível.
 */
export function mapearBiomaTerrenoParaEncontro(biomaTerreno?: string): BiomaEncontro {
  if (!biomaTerreno) return 'floresta';
  const norm = biomaTerreno.toLowerCase();
  if (norm.includes('floresta') || norm.includes('selva') || norm.includes('taiga')) return 'floresta';
  if (norm.includes('montanha') || norm.includes('pico') || norm.includes('colina')) return 'montanha';
  if (norm.includes('pântano') || norm.includes('pantano') || norm.includes('brejo')) return 'pantano';
  if (norm.includes('deserto') || norm.includes('árido')) return 'deserto';
  if (norm.includes('costa') || norm.includes('oceano') || norm.includes('lago')) return 'costa';
  if (norm.includes('urbano') || norm.includes('cidade') || norm.includes('vila')) return 'urbano';
  if (norm.includes('masmorra') || norm.includes('caverna')) return 'masmorra';
  return 'planicie';
}

export interface AtaqueMonstro {
  nome: string;
  acerto: number;
  dadosDano: string; // Ex: "1d8+3"
  danoMedio: number;
  tipoDano: string;
  alcance?: string;
  efeito55?: string; // Rider automático padrão D&D 5.5 (2024)
}

export interface MagiaOuHabilidade {
  nome: string;
  tipo: 'habilidade' | 'magia';
  circulo?: string;
  cd?: number;
  descricao: string;
}

export interface CriaturaTemplate {
  id: string;
  nome: string;
  tipoTamanho: string;
  tipo55?: string; // Atualização de tipo no Monster Manual 2024 (ex.: Goblinóide = Fada)
  papelTatico: PapelTatico;
  cr: string;
  crNum: number;
  dv: number; // Dados de Vida (HD) para Fantasia d20 / OSR
  moralD20: number; // Índice de Moral 2d6 (5 a 12)
  xp: number;
  ca: number;
  pvMedio: number;
  formulaPv: string;
  deslocamento: string;
  iniciativaMod: number;
  iniciativaMod55?: number; // Proficiência / Especialização em iniciativa (MM 2024)
  efeitoSangrando?: string; // Gatilho especial em 50% PV (D&D 5.5)
  biomas: BiomaEncontro[];
  ataques: AtaqueMonstro[];
  habilidadesEMagias: MagiaOuHabilidade[];
}

export interface MonstroEncontro extends CriaturaTemplate {
  quantidade: number;
  xpTotal: number;
  pvSangrando: number;
  iniciativaAtiva: number;
  iniciativaFixa55: number;
  tipoExibicao: string;
}

export interface LootEncontro {
  seedLoot: number;
  moedas: {
    po: number;
    pp: number;
    pc: number;
    valorTotalPO: number;
  };
  itens: ItemGerado[];
}

export interface ReacaoD20 {
  dados: [number, number];
  total: number;
  categoria: 'Hostil' | 'Desconfiado' | 'Incerto' | 'Curioso' | 'Amigável';
  descricao: string;
}

export interface DetalhesD20 {
  distanciaMetros: number;
  surpresa: string;
  dvTotalInimigos: number;
  reacaoInicial: ReacaoD20;
}

export interface CenaNaoCombate {
  tipo: 'Social' | 'Exploração' | 'Perigo Ambiental' | 'Mistério';
  protagonistaOuFoco: string;
  situacao: string;
  testesSugeridos: { pericia: string; cd: number; sucesso: string }[];
  consequenciaFalha: string;
  recompensaNarrativa: string;
}

export interface EncontroGerado {
  id: string;
  seed: number;
  sistema: SistemaEncontro;
  sistemaLabel: string;
  foco: FocoEncontro;
  titulo: string;
  bioma: BiomaEncontro;
  biomaLabel: string;
  nivelGrupo: number;
  tamanhoGrupo: number;
  dificuldadeAlvo: DificuldadeEncontroFlex;
  dificuldadeReal: DificuldadeEncontroFlex;
  dificuldadeLabel: string;
  orcamentoXpAlvo: number;
  xpBaseTotal: number;
  multiplicadorGrupo: number;
  xpAjustadoTotal: number;
  xpPorJogador: number;
  usaMultiplicadorXp: boolean;
  ambientacaoTatica: string;
  motivacaoInimigos: string;
  resolucaoAlternativa: string;
  detalhesD20: DetalhesD20;
  cenaNaoCombate?: CenaNaoCombate;
  monstros: MonstroEncontro[];
  loot: LootEncontro;
}

export interface ResultadoRolagemAtaque {
  criaturaNome: string;
  ataqueNome: string;
  d20Raw: number;
  bonusAcerto: number;
  totalAcerto: number;
  isCritico: boolean;
  isFalhaCritica: boolean;
  dadosDanoExpressao: string;
  dadosRolados: number[];
  bonusDano: number;
  totalDano: number;
  tipoDano: string;
  efeitoExtra?: string;
  timestamp: string;
}

export interface ResultadoTesteMoral {
  criaturaNome: string;
  dados: [number, number];
  total: number;
  moralAlvo: number;
  passou: boolean;
  desfecho: string;
  timestamp: string;
}

// Tabela oficial de orçamento de XP por personagem — D&D 5e (2014 SRD)
export const XP_POR_NIVEL_5E: Record<DificuldadeEncontro, number[]> = {
  facil:   [0, 25, 50, 75, 125, 250, 300, 350, 450, 550, 600, 800, 1000, 1100, 1250, 1400, 1600, 2000, 2100, 2400, 2800],
  medio:   [0, 50, 100, 150, 250, 500, 600, 750, 900, 1100, 1200, 1600, 2000, 2200, 2500, 2800, 3200, 3900, 4200, 4900, 5700],
  dificil: [0, 75, 150, 225, 375, 750, 900, 1100, 1400, 1600, 1900, 2400, 3000, 3400, 3800, 4300, 4800, 5900, 6300, 7300, 8500],
  mortal:  [0, 100, 200, 400, 500, 1100, 1400, 1700, 2100, 2400, 2800, 3600, 4500, 5100, 5700, 6400, 7200, 8800, 9500, 10900, 12700],
};

// Tabela oficial de orçamento de XP por personagem — D&D 5.5 (DMG 2024 — sem multiplicador de horda)
export const XP_POR_NIVEL_55: Record<Dificuldade55, number[]> = {
  baixa:    [0, 50, 100, 150, 250, 500, 600, 750, 1000, 1300, 1600, 1900, 2200, 2600, 2900, 3300, 3800, 4500, 5000, 5500, 6400],
  moderada: [0, 75, 150, 225, 375, 750, 1000, 1300, 1700, 2000, 2300, 2900, 3700, 4200, 4900, 5400, 6100, 7200, 8700, 10700, 13200],
  alta:     [0, 100, 200, 400, 500, 1100, 1400, 1700, 2100, 2600, 3100, 4100, 4700, 5400, 6200, 7800, 9800, 11700, 14200, 17200, 22000],
};

export function normalizarDificuldadeParaSistema(
  dificuldade: DificuldadeEncontroFlex,
  sistema: SistemaEncontro
): DificuldadeEncontroFlex {
  if (sistema === 'dnd55') {
    if (dificuldade === 'baixa' || dificuldade === 'moderada' || dificuldade === 'alta') return dificuldade;
    if (dificuldade === 'facil') return 'baixa';
    if (dificuldade === 'medio') return 'moderada';
    return 'alta';
  }
  if (dificuldade === 'facil' || dificuldade === 'medio' || dificuldade === 'dificil' || dificuldade === 'mortal') {
    return dificuldade;
  }
  if (dificuldade === 'baixa') return 'facil';
  if (dificuldade === 'moderada') return 'medio';
  return 'dificil';
}

export function obterLabelDificuldade(
  dificuldade: DificuldadeEncontroFlex,
  sistema: SistemaEncontro
): string {
  if (sistema === 'dnd55') {
    if (dificuldade === 'baixa' || dificuldade === 'facil') return 'Baixa (5.5)';
    if (dificuldade === 'moderada' || dificuldade === 'medio') return 'Moderada (5.5)';
    return 'Alta (5.5)';
  }
  if (sistema === 'd20_fantasia') {
    if (dificuldade === 'facil' || dificuldade === 'baixa') return 'Leve';
    if (dificuldade === 'medio' || dificuldade === 'moderada') return 'Padrão';
    if (dificuldade === 'dificil') return 'Perigoso';
    return 'Letal';
  }
  const map5e: Record<string, string> = {
    facil: 'Fácil',
    medio: 'Médio',
    dificil: 'Difícil',
    mortal: 'Mortal',
    baixa: 'Fácil',
    moderada: 'Médio',
    alta: 'Difícil',
  };
  return map5e[dificuldade] || 'Médio';
}

function obterMultiplicadorMonstros5e(qtdMonstros: number, tamanhoGrupo: number): number {
  const escalas = [1, 1.5, 2, 2.5, 3, 4];
  let idx = 0;
  if (qtdMonstros <= 1) idx = 0;
  else if (qtdMonstros === 2) idx = 1;
  else if (qtdMonstros <= 6) idx = 2;
  else if (qtdMonstros <= 10) idx = 3;
  else if (qtdMonstros <= 14) idx = 4;
  else idx = 5;

  if (tamanhoGrupo < 3 && idx < escalas.length - 1) idx += 1;
  else if (tamanhoGrupo >= 6 && idx > 0) idx -= 1;

  return escalas[idx];
}

// Bestiário estruturado multi-sistema (ND 1/8 até ND 20 — 38 criaturas cobrindo todos os biomas e patamares)
export const BESTIARIO_ENCONTROS: CriaturaTemplate[] = [
  {
    id: 'kobold_emboscador',
    nome: 'Kobold Emboscador',
    tipoTamanho: 'Humanoide Pequeno',
    tipo55: 'Dragão Pequeno (Kobold)',
    papelTatico: 'Escaramuçador',
    cr: '1/8',
    crNum: 0.125,
    dv: 2,
    moralD20: 6,
    xp: 25,
    ca: 12,
    pvMedio: 7,
    formulaPv: '2d6',
    deslocamento: '9m',
    iniciativaMod: 2,
    biomas: ['masmorra', 'montanha', 'floresta'],
    ataques: [
      { nome: 'Adaga Enferrujada', acerto: 4, dadosDano: '1d4+2', danoMedio: 4, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Funda de Couro', acerto: 4, dadosDano: '1d4+2', danoMedio: 4, tipoDano: 'concussão', alcance: '9/36m' },
    ],
    habilidadesEMagias: [
      { nome: 'Táticas de Matilha', tipo: 'habilidade', descricao: 'Vantagem nas jogadas de ataque contra criaturas adjacentes a outro aliado consciente.' },
      { nome: 'Sensibilidade à Luz Solar', tipo: 'habilidade', descricao: 'Desvantagem em ataques e Percepção visual sob luz solar direta.' },
    ],
  },
  {
    id: 'bandido_estrada',
    nome: 'Salteador da Estrada',
    tipoTamanho: 'Humanoide Médio',
    papelTatico: 'Escaramuçador',
    cr: '1/8',
    crNum: 0.125,
    dv: 2,
    moralD20: 7,
    xp: 25,
    ca: 12,
    pvMedio: 11,
    formulaPv: '2d8+2',
    deslocamento: '9m',
    iniciativaMod: 1,
    biomas: ['planicie', 'floresta', 'urbano', 'costa'],
    ataques: [
      { nome: 'Cimitarra', acerto: 3, dadosDano: '1d6+1', danoMedio: 4, tipoDano: 'cortante', alcance: '1,5m' },
      { nome: 'Besta Leve', acerto: 3, dadosDano: '1d8+1', danoMedio: 5, tipoDano: 'perfurante', alcance: '24/96m' },
    ],
    habilidadesEMagias: [
      { nome: 'Emboscada Oportunista', tipo: 'habilidade', descricao: '+1d6 de dano no primeiro turno contra alvos surpresos.' },
    ],
  },
  {
    id: 'caranguejo_gigante',
    nome: 'Caranguejo Encouraçado',
    tipoTamanho: 'Besta Média',
    papelTatico: 'Bruto',
    cr: '1/8',
    crNum: 0.125,
    dv: 3,
    moralD20: 8,
    xp: 25,
    ca: 15,
    pvMedio: 13,
    formulaPv: '3d8',
    deslocamento: '9m, Natação 9m',
    iniciativaMod: 2,
    biomas: ['costa', 'pantano'],
    ataques: [
      {
        nome: 'Garra Esmagadora',
        acerto: 3,
        dadosDano: '1d6+1',
        danoMedio: 4,
        tipoDano: 'concussão',
        alcance: '1,5m',
        efeito55: 'Alvo Médio ou menor fica Agarrado automaticamente (escapar CD 11).',
      },
    ],
    habilidadesEMagias: [
      { nome: 'Anfíbio', tipo: 'habilidade', descricao: 'Respira tanto ar quanto água; ao acertar com a garra, agarra a presa.' },
    ],
  },
  {
    id: 'goblin_espreitador',
    nome: 'Goblin Espreitador',
    tipoTamanho: 'Humanoide Pequeno',
    tipo55: 'Fada Pequena (Goblinóide)',
    papelTatico: 'Escaramuçador',
    cr: '1/4',
    crNum: 0.25,
    dv: 2,
    moralD20: 7,
    xp: 50,
    ca: 15,
    pvMedio: 10,
    formulaPv: '3d6',
    deslocamento: '9m',
    iniciativaMod: 2,
    biomas: ['floresta', 'masmorra', 'planicie', 'montanha'],
    ataques: [
      { nome: 'Cimitarra', acerto: 4, dadosDano: '1d6+2', danoMedio: 5, tipoDano: 'cortante', alcance: '1,5m' },
      { nome: 'Arco Curto', acerto: 4, dadosDano: '1d6+2', danoMedio: 5, tipoDano: 'perfurante', alcance: '24/96m' },
    ],
    habilidadesEMagias: [
      { nome: 'Escapada Ágil', tipo: 'habilidade', descricao: 'Pode usar Desengajar ou Esconder-se como ação bônus em todos os turnos.' },
    ],
  },
  {
    id: 'esqueleto_guerreiro',
    nome: 'Esqueleto da Cripta',
    tipoTamanho: 'Morto-vivo Médio',
    papelTatico: 'Atirador',
    cr: '1/4',
    crNum: 0.25,
    dv: 2,
    moralD20: 12,
    xp: 50,
    ca: 14,
    pvMedio: 13,
    formulaPv: '2d8+4',
    deslocamento: '9m',
    iniciativaMod: 3,
    biomas: ['masmorra', 'pantano', 'deserto'],
    ataques: [
      { nome: 'Espada Curta', acerto: 5, dadosDano: '1d6+3', danoMedio: 6, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Arco Curto', acerto: 5, dadosDano: '1d6+3', danoMedio: 6, tipoDano: 'perfurante', alcance: '24/96m' },
    ],
    habilidadesEMagias: [
      { nome: 'Imunidades de Morto-vivo', tipo: 'habilidade', descricao: 'Vulnerável a dano de concussão; imune a veneno e exaustão.' },
    ],
  },
  {
    id: 'lobo_cinzento',
    nome: 'Lobo Caçador',
    tipoTamanho: 'Besta Média',
    papelTatico: 'Escaramuçador',
    cr: '1/4',
    crNum: 0.25,
    dv: 2,
    moralD20: 7,
    xp: 50,
    ca: 13,
    pvMedio: 11,
    formulaPv: '2d8+2',
    deslocamento: '12m',
    iniciativaMod: 2,
    biomas: ['floresta', 'planicie', 'montanha'],
    ataques: [
      {
        nome: 'Mordida',
        acerto: 4,
        dadosDano: '2d4+2',
        danoMedio: 7,
        tipoDano: 'perfurante',
        alcance: '1,5m',
        efeito55: 'Alvo Médio ou menor cai Caído automaticamente ao sofrer o golpe.',
      },
    ],
    habilidadesEMagias: [
      { nome: 'Táticas de Matilha', tipo: 'habilidade', descricao: 'Vantagem em jogadas de ataque quando há outro lobo adjacente ao alvo.' },
      { nome: 'Faro Aguçado', tipo: 'habilidade', descricao: 'Vantagem em Percepção baseada em audição e olfato.' },
    ],
  },
  {
    id: 'acolito_sombrio',
    nome: 'Acólito do Culto',
    tipoTamanho: 'Humanoide Médio',
    papelTatico: 'Conjurador',
    cr: '1/4',
    crNum: 0.25,
    dv: 2,
    moralD20: 9,
    xp: 50,
    ca: 11,
    pvMedio: 9,
    formulaPv: '2d8',
    deslocamento: '9m',
    iniciativaMod: 0,
    biomas: ['urbano', 'masmorra', 'deserto', 'pantano'],
    ataques: [
      { nome: 'Maça Cerimonial', acerto: 2, dadosDano: '1d6', danoMedio: 3, tipoDano: 'concussão', alcance: '1,5m' },
      { nome: 'Chama Sagrada', acerto: 4, dadosDano: '1d8', danoMedio: 4, tipoDano: 'radiante', alcance: '18m' },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Divina (CD 12)', tipo: 'magia', circulo: '1º Círculo (3 espaços)', cd: 12, descricao: 'Magias: Bênção, Comando, Curar Ferimentos (1d8+2).' },
    ],
  },
  {
    id: 'orc_saqueador',
    nome: 'Orc Saqueador',
    tipoTamanho: 'Humanoide Médio',
    papelTatico: 'Bruto',
    cr: '1/2',
    crNum: 0.5,
    dv: 2,
    moralD20: 8,
    xp: 100,
    ca: 13,
    pvMedio: 15,
    formulaPv: '2d8+6',
    deslocamento: '9m',
    iniciativaMod: 1,
    biomas: ['montanha', 'planicie', 'floresta', 'masmorra'],
    ataques: [
      { nome: 'Machado Grande', acerto: 5, dadosDano: '1d12+3', danoMedio: 9, tipoDano: 'cortante', alcance: '1,5m' },
      { nome: 'Azagaia', acerto: 5, dadosDano: '1d6+3', danoMedio: 6, tipoDano: 'perfurante', alcance: '9/36m' },
    ],
    habilidadesEMagias: [
      { nome: 'Ímpeto Adrenalina', tipo: 'habilidade', descricao: 'Como ação bônus, usa Disparada em direção a um inimigo e ganha 3 PV temporários.' },
    ],
  },
  {
    id: 'gnoll_cacador',
    nome: 'Gnoll Carniceiro',
    tipoTamanho: 'Humanoide Médio',
    tipo55: 'Corruptor Médio (Gnoll)',
    papelTatico: 'Escaramuçador',
    cr: '1/2',
    crNum: 0.5,
    dv: 5,
    moralD20: 8,
    xp: 100,
    ca: 15,
    pvMedio: 22,
    formulaPv: '5d8',
    deslocamento: '9m',
    iniciativaMod: 1,
    biomas: ['deserto', 'planicie', 'pantano'],
    ataques: [
      { nome: 'Lança', acerto: 4, dadosDano: '1d6+2', danoMedio: 5, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Arco Longo', acerto: 3, dadosDano: '1d8+1', danoMedio: 5, tipoDano: 'perfurante', alcance: '45/180m' },
    ],
    habilidadesEMagias: [
      { nome: 'Frenesi Sangrento', tipo: 'habilidade', descricao: 'Quando reduz uma criatura a 0 PV ou a deixa Sangrando, move-se metade do deslocamento e morde (1d4+2).' },
    ],
  },
  {
    id: 'sahuagin_batedor',
    nome: 'Sahuagin Lanceiro',
    tipoTamanho: 'Humanoide Médio',
    tipo55: 'Corruptor Médio (Sahuagin)',
    papelTatico: 'Escaramuçador',
    cr: '1/2',
    crNum: 0.5,
    dv: 4,
    moralD20: 9,
    xp: 100,
    ca: 12,
    pvMedio: 22,
    formulaPv: '4d8+4',
    deslocamento: '9m, Natação 12m',
    iniciativaMod: 0,
    biomas: ['costa'],
    ataques: [
      { nome: 'Lança de Coral', acerto: 3, dadosDano: '1d8+1', danoMedio: 5, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Garras e Mordida', acerto: 3, dadosDano: '1d4+1', danoMedio: 3, tipoDano: 'cortante', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Frenesi de Sangue', tipo: 'habilidade', descricao: 'Vantagem nos ataques corpo a corpo contra qualquer criatura abaixo do PV máximo.' },
      { nome: 'Telepatia com Tubarões', tipo: 'habilidade', descricao: 'Comanda tubarões a até 36m.' },
    ],
  },
  {
    id: 'aranha_gigante',
    nome: 'Aranha Tecelã Gigante',
    tipoTamanho: 'Besta Grande',
    papelTatico: 'Controlador',
    cr: '1',
    crNum: 1,
    dv: 4,
    moralD20: 8,
    xp: 200,
    ca: 14,
    pvMedio: 26,
    formulaPv: '4d10+4',
    deslocamento: '9m, Escalada 9m',
    iniciativaMod: 3,
    biomas: ['floresta', 'masmorra', 'pantano'],
    ataques: [
      {
        nome: 'Mordida Peçonhenta',
        acerto: 5,
        dadosDano: '1d8+3',
        danoMedio: 7,
        tipoDano: 'perfurante (+2d6 veneno)',
        alcance: '1,5m',
        efeito55: 'Causa +2d6 de dano de veneno adicional (Con CD 11 reduz à metade).',
      },
      {
        nome: 'Teia Pegajosa (Recarga 5-6)',
        acerto: 5,
        dadosDano: '1d4',
        danoMedio: 2,
        tipoDano: 'contenção',
        alcance: '9/18m',
        efeito55: 'Alvo fica Contido automaticamente (Força CD 12 para romper).',
      },
    ],
    habilidadesEMagias: [
      { nome: 'Patas Aracnídeas', tipo: 'habilidade', descricao: 'Escala tetos e superfícies difíceis sem testes; ignora movimento difícil em teias.' },
    ],
  },
  {
    id: 'bugbear_emboscador',
    nome: 'Bugbear Emboscador',
    tipoTamanho: 'Humanoide Médio',
    tipo55: 'Fada Média (Goblinóide)',
    papelTatico: 'Bruto',
    cr: '1',
    crNum: 1,
    dv: 5,
    moralD20: 8,
    xp: 200,
    ca: 16,
    pvMedio: 33,
    formulaPv: '6d8+6',
    deslocamento: '9m',
    iniciativaMod: 2,
    biomas: ['floresta', 'masmorra', 'montanha'],
    ataques: [
      {
        nome: 'Maça Estrela Brutal',
        acerto: 5,
        dadosDano: '2d8+3',
        danoMedio: 12,
        tipoDano: 'perfurante',
        alcance: '3m (Alcance Longo)',
        efeito55: 'Pode agarrar o alvo atingido (CD 13 para escapar) e arrastá-lo.',
      },
      { nome: 'Azagaia', acerto: 5, dadosDano: '2d6+3', danoMedio: 10, tipoDano: 'perfurante', alcance: '9/36m' },
    ],
    habilidadesEMagias: [
      { nome: 'Sequestrador Furtivo', tipo: 'habilidade', descricao: '+2d6 de dano extra no primeiro turno contra alvos que ainda não agiram.' },
    ],
  },
  {
    id: 'carnical_devorador',
    nome: 'Carniçal Devorador',
    tipoTamanho: 'Morto-vivo Médio',
    papelTatico: 'Controlador',
    cr: '1',
    crNum: 1,
    dv: 5,
    moralD20: 12,
    xp: 200,
    ca: 12,
    pvMedio: 22,
    formulaPv: '5d8',
    deslocamento: '9m',
    iniciativaMod: 2,
    biomas: ['masmorra', 'pantano', 'urbano'],
    ataques: [
      {
        nome: 'Garras Paralisantes',
        acerto: 4,
        dadosDano: '2d4+2',
        danoMedio: 7,
        tipoDano: 'cortante',
        alcance: '1,5m',
        efeito55: 'Alvo faz Con CD 10 ou fica Paralisado até o fim do próximo turno.',
      },
      { nome: 'Mordida Séptica', acerto: 4, dadosDano: '2d6+2', danoMedio: 9, tipoDano: 'perfurante', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Toque Paralisante', tipo: 'habilidade', cd: 10, descricao: 'Alvos não-elfos atingidos pelas garras arriscam paralisia instantânea.' },
    ],
  },
  {
    id: 'espectro_ladino',
    nome: 'Espião da Guilda Sombria',
    tipoTamanho: 'Humanoide Médio',
    papelTatico: 'Escaramuçador',
    cr: '1',
    crNum: 1,
    dv: 6,
    moralD20: 8,
    xp: 200,
    ca: 14,
    pvMedio: 27,
    formulaPv: '6d8',
    deslocamento: '9m',
    iniciativaMod: 3,
    iniciativaMod55: 4,
    biomas: ['urbano', 'planicie', 'costa'],
    ataques: [
      { nome: 'Espada Curta Envenenada', acerto: 4, dadosDano: '1d6+2', danoMedio: 5, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Besta de Mão', acerto: 4, dadosDano: '1d6+2', danoMedio: 5, tipoDano: 'perfurante', alcance: '9/36m' },
    ],
    habilidadesEMagias: [
      { nome: 'Ataque Furtivo (2d6)', tipo: 'habilidade', descricao: '1x/turno causa +2d6 de dano extra se tiver vantagem ou aliado adjacente ao alvo.' },
      { nome: 'Ação Ardilosa', tipo: 'habilidade', descricao: 'Usa Disparada, Desengajar ou Esconder-se como ação bônus.' },
    ],
  },
  {
    id: 'harpia_costeira',
    nome: 'Harpia dos Penhascos',
    tipoTamanho: 'Monstruosidade Média',
    papelTatico: 'Controlador',
    cr: '1',
    crNum: 1,
    dv: 7,
    moralD20: 7,
    xp: 200,
    ca: 11,
    pvMedio: 38,
    formulaPv: '7d8+7',
    deslocamento: '6m, Voo 12m',
    iniciativaMod: 1,
    biomas: ['costa', 'montanha'],
    ataques: [
      { nome: 'Garras (Ataque Múltiplo)', acerto: 3, dadosDano: '2d4+1', danoMedio: 6, tipoDano: 'cortante', alcance: '1,5m' },
      { nome: 'Clava de Osso', acerto: 3, dadosDano: '1d4+1', danoMedio: 3, tipoDano: 'concussão', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Canção Atraente', tipo: 'magia', cd: 11, descricao: 'Humanoides a até 90m fazem Sabedoria CD 11 ou ficam Enfeitiçados, andando até a harpia.' },
    ],
  },
  {
    id: 'ogro_enfurecido',
    nome: 'Ogro das Colinas',
    tipoTamanho: 'Gigante Grande',
    papelTatico: 'Bruto',
    cr: '2',
    crNum: 2,
    dv: 7,
    moralD20: 8,
    xp: 450,
    ca: 11,
    pvMedio: 68,
    formulaPv: '8d10+24',
    deslocamento: '12m',
    iniciativaMod: -1,
    efeitoSangrando: 'Quando Sangrando (≤34 PV), ganha +2 em dano corpo a corpo em fúria cega.',
    biomas: ['montanha', 'floresta', 'pantano', 'planicie'],
    ataques: [
      {
        nome: 'Clava Grande',
        acerto: 6,
        dadosDano: '2d8+4',
        danoMedio: 13,
        tipoDano: 'concussão',
        alcance: '1,5m',
        efeito55: 'Empurra o alvo 3 metros para trás se for Médio ou menor.',
      },
      { nome: 'Azagaia Pesada', acerto: 6, dadosDano: '2d6+4', danoMedio: 11, tipoDano: 'perfurante', alcance: '9/36m' },
    ],
    habilidadesEMagias: [
      { nome: 'Força Colossal', tipo: 'habilidade', descricao: 'Vantagem em testes de Força para empurrar ou derrubar inimigos.' },
    ],
  },
  {
    id: 'sacerdote_culto',
    nome: 'Fanático Arcano do Culto',
    tipoTamanho: 'Humanoide Médio',
    papelTatico: 'Conjurador',
    cr: '2',
    crNum: 2,
    dv: 6,
    moralD20: 10,
    xp: 450,
    ca: 13,
    pvMedio: 33,
    formulaPv: '6d8+6',
    deslocamento: '9m',
    iniciativaMod: 2,
    biomas: ['urbano', 'masmorra', 'deserto'],
    ataques: [
      { nome: 'Adaga Ritual (2 ataques)', acerto: 4, dadosDano: '1d4+2', danoMedio: 4, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Rajada Necrótica (Magia)', acerto: 5, dadosDano: '3d8', danoMedio: 13, tipoDano: 'necrótico', alcance: '18m' },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Sombria (CD 12)', tipo: 'magia', circulo: '2º Círculo', cd: 12, descricao: 'Magias: Imobilizar Pessoa, Arma Espiritual, Comando, Escudo da Fé.' },
      { nome: 'Devoção Sombria', tipo: 'habilidade', descricao: 'Vantagem contra ser Amedrontado ou Enfeitiçado.' },
    ],
  },
  {
    id: 'ankheg_areias',
    nome: 'Ankheg Escavador',
    tipoTamanho: 'Monstruosidade Grande',
    papelTatico: 'Bruto',
    cr: '2',
    crNum: 2,
    dv: 6,
    moralD20: 8,
    xp: 450,
    ca: 14,
    pvMedio: 45,
    formulaPv: '6d10+12',
    deslocamento: '9m, Escavação 3m',
    iniciativaMod: 0,
    biomas: ['deserto', 'planicie'],
    ataques: [
      {
        nome: 'Mordida Ácida',
        acerto: 5,
        dadosDano: '2d6+3',
        danoMedio: 10,
        tipoDano: 'cortante (+1d6 ácido)',
        alcance: '1,5m',
        efeito55: 'Alvo Médio ou menor fica Agarrado automaticamente (escapar CD 13).',
      },
      { nome: 'Jato de Ácido (Recarga 6)', acerto: 5, dadosDano: '3d6', danoMedio: 10, tipoDano: 'ácido', alcance: 'Linha 9m (CD 13 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Emboscada Subterrânea', tipo: 'habilidade', descricao: 'Sentido Sísmico de 18m; emerge do solo para surpreender viajantes.' },
    ],
  },
  {
    id: 'mimico_voraz',
    nome: 'Mímico Camuflado',
    tipoTamanho: 'Monstruosidade Média',
    papelTatico: 'Controlador',
    cr: '2',
    crNum: 2,
    dv: 9,
    moralD20: 10,
    xp: 450,
    ca: 12,
    pvMedio: 58,
    formulaPv: '9d8+18',
    deslocamento: '4,5m',
    iniciativaMod: 1,
    biomas: ['masmorra', 'urbano'],
    ataques: [
      {
        nome: 'Pseudópode Adesivo',
        acerto: 5,
        dadosDano: '1d8+3',
        danoMedio: 7,
        tipoDano: 'concussão',
        alcance: '1,5m',
        efeito55: 'Alvo fica Agarrado automaticamente (escapar CD 13) e ataques contra ele têm vantagem.',
      },
      { nome: 'Mordida Ácida', acerto: 5, dadosDano: '1d8+3', danoMedio: 7, tipoDano: 'perfurante (+1d8 ácido)', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Aparência Falsa', tipo: 'habilidade', descricao: 'Enquanto imóvel, é indistinguível de um baú, porta ou objeto comum.' },
    ],
  },
  {
    id: 'urso_coruja',
    nome: 'Urso-Coruja Territorial',
    tipoTamanho: 'Monstruosidade Grande',
    papelTatico: 'Bruto',
    cr: '3',
    crNum: 3,
    dv: 7,
    moralD20: 9,
    xp: 700,
    ca: 13,
    pvMedio: 59,
    formulaPv: '7d10+21',
    deslocamento: '12m',
    iniciativaMod: 1,
    efeitoSangrando: 'Ao ficar Sangrando (≤29 PV), solta um guincho ensurdecedor e avança sem provocar ataques de oportunidade.',
    biomas: ['floresta', 'montanha', 'planicie'],
    ataques: [
      { nome: 'Bico Dilacerante', acerto: 7, dadosDano: '1d10+5', danoMedio: 10, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Garras Pesadas (2 ataques)', acerto: 7, dadosDano: '2d8+5', danoMedio: 14, tipoDano: 'cortante', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Visão e Olfato Aguçados', tipo: 'habilidade', descricao: 'Vantagem em Percepção visual ou olfativa; Visão no Escuro 18m.' },
    ],
  },
  {
    id: 'bruxa_pantano',
    nome: 'Bruxa Verde do Mangue',
    tipoTamanho: 'Fada Média',
    papelTatico: 'Controlador',
    cr: '3',
    crNum: 3,
    dv: 11,
    moralD20: 8,
    xp: 700,
    ca: 17,
    pvMedio: 82,
    formulaPv: '11d8+33',
    deslocamento: '9m',
    iniciativaMod: 1,
    biomas: ['pantano', 'floresta'],
    ataques: [
      { nome: 'Garras Pestilentas (2 ataques)', acerto: 6, dadosDano: '2d8+4', danoMedio: 13, tipoDano: 'cortante', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Inata (CD 12)', tipo: 'magia', circulo: 'Inato', cd: 12, descricao: 'Magias: Globos de Luz, Ilusão Menor, Passagem Invisível (à vontade).' },
      { nome: 'Mimetismo Sombrio', tipo: 'habilidade', descricao: 'Imita vozes humanas ou choros de socorro com perfeição (Intuição CD 14).' },
    ],
  },
  {
    id: 'cavaleiro_renegado',
    nome: 'Cavaleiro Renegado',
    tipoTamanho: 'Humanoide Médio',
    papelTatico: 'Chefe',
    cr: '3',
    crNum: 3,
    dv: 8,
    moralD20: 10,
    xp: 700,
    ca: 18,
    pvMedio: 52,
    formulaPv: '8d8+16',
    deslocamento: '9m',
    iniciativaMod: 0,
    iniciativaMod55: 2,
    biomas: ['planicie', 'urbano', 'masmorra'],
    ataques: [
      { nome: 'Espada Montante (2 ataques)', acerto: 5, dadosDano: '2d6+3', danoMedio: 10, tipoDano: 'cortante', alcance: '1,5m' },
      { nome: 'Besta Pesada', acerto: 2, dadosDano: '1d10', danoMedio: 5, tipoDano: 'perfurante', alcance: '30/120m' },
    ],
    habilidadesEMagias: [
      { nome: 'Liderança (1/Descanso)', tipo: 'habilidade', descricao: 'Aliados a 9m adicionam 1d4 em ataques e salvaguardas por 1 minuto.' },
      { nome: 'Aparar (Reação)', tipo: 'habilidade', descricao: 'Adiciona +2 na CA contra 1 ataque corpo a corpo que o acertaria.' },
    ],
  },
  {
    id: 'manticora_picos',
    nome: 'Mantícora dos Picos',
    tipoTamanho: 'Monstruosidade Grande',
    papelTatico: 'Atirador',
    cr: '3',
    crNum: 3,
    dv: 8,
    moralD20: 8,
    xp: 700,
    ca: 14,
    pvMedio: 68,
    formulaPv: '8d10+24',
    deslocamento: '9m, Voo 15m',
    iniciativaMod: 3,
    biomas: ['montanha', 'deserto', 'planicie'],
    ataques: [
      { nome: 'Mordida (Ataque Múltiplo 3x)', acerto: 5, dadosDano: '1d8+3', danoMedio: 7, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Espinho da Cauda (3x)', acerto: 5, dadosDano: '1d8+3', danoMedio: 7, tipoDano: 'perfurante', alcance: '30/60m' },
    ],
    habilidadesEMagias: [
      { nome: 'Ataque Múltiplo (3 ataques)', tipo: 'habilidade', descricao: 'Realiza 1 mordida e 2 garras, ou dispara 3 espinhos da cauda por turno.' },
    ],
  },
  {
    id: 'lamia_deserto',
    nome: 'Lâmia das Dunas',
    tipoTamanho: 'Monstruosidade Grande',
    papelTatico: 'Controlador',
    cr: '4',
    crNum: 4,
    dv: 13,
    moralD20: 9,
    xp: 1100,
    ca: 13,
    pvMedio: 97,
    formulaPv: '13d10+26',
    deslocamento: '9m',
    iniciativaMod: 1,
    biomas: ['deserto', 'masmorra'],
    ataques: [
      { nome: 'Adaga Encantada (2 ataques)', acerto: 5, dadosDano: '1d4+3', danoMedio: 5, tipoDano: 'perfurante', alcance: '1,5m' },
      {
        nome: 'Toque Intoxicante',
        acerto: 5,
        dadosDano: '2d6',
        danoMedio: 7,
        tipoDano: 'psíquico',
        alcance: '1,5m',
        efeito55: 'Alvo fica amaldiçoado por 1h (desvantagem em testes de Sabedoria).',
      },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Ilusória (CD 13)', tipo: 'magia', circulo: '3/dia', cd: 13, descricao: 'Magias: Enfeitiçar Pessoa, Imagem Espelhada, Sugestão, Dissipar Magia.' },
    ],
  },
  {
    id: 'banshee_errante',
    nome: 'Banshee dos Cemitérios',
    tipoTamanho: 'Morto-vivo Médio',
    papelTatico: 'Controlador',
    cr: '4',
    crNum: 4,
    dv: 13,
    moralD20: 12,
    xp: 1100,
    ca: 12,
    pvMedio: 58,
    formulaPv: '13d8',
    deslocamento: '0m, Voo 12m (pairar)',
    iniciativaMod: 2,
    biomas: ['pantano', 'floresta', 'urbano', 'masmorra'],
    ataques: [
      { nome: 'Toque Corruptor', acerto: 4, dadosDano: '3d6+2', danoMedio: 12, tipoDano: 'necrótico', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Lamento Fúnebre (1/Dia)', tipo: 'magia', cd: 13, descricao: 'Criaturas a 9m fazem Con CD 13 ou caem a 0 PV (ou sofrem 3d6 psíquico no sucesso).' },
      { nome: 'Movimento Incorpóreo', tipo: 'habilidade', descricao: 'Atravessa paredes e objetos sólidos como terreno difícil.' },
    ],
  },
  {
    id: 'elemental_agua',
    nome: 'Elemental das Marés',
    tipoTamanho: 'Elemental Grande',
    papelTatico: 'Controlador',
    cr: '5',
    crNum: 5,
    dv: 12,
    moralD20: 11,
    xp: 1800,
    ca: 14,
    pvMedio: 114,
    formulaPv: '12d10+48',
    deslocamento: '9m, Natação 27m',
    iniciativaMod: 2,
    biomas: ['costa', 'pantano'],
    ataques: [
      { nome: 'Pancada de Onda (2 ataques)', acerto: 7, dadosDano: '2d8+4', danoMedio: 13, tipoDano: 'concussão', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Engolfar (Recarga 4-6)', tipo: 'habilidade', cd: 14, descricao: 'Alvos no espaço do elemental fazem Força CD 14 ou ficam Contidos e sofrem afogamento.' },
      { nome: 'Resistências Elementais', tipo: 'habilidade', descricao: 'Resistente a ácido e ataques não-mágicos; imune a veneno.' },
    ],
  },
  {
    id: 'troll_floresta',
    nome: 'Troll Musgoso das Matas',
    tipoTamanho: 'Gigante Grande',
    papelTatico: 'Bruto',
    cr: '5',
    crNum: 5,
    dv: 8,
    moralD20: 10,
    xp: 1800,
    ca: 15,
    pvMedio: 94,
    formulaPv: '9d10+45',
    deslocamento: '9m',
    iniciativaMod: 1,
    efeitoSangrando: 'Ao ficar Sangrando (≤47 PV), entra em frenesi e realiza 1 mordida extra como ação bônus.',
    biomas: ['floresta', 'pantano', 'montanha'],
    ataques: [
      { nome: 'Mordida (Ataque Múltiplo)', acerto: 7, dadosDano: '1d6+4', danoMedio: 7, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Garras Lacerantes (2x)', acerto: 7, dadosDano: '2d6+4', danoMedio: 11, tipoDano: 'cortante', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Regeneração Troll', tipo: 'habilidade', descricao: 'Recupera 15 PV no início de seu turno, a menos que tenha sofrido dano de Fogo ou Ácido.' },
    ],
  },
  {
    id: 'mago_arquimago_renegado',
    nome: 'Arquiconjurador Renegado',
    tipoTamanho: 'Humanoide Médio',
    papelTatico: 'Conjurador',
    cr: '6',
    crNum: 6,
    dv: 12,
    moralD20: 9,
    xp: 2300,
    ca: 15,
    pvMedio: 81,
    formulaPv: '18d8',
    deslocamento: '9m',
    iniciativaMod: 2,
    iniciativaMod55: 5,
    biomas: ['urbano', 'masmorra', 'montanha'],
    ataques: [
      { nome: 'Explosão Arcana (3x)', acerto: 7, dadosDano: '3d10', danoMedio: 16, tipoDano: 'força', alcance: '36m' },
      { nome: 'Bola de Fogo (Recarga 5-6)', acerto: 7, dadosDano: '8d6', danoMedio: 28, tipoDano: 'fogo', alcance: '45m (CD 15 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Arcana (CD 15)', tipo: 'magia', circulo: '5º Círculo', cd: 15, descricao: 'Magias: Escudo Arcano (Reação), Passo Nebuloso, Contramágica, Bola de Fogo, Cone de Frio.' },
    ],
  },
  {
    id: 'quimera_aladas',
    nome: 'Quimera Flamejante',
    tipoTamanho: 'Monstruosidade Grande',
    papelTatico: 'Bruto',
    cr: '6',
    crNum: 6,
    dv: 12,
    moralD20: 9,
    xp: 2300,
    ca: 14,
    pvMedio: 114,
    formulaPv: '12d10+48',
    deslocamento: '9m, Voo 18m',
    iniciativaMod: 0,
    biomas: ['montanha', 'deserto', 'planicie'],
    ataques: [
      { nome: 'Mordida + Chifres + Garras (3x)', acerto: 7, dadosDano: '2d6+4', danoMedio: 11, tipoDano: 'cortante', alcance: '1,5m' },
      { nome: 'Sopro de Fogo (Recarga 5-6)', acerto: 7, dadosDano: '7d8', danoMedio: 31, tipoDano: 'fogo', alcance: 'Cone 4,5m (CD 15 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Três Cabeças', tipo: 'habilidade', descricao: 'Vantagem em Percepção e contra ser cegado, enfeitiçado ou atordoado.' },
    ],
  },
  {
    id: 'gigante_pedra',
    nome: 'Gigante da Rocha Ancestral',
    tipoTamanho: 'Gigante Enorme',
    papelTatico: 'Bruto',
    cr: '7',
    crNum: 7,
    dv: 11,
    moralD20: 10,
    xp: 2900,
    ca: 17,
    pvMedio: 126,
    formulaPv: '11d12+55',
    deslocamento: '12m',
    iniciativaMod: 2,
    biomas: ['montanha', 'masmorra'],
    ataques: [
      { nome: 'Clava de Granito (2x)', acerto: 9, dadosDano: '3d8+6', danoMedio: 19, tipoDano: 'concussão', alcance: '4,5m' },
      {
        nome: 'Arremesso de Pedregulho',
        acerto: 9,
        dadosDano: '4d10+6',
        danoMedio: 28,
        tipoDano: 'concussão',
        alcance: '18/72m',
        efeito55: 'Alvo Grande ou menor cai Caído automaticamente.',
      },
    ],
    habilidadesEMagias: [
      { nome: 'Camuflagem Rochosa', tipo: 'habilidade', descricao: 'Vantagem em Furtividade em terrenos pedregosos; pode aparar projéteis (Reação).' },
    ],
  },
  {
    id: 'hidra_pantano',
    nome: 'Hidra Voraz do Brejo',
    tipoTamanho: 'Monstruosidade Enorme',
    papelTatico: 'Chefe',
    cr: '8',
    crNum: 8,
    dv: 15,
    moralD20: 10,
    xp: 3900,
    ca: 15,
    pvMedio: 184,
    formulaPv: '16d12+80',
    deslocamento: '9m, Natação 9m',
    iniciativaMod: 1,
    iniciativaMod55: 4,
    efeitoSangrando: 'Ao ficar Sangrando (≤92 PV), ganha 1 ataque de oportunidade extra por rodada para cada cabeça ativa.',
    biomas: ['pantano', 'costa'],
    ataques: [
      { nome: 'Mordida (5 Cabeças)', acerto: 8, dadosDano: '1d10+5', danoMedio: 10, tipoDano: 'perfurante', alcance: '3m' },
    ],
    habilidadesEMagias: [
      { nome: 'Múltiplas Cabeças', tipo: 'habilidade', descricao: 'Cada 25 de dano corta uma cabeça; se não sofrer dano de fogo, crescem 2 novas cabeças (+10 PV cada).' },
    ],
  },
  {
    id: 'gigante_fogo',
    nome: 'Gigante do Fogo Forjador',
    tipoTamanho: 'Gigante Enorme',
    papelTatico: 'Bruto',
    cr: '9',
    crNum: 9,
    dv: 13,
    moralD20: 10,
    xp: 5000,
    ca: 18,
    pvMedio: 162,
    formulaPv: '13d12+78',
    deslocamento: '9m',
    iniciativaMod: 0,
    iniciativaMod55: 3,
    biomas: ['montanha', 'deserto', 'masmorra'],
    ataques: [
      { nome: 'Espada Montante Flamejante (2x)', acerto: 11, dadosDano: '6d6+7', danoMedio: 28, tipoDano: 'cortante (+2d6 fogo)', alcance: '3m' },
      { nome: 'Rocha Incandescente', acerto: 11, dadosDano: '4d10+7', danoMedio: 29, tipoDano: 'concussão', alcance: '18/72m' },
    ],
    habilidadesEMagias: [
      { nome: 'Armadura de Placas Forjada', tipo: 'habilidade', descricao: 'Imune a dano de fogo; proficiência em salvaguardas de Des, Con e Car.' },
    ],
  },
  {
    id: 'dragao_vermelho_jovem',
    nome: 'Dragão Vermelho Jovem',
    tipoTamanho: 'Dragão Grande',
    papelTatico: 'Chefe',
    cr: '10',
    crNum: 10,
    dv: 17,
    moralD20: 10,
    xp: 5900,
    ca: 18,
    pvMedio: 178,
    formulaPv: '17d10+85',
    deslocamento: '12m, Escalada 12m, Voo 24m',
    iniciativaMod: 0,
    iniciativaMod55: 4,
    efeitoSangrando: 'Ao ficar Sangrando (≤89 PV), recarrega imediatamente seu Sopro de Fogo.',
    biomas: ['montanha', 'deserto', 'masmorra'],
    ataques: [
      { nome: 'Mordida Flamejante', acerto: 10, dadosDano: '2d10+6', danoMedio: 17, tipoDano: 'perfurante (+1d6 fogo)', alcance: '3m' },
      { nome: 'Garra (2 ataques)', acerto: 10, dadosDano: '2d6+6', danoMedio: 13, tipoDano: 'cortante', alcance: '1,5m' },
      { nome: 'Sopro de Fogo (Recarga 5-6)', acerto: 10, dadosDano: '16d6', danoMedio: 56, tipoDano: 'fogo', alcance: 'Cone 9m (CD 17 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Imunidade Ígnea', tipo: 'habilidade', descricao: 'Imune a dano de fogo; Visão às Cegas 9m, Visão no Escuro 36m.' },
    ],
  },
  {
    id: 'efreeti_deserto',
    nome: 'Efreeti Senhor das Cinzas',
    tipoTamanho: 'Elemental Grande',
    papelTatico: 'Conjurador',
    cr: '11',
    crNum: 11,
    dv: 16,
    moralD20: 10,
    xp: 7200,
    ca: 17,
    pvMedio: 200,
    formulaPv: '16d10+112',
    deslocamento: '12m, Voo 18m',
    iniciativaMod: 1,
    iniciativaMod55: 5,
    biomas: ['deserto', 'urbano', 'planicie'],
    ataques: [
      { nome: 'Cimitarra Escaldante (3 ataques)', acerto: 10, dadosDano: '2d6+6', danoMedio: 13, tipoDano: 'cortante (+2d6 fogo)', alcance: '1,5m' },
      { nome: 'Arremessar Chama (3x)', acerto: 7, dadosDano: '5d6', danoMedio: 17, tipoDano: 'fogo', alcance: '36m' },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Elemental (CD 15)', tipo: 'magia', circulo: 'Inato', cd: 15, descricao: 'Magias: Muralha de Fogo, Invisibilidade Maior, Forma Gasosa, Deslocamento Planar.' },
    ],
  },
  {
    id: 'beholder_observador',
    nome: 'Observador das Profundezas',
    tipoTamanho: 'Aberração Grande',
    papelTatico: 'Chefe',
    cr: '13',
    crNum: 13,
    dv: 19,
    moralD20: 11,
    xp: 10000,
    ca: 18,
    pvMedio: 190,
    formulaPv: '20d10+80',
    deslocamento: '0m, Voo 6m (levitação)',
    iniciativaMod: 2,
    iniciativaMod55: 12,
    efeitoSangrando: 'Ao ficar Sangrando (≤95 PV), dispara 1 raio ocular extra no início de cada rodada.',
    biomas: ['masmorra'],
    ataques: [
      { nome: 'Mordida Afiada', acerto: 5, dadosDano: '4d6', danoMedio: 14, tipoDano: 'perfurante', alcance: '1,5m' },
      { nome: 'Raio Ocular de Desintegração', acerto: 8, dadosDano: '10d8', danoMedio: 45, tipoDano: 'força', alcance: '36m (CD 16 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Cone Antimagia', tipo: 'magia', descricao: 'Olho central projeta um cone de 45m que anula todas as magias e itens mágicos.' },
      { nome: '3 Raios Oculares Aleatórios (CD 16)', tipo: 'magia', cd: 16, descricao: 'Dispara 3 raios por turno (Paralisia, Medo, Telecinesia, Desintegração ou Raio da Morte).' },
    ],
  },
  {
    id: 'lorde_vampiro',
    nome: 'Lorde Vampiro das Sombras',
    tipoTamanho: 'Morto-vivo Médio',
    papelTatico: 'Chefe',
    cr: '13',
    crNum: 13,
    dv: 17,
    moralD20: 11,
    xp: 10000,
    ca: 16,
    pvMedio: 195,
    formulaPv: '23d8+92',
    deslocamento: '12m, Escalada 12m',
    iniciativaMod: 4,
    iniciativaMod55: 14,
    efeitoSangrando: 'Ao ficar Sangrando (≤97 PV), convoca 1d4 enxames de morcegos e ganha ação lendária adicional.',
    biomas: ['urbano', 'floresta', 'masmorra', 'planicie'],
    ataques: [
      {
        nome: 'Golpe Vampírico (2 ataques)',
        acerto: 9,
        dadosDano: '2d8+4',
        danoMedio: 13,
        tipoDano: 'concussão (+2d6 necrótico)',
        alcance: '1,5m',
        efeito55: 'Alvo fica Agarrado automaticamente (escapar CD 17).',
      },
      { nome: 'Mordida Drenante', acerto: 9, dadosDano: '1d6+4', danoMedio: 7, tipoDano: 'perfurante (+3d6 necrótico)', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Regeneração Sombria', tipo: 'habilidade', descricao: 'Recupera 20 PV por turno se não estiver sob luz solar ou água corrente.' },
      { nome: 'Resistência Lendária (3/Dia)', tipo: 'habilidade', descricao: 'Pode escolher ter sucesso automático em uma salvaguarda fracassada.' },
    ],
  },
  {
    id: 'dragao_negro_adulto',
    nome: 'Dragão Negro Adulto',
    tipoTamanho: 'Dragão Enorme',
    papelTatico: 'Chefe',
    cr: '14',
    crNum: 14,
    dv: 17,
    moralD20: 11,
    xp: 11500,
    ca: 19,
    pvMedio: 195,
    formulaPv: '17d12+85',
    deslocamento: '12m, Natação 12m, Voo 24m',
    iniciativaMod: 2,
    iniciativaMod55: 12,
    efeitoSangrando: 'Ao ficar Sangrando (≤97 PV), libera nuvem de escuridão mágica (9m) e recarrega o Sopro Ácido.',
    biomas: ['pantano', 'costa', 'floresta'],
    ataques: [
      { nome: 'Dilacerar (3 ataques)', acerto: 11, dadosDano: '2d8+6', danoMedio: 15, tipoDano: 'cortante (+1d8 ácido)', alcance: '3m' },
      { nome: 'Sopro Ácido (Recarga 5-6)', acerto: 11, dadosDano: '12d8', danoMedio: 54, tipoDano: 'ácido', alcance: 'Linha 18m (CD 18 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Resistência Lendária (3/Dia)', tipo: 'habilidade', descricao: 'Pode escolher passar automaticamente em até 3 salvaguardas por dia; 3 Ações Lendárias/rodada.' },
    ],
  },
  {
    id: 'mumia_lorde',
    nome: 'Lorde Múmia Faraônico',
    tipoTamanho: 'Morto-vivo Médio',
    papelTatico: 'Chefe',
    cr: '15',
    crNum: 15,
    dv: 16,
    moralD20: 12,
    xp: 13000,
    ca: 17,
    pvMedio: 187,
    formulaPv: '25d8+75',
    deslocamento: '9m',
    iniciativaMod: 0,
    iniciativaMod55: 10,
    efeitoSangrando: 'Ao ficar Sangrando (≤93 PV), invoca tempestade de areia necromântica (raio 9m, 3d6 necrótico).',
    biomas: ['deserto', 'masmorra'],
    ataques: [
      {
        nome: 'Punho Putrefato (2 ataques)',
        acerto: 9,
        dadosDano: '3d6+4',
        danoMedio: 14,
        tipoDano: 'concussão (+6d6 necrótico)',
        alcance: '1,5m',
        efeito55: 'Alvo faz Con CD 16 ou contrai Podridão da Múmia (não pode recuperar PV).',
      },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Divina (CD 17)', tipo: 'magia', circulo: '6º Círculo', cd: 17, descricao: 'Magias: Praga de Insetos, Doença Plena, Canalizar Trevas, Dissipar Magia.' },
      { nome: 'Resistência Lendária (3/Dia)', tipo: 'habilidade', descricao: '3 salvaguardas automáticas/dia e 3 Ações Lendárias por rodada.' },
    ],
  },
  {
    id: 'dragao_vermelho_adulto',
    nome: 'Dragão Vermelho Adulto',
    tipoTamanho: 'Dragão Enorme',
    papelTatico: 'Chefe',
    cr: '17',
    crNum: 17,
    dv: 19,
    moralD20: 12,
    xp: 18000,
    ca: 19,
    pvMedio: 256,
    formulaPv: '19d12+133',
    deslocamento: '12m, Escalada 12m, Voo 24m',
    iniciativaMod: 0,
    iniciativaMod55: 12,
    efeitoSangrando: 'Ao ficar Sangrando (≤128 PV), ativa Presença Aterradora (CD 19 Sab) e recarrega Sopro de Fogo.',
    biomas: ['montanha', 'deserto', 'planicie'],
    ataques: [
      { nome: 'Dilacerar Flamejante (3 ataques)', acerto: 14, dadosDano: '2d6+8', danoMedio: 15, tipoDano: 'cortante (+2d6 fogo)', alcance: '3m' },
      { nome: 'Sopro de Fogo (Recarga 5-6)', acerto: 14, dadosDano: '17d6', danoMedio: 59, tipoDano: 'fogo', alcance: 'Cone 18m (CD 21 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Resistência Lendária (3/Dia)', tipo: 'habilidade', descricao: 'Imune a fogo; 3 Ações Lendárias (Detectar, Salto de Asas, Mordida) e magias inatas (Bola de Fogo, Comando).' },
    ],
  },
  {
    id: 'arquidemone_abissal',
    nome: 'Senhor das Fossas Abissais',
    tipoTamanho: 'Corruptor Grande',
    papelTatico: 'Chefe',
    cr: '20',
    crNum: 20,
    dv: 24,
    moralD20: 12,
    xp: 25000,
    ca: 19,
    pvMedio: 300,
    formulaPv: '24d10+168',
    deslocamento: '9m, Voo 18m',
    iniciativaMod: 2,
    iniciativaMod55: 14,
    efeitoSangrando: 'Ao ficar Sangrando (≤150 PV), a aura infernal dobra (4d6 fogo no início do turno de inimigos a 6m).',
    biomas: ['masmorra', 'deserto', 'montanha', 'urbano'],
    ataques: [
      {
        nome: 'Maça Infernal (3 ataques)',
        acerto: 14,
        dadosDano: '2d6+8',
        danoMedio: 15,
        tipoDano: 'concussão (+6d6 fogo)',
        alcance: '3m',
        efeito55: 'Alvo atingido pega fogo (2d6 de fogo por turno até apagar).',
      },
      { nome: 'Mordida Venenosa', acerto: 14, dadosDano: '4d6+8', danoMedio: 22, tipoDano: 'perfurante (+6d6 veneno)', alcance: '1,5m' },
    ],
    habilidadesEMagias: [
      { nome: 'Aura de Medo & Resistência Mágica', tipo: 'habilidade', cd: 21, descricao: 'Vantagem contra magias; inimigos a 6m fazem Sab CD 21 ou ficam Amedrontados.' },
      { nome: 'Conjuração Infernal (CD 21)', tipo: 'magia', circulo: '9º Círculo', cd: 21, descricao: 'Magias: Bola de Fogo (à vontade), Muralha de Fogo, Imobilizar Monstro.' },
    ],
  },
  {
    id: 'kraken_fossas',
    nome: 'Leviatã das Fossas (Kraken Jovem)',
    tipoTamanho: 'Monstruosidade Imensa',
    papelTatico: 'Chefe',
    cr: '18',
    crNum: 18,
    dv: 22,
    moralD20: 11,
    xp: 20000,
    ca: 18,
    pvMedio: 280,
    formulaPv: '20d20+70',
    deslocamento: '6m, Natação 18m',
    iniciativaMod: 0,
    iniciativaMod55: 12,
    efeitoSangrando: 'Ao ficar Sangrando (≤140 PV), solta Nuvem de Tinta (raio 18m) e dispara Tempestade de Raios.',
    biomas: ['costa', 'pantano'],
    ataques: [
      {
        nome: 'Tentáculo Colossal (3 ataques)',
        acerto: 15,
        dadosDano: '3d6+8',
        danoMedio: 18,
        tipoDano: 'concussão',
        alcance: '9m',
        efeito55: 'Alvo fica Agarrado e Contido automaticamente (escapar CD 18).',
      },
      { nome: 'Tempestade de Relâmpagos', acerto: 13, dadosDano: '4d10', danoMedio: 22, tipoDano: 'elétrico', alcance: '36m (3 raios, CD 20 Des)' },
    ],
    habilidadesEMagias: [
      { nome: 'Monstro de Cerco & Ações Lendárias', tipo: 'habilidade', descricao: 'Causa dano dobrado a navios e estruturas; 3 Ações Lendárias por rodada.' },
    ],
  },
  {
    id: 'lich_arquimago',
    nome: 'Arquimago Lich Imortal',
    tipoTamanho: 'Morto-vivo Médio',
    papelTatico: 'Chefe',
    cr: '20',
    crNum: 20,
    dv: 24,
    moralD20: 12,
    xp: 25000,
    ca: 20,
    pvMedio: 245,
    formulaPv: '30d8+110',
    deslocamento: '9m, Voo 9m',
    iniciativaMod: 3,
    iniciativaMod55: 17,
    efeitoSangrando: 'Ao ficar Sangrando (≤122 PV), ativa Escudo Necrótico (+30 PV temp.) e teleporta-se 18m.',
    biomas: ['masmorra', 'urbano', 'floresta', 'planicie'],
    ataques: [
      {
        nome: 'Toque Paralisante (3 ataques)',
        acerto: 12,
        dadosDano: '4d8',
        danoMedio: 18,
        tipoDano: 'gélido (+3d6 necrótico)',
        alcance: '1,5m',
        efeito55: 'Alvo faz Con CD 20 ou fica Paralisado até o fim do próximo turno.',
      },
      { nome: 'Explosão de Energia Negra (3x)', acerto: 12, dadosDano: '5d10', danoMedio: 27, tipoDano: 'necrótico', alcance: '36m' },
    ],
    habilidadesEMagias: [
      { nome: 'Conjuração Suprema (CD 20)', tipo: 'magia', circulo: '9º Círculo', cd: 20, descricao: 'Magias: Dedo da Morte, Desintegrar, Palavra de Poder: Matar, Contramágica, Teleporte.' },
      { nome: 'Resistência Lendária (4/Dia)', tipo: 'habilidade', descricao: 'Imune a veneno e exaustão; 3 Ações Lendárias por rodada; reconstrói-se na filactéria.' },
    ],
  },
];

const TITULOS_POR_BIOMA: Record<BiomaEncontro, string[]> = {
  floresta: ['Emboscada sob as Copas', 'Caçada no Bosque Fechado', 'Guardiões da Clareira Antiga', 'Patrulha das Raízes'],
  masmorra: ['Sentinelas da Câmara Oculta', 'Ronda das Catacumbas', 'Guardiões do Selo Profundo', 'Horda do Subterrâneo'],
  montanha: ['Ameaça no Desfiladeiro', 'Caçadores das Rochas Altas', 'Sombra sobre o Penhasco', 'Passagem Bloqueada'],
  pantano: ['Vozes na Névoa Pútrida', 'Horrores das Águas Negras', 'Ruínas Submersas', 'Emboscada no Manguezal'],
  planicie: ['Assalto na Estrada Real', 'Bando Errante nas Colinas', 'Saqueadores da Planície', 'Tributo Sangrento'],
  deserto: ['Emboscada nas Dunas Escaldantes', 'Maldição da Tumba Soterrada', 'Caçadores do Oásis Seco', 'Tempestade de Areia Viva'],
  costa: ['Incursão dos Recifes', 'Saqueadores da Maré Baixa', 'Canção Mortal nas Falésias', 'Monstros das Profundezas'],
  urbano: ['Cilada no Beco das Sombras', 'Ritual Proibido nos Esgotos', 'Cobrança da Guilda Negra', 'Tumulto na Praça Velha'],
};

const AMBIENTACOES_TATICAS: Record<BiomaEncontro, string[]> = {
  floresta: [
    'Árvores densas oferecem meia cobertura; raízes altas tornam 30% do chão terreno difícil.',
    'Neblina baixa reduz a visibilidade além de 18m; inimigos ocultos entre arbustos espinhosos.',
  ],
  masmorra: [
    'Corredor estreito de pedra úmida com tochas apagadas e pilares de sustentação para cobertura.',
    'Salão abobadado com desnível central de 3 metros e duas saídas laterais estreitas.',
  ],
  montanha: [
    'Trilha íngreme junto a um precipício de 18m; rochas soltas podem rolar com impacto.',
    'Platô rochoso com pedregulhos grandes dando cobertura total em pontos elevados.',
  ],
  pantano: [
    'Água turva na altura dos joelhos (terreno difícil) cercando ilhotas secas de raízes retorcidas.',
    'Névoa fétida espessa e árvores podres caídas servindo de pontes improvisadas.',
  ],
  planicie: [
    'Estrada de terra batida ladeada por valas secas e carroças abandonadas viradas.',
    'Colina baixa com gramado alto até a cintura, garantindo vantagem em Furtividade inicial.',
  ],
  deserto: [
    'Dunas móveis inclinando o terreno em 30°; sol escaldante obriga controle de fadiga.',
    'Ruínas de arenito meio soterradas formando sombra parcial e corredores abertos.',
  ],
  costa: [
    'Rochas escorregadias cobertas de cracas (CD 10 Acrobacia ao correr) batidas pelas ondas.',
    'Enseada estreita onde a maré está subindo rapidamente a cada 2 rodadas.',
  ],
  urbano: [
    'Beco sem saída com telhados baixos acessíveis (3m) e barris de madeira inflamáveis.',
    'Pátio interno iluminado por lampiões a óleo pendurados, com caixotes e escadarias.',
  ],
};

const MOTIVACOES_INIMIGOS = [
  'Defendendo território recém-conquistado contra qualquer intruso.',
  'Em busca desesperada de alimento, pilhagem rápida ou prisioneiros para resgate.',
  'Cumprindo ordens rigorosas de um líder oculto que vigia das sombras.',
  'Atraindo os viajantes para uma armadilha ou distração maior.',
  'Exigindo pedágio abusivo em ouro ou itens mágicos antes de permitir passagem.',
  'Fugindo de um predador ainda maior logo atrás na mesma trilha.',
];

const RESOLUCOES_ALTERNATIVAS = [
  'Suborno ou troca: oferecer suprimentos, ouro ou uma informação valiosa evita o combate.',
  'Intimidação coordenada: derrotar ou abater o líder faz o restante recuar ou se render.',
  'Furtividade / Desvio: uma rota lateral elevada permite contornar o perigo com teste em grupo.',
  'Aliança temporária: os inimigos enfrentam uma ameaça em comum na região e aceitam trégua.',
  'Enganação / Distração: um barulho ou ilusão desvia a atenção da patrulha por 1d4 rodadas.',
];

const CENAS_EXPLORACAO_POR_BIOMA: Record<BiomaEncontro, Omit<CenaNaoCombate, 'testesSugeridos'>[]> = {
  floresta: [
    {
      tipo: 'Mistério',
      protagonistaOuFoco: 'Santuário Silvestre Coberto de Musgo Luminoso',
      situacao: 'Um altar antigo pulsa com runas feéricas enquanto cervos albinos observam em silêncio absoluto.',
      consequenciaFalha: 'Uma maldição feérica faz o grupo perder 1d4 horas andando em círculos e sofrer 1 nível de exaustão.',
      recompensaNarrativa: 'Bênção da Floresta (+1d4 em testes de Sobrevivência e Percepção até o próximo descanso longo).',
    },
    {
      tipo: 'Social',
      protagonistaOuFoco: 'Caravana de Caçadores de Relíquias Presa na Lama',
      situacao: 'Três exploradores discutem sobre uma caixa selada em bronze que emite zumbidos metálicos.',
      consequenciaFalha: 'O grupo desconfia dos aventureiros e exige pagamento dobrado ou tenta sabotar suas montarias.',
      recompensaNarrativa: 'Mapa parcial de uma ruína próxima e compra/venda de poções com 20% de desconto.',
    },
  ],
  masmorra: [
    {
      tipo: 'Perigo Ambiental',
      protagonistaOuFoco: 'Corredor de Lajes de Pressão e Gás Sulfuroso',
      situacao: 'Fendas no teto exalam vapor quente sobre mosaicos rachados que retratam constelações esquecidas.',
      consequenciaFalha: 'Dispara jato de vapor escaldante (dano de fogo/veneno escalado ao nível) e alerta guardas da sala vizinha.',
      recompensaNarrativa: 'Descoberta de passagem secreta que evita uma emboscada à frente.',
    },
  ],
  montanha: [
    {
      tipo: 'Perigo Ambiental',
      protagonistaOuFoco: 'Ponte Pênsil Rompida sobre Abismo Ventoso',
      situacao: 'Cabos de cânhamo apodrecidos balançam sob rajadas geladas; há um abrigo de anões do outro lado.',
      consequenciaFalha: 'Um personagem escorrega e precisa ser resgatado às pressas, perdendo 1 suprimento aleatório.',
      recompensaNarrativa: 'Abrigo seguro para descanso curto e minério de prata exposto na parede.',
    },
  ],
  pantano: [
    {
      tipo: 'Exploração',
      protagonistaOuFoco: 'Barcaça Afundada com Lampiões Fatuos',
      situacao: 'Luzes azuladas dançam sobre os destroços de um barco mercante semi-submerso na turfa.',
      consequenciaFalha: 'A lama sugadora retém quem se aproxima sem corda, atraindo sanguessugas gigantes.',
      recompensaNarrativa: 'Baú estanque preservado com cartas comerciais e um mapa de trilhas secas.',
    },
  ],
  planicie: [
    {
      tipo: 'Social',
      protagonistaOuFoco: 'Mercador Ambulante e sua Carroça Fortificada',
      situacao: 'Um mascate excêntrico oferece boatos, mapas e quinquilharias raras em troca de escolta até o cruzamento.',
      consequenciaFalha: 'O mercador eleva preços ou vende um mapa desatualizado que leva a território hostil.',
      recompensaNarrativa: 'Informação privilegiada sobre patrulhas inimigas e acesso a um item incomum.',
    },
  ],
  deserto: [
    {
      tipo: 'Exploração',
      protagonistaOuFoco: 'Oásis Miragem e Obelisco Soterrado',
      situacao: 'Água cristalina brota aos pés de um pilar inscrito em língua ancestral, mas o vento carrega sussurros.',
      consequenciaFalha: 'A água salobra causa náusea temporária ou revela-se miragem ilusória que drena cantis.',
      recompensaNarrativa: 'Água potável para 3 dias e tradução de uma profecia ligada à masmorra local.',
    },
  ],
  costa: [
    {
      tipo: 'Mistério',
      protagonistaOuFoco: 'Navio Fantasma Encalhado na Maré Baixa',
      situacao: 'O casco coberto de cracas tem o diário de bordo aberto sobre o leme e sinos tocando sem vento.',
      consequenciaFalha: 'A maré sobe repentinamente bloqueando a saída pela gruta costeira.',
      recompensaNarrativa: 'Bússola encantada e coordenadas de um recife com carga naufragada.',
    },
  ],
  urbano: [
    {
      tipo: 'Social',
      protagonistaOuFoco: 'Inspeção Repentina da Guarda ou Informante da Guilda',
      situacao: 'Um mensageiro ofegante deixa cair um envelope lacrado aos pés do grupo antes de sumir na multidão.',
      consequenciaFalha: 'A patrulha local passa a vigiar o grupo, dificultando ações furtivas no distrito.',
      recompensaNarrativa: 'Senha de acesso ao mercado clandestino e pista direta sobre uma facção rival.',
    },
  ],
};

/**
 * Avalia uma rolagem clássica de Reação 2d6 (Fantasia d20 / OSR).
 */
export function avaliarReacao2d6(d1: number, d2: number): ReacaoD20 {
  const total = d1 + d2;
  if (total <= 2) {
    return { dados: [d1, d2], total, categoria: 'Hostil', descricao: 'Ataque imediato sem diálogo.' };
  }
  if (total <= 5) {
    return { dados: [d1, d2], total, categoria: 'Desconfiado', descricao: 'Hostilidade latente; exige rendição, pedágio ou recuo.' };
  }
  if (total <= 8) {
    return { dados: [d1, d2], total, categoria: 'Incerto', descricao: 'Cauteloso e avaliando forças; aberto a negociação tensa.' };
  }
  if (total <= 11) {
    return { dados: [d1, d2], total, categoria: 'Curioso', descricao: 'Disposto a conversar, trocar informações ou negociar passagem.' };
  }
  return { dados: [d1, d2], total, categoria: 'Amigável', descricao: 'Receptivo e cooperativo; pode oferecer ajuda ou aliança.' };
}

/**
 * Rola um novo teste de Reação (2d6) em tempo real na mesa.
 */
export function rolarReacaoD20(): ReacaoD20 {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return avaliarReacao2d6(d1, d2);
}

/**
 * Rola um teste de Moral (2d6 <= Moral da criatura) estilo Fantasia d20 / OSR.
 */
export function rolarTesteMoral(criaturaNome: string, moralAlvo: number): ResultadoTesteMoral {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;
  const passou = total <= moralAlvo;
  const timestamp = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return {
    criaturaNome,
    dados: [d1, d2],
    total,
    moralAlvo,
    passou,
    desfecho: passou
      ? 'Mantém posição e continua lutando com firmeza.'
      : 'Moral quebrada! Tenta recuar, fugir ou se render.',
    timestamp,
  };
}

/**
 * Gera loot determinístico escalonado para o encontro (utiliza itemGenerator.ts).
 */
export function gerarLootEncontro(
  seedLoot: number,
  nivelGrupo: number,
  dificuldade: DificuldadeEncontroFlex
): LootEncontro {
  const rng = new DeterministicRNG(seedLoot);

  const multDif =
    dificuldade === 'facil' || dificuldade === 'baixa'
      ? 0.6
      : dificuldade === 'medio' || dificuldade === 'moderada'
      ? 1
      : dificuldade === 'dificil' || dificuldade === 'alta'
      ? 1.65
      : 2.5;

  const baseOuro = Math.max(5, Math.round(nivelGrupo * 20 * multDif));
  const po = rng.nextInt(Math.round(baseOuro * 0.6), Math.round(baseOuro * 1.5));
  const pp = rng.nextInt(10, baseOuro * 3);
  const pc = rng.nextInt(20, baseOuro * 6);
  const valorTotalPO = Math.round(po + pp / 10 + pc / 100);

  let raridade: RaridadeItem = 'Comum';
  if (nivelGrupo >= 15 && (dificuldade === 'mortal' || dificuldade === 'alta')) raridade = 'Muito Raro';
  else if (nivelGrupo >= 11 || (nivelGrupo >= 7 && (dificuldade === 'mortal' || dificuldade === 'alta'))) raridade = 'Raro';
  else if (nivelGrupo >= 5 || (nivelGrupo >= 3 && dificuldade !== 'facil' && dificuldade !== 'baixa')) raridade = 'Incomum';

  const qtdItens =
    dificuldade === 'facil' || dificuldade === 'baixa'
      ? 1
      : dificuldade === 'medio' || dificuldade === 'moderada'
      ? rng.nextInt(1, 2)
      : rng.nextInt(2, 3);

  const categorias: CategoriaItem[] = [
    'Arma',
    'Armadura e Escudo',
    'Poção ou Elixir',
    'Pergaminho Arcano',
    'Gema e Joia',
    'Item Maravilhoso',
  ];

  const itens: ItemGerado[] = [];
  for (let i = 0; i < qtdItens; i++) {
    const subItemSeed = deriveSubSeed(seedLoot, `loot_item_${i}`);
    const cat = rng.pick(categorias);
    itens.push(
      gerarItem(subItemSeed, {
        categoria: cat,
        raridadeDesejada: i === 0 ? raridade : 'Comum',
        permitirMaldicao: dificuldade === 'mortal' || dificuldade === 'alta',
      })
    );
  }

  return {
    seedLoot,
    moedas: { po, pp, pc, valorTotalPO },
    itens,
  };
}

function criarMonstroEncontro(
  template: CriaturaTemplate,
  quantidade: number,
  sistema: SistemaEncontro
): MonstroEncontro {
  const iniciativaAtiva =
    sistema === 'dnd55' && template.iniciativaMod55 !== undefined
      ? template.iniciativaMod55
      : template.iniciativaMod;

  return {
    ...template,
    quantidade,
    xpTotal: template.xp * quantidade,
    pvSangrando: Math.max(1, Math.floor(template.pvMedio / 2)),
    iniciativaAtiva,
    iniciativaFixa55: 10 + iniciativaAtiva,
    tipoExibicao: sistema === 'dnd55' && template.tipo55 ? template.tipo55 : template.tipoTamanho,
  };
}

function gerarCenaExploracao(
  rng: DeterministicRNG,
  bioma: BiomaEncontro,
  nivel: number
): CenaNaoCombate {
  const lista = CENAS_EXPLORACAO_POR_BIOMA[bioma] || CENAS_EXPLORACAO_POR_BIOMA.floresta;
  const base = rng.pick(lista);
  const cdBase = Math.min(22, 10 + Math.floor(nivel / 2));

  return {
    ...base,
    testesSugeridos: [
      {
        pericia: 'Percepção / Investigação',
        cd: cdBase,
        sucesso: 'Identifica pistas ocultas, pontos fracos ou atalhos seguros antes de agir.',
      },
      {
        pericia: 'Persuasão / Intuição / Arcanismo',
        cd: cdBase + 2,
        sucesso: 'Resolve o impasse sem perdas e extrai o máximo da oportunidade.',
      },
      {
        pericia: 'Sobrevivência / Atletismo',
        cd: cdBase + 1,
        sucesso: 'Supera o obstáculo físico do terreno com segurança para todo o grupo.',
      },
    ],
  };
}

/**
 * Gera um encontro aleatório completo e balanceado para D&D 5.5 (2024), D&D 5e (2014) ou Fantasia d20.
 */
export function gerarEncontroAleatorio(
  seed: number,
  options: {
    nivelGrupo: number;
    tamanhoGrupo: number;
    dificuldade: DificuldadeEncontroFlex;
    bioma: BiomaEncontro;
    sistema?: SistemaEncontro;
    foco?: FocoEncontro;
  }
): EncontroGerado {
  const rng = new DeterministicRNG(seed);
  const sistema: SistemaEncontro = options.sistema || 'dnd5e';
  const foco: FocoEncontro = options.foco || 'combate';
  const nivel = Math.min(20, Math.max(1, options.nivelGrupo));
  const tamanho = Math.min(8, Math.max(1, options.tamanhoGrupo));
  const difNorm = normalizarDificuldadeParaSistema(options.dificuldade, sistema);

  // Calcula orçamento de XP alvo conforme o sistema
  let orcamentoXpAlvo = 100;
  if (sistema === 'dnd55') {
    const d55 = difNorm as Dificuldade55;
    orcamentoXpAlvo = (XP_POR_NIVEL_55[d55][nivel] || 75) * tamanho;
  } else {
    const d5e = difNorm as DificuldadeEncontro;
    orcamentoXpAlvo = (XP_POR_NIVEL_5E[d5e][nivel] || 100) * tamanho;
  }

  const usaMultiplicadorXp = sistema === 'dnd5e';

  // Filtra criaturas compatíveis com o bioma (e se o nível for alto e o bioma tiver poucas opções de topo, expande graciosamente)
  const poolBioma = BESTIARIO_ENCONTROS.filter((m) => m.biomas.includes(options.bioma));
  const poolBase = poolBioma.length > 0 ? poolBioma : BESTIARIO_ENCONTROS;

  const minXpCandidato = Math.max(25, orcamentoXpAlvo * (sistema === 'dnd55' ? 0.05 : 0.04));
  const maxXpCandidato = orcamentoXpAlvo * (sistema === 'dnd55' ? 1.15 : 1.25);

  let candidatos = poolBase.filter((m) => m.xp <= maxXpCandidato && m.xp >= minXpCandidato);
  if (candidatos.length === 0) {
    // Fallback para bestiário completo em níveis muito altos antes de relaxar o orçamento
    candidatos = BESTIARIO_ENCONTROS.filter((m) => m.xp <= maxXpCandidato && m.xp >= minXpCandidato);
  }
  if (candidatos.length === 0) {
    candidatos = [...poolBase]
      .sort((a, b) => Math.abs(a.xp - orcamentoXpAlvo * 0.5) - Math.abs(b.xp - orcamentoXpAlvo * 0.5))
      .slice(0, 4);
  }

  const monstros: MonstroEncontro[] = [];
  let xpBaseAtual = 0;
  let totalCriaturas = 0;

  // Escolhe criatura principal respeitando orçamento do sistema
  const chefeOuPrincipal = rng.pick(candidatos);
  const tetoPrincipal = sistema === 'dnd55' ? orcamentoXpAlvo * 0.85 : orcamentoXpAlvo * 0.75;
  const maxQtdPrincipal = Math.max(
    1,
    Math.min(sistema === 'dnd55' ? 8 : 6, Math.floor(tetoPrincipal / Math.max(25, chefeOuPrincipal.xp)))
  );
  const qtdPrincipal = rng.nextInt(1, maxQtdPrincipal);

  monstros.push(criarMonstroEncontro(chefeOuPrincipal, qtdPrincipal, sistema));
  xpBaseAtual += chefeOuPrincipal.xp * qtdPrincipal;
  totalCriaturas += qtdPrincipal;

  // Tenta adicionar grupo secundário tático caso ainda haja orçamento disponível
  const multAtual = usaMultiplicadorXp ? obterMultiplicadorMonstros5e(totalCriaturas, tamanho) : 1;
  const limiarSuporte = sistema === 'dnd55' ? 0.78 : 0.72;

  if (xpBaseAtual * multAtual < orcamentoXpAlvo * limiarSuporte && candidatos.length > 1) {
    const suportePool = candidatos.filter((c) => c.id !== chefeOuPrincipal.id);
    if (suportePool.length > 0) {
      const suporte = rng.pick(suportePool);
      let qtdSuporte = 0;
      const maxSuporte = sistema === 'dnd55' ? 6 : 4;
      while (qtdSuporte < maxSuporte) {
        const nextTotal = totalCriaturas + qtdSuporte + 1;
        const nextMult = usaMultiplicadorXp ? obterMultiplicadorMonstros5e(nextTotal, tamanho) : 1;
        const nextXpEfetivo = (xpBaseAtual + suporte.xp * (qtdSuporte + 1)) * nextMult;
        if (nextXpEfetivo <= orcamentoXpAlvo * 1.15 || qtdSuporte === 0) {
          qtdSuporte++;
        } else {
          break;
        }
      }
      if (qtdSuporte > 0) {
        monstros.push(criarMonstroEncontro(suporte, qtdSuporte, sistema));
        xpBaseAtual += suporte.xp * qtdSuporte;
        totalCriaturas += qtdSuporte;
      }
    }
  }

  const multiplicadorGrupo = usaMultiplicadorXp
    ? obterMultiplicadorMonstros5e(totalCriaturas, tamanho)
    : 1;
  const xpAjustadoTotal = Math.round(xpBaseAtual * multiplicadorGrupo);
  const xpPorJogador = Math.round(xpBaseAtual / tamanho);

  // Calcula dificuldade real atingida de acordo com o sistema ativo
  let dificuldadeReal: DificuldadeEncontroFlex;
  if (sistema === 'dnd55') {
    const modThreshold = XP_POR_NIVEL_55.moderada[nivel] * tamanho;
    const altaThreshold = XP_POR_NIVEL_55.alta[nivel] * tamanho;
    if (xpBaseAtual >= altaThreshold) dificuldadeReal = 'alta';
    else if (xpBaseAtual >= modThreshold) dificuldadeReal = 'moderada';
    else dificuldadeReal = 'baixa';
  } else {
    const xpMedioThreshold = XP_POR_NIVEL_5E.medio[nivel] * tamanho;
    const xpDificilThreshold = XP_POR_NIVEL_5E.dificil[nivel] * tamanho;
    const xpMortalThreshold = XP_POR_NIVEL_5E.mortal[nivel] * tamanho;
    const xpComp = usaMultiplicadorXp ? xpAjustadoTotal : xpBaseAtual;

    if (xpComp >= xpMortalThreshold) dificuldadeReal = 'mortal';
    else if (xpComp >= xpDificilThreshold) dificuldadeReal = 'dificil';
    else if (xpComp >= xpMedioThreshold) dificuldadeReal = 'medio';
    else dificuldadeReal = 'facil';
  }

  // Mecânicas clássicas Fantasia d20 / OSR (calculadas deterministicamente para todos os sistemas)
  const dReacao1 = rng.nextInt(1, 6);
  const dReacao2 = rng.nextInt(1, 6);
  const reacaoInicial = avaliarReacao2d6(dReacao1, dReacao2);

  const dadosDist =
    options.bioma === 'masmorra' || options.bioma === 'urbano'
      ? rng.nextInt(2, 12)
      : options.bioma === 'floresta' || options.bioma === 'pantano'
      ? rng.nextInt(3, 18)
      : rng.nextInt(4, 24);
  const distanciaMetros = dadosDist * 3;

  const rollSurpGrupo = rng.nextInt(1, 6);
  const rollSurpInimigo = rng.nextInt(1, 6);
  let surpresa = 'Nenhum lado surpreso (ambos se percebem ao mesmo tempo).';
  if (rollSurpGrupo <= 2 && rollSurpInimigo > 2) {
    surpresa = 'Grupo em risco de surpresa (1–2 em 1d6): inimigos começam em vantagem posicional.';
  } else if (rollSurpInimigo <= 2 && rollSurpGrupo > 2) {
    surpresa = 'Inimigos distraídos (1–2 em 1d6): aventureiros podem emboscar ou evitar o encontro.';
  }

  const dvTotalInimigos = monstros.reduce((acc, m) => acc + m.dv * m.quantidade, 0);

  const biomaLabel = BIOMAS_ENCONTRO.find((b) => b.id === options.bioma)?.label || options.bioma;
  const sistemaLabel = SISTEMAS_ENCONTRO.find((s) => s.id === sistema)?.label || sistema;
  const tituloBase = rng.pick(TITULOS_POR_BIOMA[options.bioma]);
  const ambientacaoTatica = rng.pick(AMBIENTACOES_TATICAS[options.bioma]);
  const motivacaoInimigos = rng.pick(MOTIVACOES_INIMIGOS);
  const resolucaoAlternativa = rng.pick(RESOLUCOES_ALTERNATIVAS);

  const cenaNaoCombate =
    foco === 'exploracao' || foco === 'misto'
      ? gerarCenaExploracao(rng, options.bioma, nivel)
      : undefined;

  const titulo =
    foco === 'exploracao' && cenaNaoCombate
      ? cenaNaoCombate.protagonistaOuFoco
      : tituloBase;

  const lootSeed = deriveSubSeed(seed, 'encounter_loot');
  const loot = gerarLootEncontro(lootSeed, nivel, difNorm);

  return {
    id: `enc_${sistema}_${seed}`,
    seed,
    sistema,
    sistemaLabel,
    foco,
    titulo,
    bioma: options.bioma,
    biomaLabel,
    nivelGrupo: nivel,
    tamanhoGrupo: tamanho,
    dificuldadeAlvo: difNorm,
    dificuldadeReal,
    dificuldadeLabel: obterLabelDificuldade(dificuldadeReal, sistema),
    orcamentoXpAlvo,
    xpBaseTotal: xpBaseAtual,
    multiplicadorGrupo,
    xpAjustadoTotal,
    xpPorJogador,
    usaMultiplicadorXp,
    ambientacaoTatica,
    motivacaoInimigos,
    resolucaoAlternativa,
    detalhesD20: {
      distanciaMetros,
      surpresa,
      dvTotalInimigos,
      reacaoInicial,
    },
    cenaNaoCombate,
    monstros,
    loot,
  };
}

/**
 * Rola um ataque completo (1d20 + acerto) e o dano (dobrando dados em 20 natural).
 */
export function rolarAtaqueEDano(criaturaNome: string, ataque: AtaqueMonstro): ResultadoRolagemAtaque {
  const d20Raw = Math.floor(Math.random() * 20) + 1;
  const isCritico = d20Raw === 20;
  const isFalhaCritica = d20Raw === 1;
  const totalAcerto = d20Raw + ataque.acerto;

  const match = ataque.dadosDano.replace(/\s+/g, '').match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  let numDados = 1;
  let ladosDado = 6;
  let bonusDano = 0;

  if (match) {
    numDados = parseInt(match[1], 10);
    ladosDado = parseInt(match[2], 10);
    bonusDano = match[3] ? parseInt(match[3], 10) : 0;
  }

  const dadosParaRolar = isCritico ? numDados * 2 : numDados;
  const dadosRolados: number[] = [];
  let somaDados = 0;

  for (let i = 0; i < dadosParaRolar; i++) {
    const r = Math.floor(Math.random() * ladosDado) + 1;
    dadosRolados.push(r);
    somaDados += r;
  }

  const totalDano = Math.max(0, somaDados + bonusDano);
  const now = new Date();
  const timestamp = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return {
    criaturaNome,
    ataqueNome: ataque.nome,
    d20Raw,
    bonusAcerto: ataque.acerto,
    totalAcerto,
    isCritico,
    isFalhaCritica,
    dadosDanoExpressao: ataque.dadosDano,
    dadosRolados,
    bonusDano,
    totalDano,
    tipoDano: ataque.tipoDano,
    efeitoExtra: ataque.efeito55,
    timestamp,
  };
}

/**
 * Exporta um encontro completo em formato Markdown pronto para notas do mestre.
 */
export function exportarEncontroMarkdown(enc: EncontroGerado): string {
  let md = `# ⚔️ Encontro: ${enc.titulo}\n`;
  md += `**Sistema:** ${enc.sistemaLabel} | **Bioma:** ${enc.biomaLabel} | **Grupo:** ${enc.tamanhoGrupo} jogadores (Nível ${enc.nivelGrupo}) | **Dificuldade:** ${enc.dificuldadeLabel}\n`;

  if (enc.sistema === 'dnd55') {
    md += `**Orçamento XP (2024):** ${enc.xpBaseTotal} / ${enc.orcamentoXpAlvo} XP (Sem multiplicador · ${enc.xpPorJogador} XP/jogador)\n\n`;
  } else if (enc.sistema === 'd20_fantasia') {
    md += `**DV Totais:** ${enc.detalhesD20.dvTotalInimigos} DV | **Distância:** ${enc.detalhesD20.distanciaMetros}m | **Reação (2d6=${enc.detalhesD20.reacaoInicial.total}):** ${enc.detalhesD20.reacaoInicial.categoria}\n`;
    md += `**Surpresa:** ${enc.detalhesD20.surpresa}\n\n`;
  } else {
    md += `**XP Base:** ${enc.xpBaseTotal} XP | **XP Ajustado (x${enc.multiplicadorGrupo}):** ${enc.xpAjustadoTotal} XP (${enc.xpPorJogador} XP/jogador)\n\n`;
  }

  md += `> **Cenário Tático:** ${enc.ambientacaoTatica}\n`;
  md += `> **Motivação:** ${enc.motivacaoInimigos}\n`;
  md += `> **Resolução Alternativa:** ${enc.resolucaoAlternativa}\n\n`;

  if (enc.cenaNaoCombate) {
    md += `## 🧭 Cena de ${enc.cenaNaoCombate.tipo}: ${enc.cenaNaoCombate.protagonistaOuFoco}\n`;
    md += `${enc.cenaNaoCombate.situacao}\n`;
    for (const t of enc.cenaNaoCombate.testesSugeridos) {
      md += `- **${t.pericia} (CD ${t.cd}):** ${t.sucesso}\n`;
    }
    md += `- **Falha:** ${enc.cenaNaoCombate.consequenciaFalha}\n`;
    md += `- **Recompensa:** ${enc.cenaNaoCombate.recompensaNarrativa}\n\n`;
  }

  if (enc.foco !== 'exploracao') {
    md += `## 👹 Criaturas\n`;
    for (const m of enc.monstros) {
      md += `### ${m.quantidade}x ${m.nome} (${m.tipoExibicao} · ${m.papelTatico} · ND ${m.cr} · ${m.xp} XP cada)\n`;
      if (enc.sistema === 'dnd55') {
        md += `- **CA:** ${m.ca} | **PV:** ${m.pvMedio} (${m.formulaPv}) · **Sangrando:** ≤${m.pvSangrando} PV | **Iniciativa:** ${m.iniciativaAtiva >= 0 ? '+' : ''}${m.iniciativaAtiva} (${m.iniciativaFixa55}) | **Desl.:** ${m.deslocamento}\n`;
      } else if (enc.sistema === 'd20_fantasia') {
        md += `- **CA:** ${m.ca} | **DV:** ${m.dv} (${m.pvMedio} PV) | **Moral:** ${m.moralD20} | **Desl.:** ${m.deslocamento}\n`;
      } else {
        md += `- **CA:** ${m.ca} | **PV:** ${m.pvMedio} (${m.formulaPv}) | **Deslocamento:** ${m.deslocamento} | **Iniciativa:** ${m.iniciativaMod >= 0 ? '+' : ''}${m.iniciativaMod}\n`;
      }
      if (enc.sistema === 'dnd55' && m.efeitoSangrando) {
        md += `- **Gatilho Sangrando (5.5):** ${m.efeitoSangrando}\n`;
      }
      md += `- **Ataques:**\n`;
      for (const atk of m.ataques) {
        md += `  - **${atk.nome}:** +${atk.acerto} para acertar, dano \`${atk.dadosDano}\` (méd. ${atk.danoMedio}) ${atk.tipoDano}${atk.alcance ? ` [${atk.alcance}]` : ''}${enc.sistema === 'dnd55' && atk.efeito55 ? ` — *${atk.efeito55}*` : ''}\n`;
      }
      if (m.habilidadesEMagias.length > 0) {
        md += `- **Magias & Habilidades:**\n`;
        for (const h of m.habilidadesEMagias) {
          md += `  - *${h.nome}*${h.circulo ? ` (${h.circulo})` : ''}: ${h.descricao}\n`;
        }
      }
      md += `\n`;
    }
  }

  md += `## 💰 Tesouro & Loot\n`;
  md += `- **Moedas:** ${enc.loot.moedas.po} PO, ${enc.loot.moedas.pp} PP, ${enc.loot.moedas.pc} PC (~${enc.loot.moedas.valorTotalPO} PO totais)\n`;
  for (const item of enc.loot.itens) {
    md += `- **${item.nome}** (${item.categoria}, ${item.raridade}) — ${item.descricaoMecanica} (${item.valorPO} PO)\n`;
  }

  return md;
}
