/**
 * FORJA DE MUNDOS — Compositor Gramatical em Português (PT-BR) (§3)
 *
 * Gramática de unificação com léxico morfológico para concordância estrita de
 * gênero, número, artigos, preposições combinadas e adjetivos.
 * Proibição (§3.2): sem concatenação crua de templates; todo texto passa pelo compositor.
 */

export type Genero = 'm' | 'f';
export type Numero = 's' | 'p';

export interface MorfemaSubstantivo {
  texto: string;
  genero: Genero;
  numero: Numero;
  formas?: {
    f?: string;
    mp?: string;
    fp?: string;
  };
}

export interface MorfemaAdjetivo {
  m_s: string;
  f_s: string;
  m_p: string;
  f_p: string;
}

/**
 * Léxico morfológico base de substantivos comuns no contexto TTRPG
 */
export const LEXICO_SUBSTANTIVOS: Record<string, MorfemaSubstantivo> = {
  ferreiro: { texto: 'ferreiro', genero: 'm', numero: 's', formas: { f: 'ferreira', mp: 'ferreiros', fp: 'ferreiras' } },
  taverneiro: { texto: 'taverneiro', genero: 'm', numero: 's', formas: { f: 'taverneira', mp: 'taverneiros', fp: 'taverneiras' } },
  mago: { texto: 'mago', genero: 'm', numero: 's', formas: { f: 'maga', mp: 'magos', fp: 'magas' } },
  feiticeiro: { texto: 'feiticeiro', genero: 'm', numero: 's', formas: { f: 'feiticeira', mp: 'feiticeiros', fp: 'feiticeiras' } },
  clerigo: { texto: 'clérigo', genero: 'm', numero: 's', formas: { f: 'clériga', mp: 'clérigos', fp: 'clérigas' } },
  ladrao: { texto: 'ladrão', genero: 'm', numero: 's', formas: { f: 'ladra', mp: 'ladrões', fp: 'ladras' } },
  guerreiro: { texto: 'guerreiro', genero: 'm', numero: 's', formas: { f: 'guerreira', mp: 'guerreiros', fp: 'guerreiras' } },
  guardiao: { texto: 'guardião', genero: 'm', numero: 's', formas: { f: 'guardiã', mp: 'guardiões', fp: 'guardiãs' } },
  rei: { texto: 'rei', genero: 'm', numero: 's', formas: { f: 'rainha', mp: 'reis', fp: 'rainhas' } },
  capitao: { texto: 'capitão', genero: 'm', numero: 's', formas: { f: 'capitã', mp: 'capitães', fp: 'capitãs' } },
  vilao: { texto: 'vilão', genero: 'm', numero: 's', formas: { f: 'vilã', mp: 'vilões', fp: 'vilãs' } },
  cavaleiro: { texto: 'cavaleiro', genero: 'm', numero: 's', formas: { f: 'cavaleira', mp: 'cavaleiros', fp: 'cavaleiras' } },
  monge: { texto: 'monge', genero: 'm', numero: 's', formas: { f: 'monja', mp: 'monges', fp: 'monjas' } },
  druida: { texto: 'druida', genero: 'm', numero: 's', formas: { f: 'druida', mp: 'druidas', fp: 'druidas' } },
  artesao: { texto: 'artesão', genero: 'm', numero: 's', formas: { f: 'artesã', mp: 'artesãos', fp: 'artesãs' } },
  mercador: { texto: 'mercador', genero: 'm', numero: 's', formas: { f: 'mercadora', mp: 'mercadores', fp: 'mercadoras' } },
  alquimista: { texto: 'alquimista', genero: 'm', numero: 's', formas: { f: 'alquimista', mp: 'alquimistas', fp: 'alquimistas' } },
  espadachim: { texto: 'espadachim', genero: 'm', numero: 's', formas: { f: 'espadachim', mp: 'espadachins', fp: 'espadachins' } },
  bardo: { texto: 'bardo', genero: 'm', numero: 's', formas: { f: 'barda', mp: 'bardos', fp: 'bardas' } },
  cacador: { texto: 'caçador', genero: 'm', numero: 's', formas: { f: 'caçadora', mp: 'caçadores', fp: 'caçadoras' } },

  // Itens e Locais
  espada: { texto: 'espada', genero: 'f', numero: 's', formas: { mp: 'espadas', fp: 'espadas' } },
  adaga: { texto: 'adaga', genero: 'f', numero: 's', formas: { mp: 'adagas', fp: 'adagas' } },
  machado: { texto: 'machado', genero: 'm', numero: 's', formas: { mp: 'machados', fp: 'machados' } },
  arco: { texto: 'arco', genero: 'm', numero: 's', formas: { mp: 'arcos', fp: 'arcos' } },
  escudo: { texto: 'escudo', genero: 'm', numero: 's', formas: { mp: 'escudos', fp: 'escudos' } },
  armadura: { texto: 'armadura', genero: 'f', numero: 's', formas: { mp: 'armaduras', fp: 'armaduras' } },
  elmo: { texto: 'elmo', genero: 'm', numero: 's', formas: { mp: 'elmos', fp: 'elmos' } },
  anel: { texto: 'anel', genero: 'm', numero: 's', formas: { mp: 'anéis', fp: 'anéis' } },
  pocao: { texto: 'poção', genero: 'f', numero: 's', formas: { mp: 'poções', fp: 'poções' } },
  amuleto: { texto: 'amuleto', genero: 'm', numero: 's', formas: { mp: 'amuletos', fp: 'amuletos' } },
  grimorio: { texto: 'grimório', genero: 'm', numero: 's', formas: { mp: 'grimórios', fp: 'grimórios' } },
  pergaminho: { texto: 'pergaminho', genero: 'm', numero: 's', formas: { mp: 'pergaminhos', fp: 'pergaminhos' } },
  castelo: { texto: 'castelo', genero: 'm', numero: 's', formas: { mp: 'castelos', fp: 'castelos' } },
  torre: { texto: 'torre', genero: 'f', numero: 's', formas: { mp: 'torres', fp: 'torres' } },
  masmorra: { texto: 'masmorra', genero: 'f', numero: 's', formas: { mp: 'masmorras', fp: 'masmorras' } },
  caverna: { texto: 'caverna', genero: 'f', numero: 's', formas: { mp: 'cavernas', fp: 'cavernas' } },
  templo: { texto: 'templo', genero: 'm', numero: 's', formas: { mp: 'templos', fp: 'templos' } },
  ruina: { texto: 'ruína', genero: 'f', numero: 's', formas: { mp: 'ruínas', fp: 'ruínas' } },
  vila: { texto: 'vila', genero: 'f', numero: 's', formas: { mp: 'vilas', fp: 'vilas' } },
  cidade: { texto: 'cidade', genero: 'f', numero: 's', formas: { mp: 'cidades', fp: 'cidades' } },
  fortaleza: { texto: 'fortaleza', genero: 'f', numero: 's', formas: { mp: 'fortalezas', fp: 'fortalezas' } },
  floresta: { texto: 'floresta', genero: 'f', numero: 's', formas: { mp: 'florestas', fp: 'florestas' } },
  montanha: { texto: 'montanha', genero: 'f', numero: 's', formas: { mp: 'montanhas', fp: 'montanhas' } },
  rio: { texto: 'rio', genero: 'm', numero: 's', formas: { mp: 'rios', fp: 'rios' } },
  ponte: { texto: 'ponte', genero: 'f', numero: 's', formas: { mp: 'pontes', fp: 'pontes' } },
};

