import crypto from 'crypto';
import type { NoteCategory, NoteLink, NoteNode } from '../src/types';

export interface ObsidianFileInput {
  filename: string;
  content: string;
}

export interface ParsedObsidianDoc {
  title: string;
  body: string;
  tags: string[];
  aliases: string[];
  category: NoteCategory;
  color?: string;
  rawWikiLinks: { target: string; label?: string }[];
}

export interface ImportGraphResult {
  notes: NoteNode[];
  links: NoteLink[];
  createdCount: number;
  updatedCount: number;
  linksCreatedCount: number;
}

const VALID_CATEGORIES = new Set<NoteCategory>([
  'general',
  'location',
  'npc',
  'character',
  'dungeon',
  'clue',
  'faction',
  'item',
  'lore',
]);

const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';
const NOTION_UUID_REGEX =
  /^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isValidNotionId(id: string): boolean {
  return NOTION_UUID_REGEX.test(id.trim());
}

export function normalizeNotionId(id: string): string {
  const hex = id.trim().replace(/-/g, '').toLowerCase();
  if (hex.length !== 32) return id.trim();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_API_KEY && process.env.NOTION_API_KEY.trim().length > 0);
}

function mapToNoteCategory(raw?: string, tags: string[] = []): NoteCategory {
  const candidates = [raw, ...tags].filter(Boolean).map((v) => String(v).toLowerCase().trim());
  for (const c of candidates) {
    if (VALID_CATEGORIES.has(c as NoteCategory)) return c as NoteCategory;
    if (
      c.includes('ficha') ||
      c === 'pj' ||
      c === 'pc' ||
      c.includes('jogador') ||
      c.includes('character-sheet') ||
      c.includes('heroi') ||
      c.includes('herói')
    ) {
      return 'character';
    }
    if (c.includes('npc') || c.includes('personagem') || c.includes('character')) return 'npc';
    if (c.includes('local') || c.includes('cidade') || c.includes('vila') || c.includes('place') || c.includes('region')) {
      return 'location';
    }
    if (c.includes('masmorra') || c.includes('dungeon') || c.includes('caverna')) return 'dungeon';
    if (c.includes('facç') || c.includes('facc') || c.includes('guild') || c.includes('faction')) return 'faction';
    if (c.includes('pista') || c.includes('segredo') || c.includes('clue') || c.includes('quest')) return 'clue';
    if (c.includes('item') || c.includes('loot') || c.includes('tesouro') || c.includes('arma')) return 'item';
    if (c.includes('lore') || c.includes('histór') || c.includes('histor') || c.includes('mito')) return 'lore';
  }
  return 'general';
}

function sanitizeTitleFromFilename(filename: string): string {
  const base = filename
    .replace(/\\/g, '/')
    .split('/')
    .pop() || 'Nota Importada';
  return base.replace(/\.(md|markdown|txt)$/i, '').trim() || 'Nota Importada';
}

function parseSimpleYamlFrontmatter(raw: string): {
  meta: Record<string, string | string[]>;
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { meta: {}, body: normalized };
  }

  const endIdx = normalized.indexOf('\n---', 4);
  if (endIdx < 0) {
    return { meta: {}, body: normalized };
  }

  const yamlBlock = normalized.slice(4, endIdx);
  const restStart = normalized.indexOf('\n', endIdx + 4);
  const body = restStart >= 0 ? normalized.slice(restStart + 1).trimStart() : '';

  const meta: Record<string, string | string[]> = {};
  const lines = yamlBlock.split('\n');
  let currentListKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (currentListKey && /^\s*-\s+/.test(line)) {
      const val = trimmed.replace(/^-\s+/, '').replace(/^['"]|['"]$/g, '').trim();
      if (val) {
        const existing = meta[currentListKey];
        if (Array.isArray(existing)) existing.push(val);
        else meta[currentListKey] = [val];
      }
      continue;
    }

    currentListKey = null;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx <= 0) continue;

    const key = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const rawVal = trimmed.slice(colonIdx + 1).trim();

    if (!rawVal) {
      meta[key] = [];
      currentListKey = key;
      continue;
    }

    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      const items = rawVal
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      meta[key] = items;
    } else {
      meta[key] = rawVal.replace(/^['"]|['"]$/g, '').trim();
    }
  }

  return { meta, body };
}

