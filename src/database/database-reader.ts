import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../core';
import { MssqlEngine, MysqlEngine, PostgresEngine } from './engines';
import { DatabaseProvider, DatabaseSummary, IDatabaseEngine } from './types';

export interface DatabaseReaderOptions {
  connectionString: string;
  /** Override the auto-detected provider. */
  provider?: DatabaseProvider;
  /** Schema to introspect (default: 'public' for PG, 'dbo' for MSSQL, database name for MySQL). */
  schema?: string;
  /** Root path of the project – context/ folder will be written here. */
  projectPath?: string;
}

/**
 * Connects to a database, extracts full schema metadata,
 * and writes the result to `context/database-summary.json`.
 */
export class DatabaseReader {
  private readonly logger = Logger.child('DatabaseReader');

  async read(options: DatabaseReaderOptions): Promise<DatabaseSummary> {
    const { connectionString, projectPath } = options;
    const provider = options.provider ?? this.detectProvider(connectionString);
    const engine = this.createEngine(provider, connectionString);

    this.logger.info(`Connecting to ${provider} database…`);
    await engine.connect();

    try {
      const databaseName = await engine.getDatabaseName();
      const schema = options.schema ?? this.defaultSchema(provider, databaseName);

      this.logger.info(`Introspecting schema "${schema}" in database "${databaseName}"`);

      const [tables, views, storedProcedures] = await Promise.all([
        engine.getTables(schema),
        engine.getViews(schema),
        engine.getStoredProcedures(schema),
      ]);

      const summary: DatabaseSummary = {
        meta: {
          provider,
          database: databaseName,
          schema,
          extractedAt: new Date().toISOString(),
          tableCount: tables.length,
          viewCount: views.length,
          storedProcedureCount: storedProcedures.length,
        },
        tables,
        views,
        storedProcedures,
      };

      this.logger.info(
        `Found ${tables.length} tables, ${views.length} views, ${storedProcedures.length} stored procedures`,
      );

      if (projectPath) {
        this.writeContext(projectPath, summary);
      }

      return summary;
    } finally {
      await engine.disconnect();
      this.logger.info('Database connection closed');
    }
  }

  /** Detect provider from the connection string format. */
  private detectProvider(connectionString: string): DatabaseProvider {
    const cs = connectionString.toLowerCase();

    if (cs.startsWith('postgres://') || cs.startsWith('postgresql://')) {
      return 'postgres';
    }
    if (cs.startsWith('mysql://') || cs.startsWith('mariadb://')) {
      return 'mysql';
    }
    if (
      cs.startsWith('mssql://') ||
      cs.startsWith('sqlserver://') ||
      cs.includes('server=') ||
      cs.includes('data source=')
    ) {
      return 'mssql';
    }

    throw new Error(
      `Cannot auto-detect database provider from connection string. ` +
        `Use the --provider flag (postgres | mysql | mssql).`,
    );
  }

  private createEngine(provider: DatabaseProvider, connectionString: string): IDatabaseEngine {
    switch (provider) {
      case 'postgres':
        return new PostgresEngine(connectionString);
      case 'mysql':
        return new MysqlEngine(connectionString);
      case 'mssql':
        return new MssqlEngine(connectionString);
      default:
        throw new Error(`Unsupported database provider: ${provider}`);
    }
  }

  private defaultSchema(provider: DatabaseProvider, databaseName: string): string {
    switch (provider) {
      case 'postgres':
        return 'public';
      case 'mssql':
        return 'dbo';
      case 'mysql':
        return databaseName; // MySQL uses the database name as schema
    }
  }

  private writeContext(projectPath: string, summary: DatabaseSummary): void {
    const contextDir = path.join(path.resolve(projectPath), 'context');
    if (!fs.existsSync(contextDir)) {
      fs.mkdirSync(contextDir, { recursive: true });
    }
    const filePath = path.join(contextDir, 'database-summary.json');
    fs.writeFileSync(filePath, JSON.stringify(summary, null, 2), 'utf-8');
    this.logger.info(`Database summary written to ${filePath}`);
  }
}
