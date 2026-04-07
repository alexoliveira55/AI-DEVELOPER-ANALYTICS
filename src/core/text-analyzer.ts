/**
 * Lightweight NLP utilities for Portuguese/English text processing.
 * Provides stemming, normalization, synonym expansion, and semantic
 * matching without external dependencies.
 */

/** Synonym groups mapping a canonical term to its variations. */
const SYNONYM_GROUPS: { canonical: string; terms: string[] }[] = [
  { canonical: 'customer', terms: ['cliente', 'client', 'customer', 'consumidor', 'comprador', 'usuario', 'user'] },
  { canonical: 'product', terms: ['produto', 'product', 'item', 'mercadoria', 'artigo'] },
  { canonical: 'order', terms: ['pedido', 'order', 'venda', 'sale', 'compra', 'purchase', 'encomenda'] },
  { canonical: 'payment', terms: ['pagamento', 'payment', 'cobranca', 'fatura', 'invoice', 'billing'] },
  { canonical: 'authentication', terms: ['autenticacao', 'login', 'auth', 'signin', 'sign-in', 'logon'] },
  { canonical: 'authorization', terms: ['autorizacao', 'permission', 'permissao', 'role', 'papel', 'acesso', 'access'] },
  { canonical: 'registration', terms: ['cadastro', 'registro', 'registration', 'signup', 'sign-up'] },
  { canonical: 'report', terms: ['relatorio', 'report', 'dashboard', 'grafico', 'chart', 'analytics'] },
  { canonical: 'notification', terms: ['notificacao', 'notification', 'alerta', 'alert', 'aviso', 'email', 'sms'] },
  { canonical: 'inventory', terms: ['estoque', 'inventory', 'stock', 'armazem', 'warehouse'] },
  { canonical: 'shipping', terms: ['envio', 'entrega', 'shipping', 'delivery', 'frete', 'freight', 'logistica'] },
  { canonical: 'category', terms: ['categoria', 'category', 'classificacao', 'tipo', 'type', 'grupo', 'group'] },
  { canonical: 'address', terms: ['endereco', 'address', 'localizacao', 'location', 'cep', 'zipcode'] },
  { canonical: 'employee', terms: ['funcionario', 'employee', 'colaborador', 'worker', 'staff'] },
  { canonical: 'schedule', terms: ['agendamento', 'schedule', 'agenda', 'horario', 'booking', 'reserva'] },
  { canonical: 'document', terms: ['documento', 'document', 'arquivo', 'file', 'anexo', 'attachment'] },
  { canonical: 'configuration', terms: ['configuracao', 'configuration', 'config', 'settings', 'preferencia'] },
  { canonical: 'search', terms: ['busca', 'pesquisa', 'search', 'consulta', 'query', 'filtro', 'filter'] },
];

/** Map of domain categories to keywords that hint at belonging to that category. */
const CATEGORY_HINTS: Record<string, string[]> = {
  data: ['cadastro', 'registro', 'crud', 'tabela', 'banco', 'persistir', 'salvar', 'armazenar',
    'listar', 'consultar', 'buscar', 'filtrar', 'excluir', 'deletar', 'editar', 'atualizar',
    'create', 'read', 'update', 'delete', 'store', 'persist', 'save', 'list', 'query'],
  api: ['endpoint', 'rota', 'api', 'rest', 'graphql', 'requisicao', 'request', 'response',
    'route', 'controller', 'get', 'post', 'put', 'patch'],
  security: ['autenticacao', 'autorizacao', 'permissao', 'login', 'senha', 'token', 'jwt',
    'criptografia', 'hash', 'acesso', 'papel', 'role', 'guard', 'auth', 'password', 'encrypt'],
  ui: ['tela', 'formulario', 'pagina', 'componente', 'interface', 'botao', 'campo',
    'modal', 'menu', 'navegacao', 'layout', 'responsivo', 'screen', 'form', 'page', 'button'],
  integration: ['webhook', 'email', 'notificacao', 'sms', 'fila', 'mensageria', 'evento',
    'externa', 'terceiro', 'api-externa', 'importacao', 'exportacao', 'queue', 'message', 'event'],
  workflow: ['fluxo', 'processo', 'etapa', 'aprovacao', 'status', 'transicao', 'estado',
    'workflow', 'pipeline', 'fila', 'agendamento', 'cron', 'step', 'approval', 'state'],
  testing: ['teste', 'test', 'spec', 'coverage', 'mock', 'stub', 'fixture', 'e2e', 'unit', 'integration'],
  infrastructure: ['deploy', 'ci', 'cd', 'pipeline', 'docker', 'infra', 'container', 'kubernetes',
    'monitoring', 'log', 'observability'],
};

/** Portuguese suffixes removed during stemming, longest first. */
const PT_SUFFIXES = [
  'amentos', 'imentos', 'amento', 'imento', 'ações', 'acoes', 'ições', 'icoes',
  'mente', 'ência', 'encia', 'ância', 'ancia', 'ável', 'avel', 'ível', 'ivel',
  'ador', 'edor', 'idor', 'ação', 'acao', 'ição', 'icao', 'ante', 'ente', 'inte',
  'ando', 'endo', 'indo', 'ados', 'idos', 'ções', 'coes',
  'ão', 'ao', 'ão', 'ar', 'er', 'ir', 'os', 'as', 'es', 'is',
];

