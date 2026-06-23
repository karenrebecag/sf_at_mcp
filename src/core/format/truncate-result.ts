const DEFAULT_MAX_RECORDS = 50;

export interface QueryResultShape {
  records?: unknown[];
  totalSize?: number;
  done?: boolean;
  nextRecordsUrl?: string;
}

export interface TruncatedQueryResult {
  result: QueryResultShape;
  truncated: boolean;
  hints: string[];
}

export function truncateQueryResult(
  raw: unknown,
  maxRecords = DEFAULT_MAX_RECORDS,
): TruncatedQueryResult {
  const result = (raw ?? {}) as QueryResultShape;
  const hints: string[] = [];
  const records = result.records ?? [];

  if (records.length <= maxRecords && result.done !== false) {
    return { result, truncated: false, hints };
  }

  const truncated = records.length > maxRecords || result.done === false;
  if (records.length > maxRecords) {
    hints.push(
      `Showing ${maxRecords} of ${records.length} records in this page. Use queryLocator with nextRecordsUrl for more rows, or narrow the query with WHERE / GROUP BY.`,
    );
  }
  if (result.done === false && result.nextRecordsUrl) {
    hints.push(
      `More records available. Pass queryLocator: "${result.nextRecordsUrl}" to fetch the next page.`,
    );
  }

  return {
    result: {
      ...result,
      records: records.slice(0, maxRecords),
      totalSize: result.totalSize ?? records.length,
    },
    truncated,
    hints,
  };
}
