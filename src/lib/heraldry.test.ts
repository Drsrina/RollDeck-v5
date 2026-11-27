import { describe, expect, it, beforeEach } from 'vitest';
import { useHeraldryStore, ARMORIA_URLS } from '../store/useHeraldryStore';

describe('useHeraldryStore — Armoria & Heráldica Integration', () => {
  beforeEach(() => {
    // Reset store state
    useHeraldryStore.setState({
      brasoes: [],
      selectedBrasaoId: null,
      armoriaSourceMode: 'cloud',
      customArmoriaUrl: 'http://localhost:8081',
    });
  });

  it('retorna a URL de nuvem por padrão e altera para docker e custom', () => {
    const store = useHeraldryStore.getState();
    expect(store.getEffectiveArmoriaUrl()).toBe(ARMORIA_URLS.cloud);

    store.setArmoriaSourceMode('docker');
    expect(useHeraldryStore.getState().getEffectiveArmoriaUrl()).toBe(ARMORIA_URLS.docker);

    store.setArmoriaSourceMode('custom');
    store.setCustomArmoriaUrl('http://meu-servidor:9000');
    expect(useHeraldryStore.getState().getEffectiveArmoriaUrl()).toBe('http://meu-servidor:9000');
  });

  it('salva um novo brasão e gera metadados corretos', () => {
    const store = useHeraldryStore.getState();
    const mockSvg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';

    const novo = store.salvarBrasao({
      nome: 'Clã das Colinas',
      categoria: 'faccao',
      svgData: mockSvg,
      targetId: 'faccao-colinas-1',
      tags: ['anões', 'martelo', 'realeza'],
    });

    expect(novo.id).toBeDefined();
    expect(novo.nome).toBe('Clã das Colinas');
    expect(novo.categoria).toBe('faccao');
    expect(novo.svgData).toBe(mockSvg);
    expect(novo.tags).toEqual(['anões', 'martelo', 'realeza']);

    const brasoes = useHeraldryStore.getState().brasoes;
    expect(brasoes.length).toBe(1);
    expect(brasoes[0].id).toBe(novo.id);
  });

  it('encontra brasão por nome ou targetId', () => {
    const store = useHeraldryStore.getState();
    store.salvarBrasao({
      nome: 'Guilda dos Assassinos',
      categoria: 'faccao',
      svgData: '<svg><path d="M0 0"/></svg>',
      targetId: 'faccao-assassinos-99',
      tags: ['sombra', 'adaga'],
    });

    const porNome = store.obterBrasaoPorNomeOuTarget('guilda dos assassinos');
    expect(porNome).toBeDefined();
    expect(porNome?.nome).toBe('Guilda dos Assassinos');

    const porTarget = store.obterBrasaoPorNomeOuTarget('faccao-assassinos-99');
    expect(porTarget).toBeDefined();
    expect(porTarget?.targetId).toBe('faccao-assassinos-99');

    const porTag = store.obterBrasaoPorNomeOuTarget('adaga');
    expect(porTag).toBeDefined();

    const inexistente = store.obterBrasaoPorNomeOuTarget('nao-existe');
    expect(inexistente).toBeUndefined();
  });

  it('permite atualizar e remover brasões', () => {
    const store = useHeraldryStore.getState();
    const b1 = store.salvarBrasao({
      nome: 'Casa Stark',
      categoria: 'reino',
      svgData: '<svg></svg>',
    });

    store.atualizarBrasao(b1.id, { nome: 'Casa Stark de Winterfell' });
    expect(useHeraldryStore.getState().brasoes[0].nome).toBe('Casa Stark de Winterfell');

    store.removerBrasao(b1.id);
    expect(useHeraldryStore.getState().brasoes.length).toBe(0);
  });
});
