import { sendApiError, sendApiResult } from '../response.js';
import { fetchObjectDescribe } from '../../services/describe.js';
import type { ApiHandler } from '../types.js';

export const getDescribe: ApiHandler = async ({ res, params, searchParams }) => {
  const sobject = decodeURIComponent(params.sobject ?? '').trim();
  if (!sobject) {
    sendApiError(res, 'Missing required parameter: sobject');
    return;
  }

  const mode = searchParams.get('mode') ?? 'curated';

  try {
    const data = await fetchObjectDescribe(sobject, {
      mode: mode === 'picklists' || mode === 'full' ? mode : 'curated',
      search: searchParams.get('search') ?? undefined,
      field: searchParams.get('field') ?? undefined,
    });
    sendApiResult(res, 200, data);
  } catch (err) {
    sendApiError(res, String(err));
  }
};
