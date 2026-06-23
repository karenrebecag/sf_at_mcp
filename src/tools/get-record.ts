import { buildGetRecordQuery } from '../core/records.js';
import { errorToolResult, jsonToolResult, mergeMeta } from '../core/format/tool-result.js';
import { runSoql } from '../services/salesforce-data.js';

export const getRecordSchema = {
  type: 'object',
  properties: {
    object: { type: 'string', description: 'Lead, Account, or Contact.' },
    id: { type: 'string', description: 'Salesforce 15/18-char record Id.' },
    fields: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optional field list. Defaults to Id, Name, Owner.Name, CreatedDate.',
    },
  },
  required: ['object', 'id'],
  additionalProperties: false,
} as const;

export async function handleGetRecord(args: Record<string, unknown>) {
  const object = typeof args.object === 'string' ? args.object.trim() : '';
  const id = typeof args.id === 'string' ? args.id.trim() : '';
  if (!object || !id) return errorToolResult('Missing required parameters: object and id');

  try {
    const fields =
      Array.isArray(args.fields) && args.fields.length > 0 ? args.fields.map(String) : undefined;
    const soql = buildGetRecordQuery(object, id, fields);
    const { result, warnings, hints } = await runSoql(soql, { maxRecords: 1 });
    const meta = mergeMeta({ soql }, warnings.length ? { warnings } : {});
    return jsonToolResult(result, meta, { hints });
  } catch (err) {
    return errorToolResult(String(err));
  }
}
