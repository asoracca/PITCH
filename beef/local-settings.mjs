import { resolve } from 'node:path';

// Local development uses its own database unless a developer explicitly supplies one.
export function serverSettings() {
  const settings = { ...process.env };
  if (!settings.TURSO_DATABASE_URL && settings.NODE_ENV !== 'production' && !settings.VERCEL) {
    settings.TURSO_DATABASE_URL = `file:${resolve(process.cwd(), '..', '.local', 'pitch.db')}`;
    settings.BEEF_LOCAL_DATABASE = '1';
  }
  return settings;
}
