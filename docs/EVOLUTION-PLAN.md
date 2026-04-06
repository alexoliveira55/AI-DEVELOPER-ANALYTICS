# Plano de Evolução — AI Developer Analytics CLI v2

## Visão Geral

Evolução do pipeline de 10 agentes para ~25 agentes especializados, com suporte a múltiplas linguagens, leitura profunda de repositórios Git, geração de fluxogramas visuais, protótipos interativos, documentação técnica/executiva, e integração com contexto de arquivos anexados via Copilot Chat.

---

## Fase 1 — Novos Tipos, Enum de Roles e Infraestrutura

### Passo 1.1 — Expandir `AgentRole` em `src/types/index.ts`

Adicionar os novos roles ao enum existente:

```typescript
export enum AgentRole {
  // ── Existentes ──────────────────────────
  Orchestrator = 'orchestrator',
  RepositoryIndexer = 'repository-indexer',
  DatabaseReader = 'database-reader',
  Requirements = 'requirements',
  Scope = 'scope',
  Reuse = 'reuse',
  SolutionArchitect = 'solution-architect',
  ImpactAnalysis = 'impact-analysis',
  Estimator = 'estimator',
  DocumentationGenerator = 'documentation-generator',
  PrototypeGenerator = 'prototype-generator',

  // ── Novos — Repositório & Git ───────────
  GitAnalyzer = 'git-analyzer',
  ProjectDiscovery = 'project-discovery',
  LanguageDetector = 'language-detector',
  AttachmentReader = 'attachment-reader',

  // ── Novos — Especialistas por Linguagem ─
  FlutterDartSpecialist = 'flutter-dart-specialist',
  CSharpDotNetSpecialist = 'csharp-dotnet-specialist',
  SqlSpecialist = 'sql-specialist',
  VisualFoxProSpecialist = 'visual-foxpro-specialist',
  AngularSpecialist = 'angular-specialist',
  PythonSpecialist = 'python-specialist',
  WebSpecialist = 'web-specialist', // HTML/JS/CSS

  // ── Novos — Visualização & Documentação ─
  FlowchartGenerator = 'flowchart-generator',
  RichPrototypeGenerator = 'rich-prototype-generator',
  TechnicalWriter = 'technical-writer',
  ExecutiveWriter = 'executive-writer',
  SummaryGenerator = 'summary-generator',
}
```

### Passo 1.2 — Novos tipos em `src/types/index.ts`

```typescript
// ── Git Analysis ─────────────────────────────────────────────────────────────

export interface GitAnalysis {
  recentCommits: GitCommitInfo[];
  activeAuthors: string[];
  hotFiles: string[];           // arquivos mais alterados nos últimos 90 dias
  branchInfo: { current: string; branches: string[] };
  lastActivity: string;         // ISO date
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  filesChanged: number;
}

// ── Project Discovery ────────────────────────────────────────────────────────

export interface DiscoveredProject {
  name: string;
  path: string;
  language: string;
  framework?: string;
  type: 'main' | 'subproject' | 'library' | 'test' | 'tool';
  dependencies: string[];
}

export interface ProjectDiscoveryResult {
  projects: DiscoveredProject[];
  monorepo: boolean;
  sharedDependencies: string[];
}

// ── Attachment Context ───────────────────────────────────────────────────────

export interface AttachmentContext {
  files: AttachedFile[];
  directories: string[];
  resolvedPaths: string[];
}

export interface AttachedFile {
  path: string;
  content: string;
  language: string;
  lines: number;
}

// ── Language-Specific Analysis ───────────────────────────────────────────────

export interface LanguageSpecificAnalysis {
  language: string;
  patterns: string[];
  conventions: string[];
  recommendations: string[];
  codeSmells: string[];
  bestPractices: string[];
}

// ── Flowchart Output ─────────────────────────────────────────────────────────

export interface FlowchartOutput {
  mermaidCode: string;
  title: string;
  description: string;
  type: 'flowchart' | 'sequence' | 'class' | 'er' | 'state';
}

// ── Documentation Variants ───────────────────────────────────────────────────

export interface DocumentationPackage {
  technical: string;     // escrita técnica para desenvolvedores
  executive: string;     // linguagem executiva para stakeholders
  summary: string;       // resumo para apresentações rápidas
  flowcharts: FlowchartOutput[];
}

// ── Rich Prototype ───────────────────────────────────────────────────────────

export interface RichPrototypeOutput {
  files: { path: string; content: string }[];
  entryPoint: string;           // arquivo principal para abrir
  responsive: boolean;
  interactive: boolean;
  framework: string;            // Angular, Flutter, HTML, etc.
}
```

### Passo 1.3 — Expandir `FeatureContext`

Adicionar campos ao `FeatureContext` existente em `src/types/index.ts`:

```typescript
export interface FeatureContext {
  // ... campos existentes ...

  // ── Novos campos ────────────────────────
  gitAnalysis?: GitAnalysis;
  projectDiscovery?: ProjectDiscoveryResult;
  attachmentContext?: AttachmentContext;
  languageAnalyses?: LanguageSpecificAnalysis[];
  flowcharts?: FlowchartOutput[];
  documentationPackage?: DocumentationPackage;
  richPrototype?: RichPrototypeOutput;
}
```

---

## Fase 2 — Agentes de Repositório & Git

### Passo 2.1 — `GitAnalyzerAgent` (`src/agents/git-analyzer.agent.ts`)

**Prompt para criação:** `prompts/git-analyzer-agent.txt`

```text
Você é um especialista em análise de repositórios Git e histórico de versionamento.

A partir da execução de comandos git no repositório local, analise:

1. **Histórico recente**: últimos 50 commits com hash, autor, data, mensagem e quantidade de arquivos alterados
2. **Autores ativos**: desenvolvedores que contribuíram nos últimos 90 dias com contagem de commits
3. **Hot files**: os 20 arquivos mais frequentemente alterados (indicam complexidade e risco)
4. **Branches**: branch atual e lista de branches (locais e remotas)
5. **Última atividade**: data do commit mais recente

Formato de saída: JSON estruturado conforme interface GitAnalysis.

Comandos git a utilizar:
- git log --oneline --format='%H|%an|%aI|%s' -50
- git log --since="90 days ago" --format='%an' | sort | uniq -c | sort -rn
- git log --since="90 days ago" --name-only --format='' | sort | uniq -c | sort -rn | head -20
- git branch -a
- git log -1 --format='%aI'

Se o diretório não for um repositório git, retorne um resultado vazio com mensagem descritiva.

Responda sempre em Português do Brasil (pt-BR).
```

