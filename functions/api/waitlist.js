import { sendResendEmail } from "../lib/resend.js";
import { buildWaitlistConfirmationEmail } from "../templates/waitlistConfirmationEmail.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
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

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));

    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();
    const fleetSize = String(body.fleetSize || "").trim();

    const companyNameRaw = body.companyName == null ? "" : String(body.companyName);
    const companyName = companyNameRaw.trim() ? companyNameRaw.trim() : null;

    // Validate
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
    const ip = request.headers.get("cf-connecting-ip") || null;
    const userAgent = request.headers.get("user-agent") || null;
    const createdAt = new Date().toISOString();

    // Insert into D1 (idempotent, avoids duplicates)
    const stmt = env.DB.prepare(`
      INSERT INTO waitlist (email, role, fleet_size, company_name, created_at, ip, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO NOTHING;
    `);

    const result = await stmt
      .bind(email, role, fleetSize, companyName, createdAt, ip, userAgent)
      .run();

    const inserted = result?.meta?.changes === 1;

    // Send confirmation email only if this is a new signup
    if (inserted) {
      const apiKey = env.RESEND_API_KEY;
      if (!apiKey) {
        throw new Error("Missing RESEND_API_KEY (Pages secret).");
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
        text, // ✅ plain-text fallback included
      });
    }

    return json(200, {
      ok: true,
      message: inserted
        ? "You're on the list ✅ (check your inbox)"
        : "You're already on the list ✅",
    });
  } catch (err) {
    return json(500, { ok: false, error: err?.message || "Server error" });
  }
}

