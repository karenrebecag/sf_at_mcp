# Salesforce ATFX — MCP custom connector (Claude web)

Remote, **read-only** MCP server that lets users in **Claude web** query the ATFX
Salesforce org. It needs **no admin** and **no Connected App**: data access rides
the locally-authenticated **`sf` CLI**, so the server never holds a Salesforce
token. It runs as a small always-on process (e.g. a free Oracle Cloud VM) and is
exposed over HTTPS.

> All queries run as a single shared, CLI-authenticated user (a service identity).
> Everyone using the connector sees what that user can see. Read-only by design.

## How it works

```
Claude web ──HTTPS──▶ this server ──shells out──▶ sf CLI ──▶ Salesforce ATFX
                         (token in URL gate)        (owns the session / refresh)
```

- No Salesforce OAuth in this codebase. Auth is established once on the host with
  `sf org login device`; the CLI transparently refreshes the session afterwards.
- The connector is gated by a shared secret in the URL:
  `https://<host>/<MCP_ACCESS_TOKEN>/mcp`. Treat that URL like a password.

## Tools (read-only)

| Tool | Purpose |
|------|---------|
| `salesforce_atfx_get_org_info` | Connected user + org |
| `salesforce_atfx_describe_object` | sObject fields, types, relationships |
| `salesforce_atfx_soql_query` | Run a SOQL `SELECT` |

The SOQL tool rejects anything that is not a `SELECT`.

## Deploy on a free Oracle Cloud "Always Free" VM

### 1. Create the VM
Oracle Cloud → create an **Always Free** VM (Ubuntu 22.04, ARM `VM.Standard.A1`
or AMD micro). Open inbound **TCP 80 and 443** in the VCN security list. SSH in.

### 2. Install Node + the Salesforce CLI
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g @salesforce/cli
sf --version
```

### 3. Deploy this app
```bash
sudo git clone https://github.com/karenrebecag/sf_at_mcp.git /opt/salesforce-atfx-mcp
sudo chown -R ubuntu:ubuntu /opt/salesforce-atfx-mcp
cd /opt/salesforce-atfx-mcp
npm install        # or: corepack pnpm install
npm run build
cp .env.example .env
# edit .env: set MCP_ACCESS_TOKEN (openssl rand -hex 24), SF_TARGET_ORG=atfx
```

### 4. Authenticate Salesforce (once, no admin needed)
```bash
sf org login device --alias atfx --instance-url https://login.salesforce.com
```
It prints a code + URL. Open the URL **in your laptop browser**, log in with the
ATFX user, enter the code. The VM is now authenticated. Verify:
```bash
sf org display --target-org atfx
```

### 5. Run as a service
```bash
sudo cp deploy/salesforce-atfx-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now salesforce-atfx-mcp
curl localhost:8787/health      # -> {"status":"ok"}
```

### 6. Expose over HTTPS (free + stable)

**Option A — Caddy + DuckDNS (recommended, $0, stable URL):**
Get a free subdomain at duckdns.org pointed at the VM's public IP, then:
```bash
sudo apt-get install -y caddy
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit the hostname first
sudo systemctl restart caddy
```
Caddy auto-issues a Let's Encrypt cert. Your base URL is
`https://<name>.duckdns.org`.

**Option B — Cloudflare Tunnel** (no open ports; needs a Cloudflare account, and a
stable hostname requires a domain on Cloudflare):
```bash
cloudflared tunnel --url http://localhost:8787
```

### 7. Add the connector in Claude web
Settings → Connectors → **Add custom connector** → URL:
```
https://<your-host>/<MCP_ACCESS_TOKEN>/mcp
```

## Local development
```bash
pnpm install
pnpm test          # vitest (tool guards; no live org needed)
pnpm check         # typecheck
pnpm dev           # runs the server with tsx
```

## Operational notes
- The VM must stay on. If `sf`'s session is ever revoked (password change, admin
  action) or expires, re-run `sf org login device`.
- Rotate access: change `MCP_ACCESS_TOKEN` in `.env` and restart the service; the
  old connector URL stops working.
- Read-only by design — there are no write tools.
