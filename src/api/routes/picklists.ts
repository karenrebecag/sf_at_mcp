import { sendApiError, sendApiResult } from '../response.js';
import { fetchObjectDescribe } from '../../services/describe.js';
import type { ApiHandler } from '../types.js';

export const getPicklists: ApiHandler = async ({ res, params, searchParams }) => {
  const object = decodeURIComponent(params.object ?? '').trim();
  if (!object) {
    sendApiError(res, 'Missing required parameter: object');
    return;
  }

  try {
    const data = await fetchObjectDescribe(object, {
      mode: 'picklists',
      field: searchParams.get('field') ?? undefined,
      search: searchParams.get('search') ?? undefined,
    });
    sendApiResult(res, 200, data);
  } catch (err) {
    sendApiError(res, String(err));
  }
};
