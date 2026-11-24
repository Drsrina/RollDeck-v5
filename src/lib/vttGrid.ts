import type { NoteNode } from '../types';
import type {
  VttGridConfig,
  VttScene,
  VttSurfacePreset,
  VttToken,
  VttTokenAttack,
  VttTokenSize,
} from '../types/vtt';
import type { BiomaEncontro, EncontroGerado } from './forja/encounterGenerator';

const SQRT3 = Math.sqrt(3);

export interface Point2D {
  x: number;
  y: number;
}

export interface AxialHex {
  q: number;
  r: number;
}

export interface GridDistanceResult {
  cells: number;
  meters: number;
  feet: number;
  label: string;
}

/**
 * Computes the circumradius R of a pointy-top hex whose flat-to-flat width matches `cellSize`.
 */
export function getHexRadius(cellSize: number): number {
  return cellSize / SQRT3;
}

/**
 * Converts world pixel coordinates (x, y) into fractional pointy-top axial hex coordinates,
 * then rounds cleanly using cubic coordinates (q + r + s = 0).
 */
export function pixelToAxialHex(x: number, y: number, cellSize: number): AxialHex {
  const R = getHexRadius(cellSize);
  const fq = ((SQRT3 / 3) * x - (1 / 3) * y) / R;
  const fr = ((2 / 3) * y) / R;
  const fs = -fq - fr;

  let rq = Math.round(fq);
  let rr = Math.round(fr);
  const rs = Math.round(fs);

  const qDiff = Math.abs(rq - fq);
  const rDiff = Math.abs(rr - fr);
  const sDiff = Math.abs(rs - fs);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

/**
 * Converts pointy-top axial hex coordinates (q, r) back into world pixel center (x, y).
 */
export function axialHexToPixel(q: number, r: number, cellSize: number): Point2D {
  const R = getHexRadius(cellSize);
  return {
    x: R * SQRT3 * (q + r / 2),
    y: R * 1.5 * r,
  };
}

/**
 * Returns the 6 SVG polygon corner points for a pointy-top hexagon centered at (cx, cy).
 */
export function getHexPolygonPoints(cx: number, cy: number, cellSize: number): string {
  const R = getHexRadius(cellSize);
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((60 * i - 30) * Math.PI) / 180;
    const px = cx + R * Math.cos(angle);
    const py = cy + R * Math.sin(angle);
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return pts.join(' ');
}

/**
 * Computes all visible pointy-top hex centers within a world-space bounding box.
 */
export function getVisibleHexCenters(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  cellSize: number,
  maxHexes = 900
): { q: number; r: number; x: number; y: number }[] {
  const R = getHexRadius(cellSize);
  const rowStep = R * 1.5;
  const colStep = cellSize;

  const rMin = Math.floor(minY / rowStep) - 1;
  const rMax = Math.ceil(maxY / rowStep) + 1;
  const result: { q: number; r: number; x: number; y: number }[] = [];

  for (let r = rMin; r <= rMax; r++) {
    const xOffset = (r * colStep) / 2;
    const qMin = Math.floor((minX - xOffset) / colStep) - 1;
    const qMax = Math.ceil((maxX - xOffset) / colStep) + 1;

    for (let q = qMin; q <= qMax; q++) {
      const center = axialHexToPixel(q, r, cellSize);
      result.push({ q, r, x: center.x, y: center.y });
      if (result.length >= maxHexes) return result;
    }
  }
  return result;
}

/**
 * Snaps a world coordinate (x, y) to the active grid type and token footprint size.
 * - Square: odd sizes (1×1, 3×3) snap to cell centers; even sizes (2×2, 4×4) snap to grid intersections.
 * - Hex: snaps to exact pointy-top hex center.
 * - None: returns exact point unchanged.
 */
export function snapPointToGrid(
  x: number,
  y: number,
  grid: VttGridConfig,
  sizeCells: VttTokenSize = 1
): Point2D {
  if (!grid.snapToGrid || grid.type === 'none') {
    return { x, y };
  }

  const cs = Math.max(24, grid.cellSize);

  if (grid.type === 'square') {
    const isEven = sizeCells % 2 === 0;
    if (isEven) {
      return {
        x: Math.round(x / cs) * cs,
        y: Math.round(y / cs) * cs,
      };
    }
    return {
      x: Math.floor(x / cs) * cs + cs * 0.5,
      y: Math.floor(y / cs) * cs + cs * 0.5,
    };
  }

  // Pointy-top Hex snap
  const axial = pixelToAxialHex(x, y, cs);
  return axialHexToPixel(axial.q, axial.r, cs);
}

/**
 * Measures tactical tabletop distance between two world points.
 * - Square: D&D 5e Chebyshev grid steps (diagonals = 1 cell) when snap is on, or Euclidean cells.
 * - Hex: exact cubic axial step distance.
 * - None: Euclidean cell units.
 */
export function measureGridDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  grid: VttGridConfig
): GridDistanceResult {
  const cs = Math.max(24, grid.cellSize);
  let cells = 0;

  if (grid.type === 'hex') {
    const hA = pixelToAxialHex(ax, ay, cs);
    const hB = pixelToAxialHex(bx, by, cs);
    const dq = hB.q - hA.q;
    const dr = hB.r - hA.r;
    cells = (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
  } else if (grid.type === 'square') {
    const dxCells = Math.abs(bx - ax) / cs;
    const dyCells = Math.abs(by - ay) / cs;
    // Standard 5e tactical square distance (Chebyshev rounded to nearest 0.5 when unsnapped)
    const cheb = Math.max(dxCells, dyCells);
    cells = grid.snapToGrid ? Math.round(cheb) : Math.round(cheb * 2) / 2;
  } else {
    const euclid = Math.hypot(bx - ax, by - ay) / cs;
    cells = Math.round(euclid * 10) / 10;
  }

  const meters = Math.round(cells * grid.unitPerCellMeters * 10) / 10;
  // Standard tabletop conversion: 1.5m = 5 ft
  const feet = Math.round((meters / 1.5) * 5);

  const cellWord = cells === 1 ? 'cél' : 'céls';
  let label = `${cells} ${cellWord}`;
  if (grid.unitDisplay === 'm') {
    label = `${cells} ${cellWord} · ${meters}m`;
  } else if (grid.unitDisplay === 'ft') {
    label = `${cells} ${cellWord} · ${feet} pés`;
  } else {
    label = `${cells} ${cellWord} · ${meters}m (${feet} pés)`;
  }

  return { cells, meters, feet, label };
}

/**
 * Finds the nearest unoccupied grid slot spiraling outward from (originX, originY)
 * so imported heroes and encounter monsters never stack on top of each other.
 */
export function findFreeGridSlot(
  existingTokens: Pick<VttToken, 'x' | 'y' | 'sizeCells'>[],
  originX: number,
  originY: number,
  grid: VttGridConfig,
  sizeCells: VttTokenSize = 1
): Point2D {
  const cs = Math.max(24, grid.cellSize);
  const snappedOrigin = snapPointToGrid(originX, originY, { ...grid, snapToGrid: true }, sizeCells);

  const isOccupied = (cx: number, cy: number): boolean => {
    for (const t of existingTokens) {
      const minSep = ((t.sizeCells + sizeCells) * 0.5) * cs * 0.82;
      if (Math.hypot(t.x - cx, t.y - cy) < minSep) {
        return true;
      }
    }
    return false;
  };

  if (!isOccupied(snappedOrigin.x, snappedOrigin.y)) {
    return snappedOrigin;
  }

  const step = cs * Math.max(1, sizeCells);
  for (let ring = 1; ring <= 14; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const candidate = snapPointToGrid(
          snappedOrigin.x + dx * step,
          snappedOrigin.y + dy * step,
          { ...grid, snapToGrid: true },
          sizeCells
        );
        if (!isOccupied(candidate.x, candidate.y)) {
          return candidate;
        }
      }
    }
  }

  return { x: snappedOrigin.x + step, y: snappedOrigin.y };
}

