function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Same-origin calls from Pages don't need CORS.
      // If you later call this from another domain, we'll add CORS properly.
    },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const ALLOWED_ROLES = new Set([
  "fleet_owner",
  "operations",
  "fleet_staff",
  "engineer",
  "other",
]);

const ALLOWED_FLEET_SIZES = new Set([
  "1-5",
  "6-20",
  "21-100",
  "101-500",
  "500+",
]);

// POST /api/waitlist
export async function onRequestPost({ request /*, env */ }) {
  try {
    const body = await request.json().catch(() => ({}));

    const emailRaw = String(body.email || "").trim();
    const email = emailRaw.toLowerCase();

    const role = String(body.role || "").trim();
    const fleetSize = String(body.fleetSize || "").trim();

    const companyNameRaw = body.companyName == null ? "" : String(body.companyName);
    const companyName = companyNameRaw.trim() ? companyNameRaw.trim() : null;

    // ✅ Validate
    if (!isValidEmail(email)) {
      return json(400, { ok: false, error: "Please enter a valid email." });
    }

    if (!ALLOWED_ROLES.has(role)) {
      return json(400, { ok: false, error: "Please select a valid role." });
    }

    if (!ALLOWED_FLEET_SIZES.has(fleetSize)) {
      return json(400, { ok: false, error: "Please select a valid fleet size." });
    }

    // Optional: capture metadata (useful later for analytics/dedupe)
    const meta = {
      ip: request.headers.get("cf-connecting-ip") || null,
      userAgent: request.headers.get("user-agent") || null,
      createdAt: new Date().toISOString(),
    };

    // ✅ For now (before D1): just log and return success.
    // In Step 2, we'll replace this with a D1 insert.
    console.log("WAITLIST_SUBMISSION", {
      email,
      role,
      fleetSize,
      companyName,
      ...meta,
    });

    return json(200, {
      ok: true,
      message: "You're on the list ✅",
      // Helpful during testing; remove later if you want.
      received: { email, role, fleetSize, companyName },
    });
  } catch (err) {
    return json(500, { ok: false, error: err?.message || "Server error" });
  }
}

// (Optional) If someone hits /api/waitlist in a browser
export async function onRequestGet() {
  return json(200, { ok: true, message: "Use POST to join the waitlist." });
}

