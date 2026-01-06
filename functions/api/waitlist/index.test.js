import assert from "node:assert/strict";
import test from "node:test";
import { _onRequestPostCore } from "./index.js";

async function readJson(res) {
  const txt = await res.text();
  return JSON.parse(txt);
}

function makeRequest({ url = "https://x/api/waitlist", body = {}, headers = {}, method = "POST" } = {}) {
  return new Request(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });
}

function makeFakeDB({ insertThrowsMessage = null } = {}) {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      calls.push({ type: "prepare", sql });
      return {
        bind(...args) {
          calls.push({ type: "bind", sql, args });
          return {
            async run() {
              calls.push({ type: "run", sql, args });
              if (insertThrowsMessage) throw new Error(insertThrowsMessage);
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
}

test("validation: invalid email -> 400", async () => {
  const logs = [];
  const req = makeRequest({
    body: { email: "not-an-email", role: "engineer", fleetSize: "1-5" },
  });

  const res = await _onRequestPostCore(
    { request: req, env: { DB: makeFakeDB() }, ctx: {} },
    { uuid: () => "rid_1", now: () => 0, logImpl: (e, p) => logs.push({ e, p }) }
  );

  assert.equal(res.status, 400);
  assert.equal(res.headers.get("x-request-id"), "rid_1");

  const body = await readJson(res);
  assert.equal(body.ok, false);
  assert.match(body.error, /valid email/i);

  assert.equal(logs.some((x) => x.e === "waitlist.validation.fail" && x.p.field === "email"), true);
});

test("validation: invalid role -> 400", async () => {
  const req = makeRequest({
    body: { email: "a@b.com", role: "hacker", fleetSize: "1-5" },
  });

  const res = await _onRequestPostCore(
    { request: req, env: { DB: makeFakeDB() }, ctx: {} },
    { uuid: () => "rid_2", now: () => 0, logImpl: () => {} }
  );

  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.match(body.error, /valid role/i);
});

test("validation: invalid fleetSize -> 400", async () => {
  const req = makeRequest({
    body: { email: "a@b.com", role: "engineer", fleetSize: "999" },
  });

  const res = await _onRequestPostCore(
    { request: req, env: { DB: makeFakeDB() }, ctx: {} },
    { uuid: () => "rid_3", now: () => 0, logImpl: () => {} }
  );

  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.match(body.error, /valid fleet size/i);
});

test("duplicate email -> 200 already_joined", async () => {
  const req = makeRequest({
    body: { email: "a@b.com", role: "engineer", fleetSize: "1-5" },
  });

  const res = await _onRequestPostCore(
    { request: req, env: { DB: makeFakeDB({ insertThrowsMessage: "UNIQUE constraint failed: waitlist.email" }) }, ctx: {} },
    { uuid: () => "rid_4", now: (() => { let t = 0; return () => (t += 5); })(), logImpl: () => {} }
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.status, "already_joined");
});

test("db error (non-duplicate) -> 500 database error", async () => {
  const req = makeRequest({
    body: { email: "a@b.com", role: "engineer", fleetSize: "1-5" },
  });

  const res = await _onRequestPostCore(
    { request: req, env: { DB: makeFakeDB({ insertThrowsMessage: "SQLITE_BUSY" }) }, ctx: {} },
    { uuid: () => "rid_5", now: () => 0, logImpl: () => {} }
  );

  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.match(body.error, /Database error/i);
});

test("joined with QUEUE_MODE disabled -> does not enqueue", async () => {
  const enqueueCalls = [];
  const req = makeRequest({
    body: { email: "a@b.com", role: "engineer", fleetSize: "1-5", companyName: "  ACME  " },
    headers: { "CF-Connecting-IP": "1.2.3.4", "User-Agent": "ua" },
  });

  const res = await _onRequestPostCore(
    {
      request: req,
      env: { DB: makeFakeDB(), QUEUE_MODE: "disabled" },
      ctx: {},
    },
    {
      uuid: () => "rid_6",
      now: (() => { let t = 0; return () => (t += 10); })(),
      logImpl: () => {},
      enqueueImpl: async (...args) => enqueueCalls.push(args),
    }
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.status, "joined");
  assert.equal(enqueueCalls.length, 0);
});

test("joined with QUEUE_MODE enabled -> enqueues job and triggers via waitUntil when configured", async () => {
  const enqueueCalls = [];
  const fetchCalls = [];

  const req = makeRequest({
    body: { email: "User@B.com", role: "engineer", fleetSize: "1-5" },
  });

  const ctx = { waitUntil: (p) => p }; // just accept promise

  const res = await _onRequestPostCore(
    {
      request: req,
      env: {
        DB: makeFakeDB(),
        QUEUE_MODE: "enabled",
        EMAIL_MODE: "enabled",
        EMAIL_CONSUMER_TRIGGER_URL: "https://trigger.local/run",
        TRIGGER_SECRET: "secret",
      },
      ctx,
    },
    {
      uuid: () => "rid_7",
      now: (() => { let t = 0; return () => (t += 10); })(),
      logImpl: () => {},
      enqueueImpl: async (env, payload) => enqueueCalls.push({ env, payload }),
      fetchImpl: async (url, opts) => {
        fetchCalls.push({ url, opts });
        return { ok: true, status: 200, text: async () => "ok" };
      },
    }
  );

  assert.equal(res.status, 200);

  // enqueued with normalized email
  assert.equal(enqueueCalls.length, 1);
  assert.equal(enqueueCalls[0].payload.email, "user@b.com");
  assert.equal(enqueueCalls[0].payload.emailSource, "trigger");
  assert.equal(enqueueCalls[0].payload.emailEnabled, true);

  // trigger called
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://trigger.local/run");
  assert.equal(fetchCalls[0].opts.method, "POST");
  assert.equal(fetchCalls[0].opts.headers["x-trigger-secret"], "secret");
});
