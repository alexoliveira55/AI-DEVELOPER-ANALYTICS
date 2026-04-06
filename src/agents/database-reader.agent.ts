import { BaseAgent } from '../core';
import { DatabaseReader, DatabaseSummary } from '../database';
import { AgentRole, SessionContext } from '../types';

/** Reads database schema information from a configured data source. */
export class DatabaseReaderAgent extends BaseAgent<void, DatabaseSummary> {
  readonly role = AgentRole.DatabaseReader;
  readonly name = 'Database Reader';

  protected async run(_input: void, context: SessionContext): Promise<DatabaseSummary> {
    const dbConfig = context.config.database;

    if (!dbConfig?.connectionString) {
      this.logger.warn('No database connection configured – returning empty summary');
      return {
        meta: {
          provider: 'postgres',
          database: '',
          schema: '',
          extractedAt: new Date().toISOString(),
          tableCount: 0,
          viewCount: 0,
          storedProcedureCount: 0,
        },
        tables: [],
        views: [],
        storedProcedures: [],
      };
    }

    const reader = new DatabaseReader();
    return reader.read({
      connectionString: dbConfig.connectionString,
      provider: dbConfig.provider,
      schema: dbConfig.schema,
      projectPath: context.projectPath,
    });
  }
}
