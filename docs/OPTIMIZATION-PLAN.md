# Plano de Otimização — AI Developer Analytics como MCP Server Local

> **Versão**: 1.0  
> **Data**: 06/04/2026  
> **Foco**: Melhorar capacidade analítica de requisitos e estimativas, otimizar para distribuição como MCP Server local

---

## 1. Diagnóstico do Estado Atual

### 1.1 Pontos Fortes Identificados

| Área | Avaliação | Detalhe |
|------|-----------|---------|
| Arquitetura de agentes | ✅ Sólida | Pipeline de 18 etapas com `BaseAgent`, `withLlmFallback`, modos de execução |
| Inferência de requisitos | ✅ Boa base | Cross-reference com repo (services, controllers, auth, validation) e BD (tables, columns, stored procedures) |
| Estimativa componentizada | ✅ Boa base | Breakdown por componente com dependency multiplier, reuse discount, complexity multiplier |
| Análise de impacto | ✅ Multi-fator | Dependency chain tracing, route conflict detection, risk scoring |
| Localização pt-BR | ✅ Consistente | Labels centralizados, sem hardcode de strings |
| Fallback LLM → Offline | ✅ Robusto | One-way fallback com degradação graciosa |

### 1.2 Problemas Críticos Identificados

| # | Problema | Impacto | Severidade |
|---|----------|---------|------------|
| P1 | **Prompts extremamente superficiais** — Os templates em `prompts/*.txt` têm 5–10 linhas genéricas. Não são usados de fato nos agentes offline | Os agentes offline operam 100% por heurística regex-based, sem profundidade semântica | 🔴 Alto |
| P2 | **LLM nunca é chamado na prática** — Nenhum agente core (Requirements, Scope, Solution, Impact, Estimation) implementa `withLlmFallback`. Todos executam lógica offline pura | O modo `LLM_ONLINE` existe mas é inutilizado nos agentes analíticos centrais | 🔴 Alto |
| P3 | **Requisitos inferidos são rasos** — Dependem exclusivamente de regex matching de keywords (`/crud|cadastro|auth/`) nos nomes de services e componentes | Requisitos de negócio complexos (workflows, regras de domínio, integrações externas) são ignorados | 🔴 Alto |
| P4 | **Estimativa usa constantes fixas** — `HOURS_PER_NEW_COMPONENT` são valores hardcoded (service=8h, controller=6h). Não consideram complexidade real do domínio | Estimativas imprecisas para projetos com complexidade acima da média | 🟡 Médio |
| P5 | **MCP Server não expõe recursos (Resources)** — Só tools, sem resources para contexto do repositório | O LLM host (Copilot) não tem acesso passivo ao contexto do projeto | 🟡 Médio |
| P6 | **Pipeline sequencial sem cache** — Cada chamada MCP re-executa todo o pipeline do zero, incluindo repository indexing | Latência alta (10-30s+) a cada invocação de tool, mesmo para o mesmo repo | 🔴 Alto |
| P7 | **Sem paralelização** — Steps 1-5 (Indexer, DB, Git, Discovery, Attachments) são independentes mas executam em série | Tempo de pipeline inflado desnecessariamente | 🟡 Médio |
| P8 | **Sem feedback iterativo** — MCP tools não suportam refinamento de requisitos baseado em feedback do usuário | Análise one-shot, sem possibilidade de ajuste progressivo | 🟡 Médio |
| P9 | **Keyword extraction primitiva** — `extractKeywords()` remove stopwords com regex e filtra palavras ≥3 chars. Sem stemming, sem sinônimos, sem NLP | Matching falha para termos em português, variações, ou terminologia de domínio | 🟡 Médio |
| P10 | **Sem histórico de análises** — Resultados não alimentam análises futuras | Não há aprendizado ou benchmarking entre features do mesmo projeto | 🟡 Médio |
| P11 | **Config `ai-config.json` parcialmente desconectada** — Campos como `focusFactor`, `hoursPerStoryPoint`, `copilotGain`, `hybridGain` existem no config mas não são consumidos pelo `EstimationAgent` | Configuração existe sem efeito real | 🟡 Médio |
| P12 | **Sem validação de coerência** — Requisitos, escopo e estimativa são gerados independentemente sem cross-validation | Possibilidade de requisitos sem cobertura de escopo, ou escopo sem estimativa | 🟠 Médio |

