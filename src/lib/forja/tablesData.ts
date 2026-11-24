/**
 * FORJA DE MUNDOS — Conjunto de Tabelas Canônicas Determinísticas (§2.1)
 *
 * Tabelas ponderadas com tags, binds contextuais e alta entropia informacional (H >= 0.7).
 */

import { TabelaDSL } from './tableEngine';

export const TABELAS_CANONICAS: TabelaDSL[] = [
  {
    tabela: 'rumores_taverna',
    modo: 'unico',
    max_depth: 3,
    entradas: [
      {
        peso: 35,
        texto: 'Dizem que [art:def:ferreiro] {{ferreiro}} está devendo favores perigosos para [art:def:faccao] {{faccao}}.',
        tags: ['urbano', 'crime', 'nível>=1'],
        bind: 'rumor_principal',
      },
      {
        peso: 30,
        texto: 'Uma criatura [adj:sombrio:criatura] ronda as antigas ruínas ao norte. Ninguém ousa viajar à noite.',
        tags: ['ermos', 'perigo', 'noite'],
      },
      {
        peso: 25,
        texto: 'O sindicato dos mercadores contratou guardas armados após sucessivas caravanas desaparecerem no vale.',
        tags: ['comercio', 'viagem'],
      },
      {
        peso: 20,
        texto: 'Luzes azuladas foram avistadas na torre abandonada do arquimago durante o último solstício.',
        tags: ['arcano', 'mistério', 'nível>=3'],
      },
      {
        peso: 15,
        texto: 'Um forasteiro ferido chegou à estalagem murmurando sobre um santuário esquecido repleto de ouro e ossos.',
        tags: ['masmorra', 'tesouro'],
      },
      {
        peso: 12,
        texto: 'A milícia local encontrou selos arcanos desenhados com cinzas nas portas de três cidadãos respeitáveis.',
        tags: ['culto', 'conspiração'],
      },
      {
        peso: 10,
        texto: 'O leito do rio secou repentinamente a montante, revelando entradas de catacumbas submersas há séculos.',
        tags: ['rio', 'catástrofe'],
      },
    ],
  },
  {
    tabela: 'ocupacoes_npc',
    modo: 'repetivel',
    entradas: [
      { peso: 30, texto: 'ferreiro', tags: ['artesão'] },
      { peso: 28, texto: 'taverneiro', tags: ['comércio'] },
      { peso: 25, texto: 'mercador', tags: ['comércio'] },
      { peso: 22, texto: 'alquimista', tags: ['arcano'] },
      { peso: 20, texto: 'guarda da milícia', tags: ['militar'] },
      { peso: 18, texto: 'pescador', tags: ['rio', 'costa'] },
      { peso: 16, texto: 'curandeiro', tags: ['religião'] },
      { peso: 15, texto: 'escriba', tags: ['estudo'] },
      { peso: 14, texto: 'mineiro', tags: ['montanha'] },
      { peso: 12, texto: 'bardo andarilho', tags: ['arte'] },
      { peso: 10, texto: 'caçador de recompensas', tags: ['combate'] },
      { peso: 8, texto: 'arcanista recluso', tags: ['arcano', 'nível>=4'] },
    ],
  },
  {
    tabela: 'tracos_aparencia',
    modo: 'repetivel',
    entradas: [
      { peso: 25, texto: 'olhar atento e cicatriz tênue atravessando a sobrancelha esquerda' },
      { peso: 25, texto: 'mãos calejadas marcadas por fuligem e queimaduras antigas' },
      { peso: 22, texto: 'postura rígida e capa esfarrapada de viagem presa por fivela de bronze' },
      { peso: 20, texto: 'cabelos grisalhos desgrenhados e anéis de prata desgastada em vários dedos' },
      { peso: 18, texto: 'voz rouca e profunda, acompanhada de tosse constante' },
      { peso: 18, texto: 'tatuagem desbotada com símbolo de uma irmandade esquecida no antebraço' },
      { peso: 15, texto: 'vestes sóbrias impecavelmente limpas, contrastando com botas enlameadas' },
      { peso: 12, texto: 'olhos de cores diferentes (heterocromia) e sorriso enigmático' },
    ],
  },
  {
    tabela: 'segredos_npc',
    modo: 'repetivel',
    entradas: [
      { peso: 25, texto: 'deve uma soma astronômica de moedas de ouro para a guilda dos contrabandistas' },
      { peso: 22, texto: 'guarda um mapa em pergaminho costurado no forro secreto de suas botas' },
      { peso: 20, texto: 'é o último sobrevivente de uma linhagem nobre destituída após a grande revolta' },
      { peso: 18, texto: 'transmite relatórios discretos sobre viajantes para um espião da corte real' },
      { peso: 16, texto: 'esconde um artefato amaldiçoado que sussurra pensamentos alheios durante o sono' },
      { peso: 15, texto: 'assumiu a identidade de um viajante falecido há dez invernos' },
      { peso: 12, texto: 'participa de rituais noturnos secretos no cemitério velho' },
    ],
  },
  {
    tabela: 'arquetipos_faccao',
    modo: 'repetivel',
    entradas: [
      { peso: 30, texto: 'Guilda Comercial dos Mercadores Livres', tags: ['comércio'] },
      { peso: 25, texto: 'Irmandade dos Olhos de Corvo (Ladrões)', tags: ['submundo'] },
      { peso: 22, texto: 'Ordem dos Guardiões da Aurora (Cavaleiros)', tags: ['ordem'] },
      { peso: 20, texto: 'Círculo das Raízes Cinzentas (Druidas)', tags: ['natureza'] },
      { peso: 18, texto: 'Conclave do Vidro Negro (Eruditos Arcanos)', tags: ['arcano'] },
      { peso: 15, texto: 'Culto da Chama Abissal (Fanáticos)', tags: ['culto'] },
      { peso: 14, texto: 'Sindicato dos Mineiros e Fundidores', tags: ['artesãos'] },
    ],
  },
  {
    tabela: 'temas_masmorra',
    modo: 'repetivel',
    entradas: [
      { peso: 28, texto: 'Catacumbas Esquecidas dos Reis Caídos', tags: ['mortos-vivos', 'cripta'] },
      { peso: 24, texto: 'Mina Abandonada de Prata Profunda', tags: ['subterrâneo', 'goblins'] },
      { peso: 22, texto: 'Santuário Submerso do Olho Primordial', tags: ['aquático', 'aberrações'] },
      { peso: 20, texto: 'Bastilha Clandestina dos Renegados', tags: ['prisão', 'humanoides'] },
      { peso: 18, texto: 'Laboratório Alquímico Corrompido', tags: ['arcano', 'constructos'] },
      { peso: 15, texto: 'Cavernas Fúngicas dos Devoradores', tags: ['feras', 'veneno'] },
    ],
  },
  {
    tabela: 'armadilhas_masmorra',
    modo: 'repetivel',
    entradas: [
      { peso: 25, texto: 'Placa de pressão conectada a dardos impregnados com veneno paralisante (CD 13 Percepção, CD 12 Destreza)' },
      { peso: 22, texto: 'Fosso oculto com estacas de ferro enferrujadas sob piso falso de ardósia (CD 14 Percepção)' },
      { peso: 20, texto: 'Glifo arcano gravado no lintel que detona uma onda sônica ensurdecedora (CD 15 Investigação)' },
      { peso: 18, texto: 'Fio de tropeço acoplado a pêndulo com lâmina afiada em arco suspenso no teto (CD 13 Destreza)' },
      { peso: 15, texto: 'Gás sonífero liberado ao girar a maçaneta sem o contra-giro de segurança (CD 14 Constituição)' },
      { peso: 12, texto: 'Grade de ferro pesada que desaba fechando a rota de fuga enquanto água começa a jorrar' },
    ],
  },
  {
    tabela: 'monstros_encontros',
    modo: 'repetivel',
    entradas: [
      { peso: 35, texto: 'Bando de Goblins emboscadores com arcos curtos e armadilhas de laço', data: { xp: 100, cr: '1/4' } },
      { peso: 30, texto: 'Esqueletos de guerreiros antigos empunhando lanças e escudos oxidados', data: { xp: 150, cr: '1/2' } },
      { peso: 25, texto: 'Aranhas gigantes tecendo teias pegajosas no teto abobadado', data: { xp: 200, cr: '1' } },
      { peso: 20, texto: 'Hobgoblins disciplinados com alabardas em formação de falange', data: { xp: 300, cr: '1' } },
      { peso: 18, texto: 'Aparição espectral atormentada sussurrando maldições do passado', data: { xp: 450, cr: '2' } },
      { peso: 14, texto: 'Basilisco empedrado em repouso perto de aventureiros petrificados', data: { xp: 700, cr: '3' } },
      { peso: 10, texto: 'Minotauro guardião do labirinto armado com machado duplo maciço', data: { xp: 1100, cr: '4' } },
      { peso: 6, texto: 'Quimera enfurecida com bafo de chamas e garras leoninas', data: { xp: 2300, cr: '6' } },
    ],
  },
];
