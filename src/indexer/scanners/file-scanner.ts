import * as fs from 'fs';
import * as path from 'path';
import { ScannedFile } from '../types';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out',
  '__pycache__', '.venv', 'venv', '.tox', 'env',
  'bin', 'obj', 'target', '.gradle',
  '.idea', '.vscode', '.vs', 'coverage', '.nyc_output',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib', '.class',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.lock', '.map',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python', '.pyw': 'Python',
  '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
  '.cs': 'C#', '.vb': 'VB.NET',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby', '.erb': 'Ruby',
  '.php': 'PHP',
  '.swift': 'Swift',
  '.dart': 'Dart',
  '.sql': 'SQL',
  '.html': 'HTML', '.htm': 'HTML',
  '.css': 'CSS', '.scss': 'SCSS', '.sass': 'Sass', '.less': 'Less',
  '.json': 'JSON', '.jsonc': 'JSON',
  '.yaml': 'YAML', '.yml': 'YAML',
  '.xml': 'XML',
  '.md': 'Markdown', '.mdx': 'Markdown',
  '.sh': 'Shell', '.bash': 'Shell', '.zsh': 'Shell',
  '.ps1': 'PowerShell', '.psm1': 'PowerShell',
  '.dockerfile': 'Docker', '.prisma': 'Prisma',
  '.graphql': 'GraphQL', '.gql': 'GraphQL',
  '.proto': 'Protobuf',
  '.tf': 'Terraform', '.hcl': 'HCL',
  '.vue': 'Vue', '.svelte': 'Svelte',
  // Visual FoxPro
  '.prg': 'Visual FoxPro', '.vcx': 'Visual FoxPro', '.vct': 'Visual FoxPro',
};

/** Recursively scans a directory and returns all text-based source files. */
export function scanFiles(rootPath: string): ScannedFile[] {
  const results: ScannedFile[] = [];
  walk(rootPath, rootPath, results);
  return results;
}

/** Detect XML files that are converted VFP forms/screens (.scx/.sct → .xml). */
function isVfpFormXml(content: string): boolean {
  const head = content.slice(0, 2000);
  return /VFPData|PLATFORM\s*=\s*"WINDOWS"|BASECLASS\s*=|<CommandButton|<TextBox|<EditBox|<Grid\b.*RecordSource|<PageFrame|ObjType\s*=\s*"\d+"/i.test(head);
}

function walk(root: string, dir: string, out: ScannedFile[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // permission denied, etc.
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        walk(root, fullPath, out);
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) continue;

    // Handle extensionless files like Dockerfile
    const baseName = entry.name.toLowerCase();
    let language = LANGUAGE_MAP[ext]
      ?? (baseName === 'dockerfile' ? 'Docker' : undefined)
      ?? (baseName === 'makefile' ? 'Makefile' : undefined)
      ?? undefined;

    if (!language) continue; // skip unrecognized files

    let content: string;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch {
      continue;
    }

    // Reclassify XML files that are converted VFP forms (.scx/.sct → .xml)
    if (language === 'XML' && isVfpFormXml(content)) {
      language = 'Visual FoxPro';
    }

    out.push({
      absolutePath: fullPath,
      relativePath: path.relative(root, fullPath).replace(/\\/g, '/'),
      extension: ext,
      language,
      lines: content.split('\n').length,
      size: Buffer.byteLength(content, 'utf-8'),
      content,
    });
  }
}
