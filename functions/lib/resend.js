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
  // Start log (good for tracing slow/failing provider calls)
  log("resend.send.start", {
    rid,
    fromDomain: typeof from === "string" && from.includes("@") ? from.split("@")[1]?.replace(">", "") : null,
    toDomain: typeof to === "string" && to.includes("@") ? to.split("@")[1] : null,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  // Resend may return JSON or text; read as text once, then parse if possible.
  const raw = await res.text().catch(() => "");

  let parsed = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    // Log failure with provider status + short response preview
    log("resend.send.fail", {
      rid,
      status: res.status,
      bodyPreview: raw ? raw.slice(0, 300) : "",
    });

    throw new Error(`Resend error (${res.status}): ${raw}`);
  }

  // Log success; Resend often returns an id
  log("resend.send.ok", {
    rid,
    status: res.status,
    id: parsed?.id || null,
  });

  // Maintain compatibility with your old return shape
  return parsed || {};
}