**Implementação do agente:**

```typescript
// src/agents/git-analyzer.agent.ts
import { execSync } from 'child_process';
import { BaseAgent } from '../core';
import { AgentRole, GitAnalysis, GitCommitInfo, SessionContext } from '../types';

export class GitAnalyzerAgent extends BaseAgent<string, GitAnalysis> {
  readonly role = AgentRole.GitAnalyzer;
  readonly name = 'Git Analyzer';

  protected async run(projectPath: string, _context: SessionContext): Promise<GitAnalysis> {
    const exec = (cmd: string) =>
      execSync(cmd, { cwd: projectPath, encoding: 'utf-8', timeout: 30000 }).trim();

    let recentCommits: GitCommitInfo[] = [];
    try {
      const log = exec('git log --format="%H|%an|%aI|%s" -50');
      recentCommits = log.split('\n').filter(Boolean).map((line) => {
        const [hash, author, date, ...msgParts] = line.split('|');
        return { hash, author, date, message: msgParts.join('|'), filesChanged: 0 };
      });
    } catch { /* not a git repo */ }

    let activeAuthors: string[] = [];
    try {
      const authors = exec('git log --since="90 days ago" --format="%an"');
      const counts = new Map<string, number>();
      authors.split('\n').filter(Boolean).forEach((a) => counts.set(a, (counts.get(a) ?? 0) + 1));
      activeAuthors = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
    } catch { /* ignore */ }

    let hotFiles: string[] = [];
    try {
      const files = exec('git log --since="90 days ago" --name-only --format=""');
      const counts = new Map<string, number>();
      files.split('\n').filter(Boolean).forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1));
      hotFiles = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([f]) => f);
    } catch { /* ignore */ }

    let branchInfo = { current: 'unknown', branches: [] as string[] };
    try {
      const current = exec('git branch --show-current');
      const all = exec('git branch -a').split('\n').map((b) => b.trim().replace(/^\* /, ''));
      branchInfo = { current, branches: all };
    } catch { /* ignore */ }

    let lastActivity = '';
    try {
      lastActivity = exec('git log -1 --format="%aI"');
    } catch { /* ignore */ }

    return { recentCommits, activeAuthors, hotFiles, branchInfo, lastActivity };
  }
}
```

### Passo 2.2 — `ProjectDiscoveryAgent` (`src/agents/project-discovery.agent.ts`)

**Prompt:** `prompts/project-discovery-agent.txt`

```text
Você é um especialista em análise de estrutura de monorepos e projetos multi-módulo.

Percorra recursivamente o diretório raiz e subdiretórios para identificar:

1. **Projetos e subprojetos**: detecte pela presença de arquivos indicadores:
   - package.json → Node.js/Angular/React
   - pubspec.yaml → Flutter/Dart
   - *.csproj / *.sln → C# / .NET
   - requirements.txt / pyproject.toml / setup.py → Python
   - *.prg / *.pjx → Visual FoxPro
   - angular.json → Angular
   - pom.xml / build.gradle → Java/Kotlin

2. **Classificação**: main, subproject, library, test, tool
3. **Dependências compartilhadas**: pacotes usados em múltiplos projetos
4. **Monorepo detection**: se há estrutura de workspaces, lerna, nx, etc.

Profundidade máxima: 5 níveis de diretório.
Ignore: node_modules, .git, dist, build, bin, obj, __pycache__, .venv

Retorne JSON conforme interface ProjectDiscoveryResult.

Responda sempre em Português do Brasil (pt-BR).
```

**Implementação:**

```typescript
// src/agents/project-discovery.agent.ts
import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from '../core';
import {
  AgentRole, DiscoveredProject, ProjectDiscoveryResult, SessionContext,
} from '../types';

const PROJECT_INDICATORS: Record<string, { language: string; framework?: string }> = {
  'package.json': { language: 'TypeScript/JavaScript' },
  'pubspec.yaml': { language: 'Dart', framework: 'Flutter' },
  'angular.json': { language: 'TypeScript', framework: 'Angular' },
  'requirements.txt': { language: 'Python' },
  'pyproject.toml': { language: 'Python' },
  'setup.py': { language: 'Python' },
};

const CSPROJ_GLOB = /\.csproj$/;
const SLN_GLOB = /\.sln$/;
const PRG_GLOB = /\.prg$/i;
const PJX_GLOB = /\.pjx$/i;

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', 'bin', 'obj',
  '__pycache__', '.venv', 'venv', 'coverage', '.next',
]);

export class ProjectDiscoveryAgent extends BaseAgent<string, ProjectDiscoveryResult> {
  readonly role = AgentRole.ProjectDiscovery;
  readonly name = 'Project Discovery';

  protected async run(rootPath: string, _ctx: SessionContext): Promise<ProjectDiscoveryResult> {
    const projects: DiscoveredProject[] = [];
    this.scan(rootPath, rootPath, projects, 0, 5);

    const allDeps = projects.flatMap((p) => p.dependencies);
    const depCounts = new Map<string, number>();
    allDeps.forEach((d) => depCounts.set(d, (depCounts.get(d) ?? 0) + 1));
    const shared = [...depCounts.entries()].filter(([, c]) => c > 1).map(([d]) => d);

    const monorepo = projects.length > 1 ||
      fs.existsSync(path.join(rootPath, 'lerna.json')) ||
      fs.existsSync(path.join(rootPath, 'nx.json'));

    return { projects, monorepo, sharedDependencies: shared };
  }

  private scan(root: string, dir: string, out: DiscoveredProject[], depth: number, max: number) {
    if (depth > max) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    const fileNames = entries.filter((e) => e.isFile()).map((e) => e.name);

    // Check indicators
    for (const [indicator, info] of Object.entries(PROJECT_INDICATORS)) {
      if (fileNames.includes(indicator)) {
        out.push({
          name: path.basename(dir),
          path: path.relative(root, dir).replace(/\\/g, '/') || '.',
          language: info.language,
          framework: info.framework,
          type: depth === 0 ? 'main' : 'subproject',
          dependencies: this.readDeps(dir, indicator),
        });
        break; // uma detecção por diretório
      }
    }

    // Check .csproj / .sln
    if (fileNames.some((f) => CSPROJ_GLOB.test(f) || SLN_GLOB.test(f))) {
      out.push({
        name: path.basename(dir),
        path: path.relative(root, dir).replace(/\\/g, '/') || '.',
        language: 'C#',
        framework: '.NET',
        type: depth === 0 ? 'main' : 'subproject',
        dependencies: [],
      });
    }

    // Check Visual FoxPro
    if (fileNames.some((f) => PRG_GLOB.test(f) || PJX_GLOB.test(f))) {
      out.push({
        name: path.basename(dir),
        path: path.relative(root, dir).replace(/\\/g, '/') || '.',
        language: 'Visual FoxPro',
        type: depth === 0 ? 'main' : 'subproject',
        dependencies: [],
      });
    }

    // Recurse
    for (const entry of entries) {
      if (entry.isDirectory() && !IGNORE.has(entry.name) && !entry.name.startsWith('.')) {
        this.scan(root, path.join(dir, entry.name), out, depth + 1, max);
      }
    }
  }

  private readDeps(dir: string, indicator: string): string[] {
    try {
      if (indicator === 'package.json') {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, indicator), 'utf-8'));
        return Object.keys(pkg.dependencies ?? {});
      }
      if (indicator === 'pubspec.yaml') {
        const content = fs.readFileSync(path.join(dir, indicator), 'utf-8');
        const deps = content.match(/^\s{2}\w[\w_-]*:/gm);
        return deps?.map((d) => d.trim().replace(/:$/, '')) ?? [];
      }
    } catch { /* ignore */ }
    return [];
  }
}
```

