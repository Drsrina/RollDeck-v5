import {
  Castle,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dices,
  History,
  IdCard,
  Keyboard,
  LogOut,
  Map as MapIcon,
  PackageCheck,
  PanelsTopLeft,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Swords,
  Trash2,
  Volume2,
  VolumeX,
  X,
  LucideIcon,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { isPersistenceGranted } from '../../db/indexedDB';
import { canAccessTab, clearAuthSession, ROLE_META, useAuthSession } from '../../lib/authSession';
import { triggerHaptic } from '../../lib/haptics';
import { playDiceRollSound } from '../../lib/audio';
import { type ActiveTab, useAppStore } from '../../store/useAppStore';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface DesktopSidebarProps {
  className?: string;
  isMobileDrawer?: boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  className = '',
  isMobileDrawer = false,
}) => {
  const {
    activeTab,
    setActiveTab,
    settings,
    updateSettings,
    tray,
    clearTray,
    rollTray,
    isRolling,
    isSidebarCollapsed,
    toggleSidebar,
    setMobileDrawerOpen,
  } = useAppStore();

  const [persisted, setPersisted] = useState(false);
  const { user: currentUser } = useAuthSession();

  useEffect(() => {
    isPersistenceGranted().then(setPersisted);
  }, []);

  const totalDiceInTray = tray.reduce((acc, t) => acc + t.count, 0);

  const allTabs: {
    id: ActiveTab;
    label: string;
    icon: LucideIcon;
    badge?: number;
  }[] = [
    {
      id: 'roll',
      label: 'Mesa de Rolagem',
      icon: Dices,
      badge: totalDiceInTray > 0 ? totalDiceInTray : undefined,
    },
    { id: 'sheets', label: 'Minhas Fichas', icon: IdCard },
    { id: 'packages', label: 'Pacotes Pré-config', icon: PackageCheck },
    { id: 'map', label: 'Mapa de Notas', icon: MapIcon },
    { id: 'vtt', label: 'Tabuleiro VTT', icon: Swords },
    { id: 'loot', label: 'Geradores de Loot', icon: Sparkles },
    { id: 'forja', label: 'Forja de Mundos', icon: Compass },
    { id: 'studio', label: 'Estúdio de Criação', icon: PanelsTopLeft },
    { id: 'oraculo', label: 'Oráculo da Cidade', icon: Castle },
    { id: 'history', label: 'Histórico & Logs', icon: History },
    { id: 'settings', label: 'Ajustes & Dados', icon: Settings },
  ];

  const tabs = allTabs
    .filter((tab) => canAccessTab(currentUser, tab.id))
    .map((tab, index) => ({
      ...tab,
      shortcut: String(index + 1),
    }));

  const handleSelectTab = (tab: ActiveTab) => {
    triggerHaptic('tap', settings.hapticsEnabled);
    setActiveTab(tab);
    if (isMobileDrawer) {
      setMobileDrawerOpen(false);
    }
  };

  const handleQuickRoll = () => {
    if (totalDiceInTray === 0 || isRolling) return;
    triggerHaptic('roll', settings.hapticsEnabled);
    if (settings.soundEnabled) playDiceRollSound(totalDiceInTray);
    rollTray();
  };

  const isCollapsed = !isMobileDrawer && isSidebarCollapsed;

  return (
    <aside
      aria-label="Navegação Lateral"
      style={{
        backgroundColor: 'var(--bg-dark-secondary, #0d0b1a)',
        borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.12))',
      }}
      className={`flex flex-col h-full border-r backdrop-blur-2xl z-40 select-none transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64 lg:w-72'
      } ${className}`}
    >
      {/* Brand Header */}
      <div
        className="p-3.5 lg:p-4 border-b flex items-center justify-between transition-colors"
        style={{ borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.1))' }}
      >
        <div className={`flex items-center gap-3 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <div
            className="relative flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform hover:scale-105 cursor-pointer shadow-md"
            style={{
              backgroundColor: 'var(--theme-primary-glow, rgba(34, 211, 238, 0.2))',
              border: '1px solid var(--theme-primary, #22d3ee)',
              boxShadow: '0 0 16px var(--theme-primary-glow, rgba(34, 211, 238, 0.25))',
            }}
            onClick={() => handleSelectTab('roll')}
            title="Ir para a Mesa de Rolagem"
          >
            <Dices
              className="w-5 h-5 animate-pulse"
              style={{ color: 'var(--theme-primary, #22d3ee)' }}
            />
          </div>

          {!isCollapsed && (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="font-black tracking-wider text-lg truncate drop-shadow-sm"
                  style={{ color: 'var(--theme-primary, #22d3ee)' }}
                >
                  ROLLDECK
                </span>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: 'var(--theme-secondary-glow, rgba(232, 121, 249, 0.2))',
                    color: 'var(--theme-secondary, #e879f9)',
                    borderColor: 'var(--theme-secondary, #e879f9)',
                  }}
                >
                  TTRPG
                </span>
              </div>
              <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                <span>100% Offline</span>
                {persisted && (
                  <span
                    className="inline-flex items-center gap-1"
                    style={{ color: 'var(--theme-accent, #a3e635)' }}
                    title="Dados protegidos no IndexedDB"
                  >
                    • <ShieldCheck className="w-3 h-3 inline" /> Salvo Seguro
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Botão de Fechar no Mobile Drawer */}
        {isMobileDrawer && (
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition cursor-pointer"
            title="Fechar menu lateral"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Botão de Recolher/Expandir no Desktop */}
        {!isMobileDrawer && (
          <button
            onClick={toggleSidebar}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border transition cursor-pointer ${
              isCollapsed ? 'hidden' : 'block'
            }`}
            style={{ borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.1))' }}
            title="Recolher menu lateral"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Botão de Expandir quando recolhido no Desktop */}
      {isCollapsed && !isMobileDrawer && (
        <div className="p-2 border-b flex justify-center" style={{ borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.1))' }}>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border transition cursor-pointer"
            style={{
              borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--theme-primary, #22d3ee)',
            }}
            title="Expandir menu lateral"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PWA Install Button se expandido */}
      {!isCollapsed && (
        <div className="px-3 pt-3">
          <PWAInstallButton />
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <nav className="flex-1 px-2.5 py-3 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <div className="px-2 pb-1 text-[10px] font-bold tracking-wider uppercase text-slate-500">
            Navegação Principal
          </div>
        )}

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              aria-selected={isActive}
              title={isCollapsed ? tab.label : undefined}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'
              } rounded-xl transition-all duration-200 group text-left relative cursor-pointer ${
                isActive
                  ? 'text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: 'var(--theme-primary-glow, rgba(34, 211, 238, 0.18))',
                      borderLeft: isCollapsed ? undefined : '4px solid var(--theme-primary, #22d3ee)',
                      boxShadow: 'inset 0 0 15px var(--theme-primary-glow, rgba(34, 211, 238, 0.12))',
                    }
                  : {}
              }
            >
              <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
                <Icon
                  className="w-5 h-5 transition-transform group-hover:scale-110 shrink-0"
                  style={{
                    color: isActive ? 'var(--theme-primary, #22d3ee)' : undefined,
                    filter: isActive
                      ? 'drop-shadow(0 0 8px var(--theme-primary-glow, rgba(34, 211, 238, 0.6)))'
                      : undefined,
                  }}
                />
                {!isCollapsed && <span className="text-sm truncate">{tab.label}</span>}
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-2 shrink-0">
                  {tab.badge !== undefined && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-black text-black shadow-sm"
                      style={{
                        backgroundColor: 'var(--theme-primary, #22d3ee)',
                      }}
                    >
                      {tab.badge}
                    </span>
                  )}
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/5 border border-white/10 text-slate-400 group-hover:text-slate-200">
                    {tab.shortcut}
                  </kbd>
                </div>
              )}

              {/* Indicador de badge quando recolhido */}
              {isCollapsed && tab.badge !== undefined && (
                <span
                  className="absolute top-1 right-2 w-2.5 h-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: 'var(--theme-primary, #22d3ee)' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Widget Rápido da Bandeja de Dados (se houver dados) */}
      <div
        className="p-3 border-t bg-black/20"
        style={{ borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.1))' }}
      >
        {!isCollapsed && totalDiceInTray > 0 ? (
          <div
            className="rounded-xl p-3 space-y-2.5 shadow-md border"
            style={{
              backgroundColor: 'var(--bg-dark, #07060d)',
              borderColor: 'var(--theme-primary, #22d3ee)',
              boxShadow: '0 0 15px var(--theme-primary-glow, rgba(34, 211, 238, 0.15))',
            }}
          >
            <div className="flex items-center justify-between text-xs">
              <span
                className="font-bold flex items-center gap-1.5"
                style={{ color: 'var(--theme-primary, #22d3ee)' }}
              >
                <Dices className="w-4 h-4" />
                {totalDiceInTray} {totalDiceInTray === 1 ? 'dado pronto' : 'dados prontos'}
              </span>
              <button
                onClick={() => clearTray()}
                aria-label="Limpar bandeja"
                className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                Limpar
              </button>
            </div>

            {/* Chips Preview */}
            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pr-1">
              {tray.map((t) => (
                <span
                  key={t.dieId}
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono border"
                  style={{
                    backgroundColor: 'var(--theme-primary-glow, rgba(34, 211, 238, 0.15))',
                    borderColor: 'var(--theme-primary, #22d3ee)',
                    color: 'var(--theme-primary, #22d3ee)',
                  }}
                >
                  {t.count}×{t.dieId}
                </span>
              ))}
            </div>

            {/* Quick Roll Button */}
            <button
              onClick={handleQuickRoll}
              disabled={isRolling}
              className="w-full py-2.5 px-3 rounded-lg text-black font-black text-xs tracking-wider flex items-center justify-center gap-2 hover:brightness-110 active:scale-98 transition shadow-lg cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-primary, #22d3ee)',
                boxShadow: '0 0 16px var(--theme-primary-glow, rgba(34, 211, 238, 0.35))',
              }}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRolling ? 'ROLANDO...' : 'ROLAR BANDEJA'}</span>
              <kbd className="text-[9px] px-1 py-0.2 rounded bg-black/25 text-black font-mono">Espaço</kbd>
            </button>
          </div>
        ) : !isCollapsed ? (
          <div className="rounded-xl p-2.5 border border-white/5 text-slate-400 flex items-start gap-2 bg-black/30">
            <Keyboard
              className="w-4 h-4 shrink-0 mt-0.5"
              style={{ color: 'var(--theme-primary, #22d3ee)' }}
            />
            <div className="text-[11px] leading-tight space-y-0.5">
              <p className="font-medium text-slate-300">Atalhos:</p>
              <p className="text-[10px] text-slate-400">
                <span style={{ color: 'var(--theme-primary, #22d3ee)' }}>1-{tabs.length}</span> troca de aba •{' '}
                <span style={{ color: 'var(--theme-primary, #22d3ee)' }}>Espaço</span> rola dados
              </p>
            </div>
          </div>
        ) : (
          /* Ícone de atalho rápido na barra recolhida */
          <div className="flex flex-col items-center gap-2">
            {totalDiceInTray > 0 && (
              <button
                onClick={handleQuickRoll}
                disabled={isRolling}
                className="p-2.5 rounded-xl text-black shadow-md hover:brightness-110 transition cursor-pointer"
                style={{ backgroundColor: 'var(--theme-primary, #22d3ee)' }}
                title={`Rolar ${totalDiceInTray} dados prontos`}
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            )}
            <button
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              className="p-2 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition cursor-pointer"
              title={settings.soundEnabled ? 'Desativar som' : 'Ativar som'}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4" style={{ color: 'var(--theme-primary, #22d3ee)' }} />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-500" />
              )}
            </button>
          </div>
        )}

        {/* Desktop Quick Sound Toggle & User Account Card */}
        {!isCollapsed ? (
          <div className="mt-2.5 pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px]">Efeitos Sonoros</span>
              <button
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition text-[11px] cursor-pointer"
                title={settings.soundEnabled ? 'Desativar som' : 'Ativar som'}
              >
                {settings.soundEnabled ? (
                  <>
                    <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--theme-primary, #22d3ee)' }} />
                    <span>Ligado</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                    <span>Mudo</span>
                  </>
                )}
              </button>
            </div>

            {currentUser && (
              <div className="p-2 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleSelectTab('settings');
                    window.dispatchEvent(
                      new CustomEvent('rolldeck:open-settings-subtab', { detail: 'users' })
                    );
                  }}
                  className="flex items-center gap-2 min-w-0 text-left group cursor-pointer flex-1"
                  title="Abrir Conta e Usuários"
                >
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-[11px] font-black text-cyan-200 shrink-0">
                    {currentUser.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white truncate group-hover:text-cyan-200 transition">
                        {currentUser.displayName}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border shrink-0 ${ROLE_META[currentUser.role].badgeClass}`}
                      >
                        {ROLE_META[currentUser.role].shortLabel}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono block truncate">
                      @{currentUser.username}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => clearAuthSession()}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition cursor-pointer shrink-0"
                  title="Sair da conta"
                  aria-label="Sair da conta"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          currentUser && (
            <div className="mt-2 pt-2 border-t border-white/5 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => clearAuthSession()}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition cursor-pointer"
                title={`Sair (@${currentUser.username})`}
                aria-label="Sair da conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )
        )}
      </div>
    </aside>
  );
};

