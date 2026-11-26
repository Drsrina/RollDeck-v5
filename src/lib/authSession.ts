import { useSyncExternalStore } from 'react';

export type UserRole = 'admin' | 'gm' | 'player' | 'viewer';
export type ApiScope = 'read' | 'write' | 'roll' | 'generate';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  scopes: ApiScope[];
  active: boolean;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number;
}

export interface AuthSessionSnapshot {
  token: string | null;
  user: AuthUser | null;
}

export const ROLE_META: Record<
  UserRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
  }
> = {
  admin: {
    label: 'Administrador',
    shortLabel: 'Admin',
    description: 'Controle total: usuários, chaves de API, leitura, escrita e motores RPG.',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/40',
  },
  gm: {
    label: 'Mestre (GM)',
    shortLabel: 'Mestre',
    description:
      'Acesso completo à campanha: Forja de Mundos, Mapa de Notas, Oráculo, Geradores de Loot, VTT, pacotes e rolagens.',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
  },
  player: {
    label: 'Jogador',
    shortLabel: 'Jogador',
    description:
      'Cria e joga fichas de Personagens e Sidekicks, usa Mesa de Rolagem, Pacotes, Tabuleiro VTT e Histórico.',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
  },
  viewer: {
    label: 'Observador',
    shortLabel: 'Observador',
    description:
      'Acesso somente leitura à Mesa, Pacotes, Tabuleiro VTT e Histórico (sem acesso às ferramentas do Mestre).',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-400/40',
  },
};

export type AppTabId =
  | 'roll'
  | 'sheets'
  | 'packages'
  | 'map'
  | 'vtt'
  | 'loot'
  | 'forja'
  | 'oraculo'
  | 'history'
  | 'settings';

export const GM_ONLY_TABS: readonly AppTabId[] = ['forja', 'map', 'oraculo', 'loot'] as const;

export const PLAYER_ONLY_TABS: readonly AppTabId[] = ['sheets'] as const;

export function isGmOrAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'gm';
}

export function canAccessTab(user: AuthUser | null, tab: AppTabId): boolean {
  if (GM_ONLY_TABS.includes(tab)) {
    return isGmOrAdmin(user);
  }
  if (PLAYER_ONLY_TABS.includes(tab)) {
    return user?.role === 'player';
  }
  return true;
}

/**
 * In-memory session holder for authenticated RollDeck users.
 * Intentionally avoids localStorage/sessionStorage for security hygiene.
 */
let sessionSnapshot: AuthSessionSnapshot = {
  token: null,
  user: null,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// Clean up any legacy token from localStorage if present
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('rolldeck_auth_session');
  }
} catch {}

export function getSessionToken(): string | null {
  return sessionSnapshot.token;
}

export function getAuthUser(): AuthUser | null {
  return sessionSnapshot.user;
}

export function setAuthSession(token: string | null, user: AuthUser | null): void {
  sessionSnapshot = { token, user };
  emitChange();
}

export function updateAuthUser(user: AuthUser): void {
  sessionSnapshot = { ...sessionSnapshot, user };
  emitChange();
}

export function setSessionToken(token: string | null): void {
  sessionSnapshot = {
    token,
    user: token ? sessionSnapshot.user : null,
  };
  emitChange();
}

export function clearAuthSession(): void {
  sessionSnapshot = { token: null, user: null };
  emitChange();
}

export function clearSessionToken(): void {
  clearAuthSession();
}

export function subscribeAuthSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthSession(): AuthSessionSnapshot {
  return useSyncExternalStore(
    subscribeAuthSession,
    () => sessionSnapshot,
    () => sessionSnapshot
  );
}

export function hasScope(user: AuthUser | null, scope: ApiScope): boolean {
  if (!user) return false;
  return user.scopes.includes(scope);
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (sessionSnapshot.token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${sessionSnapshot.token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    headers,
  });
}
