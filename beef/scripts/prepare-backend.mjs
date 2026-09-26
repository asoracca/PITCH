import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { serverSettings } from '../local-settings.mjs';

const root = resolve(process.cwd(), '..');
const build = spawnSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const settings = serverSettings();
if (settings.BEEF_LOCAL_DATABASE === '1' && settings.TURSO_DATABASE_URL?.startsWith('file:')) {
  await mkdir(dirname(settings.TURSO_DATABASE_URL.slice(5)), { recursive: true });
}
const migrated = spawnSync(process.execPath, ['scripts/migrate-libsql.mjs'], { cwd: root, env: settings, stdio: 'inherit' });
if (migrated.status !== 0) process.exit(migrated.status ?? 1);
