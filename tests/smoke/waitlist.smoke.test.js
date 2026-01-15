// tests/smoke/waitlist.smoke.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { get, postJson, uniqueEmail } from '../helpers/http.js';

const ALLOW_WRITES = process.env.SMOKE_ALLOW_WRITES === 'true';

test('SMOKE: service responds (health if available)', async () => {
  const { res } = await get('/api/health');
  assert.ok(res.status === 200 || res.status === 404 || res.status === 405);
});

test('SMOKE: can signup once', async () => {
  if (!ALLOW_WRITES) {
    test.skip('SMOKE_ALLOW_WRITES not enabled');
    return;
  }

  const email = uniqueEmail('smoke');
  const { res, json, text } = await postJson('/api/waitlist', {
    email,
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'SmokeCorp',
  });

  assert.equal(res.status, 200, `Expected 200, got ${res.status}. Body: ${text}`);
  assert.ok(json, `Expected JSON body. Got: ${text}`);
  assert.ok(
    json.status === 'joined' || json.status === 'already_joined',
    `Unexpected status: ${JSON.stringify(json)}`
  );
});
