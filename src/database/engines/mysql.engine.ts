import {
  ColumnDetail,
  ForeignKeyDetail,
  IDatabaseEngine,
  IndexDetail,
  PrimaryKeyDetail,
  StoredProcedureDetail,
  TableDetail,
  ViewDetail,
} from '../types';

/**
 * MySQL / MariaDB introspection engine.
 * Requires the `mysql2` package to be installed: npm install mysql2
 */
export class MysqlEngine implements IDatabaseEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any = null;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    let mysql: any;
    try {
      // @ts-ignore - optional runtime dependency
      mysql = await import('mysql2/promise');
    } catch {
      throw new Error('MySQL driver not installed. Run: npm install mysql2');
    }
    this.pool = mysql.createPool(this.connectionString);
    const conn = await this.pool.getConnection();
    conn.release();
  }

  async getDatabaseName(): Promise<string> {
    const [rows] = await this.query('SELECT DATABASE() AS db');
    return (rows as any[])[0].db;
  }

  async getTables(schema: string): Promise<TableDetail[]> {
    const [tableRows] = await this.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, [schema]);

    const tables: TableDetail[] = [];
    for (const row of tableRows as Record<string, unknown>[]) {
      const tableName = row.TABLE_NAME as string;
      const [columns, primaryKey, foreignKeys, indexes] = await Promise.all([
        this.getColumns(schema, tableName),
        this.getPrimaryKey(schema, tableName),
        this.getForeignKeys(schema, tableName),
        this.getIndexes(schema, tableName),
      ]);

      const [countRows] = await this.query(`
        SELECT TABLE_ROWS AS estimate
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `, [schema, tableName]);
      const estimate = ((countRows as Record<string, unknown>[])[0]?.estimate as number) ?? 0;

      tables.push({ name: tableName, schema, columns, primaryKey, foreignKeys, indexes, rowCountEstimate: estimate });
    }
    return tables;
  }

  async getViews(schema: string): Promise<ViewDetail[]> {
    const [viewRows] = await this.query(`
      SELECT TABLE_NAME, VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [schema]);

    const views: ViewDetail[] = [];
    for (const row of viewRows as Record<string, unknown>[]) {
      const columns = await this.getColumns(schema, row.TABLE_NAME as string);
      views.push({
        name: row.TABLE_NAME as string,
        schema,
        definition: (row.VIEW_DEFINITION as string) ?? null,
        columns,
      });
    }
    return views;
  }

  async getStoredProcedures(schema: string): Promise<StoredProcedureDetail[]> {
    const [procRows] = await this.query(`
      SELECT ROUTINE_NAME, ROUTINE_TYPE, ROUTINE_DEFINITION
      FROM INFORMATION_SCHEMA.ROUTINES
      WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE IN ('PROCEDURE', 'FUNCTION')
      ORDER BY ROUTINE_NAME
    `, [schema]);

    const procs: StoredProcedureDetail[] = [];
    for (const row of procRows as Record<string, unknown>[]) {
      const [paramRows] = await this.query(`
        SELECT PARAMETER_NAME, DATA_TYPE, PARAMETER_MODE, ORDINAL_POSITION
        FROM INFORMATION_SCHEMA.PARAMETERS
        WHERE SPECIFIC_SCHEMA = ? AND SPECIFIC_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [schema, row.ROUTINE_NAME]);

      procs.push({
        name: row.ROUTINE_NAME as string,
        schema,
        type: row.ROUTINE_TYPE === 'PROCEDURE' ? 'procedure' : 'function',
        parameters: (paramRows as Record<string, unknown>[]).map((p) => ({
          name: (p.PARAMETER_NAME as string) ?? '',
          dataType: p.DATA_TYPE as string,
          direction: ((p.PARAMETER_MODE as string) ?? 'IN') as 'IN' | 'OUT' | 'INOUT',
          ordinalPosition: p.ORDINAL_POSITION as number,
        })),
        definition: (row.ROUTINE_DEFINITION as string) ?? null,
      });
    }
    return procs;
  }

  async disconnect(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getColumns(schema: string, table: string): Promise<ColumnDetail[]> {
    const [rows] = await this.query(`
      SELECT
        COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE,
        COLUMN_DEFAULT, ORDINAL_POSITION, EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [schema, table]);

    return (rows as Record<string, unknown>[]).map((r) => ({
      name: r.COLUMN_NAME as string,
      dataType: r.DATA_TYPE as string,
      maxLength: r.CHARACTER_MAXIMUM_LENGTH as number | null,
      precision: r.NUMERIC_PRECISION as number | null,
      scale: r.NUMERIC_SCALE as number | null,
      nullable: r.IS_NULLABLE === 'YES',
      defaultValue: r.COLUMN_DEFAULT as string | null,
      isIdentity: ((r.EXTRA as string) ?? '').includes('auto_increment'),
      ordinalPosition: r.ORDINAL_POSITION as number,
    }));
  }

  private async getPrimaryKey(schema: string, table: string): Promise<PrimaryKeyDetail | null> {
    const [rows] = await this.query(`
      SELECT CONSTRAINT_NAME, COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION
    `, [schema, table]);

    const r = rows as Record<string, unknown>[];
    if (r.length === 0) return null;
    return { name: 'PRIMARY', columns: r.map((c) => c.COLUMN_NAME as string) };
  }

  private async getForeignKeys(schema: string, table: string): Promise<ForeignKeyDetail[]> {
    const [rows] = await this.query(`
      SELECT
        kcu.CONSTRAINT_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_SCHEMA AS REF_SCHEMA,
        kcu.REFERENCED_TABLE_NAME AS REF_TABLE,
        kcu.REFERENCED_COLUMN_NAME AS REF_COLUMN,
        rc.DELETE_RULE,
        rc.UPDATE_RULE
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
      WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
    `, [schema, table]);

    const grouped = new Map<string, ForeignKeyDetail>();
    for (const r of rows as Record<string, unknown>[]) {
      const name = r.CONSTRAINT_NAME as string;
      const existing = grouped.get(name);
      if (existing) {
        existing.columns.push(r.COLUMN_NAME as string);
        existing.referencedColumns.push(r.REF_COLUMN as string);
      } else {
        grouped.set(name, {
          name,
          columns: [r.COLUMN_NAME as string],
          referencedTable: r.REF_TABLE as string,
          referencedSchema: r.REF_SCHEMA as string,
          referencedColumns: [r.REF_COLUMN as string],
          onDelete: r.DELETE_RULE as string,
          onUpdate: r.UPDATE_RULE as string,
        });
      }
    }
    return Array.from(grouped.values());
  }

  private async getIndexes(schema: string, table: string): Promise<IndexDetail[]> {
    const [rows] = await this.query(`
      SELECT
        s.INDEX_NAME,
        s.COLUMN_NAME,
        s.NON_UNIQUE,
        s.INDEX_TYPE
      FROM INFORMATION_SCHEMA.STATISTICS s
      WHERE s.TABLE_SCHEMA = ? AND s.TABLE_NAME = ? AND s.INDEX_NAME != 'PRIMARY'
      ORDER BY s.INDEX_NAME, s.SEQ_IN_INDEX
    `, [schema, table]);

    const grouped = new Map<string, IndexDetail>();
    for (const r of rows as Record<string, unknown>[]) {
      const name = r.INDEX_NAME as string;
      const existing = grouped.get(name);
      if (existing) {
        existing.columns.push(r.COLUMN_NAME as string);
      } else {
        grouped.set(name, {
          name,
          columns: [r.COLUMN_NAME as string],
          isUnique: (r.NON_UNIQUE as number) === 0,
          type: r.INDEX_TYPE as string,
        });
      }
    }
    return Array.from(grouped.values());
  }

  private async query(sql: string, params?: unknown[]): Promise<[any[], any[]]> {
    if (!this.pool) throw new Error('MysqlEngine not connected');
    return this.pool.query(sql, params);
  }
}