---

## 2. Plano de Otimização

### Fase 1 — Fundação: Cache e Performance do MCP Server
> **Prioridade**: 🔴 Crítica — Pré-requisito para usabilidade como MCP Server local  
> **Esforço estimado**: 16–24h

#### 1.1 Cache de Contexto do Repositório

**Problema**: Cada chamada MCP re-indexa todo o repositório (Step 1), que é a etapa mais custosa.

**Solução**: Implementar `RepositoryContextCache` em `src/core/`:

```typescript
// src/core/repo-cache.ts
interface CachedContext {
  repositoryContext: RepositoryContext;
  repoIndex: RepoIndex;
  gitAnalysis?: GitAnalysis;
  projectDiscovery?: ProjectDiscoveryResult;
  databaseSummary?: DatabaseSummary;
  timestamp: number;
  projectPath: string;
  fileHash: string; // Hash dos mtimes dos arquivos do projeto
}

class RepositoryContextCache {
  private cache = new Map<string, CachedContext>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 min
  
  get(projectPath: string): CachedContext | null;
  set(projectPath: string, data: CachedContext): void;
  invalidate(projectPath: string): void;
  isValid(projectPath: string): boolean; // Checa MTL + file hash
}
```

**Impacto**: Redução de 60–80% no tempo de resposta para chamadas subsequentes ao mesmo repositório.

#### 1.2 Paralelização dos Steps Independentes

**Problema**: Steps 1-5 (Indexer, DB, Git, Discovery, Attachments) executam em série apesar de serem independentes.

**Solução**: `Promise.allSettled` para steps independentes no `Orchestrator`:

```typescript
// Parallel group 1: Repository discovery
const [indexData, dbData, gitData, discoveryData] = await Promise.allSettled([
  this.executeStep('Step 1', 'Repository Indexer', ...),
  this.executeStep('Step 2', 'Database Reader', ...),
  this.executeStep('Step 3', 'Git Analyzer', ...),
  this.executeStep('Step 4', 'Project Discovery', ...),
]);
```

**Impacto**: Redução de 30–50% no tempo total do pipeline.

#### 1.3 MCP Resources para Contexto Passivo

**Problema**: O LLM host não tem acesso passivo ao contexto do repositório.

**Solução**: Expor MCP Resources que o host pode consultar sem executar o pipeline completo:

```typescript
server.resource('repository-context', 'Contexto atual do repositório indexado', async (uri) => {
  const cached = cache.get(resolveProjectPath());
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(cached) }] };
});

server.resource('analysis-history', 'Histórico de análises realizadas', async (uri) => {
  return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(history) }] };
});
```

**Novos Resources**:
| Resource | Descrição |
|----------|-----------|
| `repository://context` | RepositoryContext cacheado (linguagens, frameworks, serviços, endpoints) |
| `repository://database` | Resumo do schema de BD |
| `repository://git-summary` | Análise Git (branches, autores, hot files) |
| `analysis://history` | Histórico de análises anteriores do projeto |
| `analysis://last-result` | Resultado da última análise completa |

---

### Fase 2 — Integração Real com LLM nos Agentes Core
> **Prioridade**: 🔴 Crítica — Diferencial principal de qualidade analítica  
> **Esforço estimado**: 32–48h

#### 2.1 Implementar `withLlmFallback` nos 5 Agentes Core

**Problema**: Requirements, Scope, Solution, Impact e Estimation NUNCA chamam LLM. Todo o código atual é lógica offline.

**Solução**: Reestruturar cada agente para ter dual-path:

```typescript
// requirements.agent.ts
protected async run(fc: FeatureContext, context: SessionContext): Promise<RequirementsAnalysis> {
  const offlineResult = this.offlineAnalysis(fc);  // Lógica atual (rename)
  
  return this.withLlmFallback(
    async () => {
      const prompt = this.buildPrompt(fc, offlineResult);
      const llmResult = await this.callLlm(prompt, context);
      return this.mergeResults(offlineResult, llmResult); // Merge, não substituir
    },
    async () => offlineResult,
  );
}
```

