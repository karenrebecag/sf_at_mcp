import { buildSearchQuery } from '../../core/queries/search.js';
import { sendApiError, sendApiResult } from '../response.js';
import { runSoql } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const getSearch: ApiHandler = async ({ res, searchParams }) => {
  const object = searchParams.get('object') ?? '';
  if (!object) {
    sendApiError(res, 'Missing query param: object');
    return;
  }

  const daysRaw = searchParams.get('days');
  const limitRaw = searchParams.get('limit');

  try {
    const soql = buildSearchQuery({
      object,
      email: searchParams.get('email') ?? undefined,
      name: searchParams.get('name') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      country: searchParams.get('country') ?? undefined,
      ownerName: searchParams.get('ownerName') ?? undefined,
      days: daysRaw !== null && daysRaw !== '' ? Number(daysRaw) : undefined,
      limit: limitRaw !== null && limitRaw !== '' ? Number(limitRaw) : undefined,
    });
    const { result, warnings, truncated, hints } = await runSoql(soql);
    sendApiResult(res, 200, result, {
      soql,
      ...(warnings.length ? { warnings } : {}),
      ...(truncated ? { truncated: true } : {}),
      ...(hints.length ? { hints } : {}),
    });
  } catch (err) {
    sendApiError(res, String(err));
  }
};
