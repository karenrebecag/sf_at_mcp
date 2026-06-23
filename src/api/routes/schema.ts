import { SCHEMA_MD } from '../../schema.js';
import { sendJson } from '../http.js';
import type { ApiHandler } from '../types.js';

export const getSchema: ApiHandler = async ({ res }) => {
  sendJson(res, 200, { data: { format: 'markdown', content: SCHEMA_MD } });
};
