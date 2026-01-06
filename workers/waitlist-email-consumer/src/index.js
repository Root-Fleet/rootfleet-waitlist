import { log } from "../../../functions/_shared/log.js";
import {
  dequeueWaitlistEmail,
  enqueueWaitlistEmail,
  queueLength,
} from "../../../functions/_shared/queue.js";
import { processWaitlistEmailJob } from "../../../functions/_shared/waitlistEmailJob.js";

/**
 * Core drain (unit-testable via injected deps)
 */
export async function _drainCore(
  env,
  ctx,
  limit,
  source,
  {
    uuid = () => crypto.randomUUID(),
    now = () => Date.now(),
    logImpl = log,
    dequeueImpl = dequeueWaitlistEmail,
    enqueueImpl = enqueueWaitlistEmail,
    lengthImpl = queueLength,
    processImpl = processWaitlistEmailJob,
  } = {}
) {
  const rid = uuid();
  const t0 = now();

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < limit; i++) {
    const job = await dequeueImpl(env);
    if (!job) break;

    const jobWithSource = {
      ...job,
      emailSource: source,
    };

    try {
      await processImpl(jobWithSource, env, ctx);
      processed++;
    } catch (e) {
      failed++;
      logImpl("consumer.job.fail", {
        rid,
        source,
        error: String(e?.message || e).slice(0, 200),
      });

      try {
        await enqueueImpl(env, jobWithSource);
      } catch (reErr) {
        logImpl("consumer.reenqueue.fail", {
          rid,
          source,
          error: String(reErr?.message || reErr).slice(0, 200),
        });
      }
    }
  }

  const remaining = await lengthImpl(env).catch(() => null);

  logImpl("consumer.drain.done", {
    rid,
    source,
    processed,
    failed,
    remaining,
    totalMs: now() - t0,
  });

  return { processed, failed, remaining, source };
}

/**
 * Core fetch handler (unit-testable)
 */
export async function _fetchCore(
  request,
  env,
  ctx,
  {
    drainImpl = _drainCore,
  } = {}
) {
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
    const result = await drainImpl(env, ctx, limit, "trigger");

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  return new Response("not found", { status: 404 });
}

/**
 * Core scheduled handler (unit-testable)
 */
export async function _scheduledCore(
  event,
  env,
  ctx,
  {
    drainImpl = _drainCore,
  } = {}
) {
  const limit = Number(env.DRAIN_BATCH_SIZE || 10);
  await drainImpl(env, ctx, limit, "cron");
}

export default {
  async fetch(request, env, ctx) {
    return _fetchCore(request, env, ctx);
  },

  async scheduled(event, env, ctx) {
    return _scheduledCore(event, env, ctx);
  },
};


