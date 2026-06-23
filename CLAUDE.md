# CLAUDE.md — SalesforceATFX_mcp

Context for Claude Code on init. **No secrets here** — tokens, refresh tokens, and full
connector URLs live only in the VM `.env` and Salesforce. Never commit or log them.

**Version:** 0.2.0 · **Tests:** 94 (43 HTTP) · **Deploy commit:** check VM with
`git rev-parse --short HEAD` at `/opt/salesforce-atfx-mcp`.

---

## What this is

A **remote, read-only** Salesforce connector for the ATFX brokerage CRM org. Two surfaces
on one Node HTTP process:

| Surface | Consumers | Transport |
|---------|-----------|-----------|
| **MCP** | Claude web (remote custom connector) | Streamable HTTP at `/<token>/mcp` |
| **REST `/api`** | Dashboards, scripts, internal tools | JSON over HTTP at `/<token>/api/...` |

Both share the same auth token, Salesforce session (`sf` CLI), core query builders, and
SOQL guards. Read-only by design — no create/update/delete.

---

## Architecture (read before changing)

### Why `sf` CLI instead of OAuth

The org has **no admin access** and **cannot create a Connected App**. Claude web remote
connectors normally need their own Connected App OAuth — blocked.

**Workaround:** reuse the session the `sf` CLI already holds (`PlatformCLI` connected app).
The server shells out via `execFile('sf', [...])` — no shell, no injection. The CLI owns
and refreshes tokens; this process never stores Salesforce credentials.

**Trade-offs (intentional):**

- **Single service identity** — all users query as the CLI-authenticated user.
- **Not serverless** — needs persistent VM + `sf` CLI + keychain.
- **Token in URL** — `MCP_ACCESS_TOKEN` in path is a shared secret (like a password).
- **No rate limiting** — heavy SOQL can saturate the small VM.
- **Read-only ≠ least privilege** — token bearer can read everything the SF user can.

```
Client (Claude web / REST consumer)
    → HTTPS (Caddy TLS) → Node :8787 (index.ts)
    → tokenMatches (timing-safe) — MCP_ACCESS_TOKEN
    → MCP tools (server.ts)  OR  REST router (api/router.ts)
    → services/salesforce-data.ts → core/ (guards, builders)
    → salesforce.ts (execFile → sf CLI)
    → ATFX Salesforce org
```

### HTTP routing order (`src/index.ts`)

1. `OPTIONS *` → 204 + CORS headers
2. `GET /health` → public `{"status":"ok"}`
3. `/api` or `/<token>/api/*` → `handleApiRequest` (auth required)
4. `/mcp` or `/<token>/mcp` → MCP Streamable HTTP (auth required)
5. else → 404

---

## Connections

### Production host

