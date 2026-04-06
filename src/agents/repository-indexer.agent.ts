import { BaseAgent } from '../core';
import { RepositoryIndexer, RepositoryContext } from '../indexer';
import { AgentRole, SessionContext } from '../types';

/** Scans a project directory and generates a full repository context index. */
export class RepositoryIndexerAgent extends BaseAgent<string, RepositoryContext> {
  readonly role = AgentRole.RepositoryIndexer;
  readonly name = 'Repository Indexer';

  protected async run(projectPath: string, _context: SessionContext): Promise<RepositoryContext> {
    const indexer = new RepositoryIndexer();
    return indexer.index(projectPath);
  }
}
