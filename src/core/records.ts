import { assertSupportedObject } from './objects.js';
import { assertSalesforceId, assertSoqlFieldNames } from './soql-fields.js';

export const DEFAULT_RECORD_FIELDS = ['Id', 'Name', 'Owner.Name', 'CreatedDate'];

export function buildGetRecordQuery(object: string, id: string, fields?: string[]): string {
  const sobject = assertSupportedObject(object);
  const safeId = assertSalesforceId(id);
  const selectFields = assertSoqlFieldNames(
    fields && fields.length > 0 ? fields : DEFAULT_RECORD_FIELDS,
  );
  return `SELECT ${selectFields.join(', ')} FROM ${sobject} WHERE Id = '${safeId}' LIMIT 1`;
}
