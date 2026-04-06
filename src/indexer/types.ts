// ── Full Repository Index Types ──────────────────────────────────────────────

export interface RepositoryContext {
  meta: RepositoryMeta;
  languages: LanguageSummary[];
  frameworks: FrameworkDetection[];
  architecturePattern: ArchitecturePattern;
  services: ServiceEntry[];
  controllers: ControllerEntry[];
  repositories: RepositoryEntry[];
  components: ComponentEntry[];
  apiEndpoints: ApiEndpoint[];
  databaseScripts: DatabaseScriptEntry[];
  reusableComponents: ReusableComponentEntry[];
}

export interface RepositoryMeta {
  name: string;
  rootPath: string;
  indexedAt: string;
  totalFiles: number;
  totalLines: number;
  totalSizeBytes: number;
}

export interface LanguageSummary {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

export interface FrameworkDetection {
  name: string;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface ArchitecturePattern {
  primary: string;
  patterns: string[];
  evidence: string[];
}

export interface ServiceEntry {
  name: string;
  filePath: string;
  methods: string[];
  injectedDependencies: string[];
}

export interface ControllerEntry {
  name: string;
  filePath: string;
  basePath?: string;
  actions: ControllerAction[];
}

export interface ControllerAction {
  name: string;
  httpMethod?: string;
  route?: string;
  line: number;
}

export interface RepositoryEntry {
  name: string;
  filePath: string;
  entity?: string;
  methods: string[];
}

export interface ComponentEntry {
  name: string;
  filePath: string;
  type: 'class' | 'function' | 'module';
  exports: string[];
}

export interface ApiEndpoint {
  method: string;
  route: string;
  handler: string;
  filePath: string;
  line: number;
}

export interface DatabaseScriptEntry {
  filePath: string;
  type: 'migration' | 'seed' | 'procedure' | 'schema' | 'query';
  tables: string[];
}

export interface ReusableComponentEntry {
  name: string;
  filePath: string;
  category: 'utility' | 'helper' | 'shared' | 'common' | 'lib' | 'hook' | 'middleware' | 'decorator' | 'pipe' | 'guard' | 'interceptor';
  exports: string[];
}

// ── Scanner interface ────────────────────────────────────────────────────────

export interface ScannedFile {
  absolutePath: string;
  relativePath: string;
  extension: string;
  language: string;
  lines: number;
  size: number;
  content: string;
}
