import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { orgInfo } from '../salesforce.js';

export const getOrgInfoSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export async function handleGetOrgInfo(): Promise<CallToolResult> {
  try {
    const info = (await orgInfo()) as Record<string, unknown>;
    const summary = {
      username: info.username,
      alias: info.alias,
      instanceUrl: info.instanceUrl,
      orgId: info.id,
      apiVersion: info.apiVersion,
      connectedStatus: info.connectedStatus,
    };
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: String(err) }] };
  }
}
