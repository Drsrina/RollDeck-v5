import { z } from 'zod';
import { executeRoll, rollSingleDieRaw, STANDARD_DICE } from '../roll';
import { gerarItem } from '../forja/itemGenerator';
import type { AISettings, LootColumn, LootGenerator, LootGroup, LootItem } from '../../types';

export interface GenerateLootOptions {
  generator: LootGenerator;
  aiSettings?: AISettings;
  countOverride?: number;
  abortSignal?: AbortSignal;
  onItemRevealed?: (item: LootItem, index: number, total: number) => void;
}

/**
 * Builds a dynamic Zod schema based on the generator's active columns
 */
export function buildDynamicColumnsSchema(columns: LootColumn[]) {
  const activeCols = columns.filter((c) => c.enabled);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const col of activeCols) {
    let fieldSchema: z.ZodTypeAny;

    switch (col.type) {
      case 'number':
        fieldSchema = z.union([z.number(), z.string().transform((v) => parseFloat(v) || 0)]);
        break;
      case 'currency':
        fieldSchema = z.union([
          z.number(),
          z.string().transform((v) => {
            const num = parseFloat(v.replace(/[^0-9.-]/g, ''));
            return isNaN(num) ? 0 : num;
          }),
        ]);
        break;
      case 'boolean':
        fieldSchema = z.union([
          z.boolean(),
          z.string().transform((v) => v.toLowerCase() === 'true' || v.toLowerCase() === 'sim'),
        ]);
        break;
      case 'tags':
      case 'multi_choice':
        fieldSchema = z.union([
          z.array(z.string()),
          z.string().transform((v) => v.split(',').map((s) => s.trim())),
        ]);
        break;
      case 'single_choice':
        if (col.options && col.options.length > 0) {
          fieldSchema = z.string();
        } else {
          fieldSchema = z.string();
        }
        break;
      default:
        fieldSchema = z.string();
    }

    if (!col.required) {
      fieldSchema = fieldSchema.optional().nullable().default(null);
    }

    shape[col.key] = fieldSchema;
  }

  const itemSchema = z.object(shape).passthrough();
  return z.object({
    title: z.string().optional(),
    items: z.array(itemSchema),
  });
}

/**
 * Sanitizes and extracts pure JSON from an AI response string
 */
export function extractAndParseJSON(rawText: string): any {
  if (!rawText) throw new Error('Resposta vazia da IA.');

  let cleaned = rawText.trim();

  // Remove markdown code fences if present (```json ... ```)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  } else {
    // If there is text before { or [, trim it
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIdx = 0;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
    }

    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
      cleaned = cleaned.slice(startIdx, endIdx + 1).trim();
    }
  }

  // Handle case where AI responds with a bare array [...] instead of {"items":[...]}
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return { items: parsed };
    }
    return parsed;
  } catch (err: any) {
    // Attempt basic JSON repairs (trailing commas, unbalanced brackets)
    let repaired = cleaned.replace(/,\s*([}\]])/g, '$1');
    try {
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed)) return { items: parsed };
      return parsed;
    } catch {
      throw new Error(`Não foi possível interpretar o JSON da IA: ${err.message}`);
    }
  }
}

/**
 * Evaluates real cryptographic dice rolls for any columns with type 'dice_formula'
 */
export function evaluateItemDiceRolls(itemCells: Record<string, any>, columns: LootColumn[]): {
  cells: Record<string, any>;
  rolledValues: Record<string, { formula: string; result: number }>;
} {
  const evaluatedCells = { ...itemCells };
  const rolledValues: Record<string, { formula: string; result: number }> = {};

  const diceLookup = new Map(STANDARD_DICE.map((d) => [d.id, d]));

  for (const col of columns) {
    if (col.type === 'dice_formula') {
      const rawFormula = String(evaluatedCells[col.key] || '1d6').trim();
      // Match formulas like 2d6, 1d20+5, 3d8-2
      const match = rawFormula.match(/(\d+)d(\d+)(?:([+-])(\d+))?/i);
      if (match) {
        const count = parseInt(match[1], 10);
        const sides = parseInt(match[2], 10);
        const sign = match[3];
        const modNum = match[4] ? parseInt(match[4], 10) : 0;
        const modifier = sign === '-' ? -modNum : modNum;

        let sum = 0;
        for (let i = 0; i < count; i++) {
          sum += rollSingleDieRaw(sides);
        }
        const total = sum + modifier;
        rolledValues[col.key] = { formula: rawFormula, result: total };
        evaluatedCells[col.key] = `${rawFormula} ➔ [${total}]`;
      }
    }
  }

  return { cells: evaluatedCells, rolledValues };
}

