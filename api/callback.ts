import type { VercelRequest, VercelResponse } from '@vercel/node';
import { openTxState, sealAuthCode, isAllowedRedirectUri } from '../src/oauth.js';

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/**
 * Salesforce redirect target. We exchange the SF code for a refresh token, wrap
 * it (plus Claude's PKCE challenge) in our own authorization code, and bounce
 * the browser back to Claude's redirect_uri.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const sfCode = first(req.query.code);
  const txToken = first(req.query.state);

  if (!sfCode || !txToken) {
    res.status(400).send('Missing code or state from Salesforce.');
    return;
  }

  let tx;
  try {
    tx = await openTxState(txToken);
  } catch {
    res.status(400).send('Invalid or expired authorization state.');
    return;
  }

  // Defense in depth: rd was validated at /authorize and is integrity-protected
  // inside the sealed state, but re-check before we ever emit a redirect.
  if (!isAllowedRedirectUri(tx.rd)) {
    res.status(400).send('Invalid redirect target.');
    return;
  }

  try {
    const loginUrl = process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com';
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: sfCode,
      client_id: requireEnv('SF_CLIENT_ID'),
      client_secret: requireEnv('SF_CLIENT_SECRET'),
      redirect_uri: `${baseUrl()}/callback`,
    });

    const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => tokenRes.statusText);
      console.error('Salesforce token exchange failed:', tokenRes.status, text);
      res.status(502).send('Could not complete Salesforce sign-in. Please try again.');
      return;
    }

    const data = (await tokenRes.json()) as { refresh_token?: string; instance_url: string };
    if (!data.refresh_token) {
      res
        .status(502)
        .send(
          'Salesforce did not return a refresh token. Enable the "refresh_token" / offline_access scope on the Connected App.',
        );
      return;
    }

    const code = await sealAuthCode({
      srt: data.refresh_token,
      iu: data.instance_url,
      cc: tx.cc,
      ccm: tx.ccm,
    });

    const back = new URL(tx.rd);
    back.searchParams.set('code', code);
    if (tx.cs) back.searchParams.set('state', tx.cs);

    // The Location URL carries our authorization code — never let it be cached.
    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, back.toString());
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).send('Authentication failed. Please try again.');
  }
}
