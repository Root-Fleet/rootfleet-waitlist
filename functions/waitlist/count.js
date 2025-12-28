function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare(`SELECT count FROM waitlist_stats WHERE id = 1`).first();

  return json(
    200,
    { ok: true, count: row?.count ?? 0 },
    {
      // cache briefly to reduce DB reads
      "cache-control": "public, max-age=60",
    }
  );
}
