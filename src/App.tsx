import React, { useEffect, useMemo } from 'react';
import { DiceRollAnimation } from './components/dice/DiceRollAnimation';
import { FloatingDice3DOverlay } from './components/dice/FloatingDice3DOverlay';
import { RollResultsModal } from './components/dice/RollResultsModal';
import { BottomNav } from './components/navigation/BottomNav';
import { DesktopSidebar } from './components/navigation/DesktopSidebar';
import { TopBar } from './components/navigation/TopBar';
import { playDiceRollSound } from './lib/audio';
import { HistoryScreen } from './screens/HistoryScreen';
import { LootScreen } from './screens/LootScreen';
import { MapScreen } from './screens/MapScreen';
import { PackagesScreen } from './screens/PackagesScreen';
import { PlayerSheetsScreen } from './screens/PlayerSheetsScreen';
import { RollScreen } from './screens/RollScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ForjaScreen } from './screens/ForjaScreen';
import { OraculoScreen } from './screens/OraculoScreen';
import { VttScreen } from './screens/VttScreen';
import { DisclaimerTokenModal } from './components/auth/DisclaimerTokenModal';
import { FloatingWindowsHost } from './components/map/FloatingWindowsHost';
import {
  canAccessTab,
  clearAuthSession,
  getSessionToken,
  isGmOrAdmin,
  setAuthSession,
  useAuthSession,
} from './lib/authSession';
import { type ActiveTab, useAppStore } from './store/useAppStore';

const ORDERED_TABS: readonly ActiveTab[] = [
  'roll',
  'sheets',
  'packages',
  'map',
  'vtt',
  'loot',
  'forja',
  'oraculo',
  'history',
  'settings',
];

