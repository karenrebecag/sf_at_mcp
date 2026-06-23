import { describe, expect, it } from 'vitest';
import { normalizeApiPath } from '../src/api/auth.js';
import { assertSelectQuery } from '../src/core/soql-guards.js';
import { leadConversionRate, leadsByBdm, leadsByCountry } from '../src/core/queries/leads.js';

describe('api auth paths', () => {
  it('normalizes token-prefixed api paths', () => {
    expect(normalizeApiPath('/secret-token/api/org')).toBe('/api/org');
    expect(normalizeApiPath('/secret-token/api/dashboard/leads/by-bdm')).toBe(
      '/api/dashboard/leads/by-bdm',
    );
  });

  it('accepts bare /api paths', () => {
    expect(normalizeApiPath('/api/query')).toBe('/api/query');
    expect(normalizeApiPath('/api')).toBe('/api');
  });

  it('rejects non-api paths', () => {
    expect(normalizeApiPath('/health')).toBeNull();
    expect(normalizeApiPath('/secret/mcp')).toBeNull();
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