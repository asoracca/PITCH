import { build } from 'esbuild';
import { access } from 'node:fs/promises';
import { migrateConfiguredDatabase } from './migrate-libsql.mjs';

await Promise.all(['prototype/index.html', 'prototype/style.css', 'prototype/app.js'].map(path => access(path)));
await build({ entryPoints: ['api/index.ts'], outfile: 'build/vercel/index.js', bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node24' });
// Migrations run at build time, never at the beginning of a game request.
try { await migrateConfiguredDatabase(); }
catch { console.error('Build stopped: connect the Turso database and check migrations before deploying. No credentials were logged.'); process.exitCode = 1; }
