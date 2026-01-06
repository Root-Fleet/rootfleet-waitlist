import assert from "node:assert/strict";
import test from "node:test";
import { _sendResendEmailCore } from "./resend.js";

function makeFakeResponse({ ok, status, bodyText }) {
  return {
    ok,
    status,
    async text() {
      return bodyText;
    },
  };
}

test("_sendResendEmailCore returns parsed JSON on success and logs ok", async () => {
  const calls = [];
  const logs = [];

  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return makeFakeResponse({
      ok: true,
      status: 200,
      bodyText: JSON.stringify({ id: "email_123" }),
    });
  };

  const logImpl = (event, payload) => logs.push({ event, payload });

  const nowTimes = [1000, 1123];
  const now = () => nowTimes.shift();

  const out = await _sendResendEmailCore(
    {
      rid: "rid_1",
      apiKey: "rk_test",
      from: "Rootfleet <noreply@rootfleet.com>",
      to: "user@example.com",
      subject: "Hello",
      html: "<p>hi</p>",
      text: "hi",
    },
    { fetchImpl, logImpl, now }
  );

  assert.deepEqual(out, { id: "email_123" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.resend.com/emails");

  const sentBody = JSON.parse(calls[0].options.body);
  assert.equal(sentBody.to, "user@example.com");

  assert.equal(logs[0].event, "resend.send.start");
  assert.deepEqual(logs[0].payload, { rid: "rid_1", toDomain: "example.com" });

  assert.equal(logs[1].event, "resend.send.ok");
  assert.equal(logs[1].payload.resendMs, 123);
  assert.equal(logs[1].payload.id, "email_123");
});

test("_sendResendEmailCore throws and logs fail on non-OK response", async () => {
  const logs = [];

  const fetchImpl = async () =>
    makeFakeResponse({
      ok: false,
      status: 401,
      bodyText: `{"message":"Unauthorized"}`,
    });

  const logImpl = (event, payload) => logs.push({ event, payload });

  const nowTimes = [2000, 2050];
  const now = () => nowTimes.shift();

  await assert.rejects(
    () =>
      _sendResendEmailCore(
        {
          rid: "rid_2",
          apiKey: "bad_key",
          from: "x",
          to: "user@example.com",
          subject: "s",
          html: "h",
          text: "t",
        },
        { fetchImpl, logImpl, now }
      ),
    (err) => {
      assert.match(err.message, /Resend error \(401\):/);
      assert.match(err.message, /Unauthorized/);
      return true;
    }
  );

  assert.equal(logs[0].event, "resend.send.start");
  assert.equal(logs[1].event, "resend.send.fail");
  assert.equal(logs[1].payload.status, 401);
  assert.equal(logs[1].payload.resendMs, 50);
});

test("_sendResendEmailCore returns {} if success body is not JSON", async () => {
  const fetchImpl = async () =>
    makeFakeResponse({ ok: true, status: 200, bodyText: "OK" });

  const out = await _sendResendEmailCore(
    {
      rid: "rid_3",
      apiKey: "rk",
      from: "x",
      to: "user@example.com",
      subject: "s",
      html: "h",
      text: "t",
    },
    {
      fetchImpl,
      logImpl: () => {},
      now: (() => {
        let t = 1;
        return () => t++;
      })(),
    }
  );

  assert.deepEqual(out, {});
});
