import assert from "node:assert/strict";
import test from "node:test";
import { _processWaitlistEmailJobCore } from "./waitlistEmailjob.js";

// Minimal fake D1 that records calls and returns canned results.
function makeFakeDB(steps) {
  const calls = [];
  let i = 0;

  return {
    calls,
    prepare(sql) {
      const step = steps[i++] || {};
      calls.push({ type: "prepare", sql });

      return {
        bind(...args) {
          calls.push({ type: "bind", sql, args });

          return {
            async run() {
              calls.push({ type: "run", sql, args });
              return step.runResult ?? { meta: { changes: 0 } };
            },
            async first() {
              calls.push({ type: "first", sql, args });
              return step.firstResult ?? null;
            },
          };
        },
      };
    },
  };
}

test("invalid job: missing email returns invalid_job and logs", async () => {
  const logs = [];
  const env = { DB: makeFakeDB([]) };

  const out = await _processWaitlistEmailJobCore(
    { rid: "rid_1" }, // no email
    env,
    {},
    {
      logImpl: (e, p) => logs.push({ e, p }),
      now: (() => { let t = 1000; return () => (t += 10); })(),
      cryptoImpl: { randomUUID: () => "uuid_ignored" },
      sendResendEmailImpl: async () => ({}),
      buildEmailImpl: () => ({ subject: "s", html: "h", text: "t" }),
    }
  );

  assert.equal(out.status, "invalid_job");
  assert.equal(logs[0].e, "emailjob.invalid");
  assert.equal(logs[0].p.reason, "missing_email");
});

test("claim not acquired -> skip_not_pending", async () => {
  const logs = [];
  const db = makeFakeDB([
    { runResult: { meta: { changes: 0 } } }, // claim update
  ]);

  const env = { DB: db, RESEND_API_KEY: "rk" };

  const out = await _processWaitlistEmailJobCore(
    { rid: "rid_2", email: "USER@Example.com" },
    env,
    {},
    {
      logImpl: (e, p) => logs.push({ e, p }),
      now: (() => { let t = 2000; return () => (t += 5); })(),
      cryptoImpl: { randomUUID: () => "uuid" },
      sendResendEmailImpl: async () => ({ id: "x" }),
      buildEmailImpl: () => ({ subject: "s", html: "h", text: "t" }),
    }
  );

  assert.equal(out.status, "skip_not_pending");
  assert.equal(logs[0].e, "emailjob.claim.skip");
  assert.equal(logs[0].p.emailDomain, "example.com");
});

test("claimed but missing RESEND_API_KEY -> skipped and DB updated", async () => {
  const logs = [];
  const db = makeFakeDB([
    { runResult: { meta: { changes: 1 } } }, // claim update ok
    { runResult: { meta: { changes: 1 } } }, // mark skipped update
  ]);

  const env = { DB: db, RESEND_API_KEY: "" };

  const out = await _processWaitlistEmailJobCore(
    { rid: "rid_3", email: "user@example.com", emailSource: "trigger" },
    env,
    {},
    {
      logImpl: (e, p) => logs.push({ e, p }),
      now: (() => { let t = 3000; return () => (t += 7); })(),
      cryptoImpl: { randomUUID: () => "uuid" },
      sendResendEmailImpl: async () => ({ id: "x" }),
      buildEmailImpl: () => ({ subject: "s", html: "h", text: "t" }),
    }
  );

  assert.equal(out.status, "skipped");
  assert.equal(logs.at(-1).e, "emailjob.skipped");

  // verify we issued the skipped UPDATE (2nd prepare)
  assert.equal(db.calls.filter((c) => c.type === "prepare").length, 2);
});

test("happy path: claimed + resend ok -> sent and DB success update runs", async () => {
  const logs = [];
  const db = makeFakeDB([
    { runResult: { meta: { changes: 1 } } }, // claim ok
    { runResult: { meta: { changes: 1 } } }, // persist success
  ]);

  const env = { DB: db, RESEND_API_KEY: "rk", RESEND_FROM: "From <a@b.com>" };

  const sendCalls = [];
  const out = await _processWaitlistEmailJobCore(
    { rid: "rid_4", email: "user@example.com", role: "engineer", fleetSize: "1-5" },
    env,
    {},
    {
      logImpl: (e, p) => logs.push({ e, p }),
      now: (() => { let t = 4000; return () => (t += 11); })(),
      cryptoImpl: { randomUUID: () => "uuid" },
      buildEmailImpl: ({ email }) => ({ subject: "sub", html: `hi ${email}`, text: "txt" }),
      sendResendEmailImpl: async (args) => {
        sendCalls.push(args);
        return { id: "resend_123" };
      },
    }
  );

  assert.equal(out.status, "sent");
  assert.equal(out.resendId, "resend_123");
  assert.equal(sendCalls.length, 1);
  assert.equal(logs.at(-1).e, "emailjob.sent");
});

test("resend fails -> pending_retry with backoff (attempts < 5)", async () => {
  const logs = [];
  const db = makeFakeDB([
    { runResult: { meta: { changes: 1 } } }, // claim ok
    { firstResult: { attempts: 0 } },        // select attempts
    { runResult: { meta: { changes: 1 } } }, // update pending retry
  ]);

  const env = { DB: db, RESEND_API_KEY: "rk" };

  const out = await _processWaitlistEmailJobCore(
    { rid: "rid_5", email: "user@example.com" },
    env,
    {},
    {
      logImpl: (e, p) => logs.push({ e, p }),
      // fixed now so nextAt is deterministic-ish format; we just assert non-null
      now: () => Date.UTC(2026, 0, 6, 0, 0, 0),
      cryptoImpl: { randomUUID: () => "uuid" },
      buildEmailImpl: () => ({ subject: "s", html: "h", text: "t" }),
      sendResendEmailImpl: async () => {
        throw new Error("boom");
      },
    }
  );

  assert.equal(out.status, "pending_retry");
  assert.equal(out.attempts, 1);
  assert.ok(out.nextAt, "nextAt should be set for non-terminal retries");
  assert.equal(logs.at(-1).e, "emailjob.fail");
});

test("resend fails -> failed when attempts >= 5", async () => {
  const logs = [];
  const db = makeFakeDB([
    { runResult: { meta: { changes: 1 } } }, // claim ok
    { firstResult: { attempts: 4 } },        // already had 4 attempts
    { runResult: { meta: { changes: 1 } } }, // update failed
  ]);

  const env = { DB: db, RESEND_API_KEY: "rk" };

  const out = await _processWaitlistEmailJobCore(
    { rid: "rid_6", email: "user@example.com" },
    env,
    {},
    {
      logImpl: (e, p) => logs.push({ e, p }),
      now: () => Date.UTC(2026, 0, 6, 0, 0, 0),
      cryptoImpl: { randomUUID: () => "uuid" },
      buildEmailImpl: () => ({ subject: "s", html: "h", text: "t" }),
      sendResendEmailImpl: async () => {
        throw new Error("boom");
      },
    }
  );

  assert.equal(out.status, "failed");
  assert.equal(out.attempts, 5);
  assert.equal(out.nextAt, null);
  assert.equal(logs.at(-1).e, "emailjob.fail");
});
