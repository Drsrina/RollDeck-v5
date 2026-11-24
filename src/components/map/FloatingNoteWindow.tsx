import {
  Compass,
  Eye,
  FileEdit,
  IdCard,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  Minus,
  Save,
  Tag,
  Trash2,
  X,
  Castle,
  User,
  Skull,
  Search,
  Shield,
  Sword,
  BookOpen,
  FileText,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { createDefaultCharacterSheet } from '../../lib/characterSheet';
import { computeBacklinks, extractWikiLinks } from '../../lib/wikiLinks';
import { useAppStore } from '../../store/useAppStore';
import { useMapStore } from '../../store/useMapStore';
import type { CharacterSheetData, FloatingWindowState, NoteCategory } from '../../types';
import { CharacterSheetPanel } from './CharacterSheetPanel';
import { NoteMarkdownPreview } from './NoteMarkdownPreview';

interface FloatingNoteWindowProps {
  windowState: FloatingWindowState;
}

export const CATEGORY_ICONS: Record<NoteCategory, React.ElementType> = {
  general: FileText,
  location: Castle,
  npc: User,
  character: IdCard,
  dungeon: Skull,
  clue: Search,
  faction: Shield,
  item: Sword,
  lore: BookOpen,
};

export const CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: 'Geral',
  location: 'Local / Cidade',
  npc: 'Personagem (NPC)',
  character: 'Ficha de Personagem',
  dungeon: 'Masmorra / Tumba',
  clue: 'Pista / Mistério',
  faction: 'Facção / Grupo',
  item: 'Item Lendário',
  lore: 'Lore / História',
};

export const CATEGORY_COLORS: Record<NoteCategory, string> = {
  general: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
  location: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  npc: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  character: 'text-pink-400 border-pink-500/35 bg-pink-500/15',
  dungeon: 'text-red-400 border-red-500/30 bg-red-500/10',
  clue: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  faction: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  item: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
  lore: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
};

