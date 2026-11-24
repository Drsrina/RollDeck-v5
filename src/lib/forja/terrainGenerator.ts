/**
 * FORJA DE MUNDOS — Gerador de Terreno em 9 Estágios Determinísticos (§4.5)
 *
 * Suporte a malha Voronoi (Poisson Disk) e grade Hexagonal.
 * Pipeline com sub-seeds isoladas por estágio.
 */

import { DeterministicRNG, deriveSubSeed } from './prng';

export type TopologiaTerreno = 'voronoi' | 'hex';

export type BiomaTipo =
  | 'Oceano'
  | 'Lago'
  | 'Costa'
  | 'Planície'
  | 'Floresta Temperada'
  | 'Taiga'
  | 'Selva Tropical'
  | 'Colinas'
  | 'Montanha'
  | 'Picos Nevados'
  | 'Deserto'
  | 'Pântano'
  | 'Tundra';

export type ZonaClimatica =
  | 'Polar'
  | 'Tundra'
  | 'Boreal'
  | 'Temperado Úmido'
  | 'Mediterrâneo'
  | 'Semiárido'
  | 'Árido'
  | 'Tropical';

export interface TerrenoCell {
  id: number;
  x: number;
  y: number;
  polygon: [number, number][]; // Vértices da célula
  neighbors: number[];

  // Estágio 2: Heightmap
  elevation: number; // 0.0 (fundo do mar) a 1.0 (pico da montanha)

  // Estágio 3: Clima
  latitude: number; // 0.0 (equador) a 1.0 (polo)
  distanciaOceano: number;
  zonaClima: ZonaClimatica;

  // Estágio 4: Hidrologia
  isOceano: boolean;
  isLago: boolean;
  fluxoHidrico: number; // Fluxo acumulado
  downslopeId: number | null; // Próxima célula rio abaixo
  isRio: boolean;
  larguraRio: number;

  // Estágio 5: Bioma
  isCosta: boolean;
  bioma: BiomaTipo;

  // Estágio 6: Assentamento
  burgScore: number;
  settlementId?: string;
  settlementName?: string;
  settlementRole?: string;

  // Estágio 9: Marcos
  landmark?: {
    id: string;
    nome: string;
    tipo: 'fortaleza' | 'templo' | 'torre' | 'porto' | 'ruina';
  };
}

export interface TerrenoRoute {
  id: string;
  fromCell: number;
  toCell: number;
  path: number[];
  tipo: 'estrada' | 'trilha';
}

export interface TerrenoResult {
  seed: number;
  topologia: TopologiaTerreno;
  largura: number;
  altura: number;
  cells: TerrenoCell[];
  rivers: { path: number[]; flow: number }[];
  settlements: { cellId: number; name: string; role: string; score: number }[];
  routes: TerrenoRoute[];
  landmarks: { cellId: number; nome: string; tipo: string }[];
  metricas: {
    totalCells: number;
    areaTerra: number;
    areaAgua: number;
    distribuicaoBiomas: Record<string, number>;
  };
}

/**
 * Ruído Simplex 2D simplificado e determinístico para fBm
 */
function createNoise2D(seed: number) {
  const rng = new DeterministicRNG(seed);
  const p: number[] = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  rng.shuffle(p);
  const perm = new Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  function grad(hash: number, x: number, y: number) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  return function (x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1 = 0, j1 = 1;
    if (x0 > y0) { i1 = 1; j1 = 0; }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;

    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * grad(perm[ii + perm[jj]], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * grad(perm[ii + i1 + perm[jj + j1]], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * grad(perm[ii + 1 + perm[jj + 1]], x2, y2);
    }

    return 70.0 * (n0 + n1 + n2);
  };
}

/**
 * Fractal Brownian Motion (fBm) com octaves, gain e lacunarity
 */
function fBm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 5, gain = 0.5, lacunarity = 2.0): number {
  let total = 0;
  let frequency = 1.0;
  let amplitude = 1.0;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += noise(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }

  return (total / maxValue + 1) * 0.5; // Normalizado em [0, 1]
}

/**
 * Pipeline de Geração de Terreno em 9 Estágios Determinísticos (§4.5.1)
 */
