import { createHash } from 'node:crypto';
import { prepareSoql } from '../../core/soql-guards.js';

function hashKey(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
import { sendApiError, sendApiResult } from '../response.js';
import { runSoql } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const postQuery: ApiHandler = async ({ res, body }) => {
  const payload = (body ?? {}) as { query?: unknown; queryLocator?: unknown; maxRecords?: unknown };
  const queryLocator = typeof payload.queryLocator === 'string' ? payload.queryLocator.trim() : '';
  const soql = typeof payload.query === 'string' ? payload.query.trim() : '';
  const maxRecords = typeof payload.maxRecords === 'number' ? payload.maxRecords : undefined;

  if (!soql && !queryLocator) {
    sendApiError(res, 'Missing required field: query or queryLocator');
    return;
  }

  try {
    const executedSoql = soql ? prepareSoql(soql).soql : undefined;
    const cacheKey = executedSoql ? `atfx:query:${hashKey(executedSoql)}` : undefined;
    const { result, warnings, truncated, hints, cached } = await runSoql(soql || undefined, {
      queryLocator: queryLocator || undefined,
      maxRecords,
      cacheKey,
    });
    sendApiResult(res, 200, result, {
      ...(executedSoql ? { soql: executedSoql } : {}),
      ...(queryLocator ? { queryLocator } : {}),
      ...(cacheKey ? { cached } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(truncated ? { truncated: true } : {}),
      ...(hints.length ? { hints } : {}),
    });
  } catch (err) {
    sendApiError(res, String(err));
  }
};