/**
 * Infers tactical footprint (1x1..4x4) from a creature size string (Portuguese/English).
 */
export function parseMonsterSizeCells(tipoTamanho?: string): VttTokenSize {
  if (!tipoTamanho) return 1;
  const norm = tipoTamanho.toLowerCase();
  if (norm.includes('imenso') || norm.includes('colossal') || norm.includes('gargantuan')) return 4;
  if (norm.includes('enorme') || norm.includes('huge')) return 3;
  if (norm.includes('grande') || norm.includes('large')) return 2;
  return 1;
}

/**
 * Maps a Forge encounter biome into the closest built-in VTT tactical tabletop surface.
 */
export function mapBiomaToSurfacePreset(bioma?: BiomaEncontro): VttSurfacePreset {
  switch (bioma) {
    case 'floresta':
    case 'pantano':
    case 'planicie':
      return 'forest';
    case 'masmorra':
    case 'urbano':
      return 'dungeon';
    case 'montanha':
    case 'costa':
      return 'cavern';
    case 'deserto':
      return 'parchment';
    default:
      return 'slate';
  }
}

/**
 * Converts a Notes Map Character Sheet node into a combat-ready VTT Ally Token.
 */
export function createTokenFromCharacterNote(note: NoteNode, pos: Point2D): VttToken {
  const sheet = note.characterSheet;
  const hpMax = Math.max(1, sheet?.hpMax ?? 20);
  const hpCurrent = Math.min(hpMax, Math.max(0, sheet?.hpCurrent ?? hpMax));
  const attacks: VttTokenAttack[] = (sheet?.attacks || []).map((a) => ({
    id: a.id || crypto.randomUUID(),
    name: a.name,
    bonus: a.bonus,
    damage: a.damage,
  }));

  return {
    id: `tok-${crypto.randomUUID()}`,
    name: note.title || 'Herói',
    faction: 'ally',
    color: note.color || '#10b981',
    avatarUrl: sheet?.avatarUrl || undefined,
    sizeCells: 1,
    x: pos.x,
    y: pos.y,
    rotation: 0,
    locked: false,
    hidden: false,
    hpCurrent,
    hpMax,
    hpTemp: sheet?.hpTemp ?? 0,
    ac: sheet?.ac ?? 12,
    speed: sheet?.speed || '9m',
    initiativeMod: sheet?.initiative ?? 0,
    initiativeValue: null,
    conditions: [...(sheet?.conditions || [])],
    notes: sheet
      ? `${sheet.race} · ${sheet.characterClass} Nv. ${sheet.level}`
      : note.body.slice(0, 120),
    sourceNoteId: note.id,
    sourceRole: sheet ? `${sheet.characterClass} Nv.${sheet.level}` : 'Personagem',
    bloodiedThreshold: Math.floor(hpMax / 2),
    attacks,
  };
}

