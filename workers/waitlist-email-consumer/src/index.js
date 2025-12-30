import { log } from "../../../functions/_shared/log.js";
import { processWaitlistEmailJob } from "../../../functions/_shared/waitlistEmailJob.js";


export default {
  async scheduled(event, env, ctx) {
    const runId = crypto.randomUUID();
    const t0 = Date.now();

    log("cron.run.start", { runId, cron: event.cron });

    const batchSize = Number(env.CRON_BATCH_SIZE || 10);

    const rows = await env.DB.prepare(
      `
      SELECT email, role, fleet_size AS fleetSize, company_name AS companyName
      FROM waitlist
      WHERE (email_status IS NULL OR email_status = 'pending')
        AND (next_email_attempt_at IS NULL OR next_email_attempt_at <= datetime('now'))
      ORDER BY created_at ASC
      LIMIT ?
      `
    ).bind(batchSize).all();

    const jobs = rows?.results || [];
    log("cron.run.found", { runId, count: jobs.length });

    for (const job of jobs) {
      ctx.waitUntil(
        (async () => {
          const rid = crypto.randomUUID();
          log("cron.job.start", { runId, rid, emailDomain: domain(job.email) });
          const res = await processWaitlistEmailJob(env, { rid, ...job });
          log("cron.job.end", { runId, rid, status: res.status });
        })()
      );
    }

    log("cron.run.end", { runId, scheduledMs: Date.now() - t0 });
  },
};

function domain(email) {
  return String(email || "").includes("@") ? String(email).split("@")[1] : null;
}