function extractInlineTags(markdown: string): string[] {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '');
  const found = new Set<string>();
  const regex = /(?:^|[\s(])#([a-zA-ZÀ-ÿ0-9_-]+(?:\/[a-zA-ZÀ-ÿ0-9_-]+)*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    const tag = match[1].trim();
    // Ignore pure hex colors like #ff00aa or #123
    if (/^[0-9a-fA-F]{3,8}$/.test(tag)) continue;
    if (tag.length > 0 && tag.length <= 60) {
      found.add(tag);
    }
  }
  return Array.from(found);
}

/**
 * Extracts and normalizes Obsidian wiki-links:
 * [[Folder/Note Name#Heading|Display]] -> target "Note Name", normalized body token [[Note Name|Display]]
 */
function normalizeObsidianWikiLinks(markdown: string): {
  body: string;
  links: { target: string; label?: string }[];
} {
  const links: { target: string; label?: string }[] = [];
  const body = markdown.replace(/(!?)\[\[([^\]]+)\]\]/g, (full, bang, inner) => {
    // Keep image embeds untouched as text reference
    if (bang === '!') return full;
    const [rawTarget, rawAlias] = String(inner).split('|');
    const withoutHeading = (rawTarget || '').split('#')[0].trim();
    const cleanTarget = withoutHeading.includes('/')
      ? withoutHeading.split('/').pop()!.trim()
      : withoutHeading;

    if (!cleanTarget) return full;
    const cleanAlias = rawAlias?.trim();
    links.push({ target: cleanTarget, label: cleanAlias });
    return cleanAlias ? `[[${cleanTarget}|${cleanAlias}]]` : `[[${cleanTarget}]]`;
  });
  return { body, links };
}

/**
 * Parses a single Obsidian Markdown file into structured note fields.
 */