**Estratégia**: O LLM **enriquece** a análise offline, não a substitui. A análise offline fornece ground-truth baseada no código. O LLM adiciona semântica de domínio, regras de negócio implícitas, e recomendações.

#### 2.2 Reescrever Prompts com Engenharia Estruturada

**Problema**: Prompts atuais são genéricos (5–10 linhas) e não passam contexto do repositório.

**Solução**: Prompts com structured output, contexto rico, e exemplos:

```text
# prompts/requirements-agent.txt (NOVO)

## Papel
Você é um analista de requisitos de software sênior com especialidade em
engenharia reversa de requisitos a partir de código-fonte existente.

## Contexto do Repositório
{repositoryContext}

## Esquema de Banco de Dados
{databaseSchema}

## Análise Offline Prévia (dados estruturais do código)
{offlineAnalysis}

## Tarefa
A partir da descrição de funcionalidade abaixo, gere uma análise de requisitos
COMPLETA que:

1. **Requisitos Funcionais**: Identifique TODOS os requisitos, incluindo:
   - Requisitos explícitos da descrição
   - Requisitos implícitos derivados do domínio
   - Requisitos de integração com componentes existentes
   - Regras de negócio que a nomenclatura existente sugere
   
2. **Requisitos Não-Funcionais**: 
   - Performance (baseada no volume de dados existente)
   - Segurança (baseada nos padrões auth/guard existentes)
   - Escalabilidade (baseada na arquitetura atual)
   - Observabilidade (baseada em logging/monitoring existente)

3. **Restrições Técnicas**: Derivadas da stack e padrões do repositório

4. **Premissas**: Baseadas na estrutura existente do código

5. **Critérios de Aceitação**: Para cada requisito funcional de prioridade "must"

## Descrição da Funcionalidade
{featureDescription}

## Formato de Resposta
Responda EXCLUSIVAMENTE em JSON válido seguindo este schema:
{jsonSchema}

## Idioma
Responda sempre em Português do Brasil (pt-BR).
```

**Aplicar para cada agente**: Requirements, Scope, Solution, Impact, Estimation.

#### 2.3 Resultado Híbrido: Merge Offline + LLM

**Problema**: Substituir a análise offline pelo LLM perderia ground-truth.

**Solução**: Função `mergeResults()` que combina os dois:

- **Offline**: Dados factuais (arquivos, métodos, dependências, endpoints reais)
- **LLM**: Semântica (regras de negócio, riscos de domínio, complexidade contextual)
- **Merged**: Resultado combinado com `source` tag em cada item

```typescript
interface EnrichedRequirement extends Requirement {
  source: 'offline' | 'llm' | 'merged';
  confidence: number;  // 0-1
  rationale?: string;  // Justificativa (LLM-provided)
}
```

---

### Fase 3 — Análise de Requisitos Profunda
> **Prioridade**: 🟡 Alta — Core da proposta de valor  
> **Esforço estimado**: 24–32h

#### 3.1 Classificação Semântica de Requisitos

**Problema**: `detectCategory()` usa regex simples (`/api|endpoint/` → 'api'). Falha para descrições ambíguas ou em português.

**Solução**: Árvore de decisão multi-nível + dicionário de domínio:

```typescript
// src/agents/helpers/requirement-classifier.ts
class RequirementClassifier {
  private domainDictionary: Map<string, string[]> = new Map([
    ['data', ['cadastro', 'registro', 'crud', 'tabela', 'banco', 'persistir', 'salvar', 'armazenar',
              'listar', 'consultar', 'buscar', 'filtrar', 'excluir', 'deletar', 'editar', 'atualizar']],
    ['api', ['endpoint', 'rota', 'api', 'rest', 'graphql', 'requisição', 'request', 'response']],
    ['security', ['autenticação', 'autorização', 'permissão', 'login', 'senha', 'token', 'jwt',
                  'criptografia', 'hash', 'acesso', 'papel', 'role', 'guard']],
    ['ui', ['tela', 'formulário', 'página', 'componente', 'interface', 'botão', 'campo',
            'modal', 'menu', 'navegação', 'layout', 'responsivo']],
    ['integration', ['webhook', 'email', 'notificação', 'sms', 'fila', 'mensageria', 'evento',
                     'externa', 'terceiro', 'api-externa', 'importação', 'exportação']],
    ['workflow', ['fluxo', 'processo', 'etapa', 'aprovação', 'status', 'transição', 'estado',
                  'workflow', 'pipeline', 'fila', 'agendamento', 'cron']]
  ]);

  classify(text: string): { category: string; confidence: number; subcategories: string[] };
  detectPriority(text: string, context?: RepositoryContext): 'must' | 'should' | 'could';
}
```