| Item | Value |
|------|-------|
| Public hostname | `atfxmcp.westus2.cloudapp.azure.com` |
| HTTPS | Caddy → `localhost:8787` (Let's Encrypt) |
| VM path | `/opt/salesforce-atfx-mcp` |
| systemd unit | `salesforce-atfx-mcp` (user `ubuntu`) |
| SF org alias | `atfx` (`SF_TARGET_ORG`) |

### Claude web (MCP connector)

Configure a **remote MCP connector** in Claude web:

```
https://<host>/<MCP_ACCESS_TOKEN>/mcp
```

- Token is the shared secret — treat the full URL as a credential.
- Same token works as `Authorization: Bearer <token>` (preferred for server-side REST).
- MCP is **stateless** — `createServer()` per request, no shared sessions.

### REST API base URLs

Either form works (same auth):

```
https://<host>/<MCP_ACCESS_TOKEN>/api/...
https://<host>/api/...          # + Authorization: Bearer <token>
```

### SSH (ops)

```bash
ssh ubuntu@atfxmcp.westus2.cloudapp.azure.com
```

### Env vars (`.env.example`)

| Variable | Purpose |
|----------|---------|
| `MCP_ACCESS_TOKEN` | Shared secret (≥24 chars). Gates MCP + REST. |
| `SF_TARGET_ORG` | Salesforce CLI alias (default `atfx`) |
| `PORT` | HTTP listen port (default `8787`) |
| `SF_BIN` | Optional path to `sf` binary |
| `SF_FIXTURE_MODE=mock` | Local tests without live SF |
| `DESCRIBE_CACHE_TTL_MS` | Describe cache TTL (default 1h) |
| `SF_USE_GENERIC_UNIX_KEYCHAIN` | Required on VM for systemd (`true`) |

---

## Auth

Implemented in `src/api/auth.ts`:

- **Path prefix:** `/<token>/api/...` or `/<token>/mcp`
- **Bearer header:** `Authorization: Bearer <token>` (works for `/api/...` and `/mcp`)
- **Compare:** `timingSafeEqual`, fixed length
- **Failures:** REST → `401 {"error":"unauthorized"}`; MCP → 401 + `WWW-Authenticate: Bearer`

There is **no Salesforce OAuth** in this codebase.

---

## REST API

### Response contract

**Success (200):**

```json
{ "data": <payload>, "meta": { "soql"?: "...", "queryLocator"?: "...", "warnings"?: [], "truncated"?: true, "hints"?: [], ... } }
```

`meta` is omitted when empty. Dashboard routes add `period`, `days`, etc.

**Error (400 / 401 / 404 / 405 / 502):**

```json
{ "error": "bad_request" | "unauthorized" | "not_found" | "method_not_allowed" | "salesforce_error", "message": "..." }
```

Classification: `src/api/errors.ts` (`apiErrorStatus`, `sanitizeSalesforceMessage`).

### Route index

`GET /api` (or `GET /<token>/api`) returns the machine-readable index with all endpoints.
Dashboard entries include `"kind": "shortcut"`.

### Data routes (13 + index)

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/api` | index | API catalog |
| `GET` | `/api/org` | `routes/org.ts` | Connected org + user summary |
| `GET` | `/api/schema` | `routes/schema.ts` | Full curated dictionary (markdown) |
| `GET` | `/api/schema/:section` | `routes/schema.ts` | Section: `lead`, `account`, `contact` |
| `GET` | `/api/describe/:sobject` | `routes/describe.ts` | Field metadata (see query params) |
| `GET` | `/api/picklists/:object` | `routes/picklists.ts` | Picklist fields + values |
| `POST` | `/api/aggregate` | `routes/aggregate.ts` | Semantic GROUP BY / COUNT |
| `GET` | `/api/search` | `routes/search.ts` | Parameterized record search |
| `GET` | `/api/records/:object/:id` | `routes/records.ts` | Single record by Id |
| `POST` | `/api/query` | `routes/query.ts` | Raw SOQL or pagination |

### Dashboard shortcuts (`kind: "shortcut"`)

| Method | Path | Query params | Returns |
|--------|------|--------------|---------|
| `GET` | `/api/dashboard/leads/by-bdm` | `period` (default `THIS_MONTH`) | `Owner.Name`, `cnt` |
| `GET` | `/api/dashboard/leads/by-country` | `days` (default `30`, 1–365) | `Country_of_Residence_Lead__c`, `cnt` |
| `GET` | `/api/dashboard/leads/conversion-rate` | `days` (default `30`) | `{ total, converted, rate }`, `meta.soql` = 2 queries |

### REST parameters (detail)

**`GET /api/describe/:sobject`**

- `mode`: `curated` (default) | `picklists` | `full`
- `search`: filter field name/label
- `field`: exact API name

**`GET /api/search`**

- Required: `object` (`Lead` | `Account` | `Contact`)
- Optional: `email`, `name`, `status`, `country` (ISO-3), `ownerName`, `days`, `limit` (max 200)

**`GET /api/records/:object/:id`**

- Optional: `fields` — comma-separated (`Id,Name,Status`)

**`POST /api/aggregate`** (JSON body)

```json
{
  "object": "Lead",
  "groupBy": ["Status"],
  "metric": "count",
  "period": "THIS_MONTH",
  "days": 7,
  "filters": { "country": "MEX" },
  "orderBy": "desc",
  "limit": 100
}
```

**`POST /api/query`** (JSON body, max **1 MB**)

```json
{ "query": "SELECT Id, Name FROM Lead LIMIT 5" }
```

```json
{ "queryLocator": "/services/data/v67.0/query/<locator>" }
```

- Provide **`query` OR `queryLocator`**, never both.
- `maxRecords`: cap records in response (truncation; default 50).
- `meta.soql`: executed SELECT (after guards). `meta.queryLocator` echoed on pagination.

### REST error codes

| Status | When |
|--------|------|
| 401 | Missing/wrong token |
| 404 | Unknown `/api/...` path |
| 405 | Wrong HTTP method on known path |
| 400 | Validation, guards, bad JSON, body too large |
| 502 | Salesforce/CLI failure (message sanitized) |

### Example calls (replace `<TOKEN>`, never commit real token)

```bash
# Public health
curl -s https://atfxmcp.westus2.cloudapp.azure.com/health

# Org (Bearer)
curl -s -H "Authorization: Bearer <TOKEN>" \
  https://atfxmcp.westus2.cloudapp.azure.com/api/org

# Dashboard
curl -s -H "Authorization: Bearer <TOKEN>" \
  "https://atfxmcp.westus2.cloudapp.azure.com/api/dashboard/leads/by-bdm?period=THIS_MONTH"

# SOQL
curl -s -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"query":"SELECT Id, Name, Status FROM Lead LIMIT 3"}' \
  https://atfxmcp.westus2.cloudapp.azure.com/api/query
