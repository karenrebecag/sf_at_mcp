import { sendJson } from '../http.js';
import { fetchObjectDescribe } from '../../services/describe.js';
import type { ApiHandler } from '../types.js';

export const getDescribe: ApiHandler = async ({ res, pathname, searchParams }) => {
  const sobject = decodeURIComponent(pathname.split('/').pop() ?? '').trim();
  if (!sobject) {
    sendJson(res, 400, { error: 'bad_request', message: 'Missing sobject name' });
    return;
  }

  const mode = searchParams.get('mode') ?? 'curated';
  const search = searchParams.get('search') ?? undefined;
  const field = searchParams.get('field') ?? undefined;

  try {
    const data = await fetchObjectDescribe(sobject, {
      mode: mode === 'picklists' || mode === 'full' ? mode : 'curated',
      search,
      field,
    });
    sendJson(res, 200, { data });
  } catch (err) {
    const message = String(err);
    const status = message.includes('not in the curated') ? 400 : 502;
    sendJson(res, status, { error: status === 400 ? 'bad_request' : 'salesforce_error', message });
  }
};
