import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crosshair,
  Dices,
  Eye,
  EyeOff,
  Heart,
  Image as ImageIcon,
  Lock,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Square,
  Sword,
  Swords,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { playCriticalFailSound, playCriticalSuccessSound, playDiceRollSound } from '../../lib/audio';
import { rollSingleDieRaw } from '../../lib/roll';
import { rollVttDamageExpression } from '../../lib/vttGrid';
import { useAppStore } from '../../store/useAppStore';
import { useVttStore } from '../../store/useVttStore';
import {
  VTT_CONDITIONS,
  VTT_FACTION_META,
  VTT_SIZE_LABELS,
  type VttScene,
  type VttToken,
  type VttTokenAttack,
  type VttTokenFaction,
  type VttTokenSize,
} from '../../types/vtt';

interface VttCombatSidebarProps {
  scene: VttScene;
  onCloseMobile?: () => void;
}

interface QuickAttackRollLog {
  id: number;
  tokenName: string;
  attackName: string;
  d20: number;
  bonus: number;
  attackTotal: number;
  damageTotal: number;
  damageBreakdown: string;
  isCrit: boolean;
  isFumble: boolean;
}

const COLOR_SWATCHES = [
  '#10b981',
  '#22d3ee',
  '#3b82f6',
  '#8b5cf6',
  '#e879f9',
  '#f43f5e',
  '#f97316',
  '#f59e0b',
  '#94a3b8',
];

