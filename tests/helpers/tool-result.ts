import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function parseToolResult(r: CallToolResult): Record<string, unknown> {
  const block = r.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Expected a text content block in tool result');
  }
  return JSON.parse(block.text) as Record<string, unknown>;
}

export function toolErrorText(r: CallToolResult): string {
  const block = r.content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Expected a text content block in tool result');
  }
  return block.text;
}