#### 3.2 Critérios de Aceitação Automáticos

**Problema**: Requisitos são gerados sem critérios de aceitação, reduzindo a utilidade para equipes ágeis.

**Solução**: Para cada requisito funcional de prioridade `must`, gerar critérios de aceitação:

```typescript
interface Requirement {
  id: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  category: string;
  acceptanceCriteria?: string[];  // NOVO
  testScenarios?: string[];       // NOVO
  relatedComponents?: string[];   // NOVO — Quais componentes do repo são afetados
}
```

**Geração offline**:
- CRUD → "Dado que [entidade] é criado, quando consultar por ID, então deve retornar os dados corretos"
- API → "Dado que endpoint [rota] é chamado com [payload], quando [método], então deve retornar [status]"
- Security → "Dado que usuário sem permissão tenta [action], quando [trigger], então deve retornar 403"

**Geração LLM**: Critérios de aceitação refinados e contextualizados pelo domínio.

#### 3.3 Rastreabilidade de Requisitos

**Problema**: Não há traceability matrix entre requisitos → escopo → componentes → estimativa.

**Solução**: Adicionar `tracingId` que conecta cada artefato ao requisito original:

```typescript
interface ScopeItem {
  area: string;
  description: string;
  type: 'modification' | 'new' | 'integration';
  tracingIds: string[];  // NOVO — FR-1, NFR-2, etc.
}

interface EstimationItem {
  task: string;
  hours: number;
  complexity: 'low' | 'medium' | 'high';
  tracingIds: string[];  // NOVO — Quais requisitos esta tarefa atende
}
```

**Output**: Matriz de rastreabilidade no documento de saída:

```
| Requisito | Escopo | Estimativa | Status |
|-----------|--------|------------|--------|
| FR-1      | scope:api-module, scope:ClienteService | 12h | Coberto |
| FR-2      | scope:database-migration | 3h | Coberto |
| NFR-1     | — | — | ⚠️ Sem cobertura |
```

---

### Fase 4 — Estimativa Calibrável e Precisa
> **Prioridade**: 🟡 Alta  
> **Esforço estimado**: 20–28h

#### 4.1 Conectar `ai-config.json` à Engine de Estimativa

**Problema**: `focusFactor`, `hoursPerStoryPoint`, `copilotGain`, `hybridGain` existem no config mas são ignorados.

**Solução**: Integrar os fatores de calibração no `EstimationAgent`:

```typescript
interface EstimationConfig {
  focusFactor: number;           // 0.0–1.0 — Fator de foco da equipe (default: 0.7)
  hoursPerStoryPoint: number;    // Horas por story point (default: 6)
  copilotGain: number;           // 0.0–1.0 — Redução com AI dev (default: 0.35)
  hybridGain: number;            // 0.0–1.0 — Redução com dev híbrido (default: 0.2)
  teamSize?: number;             // Tamanho da equipe (default: 1)
  seniorityLevel?: 'junior' | 'mid' | 'senior'; // Nível (default: mid)
}
```

**Nova saída de estimativa**:

```typescript
interface EnhancedEstimation extends Estimation {
  // Existente
  totalHours: number;
  breakdown: EstimationItem[];
  confidence: 'low' | 'medium' | 'high';
  
  // NOVO — Cenários de estimativa
  scenarios: {
    human: { hours: number; days: number; cost?: number };
    withCopilot: { hours: number; days: number; gain: string };
    hybrid: { hours: number; days: number; gain: string };
  };
  
  // NOVO — Story points
  storyPoints: number;
  
  // NOVO — Riscos que afetam a estimativa
  estimationRisks: { risk: string; impact: 'increase' | 'decrease'; factor: number }[];
  
  // NOVO — Cronograma sugerido com fases
  suggestedTimeline: { phase: string; days: number; parallelizable: boolean }[];
}
```

