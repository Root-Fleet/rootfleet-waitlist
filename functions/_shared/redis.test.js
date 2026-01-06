import assert from "node:assert/strict";
import test from "node:test";
import { _redisCmdCore } from "./redis.js";

function makeRes({ ok, status, jsonValue, jsonThrows = false }) {
  return {
    ok,
    status,
    async json() {
      if (jsonThrows) throw new Error("bad json");
      return jsonValue;
    },
  };
}

test("_redisCmdCore throws missing_upstash_env when env vars absent", async () => {
  await assert.rejects(
    () => _redisCmdCore({}, "get", ["x"], { fetchImpl: async () => {} }),
    (err) => err.message === "missing_upstash_env"
  );
});

test("_redisCmdCore builds correct URL and returns data.result on success", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return makeRes({ ok: true, status: 200, jsonValue: { result: "OK" } });
  };

  const out = await _redisCmdCore(
    {
      UPSTASH_REDIS_REST_URL: "https://example.upstash.io/",
      UPSTASH_REDIS_REST_TOKEN: "token_123",
    },
    "set",
    ["k 1", "v/2"],
    { fetchImpl, logImpl: () => {} }
  );

  assert.equal(out, "OK");
  assert.equal(calls.length, 1);

  // Base trimmed, args encoded
  assert.equal(
    calls[0].url,
    "https://example.upstash.io/set/k%201/v%2F2"
  );
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, "Bearer token_123");
});

test("_redisCmdCore logs and throws when Upstash returns error field", async () => {
  const logs = [];
  const fetchImpl = async () =>
    makeRes({ ok: true, status: 200, jsonValue: { error: "ERR boom" } });

  await assert.rejects(
    () =>
      _redisCmdCore(
        {
          UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
          UPSTASH_REDIS_REST_TOKEN: "token",
        },
        "llen",
        ["q:waitlist-email"],
        { fetchImpl, logImpl: (e, p) => logs.push({ e, p }) }
      ),
    (err) => err.message === "ERR boom"
  );

  assert.equal(logs.length, 1);
  assert.equal(logs[0].e, "redis.error");
  assert.equal(logs[0].p.command, "llen");
  assert.match(logs[0].p.msg, /ERR boom/);
});

test("_redisCmdCore logs and throws upstash_error_STATUS when HTTP not ok and no error field", async () => {
  const logs = [];
  const fetchImpl = async () =>
    makeRes({ ok: false, status: 500, jsonValue: {} });

  await assert.rejects(
    () =>
      _redisCmdCore(
        {
          UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
          UPSTASH_REDIS_REST_TOKEN: "token",
        },
        "get",
        ["x"],
        { fetchImpl, logImpl: (e, p) => logs.push({ e, p }) }
      ),
    (err) => err.message === "upstash_error_500"
  );

  assert.equal(logs[0].e, "redis.error");
  assert.equal(logs[0].p.command, "get");
});
