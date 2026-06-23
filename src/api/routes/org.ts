import { sendApiError, sendApiResult } from '../response.js';
import { fetchOrgSummary } from '../../services/salesforce-data.js';
import type { ApiHandler } from '../types.js';

export const getOrg: ApiHandler = async ({ res }) => {
  try {
    const { data, cached } = await fetchOrgSummary();
    sendApiResult(res, 200, data, { cached });
  } catch (err) {
    sendApiError(res, String(err));
  }
};
