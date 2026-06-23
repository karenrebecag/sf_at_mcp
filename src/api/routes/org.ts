import { sendJson } from '../http.js';
import { fetchOrgSummary } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const getOrg: ApiHandler = async ({ res }) => {
  try {
    const data = await fetchOrgSummary();
    sendJson(res, 200, { data });
  } catch (err) {
    sendJson(res, 502, { error: 'salesforce_error', message: String(err) });
  }
};
