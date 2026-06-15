# Salesforce ATFX — MCP custom connector

Remote MCP server that lets **non-technical users in Claude web** query the ATFX
Salesforce org in **read-only** mode. Each user signs in with **their own
Salesforce account**; the connector runs every request under that user's
permissions and sharing rules. No CLI, no install on the user side.

## How auth works

The server is both an OAuth Authorization Server (to Claude) and an OAuth client
(to Salesforce). It is **stateless** — every credential is carried inside
encrypted JWE tokens, so there is no database.

```
Claude web ──/register──▶ server                      (Dynamic Client Registration)
Claude web ──/authorize─▶ server ──302──▶ Salesforce login
                                   user authorizes the Connected App
Salesforce ──/callback──▶ server  (exchanges SF code for a refresh token)
server ─────302─────────▶ Claude  (with our PKCE-bound auth code)
Claude web ──/token─────▶ server  (verifies PKCE, issues access/refresh JWE)
Claude web ──/mcp───────▶ server  (Bearer JWE → refresh SF token → REST call)
```

## Tools (read-only)

| Tool | Purpose |
|------|---------|
| `salesforce_atfx_get_org_info` | Authenticated user + connected org |
| `salesforce_atfx_describe_object` | sObject fields, types, relationships |
| `salesforce_atfx_soql_query` | Run a SOQL `SELECT` |

## One-time setup

### 1. Create a Connected App in the ATFX org

Setup → App Manager → New Connected App (or External Client App):

- **Enable OAuth Settings**: on
- **Callback URL**: `https://<your-deploy>.vercel.app/callback`
- **OAuth Scopes**: `Access and manage your data (api)`,
  `Perform requests on your behalf at any time (refresh_token, offline_access)`
- Save and copy the **Consumer Key** and **Consumer Secret**.

### 2. Configure environment variables

Copy `.env.example` and set these (locally and in Vercel → Project → Settings →
Environment Variables):

| Var | Value |
|-----|-------|
| `SF_CLIENT_ID` | Connected App Consumer Key |
| `SF_CLIENT_SECRET` | Connected App Consumer Secret |
| `SF_LOGIN_URL` | `https://login.salesforce.com` |
| `SF_API_VERSION` | `67.0` |
| `OAUTH_ENCRYPTION_SECRET` | `openssl rand -base64 48` |
| `PUBLIC_BASE_URL` | your deployment URL, no trailing slash |

### 3. Deploy

```bash
pnpm install
pnpm verify      # check + lint + format + test
vercel deploy    # then vercel deploy --prod
```

Make sure the Connected App callback URL and `PUBLIC_BASE_URL` match the final
production URL.

## Add the connector in Claude web

Settings → Connectors → **Add custom connector** → URL:

```
https://<your-deploy>.vercel.app/mcp
```

Claude will run the OAuth flow; the user logs into Salesforce and is ready.

## Local development

```bash
pnpm install
pnpm test        # vitest
pnpm check:api   # typecheck api/ + src/
```

## Notes

- Read-only by design: there are no create/update/delete tools. The SOQL tool
  rejects anything that is not a `SELECT`.
- Salesforce access tokens are never stored or returned in clear text — only the
  refresh token, encrypted inside the Bearer token, is held by the client.
