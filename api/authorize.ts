import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sealTxState, isAllowedRedirectUri } from '../src/oauth.js';

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Authorization endpoint. We don't authenticate the user ourselves — we park
 * Claude's PKCE/redirect params in an encrypted `state` and bounce the browser
 * to Salesforce's login. Salesforce returns to /callback.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redirectUri = first(req.query.redirect_uri);
  const codeChallenge = first(req.query.code_challenge);
  const codeChallengeMethod = first(req.query.code_challenge_method) ?? 'S256';
  const clientState = first(req.query.state);
  const responseType = first(req.query.response_type);

  if (responseType !== 'code') {
    res.status(400).json({ error: 'unsupported_response_type' });
    return;
  }
  if (!redirectUri || !codeChallenge) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'redirect_uri and code_challenge are required',
    });
    return;
  }
  // Reject before starting the flow — never redirect to an unregistered URI.
  if (!isAllowedRedirectUri(redirectUri)) {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'redirect_uri is not allowed',
    });
    return;
  }
  if (codeChallengeMethod !== 'S256') {
    res
      .status(400)
      .json({ error: 'invalid_request', error_description: 'only S256 PKCE is supported' });
    return;
  }

  const tx = await sealTxState({
    rd: redirectUri,
    cc: codeChallenge,
    ccm: codeChallengeMethod,
    cs: clientState,
  });

  const loginUrl = process.env.SF_LOGIN_URL ?? 'https://login.salesforce.com';
  const sfClientId = process.env.SF_CLIENT_ID;
  if (!sfClientId) {
    res
      .status(500)
      .json({ error: 'server_error', error_description: 'SF_CLIENT_ID not configured' });
    return;
  }

  const authUrl = new URL(`${loginUrl}/services/oauth2/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', sfClientId);
  authUrl.searchParams.set('redirect_uri', `${baseUrl()}/callback`);
  authUrl.searchParams.set('scope', 'api refresh_token offline_access');
  authUrl.searchParams.set('state', tx);

  res.redirect(302, authUrl.toString());
}
