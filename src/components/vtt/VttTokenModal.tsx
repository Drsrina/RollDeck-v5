import { Eye, EyeOff, ImagePlus, Plus, Shield, Trash2, X } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { isGmOrAdmin, useAuthSession } from '../../lib/authSession';
import { useVttStore } from '../../store/useVttStore';
import {
  VTT_FACTION_META,
  VTT_SIZE_LABELS,
  type VttTokenFaction,
  type VttTokenSize,
} from '../../types/vtt';

interface VttTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLOR_SWATCHES = [
  '#10b981',
  '#22d3ee',
  '#3b82f6',
  '#a855f7',
  '#e879f9',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#94a3b8',
];

async function compressTokenAvatar(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Imagem inválida'));
    el.src = dataUrl;
  });

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  const minSide = Math.min(img.width, img.height);
  const sx = (img.width - minSide) / 2;
  const sy = (img.height - minSide) / 2;
  ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
  return canvas.toDataURL('image/webp', 0.85);
}

export const VttTokenModal: React.FC<VttTokenModalProps> = ({ isOpen, onClose }) => {
  const addToken = useVttStore((s) => s.addToken);
  const { user: currentUser } = useAuthSession();
  const isGm = isGmOrAdmin(currentUser);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState('');
  const [faction, setFaction] = useState<VttTokenFaction>('ally');
  const [color, setColor] = useState<string>(VTT_FACTION_META.ally.color);
  const [sizeCells, setSizeCells] = useState<VttTokenSize>(1);
  const [hpMax, setHpMax] = useState<number>(30);
  const [ac, setAc] = useState<number>(14);
  const [initiativeMod, setInitiativeMod] = useState<number>(2);
  const [speed, setSpeed] = useState<string>('9m');
  const [notes, setNotes] = useState<string>('');
  const [hidden, setHidden] = useState<boolean>(false);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFactionChange = (nextFaction: VttTokenFaction) => {
    setFaction(nextFaction);
    setColor(VTT_FACTION_META[nextFaction].color);
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError(null);
    try {
      const compressed = await compressTokenAvatar(file);
      setAvatarUrl(compressed);
    } catch {
      setAvatarError('Não foi possível processar esta imagem.');
    }
  };

  const resetForm = () => {
    setName('');
    setFaction('ally');
    setColor(VTT_FACTION_META.ally.color);
    setSizeCells(1);
    setHpMax(30);
    setAc(14);
    setInitiativeMod(2);
    setSpeed('9m');
    setNotes('');
    setHidden(false);
    setAvatarUrl(undefined);
    setAvatarError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const safeMax = Math.max(1, Math.round(hpMax) || 1);
    const trimmed = name.trim() || `${VTT_FACTION_META[faction].label} #1`;

    addToken({
      name: trimmed,
      faction,
      color,
      avatarUrl,
      sizeCells,
      rotation: 0,
      locked: false,
      hidden: isGm ? hidden : false,
      hpCurrent: safeMax,
      hpMax: safeMax,
      hpTemp: 0,
      ac: Math.max(0, Math.round(ac) || 10),
      speed: speed.trim() || '9m',
      initiativeMod: Math.round(initiativeMod) || 0,
      initiativeValue: null,
      conditions: [],
      notes: notes.trim() || undefined,
    });

    resetForm();
    onClose();
  };

  const initials = (name.trim() || VTT_FACTION_META[faction].label)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vtt-new-token-title"
      data-dice3d-ignore="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0e1120] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-black/25">
          <div>
            <h2 id="vtt-new-token-title" className="text-sm font-black text-white tracking-wide">
              Novo Token Tático
            </h2>
            <p className="text-[11px] text-slate-400">
              Posicionado automaticamente em uma célula livre do tabuleiro
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {/* Preview + Avatar Upload */}
          <div className="flex items-center gap-4">
            <div
              className="relative w-16 h-16 rounded-full shrink-0 flex items-center justify-center overflow-hidden shadow-lg"
              style={{
                border: `3px solid ${color}`,
                background: 'radial-gradient(circle at 35% 30%, #1e293b, #090d16)',
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Preview do token"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-base font-black text-slate-100 select-none">
                  {initials || '?'}
                </span>
              )}
              <span className="absolute -top-0.5 -right-0.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-slate-950/90 border border-white/20 text-[9px] font-black text-slate-100 tabular-nums">
                <Shield className="w-2.5 h-2.5 text-cyan-300" />
                {ac}
              </span>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadAvatar}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <ImagePlus className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{avatarUrl ? 'Trocar foto' : 'Enviar foto'}</span>
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-xs font-bold text-rose-200 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover</span>
                  </button>
                )}
              </div>
              {avatarError ? (
                <p className="text-[11px] text-rose-400">{avatarError}</p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Recorte circular automático (256×256 WebP salvo offline).
                </p>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Nome do Token
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Lyra, Goblin Arqueiro, Pilar de Pedra..."
              autoFocus
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/60"
            />
          </div>

          {/* Faction & Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Facção
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(['ally', 'enemy', 'neutral', 'object'] as VttTokenFaction[]).map((fac) => {
                  const meta = VTT_FACTION_META[fac];
                  const active = faction === fac;
                  return (
                    <button
                      key={fac}
                      type="button"
                      onClick={() => handleFactionChange(fac)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        active
                          ? 'bg-white/15 border-white/35 text-white'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="truncate">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Tamanho na Grade
              </label>
              <select
                value={sizeCells}
                onChange={(e) => setSizeCells(Number(e.target.value) as VttTokenSize)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs font-bold text-slate-100 focus:outline-none focus:border-cyan-400/60"
              >
                {([1, 2, 3, 4] as VttTokenSize[]).map((sz) => (
                  <option key={sz} value={sz} className="bg-[#0e1120]">
                    {VTT_SIZE_LABELS[sz]}
                  </option>
                ))}
              </select>

              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    onClick={() => setColor(swatch)}
                    className={`w-5 h-5 rounded-full transition cursor-pointer ${
                      color === swatch ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0e1120] scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: swatch }}
                    aria-label={`Selecionar cor ${swatch}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Combat Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                PV Máx
              </label>
              <input
                type="number"
                min={1}
                max={9999}
                value={hpMax}
                onChange={(e) => setHpMax(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-black/40 border border-white/15 text-sm font-bold text-white tabular-nums focus:outline-none focus:border-cyan-400/60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                CA
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={ac}
                onChange={(e) => setAc(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-black/40 border border-white/15 text-sm font-bold text-white tabular-nums focus:outline-none focus:border-cyan-400/60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Inic. Mod
              </label>
              <input
                type="number"
                min={-15}
                max={30}
                value={initiativeMod}
                onChange={(e) => setInitiativeMod(Number(e.target.value))}
                className="w-full px-2.5 py-2 rounded-xl bg-black/40 border border-white/15 text-sm font-bold text-white tabular-nums focus:outline-none focus:border-cyan-400/60"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Desloc.
              </label>
              <input
                type="text"
                value={speed}
                onChange={(e) => setSpeed(e.target.value)}
                placeholder="9m"
                className="w-full px-2.5 py-2 rounded-xl bg-black/40 border border-white/15 text-sm font-bold text-white focus:outline-none focus:border-cyan-400/60"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Notas Rápidas (Opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Resistências, aura, visão no escuro, equipamento..."
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 resize-none"
            />
          </div>

          {isGm && (
            <button
              type="button"
              onClick={() => setHidden((v) => !v)}
              className={`w-full py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                hidden
                  ? 'bg-purple-500/20 border-purple-400/45 text-purple-200'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
              }`}
            >
              {hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>
                {hidden ? 'Criar oculto dos jogadores' : 'Visível para todos na mesa'}
              </span>
            </button>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black tracking-wide flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar ao Tabuleiro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