export class TextAnalyzer {
  /**
   * Simplified RSLP-like stemmer for Portuguese.
   * Removes common suffixes to find the root form.
   */
  stem(word: string): string {
    let w = this.removeAccents(word.toLowerCase());
    if (w.length <= 3) return w;

    for (const suffix of PT_SUFFIXES) {
      if (w.endsWith(suffix) && w.length - suffix.length >= 3) {
        return w.slice(0, -suffix.length);
      }
    }
    return w;
  }

  /** Remove accents and diacritical marks. */
  removeAccents(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  /** Normalize a word: lowercase, remove accents, trim. */
  normalize(word: string): string {
    return this.removeAccents(word.toLowerCase().trim());
  }

  /**
   * Tokenize a camelCase or PascalCase name into separate words.
   * e.g., "ClienteService" → ["cliente", "service"]
   */
  tokenizeCamelCase(name: string): string[] {
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .split(/[\s_\-]+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length >= 2);
  }

  /**
   * Expand a list of keywords with synonyms from the synonym dictionary.
   * Returns the original keywords plus any canonical/variant matches.
   */
  expandSynonyms(keywords: string[]): string[] {
    const expanded = new Set(keywords);
    for (const kw of keywords) {
      const kwNorm = this.normalize(kw);
      for (const group of SYNONYM_GROUPS) {
        const match = group.terms.some((t) => {
          const tNorm = this.normalize(t);
          return tNorm === kwNorm || tNorm.includes(kwNorm) || kwNorm.includes(tNorm);
        });
        if (match) {
          for (const t of group.terms) {
            expanded.add(this.normalize(t));
          }
        }
      }
    }
    return [...expanded];
  }

  /**
   * Compute a match score (0–1) between a query text and a target name/text.
   * Uses normalized token overlap with synonym expansion.
   */
  matchScore(query: string, target: string): number {
    const queryTokens = this.extractTokens(query);
    const targetTokens = [
      ...this.extractTokens(target),
      ...this.tokenizeCamelCase(target),
    ];

    const queryExpanded = this.expandSynonyms(queryTokens);
    const targetNormalized = targetTokens.map((t) => this.normalize(t));
    const targetStems = targetNormalized.map((t) => this.stem(t));

    let matches = 0;
    for (const q of queryExpanded) {
      const qStem = this.stem(q);
      if (
        targetNormalized.some((t) => t.includes(q) || q.includes(t)) ||
        targetStems.some((t) => t === qStem || t.includes(qStem) || qStem.includes(t))
      ) {
        matches++;
      }
    }

    return queryExpanded.length > 0 ? matches / queryExpanded.length : 0;
  }

  /**
   * Classify text into a domain category with confidence.
   */
  classifyCategory(text: string): { category: string; confidence: number; subcategories: string[] } {
    const tokens = this.extractTokens(text);
    const normalizedTokens = tokens.map((t) => this.normalize(t));
    const expanded = this.expandSynonyms(normalizedTokens);

    const scores: Record<string, number> = {};
    for (const [category, hints] of Object.entries(CATEGORY_HINTS)) {
      let score = 0;
      for (const hint of hints) {
        const hintNorm = this.normalize(hint);
        if (expanded.some((t) => t === hintNorm || t.includes(hintNorm) || hintNorm.includes(t))) {
          score++;
        }
      }
      if (score > 0) scores[category] = score;
    }

    const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
    if (sorted.length === 0) {
      return { category: 'general', confidence: 0.3, subcategories: [] };
    }

    const [topCategory, topScore] = sorted[0];
    const totalHints = CATEGORY_HINTS[topCategory].length;
    const confidence = Math.min(1, topScore / Math.max(3, totalHints * 0.3));
    const subcategories = sorted.slice(1, 3).map(([cat]) => cat);

    return { category: topCategory, confidence, subcategories };
  }

  /**
   * Detect priority from text with more comprehensive patterns.
   */
  detectPriority(text: string): 'must' | 'should' | 'could' {
    const lower = this.normalize(text);
    if (/\b(must|critical|required|essential|obrigatori|precis[ao]|fundamental|imprescindivel|necessari)\b/.test(lower)) return 'must';
    if (/\b(could|nice.to.have|optional|desejavel|poderia|futuro|possivel|ideal)\b/.test(lower)) return 'could';
    return 'should';
  }

  /**
   * Extract meaningful tokens from text, filtering stopwords.
   */
  extractTokens(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
      'should', 'may', 'might', 'can', 'could', 'must', 'need', 'to', 'of',
      'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
      'that', 'this', 'and', 'but', 'or', 'not', 'so', 'if', 'when', 'new',
      'de', 'da', 'do', 'das', 'dos', 'em', 'na', 'no', 'nas', 'nos',
      'um', 'uma', 'uns', 'umas', 'para', 'com', 'por', 'que', 'se',
      'como', 'mais', 'sua', 'seu', 'seus', 'suas', 'ser', 'ter', 'estar',
      'existing', 'module', 'using', 'follow', 'apply', 'implement',
      'integrate', 'enforce', 'validate', 'review', 'modify', 'create',
    ]);
    const words = this.normalize(text).match(/\b[a-z]{3,}\b/g) ?? [];
    return [...new Set(words.filter((w) => !stopWords.has(w)))];
  }
}
