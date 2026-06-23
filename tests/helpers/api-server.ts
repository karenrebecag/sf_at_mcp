import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handleApiRequest } from '../../src/api/router.js';
import { setCorsHeaders } from '../../src/api/http.js';

export const TEST_ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN ?? '';

export interface ApiServer {
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startApiServer(): Promise<ApiServer> {
  const server = createServer(async (req, res) => {
    setCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const handled = await handleApiRequest(req, res, url.pathname, url.searchParams);
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => closeServer(server),
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Omit for path-prefix auth; pass null to send no credentials; pass a string to override. */
  token?: string | null;
  /** When true, use bare /api/... and Authorization: Bearer instead of /{token}/api/... */
  bearer?: boolean;
  json?: unknown;
  body?: string;
}

export async function apiRequest(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<{ status: number; body: unknown; headers: Headers }> {
  const token = options.token === null ? undefined : (options.token ?? TEST_ACCESS_TOKEN);
  const headers = new Headers(options.headers);

  let urlPath = path;
  if (token && !options.bearer && path.startsWith('/api')) {
    urlPath = `/${encodeURIComponent(token)}${path}`;
  }

  if (options.bearer && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body: string | undefined;
  if (options.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.json);
  } else if (options.body !== undefined) {
    body = options.body;
  }

  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: options.method ?? 'GET',
    headers,
    body,
  });

  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  return { status: res.status, body: parsed, headers: res.headers };
}

export function mockReq(
  headers: Record<string, string | string[] | undefined> = {},
): IncomingMessage {
  return { headers } as IncomingMessage;
}
