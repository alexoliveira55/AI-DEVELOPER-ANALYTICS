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
 * SQL Server introspection engine.
 * Requires the `mssql` package to be installed: npm install mssql
 */
export class MssqlEngine implements IDatabaseEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mssql: any = null;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    try {
      // @ts-ignore - optional runtime dependency
      this.mssql = await import('mssql');
    } catch {
      throw new Error('SQL Server driver not installed. Run: npm install mssql');
    }
    this.pool = await this.mssql.default.connect(this.connectionString);
  }

  async getDatabaseName(): Promise<string> {
    const result = await this.query('SELECT DB_NAME() AS db');
    return result[0].db;
  }

  async getTables(schema: string): Promise<TableDetail[]> {
    const tableRows = await this.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = @schema AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `, { schema });

    const tables: TableDetail[] = [];
    for (const row of tableRows) {
      const tableName = row.TABLE_NAME;
      const [columns, primaryKey, foreignKeys, indexes] = await Promise.all([
        this.getColumns(schema, tableName),
        this.getPrimaryKey(schema, tableName),
        this.getForeignKeys(schema, tableName),
        this.getIndexes(schema, tableName),
      ]);

      const countRows = await this.query(`
        SELECT SUM(p.rows) AS estimate
        FROM sys.partitions p
        JOIN sys.tables t ON p.object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = @schema AND t.name = @table AND p.index_id IN (0, 1)
      `, { schema, table: tableName });

      tables.push({
        name: tableName,
        schema,
        columns,
        primaryKey,
        foreignKeys,
        indexes,
        rowCountEstimate: Number(countRows[0]?.estimate ?? 0),
      });
    }
    return tables;
  }

  async getViews(schema: string): Promise<ViewDetail[]> {
    const viewRows = await this.query(`
      SELECT v.TABLE_NAME, m.definition AS VIEW_DEFINITION
      FROM INFORMATION_SCHEMA.VIEWS v
      LEFT JOIN sys.sql_modules m
        ON m.object_id = OBJECT_ID(QUOTENAME(v.TABLE_SCHEMA) + '.' + QUOTENAME(v.TABLE_NAME))
      WHERE v.TABLE_SCHEMA = @schema
      ORDER BY v.TABLE_NAME
    `, { schema });

    const views: ViewDetail[] = [];
    for (const row of viewRows) {
      const columns = await this.getColumns(schema, row.TABLE_NAME);
      views.push({
        name: row.TABLE_NAME,
        schema,
        definition: row.VIEW_DEFINITION ?? null,
        columns,
      });
    }
    return views;
  }

  async getStoredProcedures(schema: string): Promise<StoredProcedureDetail[]> {
    const procRows = await this.query(`
      SELECT
        r.ROUTINE_NAME, r.ROUTINE_TYPE, m.definition AS ROUTINE_DEFINITION
      FROM INFORMATION_SCHEMA.ROUTINES r
      LEFT JOIN sys.sql_modules m
        ON m.object_id = OBJECT_ID(QUOTENAME(r.ROUTINE_SCHEMA) + '.' + QUOTENAME(r.ROUTINE_NAME))
      WHERE r.ROUTINE_SCHEMA = @schema AND r.ROUTINE_TYPE IN ('PROCEDURE', 'FUNCTION')
      ORDER BY r.ROUTINE_NAME
    `, { schema });

    const procs: StoredProcedureDetail[] = [];
    for (const row of procRows) {
      const paramRows = await this.query(`
        SELECT PARAMETER_NAME, DATA_TYPE, PARAMETER_MODE, ORDINAL_POSITION
        FROM INFORMATION_SCHEMA.PARAMETERS
        WHERE SPECIFIC_SCHEMA = @schema AND SPECIFIC_NAME = @name
        ORDER BY ORDINAL_POSITION
      `, { schema, name: row.ROUTINE_NAME });

      procs.push({
        name: row.ROUTINE_NAME,
        schema,
        type: row.ROUTINE_TYPE === 'PROCEDURE' ? 'procedure' : 'function',
        parameters: paramRows.map((p: Record<string, unknown>) => ({
          name: (p.PARAMETER_NAME as string) ?? '',
          dataType: p.DATA_TYPE as string,
          direction: ((p.PARAMETER_MODE as string) ?? 'IN') as 'IN' | 'OUT' | 'INOUT',
          ordinalPosition: p.ORDINAL_POSITION as number,
        })),
        definition: row.ROUTINE_DEFINITION ?? null,
      });
    }
    return procs;
  }

  async disconnect(): Promise<void> {
    await this.pool?.close();
    this.pool = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async getColumns(schema: string, table: string): Promise<ColumnDetail[]> {
    const rows = await this.query(`
      SELECT
        c.COLUMN_NAME, c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION, c.NUMERIC_SCALE, c.IS_NULLABLE,
        c.COLUMN_DEFAULT, c.ORDINAL_POSITION,
        COLUMNPROPERTY(OBJECT_ID(QUOTENAME(@schema) + '.' + QUOTENAME(@table)), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
      FROM INFORMATION_SCHEMA.COLUMNS c
      WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
      ORDER BY c.ORDINAL_POSITION
    `, { schema, table });

    return rows.map((r: Record<string, unknown>) => ({
      name: r.COLUMN_NAME as string,
      dataType: r.DATA_TYPE as string,
      maxLength: r.CHARACTER_MAXIMUM_LENGTH as number | null,
      precision: r.NUMERIC_PRECISION as number | null,
      scale: r.NUMERIC_SCALE as number | null,
      nullable: r.IS_NULLABLE === 'YES',
      defaultValue: r.COLUMN_DEFAULT as string | null,
      isIdentity: r.IS_IDENTITY === 1,
      ordinalPosition: r.ORDINAL_POSITION as number,
    }));
  }

  private async getPrimaryKey(schema: string, table: string): Promise<PrimaryKeyDetail | null> {
    const rows = await this.query(`
      SELECT tc.CONSTRAINT_NAME, kcu.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      WHERE tc.TABLE_SCHEMA = @schema AND tc.TABLE_NAME = @table AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ORDER BY kcu.ORDINAL_POSITION
    `, { schema, table });

    if (rows.length === 0) return null;
    return {
      name: rows[0].CONSTRAINT_NAME as string,
      columns: rows.map((r: Record<string, unknown>) => r.COLUMN_NAME as string),
    };
  }

  private async getForeignKeys(schema: string, table: string): Promise<ForeignKeyDetail[]> {
    const rows = await this.query(`
      SELECT
        fk.name AS CONSTRAINT_NAME,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS COLUMN_NAME,
        SCHEMA_NAME(rt.schema_id) AS REF_SCHEMA,
        rt.name AS REF_TABLE,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS REF_COLUMN,
        fk.delete_referential_action_desc AS DELETE_RULE,
        fk.update_referential_action_desc AS UPDATE_RULE
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      JOIN sys.tables t ON fk.parent_object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      JOIN sys.tables rt ON fk.referenced_object_id = rt.object_id
      WHERE s.name = @schema AND t.name = @table
      ORDER BY fk.name, fkc.constraint_column_id
    `, { schema, table });

    const grouped = new Map<string, ForeignKeyDetail>();
    for (const r of rows) {
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
    const rows = await this.query(`
      SELECT
        i.name AS INDEX_NAME,
        COL_NAME(ic.object_id, ic.column_id) AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE,
        i.type_desc AS INDEX_TYPE
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.tables t ON i.object_id = t.object_id
      JOIN sys.schemas s ON t.schema_id = s.schema_id
      WHERE s.name = @schema AND t.name = @table
        AND i.is_primary_key = 0 AND i.name IS NOT NULL
      ORDER BY i.name, ic.key_ordinal
    `, { schema, table });

    const grouped = new Map<string, IndexDetail>();
    for (const r of rows) {
      const name = r.INDEX_NAME as string;
      const existing = grouped.get(name);
      if (existing) {
        existing.columns.push(r.COLUMN_NAME as string);
      } else {
        grouped.set(name, {
          name,
          columns: [r.COLUMN_NAME as string],
          isUnique: Boolean(r.IS_UNIQUE),
          type: r.INDEX_TYPE as string,
        });
      }
    }
    return Array.from(grouped.values());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async query(sql: string, params?: Record<string, string>): Promise<any[]> {
    if (!this.pool || !this.mssql) throw new Error('MssqlEngine not connected');
    const request = this.pool.request();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, this.mssql.default.NVarChar, value);
      }
    }
    const result = await request.query(sql);
    return result.recordset ?? [];
  }
}
