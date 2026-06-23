import { assertSupportedObject, countryFieldFor, type PrimaryObject } from '../objects.js';
import { assertSoqlFieldName } from '../soql-fields.js';
import { assertDateLiteral, assertDays } from './period.js';

export interface AggregateInput {
  object: string;
  groupBy: string[];
  metric?: 'count';
  period?: string;
  days?: number;
  filters?: Record<string, string | boolean | number>;
  orderBy?: 'desc' | 'asc';
  limit?: number;
}

const METRIC_EXPR = { count: 'COUNT(Id) cnt' } as const;

export function buildAggregateQuery(input: AggregateInput): string {
  const object = assertSupportedObject(input.object);
  const groupBy = input.groupBy.map((g) => g.trim()).filter(Boolean);
  if (groupBy.length === 0) {
    throw new Error('groupBy must include at least one field (e.g. Owner.Name, Status).');
  }
  const safeGroupBy = groupBy.map(assertSoqlFieldName);

  const metric = input.metric ?? 'count';
  const select = [...safeGroupBy, METRIC_EXPR[metric]].join(', ');
  const where = buildWhere(object, input);
  const order = `ORDER BY ${metric === 'count' ? 'COUNT(Id)' : 'COUNT(Id)'} ${input.orderBy === 'asc' ? 'ASC' : 'DESC'}`;
  const limit = input.limit ? ` LIMIT ${clampLimit(input.limit)}` : '';

  return `SELECT ${select} FROM ${object}${where} GROUP BY ${safeGroupBy.join(', ')} ${order}${limit}`;
}

function buildWhere(object: PrimaryObject, input: AggregateInput): string {
  const clauses: string[] = [];

  if (input.period) {
    clauses.push(`CreatedDate = ${assertDateLiteral(input.period)}`);
  } else if (input.days !== undefined) {
    clauses.push(`CreatedDate = LAST_N_DAYS:${assertDays(input.days)}`);
  }

  for (const [field, value] of Object.entries(input.filters ?? {})) {
    if (field === 'country') {
      const country = String(value).replace(/'/g, "\\'");
      clauses.push(`${countryFieldFor(object)} = '${country}'`);
      continue;
    }
    clauses.push(formatFilter(assertSoqlFieldName(field), value));
  }

  return clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
}

function formatFilter(field: string, value: string | boolean | number): string {
  if (typeof value === 'boolean') return `${field} = ${value}`;
  if (typeof value === 'number') return `${field} = ${value}`;
  const escaped = value.replace(/'/g, "\\'");
  return `${field} = '${escaped}'`;
}

function clampLimit(n: number): number {
  if (!Number.isInteger(n) || n < 1) throw new Error('limit must be a positive integer');
  return Math.min(n, 2000);
}
