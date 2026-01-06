import { log } from "../../_shared/log.js";
import { _redisCmdCore } from "../../_shared/redis.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * Core (unit-testable): inject uuid/now/log and checkers.
 */
export async function _healthGetCore(
  { env, request },
  {
    now = () => Date.now(),
    isoNow = () => new Date().toISOString(),
    uuid = () => crypto.randomUUID(),
    logImpl = log,
    // dependency-injected checkers (tests can override)
    checkD1,
    checkRedis,
  } = {}
) {
  const rid = uuid();
  const t0 = now();

  const url = new URL(request?.url || "http://local/health");
  const deep = url.searchParams.get("deep") === "1";

  // Basic environment/meta
  const environment = env?.ENVIRONMENT ?? "unknown";
  const version =
    env?.GIT_SHA || env?.VERSION || env?.CF_PAGES_COMMIT_SHA || null;

  // Config checks (do not fail health, but useful signals)
  const resendConfigured = Boolean(env?.RESEND_API_KEY);
  const upstashConfigured = Boolean(env?.UPSTASH_REDIS_REST_URL && env?.UPSTASH_REDIS_REST_TOKEN);

  // Critical binding check: D1 must be bound for this app to function
  const d1Bound = Boolean(env?.DB);

  const checks = {
    deep,
    d1: {
      bound: d1Bound,
      ok: d1Bound, // may be overwritten by deep check
      latencyMs: null,
      mode: deep ? "ping" : "binding_only",
      error: null,
    },
    resend: {
      configured: resendConfigured,
    },
    redis: {
      configured: upstashConfigured,
      ok: upstashConfigured ? true : null, // becomes boolean on deep ping
      latencyMs: null,
      mode: deep ? "ping" : "config_only",
      error: null,
    },
  };

  const warnings = [];

  if (!resendConfigured) warnings.push("resend_not_configured");
  if (!upstashConfigured) warnings.push("upstash_not_configured");

  // If D1 missing, we fail immediately with 503
  if (!d1Bound) {
    checks.d1.ok = false;
    checks.d1.error = "d1_not_bound";
    const totalMs = now() - t0;

    logImpl("health.fail", { rid, environment, reason: "d1_not_bound", deep, totalMs });

    return json(503, {
      ok: false,
      rid,
      ts: isoNow(),
      environment,
      version,
      totalMs,
      checks,
      warnings,
    });
  }

  // Deep checks (only if deep=1)
  if (deep) {
    // D1 ping
    const d1Checker =
      checkD1 ||
      (async () => {
        const q0 = now();
        await env.DB.prepare("SELECT 1 AS one").first();
        return { ok: true, latencyMs: now() - q0 };
      });

    try {
      const r = await d1Checker();
      checks.d1.ok = Boolean(r?.ok);
      checks.d1.latencyMs = Number.isFinite(r?.latencyMs) ? r.latencyMs : null;
      if (!checks.d1.ok) checks.d1.error = "d1_ping_failed";
    } catch (e) {
      checks.d1.ok = false;
      checks.d1.error = String(e?.message || e).slice(0, 200);
    }

    // Redis ping (optional)
    if (upstashConfigured) {
      const redisChecker =
        checkRedis ||
        (async () => {
          const q0 = now();
          // Uses your existing Upstash REST client core; inject fetch in tests if needed.
          await _redisCmdCore(env, "ping", [], { fetchImpl: fetch, logImpl });
          return { ok: true, latencyMs: now() - q0 };
        });

      try {
        const r = await redisChecker();
        checks.redis.ok = Boolean(r?.ok);
        checks.redis.latencyMs = Number.isFinite(r?.latencyMs) ? r.latencyMs : null;
        if (!checks.redis.ok) checks.redis.error = "redis_ping_failed";
      } catch (e) {
        checks.redis.ok = false;
        checks.redis.error = String(e?.message || e).slice(0, 200);
      }
    }
  }

  // Final health decision:
  // - D1 binding is critical
  // - if deep=1, D1 ping must succeed too
  const ok = deep ? checks.d1.ok === true : d1Bound === true;
  const status = ok ? 200 : 503;

  const totalMs = now() - t0;

  logImpl(ok ? "health.ok" : "health.fail", {
    rid,
    environment,
    deep,
    totalMs,
    d1Ok: checks.d1.ok,
    redisOk: checks.redis.ok,
  });

  return json(status, {
    ok,
    rid,
    ts: isoNow(),
    environment,
    version,
    totalMs,
    checks,
    warnings,
  });
}

/**
 * Production handler (unchanged signature)
 */
export async function onRequestGet(ctx) {
  return _healthGetCore(ctx);
}
