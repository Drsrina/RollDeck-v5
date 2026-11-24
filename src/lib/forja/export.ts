/**
 * FORJA DE MUNDOS — Camada de Exportação Agnóstica (§10)
 *
 * Suporte a:
 * - Markdown (copiável para anotações do mestre)
 * - JSON Estruturado (integração com VTTs e gerenciadores de campanha)
 * - HTML Estático Independente
 * - TSV (importação em planilhas)
 */

import { MundoCompletoResult } from './pipeline';

export function exportarMarkdown(mundo: MundoCompletoResult): string {
  const { manifesto, terreno, assentamento, masmorra, npcs, itens, rumores } = mundo;

  let md = `# FORJA DE MUNDOS — RELATÓRIO DETERMINÍSTICO\n\n`;
  md += `> **Semente Raiz:** \`${manifesto.seed_raiz}\` | **Hash do Pacote:** \`${manifesto.hash_pacote_dados.slice(0, 18)}...\` | **Versão:** \`${manifesto.versao_pacote_dados}\`\n\n`;

  md += `## 1. Terreno e Geografia (${terreno.topologia.toUpperCase()})\n`;
  md += `- **Área:** ${terreno.metricas.totalCells} células (${terreno.metricas.areaTerra} terra / ${terreno.metricas.areaAgua} água)\n`;
  md += `- **Rios Identificados:** ${terreno.rivers.length}\n`;
  md += `- **Assentamentos Notáveis:** ${terreno.settlements.map((s) => `${s.name} (${s.role})`).join(', ')}\n\n`;

  md += `## 2. Assentamento: ${assentamento.nome}\n`;
  md += `- **Porte:** ${assentamento.tamanho.toUpperCase()} (População: ~${assentamento.populacao} habitantes)\n`;
  md += `- **Governo:** ${assentamento.governo}\n`;
  md += `- **Distritos:**\n`;
  for (const d of assentamento.distritos) {
    md += `  - **${d.nome}** (${d.tipoUso}) — ${d.descricao}\n`;
  }
  md += `- **Pontos de Interesse:**\n`;
  for (const poi of assentamento.pontosDeInteresse) {
    md += `  - **${poi.nome}** [${poi.tipo}]: Responsável: ${poi.responsavelNome} (${poi.responsavelOcupacao}). Especialidade: ${poi.especialidade}\n`;
  }
  md += `- **Facções Ativas:**\n`;
  for (const f of assentamento.faccoes) {
    md += `  - **${f.nome}** (${f.tipo}): Líder: ${f.lider} | Objetivo: ${f.objetivo}\n`;
  }
  md += `\n`;

  md += `## 3. Masmorra: ${masmorra.nome}\n`;
  md += `- **Tema:** ${masmorra.tema} | **Layout:** ${masmorra.algoritmoLayout}\n`;
  md += `- **Alcançabilidade (Lock & Key):** ${masmorra.isSolvable ? 'SOLÚVEL (Verificado por BFS)' : 'INACESSÍVEL'}\n`;
  md += `- **Orçamento de XP:** Alvo: ${masmorra.orcamentoXp.orcamentoAlvo} | Alocado: ${masmorra.orcamentoXp.xpAlocado} (${masmorra.orcamentoXp.variacaoPercentual}%)\n`;
  md += `- **Salas e Chaves:**\n`;
  for (const r of masmorra.rooms) {
    md += `  - **Sala ${r.numero}: ${r.nome}** (${r.tipo})\n`;
    md += `    - ${r.descricao}\n`;
    if (r.monstros && r.monstros.length > 0) {
      md += `    - *Encontro:* ${r.monstros.map((m) => `${m.quantidade}x ${m.nome} (CR ${m.cr})`).join(', ')} [${r.xpTotal} XP]\n`;
    }
    if (r.armadilha) md += `    - *Armadilha:* ${r.armadilha}\n`;
    if (r.tesouro) md += `    - *Tesouro:* ${r.tesouro}\n`;
  }
  md += `\n`;

  md += `## 4. Fichas de NPCs (Estilo Donjon)\n`;
  for (const npc of npcs) {
    md += `- **${npc.resumoLinhaUnica}**\n`;
  }
  md += `\n`;

  md += `## 5. Itens e Tesouros Encontrados\n`;
  for (const item of itens) {
    md += `- **${item.nome}** (${item.categoria}, ${item.raridade}) — ${item.descricaoMecanica} | Valor: **${item.valorPO} PO**\n`;
  }
  md += `\n`;

  md += `## 6. Rumores da Taverna\n`;
  for (let i = 0; i < rumores.length; i++) {
    md += `${i + 1}. "${rumores[i]}"\n`;
  }

  return md;
}

export function exportarJSON(mundo: MundoCompletoResult): string {
  const serializable = {
    manifesto: mundo.manifesto,
    terreno: {
      seed: mundo.terreno.seed,
      topologia: mundo.terreno.topologia,
      metricas: mundo.terreno.metricas,
      settlements: mundo.terreno.settlements,
      routes: mundo.terreno.routes,
      landmarks: mundo.terreno.landmarks,
    },
    assentamento: mundo.assentamento,
    masmorra: {
      seed: mundo.masmorra.seed,
      nome: mundo.masmorra.nome,
      isSolvable: mundo.masmorra.isSolvable,
      orcamentoXp: mundo.masmorra.orcamentoXp,
      rooms: mundo.masmorra.rooms,
      missionGraph: mundo.masmorra.missionGraph,
    },
    npcs: mundo.npcs,
    itens: mundo.itens,
    rumores: mundo.rumores,
    grafoEntidades: mundo.weaver.exportJSON(),
  };

  return JSON.stringify(serializable, null, 2);
}

export function exportarTSV(mundo: MundoCompletoResult): string {
  let tsv = `ID\tTipo\tNome\tDetalhe\tValor/XP\n`;
  for (const npc of mundo.npcs) {
    tsv += `${npc.id}\tNPC\t${npc.nome}\t${npc.ocupacao} (${npc.raca})\tPV:${npc.stats.pv} CA:${npc.stats.ca}\n`;
  }
  for (const it of mundo.itens) {
    tsv += `${it.id}\tItem\t${it.nome}\t${it.categoria} (${it.raridade})\t${it.valorPO} PO\n`;
  }
  for (const r of mundo.masmorra.rooms) {
    tsv += `${r.id}\tSala\t${r.nome}\t${r.tipo}\t${r.xpTotal} XP\n`;
  }
  return tsv;
}
