import { describe, expect, it } from 'vitest';
import { assertSupportedObject } from '../src/core/objects.js';
import { assertSelectQuery, prepareSoql } from '../src/core/soql-guards.js';
import { buildAggregateQuery } from '../src/core/queries/aggregate.js';
import { leadConversionRate, leadsByBdm, leadsByCountry } from '../src/core/queries/leads.js';
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

  it('rejects Opportunity in SOQL', () => {
    expect(() => prepareSoql('SELECT Id FROM Opportunity LIMIT 1')).toThrow(/does not exist/);
  });
});

describe('api query guard', () => {
  it('allows SELECT', () => {
    expect(() => assertSelectQuery('SELECT Id FROM Lead LIMIT 1')).not.toThrow();
  });

  it('rejects mutations', () => {
    expect(() => assertSelectQuery('DELETE FROM Account')).toThrow(/read-only/i);
  });
});

describe('dashboard SOQL builders', () => {
  it('builds leads by bdm with default period', () => {
    expect(leadsByBdm()).toContain('CreatedDate = THIS_MONTH');
    expect(leadsByBdm('LAST_MONTH')).toContain('CreatedDate = LAST_MONTH');
  });

  it('rejects invalid date literals', () => {
    expect(() => leadsByBdm('DROP TABLE')).toThrow(/Invalid SOQL date literal/);
  });

  it('builds leads by country with bounded days', () => {
    expect(leadsByCountry(30)).toContain('LAST_N_DAYS:30');
    expect(() => leadsByCountry(0)).toThrow(/days must/);
  });

  it('builds conversion rate pair', () => {
    const [total, converted] = leadConversionRate(7);
    expect(total).toContain('COUNT(Id) total');
    expect(converted).toContain('IsConverted = true');
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