export default function App() {
  const { token: sessionToken, user: currentUser } = useAuthSession();
  const isAuthenticated = Boolean(sessionToken && currentUser);
  const [authChecking, setAuthChecking] = React.useState<boolean>(true);

  const {
    isInitialized,
    refreshFromDB,
    activeTab,
    setActiveTab,
    currentResult,
    showResultModal,
    setShowResultModal,
    rollAgain,
    tray,
    rollTray,
    isRolling,
    settings,
    isMobileDrawerOpen,
    setMobileDrawerOpen,
  } = useAppStore();

  useEffect(() => {
    refreshFromDB();
  }, [refreshFromDB]);

  // Valida sessão em memória no servidor (sem persistir token em localStorage)
  useEffect(() => {
    const activeToken = getSessionToken();
    if (!activeToken) {
      setAuthChecking(false);
      return;
    }

    fetch('/api/auth/validate-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`,
      },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid && data.user) {
          setAuthSession(activeToken, data.user);
        } else {
          clearAuthSession();
        }
      })
      .catch(() => {
        clearAuthSession();
      })
      .finally(() => {
        setAuthChecking(false);
      });
  }, []);

  const tabShortcutMap = useMemo(() => {
    const allowed = ORDERED_TABS.filter((tab) => canAccessTab(currentUser, tab));
    const map: Record<string, ActiveTab> = {};
    allowed.forEach((tab, idx) => {
      map[String(idx + 1)] = tab;
    });
    return map;
  }, [currentUser]);

  // Redireciona automaticamente se o usuário logado não tiver permissão para a aba ativa
  useEffect(() => {
    if (currentUser && !canAccessTab(currentUser, activeTab)) {
      setActiveTab('roll');
    }
  }, [currentUser, activeTab, setActiveTab]);

  // Global desktop keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Tab shortcuts (dinâmicos conforme as abas permitidas ao papel do usuário)
      if (tabShortcutMap[e.key]) {
        e.preventDefault();
        setActiveTab(tabShortcutMap[e.key]);
        return;
      }

      // Space to roll current tray (skip on VTT so Spacebar pans the tactical canvas cleanly)
      if (e.code === 'Space' && !e.repeat && activeTab !== 'vtt') {
        const totalDice = tray.reduce((acc, t) => acc + t.count, 0);
        if (totalDice > 0 && !isRolling) {
          e.preventDefault();
          if (settings.soundEnabled) playDiceRollSound(totalDice);
          rollTray();
        }
      }

      // Escape to close result modal
      if (e.key === 'Escape' && showResultModal) {
        setShowResultModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTab,
    setActiveTab,
    tabShortcutMap,
    tray,
    isRolling,
    rollTray,
    settings.soundEnabled,
    showResultModal,
    setShowResultModal,
  ]);

  if (!isInitialized || authChecking) {
    return (
      <div className="min-h-screen bg-[#07060d] flex flex-col items-center justify-center p-4">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-purple-500/20 to-pink-500/20 border border-cyan-400/40 shadow-[0_0_25px_rgba(34,211,238,0.3)] animate-pulse">
          <span className="text-3xl">🎲</span>
        </div>
        <p className="mt-4 text-xs font-bold tracking-widest text-cyan-300 uppercase">
          Carregando RollDeck...
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative h-screen w-screen text-slate-100 flex flex-col md:flex-row overflow-hidden transition-colors duration-500"
      style={{ backgroundColor: 'var(--bg-dark, #07060d)' }}
    >
      {/* Ambient Neon Glow Orbs (Anti-slop, subtle glassmorphic backdrop) */}
      <div
        className="fixed top-[-10%] left-[-15%] w-[450px] h-[450px] rounded-full blur-[120px] pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: 'var(--ambient-orb-1, rgba(34, 211, 238, 0.15))' }}
      />
      <div
        className="fixed top-[30%] right-[-15%] w-[400px] h-[400px] rounded-full blur-[130px] pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: 'var(--ambient-orb-2, rgba(232, 121, 249, 0.12))' }}
      />
      <div
        className="fixed bottom-[-10%] left-[20%] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none transition-colors duration-700"
        style={{ backgroundColor: 'var(--ambient-orb-3, rgba(139, 92, 246, 0.12))' }}
      />

      {/* Desktop Sidebar (visible on md+) */}
      <DesktopSidebar className="hidden md:flex" />

      {/* Mobile Drawer Sidebar (collapsible / expandable on mobile) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
            onClick={() => setMobileDrawerOpen(false)}
          />

          {/* Drawer content slide-in */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-250">
            <DesktopSidebar isMobileDrawer={true} className="flex w-full" />
          </div>
        </div>
      )}

      {/* Content Column (Mobile TopBar + Screen views) */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Mobile Top Application Bar (hidden on md+) */}
        <TopBar />

        {/* Main View Area */}
        <main className="flex-1 w-full flex flex-col overflow-hidden">
          {(() => {
            const effectiveTab: ActiveTab =
              currentUser && !canAccessTab(currentUser, activeTab) ? 'roll' : activeTab;

            if (effectiveTab === 'map' && canAccessTab(currentUser, 'map')) {
              return <MapScreen />;
            }
            if (effectiveTab === 'vtt') {
              return <VttScreen />;
            }
            return (
              <div className="flex-1 w-full overflow-y-auto">
                <div className="w-full max-w-lg md:max-w-6xl xl:max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-2 md:py-6">
                  {effectiveTab === 'roll' && <RollScreen />}
                  {effectiveTab === 'sheets' && canAccessTab(currentUser, 'sheets') && (
                    <PlayerSheetsScreen />
                  )}
                  {effectiveTab === 'packages' && <PackagesScreen />}
                  {effectiveTab === 'loot' && canAccessTab(currentUser, 'loot') && <LootScreen />}
                  {effectiveTab === 'forja' && canAccessTab(currentUser, 'forja') && <ForjaScreen />}
                  {effectiveTab === 'oraculo' && canAccessTab(currentUser, 'oraculo') && (
                    <OraculoScreen />
                  )}
                  {effectiveTab === 'history' && <HistoryScreen />}
                  {effectiveTab === 'settings' && <SettingsScreen />}
                </div>
              </div>
            );
          })()}
        </main>

        {/* Mobile Bottom Thumb Navigation Bar (hidden on md+) */}
        <BottomNav />
      </div>

      {/* 3D Dice Roll Animation Overlay */}
      <DiceRollAnimation />

      {/* Full Roll Result Modal */}
      <RollResultsModal
        result={currentResult}
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        onRollAgain={rollAgain}
      />

      {/* Autenticação simples por usuário e senha (controlada por admin, sem e-mail) */}
      <DisclaimerTokenModal
        isOpen={!isAuthenticated}
        onSuccess={(token, user) => {
          setAuthSession(token, user);
        }}
      />

      {/* Janelas Flutuantes Globais Persistentes através da navegação (somente Mestre/Admin) */}
      {isAuthenticated && isGmOrAdmin(currentUser) && <FloatingWindowsHost />}

      {/* Dados 3D Interativos Persistentes em todas as abas (ligável/desligável na Mesa de Rolagem) */}
      {isAuthenticated && settings.dice3DEnabled !== false && <FloatingDice3DOverlay />}
    </div>
  );
}
