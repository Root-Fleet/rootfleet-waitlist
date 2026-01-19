import assert from "node:assert/strict";
import test from "node:test";
import { _drainCore, _fetchCore, _scheduledCore } from "./index.js";

async function readJson(res) {
  const t = await res.text();
  return JSON.parse(t);
}

test("fetch /health -> 200 ok", async () => {
  const res = await _fetchCore(new Request("https://x/health"), {}, {});
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "ok");
});

test("fetch /trigger unauthorized when secret missing or mismatch", async () => {
  const env = { TRIGGER_SECRET: "secret" };

  const res1 = await _fetchCore(new Request("https://x/trigger", { method: "POST" }), env, {});
  assert.equal(res1.status, 401);

  const res2 = await _fetchCore(
    new Request("https://x/trigger", { method: "POST", headers: { "x-trigger-secret": "wrong" } }),
    env,
    {}
  );
  assert.equal(res2.status, 401);
});

test("fetch /trigger calls drain and returns JSON result", async () => {
  const env = { TRIGGER_SECRET: "secret", DRAIN_BATCH_SIZE: "3" };

  const drainCalls = [];
  const drainImpl = async (envArg, ctxArg, limit, source) => {
    drainCalls.push({ envArg, ctxArg, limit, source });
    return { processed: 2, failed: 0, remaining: 5, source };
  };

  const res = await _fetchCore(
    new Request("https://x/trigger", { method: "POST", headers: { "x-trigger-secret": "secret" } }),
    env,
    {},
    { drainImpl }
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);

  assert.deepEqual(body, { ok: true, processed: 2, failed: 0, remaining: 5, source: "trigger" });
  assert.equal(drainCalls.length, 1);
  assert.equal(drainCalls[0].limit, 3);
  assert.equal(drainCalls[0].source, "trigger");
});

test("fetch unknown path -> 404", async () => {
  const res = await _fetchCore(new Request("https://x/whatever"), {}, {});
  assert.equal(res.status, 404);
});

test("scheduled calls drain with cron source", async () => {
  const drainCalls = [];
  const drainImpl = async (envArg, ctxArg, limit, source) => {
    drainCalls.push({ limit, source });
    return {};
  };

  await _scheduledCore({}, { DRAIN_BATCH_SIZE: "9" }, {}, { drainImpl });

  assert.equal(drainCalls.length, 1);
  assert.equal(drainCalls[0].limit, 9);
  assert.equal(drainCalls[0].source, "cron");
});

test("drain processes up to limit and stops when queue empty", async () => {
  const jobs = [{ email: "a@b.com" }, { email: "c@d.com" }];

  const dequeueImpl = async () => jobs.shift() || null;
  const processedJobs = [];
  const processImpl = async (job) => processedJobs.push(job);
  const lengthImpl = async () => 0;

  const logs = [];
  const result = await _drainCore(
    {},
    {},
    10,
    "trigger",
    {
      uuid: () => "rid_1",
      now: (() => { let t = 1000; return () => (t += 10); })(),
      logImpl: (e, p) => logs.push({ e, p }),
      dequeueImpl,
      processImpl,
      lengthImpl,
      enqueueImpl: async () => {},
    }
  );

  assert.deepEqual(result, { processed: 2, failed: 0, remaining: 0, source: "trigger" });

  // Ensure emailSource was attached
  assert.equal(processedJobs[0].emailSource, "trigger");
  assert.equal(processedJobs[1].emailSource, "trigger");

  assert.equal(logs.at(-1).e, "consumer.drain.done");
  assert.equal(logs.at(-1).p.processed, 2);
});

test("drain re-enqueues failed jobs and counts failed", async () => {
  const jobs = [{ email: "a@b.com" }, null];

  const dequeueImpl = async () => jobs.shift();
  const processImpl = async () => { throw new Error("boom"); };

  const enqueued = [];
  const enqueueImpl = async (_env, payload) => enqueued.push(payload);

  const logs = [];
  const result = await _drainCore(
    {},
    {},
    5,
    "cron",
    {
      uuid: () => "rid_2",
      now: (() => { let t = 2000; return () => (t += 5); })(),
      logImpl: (e, p) => logs.push({ e, p }),
      dequeueImpl,
      processImpl,
      enqueueImpl,
      lengthImpl: async () => 1,
    }
  );

  assert.equal(result.processed, 0);
  assert.equal(result.failed, 1);
  assert.equal(enqueued.length, 1);
  assert.equal(enqueued[0].emailSource, "cron");

  assert.equal(logs.some((x) => x.e === "consumer.job.fail"), true);
  assert.equal(logs.at(-1).e, "consumer.drain.done");
});

test("drain logs reenqueue fail but continues", async () => {
  const jobs = [{ email: "a@b.com" }, null];

  const dequeueImpl = async () => jobs.shift();
  const processImpl = async () => { throw new Error("boom"); };
  const enqueueImpl = async () => { throw new Error("reenqueue boom"); };

  const logs = [];
  const result = await _drainCore(
    {},
    {},
    5,
    "trigger",
    {
      uuid: () => "rid_3",
      now: (() => { let t = 3000; return () => (t += 5); })(),
      logImpl: (e, p) => logs.push({ e, p }),
      dequeueImpl,
      processImpl,
      enqueueImpl,
      lengthImpl: async () => null,
    }
  );

  assert.equal(result.failed, 1);
  assert.equal(logs.some((x) => x.e === "consumer.reenqueue.fail"), true);
});

// how to run test

// node --test workers/waitlist-email-consumer/src/index.test.js
