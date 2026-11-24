import React, { useRef, useState } from 'react';
import {
  Copy,
  Download,
  Key,
  RotateCcw,
  Settings,
  Sparkles,
  Upload,
  X,
  Check,
} from 'lucide-react';
import { downloadArquivo } from '../../lib/exportMarkdown';
import { useOraculoStore } from '../../store/useOraculoStore';

interface ConfigCampanhaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigCampanhaModal: React.FC<ConfigCampanhaModalProps> = ({ isOpen, onClose }) => {
  const {
    seed,
    setSeed,
    cidade,
    atualizarNomeCidade,
    exportarEstadoJSON,
    importarEstadoJSON,
    resetarCampanha,
    resetarApenasLog,
    zerarCidade,
  } = useOraculoStore();

  const [inputSeed, setInputSeed] = useState(seed);
  const [copied, setCopied] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleApplySeed = () => {
    if (inputSeed.trim()) {
      setSeed(inputSeed.trim());
    }
  };

  const handleCopySeed = () => {
    navigator.clipboard.writeText(seed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportJSON = () => {
    const jsonStr = exportarEstadoJSON();
    const nomeLimpo = (cidade.nome || 'Campanha').toLowerCase().replace(/\s+/g, '_');
    downloadArquivo(jsonStr, `oraculo_backup_${nomeLimpo}.json`, 'application/json');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      const sucesso = importarEstadoJSON(content);
      if (sucesso) {
        setImportStatus('Campanha importada com sucesso!');
        setTimeout(() => setImportStatus(null), 3000);
      } else {
        setImportStatus('Erro: Arquivo JSON inválido.');
        setTimeout(() => setImportStatus(null), 3000);
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl glass-panel-elevated p-5 border border-white/20 shadow-2xl space-y-4 select-none max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Configurações da Campanha
              </h3>
              <p className="text-[10px] text-slate-400">
                Semente determinística, backups e gerenciamento de estado
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

        {/* Semente RNG Determinística (Mulberry32) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>Semente do RNG (Mulberry32)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputSeed}
              onChange={(e) => setInputSeed(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={handleApplySeed}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
            >
              Aplicar
            </button>
            <button
              type="button"
              onClick={handleCopySeed}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300"
              title="Copiar Semente"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            A mesma semente sempre gera as mesmas rolagens e eventos determinísticos.
          </p>
        </div>

        {/* Backup: Exportar e Importar JSON */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Backup & Restauração (JSON)
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportJSON}
              className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Exportar JSON</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <span>Importar JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileImport}
            />
          </div>

          {importStatus && (
            <div className="p-2 rounded-lg bg-black/60 border border-white/15 text-center text-xs font-semibold text-cyan-300">
              {importStatus}
            </div>
          )}
        </div>

        {/* Zona de Reinicialização */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Ações de Reinicialização
          </label>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Iniciar nova campanha com nova semente e cidade zerada?')) {
                  resetarCampanha(`seed_${Date.now()}`);
                  onClose();
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nova Campanha (Nova Semente)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja zerar os recursos e população da cidade atual?')) {
                  zerarCidade();
                  onClose();
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Zerar Apenas Ficha da Cidade</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm('Deseja limpar todo o histórico do diário de campanha?')) {
                  resetarApenasLog();
                  onClose();
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <span>Limpar Apenas Diário de Campanha</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
