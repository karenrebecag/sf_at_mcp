/** SOQL field-name validation — blocks injection via SELECT/GROUP BY/WHERE field slots. */

const FIELD_SEGMENT = /^[A-Za-z][A-Za-z0-9_]*$/;
const RELATIONSHIP_FIELD = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const SALESFORCE_ID = /^[a-zA-Z0-9]{15,18}$/;

export function assertSoqlFieldName(field: string): string {
  const name = field.trim();
  if (!name) throw new Error('Field name cannot be empty.');
  if (FIELD_SEGMENT.test(name) || RELATIONSHIP_FIELD.test(name)) return name;
  throw new Error(
    `Invalid field name "${field}". Use API names like Status, Owner.Name, Country_of_Residence_Lead__c.`,
  );
}

export function assertSoqlFieldNames(fields: string[]): string[] {
  return fields.map(assertSoqlFieldName);
}

export function assertSalesforceId(id: string): string {
  const value = id.trim();
  if (!SALESFORCE_ID.test(value)) {
    throw new Error('Invalid Salesforce record Id.');
  }
  return value;
}
