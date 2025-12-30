import { log } from "../../lib/log.js";

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

/**
 * Phase 1: request returns fast after INSERT + enqueue
 * Phase 2: queue consumer sends email + updates DB fields + (optional) stats
 *
 * Timing:
 * - insertMs measured always
 * - statsUpdateMs measured only if env.SYNC_STATS_TIMING === "1"
 *   (use this temporarily to prove whether stats update contributes to slowness)
 */
export async function onRequestPost({ request, env }) {
  const rid = crypto.randomUUID();
  const t0 = Date.now();

  let insertMs = null;
  let statsUpdateMs = null;
  let enqueueMs = null;

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

    // =========================
    // INSERT (timed separately)
    // =========================
    log("waitlist.db.insert.start", { rid });
    const tIns0 = Date.now();

    try {
      await env.DB.prepare(
        `INSERT INTO waitlist (email, role, fleet_size, company_name, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(email, role, fleetSize, companyName, ip, userAgent).run();

      insertMs = Date.now() - tIns0;
      log("waitlist.db.insert.ok", { rid, insertMs });
    } catch (e) {
      insertMs = Date.now() - tIns0;
      const msg = String(e?.message || e);
      const isDup =
        msg.includes("UNIQUE constraint failed") || msg.toLowerCase().includes("unique");

      const totalMs = Date.now() - t0;

      if (isDup) {
        log("waitlist.duplicate", { rid, insertMs });
        log("waitlist.result", { rid, status: "already_joined", insertMs, totalMs });
        return json(
          200,
          { ok: true, status: "already_joined", message: "You're already on the list ✅", rid },
          { "x-request-id": rid }
        );
      }

      log("waitlist.db.insert.fail", { rid, insertMs, error: msg.slice(0, 300) });
      log("waitlist.result", { rid, status: "db_error", insertMs, totalMs });

      return json(500, { ok: false, error: "Database error. Please try again.", rid }, { "x-request-id": rid });
    }

    // ==========================================
    // OPTIONAL: measure stats update synchronously
    // (use temporarily to quantify its cost)
    // ==========================================
    if (env.SYNC_STATS_TIMING === "1") {
      log("waitlist.db.stats_update.start", { rid });
      const tStat0 = Date.now();

      try {
        await env.DB.prepare(
          `UPDATE waitlist_stats SET count = count + 1 WHERE id = 1`
        ).run();

        statsUpdateMs = Date.now() - tStat0;
        log("waitlist.db.stats_update.ok", { rid, statsUpdateMs });
      } catch (e) {
        statsUpdateMs = Date.now() - tStat0;
        log("waitlist.db.stats_update.fail", { rid, statsUpdateMs, error: String(e?.message || e).slice(0, 300) });
        // IMPORTANT: we do NOT fail the request if stats update fails.
      }
    }

    // =========================
    // Phase 2: enqueue background job
    // =========================
    if (!env.WAITLIST_EMAIL_QUEUE) {
      const totalMs = Date.now() - t0;
      log("waitlist.queue.missing", { rid });
      log("waitlist.result", { rid, status: "joined_queue_missing", insertMs, statsUpdateMs, totalMs });

      return json(
        200,
        {
          ok: true,
          status: "joined_queue_missing",
          message: "You're on the list ✅ (email system is being set up)",
          rid,
        },
        { "x-request-id": rid }
      );
    }

    log("waitlist.queue.send.start", { rid });

    const tQ0 = Date.now();
    await env.WAITLIST_EMAIL_QUEUE.send({
      rid,
      email,
      role,
      fleetSize,
      companyName,
      // Also allow consumer to optionally do stats update:
      doStatsUpdate: env.SYNC_STATS_TIMING !== "1", // if we didn't do it here, do it in background
    });
    enqueueMs = Date.now() - tQ0;

    log("waitlist.email.enqueued", {
      rid,
      enqueueMs,
      toDomain: email.split("@")[1] || null,
    });

    // Nice for support visibility: mark queued (best effort)
    try {
      await env.DB.prepare(
        `UPDATE waitlist SET email_status = ? WHERE email = ?`
      ).bind("queued", email).run();
    } catch (e) {
      log("waitlist.email.status_write.fail", { rid, error: String(e?.message || e).slice(0, 300) });
    }

    // =========================
    // Phase 1: return fast
    // =========================
    const totalMs = Date.now() - t0;
    log("waitlist.result", {
      rid,
      status: "joined",
      insertMs,
      statsUpdateMs,
      enqueueMs,
      totalMs,
    });

    return json(
      200,
      {
        ok: true,
        status: "joined",
        message: "You're on the list ✅ (check your inbox soon)",
        rid,
      },
      { "x-request-id": rid }
    );
  } catch (err) {
    const totalMs = Date.now() - t0;
    log("waitlist.unhandled.fail", { rid, error: String(err?.message || err).slice(0, 300), totalMs });

    return json(500, { ok: false, error: "Server error", rid }, { "x-request-id": rid });
  }
}

