/**
 * Read-only Salesforce access via the `sf` CLI.
 *
 * The server shells out to the locally-authenticated Salesforce CLI instead of
 * holding any OAuth token itself. The CLI owns the session (it transparently
 * refreshes the access token from the refresh token in its keychain), so this
 * process never sees or stores a credential. Auth is established once with
 * `sf org login device` on the host.
 *
 * execFile (no shell) is used so query/sobject arguments cannot be interpreted
 * by a shell — no command injection.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const SF_BIN = process.env.SF_BIN ?? 'sf';
const MAX_BUFFER = 20 * 1024 * 1024; // 20 MB — query results can be large
const TIMEOUT_MS = 60_000;

function targetOrg(): string {
  return process.env.SF_TARGET_ORG ?? 'atfx';
}

interface SfEnvelope<T> {
  status: number;
  result: T;
  message?: string;
  name?: string;
}

async function runSf<T>(args: string[]): Promise<T> {
  let stdout: string;
  try {
    const r = await run(SF_BIN, [...args, '--json'], {
      maxBuffer: MAX_BUFFER,
      timeout: TIMEOUT_MS,
    });
    stdout = r.stdout;
  } catch (err) {
    // sf exits non-zero on Salesforce errors but still prints a JSON envelope.
    const e = err as { stdout?: string; message?: string };
    if (!e.stdout) throw new Error(e.message ?? 'sf command failed to run');
    stdout = e.stdout;
  }

  let parsed: SfEnvelope<T>;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('Could not parse sf CLI output');
  }
  if (parsed.status !== 0) {
    throw new Error(parsed.message ?? parsed.name ?? 'sf command returned an error');
  }
  return parsed.result;
}

export function query(soql: string): Promise<unknown> {
  return runSf(['data', 'query', '--query', soql, '--target-org', targetOrg()]);
}

export function describe(sobject: string): Promise<unknown> {
  return runSf(['sobject', 'describe', '--sobject', sobject, '--target-org', targetOrg()]);
}

export function orgInfo(): Promise<unknown> {
  return runSf(['org', 'display', '--target-org', targetOrg()]);
}
