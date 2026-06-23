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
 *
 * REST API for dashboards lives under /api (or /<token>/api) with the same auth.
 */
import { createServer as createHttpServer } from 'node:http';
import { accessTokenConfigured, presentedToken, tokenMatches } from './api/auth.js';
import { handleApiRequest } from './api/router.js';
import { readBody, setCorsHeaders } from './api/http.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from './server.js';

const PORT = Number(process.env.PORT ?? 8787);

if (!accessTokenConfigured()) {
  process.stderr.write('MCP_ACCESS_TOKEN must be set and at least 24 chars.\n');
  process.exit(1);
}

const httpServer = createHttpServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  setCorsHeaders(res);

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

  const handledApi = await handleApiRequest(req, res, url.pathname, url.searchParams);
  if (handledApi) return;

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
