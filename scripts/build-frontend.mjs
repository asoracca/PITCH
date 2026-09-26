import { spawnSync } from 'node:child_process';
const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--dir', 'frontend', 'build'], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('Frontend validation/build failed.');