/**
 * Léxico morfológico de adjetivos com 4 formas de flexão
 */
export const LEXICO_ADJETIVOS: Record<string, MorfemaAdjetivo> = {
  antigo: { m_s: 'antigo', f_s: 'antiga', m_p: 'antigos', f_p: 'antigas' },
  novo: { m_s: 'novo', f_s: 'nova', m_p: 'novos', f_p: 'novas' },
  poderoso: { m_s: 'poderoso', f_s: 'poderosa', m_p: 'poderosos', f_p: 'poderosas' },
  sombrio: { m_s: 'sombrio', f_s: 'sombria', m_p: 'sombrios', f_p: 'sombrias' },
  sagrado: { m_s: 'sagrado', f_s: 'sagrada', m_p: 'sagrados', f_p: 'sagradas' },
  maldito: { m_s: 'maldito', f_s: 'maldita', m_p: 'malditos', f_p: 'malditas' },
  antiquado: { m_s: 'antiquado', f_s: 'antiquada', m_p: 'antiquados', f_p: 'antiquadas' },
  feroz: { m_s: 'feroz', f_s: 'feroz', m_p: 'ferozes', f_p: 'ferozes' },
  grande: { m_s: 'grande', f_s: 'grande', m_p: 'grandes', f_p: 'grandes' },
  pequeno: { m_s: 'pequeno', f_s: 'pequena', m_p: 'pequenos', f_p: 'pequenas' },
  dourado: { m_s: 'dourado', f_s: 'dourada', m_p: 'dourados', f_p: 'douradas' },
  prateado: { m_s: 'prateado', f_s: 'prateada', m_p: 'prateados', f_p: 'prateadas' },
  enferrujado: { m_s: 'enferrujado', f_s: 'enferrujada', m_p: 'enferrujados', f_p: 'enferrujadas' },
  esquecido: { m_s: 'esquecido', f_s: 'esquecida', m_p: 'esquecidos', f_p: 'esquecidas' },
  silencioso: { m_s: 'silencioso', f_s: 'silenciosa', m_p: 'silenciosos', f_p: 'silenciosas' },
  traicoeiro: { m_s: 'traiçoeiro', f_s: 'traiçoeira', m_p: 'traiçoeiros', f_p: 'traiçoeiras' },
  letal: { m_s: 'letal', f_s: 'letal', m_p: 'letais', f_p: 'letais' },
  corrompido: { m_s: 'corrompido', f_s: 'corrompida', m_p: 'corrompidos', f_p: 'corrompidas' },
  luminoso: { m_s: 'luminoso', f_s: 'luminosa', m_p: 'luminosos', f_p: 'luminosas' },
  arcano: { m_s: 'arcano', f_s: 'arcana', m_p: 'arcanos', f_p: 'arcanas' },
};

