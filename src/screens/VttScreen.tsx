import {
  Check,
  Compass,
  Copy,
  Crosshair,
  Grid,
  Hand,
  Hexagon,
  Image as ImageIcon,
  Layers,
  Magnet,
  MousePointer2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Ruler,
  Skull,
  Sliders,
  Swords,
  Trash2,
  Undo2,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { VttBestiaryModal } from '../components/vtt/VttBestiaryModal';
import { VttCanvas } from '../components/vtt/VttCanvas';
import { VttCombatSidebar } from '../components/vtt/VttCombatSidebar';
import { VttImportModal } from '../components/vtt/VttImportModal';
import { VttTokenModal } from '../components/vtt/VttTokenModal';
import { VttWeatherPopover } from '../components/vtt/VttWeatherPopover';
import { isGmOrAdmin, useAuthSession } from '../lib/authSession';
import { stopWeatherAudio } from '../lib/vttWeatherAudio';
import { useVttStore } from '../store/useVttStore';
import {
  VTT_SURFACE_PRESETS,
  type VttGridType,
  type VttSurfacePreset,
} from '../types/vtt';

async function readBattlemapFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number; name: string }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler mapa'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Imagem inválida'));
    el.src = dataUrl;
  });

  // Cap largest dimension to 2048px to keep IndexedDB fast and crisp
  const maxDim = 2048;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const outW = Math.round(img.width * scale);
  const outH = Math.round(img.height * scale);

  if (scale < 1) {
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, outW, outH);
      return {
        dataUrl: canvas.toDataURL('image/webp', 0.88),
        width: outW,
        height: outH,
        name: file.name,
      };
    }
  }

  return { dataUrl, width: img.width, height: img.height, name: file.name };
}

