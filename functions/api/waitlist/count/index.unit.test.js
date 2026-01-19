import assert from "node:assert/strict";
import test from "node:test";
import { _onRequestGetCore } from "./index.js";

function makeFakeDB({ count, throws = false }) {
  return {
    prepare() {
      return {
        async first() {
          if (throws) throw new Error("db down");
          return { count };
        },
      };
    },
  };
}

async function readJson(res) {
  const text = await res.text();
  return JSON.parse(text);
}

test("count endpoint returns 200 with count on success", async () => {
  const logs = [];

  const res = await _onRequestGetCore(
    { env: { DB: makeFakeDB({ count: 7 }) } },
    {
      uuid: () => "rid_1",
      now: (() => { let t = 1000; return () => (t += 10); })(),
      logImpl: (e, p) => logs.push({ e, p }),
    }
  );

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/json; charset=utf-8");

  const body = await readJson(res);
  assert.deepEqual(body, { ok: true, count: 7, rid: "rid_1" });

  assert.equal(logs[0].e, "waitlist.count.result");
  assert.equal(logs[0].p.rid, "rid_1");
  assert.equal(logs[0].p.count, 7);
});

test("count endpoint returns 500 with generic error on failure", async () => {
  const logs = [];

  const res = await _onRequestGetCore(
    { env: { DB: makeFakeDB({ throws: true }) } },
    {
      uuid: () => "rid_2",
      now: (() => { let t = 2000; return () => (t += 5); })(),
      logImpl: (e, p) => logs.push({ e, p }),
    }
  );

  assert.equal(res.status, 500);

  const body = await readJson(res);
  assert.deepEqual(body, { ok: false, error: "Server error", rid: "rid_2" });

  assert.equal(logs[0].e, "waitlist.count.fail");
  assert.equal(logs[0].p.rid, "rid_2");
  assert.match(logs[0].p.error, /db down/);
});
