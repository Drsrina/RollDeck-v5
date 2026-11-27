import React, { useState } from 'react';
import {
  Compass,
  Download,
  ExternalLink,
  FileCode,
  FileImage,
  Globe,
  HardDrive,
  Layers,
  Map as MapIcon,
  Network,
  Plus,
  Settings,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useMapStore } from '../../store/useMapStore';
import { exportVaultToConsolidatedMarkdown } from '../../lib/obsidianExporter';
import {
  useWorldMapStore,
  type FMGSourceMode,
  type WorldMapSnapshot,
} from '../../store/useWorldMapStore';

interface WorldMapVaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenWorldTool?: () => void;
}

export const WorldMapVaultDrawer: React.FC<WorldMapVaultDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const importFmgWorldToCanvas = useMapStore((s) => s.importFmgWorldToCanvas);

  const {
    fmgSourceMode,
    customFMGUrl,
    mapas,
    selectedMapId,
    setFMGSourceMode,
    setCustomFMGUrl,
    salvarMapa,
    removerMapa,
    setSelectedMapId,
    enviarMapaParaVtt,
    enviarMapaParaCanvas,
  } = useWorldMapStore();

  const [activeTab, setActiveTabInternal] = useState<
    'galeria' | 'adicionar' | 'pipeline' | 'config'
  >('galeria');
  const [novoNome, setNovoNome] = useState('');
  const [novoTipo, setNovoTipo] = useState<'continente' | 'regional' | 'tatico'>('continente');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Estados da Pipeline FMG -> Wiki-links
  const [fmgJsonFile, setFmgJsonFile] = useState<any | null>(null);
  const [fmgFileName, setFmgFileName] = useState('');
  const [isImportingPipeline, setIsImportingPipeline] = useState(false);
  const [pipelineSummary, setPipelineSummary] = useState<{
    states: number;
    burgs: number;
    cultures: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageDataUrl.trim() || !novoNome.trim()) {
      setFeedbackMsg('Por favor, informe um nome e carregue uma imagem.');
      return;
    }

    salvarMapa({
      nome: novoNome,
      imageDataUrl,
      tipo: novoTipo,
    });

    setNovoNome('');
    setImageDataUrl('');
    setFeedbackMsg('Mapa salvo no cofre com sucesso!');
    setActiveTabInternal('galeria');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setImageDataUrl(result);
        if (!novoNome) {
          setNovoNome(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        setFmgJsonFile(parsed);
        setFmgFileName(file.name);

        const statesCount = Array.isArray(parsed.states)
          ? parsed.states.filter((s: any) => s && s.name && s.name !== 'Neutrals').length
          : 0;
        const burgsCount = Array.isArray(parsed.burgs)
          ? parsed.burgs.filter((b: any) => b && b.name).length
          : 0;
        const culturesCount = Array.isArray(parsed.cultures)
          ? parsed.cultures.filter((c: any) => c && c.name && c.name !== 'Wild').length
          : 0;

        setPipelineSummary({
          states: statesCount,
          burgs: burgsCount,
          cultures: culturesCount,
        });
      } catch {
        alert('O arquivo selecionado não é um JSON válido do FMG.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecutarPipeline = async () => {
    if (!fmgJsonFile) return;

    setIsImportingPipeline(true);
    try {
      const res = await importFmgWorldToCanvas(fmgJsonFile, {
        scaleFactor: 1.5,
        maxBurgs: 50,
      });

      setFeedbackMsg(
        `Sucesso! ${res.notes.length} notas criadas e ${res.links.length} wiki-links conectados no Canvas!`
      );
      setTimeout(() => {
        onClose();
        setActiveTab('map');
      }, 1200);
    } catch (err: any) {
      alert(`Falha na conversão: ${err?.message || 'Erro desconhecido'}`);
    } finally {
      setIsImportingPipeline(false);
    }
  };

  const handleExportarObsidian = () => {
    const notes = useMapStore.getState().notes;
    if (notes.length === 0) {
      alert('Nenhuma nota encontrada no canvas para exportar.');
      return;
    }
    const md = exportVaultToConsolidatedMarkdown(notes, 'RollDeck Campaign Vault');
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roll-deck-vault-${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setFeedbackMsg('Vault exportado com sucesso!');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleEnviarVtt = (mapa: WorldMapSnapshot) => {
    const sceneId = enviarMapaParaVtt(mapa.id);
    if (sceneId) {
      setFeedbackMsg(`Cena criada no VTT com o mapa "${mapa.nome}"!`);
      setTimeout(() => {
        onClose();
        setActiveTab('vtt');
      }, 700);
    }
  };

  const handleEnviarCanvas = async (mapa: WorldMapSnapshot) => {
    const ok = await enviarMapaParaCanvas(mapa.id);
    if (ok) {
      setFeedbackMsg(`Mapa "${mapa.nome}" inserido no Canvas Mental!`);
      setTimeout(() => {
        onClose();
        setActiveTab('map');
      }, 700);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] bg-[#090b16] border-l border-white/10 shadow-2xl flex flex-col text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0e1224]">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Cofre de Mapas Continentais
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h3>
            <p className="text-[11px] text-slate-400">Azgaar FMG ➔ VTT & Canvas RollDeck</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-white/10 px-4 gap-2 bg-[#060810] text-xs font-semibold overflow-x-auto scrollbar-thin">
        <button
          onClick={() => setActiveTabInternal('galeria')}
          className={`py-2.5 px-3 border-b-2 transition whitespace-nowrap cursor-pointer ${
            activeTab === 'galeria'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Mapas Salvos ({mapas.length})
        </button>
        <button
          onClick={() => setActiveTabInternal('adicionar')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
            activeTab === 'adicionar'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          Imagem FMG
        </button>
        <button
          onClick={() => setActiveTabInternal('pipeline')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
            activeTab === 'pipeline'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Network className="w-3.5 h-3.5 text-amber-400" />
          Pipeline Wiki-links
        </button>
        <button
          onClick={() => setActiveTabInternal('config')}
          className={`py-2.5 px-3 border-b-2 transition flex items-center gap-1 whitespace-nowrap cursor-pointer ${
            activeTab === 'config'
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Fonte FMG
        </button>
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div className="m-3 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-200 text-xs">
          {feedbackMsg}
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'galeria' && (
          <div className="space-y-4">
            {mapas.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
                <MapIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">Nenhum mapa salvo ainda</p>
                <p className="text-xs text-slate-500 mt-1">
                  Exporte uma imagem PNG ou SVG do Fantasy Map Generator e importe na aba
                  &quot;Imagem FMG&quot;.
                </p>
                <button
                  onClick={() => setActiveTabInternal('adicionar')}
                  className="mt-4 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer"
                >
                  Importar Primeiro Mapa
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {mapas.map((mapa) => {
                  const isSelected = selectedMapId === mapa.id;

                  return (
                    <div
                      key={mapa.id}
                      onClick={() => setSelectedMapId(mapa.id)}
                      className={`p-3 rounded-2xl border transition-all flex flex-col gap-3 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-[#0f1325] border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={mapa.imageDataUrl}
                          alt={mapa.nome}
                          className="w-24 h-20 rounded-xl object-cover bg-black border border-white/10 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-white truncate">{mapa.nome}</h4>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono capitalize">
                            {mapa.tipo}
                          </span>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                            Adicionado em {new Date(mapa.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>

                      {/* Botões de Ação Direta */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnviarVtt(mapa);
                          }}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                          title="Criar nova cena no VTT com este mapa como fundo"
                        >
                          <Swords className="w-3.5 h-3.5" />
                          <span>Enviar ao VTT</span>
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnviarCanvas(mapa);
                          }}
                          className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition cursor-pointer"
                          title="Inserir imagem no Canvas Mental do MapScreen"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Enviar ao Canvas</span>
                        </button>
                      </div>

                      {/* Ações Secundárias */}
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                        <a
                          href={mapa.imageDataUrl}
                          download={`${mapa.nome.toLowerCase().replace(/\s+/g, '-')}.png`}
                          className="hover:text-cyan-300 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Baixar Imagem
                        </a>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Excluir o mapa "${mapa.nome}" do cofre?`)) {
                              removerMapa(mapa.id);
                            }
                          }}
                          className="hover:text-rose-400 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remover
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Aba de Pipeline FMG -> Wiki-links */}
        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
              <div className="font-bold mb-1 flex items-center gap-1.5 text-amber-300">
                <Network className="w-4 h-4" />
                Transformador FMG ➔ Nós & Wiki-links
              </div>
              Exporte os dados completos do seu mundo no menu <strong>Export &gt; GeoJSON / JSON data</strong> do Fantasy Map Generator, e faça o upload abaixo para gerar automaticamente nós de Reinos, Capitais, Culturas e todas as conexões visuais por [[Wiki-links]].
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Arquivo .json do Mundo FMG
              </label>
              <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-white/10 bg-black/40 hover:border-amber-500/40 hover:bg-amber-950/10 transition cursor-pointer">
                <FileCode className="w-8 h-8 text-amber-400 mb-2" />
                <span className="text-xs text-slate-300 font-semibold">
                  {fmgFileName || 'Clique para carregar arquivo .json do mapa'}
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  Exportado do Azgaar Fantasy Map Generator
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleJsonUpload}
                  className="hidden"
                />
              </label>
            </div>

            {pipelineSummary && (
              <div className="p-3.5 rounded-xl bg-[#12162a] border border-white/10 text-xs space-y-2">
                <h4 className="font-bold text-white flex items-center justify-between">
                  <span>Estrutura do Mundo Detectada:</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Pronto</span>
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center pt-1 font-mono">
                  <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                    <div className="text-amber-400 font-bold text-sm">{pipelineSummary.states}</div>
                    <div className="text-[10px] text-slate-400">Reinos</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                    <div className="text-cyan-400 font-bold text-sm">{pipelineSummary.burgs}</div>
                    <div className="text-[10px] text-slate-400">Cidades</div>
                  </div>
                  <div className="p-2 rounded-lg bg-black/40 border border-white/5">
                    <div className="text-purple-400 font-bold text-sm">{pipelineSummary.cultures}</div>
                    <div className="text-[10px] text-slate-400">Culturas</div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleExecutarPipeline}
              disabled={!fmgJsonFile || isImportingPipeline}
              className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 ${
                !fmgJsonFile || isImportingPipeline
                  ? 'bg-white/5 text-slate-500 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              }`}
            >
              <Network className="w-4 h-4" />
              <span>
                {isImportingPipeline
                  ? 'Forjando Nós e Wiki-links...'
                  : 'Criar Nós e Wiki-links no Canvas Mental'}
              </span>
            </button>

            {/* Exportação Reversa: RollDeck ➔ Obsidian */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                Exportar Notas do RollDeck para Obsidian
              </h5>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Baixe todas as notas atuais do Canvas em um arquivo consolidado formatado para vaults do Obsidian e SilverBullet.
              </p>
              <button
                type="button"
                onClick={handleExportarObsidian}
                className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Vault RollDeck (.md)</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'adicionar' && (
          <form onSubmit={handleSalvar} className="space-y-4">
            <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-cyan-200 leading-relaxed">
              <strong>Como exportar no Azgaar FMG:</strong> No menu lateral do Fantasy Map
              Generator, vá em <em>Export &gt; PNG Image</em> ou <em>Export &gt; SVG</em>, salve no
              seu computador e faça o upload abaixo.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome do Continente / Mapa
              </label>
              <input
                type="text"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Continente de Aethelgard, Terras Selvagens..."
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Tipo de Mapa</label>
              <select
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="continente">Continente / Mundo Completo</option>
                <option value="regional">Região / Província</option>
                <option value="tatico">Tático / Zona de Combate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Arquivo de Imagem (PNG, JPG, SVG)
              </label>
              <label className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-white/10 bg-black/40 hover:border-cyan-500/40 hover:bg-cyan-950/10 transition cursor-pointer">
                <FileImage className="w-8 h-8 text-cyan-400 mb-2" />
                <span className="text-xs text-slate-300 font-semibold">
                  Clique para selecionar arquivo de imagem
                </span>
                <span className="text-[10px] text-slate-500 mt-1">
                  Exportado do Fantasy Map Generator
                </span>
                <input
                  type="file"
                  accept="image/*,.svg"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {imageDataUrl && (
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Prévia do Mapa:
                </label>
                <img
                  src={imageDataUrl}
                  alt="Prévia"
                  className="w-full h-44 rounded-xl object-contain bg-black border border-white/10"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              Salvar Mapa no RollDeck
            </button>
          </form>
        )}

        {activeTab === 'config' && (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300">
              <h4 className="font-bold text-white mb-1">Origem do Fantasy Map Generator</h4>
              <p className="text-[11px] text-slate-400">
                O gerador de mundos pode ser executado via versão online do Azgaar ou localmente no
                container Docker na porta 8080.
              </p>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'cloud' as FMGSourceMode,
                  title: '🌐 Nuvem Oficial (Azgaar GitHub Pages)',
                  desc: 'azgaar.github.io/Fantasy-Map-Generator — Completo e pronto para uso.',
                },
                {
                  id: 'docker' as FMGSourceMode,
                  title: '💻 Container Docker Local',
                  desc: 'localhost:8080 — Executado pelo docker-compose do bundle.',
                },
                {
                  id: 'custom' as FMGSourceMode,
                  title: '⚙️ URL Personalizada',
                  desc: 'Endereço próprio ou servidor interno.',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                    fmgSourceMode === opt.id
                      ? 'bg-cyan-950/30 border-cyan-500/60'
                      : 'bg-black/30 border-white/5 hover:border-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="fmgSource"
                    value={opt.id}
                    checked={fmgSourceMode === opt.id}
                    onChange={() => setFMGSourceMode(opt.id)}
                    className="mt-1 text-cyan-600 focus:ring-0"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">{opt.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {fmgSourceMode === 'custom' && (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  URL Customizada do FMG
                </label>
                <input
                  type="url"
                  value={customFMGUrl}
                  onChange={(e) => setCustomFMGUrl(e.target.value)}
                  placeholder="http://192.168.1.100:8080"
                  className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
