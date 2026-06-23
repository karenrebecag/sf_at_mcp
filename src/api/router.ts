import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeApiPath, presentedToken, tokenMatches } from './auth.js';
import { readBody, sendJson } from './http.js';
import { apiIndex, apiRoutes } from './routes/index.js';
import type { ApiContext, ApiRoute } from './types.js';

const allRoutes: ApiRoute[] = [apiIndex, ...apiRoutes];

function matchRoute(method: string, pathname: string): ApiRoute | undefined {
  for (const route of allRoutes) {
    if (route.method !== method) continue;
    const params = matchPattern(route.pattern, pathname);
    if (params) return route;
  }
  return undefined;
}

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean);

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    const segment = pathParts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = segment;
    } else if (part !== segment) {
      return null;
    }
  }
  return params;
}

function relativePath(pathname: string): string {
  const stripped = pathname.replace(/^\/api\/?/, '');
  return stripped ? `/${stripped}` : '/';
}

export async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  rawPathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  const apiPath = normalizeApiPath(rawPathname);
  if (!apiPath) return false;

  if (!tokenMatches(presentedToken(req, rawPathname))) {
    sendJson(res, 401, { error: 'unauthorized' });
    return true;
  }

  const method = req.method ?? 'GET';
  const rel = relativePath(apiPath);
  const route = matchRoute(method, rel);

  if (!route) {
    sendJson(res, 404, { error: 'not_found', path: apiPath });
    return true;
  }

  const body = method === 'POST' ? await readBody(req) : undefined;
  const ctx: ApiContext = { req, res, pathname: apiPath, searchParams, body };
  await route.handler(ctx);
  return true;
}
