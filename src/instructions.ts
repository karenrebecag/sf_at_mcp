export const INSTRUCTIONS = `# Salesforce ATFX — read-only connector

Read-only access to the ATFX brokerage CRM. All requests run as one shared,
CLI-authenticated service user; results reflect that user's permissions.

## Tools
- salesforce_atfx_get_org_info — which org / user am I connected as.
- salesforce_atfx_describe_object — live field list of any sObject (use for
  exhaustive detail; objects have hundreds of fields).
- salesforce_atfx_soql_query — run a SOQL SELECT.

## Schema context (READ THIS BEFORE QUERYING)
A curated data dictionary is published as the MCP resource **schema://atfx**
(objects, key fields, picklist values, SOQL patterns). Read it before writing
queries with unfamiliar fields. Key facts up front:

- Pipeline is **Lead → Account**. **No Opportunity object exists** — never query it.
- **"BDM" = record Owner.** Group/filter by the \`Owner.Name\` relationship, not OwnerId.
- **Country = ISO-3 picklists, per object:** Lead \`Country_of_Residence_Lead__c\`,
  Account \`Country_of_Residence_Account__c\`, Contact \`Country_of_Residence__c\`.
- **Lead.Status** = Not Used Demo | Used Demo | Interested to Open Account |
  Pending Submitted Application | Live | Stage 6 - Dead. Conversion via \`IsConverted\`.
- Account is large (~55k+). Always scope with WHERE / LIMIT. Watch bulk-load
  spikes (a single day can hold thousands of migrated records) when reporting growth.

## Guidance
- READ-ONLY: no create/update/delete; never claim to have modified data.
- SOQL only (SELECT). Prefer GROUP BY / COUNT() for aggregates over pulling rows.
- Field/object API names are case-sensitive; custom fields end in __c.
`;
