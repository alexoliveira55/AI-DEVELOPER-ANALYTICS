// ── Execution Modes ──────────────────────────────────────────────────────────

export enum ExecutionMode {
  LLM_ONLINE = 'llm-online',
  LLM_OFFLINE = 'llm-offline',
  REPOSITORY_ONLY = 'repository-only',
}

/** Represents a role an agent can fulfill in the system. */
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
  WebSpecialist = 'web-specialist',

  // ── Novos — Visualização & Documentação ─
  FlowchartGenerator = 'flowchart-generator',
  RichPrototypeGenerator = 'rich-prototype-generator',
  TechnicalWriter = 'technical-writer',
  ExecutiveWriter = 'executive-writer',
  SummaryGenerator = 'summary-generator',
}

/** Message passed between agents. */
export interface AgentMessage {
  from: AgentRole;
  to: AgentRole;
  type: 'request' | 'response' | 'event';
  payload: unknown;
  timestamp: Date;
  correlationId: string;
}

/** Shared context available to all agents during a session. */
export interface SessionContext {
  sessionId: string;
  projectPath: string;
  config: AppConfig;
  artifacts: Map<string, unknown>;
}

/** Top-level application configuration. */
export interface AppConfig {
  ai: AiProviderConfig;
  logging: LoggingConfig;
  output: OutputConfig;
  database?: DatabaseConfig;
  executionMode?: string;
  language?: string;
}

export interface AiProviderConfig {
  provider: string;
  apiKey: string;
  model: string;
}

export interface LoggingConfig {
  level: string;
}

export interface OutputConfig {
  dir: string;
}

export interface DatabaseConfig {
  connectionString: string;
  provider?: 'postgres' | 'mysql' | 'mssql';
  schema?: string;
}

/** Result produced by an agent after processing. */
export interface AgentResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Repository index metadata. */
export interface RepoIndex {
  files: FileEntry[];
  languages: Record<string, number>;
  totalLines: number;
  dependencies: string[];
}

export interface FileEntry {
  path: string;
  language: string;
  lines: number;
  size: number;
}

/** Database schema snapshot. */
export interface DatabaseSchema {
  tables: TableInfo[];
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
}

/** Estimation output. */
export interface Estimation {
  totalHours: number;
  breakdown: EstimationItem[];
  confidence: 'low' | 'medium' | 'high';
}

export interface EstimationItem {
  task: string;
  hours: number;
  complexity: 'low' | 'medium' | 'high';
}

// ── Requirements Analysis ────────────────────────────────────────────────────

export interface RequirementsAnalysis {
  functionalRequirements: Requirement[];
  nonFunctionalRequirements: Requirement[];
  assumptions: string[];
  constraints: string[];
}

export interface Requirement {
  id: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  category: string;
}

// ── Scope Definition ─────────────────────────────────────────────────────────

export interface ScopeDefinition {
  inScope: ScopeItem[];
  outOfScope: string[];
  affectedModules: string[];
  newModules: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface ScopeItem {
  area: string;
  description: string;
  type: 'new' | 'modification' | 'integration';
}

// ── Reuse Analysis ───────────────────────────────────────────────────────────

export interface ReuseAnalysis {
  candidates: ReuseCandidate[];
  summary: string;
  reuseScore: number;
}

export interface ReuseCandidate {
  name: string;
  filePath: string;
  type: string;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}

// ── Solution Architecture ────────────────────────────────────────────────────

export interface SolutionArchitecture {
  overview: string;
  proposedComponents: ProposedComponent[];
  integrations: Integration[];
  dataFlows: DataFlow[];
  technologyStack: string[];
}

export interface ProposedComponent {
  name: string;
  type: 'service' | 'controller' | 'repository' | 'middleware' | 'utility' | 'model' | 'migration';
  description: string;
  isNew: boolean;
  dependencies: string[];
}

export interface Integration {
  source: string;
  target: string;
  type: string;
  description: string;
}

export interface DataFlow {
  from: string;
  to: string;
  data: string;
  description: string;
}

// ── Impact Analysis ──────────────────────────────────────────────────────────

export interface ImpactAnalysis {
  impactedAreas: ImpactedArea[];
  riskLevel: 'low' | 'medium' | 'high';
  breakingChanges: string[];
  testingRecommendations: string[];
  migrationNotes: string[];
}

export interface ImpactedArea {
  area: string;
  files: string[];
  impact: 'low' | 'medium' | 'high';
  description: string;
}

// ── Prototype Output ─────────────────────────────────────────────────────────

export interface PrototypeOutput {
  files: { path: string; content: string }[];
}

// ── Feature Context (shared across all agents) ──────────────────────────────

/**
 * Shared context object that accumulates outputs from every agent in the
 * pipeline.  Each field is optional so agents that run early (e.g. the
 * RepositoryIndexer) don't need the full bag, while late-stage agents
 * (e.g. Estimation, Documentation) can read everything that came before.
 *
 * The Orchestrator creates this object, passes it into every agent, and
 * collects outputs back into it after each step.
 */
export interface FeatureContext {
  /** Raw requirement / feature description supplied by the user. */
  rawRequirements?: string;

