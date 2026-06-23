import { describe, expect, it } from 'vitest';
import { apiErrorStatus, sanitizeSalesforceMessage } from '../src/api/errors.js';

describe('apiErrorStatus', () => {
  it('maps validation errors to 400', () => {
    expect(apiErrorStatus('Object "Opportunity" does not exist in the ATFX org')).toBe(400);
    expect(apiErrorStatus('Invalid field name "foo bar"')).toBe(400);
    expect(apiErrorStatus('days must be an integer between 1 and 365')).toBe(400);
    expect(apiErrorStatus('Invalid JSON body')).toBe(400);
    expect(apiErrorStatus('Provide query or queryLocator, not both.')).toBe(400);
    expect(
      apiErrorStatus(
        'queryLocator must be a SOQL pagination URL (/services/data/vXX.X/query/...).',
      ),
    ).toBe(400);
    expect(apiErrorStatus('Request body too large')).toBe(400);
  });

  it('maps unknown Salesforce failures to 502', () => {
    expect(apiErrorStatus('NETWORK_TIMEOUT')).toBe(502);
  });
});

describe('sanitizeSalesforceMessage', () => {
  it('strips CLI noise', () => {
    expect(sanitizeSalesforceMessage('Error: foo bar See more help with --help')).toBe('foo bar');
  });
});
