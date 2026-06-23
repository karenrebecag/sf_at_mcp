import type { ApiRoute } from '../../types.js';
import { getLeadConversionRate, getLeadsByBdm, getLeadsByCountry } from './leads.js';

export const dashboardRoutes: ApiRoute[] = [
  { method: 'GET', pattern: '/dashboard/leads/by-bdm', handler: getLeadsByBdm },
  { method: 'GET', pattern: '/dashboard/leads/by-country', handler: getLeadsByCountry },
  { method: 'GET', pattern: '/dashboard/leads/conversion-rate', handler: getLeadConversionRate },
];