/**
 * Calculates group totals (Value in currency, total weight, total item count)
 */
export function calculateGroupTotals(items: LootItem[], columns: LootColumn[]): {
  totalValueText: string;
  totalWeightText?: string;
  itemCount: number;
} {
  const valueCol = columns.find((c) => c.type === 'currency' && c.enabled);
  const weightCol = columns.find((c) => c.key === 'weight' && c.enabled);

  let totalValue = 0;
  let hasValue = false;
  let currencyUnit = valueCol?.currencyConfig?.unit || 'PO';

  let totalWeight = 0;
  let hasWeight = false;

  for (const item of items) {
    if (valueCol && item.cells[valueCol.key] !== undefined) {
      const val = parseFloat(String(item.cells[valueCol.key]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(val)) {
        totalValue += val;
        hasValue = true;
      }
    }

    if (weightCol && item.cells[weightCol.key] !== undefined) {
      const w = parseFloat(String(item.cells[weightCol.key]).replace(/[^0-9.-]/g, ''));
      if (!isNaN(w)) {
        totalWeight += w;
        hasWeight = true;
      }
    }
  }

  return {
    totalValueText: hasValue ? `${totalValue.toLocaleString('pt-BR')} ${currencyUnit}` : 'N/A',
    totalWeightText: hasWeight ? `${totalWeight.toFixed(1)} kg` : undefined,
    itemCount: items.length,
  };
}

/**
 * Generates prompt instructions for the AI model
 */
export function constructLootPrompt(generator: LootGenerator, count: number): string {
  const activeCols = generator.columns.filter((c) => c.enabled);

  const columnsInstructions = activeCols
    .map((c) => {
      let extra = '';
      if (c.type === 'single_choice' && c.options?.length) {
        extra = ` (opções permitidas: ${c.options.join(', ')})`;
      } else if (c.type === 'currency') {
        extra = ` (número numérico em ${c.currencyConfig?.unit || 'moedas'})`;
      } else if (c.type === 'dice_formula') {
        extra = ` (fórmula de dado TTRPG como 1d8, 2d6+2)`;
      }
      return `- "${c.key}" (${c.type}): ${c.instruction}${extra}`;
    })
    .join('\n');

  return `Você é um mestre experiente de TTRPG e designer de itens temáticos de alta fantasia e ficção.
Crie um lote de exatamente ${count} itens de loot inspirados no tema abaixo.

TEMA DO GERADOR:
${generator.theme}

${generator.instructions ? `INSTRUÇÕES ADICIONAIS:\n${generator.instructions}\n` : ''}
PARÂMETROS:
- Raridade desejada: ${generator.params.rarity}
- Idioma de saída: ${generator.params.language || 'Português do Brasil'}
- Criatividade: ${generator.params.creativity}

COLUNAS OBRIGATÓRIAS POR ITEM:
${columnsInstructions}

IMPORTANTE: Responda ESTRITAMENTE em formato JSON puro, sem introduções ou comentários antes ou depois, seguindo esta estrutura:
{
  "title": "Título evocativo para este lote de tesouro",
  "items": [
    {
      ${activeCols.map((c) => `"${c.key}": ...`).join(',\n      ')}
    }
  ]
}`;
}

/**
 * Procedural Fallback generator when offline or no API key is present
 */
export function generateProceduralFallbackLoot(generator: LootGenerator, count: number): {
  title: string;
  items: LootItem[];
} {
  const generatedItems: LootItem[] = [];

  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 900000) + 10000;
    const forjaItem = gerarItem(seed, { permitirMaldicao: true });

    const cells: Record<string, any> = {};
    for (const col of generator.columns.filter((c) => c.enabled)) {
      if (col.key === 'name') cells[col.key] = forjaItem.nome;
      else if (col.key === 'rarity') cells[col.key] = forjaItem.raridade;
      else if (col.key === 'type') cells[col.key] = forjaItem.categoria;
      else if (col.key === 'value') cells[col.key] = forjaItem.valorPO;
      else if (col.key === 'weight') cells[col.key] = forjaItem.categoria === 'Armadura e Escudo' ? 12 : forjaItem.categoria === 'Arma' ? 2.5 : 0.5;
      else if (col.key === 'description') cells[col.key] = forjaItem.propriedadeMagica ? `${forjaItem.descricaoMecanica} (${forjaItem.propriedadeMagica})` : forjaItem.descricaoMecanica;
      else if (col.key === 'history') cells[col.key] = forjaItem.peculiaridade || `Forjado sob o tema "${generator.name}" em antigas eras.`;
      else if (col.type === 'dice_formula') cells[col.key] = forjaItem.descricaoMecanica.includes('d') ? (forjaItem.descricaoMecanica.match(/\d+d\d+(?:\+\d+)?/)?.[0] || '1d8+2') : '1d6';
      else cells[col.key] = 'Padrão';
    }

    const { cells: finalCells, rolledValues } = evaluateItemDiceRolls(cells, generator.columns);

    generatedItems.push({
      id: `loot-item-${crypto.randomUUID()}`,
      cells: finalCells,
      rolledValues,
      isLocked: false,
    });
  }

  return {
    title: `${generator.name} — Lote Offline (${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })})`,
    items: generatedItems,
  };
}

