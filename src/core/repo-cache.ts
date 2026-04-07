import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { RepoIndex } from '../types';
import { RepositoryContext } from '../indexer';
import { DatabaseSummary } from '../database';

/**
 * Cached context for a repository. Stores the results of Steps 1–4
 * so subsequent MCP tool calls skip expensive re-indexing.
 */
export interface CachedContext {
  repositoryContext: RepositoryContext;
  repoIndex: RepoIndex;
  gitAnalysis?: unknown;
  projectDiscovery?: unknown;
  databaseSummary?: DatabaseSummary;
  timestamp: number;
  projectPath: string;
  fileHash: string;
}

/**
 * In-memory cache for repository context data. Avoids re-indexing the
 * same repository on every MCP tool call. Entries expire after a
 * configurable TTL (default 5 minutes) or when the project's file
 * structure changes (detected via mtime hashing).
 */
export class RepositoryContextCache {
  private cache = new Map<string, CachedContext>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  /** Retrieve cached context for the given project path, or null if stale/missing. */
  get(projectPath: string): CachedContext | null {
    const key = this.normalizeKey(projectPath);
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Expired by TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Check for file changes
    const currentHash = this.computeFileHash(projectPath);
    if (currentHash !== entry.fileHash) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /** Store context for the given project path. */
  set(projectPath: string, data: Omit<CachedContext, 'timestamp' | 'fileHash'>): void {
    const key = this.normalizeKey(projectPath);
    this.cache.set(key, {
      ...data,
      timestamp: Date.now(),
      fileHash: this.computeFileHash(projectPath),
    });
  }

  /** Explicitly invalidate the cache for a project. */
  invalidate(projectPath: string): void {
    this.cache.delete(this.normalizeKey(projectPath));
  }

  /** Number of cached projects. */
  get size(): number {
    return this.cache.size;
  }

  /** Clear all cached entries. */
  clear(): void {
    this.cache.clear();
  }

  /** Alias for clear() — invalidate all entries. */
  invalidateAll(): void {
    this.cache.clear();
  }

  private normalizeKey(projectPath: string): string {
    return path.resolve(projectPath).toLowerCase();
  }

  /**
   * Compute a fast hash based on the mtimes of key project files.
   * This catches common changes (new/deleted/modified files) without
   * scanning the full directory tree.
   */
  private computeFileHash(projectPath: string): string {
    const hash = crypto.createHash('md5');
    const markers = [
      'package.json', 'package-lock.json',
      'tsconfig.json', 'angular.json', 'pubspec.yaml',
      'pom.xml', 'build.gradle', '*.csproj', '*.sln',
      'requirements.txt', 'Cargo.toml', 'go.mod',
    ];

    for (const marker of markers) {
      const full = path.join(projectPath, marker);
      try {
        const stat = fs.statSync(full);
        hash.update(`${marker}:${stat.mtimeMs}`);
      } catch {
        // File doesn't exist — skip
      }
    }

    // Also hash the top-level directory listing for structural changes
    try {
      const entries = fs.readdirSync(projectPath, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
      hash.update(`dirs:${dirs.join(',')}`);
    } catch {
      // Cannot read — skip
    }

    return hash.digest('hex');
  }
}
