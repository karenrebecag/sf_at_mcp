import { createHash } from 'node:crypto';
import { buildAggregateQuery } from '../../core/queries/aggregate.js';

function hashKey(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
import { sendApiError, sendApiResult } from '../response.js';
import { runSoql } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const postAggregate: ApiHandler = async ({ res, body }) => {
  const payload = (body ?? {}) as Record<string, unknown>;
  try {
    const soql = buildAggregateQuery({
      object: String(payload.object ?? ''),
      groupBy: Array.isArray(payload.groupBy) ? payload.groupBy.map(String) : [],
      metric: payload.metric === 'count' ? 'count' : undefined,
      period: typeof payload.period === 'string' ? payload.period : undefined,
      days: typeof payload.days === 'number' ? payload.days : undefined,
      filters: (payload.filters as Record<string, string | boolean | number>) ?? undefined,
      orderBy: payload.orderBy === 'asc' ? 'asc' : 'desc',
      limit: typeof payload.limit === 'number' ? payload.limit : undefined,
    });
    const cacheKey = `atfx:aggregate:${hashKey(JSON.stringify(payload))}`;
    const { result, warnings, truncated, hints, cached } = await runSoql(soql, { cacheKey });
    sendApiResult(res, 200, result, {
      soql,
      cached,
      ...(warnings.length ? { warnings } : {}),
      ...(truncated ? { truncated: true } : {}),
      ...(hints.length ? { hints } : {}),
    });
  } catch (err) {
    sendApiError(res, String(err));
  }
};
