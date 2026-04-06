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

const CSPROJ_RE = /\.csproj$/;
const SLN_RE = /\.sln$/;
const PRG_RE = /\.prg$/i;
const PJX_RE = /\.pjx$/i;

const IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', 'bin', 'obj',
  '__pycache__', '.venv', 'venv', 'coverage', '.next',
]);

/** Recursively discovers projects and sub-projects inside a directory tree. */
export class ProjectDiscoveryAgent extends BaseAgent<string, ProjectDiscoveryResult> {
  readonly role = AgentRole.ProjectDiscovery;
  readonly name = 'Project Discovery';

  protected async run(rootPath: string, _ctx: SessionContext): Promise<ProjectDiscoveryResult> {
    const resolvedRoot = path.resolve(rootPath);
    const projects: DiscoveredProject[] = [];
    this.scan(resolvedRoot, resolvedRoot, projects, 0, 5);

    const allDeps = projects.flatMap((p) => p.dependencies);
    const depCounts = new Map<string, number>();
    allDeps.forEach((d) => depCounts.set(d, (depCounts.get(d) ?? 0) + 1));
    const shared = [...depCounts.entries()].filter(([, c]) => c > 1).map(([d]) => d);

    const monorepo = projects.length > 1 ||
      fs.existsSync(path.join(resolvedRoot, 'lerna.json')) ||
      fs.existsSync(path.join(resolvedRoot, 'nx.json'));

    return { projects, monorepo, sharedDependencies: shared };
  }

  private scan(root: string, dir: string, out: DiscoveredProject[], depth: number, max: number) {
    if (depth > max) return;
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    const fileNames = entries.filter((e) => e.isFile()).map((e) => e.name);
    let detected = false;

    // Check indicator files
    for (const [indicator, info] of Object.entries(PROJECT_INDICATORS)) {
      if (fileNames.includes(indicator)) {
        // angular.json overrides generic package.json
        const framework = fileNames.includes('angular.json') ? 'Angular' : info.framework;
        const language = framework === 'Angular' ? 'TypeScript' : info.language;
        out.push({
          name: path.basename(dir),
          path: path.relative(root, dir).replace(/\\/g, '/') || '.',
          language,
          framework,
          type: depth === 0 ? 'main' : 'subproject',
          dependencies: this.readDeps(dir, indicator),
        });
        detected = true;
        break;
      }
    }

    // Check .csproj / .sln
    if (!detected && fileNames.some((f) => CSPROJ_RE.test(f) || SLN_RE.test(f))) {
      out.push({
        name: path.basename(dir),
        path: path.relative(root, dir).replace(/\\/g, '/') || '.',
        language: 'C#',
        framework: '.NET',
        type: depth === 0 ? 'main' : 'subproject',
        dependencies: [],
      });
      detected = true;
    }

    // Check Visual FoxPro
    if (!detected && fileNames.some((f) => PRG_RE.test(f) || PJX_RE.test(f))) {
      out.push({
        name: path.basename(dir),
        path: path.relative(root, dir).replace(/\\/g, '/') || '.',
        language: 'Visual FoxPro',
        type: depth === 0 ? 'main' : 'subproject',
        dependencies: [],
      });
    }

    // Recurse into subdirectories
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
        const section = content.split(/^dependencies:/m)[1];
        if (!section) return [];
        const lines = section.split('\n');
        const deps: string[] = [];
        for (const line of lines) {
          if (/^\S/.test(line) && !line.startsWith('#')) break;
          const match = line.match(/^\s{2}(\w[\w_-]*):/);
          if (match) deps.push(match[1]);
        }
        return deps;
      }
    } catch { /* ignore */ }
    return [];
  }
}
