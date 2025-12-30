import { log } from "../../lib/log.js";
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
  const rid = crypto.randomUUID();
  const url = new URL(request.url);
  const path = url.pathname;

  const ip = getClientIp(request);
  const userAgent = request.headers.get("User-Agent") || null;

  log("waitlist.request", {
    rid,
    method: request.method,
    path,
    ip,
    ua: userAgent,
  });

  try {
    const body = await request.json().catch(() => ({}));

    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();
    const fleetSize = String(body.fleetSize || "").trim();

    const companyNameRaw =
      body.companyName == null ? "" : String(body.companyName);
    const companyName = companyNameRaw.trim() ? companyNameRaw.trim() : null;

    log("waitlist.parsed", {
      rid,
      role,
      fleetSize,
      hasCompanyName: !!companyName,
      emailDomain: email.includes("@") ? email.split("@")[1] : null,
    });

    // Validate input
    if (!isValidEmail(email)) {
      log("waitlist.validation.fail", { rid, field: "email" });
      return json(
        400,
        { ok: false, error: "Please enter a valid email.", rid },
        { "x-request-id": rid }
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      log("waitlist.validation.fail", { rid, field: "role" });
      return json(
        400,
        { ok: false, error: "Please select a valid role.", rid },
        { "x-request-id": rid }
      );
    }

    if (!ALLOWED_FLEET_SIZES.has(fleetSize)) {
      log("waitlist.validation.fail", { rid, field: "fleetSize" });
      return json(
        400,
        { ok: false, error: "Please select a valid fleet size.", rid },
        { "x-request-id": rid }
      );
    }

    // Insert + increment atomically
    log("waitlist.db.write.start", { rid });

    try {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO waitlist (email, role, fleet_size, company_name, ip, user_agent)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(email, role, fleetSize, companyName, ip, userAgent),

        env.DB.prepare(`UPDATE waitlist_stats SET count = count + 1 WHERE id = 1`),
      ]);

      log("waitlist.db.write.ok", { rid });
    } catch (e) {
      const msg = String(e?.message || e);
      const isDup =
        msg.includes("UNIQUE constraint failed") ||
        msg.toLowerCase().includes("unique");

      if (isDup) {
        log("waitlist.duplicate", { rid });

        log("waitlist.result", { rid, status: "already_joined" });

        return json(
          200,
          {
            ok: true,
            status: "already_joined",
            message: "You're already on the list ✅",
            rid,
          },
          { "x-request-id": rid }
        );
      }

      log("waitlist.db.write.fail", { rid, error: msg.slice(0, 300) });

      log("waitlist.result", { rid, status: "db_error" });

      return json(
        500,
        { ok: false, error: "Database error. Please try again.", rid },
        { "x-request-id": rid }
      );
    }

    // Email flow (only after successful insert)
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      log("waitlist.email.skipped", { rid, reason: "missing_resend_api_key" });

      // Persist skipped status (optional but useful)
      try {
        await env.DB.prepare(
          `UPDATE waitlist
           SET email_status = ?
           WHERE email = ?`
        ).bind("skipped", email).run();
      } catch (e) {
        log("waitlist.email.status_write.fail", {
          rid,
          error: String(e?.message || e).slice(0, 300),
        });
      }

      log("waitlist.result", { rid, status: "joined_email_skipped" });

      return json(
        200,
        {
          ok: true,
          status: "joined_email_skipped",
          message: "You're on the list ✅ (email system is being set up)",
          rid,
        },
        { "x-request-id": rid }
      );
    }

    const from = env.RESEND_FROM || "Rootfleet <noreply@rootfleet.com>";

    const { subject, html, text } = buildWaitlistConfirmationEmail({
      email,
      role,
      fleetSize,
      companyName,
    });

    log("waitlist.email.send.start", {
      rid,
      toDomain: email.split("@")[1] || null,
    });

    try {
      const result = await sendResendEmail({
        rid,
        apiKey,
        from,
        to: email,
        subject,
        html,
        text,
      });

      const resendId = result?.id || null;

      // Persist message id + status
      try {
        await env.DB.prepare(
          `UPDATE waitlist
           SET resend_message_id = ?,
               email_status = ?,
               email_error = NULL,
               email_sent_at = datetime('now')
           WHERE email = ?`
        ).bind(resendId, "sent", email).run();

        log("waitlist.email.status_write.ok", { rid, resendId });
      } catch (e) {
        log("waitlist.email.status_write.fail", {
          rid,
          error: String(e?.message || e).slice(0, 300),
        });
      }

      log("waitlist.email.send.ok", { rid, resendId });

      log("waitlist.result", { rid, status: "joined", resendId });

      return json(
        200,
        {
          ok: true,
          status: "joined",
          message: "You're on the list ✅ (check your inbox)",
          rid,
          resendId,
        },
        { "x-request-id": rid }
      );
    } catch (e) {
      const errMsg = String(e?.message || e).slice(0, 300);

      log("waitlist.email.send.fail", { rid, error: errMsg });

      // Persist failure status (signup already recorded)
      try {
        await env.DB.prepare(
          `UPDATE waitlist
           SET email_status = ?,
               email_error = ?
           WHERE email = ?`
        ).bind("failed", errMsg, email).run();
      } catch (dbErr) {
        log("waitlist.email.status_write.fail", {
          rid,
          error: String(dbErr?.message || dbErr).slice(0, 300),
        });
      }

      log("waitlist.result", { rid, status: "joined_email_failed" });

      return json(
        200,
        {
          ok: true,
          status: "joined_email_failed",
          message: "You're on the list ✅ (email delivery had an issue)",
          rid,
        },
        { "x-request-id": rid }
      );
    }
  } catch (err) {
    const msg = String(err?.message || err).slice(0, 300);

    log("waitlist.unhandled.fail", { rid, error: msg });

    log("waitlist.result", { rid, status: "server_error" });

    return json(
      500,
      { ok: false, error: "Server error", rid },
      { "x-request-id": rid }
    );
  }
}

