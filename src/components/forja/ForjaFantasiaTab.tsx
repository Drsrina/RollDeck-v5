import React from 'react';
import { Check, Copy, Dices } from 'lucide-react';
import type { ItemGeradoFantasia, SubcategoriaFantasia } from '../../lib/forja/fantasyGenerator';

interface ForjaFantasiaTabProps {
  seedFantasia: number;
  setSeedFantasia: (seed: number) => void;
  sortearSeedFantasia: () => void;
  subcategoriaFantasia: SubcategoriaFantasia;
  setSubcategoriaFantasia: (cat: SubcategoriaFantasia) => void;
  qtdElementosFantasia: number;
  setQtdElementosFantasia: (qtd: number) => void;
  loteElementosFantasia: { itens: ItemGeradoFantasia[] };
  copiedFormat: string | null;
  setCopiedFormat: (fmt: string | null) => void;
}

export const ForjaFantasiaTab: React.FC<ForjaFantasiaTabProps> = ({
  seedFantasia,
  setSeedFantasia,
  sortearSeedFantasia,
  subcategoriaFantasia,
  setSubcategoriaFantasia,
  qtdElementosFantasia,
  setQtdElementosFantasia,
  loteElementosFantasia,
  copiedFormat,
  setCopiedFormat,
}) => {
  return (
    <section className="flex flex-col gap-4">
      {/* Barra de Seleção com Dropdownlist Hierárquico */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0b1a] p-3 rounded-xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-300 font-bold font-mono">Seed Fantasia:</span>
          <input
            type="number"
            value={seedFantasia}
            onChange={(e) => setSeedFantasia(Number(e.target.value) || 0)}
            className="w-24 bg-black/60 border border-white/20 rounded px-2 py-1 text-xs font-mono text-purple-300 text-center focus:outline-none focus:border-purple-400"
          />
          <button
            onClick={sortearSeedFantasia}
            className="px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold border border-purple-500/30 flex items-center gap-1 cursor-pointer"
          >
            <Dices className="w-3 h-3" />
            <span>Sortear</span>
          </button>
        </div>

        {/* Dropdownlist Completo de 17 Subcategorias */}
        <div className="flex items-center gap-2 flex-grow max-w-md">
          <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Tabela / Tipo:</span>
          <select
            value={subcategoriaFantasia}
            onChange={(e) => setSubcategoriaFantasia(e.target.value as SubcategoriaFantasia)}
            className="w-full bg-black/70 border border-purple-500/40 rounded-lg px-3 py-1.5 text-xs text-purple-200 font-semibold focus:outline-none focus:border-purple-400"
          >
            <optgroup label="Adventure Elements (Elementos de Aventura)">
              <option value="quests">Quests: Missões / Tarefas</option>
              <option value="rumors">Rumors: Boatos / Rumores</option>
              <option value="locations">Random Locations: Locais Aleatórios</option>
              <option value="encounters">Random Encounters: Encontros Aleatórios</option>
            </optgroup>
            <optgroup label="Characters (Personagens)">
              <option value="npcs">NPCs: Personagens Não Jogáveis</option>
            </optgroup>
            <optgroup label="Items (Itens)">
              <option value="art_objects">Art Objects: Objetos de Arte</option>
              <option value="legendary_weapons">Legendary Weapons: Armas Lendárias</option>
              <option value="ancient_tomes">Ancient Tomes: Tomos Antigos</option>
            </optgroup>
            <optgroup label="Loot (Saque / Espólio)">
              <option value="pickpocket">Pickpocket Loot: Batedor de Carteiras (Furtar)</option>
              <option value="giants_bag">Giant’s Bag: Bolsa de Gigante</option>
            </optgroup>
            <optgroup label="Setting (Cenário / Ambientação)">
              <option value="castles">Castles: Castelos</option>
              <option value="towns_cities">Towns and Cities: Vilas e Cidades</option>
              <option value="traction_cities">Traction Cities: Cidades Tracionadas (Móveis)</option>
              <option value="ships">Ships: Navios / Embarcações</option>
              <option value="worlds_planes">Worlds and Planes: Mundos e Planos</option>
            </optgroup>
            <optgroup label="Embellishment (Adornos / Detalhes Visuais)">
              <option value="coats_of_arms">Coats of Arms: Brasões de Armas</option>
              <option value="dungeon_graffiti">Dungeon Graffiti: Grafites de Masmorra</option>
              <option value="omens_portents">Omens and Portents: Presságios e Augúrios</option>
              <option value="prophecies">Prophecies: Profecias</option>
              <option value="secret_doors">Secret Doors: Portas Secretas</option>
            </optgroup>
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-bold">Qtd:</span>
          {[2, 4, 6, 10].map((q) => (
            <button
              key={q}
              onClick={() => setQtdElementosFantasia(q)}
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                qtdElementosFantasia === q ? 'bg-purple-500 text-black' : 'bg-black/40 text-slate-400 hover:text-white'
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Resultados Gerados */}
      <div className="flex flex-col gap-3">
        {loteElementosFantasia.itens.map((item, idx) => (
          <div
            key={item.id}
            className="p-4 rounded-xl bg-[#0d0b1a] border border-white/10 hover:border-purple-500/30 transition-all flex flex-col gap-2.5 shadow-md"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[11px] font-bold">
                  #{idx + 1}
                </span>
                <h4 className="text-sm font-bold text-white tracking-wide">
                  {item.titulo}
                </h4>
              </div>
              <button
                onClick={() => {
                  const textLines = [
                    item.titulo,
                    item.conteudoPrincipal,
                    ...Object.entries(item.detalhes).map(([k, v]) => `${k}: ${v}`),
                  ].join('\n');
                  navigator.clipboard.writeText(textLines);
                  setCopiedFormat(`elem_${item.id}`);
                  setTimeout(() => setCopiedFormat(null), 2000);
                }}
                className="self-end sm:self-auto px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                {copiedFormat === `elem_${item.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                Copiar
              </button>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              {item.conteudoPrincipal}
            </p>

            {Object.keys(item.detalhes).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {Object.entries(item.detalhes).map(([chave, valor]) => (
                  <div
                    key={chave}
                    className="p-2 rounded-lg bg-black/40 border border-white/5 flex flex-col gap-0.5"
                  >
                    <span className="text-[10px] font-bold text-purple-300 font-mono uppercase tracking-wider">
                      {chave}
                    </span>
                    <span className="text-slate-300 font-sans">{valor}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
