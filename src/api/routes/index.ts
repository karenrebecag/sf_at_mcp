import { sendJson } from '../http.js';
import type { ApiRoute } from '../types.js';
import { dashboardRoutes } from './dashboard/index.js';
import { getDescribe } from './describe.js';
import { getOrg } from './org.js';
import { postQuery } from './query.js';
import { getSchema } from './schema.js';

export const apiRoutes: ApiRoute[] = [
  { method: 'GET', pattern: '/org', handler: getOrg },
  { method: 'GET', pattern: '/schema', handler: getSchema },
  { method: 'GET', pattern: '/describe/:sobject', handler: getDescribe },
  { method: 'POST', pattern: '/query', handler: postQuery },
  ...dashboardRoutes,
];

export const apiIndex: ApiRoute = {
  method: 'GET',
  pattern: '/',
  handler: async ({ res }) => {
    sendJson(res, 200, {
      name: 'salesforce-atfx-api',
      version: '0.1.0',
      endpoints: apiRoutes.map((r) => ({ method: r.method, path: `/api${r.pattern}` })),
    });
  },
};
