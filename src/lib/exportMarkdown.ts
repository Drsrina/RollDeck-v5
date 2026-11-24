import type { CidadeEstado, LogEntry } from '../types/oraculo';

/**
 * Converte a ficha da cidade e as entradas de diário em um arquivo Markdown elegante.
 */
export function exportarDiarioMarkdown(cidade: CidadeEstado, logs: LogEntry[], seed: string): string {
  const agora = new Date().toLocaleDateString('pt-BR');

  let md = `# Diário de Campanha: ${cidade.nome || 'Feudo Sem Nome'}\n`;
  md += `*Exportado em ${agora} · Semente PRNG: \`${seed}\`*\n\n`;

  md += `## 🏰 Ficha da Cidade (Dia ${cidade.dia} · ${cidade.estacao})\n`;
  md += `- **População**: ${cidade.populacao} habitantes\n`;
  md += `- **Recursos**: 🌾 Víveres: ${cidade.recursos.viveres} | 🪙 Ouro: ${cidade.recursos.ouro} | 🪵 Madeira: ${cidade.recursos.madeira} | 🪨 Pedra: ${cidade.recursos.pedra} | ⛏️ Minério: ${cidade.recursos.minerio}\n`;
  md += `- **Indicadores**: Estabilidade: ${cidade.estabilidade}% | Moral: ${cidade.moral}% | Defesa: ${cidade.defesa}% | Indústria: Nível ${cidade.industria}/5\n\n`;

  if (cidade.construcoes.length > 0) {
    md += `### 🔨 Construções\n`;
    for (const c of cidade.construcoes) {
      const statusIcon = c.status === 'concluida' ? '✅' : c.status === 'em_obras' ? `⏳ (${c.diasRestantes}d restantes)` : '📋 Planejada';
      md += `- **${c.nome}** [${statusIcon}]: ${c.efeito}\n`;
    }
    md += `\n`;
  }

  if (cidade.rotas.length > 0) {
    md += `### 🧭 Rotas Comerciais\n`;
    for (const r of cidade.rotas) {
      md += `- **${r.origem} ➔ ${r.destino}** (${r.produto}): ${r.frequencia} · Lucro est.: +${r.lucroEstimadoOuro} Ouro [${r.ativa ? 'Ativa' : 'Pausada'}]\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 📜 Crônicas & Diário de Rolagens\n\n`;

  if (logs.length === 0) {
    md += `*Nenhuma entrada registrada até o momento.*\n`;
  } else {
    // Ordena do mais recente ao mais antigo
    const ordenados = [...logs].sort((a, b) => b.dia - a.dia || b.timestamp - a.timestamp);

    for (const entry of ordenados) {
      const tagTipo =
        entry.tipo === 'oraculo'
          ? '🔮 ORÁCULO'
          : entry.tipo === 'tabela'
          ? '🎲 TABELA'
          : entry.tipo === 'turno_semanal'
          ? '📅 SEMANAL'
          : entry.tipo === 'turno_mensal'
          ? '🌕 MENSAL'
          : entry.tipo === 'turno_micro'
          ? '⚡ MICRO-TURNO'
          : '📝 NOTA';

      md += `### [Dia ${entry.dia} · ${entry.estacao}] ${tagTipo}: ${entry.titulo}\n`;
      md += `${entry.texto}\n\n`;
      if (entry.deltaRecursos) {
        const deltas = Object.entries(entry.deltaRecursos)
          .filter(([_, v]) => v !== 0 && v !== undefined)
          .map(([k, v]) => `${(v as number) > 0 ? '+' : ''}${v} ${k}`)
          .join(', ');
        if (deltas) {
          md += `> **Variação de Recursos**: ${deltas}\n\n`;
        }
      }
    }
  }

  return md;
}

/**
 * Dispara o download de um arquivo de texto/markdown no navegador.
 */
export function downloadArquivo(conteudo: string, nomeArquivo: string, mimeType: string = 'text/markdown') {
  const blob = new Blob([conteudo], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
