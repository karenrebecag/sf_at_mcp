import { assertDateLiteral, assertDays } from './period.js';

/** Curated SOQL for dashboard widgets — shared by MCP, REST, and future cache layer. */

export function leadsByBdm(period = 'THIS_MONTH'): string {
  const literal = assertDateLiteral(period);
  return `SELECT Owner.Name, COUNT(Id) cnt FROM Lead WHERE CreatedDate = ${literal} GROUP BY Owner.Name ORDER BY COUNT(Id) DESC`;
}

export function leadsByCountry(days = 30): string {
  const n = assertDays(days);
  return `SELECT Country_of_Residence_Lead__c, COUNT(Id) cnt FROM Lead WHERE CreatedDate = LAST_N_DAYS:${n} GROUP BY Country_of_Residence_Lead__c ORDER BY COUNT(Id) DESC`;
}

export function leadConversionRate(days = 30): [string, string] {
  const n = assertDays(days);
  return [
    `SELECT COUNT(Id) total FROM Lead WHERE CreatedDate = LAST_N_DAYS:${n}`,
    `SELECT COUNT(Id) converted FROM Lead WHERE CreatedDate = LAST_N_DAYS:${n} AND IsConverted = true`,
  ];
}
