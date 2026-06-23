import { errorToolResult, jsonToolResult } from '../core/format/tool-result.js';
import { fetchOrgSummary } from '../services/salesforce-data.js';

export const getOrgInfoSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

export async function handleGetOrgInfo() {
  try {
    const { data, cached } = await fetchOrgSummary();
    return jsonToolResult(data, cached ? { cached: true } : undefined);
  } catch (err) {
    return errorToolResult(String(err));
  }
}
