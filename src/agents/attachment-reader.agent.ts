import * as fs from 'fs';
import * as path from 'path';
import { BaseAgent } from '../core';
import {
  AgentRole, AttachmentContext, AttachedFile, SessionContext,
} from '../types';

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript',
  '.dart': 'Dart',
  '.cs': 'C#',
  '.py': 'Python',
  '.sql': 'SQL',
  '.html': 'HTML', '.htm': 'HTML',
  '.css': 'CSS', '.scss': 'SCSS',
  '.prg': 'Visual FoxPro',
  '.json': 'JSON',
  '.yaml': 'YAML', '.yml': 'YAML',
  '.xml': 'XML',
  '.md': 'Markdown',
};

/** Reads files and directories attached as additional context (e.g. from Copilot Chat). */
export class AttachmentReaderAgent extends BaseAgent<string[], AttachmentContext> {
  readonly role = AgentRole.AttachmentReader;
  readonly name = 'Attachment Reader';

  protected async run(paths: string[], _ctx: SessionContext): Promise<AttachmentContext> {
    const files: AttachedFile[] = [];
    const directories: string[] = [];

    for (const p of paths) {
      const resolved = path.resolve(p);
      if (!fs.existsSync(resolved)) {
        this.logger.warn(`Attachment not found: ${resolved}`);
        continue;
      }

      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        directories.push(resolved);
        this.readDir(resolved, files, 0, 3);
      } else if (stat.isFile()) {
        const file = this.readSingleFile(resolved);
        if (file) files.push(file);
      }
    }

    this.logger.info(`Read ${files.length} file(s) from ${paths.length} attachment path(s)`);
    return { files, directories, resolvedPaths: paths.map((p) => path.resolve(p)) };
  }

  private readDir(dir: string, out: AttachedFile[], depth: number, max: number) {
    if (depth > max) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isFile()) {
          const f = this.readSingleFile(full);
          if (f) out.push(f);
        } else if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
          this.readDir(full, out, depth + 1, max);
        }
      }
    } catch { /* permission denied etc. */ }
  }

  private readSingleFile(filePath: string): AttachedFile | null {
    const ext = path.extname(filePath).toLowerCase();
    const language = LANGUAGE_MAP[ext];
    if (!language) return null;
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { path: filePath, content, language, lines: content.split('\n').length };
    } catch { return null; }
  }
}
