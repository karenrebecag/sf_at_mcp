import { sendJson } from '../http.js';
import type { ApiRoute } from '../types.js';
import { postAggregate } from './aggregate.js';
import { dashboardRoutes } from './dashboard/index.js';
import { getDescribe } from './describe.js';
import { getOrg } from './org.js';
import { getPicklists } from './picklists.js';
import { postQuery } from './query.js';
import { getRecord } from './records.js';
import { getSearch } from './search.js';
import { getSchema, getSchemaSection } from './schema.js';

export const apiRoutes: ApiRoute[] = [
  { method: 'GET', pattern: '/org', handler: getOrg },
  { method: 'GET', pattern: '/schema', handler: getSchema },
  { method: 'GET', pattern: '/schema/:section', handler: getSchemaSection },
  { method: 'GET', pattern: '/describe/:sobject', handler: getDescribe },
  { method: 'GET', pattern: '/picklists/:object', handler: getPicklists },
  { method: 'POST', pattern: '/aggregate', handler: postAggregate },
  { method: 'GET', pattern: '/search', handler: getSearch },
  { method: 'GET', pattern: '/records/:object/:id', handler: getRecord },
  { method: 'POST', pattern: '/query', handler: postQuery },
  ...dashboardRoutes,
];

export const apiIndex: ApiRoute = {
  method: 'GET',
  pattern: '/',
  handler: async ({ res }) => {
    sendJson(res, 200, {
      name: 'salesforce-atfx-api',
      version: '0.2.0',
      endpoints: apiRoutes.map((r) => ({
        method: r.method,
        path: `/api${r.pattern}`,
        ...(r.pattern.startsWith('/dashboard/') ? { kind: 'shortcut' as const } : {}),
      })),
    });
  },
};
