import { ApiEndpoint, ScannedFile } from '../types';

/**
 * Extracts API endpoint definitions from source files.
 * Supports decorator-based (NestJS, Spring) and programmatic (Express, Fastify, Gin) styles.
 */
export function extractApiEndpoints(files: ScannedFile[]): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];

  for (const file of files) {
    if (!isRoutableFile(file)) continue;
    endpoints.push(...fromDecorators(file));
    endpoints.push(...fromExpressStyle(file));
    endpoints.push(...fromFastifyStyle(file));
  }

  return endpoints;
}

// ── Decorator-based (NestJS / Spring / ASP.NET) ──────────────────────────────

const HTTP_DECORATOR_RE =
  /@(Get|Post|Put|Patch|Delete|Head|Options|All|HttpGet|HttpPost|HttpPut|HttpDelete|RequestMapping|GetMapping|PostMapping|PutMapping|DeleteMapping)\s*\(\s*['"]?([^'")\s]*)?['"]?\s*\)/g;

function fromDecorators(file: ScannedFile): ApiEndpoint[] {
  const results: ApiEndpoint[] = [];
  const lines = file.content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    HTTP_DECORATOR_RE.lastIndex = 0;
    const m = HTTP_DECORATOR_RE.exec(lines[i]);
    if (!m) continue;
    const method = normalizeMethod(m[1]);
    const route = m[2] || '/';
    const handler = findNextMethod(lines, i + 1);
    results.push({ method, route, handler, filePath: file.relativePath, line: i + 1 });
  }
  return results;
}

// ── Express-style: app.get('/path', handler) or router.post(...) ─────────────

const EXPRESS_RE =
  /(?:app|router|server)\.(get|post|put|patch|delete|options|head|all)\s*\(\s*['"`]([^'"`]+)['"`]/g;

function fromExpressStyle(file: ScannedFile): ApiEndpoint[] {
  const results: ApiEndpoint[] = [];
  const lines = file.content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    EXPRESS_RE.lastIndex = 0;
    const m = EXPRESS_RE.exec(lines[i]);
    if (m) {
      results.push({
        method: m[1].toUpperCase(),
        route: m[2],
        handler: extractHandlerName(lines[i]),
        filePath: file.relativePath,
        line: i + 1,
      });
    }
  }
  return results;
}

// ── Fastify-style: fastify.route({ method, url }) ───────────────────────────

const FASTIFY_ROUTE_RE =
  /(?:fastify|server|app)\.route\s*\(\s*\{[^}]*method:\s*['"](\w+)['"][^}]*url:\s*['"]([^'"]+)['"][^}]*\}/g;

function fromFastifyStyle(file: ScannedFile): ApiEndpoint[] {
  const results: ApiEndpoint[] = [];
  const joined = file.content;
  let m: RegExpExecArray | null;
  FASTIFY_ROUTE_RE.lastIndex = 0;
  while ((m = FASTIFY_ROUTE_RE.exec(joined)) !== null) {
    const line = joined.substring(0, m.index).split('\n').length;
    results.push({
      method: m[1].toUpperCase(),
      route: m[2],
      handler: 'route-handler',
      filePath: file.relativePath,
      line,
    });
  }
  return results;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isRoutableFile(f: ScannedFile): boolean {
  const codeLangs = ['TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'Go', 'Kotlin', 'Ruby', 'PHP'];
  return codeLangs.includes(f.language);
}

function normalizeMethod(decorator: string): string {
  const map: Record<string, string> = {
    Get: 'GET', HttpGet: 'GET', GetMapping: 'GET',
    Post: 'POST', HttpPost: 'POST', PostMapping: 'POST',
    Put: 'PUT', HttpPut: 'PUT', PutMapping: 'PUT',
    Patch: 'PATCH',
    Delete: 'DELETE', HttpDelete: 'DELETE', DeleteMapping: 'DELETE',
    Head: 'HEAD', Options: 'OPTIONS', All: 'ALL',
    RequestMapping: 'ALL',
  };
  return map[decorator] ?? decorator.toUpperCase();
}

function findNextMethod(lines: string[], startIdx: number): string {
  for (let i = startIdx; i < Math.min(startIdx + 5, lines.length); i++) {
    const m = /(?:async\s+)?(\w+)\s*\(/.exec(lines[i]);
    if (m && m[1] !== 'async') return m[1];
  }
  return 'anonymous';
}

function extractHandlerName(line: string): string {
  // Try to find a named function reference: ..., handlerName) or ..., handlerName,
  const m = /,\s*(\w+)\s*[,)]/.exec(line);
  return m?.[1] ?? 'inline-handler';
}