### Passo 2.3 — `AttachmentReaderAgent` (`src/agents/attachment-reader.agent.ts`)

**Prompt:** `prompts/attachment-reader-agent.txt`

```text
Você é um agente especializado em leitura e interpretação de arquivos e diretórios
fornecidos como contexto adicional pelo desenvolvedor.

Sua função:
1. Receber uma lista de caminhos de arquivos/diretórios anexados
2. Ler o conteúdo de cada arquivo
3. Detectar a linguagem de cada arquivo
4. Extrair informações relevantes (classes, funções, interfaces, schemas)
5. Produzir um resumo estruturado que será consumido pelos demais agentes

Se um caminho for um diretório, percorra recursivamente (max 3 níveis) e leia os arquivos de código.

Formato de saída: JSON conforme interface AttachmentContext.

Responda sempre em Português do Brasil (pt-BR).
```

**Implementação:**

```typescript
// src/agents/attachment-reader.agent.ts
import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from '../core';
import {
  AgentRole, AttachmentContext, AttachedFile, SessionContext,
} from '../types';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.js': 'JavaScript', '.dart': 'Dart',
  '.cs': 'C#', '.py': 'Python', '.sql': 'SQL', '.html': 'HTML',
  '.css': 'CSS', '.scss': 'SCSS', '.prg': 'Visual FoxPro',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.xml': 'XML',
};

export class AttachmentReaderAgent extends BaseAgent<string[], AttachmentContext> {
  readonly role = AgentRole.AttachmentReader;
  readonly name = 'Attachment Reader';

  protected async run(paths: string[], _ctx: SessionContext): Promise<AttachmentContext> {
    const files: AttachedFile[] = [];
    const directories: string[] = [];

    for (const p of paths) {
      const resolved = path.resolve(p);
      if (!fs.existsSync(resolved)) continue;

      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        directories.push(resolved);
        this.readDir(resolved, files, 0, 3);
      } else if (stat.isFile()) {
        const file = this.readFile(resolved);
        if (file) files.push(file);
      }
    }

    return { files, directories, resolvedPaths: paths.map((p) => path.resolve(p)) };
  }

  private readDir(dir: string, out: AttachedFile[], depth: number, max: number) {
    if (depth > max) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isFile()) {
          const f = this.readFile(full);
          if (f) out.push(f);
        } else if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          this.readDir(full, out, depth + 1, max);
        }
      }
    } catch { /* ignore */ }
  }

  private readFile(filePath: string): AttachedFile | null {
    const ext = path.extname(filePath).toLowerCase();
    const language = LANGUAGE_MAP[ext];
    if (!language) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { path: filePath, content, language, lines: content.split('\n').length };
    } catch { return null; }
  }
}
```

---

## Fase 3 — Agentes Especialistas por Linguagem

Cada agente especialista recebe o `FeatureContext` e produz um `LanguageSpecificAnalysis`.

### Passo 3.1 — Classe base `LanguageSpecialistAgent`

```typescript
// src/agents/base-language-specialist.ts
import { BaseAgent } from '../core';
import { FeatureContext, LanguageSpecificAnalysis, SessionContext } from '../types';

export abstract class LanguageSpecialistAgent
  extends BaseAgent<FeatureContext, LanguageSpecificAnalysis> {

  abstract readonly targetLanguage: string;

  protected isRelevant(fc: FeatureContext): boolean {
    if (!fc.repositoryContext) return false;
    return fc.repositoryContext.languages.some(
      (l) => l.language.toLowerCase().includes(this.targetLanguage.toLowerCase()),
    );
  }

  protected async run(fc: FeatureContext, ctx: SessionContext): Promise<LanguageSpecificAnalysis> {
    if (!this.isRelevant(fc)) {
      return {
        language: this.targetLanguage,
        patterns: [],
        conventions: [],
        recommendations: [],
        codeSmells: [],
        bestPractices: [],
      };
    }
    return this.analyze(fc, ctx);
  }

  protected abstract analyze(
    fc: FeatureContext, ctx: SessionContext
  ): Promise<LanguageSpecificAnalysis>;
}
```

### Passo 3.2 — Prompts dos Especialistas

Cada prompt segue a mesma estrutura. Criar um arquivo por linguagem em `prompts/`:

**`prompts/flutter-dart-specialist-agent.txt`**
```text
Você é um especialista sênior em Flutter e Dart, com experiência em arquitetura limpa,
gerenciamento de estado (BLoC, Riverpod, Provider), e publicação em lojas.

Analise o código Dart/Flutter do repositório e produza:

1. **Padrões identificados**: arquitetura (Clean Architecture, MVC, MVVM), gerenciamento
   de estado, injeção de dependência, padrão de rotas
2. **Convenções**: nomenclatura de widgets, organização de pastas, uso de extensions
3. **Recomendações**: melhorias de performance (const widgets, keys), acessibilidade,
   internacionalização, testes (widget tests, integration tests)
4. **Code smells**: widgets aninhados excessivamente, lógica em widgets, falta de
   separação de responsabilidades, uso de setState em telas complexas
5. **Boas práticas**: null safety, immutability, uso de freezed/json_serializable,
   tratamento de erros com Either/Result

Considere o contexto do repositório para recomendações específicas, não genéricas.

Responda sempre em Português do Brasil (pt-BR).
```