  // ── Stage 1 — Repository ────────────────────────────────
  repositoryContext?: import('../indexer').RepositoryContext;

  /** Legacy flat shape consumed by estimation / doc / prototype agents. */
  repoIndex?: RepoIndex;

  // ── Stage 2 — Database ──────────────────────────────────
  databaseSummary?: import('../database').DatabaseSummary;

  // ── Stage 3 — Requirements ──────────────────────────────
  requirementsAnalysis?: RequirementsAnalysis;

  // ── Stage 4 — Scope ─────────────────────────────────────
  scopeDefinition?: ScopeDefinition;

  // ── Stage 5 — Reuse ─────────────────────────────────────
  reuseAnalysis?: ReuseAnalysis;

  // ── Stage 6 — Solution Architecture ─────────────────────
  solutionArchitecture?: SolutionArchitecture;

  // ── Stage 7 — Impact Analysis ───────────────────────────
  impactAnalysis?: ImpactAnalysis;

  // ── Stage 8 — Estimation ────────────────────────────────
  estimation?: Estimation;

  // ── Stage 9 — Documentation ─────────────────────────────
  documentation?: string;

  // ── Stage 10 — Prototype ────────────────────────────────
  prototype?: PrototypeOutput;

  // ── Novos campos (v2) ───────────────────────────────────
  gitAnalysis?: GitAnalysis;
  projectDiscovery?: ProjectDiscoveryResult;
  attachmentContext?: AttachmentContext;
  languageAnalyses?: LanguageSpecificAnalysis[];
  flowcharts?: FlowchartOutput[];
  documentationPackage?: DocumentationPackage;
  richPrototype?: RichPrototypeOutput;
}

// ── Git Analysis ─────────────────────────────────────────────────────────────

export interface GitAnalysis {
  recentCommits: GitCommitInfo[];
  activeAuthors: string[];
  hotFiles: string[];
  branchInfo: { current: string; branches: string[] };
  lastActivity: string;
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
  technical: string;
  executive: string;
  summary: string;
  flowcharts: FlowchartOutput[];
}

// ── Rich Prototype ───────────────────────────────────────────────────────────

export interface RichPrototypeOutput {
  files: { path: string; content: string }[];
  entryPoint: string;
  responsive: boolean;
  interactive: boolean;
  framework: string;
}

// ── Pipeline Result ──────────────────────────────────────────────────────────

/** Metadata about a single pipeline step execution. */
export interface StepResult {
  stepName: string;
  agent: string;
  success: boolean;
  skipped: boolean;
  error?: string;
  durationMs: number;
}

/** Envelope returned by the orchestrator with full pipeline metadata. */
export interface PipelineResult {
  success: boolean;
  sessionId: string;
  featureName: string;
  executionMode: ExecutionMode;
  steps: StepResult[];
  errors: string[];
  warnings: string[];
  durationMs: number;
  context: FeatureContext;
}
