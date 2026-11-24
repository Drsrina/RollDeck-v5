import {
  Backpack,
  Dices,
  Footprints,
  Heart,
  Image as ImageIcon,
  Plus,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  User,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import {
  ATTRIBUTE_META,
  COMMON_CHARACTER_CONDITIONS,
  COMMON_RPG_SKILLS,
  calcAttributeModifier,
  calcProficiencyBonus,
  formatModifier,
  parseDamageFormula,
} from '../../lib/characterSheet';
import { useAppStore } from '../../store/useAppStore';
import type { CharacterAttributeKey, CharacterSheetAttack, CharacterSheetData } from '../../types';

interface CharacterSheetPanelProps {
  value: CharacterSheetData;
  characterName: string;
  onChange: (next: CharacterSheetData) => void;
  compact?: boolean;
}

type SheetSectionTab = 'combat' | 'skills' | 'gear';

export const CharacterSheetPanel: React.FC<CharacterSheetPanelProps> = ({
  value,
  characterName,
  onChange,
  compact = false,
}) => {
  const rollPackage = useAppStore((s) => s.rollPackage);
  const allDice = useAppStore((s) => s.allDice);
  const [section, setSection] = useState<SheetSectionTab>('combat');
  const [customCondition, setCustomCondition] = useState('');

  const update = (patch: Partial<CharacterSheetData>) => {
    onChange({ ...value, ...patch });
  };

  const triggerD20Roll = (label: string, modifier: number, color = '#ec4899') => {
    rollPackage({
      id: `char-roll-${Date.now()}`,
      name: `${characterName || 'Personagem'} — ${label}`,
      color,
      icon: '🎭',
      categoryId: 'skills',
      globalModifier: 0,
      isFavorite: false,
      order: 0,
      groups: [
        {
          id: `grp-${Date.now()}`,
          dieId: 'd20',
          count: 1,
          modifier,
          label,
          advantage: 'none',
        },
      ],
    });
  };

  const triggerDamageRoll = (attack: CharacterSheetAttack) => {
    const parsed = parseDamageFormula(attack.damage);
    if (!parsed) return;
    const validDie = allDice.find((d) => d.id === parsed.dieId || d.sides === parsed.sides);
    const dieId = validDie ? validDie.id : 'd6';

    rollPackage({
      id: `char-dmg-${Date.now()}`,
      name: `${characterName || 'Personagem'} — Dano (${attack.name})`,
      color: '#f43f5e',
      icon: '⚔️',
      categoryId: 'combat',
      globalModifier: 0,
      isFavorite: false,
      order: 0,
      groups: [
        {
          id: `grp-${Date.now()}`,
          dieId,
          count: parsed.count,
          modifier: parsed.modifier,
          label: attack.damage,
          advantage: 'none',
        },
      ],
    });
  };

  const handleHpDelta = (delta: number) => {
    const nextHp = Math.max(0, Math.min(value.hpMax + 999, value.hpCurrent + delta));
    update({ hpCurrent: nextHp });
  };

  const handleAttributeChange = (key: CharacterAttributeKey, raw: number) => {
    const clamped = Math.max(1, Math.min(30, Number.isFinite(raw) ? raw : 10));
    const nextAttributes = { ...value.attributes, [key]: clamped };
    const nextPatch: Partial<CharacterSheetData> = { attributes: nextAttributes };
    if (key === 'dex') {
      nextPatch.initiative = calcAttributeModifier(clamped);
    }
    update(nextPatch);
  };

  const toggleSaveProficiency = (key: CharacterAttributeKey) => {
    const set = new Set(value.savingThrowProficiencies || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    update({ savingThrowProficiencies: Array.from(set) });
  };

  const toggleSkill = (skillName: string) => {
    const set = new Set(value.skills || []);
    if (set.has(skillName)) set.delete(skillName);
    else set.add(skillName);
    update({ skills: Array.from(set) });
  };

  const toggleCondition = (cond: string) => {
    const trimmed = cond.trim();
    if (!trimmed) return;
    const set = new Set(value.conditions || []);
    if (set.has(trimmed)) set.delete(trimmed);
    else set.add(trimmed);
    update({ conditions: Array.from(set) });
  };

  const handleAddAttack = () => {
    const next: CharacterSheetAttack = {
      id: `atk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Novo Ataque',
      bonus: value.proficiencyBonus + calcAttributeModifier(value.attributes.str),
      damage: '1d6+2',
    };
    update({ attacks: [...(value.attacks || []), next] });
  };

  const handleUpdateAttack = (id: string, patch: Partial<CharacterSheetAttack>) => {
    update({
      attacks: (value.attacks || []).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  };

  const handleRemoveAttack = (id: string) => {
    update({
      attacks: (value.attacks || []).filter((a) => a.id !== id),
    });
  };

  const handleUploadAvatar = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          update({ avatarUrl: reader.result });
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const hpPct =
    value.hpMax > 0 ? Math.max(0, Math.min(100, Math.round((value.hpCurrent / value.hpMax) * 100))) : 0;
  const hpBarColor =
    hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <div className="space-y-3 rounded-2xl bg-black/35 border border-pink-500/25 p-3">
      {/* Identity Row */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={handleUploadAvatar}
          title="Definir retrato do personagem"
          className="w-12 h-12 rounded-xl bg-pink-500/15 border border-pink-400/30 flex items-center justify-center shrink-0 overflow-hidden hover:border-pink-400 transition group relative"
        >
          {value.avatarUrl ? (
            <img
              src={value.avatarUrl}
              alt={characterName}
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-5 h-5 text-pink-300 group-hover:scale-110 transition-transform" />
          )}
          <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <ImageIcon className="w-4 h-4 text-white" />
          </span>
        </button>

        <div className={`grid gap-1.5 flex-1 min-w-0 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
          <input
            type="text"
            value={value.race}
            onChange={(e) => update({ race: e.target.value })}
            placeholder="Raça / Espécie"
            aria-label="Raça do personagem"
            className="px-2 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-pink-400"
          />
          <input
            type="text"
            value={value.characterClass}
            onChange={(e) => update({ characterClass: e.target.value })}
            placeholder="Classe / Arquétipo"
            aria-label="Classe do personagem"
            className="px-2 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs focus:outline-none focus:border-pink-400"
          />
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 border border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">Nv</span>
            <input
              type="number"
              min={1}
              max={20}
              value={value.level}
              onChange={(e) => {
                const lvl = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                update({ level: lvl, proficiencyBonus: calcProficiencyBonus(lvl) });
              }}
              aria-label="Nível do personagem"
              className="w-full bg-transparent text-white text-xs font-mono font-bold focus:outline-none tabular-nums"
            />
          </div>
          <input
            type="text"
            value={value.playerName || ''}
            onChange={(e) => update({ playerName: e.target.value })}
            placeholder="Jogador (opcional)"
            aria-label="Nome do jogador"
            className="px-2 py-1.5 rounded-lg bg-black/50 border border-white/10 text-slate-200 text-xs focus:outline-none focus:border-pink-400"
          />
        </div>
      </div>

      {/* Section Sub-tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-black/45 border border-white/10">
        <button
          type="button"
          onClick={() => setSection('combat')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
            section === 'combat'
              ? 'bg-pink-500/25 text-pink-200 border border-pink-400/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Swords className="w-3.5 h-3.5 shrink-0" />
          <span>Combate & Atributos</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('skills')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
            section === 'skills'
              ? 'bg-pink-500/25 text-pink-200 border border-pink-400/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>Perícias & Magias</span>
        </button>
        <button
          type="button"
          onClick={() => setSection('gear')}
          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition ${
            section === 'gear'
              ? 'bg-pink-500/25 text-pink-200 border border-pink-400/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Backpack className="w-3.5 h-3.5 shrink-0" />
          <span>Inventário</span>
        </button>
      </div>

      {/* SECTION 1: COMBAT & ATTRIBUTES */}
      {section === 'combat' && (
        <div className="space-y-3">
          {/* HP Bar + Core Combat Stats */}
          <div className={`grid gap-2 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-12'}`}>
            {/* HP Card */}
            <div className={`${compact ? '' : 'sm:col-span-6'} p-2.5 rounded-xl bg-black/50 border border-white/10 space-y-2`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-rose-300 uppercase flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 fill-rose-500/40 text-rose-400" />
                  Pontos de Vida
                </span>
                <div className="flex items-center gap-1">
                  {[-5, -1, +1, +5].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() => handleHpDelta(delta)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                        delta < 0
                          ? 'bg-rose-500/15 hover:bg-rose-500/30 text-rose-300'
                          : 'bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300'
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${hpBarColor}`}
                  style={{ width: `${hpPct}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <label className="block">
                  <span className="text-[9px] text-slate-400 uppercase block">Atual</span>
                  <input
                    type="number"
                    value={value.hpCurrent}
                    onChange={(e) => update({ hpCurrent: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full text-center px-1 py-1 rounded bg-black/60 border border-white/10 text-white font-mono font-bold text-xs tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] text-slate-400 uppercase block">Máximo</span>
                  <input
                    type="number"
                    min={1}
                    value={value.hpMax}
                    onChange={(e) => update({ hpMax: Math.max(1, Number(e.target.value) || 1) })}
                    className="w-full text-center px-1 py-1 rounded bg-black/60 border border-white/10 text-slate-200 font-mono font-bold text-xs tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="text-[9px] text-cyan-300 uppercase block">Temp</span>
                  <input
                    type="number"
                    min={0}
                    value={value.hpTemp}
                    onChange={(e) => update({ hpTemp: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full text-center px-1 py-1 rounded bg-black/60 border border-cyan-500/20 text-cyan-200 font-mono font-bold text-xs tabular-nums"
                  />
                </label>
              </div>
            </div>

            {/* CA / Init / Speed / Prof */}
            <div className={`${compact ? '' : 'sm:col-span-6'} grid grid-cols-4 gap-1.5`}>
              <label className="p-2 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-between text-center">
                <span className="text-[9px] font-bold text-sky-300 uppercase flex items-center gap-0.5">
                  <Shield className="w-3 h-3" /> CA
                </span>
                <input
                  type="number"
                  value={value.ac}
                  onChange={(e) => update({ ac: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full text-center bg-transparent text-white font-mono font-black text-base focus:outline-none tabular-nums"
                />
              </label>

              <div className="p-2 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-between text-center">
                <button
                  type="button"
                  onClick={() => triggerD20Roll('Iniciativa', value.initiative, '#f59e0b')}
                  title="Rolar Iniciativa (1d20)"
                  className="text-[9px] font-bold text-amber-300 hover:text-amber-200 uppercase flex items-center gap-0.5 cursor-pointer"
                >
                  <Zap className="w-3 h-3" /> Inic.
                </button>
                <input
                  type="number"
                  value={value.initiative}
                  onChange={(e) => update({ initiative: Number(e.target.value) || 0 })}
                  className="w-full text-center bg-transparent text-white font-mono font-black text-base focus:outline-none tabular-nums"
                />
              </div>

              <label className="p-2 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-between text-center">
                <span className="text-[9px] font-bold text-emerald-300 uppercase flex items-center gap-0.5">
                  <Footprints className="w-3 h-3" /> Desl.
                </span>
                <input
                  type="text"
                  value={value.speed}
                  onChange={(e) => update({ speed: e.target.value })}
                  className="w-full text-center bg-transparent text-white font-mono font-bold text-xs focus:outline-none"
                />
              </label>

              <label className="p-2 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center justify-between text-center">
                <span className="text-[9px] font-bold text-purple-300 uppercase">Prof.</span>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={value.proficiencyBonus}
                  onChange={(e) => update({ proficiencyBonus: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full text-center bg-transparent text-purple-200 font-mono font-black text-base focus:outline-none tabular-nums"
                />
              </label>
            </div>
          </div>

          {/* 6 Core Attributes Grid */}
          <div className={`grid gap-1.5 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'}`}>
            {ATTRIBUTE_META.map((meta) => {
              const score = value.attributes[meta.key] ?? 10;
              const mod = calcAttributeModifier(score);
              const isSaveProf = (value.savingThrowProficiencies || []).includes(meta.key);
              const saveBonus = mod + (isSaveProf ? value.proficiencyBonus : 0);

              return (
                <div
                  key={meta.key}
                  className="p-2 rounded-xl bg-black/50 border border-white/10 flex flex-col items-center gap-1"
                >
                  <span className="text-[10px] font-black text-slate-400 tracking-wider">
                    {meta.short}
                  </span>

                  <button
                    type="button"
                    onClick={() => triggerD20Roll(`Teste de ${meta.label}`, mod, '#22d3ee')}
                    title={`Rolar Teste de ${meta.label} (1d20${formatModifier(mod)})`}
                    className="w-full py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-400/30 text-cyan-200 font-mono font-black text-sm tabular-nums flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <span>{formatModifier(mod)}</span>
                    <Dices className="w-3 h-3 opacity-70" />
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={score}
                    onChange={(e) => handleAttributeChange(meta.key, Number(e.target.value))}
                    aria-label={`Valor de ${meta.label}`}
                    className="w-12 text-center py-0.5 rounded bg-black/60 border border-white/10 text-white font-mono text-xs font-bold tabular-nums focus:outline-none focus:border-pink-400"
                  />

                  {/* Saving throw proficiency toggle + roll */}
                  <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => toggleSaveProficiency(meta.key)}
                      title={`Proficiente em Salvaguarda de ${meta.label}`}
                      className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                        isSaveProf
                          ? 'bg-pink-500/30 border-pink-400 text-pink-200'
                          : 'border-white/15 text-slate-600 hover:text-slate-300'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerD20Roll(`Salvaguarda de ${meta.label}`, saveBonus, '#c084fc')
                      }
                      title={`Rolar Salvaguarda de ${meta.label} (1d20${formatModifier(saveBonus)})`}
                      className="text-[10px] font-mono text-purple-300 hover:text-white transition cursor-pointer tabular-nums"
                    >
                      TR {formatModifier(saveBonus)}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Attacks & Quick Rolls */}
          <div className="p-2.5 rounded-xl bg-black/45 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                <Swords className="w-3.5 h-3.5 text-rose-400" />
                Ataques & Ações Rápidas
              </span>
              <button
                type="button"
                onClick={handleAddAttack}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/35 text-pink-200 border border-pink-400/30 text-[10px] font-bold transition"
              >
                <Plus className="w-3 h-3" />
                <span>Ataque</span>
              </button>
            </div>

            {(value.attacks || []).length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">Nenhum ataque cadastrado.</p>
            ) : (
              <div className="space-y-1.5">
                {value.attacks.map((atk) => {
                  const hasValidDamage = Boolean(parseDamageFormula(atk.damage));
                  return (
                    <div
                      key={atk.id}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 p-1.5 rounded-lg bg-black/50 border border-white/10"
                    >
                      <input
                        type="text"
                        value={atk.name}
                        onChange={(e) => handleUpdateAttack(atk.id, { name: e.target.value })}
                        placeholder="Arma / Magia"
                        className="flex-1 min-w-[100px] px-2 py-1 rounded bg-black/60 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:border-pink-400"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={atk.bonus}
                          onChange={(e) =>
                            handleUpdateAttack(atk.id, { bonus: Number(e.target.value) || 0 })
                          }
                          title="Bônus de acerto"
                          className="w-12 text-center px-1 py-1 rounded bg-black/60 border border-white/10 text-cyan-200 font-mono text-xs tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={() => triggerD20Roll(`Ataque: ${atk.name}`, atk.bonus, '#22d3ee')}
                          title={`Rolar acerto (1d20${formatModifier(atk.bonus)})`}
                          className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-200 border border-cyan-400/30 text-[10px] font-mono font-bold whitespace-nowrap transition cursor-pointer"
                        >
                          {formatModifier(atk.bonus)}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={atk.damage}
                          onChange={(e) => handleUpdateAttack(atk.id, { damage: e.target.value })}
                          placeholder="1d8+3"
                          title="Fórmula de dano (ex: 1d8+3 cortante)"
                          className="w-24 px-1.5 py-1 rounded bg-black/60 border border-white/10 text-rose-200 font-mono text-xs focus:outline-none focus:border-rose-400"
                        />
                        <button
                          type="button"
                          disabled={!hasValidDamage}
                          onClick={() => triggerDamageRoll(atk)}
                          title={hasValidDamage ? `Rolar dano (${atk.damage})` : 'Informe dados (ex: 1d8+3)'}
                          className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/35 disabled:opacity-30 text-rose-200 border border-rose-400/30 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
                        >
                          <Dices className="w-3 h-3" />
                          <span>Dano</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttack(atk.id)}
                        title="Remover ataque"
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Conditions */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase block">
              Condições & Estados
            </span>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set([...COMMON_CHARACTER_CONDITIONS, ...(value.conditions || [])])).map(
                (cond) => {
                  const active = (value.conditions || []).includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleCondition(cond)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition cursor-pointer ${
                        active
                          ? 'bg-amber-500/25 border-amber-400/60 text-amber-200'
                          : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cond}
                    </button>
                  );
                }
              )}
            </div>
            <div className="flex gap-1.5 pt-0.5">
              <input
                type="text"
                value={customCondition}
                onChange={(e) => setCustomCondition(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customCondition.trim()) {
                    e.preventDefault();
                    toggleCondition(customCondition);
                    setCustomCondition('');
                  }
                }}
                placeholder="Adicionar condição customizada..."
                className="flex-1 px-2 py-1 rounded-lg bg-black/50 border border-white/10 text-white text-[11px] focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (!customCondition.trim()) return;
                  toggleCondition(customCondition);
                  setCustomCondition('');
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-[11px] font-semibold"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: SKILLS & FEATURES */}
      {section === 'skills' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {COMMON_RPG_SKILLS.map((sk) => {
              const trained = (value.skills || []).includes(sk.name);
              const mod = calcAttributeModifier(value.attributes[sk.attr] ?? 10);
              const total = mod + (trained ? value.proficiencyBonus : 0);

              return (
                <div
                  key={sk.name}
                  className={`flex items-center justify-between gap-1 px-2 py-1 rounded-lg border transition ${
                    trained
                      ? 'bg-pink-500/15 border-pink-400/40 text-white'
                      : 'bg-black/40 border-white/10 text-slate-400'
                  }`}
                >
                  <label className="flex items-center gap-1.5 min-w-0 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={trained}
                      onChange={() => toggleSkill(sk.name)}
                      className="accent-pink-500 w-3 h-3 shrink-0"
                    />
                    <span className="text-[11px] truncate">{sk.name}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => triggerD20Roll(`Perícia: ${sk.name}`, total, '#ec4899')}
                    title={`Rolar ${sk.name} (1d20${formatModifier(total)})`}
                    className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-pink-500/30 text-[10px] font-mono font-bold text-pink-200 shrink-0 tabular-nums cursor-pointer"
                  >
                    {formatModifier(total)}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Alinhamento
              </span>
              <input
                type="text"
                value={value.alignment || ''}
                onChange={(e) => update({ alignment: e.target.value })}
                placeholder="Ex: Caótico e Bom"
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                Antecedente
              </span>
              <input
                type="text"
                value={value.background || ''}
                onChange={(e) => update({ background: e.target.value })}
                placeholder="Ex: Nobre, Criminoso..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-white text-xs"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Habilidades de Classe, Talentos & Magias
            </span>
            <textarea
              value={value.spellsAndFeatures || ''}
              onChange={(e) => update({ spellsAndFeatures: e.target.value })}
              rows={compact ? 4 : 5}
              placeholder="Liste talentos, magias preparadas, espaços de magia..."
              className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-pink-400 resize-none leading-relaxed"
            />
          </label>
        </div>
      )}

      {/* SECTION 3: INVENTORY */}
      {section === 'gear' && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
              Equipamentos, Moedas & Itens Carregados
            </span>
            <textarea
              value={value.inventory || ''}
              onChange={(e) => update({ inventory: e.target.value })}
              rows={compact ? 6 : 8}
              placeholder="- Armadura, armas, poções, tesouros, moedas..."
              className="w-full px-2.5 py-2 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-pink-400 resize-none leading-relaxed"
            />
          </label>
        </div>
      )}
    </div>
  );
};
