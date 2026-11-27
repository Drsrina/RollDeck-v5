import type { NoteCategory, NoteLink, NoteNode } from '../types';
import { syncLinksFromNoteBody } from './wikiLinks';

export interface FmgImportOptions {
  centerOnCanvas?: { x: number; y: number };
  scaleFactor?: number;
  layerId?: string;
  importBurgs?: boolean;
  importStates?: boolean;
  importReligions?: boolean;
  importCultures?: boolean;
  maxBurgs?: number; // Para evitar poluir o canvas com milhares de vilas
}

export interface FmgImportResult {
  notes: NoteNode[];
  links: NoteLink[];
  summary: {
    statesCount: number;
    burgsCount: number;
    religionsCount: number;
    culturesCount: number;
    totalLinks: number;
  };
}

/**
 * Converte a estrutura de dados JSON exportada pelo Fantasy Map Generator (Azgaar)
 * em nós de notas estruturados e arestas conectadas por [[Wiki-links]] no RollDeck.
 */
export function convertFmgJsonToRollDeckNotes(
  fmgData: any,
  options: FmgImportOptions = {}
): FmgImportResult {
  if (!fmgData || typeof fmgData !== 'object') {
    throw new Error('Dados FMG inválidos ou vazios.');
  }

  const {
    centerOnCanvas = { x: 0, y: 0 },
    scaleFactor = 1.2,
    layerId = 'default',
    importBurgs = true,
    importStates = true,
    importReligions = true,
    importCultures = true,
    maxBurgs = 60,
  } = options;

  const notes: NoteNode[] = [];
  const mapWidth = Number(fmgData.info?.width) || 1200;
  const mapHeight = Number(fmgData.info?.height) || 800;

  // Mapa de IDs e nomes para resolução de wiki-links
  const cultureMap = new Map<number, string>();
  const religionMap = new Map<number, string>();
  const stateMap = new Map<number, string>();

  // 1. Culturas
  if (Array.isArray(fmgData.cultures)) {
    for (const c of fmgData.cultures) {
      if (!c || !c.name || c.name === 'Wild' || c.removed) continue;
      cultureMap.set(c.i, c.name);

      if (importCultures) {
        const body = [
          `# Cultura: ${c.name}`,
          `**Código:** ${c.code || 'N/A'} | **Tipo:** ${c.type || 'Padrão'}`,
          `**Expansão:** ${c.expansionism || 1.0}`,
          '',
          '### Tradições e Povos',
          `Esta cultura possui influência em diversas províncias e burgos do continente.`,
        ].join('\n');

        notes.push({
          id: `fmg-culture-${c.i}`,
          title: c.name,
          body,
          tags: ['fmg', 'cultura', (c.type || 'povo').toLowerCase()],
          layerId,
          category: 'concept' as NoteCategory,
          color: '#a855f7', // Roxo
          x: Math.round(centerOnCanvas.x + ((c.i * 120) % 600) - 300),
          y: Math.round(centerOnCanvas.y + Math.floor(c.i / 5) * 100 - 300),
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }

  // 2. Religiões
  if (Array.isArray(fmgData.religions)) {
    for (const r of fmgData.religions) {
      if (!r || !r.name || r.name === 'No religion' || r.removed) continue;
      religionMap.set(r.i, r.name);

      if (importReligions) {
        const body = [
          `# Fé: ${r.name}`,
          `**Tipo:** ${r.type || 'Organizada'} | **Divindade Suprema:** ${r.deity || 'Desconhecida'}`,
          `**Origem Cultural:** ${cultureMap.get(r.culture) ? `[[${cultureMap.get(r.culture)}]]` : 'Antiga'}`,
          '',
          '### Doutrina & Influência',
          `Templos e sacerdócios desta fé exercem autoridade moral sobre as cidades e ordens do reino.`,
        ].join('\n');

        notes.push({
          id: `fmg-religion-${r.i}`,
          title: r.name,
          body,
          tags: ['fmg', 'religiao', 'fe'],
          layerId,
          category: 'concept' as NoteCategory,
          color: '#f59e0b', // Âmbar
          x: Math.round(centerOnCanvas.x + ((r.i * 140) % 700) - 350),
          y: Math.round(centerOnCanvas.y + Math.floor(r.i / 5) * 110 - 450),
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }

  // 3. Estados / Reinos
  if (Array.isArray(fmgData.states)) {
    for (const s of fmgData.states) {
      if (!s || !s.name || s.name === 'Neutrals' || s.removed) continue;
      stateMap.set(s.i, s.name);
    }

    if (importStates) {
      for (const s of fmgData.states) {
        if (!s || !s.name || s.name === 'Neutrals' || s.removed) continue;

        // Buscar nome da capital
        let capitalName = 'Desconhecida';
        if (s.capital && Array.isArray(fmgData.burgs)) {
          const capBurg =
            fmgData.burgs.find((b: any) => b && b.i === s.capital) ||
            fmgData.burgs[s.capital];
          if (capBurg?.name) capitalName = capBurg.name;
        }

        // Relações diplomáticas
        const relacoes: string[] = [];
        if (Array.isArray(s.diplomacy)) {
          s.diplomacy.forEach((status: string, otherStateId: number) => {
            const otherName = stateMap.get(otherStateId);
            if (otherName && otherName !== s.name && status && status !== 'Neutral') {
              relacoes.push(`- **${status}:** [[${otherName}]]`);
            }
          });
        }

        const cultureName = cultureMap.get(s.culture);

        const bodyLines = [
          `# Reino de ${s.name}`,
          `**Forma de Governo:** ${s.type || 'Monarquia Feudal'}`,
          `**Capital Oficial:** [[${capitalName}]]`,
          cultureName ? `**Cultura Dominante:** [[${cultureName}]]` : '',
          s.expansionism ? `**Militarismo / Expansão:** ${s.expansionism}` : '',
          '',
          '### Diplomacia & Relações Externas',
          relacoes.length > 0 ? relacoes.join('\n') : '*Nenhum tratado diplomático registrado.*',
          '',
          '### Visão Estratégica',
          `Território soberano modelado pelo Fantasy Map Generator.`,
        ].filter(Boolean);

        // Coordenadas cartográficas projetadas
        const posX = Math.round(
          centerOnCanvas.x + ((s.center ? s.center % mapWidth : 400) - mapWidth / 2) * scaleFactor
        );
        const posY = Math.round(
          centerOnCanvas.y + ((s.center ? Math.floor(s.center / mapWidth) : 300) - mapHeight / 2) * scaleFactor
        );

        notes.push({
          id: `fmg-state-${s.i}`,
          title: s.name,
          body: bodyLines.join('\n'),
          tags: ['fmg', 'reino', 'estado', (s.type || 'monarquia').toLowerCase()],
          layerId,
          category: 'faction' as NoteCategory,
          color: '#eab308', // Ouro
          x: posX,
          y: posY,
          pinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }

  // 4. Burgos / Cidades
  if (importBurgs && Array.isArray(fmgData.burgs)) {
    const validBurgs = fmgData.burgs.filter((b: any) => b && b.name && !b.removed);
    // Ordenar capitais primeiro e limitar quantidade máxima
    const sortedBurgs = [...validBurgs].sort((a, b) => (b.capital || 0) - (a.capital || 0));
    const burgsToImport = sortedBurgs.slice(0, maxBurgs);

    for (const b of burgsToImport) {
      const stateName = stateMap.get(b.state);
      const cultureName = cultureMap.get(b.culture);

      const features: string[] = [];
      if (b.capital) features.push('👑 Capital Soberana');
      if (b.citadel) features.push('🏰 Castelo / Cidadela Forte');
      if (b.walls) features.push('🛡️ Muralhas e Torres');
      if (b.plaza) features.push('⚖️ Praça Comercial');
      if (b.port) features.push('⚓ Porto Navegável');
      if (b.temple) features.push('⛪ Templo Notável');

      const bodyLines = [
        `# Assentamento: ${b.name}`,
        b.capital ? `> **Capital do Reino de [[${stateName || 'Terras Livres'}]]**` : '',
        stateName && !b.capital ? `**Reino Pertencente:** [[${stateName}]]` : '',
        cultureName ? `**Cultura Local:** [[${cultureName}]]` : '',
        b.population ? `**População Estimada:** ~${Math.round(b.population * 1000)} habitantes` : '',
        '',
        '### Infraestrutura e Pontos de Destaque',
        features.length > 0
          ? features.map((f) => `- ${f}`).join('\n')
          : '- Assentamento interiorano tradicional.',
        '',
        b.MFCG
          ? `### Planta Baixa Medieval\nSeed Watabou: \`${b.MFCG}\` (Acesse no Estúdio de Criação)`
          : '',
      ].filter(Boolean);

      const posX = Math.round(
        centerOnCanvas.x + ((b.x || 500) - mapWidth / 2) * scaleFactor
      );
      const posY = Math.round(
        centerOnCanvas.y + ((b.y || 400) - mapHeight / 2) * scaleFactor
      );

      notes.push({
        id: `fmg-burg-${b.i}`,
        title: b.name,
        body: bodyLines.join('\n'),
        tags: [
          'fmg',
          'cidade',
          b.capital ? 'capital' : 'assentamento',
          b.port ? 'porto' : null,
          b.citadel ? 'cidadela' : null,
        ].filter(Boolean) as string[],
        layerId,
        category: 'location' as NoteCategory,
        color: b.capital ? '#38bdf8' : '#22c55e', // Azul claro para capitais, Verde para cidades
        x: posX,
        y: posY,
        pinned: Boolean(b.capital),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  // Sincronizar todos os [[Wiki-links]] gerados em arestas conectadas
  let generatedLinks: NoteLink[] = [];
  for (const n of notes) {
    generatedLinks = syncLinksFromNoteBody(n.id, n.body, notes, generatedLinks);
  }

  return {
    notes,
    links: generatedLinks,
    summary: {
      statesCount: stateMap.size,
      burgsCount: Math.min(fmgData.burgs?.filter((b: any) => b && b.name).length || 0, maxBurgs),
      religionsCount: religionMap.size,
      culturesCount: cultureMap.size,
      totalLinks: generatedLinks.length,
    },
  };
}
