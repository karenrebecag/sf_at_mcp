export const INSTRUCTIONS = `# Salesforce ATFX — read-only connector (v0.2)

Read-only access to the ATFX brokerage CRM. All requests run as one shared,
CLI-authenticated service user.

## Tool priority (use in this order)
1. **salesforce_atfx_aggregate** — KPIs / GROUP BY without writing SOQL.
2. **salesforce_atfx_search_records** — find records by email, name, country, BDM.
3. **salesforce_atfx_list_picklists** — filter dropdown values (Status, Type, …).
4. **salesforce_atfx_describe_object** — field metadata (default mode=curated).
5. **salesforce_atfx_get_record** — single record by Id.
6. **salesforce_atfx_soql_query** — escape hatch only; has auto-LIMIT guardrails.
7. **salesforce_atfx_get_org_info** — confirm connected org/user.

## Schema resources (read before unfamiliar queries)
- schema://atfx — full dictionary
- schema://atfx/lead | /account | /contact — per-object slices

## Key facts
- Pipeline: **Lead → Account**. **No Opportunity** — never query it.
- **BDM = Owner.Name** (not OwnerId).
- Country ISO-3 fields differ per object (see schema resource).
- Account ~55k+ records — always scope queries.
`;
