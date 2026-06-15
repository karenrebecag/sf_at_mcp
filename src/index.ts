#!/usr/bin/env node
/**
 * Long-running HTTP MCP server for Claude web (remote custom connector).
 *
 * There is no Salesforce OAuth here: data access rides the locally-authenticated
 * `sf` CLI (see salesforce.ts). The only thing guarding this endpoint is a shared
 * secret carried in the URL path: the connector URL is
 *
 *     https://<host>/<MCP_ACCESS_TOKEN>/mcp
 *
 * Anyone with that exact URL can query as the CLI-authenticated user, so treat it
 * like a password. A Bearer header with the same token is also accepted.
 */
import { createServer as createHttpServer, type IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 8787);
const ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN;

if (!ACCESS_TOKEN || ACCESS_TOKEN.length < 24) {
  process.stderr.write('MCP_ACCESS_TOKEN must be set and at least 24 chars.\n');
  process.exit(1);
}

function tokenMatches(presented: string | undefined): boolean {
  if (!presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(ACCESS_TOKEN as string);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Token from the leading path segment (/<token>/mcp) or a Bearer header. */
function presentedToken(req: IncomingMessage, pathname: string): string | undefined {
  const m = pathname.match(/^\/([^/]+)\/mcp$/);
  if (m) return decodeURIComponent(m[1]);
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

const httpServer = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  const isMcpPath = url.pathname === '/mcp' || /^\/[^/]+\/mcp$/.test(url.pathname);
  if (!isMcpPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
    return;
  }

  if (!tokenMatches(presentedToken(req, url.pathname))) {
    res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }

  const body = await readBody(req);
  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error('MCP handler error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal_error' }));
    }
  }
});

httpServer.listen(PORT, () => {
  process.stdout.write(`Salesforce ATFX MCP listening on :${PORT}\n`);
});
