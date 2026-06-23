import { describe, expect, it } from 'vitest';
import { truncateQueryResult } from '../src/core/format/truncate-result.js';
import { normalizeQueryLocator } from '../src/salesforce.js';

describe('truncateQueryResult', () => {
  it('truncates large record sets', () => {
    const raw = { records: Array.from({ length: 80 }, (_, i) => ({ Id: i })), done: true };
    const { truncated, hints, result } = truncateQueryResult(raw, 50);
    expect(truncated).toBe(true);
    expect((result.records ?? []).length).toBe(50);
    expect(hints.some((h) => h.includes('50 of 80'))).toBe(true);
  });

  it('hints pagination when done is false', () => {
    const raw = {
      records: [{ Id: '1' }],
      done: false,
      nextRecordsUrl: '/services/data/v67.0/query/locator',
    };
    const { hints } = truncateQueryResult(raw, 50);
    expect(hints.some((h) => h.includes('queryLocator'))).toBe(true);
  });
});

describe('normalizeQueryLocator', () => {
  it('strips host from full URL', () => {
    expect(
      normalizeQueryLocator('https://atgs.my.salesforce.com/services/data/v67.0/query/01gXXX'),
    ).toBe('/services/data/v67.0/query/01gXXX');
  });
});