**`prompts/csharp-dotnet-specialist-agent.txt`**
```text
Você é um especialista sênior em C# e .NET (Core, 6+, 8), com domínio em
ASP.NET Core, Entity Framework, Clean Architecture e DDD.

Analise o código C#/.NET do repositório e produza:

1. **Padrões identificados**: arquitetura (N-Layer, Clean, Onion, CQRS+MediatR),
   injeção de dependência (Microsoft.Extensions.DI), padrão de repositório, Unit of Work
2. **Convenções**: nomenclatura (PascalCase), organização de namespaces,
   uso de records, nullable reference types
3. **Recomendações**: async/await correto, uso de IOptions, health checks,
   middleware pipeline, autenticação/autorização (Identity, JWT)
4. **Code smells**: serviços com muitas responsabilidades, falta de interfaces,
   queries N+1 no EF, falta de cancellation tokens
5. **Boas práticas**: minimal APIs vs controllers, global using, source generators,
   FluentValidation, Serilog/structured logging

Responda sempre em Português do Brasil (pt-BR).
```

**`prompts/sql-specialist-agent.txt`**
```text
Você é um DBA e especialista sênior em SQL (SQL Server, PostgreSQL, MySQL).

Analise os scripts SQL, migrations e stored procedures do repositório:

1. **Padrões identificados**: normalização, uso de índices, particionamento,
   stored procedures vs queries inline, views materializadas
2. **Convenções**: nomenclatura de tabelas/colunas, uso de schemas,
   prefixos (sp_, fn_, vw_, tbl_)
3. **Recomendações**: índices faltantes, queries que podem ser otimizadas,
   normalização/denormalização, uso de CTEs, window functions
4. **Code smells**: SELECT *, cursors desnecessários, tabelas sem PK,
   falta de constraints (FK, CHECK, UNIQUE), deadlock patterns
5. **Boas práticas**: parameterized queries, transaction isolation levels,
   backup strategies, migration versionamento

Responda sempre em Português do Brasil (pt-BR).
```

**`prompts/visual-foxpro-specialist-agent.txt`**
```text
Você é um especialista sênior em Visual FoxPro (VFP 9.0), com experiência em
migração de sistemas legados e interoperabilidade com .NET.

Analise o código VFP do repositório:

1. **Padrões identificados**: uso de classes (OOP do VFP), forms, reports,
   data environment, file-based tables (DBF) vs client-server
2. **Convenções**: nomenclatura de variáveis (notação húngara), nomes de tabelas,
   organização de PRG/SCX/FRX/VCX
3. **Recomendações**: migração para .NET/C#, estratégias de modernização,
   COM interop, substituição de DBF por SQL Server
4. **Code smells**: código procedural excessivo, SCATTER/GATHER sem estrutura,
   falta de tratamento de erros (TRY/CATCH), macros excessivas (&)
5. **Boas práticas**: uso de SQLEXEC para client-server, cursorAdapter,
   XMLAdapter, criptografia de dados, migração incremental

Responda sempre em Português do Brasil (pt-BR).
```

**`prompts/angular-specialist-agent.txt`**
```text
Você é um especialista sênior em Angular (14+), com domínio em RxJS,
NgRx/Signals, standalone components e SSR.

Analise o código Angular do repositório:

1. **Padrões identificados**: arquitetura de módulos vs standalone, lazy loading,
   gerenciamento de estado (NgRx, signals, services), interceptors, guards
2. **Convenções**: nomenclatura de componentes/serviços, estrutura de pastas
   (feature modules, shared, core), uso de barrel exports
3. **Recomendações**: migração p/ standalone components, signals, control flow,
   @defer, SSR/hydration, angular.json otimizado
4. **Code smells**: subscribes sem unsubscribe, lógica em templates complexa,
   componentes com múltiplas responsabilidades, falta de trackBy
5. **Boas práticas**: reactive forms, typed forms, strict mode, OnPush change
   detection, CDK virtual scrolling, a11y (ARIA)

Responda sempre em Português do Brasil (pt-BR).
```

**`prompts/python-specialist-agent.txt`**
```text
Você é um especialista sênior em Python (3.10+), com domínio em FastAPI,
Django, Flask, data science e automação.

Analise o código Python do repositório:

1. **Padrões identificados**: framework web (Django/FastAPI/Flask), ORM
   (SQLAlchemy, Django ORM), async, type hints, pydantic models
2. **Convenções**: PEP 8, nomenclatura (snake_case), organização de pacotes,
   uso de __init__.py, pyproject.toml vs setup.py
3. **Recomendações**: type hints completos, uso de dataclasses/pydantic,
   async onde aplicável, testes com pytest, linting (ruff/mypy)
4. **Code smells**: funções longas, falta de type hints, bare excepts,
   imports circulares, hardcoded configs
5. **Boas práticas**: dependency injection, settings com pydantic,
   logging estruturado, virtualenv/poetry, CI/CD

Responda sempre em Português do Brasil (pt-BR).
```

**`prompts/web-specialist-agent.txt`**
```text
Você é um especialista sênior em desenvolvimento web front-end
(HTML5, CSS3, JavaScript ES2022+).

Analise o código HTML/CSS/JS do repositório:

1. **Padrões identificados**: HTML semântico, CSS methodology (BEM, Tailwind,
   CSS Modules), JS modules, bundler (webpack, vite, esbuild)
2. **Convenções**: nomenclatura de classes CSS, organização de assets,
   uso de pré-processadores (SCSS/Less), design tokens
3. **Recomendações**: acessibilidade (WCAG 2.1), performance (Core Web Vitals),
   responsividade, SEO, progressive enhancement
4. **Code smells**: inline styles, !important excessivo, JS blocking render,
   imagens sem dimensões, falta de meta viewport
5. **Boas práticas**: CSS custom properties, container queries, lazy loading,
   service workers, CSP headers, minification

Responda sempre em Português do Brasil (pt-BR).
```

### Passo 3.3 — Implementação dos Especialistas

Cada especialista estende `LanguageSpecialistAgent`. Exemplo para Flutter/Dart:

