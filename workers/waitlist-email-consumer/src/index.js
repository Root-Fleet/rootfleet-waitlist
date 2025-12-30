import { log } from "../../../functions/_shared/log.js";
import { processWaitlistEmailJob } from "../../../functions/_shared/waitlistEmailJob.js";

export default {
  /**
   * Required so `wrangler dev` can start an HTTP server.
   * This worker is background-focused, so this is just a health check.
   */
  async fetch(request, env, ctx) {
    return new Response("waitlist-email-consumer running ✅", {
      status: 200,
    });
  },

  /**
   * Queue consumer
   */
  async queue(batch, env, ctx) {
    for (const message of batch.messages) {
      try {
        await processWaitlistEmailJob(message.body, env, ctx);
        message.ack();
      } catch (err) {
        log("queue job failed", {
          error: err?.message ?? err,
          body: message.body,
        });

        // Let Cloudflare retry the message
        message.retry();
      }
    }
  },

  /**
   * Scheduled / cron handler (optional)
   */

  async scheduled(event, env, ctx) {
    log("scheduled tick", { cron: event.cron });
  },
};

