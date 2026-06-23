import { prepareSoql } from '../../core/soql-guards.js';
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
    const { result, warnings, truncated, hints } = await runSoql(soql || undefined, {
      queryLocator: queryLocator || undefined,
      maxRecords,
    });
    sendApiResult(res, 200, result, {
      ...(executedSoql ? { soql: executedSoql } : {}),
      ...(queryLocator ? { queryLocator } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(truncated ? { truncated: true } : {}),
      ...(hints.length ? { hints } : {}),
    });
  } catch (err) {
    sendApiError(res, String(err));
  }
};