```typescript
// src/agents/flutter-dart-specialist.agent.ts
import { AgentRole, FeatureContext, LanguageSpecificAnalysis, SessionContext } from '../types';
import { LanguageSpecialistAgent } from './base-language-specialist';

export class FlutterDartSpecialistAgent extends LanguageSpecialistAgent {
  readonly role = AgentRole.FlutterDartSpecialist;
  readonly name = 'Flutter/Dart Specialist';
  readonly targetLanguage = 'Dart';

  protected async analyze(fc: FeatureContext, ctx: SessionContext): Promise<LanguageSpecificAnalysis> {
    return this.withLlmFallback(
      () => this.llmAnalyze(fc, ctx),
      () => this.offlineAnalyze(fc),
    );
  }

  private async llmAnalyze(fc: FeatureContext, _ctx: SessionContext): Promise<LanguageSpecificAnalysis> {
    // Montar prompt com contexto do repositório e chamar LLM
    // Usar template de prompts/flutter-dart-specialist-agent.txt
    throw new Error('LLM not implemented yet');
  }

  private async offlineAnalyze(fc: FeatureContext): Promise<LanguageSpecificAnalysis> {
    const repo = fc.repositoryContext;
    const patterns: string[] = [];
    const conventions: string[] = [];
    const recommendations: string[] = [];

    if (repo) {
      const frameworks = repo.frameworks.map((f) => f.name.toLowerCase());
      if (frameworks.some((f) => f.includes('flutter'))) patterns.push('Flutter Framework');
      if (frameworks.some((f) => f.includes('bloc'))) patterns.push('BLoC Pattern');
      if (frameworks.some((f) => f.includes('riverpod'))) patterns.push('Riverpod');
      if (frameworks.some((f) => f.includes('provider'))) patterns.push('Provider');

      // Detect from file structure
      const files = repo.services.map((s) => s.filePath);
      if (files.some((f) => f.includes('/bloc/'))) patterns.push('BLoC Architecture');
      if (files.some((f) => f.includes('/domain/'))) patterns.push('Clean Architecture');
    }

    return {
      language: 'Dart/Flutter',
      patterns,
      conventions,
      recommendations,
      codeSmells: [],
      bestPractices: [],
    };
  }
}
```

Repetir o padrão para cada especialista: `CSharpDotNetSpecialistAgent`, `SqlSpecialistAgent`, `VisualFoxProSpecialistAgent`, `AngularSpecialistAgent`, `PythonSpecialistAgent`, `WebSpecialistAgent`.

---

## Fase 4 — Agentes de Visualização e Fluxogramas

### Passo 4.1 — `FlowchartGeneratorAgent` (`src/agents/flowchart-generator.agent.ts`)

**Prompt:** `prompts/flowchart-generator-agent.txt`

```text
Você é um especialista em diagramação técnica usando Mermaid.js.

A partir da arquitetura da solução, fluxos de dados e componentes propostos, gere:

1. **Fluxograma principal**: graph TD mostrando o fluxo completo da funcionalidade
   desde a requisição do usuário até a persistência e resposta
2. **Diagrama de sequência**: sequence diagram mostrando a interação entre
   componentes (Controller → Service → Repository → Database)
3. **Diagrama de classes**: class diagram dos novos componentes e suas relações
4. **Diagrama ER**: erDiagram das entidades envolvidas e seus relacionamentos
5. **Diagrama de estados**: stateDiagram-v2 se houver fluxo de estados (ex: workflow)

Regras:
- Use labels em português do Brasil
- Cada diagrama deve ter título descritivo
- Use cores e estilos para destacar componentes novos vs existentes
- Mantenha diagramas legíveis (máximo 15-20 nós por diagrama)
- Inclua descrição textual explicando cada diagrama

Formato de saída: Array de FlowchartOutput com mermaidCode, title, description, type.

Responda sempre em Português do Brasil (pt-BR).
```

**Implementação:**

```typescript
// src/agents/flowchart-generator.agent.ts
import { BaseAgent } from '../core';
import { Labels } from '../config';
import {
  AgentRole, FeatureContext, FlowchartOutput, SessionContext,
  SolutionArchitecture,
} from '../types';

export class FlowchartGeneratorAgent extends BaseAgent<FeatureContext, FlowchartOutput[]> {
  readonly role = AgentRole.FlowchartGenerator;
  readonly name = 'Flowchart Generator';

  protected async run(fc: FeatureContext, ctx: SessionContext): Promise<FlowchartOutput[]> {
    return this.withLlmFallback(
      () => this.llmGenerate(fc, ctx),
      () => this.offlineGenerate(fc),
    );
  }

  private async llmGenerate(fc: FeatureContext, _ctx: SessionContext): Promise<FlowchartOutput[]> {
    // Chamar LLM com prompt de flowchart-generator-agent.txt + contexto da solução
    throw new Error('LLM not implemented');
  }

  private async offlineGenerate(fc: FeatureContext): Promise<FlowchartOutput[]> {
    const charts: FlowchartOutput[] = [];
    const sol = fc.solutionArchitecture;
    if (!sol) return charts;

    // 1. Flowchart principal
    charts.push(this.buildMainFlowchart(sol, fc.rawRequirements ?? 'feature'));

    // 2. Sequence diagram
    charts.push(this.buildSequenceDiagram(sol));

    // 3. Class diagram
    if (sol.proposedComponents.length > 0) {
      charts.push(this.buildClassDiagram(sol));
    }

    return charts;
  }

  private buildMainFlowchart(sol: SolutionArchitecture, feature: string): FlowchartOutput {
    const nodes: string[] = ['graph TD'];
    nodes.push(`  A["Requisição do Usuário"] --> B["Validação de Entrada"]`);

    const services = sol.proposedComponents.filter((c) => c.type === 'service');
    const repos = sol.proposedComponents.filter((c) => c.type === 'repository');

    if (services.length > 0) {
      nodes.push(`  B --> C["${services[0].name}"]`);
      if (repos.length > 0) {
        nodes.push(`  C --> D["${repos[0].name}"]`);
        nodes.push(`  D --> E[("Banco de Dados")]`);
        nodes.push(`  E --> D`);
        nodes.push(`  D --> C`);
      }
      nodes.push(`  C --> F["Resposta ao Usuário"]`);
    }

    // Style new vs existing
    for (const comp of sol.proposedComponents) {
      if (comp.isNew) {
        const id = comp.name.charAt(0).toUpperCase();
        nodes.push(`  style ${id} fill:#e1f5fe,stroke:#0288d1`);
      }
    }

    return {
      mermaidCode: nodes.join('\n'),
      title: `Fluxo Principal — ${feature}`,
      description: `Fluxograma do fluxo principal da funcionalidade, desde a requisição até a persistência.`,
      type: 'flowchart',
    };
  }

  private buildSequenceDiagram(sol: SolutionArchitecture): FlowchartOutput {
    const lines: string[] = ['sequenceDiagram'];
    lines.push('  actor Usuário');

    const controller = sol.proposedComponents.find((c) => c.type === 'controller');
    const service = sol.proposedComponents.find((c) => c.type === 'service');
    const repo = sol.proposedComponents.find((c) => c.type === 'repository');

    const ctrlName = controller?.name ?? 'Controller';
    const svcName = service?.name ?? 'Service';
    const repoName = repo?.name ?? 'Repository';

    lines.push(`  participant ${ctrlName}`);
    lines.push(`  participant ${svcName}`);
    lines.push(`  participant ${repoName}`);
    lines.push(`  participant DB as Banco de Dados`);

    lines.push(`  Usuário->>${ctrlName}: Requisição HTTP`);
    lines.push(`  ${ctrlName}->>${svcName}: Processa regras de negócio`);
    lines.push(`  ${svcName}->>${repoName}: Persiste dados`);
    lines.push(`  ${repoName}->>DB: Query SQL`);
    lines.push(`  DB-->>${repoName}: Resultado`);
    lines.push(`  ${repoName}-->>${svcName}: Entidade`);
    lines.push(`  ${svcName}-->>${ctrlName}: DTO de resposta`);
    lines.push(`  ${ctrlName}->>Usuário: HTTP Response`);

    return {
      mermaidCode: lines.join('\n'),
      title: 'Diagrama de Sequência',
      description: 'Interação entre componentes durante o processamento da requisição.',
      type: 'sequence',
    };
  }

  private buildClassDiagram(sol: SolutionArchitecture): FlowchartOutput {
    const lines: string[] = ['classDiagram'];

    for (const comp of sol.proposedComponents) {
      lines.push(`  class ${comp.name.replace(/\s/g, '')} {`);
      lines.push(`    +${comp.type}`);
      lines.push(`    +${comp.description.substring(0, 50)}`);
      lines.push(`  }`);
    }

    // Relations
    for (const int of sol.integrations) {
      lines.push(`  ${int.source.replace(/\s/g, '')} --> ${int.target.replace(/\s/g, '')} : ${int.type}`);
    }

    return {
      mermaidCode: lines.join('\n'),
      title: 'Diagrama de Classes',
      description: 'Componentes propostos e suas relações.',
      type: 'class',
    };
  }
}
```

---

## Fase 5 — Agentes de Documentação Técnica, Executiva e Resumo

### Passo 5.1 — `TechnicalWriterAgent` (`src/agents/technical-writer.agent.ts`)

**Prompt:** `prompts/technical-writer-agent.txt`

```text
Você é um redator técnico sênior especializado em documentação de arquitetura de software.
Seu público são analistas e desenvolvedores seniores.

