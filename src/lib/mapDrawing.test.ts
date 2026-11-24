import { describe, expect, it } from 'vitest';
import {
  buildSvgPathD,
  computeRotatedResize,
  denormalizePoints,
  getStrokeDashArray,
  normalizeStrokePoints,
  simplifyPoints,
} from './mapDrawing';

describe('mapDrawing engine', () => {
  it('simplifica pontos colineares mantendo início e fim', () => {
    const raw = [
      { x: 0, y: 0 },
      { x: 25, y: 0.2 },
      { x: 50, y: -0.1 },
      { x: 100, y: 0 },
    ];
    const simplified = simplifyPoints(raw, 2);
    expect(simplified).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
  });

  it('normaliza traços horizontais/verticais respeitando tamanho mínimo e reverte corretamente', () => {
    const box = normalizeStrokePoints(
      [
        { x: 100, y: 200 },
        { x: 300, y: 200 },
      ],
      16
    );
    expect(box.x).toBe(100);
    expect(box.width).toBe(200);
    expect(box.height).toBe(16);
    expect(box.points[0].x).toBe(0);
    expect(box.points[1].x).toBe(1);
    expect(box.points[0].y).toBeCloseTo(0.5, 3);

    const local = denormalizePoints(box.points, box.width, box.height);
    expect(local[0].x).toBe(0);
    expect(local[1].x).toBe(200);
    expect(local[0].y).toBeCloseTo(8, 2);
  });

  it('gera curvas Bézier cúbicas suaves quando smooth=true e polilinha reta quando smooth=false', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 50, y: 40 },
      { x: 100, y: 10 },
    ];
    const smoothD = buildSvgPathD(pts, true);
    const sharpD = buildSvgPathD(pts, false);
    expect(smoothD).toContain(' C ');
    expect(sharpD).toBe('M 0.00 0.00 L 50.00 40.00 L 100.00 10.00');
  });

  it('mantém borda esquerda ancorada ao redimensionar borda leste sem rotação', () => {
    const resized = computeRotatedResize(
      { x: 100, y: 50, width: 200, height: 100, rotation: 0 },
      'e',
      40,
      15
    );
    expect(resized.x).toBe(100);
    expect(resized.y).toBe(50);
    expect(resized.width).toBe(240);
    expect(resized.height).toBe(100);
  });

  it('projeta corretamente o delta ao redimensionar caixa rotacionada em 90 graus', () => {
    // Caixa rotacionada 90°: eixo local "e" aponta para +Y no mundo
    const resized = computeRotatedResize(
      { x: 100, y: 100, width: 200, height: 100, rotation: 90 },
      'e',
      0,
      40
    );
    expect(resized.width).toBe(240);
    expect(resized.height).toBe(100);
    // Centro move +20 em Y no mundo
    expect(resized.y + resized.height / 2).toBeCloseTo(170, 2);
  });

  it('retorna dash arrays proporcionais para estilos dashed e dotted', () => {
    expect(getStrokeDashArray('solid', 4)).toBeUndefined();
    expect(getStrokeDashArray('dashed', 4)).toContain(' ');
    expect(getStrokeDashArray('dotted', 4)).toContain('0.5 ');
  });
});
