import { describe, expect, it } from 'vitest';
import { handleSoqlQuery } from '../src/tools/soql-query.js';
import { handleDescribeObject } from '../src/tools/describe-object.js';

const session = { accessToken: 'x', instanceUrl: 'https://x.my.salesforce.com' };

describe('soql-query tool', () => {
  it('rejects a missing query', async () => {
    const r = await handleSoqlQuery(session, {});
    expect(r.isError).toBe(true);
  });

  it('rejects non-SELECT statements (read-only guard)', async () => {
    const r = await handleSoqlQuery(session, { query: 'DELETE FROM Account' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/read-only/i);
  });
});

describe('describe-object tool', () => {
  it('rejects a missing sobject', async () => {
    const r = await handleDescribeObject(session, {});
    expect(r.isError).toBe(true);
  });
});
