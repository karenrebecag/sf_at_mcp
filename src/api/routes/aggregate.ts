import { buildAggregateQuery } from '../../core/queries/aggregate.js';
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
    const { result, warnings, truncated, hints } = await runSoql(soql);
    sendApiResult(res, 200, result, {
      soql,
      ...(warnings.length ? { warnings } : {}),
      ...(truncated ? { truncated: true } : {}),
      ...(hints.length ? { hints } : {}),
    });
  } catch (err) {
    sendApiError(res, String(err));
  }
};
