import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  apiRequest,
  startApiServer,
  TEST_ACCESS_TOKEN,
  type ApiServer,
} from './helpers/api-server.js';
import { MCP_REST_PARITY } from './helpers/api-parity.js';

describe('REST API (HTTP)', () => {
  let server: ApiServer;

  beforeAll(async () => {
    server = await startApiServer();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('auth', () => {
    it('returns 401 without credentials on bare /api', async () => {
      const r = await apiRequest(server.baseUrl, '/api/org', { token: null, bearer: true });
      expect(r.status).toBe(401);
      expect(r.body).toEqual({ error: 'unauthorized' });
    });

    it('returns 401 with wrong token in path prefix', async () => {
      const r = await apiRequest(server.baseUrl, '/api/org', {
        token: 'wrong-token-0123456789012345',
      });
      expect(r.status).toBe(401);
    });

    it('accepts path-prefix token', async () => {
      const r = await apiRequest(server.baseUrl, '/api/org');
      expect(r.status).toBe(200);
    });

    it('accepts Authorization Bearer on bare /api', async () => {
      const r = await apiRequest(server.baseUrl, '/api/org', { bearer: true });
      expect(r.status).toBe(200);
    });
  });

  describe('routing', () => {
    it('returns 404 for unknown API routes', async () => {
      const r = await apiRequest(server.baseUrl, '/api/unknown-endpoint');
      expect(r.status).toBe(404);
      expect(r.body).toMatchObject({ error: 'not_found', path: '/api/unknown-endpoint' });
    });

    it('lists endpoints at GET /api without duplicates', async () => {
      const r = await apiRequest(server.baseUrl, '/api');
      expect(r.status).toBe(200);
      const body = r.body as {
        name: string;
        version: string;
        endpoints: { path: string; kind?: string }[];
      };
      expect(body.name).toBe('salesforce-atfx-api');
      expect(body.version).toBe('0.2.0');
      expect(body.endpoints.some((e) => e.path === '/api/org')).toBe(true);
      const dashboard = body.endpoints.filter((e) => e.path.startsWith('/api/dashboard/'));
      expect(dashboard).toHaveLength(3);
      expect(dashboard.every((e) => e.kind === 'shortcut')).toBe(true);
      const paths = body.endpoints.map((e) => e.path);
      expect(paths.length).toBe(new Set(paths).size);
    });

    it('responds to OPTIONS with CORS headers', async () => {
      const res = await fetch(`${server.baseUrl}/api/org`, { method: 'OPTIONS' });
      expect(res.status).toBe(204);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    });

    it('MCP↔REST parity: every implemented tool has a registered route', async () => {
      const r = await apiRequest(server.baseUrl, '/api');
      const body = r.body as { endpoints: { method: string; path: string }[] };
      const missing = MCP_REST_PARITY.filter((entry) => entry.status === 'implemented').filter(
        (entry) =>
          !body.endpoints.some((e) => e.method === entry.restMethod && e.path === entry.restPath),
      );
      expect(missing, `Missing routes: ${JSON.stringify(missing)}`).toEqual([]);
    });
  });

  describe('GET /api/org', () => {
    it('returns org summary from fixtures', async () => {
      const r = await apiRequest(server.baseUrl, '/api/org');
      expect(r.status).toBe(200);
      const data = (r.body as { data: { username: string } }).data;
      expect(data.username).toBe('fixture@atfx.test');
    });
  });

  describe('GET /api/schema', () => {
    it('returns markdown schema resource', async () => {
      const r = await apiRequest(server.baseUrl, '/api/schema');
      expect(r.status).toBe(200);
      const data = (r.body as { data: { format: string; content: string } }).data;
      expect(data.format).toBe('markdown');
      expect(data.content).toContain('Lead');
    });

    it('returns per-object schema section', async () => {
      const r = await apiRequest(server.baseUrl, '/api/schema/lead');
      expect(r.status).toBe(200);
      const data = (r.body as { data: { uri: string; content: string } }).data;
      expect(data.uri).toBe('schema://atfx/lead');
      expect(data.content).toContain('Lead');
    });

    it('returns 404 for unknown schema section', async () => {
      const r = await apiRequest(server.baseUrl, '/api/schema/opportunity');
      expect(r.status).toBe(404);
    });
  });

  describe('GET /api/describe/:sobject', () => {
    it('returns curated Lead fields', async () => {
      const r = await apiRequest(server.baseUrl, '/api/describe/Lead');
      expect(r.status).toBe(200);
      const fields = (r.body as { data: { fields: { name: string }[] } }).data.fields;
      expect(fields.some((f) => f.name === 'Status')).toBe(true);
    });

    it('supports picklists mode via query param', async () => {
      const r = await apiRequest(server.baseUrl, '/api/describe/Lead?mode=picklists&field=Status');
      expect(r.status).toBe(200);
      const fields = (r.body as { data: { fields: { picklistValues: { value: string }[] }[] } })
        .data.fields;
      expect(fields[0]?.picklistValues?.[0]?.value).toBe('Not Used Demo');
    });
  });

  describe('POST /api/query', () => {
    it('returns 400 for invalid JSON body', async () => {
      const token = TEST_ACCESS_TOKEN;
      const res = await fetch(`${server.baseUrl}/${encodeURIComponent(token)}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not-json',
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toMatchObject({ error: 'bad_request', message: 'Invalid JSON body' });
    });

    it('returns 400 when query is missing', async () => {
      const r = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        json: {},
      });
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ error: 'bad_request' });
    });

    it('returns 400 for non-SELECT SOQL', async () => {
      const r = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        json: { query: 'DELETE FROM Lead' },
      });
      expect(r.status).toBe(400);
      expect((r.body as { message: string }).message).toMatch(/read-only/i);
    });

    it('runs SELECT and returns fixture data with soql in meta', async () => {
      const r = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        json: { query: 'SELECT Id, Name FROM Lead LIMIT 5' },
      });
      expect(r.status).toBe(200);
      const body = r.body as {
        data: { records: unknown[] };
        meta?: { soql?: string; truncated?: boolean };
      };
      expect(body.data.records.length).toBeGreaterThan(0);
      expect(body.meta?.soql).toContain('SELECT Id, Name FROM Lead');
    });

    it('paginates via queryLocator', async () => {
      const page1 = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        json: { query: 'SELECT Id, Name FROM Lead' },
      });
      const locator = (page1.body as { data: { nextRecordsUrl: string } }).data.nextRecordsUrl;
      const page2 = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        json: { queryLocator: locator },
      });
      expect(page2.status).toBe(200);
      const records = (page2.body as { data: { records: { Name: string }[] } }).data.records;
      expect(records[0]?.Name).toBe('Paged Lead');
    });

    it('rejects query and queryLocator together', async () => {
      const r = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        json: {
          query: 'SELECT Id FROM Lead',
          queryLocator: '/services/data/v67.0/query/fixture-locator',
        },
      });
      expect(r.status).toBe(400);
      expect((r.body as { message: string }).message).toMatch(/not both/i);
    });

    it('rejects arbitrary REST queryLocator paths', async () => {
      const r = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        json: { queryLocator: '/services/data/v67.0/limits' },
      });
      expect(r.status).toBe(400);
      expect((r.body as { message: string }).message).toMatch(/SOQL pagination URL/);
    });

    it('rejects oversized request body', async () => {
      const r = await apiRequest(server.baseUrl, '/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'x'.repeat(1024 * 1024 + 1) }),
      });
      expect(r.status).toBe(400);
      expect((r.body as { message: string }).message).toMatch(/too large/i);
    });
  });

  describe('POST /api/aggregate', () => {
    it('groups leads by Status', async () => {
      const r = await apiRequest(server.baseUrl, '/api/aggregate', {
        method: 'POST',
        json: { object: 'Lead', groupBy: ['Status'], days: 7 },
      });
      expect(r.status).toBe(200);
      const body = r.body as { data: { records: { Status: string }[] }; meta: { soql: string } };
      expect(body.data.records[0]?.Status).toBe('Not Used Demo');
      expect(body.meta.soql).toContain('GROUP BY Status');
    });

    it('returns 400 when groupBy is empty', async () => {
      const r = await apiRequest(server.baseUrl, '/api/aggregate', {
        method: 'POST',
        json: { object: 'Lead', groupBy: [] },
      });
      expect(r.status).toBe(400);
    });

    it('returns 400 for malicious groupBy', async () => {
      const r = await apiRequest(server.baseUrl, '/api/aggregate', {
        method: 'POST',
        json: { object: 'Lead', groupBy: ["Status FROM Lead WHERE Name LIKE '"], days: 7 },
      });
      expect(r.status).toBe(400);
    });
  });

  describe('GET /api/search', () => {
    it('requires object param', async () => {
      const r = await apiRequest(server.baseUrl, '/api/search');
      expect(r.status).toBe(400);
    });

    it('searches leads by email', async () => {
      const r = await apiRequest(server.baseUrl, '/api/search?object=Lead&email=test@&days=7');
      expect(r.status).toBe(200);
      const records = (r.body as { data: { records: { Email: string }[] } }).data.records;
      expect(records[0]?.Email).toBe('test@example.com');
    });

    it('returns 400 when no filters provided', async () => {
      const r = await apiRequest(server.baseUrl, '/api/search?object=Lead');
      expect(r.status).toBe(400);
    });

    it('returns 400 for invalid days', async () => {
      const r = await apiRequest(server.baseUrl, '/api/search?object=Lead&days=abc&email=x');
      expect(r.status).toBe(400);
    });
  });

  describe('GET /api/picklists/:object', () => {
    it('returns Status picklist for Lead', async () => {
      const r = await apiRequest(server.baseUrl, '/api/picklists/Lead?field=Status');
      expect(r.status).toBe(200);
      const fields = (r.body as { data: { fields: { name: string }[] } }).data.fields;
      expect(fields[0]?.name).toBe('Status');
    });
  });

  describe('GET /api/records/:object/:id', () => {
    it('returns a single record', async () => {
      const r = await apiRequest(server.baseUrl, '/api/records/Lead/00Qfixture000001');
      expect(r.status).toBe(200);
      const records = (r.body as { data: { records: { Id: string }[] } }).data.records;
      expect(records[0]?.Id).toBe('00Qfixture000001');
    });

    it('returns 400 for malicious fields param', async () => {
      const r = await apiRequest(
        server.baseUrl,
        "/api/records/Lead/00Qfixture000001?fields=Name,+Email+FROM+Lead+WHERE+Name+LIKE+'",
      );
      expect(r.status).toBe(400);
    });

    it('returns 400 for Opportunity object', async () => {
      const r = await apiRequest(server.baseUrl, '/api/records/Opportunity/00Qfixture000001');
      expect(r.status).toBe(400);
      expect((r.body as { message: string }).message).toMatch(/does not exist/);
    });

    it('returns 400 for invalid Salesforce Id', async () => {
      const r = await apiRequest(server.baseUrl, '/api/records/Lead/not-an-id');
      expect(r.status).toBe(400);
      expect((r.body as { message: string }).message).toMatch(/Invalid Salesforce record Id/);
    });
  });

  describe('validation edge cases', () => {
    it('returns 400 for describe Opportunity', async () => {
      const r = await apiRequest(server.baseUrl, '/api/describe/Opportunity');
      expect(r.status).toBe(400);
    });

    it('returns 400 for picklists on invalid object', async () => {
      const r = await apiRequest(server.baseUrl, '/api/picklists/Opportunity');
      expect(r.status).toBe(400);
    });

    it('returns 405 for POST on GET-only route', async () => {
      const r = await apiRequest(server.baseUrl, '/api/org', { method: 'POST', json: {} });
      expect(r.status).toBe(405);
      expect(r.body).toMatchObject({ error: 'method_not_allowed' });
    });
  });

  describe('dashboard leads', () => {
    it('GET /api/dashboard/leads/by-bdm returns aggregate rows', async () => {
      const r = await apiRequest(server.baseUrl, '/api/dashboard/leads/by-bdm');
      expect(r.status).toBe(200);
      const body = r.body as { data: { records: { Name: string }[] }; meta: { period: string } };
      expect(body.meta.period).toBe('THIS_MONTH');
      expect(body.data.records[0]?.Name).toBe('BDM One');
    });

    it('rejects invalid period on by-bdm', async () => {
      const r = await apiRequest(server.baseUrl, '/api/dashboard/leads/by-bdm?period=DROP%20TABLE');
      expect(r.status).toBe(400);
    });

    it('GET /api/dashboard/leads/by-country returns country breakdown', async () => {
      const r = await apiRequest(server.baseUrl, '/api/dashboard/leads/by-country?days=30');
      expect(r.status).toBe(200);
      const body = r.body as {
        data: { records: { Country_of_Residence_Lead__c: string }[] };
        meta: { days: number };
      };
      expect(body.meta.days).toBe(30);
      expect(body.data.records[0]?.Country_of_Residence_Lead__c).toBe('MEX');
    });

    it('rejects invalid days on by-country', async () => {
      const r = await apiRequest(server.baseUrl, '/api/dashboard/leads/by-country?days=0');
      expect(r.status).toBe(400);
    });

    it('GET /api/dashboard/leads/conversion-rate computes rate with soql in meta', async () => {
      const r = await apiRequest(server.baseUrl, '/api/dashboard/leads/conversion-rate?days=7');
      expect(r.status).toBe(200);
      const body = r.body as {
        data: { total: number; converted: number; rate: number };
        meta: { days: number; soql: string[] };
      };
      expect(body.data.total).toBe(100);
      expect(body.data.converted).toBe(25);
      expect(body.data.rate).toBe(0.25);
      expect(body.meta.soql).toHaveLength(2);
      expect(body.meta.soql[0]).toContain('COUNT(Id) total');
    });
  });
});

describe('REST API token env', () => {
  it('test harness uses configured access token', () => {
    expect(TEST_ACCESS_TOKEN.length).toBeGreaterThanOrEqual(24);
  });
});
