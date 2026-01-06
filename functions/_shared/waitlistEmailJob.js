import { log } from "./log.js";
import { sendResendEmail } from "./resend.js";
import { buildWaitlistConfirmationEmail } from "./templates/waitlistConfirmationEmail.js";

/**
 * Pure/testable core. Unit tests inject deps.
 */
export async function _processWaitlistEmailJobCore(
  job,
  env,
  ctx,
  {
    logImpl,
    sendResendEmailImpl,
    buildEmailImpl,
    now,
    cryptoImpl,
  } = {}
) {
  const _log = logImpl || log;
  const _send = sendResendEmailImpl || sendResendEmail;
  const _build = buildEmailImpl || buildWaitlistConfirmationEmail;
  const _now = now || (() => Date.now());
  const _crypto = cryptoImpl || crypto;

  const rid = job?.rid || _crypto.randomUUID();
  const t0 = _now();

  const email = String(job?.email || "").trim().toLowerCase();
  const role = String(job?.role || "").trim();
  const fleetSize = String(job?.fleetSize || "").trim();
  const companyName = job?.companyName ?? null;

  const emailSource =
    job?.emailSource === "trigger" || job?.emailSource === "cron"
      ? job.emailSource
      : "cron";

  if (!email) {
    _log("emailjob.invalid", { rid, reason: "missing_email" });
    return { rid, status: "invalid_job", totalMs: _now() - t0 };
  }

  // 1) claim the row (avoid duplicate sends)
  const claimRes = await env.DB.prepare(
    `UPDATE waitlist
     SET email_status = 'processing',
         email_source = ?
     WHERE email = ?
       AND (email_status IS NULL OR email_status = 'pending')
       AND Resend_message_id IS NULL`
  )
    .bind(emailSource, email)
    .run();

  const claimed = Number(claimRes?.meta?.changes || 0) === 1;
  if (!claimed) {
    _log("emailjob.claim.skip", {
      rid,
      emailDomain: domain(email),
      totalMs: _now() - t0,
    });
    return { rid, status: "skip_not_pending", totalMs: _now() - t0 };
  }

  // 2) send or mark skipped
  if (!env.RESEND_API_KEY) {
    await env.DB.prepare(
      `UPDATE waitlist
       SET email_status = 'skipped',
           email_error = 'missing_resend_api_key',
           email_source = ?
       WHERE email = ?`
    )
      .bind(emailSource, email)
      .run();

    _log("emailjob.skipped", { rid, reason: "missing_resend_api_key", totalMs: _now() - t0 });
    return { rid, status: "skipped", totalMs: _now() - t0 };
  }

  const from = env.RESEND_FROM || "Rootfleet <noreply@rootfleet.com>";
  const { subject, html, text } = _build({
    email,
    role,
    fleetSize,
    companyName,
  });

  try {
    const result = await _send({
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
           next_email_attempt_at = NULL,
           email_source = ?
       WHERE email = ?`
    )
      .bind(resendId, emailSource, email)
      .run();

    const totalMs = _now() - t0;
    _log("emailjob.sent", { rid, resendId, emailSource, totalMs });
    return { rid, status: "sent", resendId, emailSource, totalMs };
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
    const nextAt = terminal ? null : computeNextAttemptUtc(attempts, _now);

    await env.DB.prepare(
      `UPDATE waitlist
       SET email_status = ?,
           email_error = ?,
           email_attempts = ?,
           next_email_attempt_at = ?,
           email_source = ?
       WHERE email = ?`
    )
      .bind(terminal ? "failed" : "pending", errMsg, attempts, nextAt, emailSource, email)
      .run();

    const totalMs = _now() - t0;
    _log("emailjob.fail", { rid, attempts, nextAt, emailSource, error: errMsg, totalMs });
    return {
      rid,
      status: terminal ? "failed" : "pending_retry",
      attempts,
      nextAt,
      emailSource,
      totalMs,
    };
  }
}

/**
 * Production wrapper (NO call sites change).
 */
export async function processWaitlistEmailJob(job, env, ctx) {
  return _processWaitlistEmailJobCore(job, env, ctx);
}

function domain(email) {
  return email.includes("@") ? email.split("@")[1] : null;
}

function computeNextAttemptUtc(attempts, nowFn = () => Date.now()) {
  const minutes = Math.min(60, Math.pow(2, attempts - 1));
  const d = new Date(nowFn() + minutes * 60_000);

  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

