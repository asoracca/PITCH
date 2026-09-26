import { spawnSync } from 'node:child_process';
const target = process.argv[2];
if (!['--local', '--remote'].includes(target)) throw new Error('Specify --local or --remote.');
const result = spawnSync('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', target], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
