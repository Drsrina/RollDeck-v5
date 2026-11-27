import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Building2,
  Compass,
  ExternalLink,
  Globe,
  HardDrive,
  Info,
  Maximize2,
  Minimize2,
  PanelsTopLeft,
  RefreshCw,
  Shield,
  Map as MapIcon,
} from 'lucide-react';
import { HeraldryVaultDrawer } from '../components/studio/HeraldryVaultDrawer';
import { WorldMapVaultDrawer } from '../components/studio/WorldMapVaultDrawer';
import { canAccessTab, useAuthSession } from '../lib/authSession';
import { useAppStore } from '../store/useAppStore';
import { useHeraldryStore } from '../store/useHeraldryStore';
import { useWorldMapStore } from '../store/useWorldMapStore';

export type StudioToolId = 'city' | 'heraldry' | 'world' | 'notes';

interface StudioToolDef {
  id: StudioToolId;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  url: string;
  isAvailable: boolean;
  comingSoonPlan?: string;
  shortcutsTip: string;
}

export const StudioScreen: React.FC = () => {
  const { user: currentUser } = useAuthSession();
  const studioInitialTool = useAppStore((s) => s.studioInitialTool);
  const setStudioInitialTool = useAppStore((s) => s.setStudioInitialTool);

  const {
    armoriaSourceMode,
    setArmoriaSourceMode,
    getEffectiveArmoriaUrl,
    brasoes,
  } = useHeraldryStore();

  const {
    fmgSourceMode,
    setFMGSourceMode,
    getEffectiveFMGUrl,
    mapas,
  } = useWorldMapStore();

  const [activeToolId, setActiveToolId] = useState<StudioToolId>(() => {
    return studioInitialTool || 'city';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);
  const [isHeraldryVaultOpen, setIsHeraldryVaultOpen] = useState(false);
  const [isWorldMapVaultOpen, setIsWorldMapVaultOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Consumir ferramenta inicial se acionada externamente (ex: da Forja)
  useEffect(() => {
    if (studioInitialTool) {
      setActiveToolId(studioInitialTool);
      setStudioInitialTool(undefined as any);
    }
  }, [studioInitialTool, setStudioInitialTool]);

  if (!canAccessTab(currentUser, 'studio')) {
    return null;
  }

  const effectiveArmoriaUrl = getEffectiveArmoriaUrl();
  const effectiveFMGUrl = getEffectiveFMGUrl();

  const STUDIO_TOOLS: StudioToolDef[] = [
    {
      id: 'city',
      name: 'Gerador Medieval de Cidades (Watabou)',
      shortName: 'Cidades Medievais',
      icon: Building2,
      description:
        'Geração procedural de plantas baixas urbanas com distritos, muralhas, torres, castelos e rios navegáveis.',
      url: '/apps/city-generator/index.html',
      isAvailable: true,
      shortcutsTip:
        'Dica: Pressione Enter ou clique na cidade para sortear novos layouts, ou use o menu do gerador para exportar em PNG/SVG.',
    },
    {
      id: 'heraldry',
      name: 'Armoria — Heráldica & Brasões (Azgaar)',
      shortName: 'Brasões & Heráldica',
      icon: Shield,
      description:
        'Criação e edição vetorial de brasões para facções, reinos, famílias nobres, cavaleiros e clãs.',
      url: effectiveArmoriaUrl,
      isAvailable: true,
      shortcutsTip:
        'Dica: Crie e personalize seu brasão, exporte em SVG e use o botão "Cofre de Brasões" para associar às suas facções ou fichas.',
    },
    {
      id: 'world',
      name: 'Azgaar’s Fantasy Map Generator (FMG)',
      shortName: 'Mapa Continental',
      icon: MapIcon,
      description:
        'Simulação cartográfica completa: biomas, relevo, altitude, rios, províncias e governos continentais.',
      url: effectiveFMGUrl,
      isAvailable: true,
      shortcutsTip:
        'Dica: Gere o mapa continental, exporte PNG/SVG no menu do FMG e clique em "Cofre de Mapas" para enviar ao VTT ou Canvas Mental!',
    },
    {
      id: 'notes',
      name: 'SilverBullet — Obsidian Vault & Notas Markdown',
      shortName: 'Vault Markdown',
      icon: BookOpen,
      description:
        'Editor de notas Markdown conectado ao vault de campanha sincronizado via Docker.',
      url: `http://${
        typeof window !== 'undefined' && window.location?.hostname
          ? window.location.hostname
          : 'localhost'
      }:8083`,
      isAvailable: true,
      shortcutsTip:
        'Dica: O SilverBullet roda localmente na porta 8083 com suporte a wiki-links e tags sincronizadas com o RollDeck.',
    },
  ];

  const activeTool = STUDIO_TOOLS.find((t) => t.id === activeToolId) || STUDIO_TOOLS[0];

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-2 w-full h-full pb-16 md:pb-2 ${
        isFullscreen ? 'p-2 bg-[#07060d]' : 'px-1.5 pt-1.5 md:px-2 md:pt-2'
      }`}
    >
      {/* Barra de Seleção de Ferramentas e Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0d0b1a] px-3 py-2 rounded-xl border border-white/10 shrink-0 shadow-lg">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
          <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 shrink-0">
            <PanelsTopLeft className="w-5 h-5 animate-pulse" />
          </div>
          {STUDIO_TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isSelected = tool.id === activeToolId;

            return (
              <button
                key={tool.id}
                onClick={() => setActiveToolId(tool.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.35)]'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tool.shortName}</span>
                {!tool.isAvailable && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {tool.comingSoonPlan}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Controles da Ferramenta Ativa */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
          {/* Seletor Rápido de Fonte quando Armoria está ativo */}
          {activeToolId === 'heraldry' && (
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => {
                  setArmoriaSourceMode('cloud');
                  handleRefresh();
                }}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                  armoriaSourceMode === 'cloud'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Usar versão web oficial (Vercel)"
              >
                <Globe className="w-3 h-3" />
                <span>Nuvem</span>
              </button>
              <button
                onClick={() => {
                  setArmoriaSourceMode('docker');
                  handleRefresh();
                }}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                  armoriaSourceMode === 'docker'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Usar container local (localhost:8081)"
              >
                <HardDrive className="w-3 h-3" />
                <span>Docker</span>
              </button>
            </div>
          )}

          {/* Seletor Rápido de Fonte quando FMG está ativo */}
          {activeToolId === 'world' && (
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
              <button
                onClick={() => {
                  setFMGSourceMode('cloud');
                  handleRefresh();
                }}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                  fmgSourceMode === 'cloud'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Usar versão web oficial (GitHub Pages)"
              >
                <Globe className="w-3 h-3" />
                <span>Nuvem</span>
              </button>
              <button
                onClick={() => {
                  setFMGSourceMode('docker');
                  handleRefresh();
                }}
                className={`px-2 py-1 rounded-lg flex items-center gap-1 transition cursor-pointer ${
                  fmgSourceMode === 'docker'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Usar container local (localhost:8080)"
              >
                <HardDrive className="w-3 h-3" />
                <span>Docker</span>
              </button>
            </div>
          )}

          {/* Botão para abrir o Cofre de Heráldica / Brasões */}
          {activeToolId === 'heraldry' && (
            <button
              onClick={() => setIsHeraldryVaultOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 text-xs font-bold transition cursor-pointer"
              title="Abrir Cofre de Brasões do RollDeck"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Cofre de Brasões ({brasoes.length})</span>
            </button>
          )}

          {/* Botão para abrir o Cofre de Mapas */}
          {activeToolId === 'world' && (
            <button
              onClick={() => setIsWorldMapVaultOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/30 text-xs font-bold transition cursor-pointer"
              title="Abrir Cofre de Mapas Continentais"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Cofre de Mapas ({mapas.length})</span>
            </button>
          )}

          {activeTool.isAvailable && (
            <>
              <button
                onClick={handleRefresh}
                title="Recarregar aplicação"
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleToggleFullscreen}
                title={isFullscreen ? 'Sair da tela cheia' : 'Expandir tela cheia'}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              <a
                href={activeTool.url}
                target="_blank"
                rel="noreferrer"
                title="Abrir em nova aba"
                className="p-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/30 transition flex items-center justify-center cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </>
          )}
        </div>
      </div>

      {/* Dica de Uso & Contexto */}
      {activeTool.isAvailable && (
        <div className="px-3 py-2 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-center gap-2 text-xs text-cyan-200 shrink-0">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="truncate">{activeTool.shortcutsTip}</span>
        </div>
      )}

      {/* Container Principal do Iframe */}
      <div className="flex-1 w-full rounded-2xl bg-black border border-white/15 overflow-hidden shadow-2xl relative min-h-[450px]">
        {activeTool.isAvailable ? (
          <iframe
            key={`${activeTool.id}-${iframeKey}-${activeTool.url}`}
            src={activeTool.url}
            title={activeTool.name}
            className="w-full h-full border-0 select-none"
            allow="fullscreen; clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-downloads allow-forms allow-popups"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-cyan-400">
              <PanelsTopLeft className="w-10 h-10 animate-bounce" />
            </div>
            <div className="max-w-md">
              <h3 className="text-lg font-bold text-white">{activeTool.name}</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                {activeTool.description}
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                Integração prevista para o {activeTool.comingSoonPlan}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer do Cofre de Heráldica */}
      <HeraldryVaultDrawer
        isOpen={isHeraldryVaultOpen}
        onClose={() => setIsHeraldryVaultOpen(false)}
        onOpenHeraldryTool={() => {
          setActiveToolId('heraldry');
          setIsHeraldryVaultOpen(false);
        }}
      />

      {/* Drawer do Cofre de Mapas */}
      <WorldMapVaultDrawer
        isOpen={isWorldMapVaultOpen}
        onClose={() => setIsWorldMapVaultOpen(false)}
        onOpenWorldTool={() => {
          setActiveToolId('world');
          setIsWorldMapVaultOpen(false);
        }}
      />
    </div>
  );
};
