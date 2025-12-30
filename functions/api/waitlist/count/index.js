import { log } from "../../../_shared/log.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function onRequestGet({ env }) {
  const rid = crypto.randomUUID();
  const t0 = Date.now();

  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM waitlist`).first();
    const count = Number(row?.count || 0);

    log("waitlist.count.result", { rid, count, totalMs: Date.now() - t0 });
    return json(200, { ok: true, count, rid });
  } catch (e) {
    log("waitlist.count.fail", { rid, error: String(e?.message || e).slice(0, 300), totalMs: Date.now() - t0 });
    return json(500, { ok: false, error: "Server error", rid });
  }
}