/**
 * Main AI generation dispatch function with offline resilience
 */
export async function generateLootWithAI(options: GenerateLootOptions): Promise<{
  title: string;
  items: LootItem[];
}> {
  const { generator, aiSettings, countOverride, abortSignal, onItemRevealed } = options;
  const count = countOverride || generator.params.count || 6;

  const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const isExplicitOffline = aiSettings?.provider === 'offline-procedural';

  // If user chose explicit offline mode, or device is offline, run procedural immediately
  if (isExplicitOffline || isBrowserOffline || !aiSettings) {
    const result = generateProceduralFallbackLoot(generator, count);
    if (onItemRevealed) {
      for (let i = 0; i < result.items.length; i++) {
        await new Promise((r) => setTimeout(r, 40));
        onItemRevealed(result.items[i], i, result.items.length);
      }
    }
    return result;
  }

  const prompt = constructLootPrompt(generator, count);
  let rawContent = '';

  try {
    if (aiSettings.provider === 'openai-compatible' || aiSettings.provider === 'custom-proxy') {
      // 1. Provedor externo informado pelo usuário com chave própria (OpenAI, Ollama, Groq, etc.)
      const endpoint = aiSettings.endpoint || 'https://api.openai.com/v1/chat/completions';
      const temp = generator.params.creativity === 'conservative' ? 0.3 : generator.params.creativity === 'wild' ? 1.0 : 0.7;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(aiSettings.apiKey ? { Authorization: `Bearer ${aiSettings.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: aiSettings.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: temp,
          response_format: { type: 'json_object' },
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Erro na API (${response.status}): ${errData}`);
      }

      const resJson = await response.json();
      rawContent = resJson.choices?.[0]?.message?.content || '';
    } else if (aiSettings.provider === 'anthropic') {
      // 3. Anthropic Messages API
      const endpoint = aiSettings.endpoint || 'https://api.anthropic.com/v1/messages';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiSettings.apiKey || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: aiSettings.model || 'claude-3-5-haiku-20241022',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Erro na API Anthropic (${response.status}): ${errData}`);
      }

      const resJson = await response.json();
      rawContent = resJson.content?.[0]?.text || '';
    }

    // Parse and validate with dynamic Zod schema
    const parsedData = extractAndParseJSON(rawContent);
    const schema = buildDynamicColumnsSchema(generator.columns);
    const validationResult = schema.safeParse(parsedData);

    const itemsData = parsedData.items || [];
    if (!validationResult.success) {
      console.warn('Zod schema validation warning on AI output:', validationResult.error);
    }

    const title =
      parsedData.title ||
      `${generator.name} — ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const items: LootItem[] = [];
    for (let i = 0; i < itemsData.length; i++) {
      const rawItem = itemsData[i];
      const { cells, rolledValues } = evaluateItemDiceRolls(rawItem, generator.columns);
      const item: LootItem = {
        id: `loot-item-${crypto.randomUUID()}`,
        cells,
        rolledValues,
        isLocked: false,
      };
      items.push(item);
      if (onItemRevealed) {
        onItemRevealed(item, i, itemsData.length);
      }
    }

    return { title, items };
  } catch (err: any) {
    if (err.name === 'AbortError' || err.message?.includes('cancelada')) {
      throw new Error('Geração cancelada pelo usuário.');
    }
    console.warn('Fallback para modo procedural devido a erro:', err.message);
    const fallback = generateProceduralFallbackLoot(generator, count);
    if (onItemRevealed) {
      for (let i = 0; i < fallback.items.length; i++) {
        await new Promise((r) => setTimeout(r, 40));
        onItemRevealed(fallback.items[i], i, fallback.items.length);
      }
    }
    return fallback;
  }
}
