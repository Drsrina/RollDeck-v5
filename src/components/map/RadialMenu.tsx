import { Edit3, ExternalLink, Focus, Link2, Pin, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';

interface RadialMenuProps {
  onStartLink: (fromId: string) => void;
}

export const RadialMenu: React.FC<RadialMenuProps> = ({ onStartLink }) => {
  const {
    radialNodeId,
    radialPosition,
    setRadialMenu,
    notes,
    openEditor,
    openFloatingNote,
    togglePinNode,
    deleteNoteData,
    viewState,
    setViewState,
  } = useMapStore();

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [radialNodeId]);

  useEffect(() => {
    if (!radialNodeId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setRadialMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [radialNodeId, setRadialMenu]);

  if (!radialNodeId || !radialPosition) return null;

  const note = notes.find((n) => n.id === radialNodeId);
  if (!note) return null;

  const isFocusedHere = viewState.focusNodeId === radialNodeId;

  const handleEdit = () => {
    openEditor(radialNodeId);
    setRadialMenu(null);
  };

  const handlePopOut = () => {
    openFloatingNote(radialNodeId);
    setRadialMenu(null);
  };

  const handleLink = () => {
    onStartLink(radialNodeId);
    setRadialMenu(null);
  };

  const handleToggleFocus = () => {
    setViewState({ focusNodeId: isFocusedHere ? null : radialNodeId });
    setRadialMenu(null);
  };

  const handleTogglePin = () => {
    togglePinNode(radialNodeId);
    setRadialMenu(null);
  };

  const handleDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteNoteData(radialNodeId);
    setRadialMenu(null);
  };

  return (
    <div
      data-canvas-ui="true"
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 pointer-events-auto bg-black/40 backdrop-blur-xs flex items-center justify-center"
      onClick={() => setRadialMenu(null)}
    >
      <div
        className="absolute p-2 rounded-2xl glass-panel-elevated border border-cyan-400/50 shadow-[0_0_25px_rgba(34,211,238,0.4)] flex flex-col gap-1.5 min-w-[180px] animate-scale"
        style={{
          left: Math.max(16, Math.min(window.innerWidth - 200, radialPosition.x - 90)),
          top: Math.max(16, Math.min(window.innerHeight - 250, radialPosition.y - 60)),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10 px-1">
          <span className="text-xs font-bold text-white truncate max-w-[135px]">{note.title}</span>
          <button
            type="button"
            onClick={() => setRadialMenu(null)}
            className="text-slate-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleEdit}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold transition"
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Editar Nota</span>
        </button>

        <button
          type="button"
          onClick={handlePopOut}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold transition"
          title="Abrir como janela flutuante persistente pelo app"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Janela Flutuante</span>
        </button>

        <button
          type="button"
          onClick={handleLink}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-purple-500/20 text-purple-300 text-xs font-semibold transition"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>Conectar Link</span>
        </button>

        <button
          type="button"
          onClick={handleToggleFocus}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            isFocusedHere
              ? 'bg-purple-500/25 text-purple-200 border border-purple-400/40'
              : 'hover:bg-purple-500/15 text-slate-200'
          }`}
          title="Destaca apenas esta nota e sua vizinhança conectada"
        >
          <Focus className="w-3.5 h-3.5 text-purple-400" />
          <span>{isFocusedHere ? 'Sair do Modo Foco' : 'Focar Vizinhança'}</span>
        </button>

        <button
          type="button"
          onClick={handleTogglePin}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition"
        >
          <Pin className={`w-3.5 h-3.5 ${note.pinned ? 'fill-current' : ''}`} />
          <span>{note.pinned ? 'Desafixar Nó' : 'Fixar Posição'}</span>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border-t border-white/5 pt-2 ${
            confirmingDelete
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'hover:bg-rose-500/20 text-rose-400'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{confirmingDelete ? 'Confirmar Exclusão' : 'Excluir'}</span>
        </button>
      </div>
    </div>
  );
};
