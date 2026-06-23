import type { ServerResponse } from 'node:http';
import { apiErrorPayload, apiErrorStatus } from './errors.js';
import { sendJson } from './http.js';

export interface ApiResultMeta {
  soql?: string | string[];
  queryLocator?: string;
  warnings?: string[];
  truncated?: boolean;
  hints?: string[];
  [key: string]: unknown;
}

export function sendApiResult(
  res: ServerResponse,
  status: number,
  data: unknown,
  meta?: ApiResultMeta,
): void {
  const payload: Record<string, unknown> = { data };
  if (meta && Object.keys(meta).length > 0) payload.meta = meta;
  sendJson(res, status, payload);
}

export function sendApiError(res: ServerResponse, message: string): void {
  sendJson(res, apiErrorStatus(message), apiErrorPayload(message));
}
