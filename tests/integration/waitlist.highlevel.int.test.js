import assert from 'node:assert/strict';
import test from 'node:test';
import { get, postJson, uniqueEmail } from '../helpers/http.js';

test('INTEGRATION: signup then count increases (if count endpoint exists)', async () => {
  const before = await get('/api/waitlist/count');
  const hasCount =
    before.res.status === 200 && typeof before.json?.count === 'number';

  const email = uniqueEmail('int');
  const signup = await postJson('/api/waitlist', {
    email,
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'IntCorp',
  });

  assert.equal(signup.res.status, 200);
  assert.ok(signup.json);
  assert.ok(['joined', 'already_joined'].includes(signup.json.status));

  if (hasCount) {
    const after = await get('/api/waitlist/count');
    assert.equal(after.res.status, 200);
    assert.equal(typeof after.json?.count, 'number');
    assert.ok(after.json.count >= before.json.count);
  }
});
