import { errorToolResult, jsonToolResult, mergeMeta } from '../core/format/tool-result.js';
import { runSoql } from '../services/salesforce-data.js';

export const soqlQuerySchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'Read-only SOQL SELECT. Non-aggregates without LIMIT get LIMIT 200 auto-appended. Omit when using queryLocator.',
    },
    queryLocator: {
      type: 'string',
      description: 'nextRecordsUrl from a previous response — fetches the next page.',
    },
    maxRecords: {
      type: 'number',
      description: 'Max records returned per page in the tool response (default 50).',
    },
  },
  additionalProperties: false,
} as const;

export async function handleSoqlQuery(args: {
  query?: unknown;
  queryLocator?: unknown;
  maxRecords?: unknown;
}) {
  const queryLocator = typeof args.queryLocator === 'string' ? args.queryLocator.trim() : '';
  const soql = typeof args.query === 'string' ? args.query.trim() : '';
  const maxRecords = typeof args.maxRecords === 'number' ? args.maxRecords : undefined;

  if (!soql && !queryLocator) {
    return errorToolResult('Provide query or queryLocator.');
  }

  try {
    const { result, warnings, truncated, hints } = await runSoql(soql || undefined, {
      queryLocator: queryLocator || undefined,
      maxRecords,
    });
    const meta = mergeMeta(undefined, {
      ...(warnings.length ? { warnings } : {}),
      ...(truncated ? { truncated: true } : {}),
    });
    return jsonToolResult(result, Object.keys(meta).length ? meta : undefined, { hints });
  } catch (err) {
    return errorToolResult(String(err));
  }
}
