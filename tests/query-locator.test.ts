import { describe, expect, it } from 'vitest';
import { assertSoqlQueryLocator, normalizeQueryLocator } from '../src/core/query-locator.js';

describe('normalizeQueryLocator', () => {
  it('strips host from full URL', () => {
    expect(
      normalizeQueryLocator('https://atgs.my.salesforce.com/services/data/v67.0/query/01gXXX'),
    ).toBe('/services/data/v67.0/query/01gXXX');
  });

  it('adds leading slash when missing', () => {
    expect(normalizeQueryLocator('services/data/v67.0/query/locator')).toBe(
      '/services/data/v67.0/query/locator',
    );
  });
});

describe('assertSoqlQueryLocator', () => {
  it('accepts SOQL pagination paths', () => {
    expect(assertSoqlQueryLocator('/services/data/v67.0/query/fixture-locator')).toBe(
      '/services/data/v67.0/query/fixture-locator',
    );
  });

  it('accepts full nextRecordsUrl', () => {
    expect(
      assertSoqlQueryLocator('https://instance.salesforce.com/services/data/v59.0/query/01gABC'),
    ).toBe('/services/data/v59.0/query/01gABC');
  });

  it('rejects arbitrary REST paths', () => {
    expect(() => assertSoqlQueryLocator('/services/data/v67.0/limits')).toThrow(
      /SOQL pagination URL/,
    );
    expect(() => assertSoqlQueryLocator('/services/data/v67.0/sobjects/User/describe')).toThrow(
      /SOQL pagination URL/,
    );
  });
});
