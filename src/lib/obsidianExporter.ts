import type { NoteNode } from '../types';

export interface ObsidianVaultFile {
  relativePath: string;
  filename: string;
  content: string;
}

/**
 * Converte as notas do RollDeck em arquivos Markdown compatíveis com Obsidian e SilverBullet,
 * organizando por categorias em subpastas e preservando links com sintaxe [[Wiki-links]].
 */
export function generateObsidianVaultFiles(notes: NoteNode[]): ObsidianVaultFile[] {
  return notes.map((note) => {
    const categoryFolder = getFolderForCategory(note.category);
    const sanitizedTitle = note.title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'Sem-Titulo';
    const filename = `${sanitizedTitle}.md`;
    const relativePath = `${categoryFolder}/${filename}`;

    const frontmatter = [
      '---',
      `title: "${note.title.replace(/"/g, '\\"')}"`,
      `category: "${note.category || 'general'}"`,
      note.tags?.length ? `tags:\n${note.tags.map((t) => `  - "${t}"`).join('\n')}` : null,
      note.pinned ? 'pinned: true' : null,
      `updated: ${new Date(note.updatedAt || Date.now()).toISOString()}`,
      '---',
      '',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const content = `${frontmatter}${note.body || ''}\n`;

    return {
      relativePath,
      filename,
      content,
    };
  });
}

function getFolderForCategory(category?: string): string {
  switch (category) {
    case 'faction':
      return '1. Faccoes e Reinos';
    case 'location':
      return '2. Cidades e Locais';
    case 'npc':
      return '3. Personagens e NPCs';
    case 'item':
      return '4. Itens e Reliquias';
    case 'concept':
      return '5. Culturas e Religioes';
    case 'session':
      return '6. Sessoes e Registros';
    case 'event':
      return '7. Cronologia e Eventos';
    default:
      return '0. Geral';
  }
}

/**
 * Gera um arquivo consolidado Markdown contendo o Vault estruturado com seções e wiki-links.
 */
export function exportVaultToConsolidatedMarkdown(
  notes: NoteNode[],
  vaultTitle = 'RollDeck RPG Vault'
): string {
  const files = generateObsidianVaultFiles(notes);
  const header = [
    `# ${vaultTitle}`,
    `*Exportado automaticamente pelo RollDeck em ${new Date().toLocaleDateString('pt-BR')}*`,
    `Total de arquivos/nós conectados: ${files.length}`,
    '',
    '---',
    '',
  ].join('\n');

  const fileSections = files.map((f) => {
    return [
      `<!-- INICIO: ${f.relativePath} -->`,
      `## 📄 ${f.filename}`,
      `*Pasta sugerida: \`${f.relativePath}\`*`,
      '',
      f.content,
      '---',
      '',
    ].join('\n');
  });

  return header + fileSections.join('\n');
}
