import { sendResendEmail } from "../../lib/resend.js";
import { buildWaitlistConfirmationEmail } from "../../templates/waitlistConfirmationEmail.js";


function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getClientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    null
  );
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

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));

    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();
    const fleetSize = String(body.fleetSize || "").trim();

    const companyNameRaw = body.companyName == null ? "" : String(body.companyName);
    const companyName = companyNameRaw.trim() ? companyNameRaw.trim() : null;

    // Validate input
    if (!isValidEmail(email)) {
      return json(400, { ok: false, error: "Please enter a valid email." });
    }
    if (!ALLOWED_ROLES.has(role)) {
      return json(400, { ok: false, error: "Please select a valid role." });
    }
    if (!ALLOWED_FLEET_SIZES.has(fleetSize)) {
      return json(400, { ok: false, error: "Please select a valid fleet size." });
    }

    // Metadata (optional)
    const ip = getClientIp(request);
    const userAgent = request.headers.get("User-Agent") || null;

    // Insert + increment count atomically via batch
    // - If INSERT fails due to UNIQUE(email), batch throws and count is NOT incremented.
    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO waitlist (email, role, fleet_size, company_name, ip, user_agent)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(email, role, fleetSize, companyName, ip, userAgent),

        env.DB.prepare(`UPDATE waitlist_stats SET count = count + 1 WHERE id = 1`),
      ]);
    } catch (e) {
      const msg = String(e?.message || e);
      const isDup = msg.includes("UNIQUE constraint failed") || msg.toLowerCase().includes("unique");

      if (isDup) {
        // Friendly idempotent response: already signed up
        return json(200, {
          ok: true,
          status: "already_joined",
          message: "You're already on the list ✅",
        });
      }

      // Unexpected DB error
      return json(500, { ok: false, error: "Database error. Please try again." });
    }

    // Only send confirmation email after a successful INSERT (first-time signup)
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      // This is a server misconfig; signup is already recorded, but email won't send
      // You can decide if you want to treat this as fatal; I recommend returning 200
      // to avoid confusing the user.
      return json(200, {
        ok: true,
        status: "joined_email_skipped",
        message: "You're on the list ✅ (email system is being set up)",
      });
    }

    const from = env.RESEND_FROM || "Rootfleet <noreply@rootfleet.com>";

    const { subject, html, text } = buildWaitlistConfirmationEmail({
      email,
      role,
      fleetSize,
      companyName,
    });

    await sendResendEmail({
      apiKey,
      from,
      to: email,
      subject,
      html,
      text,
    });

    return json(200, {
      ok: true,
      status: "joined",
      message: "You're on the list ✅ (check your inbox)",
    });
  } catch (err) {
    return json(500, { ok: false, error: err?.message || "Server error" });
  }
}