export const VttScreen: React.FC = () => {
  const {
    scenes,
    activeSceneId,
    selectedTokenId,
    activeTool,
    isRightPanelOpen,
    undoStack,
    selectScene,
    createScene,
    renameScene,
    duplicateScene,
    deleteScene,
    updateGrid,
    setSurfacePreset,
    setBackground,
    updateBackground,
    setCamera,
    setActiveTool,
    setRightPanelOpen,
    deleteToken,
    clearAllTokens,
    stepSelectedToken,
    snapAllTokensToGrid,
    undo,
    requestCameraFocus,
  } = useVttStore();

  const { user: currentUser } = useAuthSession();
  const canUseGmModules = isGmOrAdmin(currentUser);
  const isViewer = currentUser?.role === 'viewer';

  const activeScene = useMemo(
    () => scenes.find((s) => s.id === activeSceneId) || scenes[0],
    [scenes, activeSceneId]
  );

  const [isNewTokenOpen, setIsNewTokenOpen] = useState(false);
  const [isBestiaryOpen, setIsBestiaryOpen] = useState(false);
  const [importModal, setImportModal] = useState<{
    open: boolean;
    tab: 'characters' | 'encounter';
  }>({ open: false, tab: 'characters' });
  const [isMapPopoverOpen, setIsMapPopoverOpen] = useState(false);
  const [isSceneMenuOpen, setIsSceneMenuOpen] = useState(false);
  const [isRenamingScene, setIsRenamingScene] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmClearTokens, setConfirmClearTokens] = useState(false);
  const [mapUploadError, setMapUploadError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const mapFileInputRef = useRef<HTMLInputElement | null>(null);
  const mapPopoverRef = useRef<HTMLDivElement | null>(null);
  const sceneMenuRef = useRef<HTMLDivElement | null>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isMapPopoverOpen && mapPopoverRef.current && !mapPopoverRef.current.contains(target)) {
        setIsMapPopoverOpen(false);
      }
      if (isSceneMenuOpen && sceneMenuRef.current && !sceneMenuRef.current.contains(target)) {
        setIsSceneMenuOpen(false);
        setIsRenamingScene(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isMapPopoverOpen, isSceneMenuOpen]);

  // Silence procedural weather audio smoothly when leaving the VTT screen
  useEffect(() => {
    return () => {
      stopWeatherAudio();
    };
  }, []);

  // Tactical keyboard shortcuts (V, R, H, 0, Arrow keys, Ctrl+Z, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      if (isNewTokenOpen || isBestiaryOpen || importModal.open) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isViewer) return;
        e.preventDefault();
        undo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'v') {
        e.preventDefault();
        setActiveTool('select');
      } else if (key === 'r') {
        e.preventDefault();
        setActiveTool('ruler');
      } else if (key === 'h') {
        e.preventDefault();
        setActiveTool('pan');
      } else if (key === '0') {
        e.preventDefault();
        requestCameraFocus(0, 0);
      } else if (!isViewer && selectedTokenId && e.key === 'ArrowUp') {
        e.preventDefault();
        stepSelectedToken(0, -1);
      } else if (!isViewer && selectedTokenId && e.key === 'ArrowDown') {
        e.preventDefault();
        stepSelectedToken(0, 1);
      } else if (!isViewer && selectedTokenId && e.key === 'ArrowLeft') {
        e.preventDefault();
        stepSelectedToken(-1, 0);
      } else if (!isViewer && selectedTokenId && e.key === 'ArrowRight') {
        e.preventDefault();
        stepSelectedToken(1, 0);
      } else if (!isViewer && (e.key === 'Delete' || e.key === 'Backspace') && selectedTokenId) {
        e.preventDefault();
        deleteToken(selectedTokenId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isNewTokenOpen,
    isBestiaryOpen,
    importModal.open,
    isViewer,
    selectedTokenId,
    setActiveTool,
    requestCameraFocus,
    deleteToken,
    stepSelectedToken,
    undo,
  ]);

  if (!activeScene) return null;

  const canUndo = undoStack.some((snap) => snap.sceneId === activeScene.id);

  const handleBattlemapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMapUploadError(null);
    try {
      const result = await readBattlemapFile(file);
      setBackground({
        dataUrl: result.dataUrl,
        name: result.name,
        width: result.width,
        height: result.height,
        x: 0,
        y: 0,
        scale: 1,
        opacity: 0.92,
      });
    } catch {
      setMapUploadError('Não foi possível carregar este arquivo de imagem.');
    }
  };

  const handleZoomStep = (delta: number) => {
    const nextZoom = Math.max(0.35, Math.min(2.5, Number((activeScene.camera.zoom + delta).toFixed(2))));
    setCamera({ ...activeScene.camera, zoom: nextZoom });
  };

  const handleCommitRename = () => {
    if (renameDraft.trim()) {
      renameScene(activeScene.id, renameDraft.trim());
    }
    setIsRenamingScene(false);
  };

  const gridTypes: { id: VttGridType; label: string; icon: React.ReactNode }[] = [
    { id: 'square', label: 'Quad', icon: <Grid className="w-3.5 h-3.5" /> },
    { id: 'hex', label: 'Hex', icon: <Hexagon className="w-3.5 h-3.5" /> },
    { id: 'none', label: 'Off', icon: <X className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden bg-[#070a14] pb-15 md:pb-0">
      {/* Top Scene & Grid Toolbar */}
      <header
        data-dice3d-ignore="true"
        className="shrink-0 z-20 px-3 py-2 border-b border-white/10 bg-[#0b0f1c]/95 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2"
      >
        {/* Left: Scene Selector & Quick Actions */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative" ref={sceneMenuRef}>
            <button
              type="button"
              onClick={() => setIsSceneMenuOpen((v) => !v)}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-2 max-w-[200px] sm:max-w-[240px] transition cursor-pointer"
              title="Gerenciar cenas do tabuleiro"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
              <span className="truncate">{activeScene.name}</span>
              <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                (
                {canUseGmModules
                  ? activeScene.tokens.length
                  : activeScene.tokens.filter((t) => !t.hidden).length}
                )
              </span>
            </button>

            {isSceneMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-white/15 bg-[#0e1222] shadow-2xl p-2.5 z-40 space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Cenas Salvas ({scenes.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      createScene();
                      setIsSceneMenuOpen(false);
                    }}
                    className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/30 text-[11px] font-bold text-cyan-200 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Nova Cena</span>
                  </button>
                </div>

                {/* Rename active scene inline */}
                {isRenamingScene ? (
                  <div className="flex items-center gap-1.5 px-1">
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCommitRename();
                        if (e.key === 'Escape') setIsRenamingScene(false);
                      }}
                      autoFocus
                      className="flex-1 px-2 py-1 rounded-lg bg-black/50 border border-cyan-400/50 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCommitRename}
                      className="p-1.5 rounded-lg bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/40 cursor-pointer"
                      aria-label="Salvar nome"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-1">
                    <button
                      type="button"
                      onClick={() => {
                        setRenameDraft(activeScene.name);
                        setIsRenamingScene(true);
                      }}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Renomear</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        duplicateScene(activeScene.id);
                        setIsSceneMenuOpen(false);
                      }}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Duplicar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        deleteScene(activeScene.id);
                        setIsSceneMenuOpen(false);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-[11px] font-bold text-rose-200 flex items-center justify-center cursor-pointer"
                      title="Excluir cena atual"
                      aria-label="Excluir cena atual"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="max-h-56 overflow-y-auto space-y-1 border-t border-white/10 pt-2">
                  {scenes.map((sc) => {
                    const isCur = sc.id === activeScene.id;
                    return (
                      <button
                        key={sc.id}
                        type="button"
                        onClick={() => {
                          selectScene(sc.id);
                          setIsSceneMenuOpen(false);
                        }}
                        className={`w-full px-2.5 py-2 rounded-xl text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                          isCur
                            ? 'bg-cyan-500/20 border border-cyan-400/40 text-white font-bold'
                            : 'bg-black/25 hover:bg-white/5 border border-transparent text-slate-300'
                        }`}
                      >
                        <span className="text-xs truncate">{sc.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 tabular-nums shrink-0">
                          {sc.tokens.length} tok
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Grid Segmented Control */}
          <div className="flex items-center p-0.5 rounded-xl bg-black/40 border border-white/10">
            {gridTypes.map((gt) => {
              const active = activeScene.grid.type === gt.id;
              return (
                <button
                  key={gt.id}
                  type="button"
                  onClick={() => updateGrid({ type: gt.id })}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-cyan-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {gt.icon}
                  <span className="hidden sm:inline">{gt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Snap Toggle */}
          <button
            type="button"
            onClick={() => updateGrid({ snapToGrid: !activeScene.grid.snapToGrid })}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              activeScene.grid.snapToGrid
                ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Imã de grade (Snap)"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Snap</span>
          </button>

          {/* Map & Grid Settings Popover */}
          <div className="relative" ref={mapPopoverRef}>
            <button
              type="button"
              onClick={() => setIsMapPopoverOpen((v) => !v)}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                isMapPopoverOpen || activeScene.background
                  ? 'bg-purple-500/15 border-purple-400/40 text-purple-200'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
              }`}
              title="Configurar Battlemap, superfície e grade"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Mapa & Grade</span>
            </button>

            {isMapPopoverOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 max-w-[90vw] rounded-2xl border border-white/15 bg-[#0e1222] shadow-2xl p-4 z-40 space-y-4">
                {/* Battlemap Image Upload */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                      Imagem de Battlemap
                    </span>
                    {activeScene.background && (
                      <button
                        type="button"
                        onClick={() => setBackground(null)}
                        className="text-[11px] font-bold text-rose-300 hover:text-rose-200 cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>

                  <input
                    ref={mapFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBattlemapUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => mapFileInputRef.current?.click()}
                    className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-xs font-bold text-slate-200 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <ImageIcon className="w-4 h-4 text-purple-300" />
                    <span className="truncate">
                      {activeScene.background
                        ? activeScene.background.name
                        : 'Carregar mapa local (PNG/JPG/WebP)'}
                    </span>
                  </button>

                  {mapUploadError && <p className="text-[11px] text-rose-400">{mapUploadError}</p>}

                  {activeScene.background && (
                    <div className="space-y-2 pt-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Escala</span>
                            <span className="font-mono tabular-nums">
                              {Math.round(activeScene.background.scale * 100)}%
                            </span>
                          </label>
                          <input
                            type="range"
                            min={0.25}
                            max={3}
                            step={0.05}
                            value={activeScene.background.scale}
                            onChange={(e) =>
                              updateBackground({ scale: Number(e.target.value) })
                            }
                            className="w-full accent-cyan-400"
                          />
                        </div>
                        <div>
                          <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Opacidade</span>
                            <span className="font-mono tabular-nums">
                              {Math.round(activeScene.background.opacity * 100)}%
                            </span>
                          </label>
                          <input
                            type="range"
                            min={0.15}
                            max={1}
                            step={0.05}
                            value={activeScene.background.opacity}
                            onChange={(e) =>
                              updateBackground({ opacity: Number(e.target.value) })
                            }
                            className="w-full accent-cyan-400"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Alinhar X</span>
                            <span className="font-mono tabular-nums">{activeScene.background.x}px</span>
                          </label>
                          <input
                            type="range"
                            min={-256}
                            max={256}
                            step={2}
                            value={activeScene.background.x}
                            onChange={(e) => updateBackground({ x: Number(e.target.value) })}
                            className="w-full accent-purple-400"
                          />
                        </div>
                        <div>
                          <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                            <span>Alinhar Y</span>
                            <span className="font-mono tabular-nums">{activeScene.background.y}px</span>
                          </label>
                          <input
                            type="range"
                            min={-256}
                            max={256}
                            step={2}
                            value={activeScene.background.y}
                            onChange={(e) => updateBackground({ y: Number(e.target.value) })}
                            className="w-full accent-purple-400"
                          />
                        </div>
                      </div>

                      {(activeScene.background.x !== 0 ||
                        activeScene.background.y !== 0 ||
                        activeScene.background.scale !== 1) && (
                        <button
                          type="button"
                          onClick={() => updateBackground({ x: 0, y: 0, scale: 1 })}
                          className="w-full py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-slate-300 transition cursor-pointer"
                        >
                          Centralizar e Resetar Escala
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Built-in Tactical Surfaces */}
                <div className="space-y-2 border-t border-white/10 pt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 block">
                    Superfície Tática
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(Object.keys(VTT_SURFACE_PRESETS) as VttSurfacePreset[]).map((key) => {
                      const preset = VTT_SURFACE_PRESETS[key];
                      const active = activeScene.surfacePreset === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSurfacePreset(key)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-2 transition cursor-pointer ${
                            active
                              ? 'border-cyan-400/60 bg-cyan-500/15 text-white'
                              : 'border-white/10 bg-black/30 text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/25 shrink-0"
                            style={{ backgroundColor: preset.bg }}
                          />
                          <span className="truncate">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Fine-tuning */}
                <div className="space-y-2.5 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                      Ajustes da Grade
                    </span>
                    <div className="flex items-center gap-1">
                      {[
                        { color: '#94a3b8', label: 'Claro' },
                        { color: '#22d3ee', label: 'Ciano' },
                        { color: '#f59e0b', label: 'Âmbar' },
                        { color: '#0f172a', label: 'Escuro' },
                      ].map((swatch) => (
                        <button
                          key={swatch.color}
                          type="button"
                          onClick={() => updateGrid({ color: swatch.color })}
                          title={`Cor da grade: ${swatch.label}`}
                          className={`w-4 h-4 rounded-full border transition cursor-pointer ${
                            activeScene.grid.color === swatch.color
                              ? 'border-white scale-115'
                              : 'border-white/25 opacity-75 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: swatch.color }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Tamanho da Célula</span>
                      <span className="font-mono tabular-nums">{activeScene.grid.cellSize} px</span>
                    </label>
                    <input
                      type="range"
                      min={40}
                      max={112}
                      step={4}
                      value={activeScene.grid.cellSize}
                      onChange={(e) => updateGrid({ cellSize: Number(e.target.value) })}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Opacidade das Linhas</span>
                      <span className="font-mono tabular-nums">
                        {Math.round(activeScene.grid.opacity * 100)}%
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0.06}
                      max={0.7}
                      step={0.02}
                      value={activeScene.grid.opacity}
                      onChange={(e) => updateGrid({ opacity: Number(e.target.value) })}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">Unidade da Régua</span>
                    <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
                      {(
                        [
                          { id: 'm', label: 'Metros' },
                          { id: 'ft', label: 'Pés' },
                          { id: 'both', label: 'Ambos' },
                        ] as const
                      ).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => updateGrid({ unitDisplay: u.id })}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            activeScene.grid.unitDisplay === u.id
                              ? 'bg-cyan-400 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {u.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeScene.tokens.length > 0 && activeScene.grid.type !== 'none' && (
                    <button
                      type="button"
                      onClick={() => snapAllTokensToGrid()}
                      className="w-full py-1.5 px-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-[11px] font-bold text-cyan-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Magnet className="w-3.5 h-3.5" />
                      <span>Re-alinhar Tokens ao Grid</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* GM Weather, Particles & Ambient Audio Controls */}
          <VttWeatherPopover scene={activeScene} />
        </div>

        {/* Right: Importers, +Token, Combat Drawer Toggle */}
        <div className="flex items-center gap-1.5">
          {canUseGmModules && (
            <>
              <button
                type="button"
                onClick={() => setImportModal({ open: true, tab: 'characters' })}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                title="Importar Fichas de Personagem do Mapa de Notas"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Fichas</span>
              </button>

              <button
                type="button"
                onClick={() => setImportModal({ open: true, tab: 'encounter' })}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/35 text-amber-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                title="Importar ou gerar Encontro da Forja de Mundos"
              >
                <Compass className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Encontro</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBestiaryOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/35 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                title="Adicionar monstros do Bestiário D&D 5.5 (com opção de ocultar dos jogadores)"
              >
                <Skull className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Bestiário 5.5</span>
              </button>
            </>
          )}

          {!isViewer && (
            <button
              type="button"
              onClick={() => setIsNewTokenOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black flex items-center gap-1 transition cursor-pointer whitespace-nowrap shadow-md shadow-cyan-500/20"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Token</span>
            </button>
          )}

          {/* Desktop Right Sidebar Toggle */}
          <button
            type="button"
            onClick={() => setRightPanelOpen(!isRightPanelOpen)}
            className="hidden lg:flex p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition cursor-pointer"
            title={isRightPanelOpen ? 'Recolher painel tático' : 'Abrir painel tático'}
            aria-label={isRightPanelOpen ? 'Recolher painel tático' : 'Abrir painel tático'}
          >
            {isRightPanelOpen ? (
              <PanelRightClose className="w-4 h-4" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-cyan-300" />
            )}
          </button>

          {/* Mobile Combat Sidebar Trigger */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="lg:hidden px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            <Swords className="w-3.5 h-3.5 text-amber-300" />
            <span>Combate</span>
          </button>
        </div>
      </header>

      {/* Main Tactical Workspace Row */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        {/* Left Compact Tool Dock */}
        <aside
          data-dice3d-ignore="true"
          aria-label="Ferramentas do Tabuleiro"
          className="shrink-0 z-10 w-12 sm:w-13 border-r border-white/10 bg-[#0b0f1c]/95 flex flex-col items-center py-2.5 gap-1.5 select-none"
        >
          <button
            type="button"
            onClick={() => setActiveTool('select')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              activeTool === 'select'
                ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title="Mover e Selecionar (V)"
            aria-label="Ferramenta Mover"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('ruler')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              activeTool === 'ruler'
                ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title="Régua Tática (R ou Shift + Arrastar)"
            aria-label="Ferramenta Régua"
          >
            <Ruler className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTool('pan')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
              activeTool === 'pan'
                ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/25'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title="Mover Câmera / Pan (H)"
            aria-label="Ferramenta Câmera"
          >
            <Hand className="w-4 h-4" />
          </button>

          <div className="w-6 h-px bg-white/10 my-1" />

          <button
            type="button"
            onClick={() => handleZoomStep(0.15)}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            title="Aproximar Zoom"
            aria-label="Aproximar Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <span className="text-[10px] font-mono text-slate-400 tabular-nums">
            {Math.round(activeScene.camera.zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={() => handleZoomStep(-0.15)}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            title="Afastar Zoom"
            aria-label="Afastar Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setCamera({ x: 0, y: 0, zoom: 1 });
              requestCameraFocus(0, 0);
            }}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
            title="Centralizar Câmera (0)"
            aria-label="Centralizar Câmera"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          <button
            type="button"
            disabled={!canUndo}
            onClick={undo}
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition cursor-pointer"
            title="Desfazer última ação (Ctrl+Z)"
            aria-label="Desfazer última ação"
          >
            <Undo2 className="w-4 h-4" />
          </button>

          {activeScene.tokens.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirmClearTokens) {
                  clearAllTokens();
                  setConfirmClearTokens(false);
                } else {
                  setConfirmClearTokens(true);
                  window.setTimeout(() => setConfirmClearTokens(false), 3500);
                }
              }}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer ${
                confirmClearTokens
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-500 hover:text-rose-300 hover:bg-rose-500/15'
              }`}
              title={
                confirmClearTokens
                  ? 'Clique novamente para limpar todos os tokens'
                  : 'Limpar todos os tokens da cena'
              }
              aria-label="Limpar todos os tokens"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </aside>

        {/* Center 2D Tactical Arena */}
        <VttCanvas
          scene={activeScene}
          canImportFromGmModules={canUseGmModules}
          onOpenNewToken={() => setIsNewTokenOpen(true)}
          onOpenImportCharacters={() => {
            if (canUseGmModules) setImportModal({ open: true, tab: 'characters' });
          }}
          onOpenImportEncounter={() => {
            if (canUseGmModules) setImportModal({ open: true, tab: 'encounter' });
          }}
        />

        {/* Right Combat & Token Inspector Sidebar (Desktop) */}
        {isRightPanelOpen && (
          <div className="hidden lg:flex h-full shrink-0">
            <VttCombatSidebar scene={activeScene} />
          </div>
        )}

        {/* Mobile Slide-Over Combat Drawer */}
        {isMobileSidebarOpen && (
          <div
            data-dice3d-ignore="true"
            className="fixed inset-0 z-50 lg:hidden flex justify-end"
          >
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
            <div className="relative z-10 h-full max-w-[90vw] shadow-2xl">
              <VttCombatSidebar
                scene={activeScene}
                onCloseMobile={() => setIsMobileSidebarOpen(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <VttTokenModal isOpen={isNewTokenOpen} onClose={() => setIsNewTokenOpen(false)} />
      {canUseGmModules && (
        <>
          <VttBestiaryModal
            isOpen={isBestiaryOpen}
            onClose={() => setIsBestiaryOpen(false)}
          />
          <VttImportModal
            isOpen={importModal.open}
            initialTab={importModal.tab}
            onClose={() => setImportModal((prev) => ({ ...prev, open: false }))}
          />
        </>
      )}
    </div>
  );
};
