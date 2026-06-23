#!/usr/bin/env npx tsx
/**
 * Local MCP smoke test — exercises all 7 tools via Streamable HTTP.
 *
 * Usage:
 *   SF_FIXTURE_MODE=mock MCP_ACCESS_TOKEN=<token> pnpm dev   # terminal 1
 *   pnpm smoke:mcp                                              # terminal 2
 *
 * Or against a running server:
 *   SMOKE_BASE_URL=http://localhost:8787 SMOKE_TOKEN=<token> pnpm smoke:mcp
 */
const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:8787';
const TOKEN = process.env.SMOKE_TOKEN ?? process.env.MCP_ACCESS_TOKEN ?? '';

if (!TOKEN || TOKEN.length < 24) {
  console.error('Set MCP_ACCESS_TOKEN or SMOKE_TOKEN (24+ chars).');
  process.exit(1);
}

const MCP_URL = `${BASE}/${TOKEN}/mcp`;

interface JsonRpcResponse {
  result?: {
    tools?: { name: string }[];
    resources?: { uri: string }[];
    content?: { text: string }[];
    isError?: boolean;
  };
  error?: { message: string };
}

async function mcpCall(method: string, params: Record<string, unknown> = {}, id = 1): Promise<JsonRpcResponse> {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const text = await res.text();
  const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
  if (!dataLine) throw new Error(`No SSE data in response for ${method}: ${text.slice(0, 200)}`);
  return JSON.parse(dataLine.slice(6)) as JsonRpcResponse;
}

async function callTool(name: string, args: Record<string, unknown>, id: number) {
  const r = await mcpCall('tools/call', { name, arguments: args }, id);
  if (r.error) throw new Error(`${name}: ${r.error.message}`);
  if (r.result?.isError) throw new Error(`${name}: ${r.result.content?.[0]?.text}`);
  return r.result?.content?.[0]?.text ?? '';
}

async function waitForHealth(timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server not healthy at ${BASE}/health after ${timeoutMs}ms`);
}

const TOOL_CASES: Array<{ name: string; args: Record<string, unknown>; assert: (text: string) => void }> = [
  {
    name: 'salesforce_atfx_get_org_info',
    args: {},
    assert: (t) => {
      if (!t.includes('fixture@atfx.test') && !t.includes('@')) throw new Error('missing username');
    },
  },
  {
    name: 'salesforce_atfx_describe_object',
    args: { sobject: 'Lead', mode: 'curated' },
    assert: (t) => {
      if (!t.includes('Status')) throw new Error('missing Status field');
    },
  },
  {
    name: 'salesforce_atfx_list_picklists',
    args: { object: 'Lead', field: 'Status' },
    assert: (t) => {
      if (!t.includes('Not Used Demo')) throw new Error('missing picklist value');
    },
  },
  {
    name: 'salesforce_atfx_aggregate',
    args: { object: 'Lead', groupBy: ['Status'], days: 7 },
    assert: (t) => {
      if (!t.includes('Not Used Demo')) throw new Error('missing aggregate row');
    },
  },
  {
    name: 'salesforce_atfx_search_records',
    args: { object: 'Lead', email: 'test@', days: 30 },
    assert: (t) => {
      if (!t.includes('test@example.com')) throw new Error('missing search hit');
    },
  },
  {
    name: 'salesforce_atfx_get_record',
    args: { object: 'Lead', id: '00Qfixture000001' },
    assert: (t) => {
      if (!t.includes('00Qfixture000001')) throw new Error('missing record id');
    },
  },
  {
    name: 'salesforce_atfx_soql_query',
    args: { query: 'SELECT Id, Name FROM Lead' },
    assert: (t) => {
      if (!t.includes('truncated')) throw new Error('expected truncation meta for 80 fixture rows');
      if (!t.includes('queryLocator')) throw new Error('expected pagination hint');
    },
  },
];

async function main() {
  console.log(`Smoke target: ${MCP_URL}`);
  await waitForHealth();

  const init = await mcpCall('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '1.0' },
  });
  if (!init.result?.serverInfo) throw new Error('initialize failed');

  const tools = await mcpCall('tools/list', {}, 2);
  const names = tools.result?.tools?.map((t) => t.name) ?? [];
  if (names.length < 7) throw new Error(`Expected 7 tools, got ${names.length}: ${names.join(', ')}`);

  const resources = await mcpCall('resources/list', {}, 3);
  if ((resources.result?.resources?.length ?? 0) < 4) {
    throw new Error('Expected 4 schema resources');
  }

  let id = 10;
  for (const tc of TOOL_CASES) {
    process.stdout.write(`  • ${tc.name} ... `);
    const text = await callTool(tc.name, tc.args, id++);
    tc.assert(text);
    console.log('ok');
  }

  // Pagination follow-up
  process.stdout.write('  • soql_query pagination ... ');
  const page1 = await callTool('salesforce_atfx_soql_query', { query: 'SELECT Id, Name FROM Lead' }, id++);
  const parsed = JSON.parse(page1) as { data: { nextRecordsUrl?: string } };
  const locator = parsed.data?.nextRecordsUrl;
  if (!locator) throw new Error('missing nextRecordsUrl in page1');
  const page2 = await callTool('salesforce_atfx_soql_query', { queryLocator: locator }, id++);
  if (!page2.includes('Paged Lead')) throw new Error('pagination page2 failed');
  console.log('ok');

  // Describe cache — second call should hit cache
  process.stdout.write('  • describe cache ... ');
  await callTool('salesforce_atfx_describe_object', { sobject: 'Lead', mode: 'picklists' }, id++);
  const cached = await callTool('salesforce_atfx_describe_object', { sobject: 'Lead', mode: 'picklists' }, id++);
  if (!cached.includes('"cached": true')) throw new Error('second describe should be cached');
  console.log('ok');

  console.log('\nAll MCP smoke checks passed.');
}

main().catch((err) => {
  console.error('\nSmoke FAILED:', err);
  process.exit(1);
});