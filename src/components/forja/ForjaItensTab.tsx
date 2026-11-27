import React from 'react';
import { Check, Copy, Dices, RefreshCw, Sparkles, Sword } from 'lucide-react';
import type { CategoriaItem, ItemGerado, RaridadeItem } from '../../lib/forja/itemGenerator';

interface ForjaItensTabProps {
  modoItem: 'lote' | 'individual';
  setModoItem: (modo: 'lote' | 'individual') => void;
  seedItens: number;
  setSeedItens: (seed: number) => void;
  sortearSeedItens: () => void;
  qtdItens: number;
  setQtdItens: (qtd: number) => void;
  seedItemIndividual: number;
  setSeedItemIndividual: (seed: number) => void;
  sortearSeedItemIndividual: () => void;
  itemCategoriaFiltro: CategoriaItem | 'Qualquer';
  setItemCategoriaFiltro: (cat: CategoriaItem | 'Qualquer') => void;
  itemRaridadeFiltro: RaridadeItem | 'Qualquer';
  setItemRaridadeFiltro: (rar: RaridadeItem | 'Qualquer') => void;
  itemPermitirMaldicao: boolean;
  setItemPermitirMaldicao: (perm: boolean) => void;
  loteItensIsolado: ItemGerado[];
  itemIndividual: ItemGerado;
  copiedFormat: string | null;
  setCopiedFormat: (fmt: string | null) => void;
}

