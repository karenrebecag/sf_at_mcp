import { describe, expect, it } from 'vitest';
import { toolErrorText } from './helpers/tool-result.js';
import { handleSoqlQuery } from '../src/tools/soql-query.js';
import { handleDescribeObject } from '../src/tools/describe-object.js';

describe('soql-query tool', () => {
  it('rejects when query and queryLocator are both missing', async () => {
    const r = await handleSoqlQuery({});
    expect(r.isError).toBe(true);
  });

  it('rejects non-SELECT statements (read-only guard)', async () => {
    const r = await handleSoqlQuery({ query: 'DELETE FROM Account' });
    expect(r.isError).toBe(true);
    expect(toolErrorText(r)).toMatch(/read-only/i);
  });

  it('rejects when query and queryLocator are both provided', async () => {
    const r = await handleSoqlQuery({
      query: 'SELECT Id FROM Lead',
      queryLocator: '/services/data/v67.0/query/fixture-locator',
    });
    expect(r.isError).toBe(true);
    expect(toolErrorText(r)).toMatch(/not both/i);
  });

  it('rejects arbitrary REST queryLocator paths', async () => {
    const r = await handleSoqlQuery({ queryLocator: '/services/data/v67.0/limits' });
    expect(r.isError).toBe(true);
    expect(toolErrorText(r)).toMatch(/SOQL pagination URL/);
  });
});

describe('describe-object tool', () => {
  it('rejects a missing sobject', async () => {
    const r = await handleDescribeObject({});
    expect(r.isError).toBe(true);
  });
});
