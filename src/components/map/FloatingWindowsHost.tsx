import React from 'react';
import { useMapStore } from '../../store/useMapStore';
import { FloatingNoteWindow } from './FloatingNoteWindow';
import { FloatingNotesDock } from './FloatingNotesDock';

export const FloatingWindowsHost: React.FC = () => {
  const { floatingWindows } = useMapStore();

  return (
    <>
      {/* Active floating note windows */}
      {floatingWindows.map((win) => (
        <FloatingNoteWindow key={win.noteId} windowState={win} />
      ))}

      {/* Dock for minimized notes */}
      <FloatingNotesDock />
    </>
  );
};
