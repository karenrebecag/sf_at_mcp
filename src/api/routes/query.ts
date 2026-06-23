import { sendJson } from '../http.js';
import { runSoql } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const postQuery: ApiHandler = async ({ res, body }) => {
  const payload = body as { query?: unknown } | undefined;
  const soql = typeof payload?.query === 'string' ? payload.query.trim() : '';
  if (!soql) {
    sendJson(res, 400, { error: 'bad_request', message: 'Missing required field: query' });
    return;
  }

  try {
    const { result, warnings, truncated, hints } = await runSoql(soql);
    sendJson(res, 200, {
      data: result,
      ...((warnings.length || truncated || hints.length) && {
        meta: {
          ...(warnings.length ? { warnings } : {}),
          ...(truncated ? { truncated } : {}),
          ...(hints.length ? { hints } : {}),
        },
      }),
    });
  } catch (err) {
    const message = String(err);
    const status =
      message.includes('read-only') ||
      message.includes('Opportunity') ||
      message.includes('WHERE clause')
        ? 400
        : 502;
    sendJson(res, status, { error: status === 400 ? 'bad_request' : 'salesforce_error', message });
  }
};
