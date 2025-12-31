import { log } from "../../../functions/_shared/log.js";
import { dequeueWaitlistEmail, enqueueWaitlistEmail, queueLength } from "../../../functions/_shared/queue.js";
import { processWaitlistEmailJob } from "../../../functions/_shared/waitlistEmailJob.js";

async function drain(env, ctx, limit) {
  const rid = crypto.randomUUID();
  const t0 = Date.now();

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    const job = await dequeueWaitlistEmail(env);
    if (!job) break;

    try {
      await processWaitlistEmailJob(job, env, ctx);
      processed++;
    } catch (e) {
      failed++;
      log("consumer.job.fail", {
        rid,
        error: String(e?.message || e).slice(0, 200),
      });

      // Re-enqueue so we don't lose jobs.
      // Your D1 "claim" makes this safe (idempotent).
      try {
        await enqueueWaitlistEmail(env, job);
      } catch (reErr) {
        log("consumer.reenqueue.fail", {
          rid,
          error: String(reErr?.message || reErr).slice(0, 200),
        });
      }
    }
  }

  const remaining = await queueLength(env).catch(() => null);
  log("consumer.drain.done", {
    rid,
    processed,
    failed,
    remaining,
    totalMs: Date.now() - t0,
  });

  return { processed, failed, remaining };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/trigger") {
      const secret = request.headers.get("x-trigger-secret");
      if (!secret || secret !== env.TRIGGER_SECRET) {
        return new Response("unauthorized", { status: 401 });
      }

      const limit = Number(env.DRAIN_BATCH_SIZE || 10);
      const result = await drain(env, ctx, limit);

      return new Response(JSON.stringify({ ok: true, ...result }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    return new Response("not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    const limit = Number(env.DRAIN_BATCH_SIZE || 10);
    await drain(env, ctx, limit);
  },
};

