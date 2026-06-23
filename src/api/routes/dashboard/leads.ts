import { defaultCacheTtlMs, withCache } from '../../../core/cache/redis.js';
import { leadConversionRate, leadsByBdm, leadsByCountry } from '../../queries/leads.js';
import { sendApiError, sendApiResult } from '../../response.js';
import { runSoql } from '../../../services/salesforce-data.js';
import type { ApiHandler } from '../../types.js';

export const getLeadsByBdm: ApiHandler = async ({ res, searchParams }) => {
  const period = searchParams.get('period') ?? 'THIS_MONTH';
  try {
    const soql = leadsByBdm(period);
    const { result, cached } = await runSoql(soql, { cacheKey: `atfx:leads:by-bdm:${period}` });
    sendApiResult(res, 200, result, { period, soql, cached });
  } catch (err) {
    sendApiError(res, String(err));
  }
};

export const getLeadsByCountry: ApiHandler = async ({ res, searchParams }) => {
  const days = Number(searchParams.get('days') ?? '30');
  try {
    const soql = leadsByCountry(days);
    const { result, cached } = await runSoql(soql, { cacheKey: `atfx:leads:by-country:${days}` });
    sendApiResult(res, 200, result, { days, soql, cached });
  } catch (err) {
    sendApiError(res, String(err));
  }
};

export const getLeadConversionRate: ApiHandler = async ({ res, searchParams }) => {
  const days = Number(searchParams.get('days') ?? '30');
  try {
    const queries = leadConversionRate(days);
    const { value, cached } = await withCache(
      `atfx:leads:conversion-rate:${days}`,
      defaultCacheTtlMs(),
      async () => {
        const [totalResult, convertedResult] = await Promise.all(
          queries.map(async (q) => (await runSoql(q)).result),
        );
        const total = extractCount(totalResult);
        const converted = extractCount(convertedResult);
        const rate = total > 0 ? converted / total : 0;
        return { total, converted, rate };
      },
    );
    sendApiResult(res, 200, value, { days, soql: queries, cached });
  } catch (err) {
    sendApiError(res, String(err));
  }
};

function extractCount(result: unknown): number {
  const records = (result as { records?: Array<Record<string, unknown>> })?.records ?? [];
  const row = records[0];
  if (!row) return 0;
  const value = row.total ?? row.converted ?? row.cnt ?? row.expr0 ?? Object.values(row)[0];
  return typeof value === 'number' ? value : Number(value) || 0;
}
