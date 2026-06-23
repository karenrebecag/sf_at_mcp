import { truncateQueryResult } from '../core/format/truncate-result.js';
import { assertSoqlQueryLocator } from '../core/query-locator.js';
import { prepareSoql } from '../core/soql-guards.js';
import { describe, orgInfo, query, queryMore } from '../salesforce.js';

export interface RunSoqlOptions {
  maxRecords?: number;
  queryLocator?: string;
}

export async function fetchOrgSummary() {
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

export async function runSoql(
  raw?: string,
  options: RunSoqlOptions = {},
): Promise<{ result: unknown; warnings: string[]; truncated: boolean; hints: string[] }> {
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