#### 4.2 Estimativa Baseada em Complexidade Ciclomática

**Problema**: Horas são constantes fixas por tipo de componente, sem considerar a complexidade real.

**Solução**: Analisar o código-fonte dos componentes modificados para ajustar estimativas:

```typescript
interface ComponentComplexity {
  name: string;
  linesOfCode: number;
  methodCount: number;
  dependencyCount: number;
  cyclomaticComplexity: number;  // Estimada por contagem de branches (if/switch/for/while)
  complexityMultiplier: number;  // Derivado dos fatores acima
}
```

**Heurística**:
- LoC > 500 → ×1.3
- Methods > 15 → ×1.2
- Dependencies > 5 → ×1.3
- Cyclomatic > 20 → ×1.5
- Combinações cumulativas com cap em ×2.5

#### 4.3 Calibração por Histórico

**Problema**: Estimativas não são calibradas contra resultados reais.

**Solução**: Armazenar estimativas anteriores e permitir calibração:

```typescript
// src/core/estimation-history.ts
interface EstimationRecord {
  featureName: string;
  estimatedHours: number;
  actualHours?: number;           // Preenchido manualmente pelo usuário
  calibrationFactor?: number;     // actualHours / estimatedHours
  date: string;
}

class EstimationCalibrator {
  getProjectCalibrationFactor(projectPath: string): number;  // Média dos fatores
  addRecord(projectPath: string, record: EstimationRecord): void;
}
```

**Novo MCP tool**:
```
calibrate_estimation — Registra horas reais para calibrar estimativas futuras
```

---

### Fase 5 — MCP Server: Tools e Capacidades Avançadas
> **Prioridade**: 🟡 Alta — Diferencial de produto como MCP Server  
> **Esforço estimado**: 24–32h

#### 5.1 Novos MCP Tools para Fluxo Iterativo

| Tool | Descrição | Parâmetros |
|------|-----------|------------|
| `refine_requirements` | Refina requisitos adicionando contexto ou ajustando prioridades | `requirementIds`, `feedback`, `additionalContext` |
| `compare_solutions` | Compara duas abordagens arquiteturais para a mesma feature | `description`, `alternativeApproach` |
| `what_if_analysis` | Estima impacto de mudanças no escopo ("E se adicionarmos X?") | `baseAnalysis`, `additionalRequirements` |
| `calibrate_estimation` | Registra horas reais e calibra modelo de estimativa | `featureName`, `actualHours` |
| `list_analyses` | Lista análises anteriores do projeto | `projectPath`, `limit` |
| `get_analysis_detail` | Recupera análise específica por ID | `analysisId` |
| `generate_user_stories` | Gera user stories formatadas a partir de requisitos | `description`, `format` |
| `analyze_technical_debt` | Analisa dívida técnica com base no repositório indexado | `projectPath`, `focusArea` |

#### 5.2 MCP Prompts (Prompt Templates)

Expor prompts pré-definidos que o LLM host pode oferecer ao usuário:

```typescript
server.prompt('analyze-feature', 'Analisa uma funcionalidade completa', [
  { name: 'description', description: 'Descrição da funcionalidade', required: true },
  { name: 'depth', description: 'Profundidade: quick|standard|deep', required: false },
], async ({ description, depth }) => {
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Analise esta funcionalidade com profundidade ${depth ?? 'standard'}: ${description}`,
      }
    }]
  };
});
```

**Prompts expostos**:
| Prompt | Uso |
|--------|-----|
| `analyze-feature` | Análise completa de uma feature |
| `estimate-feature` | Estimativa com cenários |
| `compare-approaches` | Comparar duas soluções |
| `generate-user-stories` | Gerar user stories |
| `review-architecture` | Revisar decisões arquiteturais |

#### 5.3 Streaming e Progress Notifications

**Problema**: Tools MCP atuais são síncronas — o usuário espera sem feedback.

**Solução**: Implementar progress notifications via MCP protocol:

```typescript
server.tool('generate_full_analysis', schema, async (params, extra) => {
  const { sendNotification } = extra;
  
  sendNotification({ method: 'notifications/progress', params: { 
    progressToken: 'analysis', progress: 1, total: 18, message: 'Indexando repositório...' 
  }});
  
  // ... executa steps com notificações incrementais
});
```

#### 5.4 Tool Composition e Profundidade Configurável

**Problema**: `generate_full_analysis` sempre executa 18 steps. Para perguntas rápidas, é overkill.

**Solução**: Parâmetro `depth` que controla quais steps executar:

```typescript
type AnalysisDepth = 'quick' | 'standard' | 'deep';

