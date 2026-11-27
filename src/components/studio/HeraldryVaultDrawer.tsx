import React, { useState } from 'react';
import {
  Download,
  Plus,
  Shield,
  Trash2,
  Copy,
  Check,
  Upload,
  Globe,
  HardDrive,
  Settings,
  Sparkles,
  X,
  FileCode,
} from 'lucide-react';
import {
  useHeraldryStore,
  type HeraldryCategory,
  type ArmoriaSourceMode,
} from '../../store/useHeraldryStore';

interface HeraldryVaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHeraldryTool?: () => void;
}

const CATEGORIAS: { id: HeraldryCategory; label: string }[] = [
  { id: 'faccao', label: 'Facção / Guilda' },
  { id: 'personagem', label: 'Personagem / Casa' },
  { id: 'ordem', label: 'Ordem de Cavalaria' },
  { id: 'reino', label: 'Reino / Província' },
  { id: 'outro', label: 'Outro' },
];

export const HeraldryVaultDrawer: React.FC<HeraldryVaultDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    brasoes,
    selectedBrasaoId,
    armoriaSourceMode,
    customArmoriaUrl,
    setArmoriaSourceMode,
    setCustomArmoriaUrl,
    salvarBrasao,
    removerBrasao,
    setSelectedBrasaoId,
  } = useHeraldryStore();

  const [activeTab, setActiveTab] = useState<'galeria' | 'adicionar' | 'config'>('galeria');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('todos');

  // Formulário de adição
  const [novoNome, setNovoNome] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<HeraldryCategory>('faccao');
  const [novoTargetId, setNovoTargetId] = useState('');
  const [novoTags, setNovoTags] = useState('');
  const [svgInput, setSvgInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!svgInput.trim() || !novoNome.trim()) {
      setFeedbackMsg('Por favor, informe o nome e o código SVG do brasão.');
      return;
    }

    const tagsArray = novoTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    salvarBrasao({
      nome: novoNome,
      categoria: novaCategoria,
      svgData: svgInput,
      targetId: novoTargetId,
      tags: tagsArray,
    });

    setNovoNome('');
    setNovoTargetId('');
    setNovoTags('');
    setSvgInput('');
    setFeedbackMsg('Brasão salvo no cofre com sucesso!');
    setActiveTab('galeria');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.svg')) {
      alert('Por favor, envie um arquivo .svg exportado do Armoria.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setSvgInput(content);
        if (!novoNome) {
          setNovoNome(file.name.replace(/\.svg$/i, ''));
        }
      }
    };
    reader.readAsText(file);
  };

  const handleCopiarSvg = (id: string, svg: string) => {
    navigator.clipboard.writeText(svg).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleBaixarSvg = (nome: string, svg: string) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nome.toLowerCase().replace(/\s+/g, '-')}-brasao.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const brasoesFiltrados = brasoes.filter((b) =>
    filtroCategoria === 'todos' ? true : b.categoria === filtroCategoria
  );

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-[#0c0a17] border-l border-white/10 shadow-2xl flex flex-col text-slate-200">
      {/* Header do Drawer */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#120f24]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Cofre de Heráldica & Brasões
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h3>
            <p className="text-[11px] text-slate-400">Armoria & Integração com RollDeck</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navegação Interna do Drawer */}
      <div className="flex items-center border-b border-white/10 px-4 gap-2 bg-[#090714] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('galeria')}
          className={`py-2.5 px-3 border-b-2 transition ${
            activeTab === 'galeria'
              ? 'border-purple-400 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Galeria ({brasoes.length})
        </button>
        <button
          onClick={() => setActiveTab('adicionar')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1 ${
            activeTab === 'adicionar'
              ? 'border-purple-400 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Importar / Salvar
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1 ${
            activeTab === 'config'
              ? 'border-purple-400 text-purple-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Fonte Armoria
        </button>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className="m-3 p-2.5 rounded-xl bg-purple-900/40 border border-purple-500/40 text-purple-200 text-xs">
          {feedbackMsg}
        </div>
      )}

      {/* Conteúdo das Abas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'galeria' && (
          <div className="space-y-4">
            {/* Filtro de Categoria */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin text-xs">
              <button
                onClick={() => setFiltroCategoria('todos')}
                className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                  filtroCategoria === 'todos'
                    ? 'bg-purple-600 text-white font-bold'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                Todos ({brasoes.length})
              </button>
              {CATEGORIAS.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFiltroCategoria(cat.id)}
                  className={`px-2.5 py-1 rounded-lg transition whitespace-nowrap ${
                    filtroCategoria === cat.id
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Grid de Brasões */}
            {brasoesFiltrados.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <Shield className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">Nenhum brasão encontrado</p>
                <p className="text-xs text-slate-500 mt-1">
                  Crie ou gere um no Armoria e importe o SVG na aba &quot;Importar / Salvar&quot;.
                </p>
                <button
                  onClick={() => setActiveTab('adicionar')}
                  className="mt-4 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition"
                >
                  Importar Primeiro Brasão
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {brasoesFiltrados.map((b) => {
                  const isSelected = selectedBrasaoId === b.id;
                  const isCopied = copiedId === b.id;

                  return (
                    <div
                      key={b.id}
                      onClick={() => setSelectedBrasaoId(b.id)}
                      className={`p-3 rounded-2xl border transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-purple-950/30 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                          : 'bg-[#131022] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div>
                        {/* Preview do Escudo */}
                        <div
                          className="w-full h-36 rounded-xl bg-black/50 border border-white/5 flex items-center justify-center p-2 overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: b.svgData }}
                        />
                        <div className="mt-2.5">
                          <h4 className="text-xs font-bold text-white truncate" title={b.nome}>
                            {b.nome}
                          </h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-purple-300 font-mono">
                            {CATEGORIAS.find((c) => c.id === b.categoria)?.label || b.categoria}
                          </span>
                        </div>
                      </div>

                      {/* Ações Rápidas */}
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-xs text-slate-400">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopiarSvg(b.id, b.svgData);
                          }}
                          title="Copiar SVG"
                          className="p-1 hover:text-white transition"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBaixarSvg(b.nome, b.svgData);
                          }}
                          title="Baixar arquivo SVG"
                          className="p-1 hover:text-cyan-400 transition"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remover brasão "${b.nome}" do cofre?`)) {
                              removerBrasao(b.id);
                            }
                          }}
                          title="Excluir do cofre"
                          className="p-1 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'adicionar' && (
          <form onSubmit={handleSalvar} className="space-y-4">
            <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs text-purple-200 leading-relaxed">
              <strong>Como obter no Armoria:</strong> No editor do Armoria, selecione seu escudo,
              vá no menu de exportação, selecione <strong>SVG</strong> e baixe o arquivo ou copie o
              código-fonte vetorial para colar abaixo.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome do Brasão / Casa / Facção
              </label>
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Clã Presa de Prata, Casa Lancaster..."
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Categoria</label>
                <select
                  value={novaCategoria}
                  onChange={(e) => setNovaCategoria(e.target.value as HeraldryCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#0c0a17]">
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ID de Vínculo (Opcional)
                </label>
                <input
                  type="text"
                  value={novoTargetId}
                  onChange={(e) => setNovoTargetId(e.target.value)}
                  placeholder="Ex: nome da facção ou ID"
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Tags (separadas por vírgula)
              </label>
              <input
                type="text"
                value={novoTags}
                onChange={(e) => setNovoTags(e.target.value)}
                placeholder="nobreza, leão, ouro, rebeldes"
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Upload ou Colar Código */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-purple-400" />
                  Código SVG do Brasão
                </label>
                <label className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer">
                  <Upload className="w-3 h-3" />
                  Carregar arquivo .svg
                  <input
                    type="file"
                    accept=".svg"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                value={svgInput}
                onChange={(e) => setSvgInput(e.target.value)}
                placeholder="<svg ...> ... </svg>"
                rows={5}
                className="w-full p-2.5 rounded-xl bg-black/60 border border-white/10 font-mono text-[10px] text-slate-300 focus:outline-none focus:border-purple-500"
                required
              />
            </div>

            {/* Preview Instantâneo */}
            {svgInput.trim() && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Pré-visualização do Escudo:
                </label>
                <div
                  className="w-full h-32 rounded-xl bg-black/40 border border-white/10 p-2 flex items-center justify-center overflow-hidden"
                  dangerouslySetInnerHTML={{ __html: svgInput }}
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              Salvar Brasão no RollDeck
            </button>
          </form>
        )}

        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
              <h4 className="font-bold text-white mb-1">Origem de Execução do Armoria</h4>
              <p className="text-[11px] text-slate-400">
                O Armoria pode ser carregado diretamente pela versão oficial na web (Vercel) ou por
                um container Docker local na porta 8081.
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'cloud' as ArmoriaSourceMode,
                  title: '🌐 Nuvem Oficial (Vercel)',
                  desc: 'armoria.vercel.app — Pronto para uso imediato sem Docker.',
                },
                {
                  id: 'docker' as ArmoriaSourceMode,
                  title: '💻 Container Docker Local',
                  desc: 'localhost:8081 — Roda 100% offline via docker-compose do bundle.',
                },
                {
                  id: 'custom' as ArmoriaSourceMode,
                  title: '⚙️ URL Personalizada',
                  desc: 'Conecte a outra porta ou servidor da sua rede local.',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    armoriaSourceMode === opt.id
                      ? 'bg-purple-950/30 border-purple-500/60'
                      : 'bg-black/30 border-white/5 hover:border-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="armoriaSource"
                    value={opt.id}
                    checked={armoriaSourceMode === opt.id}
                    onChange={() => setArmoriaSourceMode(opt.id)}
                    className="mt-1 text-purple-600 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">{opt.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {armoriaSourceMode === 'custom' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  URL Customizada do Armoria
                </label>
                <input
                  type="url"
                  value={customArmoriaUrl}
                  onChange={(e) => setCustomArmoriaUrl(e.target.value)}
                  placeholder="http://192.168.1.50:8081"
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
