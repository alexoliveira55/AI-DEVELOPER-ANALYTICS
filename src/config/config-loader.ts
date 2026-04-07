import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as YAML from 'yaml';
import { AppConfig } from '../types';

/** Loads application configuration from env vars and optional YAML config file. */
export function loadConfig(overridePath?: string): AppConfig {
  dotenv.config();

  const defaults: AppConfig = {
    ai: {
      provider: process.env.AI_PROVIDER ?? 'openai',
      apiKey: process.env.AI_API_KEY ?? '',
      model: process.env.AI_MODEL ?? 'gpt-4',
    },
    logging: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    output: {
      dir: process.env.OUTPUT_DIR ?? './output',
    },
    database: process.env.DB_CONNECTION_STRING
      ? {
          connectionString: process.env.DB_CONNECTION_STRING,
          provider: (process.env.DB_PROVIDER as 'postgres' | 'mysql' | 'mssql' | undefined) || undefined,
          schema: process.env.DB_SCHEMA || undefined,
        }
      : undefined,
    executionMode: process.env.EXECUTION_MODE || undefined,
    language: process.env.LANGUAGE || 'pt-BR',
  };

  const configPath = overridePath ?? findConfigFile();
  if (configPath && fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const ext = path.extname(configPath).toLowerCase();
    const parsed = ext === '.json' ? JSON.parse(raw) : YAML.parse(raw);
    return deepMerge(defaults as unknown as Record<string, unknown>, parsed) as unknown as AppConfig;
  }

  return defaults;
}

function findConfigFile(): string | undefined {
  const candidates = ['ai-architect.yaml', 'ai-architect.yml', 'ai-architect.json', 'ai-config.json'];
  return candidates.find((f) => fs.existsSync(f));
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
