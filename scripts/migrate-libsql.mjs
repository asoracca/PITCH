import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function migrate(client, directory = 'drizzle') {
  await client.execute('CREATE TABLE IF NOT EXISTS _beef_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at INTEGER NOT NULL)');
  const files = (await readdir(directory)).filter(name => /^\d+_.*\.sql$/.test(name)).sort();
  const applied = [];
  for (const name of files) {
    const sql = await readFile(resolve(directory, name), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    const tx = await client.transaction('write');
    try {
      const existing = await tx.execute({ sql: 'SELECT hash FROM _beef_migrations WHERE name=?', args: [name] });
      if (existing.rows.length) {
        if (existing.rows[0].hash !== hash) throw new Error(`Previously applied migration changed: ${name}`);
      } else {
        for (const statement of sql.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) await tx.execute(statement);
        await tx.execute({ sql: 'INSERT INTO _beef_migrations (name,hash,applied_at) VALUES (?,?,?)', args: [name, hash, Date.now()] });
        applied.push(name);
      }
      await tx.commit();
    } catch (error) { await tx.rollback(); throw error; }
    finally { tx.close(); }
  }
  return applied;
}

export function config(env = process.env) {
  const url = env.TURSO_DATABASE_URL;
  const remote = url && /^(libsql|https):\/\//.test(url);
  const local = url?.startsWith('file:') && env.BEEF_LOCAL_DATABASE === '1' && !env.VERCEL;
  if (!url || (!remote && !local) || (remote && !env.TURSO_AUTH_TOKEN)) {
    throw new Error('Connect a free Turso database and set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Vercel before building.');
  }
  return { url, authToken: env.TURSO_AUTH_TOKEN };
}

export async function migrateConfiguredDatabase() {
  const client = createClient(config());
  try { const applied = await migrate(client); console.log(`Database ready. Applied ${applied.length} migration(s).`); }
  finally { client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await migrateConfiguredDatabase(); } catch { console.error('Database setup failed. Check the Turso connection settings and migration files. No credentials were logged.'); process.exitCode = 1; }
}
