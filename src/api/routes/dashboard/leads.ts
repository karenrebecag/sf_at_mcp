import { leadConversionRate, leadsByBdm, leadsByCountry } from '../../queries/leads.js';
import { sendJson } from '../../http.js';
import { runSoql } from '../../../services/salesforce-data.js';
import type { ApiHandler } from '../../types.js';

export const getLeadsByBdm: ApiHandler = async ({ res, searchParams }) => {
  const period = searchParams.get('period') ?? 'THIS_MONTH';
  try {
    const { result } = await runSoql(leadsByBdm(period));
    sendJson(res, 200, { data: result, meta: { period } });
  } catch (err) {
    const message = String(err);
    const status = message.includes('Invalid SOQL') ? 400 : 502;
    sendJson(res, status, { error: status === 400 ? 'bad_request' : 'salesforce_error', message });
  }
};

export const getLeadsByCountry: ApiHandler = async ({ res, searchParams }) => {
  const days = Number(searchParams.get('days') ?? '30');
  try {
    const { result } = await runSoql(leadsByCountry(days));
    sendJson(res, 200, { data: result, meta: { days } });
  } catch (err) {
    const message = String(err);
    const status = message.includes('days must') ? 400 : 502;
    sendJson(res, status, { error: status === 400 ? 'bad_request' : 'salesforce_error', message });
  }
};

export const getLeadConversionRate: ApiHandler = async ({ res, searchParams }) => {
  const days = Number(searchParams.get('days') ?? '30');
  try {
    const [totalResult, convertedResult] = await Promise.all(
      leadConversionRate(days).map(async (q) => (await runSoql(q)).result),
    );
    const total = extractCount(totalResult);
    const converted = extractCount(convertedResult);
    const rate = total > 0 ? converted / total : 0;
    sendJson(res, 200, {
      data: { total, converted, rate },
      meta: { days },
    });
  } catch (err) {
    const message = String(err);
    const status = message.includes('days must') ? 400 : 502;
    sendJson(res, status, { error: status === 400 ? 'bad_request' : 'salesforce_error', message });
  }
};

function extractCount(result: unknown): number {
  const records = (result as { records?: Array<Record<string, unknown>> })?.records ?? [];
  const row = records[0];
  if (!row) return 0;
  const value = row.total ?? row.converted ?? row.cnt ?? row.expr0 ?? Object.values(row)[0];
  return typeof value === 'number' ? value : Number(value) || 0;
}