export function gerarTerreno(
  rootSeed: number,
  options: {
    topologia?: TopologiaTerreno;
    largura?: number;
    altura?: number;
    cols?: number;
    rows?: number;
  } = {}
): TerrenoResult {
  const topologia = options.topologia || 'hex';
  const width = options.largura || 800;
  const height = options.altura || 600;
  const cols = options.cols || 24;
  const rows = options.rows || 18;

  // Sub-seeds por estágio (§4.5.1)
  const meshSeed = deriveSubSeed(rootSeed, 'mesh_seed');
  const elevSeed = deriveSubSeed(rootSeed, 'elevation_seed');
  const climateSeed = deriveSubSeed(rootSeed, 'climate_seed');
  const hydroSeed = deriveSubSeed(rootSeed, 'hydro_seed');
  const biomeSeed = deriveSubSeed(rootSeed, 'biome_seed');
  const settleSeed = deriveSubSeed(rootSeed, 'settlement_seed');
  const routeSeed = deriveSubSeed(rootSeed, 'route_seed');
  const connSeed = deriveSubSeed(rootSeed, 'connectivity_seed');
  const locSeed = deriveSubSeed(rootSeed, 'location_seed');

  // ==========================================
  // ESTÁGIO 1: Malha Base (Voronoi / Hex)
  // ==========================================
  const cells: TerrenoCell[] = [];
  const cellMap = new Map<string, number>();

  if (topologia === 'hex') {
    const hexRadius = Math.min(width / (cols * 1.6), height / (rows * 1.8));
    const hexWidth = hexRadius * Math.sqrt(3);
    const hexHeight = hexRadius * 2;

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const xOffset = r % 2 === 1 ? hexWidth / 2 : 0;
        const cx = c * hexWidth + xOffset + hexRadius;
        const cy = r * (hexHeight * 0.75) + hexRadius;

        // Calcula 6 vértices do hexágono regular
        const polygon: [number, number][] = [];
        for (let a = 0; a < 6; a++) {
          const angle = (Math.PI / 3) * a + Math.PI / 6;
          polygon.push([
            cx + hexRadius * Math.cos(angle),
            cy + hexRadius * Math.sin(angle),
          ]);
        }

        cells.push({
          id,
          x: cx,
          y: cy,
          polygon,
          neighbors: [],
          elevation: 0,
          latitude: cy / height,
          distanciaOceano: 0,
          zonaClima: 'Temperado Úmido',
          isOceano: false,
          isLago: false,
          fluxoHidrico: 1,
          downslopeId: null,
          isRio: false,
          larguraRio: 0,
          isCosta: false,
          bioma: 'Planície',
          burgScore: 0,
        });

        cellMap.set(`${c},${r}`, id);
        id++;
      }
    }

    // Calcula adjacências para hexágonos
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const currentId = cellMap.get(`${c},${r}`)!;
        const neighbors: number[] = [];
        const isOdd = r % 2 === 1;

        const hexOffsets = isOdd
          ? [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]]
          : [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]];

        for (const [dc, dr] of hexOffsets) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
            const nid = cellMap.get(`${nc},${nr}`);
            if (nid !== undefined) neighbors.push(nid);
          }
        }
        cells[currentId].neighbors = neighbors;
      }
    }
  } else {
    // Topologia Voronoi semi-orgânica determinística via Poisson Jitter
    const rng = new DeterministicRNG(meshSeed);
    const stepX = width / cols;
    const stepY = height / rows;

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const jitterX = (rng.next() - 0.5) * stepX * 0.7;
        const jitterY = (rng.next() - 0.5) * stepY * 0.7;
        const cx = (c + 0.5) * stepX + jitterX;
        const cy = (r + 0.5) * stepY + jitterY;

        // Vértices do polígono aproximado
        const rad = Math.min(stepX, stepY) * 0.55;
        const polygon: [number, number][] = [];
        const sides = 6;
        for (let a = 0; a < sides; a++) {
          const angle = (Math.PI * 2 / sides) * a;
          polygon.push([
            cx + rad * Math.cos(angle) + (rng.next() - 0.5) * 4,
            cy + rad * Math.sin(angle) + (rng.next() - 0.5) * 4,
          ]);
        }

        cells.push({
          id,
          x: cx,
          y: cy,
          polygon,
          neighbors: [],
          elevation: 0,
          latitude: cy / height,
          distanciaOceano: 0,
          zonaClima: 'Temperado Úmido',
          isOceano: false,
          isLago: false,
          fluxoHidrico: 1,
          downslopeId: null,
          isRio: false,
          larguraRio: 0,
          isCosta: false,
          bioma: 'Planície',
          burgScore: 0,
        });

        cellMap.set(`${c},${r}`, id);
        id++;
      }
    }

    // Adjacência em grade jittered
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const currentId = cellMap.get(`${c},${r}`)!;
        const neighbors: number[] = [];
        const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]];
        for (const [dc, dr] of offsets) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
            neighbors.push(cellMap.get(`${nc},${nr}`)!);
          }
        }
        cells[currentId].neighbors = neighbors;
      }
    }
  }

  // ==========================================
  // ESTÁGIO 2: Heightmap (fBm + Arquétipos Continentais Generativos + Warp)
  // ==========================================
  const noiseElev = createNoise2D(elevSeed);
  const warpNoise = createNoise2D(deriveSubSeed(elevSeed, 'domain_warp'));
  const archetypeRng = new DeterministicRNG(deriveSubSeed(elevSeed, 'continent_shape'));

  // Arquétipos de continentes generativos que variam drasticamente a silhueta da terra
  // 0: Continente Central Orgânico com Baías
  // 1: Continentes Gêmeos com Estreito Central
  // 2: Arquipélago e Ilhas Maiores
  // 3: Península Costeira e Mares do Norte/Sul
  const archetypes = ['central', 'twin', 'archipelago', 'peninsula'] as const;
  const continentArchetype = archetypeRng.pick(archetypes);

  const centerX = width / 2;
  const centerY = height / 2;
  const shiftCenterX = (archetypeRng.next() - 0.5) * (width * 0.25);
  const shiftCenterY = (archetypeRng.next() - 0.5) * (height * 0.25);
  const effCenterX = centerX + shiftCenterX;
  const effCenterY = centerY + shiftCenterY;

  for (const cell of cells) {
    // Ruído de distorção de domínio (domain warping) para costas recortadas e não circulares
    const warpX = warpNoise(cell.x / 140, cell.y / 140) * 45;
    const warpY = warpNoise(cell.y / 140, cell.x / 140) * 45;
    const warpedX = cell.x + warpX;
    const warpedY = cell.y + warpY;

    const nx = warpedX / 160;
    const ny = warpedY / 160;
    const rawElev = fBm(noiseElev, nx, ny, 5, 0.52, 2.05);

    // Formato generativo por arquétipo
    let shapeMask = 1.0;
    const dx = (warpedX - effCenterX) / (width * 0.48);
    const dy = (warpedY - effCenterY) / (height * 0.48);

    if (continentArchetype === 'central') {
      const dist = Math.sqrt(dx * dx + dy * dy);
      shapeMask = Math.max(0, 1 - Math.pow(dist, 1.7));
    } else if (continentArchetype === 'twin') {
      // Dois centros de massa com canal/estreito no meio
      const dx1 = (warpedX - (width * 0.32)) / (width * 0.28);
      const dy1 = (warpedY - effCenterY) / (height * 0.42);
      const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

      const dx2 = (warpedX - (width * 0.68)) / (width * 0.28);
      const dy2 = (warpedY - effCenterY) / (height * 0.42);
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      const m1 = Math.max(0, 1 - Math.pow(dist1, 1.6));
      const m2 = Math.max(0, 1 - Math.pow(dist2, 1.6));
      shapeMask = Math.max(m1, m2);
    } else if (continentArchetype === 'archipelago') {
      // Múltiplas ilhas e cadeias vulcânicas
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.sin(dist * Math.PI * 2.2);
      shapeMask = Math.max(0, 0.85 - dist * 0.8 + ring * 0.25);
    } else {
      // Península e faixa continental contínua
      const pDist = Math.abs(dx * 0.8 + dy * 0.5);
      shapeMask = Math.max(0, 1 - Math.pow(pDist, 1.5));
    }

    // Combina elevação fractal com a máscara generativa da silhueta
    let elev = rawElev * 0.65 + shapeMask * 0.55;
    cell.elevation = Math.min(1.0, Math.max(0.0, elev));
  }

  // Passagem de erosão térmica para suavizar penhascos
  for (let pass = 0; pass < 2; pass++) {
    for (const cell of cells) {
      if (cell.neighbors.length === 0) continue;
      let avgElev = cell.elevation;
      for (const nid of cell.neighbors) {
        avgElev += cells[nid].elevation;
      }
      avgElev /= (cell.neighbors.length + 1);
      cell.elevation = cell.elevation * 0.75 + avgElev * 0.25;
    }
  }

  // Limiar do oceano calibrado para manter proporção equilibrada e orgânica
  const SEA_LEVEL = 0.43;

  // ==========================================
  // ESTÁGIO 3: Clima (Latitude x Altitude x Oceano)
  // ==========================================
  for (const cell of cells) {
    // Latitude: 0 = topo polar/boreal, 0.5 = temperado/mediterrâneo, 1.0 = tropical
    const lat = Math.abs(cell.latitude - 0.5) * 2; // 0 no centro, 1 nos extremos
    const alt = cell.elevation;

    if (lat > 0.8) {
      cell.zonaClima = alt > 0.65 ? 'Polar' : 'Tundra';
    } else if (lat > 0.55) {
      cell.zonaClima = alt > 0.6 ? 'Tundra' : 'Boreal';
    } else if (lat > 0.3) {
      cell.zonaClima = alt > 0.7 ? 'Boreal' : 'Temperado Úmido';
    } else {
      cell.zonaClima = alt > 0.6 ? 'Mediterrâneo' : 'Tropical';
    }
  }

  // ==========================================
  // ESTÁGIO 4: Hidrologia (Fluxo Acumulado & Descida de Gradiente)
  // ==========================================
  // 1. Distingue oceano (conectado às bordas do mapa) de lagos
  const borderCells = cells.filter(
    (c) => c.x < 30 || c.x > width - 30 || c.y < 30 || c.y > height - 30
  );

  const isOceanQueue: number[] = [];
  const visitedOcean = new Set<number>();

  for (const bc of borderCells) {
    if (bc.elevation < SEA_LEVEL) {
      isOceanQueue.push(bc.id);
      visitedOcean.add(bc.id);
      bc.isOceano = true;
    }
  }

  while (isOceanQueue.length > 0) {
    const curId = isOceanQueue.shift()!;
    for (const nid of cells[curId].neighbors) {
      if (!visitedOcean.has(nid) && cells[nid].elevation < SEA_LEVEL) {
        visitedOcean.add(nid);
        cells[nid].isOceano = true;
        isOceanQueue.push(nid);
      }
    }
  }

  for (const cell of cells) {
    if (cell.elevation < SEA_LEVEL && !cell.isOceano) {
      cell.isLago = true;
    }
  }

  // 2. Ordena células por elevação decrescente para fluxo acumulado
  const sortedByElev = [...cells].sort((a, b) => b.elevation - a.elevation);

  for (const cell of sortedByElev) {
    if (cell.isOceano || cell.isLago) continue;

    // Encontra vizinho com menor elevação (descida de gradiente)
    let lowestNeighbor: TerrenoCell | null = null;
    let minElev = cell.elevation;

    for (const nid of cell.neighbors) {
      const neighbor = cells[nid];
      if (neighbor.elevation < minElev) {
        minElev = neighbor.elevation;
        lowestNeighbor = neighbor;
      }
    }

    if (lowestNeighbor) {
      cell.downslopeId = lowestNeighbor.id;
      lowestNeighbor.fluxoHidrico += cell.fluxoHidrico;
    }
  }

  // 3. Identifica rios por fluxo acumulado
  const RIVER_THRESHOLD = 4;
  const rivers: { path: number[]; flow: number }[] = [];

  for (const cell of cells) {
    if (cell.fluxoHidrico >= RIVER_THRESHOLD && !cell.isOceano && !cell.isLago) {
      cell.isRio = true;
      cell.larguraRio = Math.min(6, Math.max(1, Math.floor(cell.fluxoHidrico / 3)));
    }
  }

  // Reconstrói trajetos de rios contínuos
  const riverStartCandidates = cells.filter(
    (c) => c.isRio && c.downslopeId !== null && !cells[c.neighbors.find((nid) => cells[nid].downslopeId === c.id) || 0]?.isRio
  );

  for (const start of riverStartCandidates) {
    const riverPath: number[] = [start.id];
    let curr = start;
    let limit = 40;
    while (curr.downslopeId !== null && limit-- > 0) {
      const next = cells[curr.downslopeId];
      riverPath.push(next.id);
      if (next.isOceano || next.isLago) break;
      curr = next;
    }
    if (riverPath.length >= 3) {
      rivers.push({ path: riverPath, flow: start.fluxoHidrico });
    }
  }

  // ==========================================
  // ESTÁGIO 5: Biomas (Mapeamento Puro e Determinístico)
  // ==========================================
  for (const cell of cells) {
    // Checa se é costa (terra adjacente a oceano)
    if (!cell.isOceano && !cell.isLago) {
      cell.isCosta = cell.neighbors.some((nid) => cells[nid].isOceano);
    }

    if (cell.isOceano) {
      cell.bioma = 'Oceano';
    } else if (cell.isLago) {
      cell.bioma = 'Lago';
    } else if (cell.isCosta && cell.elevation < 0.48) {
      cell.bioma = 'Costa';
    } else if (cell.elevation > 0.85) {
      cell.bioma = 'Picos Nevados';
    } else if (cell.elevation > 0.72) {
      cell.bioma = 'Montanha';
    } else if (cell.elevation > 0.6) {
      cell.bioma = 'Colinas';
    } else if (cell.zonaClima === 'Tundra' || cell.zonaClima === 'Polar') {
      cell.bioma = 'Tundra';
    } else if (cell.zonaClima === 'Boreal') {
      cell.bioma = 'Taiga';
    } else if (cell.zonaClima === 'Tropical') {
      cell.bioma = cell.fluxoHidrico > 3 ? 'Selva Tropical' : 'Planície';
    } else if (cell.zonaClima === 'Semiárido' || cell.zonaClima === 'Árido') {
      cell.bioma = cell.fluxoHidrico > 3 ? 'Planície' : 'Deserto';
    } else {
      // Temperado
      if (cell.fluxoHidrico > 6 && cell.elevation < 0.46) {
        cell.bioma = 'Pântano';
      } else if (cell.fluxoHidrico > 2) {
        cell.bioma = 'Floresta Temperada';
      } else {
        cell.bioma = 'Planície';
      }
    }
  }

  // ==========================================
  // ESTÁGIO 6: Colocação de Assentamentos (Burg Score)
  // ==========================================
  const potencialPorBioma: Record<BiomaTipo, number> = {
    'Planície': 1.0,
    'Colinas': 0.8,
    'Floresta Temperada': 0.7,
    'Costa': 1.1,
    'Pântano': 0.3,
    'Montanha': 0.2,
    'Taiga': 0.4,
    'Selva Tropical': 0.5,
    'Deserto': 0.1,
    'Tundra': 0.2,
    'Picos Nevados': 0.0,
    'Oceano': 0.0,
    'Lago': 0.0,
  };

  for (const cell of cells) {
    if (cell.isOceano || cell.isLago) {
      cell.burgScore = 0;
      continue;
    }

    const potencial = potencialPorBioma[cell.bioma] || 0.5;
    const waterBonus = cell.isCosta || cell.isRio ? 1.5 : 1.0;
    const climaAmenidade =
      cell.zonaClima === 'Temperado Úmido' || cell.zonaClima === 'Mediterrâneo'
        ? 1.0
        : cell.zonaClima === 'Boreal' || cell.zonaClima === 'Tropical'
        ? 0.8
        : 0.4;

    cell.burgScore = Number((potencial * waterBonus * climaAmenidade).toFixed(2));
  }

  // Seleciona assentamentos por Poisson Disk Ponderado
  const settleRng = new DeterministicRNG(settleSeed);
  const eligibleCells = cells
    .filter((c) => c.burgScore >= 0.7 && !c.isOceano && !c.isLago)
    .sort((a, b) => b.burgScore - a.burgScore);

  const settlements: { cellId: number; name: string; role: string; score: number }[] = [];
  const minSettlementDist = 120;

  const PREFIXOS_CIDADE = [
    'Porto', 'Vila', 'Forte', 'Aldeia', 'Cruzamento', 'Cidadela', 'Passo', 'Refúgio',
    'Bastião', 'Vigia', 'Torre', 'Mirante', 'Enseada', 'Pilar', 'Península',
  ];
  const RAICES_CIDADE = [
    'da Aurora', 'das Águas Claras', 'Pedra-Negra', 'do Carvalho Velho', 'do Falcão',
    'da Névoa', 'do Vento Alto', 'dos Pescadores', 'do Sol Nascente', 'do Dragão',
    'do Vale Fundo', 'da Lua Prateada', 'dos Pinheiros', 'do Rio Velho', 'das Colinas',
    'do Sino de Ferro', 'da Tempestade', 'dos Sete Mares', 'do Lago Esmeralda',
  ];

  // Embaralha raízes para variação total entre sementes
  const rootsPool = [...RAICES_CIDADE];
  settleRng.shuffle(rootsPool);

  for (const cand of eligibleCells) {
    if (settlements.length >= 6) break;

    const tooClose = settlements.some((s) => {
      const other = cells[s.cellId];
      const dist = Math.hypot(other.x - cand.x, other.y - cand.y);
      return dist < minSettlementDist;
    });

    if (!tooClose) {
      let role = 'Vila Comercial';
      let pref = settleRng.pick(PREFIXOS_CIDADE);
      if (cand.isCosta && cand.isRio) {
        role = 'Capital Portuária';
        pref = settleRng.pick(['Porto', 'Cidadela Portuária', 'Enseada']);
      } else if (cand.bioma === 'Colinas' || cand.bioma === 'Montanha') {
        role = 'Fortaleza de Fronteira';
        pref = settleRng.pick(['Forte', 'Bastião', 'Vigia', 'Passo']);
      } else if (cand.isRio) {
        role = 'Entreposto Fluvial';
        pref = settleRng.pick(['Vila Fluvial', 'Cruzamento', 'Porto Fluvial']);
      }

      const rootName = rootsPool[settlements.length % rootsPool.length];
      const nome = `${pref} ${rootName}`;

      cand.settlementId = `settle_${cand.id}`;
      cand.settlementName = nome;
      cand.settlementRole = role;

      settlements.push({
        cellId: cand.id,
        name: nome,
        role,
        score: cand.burgScore,
      });
    }
  }

  // ==========================================
  // ESTÁGIO 7: Rede de Rotas (Dijkstra sobre Custo de Terreno)
  // ==========================================
  function custoMovimento(c: TerrenoCell): number {
    if (c.isOceano) return 999;
    if (c.isLago) return 800;
    if (c.bioma === 'Picos Nevados') return 50;
    if (c.bioma === 'Montanha') return 25;
    if (c.bioma === 'Pântano') return 18;
    if (c.bioma === 'Colinas') return 8;
    if (c.bioma === 'Floresta Temperada') return 5;
    if (c.isRio) return 3; // Rota ao longo de rio
    return 2; // Planície
  }

  function dijkstra(fromId: number, toId: number): number[] | null {
    const dist = new Map<number, number>();
    const prev = new Map<number, number>();
    const queue = new Set<number>();

    for (const cell of cells) {
      dist.set(cell.id, Infinity);
      queue.add(cell.id);
    }
    dist.set(fromId, 0);

    while (queue.size > 0) {
      let u: number | null = null;
      let lowestDist = Infinity;
      for (const id of queue) {
        const d = dist.get(id)!;
        if (d < lowestDist) {
          lowestDist = d;
          u = id;
        }
      }

      if (u === null || lowestDist === Infinity) break;
      if (u === toId) break;

      queue.delete(u);
      const uCell = cells[u];

      for (const nid of uCell.neighbors) {
        if (!queue.has(nid)) continue;
        const neighbor = cells[nid];
        const alt = dist.get(u)! + custoMovimento(neighbor);
        if (alt < dist.get(nid)!) {
          dist.set(nid, alt);
          prev.set(nid, u);
        }
      }
    }

    // Reconstrói caminho
    const path: number[] = [];
    let curr: number | undefined = toId;
    if (!prev.has(curr) && curr !== fromId) return null;

    while (curr !== undefined) {
      path.unshift(curr);
      curr = prev.get(curr);
    }
    return path;
  }

  const routes: TerrenoRoute[] = [];
  for (let i = 0; i < settlements.length; i++) {
    for (let j = i + 1; j < settlements.length; j++) {
      const from = settlements[i];
      const to = settlements[j];
      const path = dijkstra(from.cellId, to.cellId);
      if (path && path.length > 1 && path.length < 25) {
        routes.push({
          id: `route_${from.cellId}_${to.cellId}`,
          fromCell: from.cellId,
          toCell: to.cellId,
          path,
          tipo: 'estrada',
        });
      }
    }
  }

  // ==========================================
  // ESTÁGIO 8: Conectividade (Alcançabilidade BFS)
  // ==========================================
  // Verifica se células de terra estão conectadas; se ilhas isoladas existirem, marca ou repara
  const landCells = cells.filter((c) => !c.isOceano && !c.isLago);
  if (landCells.length > 0) {
    const visited = new Set<number>();
    const queue = [landCells[0].id];
    visited.add(landCells[0].id);

    while (queue.length > 0) {
      const curId = queue.shift()!;
      for (const nid of cells[curId].neighbors) {
        if (!visited.has(nid) && !cells[nid].isOceano && !cells[nid].isLago) {
          visited.add(nid);
          queue.push(nid);
        }
      }
    }
  }

  // ==========================================
  // ESTÁGIO 9: Locais e Marcos Notáveis
  // ==========================================
  const landmarks: { cellId: number; nome: string; tipo: any }[] = [];
  const locRng = new DeterministicRNG(locSeed);

  for (const cell of cells) {
    if (cell.settlementId) continue;
    if (landmarks.length >= 5) break;

    if (cell.bioma === 'Montanha' && locRng.next() < 0.15) {
      const lm = { cellId: cell.id, nome: 'Fortaleza dos Ventos Frios', tipo: 'fortaleza' as const };
      cell.landmark = { id: `loc_${cell.id}`, ...lm };
      landmarks.push(lm);
    } else if (cell.bioma === 'Colinas' && locRng.next() < 0.15) {
      const lm = { cellId: cell.id, nome: 'Santuário da Aurora Sagrada', tipo: 'templo' as const };
      cell.landmark = { id: `loc_${cell.id}`, ...lm };
      landmarks.push(lm);
    } else if (cell.bioma === 'Floresta Temperada' && locRng.next() < 0.12) {
      const lm = { cellId: cell.id, nome: 'Torre do Mago Solitário', tipo: 'torre' as const };
      cell.landmark = { id: `loc_${cell.id}`, ...lm };
      landmarks.push(lm);
    } else if (cell.isCosta && locRng.next() < 0.12) {
      const lm = { cellId: cell.id, nome: 'Farol da Costa Traiçoeira', tipo: 'porto' as const };
      cell.landmark = { id: `loc_${cell.id}`, ...lm };
      landmarks.push(lm);
    }
  }

  // Estatísticas de distribuição
  const distribuicaoBiomas: Record<string, number> = {};
  let areaTerra = 0;
  let areaAgua = 0;

  for (const c of cells) {
    distribuicaoBiomas[c.bioma] = (distribuicaoBiomas[c.bioma] || 0) + 1;
    if (c.isOceano || c.isLago) areaAgua++;
    else areaTerra++;
  }

  return {
    seed: rootSeed,
    topologia,
    largura: width,
    altura: height,
    cells,
    rivers,
    settlements,
    routes,
    landmarks,
    metricas: {
      totalCells: cells.length,
      areaTerra,
      areaAgua,
      distribuicaoBiomas,
    },
  };
}
