import React, { useState, useRef } from 'react';
import { useMapStore } from '../../store/useMapStore';
import { Lock, Unlock, Trash2, Move, Maximize2 } from 'lucide-react';
import { CanvasMapImage } from '../../types';

interface MapImagesLayerProps {
  zoom: number;
}

export const MapImagesLayer: React.FC<MapImagesLayerProps> = ({ zoom }) => {
  const { mapImages, canvasTool, updateMapImage, commitMapImages, deleteMapImage } = useMapStore();
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const isPanMode = canvasTool === 'pan';

  // Dragging state
  const dragRef = useRef<{
    imageId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Resizing state
  const resizeRef = useRef<{
    imageId: string;
    startX: number;
    startY: number;
    origWidth: number;
    origHeight: number;
  } | null>(null);

  // Start image drag
  const handlePointerDownDrag = (e: React.PointerEvent, img: CanvasMapImage) => {
    if (!isPanMode || img.locked) return;
    e.stopPropagation();
    setSelectedImageId(img.id);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    dragRef.current = {
      imageId: img.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: img.x,
      origY: img.y,
    };
  };

  const handlePointerMoveDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { imageId, startX, startY, origX, origY } = dragRef.current;
    const dx = (e.clientX - startX) / (zoom || 1);
    const dy = (e.clientY - startY) / (zoom || 1);

    updateMapImage(
      imageId,
      {
        x: Math.round(origX + dx),
        y: Math.round(origY + dy),
      },
      { commit: false }
    );
  };

  const handlePointerUpDrag = (e: React.PointerEvent) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }
      } catch {}
      commitMapImages();
    }
  };

  // Start image resize
  const handlePointerDownResize = (e: React.PointerEvent, img: CanvasMapImage) => {
    if (!isPanMode || img.locked) return;
    e.stopPropagation();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    resizeRef.current = {
      imageId: img.id,
      startX: e.clientX,
      startY: e.clientY,
      origWidth: img.width,
      origHeight: img.height,
    };
  };

  const handlePointerMoveResize = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const { imageId, startX, startY, origWidth, origHeight } = resizeRef.current;
    const dx = (e.clientX - startX) / (zoom || 1);
    const dy = (e.clientY - startY) / (zoom || 1);

    const newWidth = Math.max(60, Math.round(origWidth + dx));
    const newHeight = Math.max(60, Math.round(origHeight + dy));

    updateMapImage(
      imageId,
      {
        width: newWidth,
        height: newHeight,
      },
      { commit: false }
    );
  };

  const handlePointerUpResize = (e: React.PointerEvent) => {
    if (resizeRef.current) {
      resizeRef.current = null;
      try {
        if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
          (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        }
      } catch {}
      commitMapImages();
    }
  };

  if (!mapImages || mapImages.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {mapImages.map((img) => {
        const isSelected = isPanMode && selectedImageId === img.id;

        return (
          <div
            key={img.id}
            data-map-image-id={img.id}
            onClick={(e) => {
              if (!isPanMode) return;
              e.stopPropagation();
              setSelectedImageId((prev) => (prev === img.id ? null : img.id));
            }}
            style={{
              position: 'absolute',
              left: `${img.x}px`,
              top: `${img.y}px`,
              width: `${img.width}px`,
              height: `${img.height}px`,
              opacity: img.opacity,
              zIndex: img.zIndex ?? 1,
            }}
            className={`${isPanMode ? 'pointer-events-auto' : 'pointer-events-none'} select-none group transition-[border-color,box-shadow] ${
              isSelected ? 'ring-2 ring-cyan-400 ring-offset-2 ring-offset-black/40' : ''
            }`}
          >
            {/* Image Container with Drag handler */}
            <div
              onPointerDown={(e) => handlePointerDownDrag(e, img)}
              onPointerMove={handlePointerMoveDrag}
              onPointerUp={handlePointerUpDrag}
              onPointerCancel={handlePointerUpDrag}
              className={`w-full h-full relative rounded-2xl overflow-hidden shadow-2xl border ${
                isSelected
                  ? 'border-cyan-400/80 shadow-[0_0_25px_rgba(34,211,238,0.3)]'
                  : 'border-white/15 hover:border-white/40'
              } ${img.locked || !isPanMode ? 'cursor-default' : 'cursor-move'}`}
            >
              <img
                src={img.dataUrl}
                alt={img.name || 'Imagem de Mapa'}
                className="w-full h-full object-cover select-none pointer-events-none"
                draggable={false}
              />

              {/* Floating Quick Controls Bar (visible when selected or hover) */}
              <div
                className={`absolute top-2 left-2 right-2 flex items-center justify-between p-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 shadow-lg transition-opacity ${
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1.5 px-1 truncate">
                  {!img.locked && <Move className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider truncate max-w-[120px]">
                    {img.name || 'Imagem'}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Opacity quick cycle */}
                  <button
                    type="button"
                    onClick={() => {
                      const opacities = [1, 0.75, 0.5, 0.25];
                      const currentIdx = opacities.findIndex((o) => Math.abs(o - img.opacity) < 0.1);
                      const nextIdx = (currentIdx + 1) % opacities.length;
                      updateMapImage(img.id, { opacity: opacities[nextIdx] });
                    }}
                    title={`Opacidade: ${Math.round(img.opacity * 100)}% (clique para alternar)`}
                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 transition"
                  >
                    {Math.round(img.opacity * 100)}%
                  </button>

                  {/* Lock / Unlock Toggle */}
                  <button
                    type="button"
                    onClick={() => updateMapImage(img.id, { locked: !img.locked })}
                    title={img.locked ? 'Destravar Imagem' : 'Travar Imagem no Canvas'}
                    className={`p-1 rounded-lg transition ${
                      img.locked
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {img.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => deleteMapImage(img.id)}
                    title="Excluir Imagem do Canvas"
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Resize Handle (bottom-right corner) */}
            {!img.locked && (
              <div
                onPointerDown={(e) => handlePointerDownResize(e, img)}
                onPointerMove={handlePointerMoveResize}
                onPointerUp={handlePointerUpResize}
                onPointerCancel={handlePointerUpResize}
                title="Arraste para redimensionar"
                className={`absolute -bottom-2 -right-2 w-6 h-6 rounded-lg bg-cyan-500 text-black flex items-center justify-center shadow-lg cursor-se-resize transition-transform hover:scale-125 active:scale-95 ${
                  isSelected ? 'opacity-100 scale-110 ring-2 ring-white' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <Maximize2 className="w-3 h-3 rotate-90 stroke-[2.5]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
