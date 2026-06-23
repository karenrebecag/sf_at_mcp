#!/usr/bin/env npx tsx
/** Starts the MCP server with fixtures, runs smoke-mcp, then exits. */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.MCP_ACCESS_TOKEN ?? randomBytes(24).toString('hex');
const port = process.env.PORT ?? '8787';

const child = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
  cwd: root,
  env: {
    ...process.env,
    SF_FIXTURE_MODE: 'mock',
    MCP_ACCESS_TOKEN: token,
    PORT: port,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout?.on('data', (d) => process.stderr.write(d));
child.stderr?.on('data', (d) => process.stderr.write(d));

async function runSmoke() {
  const smoke = spawn('pnpm', ['exec', 'tsx', 'scripts/smoke-mcp.ts'], {
    cwd: root,
    env: {
      ...process.env,
      SMOKE_BASE_URL: `http://localhost:${port}`,
      SMOKE_TOKEN: token,
    },
    stdio: 'inherit',
  });
  const code: number = await new Promise((resolve) => smoke.on('close', resolve));
  return code;
}

async function main() {
  await new Promise((r) => setTimeout(r, 1500));
  const code = await runSmoke();
  child.kill('SIGTERM');
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  child.kill('SIGTERM');
  process.exit(1);
});