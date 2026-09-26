import './build-frontend.mjs';
import { build } from 'esbuild';
import { mkdir, cp, access, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await build({ entryPoints: ['backend/worker.ts'], outfile: 'dist/server/index.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', sourcemap: true });
await cp('frontend/dist', 'dist/client', { recursive: true });
await build({ entryPoints: ['server/vercel-handler.ts', 'server/libsql.ts', 'server/node-http.ts'], outdir: 'build/node', bundle: true, packages: 'external', format: 'esm', platform: 'node', target: 'node24' });
try { await access('.openai/hosting.json'); await mkdir('dist/.openai', { recursive: true }); await cp('.openai/hosting.json', 'dist/.openai/hosting.json'); await cp('drizzle', 'dist/.openai/drizzle', { recursive: true }); } catch (error) { if (error.code !== 'ENOENT') throw error; }

await build({ entryPoints: ['client/pitch-api.ts'], outfile: 'build/client/pitch-api.js', bundle: true, platform: 'browser', format: 'esm', target: 'es2022' });
