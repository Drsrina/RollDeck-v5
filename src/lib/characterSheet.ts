import type { CharacterAttributeKey, CharacterSheetData } from '../types';

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
