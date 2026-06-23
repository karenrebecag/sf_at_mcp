import { defaultCacheTtlMs, withCache } from '../core/cache/redis.js';
import { truncateQueryResult } from '../core/format/truncate-result.js';
import { assertSoqlQueryLocator } from '../core/query-locator.js';
import { prepareSoql } from '../core/soql-guards.js';
import { describe, orgInfo, query, queryMore } from '../salesforce.js';

export interface RunSoqlOptions {
  maxRecords?: number;
  queryLocator?: string;
  /** Redis cache key — when set, SOQL result is cached (optional REDIS_URL). */
  cacheKey?: string;
  cacheTtlMs?: number;
}

export interface RunSoqlResult {
  result: unknown;
  warnings: string[];
  truncated: boolean;
  hints: string[];
  cached: boolean;
}

type SoqlPayload = Omit<RunSoqlResult, 'cached'>;

export async function fetchOrgSummary(): Promise<{
  data: Awaited<ReturnType<typeof loadOrgSummary>>;
  cached: boolean;
}> {
  const { value, cached } = await withCache('atfx:org', defaultCacheTtlMs(), loadOrgSummary);
  return { data: value, cached };
}

async function loadOrgSummary() {
  const info = (await orgInfo()) as Record<string, unknown>;
  return {
    username: info.username,
    alias: info.alias,
    instanceUrl: info.instanceUrl,
    orgId: info.id,
    apiVersion: info.apiVersion,
    connectedStatus: info.connectedStatus,
  };
}

async function executeSoql(raw: string | undefined, options: RunSoqlOptions): Promise<SoqlPayload> {
  const queryText = raw?.trim() ?? '';
  const locatorText = options.queryLocator?.trim() ?? '';

  if (queryText && locatorText) {
    throw new Error('Provide query or queryLocator, not both.');
  }
  if (!queryText && !locatorText) {
    throw new Error('Provide either a SOQL query or queryLocator.');
  }

  const warnings: string[] = [];
  let result: unknown;

  if (locatorText) {
    const path = assertSoqlQueryLocator(locatorText);
    result = await queryMore(path);
  } else {
    const prepared = prepareSoql(queryText);
    warnings.push(...prepared.warnings);
    result = await query(prepared.soql);
  }

  const { result: shaped, truncated, hints } = truncateQueryResult(result, options.maxRecords);
  return { result: shaped, warnings, truncated, hints };
}

export async function runSoql(raw?: string, options: RunSoqlOptions = {}): Promise<RunSoqlResult> {
  const { cacheKey, cacheTtlMs, ...execOptions } = options;

  if (cacheKey) {
    const { value, cached } = await withCache(cacheKey, cacheTtlMs ?? defaultCacheTtlMs(), () =>
      executeSoql(raw, execOptions),
    );
    return { ...value, cached };
  }

  const payload = await executeSoql(raw, execOptions);
  return { ...payload, cached: false };
}

export async function fetchRawDescribe(sobject: string) {
  return describe(sobject) as Promise<{
    name?: string;
    label?: string;
    fields?: Array<{
      name: string;
      label: string;
      type: string;
      relationshipName?: string;
      picklistValues?: Array<{ value: string; label: string; active: boolean }>;
    }>;
  }>;
}
