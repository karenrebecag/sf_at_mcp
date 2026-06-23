import { describe, expect, it } from 'vitest';
import { assertSupportedObject } from '../src/core/objects.js';
import { prepareSoql } from '../src/core/soql-guards.js';
import { buildAggregateQuery } from '../src/core/queries/aggregate.js';
import { buildSearchQuery } from '../src/core/queries/search.js';

describe('core objects', () => {
  it('accepts primary objects', () => {
    expect(assertSupportedObject('Lead')).toBe('Lead');
  });

  it('rejects Opportunity', () => {
    expect(() => assertSupportedObject('Opportunity')).toThrow(/does not exist/);
  });
});

describe('soql guards', () => {
  it('appends LIMIT when missing', () => {
    const { soql, warnings } = prepareSoql('SELECT Id FROM Lead');
    expect(soql).toMatch(/LIMIT 200$/);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('rejects Account without WHERE', () => {
    expect(() => prepareSoql('SELECT Id FROM Account LIMIT 10')).toThrow(/WHERE/);
  });

  it('allows Account aggregates', () => {
    expect(() => prepareSoql('SELECT Type, COUNT(Id) FROM Account GROUP BY Type')).not.toThrow();
  });
});

describe('aggregate builder', () => {
  it('builds group by query', () => {
    const soql = buildAggregateQuery({
      object: 'Lead',
      groupBy: ['Status'],
      days: 7,
    });
    expect(soql).toContain('GROUP BY Status');
    expect(soql).toContain('LAST_N_DAYS:7');
  });
});

describe('search builder', () => {
  it('requires at least one filter', () => {
    expect(() => buildSearchQuery({ object: 'Lead' })).toThrow(/at least one filter/);
  });

  it('builds email search', () => {
    const soql = buildSearchQuery({ object: 'Lead', email: 'test@', days: 30 });
    expect(soql).toContain("Email LIKE '%test@%'");
  });
});