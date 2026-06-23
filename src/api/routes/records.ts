import { buildGetRecordQuery } from '../../core/records.js';
import { sendApiError, sendApiResult } from '../response.js';
import { runSoql } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const getRecord: ApiHandler = async ({ res, params, searchParams }) => {
  const object = decodeURIComponent(params.object ?? '').trim();
  const id = decodeURIComponent(params.id ?? '').trim();
  if (!object || !id) {
    sendApiError(res, 'Missing required parameters: object and id');
    return;
  }

  const fieldsParam = searchParams.get('fields');
  const fields = fieldsParam
    ? fieldsParam
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : undefined;

  try {
    const soql = buildGetRecordQuery(object, id, fields);
    const fieldsKey = fields?.join(',') ?? 'default';
    const cacheKey = `atfx:record:${object}:${id}:${fieldsKey}`;
    const { result, warnings, hints, cached } = await runSoql(soql, { maxRecords: 1, cacheKey });
    sendApiResult(res, 200, result, {
      soql,
      cached,
      ...(warnings.length ? { warnings } : {}),
      ...(hints.length ? { hints } : {}),
    });
  } catch (err) {
    sendApiError(res, String(err));
  }
};
