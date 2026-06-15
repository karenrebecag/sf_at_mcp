import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { createServer } from '../src/server.js';
import { openSessionToken } from '../src/oauth.js';
import { refreshAccessToken } from '../src/salesforce.js';

// Force the Node.js runtime (not Edge) — jose + node:crypto + streaming transport.
export const config = { runtime: 'nodejs', maxDuration: 30 };

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
}

function unauthorized(res: ServerResponse, error: string, description: string) {
  // Point Claude at the protected-resource metadata so it can start the OAuth flow.
  const resourceMetadata = `${baseUrl()}/.well-known/oauth-protected-resource`;
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': `Bearer resource_metadata="${resourceMetadata}", error="${error}"`,
  });
  res.end(JSON.stringify({ error, error_description: description }));
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const authHeader = (req.headers['authorization'] as string) ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    unauthorized(res, 'unauthorized', 'Bearer token required');
    return;
  }

  let session;
  try {
    const token = await openSessionToken(authHeader.slice(7));
    session = await refreshAccessToken(token.srt);
  } catch {
    unauthorized(res, 'invalid_token', 'Invalid or expired token');
    return;
  }

  const server = createServer(session);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('MCP handler error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
  }
}
