import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  openAuthCode,
  openSessionToken,
  sealAccessToken,
  sealRefreshToken,
  verifyPkce,
  ACCESS_TTL_SECONDS,
} from '../src/oauth.js';

function field(body: Record<string, unknown>, name: string): string | undefined {
  const v = body[name];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Token endpoint. Handles the two grants we advertise:
 *  - authorization_code: verify PKCE, then mint access/refresh JWEs.
 *  - refresh_token: re-mint from the SF refresh token carried in the JWE.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // OAuth 2.0 §5.1: token responses must not be cached.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const grantType = field(body, 'grant_type');

  try {
    if (grantType === 'authorization_code') {
      const code = field(body, 'code');
      const verifier = field(body, 'code_verifier');
      if (!code || !verifier) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'code and code_verifier are required',
        });
        return;
      }

      const authCode = await openAuthCode(code);
      if (!verifyPkce(authCode.cc, verifier, authCode.ccm)) {
        res
          .status(400)
          .json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
        return;
      }

      const payload = { srt: authCode.srt, iu: authCode.iu };
      res.status(200).json({
        access_token: await sealAccessToken(payload),
        refresh_token: await sealRefreshToken(payload),
        token_type: 'Bearer',
        expires_in: ACCESS_TTL_SECONDS,
      });
      return;
    }

    if (grantType === 'refresh_token') {
      const refreshToken = field(body, 'refresh_token');
      if (!refreshToken) {
        res
          .status(400)
          .json({ error: 'invalid_request', error_description: 'refresh_token is required' });
        return;
      }

      const session = await openSessionToken(refreshToken);
      const payload = { srt: session.srt, iu: session.iu };
      res.status(200).json({
        access_token: await sealAccessToken(payload),
        refresh_token: await sealRefreshToken(payload),
        token_type: 'Bearer',
        expires_in: ACCESS_TTL_SECONDS,
      });
      return;
    }

    res.status(400).json({ error: 'unsupported_grant_type' });
  } catch {
    res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired token' });
  }
}
