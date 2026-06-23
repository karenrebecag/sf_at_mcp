import { describe, expect, it } from 'vitest';
import { buildGetRecordQuery } from '../src/core/records.js';
import { assertSoqlFieldName } from '../src/core/soql-fields.js';
import { buildAggregateQuery } from '../src/core/queries/aggregate.js';

describe('soql field validation', () => {
  it('accepts standard and relationship fields', () => {
    expect(assertSoqlFieldName('Status')).toBe('Status');
    expect(assertSoqlFieldName('Owner.Name')).toBe('Owner.Name');
    expect(assertSoqlFieldName('Country_of_Residence_Lead__c')).toBe(
      'Country_of_Residence_Lead__c',
    );
  });

  it('rejects SOQL injection in field names', () => {
    expect(() => assertSoqlFieldName("Name FROM Lead WHERE Name LIKE '")).toThrow(
      /Invalid field name/,
    );
    expect(() => assertSoqlFieldName('Owner.Name; DELETE FROM Lead')).toThrow(/Invalid field name/);
  });

  it('rejects malicious fields in get record query', () => {
    expect(() =>
      buildGetRecordQuery('Lead', '00Qfixture000001', ["Name FROM Lead WHERE Name LIKE '"]),
    ).toThrow(/Invalid field name/);
  });

  it('rejects malicious groupBy in aggregate', () => {
    expect(() =>
      buildAggregateQuery({
        object: 'Lead',
        groupBy: ["Status FROM Lead WHERE Name LIKE '"],
        days: 7,
      }),
    ).toThrow(/Invalid field name/);
  });
});
