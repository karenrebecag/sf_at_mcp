import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function jsonToolResult(
  data: unknown,
  meta?: Record<string, unknown>,
  extra?: { hints?: string[] },
): CallToolResult {
  const payload: Record<string, unknown> = meta ? { data, meta } : { data };
  if (extra?.hints?.length) payload.hints = extra.hints;
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

export function errorToolResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

export function mergeMeta(
  base: Record<string, unknown> | undefined,
  parts: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(base ?? {}), ...parts };
}
