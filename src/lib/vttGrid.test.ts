import { describe, expect, it } from 'vitest';
import { gerarEncontroAleatorio } from './forja/encounterGenerator';
import {
  axialHexToPixel,
  createDefaultVttScene,
  createTokenFromCharacterNote,
  createTokensFromEncounter,
  findFreeGridSlot,
  measureGridDistance,
  parseMonsterSizeCells,
  pixelToAxialHex,
  snapPointToGrid,
} from './vttGrid';
import type { NoteNode } from '../types';
import type { VttGridConfig } from '../types/vtt';

const SQUARE_GRID: VttGridConfig = {
  type: 'square',
  cellSize: 64,
  unitPerCellMeters: 1.5,
  unitDisplay: 'both',
  snapToGrid: true,
  opacity: 0.25,
  color: '#94a3b8',
};

const HEX_GRID: VttGridConfig = {
  ...SQUARE_GRID,
  type: 'hex',
};

describe('vttGrid math & importers', () => {
  it('snaps odd square tokens (1x1, 3x3) to cell centers and even tokens (2x2) to grid intersections', () => {
    const s1 = snapPointToGrid(12, 50, SQUARE_GRID, 1);
    expect(s1).toEqual({ x: 32, y: 32 });

    const s2 = snapPointToGrid(55, 70, SQUARE_GRID, 2);
    expect(s2).toEqual({ x: 64, y: 64 });

    const unsnapped = snapPointToGrid(19, 41, { ...SQUARE_GRID, snapToGrid: false }, 1);
    expect(unsnapped).toEqual({ x: 19, y: 41 });
  });

  it('round-trips pointy-top axial hex coordinates and snaps accurately', () => {
    const center = axialHexToPixel(3, -2, HEX_GRID.cellSize);
    const axial = pixelToAxialHex(center.x + 5, center.y - 4, HEX_GRID.cellSize);
    expect(axial).toEqual({ q: 3, r: -2 });

    const snapped = snapPointToGrid(center.x + 7, center.y - 6, HEX_GRID, 1);
    expect(snapped.x).toBeCloseTo(center.x, 4);
    expect(snapped.y).toBeCloseTo(center.y, 4);
  });

  it('measures square Chebyshev and hex axial distances with meters and feet', () => {
    // 3 cells diagonally in square grid = 3 cells = 4.5m = 15 ft
    const sqDist = measureGridDistance(32, 32, 32 + 64 * 3, 32 + 64 * 3, SQUARE_GRID);
    expect(sqDist.cells).toBe(3);
    expect(sqDist.meters).toBe(4.5);
    expect(sqDist.feet).toBe(15);
    expect(sqDist.label).toContain('4.5m');
    expect(sqDist.label).toContain('15 pés');

    // Hex axial distance from (0,0) to (2,1) = (|2| + |3| + |1|)/2 = 3 hexes
    const a = axialHexToPixel(0, 0, HEX_GRID.cellSize);
    const b = axialHexToPixel(2, 1, HEX_GRID.cellSize);
    const hexDist = measureGridDistance(a.x, a.y, b.x, b.y, HEX_GRID);
    expect(hexDist.cells).toBe(3);
    expect(hexDist.meters).toBe(4.5);
    expect(hexDist.feet).toBe(15);
  });

  it('finds non-overlapping free grid slots when origin is occupied', () => {
    const first = findFreeGridSlot([], 0, 0, SQUARE_GRID, 1);
    const second = findFreeGridSlot([{ x: first.x, y: first.y, sizeCells: 1 }], 0, 0, SQUARE_GRID, 1);
    expect(Math.hypot(second.x - first.x, second.y - first.y)).toBeGreaterThanOrEqual(64 * 0.9);
  });

  it('parses creature size footprints in Portuguese and English', () => {
    expect(parseMonsterSizeCells('Humanoide Médio')).toBe(1);
    expect(parseMonsterSizeCells('Gigante Grande')).toBe(2);
    expect(parseMonsterSizeCells('Dragão Enorme')).toBe(3);
    expect(parseMonsterSizeCells('Monstruosidade Imenso')).toBe(4);
  });

  it('converts a Character Sheet NoteNode into an ally VTT token with synced stats', () => {
    const note: NoteNode = {
      id: 'note-hero-1',
      title: 'Kaelen Forja-Aço',
      body: 'Anão guerreiro veterano',
      tags: ['heroi'],
      layerId: 'default',
      pinned: false,
      category: 'character',
      color: '#22d3ee',
      x: 0,
      y: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      characterSheet: {
        playerName: 'Lucas',
        race: 'Anão',
        characterClass: 'Guerreiro',
        level: 5,
        background: 'Soldado',
        alignment: 'Leal e Bom',
        ac: 18,
        hpCurrent: 42,
        hpMax: 48,
        hpTemp: 5,
        speed: '7,5m',
        initiative: 2,
        proficiencyBonus: 3,
        passivePerception: 13,
        attributes: { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 10 },
        savingThrowProficiencies: ['str', 'con'],
        skills: ['Atletismo'],
        attacks: [{ id: 'a1', name: 'Machado de Batalha', bonus: 7, damage: '1d8+4' }],
        conditions: ['Concentrando'],
        inventory: 'Machado de Batalha, Cota de Malha',
        spellsAndFeatures: 'Retomar Fôlego, Surto de Ação',
        avatarUrl: 'data:image/webp;base64,abc',
      },
    };

    const token = createTokenFromCharacterNote(note, { x: 32, y: 32 });
    expect(token.faction).toBe('ally');
    expect(token.sourceNoteId).toBe('note-hero-1');
    expect(token.hpCurrent).toBe(42);
    expect(token.hpMax).toBe(48);
    expect(token.hpTemp).toBe(5);
    expect(token.ac).toBe(18);
    expect(token.initiativeMod).toBe(2);
    expect(token.conditions).toEqual(['Concentrando']);
    expect(token.attacks).toHaveLength(1);
    expect(token.avatarUrl).toBe('data:image/webp;base64,abc');
  });

  it('expands a Forja encounter into distinct numbered non-overlapping enemy tokens', () => {
    const scene = createDefaultVttScene();
    const enc = gerarEncontroAleatorio(4242, {
      nivelGrupo: 4,
      tamanhoGrupo: 4,
      dificuldade: 'moderada',
      bioma: 'masmorra',
      sistema: 'dnd55',
      foco: 'combate',
    });

    const expectedCount = enc.monstros.reduce((sum, m) => sum + Math.min(m.quantidade, 24), 0);
    const tokens = createTokensFromEncounter(enc, scene.tokens, scene.grid, 128, 0);

    expect(tokens.length).toBe(expectedCount);
    expect(tokens.every((t) => t.faction === 'enemy')).toBe(true);
    expect(tokens.every((t) => t.hpMax > 0 && t.ac > 0)).toBe(true);

    // Ensure no two spawned tokens occupy the exact same center point
    const coords = new Set(tokens.map((t) => `${Math.round(t.x)},${Math.round(t.y)}`));
    expect(coords.size).toBe(tokens.length);
  });
});
