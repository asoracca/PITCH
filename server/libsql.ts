import { createClient, type Client, type ResultSet } from '@libsql/client';
import type { Database, DatabaseResult, DatabaseStatement, SqlValue } from '../backend/database';

function result<T>(value: ResultSet): DatabaseResult<T> {
  return { results: value.rows.map(row => Object.fromEntries(value.columns.map(name => [name, row[name]]))) as T[],
    meta: { changes: value.rowsAffected }, success: true };
}

class Statement implements DatabaseStatement {
  constructor(readonly client: Client, readonly query: string, readonly values: SqlValue[] = []) {}
  bind(...values: SqlValue[]) { return new Statement(this.client, this.query, values); }
  async all<T = Record<string, unknown>>() { return result<T>(await this.client.execute({ sql: this.query, args: this.values })); }
  async first<T = Record<string, unknown>>() { return (await this.all<T>()).results[0] ?? null; }
  async run() { return this.all(); }
}

export function libsqlDatabase(client: Client): Database {
  return {
    prepare: query => new Statement(client, query),
    async batch(statements) {
      const queries = statements.map(statement => {
        if (!(statement instanceof Statement) || statement.client !== client) throw new Error('Mismatched database statement');
        return { sql: statement.query, args: statement.values };
      });
      // The provider commits all statements or rolls back the entire batch, just as D1 does.
      return (await client.batch(queries, 'write')).map(value => result<Record<string, unknown>>(value));
    },
  };
}

export function connectDatabase(url: string, authToken?: string) {
  const client = createClient({ url, authToken });
  return { client, DB: libsqlDatabase(client) };
}
