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
  log("resend.send.start", {
    rid,
    toDomain: typeof to === "string" && to.includes("@") ? to.split("@")[1] : null,
  });

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

  if (!res.ok) {
    log("resend.send.fail", {
      rid,
      status: res.status,
      bodyPreview: raw ? raw.slice(0, 300) : "",
    });
    throw new Error(`Resend error (${res.status}): ${raw}`);
  }

  log("resend.send.ok", {
    rid,
    status: res.status,
    id: parsed?.id || null,
  });

  return parsed || {};
}


