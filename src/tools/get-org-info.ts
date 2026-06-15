import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { userInfo, type SalesforceSession } from '../salesforce.js';

export const getOrgInfoSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export async function handleGetOrgInfo(session: SalesforceSession): Promise<CallToolResult> {
  try {
    const info = (await userInfo(session)) as Record<string, unknown>;
    const summary = {
      instanceUrl: session.instanceUrl,
      name: info.name,
      preferred_username: info.preferred_username,
      email: info.email,
      organization_id: info.organization_id,
      user_id: info.user_id,
    };
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: String(err) }] };
  }
}