/**
 * Expands a generated Forja de Mundos encounter into individual numbered enemy VTT tokens
 * placed cleanly in a tactical formation without overlaps.
 */
export function createTokensFromEncounter(
  encounter: EncontroGerado,
  existingTokens: VttToken[],
  grid: VttGridConfig,
  originX = 128,
  originY = 0
): VttToken[] {
  const created: VttToken[] = [];
  const occupied: Pick<VttToken, 'x' | 'y' | 'sizeCells'>[] = [...existingTokens];

  const roleColors: Record<string, string> = {
    Chefe: '#dc2626',
    Bruto: '#e11d48',
    Escaramuçador: '#f97316',
    Atirador: '#f59e0b',
    Conjurador: '#a855f7',
    Controlador: '#ec4899',
  };

  for (const monster of encounter.monstros) {
    const qty = Math.max(1, Math.min(monster.quantidade, 24));
    const sizeCells = parseMonsterSizeCells(monster.tipoTamanho);
    const color = roleColors[monster.papelTatico] || '#f43f5e';
    const initMod =
      encounter.sistema === 'dnd55' && monster.iniciativaMod55 !== undefined
        ? monster.iniciativaMod55
        : monster.iniciativaMod;

    const attacks: VttTokenAttack[] = monster.ataques.map((atk) => ({
      id: `atk-${crypto.randomUUID()}`,
      name: atk.nome,
      bonus: atk.acerto,
      damage: atk.dadosDano,
      damageType: atk.tipoDano,
      effect: atk.efeito55,
    }));

    for (let i = 0; i < qty; i++) {
      const slot = findFreeGridSlot(occupied, originX, originY, grid, sizeCells);
      const token: VttToken = {
        id: `tok-${crypto.randomUUID()}`,
        name: qty > 1 ? `${monster.nome} ${i + 1}` : monster.nome,
        faction: 'enemy',
        color,
        sizeCells,
        x: slot.x,
        y: slot.y,
        rotation: 0,
        locked: false,
        hidden: false,
        hpCurrent: Math.max(1, monster.pvMedio),
        hpMax: Math.max(1, monster.pvMedio),
        hpTemp: 0,
        ac: monster.ca,
        speed: monster.deslocamento,
        initiativeMod: initMod,
        initiativeValue: null,
        conditions: [],
        notes: monster.efeitoSangrando
          ? `Sangrando (≤${monster.pvSangrando} PV): ${monster.efeitoSangrando}`
          : `${monster.tipoExibicao} · ND ${monster.cr} · ${monster.papelTatico}`,
        sourceRole: monster.papelTatico,
        sourceCr: `ND ${monster.cr}`,
        bloodiedThreshold: monster.pvSangrando,
        attacks,
      };
      created.push(token);
      occupied.push(token);
    }
  }

  return created;
}

/**
 * Creates a clean default tactical VTT scene ready for immediate play.
 */
export function createDefaultVttScene(
  name = 'Arena Principal',
  surfacePreset: VttSurfacePreset = 'slate'
): VttScene {
  const now = Date.now();
  return {
    id: `scene-${crypto.randomUUID()}`,
    name,
    createdAt: now,
    updatedAt: now,
    surfacePreset,
    background: null,
    grid: {
      type: 'square',
      cellSize: 64,
      unitPerCellMeters: 1.5,
      unitDisplay: 'both',
      snapToGrid: true,
      opacity: 0.24,
      color: '#94a3b8',
    },
    camera: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    tokens: [],
    combat: {
      active: false,
      round: 1,
      activeTokenId: null,
      order: [],
    },
  };
}
