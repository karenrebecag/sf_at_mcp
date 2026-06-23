import { assertSupportedObject, countryFieldFor, type PrimaryObject } from '../objects.js';
import { assertDays } from './period.js';

export interface SearchInput {
  object: string;
  email?: string;
  name?: string;
  status?: string;
  country?: string;
  ownerName?: string;
  days?: number;
  limit?: number;
}

const DEFAULT_SEARCH_FIELDS: Record<PrimaryObject, string[]> = {
  Lead: [
    'Id',
    'Name',
    'Email',
    'Status',
    'Owner.Name',
    'Country_of_Residence_Lead__c',
    'CreatedDate',
  ],
  Account: [
    'Id',
    'Name',
    'Email__c',
    'Type',
    'Owner.Name',
    'Country_of_Residence_Account__c',
    'CreatedDate',
  ],
  Contact: ['Id', 'Name', 'Email', 'Owner.Name', 'Country_of_Residence__c', 'CreatedDate'],
};

export function buildSearchQuery(input: SearchInput): string {
  const object = assertSupportedObject(input.object);
  const clauses = buildClauses(object, input);
  if (clauses.length === 0) {
    throw new Error(
      'Provide at least one filter: email, name, status, country, ownerName, or days.',
    );
  }

  const fields = DEFAULT_SEARCH_FIELDS[object].join(', ');
  const limit = clampLimit(input.limit ?? 50);
  return `SELECT ${fields} FROM ${object} WHERE ${clauses.join(' AND ')} ORDER BY CreatedDate DESC LIMIT ${limit}`;
}

function buildClauses(object: PrimaryObject, input: SearchInput): string[] {
  const clauses: string[] = [];

  if (input.email) {
    const field = object === 'Account' ? 'Email__c' : 'Email';
    clauses.push(`${field} LIKE '%${escapeLike(input.email)}%'`);
  }
  if (input.name) {
    clauses.push(`Name LIKE '%${escapeLike(input.name)}%'`);
  }
  if (input.status && object === 'Lead') {
    clauses.push(`Status = '${escapeQuote(input.status)}'`);
  }
  if (input.country) {
    clauses.push(`${countryFieldFor(object)} = '${escapeQuote(input.country)}'`);
  }
  if (input.ownerName) {
    clauses.push(`Owner.Name LIKE '%${escapeLike(input.ownerName)}%'`);
  }
  if (input.days !== undefined) {
    clauses.push(`CreatedDate = LAST_N_DAYS:${assertDays(input.days)}`);
  }

  return clauses;
}

function escapeLike(value: string): string {
  return value.replace(/'/g, "\\'").replace(/%/g, '\\%');
}

function escapeQuote(value: string): string {
  return value.replace(/'/g, "\\'");
}

function clampLimit(n: number): number {
  if (!Number.isInteger(n) || n < 1) throw new Error('limit must be a positive integer');
  return Math.min(n, 200);
}
