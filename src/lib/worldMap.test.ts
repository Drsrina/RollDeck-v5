import { describe, expect, it, beforeEach } from 'vitest';
import { useWorldMapStore, FMG_URLS } from '../store/useWorldMapStore';
import { useVttStore } from '../store/useVttStore';
import { useMapStore } from '../store/useMapStore';

describe('useWorldMapStore — Fantasy Map Generator & Cross-Module Integration', () => {
  beforeEach(() => {
    useWorldMapStore.setState({
      fmgSourceMode: 'cloud',
      customFMGUrl: 'http://localhost:8080',
      mapas: [],
      selectedMapId: null,
    });
  });

  it('retorna a URL de nuvem por padrão e altera para docker e custom', () => {
    const store = useWorldMapStore.getState();
    expect(store.getEffectiveFMGUrl()).toBe(FMG_URLS.cloud);

    store.setFMGSourceMode('docker');
    expect(useWorldMapStore.getState().getEffectiveFMGUrl()).toBe(FMG_URLS.docker);

    store.setFMGSourceMode('custom');
    store.setCustomFMGUrl('http://meu-servidor:8080');
    expect(useWorldMapStore.getState().getEffectiveFMGUrl()).toBe('http://meu-servidor:8080');
  });

  it('salva e remove snapshots de mapas de mundo', () => {
    const store = useWorldMapStore.getState();
    const mapaSalvo = store.salvarMapa({
      nome: 'Continente de Aethelgard',
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      tipo: 'continente',
      descricao: 'Continente gerado com 3 reinos principais e 2 oceanos.',
    });

    expect(mapaSalvo.id).toBeDefined();
    expect(mapaSalvo.nome).toBe('Continente de Aethelgard');
    expect(mapaSalvo.tipo).toBe('continente');

    const mapas = useWorldMapStore.getState().mapas;
    expect(mapas.length).toBe(1);
    expect(mapas[0].id).toBe(mapaSalvo.id);

    store.removerMapa(mapaSalvo.id);
    expect(useWorldMapStore.getState().mapas.length).toBe(0);
  });

  it('cria uma nova cena no VTT com a imagem de fundo do mapa', () => {
    const store = useWorldMapStore.getState();
    const mapa = store.salvarMapa({
      nome: 'Mapa Tático das Terras Baixas',
      imageDataUrl: 'data:image/png;base64,mock',
      tipo: 'tatico',
    });

    const sceneId = store.enviarMapaParaVtt(mapa.id, 'Cena de Viagem');
    expect(sceneId).toBeDefined();

    const vttState = useVttStore.getState();
    const currentScene = vttState.scenes.find((s) => s.id === vttState.activeSceneId);
    expect(currentScene).toBeDefined();
    expect(currentScene?.background?.dataUrl).toBe('data:image/png;base64,mock');
  });

  it('envia imagem para o Canvas do MapScreen', async () => {
    const store = useWorldMapStore.getState();
    const mapa = store.salvarMapa({
      nome: 'Mapa Mental Geral',
      imageDataUrl: 'data:image/png;base64,canvasMock',
      tipo: 'regional',
    });

    const result = await store.enviarMapaParaCanvas(mapa.id);
    expect(result).toBe(true);

    const mapImages = useMapStore.getState().mapImages;
    expect(mapImages.length).toBeGreaterThan(0);
    const added = mapImages.find((img) => img.name === 'Mapa Mental Geral');
    expect(added).toBeDefined();
    expect(added?.dataUrl).toBe('data:image/png;base64,canvasMock');
  });
});
