import { log } from "./log.js";
import { sendResendEmail } from "./resend.js";
import { buildWaitlistConfirmationEmail } from "./templates/waitlistConfirmationEmail.js";

/**
 * Attempts to send the waitlist email for an existing waitlist row.
 * Safe against duplicates using a "claim" update:
 * pending -> processing must succeed before sending.
 *
 * Signature is standardized for both Pages and Worker usage:
 *   processWaitlistEmailJob(job, env, ctx)
 */
export async function processWaitlistEmailJob(job, env, ctx) {
  const rid = job?.rid || crypto.randomUUID();
  const t0 = Date.now();

  const email = String(job?.email || "").trim().toLowerCase();
  const role = String(job?.role || "").trim();
  const fleetSize = String(job?.fleetSize || "").trim();
  const companyName = job?.companyName ?? null;

  if (!email) {
    log("emailjob.invalid", { rid, reason: "missing_email" });
    return { rid, status: "invalid_job", totalMs: Date.now() - t0 };
  }

  // 1) claim the row (avoid duplicate sends)
  const claimRes = await env.DB.prepare(
    `UPDATE waitlist
     SET email_status = 'processing'
     WHERE email = ?
       AND (email_status IS NULL OR email_status = 'pending')`
  )
    .bind(email)
    .run();

  const claimed = Number(claimRes?.meta?.changes || 0) === 1;
  if (!claimed) {
    log("emailjob.claim.skip", { rid, emailDomain: domain(email), totalMs: Date.now() - t0 });
    return { rid, status: "skip_not_pending", totalMs: Date.now() - t0 };
  }

  // 2) send or mark skipped
  if (!env.RESEND_API_KEY) {
    await env.DB.prepare(
      `UPDATE waitlist
       SET email_status = 'skipped',
           email_error = 'missing_resend_api_key'
       WHERE email = ?`
    )
      .bind(email)
      .run();

    log("emailjob.skipped", { rid, reason: "missing_resend_api_key", totalMs: Date.now() - t0 });
    return { rid, status: "skipped", totalMs: Date.now() - t0 };
  }

  const from = env.RESEND_FROM || "Rootfleet <noreply@rootfleet.com>";
  const { subject, html, text } = buildWaitlistConfirmationEmail({
    email,
    role,
    fleetSize,
    companyName,
  });

  try {
    const result = await sendResendEmail({
      rid,
      apiKey: env.RESEND_API_KEY,
      from,
      to: email,
      subject,
      html,
      text,
    });

    const resendId = result?.id || null;

    // 3) persist success
    await env.DB.prepare(
      `UPDATE waitlist
       SET resend_message_id = ?,
           email_status = 'sent',
           email_error = NULL,
           email_sent_at = datetime('now'),
           email_attempts = COALESCE(email_attempts, 0),
           next_email_attempt_at = NULL
       WHERE email = ?`
    )
      .bind(resendId, email)
      .run();

    const totalMs = Date.now() - t0;
    log("emailjob.sent", { rid, resendId, totalMs });
    return { rid, status: "sent", resendId, totalMs };
  } catch (e) {
    const errMsg = String(e?.message || e).slice(0, 300);

    // 4) backoff retry
    const row = await env.DB.prepare(
      `SELECT COALESCE(email_attempts, 0) AS attempts FROM waitlist WHERE email = ?`
    )
      .bind(email)
      .first();

    const attempts = Number(row?.attempts || 0) + 1;

    const terminal = attempts >= 5;
    const nextAt = terminal ? null : computeNextAttemptUtc(attempts);

    await env.DB.prepare(
      `UPDATE waitlist
       SET email_status = ?,
           email_error = ?,
           email_attempts = ?,
           next_email_attempt_at = ?
       WHERE email = ?`
    )
      .bind(terminal ? "failed" : "pending", errMsg, attempts, nextAt, email)
      .run();

    const totalMs = Date.now() - t0;
    log("emailjob.fail", { rid, attempts, nextAt, error: errMsg, totalMs });
    return { rid, status: terminal ? "failed" : "pending_retry", attempts, nextAt, totalMs };
  }
}

function domain(email) {
  return email.includes("@") ? email.split("@")[1] : null;
}

function computeNextAttemptUtc(attempts) {
  const minutes = Math.min(60, Math.pow(2, attempts - 1));
  const d = new Date(Date.now() + minutes * 60_000);

  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
