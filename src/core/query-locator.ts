/** SOQL pagination URLs only — blocks arbitrary REST GET via queryLocator. */

const SOQL_QUERY_LOCATOR_PATH = /^\/services\/data\/v\d+\.\d+\/query\/[A-Za-z0-9+/=_%-]+$/;

/** Strip instance host from a full nextRecordsUrl — sf api request rest wants a path. */
export function normalizeQueryLocator(locator: string): string {
  const trimmed = locator.trim();
  try {
    if (trimmed.startsWith('http')) return new URL(trimmed).pathname + new URL(trimmed).search;
  } catch {
    /* fall through */
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function assertSoqlQueryLocator(locator: string): string {
  const path = normalizeQueryLocator(locator);
  const pathOnly = path.split('?')[0] ?? path;
  if (!SOQL_QUERY_LOCATOR_PATH.test(pathOnly)) {
    throw new Error('queryLocator must be a SOQL pagination URL (/services/data/vXX.X/query/...).');
  }
  return path;
}
