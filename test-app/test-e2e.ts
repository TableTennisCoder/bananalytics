/**
 * End-to-end test script.
 * Tests the full flow: create project -> ingest events -> query them back.
 *
 * Usage:
 *   1. Start the backend: cd server && docker-compose up postgres -d && go run ./cmd/rochade
 *   2. Run migrations (see server/README.md)
 *   3. Run this script: npx ts-node test-e2e.ts
 */

const BASE_URL = process.env.ROCHADE_URL || 'http://localhost:8080';

interface Project {
  id: string;
  name: string;
  write_key: string;
  secret_key: string;
}

async function request(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

async function main() {
  console.log(`\nTesting against ${BASE_URL}\n`);

  // 1. Health check
  const health = await request('GET', '/health');
  assert(health.status === 200, 'Health check returns 200');

  // 2. Create project
  const createRes = await request('POST', '/v1/projects', { name: 'E2E Test Project' });
  assert(createRes.status === 201, 'Create project returns 201');
  const project = createRes.data as Project;
  assert(!!project.write_key, `Got write_key: ${project.write_key}`);
  assert(!!project.secret_key, `Got secret_key: ${project.secret_key}`);
  console.log(`  Project ID: ${project.id}`);

  // 3. Ingest events
  const events = [
    {
      event: 'signup_start',
      type: 'track',
      messageId: `msg-${Date.now()}-1`,
      anonymousId: 'anon-e2e-001',
      properties: { source: 'organic' },
      context: { session: { id: 'sess-e2e-1', startedAt: new Date().toISOString() }, device: { os: 'ios', osVersion: '17', model: 'iPhone', manufacturer: 'Apple', screenWidth: 390, screenHeight: 844 }, app: { name: 'E2E', version: '1.0', build: '1', bundleId: 'com.e2e' }, locale: 'en', timezone: 'UTC' },
      userId: null,
      timestamp: new Date().toISOString(),
    },
    {
      event: 'signup_complete',
      type: 'track',
      messageId: `msg-${Date.now()}-2`,
      anonymousId: 'anon-e2e-001',
      properties: { method: 'email' },
      context: { session: { id: 'sess-e2e-1', startedAt: new Date().toISOString() }, device: { os: 'ios', osVersion: '17', model: 'iPhone', manufacturer: 'Apple', screenWidth: 390, screenHeight: 844 }, app: { name: 'E2E', version: '1.0', build: '1', bundleId: 'com.e2e' }, locale: 'en', timezone: 'UTC' },
      userId: 'user-e2e-001',
      timestamp: new Date().toISOString(),
    },
    {
      event: '$screen',
      type: 'screen',
      messageId: `msg-${Date.now()}-3`,
      anonymousId: 'anon-e2e-001',
      properties: { name: 'HomeScreen' },
      context: { session: { id: 'sess-e2e-1', startedAt: new Date().toISOString() }, device: { os: 'ios', osVersion: '17', model: 'iPhone', manufacturer: 'Apple', screenWidth: 390, screenHeight: 844 }, app: { name: 'E2E', version: '1.0', build: '1', bundleId: 'com.e2e' }, locale: 'en', timezone: 'UTC' },
      userId: 'user-e2e-001',
      timestamp: new Date().toISOString(),
    },
  ];

  const ingestRes = await request('POST', '/v1/ingest', { batch: events }, project.write_key);
  assert(ingestRes.status === 200, `Ingest returns 200`);
  assert(ingestRes.data.success === true, `Ingest success=true`);
  assert(ingestRes.data.accepted === 3, `Accepted 3 events (got ${ingestRes.data.accepted})`);

  // 4. Ingest with invalid key
  const badAuth = await request('POST', '/v1/ingest', { batch: events }, 'bad_key');
  assert(badAuth.status === 401, 'Invalid key returns 401');

  // 5. Query events
  const queryRes = await request('GET', '/v1/query/events?event=signup_start', undefined, project.secret_key);
  assert(queryRes.status === 200, 'Query events returns 200');
  assert(Array.isArray(queryRes.data.events), 'Events is an array');
  assert(queryRes.data.events.length >= 1, `Found ${queryRes.data.events.length} signup_start events`);

  // 6. Query with write key should fail
  const queryBadKey = await request('GET', '/v1/query/events', undefined, project.write_key);
  assert(queryBadKey.status === 401, 'Query with write_key returns 401');

  // 7. Deduplicate check — re-send same events
  const dedupRes = await request('POST', '/v1/ingest', { batch: events }, project.write_key);
  assert(dedupRes.status === 200, 'Dedup ingest returns 200');
  assert(dedupRes.data.accepted === 0, `Dedup: 0 new events accepted (got ${dedupRes.data.accepted})`);

  // 8. Validation — invalid event
  const invalidBatch = {
    batch: [{ event: '', type: 'track', messageId: 'x', anonymousId: 'a', timestamp: new Date().toISOString(), properties: {}, context: {} }],
  };
  const invalidRes = await request('POST', '/v1/ingest', invalidBatch, project.write_key);
  assert(invalidRes.status === 400, `Invalid event returns 400 (got ${invalidRes.status})`);

  console.log('\n All E2E tests passed!\n');
}

main().catch((err) => {
  console.error('E2E test error:', err);
  process.exit(1);
});