async function compressAvatarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler imagem'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/webp', 0.85));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export const VttCombatSidebar: React.FC<VttCombatSidebarProps> = ({ scene, onCloseMobile }) => {
  const {
    selectedTokenId,
    selectToken,
    sidebarTab,
    setSidebarTab,
    updateToken,
    adjustTokenHp,
    toggleTokenCondition,
    duplicateToken,
    deleteToken,
    syncTokenToCharacterNote,
    rollAllInitiatives,
    rollTokenInitiative,
    setTokenInitiative,
    startCombat,
    nextTurn,
    prevTurn,
    endCombat,
    requestCameraFocus,
  } = useVttStore();

  const soundEnabled = useAppStore((s) => s.settings.soundEnabled);

  const [hpInput, setHpInput] = useState('5');
  const [syncedFeedback, setSyncedFeedback] = useState(false);
  const [attackLog, setAttackLog] = useState<QuickAttackRollLog | null>(null);
  const [isAddingAttack, setIsAddingAttack] = useState(false);
  const [newAtkName, setNewAtkName] = useState('');
  const [newAtkBonus, setNewAtkBonus] = useState('4');
  const [newAtkDamage, setNewAtkDamage] = useState('1d8+2');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const selectedToken: VttToken | null =
    scene.tokens.find((t) => t.id === selectedTokenId) || null;

  const orderedCombatants = scene.combat.order
    .map((id) => scene.tokens.find((t) => t.id === id))
    .filter((t): t is VttToken => Boolean(t));

  // Include any non-object tokens not yet in combat.order
  const unorderedCombatants = scene.tokens.filter(
    (t) => t.faction !== 'object' && !scene.combat.order.includes(t.id)
  );
  const combatList = [...orderedCombatants, ...unorderedCombatants];

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedToken) return;
    try {
      const dataUrl = await compressAvatarFile(file);
      updateToken(selectedToken.id, { avatarUrl: dataUrl });
    } catch {
      // Ignore upload errors
    } finally {
      e.target.value = '';
    }
  };

  const handleSyncToSheet = async () => {
    if (!selectedToken) return;
    const ok = await syncTokenToCharacterNote(selectedToken.id);
    if (ok) {
      setSyncedFeedback(true);
      window.setTimeout(() => setSyncedFeedback(false), 2000);
    }
  };

  const handleQuickAttack = (token: VttToken, attack: VttTokenAttack) => {
    const d20 = rollSingleDieRaw(20);
    const isCrit = d20 === 20;
    const isFumble = d20 === 1;
    const attackTotal = d20 + attack.bonus;
    const dmg = rollVttDamageExpression(attack.damage, isCrit, rollSingleDieRaw);

    if (soundEnabled) {
      if (isCrit) playCriticalSuccessSound();
      else if (isFumble) playCriticalFailSound();
      else playDiceRollSound(2);
    }

    setAttackLog({
      id: Date.now(),
      tokenName: token.name,
      attackName: attack.name,
      d20,
      bonus: attack.bonus,
      attackTotal,
      damageTotal: dmg.total,
      damageBreakdown: dmg.breakdown,
      isCrit,
      isFumble,
    });
  };

  const handleAddCustomAttack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedToken || !newAtkName.trim()) return;
    const nextAttack: VttTokenAttack = {
      id: `atk-${crypto.randomUUID()}`,
      name: newAtkName.trim(),
      bonus: Number.isFinite(Number(newAtkBonus)) ? Math.round(Number(newAtkBonus)) : 0,
      damage: newAtkDamage.trim() || '1d6',
    };
    updateToken(selectedToken.id, {
      attacks: [...(selectedToken.attacks || []), nextAttack],
    });
    setNewAtkName('');
    setNewAtkBonus('4');
    setNewAtkDamage('1d8+2');
    setIsAddingAttack(false);
  };

  const handleRemoveAttack = (attackId: string) => {
    if (!selectedToken) return;
    updateToken(selectedToken.id, {
      attacks: (selectedToken.attacks || []).filter((a) => a.id !== attackId),
    });
  };

  return (
    <aside
      data-dice3d-ignore="true"
      className="w-full sm:w-80 lg:w-[330px] h-full flex flex-col bg-[#0c0f1a] border-l border-white/10 shrink-0 select-none"
    >
      {/* Top Tabs Header */}
      <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-white/5 flex-1">
          <button
            type="button"
            onClick={() => setSidebarTab('combat')}
            className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              sidebarTab === 'combat'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Iniciativa ({combatList.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarTab('inspector')}
            className={`flex-1 py-1.5 px-2.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
              sidebarTab === 'inspector'
                ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Inspetor</span>
          </button>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fechar painel tático"
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* TAB 1: COMBAT & INITIATIVE TRACKER */}
      {sidebarTab === 'combat' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Combat Round Control Strip */}
          <div className="p-3 border-b border-white/10 space-y-2.5 bg-black/25">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="font-mono font-bold tabular-nums text-cyan-300">
                  Rodada {scene.combat.round}
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-slate-400">
                  {scene.combat.active ? 'Em combate' : 'Preparando'}
                </span>
              </div>

              <button
                type="button"
                onClick={rollAllInitiatives}
                disabled={combatList.length === 0}
                className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 border border-purple-400/40 text-purple-200 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer whitespace-nowrap"
                title="Rolar 1d20 + modificador para todos os combatentes"
              >
                <Dices className="w-3.5 h-3.5" />
                <span>Rolar Iniciativa</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {!scene.combat.active ? (
                <button
                  type="button"
                  onClick={startCombat}
                  disabled={combatList.length === 0}
                  className="flex-1 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Iniciar Combate</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={prevTurn}
                    title="Turno anterior"
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={nextTurn}
                    className="flex-1 py-2 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                  >
                    <span>Próximo Turno</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={endCombat}
                    title="Encerrar combate e zerar rodadas"
                    className="p-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Ordered Combatant Rows */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {combatList.length === 0 ? (
              <div className="text-center py-10 px-4 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Nenhum combatente na cena</p>
                <p>Adicione tokens ou importe fichas/encontros para rastrear a iniciativa.</p>
              </div>
            ) : (
              combatList.map((token) => {
                const isActive = scene.combat.active && scene.combat.activeTokenId === token.id;
                const isSelected = selectedTokenId === token.id;
                const isDowned = token.hpCurrent <= 0;
                const isBloodied =
                  !isDowned &&
                  token.hpCurrent <= (token.bloodiedThreshold ?? Math.floor(token.hpMax / 2));

                return (
                  <div
                    key={token.id}
                    onClick={() => {
                      selectToken(token.id);
                      requestCameraFocus(token.x, token.y);
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer space-y-2 ${
                      isActive
                        ? 'bg-cyan-500/12 border-cyan-400/60'
                        : isSelected
                        ? 'bg-white/[0.06] border-white/25'
                        : 'bg-white/[0.02] border-white/8 hover:bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Editable Initiative Value */}
                      <div
                        className="shrink-0 flex flex-col items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          value={token.initiativeValue ?? ''}
                          placeholder="—"
                          onChange={(e) => {
                            const val = e.target.value;
                            setTokenInitiative(token.id, val === '' ? null : Number(val));
                          }}
                          aria-label={`Iniciativa de ${token.name}`}
                          className="w-11 py-1 text-center rounded-lg bg-black/50 border border-white/15 font-mono text-xs font-bold tabular-nums text-white focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          type="button"
                          onClick={() => rollTokenInitiative(token.id)}
                          className="text-[9px] text-slate-400 hover:text-cyan-300 font-mono mt-0.5 cursor-pointer"
                          title="Rolar 1d20 + modificador"
                        >
                          {token.initiativeMod >= 0
                            ? `+${token.initiativeMod}`
                            : token.initiativeMod}
                        </button>
                      </div>

                      {/* Avatar + Name + Meta */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30"
                            style={{ backgroundColor: token.color }}
                          />
                          <span className="text-xs font-bold text-white truncate">
                            {token.name}
                          </span>
                          {isActive && (
                            <span className="text-[9px] font-mono font-black text-cyan-300 shrink-0">
                              ATIVO
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                          <span>CA {token.ac}</span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              isDowned
                                ? 'text-rose-400 font-bold'
                                : isBloodied
                                ? 'text-amber-300 font-bold'
                                : 'text-slate-200'
                            }
                          >
                            PV {token.hpCurrent}/{token.hpMax}
                            {token.hpTemp > 0 ? ` (+${token.hpTemp})` : ''}
                          </span>
                          {isDowned && <span className="text-rose-400">· CAÍDO</span>}
                          {isBloodied && <span className="text-amber-300">· SANGRANDO</span>}
                        </div>
                      </div>

                      {/* Focus & Inspect */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          selectToken(token.id, true);
                          requestCameraFocus(token.x, token.y);
                        }}
                        title="Abrir no Inspetor"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer shrink-0"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quick HP Adjust Strip */}
                    <div
                      className="flex items-center justify-between gap-1 pt-1 border-t border-white/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        {[-5, -1, 1, 5].map((delta) => (
                          <button
                            key={delta}
                            type="button"
                            onClick={() => adjustTokenHp(token.id, delta)}
                            className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold tabular-nums border transition cursor-pointer ${
                              delta < 0
                                ? 'bg-rose-500/12 border-rose-500/30 text-rose-300 hover:bg-rose-500/25'
                                : 'bg-emerald-500/12 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                            }`}
                          >
                            {delta > 0 ? `+${delta}` : delta}
                          </button>
                        ))}
                      </div>

                      {token.conditions.length > 0 && (
                        <span className="text-[10px] text-amber-300 truncate max-w-[115px]">
                          {token.conditions.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TOKEN INSPECTOR */}
      {sidebarTab === 'inspector' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {!selectedToken ? (
            <div className="text-center py-12 px-4 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Nenhum token selecionado</p>
              <p>Clique em qualquer token no tabuleiro para editar PV, CA, foto, tamanho e condições.</p>
            </div>
          ) : (
            <>
              {/* Identity + Photo Upload */}
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    title="Alterar foto do token"
                    className="w-14 h-14 rounded-full overflow-hidden border-2 flex items-center justify-center bg-slate-900 hover:brightness-110 transition cursor-pointer"
                    style={{ borderColor: selectedToken.color }}
                  >
                    {selectedToken.avatarUrl ? (
                      <img
                        src={selectedToken.avatarUrl}
                        alt={selectedToken.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                  {selectedToken.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => updateToken(selectedToken.id, { avatarUrl: undefined })}
                      title="Remover foto"
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-950 border border-white/20 text-slate-300 hover:text-rose-300 flex items-center justify-center cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    type="text"
                    value={selectedToken.name}
                    onChange={(e) => updateToken(selectedToken.id, { name: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-sm font-bold text-white focus:outline-none focus:border-cyan-400"
                  />
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    {selectedToken.sourceRole && <span>{selectedToken.sourceRole}</span>}
                    {selectedToken.sourceCr && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-rose-300">{selectedToken.sourceCr}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Utilities Row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => updateToken(selectedToken.id, { locked: !selectedToken.locked })}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                    selectedToken.locked
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {selectedToken.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                  <span>{selectedToken.locked ? 'Travado' : 'Livre'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateToken(selectedToken.id, { hidden: !selectedToken.hidden })}
                  className={`px-2 py-1 rounded-lg border text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                    selectedToken.hidden
                      ? 'bg-purple-500/20 border-purple-400/40 text-purple-200'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {selectedToken.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{selectedToken.hidden ? 'Oculto' : 'Visível'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => duplicateToken(selectedToken.id)}
                  className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Duplicar</span>
                </button>

                <button
                  type="button"
                  onClick={() => deleteToken(selectedToken.id)}
                  className="ml-auto px-2 py-1 rounded-lg bg-rose-500/12 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Excluir</span>
                </button>
              </div>

              {/* Character Sheet Sync Banner */}
              {selectedToken.sourceNoteId && (
                <button
                  type="button"
                  onClick={handleSyncToSheet}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/35 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {syncedFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>PV e condições salvos na Ficha!</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sincronizar PV/Condições com Ficha</span>
                    </>
                  )}
                </button>
              )}

              {/* HP & Damage/Heal Block */}
              <div className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-400" />
                    Pontos de Vida
                  </span>
                  <span className="font-mono tabular-nums text-slate-300">
                    {selectedToken.hpCurrent} / {selectedToken.hpMax}
                    {selectedToken.hpTemp > 0 ? ` (+${selectedToken.hpTemp})` : ''}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Atual</label>
                    <input
                      type="number"
                      min={0}
                      value={selectedToken.hpCurrent}
                      onChange={(e) =>
                        updateToken(selectedToken.id, { hpCurrent: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 font-mono text-xs font-bold tabular-nums text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Máximo</label>
                    <input
                      type="number"
                      min={1}
                      value={selectedToken.hpMax}
                      onChange={(e) =>
                        updateToken(selectedToken.id, { hpMax: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 font-mono text-xs font-bold tabular-nums text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Temp.</label>
                    <input
                      type="number"
                      min={0}
                      value={selectedToken.hpTemp}
                      onChange={(e) =>
                        updateToken(selectedToken.id, { hpTemp: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 font-mono text-xs font-bold tabular-nums text-cyan-300 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Exact Damage / Heal Applicator */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={hpInput}
                    onChange={(e) => setHpInput(e.target.value)}
                    className="w-16 px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 font-mono text-xs font-bold tabular-nums text-white text-center focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => adjustTokenHp(selectedToken.id, -(Math.abs(Number(hpInput)) || 0))}
                    className="flex-1 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold cursor-pointer"
                  >
                    Dano
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustTokenHp(selectedToken.id, Math.abs(Number(hpInput)) || 0)}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-200 text-xs font-bold cursor-pointer"
                  >
                    Curar
                  </button>
                </div>
              </div>

              {/* Core Combat Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">CA</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={selectedToken.ac}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') return;
                      const parsed = parseInt(raw, 10);
                      if (!Number.isNaN(parsed)) {
                        updateToken(selectedToken.id, { ac: Math.max(0, Math.min(40, parsed)) });
                      }
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/15 font-mono text-xs font-bold tabular-nums text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Inic. Mod</label>
                  <input
                    type="number"
                    value={selectedToken.initiativeMod}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '' || raw === '-') return;
                      const parsed = parseInt(raw, 10);
                      if (!Number.isNaN(parsed)) {
                        updateToken(selectedToken.id, { initiativeMod: parsed });
                      }
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/15 font-mono text-xs font-bold tabular-nums text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Desloc.</label>
                  <input
                    type="text"
                    value={selectedToken.speed}
                    onChange={(e) => updateToken(selectedToken.id, { speed: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/15 font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Faction, Size & Border Color */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Facção</label>
                  <select
                    value={selectedToken.faction}
                    onChange={(e) => {
                      const faction = e.target.value as VttTokenFaction;
                      updateToken(selectedToken.id, {
                        faction,
                        color: VTT_FACTION_META[faction].color,
                      });
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {(Object.keys(VTT_FACTION_META) as VttTokenFaction[]).map((f) => (
                      <option key={f} value={f} className="bg-slate-900">
                        {VTT_FACTION_META[f].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Tamanho</label>
                  <select
                    value={selectedToken.sizeCells}
                    onChange={(e) =>
                      updateToken(selectedToken.id, {
                        sizeCells: Number(e.target.value) as VttTokenSize,
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    {([1, 2, 3, 4] as VttTokenSize[]).map((sz) => (
                      <option key={sz} value={sz} className="bg-slate-900">
                        {VTT_SIZE_LABELS[sz]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 block">Cor da Borda</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => updateToken(selectedToken.id, { color: c })}
                      className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                        selectedToken.color === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>
              </div>

              {/* Conditions Multi-Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Condições</span>
                  {selectedToken.conditions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => updateToken(selectedToken.id, { conditions: [] })}
                      className="text-[10px] text-slate-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Limpar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {VTT_CONDITIONS.map((cond) => {
                    const active = selectedToken.conditions.includes(cond.id);
                    return (
                      <button
                        key={cond.id}
                        type="button"
                        onClick={() => toggleTokenCondition(selectedToken.id, cond.id)}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border text-left transition cursor-pointer truncate ${
                          active
                            ? 'bg-white/10 text-white'
                            : 'bg-black/30 border-white/10 text-slate-400 hover:text-slate-200'
                        }`}
                        style={{
                          borderColor: active ? cond.color : undefined,
                          color: active ? cond.color : undefined,
                        }}
                      >
                        {cond.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Attacks (available on any token, imported or manual) */}
              {selectedToken.faction !== 'object' && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <Sword className="w-3.5 h-3.5 text-cyan-400" />
                      Ataques Rápidos
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingAttack((v) => !v)}
                      className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>{isAddingAttack ? 'Cancelar' : 'Adicionar'}</span>
                    </button>
                  </div>

                  {isAddingAttack && (
                    <form
                      onSubmit={handleAddCustomAttack}
                      className="p-2.5 rounded-xl bg-black/45 border border-cyan-400/30 space-y-2"
                    >
                      <input
                        type="text"
                        value={newAtkName}
                        onChange={(e) => setNewAtkName(e.target.value)}
                        placeholder="Nome (ex.: Espada Longa)"
                        className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-white focus:outline-none focus:border-cyan-400"
                        autoFocus
                      />
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="number"
                          value={newAtkBonus}
                          onChange={(e) => setNewAtkBonus(e.target.value)}
                          placeholder="Acerto (+4)"
                          className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
                        />
                        <input
                          type="text"
                          value={newAtkDamage}
                          onChange={(e) => setNewAtkDamage(e.target.value)}
                          placeholder="Dano (1d8+2)"
                          className="w-full px-2 py-1.5 rounded-lg bg-black/60 border border-white/15 font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!newAtkName.trim()}
                        className="w-full py-1.5 rounded-lg bg-cyan-500/25 hover:bg-cyan-500/35 disabled:opacity-40 border border-cyan-400/40 text-cyan-100 text-[11px] font-bold cursor-pointer"
                      >
                        Salvar Ataque
                      </button>
                    </form>
                  )}

                  {selectedToken.attacks && selectedToken.attacks.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedToken.attacks.map((atk) => (
                        <div
                          key={atk.id}
                          className="group flex items-center gap-1"
                        >
                          <button
                            type="button"
                            onClick={() => handleQuickAttack(selectedToken, atk)}
                            className="flex-1 min-w-0 p-2 rounded-lg bg-black/40 hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-400/40 text-left transition cursor-pointer flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{atk.name}</p>
                              <p className="text-[10px] font-mono text-slate-400 truncate">
                                {atk.bonus >= 0 ? `+${atk.bonus}` : atk.bonus} acerto · {atk.damage}
                                {atk.damageType ? ` ${atk.damageType}` : ''}
                              </p>
                            </div>
                            <Dices className="w-4 h-4 text-cyan-300 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttack(atk.id)}
                            title="Remover ataque"
                            aria-label={`Remover ataque ${atk.name}`}
                            className="p-2 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/15 transition cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {attackLog && (
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-mono tabular-nums space-y-1 ${
                        attackLog.isCrit
                          ? 'bg-amber-950/50 border-amber-400/60 text-amber-200'
                          : attackLog.isFumble
                          ? 'bg-rose-950/50 border-rose-500/60 text-rose-200'
                          : 'bg-slate-900 border-cyan-500/35 text-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="truncate">
                          {attackLog.tokenName} · {attackLog.attackName}
                          {attackLog.isCrit ? ' · CRÍTICO!' : attackLog.isFumble ? ' · FALHA CRÍTICA' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setAttackLog(null)}
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          Acerto: <strong className="text-cyan-300">{attackLog.attackTotal}</strong>{' '}
                          <span className="text-[10px] opacity-75">
                            (d20={attackLog.d20}{attackLog.bonus >= 0 ? `+${attackLog.bonus}` : attackLog.bonus})
                          </span>
                        </span>
                        <span>
                          Dano: <strong className="text-rose-300">{attackLog.damageTotal}</strong>
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate">
                        Fórmula: {attackLog.damageBreakdown}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 block">Anotações Táticas</label>
                <textarea
                  rows={2}
                  value={selectedToken.notes || ''}
                  onChange={(e) => updateToken(selectedToken.id, { notes: e.target.value })}
                  placeholder="Reações, resistências, efeito de sangrando..."
                  className="w-full px-2.5 py-2 rounded-lg bg-black/50 border border-white/15 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
};
