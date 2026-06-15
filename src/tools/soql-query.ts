import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { query } from '../salesforce.js';

export const soqlQuerySchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'A read-only SOQL SELECT statement, e.g. "SELECT Id, Name FROM Account LIMIT 10"',
    },
  },
  required: ['query'],
  additionalProperties: false,
} as const;

const SELECT_ONLY = /^\s*SELECT\s/i;

export async function handleSoqlQuery(args: { query?: unknown }): Promise<CallToolResult> {
  const soql = typeof args.query === 'string' ? args.query.trim() : '';
  if (!soql) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Missing required parameter: query' }],
    };
  }
  if (!SELECT_ONLY.test(soql)) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Only read-only SOQL SELECT queries are allowed.' }],
    };
  }

  try {
    const result = await query(soql);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: String(err) }] };
  }
}
