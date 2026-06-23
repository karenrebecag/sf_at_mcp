import { buildSearchQuery } from '../core/queries/search.js';
import { errorToolResult, jsonToolResult, mergeMeta } from '../core/format/tool-result.js';
import { runSoql } from '../services/salesforce-data.js';

export const searchRecordsSchema = {
  type: 'object',
  properties: {
    object: { type: 'string', description: 'Lead, Account, or Contact.' },
    email: { type: 'string', description: 'Partial email match (LIKE).' },
    name: { type: 'string', description: 'Partial name match (LIKE).' },
    status: { type: 'string', description: 'Lead Status exact match.' },
    country: { type: 'string', description: 'ISO-3 country code (MEX, ARG, …).' },
    ownerName: { type: 'string', description: 'Partial BDM / Owner.Name match.' },
    days: { type: 'number', description: 'Restrict to CreatedDate = LAST_N_DAYS:N.' },
    limit: { type: 'number', description: 'Max rows (default 50, max 200).' },
  },
  required: ['object'],
  additionalProperties: false,
} as const;

export async function handleSearchRecords(args: Record<string, unknown>) {
  try {
    const soql = buildSearchQuery({
      object: String(args.object ?? ''),
      email: typeof args.email === 'string' ? args.email : undefined,
      name: typeof args.name === 'string' ? args.name : undefined,
      status: typeof args.status === 'string' ? args.status : undefined,
      country: typeof args.country === 'string' ? args.country : undefined,
      ownerName: typeof args.ownerName === 'string' ? args.ownerName : undefined,
      days: typeof args.days === 'number' ? args.days : undefined,
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
