import type { VercelRequest, VercelResponse } from '@vercel/node';

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const base = baseUrl();
  res.status(200).json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['salesforce'],
  });
}
