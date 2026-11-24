import { FileText, Maximize2, X } from 'lucide-react';
import React from 'react';
import { useMapStore } from '../../store/useMapStore';
import { CATEGORY_ICONS, CATEGORY_COLORS } from './FloatingNoteWindow';
import type { NoteCategory } from '../../types';

export const FloatingNotesDock: React.FC = () => {
  const { floatingWindows, notes, minimizeFloatingNote, closeFloatingNote } = useMapStore();

  const minimizedWindows = floatingWindows.filter((w) => w.isMinimized);

  if (minimizedWindows.length === 0) return null;

  return (
    <div className="fixed bottom-16 md:bottom-4 left-4 z-50 flex flex-wrap items-center gap-2 pointer-events-auto max-w-[calc(100vw-32px)]">
      <div className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md p-1 rounded-2xl border border-white/20 shadow-2xl">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
          Notas Fixadas ({minimizedWindows.length})
        </span>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-[70vw] py-0.5">
          {minimizedWindows.map((win) => {
            const note = notes.find((n) => n.id === win.noteId);
            if (!note) return null;

            const category: NoteCategory = note.category || 'general';
            const Icon = CATEGORY_ICONS[category] || FileText;

            return (
              <div
                key={win.noteId}
                className="group flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-white/20 hover:border-cyan-400 text-white text-xs shadow-md transition"
              >
                <button
                  type="button"
                  onClick={() => minimizeFloatingNote(win.noteId, false)}
                  className="flex items-center gap-1.5 font-bold hover:text-cyan-300 transition"
                  title="Restaurar nota flutuante"
                >
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="truncate max-w-[120px]">{note.title || 'Sem Título'}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFloatingNote(win.noteId);
                  }}
                  className="p-0.5 rounded-full text-slate-400 hover:text-red-400 hover:bg-white/10 transition"
                  title="Fechar nota"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
