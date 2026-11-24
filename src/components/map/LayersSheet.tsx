import {
  Eye,
  EyeOff,
  Focus,
  Layers,
  Lock,
  PenTool,
  Plus,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useMapStore } from '../../store/useMapStore';

export const LayersSheet: React.FC = () => {
  const {
    layers,
    notes,
    drawings,
    activeDrawingLayerId,
    setActiveDrawingLayerId,
    isLayersPanelOpen,
    setLayersPanelOpen,
    createLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    deleteLayerData,
    viewState,
    setViewState,
  } = useMapStore();

  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState('#22d3ee');
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteLayerId, setConfirmDeleteLayerId] = useState<string | null>(null);

  if (!isLayersPanelOpen) return null;

  const handleCreate = async () => {
    if (!newLayerName.trim()) return;
    await createLayer(newLayerName.trim(), newLayerColor);
    setNewLayerName('');
    setShowAddForm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => {
        setConfirmDeleteLayerId(null);
        setLayersPanelOpen(false);
      }}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl glass-panel-elevated p-4 sm:p-5 max-h-[85vh] flex flex-col border border-white/20 shadow-2xl pb-[calc(1.2rem+var(--safe-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Gerenciar Camadas</span>
          </h2>
          <button
            type="button"
            onClick={() => setLayersPanelOpen(false)}
            className="p-1 rounded-full text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Focus Mode Controls */}
        <div className="py-3 border-b border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Focus className="w-3.5 h-3.5 text-purple-400" />
              Modo Foco (N saltos na vizinhança)
            </span>
            <span className="text-[10px] text-cyan-300 font-bold">
              {viewState.focusNodeId ? 'Ativado' : 'Clique direito em um nó'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {[1, 2, 3].map((hop) => (
              <button
                key={hop}
                type="button"
                onClick={() => setViewState({ focusHops: hop })}
                className={`flex-1 py-1 rounded-lg text-xs font-semibold transition ${
                  viewState.focusHops === hop
                    ? 'bg-purple-600 text-white'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {hop} {hop === 1 ? 'Salto' : 'Saltos'}
              </button>
            ))}
            {viewState.focusNodeId && (
              <button
                type="button"
                onClick={() => setViewState({ focusNodeId: null })}
                className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-semibold"
              >
                Desativar
              </button>
            )}
          </div>
        </div>

        {/* Layers List */}
        <div className="overflow-y-auto space-y-2 py-3 pr-1 text-xs flex-1">
          {layers.map((layer) => {
            const noteCount = notes.filter((n) => n.layerId === layer.id).length;
            const drawingCount = drawings.filter((d) => d.layerId === layer.id).length;
            const isActiveDrawingLayer = activeDrawingLayerId === layer.id;
            const isConfirming = confirmDeleteLayerId === layer.id;

            return (
              <div
                key={layer.id}
                className={`p-2.5 rounded-xl glass-panel border flex items-center justify-between gap-2.5 ${
                  isActiveDrawingLayer ? 'border-cyan-400/50' : 'border-white/10'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-[0_0_8px]"
                    style={{ backgroundColor: layer.color, boxShadow: `0 0 8px ${layer.color}` }}
                  />
                  <div className="min-w-0">
                    <span className={`font-semibold truncate block ${layer.visible ? 'text-white' : 'text-slate-500 line-through'}`}>
                      {layer.name}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums">
                      {noteCount} {noteCount === 1 ? 'nota' : 'notas'} · {drawingCount}{' '}
                      {drawingCount === 1 ? 'traço' : 'traços'}
                      {layer.isRollLayer ? ' · Rolagens' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveDrawingLayerId(layer.id)}
                    aria-label={`Definir ${layer.name} como camada ativa de desenho`}
                    title={isActiveDrawingLayer ? 'Camada ativa para novos desenhos' : 'Usar para novos desenhos'}
                    className={`p-1.5 rounded-lg transition ${
                      isActiveDrawingLayer
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-500 hover:text-cyan-300 hover:bg-white/10'
                    }`}
                  >
                    <PenTool className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleLayerVisibility(layer.id)}
                    aria-label={layer.visible ? 'Ocultar camada' : 'Exibir camada'}
                    className={`p-1.5 rounded-lg transition ${
                      layer.visible ? 'text-cyan-400 hover:bg-white/10' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleLayerLock(layer.id)}
                    aria-label={layer.locked ? 'Destravar camada' : 'Travar camada'}
                    className={`p-1.5 rounded-lg transition ${
                      layer.locked ? 'text-amber-400 hover:bg-white/10' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {layer.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>

                  {layers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (isConfirming) {
                          deleteLayerData(layer.id);
                          setConfirmDeleteLayerId(null);
                        } else {
                          setConfirmDeleteLayerId(layer.id);
                        }
                      }}
                      title="Excluir camada (notas e traços serão movidos para outra camada)"
                      className={`px-1.5 py-1 rounded-lg transition text-[11px] font-bold flex items-center gap-1 ${
                        isConfirming
                          ? 'bg-rose-600 text-white hover:bg-rose-500'
                          : 'text-slate-500 hover:text-rose-400'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isConfirming && <span>Confirmar</span>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add layer button or form */}
        <div className="pt-2 border-t border-white/10 shrink-0">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-cyan-500/30 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Camada</span>
            </button>
          ) : (
            <div className="space-y-2 p-2.5 rounded-xl bg-black/40 border border-white/15">
              <input
                type="text"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                placeholder="Nome da camada (ex: Lore, Perigos...)"
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {['#22d3ee', '#e879f9', '#a3e635', '#f59e0b', '#8b5cf6', '#f43f5e'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewLayerColor(c)}
                      className={`w-5 h-5 rounded-full ${newLayerColor === c ? 'ring-2 ring-white scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-2 py-1 rounded bg-white/10 text-slate-300 text-xs"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="px-3 py-1 rounded bg-cyan-600 text-white font-bold text-xs"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
