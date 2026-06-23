import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { INSTRUCTIONS } from './instructions.js';
import { SCHEMA_RESOURCES } from './schema/resources.js';
import {
  aggregateSchema,
  describeObjectSchema,
  getOrgInfoSchema,
  getRecordSchema,
  handleAggregate,
  handleDescribeObject,
  handleGetOrgInfo,
  handleGetRecord,
  handleListPicklists,
  handleSearchRecords,
  handleSoqlQuery,
  listPicklistsSchema,
  searchRecordsSchema,
  soqlQuerySchema,
} from './tools/index.js';

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

export function createServer(): Server {
  const server = new Server(
    {
      name: 'salesforce-atfx-mcp',
      version: '0.2.0',
      title: 'Salesforce ATFX',
      description: 'Read-only access to the ATFX Salesforce org — semantic tools + guarded SOQL.',
    },
    { capabilities: { tools: {}, resources: {} }, instructions: INSTRUCTIONS },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: SCHEMA_RESOURCES.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: 'text/markdown',
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const resource = SCHEMA_RESOURCES.find((r) => r.uri === req.params.uri);
    if (!resource) throw new Error(`Unknown resource: ${req.params.uri}`);
    return {
      contents: [{ uri: resource.uri, mimeType: 'text/markdown', text: resource.text }],
    };
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'salesforce_atfx_get_org_info',
        description:
          'Get the authenticated user and the connected Salesforce org (instance URL, user, org id). Call first to confirm context.',
        inputSchema: getOrgInfoSchema,
        annotations: READ_ONLY,
      },
      {
        name: 'salesforce_atfx_describe_object',
        description:
          "Describe an sObject's fields. Default mode=curated (high-signal ATFX fields). Use mode=picklists for filter values; mode=full for exhaustive list.",
        inputSchema: describeObjectSchema,
        annotations: READ_ONLY,
      },
      {
        name: 'salesforce_atfx_list_picklists',
        description:
          'List picklist fields and values for Lead, Account, or Contact — optimized for filter dropdowns.',
        inputSchema: listPicklistsSchema,
        annotations: READ_ONLY,
      },
      {
        name: 'salesforce_atfx_aggregate',
        description:
          'Run semantic aggregates (COUNT by groupBy) without writing SOQL. Prefer over soql_query for KPIs.',
        inputSchema: aggregateSchema,
        annotations: READ_ONLY,
      },
      {
        name: 'salesforce_atfx_search_records',
        description:
          'Search Lead, Account, or Contact by email, name, status, country, BDM, or date window.',
        inputSchema: searchRecordsSchema,
        annotations: READ_ONLY,
      },
      {
        name: 'salesforce_atfx_get_record',
        description: 'Fetch a single Lead, Account, or Contact record by Salesforce Id.',
        inputSchema: getRecordSchema,
        annotations: READ_ONLY,
      },
      {
        name: 'salesforce_atfx_soql_query',
        description:
          'Run a read-only SOQL SELECT (escape hatch). Supports queryLocator pagination. Guardrails: auto-LIMIT, truncation, Account requires WHERE or aggregates.',
        inputSchema: soqlQuerySchema,
        annotations: READ_ONLY,
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req): Promise<CallToolResult> => {
    const { name, arguments: args = {} } = req.params;
    const a = args as Record<string, unknown>;
    switch (name) {
      case 'salesforce_atfx_get_org_info':
        return handleGetOrgInfo();
      case 'salesforce_atfx_describe_object':
        return handleDescribeObject(a);
      case 'salesforce_atfx_list_picklists':
        return handleListPicklists(a);
      case 'salesforce_atfx_aggregate':
        return handleAggregate(a);
      case 'salesforce_atfx_search_records':
        return handleSearchRecords(a);
      case 'salesforce_atfx_get_record':
        return handleGetRecord(a);
      case 'salesforce_atfx_soql_query':
        return handleSoqlQuery(a);
      default:
        return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  });

  return server;
}
