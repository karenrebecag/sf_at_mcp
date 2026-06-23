import type { DescribeMode } from '../core/describe/filter.js';
import { errorToolResult, jsonToolResult } from '../core/format/tool-result.js';
import { fetchObjectDescribe } from '../services/describe.js';

export const describeObjectSchema = {
  type: 'object',
  properties: {
    sobject: {
      type: 'string',
      description: 'API name: Lead, Account, or Contact (use mode=full for other objects).',
    },
    mode: {
      type: 'string',
      enum: ['curated', 'picklists', 'full'],
      description:
        'curated (default) = high-signal fields from schema; picklists = filter fields only; full = all fields.',
    },
    search: {
      type: 'string',
      description: 'Optional filter on field name or label (e.g. "country", "utm").',
    },
    field: {
      type: 'string',
      description: 'Optional exact API field name (e.g. Status, Country_of_Residence_Lead__c).',
    },
  },
  required: ['sobject'],
  additionalProperties: false,
} as const;

export async function handleDescribeObject(args: {
  sobject?: unknown;
  mode?: unknown;
  search?: unknown;
  field?: unknown;
}) {
  const sobject = typeof args.sobject === 'string' ? args.sobject.trim() : '';
  if (!sobject) return errorToolResult('Missing required parameter: sobject');

  const mode = parseMode(args.mode);
  const search = typeof args.search === 'string' ? args.search : undefined;
  const field = typeof args.field === 'string' ? args.field : undefined;

  try {
    const data = await fetchObjectDescribe(sobject, { mode, search, field });
    return jsonToolResult(data);
  } catch (err) {
    return errorToolResult(String(err));
  }
}

function parseMode(value: unknown): DescribeMode {
  if (value === 'picklists' || value === 'full' || value === 'curated') return value;
  return 'curated';
}
