import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN;

export function accessTokenConfigured(): boolean {
  return Boolean(ACCESS_TOKEN && ACCESS_TOKEN.length >= 24);
}

export function tokenMatches(presented: string | undefined): boolean {
  if (!presented || !ACCESS_TOKEN) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(ACCESS_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Token from /<token>/... prefix or Authorization: Bearer header. */
export function presentedToken(req: IncomingMessage, pathname: string): string | undefined {
  const m = pathname.match(/^\/([^/]+)\/(?:api|mcp)(?:\/|$)/);
  if (m) return decodeURIComponent(m[1]);
  const auth = req.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7);
  return undefined;
}

/** /api/foo or /<token>/api/foo → /api/foo */
export function normalizeApiPath(pathname: string): string | null {
  const prefixed = pathname.match(/^\/[^/]+\/api(\/.*)?$/);
  if (prefixed) return `/api${prefixed[1] ?? ''}`;
  if (pathname === '/api' || pathname.startsWith('/api/')) return pathname;
  return null;
}
