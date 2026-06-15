import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, type SalesforceSession } from '../salesforce.js';

export const describeObjectSchema = {
  type: 'object',
  properties: {
    sobject: {
      type: 'string',
      description:
        'API name of the sObject to describe, e.g. "Account", "Opportunity", "Custom__c"',
    },
  },
  required: ['sobject'],
  additionalProperties: false,
} as const;

export async function handleDescribeObject(
  session: SalesforceSession,
  args: { sobject?: unknown },
): Promise<CallToolResult> {
  const sobject = typeof args.sobject === 'string' ? args.sobject.trim() : '';
  if (!sobject) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Missing required parameter: sobject' }],
    };
  }

  try {
    const result = (await describe(session, sobject)) as {
      name?: string;
      label?: string;
      fields?: Array<{ name: string; label: string; type: string; relationshipName?: string }>;
    };
    // Trim the describe payload to the fields most useful to the model.
    const summary = {
      name: result.name,
      label: result.label,
      fields: (result.fields ?? []).map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        ...(f.relationshipName ? { relationshipName: f.relationshipName } : {}),
      })),
    };
    return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: String(err) }] };
  }
}
