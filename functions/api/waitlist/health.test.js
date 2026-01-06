import assert from "node:assert/strict";
import test from "node:test";
import { _healthGetCore } from "./health.js";

async function readJson(res) {
  const t = await res.text();
  return JSON.parse(t);
}

function makeReq(url) {
  return { url };
}

test("shallow: returns 200 when D1 is bound, deep=false", async () => {
  const logs = [];
  const res = await _healthGetCore(
    {
      env: { ENVIRONMENT: "preview", DB: {} },
      request: makeReq("https://x/health"),
    },
    {
      uuid: () => "rid_1",
      isoNow: () => "2026-01-06T00:00:00.000Z",
      now: (() => { let t = 1000; return () => (t += 10); })(),
      logImpl: (e, p) => logs.push({ e, p }),
      // should not be called in shallow mode
      checkD1: async () => {
        throw new Error("should_not_run");
      },
    }
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);

  assert.equal(body.ok, true);
  assert.equal(body.rid, "rid_1");
  assert.equal(body.environment, "preview");
  assert.equal(body.checks.deep, false);
  assert.equal(body.checks.d1.bound, true);
  assert.equal(body.checks.d1.mode, "binding_only");
  assert.equal(logs.at(-1).e, "health.ok");
});

test("shallow: returns 503 when D1 is missing", async () => {
  const res = await _healthGetCore(
    {
      env: { ENVIRONMENT: "preview" }, // no DB
      request: makeReq("https://x/health"),
    },
    {
      uuid: () => "rid_2",
      isoNow: () => "2026-01-06T00:00:00.000Z",
      now: (() => { let t = 2000; return () => (t += 5); })(),
      logImpl: () => {},
    }
  );

  assert.equal(res.status, 503);
  const body = await readJson(res);

  assert.equal(body.ok, false);
  assert.equal(body.rid, "rid_2");
  assert.equal(body.checks.d1.bound, false);
  assert.equal(body.checks.d1.ok, false);
  assert.equal(body.checks.d1.error, "d1_not_bound");
});

test("deep: returns 200 when D1 ping succeeds", async () => {
  const res = await _healthGetCore(
    {
      env: { ENVIRONMENT: "prod", DB: {}, RESEND_API_KEY: "rk" },
      request: makeReq("https://x/health?deep=1"),
    },
    {
      uuid: () => "rid_3",
      isoNow: () => "2026-01-06T00:00:00.000Z",
      now: (() => { let t = 3000; return () => (t += 20); })(),
      logImpl: () => {},
      checkD1: async () => ({ ok: true, latencyMs: 7 }),
      // redis not configured here; should not be pinged
      checkRedis: async () => {
        throw new Error("should_not_run");
      },
    }
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);

  assert.equal(body.ok, true);
  assert.equal(body.checks.deep, true);
  assert.equal(body.checks.d1.ok, true);
  assert.equal(body.checks.d1.latencyMs, 7);
  assert.equal(body.checks.redis.configured, false);
});

test("deep: returns 503 when D1 ping fails", async () => {
  const res = await _healthGetCore(
    {
      env: { ENVIRONMENT: "prod", DB: {} },
      request: makeReq("https://x/health?deep=1"),
    },
    {
      uuid: () => "rid_4",
      isoNow: () => "2026-01-06T00:00:00.000Z",
      now: (() => { let t = 4000; return () => (t += 10); })(),
      logImpl: () => {},
      checkD1: async () => {
        throw new Error("db down");
      },
    }
  );

  assert.equal(res.status, 503);
  const body = await readJson(res);

  assert.equal(body.ok, false);
  assert.equal(body.checks.d1.ok, false);
  assert.match(body.checks.d1.error, /db down/);
});

test("deep: pings redis when configured and reports redis status", async () => {
  const res = await _healthGetCore(
    {
      env: {
        ENVIRONMENT: "prod",
        DB: {},
        UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "token",
      },
      request: makeReq("https://x/health?deep=1"),
    },
    {
      uuid: () => "rid_5",
      isoNow: () => "2026-01-06T00:00:00.000Z",
      now: (() => { let t = 5000; return () => (t += 10); })(),
      logImpl: () => {},
      checkD1: async () => ({ ok: true, latencyMs: 3 }),
      checkRedis: async () => ({ ok: true, latencyMs: 9 }),
    }
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);

  assert.equal(body.ok, true);
  assert.equal(body.checks.redis.configured, true);
  assert.equal(body.checks.redis.ok, true);
  assert.equal(body.checks.redis.latencyMs, 9);
});
