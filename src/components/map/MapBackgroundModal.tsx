import React, { useRef } from 'react';
import { Image as ImageIcon, Lock, Trash2, Unlock, Upload, X, Plus, Move } from 'lucide-react';
import { useMapStore } from '../../store/useMapStore';
import { CanvasMapImage } from '../../types';

interface MapBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MapBackgroundModal: React.FC<MapBackgroundModalProps> = ({ isOpen, onClose }) => {
  const { mapImages, addMapImage, updateMapImage, deleteMapImage, viewState } = useMapStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Position relative to current canvas pan
        const baseWorldX = Math.round((-viewState.panX + 150 + index * 40) / viewState.zoom);
        const baseWorldY = Math.round((-viewState.panY + 150 + index * 40) / viewState.zoom);

        const newImg: CanvasMapImage = {
          id: `canvas-img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          dataUrl,
          x: baseWorldX,
          y: baseWorldY,
          width: 500,
          height: 380,
          opacity: 0.85,
          locked: false,
          zIndex: (mapImages?.length || 0) + 1,
        };
        addMapImage(newImg);
      };
      reader.readAsDataURL(file);
    });

    if (e.target) {
      e.target.value = '';
    }
  };

  return (
    <div
      role="dialog"
      data-canvas-ui="true"
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl glass-panel-elevated p-4 sm:p-5 border border-white/20 shadow-2xl space-y-4 select-none max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Imagens e Tokens do Canvas
              </h3>
              <p className="text-[10px] text-slate-400">
                Arraste, posicione e redimensione múltiplos mapas e tokens
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Upload banner */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-3 rounded-xl border border-dashed border-cyan-400/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/40 text-cyan-300 flex items-center justify-center gap-2 text-xs font-bold transition shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Adicionar Nova Imagem / Token (+PNG, JPG, WebP)</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* List of images */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
          {mapImages && mapImages.length > 0 ? (
            mapImages.map((img, idx) => (
              <div
                key={img.id}
                className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 flex flex-col gap-2.5"
              >
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="w-16 h-12 rounded-lg overflow-hidden border border-white/15 bg-black shrink-0 relative">
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="w-full h-full object-cover"
                      style={{ opacity: img.opacity }}
                    />
                  </div>

                  {/* Name and dimensions */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={img.name}
                      onChange={(e) => updateMapImage(img.id, { name: e.target.value })}
                      className="w-full px-2 py-1 rounded bg-black/50 border border-white/10 text-white font-bold text-xs focus:outline-none focus:border-cyan-400"
                      placeholder="Nome da imagem ou token..."
                    />
                    <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>{img.width}x{img.height}px</span>
                      <span>•</span>
                      <span>Pos: ({img.x}, {img.y})</span>
                    </div>
                  </div>

                  {/* Lock & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateMapImage(img.id, { locked: !img.locked })}
                      title={img.locked ? 'Destravar (permitir mover)' : 'Travar posição'}
                      className={`p-2 rounded-lg transition ${
                        img.locked
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {img.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4 text-cyan-400" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteMapImage(img.id)}
                      title="Excluir do Canvas"
                      className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Opacity slider */}
                <div className="flex items-center gap-3 pt-1 border-t border-white/5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase w-16">
                    Opacidade:
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={img.opacity}
                    onChange={(e) => updateMapImage(img.id, { opacity: parseFloat(e.target.value) })}
                    className="flex-1 accent-cyan-400 cursor-pointer h-1.5"
                  />
                  <span className="font-mono text-cyan-400 text-[10px] w-9 text-right font-bold">
                    {Math.round(img.opacity * 100)}%
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
                <ImageIcon className="w-6 h-6" />
              </div>
              <p className="text-slate-300 font-bold text-xs">
                Nenhuma imagem ou token no canvas
              </p>
              <p className="text-slate-500 text-[11px] max-w-xs mx-auto">
                Carregue mapas de batalha, plantas de cidades, brasões ou miniaturas para servir de referência visual.
              </p>
            </div>
          )}
        </div>

        {/* Footer tips */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <Move className="w-3.5 h-3.5 text-cyan-400" />
            <span>Arraste e use o canto inferior direito para redimensionar no mapa</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
