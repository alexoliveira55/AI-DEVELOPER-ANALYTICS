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
 * PostgreSQL introspection engine.
 * Requires the `pg` package to be installed: npm install pg @types/pg
 */
export class PostgresEngine implements IDatabaseEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pool: any = null;
  private connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  async connect(): Promise<void> {
    let pg: any;
    try {
      // @ts-ignore - optional runtime dependency
      pg = await import('pg');
    } catch {
      throw new Error('PostgreSQL driver not installed. Run: npm install pg');
    }
    this.pool = new pg.Pool({ connectionString: this.connectionString });
    const client = await this.pool.connect();
    client.release();
  }

  async getDatabaseName(): Promise<string> {
    const result = await this.query('SELECT current_database() AS db');
    return result.rows[0].db;
  }

  async getTables(schema: string): Promise<TableDetail[]> {
    const tablesResult = await this.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [schema]);

    const tables: TableDetail[] = [];
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      const [columns, primaryKey, foreignKeys, indexes] = await Promise.all([
        this.getColumns(schema, tableName),
        this.getPrimaryKey(schema, tableName),
        this.getForeignKeys(schema, tableName),
        this.getIndexes(schema, tableName),
      ]);

      const countResult = await this.query(`
        SELECT reltuples::bigint AS estimate
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1 AND c.relname = $2
      `, [schema, tableName]);

      tables.push({
        name: tableName,
        schema,
        columns,
        primaryKey,
        foreignKeys,
        indexes,
        rowCountEstimate: Number(countResult.rows[0]?.estimate ?? 0),
      });
    }
    return tables;
  }

  async getViews(schema: string): Promise<ViewDetail[]> {
    const viewsResult = await this.query(`
      SELECT table_name, view_definition
      FROM information_schema.views
      WHERE table_schema = $1
      ORDER BY table_name
    `, [schema]);

    const views: ViewDetail[] = [];
    for (const row of viewsResult.rows) {
      const columns = await this.getColumns(schema, row.table_name);
      views.push({
        name: row.table_name,
        schema,
        definition: row.view_definition ?? null,
        columns,
      });
    }
    return views;
  }

  async getStoredProcedures(schema: string): Promise<StoredProcedureDetail[]> {
    const procsResult = await this.query(`
      SELECT r.routine_name, r.routine_type, r.routine_definition
      FROM information_schema.routines r
      WHERE r.specific_schema = $1
        AND r.routine_type IN ('PROCEDURE', 'FUNCTION')
      ORDER BY r.routine_name
    `, [schema]);

    const procs: StoredProcedureDetail[] = [];
    for (const row of procsResult.rows) {
      const paramsResult = await this.query(`
        SELECT parameter_name, data_type, parameter_mode, ordinal_position
        FROM information_schema.parameters
        WHERE specific_schema = $1 AND specific_name = $2
        ORDER BY ordinal_position
      `, [schema, row.routine_name]);

      procs.push({
        name: row.routine_name,
        schema,
        type: row.routine_type === 'PROCEDURE' ? 'procedure' : 'function',
        parameters: paramsResult.rows.map((p: any) => ({
          name: p.parameter_name ?? '',
          dataType: p.data_type,
          direction: (p.parameter_mode ?? 'IN') as 'IN' | 'OUT' | 'INOUT',
          ordinalPosition: p.ordinal_position,
        })),
        definition: row.routine_definition ?? null,
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
    const result = await this.query(`
      SELECT
        c.column_name, c.data_type, c.character_maximum_length,
        c.numeric_precision, c.numeric_scale, c.is_nullable,
        c.column_default, c.ordinal_position,
        CASE WHEN c.column_default LIKE 'nextval%' THEN true ELSE false END AS is_identity
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `, [schema, table]);

    return result.rows.map((r: any) => ({
      name: r.column_name,
      dataType: r.data_type,
      maxLength: r.character_maximum_length ?? null,
      precision: r.numeric_precision ?? null,
      scale: r.numeric_scale ?? null,
      nullable: r.is_nullable === 'YES',
      defaultValue: r.column_default ?? null,
      isIdentity: Boolean(r.is_identity),
      ordinalPosition: r.ordinal_position,
    }));
  }

  private async getPrimaryKey(schema: string, table: string): Promise<PrimaryKeyDetail | null> {
    const result = await this.query(`
      SELECT tc.constraint_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `, [schema, table]);

    if (result.rows.length === 0) return null;
    return {
      name: result.rows[0].constraint_name,
      columns: result.rows.map((r: Record<string, unknown>) => r.column_name as string),
    };
  }

  private async getForeignKeys(schema: string, table: string): Promise<ForeignKeyDetail[]> {
    const result = await this.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_schema AS ref_schema,
        ccu.table_name AS ref_table,
        ccu.column_name AS ref_column,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
      WHERE tc.table_schema = $1 AND tc.table_name = $2 AND tc.constraint_type = 'FOREIGN KEY'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `, [schema, table]);

    const grouped = new Map<string, ForeignKeyDetail>();
    for (const r of result.rows) {
      const existing = grouped.get(r.constraint_name);
      if (existing) {
        existing.columns.push(r.column_name);
        existing.referencedColumns.push(r.ref_column);
      } else {
        grouped.set(r.constraint_name, {
          name: r.constraint_name,
          columns: [r.column_name],
          referencedTable: r.ref_table,
          referencedSchema: r.ref_schema,
          referencedColumns: [r.ref_column],
          onDelete: r.delete_rule,
          onUpdate: r.update_rule,
        });
      }
    }
    return Array.from(grouped.values());
  }

  private async getIndexes(schema: string, table: string): Promise<IndexDetail[]> {
    const result = await this.query(`
      SELECT
        i.relname AS index_name,
        a.attname AS column_name,
        ix.indisunique AS is_unique,
        am.amname AS index_type
      FROM pg_index ix
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_am am ON am.oid = i.relam
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = $1 AND t.relname = $2
        AND NOT ix.indisprimary
      ORDER BY i.relname, a.attnum
    `, [schema, table]);

    const grouped = new Map<string, IndexDetail>();
    for (const r of result.rows) {
      const existing = grouped.get(r.index_name);
      if (existing) {
        existing.columns.push(r.column_name);
      } else {
        grouped.set(r.index_name, {
          name: r.index_name,
          columns: [r.column_name],
          isUnique: r.is_unique,
          type: r.index_type,
        });
      }
    }
    return Array.from(grouped.values());
  }

  private async query(sql: string, params?: unknown[]): Promise<{ rows: any[] }> {
    if (!this.pool) throw new Error('PostgresEngine not connected');
    return this.pool.query(sql, params);
  }
}
