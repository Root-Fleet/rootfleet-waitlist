function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// POST /api/waitlist
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const emailRaw = (body.email || "").trim();
    const email = emailRaw.toLowerCase();

    if (!isValidEmail(email)) {
      return json(400, { error: "Please enter a valid email." });
    }

    const ip = request.headers.get("cf-connecting-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const createdAt = new Date().toISOString();

    // Insert with dedupe using UNIQUE(email)
    // If already exists, we treat it as success (idempotent waitlist join).
    const stmt = env.DB.prepare(
      `INSERT INTO waitlist (email, created_at, ip, user_agent)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO NOTHING;`
    );

    const result = await stmt.bind(email, createdAt, ip, userAgent).run();

    // result.meta.changes === 1 means inserted, 0 means already existed
    const message =
      result?.meta?.changes === 1
        ? "You’re on the list ✅"
        : "You’re already on the list ✅";

    return json(200, { ok: true, message });
  } catch (err) {
    return json(500, { error: err?.message || "Server error" });
  }
}

