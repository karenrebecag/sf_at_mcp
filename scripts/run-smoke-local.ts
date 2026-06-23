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

async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const base = `http://127.0.0.1:${port}`;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {
      /* server still starting */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server not healthy at ${base}/health after ${timeoutMs}ms`);
}

async function runSmoke() {
  const smoke = spawn('pnpm', ['exec', 'tsx', 'scripts/smoke-mcp.ts'], {
    cwd: root,
    env: {
      ...process.env,
      SMOKE_BASE_URL: `http://127.0.0.1:${port}`,
      SMOKE_TOKEN: token,
    },
    stdio: 'inherit',
  });
  const code: number = await new Promise((resolve) => smoke.on('close', resolve));
  return code;
}

async function main() {
  await waitForHealth();
  const code = await runSmoke();
  child.kill('SIGTERM');
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  child.kill('SIGTERM');
  process.exit(1);
});