export function parseObsidianMarkdownFile(input: ObsidianFileInput): ParsedObsidianDoc {
  const { meta, body: bodyWithoutFrontmatter } = parseSimpleYamlFrontmatter(input.content || '');
  const fallbackTitle = sanitizeTitleFromFilename(input.filename);

  const metaTitle = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : fallbackTitle;
  const title = metaTitle.slice(0, 200);

  const tagSet = new Set<string>(['obsidian']);
  const rawMetaTags = meta.tags ?? meta.tag;
  if (Array.isArray(rawMetaTags)) {
    for (const t of rawMetaTags) {
      const clean = t.replace(/^#/, '').trim();
      if (clean) tagSet.add(clean.slice(0, 60));
    }
  } else if (typeof rawMetaTags === 'string') {
    for (const t of rawMetaTags.split(/[,\s]+/)) {
      const clean = t.replace(/^#/, '').trim();
      if (clean) tagSet.add(clean.slice(0, 60));
    }
  }

  for (const inlineTag of extractInlineTags(bodyWithoutFrontmatter)) {
    tagSet.add(inlineTag);
  }

  const aliases: string[] = [];
  const rawAliases = meta.aliases ?? meta.alias;
  if (Array.isArray(rawAliases)) {
    aliases.push(...rawAliases.map((a) => a.trim()).filter(Boolean));
  } else if (typeof rawAliases === 'string' && rawAliases.trim()) {
    aliases.push(...rawAliases.split(',').map((a) => a.trim()).filter(Boolean));
  }

  const { body, links } = normalizeObsidianWikiLinks(bodyWithoutFrontmatter);
  const tags = Array.from(tagSet).slice(0, 50);
  const rawCat =
    (typeof meta.category === 'string' && meta.category) ||
    (typeof meta.type === 'string' && meta.type) ||
    (typeof meta.tipo === 'string' && meta.tipo) ||
    undefined;

  const color =
    typeof meta.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(meta.color.trim())
      ? meta.color.trim()
      : undefined;

  return {
    title,
    body: body.slice(0, 50000),
    tags,
    aliases,
    category: mapToNoteCategory(rawCat, tags),
    color,
    rawWikiLinks: links,
  };
}

/**
 * Computes clean non-overlapping spiral coordinates for newly imported notes.
 */
function computeSpiralPosition(index: number, offsetBase: number): { x: number; y: number } {
  const n = index + offsetBase;
  const angle = n * 0.72;
  const radius = 140 + 52 * Math.sqrt(n + 1);
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

/**
 * Converts parsed Obsidian Markdown files into RollDeck NoteNodes and auto-linked NoteLinks.
 */
export function convertObsidianFilesToGraph(options: {
  files: ObsidianFileInput[];
  layerId: string;
  mode: 'merge' | 'create';
  existingNotes: NoteNode[];
  existingLinks: NoteLink[];
}): ImportGraphResult {
  const now = Date.now();
  const existingByTitle = new Map<string, NoteNode>();
  for (const n of options.existingNotes) {
    existingByTitle.set(n.title.trim().toLowerCase(), n);
  }

  const parsedDocs = options.files.map(parseObsidianMarkdownFile);
  const importedNotes: NoteNode[] = [];
  const titleOrAliasToId = new Map<string, string>();

  // Pre-seed map with existing notes
  for (const n of options.existingNotes) {
    titleOrAliasToId.set(n.title.trim().toLowerCase(), n.id);
  }

  let createdCount = 0;
  let updatedCount = 0;
  const baseIndex = options.existingNotes.length;

  parsedDocs.forEach((doc, idx) => {
    const key = doc.title.trim().toLowerCase();
    const existing = options.mode === 'merge' ? existingByTitle.get(key) : undefined;

    if (existing) {
      const mergedTags = Array.from(new Set([...(existing.tags || []), ...doc.tags])).slice(0, 50);
      const updatedNote: NoteNode = {
        ...existing,
        body: doc.body,
        tags: mergedTags,
        category: doc.category !== 'general' ? doc.category : existing.category,
        color: doc.color ?? existing.color,
        updatedAt: now,
      };
      importedNotes.push(updatedNote);
      titleOrAliasToId.set(key, updatedNote.id);
      for (const alias of doc.aliases) {
        titleOrAliasToId.set(alias.toLowerCase(), updatedNote.id);
      }
      updatedCount += 1;
    } else {
      const pos = computeSpiralPosition(idx, baseIndex);
      const newNote: NoteNode = {
        id: `note-obs-${crypto.randomUUID().slice(0, 12)}`,
        title: doc.title,
        body: doc.body,
        tags: doc.tags,
        layerId: options.layerId,
        category: doc.category,
        ...(doc.color ? { color: doc.color } : {}),
        x: pos.x,
        y: pos.y,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      importedNotes.push(newNote);
      titleOrAliasToId.set(key, newNote.id);
      for (const alias of doc.aliases) {
        titleOrAliasToId.set(alias.toLowerCase(), newNote.id);
      }
      createdCount += 1;
    }
  });

  // Build NoteLinks for all resolved [[wiki-links]]
  const existingLinkKeys = new Set(options.existingLinks.map((l) => `${l.fromId}=>${l.toId}`));
  const createdLinks: NoteLink[] = [];

  parsedDocs.forEach((doc, idx) => {
    const sourceNote = importedNotes[idx];
    for (const wl of doc.rawWikiLinks) {
      const targetId = titleOrAliasToId.get(wl.target.trim().toLowerCase());
      if (!targetId || targetId === sourceNote.id) continue;
      const pairKey = `${sourceNote.id}=>${targetId}`;
      if (existingLinkKeys.has(pairKey)) continue;
      existingLinkKeys.add(pairKey);
      createdLinks.push({
        id: `link-${sourceNote.id}-${targetId}`,
        fromId: sourceNote.id,
        toId: targetId,
        ...(wl.label ? { label: wl.label.slice(0, 120) } : {}),
        type: 'link',
      });
    }
  });

  return {
    notes: importedNotes,
    links: createdLinks,
    createdCount,
    updatedCount,
    linksCreatedCount: createdLinks.length,
  };
}

// =========================================================================
// NOTION API CONNECTOR (SERVER-SIDE ONLY — uses process.env.NOTION_API_KEY)
// =========================================================================

export interface NotionSearchItem {
  id: string;
  object: 'page' | 'database';
  title: string;
  icon?: string;
  lastEditedTime?: string;
}

type FetchLike = typeof fetch;

async function notionApiRequest<T = any>(
  endpointPath: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; fetcher?: FetchLike; apiKey?: string } = {}
): Promise<T> {
  const token = (options.apiKey ?? process.env.NOTION_API_KEY ?? '').trim();
  if (!token) {
    throw new Error('NOTION_API_KEY não configurada no servidor.');
  }
  if (!endpointPath.startsWith('/')) {
    throw new Error('Caminho da API do Notion inválido.');
  }

  const fetchImpl = options.fetcher || fetch;
  const res = await fetchImpl(`${NOTION_API_BASE}${endpointPath}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = payload?.message || `Notion retornou HTTP ${res.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

function richTextToMarkdown(
  richTextArr: any[] | undefined,
  mentionedPageIds: Set<string>
): string {
  if (!Array.isArray(richTextArr)) return '';
  return richTextArr
    .map((item) => {
      if (!item) return '';
      if (item.type === 'mention' && item.mention?.type === 'page' && item.mention.page?.id) {
        const refId = normalizeNotionId(item.mention.page.id);
        mentionedPageIds.add(refId);
        const label = (item.plain_text || '').trim();
        return label ? `[[${label}]]` : '';
      }

      let text: string = item.plain_text || '';
      if (!text) return '';

      const ann = item.annotations || {};
      if (ann.code) text = `\`${text}\``;
      if (ann.bold) text = `**${text}**`;
      if (ann.italic) text = `*${text}*`;
      if (ann.strikethrough) text = `~~${text}~~`;
      if (item.href && /^https?:\/\//i.test(item.href)) {
        text = `[${text}](${item.href})`;
      }
      return text;
    })
    .join('');
}

function extractNotionObjectTitle(obj: any): string {
  if (!obj) return 'Sem Título';

  // Database title
  if (obj.object === 'database' && Array.isArray(obj.title)) {
    const t = obj.title.map((x: any) => x?.plain_text || '').join('').trim();
    if (t) return t;
  }

  // Page properties -> find property with type === 'title'
  if (obj.properties && typeof obj.properties === 'object') {
    for (const prop of Object.values<any>(obj.properties)) {
      if (prop?.type === 'title' && Array.isArray(prop.title)) {
        const t = prop.title.map((x: any) => x?.plain_text || '').join('').trim();
        if (t) return t;
      }
    }
  }

  return 'Página do Notion';
}

function extractNotionIcon(obj: any): string | undefined {
  if (obj?.icon?.type === 'emoji' && typeof obj.icon.emoji === 'string') {
    return obj.icon.emoji;
  }
  return undefined;
}

function extractNotionPropertiesMetadata(page: any): {
  tags: string[];
  categoryHint?: string;
  headerLines: string[];
} {
  const tags = new Set<string>(['notion']);
  const headerLines: string[] = [];
  let categoryHint: string | undefined;

  if (!page?.properties || typeof page.properties !== 'object') {
    return { tags: Array.from(tags), headerLines };
  }

  for (const [propName, prop] of Object.entries<any>(page.properties)) {
    if (!prop || prop.type === 'title') continue;
    const lowerName = propName.toLowerCase();

    if (prop.type === 'multi_select' && Array.isArray(prop.multi_select)) {
      const vals = prop.multi_select.map((s: any) => s?.name).filter(Boolean);
      vals.forEach((v: string) => tags.add(v.slice(0, 60)));
      if (vals.length > 0) headerLines.push(`- **${propName}:** ${vals.join(', ')}`);
    } else if (prop.type === 'select' && prop.select?.name) {
      const val = String(prop.select.name);
      tags.add(val.slice(0, 60));
      if (lowerName.includes('tipo') || lowerName.includes('categ') || lowerName.includes('type')) {
        categoryHint = val;
      }
      headerLines.push(`- **${propName}:** ${val}`);
    } else if (prop.type === 'status' && prop.status?.name) {
      headerLines.push(`- **${propName}:** ${prop.status.name}`);
    } else if (prop.type === 'rich_text' && Array.isArray(prop.rich_text)) {
      const txt = prop.rich_text.map((x: any) => x?.plain_text || '').join('').trim();
      if (txt) headerLines.push(`- **${propName}:** ${txt}`);
    } else if (prop.type === 'number' && typeof prop.number === 'number') {
      headerLines.push(`- **${propName}:** ${prop.number}`);
    } else if (prop.type === 'checkbox' && typeof prop.checkbox === 'boolean') {
      headerLines.push(`- **${propName}:** ${prop.checkbox ? 'Sim' : 'Não'}`);
    }
  }

  return {
    tags: Array.from(tags).slice(0, 50),
    categoryHint,
    headerLines,
  };
}

function notionBlocksToMarkdown(blocks: any[], mentionedPageIds: Set<string>): string {
  const lines: string[] = [];

  for (const block of blocks) {
    if (!block || !block.type) continue;
    const data = block[block.type];

    switch (block.type) {
      case 'heading_1':
        lines.push(`# ${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      case 'heading_2':
        lines.push(`## ${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      case 'heading_3':
        lines.push(`### ${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      case 'paragraph': {
        const txt = richTextToMarkdown(data?.rich_text, mentionedPageIds);
        if (txt) lines.push(txt);
        break;
      }
      case 'bulleted_list_item':
        lines.push(`- ${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      case 'numbered_list_item':
        lines.push(`1. ${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      case 'to_do': {
        const mark = data?.checked ? 'x' : ' ';
        lines.push(`- [${mark}] ${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      }
      case 'quote':
        lines.push(`> ${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      case 'callout': {
        const icon = data?.icon?.type === 'emoji' ? `${data.icon.emoji} ` : '';
        lines.push(`> ${icon}${richTextToMarkdown(data?.rich_text, mentionedPageIds)}`);
        break;
      }
      case 'toggle':
        lines.push(`**${richTextToMarkdown(data?.rich_text, mentionedPageIds)}**`);
        break;
      case 'code': {
        const lang = typeof data?.language === 'string' ? data.language : '';
        const codeTxt = (data?.rich_text || []).map((x: any) => x?.plain_text || '').join('');
        lines.push(`\`\`\`${lang}\n${codeTxt}\n\`\`\``);
        break;
      }
      case 'divider':
        lines.push('---');
        break;
      case 'child_page':
        if (data?.title) {
          if (block.id) mentionedPageIds.add(normalizeNotionId(block.id));
          lines.push(`- [[${data.title}]]`);
        }
        break;
      case 'link_to_page':
        if (data?.page_id) {
          mentionedPageIds.add(normalizeNotionId(data.page_id));
        }
        break;
      default:
        break;
    }
  }

  return lines.join('\n\n').trim();
}

export async function searchNotionWorkspace(options: {
  query?: string;
  filterType?: 'page' | 'database';
  pageSize?: number;
  fetcher?: FetchLike;
  apiKey?: string;
}): Promise<NotionSearchItem[]> {
  const body: Record<string, any> = {
    page_size: Math.min(50, Math.max(1, options.pageSize || 25)),
    sort: { direction: 'descending', timestamp: 'last_edited_time' },
  };

  if (options.query && options.query.trim()) {
    body.query = options.query.trim().slice(0, 120);
  }
  if (options.filterType) {
    body.filter = { value: options.filterType, property: 'object' };
  }

  const data = await notionApiRequest<{ results?: any[] }>('/search', {
    method: 'POST',
    body,
    fetcher: options.fetcher,
    apiKey: options.apiKey,
  });

  const results = Array.isArray(data.results) ? data.results : [];
  return results
    .filter((item) => item && (item.object === 'page' || item.object === 'database') && !item.archived)
    .map((item) => ({
      id: normalizeNotionId(String(item.id)),
      object: item.object as 'page' | 'database',
      title: extractNotionObjectTitle(item),
      icon: extractNotionIcon(item),
      lastEditedTime: item.last_edited_time,
    }));
}

export async function importNotionToGraph(options: {
  pageIds?: string[];
  databaseId?: string;
  layerId: string;
  mode: 'merge' | 'create';
  existingNotes: NoteNode[];
  existingLinks: NoteLink[];
  fetcher?: FetchLike;
  apiKey?: string;
}): Promise<ImportGraphResult> {
  const pagesToProcess: any[] = [];
  const seenPageIds = new Set<string>();

  if (options.databaseId) {
    if (!isValidNotionId(options.databaseId)) {
      throw new Error('ID de database do Notion inválido.');
    }
    const normDbId = normalizeNotionId(options.databaseId);
    const queryRes = await notionApiRequest<{ results?: any[] }>(`/databases/${normDbId}/query`, {
      method: 'POST',
      body: { page_size: 40 },
      fetcher: options.fetcher,
      apiKey: options.apiKey,
    });
    for (const page of queryRes.results || []) {
      if (page?.id && !page.archived) {
        const nid = normalizeNotionId(String(page.id));
        if (!seenPageIds.has(nid)) {
          seenPageIds.add(nid);
          pagesToProcess.push(page);
        }
      }
    }
  }

  for (const rawId of (options.pageIds || []).slice(0, 40)) {
    if (!isValidNotionId(rawId)) {
      throw new Error(`ID de página do Notion inválido: ${rawId}`);
    }
    const nid = normalizeNotionId(rawId);
    if (seenPageIds.has(nid)) continue;
    seenPageIds.add(nid);
    const pageObj = await notionApiRequest<any>(`/pages/${nid}`, {
      method: 'GET',
      fetcher: options.fetcher,
      apiKey: options.apiKey,
    });
    if (pageObj && !pageObj.archived) {
      pagesToProcess.push(pageObj);
    }
  }

  const now = Date.now();
  const existingByTitle = new Map<string, NoteNode>();
  const titleToId = new Map<string, string>();
  for (const n of options.existingNotes) {
    existingByTitle.set(n.title.trim().toLowerCase(), n);
    titleToId.set(n.title.trim().toLowerCase(), n.id);
  }

  const notionIdToNoteId = new Map<string, string>();
  const pageMentionsByNoteId = new Map<string, Set<string>>();
  const importedNotes: NoteNode[] = [];

  let createdCount = 0;
  let updatedCount = 0;
  const baseIndex = options.existingNotes.length;

  for (let i = 0; i < pagesToProcess.length; i++) {
    const page = pagesToProcess[i];
    const normNotionId = normalizeNotionId(String(page.id));
    const title = extractNotionObjectTitle(page).slice(0, 200);
    const metaProps = extractNotionPropertiesMetadata(page);

    const blocksRes = await notionApiRequest<{ results?: any[] }>(
      `/blocks/${normNotionId}/children?page_size=100`,
      {
        method: 'GET',
        fetcher: options.fetcher,
        apiKey: options.apiKey,
      }
    );

    const mentionedIds = new Set<string>();
    const blocksMd = notionBlocksToMarkdown(blocksRes.results || [], mentionedIds);

    const bodyParts: string[] = [];
    if (metaProps.headerLines.length > 0) {
      bodyParts.push(metaProps.headerLines.join('\n'));
    }
    if (blocksMd) {
      bodyParts.push(blocksMd);
    }
    const fullBody = bodyParts.join('\n\n').slice(0, 50000);

    const key = title.trim().toLowerCase();
    const existing = options.mode === 'merge' ? existingByTitle.get(key) : undefined;
    const category = mapToNoteCategory(metaProps.categoryHint, metaProps.tags);

    if (existing) {
      const mergedTags = Array.from(new Set([...(existing.tags || []), ...metaProps.tags])).slice(0, 50);
      const updatedNote: NoteNode = {
        ...existing,
        body: fullBody,
        tags: mergedTags,
        category: category !== 'general' ? category : existing.category,
        updatedAt: now,
      };
      importedNotes.push(updatedNote);
      notionIdToNoteId.set(normNotionId, updatedNote.id);
      titleToId.set(key, updatedNote.id);
      pageMentionsByNoteId.set(updatedNote.id, mentionedIds);
      updatedCount += 1;
    } else {
      const pos = computeSpiralPosition(i, baseIndex);
      const newNote: NoteNode = {
        id: `note-notion-${normNotionId.slice(0, 12)}-${crypto.randomUUID().slice(0, 4)}`,
        title,
        body: fullBody,
        tags: metaProps.tags,
        layerId: options.layerId,
        category,
        x: pos.x,
        y: pos.y,
        pinned: false,
        createdAt: now,
        updatedAt: now,
      };
      importedNotes.push(newNote);
      notionIdToNoteId.set(normNotionId, newNote.id);
      titleToId.set(key, newNote.id);
      pageMentionsByNoteId.set(newNote.id, mentionedIds);
      createdCount += 1;
    }
  }

  // Create NoteLinks from Notion page mentions AND [[wiki-links]] inside text
  const existingLinkKeys = new Set(options.existingLinks.map((l) => `${l.fromId}=>${l.toId}`));
  const createdLinks: NoteLink[] = [];

  for (const note of importedNotes) {
    const mentions = pageMentionsByNoteId.get(note.id) || new Set<string>();
    for (const targetNotionId of mentions) {
      const targetNoteId = notionIdToNoteId.get(targetNotionId);
      if (!targetNoteId || targetNoteId === note.id) continue;
      const pairKey = `${note.id}=>${targetNoteId}`;
      if (existingLinkKeys.has(pairKey)) continue;
      existingLinkKeys.add(pairKey);
      createdLinks.push({
        id: `link-${note.id}-${targetNoteId}`,
        fromId: note.id,
        toId: targetNoteId,
        type: 'link',
      });
    }

    // Also resolve [[Wiki Links]] present inside Notion text
    const wikiMatches = note.body.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g);
    for (const m of wikiMatches) {
      const targetTitle = m[1]?.trim().toLowerCase();
      const targetNoteId = targetTitle ? titleToId.get(targetTitle) : undefined;
      if (!targetNoteId || targetNoteId === note.id) continue;
      const pairKey = `${note.id}=>${targetNoteId}`;
      if (existingLinkKeys.has(pairKey)) continue;
      existingLinkKeys.add(pairKey);
      createdLinks.push({
        id: `link-${note.id}-${targetNoteId}`,
        fromId: note.id,
        toId: targetNoteId,
        ...(m[2]?.trim() ? { label: m[2].trim().slice(0, 120) } : {}),
        type: 'link',
      });
    }
  }

  return {
    notes: importedNotes,
    links: createdLinks,
    createdCount,
    updatedCount,
    linksCreatedCount: createdLinks.length,
  };
}
