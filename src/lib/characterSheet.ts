import type { CharacterAttributeKey, CharacterSheetData, SidekickRole } from '../types';

export const SIDEKICK_ROLE_META: Record<
  SidekickRole,
  {
    label: string;
    subtitle: string;
    defaultClass: string;
    defaultRace: string;
  }
> = {
  warrior: {
    label: 'Combatente',
    subtitle: 'Guarda-costas, escudeiro ou soldado de linha de frente',
    defaultClass: 'Sidekick Combatente',
    defaultRace: 'Humano',
  },
  expert: {
    label: 'Especialista',
    subtitle: 'Batedor, ladino ágil ou ajudante tático de perícias',
    defaultClass: 'Sidekick Especialista',
    defaultRace: 'Halfling',
  },
  spellcaster: {
    label: 'Conjurador',
    subtitle: 'Acólito, aprendiz arcano ou curandeiro de apoio',
    defaultClass: 'Sidekick Conjurador',
    defaultRace: 'Elfo',
  },
  companion: {
    label: 'Companheiro',
    subtitle: 'Fera leal, montaria treinada ou familiar místico',
    defaultClass: 'Companheiro Fiel',
    defaultRace: 'Fera / Criatura',
  },
};

export const ATTRIBUTE_META: {
  key: CharacterAttributeKey;
  short: string;
  label: string;
}[] = [
  { key: 'str', short: 'FOR', label: 'Força' },
  { key: 'dex', short: 'DES', label: 'Destreza' },
  { key: 'con', short: 'CON', label: 'Constituição' },
  { key: 'int', short: 'INT', label: 'Inteligência' },
  { key: 'wis', short: 'SAB', label: 'Sabedoria' },
  { key: 'cha', short: 'CAR', label: 'Carisma' },
];

export const COMMON_CHARACTER_CONDITIONS: string[] = [
  'Inspirado',
  'Concentrando',
  'Caído',
  'Envenenado',
  'Amedrontado',
  'Atordoado',
  'Agarrado',
  'Invisível',
  'Exausto',
  'Inconsciente',
];

export const COMMON_RPG_SKILLS: { name: string; attr: CharacterAttributeKey }[] = [
  { name: 'Acrobacia', attr: 'dex' },
  { name: 'Arcanismo', attr: 'int' },
  { name: 'Atletismo', attr: 'str' },
  { name: 'Atuação', attr: 'cha' },
  { name: 'Enganação', attr: 'cha' },
  { name: 'Furtividade', attr: 'dex' },
  { name: 'História', attr: 'int' },
  { name: 'Intimidação', attr: 'cha' },
  { name: 'Intuição', attr: 'wis' },
  { name: 'Investigação', attr: 'int' },
  { name: 'Medicina', attr: 'wis' },
  { name: 'Natureza', attr: 'int' },
  { name: 'Percepção', attr: 'wis' },
  { name: 'Persuasão', attr: 'cha' },
  { name: 'Prestidigitação', attr: 'dex' },
  { name: 'Religião', attr: 'int' },
  { name: 'Sobrevivência', attr: 'wis' },
];