A partir do contexto completo da análise (requisitos, escopo, solução, impacto, estimativa),
gere documentação TÉCNICA completa:

1. **Visão Geral Técnica**: resumo da solução em 2-3 parágrafos
2. **Arquitetura**: componentes, camadas, padrões utilizados, integrações
3. **Modelo de Dados**: tabelas, relacionamentos, migrações necessárias
4. **APIs**: endpoints, contratos (request/response), autenticação
5. **Fluxos de Dados**: como os dados trafegam entre componentes
6. **Análise de Impacto**: áreas afetadas, riscos, breaking changes
7. **Estimativas**: horas por módulo, complexidade, confidence level
8. **Decisões Técnicas**: trade-offs considerados e justificativa
9. **Glossário**: termos técnicos utilizados no documento
10. **Referência Cruzada**: links entre seções quando conceitos se relacionam

Regras:
- Use linguagem técnica precisa mas acessível para desenvolvedores plenos/seniores
- Inclua exemplos de código quando relevante
- Inclua diagramas Mermaid inline quando útil
- Referencie arquivos existentes do repositório por caminho relativo
- Estruture com headers Markdown (##, ###) bem organizados
- Inclua tabelas para dados tabulares (estimativas, endpoints, campos)

Responda sempre em Português do Brasil (pt-BR).
```

### Passo 5.2 — `ExecutiveWriterAgent` (`src/agents/executive-writer.agent.ts`)

**Prompt:** `prompts/executive-writer-agent.txt`

```text
Você é um redator executivo especializado em comunicação de decisões técnicas para
gestores, POs, e stakeholders não-técnicos.

A partir do contexto completo da análise, gere documentação EXECUTIVA:

1. **Resumo Executivo**: o que será feito, por que, e qual o benefício — em 3-5 bullets
2. **Escopo em Linguagem de Negócio**: funcionalidades em termos de valor para o usuário,
   sem jargão técnico (ex: "O sistema permitirá que..." em vez de "O endpoint REST...")
3. **Impacto no Negócio**: áreas do sistema afetadas traduzidas para módulos de negócio
   (ex: "Módulo de Cadastro de Clientes" em vez de "CustomerController")
4. **Cronograma Simplificado**: estimativa em dias úteis (não horas), fases (análise,
   desenvolvimento, testes, deploy), com visualização tipo timeline
5. **Riscos e Mitigações**: riscos em linguagem não-técnica com plano de mitigação
6. **Investimento vs Retorno**: custo estimado (horas-dev) vs benefício esperado
7. **Próximos Passos**: ações claras com responsáveis sugeridos
8. **Dependências Externas**: o que precisa estar pronto antes (outras equipes, infra, etc.)

Regras:
- NUNCA use termos como API, endpoint, repository, controller, service, middleware
- Substitua por equivalentes de negócio: "ponto de integração", "módulo", "regra de negócio"
- Use bullets e numeração para facilitar a leitura rápida
- Máximo 2 páginas A4 equivalente em Markdown
- Inclua um diagrama Mermaid simplificado (max 6-8 nós) tipo "jornada do usuário"

Responda sempre em Português do Brasil (pt-BR).
```

### Passo 5.3 — `SummaryGeneratorAgent` (`src/agents/summary-generator.agent.ts`)

**Prompt:** `prompts/summary-generator-agent.txt`

```text
Você é um especialista em comunicação concisa e apresentações executivas.

Gere três variantes de resumo da análise:

1. **One-liner** (1 frase): descrição da funcionalidade em uma frase
2. **Elevator pitch** (30 segundos / ~100 palavras): o que, por que, como, quando
3. **Resumo para daily/sprint planning** (~200 palavras): escopo, impacto,
   estimativa, riscos principais, dependências

Cada resumo deve:
- Ser auto-contido (não requer leitura do documento completo)
- Usar linguagem acessível a todos os papéis (dev, QA, PO, gestor)
- Destacar números-chave: horas estimadas, módulos impactados, nível de risco

Formato de saída:
```markdown
## Resumo Rápido

### Em uma frase
[one-liner]

### Elevator Pitch
[elevator pitch]

### Para Daily/Sprint
[resumo]
```

Responda sempre em Português do Brasil (pt-BR).
```

---

## Fase 6 — Agente Prototipador Rico (Rich Prototype)

### Passo 6.1 — `RichPrototypeGeneratorAgent` (`src/agents/rich-prototype-generator.agent.ts`)

**Prompt:** `prompts/rich-prototype-agent.txt`

```text
Você é um engenheiro de UI/UX sênior especializado em prototipação rápida interativa.

Gere um protótipo FUNCIONAL com interface rica, responsiva e interativa:

1. **Se o projeto é Angular**: gere componentes standalone com Angular Material ou
   PrimeNG, responsivos (flex layout / CSS grid), com formulários reativos, tabelas
   com paginação/filtro, e navegação por rotas

2. **Se o projeto é Flutter**: gere widgets Material 3 com responsive layout,
   formulários com validação, listas com scroll infinito, navigation 2.0

3. **Se o projeto é HTML/JS/CSS**: gere HTML5 semântico + CSS3 responsivo (media queries,
   flexbox, grid) + JavaScript vanilla ou com framework leve. Inclua:
   - Layout responsivo que funcione em mobile, tablet e desktop
   - Formulários com validação client-side
   - Tabelas interativas com sort/filter
   - Modais/dialogs para confirmação
   - Feedback visual (loading states, success/error messages)
   - Tema claro/escuro via CSS custom properties

4. **Se o projeto é C#/.NET**: gere Razor Pages ou Blazor components com
   Bootstrap 5 responsivo

5. **Se o projeto é Python**: gere templates Jinja2 com Bootstrap ou
   Streamlit para dashboards

Regras:
- O protótipo DEVE ser funcional (não apenas wireframe)
- DEVE ser responsivo (mobile-first)
- DEVE ter interatividade (formulários, botões, navegação)
- Use dados mock realistas (nomes brasileiros, CPF, endereços BR)
- Inclua CSS inline ou em arquivo separado — nunca dependa de CDN externo
- Gere um index.html que funcione standalone para HTML projects
- Labels e textos em Português do Brasil

Formato de saída: RichPrototypeOutput com files[], entryPoint, responsive, interactive, framework.

Responda sempre em Português do Brasil (pt-BR).
```

---

## Fase 7 — Novo Pipeline no Orchestrator

### Passo 7.1 — Expandir o pipeline em `src/orchestrator/orchestrator.ts`

O pipeline evolui de 10 para ~18 passos. Inserir novos steps **após o Step 1 (Repository Indexer):**

```
 1. Repository Indexer       (existente)
 2. Git Analyzer             ★ NOVO
 3. Project Discovery        ★ NOVO
 4. Attachment Reader        ★ NOVO (condicional — se houver paths anexados)
 5. Language Detection       (existente, aprimorado)
 6. Language Specialists     ★ NOVO (paralelo, só linguas detectadas)
 7. Database Reader          (existente)
 8. Requirements             (existente)
 9. Scope                    (existente)
10. Reuse                    (existente)
11. Solution Architect       (existente)
12. Impact Analysis          (existente)
13. Estimation               (existente)
14. Flowchart Generator      ★ NOVO
15. Technical Writer         ★ NOVO (substitui Documentation Generator)
16. Executive Writer         ★ NOVO
17. Summary Generator        ★ NOVO
18. Rich Prototype           ★ NOVO (substitui Prototype Generator original)
```

### Passo 7.2 — Whitelist no ModeManager

Adicionar ao `REPOSITORY_ONLY_AGENTS` em `src/core/mode-manager.ts`:

```typescript
const REPOSITORY_ONLY_AGENTS = new Set([
  'Repository Indexer',
  'Git Analyzer',           // ★
  'Project Discovery',      // ★
  'Attachment Reader',      // ★
  'Reuse Analyst',
  'Impact Analyst',
  'Estimation Agent',
  'Flowchart Generator',    // ★
  'Technical Writer',       // ★
  'Executive Writer',       // ★
  'Summary Generator',      // ★
]);
```

### Passo 7.3 — Barrel export em `src/agents/index.ts`

```typescript
// Novos exports
export { GitAnalyzerAgent } from './git-analyzer.agent';
export { ProjectDiscoveryAgent } from './project-discovery.agent';
export { AttachmentReaderAgent } from './attachment-reader.agent';
export { FlowchartGeneratorAgent } from './flowchart-generator.agent';
export { TechnicalWriterAgent } from './technical-writer.agent';
export { ExecutiveWriterAgent } from './executive-writer.agent';
export { SummaryGeneratorAgent } from './summary-generator.agent';
export { RichPrototypeGeneratorAgent } from './rich-prototype-generator.agent';

// Language specialists
export { FlutterDartSpecialistAgent } from './flutter-dart-specialist.agent';
export { CSharpDotNetSpecialistAgent } from './csharp-dotnet-specialist.agent';
export { SqlSpecialistAgent } from './sql-specialist.agent';
export { VisualFoxProSpecialistAgent } from './visual-foxpro-specialist.agent';
export { AngularSpecialistAgent } from './angular-specialist.agent';
export { PythonSpecialistAgent } from './python-specialist.agent';
export { WebSpecialistAgent } from './web-specialist.agent';
```

---

## Fase 8 — Labels em `src/config/language.ts`

Adicionar seções ao objeto `Labels`:

```typescript
  // ── Git Analysis ────────────────────────────────────────
  git: {
    title: 'Análise do Repositório Git',
    recentCommits: 'Commits Recentes',
    activeAuthors: 'Autores Ativos',
    hotFiles: 'Arquivos Mais Alterados',
    branches: 'Branches',
    lastActivity: 'Última Atividade',
    notAGitRepo: 'Diretório não é um repositório Git.',
  },

  // ── Project Discovery ───────────────────────────────────
  projectDiscovery: {
    title: 'Descoberta de Projetos',
    projectsFound: 'Projetos Encontrados',
    monorepo: 'Monorepo Detectado',
    sharedDependencies: 'Dependências Compartilhadas',
    type: 'Tipo',
    language: 'Linguagem',
    framework: 'Framework',
  },

  // ── Flowcharts ──────────────────────────────────────────
  flowchart: {
    title: 'Diagramas Visuais',
    mainFlow: 'Fluxo Principal',
    sequenceDiagram: 'Diagrama de Sequência',
    classDiagram: 'Diagrama de Classes',
    erDiagram: 'Diagrama Entidade-Relacionamento',
    stateDiagram: 'Diagrama de Estados',
  },

  // ── Documentation Variants ──────────────────────────────
  docVariants: {
    technical: 'Documentação Técnica',
    executive: 'Documentação Executiva',
    summary: 'Resumo Rápido',
    oneLiner: 'Em uma frase',
    elevatorPitch: 'Elevator Pitch',
    sprintSummary: 'Para Daily/Sprint',
  },

  // ── Language Specialists ────────────────────────────────
  languageSpecialist: {
    title: 'Análise Especializada por Linguagem',
    patterns: 'Padrões Identificados',
    conventions: 'Convenções',
    recommendations: 'Recomendações',
    codeSmells: 'Code Smells',
    bestPractices: 'Boas Práticas',
  },

  // ── Rich Prototype ─────────────────────────────────────
  richPrototype: {
    title: 'Protótipo Interativo',
    responsive: 'Responsivo',
    interactive: 'Interativo',
    entryPoint: 'Ponto de Entrada',
    framework: 'Framework',
    filesGenerated: 'Arquivos Gerados',
  },
```

---

## Fase 9 — CLI Updates em `src/index.ts`

Adicionar opções ao comando `generate`:

```typescript
program
  .command('generate')
  .description('Run the full analysis pipeline and generate the output package')
  .argument('<description>', 'Feature description or requirement text')
  .option('--prototype', 'Generate a rich interactive prototype', false)
  .option('--attach <paths...>', 'Attach files/directories as additional context')
  .option('--technical', 'Generate technical documentation', true)
  .option('--executive', 'Generate executive documentation', true)
  .option('--summary', 'Generate summary variants', true)
  .option('--flowcharts', 'Generate visual flowcharts', true)
  .option('--specialists', 'Run language-specific specialist agents', true)
```

Passar os `attach` paths para `OrchestratorOptions`:

```typescript
export interface OrchestratorOptions {
  projectPath: string;
  config: AppConfig;
  requirements?: string;
  generatePrototype?: boolean;
  mode?: string;
  attachPaths?: string[];           // ★ NOVO
  enableSpecialists?: boolean;      // ★ NOVO
  enableFlowcharts?: boolean;       // ★ NOVO
  enableExecutiveDocs?: boolean;    // ★ NOVO
}
```

---

## Fase 10 — Estrutura Final de Output

O `OutputGenerator` deve produzir a seguinte estrutura por feature:

```
docs/features/{feature-name}/
├── requirements.md          (existente)
├── scope.md                 (existente)
├── solution.md              (existente)
├── impact.md                (existente)
├── estimation.md            (existente)
├── documentation.md         → renomear para technical.md
├── executive.md             ★ NOVO
├── summary.md               ★ NOVO
├── flowcharts.md            ★ NOVO (diagramas Mermaid embarcados)
├── git-analysis.md          ★ NOVO
├── project-discovery.md     ★ NOVO
├── language-analysis.md     ★ NOVO (consolidado de todos os especialistas)
├── feature-context.json     (existente, expandido)
├── pipeline-result.json     (existente)
└── prototype/               ★ NOVO (expandido)
    ├── index.html
    ├── styles.css
    ├── app.js
    └── ...
```

---

## Checklist de Implementação

| # | Arquivo | Ação |
|---|---------|------|
| 1 | `src/types/index.ts` | Expandir `AgentRole`, adicionar novos tipos, expandir `FeatureContext` |
| 2 | `src/agents/git-analyzer.agent.ts` | Criar |
| 3 | `src/agents/project-discovery.agent.ts` | Criar |
| 4 | `src/agents/attachment-reader.agent.ts` | Criar |
| 5 | `src/agents/base-language-specialist.ts` | Criar |
| 6 | `src/agents/flutter-dart-specialist.agent.ts` | Criar |
| 7 | `src/agents/csharp-dotnet-specialist.agent.ts` | Criar |
| 8 | `src/agents/sql-specialist.agent.ts` | Criar |
| 9 | `src/agents/visual-foxpro-specialist.agent.ts` | Criar |
| 10 | `src/agents/angular-specialist.agent.ts` | Criar |
| 11 | `src/agents/python-specialist.agent.ts` | Criar |
| 12 | `src/agents/web-specialist.agent.ts` | Criar |
| 13 | `src/agents/flowchart-generator.agent.ts` | Criar |
| 14 | `src/agents/technical-writer.agent.ts` | Criar |
| 15 | `src/agents/executive-writer.agent.ts` | Criar |
| 16 | `src/agents/summary-generator.agent.ts` | Criar |
| 17 | `src/agents/rich-prototype-generator.agent.ts` | Criar |
| 18 | `src/agents/index.ts` | Exportar todos os novos agentes |
| 19 | `src/config/language.ts` | Adicionar Labels novos |
| 20 | `src/core/mode-manager.ts` | Whitelist novos agentes REPOSITORY_ONLY |
| 21 | `src/orchestrator/orchestrator.ts` | Expandir pipeline de 10→18 steps |
| 22 | `src/index.ts` | Adicionar CLI options (--attach, etc.) |
| 23 | `src/output/output-generator.ts` | Gerar novos arquivos de saída |
| 24 | `prompts/git-analyzer-agent.txt` | Criar |
| 25 | `prompts/project-discovery-agent.txt` | Criar |
| 26 | `prompts/attachment-reader-agent.txt` | Criar |
| 27 | `prompts/flowchart-generator-agent.txt` | Criar |
| 28 | `prompts/technical-writer-agent.txt` | Criar |
| 29 | `prompts/executive-writer-agent.txt` | Criar |
| 30 | `prompts/summary-generator-agent.txt` | Criar |
| 31 | `prompts/rich-prototype-agent.txt` | Criar |
| 32 | `prompts/flutter-dart-specialist-agent.txt` | Criar |
| 33 | `prompts/csharp-dotnet-specialist-agent.txt` | Criar |
| 34 | `prompts/sql-specialist-agent.txt` | Criar |
| 35 | `prompts/visual-foxpro-specialist-agent.txt` | Criar |
| 36 | `prompts/angular-specialist-agent.txt` | Criar |
| 37 | `prompts/python-specialist-agent.txt` | Criar |
| 38 | `prompts/web-specialist-agent.txt` | Criar |

---

## Ordem de Execução Recomendada

1. **Tipos e infraestrutura** (Fase 1) — tudo depende dos tipos
2. **Git + ProjectDiscovery + Attachment** (Fase 2) — fornecem contexto para todos
3. **Base specialist + 7 specialists** (Fase 3) — podem rodar em paralelo
4. **Flowchart generator** (Fase 4) — depende da solução
5. **Technical/Executive/Summary writers** (Fase 5) — dependem de tudo acima
6. **Rich Prototype** (Fase 6) — independente, pode ser em paralelo com writers
7. **Orchestrator + ModeManager + CLI** (Fase 7-9) — integra tudo
8. **OutputGenerator** (Fase 10) — gera os arquivos finais
