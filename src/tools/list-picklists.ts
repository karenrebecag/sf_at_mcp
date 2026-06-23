import { errorToolResult, jsonToolResult } from '../core/format/tool-result.js';
import { fetchObjectDescribe } from '../services/describe.js';

export const listPicklistsSchema = {
  type: 'object',
  properties: {
    object: { type: 'string', description: 'Lead, Account, or Contact.' },
    field: {
      type: 'string',
      description: 'Optional single picklist field API name (e.g. Status).',
    },
    search: {
      type: 'string',
      description: 'Optional filter on field name or label.',
    },
  },
  required: ['object'],
  additionalProperties: false,
} as const;

/** Thin wrapper over describe_object mode=picklists — optimized for dashboard filter UIs. */
export async function handleListPicklists(args: Record<string, unknown>) {
  const object = typeof args.object === 'string' ? args.object.trim() : '';
  if (!object) return errorToolResult('Missing required parameter: object');

  try {
    const data = await fetchObjectDescribe(object, {
      mode: 'picklists',
      field: typeof args.field === 'string' ? args.field : undefined,
      search: typeof args.search === 'string' ? args.search : undefined,
    });
    return jsonToolResult(data);
  } catch (err) {
    return errorToolResult(String(err));
  }
}
