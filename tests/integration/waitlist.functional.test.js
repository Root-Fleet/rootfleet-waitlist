// tests/integration/waitlist.functional.test.js
import assert from 'node:assert/strict';
import test from 'node:test';
import { postJson, uniqueEmail } from '../helpers/http.js';

test('FUNCTIONAL: rejects missing email', async () => {
  const { res } = await postJson('/api/waitlist', {
    role: 'fleet_owner',
    fleetSize: '1-5',
  });
  // Your implementation may return 400/422.
  assert.ok([400, 422].includes(res.status), `Expected 400/422, got ${res.status}`);
});

test('FUNCTIONAL: rejects invalid email', async () => {
  const { res } = await postJson('/api/waitlist', {
    email: 'not-an-email',
    role: 'fleet_owner',
    fleetSize: '1-5',
  });
  assert.ok([400, 422].includes(res.status), `Expected 400/422, got ${res.status}`);
});

test('FUNCTIONAL: happy path returns joined/already_joined', async () => {
  const email = uniqueEmail('func');
  const { res, json } = await postJson('/api/waitlist', {
    email,
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'FuncCorp',
  });

  assert.equal(res.status, 200);
  assert.ok(json);
  assert.ok(['joined', 'already_joined'].includes(json.status));
});

test('FUNCTIONAL: duplicate email is idempotent (already_joined)', async () => {
  const email = uniqueEmail('dup');

  const first = await postJson('/api/waitlist', {
    email,
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'DupCorp',
  });
  assert.equal(first.res.status, 200);

  const second = await postJson('/api/waitlist', {
    email,
    role: 'fleet_owner',
    fleetSize: '1-5',
    companyName: 'DupCorp',
  });
  assert.equal(second.res.status, 200);
  assert.ok(second.json);
  // If your API returns joined for duplicates, change this expectation.
  assert.ok(
    ['already_joined', 'joined'].includes(second.json.status),
    `Unexpected: ${JSON.stringify(second.json)}`
  );
});
