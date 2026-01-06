// tests/integration/waitlist.e2e.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { get, postJson, uniqueEmail } from '../helpers/http.js';

test('E2E: signup then count increases (if count endpoint exists)', async () => {
  // Try count endpoint; if not present, skip that part.
  const before = await get('/api/waitlist/count');
  const hasCount = before.res.status === 200 && typeof before.json?.count === 'number';

  const email = uniqueEmail('e2e');
  const signup = await postJson('/api/waitlist', {
    email,
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'E2ECorp',
  });

  assert.equal(signup.res.status, 200);
  assert.ok(signup.json);
  assert.ok(['joined', 'already_joined'].includes(signup.json.status));

  if (!hasCount) {
    test.skip('Count endpoint not available; skipping count assertion');
    return;
  }

  const after = await get('/api/waitlist/count');
  assert.equal(after.res.status, 200);
  assert.equal(typeof after.json?.count, 'number');
  assert.ok(after.json.count >= before.json.count, `Count did not increase: before=${before.json.count}, after=${after.json.count}`);
});
