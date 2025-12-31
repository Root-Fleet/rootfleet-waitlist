import { log } from "./log.js";

/**
 * Minimal Upstash Redis REST client.
 * Upstash REST:
 *  - Auth: Authorization: Bearer <TOKEN>
 *  - Response: { result: ... } or { error: ..., status: ... }
 */
export async function redisCmd(env, command, ...args) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("missing_upstash_env");
  }

  const base = env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, "");
  const path = [command, ...args].map((x) => encodeURIComponent(String(x))).join("/");
  const url = `${base}/${path}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.error) {
    const msg = data?.error || `upstash_error_${res.status}`;
    log("redis.error", { command, msg: String(msg).slice(0, 200) });
    throw new Error(msg);
  }

  return data.result;
}