export const ForjaItensTab: React.FC<ForjaItensTabProps> = ({
  modoItem,
  setModoItem,
  seedItens,
  setSeedItens,
  sortearSeedItens,
  qtdItens,
  setQtdItens,
  seedItemIndividual,
  setSeedItemIndividual,
  sortearSeedItemIndividual,
  itemCategoriaFiltro,
  setItemCategoriaFiltro,
  itemRaridadeFiltro,
  setItemRaridadeFiltro,
  itemPermitirMaldicao,
  setItemPermitirMaldicao,
  loteItensIsolado,
  itemIndividual,
  copiedFormat,
  setCopiedFormat,
}) => {
  return (
    <section className="flex flex-col gap-4">
      {/* Seletor de Modo: Lote vs Individual */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-1 bg-black/60 p-1 rounded-lg border border-white/10">
          <button
            onClick={() => setModoItem('lote')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              modoItem === 'lote' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sword className="w-3.5 h-3.5" />
            Lote de Tesouro
          </button>
          <button
            onClick={() => setModoItem('individual')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              modoItem === 'individual' ? 'bg-cyan-500 text-black shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Item Individual
          </button>
        </div>

        {modoItem === 'lote' ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300 font-bold font-mono">Seed Lote:</span>
              <input
                type="number"
                value={seedItens}
                onChange={(e) => setSeedItens(Number(e.target.value) || 0)}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
              />
              <button
                onClick={sortearSeedItens}
                className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sortear</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 font-bold">Qtd:</span>
              {[4, 6, 8, 12].map((q) => (
                <button
                  key={q}
                  onClick={() => setQtdItens(q)}
                  className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                    qtdItens === q ? 'bg-cyan-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-cyan-300 font-bold font-mono">Seed Item:</span>
              <input
                type="number"
                value={seedItemIndividual}
                onChange={(e) => setSeedItemIndividual(Number(e.target.value) || 0)}
                className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-cyan-300 text-center"
              />
              <button
                onClick={sortearSeedItemIndividual}
                className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
              >
                <Dices className="w-3 h-3" />
                <span>Sortear Item</span>
              </button>
            </div>

            {/* Filtros de Categoria e Raridade */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Categoria:</span>
              <select
                value={itemCategoriaFiltro}
                onChange={(e) => setItemCategoriaFiltro(e.target.value as any)}
                className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="Qualquer">Qualquer</option>
                <option value="Arma">Arma</option>
                <option value="Armadura e Escudo">Armadura e Escudo</option>
                <option value="Poção ou Elixir">Poção ou Elixir</option>
                <option value="Item Maravilhoso">Item Maravilhoso</option>
                <option value="Pergaminho Arcano">Pergaminho Arcano</option>
                <option value="Gema e Joia">Gema e Joia</option>
                <option value="Tesouro de Moedas">Tesouro de Moedas</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Raridade:</span>
              <select
                value={itemRaridadeFiltro}
                onChange={(e) => setItemRaridadeFiltro(e.target.value as any)}
                className="bg-black/60 border border-white/20 rounded px-2 py-1 text-xs text-slate-200"
              >
                <option value="Qualquer">Qualquer</option>
                <option value="Comum">Comum</option>
                <option value="Incomum">Incomum</option>
                <option value="Raro">Raro</option>
                <option value="Muito Raro">Muito Raro</option>
                <option value="Lendário">Lendário</option>
              </select>
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={itemPermitirMaldicao}
                onChange={(e) => setItemPermitirMaldicao(e.target.checked)}
                className="rounded border-white/20 text-rose-500 focus:ring-0"
              />
              <span>Maldições</span>
            </label>
          </div>
        )}
      </div>

      {/* VISUALIZAÇÃO DE LOTE DE ITENS */}
      {modoItem === 'lote' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {loteItensIsolado.map((it) => (
            <div
              key={it.id}
              className="p-3.5 rounded-xl bg-[#0d0b1a] border border-white/10 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-sm text-cyan-300 font-sans">{it.nome}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {it.valorPO} PO
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mb-2">
                  {it.categoria} &bull; <span className="text-purple-300">{it.raridade}</span>
                </div>
                <p className="text-xs text-slate-200 mb-2 font-sans">{it.descricaoMecanica}</p>
                {it.propriedadeMagica && (
                  <div className="text-xs text-cyan-300 mb-1 font-sans">
                    ✨ {it.propriedadeMagica}
                  </div>
                )}
                {it.peculiaridade && (
                  <div className="text-[11px] text-slate-400 italic font-sans">
                    &bull; {it.peculiaridade}
                  </div>
                )}
                {it.isAmaldicoado && (
                  <div className="text-xs text-rose-300 font-semibold mt-1">
                    💀 {it.maldicaoTexto}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VISUALIZAÇÃO DE ITEM INDIVIDUAL DETALHADO */}
      {modoItem === 'individual' && (
        <div className="p-5 rounded-2xl bg-[#0d0b1a] border border-cyan-500/30 flex flex-col gap-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">{itemIndividual.nome}</h3>
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {itemIndividual.valorPO} PO
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {itemIndividual.categoria} &bull; <span className="text-purple-300 font-semibold">{itemIndividual.raridade}</span> &bull; Seed: {seedItemIndividual}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${itemIndividual.nome} (${itemIndividual.categoria}, ${itemIndividual.raridade}) — ${itemIndividual.valorPO} PO\n${itemIndividual.descricaoMecanica}\n${itemIndividual.propriedadeMagica ? `Propriedade Mágica: ${itemIndividual.propriedadeMagica}\n` : ''}${itemIndividual.peculiaridade ? `Peculiaridade: ${itemIndividual.peculiaridade}\n` : ''}${itemIndividual.isAmaldicoado ? `Maldição: ${itemIndividual.maldicaoTexto}` : ''}`
                );
                setCopiedFormat('item_ind');
                setTimeout(() => setCopiedFormat(null), 2000);
              }}
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              {copiedFormat === 'item_ind' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              Copiar Ficha do Item
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-2">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Mecânica de Jogo (SRD / TTRPG):
            </div>
            <p className="text-sm text-slate-100 font-medium leading-relaxed">
              {itemIndividual.descricaoMecanica}
            </p>
          </div>

          {itemIndividual.propriedadeMagica && (
            <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-xs text-cyan-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-cyan-300">
                <Sparkles className="w-3.5 h-3.5" />
                Propriedade Mágica & Efeitos
              </div>
              <p>{itemIndividual.propriedadeMagica}</p>
            </div>
          )}

          {itemIndividual.peculiaridade && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-xs text-slate-300 italic">
              <strong>Peculiaridade Histórica:</strong> {itemIndividual.peculiaridade}
            </div>
          )}

          {itemIndividual.isAmaldicoado && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 space-y-1">
              <div className="font-bold text-rose-300">💀 Maldição Antiga Ativa</div>
              <p>{itemIndividual.maldicaoTexto}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
