/** MCP tool ↔ REST endpoint parity matrix — used by audit tests. */

export interface ParityEntry {
  mcpTool: string;
  restMethod: string;
  restPath: string;
  status: 'implemented' | 'partial' | 'missing';
  notes?: string;
}

export const MCP_REST_PARITY: ParityEntry[] = [
  {
    mcpTool: 'salesforce_atfx_get_org_info',
    restMethod: 'GET',
    restPath: '/api/org',
    status: 'implemented',
  },
  {
    mcpTool: 'schema://atfx',
    restMethod: 'GET',
    restPath: '/api/schema',
    status: 'implemented',
  },
  {
    mcpTool: 'schema://atfx/{lead,account,contact}',
    restMethod: 'GET',
    restPath: '/api/schema/:section',
    status: 'implemented',
  },
  {
    mcpTool: 'salesforce_atfx_describe_object',
    restMethod: 'GET',
    restPath: '/api/describe/:sobject',
    status: 'implemented',
  },
  {
    mcpTool: 'salesforce_atfx_list_picklists',
    restMethod: 'GET',
    restPath: '/api/picklists/:object',
    status: 'implemented',
    notes: 'Also available via /api/describe/:sobject?mode=picklists',
  },
  {
    mcpTool: 'salesforce_atfx_aggregate',
    restMethod: 'POST',
    restPath: '/api/aggregate',
    status: 'implemented',
    notes: 'Dashboard shortcuts under /api/dashboard/leads/*',
  },
  {
    mcpTool: 'salesforce_atfx_search_records',
    restMethod: 'GET',
    restPath: '/api/search',
    status: 'implemented',
  },
  {
    mcpTool: 'salesforce_atfx_get_record',
    restMethod: 'GET',
    restPath: '/api/records/:object/:id',
    status: 'implemented',
  },
  {
    mcpTool: 'salesforce_atfx_soql_query',
    restMethod: 'POST',
    restPath: '/api/query',
    status: 'implemented',
    notes: 'Supports queryLocator pagination in body',
  },
];
