import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';

export function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync('drizzle').filter(p => p.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, 'utf8'));
  class Statement {
    constructor(query, values = []) { this.query = query; this.values = values; }
    bind(...values) { return new Statement(this.query, values); }
    execute() {
      const results = sqlite.prepare(this.query).all(...this.values);
      const meta = sqlite.prepare('SELECT changes() AS changes, last_insert_rowid() AS last_row_id').get();
      return { results, meta, success: true };
    }
    async first(column) { const row = this.execute().results[0]; return column ? row?.[column] ?? null : row ?? null; }
    async all() { return this.execute(); }
    async run() { return this.execute(); }
  }
  return { sqlite, prepare: query => new Statement(query), async batch(statements) {
    sqlite.exec('BEGIN');
    try { const results = statements.map(s => s.execute()); sqlite.exec('COMMIT'); return results; }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
}
