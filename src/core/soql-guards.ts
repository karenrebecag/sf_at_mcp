const SELECT_ONLY = /^\s*SELECT\s/i;
const HAS_LIMIT = /\bLIMIT\s+\d+/i;
const HAS_AGGREGATE = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i;
const HAS_GROUP_BY = /\bGROUP\s+BY\b/i;
const FROM_OBJECT = /\bFROM\s+([A-Za-z0-9_]+)/i;
const HAS_WHERE = /\bWHERE\b/i;

const DEFAULT_ROW_LIMIT = 200;

export interface SoqlGuardResult {
  soql: string;
  warnings: string[];
}

export function assertSelectQuery(soql: string): void {
  if (!SELECT_ONLY.test(soql)) {
    throw new Error('Only read-only SOQL SELECT queries are allowed.');
  }
}

export function prepareSoql(raw: string): SoqlGuardResult {
  const soql = raw.trim();
  assertSelectQuery(soql);

  const warnings: string[] = [];
  const fromMatch = soql.match(FROM_OBJECT);
  const object = fromMatch?.[1];

  if (object === 'Opportunity') {
    throw new Error(
      'Opportunity does not exist in the ATFX org. Pipeline is Lead → Account — query Lead or Account instead.',
    );
  }

  const isAggregate = HAS_AGGREGATE.test(soql) || HAS_GROUP_BY.test(soql);

  if (object === 'Account' && !isAggregate && !HAS_WHERE.test(soql)) {
    throw new Error(
      'Account has ~55k+ records. Add a WHERE clause or use GROUP BY / COUNT() aggregates.',
    );
  }

  if (!isAggregate && !HAS_LIMIT.test(soql)) {
    warnings.push(`No LIMIT found; appended LIMIT ${DEFAULT_ROW_LIMIT}.`);
    return { soql: `${soql} LIMIT ${DEFAULT_ROW_LIMIT}`, warnings };
  }

  return { soql, warnings };
}
