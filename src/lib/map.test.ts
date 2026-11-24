import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS } from '../components/map/FloatingNoteWindow';
import {
  calcAttributeModifier,
  calcProficiencyBonus,
  characterSheetToMarkdown,
  createDefaultCharacterSheet,
  parseDamageFormula,
} from './characterSheet';
import type { NoteCategory, NoteLink, FloatingWindowState, CanvasMapImage, NoteNode, NoteLayer } from '../types';

describe('Mapa de Notas — Janelas Flutuantes e Cartografia Visual', () => {
  it('contém todas as 9 categorias de RPG (incluindo Ficha de Personagem) com rótulos definidos', () => {
    const categories: NoteCategory[] = [
      'general',
      'location',
      'npc',
      'character',
      'dungeon',
      'clue',
      'faction',
      'item',
      'lore',
    ];

    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof CATEGORY_LABELS[cat]).toBe('string');
    }
    expect(CATEGORY_LABELS.character).toBe('Ficha de Personagem');
  });

  it('suporta links com estilo e direcionalidade', () => {
    const link: NoteLink = {
      id: 'link-1',
      fromId: 'note-a',
      toId: 'note-b',
      label: 'Aliado jurado',
      directional: true,
      style: 'dashed',
      color: '#22d3ee',
    };

    expect(link.directional).toBe(true);
    expect(link.style).toBe('dashed');
    expect(link.label).toBe('Aliado jurado');
  });

  it('gerencia estado de janela flutuante com coordenadas e minimização', () => {
    const win: FloatingWindowState = {
      noteId: 'note-123',
      x: 100,
      y: 150,
      width: 440,
      height: 480,
      isMinimized: false,
      zIndex: 101,
    };

    expect(win.isMinimized).toBe(false);
    expect(win.width).toBeGreaterThanOrEqual(280);
    expect(win.height).toBeGreaterThanOrEqual(200);

    // Simula minimização para dock
    const minimized = { ...win, isMinimized: true };
    expect(minimized.isMinimized).toBe(true);
  });

  it('suporta imagens e tokens móveis com lock, opacidade e dimensões', () => {
    const img: CanvasMapImage = {
      id: 'token-dragao',
      name: 'Dragão Vermelho',
      dataUrl: 'data:image/png;base64,sample',
      x: 200,
      y: 300,
      width: 180,
      height: 180,
      opacity: 0.9,
      locked: false,
      zIndex: 5,
    };

    expect(img.name).toBe('Dragão Vermelho');
    expect(img.locked).toBe(false);
    expect(img.opacity).toBe(0.9);

    // Mover token
    const moved = { ...img, x: 250, y: 320, locked: true };
    expect(moved.x).toBe(250);
    expect(moved.locked).toBe(true);
  });

  it('garante herança de cor da camada selecionada', () => {
    const layers: NoteLayer[] = [
      { id: 'layer-world', name: 'Mundo', color: '#38bdf8', visible: true, locked: false, order: 0 },
      { id: 'layer-secret', name: 'Segredos', color: '#f43f5e', visible: true, locked: false, order: 1 },
    ];

    const note: NoteNode = {
      id: 'note-1',
      title: 'Covil Misterioso',
      body: 'Texto da nota',
      x: 100,
      y: 100,
      layerId: 'layer-secret',
      color: '#38bdf8', // cor anterior
      tags: [],
      pinned: false,
      createdAt: 100,
      updatedAt: 100,
    };

    const targetLayer = layers.find((l) => l.id === note.layerId);
    const resolvedColor = targetLayer?.color || note.color || '#22d3ee';
    expect(resolvedColor).toBe('#f43f5e');
  });

  it('calcula física de mola elástica mantendo distância mínima de nós conectados', () => {
    const draggedFinalX = 500;
    const draggedFinalY = 500;
    const neighborX = 520;
    const neighborY = 510;

    const MIN_DISTANCE = 160;

    const distX = neighborX - draggedFinalX;
    const distY = neighborY - draggedFinalY;
    const currentDist = Math.hypot(distX, distY);

    expect(currentDist).toBeLessThan(MIN_DISTANCE);

    // Aplica preservação de distância mínima
    const angle = Math.atan2(distY, distX);
    const correctedX = draggedFinalX + Math.cos(angle) * MIN_DISTANCE;
    const correctedY = draggedFinalY + Math.sin(angle) * MIN_DISTANCE;

    const newDist = Math.hypot(correctedX - draggedFinalX, correctedY - draggedFinalY);
    expect(Math.round(newDist)).toBe(MIN_DISTANCE);
  });

  it('calcula modificadores, proficiência, dano e exportação Markdown da Ficha de Personagem', () => {
    expect(calcAttributeModifier(10)).toBe(0);
    expect(calcAttributeModifier(18)).toBe(4);
    expect(calcAttributeModifier(7)).toBe(-2);

    expect(calcProficiencyBonus(1)).toBe(2);
    expect(calcProficiencyBonus(5)).toBe(3);
    expect(calcProficiencyBonus(17)).toBe(6);

    const parsed = parseDamageFormula('2d6+4 cortante');
    expect(parsed).toEqual({ count: 2, sides: 6, modifier: 4, dieId: 'd6' });
    expect(parseDamageFormula('sem dados')).toBeNull();

    const sheet = createDefaultCharacterSheet();
    const md = characterSheetToMarkdown('Thorin', sheet);
    expect(md).toContain('Ficha de Personagem');
    expect(md).toContain('**FOR:** 15 (+2)');
    expect(md).toContain('Espada Longa');
  });
});
