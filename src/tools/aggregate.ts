import { buildAggregateQuery } from '../core/queries/aggregate.js';
import { errorToolResult, jsonToolResult, mergeMeta } from '../core/format/tool-result.js';
import { runSoql } from '../services/salesforce-data.js';

export const aggregateSchema = {
  type: 'object',
  properties: {
    object: { type: 'string', description: 'Lead, Account, or Contact.' },
    groupBy: {
      type: 'array',
      items: { type: 'string' },
      description: 'Fields to group by, e.g. ["Owner.Name"] or ["Status"].',
    },
    metric: { type: 'string', enum: ['count'], description: 'Aggregate metric (default: count).' },
    period: {
      type: 'string',
      description: 'SOQL date literal for CreatedDate, e.g. THIS_MONTH, LAST_MONTH.',
    },
    days: {
      type: 'number',
      description: 'Alternative to period — LAST_N_DAYS:N on CreatedDate.',
    },
    filters: {
      type: 'object',
      description:
        'Extra WHERE filters. Use country (ISO-3) for the correct per-object country field.',
      additionalProperties: true,
    },
    orderBy: { type: 'string', enum: ['asc', 'desc'] },
    limit: { type: 'number', description: 'Max groups returned (max 2000).' },
  },
  required: ['object', 'groupBy'],
  additionalProperties: false,
} as const;

export async function handleAggregate(args: Record<string, unknown>) {
  try {
    const soql = buildAggregateQuery({
      object: String(args.object ?? ''),
      groupBy: Array.isArray(args.groupBy) ? args.groupBy.map(String) : [],
      metric: args.metric === 'count' ? 'count' : undefined,
      period: typeof args.period === 'string' ? args.period : undefined,
      days: typeof args.days === 'number' ? args.days : undefined,
      filters: (args.filters as Record<string, string | boolean | number>) ?? undefined,
      orderBy: args.orderBy === 'asc' ? 'asc' : 'desc',
      limit: typeof args.limit === 'number' ? args.limit : undefined,
    });
    const { result, warnings, truncated, hints } = await runSoql(soql);
    const meta = mergeMeta(
      { soql },
      {
        ...(warnings.length ? { warnings } : {}),
        ...(truncated ? { truncated: true } : {}),
      },
    );
    return jsonToolResult(result, meta, { hints });
  } catch (err) {
    return errorToolResult(String(err));
  }
}
