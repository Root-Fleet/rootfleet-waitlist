import { log } from "./log.js";

/**
 * Pure/testable core. Unit tests call this directly with injected deps.
 */
export async function _sendResendEmailCore(
  { rid, apiKey, from, to, subject, html, text },
  { fetchImpl, logImpl, now }
) {
  const t0 = now();

  const toDomain =
    typeof to === "string" && to.includes("@") ? to.split("@")[1] : null;

  logImpl("resend.send.start", { rid, toDomain });

  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  const raw = await res.text().catch(() => "");
  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const resendMs = now() - t0;

  if (!res.ok) {
    logImpl("resend.send.fail", {
      rid,
      resendMs,
      status: res.status,
      bodyPreview: raw ? raw.slice(0, 300) : "",
    });
    throw new Error(`Resend error (${res.status}): ${raw}`);
  }

  logImpl("resend.send.ok", {
    rid,
    resendMs,
    status: res.status,
    id: parsed?.id || null,
  });

  return parsed || {};
}

/**
 * Production wrapper. NO call sites need to change.
 */
export async function sendResendEmail(args) {
  return _sendResendEmailCore(args, {
    fetchImpl: fetch,
    logImpl: log,
    now: () => Date.now(),
  });
}

