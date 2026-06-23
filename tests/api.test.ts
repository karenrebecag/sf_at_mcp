import { describe, expect, it } from 'vitest';
import { normalizeApiPath, presentedToken, tokenMatches } from '../src/api/auth.js';
import { mockReq, TEST_ACCESS_TOKEN } from './helpers/api-server.js';

describe('api auth paths', () => {
  it('normalizes token-prefixed api paths', () => {
    expect(normalizeApiPath('/secret-token/api/org')).toBe('/api/org');
    expect(normalizeApiPath('/secret-token/api/dashboard/leads/by-bdm')).toBe(
      '/api/dashboard/leads/by-bdm',
    );
  });

  it('accepts bare /api paths', () => {
    expect(normalizeApiPath('/api/query')).toBe('/api/query');
    expect(normalizeApiPath('/api')).toBe('/api');
  });

  it('rejects non-api paths', () => {
    expect(normalizeApiPath('/health')).toBeNull();
    expect(normalizeApiPath('/secret/mcp')).toBeNull();
  });
});

describe('api token auth', () => {
  it('matches the configured access token', () => {
    expect(tokenMatches(TEST_ACCESS_TOKEN)).toBe(true);
  });

  it('rejects missing or wrong tokens', () => {
    expect(tokenMatches(undefined)).toBe(false);
    expect(tokenMatches('wrong-token-0123456789012345')).toBe(false);
    expect(tokenMatches(`${TEST_ACCESS_TOKEN}x`)).toBe(false);
  });

  it('extracts token from path prefix', () => {
    expect(presentedToken(mockReq(), '/my-token/api/org')).toBe('my-token');
    expect(presentedToken(mockReq(), '/my-token/api')).toBe('my-token');
  });

  it('extracts token from Authorization Bearer header', () => {
    const req = mockReq({ authorization: 'Bearer header-token-value' });
    expect(presentedToken(req, '/api/org')).toBe('header-token-value');
  });

  it('prefers path prefix over Bearer header', () => {
    const req = mockReq({ authorization: 'Bearer header-token' });
    expect(presentedToken(req, '/path-token/api/org')).toBe('path-token');
  });

  it('returns undefined when no credentials are present', () => {
    expect(presentedToken(mockReq(), '/api/org')).toBeUndefined();
  });
});
