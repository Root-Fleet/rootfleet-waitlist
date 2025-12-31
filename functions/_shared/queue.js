import { redisCmd } from "./redis.js";

const QKEY = "q:waitlist-email";

export async function enqueueWaitlistEmail(env, payload) {
  // LPUSH queueKey <json>
  return redisCmd(env, "lpush", QKEY, JSON.stringify(payload));
}

export async function dequeueWaitlistEmail(env) {
  // RPOP queueKey -> <json|null>
  const raw = await redisCmd(env, "rpop", QKEY);
  return raw ? JSON.parse(raw) : null;
}

export async function queueLength(env) {
  return redisCmd(env, "llen", QKEY);
}
