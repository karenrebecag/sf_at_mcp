import type { VercelRequest, VercelResponse } from '@vercel/node';

function baseUrl(): string {
  return (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
}

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const base = baseUrl();
  res.status(200).json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
  });
}
