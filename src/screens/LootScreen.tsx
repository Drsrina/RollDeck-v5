import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Download,
  Dices,
  Edit2,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Minus,
  Network,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings,
  Share2,
  Sliders,
  Sparkles,
  Table as TableIcon,
  Trash2,
  Unlock,
  Upload,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { LootItemCard } from '../components/loot/LootItemCard';
import { LootTableView } from '../components/loot/LootTableView';
import { DEFAULT_LOOT_GENERATOR_TEMPLATES, STANDARD_DEFAULT_COLUMNS, THEME_PRESETS } from '../lib/lootTemplates';
import { triggerHaptic } from '../lib/haptics';
import { useAppStore } from '../store/useAppStore';
import { useLootStore } from '../store/useLootStore';
import { useMapStore } from '../store/useMapStore';
import type {
  AISettings,
  CurrencyConfig,
  LootColumn,
  LootColumnType,
  LootGenerator,
  LootItem,
} from '../types';

export const LootScreen: React.FC = () => {
  const { setActiveTab } = useAppStore();
  const {
    generators,
    activeGeneratorId,
    setActiveGeneratorId,
    currentGroup,
    lootGroupsHistory,
    aiSettings,
    isGenerating,
    generationError,
    generationProgress,
    viewMode,
    setViewMode,
    selectedItemIds,
    toggleSelectItem,
    selectAllItems,
    saveGenerator,
    duplicateGenerator,
    deleteGenerator,
    generateLoot,
    cancelGeneration,
    toggleLockItem,
    updateItemCell,
    deleteItemFromCurrentGroup,
    rerollSingleItem,
    saveGroupAsNotes,
    saveGroupAsCanvasTable,
    updateAISettings,
    loadGroupFromHistory,
    deleteGroupHistoryItem,
  } = useLootStore();

  const { layers } = useMapStore();

  // Active generator
  const activeGenerator = useMemo(() => {
    return (
      generators.find((g) => g.id === activeGeneratorId) ||
      generators[0] ||
      DEFAULT_LOOT_GENERATOR_TEMPLATES[0]
    );
  }, [generators, activeGeneratorId]);

  // Modals & Panels state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaveToMapOpen, setIsSaveToMapOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Quick count override selector
  const [quickCount, setQuickCount] = useState<number>(activeGenerator?.params.count || 6);

  // Generator editor form state
  const [editorData, setEditorData] = useState<LootGenerator>(activeGenerator);
  const [editingColumn, setEditingColumn] = useState<LootColumn | null>(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  // Open editor with fresh data
  const handleOpenEditor = (gen?: LootGenerator) => {
    const target = gen || activeGenerator;
    setEditorData(JSON.parse(JSON.stringify(target)));
    setIsEditorOpen(true);
  };

  // Trigger quick copy toast
  const triggerCopyFeedback = (msg: string) => {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  // Execute Generation
  const handleGenerate = async () => {
    triggerHaptic('roll', true);
    await generateLoot(activeGenerator.id, quickCount);
  };

  // Re-roll only unlocked items
  const handleRerollUnlocked = async () => {
    if (!currentGroup) return;
    triggerHaptic('roll', true);
    for (const item of currentGroup.items) {
      if (!item.isLocked) {
        await rerollSingleItem(item.id);
      }
    }
  };

  // Save to Map handler
  const handleSaveToMap = async (mode: 'single_note' | 'items_notes' | 'canvas_table') => {
    if (!currentGroup) return;
    triggerHaptic('tap', true);

    if (mode === 'canvas_table') {
      await saveGroupAsCanvasTable(currentGroup.id);
      triggerCopyFeedback('Tabela interativa adicionada ao Mapa!');
    } else {
      await saveGroupAsNotes(currentGroup.id, mode);
      triggerCopyFeedback(
        mode === 'single_note'
          ? 'Nota com tabela salva no Mapa!'
          : 'Índice e notas individuais criadas no Mapa!'
      );
    }
    setIsSaveToMapOpen(false);
  };

  // Export handlers
  const handleExportJSON = () => {
    if (!currentGroup) return;
    const blob = new Blob([JSON.stringify(currentGroup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loot-${currentGroup.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    triggerCopyFeedback('Arquivo JSON baixado!');
  };

  const handleExportCSV = () => {
    if (!currentGroup) return;
    const cols = currentGroup.columnsSnapshot.filter((c) => c.enabled);
    const header = cols.map((c) => `"${c.label}"`).join(',');
    const rows = currentGroup.items.map((item) =>
      cols
        .map((c) => {
          const val = String(item.cells[c.key] ?? '').replace(/"/g, '""');
          return `"${val}"`;
        })
        .join(',')
    );
    const csvContent = [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `loot-${currentGroup.title.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    triggerCopyFeedback('Arquivo CSV baixado!');
  };

  const handleExportMarkdown = () => {
    if (!currentGroup) return;
    const cols = currentGroup.columnsSnapshot.filter((c) => c.enabled);
    const header = `| ${cols.map((c) => c.label).join(' | ')} |`;
    const divider = `| ${cols.map(() => '---').join(' | ')} |`;
    const rows = currentGroup.items.map((item) => {
      const cells = cols.map((c) => String(item.cells[c.key] ?? '-').replace(/\n/g, ' '));
      return `| ${cells.join(' | ')} |`;
    });
    const md = `### ${currentGroup.title}\n\n**Tema:** ${currentGroup.theme}\n**Total:** ${currentGroup.totals.totalValueText}\n\n${header}\n${divider}\n${rows.join('\n')}`;

    navigator.clipboard.writeText(md);
    triggerCopyFeedback('Markdown copiado para a área de transferência!');
  };

  const handleExportDiscord = () => {
    if (!currentGroup) return;
    let text = `📦 **${currentGroup.title.toUpperCase()}**\n`;
    text += `*Tema: ${currentGroup.theme}*\n`;
    text += `💰 **Valor Total:** ${currentGroup.totals.totalValueText}\n\n`;

    currentGroup.items.forEach((item, idx) => {
      const name = item.cells.name || `Item ${idx + 1}`;
      const rarity = item.cells.rarity ? `[${item.cells.rarity}]` : '';
      const val = item.cells.value ? `(${item.cells.value} PO)` : '';
      const desc = item.cells.description ? `\n   > ${item.cells.description}` : '';
      text += `• **${name}** ${rarity} ${val}${desc}\n`;
    });

    navigator.clipboard.writeText(text);
    triggerCopyFeedback('Texto copiado para Discord / WhatsApp!');
  };

  // Generator Editor Helpers
  const handleSaveEditor = async () => {
    await saveGenerator(editorData);
    setIsEditorOpen(false);
    triggerCopyFeedback('Gerador salvo com sucesso!');
  };

  const handleCreateNewGenerator = () => {
    const newGen: LootGenerator = {
      id: `gen-${crypto.randomUUID()}`,
      name: 'Novo Gerador',
      icon: '✨',
      color: '#06b6d4',
      theme: 'Escreva aqui o tema do seu gerador...',
      params: {
        count: 6,
        rarity: 'misto',
        language: 'pt-BR',
        creativity: 'balanced',
        noRepeat: true,
      },
      columns: JSON.parse(JSON.stringify(STANDARD_DEFAULT_COLUMNS)),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    handleOpenEditor(newGen);
  };

  return (
    <div className="flex flex-col min-h-full pb-24 lg:pb-8 w-full text-slate-100">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Top Bar Header with Generator Selection */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl">{activeGenerator.icon}</span>
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-tight text-white truncate flex items-center gap-1.5">
              <span>{activeGenerator.name}</span>
            </h1>
            <p className="text-[11px] text-cyan-300 truncate max-w-[200px]">
              {activeGenerator.theme.slice(0, 45)}...
            </p>
          </div>
        </div>

        {/* Generator Quick Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsHistoryOpen(true)}
            aria-label="Histórico de Loot"
            className="p-2 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 transition active:scale-95 relative"
            title="Histórico de Gerações"
          >
            <History className="w-4 h-4" />
            {lootGroupsHistory.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400" />
            )}
          </button>

          <button
            onClick={() => handleOpenEditor()}
            aria-label="Editar Gerador"
            className="p-2 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 transition active:scale-95"
            title="Configurar Gerador e Colunas"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Ajustes de IA"
            className="p-2 rounded-xl glass-panel text-slate-300 hover:text-purple-300 transition active:scale-95"
            title="Ajustes do Modelo de IA"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel of Generators & Templates */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-3">
        {generators.map((gen) => {
          const isActive = gen.id === activeGenerator.id;
          return (
            <button
              key={gen.id}
              onClick={() => {
                triggerHaptic('tap', true);
                setActiveGeneratorId(gen.id);
                setQuickCount(gen.params.count || 6);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-all duration-200 shrink-0 ${
                isActive
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)] scale-102'
                  : 'glass-panel border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              <span>{gen.icon}</span>
              <span>{gen.name}</span>
            </button>
          );
        })}

        {/* Add New Generator Button */}
        <button
          onClick={handleCreateNewGenerator}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-cyan-400/50 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/10 transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Novo</span>
        </button>
      </div>

      {/* Generation Bar & Thumb Trigger Box */}
      {(() => {
        const isOfflineMode = aiSettings.provider === 'offline-procedural';
        return (
          <div className="rounded-2xl glass-panel-elevated p-3 border border-cyan-500/30 mb-3 space-y-2.5 shadow-lg">
            {/* Mode Switcher: 100% Offline Procedural vs IA */}
            <div className="flex items-center justify-between p-1.5 rounded-xl bg-black/40 border border-white/10 text-xs">
              <div className="flex items-center gap-1.5 pl-1">
                {isOfflineMode ? (
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                    <Zap className="w-3.5 h-3.5 fill-emerald-400" />
                    Modo 100% Offline (Instantâneo)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-purple-300 font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                    Modo IA Custom (Sua Chave)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-white/10">
                <button
                  type="button"
                  onClick={() => updateAISettings({ provider: 'offline-procedural' })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                    isOfflineMode
                      ? 'bg-emerald-500 text-black shadow-sm font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Geração procedural instantânea offline sem IA ou internet"
                >
                  <Zap className="w-3 h-3 fill-current" />
                  Offline
                </button>
                <button
                  type="button"
                  onClick={() => updateAISettings({ provider: 'openai-compatible' })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 ${
                    !isOfflineMode
                      ? 'bg-purple-600 text-white shadow-sm font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Geração com modelo customizado (BYO Key - OpenAI, Ollama, Claude)"
                >
                  <Sparkles className="w-3 h-3" />
                  IA Custom
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              {/* Quick Item Count Pills */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Qtd:
                </span>
                {[1, 3, 5, 8, 12].map((num) => (
                  <button
                    key={num}
                    onClick={() => setQuickCount(num)}
                    className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition ${
                      quickCount === num
                        ? isOfflineMode
                          ? 'bg-emerald-500 text-black shadow-sm'
                          : 'bg-cyan-500 text-black shadow-sm'
                        : 'bg-black/40 text-slate-400 hover:text-white'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              {/* Rarity Label Badge */}
              <div className="text-[11px] text-slate-300 font-medium">
                Raridade: <span className="text-cyan-300 capitalize">{activeGenerator.params.rarity}</span>
              </div>
            </div>

            {/* Big Neon Thumb Button: GERAR LOOT */}
            {!isGenerating ? (
              <div className="space-y-1.5">
                {isOfflineMode ? (
                  <button
                    onClick={handleGenerate}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.45)] hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-5 h-5 fill-current animate-pulse" />
                    <span>Gerar {quickCount} {quickCount === 1 ? 'Item' : 'Itens'} (100% Offline)</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleGenerate}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 text-white font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(34,211,238,0.45)] hover:brightness-110 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-5 h-5 animate-pulse" />
                      <span>Gerar {quickCount} {quickCount === 1 ? 'Item' : 'Itens'} de Loot (IA)</span>
                    </button>
                    <button
                      onClick={() => {
                        updateAISettings({ provider: 'offline-procedural' });
                        setTimeout(() => handleGenerate(), 10);
                      }}
                      className="w-full py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-xs hover:bg-emerald-500/20 active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>Gerar Instantaneamente em Modo Offline</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-cyan-300 font-bold">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
                    <span>
                      {isOfflineMode ? 'Gerando itens offline' : 'Criando loot com IA'}
                      {generationProgress
                        ? ` (${generationProgress.current}/${generationProgress.total})...`
                        : '...'}
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!isOfflineMode && (
                      <button
                        onClick={() => {
                          cancelGeneration();
                          updateAISettings({ provider: 'offline-procedural' });
                          setTimeout(() => {
                            generateLoot(activeGenerator.id, quickCount);
                          }, 50);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 text-[11px] font-bold flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 fill-current" />
                        Usar Offline
                      </button>
                    )}
                    <button
                      onClick={cancelGeneration}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-[11px]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/10">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isOfflineMode
                        ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'
                        : 'bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400'
                    }`}
                    style={{
                      width: generationProgress
                        ? `${Math.max(10, (generationProgress.current / generationProgress.total) * 100)}%`
                        : '40%',
                    }}
                  />
                </div>
              </div>
            )}

            {generationError && (
              <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 flex items-center justify-between">
                <span>{generationError}</span>
                <button
                  onClick={() => useLootStore.setState({ generationError: null })}
                  className="text-rose-400 p-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Generated Loot Batch Display */}
      {currentGroup && currentGroup.items.length > 0 && (
        <div className="space-y-2.5">
          {/* Batch Header & Stats Summary */}
          <div className="rounded-2xl glass-panel p-3 border border-white/10 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-black text-white truncate">{currentGroup.title}</h2>
                <p className="text-[11px] text-slate-400 truncate">{currentGroup.theme}</p>
              </div>

              {/* View Switcher: Cards vs Table */}
              <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10 shrink-0">
                <button
                  onClick={() => setViewMode('cards')}
                  aria-label="Modo Cartões"
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'cards' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Visualizar em Cartões"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  aria-label="Modo Tabela"
                  className={`p-1.5 rounded-lg transition ${
                    viewMode === 'table' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Visualizar em Tabela"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Totals Summary Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-400">
                  Itens: <strong className="text-white">{currentGroup.items.length}</strong>
                </span>
                {currentGroup.totals.totalWeightText && (
                  <span className="font-bold text-slate-400">
                    • Peso: <strong className="text-white">{currentGroup.totals.totalWeightText}</strong>
                  </span>
                )}
              </div>
              <div className="font-bold">
                Valor Total:{' '}
                <strong className="text-cyan-300 font-mono text-sm">
                  {currentGroup.totals.totalValueText}
                </strong>
              </div>
            </div>

            {/* Action Bar for Current Group */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleRerollUnlocked}
                  className="px-2.5 py-1.5 rounded-xl glass-panel text-slate-300 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                  title="Rerrolar apenas os itens sem trava"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rerrolar Livres</span>
                </button>

                <button
                  onClick={() => setIsSaveToMapOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-500/30 text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                  title="Salvar lote no Canvas de Notas"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Salvar no Mapa</span>
                </button>
              </div>

              <button
                onClick={() => setIsExportOpen(true)}
                className="px-2.5 py-1.5 rounded-xl glass-panel text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition active:scale-95"
                title="Exportar como..."
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Exportar</span>
              </button>
            </div>
          </div>

          {/* Selection Toolbar (if any items selected) */}
          {selectedItemIds.length > 0 && (
            <div className="rounded-xl bg-cyan-950/80 border border-cyan-400/40 p-2 flex items-center justify-between text-xs animate-fadeIn">
              <span className="font-bold text-cyan-200">
                {selectedItemIds.length} {selectedItemIds.length === 1 ? 'item selecionado' : 'itens selecionados'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    selectedItemIds.forEach((id) => toggleLockItem(id));
                  }}
                  className="px-2 py-1 rounded-lg bg-black/50 text-amber-300 text-[11px] font-bold hover:bg-black/70"
                >
                  Alternar Trava
                </button>
                <button
                  onClick={() => {
                    selectedItemIds.forEach((id) => deleteItemFromCurrentGroup(id));
                  }}
                  className="px-2 py-1 rounded-lg bg-rose-500/30 text-rose-300 text-[11px] font-bold hover:bg-rose-500/50"
                >
                  Excluir Selecionados
                </button>
              </div>
            </div>
          )}

          {/* Items Display: Cards vs Table */}
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {currentGroup.items.map((item) => (
                <LootItemCard
                  key={item.id}
                  item={item}
                  columns={currentGroup.columnsSnapshot}
                  isSelected={selectedItemIds.includes(item.id)}
                  onToggleSelect={() => toggleSelectItem(item.id)}
                  onToggleLock={() => toggleLockItem(item.id)}
                  onReroll={() => rerollSingleItem(item.id)}
                  onDelete={() => deleteItemFromCurrentGroup(item.id)}
                  onUpdateCell={(key, val) => updateItemCell(item.id, key, val)}
                />
              ))}
            </div>
          ) : (
            <LootTableView
              group={currentGroup}
              selectedItemIds={selectedItemIds}
              onToggleSelect={(id) => toggleSelectItem(id)}
              onToggleLock={(id) => toggleLockItem(id)}
              onRerollItem={(id) => rerollSingleItem(id)}
              onDeleteItem={(id) => deleteItemFromCurrentGroup(id)}
              onUpdateCell={(id, key, val) => updateItemCell(id, key, val)}
            />
          )}
        </div>
      )}

      {/* Empty State if No Loot Yet */}
      {(!currentGroup || currentGroup.items.length === 0) && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 glass-panel rounded-3xl border border-white/5 p-6">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(34,211,238,0.2)]">
            ✨
          </div>
          <h3 className="text-base font-bold text-white">Nenhum lote gerado ainda</h3>
          <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Escolha um gerador acima e toque no botão <strong>GERAR LOOT</strong> para criar tesouros,
            armas e itens únicos com IA!
          </p>
        </div>
      )}

      {/* ================= MODAL: SALVAR NO MAPA ================= */}
      {isSaveToMapOpen && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl glass-panel-elevated p-5 border border-purple-400/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <MapIcon className="w-4 h-4 text-purple-400" />
                <span>Salvar Loot no Canvas do Mapa</span>
              </h3>
              <button
                onClick={() => setIsSaveToMapOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Como você deseja integrar este lote de <strong>{currentGroup.items.length} itens</strong> no seu mapa?
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleSaveToMap('single_note')}
                className="w-full p-3 rounded-2xl glass-panel border border-white/10 hover:border-cyan-400 text-left transition flex items-start gap-3 group"
              >
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition">
                    Opção A: Nota Única com Tabela
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cria 1 nota contendo uma tabela Markdown completa com todos os itens e totais somados.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSaveToMap('items_notes')}
                className="w-full p-3 rounded-2xl glass-panel border border-white/10 hover:border-purple-400 text-left transition flex items-start gap-3 group"
              >
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 shrink-0">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition">
                    Opção B: Hub e Notas Interligadas
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cria uma nota-índice mais 1 nota individual para cada item, interligadas por <code>[[Wikilinks]]</code>.
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSaveToMap('canvas_table')}
                className="w-full p-3 rounded-2xl glass-panel border border-white/10 hover:border-pink-400 text-left transition flex items-start gap-3 group"
              >
                <div className="p-2 rounded-xl bg-pink-500/20 text-pink-300 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white group-hover:text-pink-300 transition">
                    Opção C: Tabela Interativa no Canvas
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Adiciona um objeto de tabela interativo diretamente sobre o quadro visual.
                  </p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setIsSaveToMapOpen(false);
                  setActiveTab('map');
                }}
                className="text-xs text-cyan-300 hover:underline flex items-center gap-1"
              >
                <span>Ir para o Mapa agora</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EXPORTAR ================= */}
      {isExportOpen && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl glass-panel-elevated p-5 border border-cyan-400/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-cyan-400" />
                <span>Exportar Loot</span>
              </h3>
              <button
                onClick={() => setIsExportOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportDiscord}
                className="p-3 rounded-2xl glass-panel border border-white/10 hover:border-cyan-400 flex flex-col items-center gap-2 text-center transition"
              >
                <Copy className="w-5 h-5 text-indigo-400" />
                <span className="text-xs font-bold text-white">Discord / Zap</span>
                <span className="text-[10px] text-slate-400">Texto formatado</span>
              </button>

              <button
                onClick={handleExportMarkdown}
                className="p-3 rounded-2xl glass-panel border border-white/10 hover:border-cyan-400 flex flex-col items-center gap-2 text-center transition"
              >
                <FileText className="w-5 h-5 text-cyan-400" />
                <span className="text-xs font-bold text-white">Markdown</span>
                <span className="text-[10px] text-slate-400">Tabela de texto</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="p-3 rounded-2xl glass-panel border border-white/10 hover:border-cyan-400 flex flex-col items-center gap-2 text-center transition"
              >
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold text-white">Planilha (CSV)</span>
                <span className="text-[10px] text-slate-400">Excel / Sheets</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="p-3 rounded-2xl glass-panel border border-white/10 hover:border-cyan-400 flex flex-col items-center gap-2 text-center transition"
              >
                <Download className="w-5 h-5 text-amber-400" />
                <span className="text-xs font-bold text-white">Arquivo JSON</span>
                <span className="text-[10px] text-slate-400">Dados brutos</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: HISTÓRICO DE GERAÇÕES ================= */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md md:max-w-2xl max-h-[80vh] rounded-3xl glass-panel-elevated p-5 border border-white/20 shadow-2xl flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <History className="w-4 h-4 text-cyan-400" />
                <span>Histórico de Lotes Anteriores</span>
              </h3>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-1">
              {lootGroupsHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  Nenhum histórico gravado ainda.
                </p>
              ) : (
                lootGroupsHistory.map((group) => (
                  <div
                    key={group.id}
                    className="p-3 rounded-2xl glass-panel border border-white/10 hover:border-cyan-400 flex items-center justify-between gap-2 transition"
                  >
                    <div
                      onClick={() => {
                        loadGroupFromHistory(group.id);
                        setIsHistoryOpen(false);
                      }}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <h4 className="text-xs font-bold text-white truncate">{group.title}</h4>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{group.theme}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-cyan-300">
                        <span>{group.items.length} itens</span>
                        <span>•</span>
                        <span className="font-mono">{group.totals.totalValueText}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          loadGroupFromHistory(group.id);
                          setIsHistoryOpen(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-cyan-500 text-black font-bold text-xs"
                      >
                        Carregar
                      </button>
                      <button
                        onClick={() => deleteGroupHistoryItem(group.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIGURAÇÃO DO GERADOR ================= */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-lg md:max-w-3xl lg:max-w-4xl max-h-[90vh] rounded-3xl glass-panel-elevated p-5 md:p-6 border border-cyan-400/40 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 shrink-0">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>{editorData.icon}</span>
                <span>Configurar Gerador</span>
              </h3>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pr-1 text-xs">
              {/* Name, Icon, Color */}
              <div className="grid grid-cols-4 gap-2">
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">
                    Nome do Gerador
                  </label>
                  <input
                    type="text"
                    value={editorData.name}
                    onChange={(e) => setEditorData({ ...editorData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Ícone</label>
                  <input
                    type="text"
                    value={editorData.icon}
                    onChange={(e) => setEditorData({ ...editorData, icon: e.target.value })}
                    className="w-full px-3 py-2 text-center rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400 text-base"
                  />
                </div>
              </div>

              {/* Theme presets pills */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase text-slate-400">
                  Presets Rápidos de Tema
                </label>
                <div className="flex flex-wrap gap-1">
                  {THEME_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setEditorData({ ...editorData, theme: p.prompt })}
                      className="px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] text-slate-300 hover:border-cyan-400 transition"
                    >
                      <span>{p.icon}</span> <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Text Area */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">
                  Tema & Contexto Livre (Extenso)
                </label>
                <textarea
                  rows={3}
                  value={editorData.theme}
                  onChange={(e) => setEditorData({ ...editorData, theme: e.target.value })}
                  placeholder="Ex: Piratas steampunk em aeronaves de latão flutuantes..."
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
                />
              </div>

              {/* Extra Instructions */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">
                  Instruções Extras (Tom, restrições, sem magia, etc.)
                </label>
                <input
                  type="text"
                  value={editorData.instructions || ''}
                  onChange={(e) => setEditorData({ ...editorData, instructions: e.target.value })}
                  placeholder="Ex: Tom sombrio e realista, foco em bugigangas de taverna..."
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Parameters: Count, Rarity, Creativity */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Quantidade</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editorData.params.count}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        params: { ...editorData.params, count: parseInt(e.target.value, 10) || 6 },
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Raridade</label>
                  <select
                    value={editorData.params.rarity}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        params: { ...editorData.params, rarity: e.target.value as any },
                      })
                    }
                    className="w-full px-2 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="misto">Misto</option>
                    <option value="comum">Comum</option>
                    <option value="incomum">Incomum</option>
                    <option value="raro">Raro</option>
                    <option value="épico">Épico</option>
                    <option value="lendário">Lendário</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-400">Criatividade</label>
                  <select
                    value={editorData.params.creativity}
                    onChange={(e) =>
                      setEditorData({
                        ...editorData,
                        params: { ...editorData.params, creativity: e.target.value as any },
                      })
                    }
                    className="w-full px-2 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="conservative">Conservador</option>
                    <option value="balanced">Equilibrado</option>
                    <option value="wild">Ousado</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Columns Manager */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase text-cyan-300">
                    Colunas do Gerador ({editorData.columns.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newCol: LootColumn = {
                        id: `col-${crypto.randomUUID()}`,
                        key: `campo_${editorData.columns.length + 1}`,
                        label: 'Novo Campo',
                        type: 'text_short',
                        instruction: 'Descrição de como a IA deve preencher este campo',
                        required: false,
                        enabled: true,
                      };
                      setEditorData({
                        ...editorData,
                        columns: [...editorData.columns, newCol],
                      });
                    }}
                    className="text-cyan-400 text-[11px] font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Campo</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {editorData.columns.map((col, idx) => (
                    <div
                      key={col.id}
                      className="p-2.5 rounded-xl glass-panel border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={col.enabled}
                          onChange={(e) => {
                            const updated = [...editorData.columns];
                            updated[idx].enabled = e.target.checked;
                            setEditorData({ ...editorData, columns: updated });
                          }}
                          className="rounded text-cyan-500 bg-black/40 border-white/20 w-4 h-4 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white truncate">{col.label}</span>
                            <span className="text-[10px] text-cyan-400 font-mono">({col.type})</span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{col.instruction}</p>
                        </div>
                      </div>

                      {/* Reorder up/down and delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editorData.columns];
                              const temp = updated[idx - 1];
                              updated[idx - 1] = updated[idx];
                              updated[idx] = temp;
                              setEditorData({ ...editorData, columns: updated });
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx < editorData.columns.length - 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...editorData.columns];
                              const temp = updated[idx + 1];
                              updated[idx + 1] = updated[idx];
                              updated[idx] = temp;
                              setEditorData({ ...editorData, columns: updated });
                            }}
                            className="p-1 rounded text-slate-400 hover:text-white"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditorData({
                              ...editorData,
                              columns: editorData.columns.filter((_, i) => i !== idx),
                            });
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  duplicateGenerator(editorData);
                  setIsEditorOpen(false);
                }}
                className="px-3 py-1.5 rounded-xl glass-panel text-slate-300 hover:text-white text-xs font-semibold"
              >
                Duplicar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-3 py-1.5 rounded-xl glass-panel text-slate-400 text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditor}
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 text-black font-bold text-xs shadow-md"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: AJUSTES DE IA ================= */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl glass-panel-elevated p-5 border border-purple-400/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-purple-400" />
                <span>Configuração de IA</span>
              </h3>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">Provedor / Modo</label>
                <select
                  value={aiSettings.provider}
                  onChange={(e) => updateAISettings({ provider: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400 font-medium"
                >
                  <option value="offline-procedural">⚡ 100% Offline Procedural (Instantâneo / 0% Custo de Tokens)</option>
                  <option value="openai-compatible">OpenAI Compatible (ChatGPT, Groq, Ollama - Chave Própria)</option>
                  <option value="anthropic">Anthropic (Claude - Chave Própria)</option>
                  <option value="custom-proxy">Proxy Customizado / Endpoint Próprio</option>
                </select>
              </div>

              {aiSettings.provider === 'offline-procedural' ? (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-400/30 text-xs text-emerald-200 leading-relaxed space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                    <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
                    <span>Modo 100% Offline Ativado (0 Tokens)</span>
                  </div>
                  <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                    Itens gerados de forma procedural e determinística usando tabelas clássicas de TTRPG (armas com fórmulas de dano 1d8+2, poções, pergaminhos e tesouros balanceados).
                  </p>
                  <div className="text-[10px] text-emerald-300/80 font-mono">
                    ✓ 0ms latência &nbsp;•&nbsp; ✓ Modo avião &nbsp;•&nbsp; ✓ 0 consumo de tokens
                  </div>
                </div>
              ) : (
                <>
                  <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-[11px] text-purple-200 leading-relaxed">
                    💡 <strong>IA Própria (BYO Key):</strong> Chamada feita diretamente pelo seu navegador com suas próprias credenciais, sem consumir nenhum token do servidor do app.
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Modelo</label>
                    <input
                      type="text"
                      value={aiSettings.model}
                      onChange={(e) => updateAISettings({ model: e.target.value })}
                      placeholder="gpt-4o-mini ou claude-3-5-haiku"
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Endpoint URL</label>
                    <input
                      type="text"
                      value={aiSettings.endpoint || ''}
                      onChange={(e) => updateAISettings({ endpoint: e.target.value })}
                      placeholder="https://api.openai.com/v1/chat/completions"
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Chave de API (opcional para proxies locais)</label>
                    <input
                      type="password"
                      value={aiSettings.apiKey || ''}
                      onChange={(e) => updateAISettings({ apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-400/20 text-[11px] text-cyan-200 leading-relaxed">
                    ℹ️ <strong>Fallback Inteligente:</strong> Se a conexão falhar ou demorar mais de 4.5s, o gerador procedural offline assume automaticamente sem travar.
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-purple-500 text-white font-bold text-xs"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
