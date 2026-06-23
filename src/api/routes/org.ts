import { sendApiError, sendApiResult } from '../response.js';
import { fetchOrgSummary } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const getOrg: ApiHandler = async ({ res }) => {
  try {
    const data = await fetchOrgSummary();
    sendApiResult(res, 200, data);
  } catch (err) {
    sendApiError(res, String(err));
  }
};
