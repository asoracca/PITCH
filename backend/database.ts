export type SqlValue = string | number | null;
export interface DatabaseResult<T = Record<string, unknown>> {
  results: T[];
  meta: { changes: number; last_row_id?: number };
  success: boolean;
}
export interface DatabaseStatement {
  bind(...values: SqlValue[]): DatabaseStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
  run(): Promise<DatabaseResult>;
}
/** The API needs prepared queries and atomic batches on either D1 or libSQL. */
export interface Database {
  prepare(query: string): DatabaseStatement;
  batch(statements: DatabaseStatement[]): Promise<DatabaseResult[]>;
}
