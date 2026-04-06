import {
  ComponentEntry,
  ControllerAction,
  ControllerEntry,
  RepositoryEntry,
  ScannedFile,
  ServiceEntry,
} from '../types';

// ── Services ─────────────────────────────────────────────────────────────────

const SERVICE_FILE_PATTERN = /\.service\.|\.provider\.|Service\.(ts|js|java|cs|py|go|kt)$/i;
const CLASS_RE = /(?:export\s+)?class\s+(\w+)/g;
const METHOD_RE = /(?:async\s+)?(\w+)\s*\([^)]*\)\s*[:{]/g;
const INJECT_RE = /(?:private|protected|readonly)\s+(?:readonly\s+)?(\w+)\s*:\s*(\w+)/g;

export function extractServices(files: ScannedFile[]): ServiceEntry[] {
  return files
    .filter((f) => SERVICE_FILE_PATTERN.test(f.relativePath))
    .map((f) => {
      const className = firstMatch(CLASS_RE, f.content) ?? nameFromPath(f.relativePath);
      const methods = allMatches(METHOD_RE, f.content).filter(
        (m) => m !== 'constructor' && !m.startsWith('_'),
      );
      const injectedDependencies = allMatchesGroup(INJECT_RE, f.content, 2);
      return { name: className, filePath: f.relativePath, methods, injectedDependencies };
    });
}

// ── Controllers ──────────────────────────────────────────────────────────────

const CONTROLLER_FILE_PATTERN = /\.controller\.|Controller\.(ts|js|java|cs|py|go|kt)$/i;
const ROUTE_DECORATOR_RE = /@(?:Controller|RequestMapping|Route)\s*\(\s*['"]([^'"]*)['"]\s*\)/;
const ACTION_DECORATOR_RE =
  /@(Get|Post|Put|Patch|Delete|Head|Options|All)\s*\(\s*['"]?([^'")]*)?['"]?\s*\)/g;

export function extractControllers(files: ScannedFile[]): ControllerEntry[] {
  return files
    .filter((f) => CONTROLLER_FILE_PATTERN.test(f.relativePath))
    .map((f) => {
      const className = firstMatch(CLASS_RE, f.content) ?? nameFromPath(f.relativePath);
      const baseMatch = ROUTE_DECORATOR_RE.exec(f.content);
      const basePath = baseMatch?.[1];
      const actions = extractActions(f.content);
      return { name: className, filePath: f.relativePath, basePath, actions };
    });
}

function extractActions(content: string): ControllerAction[] {
  const actions: ControllerAction[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = ACTION_DECORATOR_RE.exec(lines[i]);
    if (match) {
      const httpMethod = match[1].toUpperCase();
      const route = match[2] || '/';
      // Next non-decorator line with a method signature
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        const mMatch = /(?:async\s+)?(\w+)\s*\(/.exec(lines[j]);
        if (mMatch) {
          actions.push({ name: mMatch[1], httpMethod, route, line: j + 1 });
          break;
        }
      }
    }
    ACTION_DECORATOR_RE.lastIndex = 0;
  }
  // Fallback: extract plain method names if no decorator-based actions found
  if (actions.length === 0) {
    const methods = allMatches(METHOD_RE, content).filter(
      (m) => m !== 'constructor' && !m.startsWith('_'),
    );
    methods.forEach((m) => actions.push({ name: m, line: 0 }));
  }
  return actions;
}

// ── Repositories ─────────────────────────────────────────────────────────────

const REPO_FILE_PATTERN = /\.repository\.|\.repo\.|Repository\.(ts|js|java|cs|py|go|kt)$/i;
const ENTITY_RE = /(?:Repository|getRepository)\s*<\s*(\w+)\s*>/;

export function extractRepositories(files: ScannedFile[]): RepositoryEntry[] {
  return files
    .filter((f) => REPO_FILE_PATTERN.test(f.relativePath))
    .map((f) => {
      const className = firstMatch(CLASS_RE, f.content) ?? nameFromPath(f.relativePath);
      const entityMatch = ENTITY_RE.exec(f.content);
      const methods = allMatches(METHOD_RE, f.content).filter(
        (m) => m !== 'constructor' && !m.startsWith('_'),
      );
      return { name: className, filePath: f.relativePath, entity: entityMatch?.[1], methods };
    });
}

// ── Generic Components ───────────────────────────────────────────────────────

const EXPORT_RE = /export\s+(?:default\s+)?(?:class|function|const|interface|type|enum)\s+(\w+)/g;

export function extractComponents(files: ScannedFile[]): ComponentEntry[] {
  // Exclude files already captured as services/controllers/repositories
  const exclude = new RegExp(
    `${SERVICE_FILE_PATTERN.source}|${CONTROLLER_FILE_PATTERN.source}|${REPO_FILE_PATTERN.source}`,
    'i',
  );
  return files
    .filter((f) => !exclude.test(f.relativePath) && isCodeFile(f))
    .map((f) => {
      const exports = allMatches(EXPORT_RE, f.content);
      const hasClass = /(?:export\s+)?class\s+/.test(f.content);
      const type = hasClass ? 'class' : exports.length > 0 ? 'module' : 'function';
      return {
        name: nameFromPath(f.relativePath),
        filePath: f.relativePath,
        type: type as ComponentEntry['type'],
        exports,
      };
    })
    .filter((c) => c.exports.length > 0);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function firstMatch(re: RegExp, text: string): string | undefined {
  re.lastIndex = 0;
  const m = re.exec(text);
  return m?.[1];
}

function allMatches(re: RegExp, text: string): string[] {
  re.lastIndex = 0;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) results.push(m[1]);
  return [...new Set(results)];
}

function allMatchesGroup(re: RegExp, text: string, group: number): string[] {
  re.lastIndex = 0;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[group]) results.push(m[group]);
  }
  return [...new Set(results)];
}

function nameFromPath(relativePath: string): string {
  const base = relativePath.split('/').pop() ?? relativePath;
  return base.replace(/\.[^.]+$/, '').replace(/\.(service|controller|repository|repo|module)$/, '');
}

function isCodeFile(f: ScannedFile): boolean {
  return ['TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'Go', 'Rust', 'Kotlin', 'Ruby', 'PHP', 'Dart', 'Swift'].includes(f.language);
}