// quick: Steps 1, 6, 7, 12 (index, requirements, scope, estimation) — ~3s
// standard: Steps 1-9, 11-12, 14, 17 (sem specialists, flowcharts, executive docs) — ~8s  
// deep: Todos os 18 steps — ~15s+
```

---

### Fase 6 — Keyword Extraction e NLP
> **Prioridade**: 🟠 Média  
> **Esforço estimado**: 16–20h

#### 6.1 Stemming e Normalização para Português

**Problema**: `extractKeywords()` compara strings literais. "clientes" não casa com "cliente", "ClienteService" não casa com "client".

**Solução**: Stemmer leve para pt-BR (sem dependência externa pesada):

```typescript
// src/agents/helpers/text-analyzer.ts
class TextAnalyzer {
  // RSLP Stemmer simplificado para pt-BR
  stem(word: string): string;
  
  // Normalização: remove acentos, plurais, sufixos comuns
  normalize(word: string): string;
  
  // Sinônimos de domínio: "cadastro" = "registration" = "crud"
  expandSynonyms(keywords: string[]): string[];
  
  // Tokenização inteligente: "ClienteService" → ["cliente", "service"]
  tokenizeCamelCase(name: string): string[];
  
  // Semantic matching score (0-1): "gerenciar usuarios" vs "UserManagementService"
  matchScore(query: string, target: string): number;
}
```

#### 6.2 Dicionário de Domínio Expansível

Arquivo de configuração para sinônimos e termos de domínio:

```json
// domain-dictionary.json (novo)
{
  "synonymGroups": [
    { "canonical": "customer", "terms": ["cliente", "client", "customer", "consumidor", "comprador"] },
    { "canonical": "product", "terms": ["produto", "product", "item", "mercadoria", "artigo"] },
    { "canonical": "order", "terms": ["pedido", "order", "venda", "sale", "compra", "purchase"] },
    { "canonical": "authentication", "terms": ["autenticação", "login", "auth", "signin", "sign-in"] }
  ],
  "categoryHints": {
    "crud": ["cadastro", "registro", "create", "read", "update", "delete", "CRUD"],
    "report": ["relatório", "report", "dashboard", "gráfico", "chart", "analytics"]
  }
}
```

---

### Fase 7 — Cross-Validation e Coerência
> **Prioridade**: 🟠 Média  
> **Esforço estimado**: 12–16h

#### 7.1 Agente de Validação de Coerência

**Problema**: Requisitos, escopo, solução e estimativa são gerados independentemente sem validação cruzada.

**Solução**: Novo agente `CoherenceValidatorAgent` que executa após todos os outros:

```typescript
// src/agents/coherence-validator.agent.ts
interface CoherenceReport {
  uncoveredRequirements: string[];        // Requisitos sem escopo associado
  scopeWithoutRequirement: string[];      // Escopo sem requisito justificador
  estimationGaps: string[];               // Componentes sem estimativa
  componentWithoutOwner: string[];        // Componentes sem requisito pai
  riskMismatch: string[];                 // Risco alto mas estimativa sem buffer
  suggestions: string[];                  // Recomendações de ajuste
  coherenceScore: number;                 // 0-100
}
```

**Execução**: Step 17.5 (antes do Summary Generator).

**No MCP Server**: Incluir como seção no `generate_full_analysis` output:

```markdown
## Validação de Coerência (score: 85/100)

