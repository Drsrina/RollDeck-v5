import type { RecursosCidade } from '../types/oraculo';

export interface EntradaTabela {
  min: number;
  max: number;
  texto: string;
}

export interface TabelaRolavel {
  id: string;
  nome: string;
  dado: string;
  categoria?: string;
  descricao?: string;
  entradas: EntradaTabela[];
}

export interface ConstrucaoPreset {
  nome: string;
  custo: Partial<RecursosCidade>;
  efeito: string;
  diasParaConstruir: number;
}

export interface RegrasTurnosDef {
  consumoPerCapitaSemanal: {
    viveresPorHabitante: number;
  };
  producaoSemanalBase: {
    multiplicadorPorIndustria: number;
    ouro: number;
    madeira: number;
    pedra: number;
    minerio: number;
  };
  faseMensal: {
    impostoBasePorHabitante: number;
    colheitaSazonal: {
      primavera: number;
      verao: number;
      outono: number;
      inverno: number;
    };
  };
  construcoesPredefinidas: ConstrucaoPreset[];
}

export const REGRAS_TURNOS: RegrasTurnosDef = {
  consumoPerCapitaSemanal: {
    viveresPorHabitante: 0.05,
  },
  producaoSemanalBase: {
    multiplicadorPorIndustria: 1.25,
    ouro: 8,
    madeira: 10,
    pedra: 6,
    minerio: 4,
  },
  faseMensal: {
    impostoBasePorHabitante: 0.1,
    colheitaSazonal: {
      primavera: 30,
      verao: 40,
      outono: 35,
      inverno: 10,
    },
  },
  construcoesPredefinidas: [
    {
      nome: "Moinho d'Água",
      custo: { madeira: 20, pedra: 15, ouro: 10 },
      efeito: '+15 Víveres semanais adicionais por eficiência na moagem',
      diasParaConstruir: 14,
    },
    {
      nome: 'Paliçada Defensiva',
      custo: { madeira: 30, pedra: 10, ouro: 5 },
      efeito: '+20 Defesa e reduz o impacto de ataques selvagens',
      diasParaConstruir: 10,
    },
    {
      nome: 'Serraria Comunal',
      custo: { ouro: 15, madeira: 10 },
      efeito: '+12 Madeira semanal na produção básica',
      diasParaConstruir: 7,
    },
    {
      nome: 'Forja dos Ferreiros',
      custo: { pedra: 25, minerio: 15, ouro: 20 },
      efeito: '+1 Nível de Indústria e +10 Ouro em ferramentas',
      diasParaConstruir: 21,
    },
    {
      nome: 'Armazém Graneleiro',
      custo: { madeira: 25, pedra: 20, ouro: 12 },
      efeito: 'Preserva reservas de víveres durante geadas e secas',
      diasParaConstruir: 14,
    },
    {
      nome: 'Mercado Central',
      custo: { madeira: 15, ouro: 25 },
      efeito: '+25% de lucro em rotas comerciais e +10 Moral',
      diasParaConstruir: 14,
    },
    {
      nome: 'Torre de Vigia',
      custo: { pedra: 30, madeira: 10, ouro: 15 },
      efeito: '+15 Defesa e aviso antecipado de desastres',
      diasParaConstruir: 12,
    },
    {
      nome: 'Templo / Santuário Comunal',
      custo: { pedra: 20, ouro: 20 },
      efeito: '+15 Moral e estabilidade espiritual da população',
      diasParaConstruir: 18,
    },
  ],
};

export const TABELAS_EVENTO_DUPLO: {
  foco: TabelaRolavel;
  acao: TabelaRolavel;
  assunto: TabelaRolavel;
} = {
  foco: {
    id: 'evento_foco',
    nome: 'Foco do Evento',
    dado: '1d100',
    entradas: [
      { min: 1, max: 12, texto: 'Facção ou Aliado Próximo' },
      { min: 13, max: 25, texto: 'Ameaça Externa / Inimigo' },
      { min: 26, max: 37, texto: 'Ambiente ou Natureza Selvagem' },
      { min: 38, max: 50, texto: 'Autoridade / Governante Local' },
      { min: 51, max: 62, texto: 'Recursos ou Tesouro Escondido' },
      { min: 63, max: 75, texto: 'Segredo Revelado / Conspiração' },
      { min: 76, max: 88, texto: 'Comunidade / População Comum' },
      { min: 89, max: 100, texto: 'Força Mística / Presságio' },
    ],
  },
  acao: {
    id: 'evento_acao',
    nome: 'Ação do Evento',
    dado: '1d100',
    entradas: [
      { min: 1, max: 12, texto: 'Emboscada ou Incursão' },
      { min: 13, max: 25, texto: 'Traição ou Rompimento' },
      { min: 26, max: 37, texto: 'Negociação ou Oferta Inesperada' },
      { min: 38, max: 50, texto: 'Descoberta ou Escavação' },
      { min: 51, max: 62, texto: 'Fuga ou Desaparecimento Misterioso' },
      { min: 63, max: 75, texto: 'Aliança ou Reforço Inesperado' },
      { min: 76, max: 88, texto: 'Sabotagem ou Contaminação' },
      { min: 89, max: 100, texto: 'Disputa de Liderança / Duelo' },
    ],
  },
  assunto: {
    id: 'evento_assunto',
    nome: 'Assunto do Evento',
    dado: '1d100',
    entradas: [
      { min: 1, max: 12, texto: 'Sobre relíquia antiga' },
      { min: 13, max: 25, texto: 'Por terras e rotas de comércio' },
      { min: 26, max: 37, texto: 'Com promessa de ouro abundante' },
      { min: 38, max: 50, texto: 'Envolvendo uma profecia sombria' },
      { min: 51, max: 62, texto: 'Por dívidas de honra e vingança' },
      { min: 63, max: 75, texto: 'Ameaçando o abastecimento da região' },
      { min: 76, max: 88, texto: 'Revelando um infiltrado disfarçado' },
      { min: 89, max: 100, texto: 'Despertando um mal há muito esquecido' },
    ],
  },
};

