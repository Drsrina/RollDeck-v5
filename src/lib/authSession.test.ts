import { describe, expect, it } from 'vitest';
import { createDefaultSidekickSheet } from './characterSheet';
import {
  canAccessTab,
  GM_ONLY_TABS,
  isGmOrAdmin,
  PLAYER_ONLY_TABS,
  type AppTabId,
  type AuthUser,
  type UserRole,
} from './authSession';

function makeUser(role: UserRole): AuthUser {
  const now = Date.now();
  return {
    id: `usr_${role}`,
    username: role,
    displayName: role.toUpperCase(),
    role,
    scopes: role === 'admin' || role === 'gm' ? ['read', 'write', 'roll', 'generate'] : role === 'player' ? ['read', 'roll'] : ['read'],
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

const GENERAL_TABS: AppTabId[] = ['roll', 'packages', 'vtt', 'history', 'settings'];

describe('RBAC de módulos RollDeck (canAccessTab & isGmOrAdmin)', () => {
  it('permite módulos GM e gerais para admin e gm, mantendo Minhas Fichas dedicado a jogadores', () => {
    const admin = makeUser('admin');
    const gm = makeUser('gm');

    expect(isGmOrAdmin(admin)).toBe(true);
    expect(isGmOrAdmin(gm)).toBe(true);

    for (const tab of [...GM_ONLY_TABS, ...GENERAL_TABS]) {
      expect(canAccessTab(admin, tab)).toBe(true);
      expect(canAccessTab(gm, tab)).toBe(true);
    }

    for (const playerTab of PLAYER_ONLY_TABS) {
      expect(canAccessTab(admin, playerTab)).toBe(false);
      expect(canAccessTab(gm, playerTab)).toBe(false);
    }
  });

  it('bloqueia Forja de Mundos, Mapa de Notas, Oráculo e Geradores de Loot para jogador e observador', () => {
    const player = makeUser('player');
    const viewer = makeUser('viewer');

    expect(isGmOrAdmin(player)).toBe(false);
    expect(isGmOrAdmin(viewer)).toBe(false);
    expect(isGmOrAdmin(null)).toBe(false);

    for (const restrictedTab of ['forja', 'map', 'oraculo', 'loot'] as AppTabId[]) {
      expect(canAccessTab(player, restrictedTab)).toBe(false);
      expect(canAccessTab(viewer, restrictedTab)).toBe(false);
      expect(canAccessTab(null, restrictedTab)).toBe(false);
    }

    for (const allowedTab of GENERAL_TABS) {
      expect(canAccessTab(player, allowedTab)).toBe(true);
      expect(canAccessTab(viewer, allowedTab)).toBe(true);
    }

    // Menu dedicado de fichas de personagens e sidekicks exclusivo para jogadores
    expect(canAccessTab(player, 'sheets')).toBe(true);
    expect(canAccessTab(viewer, 'sheets')).toBe(false);
    expect(canAccessTab(null, 'sheets')).toBe(false);
  });

  it('gera presets válidos de fichas de sidekick para todos os papéis', () => {
    const warrior = createDefaultSidekickSheet('warrior', 'Lucas');
    const expert = createDefaultSidekickSheet('expert', 'Lucas');
    const spellcaster = createDefaultSidekickSheet('spellcaster', 'Lucas');
    const companion = createDefaultSidekickSheet('companion', 'Lucas');

    expect(warrior.playerName).toBe('Lucas');
    expect(warrior.ac).toBeGreaterThanOrEqual(14);
    expect(expert.skills).toContain('Furtividade');
    expect(spellcaster.attacks.length).toBeGreaterThan(0);
    expect(companion.speed).toBe('12m');
  });
});