⚠️ **2 requisitos sem cobertura de escopo**: NFR-3, NFR-5
⚠️ **1 componente estimado sem requisito associado**: UtilityHelper
✅ Todos os requisitos funcionais têm escopo associado
✅ Estimativa inclui buffer para riscos identificados
```

---

### Fase 8 — Distribuição como MCP Server Local
> **Prioridade**: 🟠 Média — Qualidade de produto para distribuição  
> **Esforço estimado**: 12–16h

#### 8.1 Packaging Multi-Plataforma

```json
// package.json — ampliar scripts
{
  "scripts": {
    "package:win": "pkg dist/mcp-server.js --targets node20-win-x64 --output dist/bin/ai-mcp-win.exe",
    "package:mac": "pkg dist/mcp-server.js --targets node20-macos-x64 --output dist/bin/ai-mcp-macos",
    "package:linux": "pkg dist/mcp-server.js --targets node20-linux-x64 --output dist/bin/ai-mcp-linux",
    "package:all": "npm run package:win && npm run package:mac && npm run package:linux"
  }
}
```

#### 8.2 Instalação Simplificada

```json
// Gerar arquivo de configuração MCP padrão
// .mcp-config.json (template para o usuário)
{
  "mcpServers": {
    "ai-developer-analytics": {
      "command": "node",
      "args": ["path/to/dist/mcp-server.js"],
      "env": {
        "AI_PROVIDER": "openai",
        "AI_API_KEY": "${env:OPENAI_API_KEY}",
        "AI_MODEL": "gpt-4o"
      }
    }
  }
}
```

**Criar**: `npx ai-developer-analytics init` — gera config automaticamente.

#### 8.3 Health Check e Diagnóstico

```typescript
server.tool('health_check', 'Verifica o status do servidor e suas capacidades', {}, async () => {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        version: '2.0.0',
        mode: ModeManager.getMode(),
        llmAvailable: ModeManager.isLlmAvailable(),
        cachedProjects: cache.size,
        capabilities: ['requirements', 'scope', 'estimation', 'impact', 'solution', 'prototype'],
      }, null, 2),
    }],
  };
});
```

---

## 3. Roadmap de Implementação

```
Fase 1: Cache + Performance ──────── Semana 1-2
  ├─ 1.1 RepositoryContextCache
  ├─ 1.2 Paralelização Steps 1-5
  └─ 1.3 MCP Resources

Fase 2: Integração LLM ──────────── Semana 2-4
  ├─ 2.1 withLlmFallback nos 5 core agents
  ├─ 2.2 Reescrita de prompts (5 prompts)
  └─ 2.3 Merge offline + LLM

Fase 3: Requisitos Profundos ────── Semana 3-5
  ├─ 3.1 RequirementClassifier
  ├─ 3.2 Critérios de aceitação
  └─ 3.3 Rastreabilidade

Fase 4: Estimativa Calibrável ───── Semana 4-6
  ├─ 4.1 Conectar ai-config.json
  ├─ 4.2 Complexidade ciclomática
  └─ 4.3 Calibração por histórico

Fase 5: MCP Tools Avançados ─────── Semana 5-7
  ├─ 5.1 Novos tools (refine, compare, what-if)
  ├─ 5.2 MCP Prompts
  ├─ 5.3 Streaming/Progress
  └─ 5.4 Depth configurável

Fase 6: NLP Leve ────────────────── Semana 6-8
  ├─ 6.1 Stemmer pt-BR
  └─ 6.2 Dicionário de domínio

Fase 7: Cross-Validation ───────── Semana 7-8
  └─ 7.1 CoherenceValidatorAgent

Fase 8: Distribuição ────────────── Semana 8-9
  ├─ 8.1 Packaging multi-plataforma
  ├─ 8.2 Instalação simplificada
  └─ 8.3 Health check
