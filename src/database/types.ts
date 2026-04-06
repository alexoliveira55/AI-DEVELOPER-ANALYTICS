// ── Database Reader Types ────────────────────────────────────────────────────

export type DatabaseProvider = 'postgres' | 'mysql' | 'mssql';

/** Complete database summary written to context/database-summary.json. */
export interface DatabaseSummary {
  meta: DatabaseMeta;
  tables: TableDetail[];
  views: ViewDetail[];
  storedProcedures: StoredProcedureDetail[];
}

export interface DatabaseMeta {
  provider: DatabaseProvider;
  database: string;
  schema: string;
  extractedAt: string;
  tableCount: number;
  viewCount: number;
  storedProcedureCount: number;
}

export interface TableDetail {
  name: string;
  schema: string;
  columns: ColumnDetail[];
  primaryKey: PrimaryKeyDetail | null;
  foreignKeys: ForeignKeyDetail[];
  indexes: IndexDetail[];
  rowCountEstimate?: number;
}

export interface ColumnDetail {
  name: string;
  dataType: string;
  maxLength: number | null;
  precision: number | null;
  scale: number | null;
  nullable: boolean;
  defaultValue: string | null;
  isIdentity: boolean;
  ordinalPosition: number;
}

export interface PrimaryKeyDetail {
  name: string;
  columns: string[];
}

export interface ForeignKeyDetail {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedSchema: string;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export interface IndexDetail {
  name: string;
  columns: string[];
  isUnique: boolean;
  type: string;
}

export interface ViewDetail {
  name: string;
  schema: string;
  definition: string | null;
  columns: ColumnDetail[];
}

export interface StoredProcedureDetail {
  name: string;
  schema: string;
  type: 'procedure' | 'function';
  parameters: ParameterDetail[];
  definition: string | null;
}

export interface ParameterDetail {
  name: string;
  dataType: string;
  direction: 'IN' | 'OUT' | 'INOUT';
  ordinalPosition: number;
}

/** Common interface all provider-specific engines must implement. */
export interface IDatabaseEngine {
  connect(): Promise<void>;
  getTables(schema: string): Promise<TableDetail[]>;
  getViews(schema: string): Promise<ViewDetail[]>;
  getStoredProcedures(schema: string): Promise<StoredProcedureDetail[]>;
  getDatabaseName(): Promise<string>;
  disconnect(): Promise<void>;
}
