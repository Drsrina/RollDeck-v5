import { describe, expect, it, beforeEach } from 'vitest';
import { BESTIARIO_ENCONTROS } from './forja/encounterGenerator';
import { createDefaultVttScene } from './vttGrid';
import { useVttStore } from '../store/useVttStore';

describe('VTT Bestiário D&D 5.5 & Tokens Ocultos', () => {
  beforeEach(() => {
    const baseScene = createDefaultVttScene('Arena Teste');
    useVttStore.setState({
      scenes: [baseScene],
      activeSceneId: baseScene.id,
      selectedTokenId: null,
    });
  });

  it('possui criaturas D&D 5.5 com tipo55, ataques e dados de combate', () => {
    expect(BESTIARIO_ENCONTROS.length).toBeGreaterThanOrEqual(50);
    const comTipo55 = BESTIARIO_ENCONTROS.filter((c) => Boolean(c.tipo55));
    expect(comTipo55.length).toBeGreaterThan(0);
  });

  it('adiciona monstro D&D 5.5 oculto dos jogadores com limiar de Sangrando (50% PV)', () => {
    const kobold = BESTIARIO_ENCONTROS.find((c) => c.id === 'kobold_emboscador')!;
    expect(kobold).toBeDefined();

    const token = useVttStore.getState().addToken({
      name: kobold.nome,
      faction: 'enemy',
      color: '#f43f5e',
      sizeCells: 1,
      rotation: 0,
      locked: false,
      hidden: true,
      hpCurrent: kobold.pvMedio,
      hpMax: kobold.pvMedio,
      hpTemp: 0,
      ac: kobold.ca,
      speed: kobold.deslocamento,
      initiativeMod: kobold.iniciativaMod,
      initiativeValue: null,
      conditions: [],
      sourceRole: kobold.papelTatico,
      sourceCr: kobold.cr,
      bloodiedThreshold: Math.floor(kobold.pvMedio / 2),
      attacks: kobold.ataques.map((a) => ({
        id: `atk-${a.nome}`,
        name: a.nome,
        bonus: a.acerto,
        damage: a.dadosDano,
        damageType: a.tipoDano,
        effect: a.efeito55,
      })),
    });

    expect(token.hidden).toBe(true);
    expect(token.bloodiedThreshold).toBe(Math.floor(kobold.pvMedio / 2));
    expect(token.attacks?.length).toBe(kobold.ataques.length);
    expect(token.sourceCr).toBe(kobold.cr);
  });
});
