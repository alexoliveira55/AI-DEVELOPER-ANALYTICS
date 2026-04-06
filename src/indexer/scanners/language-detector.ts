import { LanguageSummary, ScannedFile } from '../types';

/** Aggregates files into language statistics. */
export function detectLanguages(files: ScannedFile[]): LanguageSummary[] {
  const map = new Map<string, { files: number; lines: number }>();

  for (const f of files) {
    const entry = map.get(f.language) ?? { files: 0, lines: 0 };
    entry.files++;
    entry.lines += f.lines;
    map.set(f.language, entry);
  }

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0) || 1;

  return Array.from(map.entries())
    .map(([language, { files: count, lines }]) => ({
      language,
      files: count,
      lines,
      percentage: Math.round((lines / totalLines) * 10000) / 100,
    }))
    .sort((a, b) => b.lines - a.lines);
}
