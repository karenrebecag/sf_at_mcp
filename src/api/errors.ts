/** Map domain errors to HTTP status — single place for handler classification. */

const BAD_REQUEST_PATTERNS = [
  'does not exist in the ATFX org',
  'not in the curated ATFX set',
  'read-only',
  'Opportunity',
  'WHERE clause',
  'Invalid field name',
  'Invalid Salesforce record Id',
  'groupBy must',
  'Invalid SOQL date literal',
  'days must',
  'at least one filter',
  'limit must',
  'Field name cannot be empty',
  'Invalid JSON body',
  'Missing required',
  'Missing query param',
  'Missing object',
  'Provide either a SOQL query or queryLocator',
  'query or queryLocator',
  'Provide query or queryLocator, not both',
  'queryLocator must be a SOQL pagination URL',
  'Request body too large',
] as const;

/** Strip noisy CLI prefixes from Salesforce errors before returning to clients. */
export function sanitizeSalesforceMessage(message: string): string {
  return message
    .replace(/^Error:\s*/i, '')
    .replace(/\s*See more help with --help\.?\s*$/i, '')
    .trim();
}

export function apiErrorStatus(message: string): 400 | 502 {
  const normalized = message.toLowerCase();
  for (const pattern of BAD_REQUEST_PATTERNS) {
    if (normalized.includes(pattern.toLowerCase())) return 400;
  }
  return 502;
}

export function apiErrorPayload(message: string): {
  error: 'bad_request' | 'salesforce_error';
  message: string;
} {
  const status = apiErrorStatus(message);
  const sanitized = status === 502 ? sanitizeSalesforceMessage(message) : message;
  return {
    error: status === 400 ? 'bad_request' : 'salesforce_error',
    message: sanitized,
  };
}
