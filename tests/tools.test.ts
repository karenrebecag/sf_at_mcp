import { describe, expect, it } from 'vitest';
import { handleSoqlQuery } from '../src/tools/soql-query.js';
import { handleDescribeObject } from '../src/tools/describe-object.js';

describe('soql-query tool', () => {
  it('rejects a missing query', async () => {
    const r = await handleSoqlQuery({});
    expect(r.isError).toBe(true);
  });

  it('rejects non-SELECT statements (read-only guard)', async () => {
    const r = await handleSoqlQuery({ query: 'DELETE FROM Account' });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toMatch(/read-only/i);
  });
});

describe('describe-object tool', () => {
  it('rejects a missing sobject', async () => {
    const r = await handleDescribeObject({});
    expect(r.isError).toBe(true);
  });
});