/**
 * Retorna o artigo definido correto de acordo com gênero e número
 */
export function artigoDefinido(genero: Genero, numero: Numero): string {
  if (numero === 'p') {
    return genero === 'm' ? 'os' : 'as';
  }
  return genero === 'm' ? 'o' : 'a';
}

/**
 * Retorna o artigo indefinido correto
 */
export function artigoIndefinido(genero: Genero, numero: Numero): string {
  if (numero === 'p') {
    return genero === 'm' ? 'uns' : 'umas';
  }
  return genero === 'm' ? 'um' : 'uma';
}

/**
 * Contração da preposição 'de' com artigo
 */
export function contracaoDe(genero: Genero, numero: Numero): string {
  if (numero === 'p') {
    return genero === 'm' ? 'dos' : 'das';
  }
  return genero === 'm' ? 'do' : 'da';
}

/**
 * Contração da preposição 'em' com artigo
 */
export function contracaoEm(genero: Genero, numero: Numero): string {
  if (numero === 'p') {
    return genero === 'm' ? 'nos' : 'nas';
  }
  return genero === 'm' ? 'no' : 'na';
}

/**
 * Contração da preposição 'a' com artigo
 */
export function contracaoA(genero: Genero, numero: Numero): string {
  if (numero === 'p') {
    return genero === 'm' ? 'aos' : 'às';
  }
  return genero === 'm' ? 'ao' : 'à';
}

/**
 * Concorda um adjetivo com base no gênero e número
 */
export function concordarAdjetivo(adjetivoKey: string, genero: Genero, numero: Numero): string {
  const normKey = adjetivoKey.toLowerCase().trim();
  const entry = LEXICO_ADJETIVOS[normKey];
  if (entry) {
    if (genero === 'm' && numero === 's') return entry.m_s;
    if (genero === 'f' && numero === 's') return entry.f_s;
    if (genero === 'm' && numero === 'p') return entry.m_p;
    if (genero === 'f' && numero === 'p') return entry.f_p;
  }

  // Regra morfológica de fallback para adjetivos regulares em -o/-a
  if (normKey.endsWith('o')) {
    const base = normKey.slice(0, -1);
    if (genero === 'f' && numero === 's') return `${base}a`;
    if (genero === 'm' && numero === 'p') return `${base}os`;
    if (genero === 'f' && numero === 'p') return `${base}as`;
    return normKey;
  }
  if (normKey.endsWith('oso')) {
    const base = normKey.slice(0, -3);
    if (genero === 'f' && numero === 's') return `${base}osa`;
    if (genero === 'm' && numero === 'p') return `${base}osos`;
    if (genero === 'f' && numero === 'p') return `${base}osas`;
  }
  if (numero === 'p') {
    if (normKey.endsWith('l')) return `${normKey.slice(0, -1)}is`;
    if (normKey.endsWith('z') || normKey.endsWith('r') || normKey.endsWith('s')) return `${normKey}es`;
    return `${normKey}s`;
  }
  return normKey;
}

