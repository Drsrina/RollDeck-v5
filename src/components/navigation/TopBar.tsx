import { Dices, LogOut, Menu } from 'lucide-react';
import React from 'react';
import { clearAuthSession, ROLE_META, useAuthSession } from '../../lib/authSession';
import { useAppStore } from '../../store/useAppStore';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export const TopBar: React.FC = () => {
  const { setMobileDrawerOpen, setActiveTab } = useAppStore();
  const { user: currentUser } = useAuthSession();

  return (
    <header
      style={{
        backgroundColor: 'var(--bg-dark-secondary, #0d0b1a)',
        borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.12))',
      }}
      className="md:hidden sticky top-0 z-30 w-full pt-[calc(0.5rem+var(--safe-top))] pb-2.5 px-4 backdrop-blur-xl border-b"
    >
      <div className="max-w-lg mx-auto flex items-center justify-between gap-2">
        {/* Left side: Hamburger button + Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Abrir menu de navegação"
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border transition cursor-pointer flex items-center justify-center shrink-0"
            style={{
              borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.1))',
              color: 'var(--theme-primary, #22d3ee)',
            }}
            title="Menu lateral"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div
              className="relative flex items-center justify-center w-8 h-8 rounded-lg shadow-sm border shrink-0"
              style={{
                backgroundColor: 'var(--theme-primary-glow, rgba(34, 211, 238, 0.2))',
                borderColor: 'var(--theme-primary, #22d3ee)',
              }}
            >
              <Dices
                className="w-4.5 h-4.5 animate-pulse"
                style={{ color: 'var(--theme-primary, #22d3ee)' }}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className="font-black tracking-wider text-base truncate"
                  style={{ color: 'var(--theme-primary, #22d3ee)' }}
                >
                  ROLLDECK
                </span>
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('settings');
                      window.dispatchEvent(
                        new CustomEvent('rolldeck:open-settings-subtab', { detail: 'users' })
                      );
                    }}
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0 cursor-pointer ${ROLE_META[currentUser.role].badgeClass}`}
                    title={`@${currentUser.username} — ${ROLE_META[currentUser.role].label}`}
                  >
                    {ROLE_META[currentUser.role].shortLabel}
                  </button>
                ) : (
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.2 rounded border"
                    style={{
                      backgroundColor: 'var(--theme-secondary-glow, rgba(232, 121, 249, 0.2))',
                      color: 'var(--theme-secondary, #e879f9)',
                      borderColor: 'var(--theme-secondary, #e879f9)',
                    }}
                  >
                    TTRPG
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right side: PWA Install & Logout */}
        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton />
          {currentUser && (
            <button
              type="button"
              onClick={() => clearAuthSession()}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-300 bg-white/5 hover:bg-rose-500/15 border border-white/10 transition cursor-pointer"
              title={`Sair (@${currentUser.username})`}
              aria-label="Sair da conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