```

---

## MCP

### Tools (7)

| Tool | REST equivalent | Notes |
|------|-----------------|-------|
| `salesforce_atfx_get_org_info` | `GET /api/org` | Call first for context |
| `salesforce_atfx_describe_object` | `GET /api/describe/:sobject` | `mode`: curated \| picklists \| full |
| `salesforce_atfx_list_picklists` | `GET /api/picklists/:object` | Lead, Account, Contact |
| `salesforce_atfx_aggregate` | `POST /api/aggregate` | Prefer over raw SOQL for KPIs |
| `salesforce_atfx_search_records` | `GET /api/search` | LIKE-escaped filters |
| `salesforce_atfx_get_record` | `GET /api/records/:object/:id` | Id + fields validated |
| `salesforce_atfx_soql_query` | `POST /api/query` | Escape hatch; guarded SELECT |

Handlers: `src/tools/*`. Schemas co-located with handlers.

### MCP tool parameters (quick ref)

**`salesforce_atfx_describe_object`**

- `sobject` (required), `mode`, `search`, `field`

**`salesforce_atfx_list_picklists`**

- `object` (required): Lead | Account | Contact

**`salesforce_atfx_aggregate`**

- `object`, `groupBy[]` (required); `metric`, `period`, `days`, `filters`, `orderBy`, `limit`

**`salesforce_atfx_search_records`**

- `object` (required); `email`, `name`, `status`, `country`, `ownerName`, `days`, `limit`

**`salesforce_atfx_get_record`**

- `object`, `id` (required); `fields[]` optional

**`salesforce_atfx_soql_query`**

- `query` OR `queryLocator` (not both); `maxRecords`

### MCP response shape

Tools return MCP `CallToolResult` with JSON in `content[0].text`:

```json
{ "data": <payload>, "meta": { ... }, "hints": [ "..."] }
```

**Channel difference:** MCP puts `hints` at **top level**; REST puts them in **`meta.hints`**.

### Resources (4)

| URI | REST equivalent |
|-----|-----------------|
| `schema://atfx` | `GET /api/schema` |
| `schema://atfx/lead` | `GET /api/schema/lead` |
| `schema://atfx/account` | `GET /api/schema/account` |
| `schema://atfx/contact` | `GET /api/schema/contact` |

Curated markdown dictionary — `src/schema/resources.ts`. Bulky schema detail belongs here
and in resources, **not** in MCP `instructions` (`src/instructions.ts`).

### MCP ↔ REST parity

Verified in `tests/helpers/api-parity.ts` and `tests/api.http.test.ts`. When adding a
tool or route, update both and extend the parity matrix.

---

## Security guards

Shared layer — changes apply to MCP and REST automatically when routed through
`services/salesforce-data.ts` / core.

| Guard | Location | Rule |
|-------|----------|------|
| SELECT-only SOQL | `core/soql-guards.ts` | Rejects non-SELECT |
| Opportunity block | `soql-guards.ts` | Object does not exist in org |
| Account scope | `soql-guards.ts` | Non-aggregate Account queries need WHERE |
| Auto LIMIT | `soql-guards.ts` | Appends `LIMIT 200` if missing |
| Field names | `core/soql-fields.ts` | `assertSoqlFieldName` — no injection in builders |
| Record Id | `core/records.ts` | `assertSalesforceId` (15–18 chars) |
| get_record SOQL | `core/records.ts` | `buildGetRecordQuery` (MCP + REST) |
| queryLocator allowlist | `core/query-locator.ts` | Only `/services/data/vXX.X/query/...` |
| query + locator | `salesforce-data.ts` | Mutually exclusive |
| Body size | `api/http.ts` | 1 MB max (`MAX_BODY_BYTES`) |
| CLI execution | `salesforce.ts` | `execFile`, no shell |
| Auth | `api/auth.ts` | `timingSafeEqual` |

**Accepted risks:** SOQL raw hatch, `describe mode=full`, CORS `*`, no rate limit, shared
token. See security audit notes in session history.

---

## Code layout

```
src/
  index.ts              # HTTP entry: health, CORS, API router, MCP transport
  server.ts             # MCP Server: 7 tools + 4 resources
  salesforce.ts         # sf CLI: query, queryMore, describe, orgInfo
  instructions.ts       # Compact MCP initialize instructions
  schema/resources.ts   # schema://atfx resource content
  tools/                # MCP tool handlers + JSON schemas
  api/
    auth.ts             # Token extraction + timing-safe compare
    router.ts           # REST routing (401/404/405)
    http.ts             # CORS, readBody, sendJson
    errors.ts           # HTTP error classification
    response.ts         # sendApiResult / sendApiError envelope
    routes/             # REST handlers (mirror tools + dashboard)
  core/
    soql-guards.ts      # SELECT-only, LIMIT, Opportunity, Account
    soql-fields.ts      # Field name validation
    query-locator.ts    # Pagination URL allowlist
    records.ts          # get_record query builder
    queries/            # aggregate, search, leads (dashboard)
    describe/           # curated field filter
    objects.ts          # Lead, Account, Contact registry
    format/             # truncate, tool-result helpers
  services/
    salesforce-data.ts  # runSoql, fetchOrgSummary, fetchRawDescribe
    describe.ts         # describe cache + modes
tests/
  api.http.test.ts      # REST integration (mock SF)
  helpers/api-parity.ts # MCP↔REST matrix
  mcp-handlers.test.ts  # Tool handler tests
deploy/                 # systemd unit + Caddyfile
```

---

## Org facts (query building)

- Pipeline: **Lead → Account**. **No Opportunity** — never query it.
- **BDM** = record **Owner**; use `Owner.Name`, not `OwnerId`.
- Country fields (ISO-3 picklists): `Country_of_Residence_Lead__c`, `Country_of_Residence_Account__c`, `Country_of_Residence__c`.
- `Lead.Status`: Not Used Demo | Used Demo | Interested to Open Account | Pending Submitted Application | Live | Stage 6 - Dead. Conversion: `IsConverted`.
- Lead ~418 fields; Account ~55k+ records — scope queries; prefer `GROUP BY` / `COUNT()`.
- Date literals: `LAST_N_DAYS:N`, `THIS_MONTH`, `LAST_MONTH` on `CreatedDate`.

---

## Local dev

```bash
pnpm install
cp .env.example .env    # set MCP_ACCESS_TOKEN (≥24 chars)
pnpm dev                # tsx src/index.ts — needs sf CLI for live data
pnpm verify             # check + lint + format + test (94 tests)
pnpm build              # tsc → dist/
pnpm smoke:local        # MCP smoke with SF_FIXTURE_MODE=mock
pnpm predeploy          # verify + build + smoke:local
```

Mock tests set `SF_FIXTURE_MODE=mock` in `tests/setup.ts` — no live Salesforce needed for CI.

---

## Deployment (Azure VM)

```bash
cd /opt/salesforce-atfx-mcp
git pull && npm install && npm run build
sudo systemctl restart salesforce-atfx-mcp
curl -s localhost:8787/health   # → {"status":"ok"}
```

### VM ops

```bash
sudo systemctl status salesforce-atfx-mcp
journalctl -u salesforce-atfx-mcp -n 50 --no-pager
SF_USE_GENERIC_UNIX_KEYCHAIN=true sf org display --target-org atfx
```

### Re-auth Salesforce (session revoked)

From a workstation with authorized `sf` CLI — pipe `sfdxAuthUrl` over SSH; never commit
the URL. See historical deploy notes in git / session logs.

### Rotate MCP token

1. Generate: `openssl rand -hex 24`
2. Update `/opt/salesforce-atfx-mcp/.env` → `MCP_ACCESS_TOKEN`
3. `sudo systemctl restart salesforce-atfx-mcp`
4. Update Claude web connector URL and any REST consumers.

---

## Conventions & guardrails

- **Read-only** — do not add write tools without explicit security decision.
- **Parity** — new MCP tool ⇒ REST route + `api-parity.ts` + tests.
- **Shared core** — put validation in `core/`, not duplicated in handlers.
- **No secrets in repo** — `.env` git-ignored; never log URLs with token.
- **Instructions stay compact** — schema bulk in `schema://atfx` resources.
- **CORS `*`** — do not embed token in public frontends; use Bearer server-side.