/**
 * Flexiona substantivo por gênero e número
 */
export function flexionarSubstantivo(chave: string, genero: Genero, numero: Numero): string {
  const norm = chave.toLowerCase().trim();
  const entry = LEXICO_SUBSTANTIVOS[norm];
  if (!entry) return chave;

  if (numero === 'p') {
    if (genero === 'f' && entry.formas?.fp) return entry.formas.fp;
    if (entry.formas?.mp) return entry.formas.mp;
  } else {
    if (genero === 'f' && entry.formas?.f) return entry.formas.f;
  }
  return entry.texto;
}

/**
 * Resolve concordância de grupo misto (§3.1):
 * Precedência do masculino plural
 */
export function concordarGrupoMisto(elementos: { genero: Genero; numero: Numero }[]): {
  genero: Genero;
  numero: Numero;
} {
  if (elementos.length === 0) return { genero: 'm', numero: 's' };
  if (elementos.length === 1) return { ...elementos[0] };

  const hasMasculino = elementos.some((e) => e.genero === 'm');
  return {
    genero: hasMasculino ? 'm' : 'f',
    numero: 'p',
  };
}

/**
 * Compositor Unificado PT-BR (§3.1 & §3.2)
 *
 * Processa marcações morfológicas:
 * - [art:def:substantivo_ref] -> o / a / os / as
 * - [art:indef:substantivo_ref] -> um / uma / uns / umas
 * - [de:substantivo_ref] -> do / da / dos / das
 * - [em:substantivo_ref] -> no / na / nos / nas
 * - [a:substantivo_ref] -> ao / à / aos / às
 * - [adj:chave:substantivo_ref] -> adjetivo flexionado
 * - {{var}} -> valor mapeado no contexto com checagem de morfologia
 */
export function comporTextoPT(
  template: string,
  contexto: Record<string, { texto: string; genero: Genero; numero: Numero } | string>
): string {
  let resultado = template;

  // Normaliza entradas de contexto
  const ctxNormalizado: Record<string, { texto: string; genero: Genero; numero: Numero }> = {};
  for (const [k, v] of Object.entries(contexto)) {
    if (typeof v === 'string') {
      const matchLex = LEXICO_SUBSTANTIVOS[v.toLowerCase().trim()];
      ctxNormalizado[k] = {
        texto: v,
        genero: matchLex?.genero || 'm',
        numero: matchLex?.numero || 's',
      };
    } else {
      ctxNormalizado[k] = v;
    }
  }

  // Preposições e Artigos combinados
  resultado = resultado.replace(/\[(art:def|art:indef|de|em|a):([a-zA-Z0-9_]+)\]/g, (_, tag, varName) => {
    const item = ctxNormalizado[varName];
    const gen: Genero = item ? item.genero : 'm';
    const num: Numero = item ? item.numero : 's';

    switch (tag) {
      case 'art:def':
        return artigoDefinido(gen, num);
      case 'art:indef':
        return artigoIndefinido(gen, num);
      case 'de':
        return contracaoDe(gen, num);
      case 'em':
        return contracaoEm(gen, num);
      case 'a':
        return contracaoA(gen, num);
      default:
        return '';
    }
  });

  // Adjetivos concordados
  resultado = resultado.replace(/\[adj:([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)\]/g, (_, adjKey, varName) => {
    const item = ctxNormalizado[varName];
    const gen: Genero = item ? item.genero : 'm';
    const num: Numero = item ? item.numero : 's';
    return concordarAdjetivo(adjKey, gen, num);
  });

  // Interpolação de variáveis simples {{var}}
  resultado = resultado.replace(/\{\{([a-zA-Z0-9_:]+)\}\}/g, (match, varKey) => {
    // suporte para {{prefixo:chave}}
    const parts = varKey.split(':');
    const cleanKey = parts[parts.length - 1];
    if (ctxNormalizado[cleanKey]) {
      return ctxNormalizado[cleanKey].texto;
    }
    if (ctxNormalizado[varKey]) {
      return ctxNormalizado[varKey].texto;
    }
    return match;
  });

  // Ajusta capitalização de início de frases e pontuação duplicada
  resultado = resultado
    .replace(/\s+/g, ' ')
    .replace(/\s([,.;:?!])/g, '$1')
    .replace(/(^|[.?!]\s+)([a-zà-ú])/g, (_, p1, p2) => p1 + p2.toUpperCase())
    .trim();

  return resultado;
}
