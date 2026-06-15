export const INSTRUCTIONS = `# Salesforce ATFX — read-only connector

Provides read-only access to the ATFX Salesforce org. All requests run as a single
shared, CLI-authenticated service user; results reflect that user's permissions
and sharing rules.

## Tools
- salesforce_atfx_get_org_info — which org / user am I connected as. Call first if
  unsure about context.
- salesforce_atfx_describe_object — inspect an sObject's fields, types and
  relationships before writing a query. Use it when you don't know exact field names.
- salesforce_atfx_soql_query — run a SOQL SELECT and get the matching records.

## Guidance
- This connector is READ-ONLY. There are no create/update/delete tools; never claim
  to have modified data.
- Prefer describing an object before querying unfamiliar fields.
- SOQL only (SELECT ...). Keep queries scoped with WHERE/LIMIT for large objects.
- Field and object API names are case-sensitive and custom ones end in __c.
`;
