/**
 * Stateless OAuth primitives.
 *
 * This server is an Authorization Server to Claude web and an OAuth client to
 * Salesforce at the same time. We carry every piece of state inside encrypted
 * JWTs (JWE, dir + A256GCM) so no database is needed:
 *
 *  - transaction state  -> carried to Salesforce as `state` and back to /callback
 *  - authorization code -> the `code` we hand to Claude (wraps the SF refresh token)
 *  - access / refresh    -> the Bearer tokens Claude stores and replays on /mcp
 *
 * The symmetric key is derived from OAUTH_ENCRYPTION_SECRET so a single env var
 * configures the whole flow.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { EncryptJWT, jwtDecrypt, type JWTPayload } from 'jose';

const ENC = 'A256GCM';
const ALG = 'dir';
const MIN_SECRET_LENGTH = 32;

function key(): Uint8Array {
  const secret = process.env.OAUTH_ENCRYPTION_SECRET;
  if (!secret) throw new Error('Missing required env var: OAUTH_ENCRYPTION_SECRET');
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `OAUTH_ENCRYPTION_SECRET must be at least ${MIN_SECRET_LENGTH} chars (use: openssl rand -base64 48)`,
    );
  }
  // A256GCM needs exactly 32 bytes; derive deterministically from the secret.
  return new Uint8Array(createHash('sha256').update(secret).digest());
}

async function seal(payload: JWTPayload, expiration: string | number): Promise<string> {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: ALG, enc: ENC })
    .setIssuedAt()
    .setExpirationTime(expiration)
    .encrypt(key());
}

async function open<T extends JWTPayload>(token: string): Promise<T> {
  const { payload } = await jwtDecrypt(token, key());
  return payload as T;
}

/** Claude's OAuth request params, parked while the user logs into Salesforce. */
export interface TxState extends JWTPayload {
  rd: string; // Claude redirect_uri
  cc: string; // code_challenge
  ccm: string; // code_challenge_method (S256)
  cs?: string; // Claude's opaque state
}

export const sealTxState = (s: Omit<TxState, keyof JWTPayload>) => seal(s, '10m');
export const openTxState = (t: string) => open<TxState>(t);

/** Our authorization code returned to Claude. Wraps the SF refresh token. */
export interface AuthCode extends JWTPayload {
  srt: string; // Salesforce refresh_token
  iu: string; // Salesforce instance_url
  cc: string; // code_challenge to verify against the verifier at /token
  ccm: string;
}

// Short-lived: the callback->token exchange is immediate, so a tight window
// limits replay (we are stateless and cannot mark a code as consumed).
export const sealAuthCode = (c: Omit<AuthCode, keyof JWTPayload>) => seal(c, '2m');
export const openAuthCode = (t: string) => open<AuthCode>(t);

/** Bearer token Claude replays on every /mcp call. */
export interface SessionToken extends JWTPayload {
  srt: string; // Salesforce refresh_token
  iu: string; // Salesforce instance_url
  typ: 'access' | 'refresh';
}

export const ACCESS_TTL_SECONDS = 2 * 60 * 60;
export const sealAccessToken = (s: { srt: string; iu: string }) =>
  seal({ ...s, typ: 'access' }, '2h');
export const sealRefreshToken = (s: { srt: string; iu: string }) =>
  seal({ ...s, typ: 'refresh' }, '90d');
export const openSessionToken = (t: string) => open<SessionToken>(t);

/** PKCE S256 verification (the only method we advertise). */
export function verifyPkce(challenge: string, verifier: string, method = 'S256'): boolean {
  if (method !== 'S256') return false;
  const hash = createHash('sha256').update(verifier).digest('base64url');
  const a = Buffer.from(hash);
  const b = Buffer.from(challenge);
  // Length-check first: timingSafeEqual throws on unequal lengths.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Exact-match allowlist for the client redirect_uri. Without this, an attacker
 * could drive the flow with their own redirect_uri and exfiltrate the victim's
 * Salesforce refresh token (OAuth's core open-redirect / token-theft threat).
 *
 * Configure via ALLOWED_REDIRECT_URIS (comma-separated). Defaults cover Claude
 * web's custom-connector callbacks.
 */
const DEFAULT_REDIRECT_URIS = [
  'https://claude.ai/api/mcp/auth_callback',
  'https://claude.com/api/mcp/auth_callback',
];

export function allowedRedirectUris(): string[] {
  const env = process.env.ALLOWED_REDIRECT_URIS;
  if (!env) return DEFAULT_REDIRECT_URIS;
  return env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return allowedRedirectUris().includes(uri);
}
