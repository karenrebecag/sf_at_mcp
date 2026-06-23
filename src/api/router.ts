import type { IncomingMessage, ServerResponse } from 'node:http';
import { normalizeApiPath, presentedToken, tokenMatches } from './auth.js';
import { readBody, sendJson } from './http.js';
import { apiIndex, apiRoutes } from './routes/index.js';
import type { ApiContext, ApiRoute } from './types.js';

const allRoutes: ApiRoute[] = [apiIndex, ...apiRoutes];

function matchRoute(
  method: string,
  pathname: string,
): { route: ApiRoute; params: Record<string, string> } | undefined {
  for (const route of allRoutes) {
    if (route.method !== method) continue;
    const params = matchPattern(route.pattern, pathname);
    if (params) return { route, params };
  }
  return undefined;
}

function matchPath(pathname: string): boolean {
  return allRoutes.some((route) => matchPattern(route.pattern, pathname) !== null);
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

  if (!matchRoute(method, rel) && matchPath(rel)) {
    sendJson(res, 405, { error: 'method_not_allowed', path: apiPath, method });
    return true;
  }

  const matched = matchRoute(method, rel);

  if (!matched) {
    sendJson(res, 404, { error: 'not_found', path: apiPath });
    return true;
  }

  let body: unknown;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    try {
      body = await readBody(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 400, { error: 'bad_request', message });
      return true;
    }
  }

  const ctx: ApiContext = {
    req,
    res,
    pathname: apiPath,
    searchParams,
    body,
    params: matched.params,
  };
  await matched.route.handler(ctx);
  return true;
}
