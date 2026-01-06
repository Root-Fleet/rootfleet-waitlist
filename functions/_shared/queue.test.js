import assert from "node:assert/strict";
import test from "node:test";
import {
  _dequeueWaitlistEmailCore,
  _enqueueWaitlistEmailCore,
  _queueLengthCore,
} from "./queue.js";

test("_enqueueWaitlistEmailCore LPUSHes JSON payload into q:waitlist-email", async () => {
  const calls = [];
  const redisCmdImpl = async (...args) => {
    calls.push(args);
    return 1;
  };

  const env = {};
  const payload = { email: "user@example.com", rid: "rid_1" };

  const out = await _enqueueWaitlistEmailCore(redisCmdImpl, env, payload);

  assert.equal(out, 1);
  assert.equal(calls.length, 1);

  const [envArg, cmd, qkey, json] = calls[0];
  assert.equal(envArg, env);
  assert.equal(cmd, "lpush");
  assert.equal(qkey, "q:waitlist-email");
  assert.deepEqual(JSON.parse(json), payload);
});

test("_dequeueWaitlistEmailCore returns parsed object when RPOP returns JSON", async () => {
  const redisCmdImpl = async () => JSON.stringify({ a: 1 });

  const out = await _dequeueWaitlistEmailCore(redisCmdImpl, {});
  assert.deepEqual(out, { a: 1 });
});

test("_dequeueWaitlistEmailCore returns null when queue empty", async () => {
  const redisCmdImpl = async () => null;

  const out = await _dequeueWaitlistEmailCore(redisCmdImpl, {});
  assert.equal(out, null);
});

test("_queueLengthCore calls LLEN and returns value", async () => {
  const calls = [];
  const redisCmdImpl = async (...args) => {
    calls.push(args);
    return 42;
  };

  const out = await _queueLengthCore(redisCmdImpl, {});
  assert.equal(out, 42);

  const [, cmd, qkey] = calls[0];
  assert.equal(cmd, "llen");
  assert.equal(qkey, "q:waitlist-email");
});
