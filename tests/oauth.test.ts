import { beforeAll, describe, expect, it } from 'vitest';

beforeAll(() => {
  process.env.OAUTH_ENCRYPTION_SECRET = 'test-secret-test-secret-test-secret-1234';
});

describe('oauth primitives', () => {
  it('round-trips a transaction state', async () => {
    const { sealTxState, openTxState } = await import('../src/oauth.js');
    const token = await sealTxState({
      rd: 'https://claude.ai/cb',
      cc: 'chal',
      ccm: 'S256',
      cs: 'xyz',
    });
    const out = await openTxState(token);
    expect(out.rd).toBe('https://claude.ai/cb');
    expect(out.cc).toBe('chal');
    expect(out.cs).toBe('xyz');
  });

  it('round-trips an auth code carrying the SF refresh token', async () => {
    const { sealAuthCode, openAuthCode } = await import('../src/oauth.js');
    const token = await sealAuthCode({
      srt: 'refresh-123',
      iu: 'https://x.my.salesforce.com',
      cc: 'c',
      ccm: 'S256',
    });
    const out = await openAuthCode(token);
    expect(out.srt).toBe('refresh-123');
    expect(out.iu).toBe('https://x.my.salesforce.com');
  });

  it('round-trips a session token', async () => {
    const { sealAccessToken, openSessionToken } = await import('../src/oauth.js');
    const token = await sealAccessToken({ srt: 'r', iu: 'https://x.my.salesforce.com' });
    const out = await openSessionToken(token);
    expect(out.typ).toBe('access');
    expect(out.srt).toBe('r');
  });

  it('rejects a tampered token', async () => {
    const { sealAccessToken, openSessionToken } = await import('../src/oauth.js');
    const token = await sealAccessToken({ srt: 'r', iu: 'i' });
    await expect(openSessionToken(token + 'x')).rejects.toThrow();
  });

  it('verifies PKCE S256 correctly', async () => {
    const { verifyPkce } = await import('../src/oauth.js');
    const { createHash } = await import('node:crypto');
    const verifier = 'a-random-verifier-string-1234567890';
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    expect(verifyPkce(challenge, verifier, 'S256')).toBe(true);
    expect(verifyPkce(challenge, 'wrong', 'S256')).toBe(false);
    expect(verifyPkce(challenge, verifier, 'plain')).toBe(false);
    expect(verifyPkce('short', verifier, 'S256')).toBe(false);
  });
});

describe('redirect_uri allowlist', () => {
  it('accepts the default Claude callbacks', async () => {
    const { isAllowedRedirectUri } = await import('../src/oauth.js');
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(true);
  });

  it('rejects an unregistered host (token-theft guard)', async () => {
    const { isAllowedRedirectUri } = await import('../src/oauth.js');
    expect(isAllowedRedirectUri('https://attacker.com/cb')).toBe(false);
  });

  it('rejects non-https and malformed URIs', async () => {
    const { isAllowedRedirectUri } = await import('../src/oauth.js');
    expect(isAllowedRedirectUri('http://claude.ai/api/mcp/auth_callback')).toBe(false);
    expect(isAllowedRedirectUri('not-a-url')).toBe(false);
  });

  it('honors ALLOWED_REDIRECT_URIS override', async () => {
    process.env.ALLOWED_REDIRECT_URIS = 'https://example.com/cb, https://foo.test/cb';
    const { isAllowedRedirectUri } = await import('../src/oauth.js');
    expect(isAllowedRedirectUri('https://example.com/cb')).toBe(true);
    expect(isAllowedRedirectUri('https://foo.test/cb')).toBe(true);
    expect(isAllowedRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe(false);
    delete process.env.ALLOWED_REDIRECT_URIS;
  });
});
