import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../core';
import {
  detectArchitecture,
  detectFrameworks,
  detectLanguages,
  extractApiEndpoints,
  extractComponents,
  extractControllers,
  extractDatabaseScripts,
  extractRepositories,
  extractReusableComponents,
  extractServices,
  scanFiles,
} from './scanners';
import { RepositoryContext, RepositoryMeta } from './types';

/**
 * Scans a local repository and generates comprehensive JSON summary files
 * saved under a `context/` folder at the repository root.
 */
export class RepositoryIndexer {
  private readonly logger = Logger.child('RepositoryIndexer');

  /**
   * Index the repository at `rootPath` and write results to `<rootPath>/context/`.
   * Returns the full context object.
   */
  index(rootPath: string): RepositoryContext {
    const resolvedRoot = path.resolve(rootPath);
    this.logger.info(`Indexing repository at ${resolvedRoot}`);

    // 1. Scan all files
    const files = scanFiles(resolvedRoot);
    this.logger.info(`Scanned ${files.length} files`);

    // 2. Run all detectors / extractors
    const languages = detectLanguages(files);
    const frameworks = detectFrameworks(files, resolvedRoot);
    const architecturePattern = detectArchitecture(files);
    const services = extractServices(files);
    const controllers = extractControllers(files);
    const repositories = extractRepositories(files);
    const components = extractComponents(files);
    const apiEndpoints = extractApiEndpoints(files);
    const databaseScripts = extractDatabaseScripts(files);
    const reusableComponents = extractReusableComponents(files);

    // 3. Build meta
    const meta: RepositoryMeta = {
      name: path.basename(resolvedRoot),
      rootPath: resolvedRoot,
      indexedAt: new Date().toISOString(),
      totalFiles: files.length,
      totalLines: files.reduce((sum, f) => sum + f.lines, 0),
      totalSizeBytes: files.reduce((sum, f) => sum + f.size, 0),
    };

    const context: RepositoryContext = {
      meta,
      languages,
      frameworks,
      architecturePattern,
      services,
      controllers,
      repositories,
      components,
      apiEndpoints,
      databaseScripts,
      reusableComponents,
    };

    // 4. Write to /context
    this.writeContext(resolvedRoot, context);

    this.logger.info('Repository indexing complete');
    return context;
  }

  private writeContext(rootPath: string, ctx: RepositoryContext): void {
    const contextDir = path.join(rootPath, 'context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }

    const filesToWrite: Record<string, unknown> = {
      'repository-summary.json': {
        meta: ctx.meta,
        languages: ctx.languages,
        frameworks: ctx.frameworks,
        architecturePattern: ctx.architecturePattern,
      },
      'languages.json': ctx.languages,
      'frameworks.json': ctx.frameworks,
      'architecture.json': ctx.architecturePattern,
      'services.json': ctx.services,
      'controllers.json': ctx.controllers,
      'repositories.json': ctx.repositories,
      'components.json': ctx.components,
      'api-endpoints.json': ctx.apiEndpoints,
      'database-scripts.json': ctx.databaseScripts,
      'reusable-components.json': ctx.reusableComponents,
    };

    for (const [fileName, data] of Object.entries(filesToWrite)) {
      const filePath = path.join(contextDir, fileName);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.info(`  → ${fileName}`);
    }

    this.logger.info(`Context files written to ${contextDir}`);
  }
}
