import assert from "node:assert/strict";
import test from "node:test";
import { _logCore } from "./log.js";

test("_logCore logs JSON with ts, event, and fields", () => {
  const lines = [];
  const consoleImpl = { log: (s) => lines.push(s) };

  _logCore(
    "my.event",
    { rid: "rid_1", count: 2 },
    { nowIso: () => "2026-01-06T00:00:00.000Z", consoleImpl }
  );

  assert.equal(lines.length, 1);

  const obj = JSON.parse(lines[0]);
  assert.deepEqual(obj, {
    ts: "2026-01-06T00:00:00.000Z",
    event: "my.event",
    rid: "rid_1",
    count: 2,
  });
});