```

---

## 4. Matriz de Impacto das Melhorias

| Melhoria | Impacto na Qualidade dos Requisitos | Impacto na Precisão das Estimativas | Impacto no UX como MCP Server | Esforço |
|----------|--------------------------------------|--------------------------------------|-------------------------------|---------|
| Cache de contexto | — | — | ⬆️⬆️⬆️ | Baixo |
| Paralelização pipeline | — | — | ⬆️⬆️ | Baixo |
| LLM nos core agents | ⬆️⬆️⬆️ | ⬆️⬆️⬆️ | ⬆️ | Alto |
| Prompts reestruturados | ⬆️⬆️⬆️ | ⬆️⬆️ | — | Médio |
| Merge offline+LLM | ⬆️⬆️ | ⬆️⬆️ | — | Médio |
| Classificador semântico | ⬆️⬆️ | ⬆️ | — | Médio |
| Critérios de aceitação | ⬆️⬆️⬆️ | — | ⬆️ | Médio |
| Rastreabilidade | ⬆️⬆️ | ⬆️⬆️ | ⬆️ | Médio |
| Config conectada | — | ⬆️⬆️ | — | Baixo |
| Complexidade ciclomática | — | ⬆️⬆️ | — | Médio |
| Calibração histórico | — | ⬆️⬆️⬆️ | ⬆️ | Médio |
| Novos MCP tools | ⬆️ | ⬆️ | ⬆️⬆️⬆️ | Alto |
| MCP Resources | — | — | ⬆️⬆️ | Baixo |
| Depth configurável | — | — | ⬆️⬆️⬆️ | Baixo |
| Stemmer pt-BR | ⬆️⬆️ | ⬆️ | — | Médio |
| CoherenceValidator | ⬆️⬆️ | ⬆️⬆️ | ⬆️ | Médio |

---

## 5. Quick Wins (Implementáveis em < 4h cada)

| # | Ação | Impacto |
|---|------|---------|
| QW1 | Conectar `focusFactor`, `copilotGain`, `hybridGain` do `ai-config.json` ao `EstimationAgent` e gerar cenários human/AI/hybrid | Estimativas imediatamente mais úteis |
| QW2 | Adicionar parâmetro `depth: 'quick' \| 'standard' \| 'deep'` aos MCP tools | UX dramaticamente melhor para perguntas rápidas |
| QW3 | Implementar `RepositoryContextCache` em memória com TTL de 5 min | Redução de 60-80% no tempo de resposta |
| QW4 | Adicionar `acceptanceCriteria[]` ao tipo `Requirement` e gerar critérios template-based | Requisitos significativamente mais acionáveis |
| QW5 | Adicionar MCP tool `health_check` | Diagnóstico de problemas de instalação |
| QW6 | Implementar `tokenizeCamelCase` e normalização de acentos no keyword matching | +30% de precision no matching de componentes |

---

## 6. Métricas de Sucesso

| Métrica | Baseline Atual | Target |
|---------|---------------|--------|
| Tempo de resposta MCP (warm) | 10-30s | < 3s (quick), < 8s (standard) |
| Requisitos funcionais identificados por feature | 1-5 (regex-based) | 8-15 (LLM-enriched) |
| Precisão de estimativa vs. real | Não medido | ±30% após calibração |
| Critérios de aceitação por requisito | 0 | 2-4 por FR must |
| Cobertura de rastreabilidade | 0% | > 90% |
| Cenários de estimativa | 1 (apenas total) | 3 (human, copilot, hybrid) |
| Score de coerência médio | Não medido | > 80/100 |

---

## 7. Considerações para Distribuição como MCP Server

### 7.1 Segurança
- **Não expor API keys** nos resources — filtrar `config.ai.apiKey` de qualquer output
- **Path traversal**: Validar `projectPath` contra directory traversal (`../../../etc/passwd`)
- **Rate limiting**: Não aplicável para MCP local, mas proteger contra loops infinitos no pipeline
- **Input sanitization**: Validar `description` contra injection em prompts LLM

### 7.2 Compatibilidade
- Testar com VS Code Copilot Chat, Claude Desktop, Continue, e Cline
- Manter compatibilidade com MCP SDK ≥ 1.29.0
- Suportar `stdio` e opcionalmente `sse` transport

### 7.3 Documentação
- README com instalação one-liner
- Exemplos de uso para cada MCP tool
- Guia de calibração de estimativas
- Troubleshooting para problemas comuns

### 7.4 Telemetria Opcional
- Opt-in analytics: tempo de pipeline, steps executados, modos utilizados
- Nenhum dado de código enviado externamente
- Armazenamento local em `~/.ai-developer-analytics/telemetry.json`
