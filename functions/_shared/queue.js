import { redisCmd } from "./redis.js";

const QKEY = "q:waitlist-email";

/**
 * Pure/testable cores (tests inject redisCmdImpl).
 */
export async function _enqueueWaitlistEmailCore(redisCmdImpl, env, payload) {
  return redisCmdImpl(env, "lpush", QKEY, JSON.stringify(payload));
}

export async function _dequeueWaitlistEmailCore(redisCmdImpl, env) {
  const raw = await redisCmdImpl(env, "rpop", QKEY);
  return raw ? JSON.parse(raw) : null;
}

export async function _queueLengthCore(redisCmdImpl, env) {
  return redisCmdImpl(env, "llen", QKEY);
}

/**
 * Production wrappers (same API as before).
 */
export async function enqueueWaitlistEmail(env, payload) {
  return _enqueueWaitlistEmailCore(redisCmd, env, payload);
}

export async function dequeueWaitlistEmail(env) {
  return _dequeueWaitlistEmailCore(redisCmd, env);
}

export async function queueLength(env) {
  return _queueLengthCore(redisCmd, env);
}