export const TODAS_TABELAS: TabelaRolavel[] = [
  {
    id: 'clima',
    nome: 'Condições Climáticas & Atmosfera',
    dado: '1d100',
    categoria: 'Exploração',
    entradas: [
      { min: 1, max: 15, texto: 'Céu límpido e vento suave; visibilidade perfeita' },
      { min: 16, max: 30, texto: 'Sol ameno com brisa refrescante' },
      { min: 31, max: 45, texto: 'Nublado com névoa rasteira e ar úmido' },
      { min: 46, max: 60, texto: 'Garoa persistente e solo lamacento' },
      { min: 61, max: 75, texto: 'Chuva torrencial e ventos uivantes' },
      { min: 76, max: 85, texto: 'Tempestade elétrica com relâmpagos próximos' },
      { min: 86, max: 95, texto: 'Névoa sobrenatural densa, abafando sons' },
      { min: 96, max: 100, texto: 'Vendaval cataclísmico ou granizo destrutivo' },
    ],
  },
  {
    id: 'desastres_sazonais',
    nome: 'Desastres e Eventos Sazonais',
    dado: '1d100',
    categoria: 'Campanha',
    entradas: [
      { min: 1, max: 15, texto: 'Invasão de pragas nas lavouras; perda parcial de grãos' },
      { min: 16, max: 30, texto: 'Cheia repentina do rio principal; pontes danificadas' },
      { min: 31, max: 45, texto: 'Incêndio em oficina ou depósito comunitário' },
      { min: 46, max: 60, texto: 'Seca prolongada reduzindo vazão dos poços e colheita' },
      { min: 61, max: 75, texto: 'Surto de febre nos bairros baixos; curandeiros requisitados' },
      { min: 76, max: 85, texto: 'Ataque de bando de saqueadores nos arredores' },
      { min: 86, max: 95, texto: 'Geada impiedosa congelando estradas e rebanhos' },
      { min: 96, max: 100, texto: 'Terremoto ou deslizamento de terra colapsando minas' },
    ],
  },
  {
    id: 'rumores',
    nome: 'Rumores da Taverna & Estradas',
    dado: '1d100',
    categoria: 'Ganchos',
    entradas: [
      { min: 1, max: 15, texto: 'Luzes fantasmagóricas foram vistas no pico da colina norte' },
      { min: 16, max: 30, texto: 'Uma caravana mercantil inteira sumiu sem deixar rastros' },
      { min: 31, max: 45, texto: 'O ferreiro local comprou um lingote com marcas proibidas' },
      { min: 46, max: 60, texto: 'Um caçador afirma ter encontrado a entrada de uma catacumba' },
      { min: 61, max: 75, texto: 'Dizem que o prefeito recebe cartas seladas em cera negra' },
      { min: 76, max: 85, texto: 'Criaturas subterrâneas estão perfurando poços residenciais' },
      { min: 86, max: 95, texto: 'Um desertor da guarda jura que a fortaleza vizinha caiu' },
      { min: 96, max: 100, texto: 'Um artefato lendário foi leiloado em segredo no submundo' },
    ],
  },
  {
    id: 'complicacoes',
    nome: 'Complicações Imediatas',
    dado: '1d100',
    categoria: 'Sessão',
    entradas: [
      { min: 1, max: 15, texto: 'Um aliado comete uma indiscrição perigosa em público' },
      { min: 16, max: 30, texto: 'O preço dos suprimentos triplica devido a escassez súbita' },
      { min: 31, max: 45, texto: 'A rota principal está bloqueada por árvores caídas ou pedras' },
      { min: 46, max: 60, texto: 'Guardas locais exigem pedágio exorbitante ou salvo-conduto' },
      { min: 61, max: 75, texto: 'Um item essencial foi roubado ou danificado acidentalmente' },
      { min: 76, max: 85, texto: 'Um rival antigo descobre a presença do grupo na região' },
      { min: 86, max: 95, texto: 'O tempo muda drasticamente para tempestade violenta' },
      { min: 96, max: 100, texto: 'Emboscada coordenada armada por caçadores de recompensa' },
    ],
  },
  {
    id: 'comercio',
    nome: 'Oportunidades Comerciais',
    dado: '1d100',
    categoria: 'Economia',
    entradas: [
      { min: 1, max: 15, texto: 'Mercador itinerante com poções raras e temperos exóticos' },
      { min: 16, max: 30, texto: 'Caravana busca escolta armada para rota de montanha' },
      { min: 31, max: 45, texto: 'Alta demanda por madeira e ferro refinado para fortificações' },
      { min: 46, max: 60, texto: 'Feirante vendendo mapas antigos com rotas esquecidas' },
      { min: 61, max: 75, texto: 'Joalheiro liquida pedras brutas a preços reduzidos' },
      { min: 76, max: 85, texto: 'Monopólio de guilda local impõe taxa sobre forasteiros' },
      { min: 86, max: 95, texto: 'Mercadoria contrabandeada oferecida nos becos escuros' },
      { min: 96, max: 100, texto: 'Leilão nobre de uma propriedade abandonada com adega' },
    ],
  },
  {
    id: 'npcs_rapidos',
    nome: 'NPCs e Transeuntes Rápidos',
    dado: '1d100',
    categoria: 'Personagens',
    entradas: [
      { min: 1, max: 15, texto: 'Veterano de guerra manco com olhar atento e fala curta' },
      { min: 16, max: 30, texto: 'Jovem aprendiz entusiasmado porém desastrado com pergaminhos' },
      { min: 31, max: 45, texto: 'Curandeira misteriosa com ervas secas penduradas no xale' },
      { min: 46, max: 60, texto: 'Mercador desconfiado que insiste em pesar cada moeda de ouro' },
      { min: 61, max: 75, texto: 'Bardo fanfarrão cantando baladas sobre derrotas heroicas' },
      { min: 76, max: 85, texto: 'Guarda municipal corruptível porém pragmático e cauteloso' },
      { min: 86, max: 95, texto: 'Refugiado desesperado procurando familiares desaparecidos' },
      { min: 96, max: 100, texto: 'Nobre disfarçado investigando traição de seus vassalos' },
    ],
  },
  {
    id: 'encontros_ermas',
    nome: 'Encontros nas Ermas',
    dado: '1d100',
    categoria: 'Combate & Exploração',
    entradas: [
      { min: 1, max: 15, texto: 'Pegadas recentes de predador de grande porte ao lado da trilha' },
      { min: 16, max: 30, texto: 'Acampamento recente abandonado com cinzas ainda quentes' },
      { min: 31, max: 45, texto: 'Matilha de lobos selvagens rondando a sotavento' },
      { min: 46, max: 60, texto: 'Carruagem tombada com marcas de garras e baú aberto' },
      { min: 61, max: 75, texto: 'Monumento arruinado cercado por plantas venenosas' },
      { min: 76, max: 85, texto: 'Patrulha de caçadores de recompensa interrogando viajantes' },
      { min: 86, max: 95, texto: 'Bando de humanoides saqueadores emboscando em desfiladeiro' },
      { min: 96, max: 100, texto: 'Monstro lendário territorial cruzando o horizonte distante' },
    ],
  },
  {
    id: 'masmorras_micro',
    nome: 'Acontecimentos em Masmorra',
    dado: '1d100',
    categoria: 'Masmorra',
    entradas: [
      { min: 1, max: 15, texto: 'Gotejar constante ecoando, revelando fissura na abóbada' },
      { min: 16, max: 30, texto: 'Tochas antigas recém-acesas com cheiro acre de óleo' },
      { min: 31, max: 45, texto: 'Mecanismo de pressão oculto aciona falso alarme distante' },
      { min: 46, max: 60, texto: 'Porta de pedra emperrada com entalhes de runas protetoras' },
      { min: 61, max: 75, texto: 'Esqueleto humanoide segurando um anel de latão gravado' },
      { min: 76, max: 85, texto: 'Vozes abafadas conversando no corredor seguinte' },
      { min: 86, max: 95, texto: 'Gás sonífero ou tóxico vazando lentamente de duto' },
      { min: 96, max: 100, texto: 'Sala do tesouro guardada por estátua articulada guardiã' },
    ],
  },
  {
    id: 'descobertas_arcanas',
    nome: 'Descobertas Arcanas & Curiosidades',
    dado: '1d100',
    categoria: 'Magia',
    entradas: [
      { min: 1, max: 15, texto: 'Frasco de vidro fumê contendo pó luminiscente inerte' },
      { min: 16, max: 30, texto: 'Círculo de runas apagadas que vibra ao toque de metal' },
      { min: 31, max: 45, texto: 'Diário de alquimista com receitas incompletas de antídotos' },
      { min: 46, max: 60, texto: 'Fragmento de cristal pulsando leve calor ao luar' },
      { min: 61, max: 75, texto: 'Pergaminho em couro com feitiço de comunicação menor' },
      { min: 76, max: 85, texto: 'Espelho de mão antigo que não reflete chamas nem velas' },
      { min: 86, max: 95, texto: 'Varinha de madeira entalhada com uma única carga restante' },
      { min: 96, max: 100, texto: 'Grimório selado com cadeado arcano e aviso de maldição' },
    ],
  },
];