export const FloatingNoteWindow: React.FC<FloatingNoteWindowProps> = ({ windowState }) => {
  const {
    notes,
    links,
    saveNoteData,
    closeFloatingNote,
    minimizeFloatingNote,
    updateFloatingWindowPosition,
    bringFloatingWindowToFront,
    focusCameraOn,
    selectNode,
    openFloatingNote,
  } = useMapStore();
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  const note = notes.find((n) => n.id === windowState.noteId);

  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const [category, setCategory] = useState<NoteCategory>(note?.category || 'general');
  const [characterSheet, setCharacterSheet] = useState<CharacterSheetData | undefined>(
    note?.characterSheet
  );
  const [characterView, setCharacterView] = useState<'sheet' | 'notes'>('sheet');
  const [isPreview, setIsPreview] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync when note updates externally
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setBody(note.body);
      setCategory(note.category || 'general');
      setCharacterSheet(
        note.characterSheet ||
          (note.category === 'character' ? createDefaultCharacterSheet() : undefined)
      );
      setCharacterView('sheet');
      setHasUnsavedChanges(false);
    }
  }, [note?.id]);

  // Dragging logic via PointerCapture
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const windowStartPosRef = useRef({ x: 0, y: 0 });

  const handlePointerDownHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, select, input, a')) return;
    bringFloatingWindowToFront(windowState.noteId);
    isDraggingRef.current = true;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    windowStartPosRef.current = { x: windowState.x, y: windowState.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMoveHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartPosRef.current.x;
    const dy = e.clientY - dragStartPosRef.current.y;
    updateFloatingWindowPosition(windowState.noteId, {
      x: windowStartPosRef.current.x + dx,
      y: windowStartPosRef.current.y + dy,
    });
  };

  const handlePointerUpHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Resizing logic via PointerCapture
  const isResizingRef = useRef(false);
  const resizeStartPosRef = useRef({ x: 0, y: 0 });
  const startDimensionsRef = useRef({ width: 0, height: 0 });

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    bringFloatingWindowToFront(windowState.noteId);
    isResizingRef.current = true;
    resizeStartPosRef.current = { x: e.clientX, y: e.clientY };
    startDimensionsRef.current = { width: windowState.width, height: windowState.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isResizingRef.current) return;
    const dx = e.clientX - resizeStartPosRef.current.x;
    const dy = e.clientY - resizeStartPosRef.current.y;
    updateFloatingWindowPosition(windowState.noteId, {
      x: windowState.x,
      y: windowState.y,
      width: Math.max(280, startDimensionsRef.current.width + dx),
      height: Math.max(200, startDimensionsRef.current.height + dy),
    });
  };

  const handleResizePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isResizingRef.current) {
      isResizingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleSave = async () => {
    if (!note) return;
    await saveNoteData({
      ...note,
      title: title.trim() || 'Nota Sem Título',
      body,
      category,
      characterSheet:
        category === 'character' ? characterSheet || createDefaultCharacterSheet() : note.characterSheet,
    });
    setHasUnsavedChanges(false);
  };

  const handleFocusOnMap = () => {
    if (!note) return;
    setActiveTab('map');
    selectNode(note.id);
    focusCameraOn(note.x, note.y);
  };

  const handleOpenLinkedTitle = (targetTitle: string) => {
    const match = notes.find(
      (n) => n.title.trim().toLowerCase() === targetTitle.trim().toLowerCase()
    );
    if (match) {
      openFloatingNote(match.id);
    }
  };

  const handleToggleCheckbox = (lineIndex: number) => {
    setBody((prev) => {
      const lines = prev.split('\n');
      const target = lines[lineIndex];
      if (typeof target !== 'string') return prev;
      if (target.startsWith('- [ ] ')) {
        lines[lineIndex] = `- [x] ${target.slice(6)}`;
      } else if (/^- \[(x|X)\] /.test(target)) {
        lines[lineIndex] = `- [ ] ${target.slice(6)}`;
      }
      return lines.join('\n');
    });
    setHasUnsavedChanges(true);
  };

  if (!note || windowState.isMinimized) return null;

  const CategoryIcon = CATEGORY_ICONS[category] || FileText;
  const backlinks = computeBacklinks(note.id, links, notes);
  const outgoing = extractWikiLinks(body);

  return (
    <div
      onPointerDown={() => bringFloatingWindowToFront(windowState.noteId)}
      style={{
        left: `${windowState.x}px`,
        top: `${windowState.y}px`,
        width: `${windowState.width}px`,
        height: `${windowState.height}px`,
        zIndex: windowState.zIndex,
      }}
      className="fixed flex flex-col rounded-2xl bg-slate-950/95 border border-white/20 shadow-2xl backdrop-blur-xl overflow-hidden select-none touch-none"
    >
      {/* Draggable Header */}
      <div
        onPointerDown={handlePointerDownHeader}
        onPointerMove={handlePointerMoveHeader}
        onPointerUp={handlePointerUpHeader}
        className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-white/10 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div className={`p-1 rounded-md border ${CATEGORY_COLORS[category]}`}>
            <CategoryIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-white truncate max-w-[200px]">
            {title || 'Sem Título'}
          </span>
          {hasUnsavedChanges && (
            <span className="text-[10px] text-amber-400 font-mono font-medium">● editado</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleFocusOnMap}
            title="Localizar no Mapa"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            title={isPreview ? 'Modo Edição' : 'Modo Leitura'}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition"
          >
            {isPreview ? <FileEdit className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => minimizeFloatingNote(windowState.noteId, true)}
            title="Minimizar para o Dock"
            className="p-1 rounded-md text-slate-400 hover:text-amber-400 hover:bg-white/10 transition"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => closeFloatingNote(windowState.noteId)}
            title="Fechar Janela Flutuante"
            className="p-1 rounded-md text-slate-400 hover:text-red-400 hover:bg-white/10 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 select-text touch-auto text-xs">
        {/* Category & Title Row */}
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => {
              const nextCat = e.target.value as NoteCategory;
              setCategory(nextCat);
              if (nextCat === 'character' && !characterSheet) {
                setCharacterSheet(createDefaultCharacterSheet());
              }
              setHasUnsavedChanges(true);
            }}
            className="px-2 py-1 rounded-lg bg-black/60 border border-white/15 text-[11px] font-bold text-slate-200 focus:outline-none focus:border-cyan-400 shrink-0"
          >
            {(Object.keys(CATEGORY_LABELS) as NoteCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasUnsavedChanges(true);
            }}
            placeholder={category === 'character' ? 'Nome do personagem...' : 'Título da nota...'}
            className="flex-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Character Sheet vs Notes Switcher when category === 'character' */}
        {category === 'character' && (
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/45 border border-white/10">
            <button
              type="button"
              onClick={() => setCharacterView('sheet')}
              className={`flex-1 py-1 rounded-md text-[11px] font-bold transition ${
                characterView === 'sheet'
                  ? 'bg-pink-500/25 text-pink-200 border border-pink-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ficha Completa
            </button>
            <button
              type="button"
              onClick={() => setCharacterView('notes')}
              className={`flex-1 py-1 rounded-md text-[11px] font-bold transition ${
                characterView === 'notes'
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              História & [[Links]]
            </button>
          </div>
        )}

        {/* Content Mode */}
        {category === 'character' && characterView === 'sheet' ? (
          <CharacterSheetPanel
            value={characterSheet || createDefaultCharacterSheet()}
            characterName={title}
            compact
            onChange={(nextSheet) => {
              setCharacterSheet(nextSheet);
              setHasUnsavedChanges(true);
            }}
          />
        ) : isPreview ? (
          <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 min-h-[140px]">
            <NoteMarkdownPreview
              text={body}
              compact
              onWikiLinkClick={handleOpenLinkedTitle}
              onToggleCheckbox={handleToggleCheckbox}
            />
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setHasUnsavedChanges(true);
            }}
            placeholder={
              category === 'character'
                ? 'História, vínculos, segredos... Use [[nome da nota]] para conectar a locais e NPCs!'
                : 'Escreva anotações em Markdown... Use [[nome da nota]] para linkar nós do mapa.'
            }
            className="w-full h-[calc(100%-80px)] min-h-[140px] p-2.5 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
          />
        )}

        {/* Outgoing & Backlinks Bar */}
        {(outgoing.length > 0 || backlinks.length > 0) && (
          <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2 text-[10px]">
            {outgoing.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-cyan-400">
                <LinkIcon className="w-3 h-3 shrink-0" />
                <span>Links ({outgoing.length}):</span>
                {outgoing.map((l, idx) => (
                  <button
                    key={`${l.targetTitle}-${idx}`}
                    type="button"
                    onClick={() => handleOpenLinkedTitle(l.targetTitle)}
                    className="underline underline-offset-2 hover:text-cyan-200 cursor-pointer"
                  >
                    {l.displayLabel || l.targetTitle}
                  </button>
                ))}
              </div>
            )}
            {backlinks.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-purple-400">
                <span>Citado por:</span>
                {backlinks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => openFloatingNote(b.id)}
                    className="underline underline-offset-2 hover:text-purple-200 cursor-pointer"
                  >
                    {b.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer with Save Status */}
      <div className="px-3 py-2 bg-slate-900/90 border-t border-white/10 flex items-center justify-between select-none">
        <span className="text-[10px] text-slate-400">
          {hasUnsavedChanges ? 'Alterações pendentes' : 'Salvo no banco local'}
        </span>
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition"
        >
          <Save className="w-3 h-3" />
          Salvar
        </button>
      </div>

      {/* Resize Handle at Bottom Right */}
      <div
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize touch-none z-50 flex items-center justify-center text-slate-500 hover:text-white"
        title="Redimensionar janela"
      >
        <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 fill-current">
          <circle cx="5" cy="5" r="1" />
          <circle cx="5" cy="2" r="1" />
          <circle cx="2" cy="5" r="1" />
        </svg>
      </div>
    </div>
  );
};
