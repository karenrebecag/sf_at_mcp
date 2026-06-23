import { SCHEMA_MD, SCHEMA_RESOURCES } from '../../schema.js';
import { sendJson } from '../http.js';
import { sendApiResult } from '../response.js';
import type { ApiHandler } from '../types.js';

export const getSchema: ApiHandler = async ({ res }) => {
  sendApiResult(res, 200, { format: 'markdown', content: SCHEMA_MD });
};

export const getSchemaSection: ApiHandler = async ({ res, params }) => {
  const section = decodeURIComponent(params.section ?? '')
    .trim()
    .toLowerCase();
  const resource = SCHEMA_RESOURCES.find((r) => r.uri.endsWith(`/${section}`));
  if (!resource) {
    sendJson(res, 404, {
      error: 'not_found',
      message: `Unknown schema section "${section}". Use: lead, account, contact.`,
    });
    return;
  }
  sendApiResult(res, 200, { format: 'markdown', uri: resource.uri, content: resource.text });
};