export function calcAttributeModifier(score: number): number {
  const safe = Number.isFinite(score) ? score : 10;
  return Math.floor((safe - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function calcProficiencyBonus(level: number): number {
  const safeLevel = Math.max(1, Math.min(20, Math.floor(level || 1)));
  return Math.floor((safeLevel - 1) / 4) + 2;
}

export function createDefaultCharacterSheet(): CharacterSheetData {
  return {
    playerName: '',
    race: 'Humano',
    characterClass: 'Guerreiro',
    level: 1,
    alignment: 'Neutro e Bom',
    background: 'Soldado',
    hpCurrent: 12,
    hpMax: 12,
    hpTemp: 0,
    ac: 14,
    initiative: 1,
    speed: '9m',
    proficiencyBonus: 2,
    passivePerception: 12,
    attributes: {
      str: 15,
      dex: 12,
      con: 14,
      int: 10,
      wis: 12,
      cha: 10,
    },
    savingThrowProficiencies: ['str', 'con'],
    skills: ['Atletismo', 'Percepção'],
    attacks: [
      {
        id: 'atk-default-1',
        name: 'Espada Longa',
        bonus: 4,
        damage: '1d8+2',
      },
    ],
    conditions: [],
    inventory: '- Armadura de Couro Batido\n- Escudo\n- Mochila de Aventureiro\n- 15 PO',
    spellsAndFeatures: '- Retomar Fôlego (1x/descanso curto)\n- Estilo de Luta',
  };
}

export interface ParsedDiceTerm {
  count: number;
  sides: number;
  modifier: number;
  dieId: string;
}

/**
 * Extracts a rollable dice expression from strings like "1d8+3 cortante" or "2d6 - 1 ígneo".
 */
export function parseDamageFormula(raw: string): ParsedDiceTerm | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*[dD]\s*(\d+)\s*([+-]\s*\d+)?/);
  if (!match) return null;

  const count = Math.max(1, Math.min(50, parseInt(match[1], 10)));
  const sides = Math.max(2, Math.min(1000, parseInt(match[2], 10)));
  const modifier = match[3] ? parseInt(match[3].replace(/\s+/g, ''), 10) : 0;

  return {
    count,
    sides,
    modifier: Number.isFinite(modifier) ? modifier : 0,
    dieId: `d${sides}`,
  };
}

export function characterSheetToMarkdown(title: string, sheet: CharacterSheetData): string {
  const attrsLine = ATTRIBUTE_META.map(
    (m) => `**${m.short}:** ${sheet.attributes[m.key]} (${formatModifier(calcAttributeModifier(sheet.attributes[m.key]))})`
  ).join(' | ');

  const attacksSection =
    sheet.attacks.length > 0
      ? sheet.attacks
          .map((a) => `- **${a.name}**: ${formatModifier(a.bonus)} para acertar · Dano \`${a.damage}\``)
          .join('\n')
      : '- Nenhum ataque registrado';

  const lines = [
    `> **Ficha de Personagem** — ${sheet.race || 'Raça'} · ${sheet.characterClass || 'Classe'} Nível ${sheet.level}${
      sheet.playerName ? ` · Jogador: ${sheet.playerName}` : ''
    }`,
    '',
    `**PV:** ${sheet.hpCurrent}/${sheet.hpMax}${sheet.hpTemp > 0 ? ` (+${sheet.hpTemp} temp)` : ''} | **CA:** ${sheet.ac} | **Iniciativa:** ${formatModifier(sheet.initiative)} | **Deslocamento:** ${sheet.speed || '9m'} | **Proficiência:** ${formatModifier(sheet.proficiencyBonus)}`,
    '',
    '### Atributos',
    attrsLine,
    '',
    '### Ataques & Ações',
    attacksSection,
  ];

  if (sheet.skills.length > 0) {
    lines.push('', `**Perícias Treinadas:** ${sheet.skills.join(', ')}`);
  }
  if (sheet.conditions.length > 0) {
    lines.push(`**Condições Ativas:** ${sheet.conditions.join(', ')}`);
  }
  if (sheet.spellsAndFeatures?.trim()) {
    lines.push('', '### Habilidades & Magias', sheet.spellsAndFeatures.trim());
  }
  if (sheet.inventory?.trim()) {
    lines.push('', '### Inventário & Equipamentos', sheet.inventory.trim());
  }

  return lines.join('\n');
}

export function createDefaultSidekickSheet(
  role: SidekickRole = 'warrior',
  playerName?: string
): CharacterSheetData {
  const meta = SIDEKICK_ROLE_META[role];
  if (role === 'warrior') {
    return {
      playerName: playerName || '',
      race: meta.defaultRace,
      characterClass: meta.defaultClass,
      level: 1,
      alignment: 'Leal e Bom',
      background: 'Guarda-costas / Escudeiro',
      hpCurrent: 16,
      hpMax: 16,
      hpTemp: 0,
      ac: 15,
      initiative: 1,
      speed: '9m',
      proficiencyBonus: 2,
      passivePerception: 11,
      attributes: { str: 15, dex: 12, con: 14, int: 9, wis: 11, cha: 10 },
      savingThrowProficiencies: ['str', 'con'],
      skills: ['Atletismo', 'Percepção'],
      attacks: [
        { id: `atk-${crypto.randomUUID()}`, name: 'Espada Curta', bonus: 4, damage: '1d6+2 perfurante' },
        { id: `atk-${crypto.randomUUID()}`, name: 'Lança (Arremesso)', bonus: 4, damage: '1d6+2 perfurante' },
      ],
      conditions: [],
      inventory: 'Cota de malha leve, escudo de madeira, espada curta, rações (3 dias).',
      spellsAndFeatures: 'Papel Marcial (Defensor): impõe desvantagem com reação em ataques contra um aliado adjacente.\nRetomar Fôlego (1/descanso curto): recupera 1d10 + nível PV.',
    };
  }

  if (role === 'expert') {
    return {
      playerName: playerName || '',
      race: meta.defaultRace,
      characterClass: meta.defaultClass,
      level: 1,
      alignment: 'Neutro e Bom',
      background: 'Batedor / Mensageiro',
      hpCurrent: 12,
      hpMax: 12,
      hpTemp: 0,
      ac: 14,
      initiative: 3,
      speed: '9m',
      proficiencyBonus: 2,
      passivePerception: 13,
      attributes: { str: 10, dex: 16, con: 12, int: 13, wis: 12, cha: 12 },
      savingThrowProficiencies: ['dex', 'int'],
      skills: ['Furtividade', 'Percepção', 'Investigação', 'Acrobacia'],
      attacks: [
        { id: `atk-${crypto.randomUUID()}`, name: 'Adaga', bonus: 5, damage: '1d4+3 perfurante' },
        { id: `atk-${crypto.randomUUID()}`, name: 'Arco Curto', bonus: 5, damage: '1d6+3 perfurante' },
      ],
      conditions: [],
      inventory: 'Armadura de couro, ferramentas de ladrão, 2 adagas, arco curto e 20 flechas.',
      spellsAndFeatures: 'Prestativo: pode usar a ação Ajudar como ação bônus para conceder vantagem a um aliado.\nEspecialista em Perícias: bônus dobrado em Furtividade e Percepção.',
    };
  }

  if (role === 'spellcaster') {
    return {
      playerName: playerName || '',
      race: meta.defaultRace,
      characterClass: meta.defaultClass,
      level: 1,
      alignment: 'Neutro e Bom',
      background: 'Acólito / Aprendiz',
      hpCurrent: 10,
      hpMax: 10,
      hpTemp: 0,
      ac: 12,
      initiative: 1,
      speed: '9m',
      proficiencyBonus: 2,
      passivePerception: 13,
      attributes: { str: 8, dex: 12, con: 12, int: 14, wis: 15, cha: 11 },
      savingThrowProficiencies: ['wis', 'int'],
      skills: ['Arcanismo', 'Medicina', 'Religião'],
      attacks: [
        { id: `atk-${crypto.randomUUID()}`, name: 'Raio de Fogo', bonus: 4, damage: '1d10 ígneo' },
        { id: `atk-${crypto.randomUUID()}`, name: 'Cajado', bonus: 1, damage: '1d6-1 concussão' },
      ],
      conditions: [],
      inventory: 'Foco arcano/símbolo sagrado, cajado, grimório de anotações, bolsa de componentes.',
      spellsAndFeatures: 'Truques: Raio de Fogo, Orientação, Luz.\n1º Círculo (2 espaços): Curar Ferimentos (1d8+2), Bênção, Escudo Arcano.',
    };
  }

  // companion
  return {
    playerName: playerName || '',
    race: meta.defaultRace,
    characterClass: meta.defaultClass,
    level: 1,
    alignment: 'Neutro',
    background: 'Companheiro Leal',
    hpCurrent: 13,
    hpMax: 13,
    hpTemp: 0,
    ac: 13,
    initiative: 2,
    speed: '12m',
    proficiencyBonus: 2,
    passivePerception: 14,
    attributes: { str: 13, dex: 15, con: 13, int: 4, wis: 14, cha: 8 },
    savingThrowProficiencies: ['dex', 'wis'],
    skills: ['Percepção', 'Furtividade', 'Sobrevivência'],
    attacks: [
      { id: `atk-${crypto.randomUUID()}`, name: 'Mordida / Investida', bonus: 4, damage: '1d6+2 perfurante' },
    ],
    conditions: [],
    inventory: 'Coleira reforçada, alforje leve.',
    spellsAndFeatures: 'Sentidos Aguçados: vantagem em testes de Percepção baseados em audição ou olfato.\nTática de Matilha: vantagem no ataque se um aliado estiver adjacente ao alvo.',
  };
}

