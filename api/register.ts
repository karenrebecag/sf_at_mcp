import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Dynamic Client Registration (RFC 7591).
 *
 * The server is stateless and relies on PKCE + the redirect_uri echoed back to
 * Claude, so we accept any registration and return a fresh client_id without
 * persisting it. Public client: no secret, auth method "none".
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = (req.body ?? {}) as { redirect_uris?: unknown };
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  res.status(201).json({
    client_id: randomUUID(),
    redirect_uris: redirectUris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  });
}
