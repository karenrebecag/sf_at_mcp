import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { INSTRUCTIONS } from './instructions.js';
import { handleSoqlQuery, soqlQuerySchema } from './tools/soql-query.js';
import { handleDescribeObject, describeObjectSchema } from './tools/describe-object.js';
import { handleGetOrgInfo, getOrgInfoSchema } from './tools/get-org-info.js';

export function createServer(): Server {
  const server = new Server(
    {
      name: 'salesforce-atfx-mcp',
      version: '0.1.0',
      title: 'Salesforce ATFX',
      description: 'Read-only access to the ATFX Salesforce org (SOQL, describe, org info).',
    },
    { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'salesforce_atfx_get_org_info',
        description:
          'Get the authenticated user and the connected Salesforce org (instance URL, user, org id). Call first to confirm context.',
        inputSchema: getOrgInfoSchema,
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      {
        name: 'salesforce_atfx_describe_object',
        description:
          "Describe an sObject's fields, types and relationships. Use before querying unfamiliar objects to get exact API field names.",
        inputSchema: describeObjectSchema,
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
      {
        name: 'salesforce_atfx_soql_query',
        description:
          'Run a read-only SOQL SELECT query against the ATFX org and return matching records.',
        inputSchema: soqlQuerySchema,
        annotations: { readOnlyHint: true, openWorldHint: true },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req): Promise<CallToolResult> => {
    const { name, arguments: args = {} } = req.params;
    switch (name) {
      case 'salesforce_atfx_get_org_info':
        return handleGetOrgInfo();
      case 'salesforce_atfx_describe_object':
        return handleDescribeObject(args as { sobject?: unknown });
      case 'salesforce_atfx_soql_query':
        return handleSoqlQuery(args as { query?: unknown });
      default:
        return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    }
  });

  return server;
}
