# CLAUDE.md — SalesforceATFX_mcp

Context and operating instructions for this repository. No secrets live here:
tokens, refresh tokens and the full connector URL are intentionally omitted (they
live only in the VM's `.env` and in Salesforce). Never commit those.

## What this is

A **remote, read-only MCP server** that lets non-technical users in **Claude web**
query the ATFX Salesforce org (a brokerage CRM). It exposes three tools and a
schema resource. It is deployed as an always-on process on a small cloud VM.

Tools: `salesforce_atfx_get_org_info`, `salesforce_atfx_describe_object`,
`salesforce_atfx_soql_query`. Resource: `schema://atfx` (curated data dictionary).

## Why the architecture is unusual (read before changing it)

The org is a large enterprise where we have **no Salesforce admin access and
cannot create a Connected App** (requires `Manage Connected Apps`, which the
available user lacks). A normal Claude-web remote connector would need its own
Connected App for OAuth — blocked.

Workaround: instead of minting new credentials, the server **reuses the session
the `sf` CLI already holds** (authorized against Salesforce's pre-installed
`PlatformCLI` connected app). Authorizing an existing connected app only needs a
normal API-enabled user; creating one needs admin. So:

- The server **shells out to the `sf` CLI** (`src/salesforce.ts`) for all data.
  It never holds or stores a Salesforce token; the CLI owns and refreshes the
  session.
- This is a **single shared service identity** (everyone queries as the
  CLI-authenticated user) and **read-only** — a deliberate trade-off, not an
  oversight. Per-user OAuth is impossible without the Connected App.
- This rides the supported CLI OAuth refresh flow (not the username/password flow
  that Salesforce restricts from June 2026).

Because the server must run the `sf` CLI, it **cannot be serverless** (Vercel /
Cloudflare Workers can't run the CLI or keep a session). It runs on a persistent
VM.

## Code layout

- `src/index.ts` — long-running Node HTTP server. Routes `/<token>/mcp` and
  `/health`. Gates every request on a shared secret carried in the URL path
  (constant-time compare) and creates a stateless MCP transport per request.
- `src/server.ts` — builds the MCP `Server`: tool list/dispatch + the
  `schema://atfx` resource.
- `src/salesforce.ts` — `query` / `describe` / `orgInfo` via `execFile('sf', …,
  '--json')` (no shell → no injection). Org alias from `SF_TARGET_ORG`.
- `src/tools/*` — the three tool handlers (SOQL has a SELECT-only guard).
- `src/schema.ts` — the curated data dictionary served as the resource.
- `src/instructions.ts` — server instructions sent on `initialize` (key schema
  facts + pointer to the resource).
- `deploy/` — `salesforce-atfx-mcp.service` (systemd) and `Caddyfile` (HTTPS).

## Auth gate (how the connector is protected)

There is **no Salesforce OAuth in this codebase**. The connector URL is
`https://<host>/<MCP_ACCESS_TOKEN>/mcp`; the token is a shared secret. Anyone with
that URL can query as the service identity, so the URL is a credential — never
log, commit, or paste it. Rotate by changing `MCP_ACCESS_TOKEN` in the VM `.env`
and restarting the service.

## Deployment (Azure VM)

- **Host:** Azure "for Students" VM (B1s, 1 GB RAM + a 2 GB swapfile — the swap is
  required; 0.5 GB B1ls was too small and froze). Region West US 2. Ubuntu 24.04.
- **Public hostname (stable):** `atfxmcp.westus2.cloudapp.azure.com` (Azure DNS
  name label on the static public IP). The exact IP is in the Azure portal.
- **App path on VM:** `/opt/salesforce-atfx-mcp` (this repo, cloned + `npm
  install` + `npm run build`).
- **Service:** systemd unit `salesforce-atfx-mcp` runs `node dist/index.js` as
  user `ubuntu`, reading `/opt/salesforce-atfx-mcp/.env`.
- **HTTPS:** Caddy (`/etc/caddy/Caddyfile`) reverse-proxies the hostname to
  `localhost:8787` with an auto-renewing Let's Encrypt cert. Ports 80/443/22 open
  in the Azure NSG.
- **Salesforce auth on the VM:** the `sf` CLI is authorized once as alias `atfx`
  with `SF_USE_GENERIC_UNIX_KEYCHAIN=true` (file-based key so systemd, which has
  no desktop keyring, can decrypt). Auth was transferred from a workstation via
  `sf org auth show-sfdx-auth-url` piped into `sf org login sfdx-url --sfdx-url-stdin`.

### Connecting to the server (ops)

SSH (key-based; the operator's key is in the VM's authorized_keys):

```bash
ssh ubuntu@atfxmcp.westus2.cloudapp.azure.com
```

Common operations on the VM:

```bash
# health
curl -s localhost:8787/health                      # -> {"status":"ok"}
# service control
sudo systemctl status  salesforce-atfx-mcp
sudo systemctl restart salesforce-atfx-mcp
journalctl -u salesforce-atfx-mcp -n 50 --no-pager
# Salesforce session
SF_USE_GENERIC_UNIX_KEYCHAIN=true sf org display --target-org atfx
```

### Redeploy after code changes

```bash
cd /opt/salesforce-atfx-mcp
git pull
npm install
npm run build
sudo systemctl restart salesforce-atfx-mcp
```

### Re-authenticate Salesforce (if the session is revoked/expires)

The CLI session can die on a password change or admin revocation. Re-transfer
from a machine that has an authorized `sf` CLI:

```bash
# on the authorized workstation, piped over SSH (token never hits disk/chat):
sf org auth show-sfdx-auth-url --target-org atfx --json \
  | <extract result.sfdxAuthUrl> \
  | ssh ubuntu@atfxmcp.westus2.cloudapp.azure.com \
      'umask 077; cat > /tmp/au.txt && SF_USE_GENERIC_UNIX_KEYCHAIN=true sf org login sfdx-url -f /tmp/au.txt --alias atfx; shred -u /tmp/au.txt'
```

## Org facts (for query building)

- Pipeline is **Lead → Account**. **No Opportunity object exists** — never query it.
- "BDM" = record **Owner**; group/filter by `Owner.Name`, not `OwnerId`.
- Country fields are **ISO-3 picklists**, per object: `Country_of_Residence_Lead__c`,
  `Country_of_Residence_Account__c`, `Country_of_Residence__c` (Contact).
- `Lead.Status` = Not Used Demo | Used Demo | Interested to Open Account | Pending
  Submitted Application | Live | Stage 6 - Dead. Conversion via `IsConverted`.
- Lead has ~418 fields; Account ~55k+ records. Scope queries; prefer GROUP BY /
  COUNT(); watch bulk-load spikes that distort growth metrics. Full detail per
  object via `salesforce_atfx_describe_object`; curated map in `schema://atfx`.

## Local dev

```bash
pnpm install
pnpm dev        # tsx src/index.ts (needs MCP_ACCESS_TOKEN set; sf CLI for live data)
pnpm verify     # check + lint + format:check + test
pnpm build      # tsc -> dist/
```

`pnpm verify` does not build; rebuild before smoke-testing `dist/`.

## Conventions & guardrails

- Read-only by design: do not add create/update/delete tools without an explicit
  decision — it changes the security posture.
- Keep `instructions` compact (sent every session). Put bulky schema detail in the
  `schema://atfx` resource, not in instructions.
- No secrets in the repo. `.env` is git-ignored; `.env.example` documents the vars.
