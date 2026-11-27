import { describe, expect, it, beforeEach } from 'vitest';
import { convertFmgJsonToRollDeckNotes } from './fmgImporter';
import { generateObsidianVaultFiles, exportVaultToConsolidatedMarkdown } from './obsidianExporter';
import { useMapStore } from '../store/useMapStore';

describe('Plano 4 — FMG ➔ Obsidian ➔ RollDeck Wiki-links Pipeline', () => {
  const mockFmgData = {
    info: {
      mapName: 'Reinos Antigos',
      width: 1600,
      height: 1000,
    },
    cultures: [
      { i: 1, name: 'Valirianos', code: 'VAL', type: 'Highland', expansionism: 1.2 },
      { i: 2, name: 'Ândalos', code: 'AND', type: 'River', expansionism: 1.0 },
    ],
    religions: [
      { i: 1, name: 'Fé dos Sete', deity: 'Os Sete', culture: 2, type: 'Organized' },
    ],
    states: [
      {
        i: 1,
        name: 'Coroa de Pedra',
        type: 'Monarquia',
        capital: 1,
        culture: 1,
        center: 45000,
        diplomacy: ['Neutral', 'Ally', 'Enemy'],
      },
      {
        i: 2,
        name: 'Reino dos Rios',
        type: 'Confederação',
        capital: 2,
        culture: 2,
        center: 60000,
        diplomacy: ['Neutral', 'Enemy', 'Neutral'],
      },
    ],
    burgs: [
      {
        i: 1,
        name: 'Porto Branco',
        state: 1,
        culture: 1,
        capital: 1,
        citadel: 1,
        walls: 1,
        port: 1,
        population: 45.2,
        x: 400,
        y: 300,
        MFCG: 12345,
      },
      {
        i: 2,
        name: 'Forte do Rio',
        state: 2,
        culture: 2,
        capital: 1,
        citadel: 1,
        walls: 0,
        port: 0,
        population: 18.5,
        x: 700,
        y: 500,
        MFCG: 67890,
      },
      {
        i: 3,
        name: 'Vila da Ponte',
        state: 1,
        culture: 1,
        capital: 0,
        citadel: 0,
        walls: 0,
        port: 0,
        population: 3.1,
        x: 520,
        y: 380,
      },
    ],
  };

  beforeEach(() => {
    useMapStore.setState({
      notes: [],
      links: [],
      layers: [],
    });
  });

  it('converte o JSON do FMG gerando nós estruturados e [[Wiki-links]]', () => {
    const result = convertFmgJsonToRollDeckNotes(mockFmgData);

    expect(result.notes.length).toBeGreaterThanOrEqual(7); // 2 culturas + 1 religião + 2 estados + 3 burgos
    expect(result.summary.statesCount).toBe(2);
    expect(result.summary.burgsCount).toBe(3);

    // Verificar se o reino contém o wiki-link para sua capital
    const estado1 = result.notes.find((n) => n.title === 'Coroa de Pedra');
    expect(estado1).toBeDefined();
    expect(estado1?.category).toBe('faction');
    expect(estado1?.body).toContain('[[Porto Branco]]');

    // Verificar se a capital contém o wiki-link de volta para o reino
    const capital1 = result.notes.find((n) => n.title === 'Porto Branco');
    expect(capital1).toBeDefined();
    expect(capital1?.category).toBe('location');
    expect(capital1?.body).toContain('[[Coroa de Pedra]]');

    // Verificar se as arestas entre nós foram geradas
    expect(result.links.length).toBeGreaterThan(0);
    const linkReinoCapital = result.links.find(
      (l) => l.fromId === estado1?.id && l.toId === capital1?.id
    );
    expect(linkReinoCapital).toBeDefined();
  });

  it('importFmgWorldToCanvas no useMapStore persiste nós e links no grafo', async () => {
    const result = await useMapStore.getState().importFmgWorldToCanvas(mockFmgData);
    expect(result.notes.length).toBeGreaterThanOrEqual(7);

    const storeNotes = useMapStore.getState().notes;
    const storeLinks = useMapStore.getState().links;

    expect(storeNotes.length).toBe(result.notes.length);
    expect(storeLinks.length).toBe(result.links.length);
  });

  it('exporta notas em arquivos Markdown com padrão Obsidian Vault', () => {
    const { notes } = convertFmgJsonToRollDeckNotes(mockFmgData);
    const vaultFiles = generateObsidianVaultFiles(notes);

    expect(vaultFiles.length).toBe(notes.length);
    const portoBrancoMd = vaultFiles.find((f) => f.filename === 'Porto Branco.md');
    expect(portoBrancoMd).toBeDefined();
    expect(portoBrancoMd?.relativePath).toContain('2. Cidades e Locais/Porto Branco.md');
    expect(portoBrancoMd?.content).toContain('---');
    expect(portoBrancoMd?.content).toContain('title: "Porto Branco"');
    expect(portoBrancoMd?.content).toContain('[[Coroa de Pedra]]');

    const consolidated = exportVaultToConsolidatedMarkdown(notes, 'Reinos Antigos Vault');
    expect(consolidated).toContain('# Reinos Antigos Vault');
    expect(consolidated).toContain('## 📄 Porto Branco.md');
  });
});
