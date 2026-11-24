import { ArrowRight, MoveHorizontal, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useMapStore } from '../../store/useMapStore';
import type { NoteLink, NoteLinkStyle } from '../../types';

interface LinkEditorModalProps {
  link: NoteLink | null;
  onClose: () => void;
}

const COMMON_RELATIONS = [
  'Aliado de',
  'Inimigo jurado',
  'Localizado em',
  'Pista sobre',
  'Membro da facção',
  'Mestre de',
  'Guarda o segredo',
  'Comércio com',
  'Rumor diz que',
];

const LINK_COLORS = [
  '#22d3ee',
  '#a855f7',
  '#f43f5e',
  '#10b981',
  '#f59e0b',
  '#94a3b8',
];

export const LinkEditorModal: React.FC<LinkEditorModalProps> = ({ link, onClose }) => {
  const { notes, updateLink, removeLink } = useMapStore();

  const [label, setLabel] = useState(link?.label || '');
  const [style, setStyle] = useState<NoteLinkStyle>(link?.style || 'solid');
  const [directional, setDirectional] = useState(link?.directional ?? true);
  const [color, setColor] = useState(link?.color || '#22d3ee');

  // Re-sync local form state whenever a different link is opened
  useEffect(() => {
    if (link) {
      setLabel(link.label || '');
      setStyle(link.style || 'solid');
      setDirectional(link.directional ?? true);
      setColor(link.color || '#22d3ee');
    }
  }, [link]);

  useEffect(() => {
    if (!link) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [link, onClose]);

  if (!link) return null;

  const sourceNote = notes.find((n) => n.id === link.fromId);
  const targetNote = notes.find((n) => n.id === link.toId);

  const handleSave = async () => {
    await updateLink({
      ...link,
      label: label.trim() || undefined,
      style,
      directional,
      color,
    });
    onClose();
  };

  const handleDelete = async () => {
    await removeLink(link.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-canvas-ui="true"
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl glass-panel-elevated p-4 border border-white/20 shadow-2xl space-y-3.5 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white min-w-0">
            <span className="text-cyan-400 truncate max-w-[130px]">{sourceNote?.title || 'Nó A'}</span>
            <span className="text-slate-500 shrink-0">→</span>
            <span className="text-purple-400 truncate max-w-[130px]">{targetNote?.title || 'Nó B'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Label / Relation */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">
            Rótulo da Relação
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              }
            }}
            placeholder="Ex: Aliado, Localizado em, Inimigo..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs font-medium focus:outline-none focus:border-cyan-400"
          />
          {/* Quick relation pills */}
          <div className="flex flex-wrap gap-1 pt-1">
            {COMMON_RELATIONS.slice(0, 6).map((rel) => (
              <button
                key={rel}
                type="button"
                onClick={() => setLabel(rel)}
                className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition border border-white/5"
              >
                {rel}
              </button>
            ))}
          </div>
        </div>

        {/* Style & Direction */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Estilo da Linha
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as NoteLinkStyle)}
              className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs"
            >
              <option value="solid" className="bg-slate-900">Sólida ──────</option>
              <option value="dashed" className="bg-slate-900">Tracejada - - -</option>
              <option value="dotted" className="bg-slate-900">Pontilhada · · ·</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Direção
            </label>
            <button
              type="button"
              onClick={() => setDirectional(!directional)}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-white text-xs font-semibold hover:border-cyan-400 transition"
            >
              {directional ? (
                <>
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Com Seta</span>
                </>
              ) : (
                <>
                  <MoveHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span>Bidirecional</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Color Swatches */}
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">
            Cor da Conexão
          </label>
          <div className="flex items-center gap-2">
            {LINK_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border transition-transform ${
                  color.toLowerCase() === c.toLowerCase()
                    ? 'border-white scale-110 ring-2 ring-cyan-400/60'
                    : 'border-white/25 hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remover</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md transition"
          >
            Salvar Conexão
          </button>
        </div>
      </div>
    </div>
  );
};
