import { log } from "./log.js";

export async function sendResendEmail({
  rid,
  apiKey,
  from,
  to,
  subject,
  html,
  text,
}) {
  const t0 = Date.now();

  const toDomain =
    typeof to === "string" && to.includes("@") ? to.split("@")[1] : null;

  log("resend.send.start", { rid, toDomain });

  const res = await fetch("https://api.resend.com/emails", {
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

  const resendMs = Date.now() - t0;

  if (!res.ok) {
    log("resend.send.fail", {
      rid,
      resendMs,
      status: res.status,
      bodyPreview: raw ? raw.slice(0, 300) : "",
    });
    throw new Error(`Resend error (${res.status}): ${raw}`);
  }

  log("resend.send.ok", {
    rid,
    resendMs,
    status: res.status,
    id: parsed?.id || null,
  });

  return parsed || {};
}


