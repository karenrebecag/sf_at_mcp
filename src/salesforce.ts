/**
 * Minimal read-only Salesforce REST client built on fetch.
 *
 * The MCP layer never holds a long-lived Salesforce access token: it stores the
 * refresh token (inside the encrypted Bearer it hands Claude) and mints a fresh
 * access token per session via `refreshAccessToken`.
 */
const API_VERSION = process.env.SF_API_VERSION ?? '67.0';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export interface SalesforceSession {
  accessToken: string;
  instanceUrl: string;
}

/** Exchange a refresh token for a fresh access token + instance URL. */
export async function refreshAccessToken(refreshToken: string): Promise<SalesforceSession> {
  const loginUrl = process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com';
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: requireEnv('SF_CLIENT_ID'),
    client_secret: requireEnv('SF_CLIENT_SECRET'),
    refresh_token: refreshToken,
  });

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Salesforce token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; instance_url: string };
  return { accessToken: data.access_token, instanceUrl: data.instance_url };
}

async function sfGet(session: SalesforceSession, path: string): Promise<unknown> {
  const res = await fetch(`${session.instanceUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Salesforce request failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Run a read-only SOQL query. */
export function query(session: SalesforceSession, soql: string): Promise<unknown> {
  return sfGet(session, `/services/data/v${API_VERSION}/query?q=${encodeURIComponent(soql)}`);
}

/** Describe an sObject's metadata (fields, types, relationships). */
export function describe(session: SalesforceSession, sobject: string): Promise<unknown> {
  const safe = encodeURIComponent(sobject);
  return sfGet(session, `/services/data/v${API_VERSION}/sobjects/${safe}/describe`);
}

/** Current user / org identity. */
export function userInfo(session: SalesforceSession): Promise<unknown> {
  return sfGet(session, `/services/oauth2/userinfo`);
}
