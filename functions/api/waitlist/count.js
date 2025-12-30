import { log } from "../../../src/shared/log.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function onRequestGet({ request, env }) {
  const rid = crypto.randomUUID();
  const t0 = Date.now();

  try {
    const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM waitlist`).first();
    const count = Number(row?.count || 0);

    const totalMs = Date.now() - t0;
    log("waitlist.count.result", { rid, count, totalMs });

    return json(200, { ok: true, count, rid });
  } catch (e) {
    const totalMs = Date.now() - t0;
    log("waitlist.count.fail", { rid, error: String(e?.message || e).slice(0, 300), totalMs });
    return json(500, { ok: false, error: "Server error", rid });
  }
}
