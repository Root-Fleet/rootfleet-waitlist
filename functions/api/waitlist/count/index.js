import { log } from "../../../_shared/log.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function _onRequestGetCore(
  { env },
  { logImpl, now, uuid } = {}
) {
  const _log = logImpl || log;
  const _now = now || (() => Date.now());
  const _uuid = uuid || (() => crypto.randomUUID());

  const rid = _uuid();
  const t0 = _now();

  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM waitlist`).first();
    const count = Number(row?.count || 0);

    _log("waitlist.count.result", { rid, count, totalMs: _now() - t0 });
    return json(200, { ok: true, count, rid });
  } catch (e) {
    _log("waitlist.count.fail", {
      rid,
      error: String(e?.message || e).slice(0, 300),
      totalMs: _now() - t0,
    });
    return json(500, { ok: false, error: "Server error", rid });
  }
}

export async function onRequestGet({ env }) {
  return _onRequestGetCore({ env });
}
