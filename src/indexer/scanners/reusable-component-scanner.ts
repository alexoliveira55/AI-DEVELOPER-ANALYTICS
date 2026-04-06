import { ReusableComponentEntry, ScannedFile } from '../types';

const EXPORT_RE = /export\s+(?:default\s+)?(?:class|function|const|interface|type|enum)\s+(\w+)/g;

interface CategoryRule {
  category: ReusableComponentEntry['category'];
  test: (f: ScannedFile) => boolean;
}

const rules: CategoryRule[] = [
  { category: 'utility',    test: (f) => /utils?[/.]|utilit/i.test(f.relativePath) },
  { category: 'helper',     test: (f) => /helpers?[/.]|helper/i.test(f.relativePath) },
  { category: 'shared',     test: (f) => /shared[/.]/.test(f.relativePath) },
  { category: 'common',     test: (f) => /common[/.]/.test(f.relativePath) },
  { category: 'lib',        test: (f) => /\blib[/.]/.test(f.relativePath) },
  { category: 'hook',       test: (f) => /hooks?[/.]|\.hook\./i.test(f.relativePath) || /^use[A-Z]/.test(fileName(f)) },
  { category: 'middleware',  test: (f) => /middleware/i.test(f.relativePath) },
  { category: 'decorator',  test: (f) => /decorators?[/.]|\.decorator\./i.test(f.relativePath) },
  { category: 'pipe',       test: (f) => /pipes?[/.]|\.pipe\./i.test(f.relativePath) },
  { category: 'guard',      test: (f) => /guards?[/.]|\.guard\./i.test(f.relativePath) },
  { category: 'interceptor', test: (f) => /interceptors?[/.]|\.interceptor\./i.test(f.relativePath) },
];

export function extractReusableComponents(files: ScannedFile[]): ReusableComponentEntry[] {
  const results: ReusableComponentEntry[] = [];

  for (const file of files) {
    if (!isCodeFile(file)) continue;

    for (const rule of rules) {
      if (rule.test(file)) {
        const exports = allMatches(EXPORT_RE, file.content);
        if (exports.length > 0) {
          results.push({
            name: nameFromPath(file.relativePath),
            filePath: file.relativePath,
            category: rule.category,
            exports,
          });
        }
        break; // first matching category wins
      }
    }
  }

  return results;
}

function isCodeFile(f: ScannedFile): boolean {
  return ['TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'Go', 'Rust', 'Kotlin', 'Ruby', 'PHP', 'Dart', 'Swift'].includes(f.language);
}

function fileName(f: ScannedFile): string {
  return f.relativePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? '';
}

function nameFromPath(relativePath: string): string {
  return relativePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? relativePath;
}

function allMatches(re: RegExp, text: string): string[] {
  re.lastIndex = 0;
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) results.push(m[1]);
  return [...new Set(results)];
}
