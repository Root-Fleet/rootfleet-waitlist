import { log } from "../../../src/shared/log.js";
import { processWaitlistEmailJob } from "../../../src/shared/waitlistEmailJob.js";

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders },
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

const ALLOWED_ROLES = new Set(["fleet_owner", "operations", "fleet_staff", "engineer", "other"]);
const ALLOWED_FLEET_SIZES = new Set(["1-5", "6-20", "21-100", "101-500", "500+"]);

export async function onRequestPost({ request, env, ctx }) {
  const rid = crypto.randomUUID();
  const t0 = Date.now();

  let insertMs = null;

  const url = new URL(request.url);
  const path = url.pathname;

  const ip = getClientIp(request);
  const userAgent = request.headers.get("User-Agent") || null;

  log("waitlist.request", { rid, method: request.method, path, ip, ua: userAgent });

  try {
    const body = await request.json().catch(() => ({}));

    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim();
    const fleetSize = String(body.fleetSize || "").trim();

    const companyNameRaw = body.companyName == null ? "" : String(body.companyName);
    const companyName = companyNameRaw.trim() ? companyNameRaw.trim() : null;

    log("waitlist.parsed", {
      rid,
      role,
      fleetSize,
      hasCompanyName: !!companyName,
      emailDomain: email.includes("@") ? email.split("@")[1] : null,
    });

    // Validate
    if (!isValidEmail(email)) {
      log("waitlist.validation.fail", { rid, field: "email" });
      return json(400, { ok: false, error: "Please enter a valid email.", rid }, { "x-request-id": rid });
    }
    if (!ALLOWED_ROLES.has(role)) {
      log("waitlist.validation.fail", { rid, field: "role" });
      return json(400, { ok: false, error: "Please select a valid role.", rid }, { "x-request-id": rid });
    }
    if (!ALLOWED_FLEET_SIZES.has(fleetSize)) {
      log("waitlist.validation.fail", { rid, field: "fleetSize" });
      return json(400, { ok: false, error: "Please select a valid fleet size.", rid }, { "x-request-id": rid });
    }

    // INSERT (timed) – mark email pending
    log("waitlist.db.insert.start", { rid });
    const tIns0 = Date.now();

    try {
      await env.DB.prepare(
        `INSERT INTO waitlist (
          email, role, fleet_size, company_name, created_at, ip, user_agent,
          email_status, email_attempts, next_email_attempt_at
        )
        VALUES (?, ?, ?, ?, datetime('now'), ?, ?, 'pending', 0, NULL)`
      ).bind(email, role, fleetSize, companyName, ip, userAgent).run();

      insertMs = Date.now() - tIns0;
      log("waitlist.db.insert.ok", { rid, insertMs });
    } catch (e) {
      insertMs = Date.now() - tIns0;
      const msg = String(e?.message || e);
      const isDup = msg.includes("UNIQUE constraint failed") || msg.toLowerCase().includes("unique");

      const totalMs = Date.now() - t0;

      if (isDup) {
        log("waitlist.duplicate", { rid, insertMs });
        log("waitlist.result", { rid, status: "already_joined", insertMs, totalMs });
        return json(200, { ok: true, status: "already_joined", message: "You're already on the list ✅", rid }, { "x-request-id": rid });
      }

      log("waitlist.db.insert.fail", { rid, insertMs, error: msg.slice(0, 300) });
      log("waitlist.result", { rid, status: "db_error", insertMs, totalMs });

      return json(500, { ok: false, error: "Database error. Please try again.", rid }, { "x-request-id": rid });
    }

    // HYBRID: best-effort immediate send WITHOUT blocking response
    ctx.waitUntil(
      (async () => {
        log("waitlist.email.best_effort.start", { rid });
        const result = await processWaitlistEmailJob(env, { rid, email, role, fleetSize, companyName });
        log("waitlist.email.best_effort.end", { rid, resultStatus: result.status });
      })()
    );

    const totalMs = Date.now() - t0;
    log("waitlist.result", { rid, status: "joined", insertMs, totalMs });

    return json(
      200,
      { ok: true, status: "joined", message: "You're on the list ✅ (check your inbox soon)", rid },
      { "x-request-id": rid }
    );
  } catch (err) {
    const totalMs = Date.now() - t0;
    log("waitlist.unhandled.fail", { rid, error: String(err?.message || err).slice(0, 300), totalMs });
    return json(500, { ok: false, error: "Server error", rid }, { "x-request-id": rid });
  }
}

