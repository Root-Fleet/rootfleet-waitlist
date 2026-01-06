import { log } from "./log.js";

/**
 * Pure/testable core.
 */
export async function _redisCmdCore(env, command, args, { fetchImpl, logImpl } = {}) {
  if (!env?.UPSTASH_REDIS_REST_URL || !env?.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("missing_upstash_env");
  }

  const base = String(env.UPSTASH_REDIS_REST_URL).replace(/\/+$/, "");
  const path = [command, ...args]
    .map((x) => encodeURIComponent(String(x)))
    .join("/");
  const url = `${base}/${path}`;

  const res = await (fetchImpl || fetch)(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.error) {
    const msg = data?.error || `upstash_error_${res.status}`;
    (logImpl || log)("redis.error", { command, msg: String(msg).slice(0, 200) });
    throw new Error(msg);
  }

  return data.result;
}

/**
 * Production wrapper (same API/signature as before).
 */
export async function redisCmd(env, command, ...args) {
  return _redisCmdCore(env, command, args, { fetchImpl: fetch, logImpl: log });
}

