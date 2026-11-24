import { Castle, Compass, Dices, History, Map as MapIcon, PackageCheck, Settings, Sparkles, Swords, LucideIcon } from 'lucide-react';
import React from 'react';
import { triggerHaptic } from '../../lib/haptics';
import { type ActiveTab, useAppStore } from '../../store/useAppStore';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab, settings, tray } = useAppStore();

  const totalDiceInTray = tray.reduce((acc, t) => acc + t.count, 0);

  const tabs: { id: ActiveTab; label: string; icon: LucideIcon; badge?: number }[] = [
    { id: 'roll', label: 'Rolar', icon: Dices, badge: totalDiceInTray > 0 ? totalDiceInTray : undefined },
    { id: 'oraculo', label: 'Oráculo', icon: Castle },
    { id: 'forja', label: 'Forja', icon: Compass },
    { id: 'map', label: 'Mapa', icon: MapIcon },
    { id: 'vtt', label: 'VTT', icon: Swords },
    { id: 'packages', label: 'Pacotes', icon: PackageCheck },
    { id: 'loot', label: 'Loot', icon: Sparkles },
    { id: 'history', label: 'Histórico', icon: History },
    { id: 'settings', label: 'Ajustes', icon: Settings },
  ];

  const handleSelectTab = (tab: ActiveTab) => {
    triggerHaptic('tap', settings.hapticsEnabled);
    setActiveTab(tab);
  };

  return (
    <nav
      aria-label="Navegação principal"
      style={{
        backgroundColor: 'var(--bg-dark-secondary, #0d0b1a)',
        borderColor: 'var(--glass-border, rgba(255, 255, 255, 0.12))',
      }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 backdrop-blur-xl border-t pb-[var(--safe-bottom)]"
    >
      <div className="max-w-lg mx-auto flex items-center justify-between h-15 px-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => handleSelectTab(tab.id)}
              aria-selected={isActive}
              aria-label={tab.label}
              className={`relative flex flex-col items-center justify-center flex-1 h-full min-h-[44px] px-0.5 transition-all duration-200 cursor-pointer ${
                isActive ? 'font-bold scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
              style={{
                color: isActive ? 'var(--theme-primary, #22d3ee)' : undefined,
              }}
            >
              <div className="relative">
                <Icon
                  className="w-4.5 h-4.5 transition-transform"
                  style={{
                    filter: isActive
                      ? 'drop-shadow(0 0 8px var(--theme-primary-glow, rgba(34, 211, 238, 0.7)))'
                      : undefined,
                  }}
                />
                {tab.badge !== undefined && (
                  <span
                    className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[8px] font-bold text-black shadow-md"
                    style={{ backgroundColor: 'var(--theme-primary, #22d3ee)' }}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[9px] mt-0.5 tracking-tight truncate max-w-full font-medium">{tab.label}</span>
              {isActive && (
                <span
                  className="absolute bottom-0.5 w-4 h-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--theme-primary, #22d3ee)',
                    boxShadow: '0 0 8px var(--theme-primary-glow, rgba(34, 211, 238, 0.8))',
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
