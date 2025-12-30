import { log } from "./lib/log.js";
import { sendResendEmail } from "./lib/resend.js";
import { buildWaitlistConfirmationEmail } from "./templates/waitlistConfirmationEmail.js";

export default {
  async queue(batch, env) {
    for (const msg of batch.messages) {
      const job = msg.body || {};

      const rid = job.rid || crypto.randomUUID();
      const email = String(job.email || "").trim().toLowerCase();
      const role = String(job.role || "").trim();
      const fleetSize = String(job.fleetSize || "").trim();
      const companyName = job.companyName ?? null;
      const doStatsUpdate = job.doStatsUpdate === true;

      const t0 = Date.now();
      let resendMs = null;
      let statusWriteMs = null;
      let statsUpdateMs = null;

      try {
        if (!env.RESEND_API_KEY) {
          log("consumer.email.skipped", { rid, reason: "missing_resend_api_key" });

          const tS0 = Date.now();
          await env.DB.prepare(`UPDATE waitlist SET email_status = ? WHERE email = ?`)
            .bind("skipped", email)
            .run();
          statusWriteMs = Date.now() - tS0;

          if (doStatsUpdate) {
            const tSt0 = Date.now();
            await env.DB.prepare(`UPDATE waitlist_stats SET count = count + 1 WHERE id = 1`).run();
            statsUpdateMs = Date.now() - tSt0;
          }

          log("consumer.result", { rid, status: "skipped", statusWriteMs, statsUpdateMs, totalMs: Date.now() - t0 });
          msg.ack();
          continue;
        }

        const from = env.RESEND_FROM || "Rootfleet <noreply@rootfleet.com>";
        const { subject, html, text } = buildWaitlistConfirmationEmail({
          email,
          role,
          fleetSize,
          companyName,
        });

        const resendStart = Date.now();
        const result = await sendResendEmail({
          rid,
          apiKey: env.RESEND_API_KEY,
          from,
          to: email,
          subject,
          html,
          text,
        });
        resendMs = Date.now() - resendStart;

        const resendId = result?.id || null;

        const tS0 = Date.now();
        await env.DB.prepare(
          `UPDATE waitlist
           SET resend_message_id = ?,
               email_status = ?,
               email_error = NULL,
               email_sent_at = datetime('now')
           WHERE email = ?`
        ).bind(resendId, "sent", email).run();
        statusWriteMs = Date.now() - tS0;

        if (doStatsUpdate) {
          const tSt0 = Date.now();
          await env.DB.prepare(`UPDATE waitlist_stats SET count = count + 1 WHERE id = 1`).run();
          statsUpdateMs = Date.now() - tSt0;
        }

        log("consumer.result", {
          rid,
          status: "sent",
          resendId,
          resendMs,
          statusWriteMs,
          statsUpdateMs,
          totalMs: Date.now() - t0,
        });

        msg.ack();
      } catch (e) {
        const errMsg = String(e?.message || e).slice(0, 300);

        log("consumer.fail", { rid, error: errMsg, resendMs, statusWriteMs, statsUpdateMs, totalMs: Date.now() - t0 });

        // Best-effort: persist failure state
        try {
          const tS0 = Date.now();
          await env.DB.prepare(
            `UPDATE waitlist SET email_status = ?, email_error = ? WHERE email = ?`
          ).bind("failed", errMsg, email).run();
          statusWriteMs = Date.now() - tS0;
        } catch {}

        // Retry (at-least-once)
        msg.retry();
      }
    }
  },
};

