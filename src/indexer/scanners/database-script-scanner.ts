import { DatabaseScriptEntry, ScannedFile } from '../types';

const TABLE_RE = /(?:CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE\s+TABLE)\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?(?:`|"|'|\[)?(\w+)(?:`|"|'|\])?/gi;

const MIGRATION_PATH_RE =
  /migrat|seeds?|seeders?|fixtures/i;

const PROCEDURE_RE =
  /CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION|TRIGGER|VIEW)/i;

const SCHEMA_RE =
  /CREATE\s+TABLE|CREATE\s+(?:OR\s+REPLACE\s+)?SCHEMA|CREATE\s+DATABASE/i;

export function extractDatabaseScripts(files: ScannedFile[]): DatabaseScriptEntry[] {
  const results: DatabaseScriptEntry[] = [];

  for (const file of files) {
    if (!isDatabaseFile(file)) continue;

    const tables = extractTableNames(file.content);
    const type = classifyDbFile(file);

    results.push({ filePath: file.relativePath, type, tables });
  }

  return results;
}

function isDatabaseFile(f: ScannedFile): boolean {
  if (f.language === 'SQL') return true;
  if (f.extension === '.prisma') return true;
  // ORM migration files (TypeScript/JavaScript)
  if (MIGRATION_PATH_RE.test(f.relativePath) && ['TypeScript', 'JavaScript'].includes(f.language))
    return true;
  // VFP files with SQL or table operations
  if (f.language === 'Visual FoxPro' && /(?:CREATE TABLE|ALTER TABLE|SQLEXEC|CREATE CURSOR|OPEN DATABASE|USE\s+\w+)/i.test(f.content))
    return true;
  return false;
}

function classifyDbFile(
  f: ScannedFile,
): DatabaseScriptEntry['type'] {
  const p = f.relativePath.toLowerCase();
  if (/migrat/.test(p)) return 'migration';
  if (/seed|fixture/.test(p)) return 'seed';
  if (PROCEDURE_RE.test(f.content)) return 'procedure';
  if (SCHEMA_RE.test(f.content)) return 'schema';
  return 'query';
}

function extractTableNames(content: string): string[] {
  TABLE_RE.lastIndex = 0;
  const tables = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = TABLE_RE.exec(content)) !== null) {
    tables.add(m[1]);
  }
  return Array.from(tables);
}
