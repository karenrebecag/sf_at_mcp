import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDescribeCache } from '../src/services/describe.js';
import { handleAggregate } from '../src/tools/aggregate.js';
import { handleDescribeObject } from '../src/tools/describe-object.js';
import { handleGetOrgInfo } from '../src/tools/get-org-info.js';
import { handleGetRecord } from '../src/tools/get-record.js';
import { handleListPicklists } from '../src/tools/list-picklists.js';
import { handleSearchRecords } from '../src/tools/search-records.js';
import { handleSoqlQuery } from '../src/tools/soql-query.js';

beforeEach(() => {
  process.env.SF_FIXTURE_MODE = 'mock';
  clearDescribeCache();
});

afterEach(() => {
  delete process.env.SF_FIXTURE_MODE;
  clearDescribeCache();
});

function parseResult(r: { content: { text: string }[] }) {
  return JSON.parse(r.content[0].text) as Record<string, unknown>;
}

describe('MCP tool handlers (fixture mode)', () => {
  it('get_org_info', async () => {
    const r = await handleGetOrgInfo();
    expect(r.isError).toBeFalsy();
    const body = parseResult(r);
    expect((body.data as { username: string }).username).toBe('fixture@atfx.test');
  });

  it('describe_object curated', async () => {
    const r = await handleDescribeObject({ sobject: 'Lead', mode: 'curated' });
    const body = parseResult(r);
    const fields = (body.data as { fields: { name: string }[] }).fields;
    expect(fields.some((f) => f.name === 'Status')).toBe(true);
  });

  it('list_picklists', async () => {
    const r = await handleListPicklists({ object: 'Lead', field: 'Status' });
    const body = parseResult(r);
    const fields = (body.data as { fields: { picklistValues: { value: string }[] }[] }).fields;
    expect(fields[0]?.picklistValues?.[0]?.value).toBe('Not Used Demo');
  });

  it('aggregate', async () => {
    const r = await handleAggregate({ object: 'Lead', groupBy: ['Status'], days: 7 });
    expect(r.isError).toBeFalsy();
    const body = parseResult(r);
    expect(body.meta).toBeTruthy();
  });

  it('search_records', async () => {
    const r = await handleSearchRecords({ object: 'Lead', email: 'test@', days: 30 });
    const body = parseResult(r);
    const records = (body.data as { records: unknown[] }).records;
    expect(records.length).toBeGreaterThan(0);
  });

  it('get_record', async () => {
    const r = await handleGetRecord({ object: 'Lead', id: '00Qfixture000001' });
    const body = parseResult(r);
    expect((body.data as { records: { Id: string }[] }).records[0].Id).toBe('00Qfixture000001');
  });

  it('soql_query truncates and paginates', async () => {
    const r = await handleSoqlQuery({ query: 'SELECT Id, Name FROM Lead' });
    const body = parseResult(r);
    expect((body.meta as { truncated: boolean }).truncated).toBe(true);
    expect((body.hints as string[]).length).toBeGreaterThan(0);

    const locator = (body.data as { nextRecordsUrl: string }).nextRecordsUrl;
    const r2 = await handleSoqlQuery({ queryLocator: locator });
    const body2 = parseResult(r2);
    expect((body2.data as { records: { Name: string }[] }).records[0].Name).toBe('Paged Lead');
  });

  it('describe cache hits on second call', async () => {
    const r1 = await handleDescribeObject({ sobject: 'Lead', mode: 'picklists' });
    const r2 = await handleDescribeObject({ sobject: 'Lead', mode: 'picklists' });
    expect((parseResult(r1).data as { cached: boolean }).cached).toBe(false);
    expect((parseResult(r2).data as { cached: boolean }).cached).toBe(true);
  });
});