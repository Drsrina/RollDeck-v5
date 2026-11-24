import type {
  DrawingPoint,
  DrawingPreset,
  DrawingStrokeStyle,
  DrawingStyleConfig,
} from '../types';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface DrawingPresetMeta {
  id: DrawingPreset;
  label: string;
  defaultColor: string;
  strokeWidth: number;
  opacity: number;
  strokeStyle: DrawingStrokeStyle;
  smooth: boolean;
}

export const DRAWING_PRESETS: Record<DrawingPreset, DrawingPresetMeta> = {
  free: {
    id: 'free',
    label: 'Livre',
    defaultColor: '#22d3ee',
    strokeWidth: 4,
    opacity: 0.92,
    strokeStyle: 'solid',
    smooth: true,
  },
  river: {
    id: 'river',
    label: 'Rio',
    defaultColor: '#38bdf8',
    strokeWidth: 9,
    opacity: 0.85,
    strokeStyle: 'solid',
    smooth: true,
  },
  trail: {
    id: 'trail',
    label: 'Trilha',
    defaultColor: '#f59e0b',
    strokeWidth: 3.5,
    opacity: 0.9,
    strokeStyle: 'dashed',
    smooth: true,
  },
  wall: {
    id: 'wall',
    label: 'Parede',
    defaultColor: '#e2e8f0',
    strokeWidth: 7,
    opacity: 1,
    strokeStyle: 'solid',
    smooth: false,
  },
};

export const DRAWING_COLOR_PALETTE = [
  '#38bdf8', // Rio / Água
  '#22d3ee', // Ciano
  '#f59e0b', // Trilha / Estrada
  '#e2e8f0', // Parede / Pedra
  '#10b981', // Floresta / Terreno
  '#f43f5e', // Perigo / Fronteira
  '#c084fc', // Arcano / Magia
  '#a3e635', // Ponto / Marca
];

export function createStyleFromPreset(
  preset: DrawingPreset,
  layerColor?: string
): DrawingStyleConfig {
  const meta = DRAWING_PRESETS[preset];
  return {
    preset: meta.id,
    color: preset === 'free' && layerColor ? layerColor : meta.defaultColor,
    strokeWidth: meta.strokeWidth,
    opacity: meta.opacity,
    strokeStyle: meta.strokeStyle,
    smooth: meta.smooth,
  };
}

function perpendicularDistance(
  point: DrawingPoint,
  lineStart: DrawingPoint,
  lineEnd: DrawingPoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  }
  const num = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  return num / Math.sqrt(lenSq);
}

/**
 * Simplifica uma polilinha usando Ramer-Douglas-Peucker para reduzir vértices mantendo a forma.
 */
export function simplifyPoints(points: DrawingPoint[], tolerance = 2.2): DrawingPoint[] {
  if (points.length <= 2 || tolerance <= 0) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[end]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, index + 1), tolerance);
    const right = simplifyPoints(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
}

/**
 * Converte pontos absolutos do mundo em uma caixa delimitadora (x, y, width, height)
 * com pontos normalizados entre 0 e 1 para escalonamento e rotação precisos.
 */
export function normalizeStrokePoints(
  worldPoints: DrawingPoint[],
  minBoxSize = 14
): {
  x: number;
  y: number;
  width: number;
  height: number;
  points: DrawingPoint[];
} {
  if (worldPoints.length === 0) {
    return { x: 0, y: 0, width: minBoxSize, height: minBoxSize, points: [{ x: 0.5, y: 0.5 }] };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of worldPoints) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const width = Math.max(minBoxSize, rawW);
  const height = Math.max(minBoxSize, rawH);

  // Centraliza a caixa mínima caso o traço seja perfeitamente horizontal/vertical ou um ponto único
  const x = rawW < minBoxSize ? (minX + maxX) / 2 - width / 2 : minX;
  const y = rawH < minBoxSize ? (minY + maxY) / 2 - height / 2 : minY;

  const points = worldPoints.map((p) => ({
    x: Number(((p.x - x) / width).toFixed(4)),
    y: Number(((p.y - y) / height).toFixed(4)),
  }));

  return { x, y, width, height, points };
}

export function denormalizePoints(
  normalizedPoints: DrawingPoint[],
  width: number,
  height: number
): DrawingPoint[] {
  return normalizedPoints.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));
}

/**
 * Gera o atributo `d` do SVG a partir de pontos em espaço local.
 * Quando `smooth` está ativo e há >= 3 pontos, aplica interpolação Catmull-Rom -> Bézier cúbica.
 */
export function buildSvgPathD(localPoints: DrawingPoint[], smooth: boolean): string {
  if (localPoints.length === 0) return '';
  if (localPoints.length === 1) {
    const p = localPoints[0];
    return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} L ${(p.x + 0.1).toFixed(2)} ${(p.y + 0.1).toFixed(2)}`;
  }

  if (!smooth || localPoints.length === 2) {
    return localPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  }

  let d = `M ${localPoints[0].x.toFixed(2)} ${localPoints[0].y.toFixed(2)}`;
  const tension = 1;

  for (let i = 0; i < localPoints.length - 1; i++) {
    const p0 = localPoints[Math.max(0, i - 1)];
    const p1 = localPoints[i];
    const p2 = localPoints[i + 1];
    const p3 = localPoints[Math.min(localPoints.length - 1, i + 2)];

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }

  return d;
}

export function getStrokeDashArray(
  style: DrawingStrokeStyle,
  strokeWidth: number
): string | undefined {
  if (style === 'dashed') {
    const dash = Math.max(6, strokeWidth * 2.4).toFixed(1);
    const gap = Math.max(4, strokeWidth * 1.7).toFixed(1);
    return `${dash} ${gap}`;
  }
  if (style === 'dotted') {
    const gap = Math.max(5, strokeWidth * 1.9).toFixed(1);
    return `0.5 ${gap}`;
  }
  return undefined;
}

/**
 * Calcula nova posição e dimensões (x, y, width, height) ao redimensionar um retângulo rotacionado,
 * mantendo a borda/canto oposto ancorado no espaço de mundo.
 */
export function computeRotatedResize(
  initialBox: { x: number; y: number; width: number; height: number; rotation: number },
  handle: ResizeHandle,
  dxWorld: number,
  dyWorld: number,
  options?: { minSize?: number; keepAspect?: boolean }
): { x: number; y: number; width: number; height: number } {
  const minSize = options?.minSize ?? 16;
  const rad = (initialBox.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Delta em coordenadas locais do objeto rotacionado
  const dxLocal = dxWorld * cos + dyWorld * sin;
  const dyLocal = -dxWorld * sin + dyWorld * cos;

  const halfW = initialBox.width / 2;
  const halfH = initialBox.height / 2;

  let left = -halfW;
  let right = halfW;
  let top = -halfH;
  let bottom = halfH;

  if (handle.includes('w')) {
    left = Math.min(right - minSize, left + dxLocal);
  }
  if (handle.includes('e')) {
    right = Math.max(left + minSize, right + dxLocal);
  }
  if (handle.includes('n')) {
    top = Math.min(bottom - minSize, top + dyLocal);
  }
  if (handle.includes('s')) {
    bottom = Math.max(top + minSize, bottom + dyLocal);
  }

  let newWidth = right - left;
  let newHeight = bottom - top;

  const isCorner = handle.length === 2;
  if (options?.keepAspect && isCorner && initialBox.width > 0 && initialBox.height > 0) {
    const aspect = initialBox.width / initialBox.height;
    const scaleX = newWidth / initialBox.width;
    const scaleY = newHeight / initialBox.height;
    if (Math.abs(scaleX - 1) >= Math.abs(scaleY - 1)) {
      newHeight = Math.max(minSize, newWidth / aspect);
      if (handle.includes('n')) {
        top = bottom - newHeight;
      } else {
        bottom = top + newHeight;
      }
    } else {
      newWidth = Math.max(minSize, newHeight * aspect);
      if (handle.includes('w')) {
        left = right - newWidth;
      } else {
        right = left + newWidth;
      }
    }
  }

  const shiftLocalX = (left + right) / 2;
  const shiftLocalY = (top + bottom) / 2;

  const shiftWorldX = shiftLocalX * cos - shiftLocalY * sin;
  const shiftWorldY = shiftLocalX * sin + shiftLocalY * cos;

  const oldCx = initialBox.x + initialBox.width / 2;
  const oldCy = initialBox.y + initialBox.height / 2;
  const newCx = oldCx + shiftWorldX;
  const newCy = oldCy + shiftWorldY;

  return {
    x: Number((newCx - newWidth / 2).toFixed(2)),
    y: Number((newCy - newHeight / 2).toFixed(2)),
    width: Number(newWidth.toFixed(2)),
    height: Number(newHeight.toFixed(2)),
  };
}
